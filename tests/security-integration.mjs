// Real production Next.js + a loopback-only Supabase fixture. Never uses live data.
import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { once } from "node:events";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { chromium } from "playwright";

const hash = (token) => createHash("sha256").update(token).digest("hex");
const tokens = Object.fromEntries(
  ["viewer", "admin", "expired", "revoked", "invalidDate", "invalidRole"].map(
    (name, i) => [name, String.fromCharCode(97 + i).repeat(43)],
  ),
);
const viewer = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "viewer@example.test",
  name: "Fixture Viewer",
  role: "viewer",
  created_at: "2026-01-01",
};
const admin = {
  ...viewer,
  id: "22222222-2222-4222-8222-222222222222",
  email: "admin@example.test",
  name: "Fixture Admin",
  role: "admin",
};
const fileId = "33333333-3333-4333-8333-333333333333";
const documentId = "44444444-4444-4444-8444-444444444444";
const tender = {
  id: "T0001",
  row_no: 1,
  track: "upstream",
  period: "2026",
  area: "Fixture Area",
  tender_no: "CONFIDENTIAL-FIXTURE-001",
  customer: "CONFIDENTIAL FIXTURE CUSTOMER",
  product: "Fixture Package",
  entitas: "ZKI",
  qty: 12.5,
  oe: 1234567.89,
  nilai_penawaran: 987654.32,
  idr_per_l: 15000.75,
  oe_catatan: "Financial fixture note",
  milestones: {},
  milestone_order: [],
  result: null,
  carry_over: null,
  remarks: null,
  remark: null,
  pnl: false,
  catatan_internal: "PRIVATE ADMIN NOTE",
  archived_at: null,
  created_by: admin.id,
  updated_by: admin.id,
  updated_at: "2026-10-23T00:00:00Z",
};
const tables = {
  profiles: [
    viewer,
    admin,
    {
      ...viewer,
      id: "bad-role",
      email: "invalid-role@example.test",
      role: "owner",
    },
  ],
  sessions: [
    ...Object.entries(tokens)
      .filter(([name]) => name !== "revoked")
      .map(([name, token]) => ({
        id: hash(token),
        user_id:
          name === "admin"
            ? admin.id
            : name === "invalidRole"
              ? "bad-role"
              : viewer.id,
        expires_at:
          name === "expired"
            ? "2000-01-01T00:00:00Z"
            : name === "invalidDate"
              ? "invalid"
              : "2099-01-01T00:00:00Z",
      })),
  ],
  tenders: [
    tender,
    { ...tender, id: "T0002", row_no: 2, archived_at: "2026-10-23T00:00:00Z" },
  ],
  milestone_types: [],
  select_options: [],
  tender_events: [],
  error_log: [],
  document_types: [
    {
      id: documentId,
      label: "Fixture checklist",
      is_default: true,
      archived_at: null,
      created_at: "2026-01-01",
    },
  ],
  tender_documents: [
    {
      id: "checklist-record",
      tender_id: "T0001",
      document_type_id: documentId,
      checked: true,
      file_path: "T0001/report.pdf",
      file_name: "Financial report.pdf",
      updated_at: "2026-10-23T00:00:00Z",
    },
  ],
  tender_folders: [],
  tender_files: [
    {
      id: fileId,
      tender_id: "T0001",
      folder_id: null,
      milestone_key: null,
      document_type_id: documentId,
      file_path: "T0001/report.pdf",
      file_name: 'Report "unsafe"\r\n.pdf',
      size_bytes: 24,
      created_at: "2026-10-23T00:00:00Z",
    },
  ],
};
let fixture,
  production,
  browser,
  base,
  requests = [],
  writes = [],
  logs = "";
const manifest = JSON.parse(
  await readFile(".next/server/server-reference-manifest.json", "utf8"),
);

function matches(row, key, expression) {
  if (expression.startsWith("eq."))
    return String(row[key]) === expression.slice(3);
  if (expression === "is.null") return row[key] == null;
  if (expression === "not.is.null") return row[key] != null;
  if (expression.startsWith("in.("))
    return expression
      .slice(4, -1)
      .split(",")
      .map((v) => v.replaceAll('"', ""))
      .includes(String(row[key]));
  return true;
}
before(async () => {
  viewer.password_hash = await bcrypt.hash("OnlyFixturePassword!", 10);
  fixture = createServer(async (req, res) => {
    const url = new URL(req.url, "http://fixture");
    requests.push({ path: url.pathname, method: req.method });
    if (url.pathname.startsWith("/storage/v1/object/")) {
      assert.equal(req.headers.authorization, "Bearer security-fixture-key");
      res.setHeader("Content-Type", "application/pdf");
      res.end("SECURE-FIXTURE-DOCUMENT");
      return;
    }
    const table = url.pathname.split("/").pop();
    if (!tables[table]) {
      res.writeHead(404);
      res.end("{}");
      return;
    }
    let rows = tables[table].filter((row) =>
      [...url.searchParams].every(
        ([key, value]) =>
          ["select", "order", "offset", "limit"].includes(key) ||
          matches(row, key, value),
      ),
    );
    if (req.method !== "GET" && req.method !== "HEAD") {
      writes.push({ table, method: req.method });
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString();
      if (req.method === "DELETE")
        tables[table] = tables[table].filter((row) => !rows.includes(row));
      else if (req.method === "POST")
        tables[table].push(...[JSON.parse(body)].flat());
      else if (req.method === "PATCH")
        for (const row of rows) Object.assign(row, JSON.parse(body));
      res.writeHead(204);
      res.end();
      return;
    }
    const offset = Number(url.searchParams.get("offset") || 0),
      limit = Number(url.searchParams.get("limit") || 1000);
    rows = rows.slice(offset, offset + limit);
    const columns = url.searchParams.get("select");
    if (columns && columns !== "*")
      rows = rows.map((row) =>
        Object.fromEntries(columns.split(",").map((key) => [key, row[key]])),
      );
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify(
        req.headers.accept?.includes("vnd.pgrst.object")
          ? rows[0] || null
          : rows,
      ),
    );
  });
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const portServer = createServer();
  portServer.listen(0, "127.0.0.1");
  await once(portServer, "listening");
  const port = portServer.address().port;
  await new Promise((resolve) => portServer.close(resolve));
  base = `http://localhost:${port}`;
  production = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "localhost",
      "--port",
      String(port),
    ],
    {
      env: {
        ...process.env,
        NODE_ENV: "production",
        SUPABASE_URL: `http://127.0.0.1:${fixture.address().port}`,
        SUPABASE_SERVICE_ROLE_KEY: "security-fixture-key",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  production.stdout.on("data", (chunk) => (logs += chunk));
  production.stderr.on("data", (chunk) => (logs += chunk));
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(base + "/login")).status === 200) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.equal((await fetch(base + "/login")).status, 200, logs);
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  if (production && production.exitCode === null) {
    production.kill("SIGTERM");
    await once(production, "exit");
  }
  if (fixture) await new Promise((resolve) => fixture.close(resolve));
});

const routes = [
  "/",
  "/analytics?track=all",
  "/notifications",
  "/tenders?track=all",
  "/tenders/T0001",
  "/tenders/T0001?tab=documents",
  "/tenders/T0001?tab=activity",
  "/tenders/new",
  "/tenders/archive",
  "/tenders/T0001/edit",
  "/admin/users",
  "/admin/milestones",
  "/tenders/export?track=all",
  `/tenders/T0001/download?file=${fileId}`,
  `/tenders/T0001/download?document=${documentId}`,
  "/login/anything",
  "/unknown",
];
function headers(role, extras = {}) {
  return {
    ...(role ? { Cookie: `zk_session=${tokens[role]}` } : {}),
    ...extras,
  };
}
function assertPrivate(response) {
  assert.match(
    response.headers.get("cache-control") || "",
    /private.*no-store|no-store.*private/,
  );
}
async function assertRedirect(response, destination) {
  if ([303, 307, 308].includes(response.status)) {
    assert.equal(
      new URL(response.headers.get("location"), base).pathname,
      destination,
    );
    return;
  }
  // A streamed Next.js page may send its shell before resolving the guard.
  // It must carry a redirect and must never contain business data.
  assert.equal(response.status, 200);
  const body = await response.clone().text();
  assert.ok(
    body.includes(
      `NEXT_REDIRECT;replace;${destination}${destination === "/" ? ";" : "?"}`,
    ),
    `Expected redirect to ${destination}`,
  );
  for (const secret of [
    tender.customer,
    tender.tender_no,
    tender.catatan_internal,
  ])
    assert.ok(!body.includes(secret));
}
test("all pages, exports and files reject anonymous, forged, expired, revoked and malformed sessions", async () => {
  for (const role of [
    null,
    "revoked",
    "expired",
    "invalidDate",
    "invalidRole",
  ]) {
    for (const route of routes) {
      const response = await fetch(base + route, {
        headers: headers(role),
        redirect: "manual",
      });
      // Unknown routes have no data loader; 404 is also safe for forged cookies.
      if (response.status !== 404) await assertRedirect(response, "/login");
      assertPrivate(response);
      const body = await response.text();
      for (const secret of [
        tender.customer,
        tender.tender_no,
        tender.catatan_internal,
        "SECURE-FIXTURE-DOCUMENT",
        "1234567.89",
      ])
        assert.ok(!body.includes(secret), route);
    }
  }
  assert.equal(
    requests.filter(
      (r) =>
        r.path.startsWith("/rest/v1/") && !/sessions|profiles/.test(r.path),
    ).length,
    0,
    "denied requests must never query business data",
  );
});

test("RSC, HEAD, middleware bypass and spoofed workspace headers cannot reveal data", async () => {
  for (const route of [
    "/tenders?track=all",
    "/analytics",
    "/tenders/export",
    `/tenders/T0001/download?file=${fileId}`,
  ]) {
    for (const extra of [
      { RSC: "1" },
      { "x-workspace-path": "/login" },
      {
        "x-middleware-subrequest":
          "src/proxy:src/proxy:src/proxy:src/proxy:src/proxy",
      },
    ]) {
      for (const method of ["GET", "HEAD"]) {
        const requestPath = extra.RSC
          ? route + (route.includes("?") ? "&" : "?") + "_rsc"
          : route;
        const response = await fetch(base + requestPath, {
          method,
          headers: headers("revoked", extra),
          redirect: "manual",
        });
        if (method === "GET") await assertRedirect(response, "/login");
        else
          assert.ok(
            [200, 303, 307, 308].includes(response.status),
            `${method} ${route}`,
          );
        assertPrivate(response);
      }
    }
  }
});

test("viewers can read the workspace but cannot access admin pages, archives or notes", async () => {
  for (const route of [
    "/",
    "/analytics",
    "/notifications",
    "/tenders?track=all",
    "/tenders/T0001",
    "/tenders/T0001?tab=documents",
  ]) {
    const response = await fetch(base + route, {
      headers: headers("viewer"),
      redirect: "manual",
    });
    assert.equal(response.status, 200, route);
    assertPrivate(response);
    const body = await response.text();
    assert.ok(!body.includes(tender.catatan_internal), route);
  }
  for (const route of [
    "/admin/users",
    "/admin/milestones",
    "/tenders/archive",
    "/tenders/new",
    "/tenders/T0001/edit",
  ]) {
    const response = await fetch(base + route, {
      headers: headers("viewer"),
      redirect: "manual",
    });
    await assertRedirect(response, "/");
  }
  const archived = await fetch(base + "/tenders/T0002", {
    headers: headers("viewer"),
  });
  assert.ok([200, 404].includes(archived.status));
  const archivedBody = await archived.text();
  assert.ok(archivedBody.includes("Tender not found."));
  assert.ok(!archivedBody.includes(tender.catatan_internal));
  const activity = await fetch(base + "/tenders/T0001?tab=activity", {
    headers: headers("viewer"),
  });
  assert.ok(!(await activity.text()).includes("Activity history"));
});

test("valid admins retain the administration workspace", async () => {
  for (const route of [
    "/admin/users",
    "/admin/milestones",
    "/tenders/archive",
    "/tenders/new",
    "/tenders/T0001/edit",
    "/tenders/T0001?tab=activity",
  ]) {
    const response = await fetch(base + route, {
      headers: headers("admin"),
      redirect: "manual",
    });
    assert.equal(response.status, 200, route);
    assertPrivate(response);
  }
});

test("authenticated Excel keeps values and enforces admin-only notes", async () => {
  for (const role of ["viewer", "admin"]) {
    const response = await fetch(base + "/tenders/export?track=all", {
      headers: headers(role),
    });
    assert.equal(response.status, 200);
    assertPrivate(response);
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(Buffer.from(await response.arrayBuffer()));
    const sheet = book.getWorksheet("Tenders");
    assert.equal(sheet.rowCount, 2);
    assert.ok(sheet.getRow(2).values.includes(tender.oe));
    assert.equal(
      sheet.getRow(1).values.includes("Internal Notes"),
      role === "admin",
    );
    assert.equal(
      sheet.getRow(2).values.includes(tender.catatan_internal),
      role === "admin",
    );
  }
});

test("downloads require a live session, enforce tender ownership and never expose signed URLs", async () => {
  for (const kind of ["file", "document"]) {
    const route = `/tenders/T0001/download?${kind}=${kind === "file" ? fileId : documentId}`;
    const response = await fetch(base + route, { headers: headers("viewer") });
    assert.equal(response.status, 200);
    assertPrivate(response);
    assert.equal(
      response.headers.get("content-type"),
      "application/octet-stream",
    );
    assert.match(response.headers.get("content-disposition"), /^attachment; /);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(response.headers.get("location"), null);
    assert.equal(await response.text(), "SECURE-FIXTURE-DOCUMENT");
    const cross = await fetch(base + route.replace("T0001", "T0002"), {
      headers: headers("admin"),
    });
    assert.equal(cross.status, 404);
  }
  const html = await (
    await fetch(base + "/tenders/T0001?tab=documents", {
      headers: headers("viewer"),
    })
  ).text();
  assert.ok(!html.includes("/storage/v1/object/sign/"));
  assert.ok(html.includes("/download?"));
  const invalid = await fetch(
    `${base}/tenders/T0001/download?file=${fileId}&document=${documentId}`,
    { headers: headers("viewer") },
  );
  assert.equal(invalid.status, 400);
});

test("every exposed admin action rejects forged sessions and viewers before mutation", async () => {
  const actions = Object.entries(manifest.node).filter(
    ([, action]) =>
      !["login", "logout", "reportClientError"].includes(action.exportedName),
  );
  assert.ok(actions.length >= 20);
  for (const role of ["revoked", "viewer"]) {
    for (const [id, action] of actions) {
      const worker =
        Object.keys(action.workers).find((key) => !key.includes("[")) ||
        Object.keys(action.workers)[0];
      const route =
        worker
          .replace(/^app/, "")
          .replace(/\/page$/, "")
          .replace(/\[id\]/g, "T0001") || "/";
      const response = await fetch(base + route, {
        method: "POST",
        headers: headers(role, {
          "Next-Action": id,
          "Content-Type": "text/plain;charset=UTF-8",
          Origin: base,
        }),
        body: "[]",
        redirect: "manual",
      });
      assert.ok(
        response.headers.get("x-action-redirect"),
        `${role} ${action.exportedName}: ${response.status} ${(await response.text()).slice(0, 150)}`,
      );
    }
  }
  assert.equal(
    writes.length,
    0,
    "authorization failures must not mutate fixture data",
  );
});

test("cross-origin requests cannot execute an authenticated admin action", async () => {
  const [id] = Object.entries(manifest.node).find(
    ([, action]) => action.exportedName === "archiveTender",
  );
  const response = await fetch(base + "/tenders/T0001", {
    method: "POST",
    headers: headers("admin", {
      "Next-Action": id,
      "Content-Type": "text/plain;charset=UTF-8",
      Origin: "https://untrusted.example",
    }),
    body: JSON.stringify(["T0001"]),
    redirect: "manual",
  });
  assert.equal(response.status, 500);
  assert.equal(writes.length, 0);
});

test("security headers and login page expose no public workspace entry", async () => {
  const response = await fetch(base + "/login");
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.match(
    response.headers.get("content-security-policy"),
    /frame-ancestors 'none'/,
  );
  assert.equal(response.headers.get("x-powered-by"), null);
  const html = await response.text();
  assert.ok(!html.includes("Continue to public workspace"));
  assert.ok(!html.includes(tender.customer));
});

test("real login uses generic credential errors, secure cookies and revokes the session on logout", async () => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base + "/login?next=%2Ftenders", {
    waitUntil: "networkidle",
  });
  await page.getByLabel("Email address").fill(viewer.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("WrongFixturePassword!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page
    .getByText("Incorrect email or password.", { exact: true })
    .waitFor();
  assert.match(
    await page.locator("p.feedback[role=alert]").textContent(),
    /Incorrect email or password/,
  );
  await page.getByLabel("Email address").fill("unknown@example.test");
  const unknownResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/login",
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await unknownResponse;
  await page.waitForFunction(
    () => !document.querySelector('button[type="submit"]').disabled,
  );
  assert.match(
    await page.locator("p.feedback[role=alert]").textContent(),
    /Incorrect email or password/,
  );
  await page.getByLabel("Email address").fill(viewer.email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("OnlyFixturePassword!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/tenders");
  const cookie = (await context.cookies()).find(
    (cookie) => cookie.name === "zk_session",
  );
  assert.ok(cookie);
  assert.equal(cookie.httpOnly, true);
  assert.equal(cookie.secure, true);
  assert.equal(cookie.sameSite, "Lax");
  assert.ok(tables.sessions.some((row) => row.id === hash(cookie.value)));
  await page
    .getByRole("button", { name: viewer.name, exact: false })
    .first()
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign out", exact: true })
    .click();
  await page.waitForURL("**/login");
  assert.ok(!tables.sessions.some((row) => row.id === hash(cookie.value)));
  const reuse = await fetch(base + "/tenders/export", {
    headers: { Cookie: `zk_session=${cookie.value}` },
    redirect: "manual",
  });
  assert.ok([303, 307, 308].includes(reuse.status));
  await context.close();
});

test("real browser navigation respects session changes, login returns and document access", async () => {
  const context = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const target =
    "/tenders?" +
    new URLSearchParams({ track: "all", customer: tender.customer });
  await page.goto(base + target, { waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.equal(new URL(page.url()).searchParams.get("next"), target);
  await context.addCookies([
    {
      name: "zk_session",
      value: tokens.viewer,
      domain: "localhost",
      path: "/",
    },
  ]);
  await page.goto(base + "/login?next=" + encodeURIComponent(target), {
    waitUntil: "networkidle",
  });
  assert.equal(new URL(page.url()).pathname, "/tenders");
  await page
    .getByRole("link", { name: "Analytics", exact: true })
    .last()
    .click();
  await page.waitForURL("**/analytics");
  await page
    .getByRole("heading", { name: "Tender analytics", exact: true })
    .waitFor();
  assert.ok((await page.locator("body").innerText()).includes("Rp"));
  await page.goto(base + "/tenders/T0001?tab=documents", {
    waitUntil: "networkidle",
  });
  const downloadLink = page.locator('a[href*="/download?"]:visible').first();
  await downloadLink.waitFor();
  const url = await downloadLink.getAttribute("href");
  tables.sessions = tables.sessions.filter(
    (row) => row.id !== hash(tokens.viewer),
  );
  const revoked = await context.request.get(base + url, { maxRedirects: 0 });
  assert.ok([303, 307, 308].includes(revoked.status()));
  await page.reload({ waitUntil: "networkidle" });
  assert.equal(new URL(page.url()).pathname, "/login");
  assert.deepEqual(errors, []);
  await context.close();
});
