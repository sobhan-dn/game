import http from "node:http";
import { randomUUID } from "node:crypto";
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
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const server = http.createServer(async (req, res) => {
  const rawPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const safePath = decodeURIComponent(rawPath);
  const filePath = path.normalize(path.join(__dirname, safePath));

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    let body = await readFile(filePath);
    const contentType = MIME[path.extname(filePath)] || "application/octet-stream";
    res.writeHead(200, {
      "content-type": contentType,
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => {
  console.log(`Void Spheres running at http://localhost:${PORT}`);
});

const wss = new WebSocketServer({ server });
const clients = new Map();
let joinCounter = 0;
const roleSlots = new Map();
const playableRoles = new Set(["p1", "p2"]);

function getOpenClients() {
  return [...clients.values()].filter((client) => client.socket.readyState === 1);
}

function normalizeRoles(notify = false) {
  const openClients = getOpenClients().sort((a, b) => a.joinedAt - b.joinedAt);
  const openPlayerIds = new Set(openClients.map((client) => client.playerId));
  for (const [role, playerId] of roleSlots) {
    if (!openPlayerIds.has(playerId)) {
      roleSlots.delete(role);
    }
  }
  const assignedIdentities = new Set(roleSlots.values());
  const activePlayerIds = new Set();
  openClients.forEach((client) => {
    const previousRole = client.role;
    if (activePlayerIds.has(client.playerId)) {
      client.role = "spectator";
    } else if (assignedIdentities.has(client.playerId)) {
      client.role = roleSlots.get("p1") === client.playerId ? "p1" : roleSlots.get("p2") === client.playerId ? "p2" : "spectator";
      activePlayerIds.add(client.playerId);
    } else {
      assignedIdentities.add(client.playerId);
      activePlayerIds.add(client.playerId);
      if (!roleSlots.has("p1")) {
        roleSlots.set("p1", client.playerId);
        client.role = "p1";
      } else if (!roleSlots.has("p2")) {
        roleSlots.set("p2", client.playerId);
        client.role = "p2";
      } else {
        client.role = "spectator";
      }
    }
    if (notify && previousRole !== client.role && client.socket.readyState === 1) {
      const presence = presencePayload();
      client.socket.send(JSON.stringify({
        type: "welcome",
        id: client.id,
        role: client.role,
        ready: presence.ready,
        players: presence.players,
      }));
    }
  });
  return openClients;
}

function isMatchReady() {
  const p1 = roleSlots.get("p1");
  const p2 = roleSlots.get("p2");
  if (!p1 || !p2 || p1 === p2) return false;
  const openRoleOwners = new Map(
    getOpenClients()
      .filter((client) => playableRoles.has(client.role))
      .map((client) => [client.role, client.playerId])
  );
  return openRoleOwners.get("p1") === p1 && openRoleOwners.get("p2") === p2;
}

function ownsAssignedRole(client) {
  return playableRoles.has(client.role) && roleSlots.get(client.role) === client.playerId;
}

function broadcast(payload, exceptSocket = null) {
  const data = JSON.stringify(payload);
  for (const { socket } of clients.values()) {
    if (socket !== exceptSocket && socket.readyState === 1) {
      socket.send(data);
    }
  }
}

function presencePayload() {
  return {
    type: "presence",
    ready: isMatchReady(),
    players: getOpenClients().map((client) => ({
      id: client.id,
      role: client.role,
    })),
  };
}

wss.on("connection", (socket, request) => {
  const id = randomUUID();
  const playerId = readPlayerId(request);
  const client = {
    id,
    playerId,
    role: "spectator",
    socket,
    joinedAt: ++joinCounter,
  };
  clients.set(id, client);
  normalizeRoles();

  const presence = presencePayload();
  socket.send(JSON.stringify({
    type: "welcome",
    id,
    role: client.role,
    ready: presence.ready,
    players: presence.players,
  }));
  broadcast(presencePayload());

  socket.on("message", (rawMessage) => {
    let message;
    try {
      message = JSON.parse(String(rawMessage));
    } catch {
      return;
    }

    if (!message || typeof message.type !== "string") {
      return;
    }

    const allowedTypes = new Set([
      "state",
      "player-state",
      "shot",
      "damage",
      "player-damage",
      "enemy-down",
      "enemy-spawn",
      "restart",
    ]);

    if (!allowedTypes.has(message.type)) {
      return;
    }

    normalizeRoles();

    if (!ownsAssignedRole(client)) {
      return;
    }

    if (!isMatchReady()) {
      return;
    }

    const { from: _ignoredFrom, at: _ignoredAt, ...safeMessage } = message;
    broadcast({
      ...safeMessage,
      from: client.role,
      at: Date.now(),
    }, socket);
  });

  socket.on("close", () => {
    clients.delete(id);
    normalizeRoles(true);
    broadcast(presencePayload());
  });
});

function readPlayerId(request) {
  try {
    const url = new URL(request.url || "/", `http://${request.headers?.host || "localhost"}`);
    const value = url.searchParams.get("playerId") || "";
    return /^[a-zA-Z0-9._:-]{8,120}$/.test(value) ? value : randomUUID();
  } catch {
    return randomUUID();
  }
}
