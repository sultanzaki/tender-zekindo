import { before, after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
let api, directory;
const key = "__zekindoAuthSecurity";
before(async () => {
  directory = await mkdtemp(path.resolve("node_modules/.auth-tests-"));
  const mocks = {
    "server-only": "",
    react: "export const cache=fn=>fn;",
    "next/navigation":
      "export function redirect(path){throw new Error('REDIRECT:'+path);}",
    "next/headers": `export async function headers(){return new Headers({'x-workspace-path':globalThis.${key}.path});}export async function cookies(){return {get(){return {value:globalThis.${key}.token};},set(name,value,options){globalThis.${key}.cookie={name,value,options};},delete(){globalThis.${key}.deleted=true;}};}`,
    "../supabase-server": `export function supabaseServer(){return {from(table){const query={table,operation:'select'};const chain={select(){return chain;},insert(payload){query.operation='insert';query.payload=payload;return chain;},delete(){query.operation='delete';return chain;},eq(key,value){query[key]=value;return chain;},maybeSingle(){return chain;},then(resolve,reject){const state=globalThis.${key};state.calls.push(query);return Promise.resolve({data:table==='sessions'?state.session:state.profile,error:state.error??null}).then(resolve,reject);}};return chain;}};}`,
  };
  await build({
    stdin: {
      contents:
        "export * from './src/lib/auth/session.ts'; export * from './src/lib/auth/dal.ts'; export * from './src/lib/auth/login-throttle.ts';",
      resolveDir: process.cwd(),
    },
    outfile: path.join(directory, "auth.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "auth-fixtures",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(server-only|react|next\/(navigation|headers)|\.\.\/supabase-server)$/,
            },
            (args) => ({ path: args.path, namespace: "fixture" }),
          );
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  api = await import(pathToFileURL(path.join(directory, "auth.mjs")));
});
beforeEach(() => {
  globalThis[key] = {
    token: "a".repeat(43),
    session: { user_id: "viewer", expires_at: "2099-01-01T00:00:00Z" },
    profile: {
      id: "viewer",
      name: "Viewer",
      email: "viewer@example.test",
      role: "viewer",
    },
    path: "/tenders?track=all&search=hello",
    calls: [],
  };
});
after(async () => {
  delete globalThis[key];
  if (directory) await rm(directory, { recursive: true, force: true });
});
test("missing and malformed session tokens never query the database", async () => {
  for (const token of [
    undefined,
    "",
    "forged",
    "a".repeat(10000),
    "!".repeat(43),
  ]) {
    globalThis[key].token = token;
    assert.equal(await api.getSessionUserId(), null);
  }
  assert.equal(globalThis[key].calls.length, 0);
});
test("expired, revoked, missing-user and invalid-date sessions fail closed", async () => {
  for (const session of [
    null,
    { user_id: "viewer", expires_at: "2000-01-01" },
    { user_id: "viewer", expires_at: "invalid" },
    { user_id: "", expires_at: "2099-01-01" },
    { user_id: "viewer", expires_at: null },
  ]) {
    globalThis[key].session = session;
    assert.equal(await api.getSessionUserId(), null);
  }
  globalThis[key].error = { message: "Database unavailable" };
  assert.equal(await api.getSessionUserId(), null);
});
test("authentication rejects deleted profiles and unknown roles", async () => {
  for (const profile of [null, { id: "viewer", role: "owner" }]) {
    globalThis[key].profile = profile;
    assert.equal(await api.getAuthContext(), null);
  }
});
test("requireUser preserves internal return URLs and requireAdmin rejects a viewer", async () => {
  await assert.rejects(api.requireAdmin(), /REDIRECT:\/$/);
  globalThis[key].token = undefined;
  await assert.rejects(
    api.requireUser(),
    /REDIRECT:\/login\?next=%2Ftenders%3Ftrack%3Dall%26search%3Dhello/,
  );
});
test("sessions store only token hashes and set protective cookie flags", async () => {
  await api.createSession("viewer");
  const state = globalThis[key],
    insert = state.calls.find((call) => call.operation === "insert");
  assert.match(state.cookie.value, /^[A-Za-z0-9_-]{43}$/);
  assert.match(insert.payload.id, /^[a-f0-9]{64}$/);
  assert.notEqual(insert.payload.id, state.cookie.value);
  assert.equal(state.cookie.options.httpOnly, true);
  assert.equal(state.cookie.options.sameSite, "lax");
  assert.equal(state.cookie.options.path, "/");
  assert.equal(
    state.cookie.options.secure,
    process.env.NODE_ENV === "production",
  );
});
test("failed session revocation is reported instead of silently claiming logout or reset", async () => {
  globalThis[key].error = { message: "Fixture failure" };
  await assert.rejects(api.destroySession(), /Unable to revoke/);
  assert.equal(globalThis[key].deleted, undefined);
  await assert.rejects(
    api.destroyAllSessionsForUser("viewer"),
    /Unable to revoke/,
  );
});
test("login throttle reserves concurrent attempts, expires and resets after success", () => {
  const email = "throttle@example.test",
    now = Date.now();
  for (let i = 0; i < 10; i++)
    assert.equal(api.reserveLoginAttempt(email, now), true);
  assert.equal(api.reserveLoginAttempt(email, now), false);
  assert.equal(api.reserveLoginAttempt(email, now + 15 * 60 * 1000), true);
  api.clearLoginAttempts(email);
  assert.equal(api.reserveLoginAttempt(email, now), true);
});
