import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const TEAM = {
  blue: { base: { x: -15, z: 13 } },
  red: { base: { x: 15, z: -13 } },
};

const MAZE = [
  "#################",
  "#B....#.........#",
  "#.###.#.#####.#.#",
  "#...#...#...#.#.#",
  "###.#####.#.#.#.#",
  "#...#.....#...#.#",
  "#.#.#.#######.#.#",
  "#.#...#.....#...#",
  "#.#####.###.###.#",
  "#.....#...#.....#",
  "#.###.###.#####.#",
  "#...#.....#...#.#",
  "###.#####.#.#.#.#",
  "#.........#....R#",
  "#################",
];

const cellSize = 2.15;
const offsetX = -((MAZE[0].length - 1) * cellSize) / 2;
const offsetZ = -((MAZE.length - 1) * cellSize) / 2;
const openCells = [];
for (let r = 0; r < MAZE.length; r++) {
  for (let c = 0; c < MAZE[r].length; c++) {
    if (MAZE[r][c] !== "#") openCells.push({ x: offsetX + c * cellSize, z: offsetZ + r * cellSize });
  }
}

const game = {
  scores: { blue: 0, red: 0 },
  helicopters: {},
  soldiers: [],
  bullets: [],
  shields: [],
  nextId: 1,
  elapsed: 0,
};

const clients = new Map();

const server = http.createServer(async (req, res) => {
  const safePath = req.url === "/" ? "/index.html" : decodeURIComponent(req.url.split("?")[0]);
  const filePath = path.normalize(path.join(__dirname, safePath));
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const id = `p${game.nextId++}`;
  clients.set(ws, { id, team: null, lastPong: Date.now() });
  ws.send(JSON.stringify({ type: "notice", text: "به سرور وصل شدی. یک تیم انتخاب کن." }));

  ws.on("message", (raw) => {
    let packet;
    try {
      packet = JSON.parse(raw);
    } catch {
      return;
    }
    const client = clients.get(ws);
    if (!client) return;
    if (packet.type === "pong") {
      client.lastPong = Date.now();
      return;
    }
    if (packet.type === "join" && TEAM[packet.team]) {
      client.team = packet.team;
      game.helicopters[packet.team] = {
        id: packet.team,
        team: packet.team,
        x: TEAM[packet.team].base.x,
        z: TEAM[packet.team].base.z,
        yaw: packet.team === "blue" ? Math.PI * 0.75 : -Math.PI * 0.25,
      };
      ensureSoldiers(packet.team);
      broadcast({ type: "notice", text: `بازیکن تیم ${packet.team === "blue" ? "آبی" : "قرمز"} وارد شد.` });
    }
    if (packet.type === "input" && client.team && game.helicopters[client.team]) {
      game.helicopters[client.team].x = clamp(packet.x, -18.4, 18.4);
      game.helicopters[client.team].z = clamp(packet.z, -16.2, 16.2);
      game.helicopters[client.team].yaw = Number(packet.yaw) || 0;
    }
    if (packet.type === "fire" && client.team) {
      game.bullets.push({
        id: `b${game.nextId++}`,
        team: client.team,
        x: Number(packet.x) || 0,
        z: Number(packet.z) || 0,
        dx: Number(packet.dx) || 0,
        dz: Number(packet.dz) || 1,
        ttl: 1.45,
      });
    }
    if (packet.type === "shield" && client.team) {
      game.shields.push({
        id: `s${game.nextId++}`,
        team: client.team,
        x: clamp(Number(packet.x) || 0, -18, 18),
        z: clamp(Number(packet.z) || 0, -16, 16),
        ttl: 1.75,
      });
    }
  });

  ws.on("close", () => clients.delete(ws));
});

setInterval(() => {
  step(1 / 20);
  broadcast(serializeState());
}, 1000 / 20);

setInterval(() => {
  const now = Date.now();
  for (const ws of wss.clients) {
    const client = clients.get(ws);
    if (!client) continue;
    if (now - client.lastPong > 15000) {
      ws.terminate();
      clients.delete(ws);
      continue;
    }
    if (ws.readyState === 1) ws.send(JSON.stringify({ type: "ping", t: now }));
  }
}, 5000);

server.listen(PORT, () => {
  console.log(`Maze Heli Command server running at http://localhost:${PORT}`);
});

function step(dt) {
  game.elapsed += dt;
  ensureHelicopters(dt);
  ensureSoldiers("blue");
  ensureSoldiers("red");
  updateSoldiers(dt);
  updateBullets(dt);
  updateShields(dt);
}

function ensureHelicopters(dt) {
  for (const team of Object.keys(TEAM)) {
    if (!game.helicopters[team]) {
      game.helicopters[team] = {
        id: team,
        team,
        x: TEAM[team].base.x,
        z: TEAM[team].base.z,
        yaw: team === "blue" ? Math.PI * 0.75 : -Math.PI * 0.25,
      };
    }
  }

  const controlled = new Set([...clients.values()].map((client) => client.team).filter(Boolean));
  for (const team of Object.keys(TEAM)) {
    if (controlled.has(team)) continue;
    const heli = game.helicopters[team];
    const center = TEAM[team].base;
    const phase = game.elapsed * 0.55 + (team === "blue" ? 0 : Math.PI);
    const nextX = center.x * 0.45 + Math.sin(phase) * 5.8;
    const nextZ = center.z * 0.45 + Math.cos(phase * 0.8) * 5.2;
    heli.yaw = Math.atan2(nextX - heli.x, nextZ - heli.z);
    heli.x += (nextX - heli.x) * Math.min(1, dt * 1.8);
    heli.z += (nextZ - heli.z) * Math.min(1, dt * 1.8);
  }
}

function ensureSoldiers(team) {
  const count = game.soldiers.filter((soldier) => soldier.team === team).length;
  for (let i = count; i < 7; i++) {
    const base = TEAM[team].base;
    game.soldiers.push({
      id: `u${game.nextId++}`,
      team,
      x: base.x + (Math.random() - 0.5) * 1.4,
      z: base.z + (Math.random() - 0.5) * 1.4,
      targetIndex: Math.floor(Math.random() * openCells.length),
      shield: 0,
      hp: 1,
    });
  }
}

function updateSoldiers(dt) {
  for (const soldier of game.soldiers) {
    const enemyBase = TEAM[soldier.team === "blue" ? "red" : "blue"].base;
    const patrol = openCells[soldier.targetIndex] || enemyBase;
    const useBase = Math.hypot(soldier.x - enemyBase.x, soldier.z - enemyBase.z) < 7 || Math.random() < 0.004;
    const target = useBase ? enemyBase : patrol;
    const dx = target.x - soldier.x;
    const dz = target.z - soldier.z;
    const dist = Math.hypot(dx, dz) || 1;
    if (dist < 0.55) {
      if (target === enemyBase) {
        game.scores[soldier.team] += 3;
        soldier.x = TEAM[soldier.team].base.x;
        soldier.z = TEAM[soldier.team].base.z;
      }
      soldier.targetIndex = Math.floor(Math.random() * openCells.length);
    } else {
      const speed = soldier.shield > 0 ? 1.55 : 1.05;
      const nx = soldier.x + (dx / dist) * speed * dt;
      const nz = soldier.z + (dz / dist) * speed * dt;
      if (isOpen(nx, nz)) {
        soldier.x = nx;
        soldier.z = nz;
      } else {
        soldier.targetIndex = Math.floor(Math.random() * openCells.length);
      }
    }
    soldier.shield = Math.max(0, soldier.shield - dt);
  }
}

function updateBullets(dt) {
  for (const bullet of game.bullets) {
    bullet.x += bullet.dx * 18 * dt;
    bullet.z += bullet.dz * 18 * dt;
    bullet.ttl -= dt;
    for (const soldier of game.soldiers) {
      if (soldier.team === bullet.team) continue;
      if (Math.hypot(soldier.x - bullet.x, soldier.z - bullet.z) > 0.58) continue;
      if (soldier.shield <= 0) {
        soldier.hp = 0;
        game.scores[bullet.team] += 1;
      }
      bullet.ttl = 0;
      break;
    }
  }
  game.soldiers = game.soldiers.filter((soldier) => soldier.hp > 0);
  game.bullets = game.bullets.filter((bullet) => bullet.ttl > 0 && isOpen(bullet.x, bullet.z));
}

function updateShields(dt) {
  for (const shield of game.shields) {
    shield.ttl -= dt;
    for (const soldier of game.soldiers) {
      if (soldier.team === shield.team && Math.hypot(soldier.x - shield.x, soldier.z - shield.z) < 1.55) {
        soldier.shield = 3.4;
      }
    }
  }
  game.shields = game.shields.filter((shield) => shield.ttl > 0);
}

function serializeState() {
  return {
    type: "state",
    t: Date.now(),
    scores: game.scores,
    helicopters: Object.fromEntries(
      Object.entries(game.helicopters).map(([team, heli]) => [team, {
        id: heli.id,
        team: heli.team,
        x: round(heli.x),
        z: round(heli.z),
        yaw: round(heli.yaw, 3),
      }]),
    ),
    soldiers: game.soldiers.map((soldier) => ({
      id: soldier.id,
      team: soldier.team,
      x: round(soldier.x),
      z: round(soldier.z),
      shield: round(soldier.shield, 1),
    })),
    bullets: game.bullets.map((bullet) => ({
      id: bullet.id,
      team: bullet.team,
      x: round(bullet.x),
      z: round(bullet.z),
    })),
    shields: game.shields.map((shield) => ({
      id: shield.id,
      team: shield.team,
      x: round(shield.x),
      z: round(shield.z),
      ttl: round(shield.ttl, 1),
    })),
  };
}

function isOpen(x, z) {
  const c = Math.round((x - offsetX) / cellSize);
  const r = Math.round((z - offsetZ) / cellSize);
  return MAZE[r] && MAZE[r][c] && MAZE[r][c] !== "#";
}

function broadcast(packet) {
  const body = JSON.stringify(packet);
  for (const ws of wss.clients) {
    if (ws.readyState === 1) ws.send(body);
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
