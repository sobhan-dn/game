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
    const body = await readFile(filePath);
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath)] || "application/octet-stream",
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

function getOpenClients() {
  return [...clients.values()].filter((client) => client.socket.readyState === 1);
}

function nextRole() {
  const activeRoles = new Set(getOpenClients().map((client) => client.role));
  if (!activeRoles.has("p1")) {
    return "p1";
  }
  if (!activeRoles.has("p2")) {
    return "p2";
  }
  return "spectator";
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
    players: getOpenClients().map((client) => ({
      id: client.id,
      role: client.role,
    })),
  };
}

wss.on("connection", (socket) => {
  const id = randomUUID();
  const client = {
    id,
    role: nextRole(),
    socket,
  };
  clients.set(id, client);

  socket.send(JSON.stringify({
    type: "welcome",
    id,
    role: client.role,
    players: presencePayload().players,
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
      "player-state",
      "shot",
      "player-damage",
      "enemy-down",
      "restart",
    ]);

    if (!allowedTypes.has(message.type)) {
      return;
    }

    broadcast({
      ...message,
      from: client.role,
      at: Date.now(),
    }, socket);
  });

  socket.on("close", () => {
    clients.delete(id);
    broadcast(presencePayload());
  });
});
