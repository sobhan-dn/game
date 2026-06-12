import * as THREE from "./node_modules/three/build/three.module.js";

(() => {
  const byId = (...ids) => ids.map((id) => document.getElementById(id)).find(Boolean);
  const canvas = document.getElementById("game");
  const overlay = document.getElementById("overlay");
  const startButton = byId("start-button", "start");
  const overlayNote = byId("overlay-note");
  const p1HealthValue = byId("p1-health", "p1");
  const p2HealthValue = byId("p2-health", "p2");
  const p1HealthBar = document.getElementById("p1-health-bar");
  const p2HealthBar = document.getElementById("p2-health-bar");
  const p2NameLabel = document.querySelector(".p2-panel .player-heading strong");
  const p1ScoreValue = byId("p1-score", "s1");
  const p2ScoreValue = byId("p2-score", "s2");
  const streakValue = document.getElementById("streak");
  const bestScoreValue = document.getElementById("best-score");
  const coinsValue = document.getElementById("coins");
  const rankValue = document.getElementById("rank");
  const dailyMissionValue = document.getElementById("daily-mission");
  const dailyRewardValue = document.getElementById("daily-reward");
  const riftChargeValue = document.getElementById("rift-charge");
  const riftStateValue = document.getElementById("rift-state");
  const enemiesValue = document.getElementById("enemies");
  const timerValue = document.getElementById("timer");
  const statusValue = document.getElementById("status");
  const topAlertFill = document.getElementById("top-alert-fill");
  const topAlertText = document.getElementById("top-alert-text");
  const touchStick = document.getElementById("touch-stick");
  const touchStickKnob = document.getElementById("touch-stick-knob");
  const touchJump = document.getElementById("touch-jump");
  const touchSurge = document.getElementById("touch-surge");
  const touchFire = document.getElementById("touch-fire");

  const isNativeIos = location.protocol === "voidspheres:" || location.protocol === "capacitor:";
  const isCompactTouch = matchMedia("(pointer: coarse), (max-width: 760px)").matches;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isCompactTouch,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isCompactTouch ? 1.5 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06101a, 0.012);
  const camera = new THREE.PerspectiveCamera(isCompactTouch ? 74 : 68, innerWidth / innerHeight, 0.1, 600);
  const root = new THREE.Group();
  scene.add(root);

  const clock = new THREE.Clock();
  const loader = new THREE.TextureLoader();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  const input = { f: false, b: false, l: false, r: false, jump: false, fire: false };
  const cameraState = { forward: new THREE.Vector3(1, 0, 0) };
  const net = { ws: null, role: "pending", connected: false, peer: false, ready: false, last: 0, playerId: getPlayerId() };
  const mode = { type: "ai" };
  const aiBrain = { nextJump: 0, nextStrafe: 0, strafe: 1, fireDelay: 0, aggression: 0.75 };
  const roundSeconds = 120;
  const state = {
    started: false,
    ended: false,
    message: "Tap Start",
    timeLeft: roundSeconds,
    nextEnemySpawn: 0,
    streak: 0,
    streakTimer: 0,
    bestStreak: readNumber("speedy-jumper-best-streak"),
    bestScore: readNumber("speedy-jumper-best-score"),
    coins: readNumber("speedy-jumper-coins"),
    matchCoins: 0,
    dailyTarget: 12,
    dailyProgress: readDailyProgress(),
    dailyClaimed: readTodayFlag("speedy-jumper-daily-claimed"),
    riftCharge: 0,
    riftActive: false,
    riftTimer: 0,
    nextShardSpawn: 0,
  };
  const scores = { p1: 0, p2: 0 };
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audio = { context: null, master: null, music: null, sfx: null, nextBeat: 0, step: 0 };

  const players = {
    p1: makePlayer("p1", "Player 1", 0x65f7df, 0x5ef5ff),
    p2: makePlayer("p2", "Player 2", 0xffbd57, 0xff8a25),
  };
  const platforms = [];
  const riftShards = [];
  const surgeWaves = [];
  const enemies = [];
  const bullets = [];
  const effects = [];
  let lookTouchId = null;
  let lookTouchX = 0;

  const keys = {
    KeyW: "f",
    ArrowUp: "f",
    KeyS: "b",
    ArrowDown: "b",
    KeyA: "l",
    ArrowLeft: "l",
    KeyD: "r",
    ArrowRight: "r",
  };
  const shardSlots = [
    [1, 0.34, 0.7],
    [2, -0.28, 2.8],
    [4, 0.18, 4.3],
    [6, -0.18, 5.5],
  ];

  const textureSpecs = [
    ["./assets/textures/sphere-ice.png", "ice"],
    ["./assets/textures/sphere-lava.png", "lava"],
    ["./assets/textures/sphere-emerald.png", "emerald"],
    ["./assets/textures/sphere-amber.png", "amber"],
  ];
  const sphereTextures = textureSpecs.map(([url, kind]) =>
    loadTexture(url, () => sphereFallback(kind), 1.8, 1.8)
  );
  const skyTexture = loadTexture("./assets/textures/cosmic-bg.png", skyFallback, 1, 1);

  initScene();
  resetGame();
  animate();

  function makePlayer(id, label, color, bulletColor) {
    const mesh = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.25,
      roughness: 0.26,
      metalness: 0.42,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: id === "p1" ? 0x153043 : 0x4a2307,
      emissive: id === "p1" ? 0x06333b : 0x351404,
      emissiveIntensity: 0.28,
      roughness: 0.2,
      metalness: 0.62,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 1.05, 5, 12), bodyMat);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 18), bodyMat);
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.22, 16, 16),
      new THREE.MeshBasicMaterial({ color: bulletColor })
    );
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.9), armorMat);
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.58, 0.045, 12, 36),
      new THREE.MeshBasicMaterial({ color: bulletColor, transparent: true, opacity: 0.72 })
    );
    head.position.y = 0.78;
    visor.position.set(0, 0.78, 0.28);
    gun.position.set(0.52, 0.08, 0.26);
    halo.rotation.x = Math.PI / 2;
    mesh.add(body, head, visor, gun, halo);
    root.add(mesh);
    return {
      id,
      label,
      color,
      bulletColor,
      mesh,
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      forward: new THREE.Vector3(id === "p1" ? 1 : -1, 0, 0),
      platform: null,
      grounded: true,
      health: 100,
      alive: true,
      cooldown: 0,
      invuln: 0,
      jumpGrace: 0,
      respawnTimer: 0,
      remote: id === "p2",
    };
  }

  function initScene() {
    scene.add(new THREE.HemisphereLight(0xb9ecff, 0x06101a, 1.35));
    const sun = new THREE.DirectionalLight(0xffefd0, 1.55);
    sun.position.set(24, 36, 20);
    scene.add(sun);
    const fill = new THREE.PointLight(0x40dcff, 60, 180, 2);
    fill.position.set(-14, 20, -22);
    scene.add(fill);
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(190, 64, 32),
      new THREE.MeshBasicMaterial({
        map: skyTexture,
        color: 0x9bdfff,
        side: THREE.BackSide,
        fog: false,
      })
    );
    scene.add(sky);

    const stars = new THREE.BufferGeometry();
    const positions = new Float32Array(2400 * 3);
    for (let i = 0; i < 2400; i += 1) {
      const r = 110 + Math.random() * 150;
      const a = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
      const h = Math.sqrt(1 - z * z);
      positions[i * 3] = Math.cos(a) * h * r;
      positions[i * 3 + 1] = z * r;
      positions[i * 3 + 2] = Math.sin(a) * h * r;
    }
    stars.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    scene.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7 })));
  }

  function resetGame(broadcast = false) {
    for (const item of [...platforms, ...riftShards, ...surgeWaves, ...enemies, ...bullets, ...effects]) {
      root.remove(item.mesh || item.group);
    }
    platforms.length = 0;
    riftShards.length = 0;
    surgeWaves.length = 0;
    enemies.length = 0;
    bullets.length = 0;
    effects.length = 0;
    scores.p1 = 0;
    scores.p2 = 0;
    state.streak = 0;
    state.streakTimer = 0;
    state.matchCoins = 0;
    state.riftCharge = 0;
    state.riftActive = false;
    state.riftTimer = 0;
    state.nextShardSpawn = 0;
    state.dailyProgress = readDailyProgress();
    state.dailyClaimed = readTodayFlag("speedy-jumper-daily-claimed");
    state.started = false;
    state.ended = false;
    state.message = "Tap Start";
    state.timeLeft = roundSeconds;
    state.nextEnemySpawn = 0;
    document.body.classList.remove("game-over", "target-locked");
    document.body.classList.remove("rift-active");
    createPlatforms();
    createRiftShards();
    placePlayer(players.p1, platforms[0], new THREE.Vector3(0, 1, 0));
    placePlayer(players.p2, platforms[0], new THREE.Vector3(0.45, 0.88, 0.12).normalize());
    players.p2.label = mode.type === "ai" ? "AI Rival" : "Player 2";
    if (p2NameLabel) p2NameLabel.textContent = mode.type === "ai" ? "AI RIVAL" : "YELLOW";
    cameraState.forward.copy(players[net.role] ? players[net.role].forward : players.p1.forward);
    createEnemies();
    showOverlay("Start Match", mode.type === "ai"
      ? "Solo vs AI starts instantly. Chain hits for streak bonuses."
      : "Open two browsers to play online. Player 1 joins first, Player 2 joins second.");
    updateCamera(0.016);
    updateUi();
    if (broadcast && mode.type === "online") send({ type: "restart" });
  }

  function createPlatforms() {
    const defs = [
      [8.2, [0, 6, 0], [0, 1.4, 0], 0x3edbff],
      [6.1, [16, 13, -9], [2.3, 1.8, 2.2], 0xff4b21],
      [5.4, [-15, 11, 12], [2.2, 1.4, 2.5], 0x35e879],
      [6.6, [28, 19, 10], [1.7, 2.1, 2.1], 0xffbd57],
      [5.2, [8, 25, 24], [2.4, 1.4, 2.8], 0x6ff7dd],
      [7.3, [-18, 23, 28], [2.7, 2.1, 2.3], 0xff8a25],
      [8.4, [34, 31, 28], [2.2, 2.4, 2.0], 0x31d67c],
    ];
    defs.forEach(([radius, base, amp, glow], i) => {
      const group = new THREE.Group();
      const mat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: sphereTextures[i % sphereTextures.length],
        roughness: 0.42,
        metalness: 0.32,
        emissive: glow,
        emissiveIntensity: 0.16,
      });
      const shell = new THREE.Mesh(new THREE.SphereGeometry(radius, 42, 42), mat);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.22, radius * 0.08, 12, 72),
        new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.48 })
      );
      const aura = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.08, 32, 32),
        new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0.16 })
      );
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      group.add(shell, ring, aura);
      root.add(group);
      platforms.push({
        group,
        mesh: group,
        radius,
        base: new THREE.Vector3(...base),
        amp: new THREE.Vector3(...amp),
        center: new THREE.Vector3(...base),
        prev: new THREE.Vector3(...base),
        delta: new THREE.Vector3(),
        phase: Math.random() * 6,
        speed: 0.34 + i * 0.04,
        ring,
        mat,
      });
    });
  }

  function createRiftShards() {
    for (const [platformIndex, lat, lon] of shardSlots) {
      spawnRiftShard(platformIndex, lat, lon);
    }
  }

  function spawnRiftShard(
    platformIndex = 1 + Math.floor(Math.random() * Math.max(1, platforms.length - 1)),
    lat = Math.random() * 0.8 - 0.4,
    lon = Math.random() * Math.PI * 2
  ) {
    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.62, 1),
      new THREE.MeshStandardMaterial({
        color: 0xdffcff,
        emissive: 0x64fff1,
        emissiveIntensity: 0.86,
        roughness: 0.18,
        metalness: 0.48,
      })
    );
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.92, 0.045, 10, 42),
      new THREE.MeshBasicMaterial({ color: 0x6ff7dd, transparent: true, opacity: 0.72 })
    );
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.1, 18, 18),
      new THREE.MeshBasicMaterial({ color: 0x6ff7dd, transparent: true, opacity: 0.14 })
    );
    group.add(core, ring, halo);
    root.add(group);
    riftShards.push({
      group,
      mesh: group,
      core,
      ring,
      platform: platforms[platformIndex % platforms.length],
      lat,
      lon,
      phase: Math.random() * Math.PI * 2,
      pos: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    });
  }

  function createEnemies() {
    const slots = [[1, 0.2, 1], [2, -0.2, 2.4], [3, 0.1, 4], [4, -0.3, 1.5], [5, 0.2, 4.8], [6, -0.1, 2.8]];
    for (const [platformIndex, lat, lon] of slots) {
      spawnEnemy(platformIndex, lat, lon);
    }
  }

  function spawnEnemy(platformIndex = 1 + Math.floor(Math.random() * Math.max(1, platforms.length - 1)), lat = Math.random() * 0.8 - 0.4, lon = Math.random() * Math.PI * 2) {
    const mesh = makeEnemyMesh();
    root.add(mesh);
    enemies.push({
      mesh,
      platform: platforms[platformIndex % platforms.length],
      lat,
      lon,
      health: 60,
      cooldown: 0.8 + Math.random(),
      pos: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      dead: false,
    });
    spawnEffect(platforms[platformIndex % platforms.length].center, 0xff3030, 0.28);
  }

  function makeEnemyMesh() {
    const group = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xff2525, emissive: 0x5a0505, emissiveIntensity: 0.55 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24070a, metalness: 0.5, roughness: 0.25 });
    group.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 1.0, 4, 10), red));
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), new THREE.MeshBasicMaterial({ color: 0xfff0f0 }));
    eye.position.set(0, 0.62, 0.34);
    const spikes = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.05, 10, 32), new THREE.MeshBasicMaterial({ color: 0xff3030 }));
    spikes.rotation.x = Math.PI / 2;
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.78), dark);
    gun.position.set(0.52, 0.06, 0.2);
    group.add(eye, spikes, gun);
    return group;
  }

  function placePlayer(player, platform, up) {
    player.platform = platform;
    player.up.copy(up);
    player.pos.copy(platform.center).addScaledVector(up, platform.radius + 0.9);
    player.vel.set(0, 0, 0);
    player.health = 100;
    player.alive = true;
    player.grounded = true;
    player.cooldown = 0;
    player.jumpGrace = 0;
    player.respawnTimer = 0;
    syncMesh(player);
  }

  function startGame() {
    if (mode.type === "ai") {
      if (state.ended) resetGame(false);
      net.role = "p1";
      net.ready = true;
      net.peer = true;
      players.p1.remote = false;
      players.p2.remote = false;
      players.p2.label = "AI Rival";
      state.started = true;
      state.message = "Solo match live";
      hideOverlay();
      ensureAudio();
      playSweep(360, 780, 0.2, 0.08, "triangle");
      updateUi();
      return;
    }
    ensureAudio();
    if (net.role === "pending") {
      state.message = "Connecting to server";
      showOverlay("Waiting", "Connecting to the online server...");
      updateUi();
      return;
    }
    if (net.role === "spectator") {
      state.message = "Spectator mode";
      showOverlay("Spectating", "Two players are already in the match.");
      updateUi();
      return;
    }
    if (!net.ready) {
      state.message = "Waiting for second player";
      showOverlay("Waiting for Rival", "The match starts only when both blue and yellow players are online.");
      updateUi();
      return;
    }
    if (state.ended) {
      resetGame(true);
    }
    state.started = true;
    state.message = "Match live";
    hideOverlay();
    playSweep(360, 780, 0.2, 0.08, "triangle");
    updateUi();
  }

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.033);
    update(dt);
    renderer.render(scene, camera);
  }

  function update(dt) {
    for (const platform of platforms) {
      platform.prev.copy(platform.center);
      platform.center.set(
        platform.base.x + Math.sin(clock.elapsedTime * platform.speed + platform.phase) * platform.amp.x,
        platform.base.y + Math.cos(clock.elapsedTime * platform.speed * 1.5 + platform.phase) * platform.amp.y,
        platform.base.z + Math.sin(clock.elapsedTime * platform.speed * 0.8 + platform.phase) * platform.amp.z
      );
      platform.delta.subVectors(platform.center, platform.prev);
      platform.group.position.copy(platform.center);
      platform.group.rotation.y += dt * 0.28;
      platform.ring.rotation.x += dt * 0.36;
      platform.mat.emissiveIntensity = 0.14 + Math.sin(clock.elapsedTime * 2 + platform.phase) * 0.05;
    }

    if (state.started && !state.ended) {
      const local = localPlayer();
      state.timeLeft = Math.max(0, state.timeLeft - dt);
      if (state.timeLeft <= 0) finishByScore("Time is up.");
      updateRespawn(local, dt);
      updatePlayer(local, dt);
      if (mode.type === "ai") {
        updateAiPlayer(players.p2, dt);
      } else {
        updateRemotePlayer(remotePlayer(), dt);
      }
      updateRiftShards(dt);
      updateRiftSurge(dt);
      updateEnemies(dt);
      updateEnemySpawns(dt);
      updateBullets(dt);
      sendState();
    }
    state.streakTimer = Math.max(0, state.streakTimer - dt);
    if (state.streakTimer <= 0) state.streak = 0;
    updateSurgeWaves(dt);
    updateEffects(dt);
    updateMusic();
    updateCamera(dt);
    updateUi();
  }

  function updatePlayer(player, dt) {
    if (!player || !player.alive) return;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invuln = Math.max(0, (player.invuln || 0) - dt);
    player.jumpGrace = Math.max(0, (player.jumpGrace || 0) - dt);
    if (player.grounded && player.platform) player.pos.add(player.platform.delta);

    const platform = nearestPlatform(player.pos);
    const desiredUp = tmp.copy(player.pos).sub(platform.center).normalize();
    player.up.lerp(desiredUp, 1 - Math.exp(-26 * dt)).normalize();
    const forward = tmp2.copy(cameraState.forward).projectOnPlane(player.up);
    if (forward.lengthSq() < 0.001) forward.copy(player.forward).projectOnPlane(player.up);
    forward.normalize();
    const right = new THREE.Vector3().crossVectors(forward, player.up).normalize();
    const move = new THREE.Vector3();
    if (input.f) move.add(forward);
    if (input.b) move.sub(forward);
    if (input.r) move.add(right);
    if (input.l) move.sub(right);
    if (move.lengthSq() > 0.01) move.normalize();

    const normalSpeed = player.vel.dot(player.up);
    const tangent = player.vel.clone().sub(player.up.clone().multiplyScalar(normalSpeed));
    const surgeBoost = state.riftActive && player.id === net.role ? 1.22 : 1;
    tangent.addScaledVector(move, (player.grounded ? 70 : 24) * dt * surgeBoost);
    if (tangent.length() > 24 * surgeBoost) tangent.setLength(24 * surgeBoost);
    if (player.grounded) tangent.multiplyScalar(Math.exp(-2.7 * dt));
    player.vel.copy(tangent).addScaledVector(player.up, normalSpeed);

    if (input.jump && player.grounded) {
      player.vel.addScaledVector(player.up, 25);
      player.vel.addScaledVector(move.lengthSq() ? move : forward, 19);
      player.grounded = false;
      player.jumpGrace = 0.42;
      playSweep(240, 520, 0.16, 0.055, "triangle");
      spawnEffect(player.pos, player.color, 0.35);
    }
    input.jump = false;
    const gravityUp = tmp.copy(player.pos).sub(platform.center).normalize();
    const launchPhase = player.jumpGrace > 0;
    const gravityPull = player.grounded ? 42 : launchPhase ? 48 : 122;
    player.vel.addScaledVector(gravityUp, -gravityPull * dt);
    if (!player.grounded) {
      const surfaceGap = player.pos.distanceTo(platform.center) - (platform.radius + 0.9);
      const magnetStrength = launchPhase
        ? THREE.MathUtils.clamp(1 - surfaceGap / 16, 0, 0.35) * 22
        : THREE.MathUtils.clamp(1 - surfaceGap / 42, 0.2, 1) * 94;
      player.vel.addScaledVector(gravityUp, -magnetStrength * dt);
    }
    player.pos.addScaledVector(player.vel, dt);
    landPlayer(player);

    if (input.fire && player.cooldown <= 0) fire(player);
    player.forward.lerp(forward, 1 - Math.exp(-16 * dt)).normalize();
    syncMesh(player);
    if (player.pos.length() > 230 || player.pos.y < -90) damagePlayer(player, 100, null);
  }

  function updateRespawn(player, dt) {
    if (!player || player.alive || player.respawnTimer <= 0) return;
    player.respawnTimer -= dt;
    if (player.respawnTimer <= 0) {
      const platform = platforms[Math.floor(Math.random() * platforms.length)];
      placePlayer(player, platform, spherical(Math.random() * 0.8 - 0.4, Math.random() * Math.PI * 2));
      playSweep(210, 640, 0.18, 0.06, "triangle");
      state.message = "Respawned";
    }
  }

  function updateRemotePlayer(player, dt) {
    if (!player || !player.target) return;
    player.pos.lerp(player.target.pos, 1 - Math.exp(-16 * dt));
    player.up.lerp(player.target.up, 1 - Math.exp(-12 * dt)).normalize();
    player.forward.lerp(player.target.forward, 1 - Math.exp(-12 * dt)).normalize();
    player.health = player.target.health;
    player.alive = player.target.alive;
    syncMesh(player);
  }

  function updateAiPlayer(player, dt) {
    if (!player) return;
    updateRespawn(player, dt);
    if (!player.alive) return;
    const target = players.p1;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invuln = Math.max(0, (player.invuln || 0) - dt);
    player.jumpGrace = Math.max(0, (player.jumpGrace || 0) - dt);
    aiBrain.nextJump = Math.max(0, aiBrain.nextJump - dt);
    aiBrain.nextStrafe = Math.max(0, aiBrain.nextStrafe - dt);
    aiBrain.fireDelay = Math.max(0, aiBrain.fireDelay - dt);
    aiBrain.aggression = 0.72 + THREE.MathUtils.clamp(scores.p1 - scores.p2, 0, 5) * 0.05;
    if (aiBrain.nextStrafe <= 0) {
      aiBrain.strafe = Math.random() < 0.5 ? -1 : 1;
      aiBrain.nextStrafe = 0.8 + Math.random() * 1.4;
    }
    if (player.grounded && player.platform) player.pos.add(player.platform.delta);

    const platform = nearestPlatform(player.pos);
    const desiredUp = tmp.copy(player.pos).sub(platform.center).normalize();
    player.up.lerp(desiredUp, 1 - Math.exp(-24 * dt)).normalize();
    const toTarget = target.pos.clone().sub(player.pos).projectOnPlane(player.up);
    const forward = toTarget.lengthSq() > 0.01
      ? toTarget.normalize()
      : player.forward.clone().projectOnPlane(player.up).normalize();
    const right = new THREE.Vector3().crossVectors(forward, player.up).normalize();
    const distance = player.pos.distanceTo(target.pos);
    const move = forward.clone().multiplyScalar(distance > 16 ? 1 : -0.45).addScaledVector(right, aiBrain.strafe * 0.52).normalize();
    const normalSpeed = player.vel.dot(player.up);
    const tangent = player.vel.clone().sub(player.up.clone().multiplyScalar(normalSpeed));
    tangent.addScaledVector(move, (player.grounded ? 58 : 20) * dt * aiBrain.aggression);
    if (tangent.length() > 22) tangent.setLength(22);
    if (player.grounded) tangent.multiplyScalar(Math.exp(-2.4 * dt));
    player.vel.copy(tangent).addScaledVector(player.up, normalSpeed);

    if (player.grounded && aiBrain.nextJump <= 0 && (distance > 18 || Math.random() < 0.04)) {
      player.vel.addScaledVector(player.up, 23);
      player.vel.addScaledVector(move, 16);
      player.grounded = false;
      player.jumpGrace = 0.38;
      aiBrain.nextJump = 0.9 + Math.random() * 1.2;
      spawnEffect(player.pos, player.color, 0.3);
    }

    const gravityUp = tmp.copy(player.pos).sub(platform.center).normalize();
    const launchPhase = player.jumpGrace > 0;
    const gravityPull = player.grounded ? 42 : launchPhase ? 48 : 122;
    player.vel.addScaledVector(gravityUp, -gravityPull * dt);
    if (!player.grounded) {
      const surfaceGap = player.pos.distanceTo(platform.center) - (platform.radius + 0.9);
      const magnetStrength = launchPhase
        ? THREE.MathUtils.clamp(1 - surfaceGap / 16, 0, 0.35) * 22
        : THREE.MathUtils.clamp(1 - surfaceGap / 42, 0.2, 1) * 94;
      player.vel.addScaledVector(gravityUp, -magnetStrength * dt);
    }
    player.pos.addScaledVector(player.vel, dt);
    landPlayer(player);

    player.forward.lerp(forward, 1 - Math.exp(-10 * dt)).normalize();
    if (distance < 66 && player.cooldown <= 0 && aiBrain.fireDelay <= 0 && target.alive) {
      const lead = target.pos.clone().addScaledVector(target.vel, THREE.MathUtils.clamp(distance / 72, 0.08, 0.42));
      fire(player, lead.sub(player.pos).normalize());
      aiBrain.fireDelay = 0.26 + Math.random() * 0.22;
    }
    syncMesh(player);
    if (player.pos.length() > 230 || player.pos.y < -90) damagePlayer(player, 100, null);
  }

  function landPlayer(player) {
    player.grounded = false;
    for (const platform of platforms) {
      const offset = player.pos.clone().sub(platform.center);
      const dist = offset.length();
      const normal = offset.multiplyScalar(1 / Math.max(dist, 0.0001));
      const surface = platform.radius + 0.9;
      if (dist < surface) {
        player.pos.copy(platform.center).addScaledVector(normal, surface);
        const inward = player.vel.dot(normal);
        if (inward < 0) player.vel.addScaledVector(normal, -inward);
      }
      if (Math.abs(dist - surface) < 2.05 && player.vel.dot(normal) < 25) {
        player.pos.copy(platform.center).addScaledVector(normal, surface);
        const normalSpeed = player.vel.dot(normal);
        if (normalSpeed < 0) player.vel.addScaledVector(normal, -normalSpeed);
        player.grounded = true;
        player.jumpGrace = 0;
        player.platform = platform;
        player.up.copy(normal);
      }
    }
  }

  function updateRiftShards(dt) {
    const local = localPlayer();
    for (let i = riftShards.length - 1; i >= 0; i -= 1) {
      const shard = riftShards[i];
      shard.lon += dt * 0.18;
      const normal = spherical(shard.lat + Math.sin(clock.elapsedTime * 0.8 + shard.phase) * 0.08, shard.lon);
      shard.up.copy(normal);
      shard.pos.copy(shard.platform.center).addScaledVector(normal, shard.platform.radius + 1.42);
      shard.group.position.copy(shard.pos);
      shard.group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      shard.core.rotation.y += dt * 2.4;
      shard.ring.rotation.x += dt * 1.9;
      shard.ring.rotation.z -= dt * 1.2;
      shard.group.scale.setScalar(1 + Math.sin(clock.elapsedTime * 4 + shard.phase) * 0.08);
      if (local && local.alive && local.pos.distanceTo(shard.pos) < 1.9) {
        collectRiftShard(i);
      }
    }

    state.nextShardSpawn = Math.max(0, state.nextShardSpawn - dt);
    if (riftShards.length < 4 && state.nextShardSpawn <= 0) {
      spawnRiftShard();
      state.nextShardSpawn = 2.4 + Math.random() * 1.8;
    }
  }

  function collectRiftShard(index) {
    const shard = riftShards[index];
    if (!shard) return;
    root.remove(shard.group);
    riftShards.splice(index, 1);
    addRiftCharge(25);
    awardCoins(1, false);
    state.message = state.riftCharge >= 100 ? "Rift Surge ready" : `Rift shard collected: ${state.riftCharge}%`;
    spawnEffect(shard.pos, 0x6ff7dd, 0.55);
    playSweep(640, 1180, 0.16, 0.055, "triangle");
    pulseDevice(12);
  }

  function addRiftCharge(amount) {
    state.riftCharge = THREE.MathUtils.clamp(Math.floor(state.riftCharge + amount), 0, 100);
  }

  function updateRiftSurge(dt) {
    if (!state.riftActive) return;
    state.riftTimer = Math.max(0, state.riftTimer - dt);
    if (state.riftTimer <= 0) {
      state.riftActive = false;
      document.body.classList.remove("rift-active");
      state.message = "Rift Surge ended";
    }
  }

  function activateRiftSurge() {
    const local = localPlayer();
    if (!local || !state.started || state.ended || state.riftActive || state.riftCharge < 100) return;
    state.riftCharge = 0;
    state.riftActive = true;
    state.riftTimer = 7;
    document.body.classList.add("rift-active");
    state.message = "Rift Surge active";
    spawnSurgeWave(local.pos, 0x6ff7dd);
    playSweep(220, 1380, 0.35, 0.08, "sawtooth");
    pulseDevice(26);

    let cleared = 0;
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      if (!enemy.dead && enemy.pos.distanceTo(local.pos) < 42) {
        enemy.dead = true;
        root.remove(enemy.mesh);
        addScore(local.id, 1, "Rift surge");
        cleared += 1;
        if (mode.type === "online") send({ type: "enemy-down", index: i, scorer: local.id });
      }
    }
    if (mode.type === "ai" && players.p2.alive && players.p2.pos.distanceTo(local.pos) < 24) {
      damagePlayer(players.p2, 30, local.id);
    }
    if (cleared > 0) state.message = `Rift Surge cleared ${cleared} red unit${cleared === 1 ? "" : "s"}`;
  }

  function spawnSurgeWave(pos, color) {
    const mesh = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.07, 12, 96),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 })
    );
    mesh.position.copy(pos);
    mesh.rotation.x = Math.PI / 2;
    root.add(mesh);
    surgeWaves.push({ mesh, life: 0.64, maxLife: 0.64 });
  }

  function updateSurgeWaves(dt) {
    for (let i = surgeWaves.length - 1; i >= 0; i -= 1) {
      const wave = surgeWaves[i];
      wave.life -= dt;
      const progress = 1 - wave.life / wave.maxLife;
      const scale = 1 + progress * 38;
      wave.mesh.scale.set(scale, scale, scale);
      wave.mesh.material.opacity = Math.max(0, 0.82 * (1 - progress));
      if (wave.life <= 0) {
        root.remove(wave.mesh);
        surgeWaves.splice(i, 1);
      }
    }
  }

  function updateEnemies(dt) {
    for (let i = 0; i < enemies.length; i += 1) {
      const enemy = enemies[i];
      if (enemy.dead) continue;
      enemy.lon += dt * 0.52;
      enemy.cooldown -= dt;
      const normal = spherical(enemy.lat + Math.sin(clock.elapsedTime + i) * 0.16, enemy.lon);
      enemy.up.copy(normal);
      enemy.pos.copy(enemy.platform.center).addScaledVector(normal, enemy.platform.radius + 0.95);
      enemy.mesh.position.copy(enemy.pos);
      enemy.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
      const target = localPlayer();
      if (target && target.alive && enemy.cooldown <= 0 && enemy.pos.distanceTo(target.pos) < 58) {
        shoot(enemy.pos.clone().addScaledVector(normal, 0.7), target.pos.clone().sub(enemy.pos).normalize(), 34, "enemy", 0xff3030);
        enemy.cooldown = 1.2 + Math.random() * 0.7;
      }
    }
  }

  function updateEnemySpawns(dt) {
    if (net.role !== "p1") return;
    state.nextEnemySpawn = Math.max(0, state.nextEnemySpawn - dt);
    const aliveCount = enemies.filter((enemy) => !enemy.dead).length;
    if (aliveCount >= 5 || state.nextEnemySpawn > 0) return;
    spawnEnemy();
    state.nextEnemySpawn = 1.2 + Math.random() * 1.6;
    if (mode.type === "online") send({ type: "enemy-spawn", index: enemies.length - 1, platform: platforms.indexOf(enemies[enemies.length - 1].platform), lat: enemies[enemies.length - 1].lat, lon: enemies[enemies.length - 1].lon });
  }

  function updateBullets(dt) {
    for (let i = bullets.length - 1; i >= 0; i -= 1) {
      const bullet = bullets[i];
      bullet.life -= dt;
      bullet.pos.addScaledVector(bullet.vel, dt);
      bullet.mesh.position.copy(bullet.pos);
      if (bullet.life <= 0 || platforms.some((p) => bullet.pos.distanceTo(p.center) < p.radius + 0.16)) {
        removeBullet(i);
        continue;
      }
      if (bullet.owner === "enemy") {
        const player = localPlayer();
        if (player && player.alive && bullet.pos.distanceTo(player.pos) < 1.15) {
          damagePlayer(player, 15, "enemy");
          playSweep(150, 70, 0.18, 0.06, "sawtooth");
          removeBullet(i);
        }
        continue;
      }
      for (let e = 0; e < enemies.length; e += 1) {
        const enemy = enemies[e];
        if (bullet.owner === net.role && !enemy.dead && bullet.pos.distanceTo(enemy.pos) < 1.25) {
          enemy.health -= 34;
          spawnEffect(enemy.pos, bullet.color, 0.36);
          if (enemy.health <= 0) {
            enemy.dead = true;
            root.remove(enemy.mesh);
            addScore(bullet.owner, 1, "Red unit down");
            playSweep(520, 160, 0.26, 0.07, "square");
            pulseDevice(18);
            if (mode.type === "online") send({ type: "enemy-down", index: e, scorer: bullet.owner });
          }
          removeBullet(i);
          break;
        }
      }
      const other = players[bullet.owner === "p1" ? "p2" : "p1"];
      if ((other.id === net.role || mode.type === "ai") && other.alive && bullet.pos.distanceTo(other.pos) < 1.1) {
        damagePlayer(other, 20, bullet.owner);
        removeBullet(i);
      }
    }
  }

  function fire(player, forcedDirection = null) {
    const crosshairDirection = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const aimForward = cameraState.forward.clone().projectOnPlane(player.up);
    if (aimForward.lengthSq() < 0.001) aimForward.copy(player.forward).projectOnPlane(player.up);
    aimForward.normalize();
    const muzzle = player.pos.clone().addScaledVector(player.up, 0.72).addScaledVector(aimForward, 1.0);
    const crosshairPoint = camera.position.clone().addScaledVector(crosshairDirection, 90);
    const direction = forcedDirection ? forcedDirection.clone().normalize() : crosshairPoint.sub(muzzle).normalize();
    shoot(muzzle, direction, 72, player.id, player.bulletColor);
    player.cooldown = state.riftActive && player.id === net.role ? 0.09 : 0.15;
    playSweep(player.id === "p2" ? 380 : 460, 170, 0.08, 0.045, "square");
    if (mode.type === "online") send({ type: "shot", origin: pack(muzzle), direction: pack(direction), color: player.bulletColor });
  }

  function shoot(origin, direction, speed, owner, color) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(owner === "enemy" ? 0.18 : 0.25, 14, 14),
      new THREE.MeshBasicMaterial({ color })
    );
    mesh.position.copy(origin);
    root.add(mesh);
    bullets.push({ mesh, pos: origin.clone(), vel: direction.clone().multiplyScalar(speed), owner, color, life: 2.6 });
    spawnEffect(origin, color, 0.12);
  }

  function damagePlayer(player, amount, source) {
    if (!player || player.invuln > 0) return;
    player.health = Math.max(0, player.health - amount);
    player.invuln = 0.35;
    spawnEffect(player.pos, player.color, 0.42);
    playSweep(170, 80, 0.2, 0.065, "sawtooth");
    if (source === "p1" || source === "p2") {
      addScore(source, 1, "Direct hit");
      state.message = `${source === "p1" ? "Player 1" : "Player 2"} scored a hit`;
      playSweep(620, 920, 0.12, 0.045, "triangle");
      pulseDevice(14);
    }
    if (mode.type === "online" && player.id === net.role) send({ type: "damage", target: player.id, health: player.health, source, scores });
    if (player.health <= 0) {
      player.alive = false;
      player.respawnTimer = 2.4;
      state.message = `${player.label} is respawning`;
    }
  }

  function addScore(owner, amount, reason) {
    if (!scores[owner]) scores[owner] = 0;
    const localScored = owner === net.role;
    if (localScored) {
      state.streak += 1;
      state.streakTimer = 3.5;
      state.bestStreak = Math.max(state.bestStreak, state.streak);
      writeNumber("speedy-jumper-best-streak", state.bestStreak);
      state.dailyProgress = Math.min(state.dailyTarget, state.dailyProgress + amount);
      writeDailyProgress(state.dailyProgress);
    } else {
      state.streak = 0;
      state.streakTimer = 0;
    }
    const bonus = state.streak > 0 && state.streak % 5 === 0 ? 2 : state.streak > 0 && state.streak % 3 === 0 ? 1 : 0;
    scores[owner] += amount + (localScored ? bonus : 0);
    if (localScored) {
      const coinGain = amount + bonus + (state.streak >= 5 ? 1 : 0);
      awardCoins(coinGain, false);
      if (!state.dailyClaimed && state.dailyProgress >= state.dailyTarget) {
        state.dailyClaimed = true;
        writeTodayFlag("speedy-jumper-daily-claimed", true);
        awardCoins(25, true);
        state.message = `Daily target complete: +25 coins`;
        playSweep(580, 1280, 0.22, 0.07, "triangle");
      }
    }
    if (localScored && scores[owner] > state.bestScore) {
      state.bestScore = scores[owner];
      writeNumber("speedy-jumper-best-score", state.bestScore);
    }
    if (bonus > 0) {
      state.message = `${reason}: x${state.streak} streak bonus +${bonus}`;
      playSweep(720, 1180, 0.16, 0.06, "triangle");
    }
  }

  function awardCoins(amount, announce) {
    state.coins += amount;
    state.matchCoins += amount;
    writeNumber("speedy-jumper-coins", state.coins);
    if (announce) pulseDevice(20);
  }

  function finishByScore(reason) {
    state.ended = true;
    input.fire = false;
    const winner = scores.p1 === scores.p2 ? "Draw" : scores.p1 > scores.p2 ? "Player 1 wins" : "Player 2 wins";
    const localWon = (net.role === "p1" && scores.p1 > scores.p2) || (net.role === "p2" && scores.p2 > scores.p1);
    if (localWon) awardCoins(10, true);
    if (state.bestStreak >= 8) awardCoins(5, true);
    if (scores[net.role] > state.bestScore) {
      state.bestScore = scores[net.role];
      writeNumber("speedy-jumper-best-score", state.bestScore);
    }
    state.message = `${reason} ${winner}. Final ${scores.p1}-${scores.p2}. +${state.matchCoins} coins. Best ${state.bestScore}.`;
    showOverlay("Play Again", state.message);
    document.body.classList.add("game-over");
  }

  function updateCamera(dt) {
    const player = localPlayer() || players.p1;
    const up = player.up.clone().normalize();
    const forward = cameraState.forward.clone().projectOnPlane(up);
    if (forward.lengthSq() < 0.001) forward.copy(player.forward).projectOnPlane(up);
    forward.normalize();
    cameraState.forward.copy(forward);
    const target = player.pos.clone().addScaledVector(up, 2.2).addScaledVector(forward, 1.9);
    const desired = target.clone().addScaledVector(forward, isCompactTouch ? -17 : -14.5).addScaledVector(up, isCompactTouch ? 5.2 : 4.5);
    camera.position.lerp(desired, 1 - Math.exp(-8 * dt));
    camera.up.copy(up);
    camera.lookAt(target);
  }

  function syncMesh(player) {
    const up = player.up.clone().normalize();
    const forward = player.forward.clone().projectOnPlane(up).normalize();
    const right = new THREE.Vector3().crossVectors(up, forward).normalize();
    const matrix = new THREE.Matrix4().makeBasis(right, up, forward);
    player.mesh.position.copy(player.pos);
    player.mesh.quaternion.setFromRotationMatrix(matrix);
    player.mesh.visible = player.alive;
  }

  function spawnEffect(pos, color, scale) {
    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(scale, 0),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    mesh.position.copy(pos);
    root.add(mesh);
    effects.push({ mesh, life: 0.35, scale });
  }

  function updateEffects(dt) {
    for (let i = effects.length - 1; i >= 0; i -= 1) {
      const effect = effects[i];
      effect.life -= dt;
      effect.mesh.scale.multiplyScalar(1 + dt * 5);
      effect.mesh.material.opacity = Math.max(0, effect.life / 0.35);
      if (effect.life <= 0) {
        root.remove(effect.mesh);
        effects.splice(i, 1);
      }
    }
  }

  function ensureAudio() {
    if (!AudioContextClass || audio.context) return;
    try {
      const context = new AudioContextClass();
      const master = context.createGain();
      const music = context.createGain();
      const sfx = context.createGain();
      master.gain.value = 0.68;
      music.gain.value = 0.16;
      sfx.gain.value = 0.36;
      music.connect(master);
      sfx.connect(master);
      master.connect(context.destination);
      audio.context = context;
      audio.master = master;
      audio.music = music;
      audio.sfx = sfx;
      audio.nextBeat = context.currentTime + 0.08;
    } catch {}
  }

  function updateMusic() {
    if (!audio.context || !state.started || state.ended) return;
    if (audio.context.state === "suspended") audio.context.resume();
    const horizon = audio.context.currentTime + 0.7;
    while (audio.nextBeat < horizon) {
      const roots = [45, 41, 43, 38];
      const root = roots[Math.floor(audio.step / 8) % roots.length];
      const pulse = audio.step % 8;
      const hurry = state.timeLeft < 30 ? 1.35 : 1;
      if (pulse % 2 === 0) playTone(root - 12, audio.nextBeat, 0.22 / hurry, 0.055, "triangle", audio.music);
      if (pulse === 2 || pulse === 6) playTone(root - 5, audio.nextBeat + 0.08, 0.12, 0.025, "square", audio.music);
      if (pulse === 0 || pulse === 4) {
        for (const offset of [0, 3, 7]) playTone(root + offset, audio.nextBeat, 0.48 / hurry, 0.024, "triangle", audio.music);
      }
      playTone(root + [12, 15, 19, 15, 10, 15, 17, 22][pulse], audio.nextBeat + 0.04, 0.13 / hurry, 0.022, pulse % 3 ? "triangle" : "sawtooth", audio.music);
      audio.nextBeat += (state.timeLeft < 30 ? 0.29 : 0.36);
      audio.step += 1;
    }
  }

  function playSweep(start, end, duration, volume, type) {
    if (!audio.context) return;
    const now = audio.context.currentTime;
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(start, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(end, 30), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(audio.sfx);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  function playTone(midi, time, duration, volume, type, destination) {
    const osc = audio.context.createOscillator();
    const gain = audio.context.createGain();
    osc.type = type;
    osc.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(volume, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(gain);
    gain.connect(destination);
    osc.start(time);
    osc.stop(time + duration + 0.04);
  }

  function pulseDevice(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function removeBullet(index) {
    root.remove(bullets[index].mesh);
    bullets.splice(index, 1);
  }

  function connectOnline() {
    const hostedWsUrl = "wss://speedy-jumper.onrender.com";
    const baseWsUrl = location.protocol === "file:"
      || isNativeIos
      ? hostedWsUrl
      : `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`;
    const wsUrl = `${baseWsUrl}?playerId=${encodeURIComponent(net.playerId)}`;
    const ws = new WebSocket(wsUrl);
    net.ws = ws;
    ws.addEventListener("open", () => {
      if (mode.type === "ai") return;
      net.connected = true;
      state.message = "Online server connected";
      updateUi();
    });
    ws.addEventListener("close", () => {
      if (mode.type === "ai") return;
      net.connected = false;
      net.peer = false;
      net.ready = false;
      net.role = "pending";
      state.message = "Connection lost; retrying";
      setTimeout(connectOnline, 1800);
    });
    ws.addEventListener("message", (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      onMessage(msg);
    });
  }

  function onMessage(msg) {
    if (mode.type === "ai") return;
    if (msg.type === "welcome") {
      net.role = ["p1", "p2", "spectator"].includes(msg.role) ? msg.role : "pending";
      players.p1.remote = net.role !== "p1";
      players.p2.remote = net.role !== "p2";
      if (players[net.role]) {
        cameraState.forward.copy(players[net.role].forward);
      }
      updatePresence(msg.players || [], msg.ready);
    } else if (msg.type === "presence") {
      updatePresence(msg.players || [], msg.ready);
    } else if (msg.type === "state" && msg.from !== net.role) {
      const player = players[msg.from];
      if (player) player.target = unpackState(msg.state);
      if (msg.state?.scores) Object.assign(scores, msg.state.scores);
      if (msg.state?.timeLeft !== undefined && msg.from === "p1") state.timeLeft = Number(msg.state.timeLeft);
    } else if (msg.type === "shot" && msg.from !== net.role) {
      shoot(unpack(msg.origin), unpack(msg.direction).normalize(), 72, msg.from, msg.color || 0xffffff);
    } else if (msg.type === "damage" && msg.target !== net.role) {
      const player = players[msg.target];
      if (player) {
        player.health = msg.health;
        player.alive = msg.health > 0;
      }
      if (msg.scores) Object.assign(scores, msg.scores);
    } else if (msg.type === "enemy-down") {
      const enemy = enemies[msg.index];
      if (enemy && !enemy.dead) {
        enemy.dead = true;
        root.remove(enemy.mesh);
        scores[msg.scorer] += 1;
      }
    } else if (msg.type === "enemy-spawn" && net.role !== "p1") {
      if (!enemies[msg.index]) spawnEnemy(msg.platform, msg.lat, msg.lon);
    } else if (msg.type === "restart") {
      resetGame(false);
    }
  }

  function sendState() {
    if (mode.type === "ai") return;
    if (!net.connected || !net.ready || !net.ws || net.ws.readyState !== WebSocket.OPEN || net.role === "pending" || net.role === "spectator") return;
    if (clock.elapsedTime - net.last < 1 / 15) return;
    const player = localPlayer();
    net.last = clock.elapsedTime;
    send({
      type: "state",
      state: {
        pos: pack(player.pos),
        up: pack(player.up),
        forward: pack(player.forward),
        health: player.health,
        alive: player.alive,
        scores,
        timeLeft: state.timeLeft,
      },
    });
  }

  function send(payload) {
    if (net.ws?.readyState === WebSocket.OPEN) net.ws.send(JSON.stringify(payload));
  }

  function updatePresence(list, serverReady = false) {
    if (mode.type === "ai") return;
    const blueCount = list.filter((item) => item.role === "p1").length;
    const yellowCount = list.filter((item) => item.role === "p2").length;
    const bothRolesOnline = blueCount === 1 && yellowCount === 1;
    net.ready = Boolean(bothRolesOnline && serverReady && (net.role === "p1" || net.role === "p2"));
    net.peer = Boolean(net.ready);
    if (!net.ready && !state.ended) {
      state.started = false;
      input.fire = false;
      state.message = net.role === "spectator" ? "Spectator mode" : "Waiting for both players";
      if (net.role !== "spectator") {
        showOverlay("Waiting for Rival", "The match starts only after both blue and yellow players are online.");
      }
    }
    updateUi();
  }

  function getPlayerId() {
    const key = "speedy-jumper-player-id";
    const makeId = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    try {
      const existing = localStorage.getItem(key);
      if (existing) return existing;
      const created = makeId();
      localStorage.setItem(key, created);
      return created;
    } catch {
      return makeId();
    }
  }

  function readNumber(key) {
    try {
      return Number(localStorage.getItem(key) || 0) || 0;
    } catch {
      return 0;
    }
  }

  function writeNumber(key, value) {
    try {
      localStorage.setItem(key, String(Math.max(0, Math.floor(value))));
    } catch {}
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function readDailyProgress() {
    try {
      const raw = JSON.parse(localStorage.getItem("speedy-jumper-daily-progress") || "{}");
      return raw.date === todayKey() ? Number(raw.value || 0) : 0;
    } catch {
      return 0;
    }
  }

  function writeDailyProgress(value) {
    try {
      localStorage.setItem("speedy-jumper-daily-progress", JSON.stringify({ date: todayKey(), value }));
    } catch {}
  }

  function readTodayFlag(key) {
    try {
      return localStorage.getItem(key) === todayKey();
    } catch {
      return false;
    }
  }

  function writeTodayFlag(key, value) {
    try {
      if (value) localStorage.setItem(key, todayKey());
    } catch {}
  }

  function getRank(score) {
    if (score >= 80) return "VOID ACE";
    if (score >= 50) return "ORBIT PRO";
    if (score >= 30) return "RIFT HUNTER";
    if (score >= 15) return "SPHERE PILOT";
    return "ROOKIE";
  }

  function updateUi() {
    const local = localPlayer();
    updateHealthDisplay(players.p1, p1HealthValue, p1HealthBar);
    updateHealthDisplay(players.p2, p2HealthValue, p2HealthBar);
    if (p1ScoreValue) p1ScoreValue.textContent = p1ScoreValue.id === "s1" ? `${scores.p1} points` : scores.p1;
    if (p2ScoreValue) p2ScoreValue.textContent = p2ScoreValue.id === "s2" ? `${scores.p2} points` : scores.p2;
    if (streakValue) streakValue.textContent = state.streak > 0 ? `x${state.streak}` : "0";
    if (bestScoreValue) bestScoreValue.textContent = `BEST ${state.bestScore}`;
    if (coinsValue) coinsValue.textContent = state.coins;
    if (rankValue) rankValue.textContent = getRank(state.bestScore);
    if (dailyMissionValue) dailyMissionValue.textContent = state.dailyClaimed ? "DONE" : `${state.dailyProgress}/${state.dailyTarget}`;
    if (dailyRewardValue) dailyRewardValue.textContent = state.dailyClaimed ? "COME BACK TOMORROW" : "+25 COINS";
    if (riftChargeValue) riftChargeValue.textContent = state.riftActive ? `${Math.ceil(state.riftTimer)}s` : `${state.riftCharge}%`;
    if (riftStateValue) {
      riftStateValue.textContent = state.riftActive
        ? "SURGE ACTIVE"
        : state.riftCharge >= 100
          ? "TAP SURGE"
          : "COLLECT SHARDS";
    }
    touchSurge?.classList.toggle("active", state.riftActive);
    touchSurge?.classList.toggle("ready", !state.riftActive && state.riftCharge >= 100);
    if (enemiesValue) enemiesValue.textContent = enemies.filter((enemy) => !enemy.dead).length;
    if (timerValue) timerValue.textContent = formatTime(state.timeLeft);
    const roleText = mode.type === "ai" ? "Solo vs AI" : net.role === "pending" ? "Connecting" : net.role === "spectator" ? "Spectator" : net.role === "p2" ? "Player 2" : "Player 1";
    const peer = mode.type === "ai" ? `Best streak ${state.bestStreak}` : net.ready ? "Rival online" : "Waiting for rival";
    const streak = state.streak > 1 ? ` | x${state.streak} streak` : "";
    if (statusValue) statusValue.textContent = `${state.message}${streak} | ${roleText} | ${peer}`;
    const healthRatio = local ? local.health / 100 : 0;
    if (topAlertFill) topAlertFill.style.transform = `scaleX(${THREE.MathUtils.clamp(healthRatio, 0, 1)})`;
    if (topAlertText) topAlertText.textContent = local ? `${local.label} ${Math.ceil(local.health)}` : "Spectator";
  }

  function updateHealthDisplay(player, valueEl, barEl) {
    const health = Math.ceil(THREE.MathUtils.clamp(player.health, 0, 100));
    if (valueEl) valueEl.textContent = health;
    if (!barEl) return;
    const ratio = health / 100;
    barEl.style.transform = `scaleX(${ratio})`;
    barEl.classList.toggle("low", ratio <= 0.35);
  }

  function formatTime(seconds) {
    const value = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
  }

  function showOverlay(title, note) {
    if (startButton) startButton.textContent = title;
    if (overlayNote) overlayNote.textContent = note;
    overlay.classList.add("visible");
    document.body.classList.add("overlay-open");
  }

  function hideOverlay() {
    overlay.classList.remove("visible");
    document.body.classList.remove("overlay-open");
  }

  function setMode(nextMode) {
    if (mode.type === nextMode) return;
    mode.type = nextMode;
    if (nextMode === "ai") {
      net.role = "p1";
      net.ready = true;
      net.peer = true;
      players.p1.remote = false;
      players.p2.remote = false;
      state.message = "Solo vs AI selected";
    } else {
      net.role = net.connected ? net.role : "pending";
      net.ready = false;
      net.peer = false;
      state.message = net.connected ? "Online selected" : "Connecting to server";
      connectOnline();
    }
    resetGame(false);
  }

  function localPlayer() {
    if (net.role === "pending" || net.role === "spectator") return null;
    return players[net.role] || null;
  }

  function remotePlayer() {
    if (net.role !== "p1" && net.role !== "p2") return null;
    return net.role === "p2" ? players.p1 : players.p2;
  }

  function nearestPlatform(pos) {
    return platforms.reduce((best, platform) =>
      pos.distanceTo(platform.center) - platform.radius < pos.distanceTo(best.center) - best.radius ? platform : best
    );
  }

  function spherical(lat, lon) {
    return new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).normalize();
  }

  function pack(v) {
    return { x: +v.x.toFixed(3), y: +v.y.toFixed(3), z: +v.z.toFixed(3) };
  }

  function unpack(v) {
    return new THREE.Vector3(Number(v?.x || 0), Number(v?.y || 0), Number(v?.z || 0));
  }

  function unpackState(stateValue) {
    return {
      pos: unpack(stateValue.pos),
      up: unpack(stateValue.up).normalize(),
      forward: unpack(stateValue.forward).normalize(),
      health: Number(stateValue.health || 0),
      alive: Boolean(stateValue.alive),
    };
  }

  function loadTexture(url, fallbackFactory, rx, ry) {
    const fallback = fallbackFactory();
    const texture = location.hostname.includes("onrender.com")
      ? fallback
      : loader.load(url, undefined, undefined, () => {
        texture.copy(fallback);
        texture.needsUpdate = true;
      });
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    return texture;
  }

  function sphereFallback(kind) {
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = 512;
    canvasTexture.height = 512;
    const ctx = canvasTexture.getContext("2d");
    const palettes = {
      ice: ["#35d9ff", "#0d6f90", "#bdf8ff"],
      lava: ["#19171d", "#ff3d12", "#ffbc4f"],
      emerald: ["#0f5e49", "#31d67c", "#073525"],
      amber: ["#8a5518", "#ffbe4a", "#4a2a08"],
    };
    const [base, glow, line] = palettes[kind] || palettes.ice;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 48; i += 1) {
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const r = 25 + Math.random() * 95;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, r);
      gradient.addColorStop(0, `${glow}cc`);
      gradient.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.72;
    for (let i = 0; i < 46; i += 1) {
      ctx.beginPath();
      ctx.moveTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.lineTo(Math.random() * 512, Math.random() * 512);
      ctx.stroke();
    }
    return new THREE.CanvasTexture(canvasTexture);
  }

  function skyFallback() {
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = 1024;
    canvasTexture.height = 512;
    const ctx = canvasTexture.getContext("2d");
    const gradient = ctx.createLinearGradient(0, 0, 1024, 512);
    gradient.addColorStop(0, "#071027");
    gradient.addColorStop(0.5, "#04172f");
    gradient.addColorStop(1, "#1b102c");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 512);
    for (let i = 0; i < 850; i += 1) {
      ctx.fillStyle = `rgba(230,248,255,${0.35 + Math.random() * 0.65})`;
      ctx.fillRect(Math.random() * 1024, Math.random() * 512, 1.3, 1.3);
    }
    for (const [x, y, color] of [[150, 230, "rgba(60,220,255,.34)"], [760, 120, "rgba(255,74,190,.28)"], [910, 360, "rgba(255,180,90,.25)"]]) {
      const nebula = ctx.createRadialGradient(x, y, 0, x, y, 250);
      nebula.addColorStop(0, color);
      nebula.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = nebula;
      ctx.fillRect(x - 250, y - 250, 500, 500);
    }
    return new THREE.CanvasTexture(canvasTexture);
  }

  document.addEventListener("keydown", (event) => {
    if (keys[event.code]) input[keys[event.code]] = true;
    if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
      input.jump = true;
      event.preventDefault();
    }
    if (event.code === "KeyE") activateRiftSurge();
    if (event.code === "Enter") input.fire = true;
  });

  document.addEventListener("keyup", (event) => {
    if (keys[event.code]) input[keys[event.code]] = false;
    if (event.code === "Enter") input.fire = false;
  });

  document.addEventListener("mousemove", (event) => {
    const player = localPlayer();
    if (!player || !state.started) return;
    cameraState.forward.applyQuaternion(quat.setFromAxisAngle(player.up, -event.movementX * 0.0026));
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    if (!state.started || state.ended) {
      startGame();
      return;
    }
    input.fire = true;
  });
  window.addEventListener("mouseup", () => {
    input.fire = false;
  });

  const bindPress = (button, onPress, onRelease) => {
    if (!button) return;
    let lastTouchPressAt = 0;
    button.addEventListener("click", (event) => {
      if (performance.now() - lastTouchPressAt < 500) {
        event.preventDefault();
        return;
      }
      onPress(event);
    });
    button.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") return;
      event.preventDefault();
      lastTouchPressAt = performance.now();
      onPress(event);
    });
    if (!onRelease) return;
    button.addEventListener("pointerup", onRelease);
    button.addEventListener("pointercancel", onRelease);
    button.addEventListener("pointerleave", onRelease);
  };

  bindPress(startButton, startGame);

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.clientX < innerWidth * 0.38) return;
    lookTouchId = event.pointerId;
    lookTouchX = event.clientX;
    startGame();
  });

  canvas.addEventListener("pointermove", (event) => {
    const player = localPlayer();
    if (event.pointerId !== lookTouchId || !player || !state.started) return;
    const dx = event.clientX - lookTouchX;
    lookTouchX = event.clientX;
    cameraState.forward.applyQuaternion(quat.setFromAxisAngle(player.up, -dx * 0.0052));
  });

  canvas.addEventListener("pointerup", (event) => {
    if (event.pointerId === lookTouchId) lookTouchId = null;
  });

  if (touchStick) {
    let stickPointerId = null;
    const resetTouchStick = () => {
      input.f = input.b = input.l = input.r = false;
      stickPointerId = null;
      if (touchStickKnob) touchStickKnob.style.transform = "translate(-50%, -50%)";
      touchStick.classList.remove("active");
    };
    const updateTouchStick = (point) => {
      const rect = touchStick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = point.clientX - cx;
      const dy = point.clientY - cy;
      const max = rect.width * 0.38;
      const len = Math.min(max, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      const nx = Math.cos(a) * len / max;
      const ny = Math.sin(a) * len / max;
      input.f = ny < -0.2;
      input.b = ny > 0.2;
      input.l = nx < -0.2;
      input.r = nx > 0.2;
      if (touchStickKnob) touchStickKnob.style.transform = `translate(calc(-50% + ${nx * max}px), calc(-50% + ${ny * max}px))`;
    };
    touchStick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      stickPointerId = event.pointerId;
      touchStick.setPointerCapture?.(event.pointerId);
      touchStick.classList.add("active");
      startGame();
      updateTouchStick(event);
    });
    touchStick.addEventListener("pointermove", (event) => {
      if (stickPointerId !== null && event.pointerId !== stickPointerId) return;
      event.preventDefault();
      updateTouchStick(event);
    });
    touchStick.addEventListener("pointerup", resetTouchStick);
    touchStick.addEventListener("pointercancel", resetTouchStick);
    touchStick.addEventListener("lostpointercapture", resetTouchStick);
    touchStick.addEventListener("touchstart", (event) => {
      event.preventDefault();
      touchStick.classList.add("active");
      startGame();
      updateTouchStick(event.touches[0]);
    }, { passive: false });
    touchStick.addEventListener("touchmove", (event) => {
      event.preventDefault();
      if (event.touches[0]) updateTouchStick(event.touches[0]);
    }, { passive: false });
    touchStick.addEventListener("touchend", resetTouchStick);
    touchStick.addEventListener("touchcancel", resetTouchStick);
  }
  bindPress(touchJump, () => {
    input.jump = true;
    startGame();
  });
  bindPress(touchSurge, () => {
    startGame();
    activateRiftSurge();
  });
  bindPress(touchFire, () => {
    input.fire = true;
    startGame();
  }, () => {
    input.fire = false;
  });

  function resizeRenderer() {
    const width = Math.round(visualViewport?.width || innerWidth);
    const height = Math.round(visualViewport?.height || innerHeight);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  addEventListener("resize", resizeRenderer);
  visualViewport?.addEventListener("resize", resizeRenderer);
  document.addEventListener("contextmenu", (event) => event.preventDefault());

  window.render_game_to_text = () => JSON.stringify({
    mode: state.ended ? "ended" : state.started ? "playing" : "menu",
    role: net.role,
    message: state.message,
    timeLeft: +state.timeLeft.toFixed(1),
    scores: { ...scores },
    streak: state.streak,
    coins: state.coins,
    matchCoins: state.matchCoins,
    riftCharge: state.riftCharge,
    riftActive: state.riftActive,
    riftShards: riftShards.length,
    dailyProgress: state.dailyProgress,
    dailyClaimed: state.dailyClaimed,
    rank: getRank(state.bestScore),
    bestScore: state.bestScore,
    bestStreak: state.bestStreak,
    player: localPlayer() ? {
      x: +localPlayer().pos.x.toFixed(2),
      y: +localPlayer().pos.y.toFixed(2),
      z: +localPlayer().pos.z.toFixed(2),
      health: Math.ceil(localPlayer().health),
      grounded: localPlayer().grounded,
    } : null,
    enemiesRemaining: enemies.filter((enemy) => !enemy.dead).length,
    bullets: bullets.length,
    peer: net.peer,
    ready: net.ready,
  });

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / 16.67));
    for (let i = 0; i < steps; i += 1) update(1 / 60);
    renderer.render(scene, camera);
  };
})();
