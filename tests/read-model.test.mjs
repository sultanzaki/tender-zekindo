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
    "next/cache": "export const unstable_cache=fn=>fn;",
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
                /^(server-only|react|next\/cache|\.\/(users|milestones|supabase-server))$/,
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
