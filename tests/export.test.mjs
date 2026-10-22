import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import ExcelJS from "exceljs";

let directory, GET;
const stateKey = "__zekindoExportTest";
const tender = {
  id: "fixture",
  rowNo: 1,
  track: "upstream",
  area: "Jawa",
  tenderNo: "TEST-001",
  customer: "Test Customer",
  product: "Test Package",
  entitas: "ZKI",
  period: "2026",
  qty: 12.5,
  oe: 1000,
  oeCatatan: "",
  nilaiPenawaran: 900,
  pnl: false,
  milestones: { registration: "2026-10-22" },
  result: null,
  carryOver: "",
  remarks: "Public remarks",
  remark: "",
  catatanInternal: "PRIVATE TEST NOTE",
};
before(async () => {
  directory = await mkdtemp(path.resolve("node_modules/.export-tests-"));
  const mocks = {
    "@/lib/auth/dal": `export async function getAuthContext() { return globalThis.${stateKey}.ctx; }
      export async function requireUser() { throw new Error('Export must not require login'); }`,
    "@/lib/tenders": `export async function getAllTenders(options) {
      globalThis.${stateKey}.options = options;
      return globalThis.${stateKey}.tenders.filter(t => options.track === "all" || t.track === options.track);
    }`,
    "@/lib/milestones": `export async function getMilestoneTypes() {return [{key:'registration',label:'Registration'}];} export async function getMilestoneCatalog(){return {upstream:[{key:'registration',label:'Registration'}],downstream:[{key:'dsRegistration',label:'Downstream registration'}]};}`,
  };
  await build({
    entryPoints: ["src/app/tenders/export/route.ts"],
    outfile: path.join(directory, "route.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    plugins: [
      {
        name: "export-fixtures",
        setup(b) {
          b.onResolve(
            { filter: /^@\/lib\/(auth\/dal|tenders|milestones)$/ },
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
  ({ GET } = await import(pathToFileURL(path.join(directory, "route.mjs"))));
});
after(async () => {
  delete globalThis[stateKey];
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function exportSheet(ctx, query = "") {
  globalThis[stateKey] = {
    ctx,
    tenders: [tender, { ...tender, id: "downstream", track: "downstream" }],
  };
  const response = await GET(
    new Request(`http://localhost/tenders/export${query}`),
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get("Content-Type"), /spreadsheetml/);
  assert.match(
    response.headers.get("Content-Disposition"),
    /attachment; filename="tenders-.*\.xlsx"/,
  );
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
  return workbook.getWorksheet("Tenders");
}
test("anonymous export returns a valid workbook without internal notes", async () => {
  const sheet = await exportSheet(null);
  assert.equal(sheet.rowCount, 2);
  assert.ok(!sheet.getRow(1).values.includes("Internal Notes"));
  assert.ok(!sheet.getRow(2).values.includes(tender.catatanInternal));
  assert.ok(sheet.getRow(2).values.includes("TEST-001"));
  assert.ok(sheet.getRow(2).values.includes(12.5));
  assert.deepEqual(globalThis[stateKey].options, { track: "upstream" });
});
test("anonymous export preserves track and search filters", async () => {
  const sheet = await exportSheet(
    null,
    "?track=downstream&search=does-not-match",
  );
  assert.equal(sheet.rowCount, 1);
  assert.deepEqual(globalThis[stateKey].options, { track: "downstream" });
});
test("viewer export omits internal notes", async () => {
  const sheet = await exportSheet({ profile: { role: "viewer" } });
  assert.ok(!sheet.getRow(1).values.includes("Internal Notes"));
  assert.ok(!sheet.getRow(2).values.includes(tender.catatanInternal));
});
test("admin export retains internal notes and cannot be shared-cached", async () => {
  const sheet = await exportSheet({ profile: { role: "admin" } });
  assert.ok(sheet.getRow(1).values.includes("Internal Notes"));
  assert.ok(sheet.getRow(2).values.includes(tender.catatanInternal));
});

test("all-track export includes both tracks without key collisions", async () => {
  const sheet = await exportSheet(null, "?track=all");
  assert.equal(sheet.rowCount, 3);
  assert.ok(sheet.getRow(1).values.includes("Downstream registration"));
});
