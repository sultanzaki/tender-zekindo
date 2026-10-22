import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createServer } from "node:http";
import { build } from "esbuild";
import { chromium } from "playwright";
let browser, server, directory, base;
before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "zekindo-ui-"));
  const mocks = path.resolve("tests/ui/mocks.tsx");
  await build({
    entryPoints: ["tests/ui/harness.tsx"],
    outdir: directory,
    bundle: true,
    format: "esm",
    jsx: "automatic",
    plugins: [
      {
        name: "isolate-server-actions",
        setup(b) {
          b.onResolve(
            { filter: /^next\/(link|image|navigation)$/ },
            (args) => ({ path: args.path, namespace: "next-mock" }),
          );
          b.onLoad({ filter: /.*/, namespace: "next-mock" }, (args) => ({
            contents:
              args.path === "next/link"
                ? `export {Link as default} from ${JSON.stringify(mocks)}`
                : args.path === "next/image"
                  ? `export {Image as default} from ${JSON.stringify(mocks)}`
                  : `export {useRouter,usePathname,useSearchParams} from ${JSON.stringify(mocks)}`,
            loader: "js",
            resolveDir: process.cwd(),
          }));
          b.onResolve(
            {
              filter:
                /^@\/lib\/(actions|auth\/actions|milestone-actions|folder-actions)$/,
            },
            () => ({ path: mocks }),
          );
        },
      },
    ],
  });
  server = createServer(async (req, res) => {
    const file = req.url.split("?")[0];
    if (file === "/harness.js" || file === "/harness.css") {
      res.setHeader(
        "Content-Type",
        file.endsWith(".js") ? "text/javascript" : "text/css",
      );
      res.end(await readFile(path.join(directory, file)));
    } else {
      res.setHeader("Content-Type", "text/html");
      res.end(
        '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/harness.css"></head><body><div id="root"></div><script type="module" src="/harness.js"></script></body></html>',
      );
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
    args: ["--no-sandbox"],
  });
});
after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
  if (directory) await rm(directory, { recursive: true, force: true });
});
async function open(component, width = 1280) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.goto(`${base}/?component=${component}`);
  return page;
}
test("mobile admin can reach users and sign out; Escape restores focus", async () => {
  const page = await open("nav", 375);
  await page.goto(page.url() + "&track=downstream");
  await page.getByRole("button", { name: "Open menu" }).click();
  assert.equal(
    await page.getByRole("link", { name: "Manage users" }).isVisible(),
    true,
  );
  assert.equal(
    await page.getByRole("button", { name: "Sign out" }).isVisible(),
    true,
  );
  assert.equal(
    await page.getByRole("link", {name: "+ New Tender", exact: true}).getAttribute("href"),
    "/tenders/new?track=downstream",
  );
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Open menu" })
      .evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
  );
  await page.close();
});
test("decimal amounts retain fractions and large integers without precision loss", async () => {
  const page = await open("number");
  const input = page.getByRole("textbox", { name: "Amount" });
  await input.focus();
  assert.equal(await input.inputValue(), "123.45");
  await input.fill("9007199254740993.50");
  await input.blur();
  assert.equal(await input.inputValue(), "9.007.199.254.740.993,50");
  assert.equal(
    await page.locator("output").textContent(),
    "9007199254740993.50",
  );
  await page.close();
});
test("wizard validates required fields before advancing", async () => {
  const page = await open("wizard");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  assert.equal(
    await page.getByRole("combobox", { name: "Area", exact: true }).isVisible(),
    true,
  );
  await page
    .getByRole("combobox", { name: "Area", exact: true })
    .selectOption("Jawa");
  await page
    .getByRole("combobox", { name: "Customer", exact: true })
    .selectOption("Customer");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Entity / Consortium", exact: true })
    .waitFor();
  await page.close();
});
test("filtering resets pagination and clears hidden bulk selection", async () => {
  const page = await open("table");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Select tender TN-101", exact: true })
    .check();
  await page.getByRole("searchbox").fill("Package 1");
  assert.equal(
    await page.getByText("Page 1 of 1", { exact: true }).isVisible(),
    true,
  );
  assert.equal(await page.getByText("1 selected", { exact: true }).count(), 0);
  await page
    .getByRole("button", { name: "Reset filters", exact: true })
    .click();
  assert.equal(
    await page.getByText("Page 1 of 3", { exact: true }).isVisible(),
    true,
  );
  await page.close();
});
test("sorting and column menu work with keyboard", async () => {
  const page = await open("table");
  const sort = page.getByRole("button", { name: "Customer", exact: true });
  await sort.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("columnheader", { name: /Customer/ })
      .getAttribute("aria-sort"),
    "ascending",
  );
  await page.getByRole("button", { name: "Columns", exact: true }).click();
  await page.keyboard.press("Escape");
  assert.equal(
    await page
      .getByRole("button", { name: "Columns", exact: true })
      .getAttribute("aria-expanded"),
    "false",
  );
  assert.equal(
    await page
      .getByRole("link", { name: "TN-1", exact: true })
      .getAttribute("href"),
    "/tenders/0",
  );
  await page.close();
});
test("failed removal preserves user row and failed role update preserves role", async () => {
  const page = await open("users");
  page.on("dialog", (d) => d.accept());
  const row = page.getByRole("row").filter({ hasText: "Test Viewer" });
  await row.getByRole("button", { name: "Remove", exact: true }).click();
  await page.getByRole("alert").waitFor();
  assert.equal(await row.count(), 1);
  await row.getByRole("combobox").selectOption("admin");
  await page
    .getByRole("alert")
    .filter({ hasText: "Could not update role" })
    .waitFor();
  assert.equal(await row.getByRole("combobox").inputValue(), "viewer");
  await page.close();
});
test("creating user refreshes list after success", async () => {
  const page = await open("users");
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("New user");
  await page
    .getByRole("textbox", { name: "Email", exact: true })
    .fill("new@example.test");
  await page.getByLabel("Password", { exact: true }).fill("example-password");
  await page.getByRole("button", { name: "Create user", exact: true }).click();
  await page.getByRole("status").waitFor();
  assert.equal(
    await page.locator("body").getAttribute("data-refreshed"),
    "true",
  );
  await page.close();
});
test("adding folder expands collapsed section; failed upload enables retry", async () => {
  const page = await open("documents");
  await page.getByRole("button", { name: "+ Folder", exact: true }).click();
  assert.equal(await page.getByPlaceholder("Nama folder").isVisible(), true);
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "test.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("fixture"),
    });
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page
      .getByRole("button", { name: "+ Folder", exact: true })
      .isEnabled(),
    true,
  );
  await page.close();
});
test("quick-edit result can be opened with keyboard", async () => {
  const page = await open("table");
  const edit = page.getByRole("button", {
    name: "Edit result for TN-1",
    exact: true,
  });
  await edit.focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page
      .getByRole("combobox", { name: "Edit result for TN-1", exact: true })
      .isVisible(),
    true,
  );
  await page.close();
});
test("bulk action errors use alert feedback instead of success styling", async () => {
  const page = await open("table");
  page.on("dialog", (d) => d.accept());
  await page
    .getByRole("checkbox", { name: "Select tender TN-1", exact: true })
    .check();
  await page
    .getByRole("button", { name: "Archive selected", exact: true })
    .click();
  await page.getByRole("alert").waitFor();
  assert.equal(
    await page.getByRole("alert").textContent(),
    "Could not archive tenders",
  );
  assert.equal(
    await page
      .getByRole("checkbox", { name: "Select tender TN-1", exact: true })
      .isChecked(),
    true,
  );
  await page.close();
});
