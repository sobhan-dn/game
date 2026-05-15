import * as THREE from "./node_modules/three/build/three.module.js";

const canvas = document.querySelector("#gameCanvas");
const startPanel = document.querySelector("#startPanel");
const teamLabel = document.querySelector("#teamLabel");
const blueScore = document.querySelector("#blueScore");
const redScore = document.querySelector("#redScore");
const serverStatus = document.querySelector("#serverStatus");
const messageLine = document.querySelector("#messageLine");

const TEAM = {
  blue: { name: "آبی", color: 0x46a7ff, dark: 0x17466d, base: new THREE.Vector3(-15, 0, 13) },
  red: { name: "قرمز", color: 0xff5b5b, dark: 0x6b2025, base: new THREE.Vector3(15, 0, -13) },
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

const state = {
  mode: "menu",
  team: null,
  connected: false,
  lastMessage: performance.now(),
  scores: { blue: 0, red: 0 },
  helicopters: {},
  soldiers: [],
  bullets: [],
  shields: [],
  local: {
    x: -14,
    z: 12,
    yaw: 0,
    cooldown: 0,
    shieldCooldown: 0,
  },
};

const input = {
  keys: new Set(),
  touchKeys: new Set(),
  touchFire: false,
  touchShield: false,
  mouse: { x: 0, y: 0, world: new THREE.Vector3(), down: false, right: false },
};

let socket;
let fallbackTimer = 0;
let lastTime = performance.now();
let lastInputSent = 0;
let lastInputPacket = "";

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x101c28);
scene.fog = new THREE.Fog(0x101c28, 28, 62);

const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 200);
const raycaster = new THREE.Raycaster();
const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

const hemi = new THREE.HemisphereLight(0xd8f0ff, 0x1b2730, 1.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(-10, 22, 12);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const root = new THREE.Group();
scene.add(root);

const cellSize = 2.15;
const mazeOffsetX = -((MAZE[0].length - 1) * cellSize) / 2;
const mazeOffsetZ = -((MAZE.length - 1) * cellSize) / 2;
const wallBoxes = [];
const meshes = {
  helicopters: new Map(),
  soldiers: new Map(),
  bullets: new Map(),
  shields: new Map(),
};

buildWorld();
resize();
connect();
requestAnimationFrame(loop);

document.querySelector("#joinBlue").addEventListener("click", () => join("blue"));
document.querySelector("#joinRed").addEventListener("click", () => join("red"));
window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  input.keys.add(event.key.toLowerCase());
  if (event.key === " ") event.preventDefault();
  if (event.key.toLowerCase() === "f") toggleFullscreen();
});
window.addEventListener("keyup", (event) => input.keys.delete(event.key.toLowerCase()));
window.addEventListener("mousemove", updateMouse);
window.addEventListener("mousedown", (event) => {
  if (event.button === 0) input.mouse.down = true;
  if (event.button === 2) input.mouse.right = true;
});
window.addEventListener("mouseup", (event) => {
  if (event.button === 0) input.mouse.down = false;
  if (event.button === 2) input.mouse.right = false;
});
window.addEventListener("contextmenu", (event) => event.preventDefault());
document.querySelectorAll("[data-touch-key]").forEach((button) => {
  bindTouchButton(button, (active) => {
    const key = button.dataset.touchKey;
    if (active) input.touchKeys.add(key);
    else input.touchKeys.delete(key);
  });
});
document.querySelectorAll("[data-touch-action]").forEach((button) => {
  bindTouchButton(button, (active) => {
    if (button.dataset.touchAction === "fire") input.touchFire = active;
    if (button.dataset.touchAction === "shield") input.touchShield = active;
  });
});

function join(team) {
  state.team = team;
  state.mode = "playing";
  state.local.x = TEAM[team].base.x;
  state.local.z = TEAM[team].base.z;
  teamLabel.textContent = TEAM[team].name;
  startPanel.classList.add("hidden");
  messageLine.textContent = "از بالا مسیر maze را کنترل کن. تیر برای دشمن، شیلد برای خودی‌ها.";
  send({ type: "join", team });
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  socket = new WebSocket(`${protocol}//${location.host}`);
  socket.addEventListener("open", () => {
    state.connected = true;
    serverStatus.textContent = "وصل";
    serverStatus.style.color = "#58d88b";
    if (state.team) send({ type: "join", team: state.team });
  });
  socket.addEventListener("message", (event) => {
    const packet = JSON.parse(event.data);
    if (packet.type === "ping") {
      send({ type: "pong", t: packet.t });
      return;
    }
    if (packet.type === "state") applyServerState(packet);
    if (packet.type === "notice") messageLine.textContent = packet.text;
  });
  socket.addEventListener("close", () => {
    state.connected = false;
    serverStatus.textContent = "تمرینی";
    serverStatus.style.color = "#f5c04d";
    setTimeout(connect, 900);
  });
}

function send(packet) {
  if (socket && socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(packet));
}

function applyServerState(packet) {
  state.lastMessage = performance.now();
  state.scores = packet.scores;
  state.helicopters = packet.helicopters;
  state.soldiers = packet.soldiers;
  state.bullets = packet.bullets;
  state.shields = packet.shields;
  blueScore.textContent = state.scores.blue;
  redScore.textContent = state.scores.red;
}

function buildWorld() {
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(48, 44),
    new THREE.MeshStandardMaterial({ color: 0x20313d, roughness: 0.92 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  root.add(ground);

  const wallGeometry = new THREE.BoxGeometry(cellSize, 1.15, cellSize);
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x3c5360, roughness: 0.82 });
  const pathMaterial = new THREE.MeshStandardMaterial({ color: 0x263946, roughness: 0.9 });

  for (let r = 0; r < MAZE.length; r++) {
    for (let c = 0; c < MAZE[r].length; c++) {
      const x = mazeOffsetX + c * cellSize;
      const z = mazeOffsetZ + r * cellSize;
      if (MAZE[r][c] === "#") {
        const wall = new THREE.Mesh(wallGeometry, wallMaterial);
        wall.position.set(x, 0.58, z);
        wall.castShadow = true;
        wall.receiveShadow = true;
        root.add(wall);
        wallBoxes.push(new THREE.Box3().setFromObject(wall));
      } else {
        const tile = new THREE.Mesh(new THREE.BoxGeometry(cellSize * 0.92, 0.05, cellSize * 0.92), pathMaterial);
        tile.position.set(x, 0.025, z);
        tile.receiveShadow = true;
        root.add(tile);
      }
    }
  }

  addBase("blue");
  addBase("red");
}

function addBase(team) {
  const marker = new THREE.Mesh(
    new THREE.CylinderGeometry(1.15, 1.15, 0.08, 32),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, emissive: TEAM[team].dark, emissiveIntensity: 0.42 }),
  );
  marker.position.copy(TEAM[team].base);
  marker.position.y = 0.08;
  root.add(marker);
}

function makeHelicopter(team) {
  const group = new THREE.Group();
  const color = TEAM[team].color;
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.42, 1.2, 6, 12),
    new THREE.MeshStandardMaterial({ color, metalness: 0.22, roughness: 0.35 }),
  );
  body.rotation.z = Math.PI / 2;
  body.castShadow = true;
  group.add(body);

  const cockpit = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xc9f0ff, transparent: true, opacity: 0.76 }),
  );
  cockpit.position.set(0.42, 0.08, 0);
  group.add(cockpit);

  const tail = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.12, 0.12),
    new THREE.MeshStandardMaterial({ color: TEAM[team].dark }),
  );
  tail.position.set(-1.1, 0, 0);
  group.add(tail);

  const rotor = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 0.035, 0.16),
    new THREE.MeshStandardMaterial({ color: 0xe8edf2, emissive: 0x334455, emissiveIntensity: 0.25 }),
  );
  rotor.name = "rotor";
  rotor.position.y = 0.52;
  group.add(rotor);

  const tailRotor = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.8, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe8edf2 }),
  );
  tailRotor.name = "tailRotor";
  tailRotor.position.set(-1.82, 0.04, 0);
  group.add(tailRotor);

  scene.add(group);
  return group;
}

function makeSoldier(team) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: TEAM[team].color, roughness: 0.7 });
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.18, 0.42, 5, 10), mat);
  body.position.y = 0.4;
  body.castShadow = true;
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf1c39a }));
  head.position.y = 0.82;
  group.add(head);
  scene.add(group);
  return group;
}

function makeBullet(team) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.12, 12, 8),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, emissive: TEAM[team].color, emissiveIntensity: 1.8 }),
  );
  scene.add(mesh);
  return mesh;
}

function makeShield(team) {
  const mesh = new THREE.Mesh(
    new THREE.TorusGeometry(0.58, 0.045, 8, 32),
    new THREE.MeshStandardMaterial({ color: TEAM[team].color, emissive: TEAM[team].color, emissiveIntensity: 1.2 }),
  );
  mesh.rotation.x = Math.PI / 2;
  scene.add(mesh);
  return mesh;
}

function update(dt) {
  updateMouse();
  updateLocalPlayer(dt);
  if (!state.connected && state.mode === "playing") simulateFallback(dt);
  syncMeshes();
  updateCamera(dt);
}

function updateLocalPlayer(dt) {
  if (state.mode !== "playing" || !state.team) return;
  const speed = 9.5;
  let dx = 0;
  let dz = 0;
  if (input.keys.has("w") || input.keys.has("arrowup") || input.touchKeys.has("w")) dz -= 1;
  if (input.keys.has("s") || input.keys.has("arrowdown") || input.touchKeys.has("s")) dz += 1;
  if (input.keys.has("a") || input.keys.has("arrowleft") || input.touchKeys.has("a")) dx -= 1;
  if (input.keys.has("d") || input.keys.has("arrowright") || input.touchKeys.has("d")) dx += 1;
  const len = Math.hypot(dx, dz) || 1;
  const nx = state.local.x + (dx / len) * speed * dt;
  const nz = state.local.z + (dz / len) * speed * dt;
  if (!hitsWall(nx, nz, 0.55)) {
    state.local.x = THREE.MathUtils.clamp(nx, -18.4, 18.4);
    state.local.z = THREE.MathUtils.clamp(nz, -16.2, 16.2);
  }
  state.local.yaw = Math.atan2(input.mouse.world.x - state.local.x, input.mouse.world.z - state.local.z);
  state.local.cooldown = Math.max(0, state.local.cooldown - dt);
  state.local.shieldCooldown = Math.max(0, state.local.shieldCooldown - dt);

  const wantsFire = input.mouse.down || input.keys.has(" ") || input.touchFire;
  const wantsShield = input.mouse.right || input.keys.has("shift") || input.touchShield;
  if (wantsFire && state.local.cooldown <= 0) {
    state.local.cooldown = 0.32;
    fire();
  }
  if (wantsShield && state.local.shieldCooldown <= 0) {
    state.local.shieldCooldown = 1.15;
    shield();
  }
  sendInputSnapshot();
}

function sendInputSnapshot(force = false) {
  const now = performance.now();
  const packet = {
    type: "input",
    x: +state.local.x.toFixed(2),
    z: +state.local.z.toFixed(2),
    yaw: +state.local.yaw.toFixed(3),
  };
  const body = JSON.stringify(packet);
  if (!force && now - lastInputSent < 50 && body === lastInputPacket) return;
  if (!force && now - lastInputSent < 50) return;
  lastInputSent = now;
  lastInputPacket = body;
  send(packet);
}

function fire() {
  const dir = new THREE.Vector3(Math.sin(state.local.yaw), 0, Math.cos(state.local.yaw));
  send({ type: "fire", x: state.local.x, z: state.local.z, dx: dir.x, dz: dir.z });
  if (!state.connected) {
    state.bullets.push({ id: crypto.randomUUID(), team: state.team, x: state.local.x, z: state.local.z, dx: dir.x, dz: dir.z, ttl: 1.2 });
  }
}

function shield() {
  send({ type: "shield", x: input.mouse.world.x, z: input.mouse.world.z });
  if (!state.connected) {
    state.shields.push({ id: crypto.randomUUID(), team: state.team, x: input.mouse.world.x, z: input.mouse.world.z, ttl: 1.8 });
  }
}

function hitsWall(x, z, radius) {
  const box = new THREE.Box3(
    new THREE.Vector3(x - radius, 0, z - radius),
    new THREE.Vector3(x + radius, 2.4, z + radius),
  );
  return wallBoxes.some((wall) => wall.intersectsBox(box));
}

function simulateFallback(dt) {
  fallbackTimer += dt;
  const enemy = state.team === "blue" ? "red" : "blue";
  state.helicopters[state.team] = { team: state.team, x: state.local.x, z: state.local.z, yaw: state.local.yaw };
  state.helicopters[enemy] = {
    team: enemy,
    x: Math.sin(fallbackTimer * 0.7) * 9 + TEAM[enemy].base.x * 0.25,
    z: Math.cos(fallbackTimer * 0.6) * 8 + TEAM[enemy].base.z * 0.25,
    yaw: fallbackTimer,
  };
  if (state.soldiers.length < 12) {
    spawnLocalSoldiers("blue");
    spawnLocalSoldiers("red");
  }
  for (const soldier of state.soldiers) {
    const target = TEAM[soldier.team === "blue" ? "red" : "blue"].base;
    const dx = target.x - soldier.x;
    const dz = target.z - soldier.z;
    const len = Math.hypot(dx, dz) || 1;
    const speed = soldier.shield ? 1.4 : 0.9;
    const nx = soldier.x + (dx / len) * speed * dt;
    const nz = soldier.z + (dz / len) * speed * dt;
    if (!hitsWall(nx, nz, 0.22)) {
      soldier.x = nx;
      soldier.z = nz;
    } else {
      soldier.x += Math.sin(fallbackTimer + soldier.seed) * dt;
      soldier.z += Math.cos(fallbackTimer + soldier.seed) * dt;
    }
    soldier.shield = Math.max(0, soldier.shield - dt);
  }
  for (const bullet of state.bullets) {
    bullet.x += bullet.dx * 17 * dt;
    bullet.z += bullet.dz * 17 * dt;
    bullet.ttl -= dt;
    const hit = state.soldiers.find((soldier) => soldier.team !== bullet.team && Math.hypot(soldier.x - bullet.x, soldier.z - bullet.z) < 0.55);
    if (hit && hit.shield <= 0) {
      state.soldiers = state.soldiers.filter((soldier) => soldier !== hit);
      state.scores[bullet.team] += 1;
      bullet.ttl = 0;
    }
  }
  for (const shield of state.shields) {
    shield.ttl -= dt;
    for (const soldier of state.soldiers) {
      if (soldier.team === shield.team && Math.hypot(soldier.x - shield.x, soldier.z - shield.z) < 1.4) {
        soldier.shield = 3;
      }
    }
  }
  state.bullets = state.bullets.filter((bullet) => bullet.ttl > 0 && !hitsWall(bullet.x, bullet.z, 0.1));
  state.shields = state.shields.filter((shield) => shield.ttl > 0);
  blueScore.textContent = state.scores.blue;
  redScore.textContent = state.scores.red;
}

function spawnLocalSoldiers(team) {
  const base = TEAM[team].base;
  for (let i = 0; i < 3; i++) {
    state.soldiers.push({
      id: `${team}-${performance.now()}-${i}`,
      team,
      x: base.x + (Math.random() - 0.5) * 1.4,
      z: base.z + (Math.random() - 0.5) * 1.4,
      shield: 0,
      seed: Math.random() * 10,
    });
  }
}

function syncMeshes() {
  const helicopterList = Object.values(state.helicopters);
  if (state.team) {
    const localIndex = helicopterList.findIndex((item) => item.team === state.team);
    const localHeli = { id: state.team, team: state.team, x: state.local.x, z: state.local.z, yaw: state.local.yaw };
    if (localIndex >= 0) helicopterList[localIndex] = localHeli;
    else helicopterList.push(localHeli);
  }
  syncCollection(meshes.helicopters, helicopterList, (item) => makeHelicopter(item.team), (mesh, item) => {
    const target = new THREE.Vector3(item.x, 3.25, item.z);
    if (item.team === state.team) mesh.position.copy(target);
    else mesh.position.lerp(target, 0.38);
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, item.yaw, item.team === state.team ? 1 : 0.32);
    mesh.getObjectByName("rotor").rotation.y += 0.9;
    mesh.getObjectByName("tailRotor").rotation.x += 1.2;
  });

  syncCollection(meshes.soldiers, state.soldiers, (item) => makeSoldier(item.team), (mesh, item) => {
    mesh.position.lerp(new THREE.Vector3(item.x, 0, item.z), 0.34);
    mesh.rotation.y = Math.sin(performance.now() * 0.005 + item.x) * 0.2;
    mesh.scale.setScalar(item.shield > 0 ? 1.12 : 1);
  });

  syncCollection(meshes.bullets, state.bullets, (item) => makeBullet(item.team), (mesh, item) => {
    mesh.position.lerp(new THREE.Vector3(item.x, 1.8, item.z), 0.55);
  });

  syncCollection(meshes.shields, state.shields, (item) => makeShield(item.team), (mesh, item) => {
    mesh.position.set(item.x, 0.18, item.z);
    mesh.scale.setScalar(1 + Math.sin(performance.now() * 0.01) * 0.08);
  });
}

function syncCollection(map, items, create, updateItem) {
  const ids = new Set(items.map((item) => item.id || item.team));
  for (const [id, mesh] of map) {
    if (!ids.has(id)) {
      scene.remove(mesh);
      map.delete(id);
    }
  }
  for (const item of items) {
    const id = item.id || item.team;
    if (!map.has(id)) map.set(id, create(item));
    updateItem(map.get(id), item);
  }
}

function updateCamera(dt) {
  const target = state.team && state.helicopters[state.team]
    ? state.helicopters[state.team]
    : { x: 0, z: 0 };
  const desired = new THREE.Vector3(target.x, 25, target.z + 17);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  camera.lookAt(target.x, 0, target.z);
}

function updateMouse() {
  const rect = canvas.getBoundingClientRect();
  const nx = ((input.mouse.x - rect.left) / rect.width) * 2 - 1;
  const ny = -((input.mouse.y - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera({ x: nx || 0, y: ny || 0 }, camera);
  raycaster.ray.intersectPlane(groundPlane, input.mouse.world);
}

function bindTouchButton(button, onChange) {
  const activate = (event) => {
    event.preventDefault();
    onChange(true);
  };
  const deactivate = (event) => {
    event.preventDefault();
    onChange(false);
  };
  button.addEventListener("pointerdown", activate);
  button.addEventListener("pointerup", deactivate);
  button.addEventListener("pointercancel", deactivate);
  button.addEventListener("pointerleave", deactivate);
}

window.addEventListener("pointermove", (event) => {
  input.mouse.x = event.clientX;
  input.mouse.y = event.clientY;
});

function resize() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

function loop(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}

window.advanceTime = (ms) => {
  const steps = Math.max(1, Math.round(ms / (1000 / 60)));
  for (let i = 0; i < steps; i++) update(1 / 60);
  renderer.render(scene, camera);
};

window.render_game_to_text = () => JSON.stringify({
  mode: state.mode,
  connected: state.connected,
  team: state.team,
  coordinateSystem: "x right, z down maze, helicopters at y=3.25 above maze",
  scores: state.scores,
  localHelicopter: state.team ? state.helicopters[state.team] || state.local : null,
  helicopters: Object.values(state.helicopters),
  soldiers: state.soldiers.slice(0, 16).map((s) => ({ id: s.id, team: s.team, x: +s.x.toFixed(2), z: +s.z.toFixed(2), shield: +(s.shield || 0).toFixed(1) })),
  bullets: state.bullets.length,
  shields: state.shields.length,
});
