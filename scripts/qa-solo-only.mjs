import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "node:net";
import path from "node:path";
import { chromium } from "playwright";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexUrl = pathToFileURL(path.join(projectRoot, "index.html")).href;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function findOpenPort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  assert.ok(address && typeof address === "object", "Could not allocate a local QA port");
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function waitForServer(origin, serverProcess) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode !== null || serverProcess.signalCode !== null) {
      throw new Error(`Local server exited early (${serverProcess.exitCode ?? serverProcess.signalCode})`);
    }
    try {
      const response = await fetch(origin, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // The server may still be binding its socket.
    }
    await delay(100);
  }
  throw new Error(`Timed out waiting for ${origin}`);
}

async function stopServer(serverProcess) {
  if (!serverProcess || serverProcess.exitCode !== null || serverProcess.signalCode !== null) return;
  serverProcess.kill("SIGTERM");
  await Promise.race([once(serverProcess, "exit"), delay(3_000)]);
  if (serverProcess.exitCode === null && serverProcess.signalCode === null) {
    serverProcess.kill("SIGKILL");
    await Promise.race([once(serverProcess, "exit"), delay(1_000)]);
  }
}

function validateTelemetry(state, label) {
  assert.equal(state.gameMode, "solo", `${label}: telemetry must report solo mode`);
  assert.equal("role" in state, false, `${label}: legacy role telemetry is still present`);
  assert.equal("peer" in state, false, `${label}: legacy peer telemetry is still present`);
  assert.equal("ready" in state, false, `${label}: legacy ready telemetry is still present`);
  assert.ok(state.player && typeof state.player === "object", `${label}: player telemetry is missing`);
  assert.ok(state.rival && typeof state.rival === "object", `${label}: rival telemetry is missing`);
  assert.ok(state.aiRival && typeof state.aiRival === "object", `${label}: AI telemetry is missing`);
}

async function runTarget(browser, { label, url, httpOrigin = null }) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const initialRequests = [];
  const postLoadRequests = [];
  const webSocketEvents = [];
  let gameplayStarted = false;

  await context.addInitScript(() => {
    const attempts = [];
    Object.defineProperty(window, "__soloQaWebSocketAttempts", {
      value: attempts,
      configurable: false,
      writable: false,
    });
    const NativeWebSocket = window.WebSocket;
    class TrackedWebSocket extends NativeWebSocket {
      constructor(...args) {
        attempts.push(String(args[0]));
        super(...args);
      }
    }
    Object.defineProperty(window, "WebSocket", {
      value: TrackedWebSocket,
      configurable: true,
      writable: true,
    });
  });

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(String(error)));
  page.on("request", (request) => {
    const entry = { method: request.method(), type: request.resourceType(), url: request.url() };
    (gameplayStarted ? postLoadRequests : initialRequests).push(entry);
  });
  page.on("requestfailed", (request) => {
    consoleErrors.push(`Request failed: ${request.url()} (${request.failure()?.errorText || "unknown"})`);
  });
  page.on("websocket", (socket) => webSocketEvents.push({ event: "websocket", url: socket.url() }));

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    await page.waitForFunction(
      () => typeof window.render_game_to_text === "function" && typeof window.advanceTime === "function",
      undefined,
      { timeout: 90_000 },
    );
    await page.waitForLoadState("networkidle", { timeout: 90_000 });

    assert.equal(await page.locator("#mode-online").count(), 0, `${label}: #mode-online still exists`);
    const menuState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    validateTelemetry(menuState, `${label} menu`);
    assert.equal(menuState.mode, "menu", `${label}: expected menu before starting`);

    if (httpOrigin) {
      for (const request of initialRequests) {
        const requestUrl = new URL(request.url);
        if (["data:", "blob:"].includes(requestUrl.protocol)) continue;
        assert.equal(requestUrl.origin, httpOrigin, `${label}: unexpected initial request ${request.url}`);
      }
    } else {
      for (const request of initialRequests) {
        const protocol = new URL(request.url).protocol;
        assert.ok(["file:", "data:", "blob:"].includes(protocol), `${label}: unexpected network request ${request.url}`);
      }
    }

    gameplayStarted = true;
    await page.click("#start-button");
    await page.evaluate(() => window.advanceTime(4_200));
    await page.waitForTimeout(300);

    const playingState = await page.evaluate(() => JSON.parse(window.render_game_to_text()));
    validateTelemetry(playingState, `${label} gameplay`);
    assert.equal(playingState.mode, "playing", `${label}: game did not start`);
    assert.equal(playingState.countdown, 0, `${label}: start countdown did not finish`);
    assert.equal(playingState.rival.alive, true, `${label}: AI rival is not alive`);
    assert.notEqual(playingState.aiRival.action, "observe", `${label}: AI rival never became active`);
    const rivalSpeed = Math.hypot(...Object.values(playingState.rival.velocity || {}).map(Number));
    assert.ok(rivalSpeed > 0.05, `${label}: AI rival did not move`);

    const constructorAttempts = await page.evaluate(() => [...window.__soloQaWebSocketAttempts]);
    assert.deepEqual(constructorAttempts, [], `${label}: WebSocket constructor was used`);
    assert.deepEqual(webSocketEvents, [], `${label}: browser observed WebSocket traffic`);
    assert.deepEqual(postLoadRequests, [], `${label}: gameplay made post-load network requests`);
    assert.deepEqual(consoleErrors, [], `${label}: browser errors were reported`);

    return {
      mode: playingState.mode,
      gameMode: playingState.gameMode,
      aiAction: playingState.aiRival.action,
      rivalSpeed: +rivalSpeed.toFixed(2),
      initialRequests: initialRequests.length,
      postLoadRequests: postLoadRequests.length,
      webSocketEvents: webSocketEvents.length,
    };
  } finally {
    await context.close();
  }
}

let browser;
let serverProcess;
let serverLog = "";
const result = { ok: false };

try {
  const port = await findOpenPort();
  const origin = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ["server.js"], {
    cwd: projectRoot,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [serverProcess.stdout, serverProcess.stderr]) {
    stream.on("data", (chunk) => {
      serverLog = `${serverLog}${chunk}`.slice(-4_000);
    });
  }
  await waitForServer(origin, serverProcess);

  browser = await chromium.launch({
    headless: true,
    args: ["--use-gl=angle", "--use-angle=swiftshader"],
  });
  result.http = await runTarget(browser, { label: "HTTP", url: origin, httpOrigin: origin });
  result.file = await runTarget(browser, { label: "file://", url: indexUrl });
  result.ok = true;
  console.log(JSON.stringify(result));
} catch (error) {
  result.error = error instanceof Error ? error.message : String(error);
  if (serverLog.trim()) result.server = serverLog.trim();
  console.error(JSON.stringify(result));
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await stopServer(serverProcess);
}
