import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
let api, dir;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "zekindo-business-"));
  const result = await build({
    stdin: {
      contents: [
        "analytics",
        "tender-logic",
        "validation",
        "table-state",
        "calendar",
        "upload-policy",
      ]
        .map((name) => `export * from './src/lib/${name}';`)
        .join("\n"),
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
  });
  const file = path.join(dir, "logic.mjs");
  await writeFile(file, result.outputFiles[0].text);
  api = await import(pathToFileURL(file));
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
});
const tender = (patch = {}) => ({
  id: "t",
  rowNo: 1,
  track: "upstream",
  period: "2026",
  area: "Jawa",
  tenderNo: "REF-1",
  customer: "Petro Customer",
  product: "Chemical Package",
  entitas: "ZKI",
  oe: null,
  qty: null,
  nilaiPenawaran: null,
  milestones: {},
  milestoneOrder: null,
  result: null,
  ...patch,
});
const catalog = {
  upstream: [
    { key: "first", label: "First" },
    { key: "second", label: "Second" },
  ],
  downstream: [{ key: "dsFirst", label: "Downstream first" }],
};
test("outcomes keep retender/no-info separate from losses", () => {
  const rows = [
    null,
    "WIN",
    "LOSS PRICE",
    "RETENDER",
    "NO INFO",
    "WITHDRAW",
    "CANCELED",
  ].map((result) => tender({ result }));
  const statuses = api.statusBreakdown(rows);
  assert.equal(
    statuses.reduce((n, row) => n + row.count, 0),
    rows.length,
  );
  assert.equal(statuses.find((s) => s.key === "loss").count, 1);
  assert.equal(statuses.find((s) => s.key === "retender").count, 1);
  assert.deepEqual(api.overallWinRate(rows), {
    win: 1,
    loss: 1,
    decided: 2,
    pct: 50,
  });
});
test("track pipeline and win rates agree with overall definitions", () => {
  const rows = [
    tender({ oe: 120 }),
    tender({ result: "WIN", oe: 999, nilaiPenawaran: 80 }),
    tender({ result: "LOSS PRICE", oe: 888 }),
    tender({ result: "RETENDER", oe: 777 }),
    tender({ result: "NO INFO" }),
    tender({ track: "downstream", oe: 50 }),
  ];
  const tracks = api.trackComparison(rows);
  assert.equal(
    tracks.reduce((sum, t) => sum + t.pipelineValue, 0),
    api.totalPipelineValue(rows),
  );
  assert.equal(tracks[0].pipelineValue, 120);
  assert.equal(tracks[0].winRate, 50);
  assert.equal(tracks[1].winRate, null);
  assert.equal(api.totalWinValue(rows), 80);
});
test("empty denominators do not produce misleading zero win rates", () => {
  assert.equal(api.overallWinRate([]).pct, null);
  assert.equal(
    api.outcomesByPeriod([tender({ result: "NO INFO" })], ["2026"])[0]
      .winRatePct,
    null,
  );
  assert.deepEqual(
    api.winRateByGroup([tender({ result: "WIN" })], (t) => t.area),
    [],
  );
});
test("numeric parser preserves decimals and rejects ambiguous/non-finite values", () => {
  assert.equal(api.parseNumericInput("123.45"), 123.45);
  assert.equal(api.parseNumericInput("0"), 0);
  assert.equal(api.parseNumericInput(""), null);
  for (const value of [
    "1,000",
    "1.2.3",
    "-12",
    "Infinity",
    "1e4",
    "9007199254740993",
  ])
    assert.ok(Number.isNaN(api.parseNumericInput(value)));
});
test("calendar dates and the Jakarta day boundary are correct", () => {
  assert.equal(api.isISODate("2024-02-29"), true);
  assert.equal(api.isISODate("2026-02-29"), false);
  assert.equal(api.isISODate("2026-13-01"), false);
  assert.equal(api.todayISO(new Date("2026-10-22T17:01:00Z")), "2026-10-23");
  assert.equal(api.daysBetween("2026-10-23", "2026-10-22"), 1);
});
test("explicit empty schedules and empty catalogs remain empty", () => {
  assert.deepEqual(
    api.resolveTenderMilestones(tender({ milestoneOrder: [] }), catalog),
    [],
  );
  assert.deepEqual(api.resolveTenderMilestones(tender(), { upstream: [] }), []);
  assert.equal(api.resolveTenderMilestones(tender(), catalog).length, 2);
});
test("milestone sequence warnings point to the actual reversed pair", () => {
  const issues = api.findOutOfOrderMilestones(
    { first: "2026-10-23", second: "2026-10-22" },
    catalog.upstream,
  );
  assert.deepEqual(issues, [{ earlierLabel: "First", laterLabel: "Second" }]);
});
test("deadlines respect track, hidden milestones, status and reminder window", () => {
  const rows = [
    tender({ milestones: { first: "2026-10-24" } }),
    tender({
      id: "hidden",
      milestoneOrder: [],
      milestones: { first: "2026-10-24" },
    }),
    tender({ id: "won", result: "WIN", milestones: { first: "2026-10-24" } }),
    tender({
      id: "ds",
      track: "downstream",
      milestones: { dsFirst: "2026-10-23" },
    }),
  ];
  const due = api.computeDeadlines(rows, "2026-10-22", catalog);
  assert.deepEqual(
    due.map((d) => d.tenderId),
    ["ds", "t"],
  );
  assert.equal(
    api.computeStalled(rows, "2026-10-22", catalog)[0].tenderId,
    "hidden",
  );
});
test("search covers customers, entities and trimmed text", () => {
  const filters = {
    period: "all",
    area: "all",
    entitas: "all",
    customer: "all",
    result: "all",
    search: "  petro  ",
  };
  assert.equal(api.filterTenders([tender()], filters).length, 1);
  assert.equal(
    api.filterTenders([tender()], { ...filters, search: "zki" }).length,
    1,
  );
});
test("URL filters round-trip with export track and encoded characters", () => {
  const filters = api.readTenderFilters(
    new URLSearchParams("customer=A%26B&result=WIN&search=lab"),
  );
  const restored = api.readTenderFilters(
    new URLSearchParams(api.tenderQuery(filters, "all")),
  );
  assert.deepEqual(restored, filters);
  assert.equal(
    new URLSearchParams(api.tenderQuery(filters, "all")).get("track"),
    "all",
  );
  assert.equal(
    api.readTenderFilters(new URLSearchParams("result=invalid")).result,
    "all",
  );
});
test("calendar export escapes text and uses stable all-day events", () => {
  const row = api.computeDeadlines(
    [
      tender({
        customer: "A, B; C\nNext",
        milestones: { first: "2026-10-24" },
      }),
    ],
    "2026-10-22",
    catalog,
  )[0];
  const ics = api.deadlineCalendar([row], new Date("2026-10-22T00:00:00Z"));
  assert.ok(ics.includes("DTSTART;VALUE=DATE:20261024"));
  assert.ok(ics.includes("DTEND;VALUE=DATE:20261025"));
  assert.ok(ics.includes("A\\, B\\; C\\nNext"));
});
test("login return paths and upload paths cannot escape their scope", () => {
  for (const value of [
    "//example.com",
    "/\\example.com",
    "https://example.com",
  ])
    assert.equal(api.safeNextPath(value), "/");
  assert.equal(api.safeNextPath("/tenders?track=all"), "/tenders?track=all");
  assert.equal(api.validUploadPath("a", "a/file.pdf"), true);
  assert.equal(api.validUploadPath("a", "b/file.pdf"), false);
  assert.equal(api.validUploadPath("a", "a/../b"), false);
});

test("loss shares retain full precision rather than stacking rounded totals", () => {
  const rows = ["LOSS PRICE", "LOSS TECHNICAL", "LOSS PQ ADMIN"].map((result) =>
    tender({ result }),
  );
  const data = api.lossReasonByPeriod(rows, ["2026"])[0];
  assert.ok(
    Math.abs(data.shares.reduce((sum, row) => sum + row.pct, 0) - 100) < 1e-10,
  );
});

test("calendar folds long UTF-8 lines without splitting characters", () => {
  const title = "Milestone " + "é".repeat(100);
  const row = api.computeDeadlines(
    [tender({ product: title, milestones: { first: "2026-10-24" } })],
    "2026-10-22",
    catalog,
  )[0];
  const ics = api.deadlineCalendar([row]);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
  assert.ok(ics.replace(/\r\n /g, "").includes(title));
});

test("file sections reject path fragments and ambiguous ownership", () => {
  assert.equal(api.validFileSection("first", null), true);
  assert.equal(api.validFileSection("../escape", null), false);
  assert.equal(
    api.validFileSection("first", "00000000-0000-0000-0000-000000000001"),
    false,
  );
  assert.equal(
    api.validFileSection(null, "00000000-0000-0000-0000-000000000001"),
    true,
  );
});
