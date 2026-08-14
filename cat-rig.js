const TAU = Math.PI * 2;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function saturate(value) {
  return clamp(value, 0, 1);
}

function smoothstep(edge0, edge1, value) {
  const x = saturate((value - edge0) / Math.max(1e-6, edge1 - edge0));
  return x * x * (3 - 2 * x);
}

function damp(current, target, response, dt) {
  return current + (target - current) * (1 - Math.exp(-response * dt));
}

function amount(value) {
  if (value === true) return 1;
  if (!value || !Number.isFinite(value)) return 0;
  return saturate(value);
}

function signedAmount(value) {
  if (!Number.isFinite(value)) return 0;
  return clamp(value, -1, 1);
}

function setShadows(object, castShadow, receiveShadow) {
  object.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = castShadow;
    child.receiveShadow = receiveShadow;
  });
}

function makePalette(options, hostile, kind) {
  const enemyPalettes = {
    scout: {
      fur: 0x34383a,
      underside: 0x80827e,
      accent: 0xff4e5f,
      accentDark: 0x4b1018,
      eyes: 0xffc44e,
    },
    sentinel: {
      fur: 0x6a4b35,
      underside: 0xb69a77,
      accent: 0xff742f,
      accentDark: 0x571d0b,
      eyes: 0xffe08a,
    },
    sniper: {
      fur: 0x34303d,
      underside: 0x898496,
      accent: 0xff3aa7,
      accentDark: 0x4b0d36,
      eyes: 0xffa5df,
    },
  };
  const base = hostile
    ? enemyPalettes[kind] || enemyPalettes.scout
    : {
        fur: 0x8b725d,
        underside: 0xd6bfa0,
        accent: 0x45e7dd,
        accentDark: 0x123d48,
        eyes: 0xa8fff4,
      };
  return {
    fur: options.furColor ?? base.fur,
    underside: options.undersideColor ?? base.underside,
    accent: options.accentColor ?? base.accent,
    accentDark: options.accentDarkColor ?? base.accentDark,
    eyes: options.eyeColor ?? base.eyes,
    nose: options.noseColor ?? 0x35242a,
  };
}

function createMaterials(THREE, palette) {
  return {
    fur: new THREE.MeshStandardMaterial({
      color: palette.fur,
      emissive: palette.fur,
      emissiveIntensity: 0.13,
      roughness: 0.88,
      metalness: 0.02,
    }),
    underside: new THREE.MeshStandardMaterial({
      color: palette.underside,
      emissive: palette.underside,
      emissiveIntensity: 0.055,
      roughness: 0.94,
      metalness: 0,
    }),
    nose: new THREE.MeshStandardMaterial({
      color: palette.nose,
      roughness: 0.7,
      metalness: 0,
    }),
    harness: new THREE.MeshStandardMaterial({
      color: palette.accentDark,
      emissive: palette.accentDark,
      emissiveIntensity: 0.14,
      roughness: 0.28,
      metalness: 0.78,
    }),
    armor: new THREE.MeshStandardMaterial({
      color: palette.accent,
      emissive: palette.accent,
      emissiveIntensity: 0.2,
      roughness: 0.25,
      metalness: 0.72,
    }),
    glow: new THREE.MeshBasicMaterial({
      color: palette.accent,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    }),
    eye: new THREE.MeshBasicMaterial({ color: palette.eyes }),
    pupil: new THREE.MeshBasicMaterial({ color: 0x08090c }),
    whisker: new THREE.LineBasicMaterial({
      color: 0xe9e4dc,
      transparent: true,
      opacity: 0.72,
    }),
    muzzleFlash: new THREE.MeshBasicMaterial({
      color: palette.eyes,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  };
}

function createGeometries(THREE) {
  return {
    sphere: new THREE.SphereGeometry(1, 12, 9),
    cylinder: new THREE.CylinderGeometry(1, 1, 1, 8, 1),
    taperedCylinder: new THREE.CylinderGeometry(0.72, 1, 1, 8, 1),
    cone: new THREE.ConeGeometry(1, 1, 8, 1),
    triangle: new THREE.ConeGeometry(1, 1, 3, 1),
    box: new THREE.BoxGeometry(1, 1, 1),
    torus: new THREE.TorusGeometry(1, 0.12, 7, 20),
  };
}

function addMesh(THREE, parent, geometry, material, name, position, scale, rotation) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  if (position) mesh.position.set(position[0], position[1], position[2]);
  if (scale) mesh.scale.set(scale[0], scale[1], scale[2]);
  if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
  parent.add(mesh);
  return mesh;
}

function createLeg(THREE, parent, geometries, materials, config) {
  const root = new THREE.Group();
  root.name = config.name;
  root.position.set(config.x, config.y, config.z);
  parent.add(root);

  const upper = new THREE.Group();
  upper.name = `${config.name}-upper`;
  root.add(upper);
  addMesh(
    THREE,
    upper,
    geometries.sphere,
    materials.fur,
    `${config.name}-shoulder`,
    [0, -0.055, 0],
    [config.fore ? 0.145 : 0.205, config.fore ? 0.19 : 0.235, config.fore ? 0.15 : 0.2]
  );
  addMesh(
    THREE,
    upper,
    geometries.taperedCylinder,
    materials.fur,
    `${config.name}-upper-mesh`,
    [0, -config.upperLength * 0.52, 0],
    [config.fore ? 0.11 : 0.135, config.upperLength, config.fore ? 0.11 : 0.135]
  );

  const lower = new THREE.Group();
  lower.name = `${config.name}-lower`;
  lower.position.y = -config.upperLength;
  upper.add(lower);
  addMesh(
    THREE,
    lower,
    geometries.sphere,
    materials.fur,
    `${config.name}-joint`,
    [0, 0, 0],
    [0.115, 0.105, 0.11]
  );
  addMesh(
    THREE,
    lower,
    geometries.taperedCylinder,
    materials.fur,
    `${config.name}-lower-mesh`,
    [0, -config.lowerLength * 0.5, 0],
    [config.fore ? 0.085 : 0.1, config.lowerLength, config.fore ? 0.085 : 0.1]
  );

  const paw = new THREE.Group();
  paw.name = `${config.name}-paw`;
  paw.position.y = -config.lowerLength;
  lower.add(paw);
  const pawMesh = addMesh(
    THREE,
    paw,
    geometries.sphere,
    materials.fur,
    `${config.name}-paw-mesh`,
    [0, -0.062, 0.075],
    [config.fore ? 0.135 : 0.155, 0.085, config.fore ? 0.215 : 0.235]
  );
  addMesh(
    THREE,
    paw,
    geometries.sphere,
    materials.underside,
    `${config.name}-paw-pad`,
    [0, -0.135, 0.08],
    [config.fore ? 0.085 : 0.1, 0.018, 0.12]
  );

  upper.rotation.x = config.restUpper;
  lower.rotation.x = config.restLower;
  paw.rotation.x = -(config.restUpper + config.restLower);
  root.rotation.z = config.side * 0.035;

  return {
    name: config.name,
    root,
    upper,
    lower,
    paw,
    pawMesh,
    side: config.side,
    fore: config.fore,
    restUpper: config.restUpper,
    restLower: config.restLower,
    walkOffset: config.walkOffset,
    trotOffset: config.trotOffset,
    gallopOffset: config.gallopOffset,
  };
}

function createFace(THREE, head, geometries, materials) {
  const muzzle = new THREE.Group();
  muzzle.name = "cat-muzzle";
  head.add(muzzle);
  addMesh(THREE, muzzle, geometries.sphere, materials.underside, "muzzle-left", [-0.09, -0.085, 0.285], [0.135, 0.115, 0.18]);
  addMesh(THREE, muzzle, geometries.sphere, materials.underside, "muzzle-right", [0.09, -0.085, 0.285], [0.135, 0.115, 0.18]);
  addMesh(THREE, muzzle, geometries.sphere, materials.underside, "chin", [0, -0.185, 0.255], [0.13, 0.075, 0.14]);
  const nose = addMesh(THREE, muzzle, geometries.cone, materials.nose, "cat-nose", [0, -0.035, 0.455], [0.075, 0.065, 0.065], [Math.PI / 2, Math.PI / 4, 0]);

  const eyes = {};
  for (const side of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.name = side < 0 ? "left-eye" : "right-eye";
    eyeGroup.position.set(side * 0.145, 0.07, 0.292);
    head.add(eyeGroup);
    const eye = addMesh(THREE, eyeGroup, geometries.sphere, materials.eye, `${eyeGroup.name}-iris`, [0, 0, 0], [0.092, 0.105, 0.035]);
    const pupil = addMesh(THREE, eyeGroup, geometries.sphere, materials.pupil, `${eyeGroup.name}-pupil`, [0, 0, 0.034], [0.024, 0.074, 0.012]);
    eyes[side < 0 ? "left" : "right"] = { group: eyeGroup, eye, pupil };
  }

  const whiskerPoints = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const y = -0.075 - i * 0.045;
      whiskerPoints.push(
        side * 0.105, y, 0.405,
        side * (0.43 + i * 0.035), y + (1 - i) * 0.035, 0.445 - i * 0.012
      );
    }
  }
  const whiskerGeometry = new THREE.BufferGeometry();
  whiskerGeometry.setAttribute("position", new THREE.Float32BufferAttribute(whiskerPoints, 3));
  const whiskers = new THREE.LineSegments(whiskerGeometry, materials.whisker);
  whiskers.name = "cat-whiskers";
  head.add(whiskers);

  return { muzzle, nose, eyes, whiskers, whiskerGeometry };
}

function createEars(THREE, head, geometries, materials) {
  const ears = {};
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.name = side < 0 ? "left-ear" : "right-ear";
    ear.position.set(side * 0.205, 0.205, -0.015);
    ear.rotation.z = side * -0.09;
    head.add(ear);
    addMesh(
      THREE,
      ear,
      geometries.triangle,
      materials.fur,
      `${ear.name}-outer`,
      [0, 0.17, 0],
      [0.155, 0.34, 0.125],
      [0, side * 0.08, 0]
    );
    addMesh(
      THREE,
      ear,
      geometries.triangle,
      materials.underside,
      `${ear.name}-inner`,
      [0, 0.17, 0.076],
      [0.085, 0.245, 0.018],
      [0, side * 0.08, 0]
    );
    ears[side < 0 ? "left" : "right"] = ear;
  }
  return ears;
}

function createTail(THREE, hips, geometries, materials) {
  const root = new THREE.Group();
  root.name = "tail-root";
  root.position.set(0, 0.16, -0.41);
  hips.add(root);

  const segments = [];
  let parent = root;
  const count = 7;
  for (let i = 0; i < count; i += 1) {
    const length = 0.25 - i * 0.011;
    const radius = 0.092 - i * 0.007;
    const joint = new THREE.Group();
    joint.name = `tail-segment-${i + 1}`;
    parent.add(joint);
    addMesh(
      THREE,
      joint,
      geometries.taperedCylinder,
      materials.fur,
      `tail-segment-${i + 1}-mesh`,
      [0, 0, -length * 0.5],
      [radius, length, radius],
      [-Math.PI / 2, 0, 0]
    );
    const next = new THREE.Group();
    next.position.z = -length;
    joint.add(next);
    segments.push(joint);
    parent = next;
  }
  addMesh(THREE, parent, geometries.sphere, materials.fur, "tail-tip", [0, 0, -0.025], [0.048, 0.05, 0.075]);
  return { root, segments };
}

function createHarness(THREE, bodyRoot, chest, neck, geometries, materials, kind) {
  const harness = new THREE.Group();
  harness.name = "sci-fi-harness";
  bodyRoot.add(harness);

  addMesh(THREE, harness, geometries.box, materials.harness, "harness-saddle", [0, 0.335, 0.02], [0.46, 0.085, 0.48], [0.04, 0, 0]);
  addMesh(THREE, harness, geometries.box, materials.armor, "harness-spine-light", [0, 0.397, 0.02], [0.095, 0.035, 0.38]);
  for (const z of [-0.28, 0.28]) {
    addMesh(THREE, harness, geometries.box, materials.harness, "harness-band", [-0.405, 0.08, z], [0.045, 0.42, 0.105], [0, 0, -0.08]);
    addMesh(THREE, harness, geometries.box, materials.harness, "harness-band", [0.405, 0.08, z], [0.045, 0.42, 0.105], [0, 0, 0.08]);
  }
  const collar = addMesh(THREE, neck, geometries.torus, materials.armor, "tech-collar", [0, -0.015, 0.01], [0.235, 0.235, 0.18], [Math.PI / 2, 0, 0]);

  const weapon = new THREE.Group();
  weapon.name = "compact-dorsal-weapon";
  const weaponLength = kind === "sniper" ? 0.82 : kind === "sentinel" ? 0.58 : 0.5;
  const weaponX = kind === "sentinel" ? 0 : 0.285;
  weapon.position.set(weaponX, 0.455, 0.13);
  bodyRoot.add(weapon);
  addMesh(THREE, weapon, geometries.box, materials.harness, "weapon-receiver", [0, 0, 0], [kind === "sentinel" ? 0.34 : 0.19, 0.17, 0.34]);
  addMesh(THREE, weapon, geometries.cylinder, materials.armor, "weapon-barrel", [0, 0.012, weaponLength * 0.48], [0.052, weaponLength, 0.052], [Math.PI / 2, 0, 0]);
  addMesh(THREE, weapon, geometries.box, materials.glow, "weapon-energy-cell", [0, 0.105, -0.04], [kind === "sentinel" ? 0.19 : 0.08, 0.035, 0.2]);

  if (kind === "sniper") {
    addMesh(THREE, weapon, geometries.cylinder, materials.glow, "sniper-optic", [0, 0.14, 0.02], [0.052, 0.23, 0.052], [0, 0, Math.PI / 2]);
  } else if (kind === "sentinel") {
    addMesh(THREE, weapon, geometries.box, materials.armor, "sentinel-left-cell", [-0.13, 0.02, 0.2], [0.08, 0.12, 0.35]);
    addMesh(THREE, weapon, geometries.box, materials.armor, "sentinel-right-cell", [0.13, 0.02, 0.2], [0.08, 0.12, 0.35]);
  }

  const muzzleFlash = addMesh(
    THREE,
    weapon,
    geometries.cone,
    materials.muzzleFlash,
    "weapon-muzzle-flash",
    [0, 0.012, weaponLength + 0.04],
    [0.12, 0.3, 0.12],
    [Math.PI / 2, 0, 0]
  );
  muzzleFlash.visible = false;

  const armorPlates = [];
  if (kind === "sentinel") {
    for (const side of [-1, 1]) {
      armorPlates.push(addMesh(THREE, chest, geometries.sphere, materials.armor, "sentinel-shoulder-plate", [side * 0.39, 0.07, 0.02], [0.12, 0.25, 0.28]));
    }
  }
  if (kind === "scout") {
    armorPlates.push(addMesh(THREE, harness, geometries.box, materials.armor, "scout-back-fin", [0, 0.12, -0.29], [0.035, 0.22, 0.18], [0.25, 0, 0]));
  }

  return { harness, collar, weapon, muzzleFlash, armorPlates, weaponLength };
}

/**
 * Creates a procedural quadruped combat cat. Local +Y is up and local +Z is forward.
 * @param {object} THREE Three.js namespace.
 * @param {object} [options]
 * @returns {{visual: object, parts: object, state: object}}
 */
export function createCombatCat(THREE, options = {}) {
  if (!THREE?.Group || !THREE?.Mesh) {
    throw new TypeError("createCombatCat requires the Three.js namespace as its first argument.");
  }

  const requestedKind = options.enemyKind || options.kind;
  const hostile = Boolean(options.hostile || ["scout", "sentinel", "sniper"].includes(requestedKind));
  const kind = hostile && ["scout", "sentinel", "sniper"].includes(requestedKind) ? requestedKind : hostile ? "scout" : "player";
  const palette = makePalette(options, hostile, kind);
  const materials = createMaterials(THREE, palette);
  const geometries = createGeometries(THREE);

  const visual = new THREE.Group();
  visual.name = hostile ? `combat-cat-enemy-${kind}` : "combat-cat-player";
  visual.scale.setScalar(options.scale ?? 1);

  const bodyRoot = new THREE.Group();
  bodyRoot.name = "cat-body-root";
  visual.add(bodyRoot);

  const spine = new THREE.Group();
  spine.name = "cat-spine";
  spine.position.set(0, 0.03, -0.12);
  bodyRoot.add(spine);
  addMesh(THREE, spine, geometries.sphere, materials.fur, "cat-abdomen", [0, 0, 0.06], [0.36, 0.275, 0.69]);
  addMesh(THREE, spine, geometries.sphere, materials.underside, "cat-belly", [0, -0.205, 0.08], [0.28, 0.09, 0.53]);

  const hips = new THREE.Group();
  hips.name = "cat-hips";
  hips.position.set(0, 0.045, -0.48);
  bodyRoot.add(hips);
  addMesh(THREE, hips, geometries.sphere, materials.fur, "cat-rump", [0, 0, 0], [0.43, 0.34, 0.49]);

  const chest = new THREE.Group();
  chest.name = "cat-chest";
  chest.position.set(0, 0.075, 0.35);
  bodyRoot.add(chest);
  addMesh(THREE, chest, geometries.sphere, materials.fur, "cat-ribcage", [0, 0, 0], [0.445, 0.385, 0.48]);
  addMesh(THREE, chest, geometries.sphere, materials.underside, "cat-chest-ruff", [0, -0.13, 0.32], [0.25, 0.245, 0.19]);

  const neck = new THREE.Group();
  neck.name = "cat-neck";
  neck.position.set(0, 0.12, 0.29);
  chest.add(neck);
  addMesh(THREE, neck, geometries.taperedCylinder, materials.fur, "cat-neck-mesh", [0, 0.09, 0.08], [0.235, 0.31, 0.225], [0.52, 0, 0]);

  const head = new THREE.Group();
  head.name = "cat-head";
  head.position.set(0, 0.255, 0.255);
  neck.add(head);
  addMesh(THREE, head, geometries.sphere, materials.fur, "cat-skull", [0, 0, 0], [0.345, 0.305, 0.35]);
  addMesh(THREE, head, geometries.sphere, materials.fur, "left-cheek", [-0.23, -0.08, 0.16], [0.17, 0.18, 0.2]);
  addMesh(THREE, head, geometries.sphere, materials.fur, "right-cheek", [0.23, -0.08, 0.16], [0.17, 0.18, 0.2]);
  const face = createFace(THREE, head, geometries, materials);
  const ears = createEars(THREE, head, geometries, materials);

  const legs = {
    frontLeft: createLeg(THREE, chest, geometries, materials, {
      name: "front-left-leg", x: -0.355, y: 0.01, z: 0.08, side: -1, fore: true,
      upperLength: 0.37, lowerLength: 0.46, restUpper: 0.1, restLower: -0.08,
      walkOffset: 0, trotOffset: 0, gallopOffset: Math.PI + 0.34,
    }),
    frontRight: createLeg(THREE, chest, geometries, materials, {
      name: "front-right-leg", x: 0.355, y: 0.01, z: 0.08, side: 1, fore: true,
      upperLength: 0.37, lowerLength: 0.46, restUpper: 0.1, restLower: -0.08,
      walkOffset: Math.PI, trotOffset: Math.PI, gallopOffset: Math.PI,
    }),
    hindLeft: createLeg(THREE, hips, geometries, materials, {
      name: "hind-left-leg", x: -0.36, y: 0, z: -0.03, side: -1, fore: false,
      upperLength: 0.39, lowerLength: 0.43, restUpper: -0.32, restLower: 0.53,
      walkOffset: Math.PI * 1.5, trotOffset: Math.PI, gallopOffset: 0.3,
    }),
    hindRight: createLeg(THREE, hips, geometries, materials, {
      name: "hind-right-leg", x: 0.36, y: 0, z: -0.03, side: 1, fore: false,
      upperLength: 0.39, lowerLength: 0.43, restUpper: -0.32, restLower: 0.53,
      walkOffset: Math.PI * 0.5, trotOffset: 0, gallopOffset: 0,
    }),
  };
  const legList = [legs.frontLeft, legs.frontRight, legs.hindLeft, legs.hindRight];
  const tail = createTail(THREE, hips, geometries, materials);
  const tech = createHarness(THREE, bodyRoot, chest, neck, geometries, materials, kind);

  const parts = {
    bodyRoot,
    spine,
    chest,
    hips,
    neck,
    head,
    muzzle: face.muzzle,
    nose: face.nose,
    whiskers: face.whiskers,
    eyes: face.eyes,
    ears,
    leftEar: ears.left,
    rightEar: ears.right,
    legs,
    legList,
    frontLeftLeg: legs.frontLeft,
    frontRightLeg: legs.frontRight,
    hindLeftLeg: legs.hindLeft,
    hindRightLeg: legs.hindRight,
    tail,
    tailSegments: tail.segments,
    harness: tech.harness,
    collar: tech.collar,
    weapon: tech.weapon,
    muzzleFlash: tech.muzzleFlash,
    armorPlates: tech.armorPlates,
    materials,
    geometries,
  };

  const initialTailPitch = tail.segments.map((_, index) => index === 0 ? 0.24 : index === 1 ? 0.11 : -0.018);
  tail.segments.forEach((segment, index) => {
    segment.rotation.x = initialTailPitch[index];
  });

  const state = {
    kind,
    hostile,
    maxSpeed: Math.max(0.1, options.maxSpeed ?? 14),
    elapsed: 0,
    phase: Number.isFinite(options.gaitOffset) ? options.gaitOffset : 0,
    gait: "idle",
    speed: 0,
    grounded: true,
    wasGrounded: true,
    airborne: 0,
    landing: 0,
    landingVelocity: 0,
    recoil: 0,
    previousTurning: 0,
    tailYaw: tail.segments.map(() => 0),
    tailYawVelocity: tail.segments.map(() => 0),
    tailPitch: initialTailPitch.slice(),
    tailPitchVelocity: tail.segments.map(() => 0),
    weaponBase: tech.weapon.position.clone(),
    eyeBaseScaleY: 1,
    pawContacts: {
      frontLeft: true,
      frontRight: true,
      hindLeft: true,
      hindRight: true,
    },
  };

  setShadows(visual, options.castShadow !== false, options.receiveShadow !== false);
  visual.userData.combatCat = { kind, hostile };
  return { visual, parts, state };
}

function gaitWeights(speed01) {
  const moving = smoothstep(0.015, 0.08, speed01);
  let walk = (1 - smoothstep(0.3, 0.5, speed01)) * moving;
  let trot = smoothstep(0.25, 0.48, speed01) * (1 - smoothstep(0.67, 0.86, speed01));
  let gallop = smoothstep(0.64, 0.9, speed01);
  const sum = walk + trot + gallop;
  if (sum > 1e-5) {
    walk /= sum;
    trot /= sum;
    gallop /= sum;
  }
  return { moving, walk, trot, gallop };
}

function animateLeg(leg, phase, weights, controls, dt) {
  const walkPhase = phase + leg.walkOffset;
  const trotPhase = phase + leg.trotOffset;
  const gallopPhase = phase + leg.gallopOffset;
  const walkMotion = Math.sin(walkPhase);
  const trotMotion = Math.sin(trotPhase);
  const gallopMotion = Math.sin(gallopPhase);
  const walkLift = Math.max(0, Math.cos(walkPhase));
  const trotLift = Math.max(0, Math.cos(trotPhase));
  const gallopLift = Math.max(0, Math.cos(gallopPhase));

  let stride = weights.walk * walkMotion * 0.3 + weights.trot * trotMotion * 0.48 + weights.gallop * gallopMotion * 0.67;
  let lift = weights.walk * walkLift * 0.25 + weights.trot * trotLift * 0.48 + weights.gallop * gallopLift * 0.68;
  stride *= weights.moving * (leg.fore ? 0.92 : 1.04);
  lift *= weights.moving;

  let upperTarget = leg.restUpper + stride;
  let lowerTarget = leg.restLower + lift * (leg.fore ? 0.7 : 0.9);

  if (!controls.grounded) {
    const velocityMagnitude = Math.abs(controls.normalVelocity);
    const apexTuck = 1 - smoothstep(0.7, 5.5, velocityMagnitude);
    const risingStretch = smoothstep(3, 9, controls.normalVelocity);
    const landingReach = smoothstep(1.5, 8, -controls.normalVelocity);
    const dashStretch = controls.dash;
    if (leg.fore) {
      upperTarget = leg.restUpper + apexTuck * 0.32 - risingStretch * 0.28 - landingReach * 0.2 - dashStretch * 0.38;
      lowerTarget = leg.restLower + apexTuck * 0.58 - landingReach * 0.12 + dashStretch * 0.08;
    } else {
      upperTarget = leg.restUpper + apexTuck * 0.48 + risingStretch * 0.34 - landingReach * 0.08 + dashStretch * 0.52;
      lowerTarget = leg.restLower + apexTuck * 0.78 - landingReach * 0.24 - dashStretch * 0.34;
    }
  } else {
    lowerTarget += controls.landing * (leg.fore ? 0.44 : 0.62);
    upperTarget += controls.landing * (leg.fore ? 0.1 : 0.18);
  }

  const response = controls.grounded ? 17 : 10;
  leg.upper.rotation.x = damp(leg.upper.rotation.x, upperTarget, response, dt);
  leg.lower.rotation.x = damp(leg.lower.rotation.x, lowerTarget, response, dt);
  const pawLevel = controls.grounded
    ? -(upperTarget + lowerTarget) + lift * 0.12
    : -(upperTarget + lowerTarget) * (0.45 + controls.landing * 0.25);
  leg.paw.rotation.x = damp(leg.paw.rotation.x, pawLevel, response * 1.2, dt);
  const lateral = leg.side * (0.035 + controls.landing * 0.045) - controls.turning * (leg.fore ? 0.045 : -0.035);
  leg.root.rotation.z = damp(leg.root.rotation.z, lateral, 12, dt);
  return controls.grounded && lift < 0.16;
}

function animateTail(rig, controls, time, dt) {
  const { parts, state } = rig;
  const turnRate = dt > 1e-5 ? clamp((controls.turning - state.previousTurning) / dt, -8, 8) : 0;
  state.previousTurning = controls.turning;
  const motionWave = Math.sin(time * (1.7 + controls.speed01 * 2.1) - state.phase * 0.2);

  for (let i = 0; i < parts.tail.segments.length; i += 1) {
    const tipFactor = i / Math.max(1, parts.tail.segments.length - 1);
    const previousLag = i > 0 ? state.tailYaw[i - 1] * 0.18 : 0;
    const yawTarget =
      -controls.turning * (0.055 + tipFactor * 0.025)
      -turnRate * (0.002 + tipFactor * 0.006)
      +motionWave * (0.012 + tipFactor * 0.018) * (0.35 + controls.speed01)
      +previousLag;
    const restPitch = i === 0 ? 0.24 : i === 1 ? 0.11 : -0.018 - tipFactor * 0.018;
    const pitchTarget =
      restPitch
      + controls.airborne * (0.08 - tipFactor * 0.03)
      - controls.dash * restPitch * 0.65
      + Math.cos(time * 1.35 - i * 0.48) * (0.008 + tipFactor * 0.009);
    const stiffness = 31 - i * 2.1;
    const damping = 7.2 - i * 0.28;

    state.tailYawVelocity[i] += (yawTarget - state.tailYaw[i]) * stiffness * dt;
    state.tailYawVelocity[i] *= Math.exp(-damping * dt);
    state.tailYaw[i] += state.tailYawVelocity[i] * dt;
    state.tailPitchVelocity[i] += (pitchTarget - state.tailPitch[i]) * stiffness * 0.82 * dt;
    state.tailPitchVelocity[i] *= Math.exp(-(damping + 0.4) * dt);
    state.tailPitch[i] += state.tailPitchVelocity[i] * dt;

    parts.tail.segments[i].rotation.y = state.tailYaw[i];
    parts.tail.segments[i].rotation.x = state.tailPitch[i];
  }
}

/**
 * Animates a rig returned by createCombatCat.
 * speed is in world units/second and normalVelocity is positive along local +Y.
 * @param {object} THREE Three.js namespace.
 * @param {{visual: object, parts: object, state: object}} rig
 * @param {{dt?: number, time?: number, speed?: number, grounded?: boolean, normalVelocity?: number, dash?: number|boolean, turning?: number, aiming?: number|boolean, firePulse?: number|boolean}} [params]
 * @returns {{gait: string, speed01: number, landing: number}}
 */
export function animateCombatCat(THREE, rig, params = {}) {
  if (!THREE?.MathUtils || !rig?.parts || !rig?.state) {
    throw new TypeError("animateCombatCat requires Three.js and a rig returned by createCombatCat.");
  }

  const { parts, state } = rig;
  const dt = clamp(Number.isFinite(params.dt) ? params.dt : 1 / 60, 0, 1 / 20);
  state.elapsed += dt;
  const time = Number.isFinite(params.time) ? params.time : state.elapsed;
  const grounded = params.grounded !== false;
  const normalVelocity = Number.isFinite(params.normalVelocity) ? params.normalVelocity : 0;
  const dash = amount(params.dash);
  const aiming = amount(params.aiming);
  const firePulse = amount(params.firePulse);
  const turning = signedAmount(params.turning);
  const speed = Math.max(0, Number.isFinite(params.speed) ? Math.abs(params.speed) : 0);
  state.speed = damp(state.speed, speed, grounded ? 9 : 4, dt);
  const speed01 = saturate(state.speed / state.maxSpeed);
  const weights = gaitWeights(speed01);

  if (weights.gallop > 0.55 || dash > 0.4) state.gait = "gallop";
  else if (weights.trot > 0.55) state.gait = "trot";
  else if (weights.walk > 0.2) state.gait = "walk";
  else state.gait = "idle";

  const cadence = weights.moving * (0.75 + speed01 * 2.65 + dash * 0.65);
  state.phase = (state.phase + dt * TAU * cadence) % TAU;
  if (grounded && !state.wasGrounded) {
    state.landing = Math.max(state.landing, 0.24 + saturate(Math.abs(normalVelocity) / 12) * 0.76);
    state.landingVelocity = Math.min(state.landingVelocity, 0);
  }
  state.wasGrounded = grounded;
  state.grounded = grounded;
  state.airborne = damp(state.airborne, grounded ? 0 : 1, grounded ? 14 : 8, dt);
  state.landingVelocity += (-82 * state.landing - 14 * state.landingVelocity) * dt;
  state.landing += state.landingVelocity * dt;
  if (Math.abs(state.landing) < 0.0005 && Math.abs(state.landingVelocity) < 0.002) {
    state.landing = 0;
    state.landingVelocity = 0;
  }
  state.landing = clamp(state.landing, -0.12, 1);
  state.recoil = Math.max(state.recoil, firePulse);
  state.recoil = damp(state.recoil, 0, 19, dt);

  const controls = {
    grounded,
    normalVelocity,
    dash,
    turning,
    aiming,
    landing: Math.max(0, state.landing),
    airborne: state.airborne,
    speed01,
  };
  state.pawContacts.frontLeft = animateLeg(parts.legs.frontLeft, state.phase, weights, controls, dt);
  state.pawContacts.frontRight = animateLeg(parts.legs.frontRight, state.phase, weights, controls, dt);
  state.pawContacts.hindLeft = animateLeg(parts.legs.hindLeft, state.phase, weights, controls, dt);
  state.pawContacts.hindRight = animateLeg(parts.legs.hindRight, state.phase, weights, controls, dt);

  const strideWave = Math.sin(state.phase * 2);
  const gallopWave = Math.sin(state.phase);
  const breathing = Math.sin(time * 2.15) * 0.008;
  const bob = grounded
    ? Math.abs(strideWave) * speed01 * (0.025 + weights.gallop * 0.025)
    : normalVelocity * 0.0025;
  parts.bodyRoot.position.y = damp(
    parts.bodyRoot.position.y,
    breathing + bob - Math.max(0, state.landing) * 0.14,
    grounded ? 15 : 7,
    dt
  );
  parts.bodyRoot.rotation.z = damp(parts.bodyRoot.rotation.z, -turning * (0.045 + speed01 * 0.035), 9, dt);
  parts.bodyRoot.rotation.x = damp(
    parts.bodyRoot.rotation.x,
    dash * 0.1 + weights.gallop * gallopWave * speed01 * 0.035 - state.landing * 0.04,
    10,
    dt
  );

  const spineFlex = grounded ? gallopWave * speed01 * (0.025 + weights.gallop * 0.065) : -normalVelocity * 0.004;
  parts.spine.rotation.x = damp(parts.spine.rotation.x, spineFlex, 10, dt);
  parts.hips.rotation.x = damp(parts.hips.rotation.x, -spineFlex * 0.85 + Math.max(0, state.landing) * 0.09, 11, dt);
  parts.chest.rotation.x = damp(parts.chest.rotation.x, spineFlex * 0.48 - Math.max(0, state.landing) * 0.08, 12, dt);
  parts.chest.rotation.y = damp(parts.chest.rotation.y, turning * 0.055, 9, dt);
  parts.neck.rotation.x = damp(parts.neck.rotation.x, -spineFlex * 0.68 + aiming * 0.025, 10, dt);
  parts.neck.rotation.y = damp(parts.neck.rotation.y, turning * 0.075, 10, dt);
  parts.head.rotation.x = damp(parts.head.rotation.x, -spineFlex * (0.7 - aiming * 0.45) - state.landing * 0.035, 13, dt);
  parts.head.rotation.y = damp(parts.head.rotation.y, turning * 0.12, 11, dt);
  parts.head.rotation.z = damp(parts.head.rotation.z, turning * -0.025, 10, dt);

  const earFlatten = dash * 0.55 + firePulse * 0.45 + speed01 * 0.12;
  parts.ears.left.rotation.x = damp(parts.ears.left.rotation.x, -earFlatten + turning * 0.08, 15, dt);
  parts.ears.right.rotation.x = damp(parts.ears.right.rotation.x, -earFlatten - turning * 0.08, 15, dt);
  parts.ears.left.rotation.z = damp(parts.ears.left.rotation.z, 0.09 - turning * 0.11 - aiming * 0.035, 13, dt);
  parts.ears.right.rotation.z = damp(parts.ears.right.rotation.z, -0.09 - turning * 0.11 + aiming * 0.035, 13, dt);

  const blinkCycle = ((time + (state.hostile ? 0.8 : 0)) % 4.7) / 4.7;
  const blink = blinkCycle > 0.965 ? Math.sin(((blinkCycle - 0.965) / 0.035) * Math.PI) : 0;
  const eyeScaleY = Math.max(0.08, 1 - blink * 0.92);
  parts.eyes.left.group.scale.y = eyeScaleY;
  parts.eyes.right.group.scale.y = eyeScaleY;

  parts.weapon.position.copy(state.weaponBase);
  parts.weapon.position.z -= state.recoil * 0.075;
  parts.weapon.rotation.x = damp(parts.weapon.rotation.x, aiming * -0.035 + state.recoil * 0.045, 18, dt);
  parts.muzzleFlash.visible = firePulse > 0.015 || state.recoil > 0.12;
  const flash = Math.max(firePulse, state.recoil * 0.45);
  parts.muzzleFlash.material.opacity = flash;
  parts.muzzleFlash.scale.set(
    0.12 * (0.75 + flash * 0.7),
    0.3 * (0.65 + flash * 1.2),
    0.12 * (0.75 + flash * 0.7)
  );
  parts.muzzleFlash.rotation.y = time * 19;

  animateTail(rig, controls, time, dt);
  return { gait: state.gait, speed01, landing: state.landing };
}
