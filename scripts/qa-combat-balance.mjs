import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:5173";
const seeds = [11, 29, 47];
const baselineDeaths = [3, 4, 5];
const outDir = path.resolve("output/web-game/combat-balance-qa");
const navigationTimeout = 90_000;
const results = {
  url,
  seeds,
  baselineDeaths,
  simulatedSeconds: 30,
  generatedAt: new Date().toISOString(),
  idleRuns: [],
  aggregate: null,
  phaseParry: null,
  passed: false,
};
const errors = {
  console: [],
  page: [],
  requests: [],
  fatal: null,
};

let browser;
let fatalError;

await mkdir(outDir, { recursive: true });

try {
  browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });

  for (const seed of seeds) {
    const scenario = `idle-seed-${seed}`;
    const { context, page } = await openSeededPage(seed, scenario);
    try {
      await page.click("#start-button");
      const run = await page.evaluate(() => {
        window.advanceTime(3050);
        const start = JSON.parse(window.render_game_to_text());
        let minHealth = start.player.health;
        let minShield = start.player.shield;
        let minRivalHealth = start.rival.health;
        let minRivalShield = start.rival.shield;
        let maxActive = 0;
        let maxAllowed = 0;
        let maxIncoming = 0;
        let maxEnemies = start.enemiesRemaining;
        let slotViolations = 0;
        let firstShieldDamage = null;
        let firstHealthDamage = null;
        let shieldRegenObserved = false;
        let healthRegenObserved = false;
        let previousShield = start.player.shield;
        let previousHealth = start.player.health;
        let previousTarget = null;
        let targetTransitions = 0;
        const targetTicks = { enemy: 0, player: 0, other: 0 };
        const actionTicks = {};
        const checkpoints = [];

        for (let index = 0; index < 30; index += 1) {
          window.advanceTime(1000);
          const state = JSON.parse(window.render_game_to_text());
          const second = index + 1;

          minHealth = Math.min(minHealth, state.player.health);
          minShield = Math.min(minShield, state.player.shield);
          minRivalHealth = Math.min(minRivalHealth, state.rival.health);
          minRivalShield = Math.min(minRivalShield, state.rival.shield);
          maxActive = Math.max(maxActive, state.combatDirector.activeAttackers);
          maxAllowed = Math.max(maxAllowed, state.combatDirector.maxAttackers);
          maxIncoming = Math.max(maxIncoming, state.combatDirector.incomingThreats);
          maxEnemies = Math.max(maxEnemies, state.enemiesRemaining);
          if (state.combatDirector.activeAttackers > state.combatDirector.maxAttackers) slotViolations += 1;
          if (firstShieldDamage === null && state.player.shield < start.player.shield - 0.05) firstShieldDamage = second;
          if (firstHealthDamage === null && state.player.health < start.player.health - 0.05) firstHealthDamage = second;
          if (state.player.shield > previousShield + 0.15) shieldRegenObserved = true;
          if (state.player.health > previousHealth + 0.15) healthRegenObserved = true;
          previousShield = state.player.shield;
          previousHealth = state.player.health;

          const target = state.aiRival?.targetType || "other";
          targetTicks[target in targetTicks ? target : "other"] += 1;
          if (previousTarget !== null && target !== previousTarget) targetTransitions += 1;
          previousTarget = target;
          const action = state.aiRival?.action || "none";
          actionTicks[action] = (actionTicks[action] || 0) + 1;

          if ((index + 1) % 5 === 0) {
            checkpoints.push({
              second,
              health: state.player.health,
              shield: state.player.shield,
              deaths: state.combatDirector.localDeaths,
              scores: state.scores,
              activeAttackers: state.combatDirector.activeAttackers,
              allowedAttackers: state.combatDirector.maxAttackers,
              incomingThreats: state.combatDirector.incomingThreats,
              aiTarget: state.aiRival?.targetType,
            });
          }
        }

        const final = JSON.parse(window.render_game_to_text());
        return {
          start: {
            timeLeft: start.timeLeft,
            shield: start.player.shield,
            invulnerableFor: start.player.invulnerableFor,
            enemies: start.enemiesRemaining,
            enemyCap: start.difficulty.enemyCap,
          },
          simulatedElapsed: +(start.timeLeft - final.timeLeft).toFixed(2),
          deaths: final.combatDirector.localDeaths,
          minHealth,
          minShield,
          minRivalHealth,
          minRivalShield,
          finalHealth: final.player.health,
          finalShield: final.player.shield,
          finalRivalHealth: final.rival.health,
          finalRivalShield: final.rival.shield,
          scores: final.scores,
          firstShieldDamage,
          firstHealthDamage,
          shieldRegenObserved,
          healthRegenObserved,
          maxActive,
          maxAllowed,
          maxIncoming,
          maxEnemies,
          slotViolations,
          targetSeconds: Object.fromEntries(
            Object.entries(targetTicks).map(([key, ticks]) => [key, +ticks.toFixed(2)])
          ),
          targetTransitions,
          actionSeconds: Object.fromEntries(
            Object.entries(actionTicks).map(([key, ticks]) => [key, +ticks.toFixed(2)])
          ),
          directorFinal: final.combatDirector,
          checkpoints,
        };
      });

      results.idleRuns.push({ seed, baselineDeaths: baselineDeaths[seeds.indexOf(seed)], ...run });
      console.log(`Completed deterministic idle balance seed ${seed}`);
    } finally {
      await context.close();
    }
  }

  const parryScenario = "phase-parry-seed-11";
  const { context: parryContext, page: parryPage } = await openSeededPage(11, parryScenario);
  try {
    await parryPage.click("#start-button");
    results.phaseParry = await parryPage.evaluate(() => {
      window.advanceTime(3050);
      const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
      let closestSeen = Infinity;
      let detectedAt = null;
      let before = null;
      let after = null;

      let fineTracking = false;
      let simulated = 0;
      for (let index = 0; index < 1200 && simulated < 60; index += 1) {
        const step = fineTracking ? 50 : 100;
        window.advanceTime(step);
        simulated += step / 1000;
        const state = JSON.parse(window.render_game_to_text());
        const enemyProjectiles = state.projectiles
          .filter((projectile) => projectile.owner === "enemy")
          .map((projectile) => ({ ...projectile, distance: distance(projectile.position, state.player.position) }))
          .sort((a, b) => a.distance - b.distance);
        if (enemyProjectiles[0]) closestSeen = Math.min(closestSeen, enemyProjectiles[0].distance);
        fineTracking = Boolean(enemyProjectiles[0]);

        if (enemyProjectiles[0]?.distance <= 6.5 && state.player.dashCooldown <= 0) {
          detectedAt = +(120 - state.timeLeft).toFixed(2);
          before = {
            health: state.player.health,
            shield: state.player.shield,
            riftCharge: state.riftCharge,
            phaseParries: state.combatDirector.phaseParries,
            enemyProjectileCount: enemyProjectiles.length,
            projectile: enemyProjectiles[0],
          };
          document.dispatchEvent(new KeyboardEvent("keydown", { code: "ShiftLeft", bubbles: true, cancelable: true }));
          window.advanceTime(17);
          document.dispatchEvent(new KeyboardEvent("keyup", { code: "ShiftLeft", bubbles: true, cancelable: true }));
          const final = JSON.parse(window.render_game_to_text());
          after = {
            health: final.player.health,
            shield: final.player.shield,
            riftCharge: final.riftCharge,
            phaseParries: final.combatDirector.phaseParries,
            dashCooldown: final.player.dashCooldown,
            enemyProjectileCount: final.projectiles.filter((projectile) => projectile.owner === "enemy").length,
            message: final.message,
          };
          break;
        }
      }

      return {
        attempted: Boolean(before && after),
        detectedAt,
        closestSeen: Number.isFinite(closestSeen) ? +closestSeen.toFixed(3) : null,
        before,
        after,
      };
    });
  } finally {
    await parryContext.close();
  }

  for (const run of results.idleRuns) {
    assert.ok(run.simulatedElapsed >= 29.9 && run.simulatedElapsed <= 30.1, `seed ${run.seed}: expected 30 simulated seconds`);
    assert.equal(run.deaths, 0, `seed ${run.seed}: idle player should not die in the opening 30 seconds`);
    assert.ok(run.minHealth >= 70, `seed ${run.seed}: health pressure is still too lethal`);
    assert.ok(run.maxIncoming >= 1, `seed ${run.seed}: expected at least one readable incoming threat`);
    assert.ok(run.maxEnemies <= run.start.enemyCap, `seed ${run.seed}: enemy cap exceeded`);
    assert.equal(run.slotViolations, 0, `seed ${run.seed}: active attackers exceeded the director allowance`);
    assert.ok(run.targetSeconds.enemy > 0, `seed ${run.seed}: AI rival never targeted hostile enemies`);
    assert.ok(run.targetSeconds.player > 0, `seed ${run.seed}: AI rival never pressured the player`);
  }

  const totalTargetSeconds = results.idleRuns.reduce(
    (totals, run) => ({
      enemy: totals.enemy + run.targetSeconds.enemy,
      player: totals.player + run.targetSeconds.player,
      other: totals.other + run.targetSeconds.other,
    }),
    { enemy: 0, player: 0, other: 0 }
  );
  const currentDeaths = results.idleRuns.map((run) => run.deaths);
  results.aggregate = {
    baselineDeaths,
    currentDeaths,
    deathsPrevented: baselineDeaths.map((baseline, index) => baseline - currentDeaths[index]),
    totalTargetSeconds,
    enemyTargetShare: +(totalTargetSeconds.enemy / (totalTargetSeconds.enemy + totalTargetSeconds.player)).toFixed(3),
    maximumActiveAttackers: Math.max(...results.idleRuns.map((run) => run.maxActive)),
    maximumIncomingThreats: Math.max(...results.idleRuns.map((run) => run.maxIncoming)),
    maximumEnemyCount: Math.max(...results.idleRuns.map((run) => run.maxEnemies)),
    shieldDamageSeeds: results.idleRuns.filter((run) => run.minShield < run.start.shield).map((run) => run.seed),
    shieldRegenSeeds: results.idleRuns.filter((run) => run.shieldRegenObserved).map((run) => run.seed),
  };

  assert.ok(
    results.aggregate.shieldDamageSeeds.length >= Math.ceil(results.idleRuns.length * 2 / 3),
    "expected shield pressure in at least two of the three seeded runs"
  );
  assert.ok(
    results.aggregate.shieldRegenSeeds.length >= Math.ceil(results.idleRuns.length * 2 / 3),
    "expected shield regeneration in at least two of the three seeded runs"
  );

  assert.equal(results.phaseParry.attempted, true, "expected a real enemy projectile to enter parry range");
  assert.ok(
    results.phaseParry.after.phaseParries > results.phaseParry.before.phaseParries,
    "phase parry counter should increment"
  );
  assert.ok(
    results.phaseParry.after.riftCharge >= results.phaseParry.before.riftCharge + 6,
    "phase parry should award Rift charge"
  );
  assert.equal(results.phaseParry.after.health, results.phaseParry.before.health, "phase parry should prevent health damage");
  assert.ok(results.phaseParry.after.shield >= results.phaseParry.before.shield, "phase parry should prevent shield damage");
  assert.ok(results.phaseParry.after.dashCooldown > 0, "phase parry must consume the dash cooldown");
  assert.equal(errors.console.length, 0, "unexpected console errors");
  assert.equal(errors.page.length, 0, "unexpected page errors");
  assert.equal(errors.requests.length, 0, "unexpected failed requests");
  results.passed = true;
} catch (error) {
  fatalError = error;
  errors.fatal = serializeError(error);
} finally {
  results.finishedAt = new Date().toISOString();
  try {
    await writeFile(path.join(outDir, "results.json"), JSON.stringify(results, null, 2));
    await writeFile(path.join(outDir, "errors.json"), JSON.stringify(errors, null, 2));
  } finally {
    await browser?.close();
  }
}

if (fatalError) throw fatalError;

console.log(JSON.stringify({
  passed: results.passed,
  idleDeaths: results.idleRuns.map((run) => run.deaths),
  baselineDeaths,
  enemyTargetShare: results.aggregate.enemyTargetShare,
  phaseParries: results.phaseParry.after.phaseParries - results.phaseParry.before.phaseParries,
  artifacts: outDir,
}, null, 2));

async function openSeededPage(seed, scenario) {
  const context = await browser.newContext({ viewport: { width: 390, height: 240 }, deviceScaleFactor: 1 });
  await context.addInitScript((initialSeed) => {
    let value = initialSeed >>> 0;
    Math.random = () => {
      value += 0x6d2b79f5;
      let result = value;
      result = Math.imul(result ^ result >>> 15, result | 1);
      result ^= result + Math.imul(result ^ result >>> 7, result | 61);
      return ((result ^ result >>> 14) >>> 0) / 4294967296;
    };
  }, seed);

  const page = await context.newPage();
  page.setDefaultNavigationTimeout(navigationTimeout);
  page.setDefaultTimeout(navigationTimeout);
  page.on("console", (message) => {
    if (message.type() === "error") errors.console.push({ scenario, text: message.text() });
  });
  page.on("pageerror", (error) => errors.page.push({ scenario, ...serializeError(error) }));
  page.on("requestfailed", (request) => {
    errors.requests.push({ scenario, url: request.url(), error: request.failure()?.errorText || "request failed" });
  });

  try {
    await page.goto(url, { waitUntil: "commit", timeout: navigationTimeout });
    await page.waitForFunction(
      () => typeof window.advanceTime === "function"
        && typeof window.render_game_to_text === "function"
        && JSON.parse(window.render_game_to_text()).difficulty?.profile === "adaptive-explorer",
      null,
      { timeout: navigationTimeout }
    );
    return { context, page };
  } catch (error) {
    await context.close();
    throw error;
  }
}

function serializeError(error) {
  return {
    name: error?.name || "Error",
    message: error?.message || String(error),
    stack: error?.stack || "",
  };
}
