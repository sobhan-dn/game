import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:5173";
const outDir = path.resolve("output/web-game/solar-cats-mobile-qa");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "page", text: String(error) }));

const step = (ms) => page.evaluate((value) => window.advanceTime(value), ms);
const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(350);
await page.screenshot({ path: path.join(outDir, "01-menu.png") });
await page.locator("#start-button").tap();
await step(3050);

await page.evaluate(() => {
  const stick = document.querySelector("#touch-stick");
  const rect = stick.getBoundingClientRect();
  const common = { pointerId: 9, pointerType: "touch", bubbles: true, cancelable: true, isPrimary: true };
  stick.dispatchEvent(new PointerEvent("pointerdown", {
    ...common,
    clientX: rect.left + rect.width * 0.5,
    clientY: rect.top + rect.height * 0.5,
  }));
  stick.dispatchEvent(new PointerEvent("pointermove", {
    ...common,
    clientX: rect.left + rect.width * 0.84,
    clientY: rect.top + rect.height * 0.24,
  }));
});
await step(520);
await page.evaluate(() => {
  const stick = document.querySelector("#touch-stick");
  stick.dispatchEvent(new PointerEvent("pointerup", {
    pointerId: 9,
    pointerType: "touch",
    bubbles: true,
    cancelable: true,
    isPrimary: true,
  }));
});
const moved = await state();

await page.locator("#touch-jump").tap();
await step(140);
const jumped = await state();
await page.locator("#touch-dash").tap();
await step(60);
const dashed = await state();
await page.locator("#touch-fire").tap();
await step(34);
const fired = await state();

await page.screenshot({ path: path.join(outDir, "02-game.png") });
const controls = await page.evaluate(() => ["touch-stick", "touch-jump", "touch-dash", "touch-surge", "touch-fire"].map((id) => {
  const element = document.getElementById(id);
  const rect = element.getBoundingClientRect();
  return { id, visible: rect.width > 0 && rect.height > 0, left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
}));

assert.equal(moved.player.species, "cat");
assert.notEqual(moved.player.gait, "idle");
assert.equal(jumped.player.grounded, false);
assert.ok(jumped.player.normalVelocity > 0);
assert.ok(dashed.player.dashCooldown > 0);
assert.ok(fired.projectiles.some((projectile) => projectile.owner === "p1"));
assert.ok(controls.every((control) => control.visible));
assert.ok(controls.every((control) => control.left >= 0 && control.right <= 390 && control.top >= 0 && control.bottom <= 844));
assert.equal(errors.length, 0);

await writeFile(path.join(outDir, "state.json"), JSON.stringify({ moved, jumped, dashed, fired, controls }, null, 2));
await writeFile(path.join(outDir, "errors.json"), JSON.stringify(errors, null, 2));
await context.close();
await browser.close();
console.log(`Solar Cats mobile QA passed; artifacts: ${outDir}`);
