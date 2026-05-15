import * as THREE from "./node_modules/three/build/three.module.js";
import { FBXLoader } from "./node_modules/three/examples/jsm/loaders/FBXLoader.js";
import * as SkeletonUtils from "./node_modules/three/examples/jsm/utils/SkeletonUtils.js";

(function () {
  const canvas = document.getElementById("game");
  const overlay = document.getElementById("overlay");
  const startButton = document.getElementById("start-button");
  const overlayNote = document.getElementById("overlay-note");
  const touchStick = document.getElementById("touch-stick");
  const touchStickKnob = document.getElementById("touch-stick-knob");
  const touchJump = document.getElementById("touch-jump");
  const touchFire = document.getElementById("touch-fire");
  const topAlertFill = document.getElementById("top-alert-fill");
  const topAlertText = document.getElementById("top-alert-text");
  const healthValue = document.getElementById("health");
  const enemiesValue = document.getElementById("enemies");
  const statusValue = document.getElementById("status");

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050a13);
  scene.fog = new THREE.FogExp2(0x06101a, 0.014);

  const clock = new THREE.Clock();
  const textureLoader = new THREE.TextureLoader();
  const fbxLoader = new FBXLoader();
  const playfieldRoot = new THREE.Group();
  scene.add(playfieldRoot);

  const sphereTextureUrls = [
    "./assets/textures/sphere-ice.png",
    "./assets/textures/sphere-lava.png",
    "./assets/textures/sphere-emerald.png",
    "./assets/textures/sphere-amber.png",
  ];
  const sphereTextures = sphereTextureUrls.map((url) => {
    const texture = textureLoader.load(url);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.8, 1.8);
    texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return texture;
  });
  const cosmicTexture = textureLoader.load("./assets/textures/cosmic-bg.png");
  cosmicTexture.colorSpace = THREE.SRGBColorSpace;
  cosmicTexture.wrapS = THREE.RepeatWrapping;
  cosmicTexture.wrapT = THREE.ClampToEdgeWrapping;

  const tmpVecA = new THREE.Vector3();
  const tmpVecB = new THREE.Vector3();
  const tmpVecC = new THREE.Vector3();
  const tmpVecD = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();
  const tmpMatrix = new THREE.Matrix4();

  const CONFIG = {
    playerRadius: 0.9,
    gravity: 32,
    groundAccel: 82,
    airAccel: 30,
    maxGroundSpeed: 26,
    maxAirSpeed: 30,
    groundDrag: 2.6,
    jumpSpeed: 18.6,
    jumpForwardBoost: 12.8,
    jumpAssistRange: 46,
    jumpAssistDot: 0.12,
    jumpAssistStrength: 14.8,
    jumpMagnetism: 21,
    coyoteTime: 0.2,
    landingSnapDistance: 0.52,
    landingMaxSpeed: 9.4,
    playerBulletSpeed: 72,
    enemyBulletSpeed: 35,
    playerFireDelay: 0.13,
    enemyFireDelay: 1.15,
    bulletLifetime: 2.8,
    bulletColor: 0xff2a2a,
    playerBulletRadius: 0.28,
    enemyBulletRadius: 0.22,
    playerHitPadding: 0.44,
    aimAssistDot: 0.92,
    aimAssistBlend: 0.72,
    lockAimDot: 0.95,
    playerBulletHoming: 12,
    cameraDistance: 12.6,
    cameraHeight: 2.55,
    cameraLookAhead: 2.2,
    cameraLag: 9,
    cameraBaseFov: 68,
    cameraBoostFov: 11,
    playerHealth: 100,
  };

  const camera = new THREE.PerspectiveCamera(
    CONFIG.cameraBaseFov,
    window.innerWidth / window.innerHeight,
    0.1,
    500
  );

  const input = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    jumpQueued: false,
    shootHeld: false,
  };

  const touchState = {
    stickPointer: null,
    lookPointer: null,
    lookX: 0,
    lookY: 0,
  };

  const cameraState = {
    forward: new THREE.Vector3(1, 0, 0),
    pitch: 0.12,
  };

  const state = {
    started: false,
    ended: false,
    message: "برای شروع کلیک کنید",
    lockedEnemy: null,
    totalEnemies: 0,
  };

  const world = {
    platforms: [],
    enemies: [],
    bullets: [],
    effects: [],
    player: null,
    time: 0,
    decor: null,
  };

  const modelAssets = {
    loaded: false,
    root: null,
    clips: {},
  };

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const audio = {
    context: null,
    ready: false,
    compressor: null,
    masterGain: null,
    musicGain: null,
    sfxGain: null,
    nextMusicTime: 0,
    musicStep: 0,
  };

  function initScene() {
    const hemisphere = new THREE.HemisphereLight(0xb8e7ff, 0x08131d, 1.15);
    scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff3d1, 1.5);
    sun.position.set(22, 34, 18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 120;
    sun.shadow.bias = -0.0008;
    scene.add(sun);

    const fill = new THREE.PointLight(0x3ad5f0, 55, 180, 2);
    fill.position.set(-12, 18, -18);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0x6ff7dd, 0.9);
    rim.position.set(-26, 14, -24);
    scene.add(rim);

    const skyGlow = new THREE.Mesh(
      new THREE.SphereGeometry(168, 72, 36),
      new THREE.MeshBasicMaterial({
        map: cosmicTexture,
        color: 0x92ddff,
        transparent: true,
        opacity: 0.92,
        side: THREE.BackSide,
        fog: false,
      })
    );
    skyGlow.rotation.y = Math.PI * 0.2;
    scene.add(skyGlow);

    const starsGeometry = new THREE.BufferGeometry();
    const starCount = 2600;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i += 1) {
      const radius = 110 + Math.random() * 140;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      positions[i * 3] = Math.sin(phi) * Math.cos(theta) * radius;
      positions[i * 3 + 1] = Math.cos(phi) * radius;
      positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * radius;
    }
    starsGeometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3)
    );
    const stars = new THREE.Points(
      starsGeometry,
      new THREE.PointsMaterial({
        color: 0xf2fbff,
        size: 0.75,
        transparent: true,
        opacity: 0.88,
        sizeAttenuation: true,
      })
    );
    scene.add(stars);

    createSceneDecor();
  }

  function createSceneDecor() {
    const coolGlow = createGlowTexture("#7ff9e4", "#102845");
    const warmGlow = createGlowTexture("#ffc47b", "#3d1f16");

    const nebulaDefinitions = [
      {
        texture: coolGlow,
        color: 0x7ff9e4,
        position: new THREE.Vector3(-48, 26, -54),
        scale: 56,
        amplitude: 2.4,
        speed: 0.22,
        opacity: 0.22,
      },
      {
        texture: warmGlow,
        color: 0xffbf76,
        position: new THREE.Vector3(52, 38, -34),
        scale: 44,
        amplitude: 1.8,
        speed: 0.18,
        opacity: 0.16,
      },
      {
        texture: coolGlow,
        color: 0x66cfff,
        position: new THREE.Vector3(14, -8, -68),
        scale: 70,
        amplitude: 3.2,
        speed: 0.12,
        opacity: 0.12,
      },
    ];

    const nebulae = nebulaDefinitions.map((definition, index) => {
      const material = new THREE.SpriteMaterial({
        map: definition.texture,
        color: definition.color,
        transparent: true,
        opacity: definition.opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const sprite = new THREE.Sprite(material);
      sprite.position.copy(definition.position);
      sprite.scale.setScalar(definition.scale);
      scene.add(sprite);
      return {
        sprite,
        basePosition: definition.position.clone(),
        amplitude: definition.amplitude,
        speed: definition.speed,
        opacity: definition.opacity,
        phase: index * 1.7,
      };
    });

    const aurora = new THREE.Mesh(
      new THREE.TorusGeometry(92, 18, 24, 160),
      new THREE.MeshBasicMaterial({
        color: 0x123b63,
        transparent: true,
        opacity: 0.1,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    aurora.rotation.set(1.08, 0.24, 0.3);
    scene.add(aurora);

    const dustCount = 1800;
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i += 1) {
      const radius = 36 + Math.random() * 90;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(THREE.MathUtils.randFloatSpread(2));
      const x = Math.sin(phi) * Math.cos(theta) * radius;
      const y = Math.cos(phi) * radius * 0.75;
      const z = Math.sin(phi) * Math.sin(theta) * radius;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      const tint = i % 5 === 0 ? [0.68, 0.92, 1] : [0.6, 0.95, 0.86];
      colors[i * 3] = tint[0];
      colors[i * 3 + 1] = tint[1];
      colors[i * 3 + 2] = tint[2];
    }

    const dustGeometry = new THREE.BufferGeometry();
    dustGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    dustGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({
        size: 0.9,
        vertexColors: true,
        transparent: true,
        opacity: 0.42,
        sizeAttenuation: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    scene.add(dust);

    world.decor = {
      nebulae,
      aurora,
      dust,
    };
  }

  function createGlowTexture(innerColor, outerColor) {
    const canvasTexture = document.createElement("canvas");
    canvasTexture.width = 256;
    canvasTexture.height = 256;
    const ctx = canvasTexture.getContext("2d");
    const gradient = ctx.createRadialGradient(128, 128, 14, 128, 128, 128);
    gradient.addColorStop(0, innerColor);
    gradient.addColorStop(0.42, outerColor);
    gradient.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);

    const texture = new THREE.CanvasTexture(canvasTexture);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function updateSceneDecor(deltaTime) {
    if (!world.decor) {
      return;
    }

    const { nebulae, aurora, dust } = world.decor;
    for (const nebula of nebulae) {
      const bob = Math.sin(world.time * nebula.speed + nebula.phase);
      nebula.sprite.position.y = nebula.basePosition.y + bob * nebula.amplitude;
      nebula.sprite.material.opacity = nebula.opacity + bob * 0.035;
    }

    aurora.rotation.z += deltaTime * 0.045;
    aurora.rotation.x = 1.08 + Math.sin(world.time * 0.18) * 0.08;
    aurora.material.opacity = 0.08 + Math.sin(world.time * 0.7) * 0.025;

    dust.rotation.y += deltaTime * 0.015;
    dust.rotation.x += deltaTime * 0.004;
  }

  function ensureAudio() {
    if (!AudioContextClass) {
      return;
    }

    if (!audio.context) {
      const context = new AudioContextClass();
      const compressor = context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 12;
      compressor.ratio.value = 10;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.22;

      const masterGain = context.createGain();
      masterGain.gain.value = 0.72;

      const musicGain = context.createGain();
      musicGain.gain.value = 0.18;

      const sfxGain = context.createGain();
      sfxGain.gain.value = 0.34;

      musicGain.connect(compressor);
      sfxGain.connect(compressor);
      compressor.connect(masterGain);
      masterGain.connect(context.destination);

      audio.context = context;
      audio.compressor = compressor;
      audio.masterGain = masterGain;
      audio.musicGain = musicGain;
      audio.sfxGain = sfxGain;
      audio.nextMusicTime = context.currentTime + 0.08;
      audio.musicStep = 0;
      audio.ready = true;
    }

    if (audio.context.state === "suspended") {
      audio.context.resume();
    }
  }

  function updateAudio() {
    if (!audio.context || audio.context.state !== "running") {
      return;
    }

    if (!state.started) {
      return;
    }

    const horizon = audio.context.currentTime + 0.9;
    while (audio.nextMusicTime < horizon) {
      scheduleMusicStep(audio.nextMusicTime, audio.musicStep);
      audio.nextMusicTime += 0.46;
      audio.musicStep += 1;
    }
  }

  function scheduleMusicStep(time, step) {
    const rootSequence = [45, 41, 43, 38];
    const root = rootSequence[Math.floor(step / 8) % rootSequence.length];
    const pulse = step % 8;
    const leadPattern = [12, 15, 19, 15, 10, 15, 17, 22];

    if (pulse % 2 === 0) {
      scheduleVoice(root - 12, time, 0.36, 0.06, "triangle", audio.musicGain, {
        attack: 0.01,
        release: 0.2,
        detune: -4,
      });
    }

    if (pulse === 0 || pulse === 4) {
      scheduleChord(root, time, 1.28, 0.028, [0, 3, 7], "triangle");
    }

    scheduleVoice(
      root + leadPattern[pulse],
      time + 0.06,
      0.26,
      0.028,
      pulse % 3 === 0 ? "sawtooth" : "triangle",
      audio.musicGain,
      {
        attack: 0.012,
        release: 0.12,
        filterStart: 2100,
        filterEnd: 900,
      }
    );
  }

  function scheduleChord(rootMidi, time, duration, volume, intervals, type) {
    for (const interval of intervals) {
      scheduleVoice(rootMidi + interval, time, duration, volume, type, audio.musicGain, {
        attack: 0.16,
        release: 0.5,
        detune: interval === 7 ? 3 : -2,
        filterStart: 1200,
        filterEnd: 640,
      });
    }
  }

  function scheduleVoice(
    midi,
    startTime,
    duration,
    volume,
    waveType,
    output,
    options = {}
  ) {
    if (!audio.context || !output) {
      return;
    }

    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    const filter = audio.context.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = options.filterStart || 1800;
    filter.Q.value = 0.8;

    oscillator.type = waveType;
    oscillator.frequency.value = midiToFrequency(midi);
    oscillator.detune.value = options.detune || 0;

    const attack = options.attack || 0.01;
    const release = options.release || 0.18;
    const sustainEnd = startTime + duration;

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, sustainEnd + release);

    if (options.filterEnd) {
      filter.frequency.setValueAtTime(options.filterStart || 1800, startTime);
      filter.frequency.exponentialRampToValueAtTime(
        options.filterEnd,
        sustainEnd + release
      );
    }

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(output);
    oscillator.start(startTime);
    oscillator.stop(sustainEnd + release + 0.02);
  }

  function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  function makeIdleClip() {
    return new THREE.AnimationClip("idle", 1, []);
  }

  function removeHorizontalRootMotion(sourceClip) {
    if (!sourceClip) {
      return sourceClip;
    }

    const clip = sourceClip.clone();
    let rootTrack = null;
    let largestRange = 0;

    clip.tracks.forEach((track) => {
      if (!track.name.endsWith(".position") || track.getValueSize() !== 3) {
        return;
      }
      const values = track.values;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (let i = 0; i < values.length; i += 3) {
        minX = Math.min(minX, values[i]);
        maxX = Math.max(maxX, values[i]);
        minZ = Math.min(minZ, values[i + 2]);
        maxZ = Math.max(maxZ, values[i + 2]);
      }
      const range = Math.hypot(maxX - minX, maxZ - minZ);
      if (range > largestRange) {
        largestRange = range;
        rootTrack = track;
      }
    });

    if (rootTrack && largestRange > 0.08) {
      const values = rootTrack.values;
      const baseX = values[0];
      const baseZ = values[2];
      for (let i = 0; i < values.length; i += 3) {
        values[i] = baseX;
        values[i + 2] = baseZ;
      }
    }

    return clip;
  }

  async function loadModelAssets() {
    try {
      const [model, walking, jumping, punching, uppercut] = await Promise.all([
        fbxLoader.loadAsync("./assets/models/The Boss.fbx"),
        fbxLoader.loadAsync("./assets/models/Walking.fbx"),
        fbxLoader.loadAsync("./assets/models/Jumping Up.fbx"),
        fbxLoader.loadAsync("./assets/models/Zombie Punching.fbx"),
        fbxLoader.loadAsync("./assets/models/Uppercut.fbx"),
      ]);

      model.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.frustumCulled = false;
          if (child.material) {
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            for (const material of materials) {
              material.roughness = Math.min(material.roughness ?? 0.5, 0.42);
              material.metalness = Math.max(material.metalness ?? 0, 0.22);
            }
          }
        }
      });

      modelAssets.root = model;
      modelAssets.clips = {
        idle: makeIdleClip(),
        walk: removeHorizontalRootMotion(walking.animations[0]),
        jump: removeHorizontalRootMotion(jumping.animations[0]),
        punch: removeHorizontalRootMotion(punching.animations[0]),
        uppercut: removeHorizontalRootMotion(uppercut.animations[0]),
      };
      modelAssets.loaded = true;
      resetGame();
    } catch (error) {
      console.error("FBX loading failed", error);
      state.message = "مدل FBX لود نشد؛ نسخه سبک بازی فعال است";
      updateUi();
    }
  }

  function createAnimatedModel(isEnemy) {
    if (!modelAssets.loaded || !modelAssets.root) {
      return null;
    }

    const root = SkeletonUtils.clone(modelAssets.root);
    root.scale.setScalar(isEnemy ? 0.019 : 0.0215);
    root.position.y = isEnemy ? -0.92 : -0.96;
    root.rotation.y = Math.PI;
    root.traverse((child) => {
      if (!child.isMesh || !child.material) {
        return;
      }
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => material.clone())
        : child.material.clone();
      const editableMaterials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of editableMaterials) {
        material.color.lerp(new THREE.Color(isEnemy ? 0xff2a2a : 0x62f7e2), isEnemy ? 0.28 : 0.18);
        material.emissive = new THREE.Color(isEnemy ? 0x3b0505 : 0x052f36);
        material.emissiveIntensity = isEnemy ? 0.28 : 0.16;
      }
    });

    const mixer = new THREE.AnimationMixer(root);
    const actions = {};
    Object.entries(modelAssets.clips).forEach(([name, clip]) => {
      if (!clip) {
        return;
      }
      clip.name = name;
      const action = mixer.clipAction(clip);
      action.enabled = true;
      if (name === "jump" || name === "punch" || name === "uppercut") {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      actions[name] = action;
    });
    if (actions.idle) {
      actions.idle.play();
    }

    return {
      root,
      mixer,
      actions,
      currentAction: "idle",
    };
  }

  function playActorAction(actor, name, fade = 0.16) {
    if (!actor.animated || actor.animated.currentAction === name || !actor.animated.actions[name]) {
      return;
    }
    const previous = actor.animated.actions[actor.animated.currentAction];
    const next = actor.animated.actions[name];
    if (previous) {
      previous.fadeOut(fade);
    }
    next.reset().fadeIn(fade).play();
    actor.animated.currentAction = name;
  }

  function playUiConfirmSound() {
    playSweep(440, 620, 0.12, 0.06, "triangle");
  }

  function playShootSound(owner) {
    if (owner === "player") {
      playSweep(310, 180, 0.09, 0.05, "square");
      return;
    }

    playSweep(180, 110, 0.12, 0.04, "sawtooth");
  }

  function playEnemyHitSound() {
    playSweep(520, 240, 0.12, 0.05, "triangle");
  }

  function playEnemyDownSound() {
    playSweep(260, 92, 0.34, 0.085, "sawtooth");
    playSweep(620, 210, 0.18, 0.04, "triangle");
  }

  function playPlayerDamageSound() {
    playSweep(160, 70, 0.22, 0.08, "square");
  }

  function playJumpSound() {
    playSweep(220, 420, 0.18, 0.05, "triangle");
  }

  function playLandSound() {
    playSweep(180, 120, 0.14, 0.05, "triangle");
  }

  function playSweep(startFreq, endFreq, duration, volume, waveType) {
    if (!audio.context || audio.context.state !== "running") {
      return;
    }

    const startTime = audio.context.currentTime;
    const oscillator = audio.context.createOscillator();
    const gain = audio.context.createGain();
    const filter = audio.context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = Math.max(startFreq, endFreq) * 1.2;
    filter.Q.value = 0.6;

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(startFreq, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(endFreq, 30),
      startTime + duration
    );

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    oscillator.connect(filter);
    filter.connect(gain);
    gain.connect(audio.sfxGain);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration + 0.04);
  }

  function resetGame() {
    clearWorld();

    state.started = false;
    state.ended = false;
    state.message = "برای شروع کلیک کنید";
    state.lockedEnemy = null;
    state.totalEnemies = 0;
    document.body.classList.remove("game-over");
    document.body.classList.remove("target-locked");
    world.time = 0;
    cameraState.forward.set(1, 0, 0);
    cameraState.pitch = 0.12;
    camera.fov = CONFIG.cameraBaseFov;
    camera.updateProjectionMatrix();
    input.jumpQueued = false;
    input.shootHeld = false;
    input.forward = false;
    input.backward = false;
    input.left = false;
    input.right = false;
    resetTouchStick();
    clock.stop();
    clock.start();

    createPlatforms();
    createPlayer();
    createEnemies();
    updateCamera(0.016);
    updateUi();
    showOverlay(
      "شروع بازی",
      "روی دسکتاپ بعد از شروع کلیک کنید تا ماوس قفل شود. روی موبایل از جوی‌استیک و دکمه‌ها استفاده کنید."
    );
  }

  function clearWorld() {
    for (const platform of world.platforms) {
      playfieldRoot.remove(platform.group);
    }
    for (const enemy of world.enemies) {
      playfieldRoot.remove(enemy.mesh);
    }
    for (const bullet of world.bullets) {
      playfieldRoot.remove(bullet.mesh);
    }
    for (const effect of world.effects) {
      playfieldRoot.remove(effect.mesh);
    }
    if (world.player) {
      playfieldRoot.remove(world.player.mesh);
    }

    world.platforms = [];
    world.enemies = [];
    world.bullets = [];
    world.effects = [];
    world.player = null;
  }

  function createPlatforms() {
    const definitions = [
      {
        radius: 8.2,
        color: 0x244b67,
        emissive: 0x0e5d7f,
        base: [0, 6, 0],
        amp: [0, 1.6, 0],
        speed: [0.2, 0.65, 0.18],
        phase: [0.1, 0.6, 0.4],
        spinAxis: [0.7, 1, 0.2],
        spinSpeed: 0.45,
      },
      {
        radius: 6.1,
        color: 0x35516c,
        emissive: 0x2d8cb0,
        base: [16, 13, -9],
        amp: [2.5, 1.8, 2.4],
        speed: [0.35, 0.8, 0.42],
        phase: [0.2, 1.1, 0.7],
        spinAxis: [0.3, 1, 0.8],
        spinSpeed: -0.62,
      },
      {
        radius: 5.4,
        color: 0x294258,
        emissive: 0x2ebf9b,
        base: [-15, 11, 12],
        amp: [2.2, 1.6, 2.7],
        speed: [0.4, 0.7, 0.35],
        phase: [0.7, 0.3, 1.4],
        spinAxis: [1, 0.5, 0.25],
        spinSpeed: 0.58,
      },
      {
        radius: 6.6,
        color: 0x3e5166,
        emissive: 0x5085ff,
        base: [28, 19, 10],
        amp: [1.8, 2.1, 2.1],
        speed: [0.32, 0.75, 0.28],
        phase: [0.9, 0.5, 0.2],
        spinAxis: [0.4, 0.8, 1],
        spinSpeed: 0.53,
      },
      {
        radius: 5.2,
        color: 0x533f66,
        emissive: 0xff7a79,
        base: [8, 25, 24],
        amp: [2.4, 1.4, 2.9],
        speed: [0.36, 0.68, 0.33],
        phase: [1.6, 0.7, 0.4],
        spinAxis: [0.9, 0.4, 0.7],
        spinSpeed: -0.72,
      },
      {
        radius: 7.3,
        color: 0x354860,
        emissive: 0xffb35e,
        base: [-18, 23, 28],
        amp: [2.8, 2.2, 2.4],
        speed: [0.26, 0.62, 0.37],
        phase: [1.2, 0.2, 0.8],
        spinAxis: [0.5, 1, 0.5],
        spinSpeed: 0.48,
      },
      {
        radius: 8.4,
        color: 0x314361,
        emissive: 0x5ef0df,
        base: [34, 31, 28],
        amp: [2.3, 2.5, 2.1],
        speed: [0.28, 0.52, 0.31],
        phase: [0.4, 1.4, 0.9],
        spinAxis: [0.25, 0.8, 1],
        spinSpeed: 0.41,
      },
    ];

    for (const definition of definitions) {
      world.platforms.push(new FloatingSphere(definition));
    }
  }

  function createPlayer() {
    const startPlatform = world.platforms[0];
    const mesh = makeActorMesh(0x6ff7dd, 0x153043);
    const up = new THREE.Vector3(0, 1, 0);
    const position = startPlatform.center
      .clone()
      .addScaledVector(up, startPlatform.radius + CONFIG.playerRadius);
    world.player = {
      mesh,
      position,
      velocity: new THREE.Vector3(),
      up,
      radius: CONFIG.playerRadius,
      currentPlatform: startPlatform,
      grounded: true,
      health: CONFIG.playerHealth,
      shootCooldown: 0,
      invulnerableTimer: 0,
      hitFlash: 0,
      coyoteTimer: CONFIG.coyoteTime,
      jumpTarget: null,
      jumpTargetPoint: new THREE.Vector3(),
      trailTimer: 0,
      speedBlend: 0,
      animated: null,
      actionTimer: 0,
    };
    world.player.animated = attachAnimatedModel(mesh, false);
    playfieldRoot.add(mesh);
    syncActorMesh(world.player, cameraState.forward);
  }

  function createEnemies() {
    const slots = [
      [1, 0.22, 1.2, 0.65],
      [1, -0.28, 3.9, -0.58],
      [2, -0.18, 2.6, -0.72],
      [2, 0.32, 5.1, 0.78],
      [3, 0.18, 0.7, 0.66],
      [4, 0.3, 4.0, 0.85],
      [4, -0.22, 1.6, -0.8],
      [5, -0.26, 0.8, -0.56],
      [5, 0.27, 4.9, 0.62],
      [6, 0.14, 2.2, 0.5],
      [6, -0.31, 5.5, -0.54],
    ];

    for (const [platformIndex, lat, lon, speed] of slots) {
      const platform = world.platforms[platformIndex];
      const mesh = makeActorMesh(0xff2424, 0x540507, { enemy: true });
      const enemy = {
        mesh,
        platform,
        radius: 0.95,
        lat,
        lon,
        orbitSpeed: speed,
        latAmplitude: 0.17 + Math.random() * 0.18,
        latSpeed: 0.9 + Math.random() * 0.4,
        phase: Math.random() * Math.PI * 2,
        health: 60,
        fireCooldown: 0.5 + Math.random() * 0.9,
        position: new THREE.Vector3(),
        up: new THREE.Vector3(0, 1, 0),
        forward: new THREE.Vector3(0, 0, 1),
        hitFlash: 0,
        pulseOffset: Math.random() * Math.PI * 2,
        dead: false,
        animated: null,
        actionTimer: 0,
      };
      enemy.animated = attachAnimatedModel(mesh, true);
      updateEnemyTransform(enemy, 0, true);
      syncActorMesh(enemy, enemy.forward);
      playfieldRoot.add(mesh);
      world.enemies.push(enemy);
    }

    state.totalEnemies = world.enemies.length;
  }

  class FloatingSphere {
    constructor({ radius, color, emissive, base, amp, speed, phase, spinAxis, spinSpeed }) {
      this.radius = radius;
      this.base = new THREE.Vector3().fromArray(base);
      this.amp = new THREE.Vector3().fromArray(amp);
      this.speed = new THREE.Vector3().fromArray(speed);
      this.phase = new THREE.Vector3().fromArray(phase);
      this.spinAxis = new THREE.Vector3().fromArray(spinAxis).normalize();
      this.spinSpeed = spinSpeed;
      this.center = this.base.clone();
      this.prevCenter = this.base.clone();
      this.delta = new THREE.Vector3();
      this.pulseOffset = Math.random() * Math.PI * 2;

      this.group = new THREE.Group();
      this.group.position.copy(this.center);
      this.shellMaterial = new THREE.MeshStandardMaterial({
        color,
        map: sphereTextures[world.platforms.length % sphereTextures.length],
        roughness: 0.46,
        metalness: 0.34,
        emissive,
        emissiveIntensity: 0.18,
      });

      const shell = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 40, 40),
        this.shellMaterial
      );
      shell.castShadow = true;
      shell.receiveShadow = true;
      this.group.add(shell);

      this.atmosphereMaterial = new THREE.MeshBasicMaterial({
        color: emissive,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const atmosphere = new THREE.Mesh(
        new THREE.SphereGeometry(radius * 1.085, 32, 32),
        this.atmosphereMaterial
      );
      this.group.add(atmosphere);

      this.ringMaterial = new THREE.MeshStandardMaterial({
        color: 0xf4ffff,
        emissive,
        emissiveIntensity: 0.58,
        metalness: 0.8,
        roughness: 0.12,
        transparent: true,
        opacity: 0.74,
      });
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.2, Math.max(radius * 0.09, 0.36), 16, 72),
        this.ringMaterial
      );
      ring.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
      this.ring = ring;
      this.group.add(ring);

      this.outerRingMaterial = new THREE.MeshBasicMaterial({
        color: emissive,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const outerRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 1.38, Math.max(radius * 0.04, 0.18), 12, 96),
        this.outerRingMaterial
      );
      outerRing.rotation.set(Math.PI / 2, Math.random() * Math.PI, Math.random() * Math.PI);
      this.outerRing = outerRing;
      this.group.add(outerRing);

      const lattice = new THREE.LineSegments(
        new THREE.WireframeGeometry(new THREE.SphereGeometry(radius * 1.015, 12, 12)),
        new THREE.LineBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.08,
        })
      );
      this.group.add(lattice);

      const cap = new THREE.Mesh(
        new THREE.ConeGeometry(radius * 0.24, radius * 0.95, 5),
        new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive,
          emissiveIntensity: 0.6,
          transparent: true,
          opacity: 0.8,
          roughness: 0.18,
          metalness: 0.55,
        })
      );
      cap.position.y = radius * 1.02;
      cap.rotation.z = Math.PI;
      this.group.add(cap);

      this.glowLight = new THREE.PointLight(emissive, 18, radius * 8, 2);
      this.group.add(this.glowLight);

      this.orbiters = [];
      const orbiterCount = 3;
      for (let i = 0; i < orbiterCount; i += 1) {
        const pivot = new THREE.Group();
        const orbiter = new THREE.Mesh(
          new THREE.SphereGeometry(Math.max(radius * 0.09, 0.24), 16, 16),
          new THREE.MeshBasicMaterial({
            color: emissive,
            transparent: true,
            opacity: 0.9,
          })
        );
        orbiter.position.set(radius * (1.55 + i * 0.16), 0, 0);
        pivot.rotation.set(
          (Math.PI * 2 * i) / orbiterCount,
          Math.random() * Math.PI,
          Math.random() * Math.PI
        );
        pivot.add(orbiter);
        this.group.add(pivot);
        this.orbiters.push({
          pivot,
          speed: (i % 2 === 0 ? 1 : -1) * (0.22 + i * 0.12),
          bob: Math.random() * Math.PI * 2,
        });
      }

      playfieldRoot.add(this.group);
    }

    update(time, deltaTime) {
      this.prevCenter.copy(this.center);
      this.center.set(
        this.base.x + Math.sin(time * this.speed.x + this.phase.x) * this.amp.x,
        this.base.y + Math.cos(time * this.speed.y + this.phase.y) * this.amp.y,
        this.base.z + Math.sin(time * this.speed.z + this.phase.z) * this.amp.z
      );
      this.delta.subVectors(this.center, this.prevCenter);
      this.group.position.copy(this.center);
      this.group.quaternion.multiply(
        tmpQuat.setFromAxisAngle(this.spinAxis, this.spinSpeed * deltaTime)
      );

      const pulse = 0.5 + 0.5 * Math.sin(time * 1.6 + this.pulseOffset);
      this.shellMaterial.emissiveIntensity = 0.14 + pulse * 0.24;
      this.atmosphereMaterial.opacity = 0.12 + pulse * 0.12;
      this.ringMaterial.opacity = 0.54 + pulse * 0.24;
      this.outerRingMaterial.opacity = 0.14 + pulse * 0.08;
      this.glowLight.intensity = 14 + pulse * 10;
      this.ring.rotation.x += deltaTime * 0.35;
      this.ring.rotation.z -= deltaTime * 0.18;
      this.outerRing.rotation.y += deltaTime * 0.24;

      for (const orbiter of this.orbiters) {
        orbiter.pivot.rotation.y += orbiter.speed * deltaTime;
        orbiter.pivot.rotation.z += Math.sin(time * 0.8 + orbiter.bob) * deltaTime * 0.1;
      }
    }
  }

  function makeActorMesh(primary, accent, options = {}) {
    const isEnemy = Boolean(options.enemy);
    const group = new THREE.Group();

    const suit = new THREE.MeshStandardMaterial({
      color: primary,
      emissive: primary,
      emissiveIntensity: isEnemy ? 0.44 : 0.24,
      roughness: isEnemy ? 0.26 : 0.34,
      metalness: 0.36,
    });

    const armor = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: isEnemy ? accent : 0x000000,
      emissiveIntensity: isEnemy ? 0.18 : 0,
      roughness: isEnemy ? 0.24 : 0.32,
      metalness: isEnemy ? 0.42 : 0.34,
    });

    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.52, 1.1, 4, 8),
      suit
    );
    body.castShadow = true;
    group.add(body);

    const visorMaterial = new THREE.MeshStandardMaterial({
      color: isEnemy ? 0xfff2f2 : 0xffffff,
      emissive: primary,
      emissiveIntensity: isEnemy ? 1 : 0.7,
      transparent: true,
      opacity: 0.96,
      roughness: 0.08,
      metalness: 0.7,
    });
    const visor = new THREE.Mesh(
      new THREE.SphereGeometry(0.32, 16, 16),
      visorMaterial
    );
    visor.position.set(0, 0.55, 0.32);
    group.add(visor);

    const pack = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.7, 0.28),
      armor
    );
    pack.position.set(0, -0.08, -0.42);
    pack.castShadow = true;
    group.add(pack);

    if (isEnemy) {
      const shoulderLeft = new THREE.Mesh(
        new THREE.BoxGeometry(0.22, 0.28, 0.22),
        armor
      );
      shoulderLeft.position.set(-0.45, 0.34, 0);
      shoulderLeft.castShadow = true;
      group.add(shoulderLeft);

      const shoulderRight = shoulderLeft.clone();
      shoulderRight.position.x = 0.45;
      group.add(shoulderRight);
    }

    const coreHaloMaterial = new THREE.MeshBasicMaterial({
      color: primary,
      transparent: true,
      opacity: isEnemy ? 0.72 : 0.5,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const coreHalo = new THREE.Mesh(
      new THREE.TorusGeometry(0.5, 0.06, 12, 32),
      coreHaloMaterial
    );
    coreHalo.position.set(0, 0.12, 0);
    coreHalo.rotation.x = Math.PI / 2;
    group.add(coreHalo);

    const blaster = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.16, 0.78),
      armor
    );
    blaster.position.set(0.54, 0.04, 0.22);
    blaster.castShadow = true;
    group.add(blaster);

    let warningGroup = null;
    let warningRingMaterial = null;
    let warningCoreMaterial = null;
    let beaconLight = null;
    if (isEnemy) {
      group.scale.setScalar(1.08);

      warningGroup = new THREE.Group();
      warningGroup.position.set(0, 1.62, 0);

      warningRingMaterial = new THREE.MeshBasicMaterial({
        color: 0xff2d2d,
        transparent: true,
        opacity: 0.76,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const warningRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.42, 0.045, 12, 40),
        warningRingMaterial
      );
      warningRing.rotation.x = Math.PI / 2;
      warningGroup.add(warningRing);

      warningCoreMaterial = new THREE.MeshBasicMaterial({
        color: 0xffd7d7,
        transparent: true,
        opacity: 0.86,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const warningCore = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.18, 0),
        warningCoreMaterial
      );
      warningCore.position.y = 0.26;
      warningGroup.add(warningCore);

      const redAura = new THREE.Mesh(
        new THREE.SphereGeometry(0.82, 20, 20),
        new THREE.MeshBasicMaterial({
          color: 0xff2d2d,
          transparent: true,
          opacity: 0.12,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        })
      );
      redAura.position.set(0, 0.18, 0);
      group.add(redAura);

      beaconLight = new THREE.PointLight(0xff3030, 3.2, 9, 2);
      beaconLight.position.set(0, 1.35, 0.2);
      group.add(beaconLight);
      group.add(warningGroup);
    }

    group.userData.visuals = {
      isEnemy,
      suit,
      armor,
      visorMaterial,
      coreHaloMaterial,
      warningGroup,
      warningRingMaterial,
      warningCoreMaterial,
      beaconLight,
    };

    return group;
  }

  function attachAnimatedModel(group, isEnemy) {
    const animated = createAnimatedModel(isEnemy);
    if (!animated) {
      return null;
    }
    group.add(animated.root);
    group.userData.proceduralParts = group.children.filter((child) => child !== animated.root);
    for (const child of group.userData.proceduralParts) {
      child.visible = false;
    }
    return animated;
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

  function requestPointerLockSafely() {
    if (document.pointerLockElement === canvas || !canvas.requestPointerLock) {
      return;
    }

    try {
      const result = canvas.requestPointerLock();
      if (result && typeof result.catch === "function") {
        result.catch(() => {
          if (!state.ended) {
            state.message = "بازی شروع شد؛ برای هدف‌گیری بهتر داخل صحنه کلیک کن";
            updateUi();
          }
        });
      }
    } catch (_error) {
      if (!state.ended) {
        state.message = "بازی شروع شد؛ برای هدف‌گیری بهتر داخل صحنه کلیک کن";
        updateUi();
      }
    }
  }

  function startGame(shouldLockPointer) {
    ensureAudio();

    if (state.ended) {
      resetGame();
    }

    if (!state.started) {
      state.started = true;
      hideOverlay();
      state.message = "از روی کره‌ها عبور کن و دشمن‌ها را پاکسازی کن";
      playUiConfirmSound();
      updateUi();
    }

    if (shouldLockPointer) {
      requestPointerLockSafely();
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    const deltaTime = Math.min(clock.getDelta(), 0.033);

    if (state.started && !state.ended) {
      stepGame(deltaTime);
    }

    renderer.render(scene, camera);
  }

  function stepGame(deltaTime) {
    world.time += deltaTime;
    updateWorld(deltaTime);
  }

  function updateWorld(deltaTime) {
    for (const platform of world.platforms) {
      platform.update(world.time, deltaTime);
    }

    updatePlayer(deltaTime);
    updateEnemies(deltaTime);
    updateBullets(deltaTime);
    updateEffects(deltaTime);
    updateSceneDecor(deltaTime);
    updateCamera(deltaTime);
    updateAimLock();
    updateAudio();
    updateUi();
  }

  function updatePlayer(deltaTime) {
    const player = world.player;
    if (!player) {
      return;
    }

    player.shootCooldown = Math.max(0, player.shootCooldown - deltaTime);
    player.invulnerableTimer = Math.max(0, player.invulnerableTimer - deltaTime);
    player.hitFlash = Math.max(0, player.hitFlash - deltaTime * 4);
    player.trailTimer = Math.max(0, player.trailTimer - deltaTime);

    if (player.grounded && player.currentPlatform) {
      player.position.add(player.currentPlatform.delta);
      player.coyoteTimer = CONFIG.coyoteTime;
    } else {
      player.coyoteTimer = Math.max(0, player.coyoteTimer - deltaTime);
    }

    const nearestPlatform = getNearestPlatform(player.position);
    const gravityPlatform = getPreferredGravityPlatform(player, nearestPlatform.platform);
    if (!gravityPlatform) {
      return;
    }

    const desiredUp = tmpVecA
      .copy(player.position)
      .sub(gravityPlatform.center)
      .normalize();
    if (desiredUp.lengthSq() < 0.001) {
      desiredUp.set(0, 1, 0);
    }
    player.up.lerp(desiredUp, 1 - Math.exp(-12 * deltaTime)).normalize();

    let forward = tmpVecB.copy(cameraState.forward).projectOnPlane(player.up);
    if (forward.lengthSq() < 0.0001) {
      forward = fallbackTangent(player.up, tmpVecB);
    }
    forward.normalize();
    cameraState.forward.copy(forward);

    const right = tmpVecC.copy(forward).cross(player.up).normalize();
    const moveIntent = new THREE.Vector3();
    if (input.forward) {
      moveIntent.add(forward);
    }
    if (input.backward) {
      moveIntent.sub(forward);
    }
    if (input.right) {
      moveIntent.add(right);
    }
    if (input.left) {
      moveIntent.sub(right);
    }
    if (moveIntent.lengthSq() > 0.001) {
      moveIntent.normalize();
    }

    const currentNormalSpeed = player.velocity.dot(player.up);
    const tangentialVelocity = player.velocity
      .clone()
      .sub(player.up.clone().multiplyScalar(currentNormalSpeed));

    if (moveIntent.lengthSq() > 0.001) {
      const accel = player.grounded ? CONFIG.groundAccel : CONFIG.airAccel;
      tangentialVelocity.addScaledVector(moveIntent, accel * deltaTime);
    }

    const tangentialMax = player.grounded
      ? CONFIG.maxGroundSpeed
      : CONFIG.maxAirSpeed;
    if (tangentialVelocity.length() > tangentialMax) {
      tangentialVelocity.setLength(tangentialMax);
    }

    if (player.grounded) {
      tangentialVelocity.multiplyScalar(Math.exp(-CONFIG.groundDrag * deltaTime));
    }

    player.velocity.copy(tangentialVelocity);
    player.velocity.addScaledVector(player.up, currentNormalSpeed);

    const canJump = player.grounded || player.coyoteTimer > 0;
    if (input.jumpQueued && canJump) {
      launchPlayer(player, moveIntent, forward);
      player.actionTimer = 0.5;
      playActorAction(player, "jump", 0.08);
    }
    input.jumpQueued = false;

    if (!player.grounded && player.jumpTarget) {
      applyJumpAssistMagnetism(player, deltaTime);
    }

    player.velocity.addScaledVector(player.up, -CONFIG.gravity * deltaTime);
    player.position.addScaledVector(player.velocity, deltaTime);

    resolvePlayerLanding(player);

    if (player.position.length() > 220 || player.position.y < -80) {
      endGame(false, "در خلأ گم شدی. دوباره تلاش کن.");
      return;
    }

    if (input.shootHeld && player.shootCooldown <= 0) {
      firePlayerBullet();
    }

    if (player.animated) {
      player.animated.mixer.update(deltaTime);
      player.actionTimer = Math.max(0, player.actionTimer - deltaTime);
      if (player.actionTimer <= 0) {
        if (!player.grounded) {
          playActorAction(player, "jump", 0.08);
        } else if (moveIntent.lengthSq() > 0.02 || tangentialVelocity.lengthSq() > 2) {
          playActorAction(player, "walk", 0.12);
        } else {
          playActorAction(player, "idle", 0.18);
        }
      }
    }

    player.speedBlend = THREE.MathUtils.lerp(
      player.speedBlend,
      player.velocity.length(),
      1 - Math.exp(-6 * deltaTime)
    );
    if (player.trailTimer <= 0 && (player.speedBlend > 18 || !player.grounded)) {
      spawnTrail(player.position, 0x6ff7dd, player.velocity, player.grounded ? 0.14 : 0.2);
      player.trailTimer = player.grounded ? 0.08 : 0.05;
    }

    const visualForward =
      moveIntent.lengthSq() > 0.02
        ? moveIntent
        : tangentialVelocity.lengthSq() > 0.08
          ? tangentialVelocity.clone().normalize()
          : cameraState.forward.clone().projectOnPlane(player.up).normalize();
    syncActorMesh(player, visualForward);
  }

  function resolvePlayerLanding(player) {
    const wasGrounded = player.grounded;
    player.grounded = false;

    let bestPlatform = null;
    let bestNormal = null;
    let bestGap = Infinity;

    for (const platform of world.platforms) {
      const offset = player.position.clone().sub(platform.center);
      const distance = offset.length();
      if (distance < 0.0001) {
        continue;
      }

      const normal = offset.multiplyScalar(1 / distance);
      const surfaceDistance = platform.radius + player.radius;
      const gap = distance - surfaceDistance;

      if (gap < 0) {
        player.position.copy(platform.center).addScaledVector(normal, surfaceDistance);
        const inwardSpeed = player.velocity.dot(normal);
        if (inwardSpeed < 0) {
          player.velocity.addScaledVector(normal, -inwardSpeed);
        }
      }

      const snapDistance =
        platform === player.jumpTarget
          ? CONFIG.landingSnapDistance * 1.8
          : CONFIG.landingSnapDistance;
      const landingSpeed =
        platform === player.jumpTarget
          ? CONFIG.landingMaxSpeed * 1.45
          : CONFIG.landingMaxSpeed;

      if (gap < snapDistance && player.velocity.dot(normal) <= landingSpeed) {
        if (gap < bestGap) {
          bestGap = gap;
          bestPlatform = platform;
          bestNormal = normal.clone();
        }
      }
    }

    if (bestPlatform && bestNormal) {
      player.grounded = true;
      player.currentPlatform = bestPlatform;
      player.up.copy(bestNormal);
      const normalSpeed = player.velocity.dot(bestNormal);
      const planarVelocity = player.velocity
        .clone()
        .sub(bestNormal.clone().multiplyScalar(normalSpeed));
      player.velocity.copy(planarVelocity);
      player.jumpTarget = null;
      player.coyoteTimer = CONFIG.coyoteTime;

      if (!wasGrounded) {
        spawnImpact(
          player.position.clone().sub(bestNormal.clone().multiplyScalar(player.radius * 0.14)),
          0xbffef1,
          0.24
        );
        playLandSound();
      }
    } else {
      player.currentPlatform = null;
    }
  }

  function launchPlayer(player, moveIntent, forward) {
    const launchForward =
      moveIntent.lengthSq() > 0.02 ? moveIntent.clone() : forward.clone();
    if (launchForward.lengthSq() < 0.0001) {
      fallbackTangent(player.up, launchForward);
    } else {
      launchForward.normalize();
    }

    const assist = findJumpAssist(player, launchForward);
    const launchVelocity = player.velocity.clone();
    launchVelocity.addScaledVector(player.up, CONFIG.jumpSpeed);
    launchVelocity.addScaledVector(launchForward, CONFIG.jumpForwardBoost);

    if (assist) {
      const assistStrength =
        CONFIG.jumpAssistStrength *
        THREE.MathUtils.clamp(1 - assist.distance / CONFIG.jumpAssistRange, 0.28, 1);
      launchVelocity.addScaledVector(assist.landingDirection, assistStrength);
      player.jumpTarget = assist.platform;
      player.jumpTargetPoint.copy(assist.landingPoint);
    } else {
      player.jumpTarget = null;
      player.jumpTargetPoint.set(0, 0, 0);
    }

    player.velocity.copy(launchVelocity);
    player.grounded = false;
    player.currentPlatform = null;
    player.coyoteTimer = 0;
    spawnImpact(player.position, assist ? 0x96fff0 : 0x6ff7dd, 0.3);
    playJumpSound();
  }

  function findJumpAssist(player, preferredDirection) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const platform of world.platforms) {
      if (platform === player.currentPlatform) {
        continue;
      }

      const landingNormal = player.position.clone().sub(platform.center).normalize();
      const landingPoint = platform.center
        .clone()
        .addScaledVector(landingNormal, platform.radius + player.radius);
      const toLanding = landingPoint.clone().sub(player.position);
      const distance = toLanding.length();
      if (distance > CONFIG.jumpAssistRange || distance < 3) {
        continue;
      }

      const landingDirection = toLanding.normalize();
      const alignment = landingDirection.dot(preferredDirection);
      if (alignment < CONFIG.jumpAssistDot) {
        continue;
      }

      const elevation = Math.abs(landingDirection.dot(player.up));
      const score =
        alignment * 3.2 -
        distance * 0.048 -
        elevation * 0.6 +
        platform.radius * 0.04;

      if (score > bestScore) {
        bestScore = score;
        bestTarget = {
          platform,
          landingPoint,
          landingDirection,
          distance,
        };
      }
    }

    return bestTarget;
  }

  function getPreferredGravityPlatform(player, nearestPlatform) {
    if (player.grounded || !player.jumpTarget) {
      return nearestPlatform;
    }

    const targetSurfaceDistance =
      player.position.distanceTo(player.jumpTarget.center) - player.jumpTarget.radius;
    const nearestSurfaceDistance = nearestPlatform
      ? player.position.distanceTo(nearestPlatform.center) - nearestPlatform.radius
      : Infinity;
    const towardTarget = tmpVecD
      .copy(player.jumpTarget.center)
      .sub(player.position)
      .normalize()
      .dot(player.velocity.clone().normalize());

    if (
      player.jumpTarget === nearestPlatform ||
      targetSurfaceDistance < nearestSurfaceDistance + 4 ||
      (towardTarget > 0.35 && targetSurfaceDistance < CONFIG.jumpAssistRange * 1.15)
    ) {
      return player.jumpTarget;
    }

    return nearestPlatform;
  }

  function applyJumpAssistMagnetism(player, deltaTime) {
    const landingNormal = player.position.clone().sub(player.jumpTarget.center).normalize();
    player.jumpTargetPoint
      .copy(player.jumpTarget.center)
      .addScaledVector(landingNormal, player.jumpTarget.radius + player.radius);

    const toTarget = player.jumpTargetPoint.clone().sub(player.position);
    const distance = toTarget.length();
    if (distance < 0.001) {
      return;
    }

    const pull = THREE.MathUtils.clamp(
      1 - distance / (CONFIG.jumpAssistRange * 1.2),
      0,
      1
    );
    if (pull > 0) {
      player.velocity.addScaledVector(
        toTarget.normalize(),
        CONFIG.jumpMagnetism * pull * deltaTime
      );
    }
  }

  function updateAimLock() {
    const player = world.player;
    if (!player || !state.started || state.ended) {
      state.lockedEnemy = null;
      document.body.classList.remove("target-locked");
      return;
    }

    const aimDirection = new THREE.Vector3();
    camera.getWorldDirection(aimDirection);
    aimDirection.normalize();
    const origin = player.position
      .clone()
      .addScaledVector(player.up, 0.7)
      .addScaledVector(cameraState.forward, 1.15);
    const lock = findAimAssistTarget(origin, aimDirection, CONFIG.lockAimDot);
    state.lockedEnemy = lock ? lock.enemy : null;
    document.body.classList.toggle("target-locked", Boolean(state.lockedEnemy));
  }

  function findAimAssistTarget(origin, aimDirection, minDot) {
    let bestTarget = null;
    let bestScore = -Infinity;

    for (const enemy of world.enemies) {
      if (enemy.dead) {
        continue;
      }

      const aimPoint = enemy.position.clone().addScaledVector(enemy.up, 0.24);
      const toEnemy = aimPoint.sub(origin);
      const distance = toEnemy.length();
      if (distance > 90 || distance < 1.2) {
        continue;
      }

      const direction = toEnemy.normalize();
      const alignment = direction.dot(aimDirection);
      if (alignment < minDot) {
        continue;
      }

      if (!lineOfSight(origin, enemy.position, enemy.platform)) {
        continue;
      }

      const score = alignment * 5.2 - distance * 0.045;
      if (score > bestScore) {
        bestScore = score;
        bestTarget = {
          enemy,
          direction,
          distance,
          alignment,
        };
      }
    }

    return bestTarget;
  }

  function updateEnemies(deltaTime) {
    for (let i = world.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = world.enemies[i];
      if (enemy.dead) {
        continue;
      }

      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - deltaTime);
      enemy.hitFlash = Math.max(0, enemy.hitFlash - deltaTime * 4);

      updateEnemyTransform(enemy, deltaTime, false);
      if (enemy.animated) {
        enemy.animated.mixer.update(deltaTime);
        enemy.actionTimer = Math.max(0, enemy.actionTimer - deltaTime);
      }

      const toPlayer = world.player.position.clone().sub(enemy.position);
      const distance = toPlayer.length();
      const aimDirection =
        distance > 0.001 ? toPlayer.normalize() : enemy.forward.clone();

      const tangentAim = aimDirection.clone().projectOnPlane(enemy.up);
      if (tangentAim.lengthSq() > 0.001) {
        enemy.forward.lerp(tangentAim.normalize(), 1 - Math.exp(-5 * deltaTime));
      }

      const visuals = enemy.mesh.userData.visuals;
      if (visuals && visuals.isEnemy) {
        const pulse = 0.5 + 0.5 * Math.sin(world.time * 5.4 + enemy.pulseOffset);
        visuals.suit.emissiveIntensity = 0.36 + pulse * 0.24 + enemy.hitFlash * 0.45;
        visuals.armor.emissiveIntensity = 0.12 + pulse * 0.16 + enemy.hitFlash * 0.3;
        visuals.visorMaterial.emissiveIntensity = 0.95 + pulse * 0.55;
        visuals.coreHaloMaterial.opacity = 0.58 + pulse * 0.24;
        if (visuals.warningGroup) {
          visuals.warningGroup.position.y = 1.62 + pulse * 0.12;
          visuals.warningGroup.rotation.y += deltaTime * (1.6 + pulse * 0.9);
        }
        if (visuals.warningRingMaterial) {
          visuals.warningRingMaterial.opacity = 0.62 + pulse * 0.26 + enemy.hitFlash * 0.2;
        }
        if (visuals.warningCoreMaterial) {
          visuals.warningCoreMaterial.opacity = 0.72 + pulse * 0.22 + enemy.hitFlash * 0.18;
        }
        if (visuals.beaconLight) {
          visuals.beaconLight.intensity = 2.8 + pulse * 2.1 + enemy.hitFlash * 2.6;
        }
      }

      if (
        enemy.fireCooldown <= 0 &&
        distance < 54 &&
        lineOfSight(enemy.position, world.player.position, enemy.platform)
      ) {
        fireEnemyBullet(enemy);
        enemy.actionTimer = 0.55;
        playActorAction(enemy, "punch", 0.08);
        enemy.fireCooldown = CONFIG.enemyFireDelay + Math.random() * 0.7;
      }

      if (enemy.animated && enemy.actionTimer <= 0) {
        playActorAction(enemy, "walk", 0.16);
      }

      syncActorMesh(enemy, enemy.forward);
    }
  }

  function updateEnemyTransform(enemy, deltaTime, immediate) {
    enemy.lon += enemy.orbitSpeed * deltaTime;
    const lat =
      enemy.lat +
      Math.sin(world.time * enemy.latSpeed + enemy.phase) * enemy.latAmplitude;
    const normal = sphericalDirection(lat, enemy.lon, enemy.up);
    enemy.position
      .copy(enemy.platform.center)
      .addScaledVector(normal, enemy.platform.radius + enemy.radius);

    if (immediate) {
      enemy.forward.copy(fallbackTangent(normal, new THREE.Vector3()));
    }
  }

  function updateBullets(deltaTime) {
    for (let i = world.bullets.length - 1; i >= 0; i -= 1) {
      const bullet = world.bullets[i];
      bullet.life -= deltaTime;

      if (bullet.life <= 0) {
        removeBullet(i);
        continue;
      }

      if (bullet.owner === "player" && bullet.seekTarget && !bullet.seekTarget.dead) {
        const desiredDirection = bullet.seekTarget.position
          .clone()
          .addScaledVector(bullet.seekTarget.up, 0.26)
          .sub(bullet.position)
          .normalize();
        bullet.velocity.lerp(
          desiredDirection.multiplyScalar(bullet.speed),
          1 - Math.exp(-bullet.seekStrength * deltaTime)
        );
      }

      bullet.position.addScaledVector(bullet.velocity, deltaTime);
      bullet.mesh.position.copy(bullet.position);

      let hitPlatform = false;
      for (const platform of world.platforms) {
        const impactRadius = platform.radius + bullet.radius * 0.7;
        if (bullet.position.distanceToSquared(platform.center) <= impactRadius * impactRadius) {
          spawnImpact(bullet.position, bullet.color, 0.16);
          removeBullet(i);
          hitPlatform = true;
          break;
        }
      }

      if (hitPlatform) {
        continue;
      }

      if (bullet.owner === "player") {
        let struck = false;
        for (const enemy of world.enemies) {
          if (enemy.dead) {
            continue;
          }
          const hitDistance = enemy.radius + bullet.radius + CONFIG.playerHitPadding;
          if (bullet.position.distanceToSquared(enemy.position) <= hitDistance * hitDistance) {
            damageEnemy(enemy, 34);
            spawnImpact(bullet.position, 0x6ff7dd, 0.2);
            removeBullet(i);
            struck = true;
            break;
          }
        }
        if (struck) {
          continue;
        }
      } else {
        const player = world.player;
        if (player && player.invulnerableTimer <= 0) {
          const hitDistance = player.radius + bullet.radius + 0.12;
          if (bullet.position.distanceToSquared(player.position) <= hitDistance * hitDistance) {
            damagePlayer(16);
            spawnImpact(bullet.position, 0xff9b7a, 0.22);
            removeBullet(i);
          }
        }
      }
    }
  }

  function removeBullet(index) {
    const [bullet] = world.bullets.splice(index, 1);
    if (bullet) {
      playfieldRoot.remove(bullet.mesh);
    }
  }

  function updateEffects(deltaTime) {
    for (let i = world.effects.length - 1; i >= 0; i -= 1) {
      const effect = world.effects[i];
      effect.life -= deltaTime;
      if (effect.life <= 0) {
        playfieldRoot.remove(effect.mesh);
        world.effects.splice(i, 1);
        continue;
      }

      if (effect.velocity) {
        effect.mesh.position.addScaledVector(effect.velocity, deltaTime);
      }
      if (effect.spin) {
        effect.mesh.rotation.x += effect.spin.x * deltaTime;
        effect.mesh.rotation.y += effect.spin.y * deltaTime;
        effect.mesh.rotation.z += effect.spin.z * deltaTime;
      }

      const ratio = 1 - effect.life / effect.maxLife;
      const stretch = effect.stretch || new THREE.Vector3(1, 1, 1);
      effect.mesh.scale.set(
        (effect.baseScale + ratio * effect.growth) * stretch.x,
        (effect.baseScale + ratio * effect.growth) * stretch.y,
        (effect.baseScale + ratio * effect.growth) * stretch.z
      );

      const materials = effect.materials || [effect.mesh.material];
      for (const material of materials) {
        material.opacity =
          (1 - ratio) * (effect.opacity === undefined ? 0.9 : effect.opacity);
      }
    }
  }

  function updateCamera(deltaTime) {
    const player = world.player;
    if (!player) {
      return;
    }

    const up = player.up.clone().normalize();
    let forward = cameraState.forward.clone().projectOnPlane(up);
    if (forward.lengthSq() < 0.0001) {
      forward = fallbackTangent(up, forward);
    }
    forward.normalize();
    cameraState.forward.copy(forward);

    const speedRatio = THREE.MathUtils.clamp(
      player.speedBlend / CONFIG.maxAirSpeed,
      0,
      1.2
    );
    const target = player.position
      .clone()
      .addScaledVector(up, CONFIG.cameraHeight)
      .addScaledVector(forward, CONFIG.cameraLookAhead * speedRatio);
    const dynamicDistance = CONFIG.cameraDistance + speedRatio * 1.8;
    const backOffset = forward.clone().multiplyScalar(
      -dynamicDistance * Math.cos(cameraState.pitch)
    );
    const heightOffset = up.clone().multiplyScalar(
      dynamicDistance * Math.sin(cameraState.pitch)
    );
    const desiredPosition = target.clone().add(backOffset).add(heightOffset);
    camera.position.lerp(desiredPosition, 1 - Math.exp(-CONFIG.cameraLag * deltaTime));
    camera.up.copy(up);
    camera.lookAt(target.clone().addScaledVector(forward, 2.8 + speedRatio));

    const desiredFov = CONFIG.cameraBaseFov + speedRatio * CONFIG.cameraBoostFov;
    camera.fov = THREE.MathUtils.lerp(
      camera.fov,
      desiredFov,
      1 - Math.exp(-5 * deltaTime)
    );
    camera.updateProjectionMatrix();
  }

  function firePlayerBullet() {
    const player = world.player;
    if (!player || state.ended) {
      return;
    }

    const aimDirection = new THREE.Vector3();
    camera.getWorldDirection(aimDirection);
    aimDirection.normalize();

    const muzzle = player.position
      .clone()
      .addScaledVector(player.up, 0.7)
      .addScaledVector(cameraState.forward, 1.15);

    const assistTarget = findAimAssistTarget(
      muzzle,
      aimDirection,
      CONFIG.aimAssistDot
    );
    if (assistTarget) {
      aimDirection.lerp(assistTarget.direction, CONFIG.aimAssistBlend).normalize();
      state.lockedEnemy = assistTarget.enemy;
    }

    spawnBullet(
      muzzle,
      aimDirection,
      CONFIG.playerBulletSpeed,
      "player",
      CONFIG.bulletColor,
      {
        radius: CONFIG.playerBulletRadius,
        seekTarget: assistTarget ? assistTarget.enemy : null,
        seekStrength: CONFIG.playerBulletHoming,
      }
    );
    player.actionTimer = 0.45;
    playActorAction(player, state.lockedEnemy ? "uppercut" : "punch", 0.06);
    player.shootCooldown = CONFIG.playerFireDelay;
  }

  function fireEnemyBullet(enemy) {
    if (!world.player || state.ended) {
      return;
    }

    const direction = world.player.position
      .clone()
      .addScaledVector(world.player.up, 0.4)
      .sub(enemy.position)
      .normalize();

    const muzzle = enemy.position
      .clone()
      .addScaledVector(enemy.up, 0.45)
      .addScaledVector(enemy.forward, 0.9);

    spawnBullet(
      muzzle,
      direction,
      CONFIG.enemyBulletSpeed,
      "enemy",
      CONFIG.bulletColor,
      {
        radius: CONFIG.enemyBulletRadius,
      }
    );
  }

  function spawnBullet(origin, direction, speed, owner, color, options = {}) {
    const radius = options.radius || 0.22;
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(radius * 0.82, 12, 12),
      material
    );
    mesh.position.copy(origin);
    playfieldRoot.add(mesh);
    world.bullets.push({
      mesh,
      position: origin.clone(),
      velocity: direction.clone().multiplyScalar(speed),
      owner,
      color,
      radius,
      speed,
      seekTarget: options.seekTarget || null,
      seekStrength: options.seekStrength || 0,
      life: CONFIG.bulletLifetime,
    });
    spawnImpact(origin, color, 0.08);
    playShootSound(owner);
  }

  function spawnImpact(position, color, baseScale) {
    const coreMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
    });
    const haloMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });

    const mesh = new THREE.Group();
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(baseScale, 0), coreMaterial);
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(baseScale * 0.85, 16, 16),
      haloMaterial
    );
    mesh.add(core);
    mesh.add(halo);
    mesh.position.copy(position);
    playfieldRoot.add(mesh);
    world.effects.push({
      mesh,
      materials: [coreMaterial, haloMaterial],
      life: 0.32,
      maxLife: 0.32,
      baseScale: 1,
      growth: baseScale * 4.4,
      opacity: 0.95,
      spin: new THREE.Vector3(
        Math.random() * 1.4,
        Math.random() * 1.2,
        Math.random() * 1.6
      ),
    });
  }

  function spawnTrail(position, color, velocity, scaleBoost) {
    const direction = velocity.clone();
    if (direction.lengthSq() < 0.001) {
      return;
    }

    direction.normalize();
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(
      new THREE.OctahedronGeometry(scaleBoost, 0),
      material
    );
    mesh.position.copy(position).addScaledVector(direction, -0.85);
    mesh.lookAt(position.clone().add(direction));
    playfieldRoot.add(mesh);
    world.effects.push({
      mesh,
      materials: [material],
      life: 0.18,
      maxLife: 0.18,
      baseScale: 1,
      growth: 1.4,
      opacity: 0.34,
      velocity: velocity.clone().multiplyScalar(-0.025),
      stretch: new THREE.Vector3(0.65, 0.65, 2.6),
    });
  }

  function damageEnemy(enemy, amount) {
    enemy.health -= amount;
    enemy.hitFlash = 1;
    playEnemyHitSound();
    enemy.mesh.traverse((child) => {
      if (child.material && child.material.emissive) {
        child.material.emissiveIntensity = 0.95;
      }
    });

    if (enemy.health <= 0) {
      enemy.dead = true;
      playEnemyDownSound();
      playfieldRoot.remove(enemy.mesh);
      spawnImpact(enemy.position, 0xffbf69, 0.5);
      if (world.enemies.every((entry) => entry.dead)) {
        endGame(true, "همه‌ی دشمن‌ها را از بین بردی. عالی بود.");
      }
    }
  }

  function damagePlayer(amount) {
    const player = world.player;
    if (!player || player.invulnerableTimer > 0) {
      return;
    }

    player.health -= amount;
    player.invulnerableTimer = 0.45;
    player.hitFlash = 1;
    playPlayerDamageSound();

    if (player.health <= 0) {
      player.health = 0;
      endGame(false, "دشمن‌ها تو را شکست دادند. یک بار دیگر امتحان کن.");
    }
  }

  function endGame(won, message) {
    if (state.ended) {
      return;
    }

    state.ended = true;
    state.lockedEnemy = null;
    state.message = message;
    input.shootHeld = false;
    document.body.classList.toggle("game-over", true);
    document.body.classList.remove("target-locked");
    showOverlay(won ? "شروع دوباره" : "تلاش دوباره", message);
    if (document.pointerLockElement === canvas) {
      document.exitPointerLock();
    }
  }

  function updateUi() {
    const aliveEnemies = world.enemies.filter((enemy) => !enemy.dead).length;
    const healthRatio = world.player
      ? THREE.MathUtils.clamp(world.player.health / CONFIG.playerHealth, 0, 1)
      : 0;
    const currentHealth = world.player
      ? Math.max(0, Math.ceil(world.player.health))
      : 0;
    healthValue.textContent = world.player
      ? String(currentHealth)
      : "0";
    enemiesValue.textContent = String(aliveEnemies);
    statusValue.textContent = state.message;
    topAlertFill.style.transform = `scaleX(${healthRatio})`;
    topAlertText.textContent =
      currentHealth <= 25
        ? `سلامتی بحرانی ${currentHealth}`
        : `سلامتی ${currentHealth}`;
  }

  function syncActorMesh(actor, forwardHint) {
    const forward = forwardHint.clone().projectOnPlane(actor.up);
    if (forward.lengthSq() < 0.0001) {
      fallbackTangent(actor.up, forward);
    }
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(actor.up, forward).normalize();
    tmpMatrix.makeBasis(right, actor.up, forward);
    actor.mesh.quaternion.setFromRotationMatrix(tmpMatrix);
    actor.mesh.position.copy(actor.position);
  }

  function getNearestPlatform(position) {
    let closest = null;
    let closestSurface = Infinity;
    for (const platform of world.platforms) {
      const surfaceDistance = position.distanceTo(platform.center) - platform.radius;
      if (surfaceDistance < closestSurface) {
        closestSurface = surfaceDistance;
        closest = platform;
      }
    }
    return { platform: closest, surfaceDistance: closestSurface };
  }

  function sphericalDirection(lat, lon, target) {
    target.set(
      Math.cos(lat) * Math.cos(lon),
      Math.sin(lat),
      Math.cos(lat) * Math.sin(lon)
    );
    return target.normalize();
  }

  function fallbackTangent(up, target) {
    target
      .set(0, 1, 0)
      .projectOnPlane(up);
    if (target.lengthSq() < 0.0001) {
      target.set(1, 0, 0).projectOnPlane(up);
    }
    return target.normalize();
  }

  function lineOfSight(from, to, sourcePlatform) {
    for (const platform of world.platforms) {
      if (platform === sourcePlatform) {
        continue;
      }
      if (
        from.distanceTo(platform.center) <= platform.radius + 1.8 ||
        to.distanceTo(platform.center) <= platform.radius + 1.8
      ) {
        continue;
      }
      if (segmentIntersectsSphere(from, to, platform.center, platform.radius * 0.96)) {
        return false;
      }
    }
    return true;
  }

  function segmentIntersectsSphere(start, end, center, radius) {
    const segment = end.clone().sub(start);
    const toCenter = center.clone().sub(start);
    const segmentLengthSq = segment.lengthSq();
    if (segmentLengthSq < 0.0001) {
      return false;
    }
    const projection = THREE.MathUtils.clamp(
      toCenter.dot(segment) / segmentLengthSq,
      0,
      1
    );
    const closestPoint = start.clone().addScaledVector(segment, projection);
    return closestPoint.distanceToSquared(center) < radius * radius;
  }

  function applyTouchStick(clientX, clientY) {
    if (!touchStick) {
      return;
    }

    const rect = touchStick.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxDistance = rect.width * 0.38;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.min(maxDistance, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const nx = maxDistance > 0 ? (Math.cos(angle) * distance) / maxDistance : 0;
    const ny = maxDistance > 0 ? (Math.sin(angle) * distance) / maxDistance : 0;
    const deadZone = 0.22;

    input.forward = ny < -deadZone;
    input.backward = ny > deadZone;
    input.left = nx < -deadZone;
    input.right = nx > deadZone;
    touchStickKnob.style.transform = `translate(calc(-50% + ${nx * maxDistance}px), calc(-50% + ${ny * maxDistance}px))`;
  }

  function resetTouchStick() {
    touchState.stickPointer = null;
    input.forward = false;
    input.backward = false;
    input.left = false;
    input.right = false;
    if (touchStickKnob) {
      touchStickKnob.style.transform = "translate(-50%, -50%)";
    }
  }

  function applyTouchLook(deltaX, deltaY) {
    if (!world.player) {
      return;
    }

    const rotationSpeed = 0.0042;
    cameraState.forward.applyQuaternion(
      tmpQuat.setFromAxisAngle(world.player.up, -deltaX * rotationSpeed)
    );
    cameraState.pitch = THREE.MathUtils.clamp(
      cameraState.pitch + deltaY * 0.0032,
      -0.7,
      0.46
    );
  }

  function renderGameToText() {
    const player = world.player;
    const aliveEnemies = world.enemies.filter((enemy) => !enemy.dead);
    return JSON.stringify({
      mode: state.ended ? "ended" : state.started ? "playing" : "menu",
      message: state.message,
      coordinateSystem: "Three.js world coordinates: x right, y up, z depth.",
      player: player
        ? {
            x: Number(player.position.x.toFixed(2)),
            y: Number(player.position.y.toFixed(2)),
            z: Number(player.position.z.toFixed(2)),
            health: Math.max(0, Math.ceil(player.health)),
            grounded: player.grounded,
          }
        : null,
      enemiesRemaining: aliveEnemies.length,
      enemies: aliveEnemies.slice(0, 6).map((enemy) => ({
        x: Number(enemy.position.x.toFixed(2)),
        y: Number(enemy.position.y.toFixed(2)),
        z: Number(enemy.position.z.toFixed(2)),
        health: Math.max(0, Math.ceil(enemy.health)),
      })),
      bullets: world.bullets.length,
    });
  }

  window.render_game_to_text = renderGameToText;
  window.advanceTime = (ms) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    for (let i = 0; i < steps; i += 1) {
      if (state.started && !state.ended) {
        stepGame(1 / 60);
      }
    }
    renderer.render(scene, camera);
  };

  document.addEventListener("keydown", (event) => {
    if (event.repeat) {
      return;
    }

    switch (event.code) {
      case "KeyW":
        input.forward = true;
        break;
      case "KeyS":
        input.backward = true;
        break;
      case "KeyA":
        input.left = true;
        break;
      case "KeyD":
        input.right = true;
        break;
      case "Space":
        input.jumpQueued = true;
        event.preventDefault();
        break;
      default:
        break;
    }
  });

  document.addEventListener("keyup", (event) => {
    switch (event.code) {
      case "KeyW":
        input.forward = false;
        break;
      case "KeyS":
        input.backward = false;
        break;
      case "KeyA":
        input.left = false;
        break;
      case "KeyD":
        input.right = false;
        break;
      default:
        break;
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (document.pointerLockElement !== canvas || !world.player) {
      return;
    }

    const rotationSpeed = 0.0024;
    cameraState.forward.applyQuaternion(
      tmpQuat.setFromAxisAngle(world.player.up, -event.movementX * rotationSpeed)
    );
    cameraState.pitch = THREE.MathUtils.clamp(
      cameraState.pitch + event.movementY * 0.0017,
      -0.7,
      0.46
    );
  });

  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) {
      state.message = state.ended
        ? state.message
        : "ماوس قفل شد؛ هدف بگیر و بین کره‌ها جابه‌جا شو";
      updateUi();
      return;
    }

    if (!state.ended && state.started) {
      state.message = "برای ادامه، دوباره داخل صفحه کلیک کن";
      updateUi();
    }
  });

  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }
    if (!state.started || state.ended || document.pointerLockElement !== canvas) {
      startGame(true);
      return;
    }
    input.shootHeld = true;
    if (world.player && world.player.shootCooldown <= 0) {
      firePlayerBullet();
    }
  });

  window.addEventListener("mouseup", () => {
    input.shootHeld = false;
  });

  if (touchStick) {
    touchStick.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      touchState.stickPointer = event.pointerId;
      touchStick.setPointerCapture(event.pointerId);
      startGame(false);
      applyTouchStick(event.clientX, event.clientY);
    });

    touchStick.addEventListener("pointermove", (event) => {
      if (event.pointerId !== touchState.stickPointer) {
        return;
      }
      event.preventDefault();
      applyTouchStick(event.clientX, event.clientY);
    });

    const endStick = (event) => {
      if (event.pointerId === touchState.stickPointer) {
        resetTouchStick();
      }
    };
    touchStick.addEventListener("pointerup", endStick);
    touchStick.addEventListener("pointercancel", endStick);
  }

  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse" || event.target !== canvas) {
      return;
    }
    event.preventDefault();
    startGame(false);
    touchState.lookPointer = event.pointerId;
    touchState.lookX = event.clientX;
    touchState.lookY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener("pointermove", (event) => {
    if (event.pointerId !== touchState.lookPointer || event.pointerType === "mouse") {
      return;
    }
    event.preventDefault();
    applyTouchLook(event.clientX - touchState.lookX, event.clientY - touchState.lookY);
    touchState.lookX = event.clientX;
    touchState.lookY = event.clientY;
  });

  const endTouchLook = (event) => {
    if (event.pointerId === touchState.lookPointer) {
      touchState.lookPointer = null;
    }
  };
  canvas.addEventListener("pointerup", endTouchLook);
  canvas.addEventListener("pointercancel", endTouchLook);

  if (touchJump) {
    touchJump.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startGame(false);
      input.jumpQueued = true;
      touchJump.classList.add("active");
    });
    touchJump.addEventListener("pointerup", () => touchJump.classList.remove("active"));
    touchJump.addEventListener("pointercancel", () => touchJump.classList.remove("active"));
  }

  if (touchFire) {
    touchFire.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      startGame(false);
      input.shootHeld = true;
      touchFire.classList.add("active");
      if (world.player && world.player.shootCooldown <= 0) {
        firePlayerBullet();
      }
    });
    const stopTouchFire = () => {
      input.shootHeld = false;
      touchFire.classList.remove("active");
    };
    touchFire.addEventListener("pointerup", stopTouchFire);
    touchFire.addEventListener("pointercancel", stopTouchFire);
  }

  startButton.addEventListener("click", () => startGame(false));

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });

  initScene();
  resetGame();
  loadModelAssets();
  animate();
})();
