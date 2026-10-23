// Read-only smoke checks against a running app. No accounts, tenders or files are changed.
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { chromium } from "playwright";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3002";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let rendered = 0;
let automaticExportRequests = 0;
page.on("request", (request) => {
  if (new URL(request.url()).pathname === "/tenders/export")
    automaticExportRequests++;
});
try {
  for (const width of [1440, 1024, 768, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const route of [
      "/",
      "/analytics",
      "/tenders?track=all",
      "/tenders?track=downstream",
      "/notifications",
      "/login",
    ]) {
      const response = await page.goto(base + route, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200, route);
      assert.equal(await page.locator("h1").count(), 1, route);
      assert.equal(
        await page.getByText("Something went wrong", { exact: true }).count(),
        0,
        route,
      );
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
        false,
        `${route} at ${width}`,
      );
      rendered++;
    }
  }
  await page.goto(base + "/tenders?track=all", { waitUntil: "networkidle" });
  // Seeded tender IDs are text (for example t001), not necessarily UUIDs.
  const detailHref = await page.locator("tbody a").first().getAttribute("href");
  assert.ok(detailHref, "A populated tender table must expose a detail link");
  {
    for (const width of [1440, 375])
      for (const tab of ["overview", "documents"]) {
        await page.setViewportSize({ width, height: 1000 });
        const url = new URL(detailHref, base);
        url.searchParams.set("tab", tab);
        await page.goto(url.href, { waitUntil: "networkidle" });
        assert.equal(
          await page.getByText("Something went wrong", { exact: true }).count(),
          0,
        );
        assert.equal(
          await page.evaluate(
            () => document.documentElement.scrollWidth > innerWidth,
          ),
          false,
        );
        rendered++;
      }
    await page.getByRole("link", { name: /Back to table/ }).click();
    await page.waitForURL(/track=all/);
  }
  const detailPath = new URL(detailHref, base).pathname;
  // Inspect HTML and the embedded RSC stream as well as visible text: a CSS
  // blur must never leave the real monetary fields in the public payload.
  for (const route of [
    "/",
    "/analytics",
    "/tenders?track=all",
    detailPath,
    "/notifications",
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    const html = (await response.text()).replaceAll('\\"', '"');
    assert.doesNotMatch(
      html,
      /"(?:oe|nilaiPenawaran|idrPerL)"\s*:\s*-?\d/,
      route,
    );
  }
  await page.goto(base + "/analytics", { waitUntil: "networkidle" });
  assert.ok(
    (await page
      .getByRole("img", { name: "Sign in to view monetary values" })
      .count()) >= 3,
  );
  assert.equal(
    await page
      .getByRole("heading", { name: "Pipeline Value by Area" })
      .locator("../..")
      .locator("svg")
      .count(),
    0,
  );
  for (const route of [
    `${detailPath}/edit`,
    "/admin/users",
    "/admin/milestones",
    "/tenders/archive",
    "/tenders/new?track=downstream",
  ]) {
    const response = await fetch(base + route, { redirect: "manual" });
    assert.ok([303, 307, 308].includes(response.status));
    const destination = new URL(response.headers.get("location"), base);
    assert.equal(destination.pathname, "/login");
    assert.equal(destination.searchParams.get("next"), route);
  }
  await page.context().addCookies([
    {
      name: "zk_session",
      value: "invalid-fixture-session",
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(base + "/admin/users", { waitUntil: "networkidle" });
  assert.equal(
    new URL(page.url()).pathname,
    "/login",
    "A forged session cookie must not bypass server authorization",
  );
  await page.goto(base + "/tenders?track=all", { waitUntil: "networkidle" });
  assert.ok(
    await page.getByRole("link", { name: "Sign in to view amounts" }).count(),
  );
  await page.context().clearCookies();
  await page.goto(`${base}${detailPath}?tab=activity`, {
    waitUntil: "networkidle",
  });
  assert.equal(
    await page
      .getByRole("heading", { name: "Activity history", exact: true })
      .count(),
    0,
  );
  const workbookCounts = {};
  for (const track of ["upstream", "downstream", "all"]) {
    const response = await fetch(`${base}/tenders/export?track=${track}`, {
      redirect: "manual",
    });
    assert.equal(response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const sheet = workbook.getWorksheet("Tenders");
    assert.ok(!sheet.getRow(1).values.includes("Internal Notes"));
    assert.ok(sheet.views.some((view) => view.state === "frozen"));
    const headers = sheet.getRow(1).values;
    for (const header of ["OE (Rp)", "OE Note", "Bid Value (Rp)"]) {
      const column = headers.indexOf(header);
      assert.ok(column > 0);
      for (let row = 2; row <= sheet.rowCount; row++)
        assert.equal(
          sheet.getRow(row).getCell(column).value,
          "Sign in to view",
        );
    }
    workbookCounts[track] = sheet.rowCount - 1;
  }
  assert.equal(
    workbookCounts.all,
    workbookCounts.upstream + workbookCounts.downstream,
  );
  await page.goto(base + "/analytics?track=downstream", {
    waitUntil: "networkidle",
  });
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption({ index: 1 });
  await page.waitForURL(/customer=/);
  assert.equal(
    await page.getByText("Something went wrong", { exact: true }).count(),
    0,
  );
  const exportHref = await page
    .getByRole("link", { name: "Export this scope", exact: true })
    .getAttribute("href");
  assert.ok(exportHref.includes("customer="));
  const filtered = await fetch(new URL(exportHref, base));
  assert.equal(filtered.status, 200);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(Buffer.from(await filtered.arrayBuffer()));
  assert.ok(book.getWorksheet("Tenders").rowCount > 1);
  assert.deepEqual(errors, []);
  assert.equal(
    automaticExportRequests,
    0,
    "Excel must only be requested on explicit download",
  );
  const timings = {};
  for (const route of ["/", "/analytics"]) {
    await page.goto(base + route, { waitUntil: "networkidle" });
    timings[route] = await page.evaluate(() => {
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        ttfbMs: Math.round(nav.responseStart - nav.requestStart),
        domContentLoadedMs: Math.round(
          nav.domContentLoadedEventEnd - nav.startTime,
        ),
      };
    });
  }
  console.log(
    JSON.stringify(
      {
        renderedViews: rendered,
        protectedRoutes: 5,
        forgedSessionRejected: true,
        workbookCounts,
        filteredExport: true,
        jsErrors: errors.length,
        localWarmNavigation: timings,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
