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
    let contentType = MIME[path.extname(filePath)] || "application/octet-stream";
    if (safePath === "/game.js") {
      body = patchGameScript(body.toString("utf8"));
      contentType = MIME[".js"];
    }
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

function patchGameScript(source) {
  return source
    .replace(
      /state=\{started:false,ended:false,msg:"[^"]+"\}/,
      'state={started:false,ended:false,msg:"Tap Start",timeLeft:120,nextEnemySpawn:0}'
    )
    .replace(
      /const players=\{p1:actor\("p1","[^"]+",/,
      'const players={p1:actor("p1","Player 1",'
    )
    .replace(
      /p2:actor\("p2","[^"]+",/,
      'p2:actor("p2","Player 2",'
    )
    .replace(
      /state\.msg="[^"]+"; overlay\?\.classList\.remove\("show"\);/,
      'state.msg="Match live"; overlay?.classList.remove("show");'
    )
    .replace(
      /scores\.p2=0;state\.started=false;state\.ended=false;state\.msg="[^"]+";/,
      'scores.p2=0;state.started=false;state.ended=false;state.msg="Tap Start";state.timeLeft=120;state.nextEnemySpawn=0;'
    )
    .replace(
      /ws\.onopen=\(\)=>\{net\.connected=true;state\.msg="[^"]+";updateUi\(\);\};/,
      'ws.onopen=()=>{net.connected=true;state.msg="Online server connected";updateUi();};'
    )
    .replace(
      /function updateUi\(\)\{[\s\S]*?\}\nfunction local/,
      'function updateUi(){if(p1El)p1El.textContent=Math.ceil(players.p1.health);if(p2El)p2El.textContent=Math.ceil(players.p2.health);if(s1El)s1El.textContent=`${scores.p1} points`;if(s2El)s2El.textContent=`${scores.p2} points`;const timerEl=document.getElementById("timer");if(timerEl){const v=Math.max(0,Math.ceil(state.timeLeft||120));timerEl.textContent=`${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}`;}const role=net.role==="spectator"?"Spectator":net.role==="p2"?"Player 2":"Player 1";if(statusEl)statusEl.textContent=`${state.msg} | ${role} | ${net.peer?"Rival online":"Waiting for rival"}`;}\nfunction local'
    )
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
    )
    .replace(
      'state={started:false,ended:false,msg:"\\u0628\\u0631\\u0627\\u06cc \\u0634\\u0631\\u0648\\u0639 \\u06a9\\u0644\\u06cc\\u06a9 \\u06a9\\u0646\\u06cc\\u062f"}',
      'state={started:false,ended:false,msg:"Tap Start",timeLeft:120,nextEnemySpawn:0}'
    )
    .replace(
      'state.msg="\\u0628\\u0631\\u0627\\u06cc \\u0634\\u0631\\u0648\\u0639 \\u06a9\\u0644\\u06cc\\u06a9 \\u06a9\\u0646\\u06cc\\u062f";',
      'state.msg="Tap Start";state.timeLeft=120;state.nextEnemySpawn=0;'
    )
    .replace(
      'state.msg="\\u0631\\u0642\\u0627\\u0628\\u062a \\u0634\\u0631\\u0648\\u0639 \\u0634\\u062f";',
      'state.msg="Match live";'
    )
    .replace(
      'if(state.started&&!state.ended){updateLocal(local(),dt);updateRemote(remote(),dt);updateEnemies(dt);updateBullets(dt);sendState();}',
      'if(state.started&&!state.ended){state.timeLeft=Math.max(0,state.timeLeft-dt);if(state.timeLeft<=0)finish();updateLocal(local(),dt);updateRemote(remote(),dt);updateEnemies(dt);updateEnemySpawns(dt);updateBullets(dt);sendState();}'
    )
    .replace(
      'function updateBullets(dt){',
      'function finish(){state.ended=true;input.fire=false;const w=scores.p1===scores.p2?"Draw":scores.p1>scores.p2?"Player 1 wins":"Player 2 wins";state.msg=`Time is up. ${w}. Final score ${scores.p1}-${scores.p2}`;overlay?.classList.add("show");}\\nfunction updateEnemySpawns(dt){if(net.role!=="p1")return;state.nextEnemySpawn=Math.max(0,(state.nextEnemySpawn||0)-dt);if(enemies.filter(e=>!e.dead).length>=5||state.nextEnemySpawn>0)return;const pi=1+Math.floor(Math.random()*Math.max(1,platforms.length-1)),lat=Math.random()*.8-.4,lon=Math.random()*Math.PI*2;enemy(pi,lat,lon);state.nextEnemySpawn=1.2+Math.random()*1.6;send({type:"enemy-spawn",index:enemies.length-1,platform:pi,lat,lon});}\\nfunction updateBullets(dt){'
    )
    .replace(
      'if(!e.dead&&b.pos.distanceTo(e.pos)<1.25){',
      'if(b.owner===net.role&&!e.dead&&b.pos.distanceTo(e.pos)<1.25){'
    )
    .replace(
      'for(let ei=0;ei<enemies.length;ei++){const e=enemies[ei];if(b.owner===net.role&&!e.dead&&b.pos.distanceTo(e.pos)<1.25){e.health-=34;if(e.health<=0){e.dead=true;root.remove(e.mesh);scores[b.owner]++;sweep(520,160,.26,.07,"square");send({type:"enemy-down",index:ei,scorer:b.owner});}removeBullet(i);break;}}}}',
      'for(let ei=0;ei<enemies.length;ei++){const e=enemies[ei];if(b.owner===net.role&&!e.dead&&b.pos.distanceTo(e.pos)<1.25){e.health-=34;if(e.health<=0){e.dead=true;root.remove(e.mesh);scores[b.owner]++;sweep(520,160,.26,.07,"square");send({type:"enemy-down",index:ei,scorer:b.owner});}removeBullet(i);break;}}const other=players[b.owner==="p1"?"p2":"p1"];if(other&&other.id===net.role&&other.alive&&b.pos.distanceTo(other.pos)<1.1){other.health=Math.max(0,other.health-20);scores[b.owner]++;state.msg=`${b.owner==="p1"?"Player 1":"Player 2"} scored a hit`;send({type:"damage",target:other.id,health:other.health,scores});removeBullet(i);}}}'
    )
    .replace(
      'state.msg="\\u0628\\u0647 \\u0633\\u0631\\u0648\\u0631 \\u0622\\u0646\\u0644\\u0627\\u06cc\\u0646 \\u0648\\u0635\\u0644 \\u0634\\u062f\\u06cc";',
      'state.msg="Online server connected";'
    )
    .replace(
      'if(m.state.scores)Object.assign(scores,m.state.scores);',
      'if(m.state.scores)Object.assign(scores,m.state.scores);if(m.state.timeLeft!==undefined&&m.from==="p1")state.timeLeft=Number(m.state.timeLeft);'
    )
    .replace(
      'if(p){p.health=m.health;p.alive=m.health>0;}}else if(m.type==="enemy-down")',
      'if(p){p.health=m.health;p.alive=m.health>0;}if(m.scores)Object.assign(scores,m.scores);}else if(m.type==="enemy-down")'
    )
    .replace(
      '}else if(m.type==="restart")reset(false);}',
      '}else if(m.type==="enemy-spawn"&&net.role!=="p1"){if(!enemies[m.index])enemy(m.platform,m.lat,m.lon);}else if(m.type==="restart")reset(false);}'
    )
    .replace(
      'alive:p.alive,scores}});',
      'alive:p.alive,scores,timeLeft:state.timeLeft}});'
    )
    .replace(
      'if(s1El)s1El.textContent=`${scores.p1} \\u0627\\u0645\\u062a\\u06cc\\u0627\\u0632`;if(s2El)s2El.textContent=`${scores.p2} \\u0627\\u0645\\u062a\\u06cc\\u0627\\u0632`;',
      'if(s1El)s1El.textContent=`${scores.p1} points`;if(s2El)s2El.textContent=`${scores.p2} points`;const timerEl=document.getElementById("timer");if(timerEl){const v=Math.max(0,Math.ceil(state.timeLeft||120));timerEl.textContent=`${Math.floor(v/60)}:${String(v%60).padStart(2,"0")}`;}'
    )
    .replace(
      'const role=net.role==="spectator"?"\\u062a\\u0645\\u0627\\u0634\\u0627\\u06af\\u0631":net.role==="p2"?"\\u0628\\u0627\\u0632\\u06cc\\u06a9\\u0646 \\u06f2":"\\u0628\\u0627\\u0632\\u06cc\\u06a9\\u0646 \\u06f1";if(statusEl)statusEl.textContent=`${state.msg} | ${role} | ${net.peer?"\\u0631\\u0642\\u06cc\\u0628 \\u0648\\u0635\\u0644 \\u0627\\u0633\\u062a":"\\u0645\\u0646\\u062a\\u0638\\u0631 \\u0631\\u0642\\u06cc\\u0628"}`;',
      'const role=net.role==="spectator"?"Spectator":net.role==="p2"?"Player 2":"Player 1";if(statusEl)statusEl.textContent=`${state.msg} | ${role} | ${net.peer?"Rival online":"Waiting for rival"}`;'
    )
    .replace(
      'window.render_game_to_text=()=>JSON.stringify({mode:state.started?"playing":"menu",role:net.role,message:state.msg,player:local()?{x:+local().pos.x.toFixed(2),y:+local().pos.y.toFixed(2),z:+local().pos.z.toFixed(2),health:Math.ceil(local().health),grounded:local().grounded}:null,bullets:bullets.length});',
      'window.render_game_to_text=()=>JSON.stringify({mode:state.ended?"ended":state.started?"playing":"menu",role:net.role,message:state.msg,timeLeft:+(state.timeLeft||0).toFixed(1),scores,player:local()?{x:+local().pos.x.toFixed(2),y:+local().pos.y.toFixed(2),z:+local().pos.z.toFixed(2),health:Math.ceil(local().health),grounded:local().grounded}:null,enemiesRemaining:enemies.filter(e=>!e.dead).length,bullets:bullets.length});'
    )
    .replace(
      'startBtn?.addEventListener("click",start);',
      'startBtn?.addEventListener("click",start);const tj=document.getElementById("touch-jump"),tf=document.getElementById("touch-fire"),ts=document.getElementById("touch-stick"),kn=document.getElementById("touch-stick-knob");tj?.addEventListener("pointerdown",()=>{input.jump=true;start();});tf?.addEventListener("pointerdown",()=>{input.fire=true;start();});tf?.addEventListener("pointerup",()=>input.fire=false);ts?.addEventListener("pointermove",e=>{const r=ts.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,dx=e.clientX-cx,dy=e.clientY-cy,mx=r.width*.38,len=Math.min(mx,Math.hypot(dx,dy)),a=Math.atan2(dy,dx),nx=Math.cos(a)*len/mx,ny=Math.sin(a)*len/mx;input.f=ny<-.2;input.b=ny>.2;input.l=nx<-.2;input.r=nx>.2;if(kn)kn.style.transform=`translate(calc(-50% + ${nx*mx}px), calc(-50% + ${ny*mx}px))`;});ts?.addEventListener("pointerup",()=>{input.f=input.b=input.l=input.r=false;if(kn)kn.style.transform="translate(-50%, -50%)";});let lookId=null,lx=0;canvas.addEventListener("pointerdown",e=>{if(e.pointerType==="mouse"||e.clientX<innerWidth*.38)return;lookId=e.pointerId;lx=e.clientX;start();});canvas.addEventListener("pointermove",e=>{const p=local();if(e.pointerId!==lookId||!p||!state.started)return;const dx=e.clientX-lx;lx=e.clientX;cam.forward.applyAxisAngle(p.up,-dx*.0052);});canvas.addEventListener("pointerup",e=>{if(e.pointerId===lookId)lookId=null;});'
    );
}

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
