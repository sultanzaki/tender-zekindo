import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
let api, dir;
const stateKey = "__zekindoActionTest";
const base = () => ({
  track: "upstream",
  area: "Jawa",
  customer: "Customer",
  tenderNo: "TEST",
  product: "Package",
  entitas: "ZKI",
  qty: "12.5",
  oe: "100.25",
  oeCatatan: "",
  nilaiPenawaran: "90.75",
  milestones: { first: "2026-10-22" },
});
function reset() {
  globalThis[stateKey] = {
    authorized: true,
    calls: [],
    before: {
      id: "t",
      track: "upstream",
      milestones: { first: "2026-10-20", hidden: "2026-10-19" },
    },
    targets: [
      { id: "t", tender_no: "TEST", product: "Package", archived_at: null },
    ],
  };
  return globalThis[stateKey];
}
before(async () => {
  dir = await mkdtemp(path.resolve("node_modules/.actions-tests-"));
  const mocks = {
    "@/unused": "",
    "next/cache": `export function revalidatePath(){} export function updateTag(){};`,
    "next/navigation": `export function redirect(path){throw new Error('REDIRECT:'+path);}`,
    "./auth/dal": `export async function requireAdmin(){if(!globalThis.${stateKey}.authorized)throw new Error('UNAUTHORIZED');return {userId:'admin',profile:{name:'Test Admin'}};}`,
    "./tenders": `export async function getTenderById(){return {id:'t',track:'upstream',archivedAt:null};}`,
    "./documents": `export const DOCUMENT_BUCKET='fixture';`,
    "./milestones": `export async function getMilestoneTypes(){return [{key:'first'}];} export function slugifyMilestoneKey(label){return label;}`,
    "./supabase-server": `export function supabaseServer(){return {from(table){const q={table,operation:'select',columns:'*',payload:null};const builder={select(columns){q.columns=columns;return builder;},insert(payload){q.operation='insert';q.payload=payload;return builder;},update(payload){q.operation='update';q.payload=payload;return builder;},upsert(payload){q.operation='upsert';q.payload=payload;return builder;},delete(){q.operation='delete';return builder;},eq(){return builder;},in(){return builder;},is(){return builder;},order(){return builder;},maybeSingle(){q.single=true;return builder;},single(){q.single=true;return builder;},then(resolve,reject){const state=globalThis.${stateKey};state.calls.push(q);let data=null;if(q.operation==='select'){data=table==='milestone_types'?(q.single?state.milestones[0]:state.milestones):table==='tender_files'?(state.registered??[]):q.columns==='period'?[{period:'2026'}]:q.columns.includes('archived_at')?state.targets:state.before;}else if(q.operation==='insert'&&table==='tenders'){data={id:'created'};}return Promise.resolve({data,error:null}).then(resolve,reject);}};return builder;},storage:{from(){return {list:async()=>({data:[]}),remove:async(paths)=>{globalThis.${stateKey}.removed=paths;return {error:null};}};}}};}`,
  };
  await build({
    stdin: {
      contents:
        "export * from './src/lib/actions.ts'; export * from './src/lib/folder-actions.ts'; export * from './src/lib/milestone-actions.ts';",
      resolveDir: process.cwd(),
    },
    outfile: path.join(dir, "actions.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "isolated-database",
        setup(b) {
          b.onResolve(
            {
              filter:
                /^(next\/(cache|navigation)|\.\/(auth\/dal|tenders|documents|milestones|supabase-server))$/,
            },
            (args) => ({ path: args.path, namespace: "mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "mock" }, (args) => ({
            contents: mocks[args.path],
            loader: "js",
          }));
        },
      },
    ],
  });
  api = await import(pathToFileURL(path.join(dir, "actions.mjs")));
});
after(async () => {
  delete globalThis[stateKey];
  if (dir) await rm(dir, { recursive: true, force: true });
});
test("create persists fractional values without stripping decimal points", async () => {
  const state = reset();
  await assert.rejects(api.createTender(base()), /REDIRECT:\/tenders\/created/);
  const payload = state.calls.find(
    (c) => c.table === "tenders" && c.operation === "insert",
  ).payload;
  assert.equal(payload.qty, 12.5);
  assert.equal(payload.oe, 100.25);
  assert.equal(payload.nilai_penawaran, 90.75);
});
test("edit preserves hidden dates and saves empty order with other fields", async () => {
  const state = reset();
  await assert.rejects(
    api.updateTender("t", {
      ...base(),
      milestoneOrder: [],
      result: "",
      carryOver: "",
      remarks: "",
      remark: "",
      pnl: false,
      catatanInternal: "",
    }),
    /REDIRECT/,
  );
  const payload = state.calls.find(
    (c) => c.table === "tenders" && c.operation === "update",
  ).payload;
  assert.deepEqual(payload.milestone_order, []);
  assert.equal(payload.milestones.hidden, "2026-10-19");
  assert.equal(payload.qty, 12.5);
});
test("invalid numeric input is rejected before a mutation", async () => {
  const state = reset();
  const result = await api.createTender({ ...base(), oe: "1,000" });
  assert.match(result.error, /valid/);
  assert.equal(state.calls.length, 0);
});
test("tender track changes are refused by the server", async () => {
  const state = reset();
  const result = await api.updateTender("t", {
    ...base(),
    track: "downstream",
    result: "",
  });
  assert.match(result.error, /track cannot change/);
  assert.equal(
    state.calls.some((c) => c.operation === "update"),
    false,
  );
});
test("unauthorized callers cannot mutate tenders", async () => {
  const state = reset();
  state.authorized = false;
  await assert.rejects(api.createTender(base()), /UNAUTHORIZED/);
  assert.equal(state.calls.length, 0);
});
test("bulk permanent deletion refuses active tenders", async () => {
  const state = reset();
  const result = await api.bulkDeleteTenders(["t"]);
  assert.match(result.error, /Archive all selected/);
  assert.equal(
    state.calls.some((c) => c.operation === "delete"),
    false,
  );
});
test("invalid quick-edit milestone dates never reach the database", async () => {
  const state = reset();
  const result = await api.quickUpdateMilestone("t", "first", "2026-02-30");
  assert.match(result.error, /valid milestone date/);
  assert.equal(state.calls.length, 0);
});

test("bulk archive counts matching active records rather than requested IDs", async () => {
  const state = reset();
  const result = await api.bulkArchiveTenders(["t", "t", "missing"]);
  assert.equal(result.count, 1);
  assert.ok(state.calls.some((c) => c.operation === "update"));
});
test("upload preparation rejects oversized files before storage access", async () => {
  const state = reset();
  const result = await api.prepareFileUpload("t", { milestoneKey: "first" }, [
    { name: "large.pdf", size: 6 * 1024 * 1024, type: "application/pdf" },
  ]);
  assert.match(result.error, /5 MB/);
  assert.equal(state.calls.length, 0);
});
test("upload registration rejects object paths from another tender", async () => {
  const state = reset();
  const result = await api.completeFileUpload("t", { milestoneKey: "first" }, [
    {
      path: "another/file.pdf",
      fileName: "file.pdf",
      size: 1,
      contentType: "application/pdf",
    },
  ]);
  assert.match(result.error, /Invalid upload/);
  assert.equal(state.calls.length, 0);
});
test("cleanup never removes registered files after a lost response", async () => {
  const state = reset();
  state.registered = [{ file_path: "t/registered.pdf" }];
  await api.cancelPreparedUploads("t", ["t/registered.pdf", "t/orphan.pdf"]);
  assert.deepEqual(state.removed, ["t/orphan.pdf"]);
});
test("unauthorized upload cleanup cannot access storage", async () => {
  const state = reset();
  state.authorized = false;
  await assert.rejects(
    api.cancelPreparedUploads("t", ["t/file.pdf"]),
    /UNAUTHORIZED/,
  );
  assert.equal(state.removed, undefined);
});

test("numeric-leading milestone keys retain their dates", async () => {
  const state = reset();
  await api.quickUpdateMilestone("t", "2026gate", "2026-10-22");
  assert.equal(
    state.calls.find((call) => call.operation === "update").payload.milestones[
      "2026gate"
    ],
    "2026-10-22",
  );
});

test("milestone reorder submits both positions in one atomic write", async () => {
  const state = reset();
  state.milestones = [
    {
      id: "m1",
      key: "first",
      label: "First",
      track: "upstream",
      sort_order: 10,
      show_in_table: true,
      archived_at: null,
    },
    {
      id: "m2",
      key: "second",
      label: "Second",
      track: "upstream",
      sort_order: 20,
      show_in_table: false,
      archived_at: null,
    },
  ];
  const result = await api.moveMilestoneType("m1", "down");
  assert.deepEqual(result, {});
  const mutations = state.calls.filter((call) => call.operation !== "select");
  assert.equal(mutations.length, 1);
  assert.equal(mutations[0].operation, "upsert");
  assert.deepEqual(
    mutations[0].payload.map((row) => row.sort_order),
    [20, 10],
  );
});

test("editing the default schedule keeps following future catalog additions", async () => {
  const state = reset();
  await assert.rejects(
    api.updateTender("t", {
      ...base(),
      milestoneOrder: ["first"],
      result: "",
      carryOver: "",
      remarks: "",
      remark: "",
      pnl: false,
      catatanInternal: "",
    }),
    /REDIRECT/,
  );
  assert.equal(
    state.calls.find((call) => call.operation === "update").payload.milestone_order,
    null,
  );
});

test("editing legacy schedules preserves previously stored historical keys", async () => {
  const state = reset();
  state.before.milestone_order = ["historical"];
  await assert.rejects(
    api.updateTender("t", {
      ...base(),
      milestoneOrder: ["historical"],
      result: "",
      carryOver: "",
      remarks: "",
      remark: "",
      pnl: false,
      catatanInternal: "",
    }),
    /REDIRECT/,
  );
  assert.deepEqual(
    state.calls.find((call) => call.operation === "update").payload.milestone_order,
    ["historical"],
  );
});
