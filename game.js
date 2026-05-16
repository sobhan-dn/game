import * as THREE from "./node_modules/three/build/three.module.js";

(() => {
  const canvas = document.getElementById("game");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("start-button");
  const overlayNote = document.getElementById("overlay-note");
  const p1HealthValue = document.getElementById("p1-health");
  const p2HealthValue = document.getElementById("p2-health");
  const p1ScoreValue = document.getElementById("p1-score");
  const p2ScoreValue = document.getElementById("p2-score");
  const enemiesValue = document.getElementById("enemies");
  const statusValue = document.getElementById("status");
  const topAlertFill = document.getElementById("top-alert-fill");
  const topAlertText = document.getElementById("top-alert-text");
  const touchStick = document.getElementById("touch-stick");
  const touchStickKnob = document.getElementById("touch-stick-knob");
  const touchJump = document.getElementById("touch-jump");
  const touchFire = document.getElementById("touch-fire");

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x06101a, 0.012);
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.1, 600);
  const root = new THREE.Group();
  scene.add(root);

  const clock = new THREE.Clock();
  const loader = new THREE.TextureLoader();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const quat = new THREE.Quaternion();

  const input = { f: false, b: false, l: false, r: false, jump: false, fire: false };
  const net = { ws: null, role: "p1", connected: false, peer: false, last: 0 };
  const state = { started: false, ended: false, message: "برای شروع کلیک کنید" };
  const scores = { p1: 0, p2: 0 };

  const players = {
    p1: makePlayer("p1", "بازیکن ۱", 0x65f7df, 0x5ef5ff),
    p2: makePlayer("p2", "بازیکن ۲", 0xffbd57, 0xff8a25),
  };
  const platforms = [];
  const enemies = [];
  const bullets = [];
  const effects = [];

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
  connectOnline();
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
    for (const item of [...platforms, ...enemies, ...bullets, ...effects]) root.remove(item.mesh || item.group);
    platforms.length = 0;
    enemies.length = 0;
    bullets.length = 0;
    effects.length = 0;
    scores.p1 = 0;
    scores.p2 = 0;
    state.started = false;
    state.ended = false;
    state.message = "برای شروع کلیک کنید";
    document.body.classList.remove("game-over", "target-locked");
    createPlatforms();
    placePlayer(players.p1, platforms[0], new THREE.Vector3(0, 1, 0));
    placePlayer(players.p2, platforms[0], new THREE.Vector3(0.45, 0.88, 0.12).normalize());
    createEnemies();
    showOverlay("شروع بازی", "دو مرورگر باز کن؛ نفر اول بازیکن ۱ و نفر دوم بازیکن ۲ می‌شود.");
    updateCamera(0.016);
    updateUi();
    if (broadcast) send({ type: "restart" });
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

  function createEnemies() {
    const slots = [[1, 0.2, 1], [2, -0.2, 2.4], [3, 0.1, 4], [4, -0.3, 1.5], [5, 0.2, 4.8], [6, -0.1, 2.8]];
    for (const [platformIndex, lat, lon] of slots) {
      const mesh = makeEnemyMesh();
      root.add(mesh);
      enemies.push({
        mesh,
        platform: platforms[platformIndex],
        lat,
        lon,
        health: 60,
        cooldown: 0.8 + Math.random(),
        pos: new THREE.Vector3(),
        up: new THREE.Vector3(0, 1, 0),
        dead: false,
      });
    }
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
    syncMesh(player);
  }

  function startGame() {
    if (state.ended) {
      resetGame(true);
    }
    state.started = true;
    state.message = "رقابت شروع شد";
    hideOverlay();
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
      updatePlayer(local, dt);
      updateRemotePlayer(remotePlayer(), dt);
      updateEnemies(dt);
      updateBullets(dt);
      sendState();
    }
    updateEffects(dt);
    updateCamera(dt);
    updateUi();
  }

  function updatePlayer(player, dt) {
    if (!player || !player.alive) return;
    player.cooldown = Math.max(0, player.cooldown - dt);
    player.invuln = Math.max(0, (player.invuln || 0) - dt);
    if (player.grounded && player.platform) player.pos.add(player.platform.delta);

    const platform = nearestPlatform(player.pos);
    const desiredUp = tmp.copy(player.pos).sub(platform.center).normalize();
    player.up.lerp(desiredUp, 1 - Math.exp(-12 * dt)).normalize();
    const forward = tmp2.copy(camera.getWorldDirection(new THREE.Vector3())).projectOnPlane(player.up);
    if (forward.lengthSq() < 0.001) forward.copy(player.forward);
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
    tangent.addScaledVector(move, (player.grounded ? 70 : 24) * dt);
    if (tangent.length() > 24) tangent.setLength(24);
    if (player.grounded) tangent.multiplyScalar(Math.exp(-2.7 * dt));
    player.vel.copy(tangent).addScaledVector(player.up, normalSpeed);

    if (input.jump && player.grounded) {
      player.vel.addScaledVector(player.up, 18);
      player.vel.addScaledVector(move.lengthSq() ? move : forward, 11);
      player.grounded = false;
      spawnEffect(player.pos, player.color, 0.35);
    }
    input.jump = false;
    player.vel.addScaledVector(player.up, -31 * dt);
    player.pos.addScaledVector(player.vel, dt);
    landPlayer(player);

    if (input.fire && player.cooldown <= 0) fire(player);
    const face = move.lengthSq() > 0.01 ? move : forward;
    player.forward.copy(face);
    syncMesh(player);
    if (player.pos.length() > 230 || player.pos.y < -90) damagePlayer(player, 100, null);
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
      if (Math.abs(dist - surface) < 0.45 && player.vel.dot(normal) < 8) {
        player.grounded = true;
        player.platform = platform;
        player.up.copy(normal);
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
          removeBullet(i);
        }
        continue;
      }
      for (let e = 0; e < enemies.length; e += 1) {
        const enemy = enemies[e];
        if (!enemy.dead && bullet.pos.distanceTo(enemy.pos) < 1.25) {
          enemy.health -= 34;
          spawnEffect(enemy.pos, bullet.color, 0.36);
          if (enemy.health <= 0) {
            enemy.dead = true;
            root.remove(enemy.mesh);
            scores[bullet.owner] += 1;
            send({ type: "enemy-down", index: e, scorer: bullet.owner });
            if (enemies.every((item) => item.dead)) finishByScore("همه دشمن‌ها حذف شدند.");
          }
          removeBullet(i);
          break;
        }
      }
      const other = players[bullet.owner === "p1" ? "p2" : "p1"];
      if (other.id === net.role && other.alive && bullet.pos.distanceTo(other.pos) < 1.1) {
        damagePlayer(other, 20, bullet.owner);
        removeBullet(i);
      }
    }
  }

  function fire(player) {
    const direction = camera.getWorldDirection(new THREE.Vector3()).normalize();
    const muzzle = player.pos.clone().addScaledVector(player.up, 0.72).addScaledVector(player.forward, 1.0);
    shoot(muzzle, direction, 72, player.id, player.bulletColor);
    player.cooldown = 0.15;
    send({ type: "shot", origin: pack(muzzle), direction: pack(direction), color: player.bulletColor });
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
    if (player.id === net.role) send({ type: "damage", target: player.id, health: player.health, source });
    if (player.health <= 0) {
      player.alive = false;
      if (source === "p1" || source === "p2") scores[source] += 3;
      finishByScore(`${player.label} حذف شد.`);
    }
  }

  function finishByScore(reason) {
    state.ended = true;
    input.fire = false;
    const winner = scores.p1 === scores.p2 ? "مساوی" : scores.p1 > scores.p2 ? "بازیکن ۱" : "بازیکن ۲";
    state.message = `${reason} نتیجه: ${winner}`;
    showOverlay("شروع دوباره", state.message);
    document.body.classList.add("game-over");
  }

  function updateCamera(dt) {
    const player = localPlayer() || players.p1;
    const up = player.up.clone().normalize();
    const forward = player.forward.clone().projectOnPlane(up).normalize();
    const target = player.pos.clone().addScaledVector(up, 2.3).addScaledVector(forward, 1.5);
    const desired = target.clone().addScaledVector(forward, -13).addScaledVector(up, 4);
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

  function removeBullet(index) {
    root.remove(bullets[index].mesh);
    bullets.splice(index, 1);
  }

  function connectOnline() {
    const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}`);
    net.ws = ws;
    ws.addEventListener("open", () => {
      net.connected = true;
      state.message = "به سرور آنلاین وصل شدی";
      updateUi();
    });
    ws.addEventListener("close", () => {
      net.connected = false;
      net.peer = false;
      state.message = "اتصال قطع شد؛ تلاش مجدد";
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
    if (msg.type === "welcome") {
      net.role = msg.role === "p2" || msg.role === "spectator" ? msg.role : "p1";
      if (net.role === "p2") {
        players.p1.remote = true;
        players.p2.remote = false;
      }
      updatePresence(msg.players || []);
    } else if (msg.type === "presence") {
      updatePresence(msg.players || []);
    } else if (msg.type === "state" && msg.from !== net.role) {
      const player = players[msg.from];
      if (player) player.target = unpackState(msg.state);
      if (msg.state?.scores) Object.assign(scores, msg.state.scores);
    } else if (msg.type === "shot" && msg.from !== net.role) {
      shoot(unpack(msg.origin), unpack(msg.direction).normalize(), 72, msg.from, msg.color || 0xffffff);
    } else if (msg.type === "damage" && msg.target !== net.role) {
      const player = players[msg.target];
      if (player) {
        player.health = msg.health;
        player.alive = msg.health > 0;
      }
    } else if (msg.type === "enemy-down") {
      const enemy = enemies[msg.index];
      if (enemy && !enemy.dead) {
        enemy.dead = true;
        root.remove(enemy.mesh);
        scores[msg.scorer] += 1;
      }
    } else if (msg.type === "restart") {
      resetGame(false);
    }
  }

  function sendState() {
    if (!net.connected || !net.ws || net.ws.readyState !== WebSocket.OPEN || net.role === "spectator") return;
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
      },
    });
  }

  function send(payload) {
    if (net.ws?.readyState === WebSocket.OPEN) net.ws.send(JSON.stringify(payload));
  }

  function updatePresence(list) {
    net.peer = list.some((item) => item.role !== net.role && (item.role === "p1" || item.role === "p2"));
    updateUi();
  }

  function updateUi() {
    const local = localPlayer();
    p1HealthValue.textContent = Math.ceil(players.p1.health);
    p2HealthValue.textContent = Math.ceil(players.p2.health);
    p1ScoreValue.textContent = scores.p1;
    p2ScoreValue.textContent = scores.p2;
    enemiesValue.textContent = enemies.filter((enemy) => !enemy.dead).length;
    const roleText = net.role === "spectator" ? "تماشاگر" : net.role === "p2" ? "بازیکن ۲" : "بازیکن ۱";
    const peer = net.peer ? "رقیب وصل است" : "منتظر رقیب";
    statusValue.textContent = `${state.message} | ${roleText} | ${peer}`;
    const healthRatio = local ? local.health / 100 : 0;
    topAlertFill.style.transform = `scaleX(${THREE.MathUtils.clamp(healthRatio, 0, 1)})`;
    topAlertText.textContent = local ? `${local.label} ${Math.ceil(local.health)}` : "تماشاگر";
  }

  function showOverlay(title, note) {
    startButton.textContent = title;
    overlayNote.textContent = note;
    overlay.classList.add("visible");
    document.body.classList.add("overlay-open");
  }

  function hideOverlay() {
    overlay.classList.remove("visible");
    document.body.classList.remove("overlay-open");
  }

  function localPlayer() {
    if (net.role === "spectator") return null;
    return players[net.role] || players.p1;
  }

  function remotePlayer() {
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
    const texture = fallbackFactory();
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(rx, ry);
    loader.load(url, (loaded) => {
      texture.image = loaded.image;
      texture.needsUpdate = true;
    });
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
    if (event.code === "Enter") input.fire = true;
  });

  document.addEventListener("keyup", (event) => {
    if (keys[event.code]) input[keys[event.code]] = false;
    if (event.code === "Enter") input.fire = false;
  });

  document.addEventListener("mousemove", (event) => {
    const player = localPlayer();
    if (!player || !state.started) return;
    player.forward.applyQuaternion(quat.setFromAxisAngle(player.up, -event.movementX * 0.0026));
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
  startButton.addEventListener("click", startGame);

  if (touchStick) {
    touchStick.addEventListener("pointermove", (event) => {
      const rect = touchStick.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const max = rect.width * 0.38;
      const len = Math.min(max, Math.hypot(dx, dy));
      const a = Math.atan2(dy, dx);
      const nx = Math.cos(a) * len / max;
      const ny = Math.sin(a) * len / max;
      input.f = ny < -0.2;
      input.b = ny > 0.2;
      input.l = nx < -0.2;
      input.r = nx > 0.2;
      touchStickKnob.style.transform = `translate(calc(-50% + ${nx * max}px), calc(-50% + ${ny * max}px))`;
    });
    touchStick.addEventListener("pointerup", () => {
      input.f = input.b = input.l = input.r = false;
      touchStickKnob.style.transform = "translate(-50%, -50%)";
    });
  }
  touchJump?.addEventListener("pointerdown", () => {
    input.jump = true;
    startGame();
  });
  touchFire?.addEventListener("pointerdown", () => {
    input.fire = true;
    startGame();
  });
  touchFire?.addEventListener("pointerup", () => {
    input.fire = false;
  });

  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  window.render_game_to_text = () => JSON.stringify({
    mode: state.ended ? "ended" : state.started ? "playing" : "menu",
    role: net.role,
    message: state.message,
    player: localPlayer() ? {
      x: +localPlayer().pos.x.toFixed(2),
      y: +localPlayer().pos.y.toFixed(2),
      z: +localPlayer().pos.z.toFixed(2),
      health: Math.ceil(localPlayer().health),
      grounded: localPlayer().grounded,
    } : null,
    enemiesRemaining: enemies.filter((enemy) => !enemy.dead).length,
    bullets: bullets.length,
  });

  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / 16.67));
    for (let i = 0; i < steps; i += 1) update(1 / 60);
    renderer.render(scene, camera);
  };
})();
