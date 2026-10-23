import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
let api, dir;
const key = "__zekindoReadTest";
before(async () => {
  dir = await mkdtemp(path.resolve("node_modules/.read-tests-"));
  const mocks = {
    "server-only": "",
    react: "export const cache=fn=>fn;",
    "next/cache": `export const unstable_cache=fn=>async(...args)=>{const state=globalThis.${key};state.cached??=new Map();const cacheKey=JSON.stringify(args);if(!state.cached.has(cacheKey))state.cached.set(cacheKey,await fn(...args));return state.cached.get(cacheKey);};`,
    "./auth/dal": `export async function getAuthContext(){return globalThis.${key}.ctx??null;}`,
    "./users": "export async function getProfilesByIds(){return new Map();}",
    "./milestones": `export const rowTrack=value=>value==='downstream'?'downstream':'upstream';export async function getMilestoneCatalog(){return {upstream:[],downstream:[]};}`,
    "./supabase-server": `export function supabaseServer(){return {from(){let first=0,last=999,single=false;const filters={};const chain={select(){return chain;},order(){return chain;},is(name,value){filters[name]=value;return chain;},eq(name,value){filters[name]=value;return chain;},range(a,b){first=a;last=b;return chain;},maybeSingle(){single=true;return chain;},then(resolve,reject){const state=globalThis.${key};state.calls++;const rows=state.rows.filter(row=>Object.entries(filters).every(([name,value])=>row[name]===value));return Promise.resolve({data:single?(rows[0]??null):rows.slice(first,last+1),error:null}).then(resolve,reject);}};return chain;}};}`,
  };
  await build({
    entryPoints: ["src/lib/tenders.ts"],
    outfile: path.join(dir, "read.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "read-fixtures",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(server-only|react|next\/cache|\.\/(auth\/dal|users|milestones|supabase-server))$/,
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
  api = await import(pathToFileURL(path.join(dir, "read.mjs")));
});
after(async () => {
  delete globalThis[key];
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("legacy text IDs remain readable and numeric values retain decimals", async () => {
  globalThis[key] = {
    calls: 0,
    ctx: { profile: { role: "viewer" } },
    rows: [
      {
        id: "T0001",
        qty: "12.5",
        oe: "100.25",
        milestones: {},
        milestone_order: [],
        track: "upstream",
        archived_at: null,
      },
    ],
  };
  const tender = await api.getTenderById("T0001");
  assert.equal(tender.id, "T0001");
  assert.equal(tender.qty, 12.5);
  assert.equal(tender.oe, 100.25);
  assert.deepEqual(tender.milestoneOrder, []);
  assert.equal(await api.getTenderById("missing"), null);
});
test("cached reads paginate beyond the default 1000-row API limit", async () => {
  globalThis[key] = {
    calls: 0,
    rows: Array.from({ length: 1001 }, (_, i) => ({
      id: `T${i}`,
      row_no: i,
      track: "upstream",
      milestones: {},
      milestone_order: null,
      archived_at: null,
    })),
  };
  const rows = await api.getAllTenders();
  assert.equal(rows.length, 1001);
  assert.equal(globalThis[key].calls, 2);
  assert.equal(new Set(rows.map((row) => row.id)).size, 1001);
});

test("guest list and detail redact every monetary field but retain quantity", async () => {
  globalThis[key] = {
    calls: 0,
    rows: [
      {
        id: "T0001",
        qty: 12.5,
        oe: 1234567.89,
        nilai_penawaran: 987654.32,
        idr_per_l: 15000.75,
        oe_catatan: "OE Rp 1.234.567,89",
        milestones: {},
        track: "upstream",
        archived_at: null,
      },
    ],
  };
  for (const record of [
    ...(await api.getAllTenders()),
    await api.getTenderById("T0001"),
  ]) {
    assert.equal(record.qty, 12.5);
    for (const field of ["oe", "nilaiPenawaran", "idrPerL", "oeCatatan"])
      assert.equal(record[field], null, field);
  }
});

test("shared tender cache never leaks money or loses amounts when switching viewers", async () => {
  const state = (globalThis[key] = {
    calls: 0,
    rows: [
      {
        id: "T0001",
        oe: 1234567.89,
        nilai_penawaran: 987654.32,
        idr_per_l: 15000.75,
        oe_catatan: "Financial note",
        milestones: {},
        track: "upstream",
        archived_at: null,
      },
    ],
  });
  for (const role of [null, "viewer", null, "admin", null]) {
    state.ctx = role ? { profile: { role } } : null;
    const [tender] = await api.getAllTenders();
    assert.equal(tender.oe, role ? 1234567.89 : null);
    assert.equal(tender.nilaiPenawaran, role ? 987654.32 : null);
    assert.equal(tender.idrPerL, role ? 15000.75 : null);
    assert.equal(tender.oeCatatan, role ? "Financial note" : null);
    const detail = await api.getTenderById("T0001");
    assert.equal(detail.oe, role ? 1234567.89 : null);
  }
  assert.equal(
    state.cached.size,
    1,
    "all roles share the raw cache, never the redacted result",
  );
});
