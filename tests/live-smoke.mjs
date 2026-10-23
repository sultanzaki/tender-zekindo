// Read-only checks against a running app; no accounts or business data are changed.
import assert from "node:assert/strict";
import { chromium } from "playwright";
const base = process.env.SMOKE_BASE_URL || "http://localhost:3003";
const routes = [
  "/",
  "/analytics?track=all",
  "/tenders?track=all",
  "/notifications",
  "/tenders/T0001",
  "/tenders/T0001?tab=documents",
  "/tenders/T0001?tab=activity",
  "/tenders/new",
  "/tenders/archive",
  "/tenders/T0001/edit",
  "/admin/users",
  "/admin/milestones",
  "/tenders/export?track=all",
  "/tenders/T0001/download?file=33333333-3333-4333-8333-333333333333",
];
let blocked = 0;
for (const cookie of [null, "forged-short-cookie", "z".repeat(43)]) {
  for (const route of routes) {
    for (const extra of [
      {},
      {
        RSC: "1",
        "x-workspace-path": "/login",
        "x-middleware-subrequest":
          "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy",
      },
    ]) {
      const requestPath = extra.RSC
        ? route + (route.includes("?") ? "&" : "?") + "_rsc"
        : route;
      const response = await fetch(base + requestPath, {
        headers: {
          ...extra,
          ...(cookie ? { Cookie: `zk_session=${cookie}` } : {}),
        },
        redirect: "manual",
      });
      const body = await response.text();
      if ([303, 307, 308].includes(response.status))
        assert.equal(
          new URL(response.headers.get("location"), base).pathname,
          "/login",
        );
      else {
        assert.equal(response.status, 200);
        assert.ok(body.includes("NEXT_REDIRECT;replace;/login?next="), route);
        assert.doesNotMatch(
          body.replaceAll('\\"', '"'),
          /"(?:oe|nilaiPenawaran|idrPerL)"\s*:/,
        );
      }
      assert.match(response.headers.get("cache-control"), /no-store/);
      assert.doesNotMatch(
        body,
        /application\/vnd\.openxmlformats|storage\/v1\/object\/sign/,
      );
      blocked++;
    }
  }
}
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ["--no-sandbox"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
try {
  for (const width of [375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(base + "/tenders?track=all", { waitUntil: "networkidle" });
    assert.equal(new URL(page.url()).pathname, "/login");
    assert.equal(await page.locator("h1").count(), 1);
    assert.equal(
      await page
        .getByRole("link", { name: "Continue to public workspace" })
        .count(),
      0,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
  }
  const response = await fetch(base + "/login");
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        blockedRequests: blocked,
        loginViewports: 4,
        jsErrors: errors.length,
        securityHeaders: true,
      },
      null,
      2,
    ),
  );
} finally {
  await browser.close();
}
