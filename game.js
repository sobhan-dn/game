import * as THREE from "./node_modules/three/build/three.module.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("start");
const p1El = document.getElementById("p1");
const p2El = document.getElementById("p2");
const s1El = document.getElementById("s1");
const s2El = document.getElementById("s2");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x06101a, 0.012);
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 500);
const root = new THREE.Group();
scene.add(root);
scene.add(new THREE.HemisphereLight(0xb8edff, 0x06101a, 1.35));
const sun = new THREE.DirectionalLight(0xffefd2, 1.6); sun.position.set(24, 34, 18); scene.add(sun);
const fill = new THREE.PointLight(0x44dcff, 60, 180, 2); fill.position.set(-16, 20, -24); scene.add(fill);

const clock = new THREE.Clock();
const loader = new THREE.TextureLoader();
const input = { f:false,b:false,l:false,r:false,jump:false,fire:false };
const net = { ws:null, role:"p1", connected:false, peer:false, last:0 };
const state = { started:false, ended:false, msg:"برای شروع کلیک کنید" };
const scores = { p1:0, p2:0 };
const cameraState = { forward:new THREE.Vector3(1,0,0) };
const platforms = [], enemies = [], bullets = [], effects = [];
const keys = { KeyW:"f",ArrowUp:"f",KeyS:"b",ArrowDown:"b",KeyA:"l",ArrowLeft:"l",KeyD:"r",ArrowRight:"r" };
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audio = { ctx:null, music:null, sfx:null, next:0, step:0 };

const players = {
  p1: makeActor("p1", "بازیکن ۱", 0x65f7df, 0x5ef5ff),
  p2: makeActor("p2", "بازیکن ۲", 0xffbd57, 0xff8a25)
};
const texKinds = ["ice","lava","emerald","amber"];
const textures = texKinds.map(k => fallbackTexture(k));
for (const [i, name] of ["sphere-ice","sphere-lava","sphere-emerald","sphere-amber"].entries()) {
  loader.load(`./assets/textures/${name}.png`, t => { textures[i].image = t.image; textures[i].needsUpdate = true; }, undefined, () => {});
}
makeSky(); resetGame(false); connect(); animate();

function makeActor(id,label,color,bulletColor){
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, emissive:color, emissiveIntensity:.25, metalness:.45, roughness:.25 });
  const dark = new THREE.MeshStandardMaterial({ color:id==="p1"?0x153043:0x4a2307, metalness:.6, roughness:.22 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(.5,1.05,5,12), mat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.34,18,18), mat); head.position.y = .78;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(.2,16,16), new THREE.MeshBasicMaterial({ color:bulletColor })); visor.position.set(0,.78,.3);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(.16,.18,.9), dark); gun.position.set(.52,.06,.24);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.58,.045,12,36), new THREE.MeshBasicMaterial({ color:bulletColor, transparent:true, opacity:.72 })); halo.rotation.x = Math.PI/2;
  g.add(body,head,visor,gun,halo); root.add(g);
  return { id,label,color,bulletColor,mesh:g,pos:new THREE.Vector3(),vel:new THREE.Vector3(),up:new THREE.Vector3(0,1,0),forward:new THREE.Vector3(id==="p1"?1:-1,0,0),health:100,alive:true,grounded:true,platform:null,cool:0,target:null };
}

function makeSky(){
  const sky = new THREE.Mesh(new THREE.SphereGeometry(190,64,32), new THREE.MeshBasicMaterial({ map:skyTexture(), color:0x9bdfff, side:THREE.BackSide, fog:false }));
  scene.add(sky);
  const geo = new THREE.BufferGeometry(), pts = new Float32Array(2400*3);
  for(let i=0;i<2400;i++){ const r=110+Math.random()*150,a=Math.random()*Math.PI*2,z=Math.random()*2-1,h=Math.sqrt(1-z*z); pts[i*3]=Math.cos(a)*h*r; pts[i*3+1]=z*r; pts[i*3+2]=Math.sin(a)*h*r; }
  geo.setAttribute("position", new THREE.BufferAttribute(pts,3)); scene.add(new THREE.Points(geo,new THREE.PointsMaterial({color:0xffffff,size:.7})));
}

function resetGame(sendRestart){
  for(const o of [...platforms,...enemies,...bullets,...effects]) root.remove(o.mesh||o.group);
  platforms.length = enemies.length = bullets.length = effects.length = 0;
  scores.p1 = scores.p2 = 0; state.started = false; state.ended = false; state.msg = "برای شروع کلیک کنید"; overlay.classList.add("show");
  [[8.2,[0,6,0],[0,1.4,0],0x3edbff],[6.1,[16,13,-9],[2.3,1.8,2.2],0xff4b21],[5.4,[-15,11,12],[2.2,1.4,2.5],0x35e879],[6.6,[28,19,10],[1.7,2.1,2.1],0xffbd57],[5.2,[8,25,24],[2.4,1.4,2.8],0x6ff7dd],[7.3,[-18,23,28],[2.7,2.1,2.3],0xff8a25],[8.4,[34,31,28],[2.2,2.4,2],0x31d67c]].forEach((d,i)=>platforms.push(makePlatform(d,i)));
  place(players.p1, platforms[0], new THREE.Vector3(0,1,0)); place(players.p2, platforms[0], new THREE.Vector3(.45,.88,.12).normalize());
  if(players[net.role]) cameraState.forward.copy(players[net.role].forward);
  [[1,.2,1],[2,-.2,2.4],[3,.1,4],[4,-.3,1.5],[5,.2,4.8],[6,-.1,2.8]].forEach(s=>makeEnemy(...s));
  updateUi(); if(sendRestart) send({type:"restart"});
}
function makePlatform([radius,base,amp,glow],i){
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color:0xffffff, map:textures[i%4], roughness:.42, metalness:.32, emissive:glow, emissiveIntensity:.16 });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(radius,42,42),mat));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(radius*1.22,radius*.08,12,72),new THREE.MeshBasicMaterial({color:glow,transparent:true,opacity:.48}));
  ring.rotation.set(Math.random()*Math.PI,Math.random()*Math.PI,0); group.add(ring); root.add(group);
  return { group, mesh:group, radius, base:new THREE.Vector3(...base), amp:new THREE.Vector3(...amp), center:new THREE.Vector3(...base), prev:new THREE.Vector3(...base), delta:new THREE.Vector3(), phase:Math.random()*6, speed:.34+i*.04, ring, mat };
}
function makeEnemy(pi,lat,lon){
  const mesh = new THREE.Group(), red = new THREE.MeshStandardMaterial({color:0xff2525,emissive:0x5a0505,emissiveIntensity:.55});
  mesh.add(new THREE.Mesh(new THREE.CapsuleGeometry(.48,1,4,10),red));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(.22,16,16),new THREE.MeshBasicMaterial({color:0xffeeee})); eye.position.set(0,.62,.34); mesh.add(eye); root.add(mesh);
  enemies.push({mesh,platform:platforms[pi],lat,lon,health:60,cool:.8+Math.random(),pos:new THREE.Vector3(),dead:false});
}
function place(p,platform,up){ p.platform=platform; p.up.copy(up); p.pos.copy(platform.center).addScaledVector(up, platform.radius+.9); p.vel.set(0,0,0); p.health=100; p.alive=true; p.grounded=true; sync(p); }
function start(){ ensureAudio(); if(state.ended) resetGame(true); state.started=true; state.msg="رقابت شروع شد"; overlay.classList.remove("show"); playSweep(440,720,.14,.07,"triangle"); updateUi(); }
function animate(){ requestAnimationFrame(animate); const dt=Math.min(clock.getDelta(),.033); update(dt); renderer.render(scene,camera); }
function update(dt){
  const t=clock.elapsedTime;
  for(const p of platforms){ p.prev.copy(p.center); p.center.set(p.base.x+Math.sin(t*p.speed+p.phase)*p.amp.x,p.base.y+Math.cos(t*p.speed*1.5+p.phase)*p.amp.y,p.base.z+Math.sin(t*p.speed*.8+p.phase)*p.amp.z); p.delta.subVectors(p.center,p.prev); p.group.position.copy(p.center); p.group.rotation.y+=dt*.28; p.ring.rotation.x+=dt*.35; p.mat.emissiveIntensity=.14+Math.sin(t*2+p.phase)*.05; }
  if(state.started&&!state.ended){ updateLocal(local(),dt); updateRemote(remote(),dt); updateEnemies(dt); updateBullets(dt); sendState(); }
  updateEffects(dt); updateMusic(); updateCamera(dt); updateUi();
}
function updateLocal(p,dt){
  if(!p||!p.alive)return; p.cool=Math.max(0,p.cool-dt); if(p.grounded&&p.platform)p.pos.add(p.platform.delta);
  const plat=nearest(p.pos), up=p.pos.clone().sub(plat.center).normalize(); p.up.lerp(up,1-Math.exp(-12*dt)).normalize();
  const f=cameraState.forward.clone().projectOnPlane(p.up); if(f.lengthSq()<.001)f.copy(p.forward).projectOnPlane(p.up); f.normalize();
  const r=new THREE.Vector3().crossVectors(f,p.up).normalize(), m=new THREE.Vector3();
  if(input.f)m.add(f); if(input.b)m.sub(f); if(input.r)m.add(r); if(input.l)m.sub(r); if(m.lengthSq()>.01)m.normalize();
  const ns=p.vel.dot(p.up), tan=p.vel.clone().sub(p.up.clone().multiplyScalar(ns)); tan.addScaledVector(m,(p.grounded?78:30)*dt); if(tan.length()>26)tan.setLength(26); if(p.grounded)tan.multiplyScalar(Math.exp(-2.25*dt));
  p.vel.copy(tan).addScaledVector(p.up,ns); if(input.jump&&p.grounded){ p.vel.addScaledVector(p.up,18); p.vel.addScaledVector(m.lengthSq()?m:f,11); p.grounded=false; playSweep(240,520,.16,.055,"triangle"); }
  input.jump=false; p.vel.addScaledVector(p.up,-31*dt); p.pos.addScaledVector(p.vel,dt); land(p); if(input.fire&&p.cool<=0)fire(p); p.forward.lerp(f,1-Math.exp(-16*dt)).normalize(); sync(p);
}
function land(p){ p.grounded=false; for(const plat of platforms){ const off=p.pos.clone().sub(plat.center), d=off.length(), n=off.multiplyScalar(1/Math.max(d,.001)), surf=plat.radius+.9; if(d<surf){p.pos.copy(plat.center).addScaledVector(n,surf); const inward=p.vel.dot(n); if(inward<0)p.vel.addScaledVector(n,-inward);} if(Math.abs(d-surf)<.45&&p.vel.dot(n)<8){p.grounded=true;p.platform=plat;p.up.copy(n);} } }
function updateRemote(p,dt){ if(!p||!p.target)return; p.pos.lerp(p.target.pos,1-Math.exp(-16*dt)); p.up.lerp(p.target.up,1-Math.exp(-12*dt)).normalize(); p.forward.lerp(p.target.forward,1-Math.exp(-12*dt)).normalize(); p.health=p.target.health; p.alive=p.target.alive; sync(p); }
function updateEnemies(dt){ for(let i=0;i<enemies.length;i++){ const e=enemies[i]; if(e.dead)continue; e.lon+=dt*.52; e.cool-=dt; const n=spherical(e.lat+Math.sin(clock.elapsedTime+i)*.16,e.lon); e.pos.copy(e.platform.center).addScaledVector(n,e.platform.radius+.95); e.mesh.position.copy(e.pos); e.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),n); const p=local(); if(p&&p.alive&&e.cool<=0&&e.pos.distanceTo(p.pos)<58){shoot(e.pos.clone().addScaledVector(n,.7),p.pos.clone().sub(e.pos).normalize(),34,"enemy",0xff3030);e.cool=1.2+Math.random()*.7;} } }
function updateBullets(dt){ for(let i=bullets.length-1;i>=0;i--){ const b=bullets[i]; b.life-=dt; b.pos.addScaledVector(b.vel,dt); b.mesh.position.copy(b.pos); if(b.life<=0||platforms.some(p=>b.pos.distanceTo(p.center)<p.radius+.16)){removeBullet(i);continue;} if(b.owner==="enemy"){ const p=local(); if(p&&p.alive&&b.pos.distanceTo(p.pos)<1.15){p.health=Math.max(0,p.health-15);playSweep(150,70,.18,.06,"sawtooth");send({type:"damage",target:p.id,health:p.health});removeBullet(i);} continue; } for(let ei=0;ei<enemies.length;ei++){ const e=enemies[ei]; if(!e.dead&&b.pos.distanceTo(e.pos)<1.25){ e.health-=34; if(e.health<=0){e.dead=true;root.remove(e.mesh);scores[b.owner]++;playSweep(520,160,.26,.07,"square");send({type:"enemy-down",index:ei,scorer:b.owner});} removeBullet(i); break; } } } }
function fire(p){ const dir=camera.getWorldDirection(new THREE.Vector3()).normalize(), aim=cameraState.forward.clone().projectOnPlane(p.up).normalize(), muzzle=p.pos.clone().addScaledVector(p.up,.72).addScaledVector(aim,1); shoot(muzzle,dir,72,p.id,p.bulletColor); p.cool=.15; playSweep(p.id==="p2"?380:460,170,.08,.045,"square"); send({type:"shot",origin:pack(muzzle),direction:pack(dir),color:p.bulletColor}); }
function shoot(origin,dir,speed,owner,color){ const mesh=new THREE.Mesh(new THREE.SphereGeometry(owner==="enemy"?.18:.25,14,14),new THREE.MeshBasicMaterial({color})); mesh.position.copy(origin); root.add(mesh); bullets.push({mesh,pos:origin.clone(),vel:dir.clone().multiplyScalar(speed),owner,color,life:2.6}); }
function updateCamera(dt){ const p=local()||players.p1, up=p.up.clone().normalize(), f=cameraState.forward.clone().projectOnPlane(up); if(f.lengthSq()<.001)f.copy(p.forward).projectOnPlane(up); f.normalize(); cameraState.forward.copy(f); const target=p.pos.clone().addScaledVector(up,2.3).addScaledVector(f,1.5), desired=target.clone().addScaledVector(f,-13).addScaledVector(up,4); camera.position.lerp(desired,1-Math.exp(-8*dt)); camera.up.copy(up); camera.lookAt(target); }
function sync(p){ const up=p.up.clone().normalize(), f=p.forward.clone().projectOnPlane(up).normalize(), right=new THREE.Vector3().crossVectors(up,f).normalize(), mat=new THREE.Matrix4().makeBasis(right,up,f); p.mesh.position.copy(p.pos); p.mesh.quaternion.setFromRotationMatrix(mat); p.mesh.visible=p.alive; }
function connect(){ const ws=new WebSocket(`${location.protocol==="https:"?"wss":"ws"}://${location.host}`); net.ws=ws; ws.onopen=()=>{net.connected=true;state.msg="به سرور آنلاین وصل شدی";updateUi();}; ws.onclose=()=>{net.connected=false;net.peer=false;setTimeout(connect,1800);}; ws.onmessage=e=>{let m;try{m=JSON.parse(e.data)}catch{return} onMsg(m);}; }
function onMsg(m){ if(m.type==="welcome"){net.role=m.role==="p2"||m.role==="spectator"?m.role:"p1"; if(players[net.role])cameraState.forward.copy(players[net.role].forward); updatePresence(m.players||[]);} else if(m.type==="presence")updatePresence(m.players||[]); else if(m.type==="state"&&m.from!==net.role){const p=players[m.from]; if(p)p.target={pos:unpack(m.state.pos),up:unpack(m.state.up).normalize(),forward:unpack(m.state.forward).normalize(),health:m.state.health,alive:m.state.alive}; if(m.state.scores)Object.assign(scores,m.state.scores);} else if(m.type==="shot"&&m.from!==net.role)shoot(unpack(m.origin),unpack(m.direction).normalize(),72,m.from,m.color||0xffffff); else if(m.type==="damage"&&m.target!==net.role){const p=players[m.target]; if(p){p.health=m.health;p.alive=m.health>0;}} else if(m.type==="enemy-down"){const e=enemies[m.index]; if(e&&!e.dead){e.dead=true;root.remove(e.mesh);scores[m.scorer]++;}} else if(m.type==="restart")resetGame(false); }
function sendState(){ if(!net.connected||net.ws.readyState!==WebSocket.OPEN||net.role==="spectator")return; if(clock.elapsedTime-net.last<1/15)return; const p=local(); net.last=clock.elapsedTime; send({type:"state",state:{pos:pack(p.pos),up:pack(p.up),forward:pack(p.forward),health:p.health,alive:p.alive,scores}}); }
function send(o){ if(net.ws?.readyState===WebSocket.OPEN)net.ws.send(JSON.stringify(o)); }
function updatePresence(list){ net.peer=list.some(x=>x.role!==net.role&&(x.role==="p1"||x.role==="p2")); }
function updateUi(){ p1El.textContent=Math.ceil(players.p1.health); p2El.textContent=Math.ceil(players.p2.health); s1El.textContent=`${scores.p1} امتیاز`; s2El.textContent=`${scores.p2} امتیاز`; const role=net.role==="spectator"?"تماشاگر":net.role==="p2"?"بازیکن ۲":"بازیکن ۱"; statusEl.textContent=`${state.msg} | ${role} | ${net.peer?"رقیب وصل است":"منتظر رقیب"}`; }
function local(){ return net.role==="spectator"?null:players[net.role]||players.p1; } function remote(){ return net.role==="p2"?players.p1:players.p2; } function nearest(pos){ return platforms.reduce((a,p)=>pos.distanceTo(p.center)-p.radius<pos.distanceTo(a.center)-a.radius?p:a); } function spherical(lat,lon){return new THREE.Vector3(Math.cos(lat)*Math.cos(lon),Math.sin(lat),Math.cos(lat)*Math.sin(lon)).normalize();} function pack(v){return{x:+v.x.toFixed(3),y:+v.y.toFixed(3),z:+v.z.toFixed(3)}} function unpack(v){return new THREE.Vector3(Number(v?.x||0),Number(v?.y||0),Number(v?.z||0));} function removeBullet(i){root.remove(bullets[i].mesh);bullets.splice(i,1);} function updateEffects(){}
function ensureAudio(){ if(!AudioCtx||audio.ctx)return; const ctx=new AudioCtx(), master=ctx.createGain(), music=ctx.createGain(), sfx=ctx.createGain(); master.gain.value=.68; music.gain.value=.15; sfx.gain.value=.36; music.connect(master); sfx.connect(master); master.connect(ctx.destination); audio.ctx=ctx; audio.music=music; audio.sfx=sfx; audio.next=ctx.currentTime+.08; }
function updateMusic(){ if(!audio.ctx||!state.started||state.ended)return; if(audio.ctx.state==="suspended")audio.ctx.resume(); const horizon=audio.ctx.currentTime+.7, roots=[45,41,43,38], lead=[12,15,19,15,10,15,17,22]; while(audio.next<horizon){ const root=roots[Math.floor(audio.step/8)%roots.length], pulse=audio.step%8; if(pulse%2===0)tone(root-12,audio.next,.28,.045,"triangle",audio.music); if(pulse===0||pulse===4)for(const o of [0,3,7])tone(root+o,audio.next,.65,.02,"triangle",audio.music); tone(root+lead[pulse],audio.next+.04,.16,.018,pulse%3?"triangle":"sawtooth",audio.music); audio.next+=.42; audio.step++; } }
function playSweep(a,b,d,v,type){ if(!audio.ctx)return; const now=audio.ctx.currentTime, osc=audio.ctx.createOscillator(), gain=audio.ctx.createGain(); osc.type=type; osc.frequency.setValueAtTime(a,now); osc.frequency.exponentialRampToValueAtTime(Math.max(b,30),now+d); gain.gain.setValueAtTime(.0001,now); gain.gain.exponentialRampToValueAtTime(v,now+.01); gain.gain.exponentialRampToValueAtTime(.0001,now+d); osc.connect(gain); gain.connect(audio.sfx); osc.start(now); osc.stop(now+d+.03); }
function tone(midi,time,d,v,type,dest){ const osc=audio.ctx.createOscillator(), gain=audio.ctx.createGain(); osc.type=type; osc.frequency.value=440*Math.pow(2,(midi-69)/12); gain.gain.setValueAtTime(.0001,time); gain.gain.exponentialRampToValueAtTime(v,time+.02); gain.gain.exponentialRampToValueAtTime(.0001,time+d); osc.connect(gain); gain.connect(dest); osc.start(time); osc.stop(time+d+.04); }
function fallbackTexture(kind){ const c=document.createElement("canvas"),ctx=c.getContext("2d"); c.width=c.height=512; const pal={ice:["#35d9ff","#0d6f90","#bdf8ff"],lava:["#19171d","#ff3d12","#ffbc4f"],emerald:["#0f5e49","#31d67c","#073525"],amber:["#8a5518","#ffbe4a","#4a2a08"]}[kind]; ctx.fillStyle=pal[0];ctx.fillRect(0,0,512,512); for(let i=0;i<50;i++){ctx.strokeStyle=pal[2];ctx.globalAlpha=.4+Math.random()*.5;ctx.beginPath();ctx.moveTo(Math.random()*512,Math.random()*512);ctx.lineTo(Math.random()*512,Math.random()*512);ctx.lineTo(Math.random()*512,Math.random()*512);ctx.stroke();} const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping; t.repeat.set(1.8,1.8); return t; }
function skyTexture(){ const c=document.createElement("canvas"),ctx=c.getContext("2d"); c.width=1024;c.height=512; const g=ctx.createLinearGradient(0,0,1024,512); g.addColorStop(0,"#071027");g.addColorStop(.5,"#04172f");g.addColorStop(1,"#1b102c");ctx.fillStyle=g;ctx.fillRect(0,0,1024,512); for(let i=0;i<850;i++){ctx.fillStyle=`rgba(230,248,255,${.35+Math.random()*.65})`;ctx.fillRect(Math.random()*1024,Math.random()*512,1.3,1.3);} const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; return t; }
addEventListener("keydown",e=>{ if(keys[e.code])input[keys[e.code]]=true; if(e.code==="Space"){input.jump=true;e.preventDefault();} }); addEventListener("keyup",e=>{ if(keys[e.code])input[keys[e.code]]=false; }); canvas.addEventListener("mousedown",e=>{ if(e.button!==0)return; if(!state.started||state.ended){start();return;} input.fire=true; }); addEventListener("mouseup",()=>input.fire=false); addEventListener("mousemove",e=>{const p=local(); if(p&&state.started)cameraState.forward.applyAxisAngle(p.up,-e.movementX*.0026);}); startBtn.addEventListener("click",start); addEventListener("resize",()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
window.render_game_to_text=()=>JSON.stringify({mode:state.started?"playing":"menu",role:net.role,message:state.msg,player:local()?{x:+local().pos.x.toFixed(2),y:+local().pos.y.toFixed(2),z:+local().pos.z.toFixed(2),health:Math.ceil(local().health)}:null});
