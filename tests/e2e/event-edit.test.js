// Regression suite for the event-edit-prefill bug found 2026-08-21: opening
// the edit form for an already-created event left its fields blank.
//
// Runs against the REAL app (real index.html + skupni-koledar.jsx, served
// locally and rendered in a real headless browser) with the Supabase network
// calls intercepted and replaced by fixed fixtures, so it never touches the
// shared production calendar data. Two things happened in that Supabase
// table that make good fixtures: events created before per-day ids existed
// (empty id suffix on the storage key) and a duration stored with a plain
// hyphen instead of the current en-dash format -- both are reproduced below.
//
// Not run via `node --test` (which requires files to only use node:test's
// declarative API) because Playwright needs an async browser lifecycle
// around the whole suite; this is a plain script with its own pass/fail
// tally instead. Run with: npm run test:e2e

const path = require("path");
const assert = require("node:assert/strict");
const { chromium } = require("playwright");
const { startServer } = require("./static-server.js");

const APP_ROOT = path.join(__dirname, "..", "..");

async function mockKvStore(page, rows) {
  await page.route("**/rest/v1/kv_store**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(rows),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
    }
  });
}

async function loginAsThrowawayUser(page, baseUrl) {
  await page.goto(`${baseUrl}/index.html`, { waitUntil: "networkidle" });
  await page.fill('input[placeholder="Ime"]', "Test");
  await page.fill('input[placeholder="Priimek"]', "Uporabnik");
  await page.click("text=Vstopi");
  await page.waitForTimeout(1000);
}

function eventRow(iso, idSuffix, value) {
  return { key: `avail:${iso}:__event__${idSuffix}`, value: JSON.stringify(value) };
}

const results = [];

async function runTest(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`ok - ${name}`);
  } catch (err) {
    results.push({ name, ok: false, err });
    console.log(`FAIL - ${name}`);
    console.log(err.message);
  }
}

(async () => {
  const server = await startServer(APP_ROOT);
  const browser = await chromium.launch();

  try {
    await runTest("edit prefills fields for a normal, current-format event", async () => {
      const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
      const today = new Date().toISOString().slice(0, 10);
      await mockKvStore(page, [
        eventRow(today, "111111", {
          title: "Test Dogodek",
          description: "Opis testa",
          duration: "18:00–20:00",
          createdBy: "Test Uporabnik",
          attendees: [],
        }),
      ]);
      await loginAsThrowawayUser(page, server.url);
      await page.click('button[aria-label="Uredi dogodek"]');
      await page.waitForTimeout(300);

      assert.equal(await page.locator('input[placeholder="Ime dogodka"]').inputValue(), "Test Dogodek");
      assert.equal(await page.locator('input[aria-label="Začetek dogodka"]').inputValue(), "18:00");
      assert.equal(await page.locator('input[aria-label="Konec dogodka"]').inputValue(), "20:00");
      assert.equal(await page.locator('textarea[placeholder="Opis dogodka"]').inputValue(), "Opis testa");
      await page.close();
    });

    await runTest("edit prefills fields for a legacy event (empty id, hyphen duration)", async () => {
      // This is the exact shape of the real "Odbojka" row that triggered the
      // bug report: no id suffix on the key, and "20:00 - 22:00" instead of
      // "20:00–22:00".
      const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
      const today = new Date().toISOString().slice(0, 10);
      await mockKvStore(page, [
        eventRow(today, "", {
          title: "Odbojka",
          description: "Poden",
          duration: "20:00 - 22:00",
          createdBy: "Test Uporabnik",
          attendees: ["Test Uporabnik"],
        }),
      ]);
      await loginAsThrowawayUser(page, server.url);
      await page.click('button[aria-label="Uredi dogodek"]');
      await page.waitForTimeout(300);

      assert.equal(await page.locator('input[placeholder="Ime dogodka"]').inputValue(), "Odbojka");
      assert.equal(await page.locator('input[aria-label="Začetek dogodka"]').inputValue(), "20:00");
      assert.equal(await page.locator('input[aria-label="Konec dogodka"]').inputValue(), "22:00");
      assert.equal(await page.locator('textarea[placeholder="Opis dogodka"]').inputValue(), "Poden");
      await page.close();
    });

    await runTest("editing the second of two events on the same day loads the right one", async () => {
      const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
      const today = new Date().toISOString().slice(0, 10);
      await mockKvStore(page, [
        eventRow(today, "111111", {
          title: "Prvi Dogodek",
          description: "",
          duration: "18:00–20:00",
          createdBy: "Test Uporabnik",
          attendees: [],
        }),
        eventRow(today, "222222", {
          title: "Drugi Dogodek",
          description: "",
          duration: "21:00–23:00",
          createdBy: "Test Uporabnik",
          attendees: [],
        }),
      ]);
      await loginAsThrowawayUser(page, server.url);
      const editButtons = page.locator('button[aria-label="Uredi dogodek"]');
      assert.equal(await editButtons.count(), 2);
      await editButtons.nth(1).click();
      await page.waitForTimeout(300);

      assert.equal(await page.locator('input[placeholder="Ime dogodka"]').inputValue(), "Drugi Dogodek");
      await page.close();
    });

    await runTest("canceling a new-event draft doesn't leak into the next form opened", async () => {
      const page = await browser.newPage({ viewport: { width: 480, height: 900 } });
      const today = new Date().toISOString().slice(0, 10);
      await mockKvStore(page, [
        eventRow(today, "111111", {
          title: "Obstoječi",
          description: "",
          duration: "18:00–19:00",
          createdBy: "Test Uporabnik",
          attendees: [],
        }),
      ]);
      await loginAsThrowawayUser(page, server.url);

      // Start a new event, type a draft title, then cancel without saving.
      await page.click('button[aria-label="Dodaj nov dogodek"]');
      await page.waitForTimeout(200);
      await page.fill('input[placeholder="Ime dogodka"]', "Osnutek ki se ne shrani");
      await page.click("text=Prekliči");
      await page.waitForTimeout(200);

      // Now edit the existing event -- its real title must show, not the
      // canceled draft.
      await page.click('button[aria-label="Uredi dogodek"]');
      await page.waitForTimeout(200);
      assert.equal(await page.locator('input[placeholder="Ime dogodka"]').inputValue(), "Obstoječi");
      await page.close();
    });
  } finally {
    await browser.close();
    server.close();
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exit(1);
})();
