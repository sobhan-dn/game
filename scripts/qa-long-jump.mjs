import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5173";
const outDir = path.resolve("output/web-game/long-jump-qa");
await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ["--use-gl=angle", "--use-angle=swiftshader"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("console", (message) => {
  if (message.type() === "error") errors.push({ type: "console", text: message.text() });
});
page.on("pageerror", (error) => errors.push({ type: "page", text: String(error) }));

const step = (milliseconds) => page.evaluate((ms) => window.advanceTime(ms), milliseconds);
const snapshot = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(300);
await page.click("#start-button");
await step(1400);
const countdown = await snapshot();
await page.screenshot({ path: path.join(outDir, "01-countdown-contact.png") });

assert.ok(countdown.countdown > 1.4 && countdown.countdown < 1.7);
assert.equal(countdown.player.grounded, true);
assert.ok(countdown.player.surfaceGap <= 0.002);
assert.equal(countdown.player.surfaceOffset, 1.02);
assert.equal(countdown.audio.playing, true);
assert.match(countdown.audio.style, /drums, bass, arpeggio, and pads/);

await step(1650);
await page.keyboard.down("ArrowUp");
await page.keyboard.press("Space");
await step(17);
const launched = await snapshot();
assert.equal(launched.player.grounded, false);
assert.ok(launched.player.normalVelocity > 40);

let maxSurfaceGap = launched.player.surfaceGap;
let maxAirborneTime = launched.player.airborneTime;
let landing = null;
const samples = [launched];
for (let i = 0; i < 42; i += 1) {
  await step(50);
  const current = await snapshot();
  samples.push(current);
  maxSurfaceGap = Math.max(maxSurfaceGap, current.player.surfaceGap);
  maxAirborneTime = Math.max(maxAirborneTime, current.player.airborneTime);
  if (i === 8) await page.screenshot({ path: path.join(outDir, "02-long-jump.png") });
  if (i > 5 && current.player.grounded) {
    landing = current;
    break;
  }
}
await page.keyboard.up("ArrowUp");

assert.ok(maxSurfaceGap > 7, `expected a tall jump, measured surface gap ${maxSurfaceGap}`);
assert.ok(maxAirborneTime > 0.6, `expected longer airtime, measured ${maxAirborneTime}`);
assert.ok(landing, "expected the cat to land after the long jump");
assert.equal(landing.player.grounded, true);
assert.ok(landing.player.surfaceGap <= 0.002);
assert.equal(errors.length, 0);

await page.screenshot({ path: path.join(outDir, "03-landing.png") });
const result = {
  countdown,
  launched,
  maxSurfaceGap,
  maxAirborneTime,
  landing,
  transferredPlanet: landing.player.platform !== launched.player.platform,
  sampleCount: samples.length,
  errors,
};
await writeFile(path.join(outDir, "result.json"), JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify({
  maxSurfaceGap: +maxSurfaceGap.toFixed(3),
  maxAirborneTime: +maxAirborneTime.toFixed(3),
  launchPlatform: launched.player.platform,
  landingPlatform: landing.player.platform,
  transferredPlanet: result.transferredPlanet,
  errors: errors.length,
}));
