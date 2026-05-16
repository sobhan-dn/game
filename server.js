import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const MIME = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"text/javascript; charset=utf-8", ".json":"application/json; charset=utf-8", ".png":"image/png", ".jpg":"image/jpeg" };

const server = http.createServer(async (req, res) => {
  const raw = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  const filePath = path.normalize(path.join(__dirname, decodeURIComponent(raw)));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { "content-type": MIME[path.extname(filePath)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.listen(PORT, () => console.log(`Void Spheres Duel running on ${PORT}`));

const wss = new WebSocketServer({ server });
const clients = new Map();
const openClients = () => [...clients.values()].filter(c => c.socket.readyState === 1);
const nextRole = () => {
  const roles = new Set(openClients().map(c => c.role));
  if (!roles.has("p1")) return "p1";
  if (!roles.has("p2")) return "p2";
  return "spectator";
};
const broadcast = (payload, except = null) => {
  const data = JSON.stringify(payload);
  for (const { socket } of clients.values()) if (socket !== except && socket.readyState === 1) socket.send(data);
};
const presence = () => ({ type: "presence", players: openClients().map(c => ({ id: c.id, role: c.role })) });

wss.on("connection", socket => {
  const client = { id: randomUUID(), role: nextRole(), socket };
  clients.set(client.id, client);
  socket.send(JSON.stringify({ type: "welcome", id: client.id, role: client.role, players: presence().players }));
  broadcast(presence());
  socket.on("message", raw => {
    let msg;
    try { msg = JSON.parse(String(raw)); } catch { return; }
    if (!msg || typeof msg.type !== "string") return;
    if (!["state", "shot", "damage", "enemy-down", "restart"].includes(msg.type)) return;
    broadcast({ ...msg, from: client.role, at: Date.now() }, socket);
  });
  socket.on("close", () => { clients.delete(client.id); broadcast(presence()); });
});
