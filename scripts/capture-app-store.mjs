import assert from "node:assert/strict";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5173";
const outDir = path.resolve("marketing/app-store-screenshots");
const legacyDir = path.resolve("marketing/screenshots");
await mkdir(outDir, { recursive: true });
await mkdir(legacyDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  colorScheme: "dark",
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "page", text: String(error) }));

await page.addInitScript(() => {
  try {
    localStorage.setItem("speedy-jumper-best-score", "42");
    localStorage.setItem("speedy-jumper-best-streak", "7");
    localStorage.setItem("speedy-jumper-coins", "128");
    localStorage.setItem("speedy-jumper-daily-progress", JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      value: 8,
    }));
  } catch {}
});

const step = (milliseconds) => page.evaluate((value) => window.advanceTime(value), milliseconds);
const capture = async (filename) => {
  const target = path.join(outDir, filename);
  const buffer = await page.screenshot({ path: target });
  assert.equal(buffer.readUInt32BE(16), 1290, `${filename} width is not 1290`);
  assert.equal(buffer.readUInt32BE(20), 2796, `${filename} height is not 2796`);
  return target;
};

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
  await page.waitForFunction(
    () => typeof window.render_game_to_text === "function" && typeof window.advanceTime === "function",
    undefined,
    { timeout: 90_000 },
  );
  await page.waitForTimeout(350);
  await capture("01-mode-select.png");

  await page.locator("#start-button").tap();
  await step(3_080);
  await page.waitForTimeout(80);
  await capture("02-live-arena.png");

  await page.locator("#touch-fire").tap();
  await step(40);
  await page.waitForTimeout(40);
  await capture("03-aim-fire.png");

  await page.locator("#touch-dash").tap();
  await step(80);
  await page.waitForTimeout(40);
  await capture("04-streak-coins.png");

  await page.locator("#touch-jump").tap();
  await step(150);
  await page.waitForTimeout(40);
  await capture("05-two-minute-score.png");

  await copyFile(path.join(outDir, "01-mode-select.png"), path.join(legacyDir, "iphone-67-mode-select.png"));
  await copyFile(path.join(outDir, "02-live-arena.png"), path.join(legacyDir, "iphone-67-solo-ai-gameplay.png"));
  assert.deepEqual(errors, [], "Browser errors occurred during App Store capture");
  await writeFile(path.join(outDir, "capture-report.json"), JSON.stringify({
    url,
    viewport: "430x932@3x",
    output: "1290x2796",
    files: [
      "01-mode-select.png",
      "02-live-arena.png",
      "03-aim-fire.png",
      "04-streak-coins.png",
      "05-two-minute-score.png",
    ],
    note: "All screenshots are captured directly from the live solo build with no composited gameplay or external overlays.",
    errors,
  }, null, 2));
  console.log(`Captured five App Store screenshots at ${outDir}`);
} finally {
  await context.close();
  await browser.close();
}
