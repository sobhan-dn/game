import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import assert from "node:assert/strict";
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:5173";
const outDir = path.resolve("output/web-game/solar-cats-qa");
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

const step = async (milliseconds) => {
  await page.evaluate((ms) => window.advanceTime(ms), milliseconds);
  await page.waitForTimeout(40);
};
const capture = async (name) => {
  await page.screenshot({ path: path.join(outDir, `${name}.png`) });
};
const snapshot = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
const snapshots = {};

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
await page.waitForTimeout(350);
await page.click("#start-button");
await step(3050);
await page.waitForTimeout(250);
snapshots.idle = await snapshot();
await capture("01-idle");

await page.keyboard.down("ArrowRight");
await step(520);
snapshots.gallop = await snapshot();
await capture("02-gallop");
await page.keyboard.up("ArrowRight");

await page.keyboard.press("Space");
await step(150);
snapshots.airborne = await snapshot();
await capture("03-airborne");

const canvas = page.locator("#game");
const box = await canvas.boundingBox();
if (box) {
  await page.mouse.move(box.x + box.width * 0.52, box.y + box.height * 0.48);
  await page.mouse.down({ button: "right" });
  await step(70);
  snapshots.dash = await snapshot();
  await capture("04-dash");
  await page.mouse.up({ button: "right" });

  await page.mouse.down({ button: "left" });
  await step(34);
  snapshots.fire = await snapshot();
  await capture("05-fire");
  await page.mouse.up({ button: "left" });
}

for (let i = 0; i < 60; i += 1) {
  const current = await snapshot();
  if (current.player?.grounded) break;
  await step(100);
}
snapshots.landed = await snapshot();
await capture("06-landed");

assert.equal(snapshots.idle.player?.species, "cat");
assert.equal(snapshots.idle.player?.anatomy, "quadruped");
assert.equal(snapshots.idle.planets?.length, 8);
assert.equal(new Set(snapshots.idle.planets.map((planet) => planet.surfaceTexture)).size, 8);
assert.ok(snapshots.idle.planets.find((planet) => planet.key === "earth")?.clouds);
assert.ok(snapshots.idle.planets.find((planet) => planet.key === "saturn")?.rings);
assert.ok(snapshots.idle.enemies?.every((enemy) => enemy.species === "cat"));
assert.ok(Math.hypot(...Object.values(snapshots.gallop.player.velocity)) > 1);
assert.notEqual(snapshots.gallop.player.gait, "idle");
assert.equal(snapshots.airborne.player.grounded, false);
assert.ok(snapshots.airborne.player.normalVelocity > 0);
assert.ok(snapshots.dash.player.dashCooldown > 0);
assert.ok(snapshots.fire.projectiles.some((projectile) => projectile.owner === "p1"));
assert.equal(snapshots.landed.player.grounded, true);
assert.ok(Object.values(snapshots.landed.player.pawContacts).some(Boolean));

await writeFile(path.join(outDir, "state.json"), JSON.stringify(snapshots, null, 2));
await writeFile(path.join(outDir, "errors.json"), JSON.stringify(errors, null, 2));
await browser.close();

if (errors.length) {
  console.error(JSON.stringify(errors, null, 2));
  process.exitCode = 1;
} else {
  console.log(`Solar Cats QA passed; artifacts: ${outDir}`);
}
