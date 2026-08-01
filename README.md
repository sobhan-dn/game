# Void Spheres: Riftbound

A fast Three.js arena game starring articulated quadruped combat cats. It combines radial gravity, all eight Solar System planets with distinct surfaces/atmospheres/rings/moons, projectile combat, Rift Shards, Phase Dash, hostile cat archetypes, and an adaptive AI rival. The game is fully offline and single-player, with an interface and touch controls tuned for desktop browsers and iPhone.

The cat rigs are procedural and animate a four-beat walk, diagonal trot, gallop, airborne tuck/stretch, landing compression, weapon recoil, ears, spine, paws, and a spring-damped seven-segment tail. No humanoid FBX is used at runtime.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:5173`.

## Open the HTML file directly

`index.html` can also be opened by double-clicking it. The page loads the standalone `game.bundle.js`, which includes Three.js, the cat rig, and the planet/sky textures without requiring a local web server.

`npm start` refreshes the standalone bundle automatically. After changing `game.js` or any texture, you can also rebuild it directly:

```bash
npm run build
```

## Controls

- `WASD` / arrows: move around the current sphere
- Mouse / right-side touch drag: aim horizontally and vertically
- `Space`: jump between gravity fields
- `Shift`, `Q`, or right-click: Phase Dash
- Click / `Enter`: fire
- `E`: activate a charged Rift Surge
- `P`: pause a solo match
- `F`: fullscreen
- `M`: mute

## Adaptive combat

- A combat director limits simultaneous attackers, varies pressure with player health and score, and gives every hostile shot a readable warning.
- Players have a 30-point regenerating Guard layer. A Phase Dash through a nearby hostile projectile parries it and grants Rift energy.
- Shooting an enemy during its wind-up interrupts the attack; narrowly dodging a projectile also earns a small Rift/Guard reward.
- Scout, Sentinel, and Sniper enemies now use distinct ranges, timing, accuracy, recovery, target selection, and visible health feedback.
- Solo AI alternates between contesting enemies and pressuring the player, leads moving targets imperfectly, keeps tactical spacing, and reacts to incoming shots.

On touch devices, use the left stick to move, swipe the right side to aim, and use the labeled `JUMP`, `FIRE`, `PARRY`, and `RIFT` buttons. The small button at the upper-right pauses solo matches.

## Build the iPhone app

```bash
npm run ios:sync
npx cap open ios
```

In Xcode, select the `App` scheme, set your Apple Developer Team, then archive for App Store Connect. The iOS bundle id is `com.syd-sbn.voidspheres`.

## App Store launch assets

- App icon: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png`
- Store metadata: `fastlane/metadata/en-US/`
- Release and marketing plan: `marketing/app-store-release-plan.md`
- Draft privacy/support pages: `marketing/privacy-policy.md` and `marketing/support-page.md`
- App Review notes: `marketing/review-notes.txt`

Before submission, merge the release pull request, enable GitHub Pages with **GitHub Actions** as the publishing source, and confirm the App Store support, privacy, and marketing URLs are live. The iOS game itself runs fully offline and does not depend on the website.

## Publish the optional web preview

The included `.github/workflows/pages.yml` builds and publishes the optional browser preview plus the static support and privacy pages to `https://sobhan-dn.github.io/game/` after changes land on `master`. The packaged iOS game remains fully offline.
