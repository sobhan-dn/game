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
  const safePath = decodeURIComponent(raw);
  const filePath = path.normalize(path.join(__dirname, safePath));
  if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end("Forbidden"); return; }
  try {
    let body = await readFile(filePath);
    let contentType = MIME[path.extname(filePath)] || "application/octet-stream";
    if (safePath === "/game.js") {
      body = patchGameScript(body.toString("utf8"));
      contentType = MIME[".js"];
    }
    res.writeHead(200, { "content-type": contentType, "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

function patchGameScript(source) {
  return source
    .replace(
      "health:100,alive:true,grounded:true,platform:null,cool:0,target:null};",
      "health:100,alive:true,grounded:true,platform:null,cool:0,jumpGrace:0,target:null};"
    )
    .replace(
      "p.health=100;p.alive=true;p.grounded=true;sync(p);",
      "p.health=100;p.alive=true;p.grounded=true;p.jumpGrace=0;sync(p);"
    )
    .replace(
      "p.vel.addScaledVector(p.up,18);p.vel.addScaledVector(m.lengthSq()?m:f,11);p.grounded=false;sweep(240,520,.16,.055,\"triangle\");",
      "p.vel.addScaledVector(p.up,25);p.vel.addScaledVector(m.lengthSq()?m:f,19);p.grounded=false;p.jumpGrace=.42;sweep(240,520,.16,.055,\"triangle\");"
    )
    .replace(
      "const gap=p.pos.distanceTo(plat.center)-(plat.radius+.9), pull=(p.grounded?42:118)+(p.grounded?0:THREE.MathUtils.clamp(1-gap/38,.18,1)*82); p.vel.addScaledVector(gup,-pull*dt);",
      "p.jumpGrace=Math.max(0,(p.jumpGrace||0)-dt); const launch=p.jumpGrace>0,gap=p.pos.distanceTo(plat.center)-(plat.radius+.9), pull=(p.grounded?42:(launch?48:122))+(p.grounded?0:(launch?THREE.MathUtils.clamp(1-gap/16,0,.35)*22:THREE.MathUtils.clamp(1-gap/42,.2,1)*94)); p.vel.addScaledVector(gup,-pull*dt);"
    )
    .replace(
      "if(Math.abs(d-surf)<1.65&&p.vel.dot(n)<22){p.pos.copy(plat.center).addScaledVector(n,surf);const ns=p.vel.dot(n);if(ns<0)p.vel.addScaledVector(n,-ns);p.grounded=true;p.platform=plat;p.up.copy(n);}",
      "if(Math.abs(d-surf)<2.05&&p.vel.dot(n)<25){p.pos.copy(plat.center).addScaledVector(n,surf);const ns=p.vel.dot(n);if(ns<0)p.vel.addScaledVector(n,-ns);p.grounded=true;p.jumpGrace=0;p.platform=plat;p.up.copy(n);}"
    );
}

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
