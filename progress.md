Original prompt: یک بازی سه بعدی با سرور دائمی و دو نفره بساز که با هلیکوپتر بالای سر یک maze پر پیچ و خم هستیم که سربازانی توش حرکت میکنند هم مال ما هم مال دشمن که اونم هلیکوپتر داره و باید با تیر یا دشمنان رو بزنم یا شیلد بزنیم روی یارای خودمون

## Progress

- Replaced the previous flash-card app with a Three.js helicopter maze game.
- Added a Node HTTP + WebSocket server for two-player realtime state.
- Added local fallback mode if the WebSocket server is not running.

## Verification Notes

- Installed npm dependencies and Playwright Chromium.
- Ran the server at http://localhost:5173.
- Verified gameplay with the develop-web-game Playwright client after joining the blue team.
- Verified two simultaneous browser pages joining blue/red, no console errors, synchronized helicopters/soldiers, and visible shield effect.
- Added and smoke-tested mobile touch controls for iPhone viewport.
- Reduced realtime network load: client input is throttled, server snapshots are smaller and sent at 20Hz, remote motion is interpolated, and WebSocket ping/pong cleanup was added.
- Added `render.yaml` for deploying to a real WebSocket-capable server on Render.
- Pushed the deploy-ready game to GitHub repo `sobhan-dn/game` on `master` via GitHub connector commit `9d83140b49123576ed42abe32ecb766ff466d036`.
- Attempted Render CLI login; blocked because Safari/Render requires GitHub credentials or Render account authorization.

## TODO

- Complete Render authentication, then deploy `https://github.com/sobhan-dn/game` using the included `render.yaml`.

## 2026-05-16 Replacement

- Replaced the deployed game content with the `Void Spheres` game from `/Users/sobhan/Desktop/hi/هار هار/ظلام`.
- Swapped the old WebSocket server for a small static Node server because the new game is standalone.
- Added iPhone-friendly touch controls: left joystick for movement, right-side look area, jump and fire buttons.
- Added `window.render_game_to_text` and `window.advanceTime` for automated web-game verification.
- Verified locally on `http://localhost:5174` with desktop Playwright game actions and an iPhone 14 Playwright smoke test.

## TODO

- Push the replacement to `sobhan-dn/game` on `master` and confirm Render auto-deploy goes live.

## 2026-05-16 Online Duel Upgrade

- Kept the provided texture atlas and panorama assets in `assets/textures`; their hashes match the user-provided images.
- Upgraded `Void Spheres` into an online two-player competitive duel: first browser becomes player 1, second browser becomes player 2, additional browsers become spectators.
- Added a WebSocket relay to the Node server for player state, shots, damage, enemy removals, scoring, and restarts.
- Updated the HUD and overlay for two player health bars, scores, online role status, and duel controls.
- Strengthened player/enemy visuals with distinct player tints, brighter projectiles, score feedback, and retained animated FBX character support.
- Verified locally with two simultaneous Playwright browser pages: both received separate online roles, started the game, moved independently, and produced no console/page errors.

## 2026-05-16 English Timed Duel Update

- Converted the game UI and runtime messages to English for a store-ready build.
- Added a 120-second round timer. The match ends only when time expires, then highest score wins.
- Updated scoring: destroying a red unit gives 1 point, and every successful online rival hit gives 1 point.
- Player death no longer ends the match; the player respawns after a short delay so the two-minute round keeps flowing.
- Added random red-unit respawns when the active red count drops below five, with Player 1 acting as the online spawn authority.
- Tuned the music loop to speed up in the final 30 seconds and added small haptic pulses on mobile for hits/kills.
- Optimized the iPhone viewport: English safe-area metadata, compact HUD/menu styles, larger touch controls, right-side touch look, and no external web font dependency.
- Verified desktop gameplay with the develop-web-game Playwright client and visually inspected `output/web-game/shot-0.png`.
- Verified iPhone menu and gameplay screenshots at `output/web-game/iphone-menu.png` and `output/web-game/iphone-game.png`; start button is visible and the game starts with no JS console errors.
- Verified timer expiry via `window.advanceTime(121000)`, ending with `Time is up. Draw. Final score 0-0`.

## TODO

- After GitHub connector deploy, verify the Render URL serves the updated English timed build and no longer logs missing texture 404s on Render.
- Updated Render/GitHub deployment files through the GitHub connector: English compact `index.html`, iPhone compact `styles.css`, and `server.js` runtime patches for the deployed compact game bundle.

## 2026-05-20 iPhone Role/Touch Check

- Added a persistent browser `playerId` so the server only assigns Player 1 blue and Player 2 yellow to two different browser identities; duplicate connections from the same browser become spectators.
- Extended the server runtime patch so the currently deployed compact bundle can also pass `playerId` through the WebSocket URL after deploy.
- Verified the current Render URL with an iPhone 14 Playwright context: with a first desktop player already connected, the iPhone page joined as `p2`, showed the yellow player, and joystick drag moved the player by about 18 world units.
- Verified the local updated build with an iPhone 14 Playwright context: second player joined as `p2`, yellow HUD/character rendered, joystick drag moved the player by about 16 world units, and no console/page errors were reported.

## TODO

- Push/deploy the local `game.js`, `index.html`, and `server.js` changes to GitHub/Render so the permanent URL gets the latest blue/yellow identity fix.

## 2026-05-25 iPhone App Store Packaging

- Added Capacitor 8 iOS packaging with bundle id `com.sobhandn.voidspheres` and scripts for `npm run build`, `npm run ios:sync`, and `npm run ios:open`.
- Added a clean `dist/` web export pipeline and synced the web bundle into `ios/App/App/public` for the native WebView.
- Updated the game runtime so native iOS (`voidspheres:` / `capacitor:`) connects to the hosted WebSocket server instead of trying `localhost`.
- Tuned iPhone rendering: lower mobile pixel ratio cap, high-performance WebGL preference, mobile antialias reduction, safe-area sizing, disabled text callouts/tap highlights, and more compact portrait HUD.
- Added native App Store readiness metadata: fullscreen iPhone target, hidden status bar, encryption export flag, and `PrivacyInfo.xcprivacy`.
- Verified `npm run ios:sync`, `xcodebuild -resolvePackageDependencies`, and `xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug -destination 'platform=iOS Simulator,name=iPhone 17' build`.
- Installed and launched the built app on the iPhone 17 simulator and captured `output/web-game/native-ios-after-load.png`.
- Verified two-client local gameplay with an iPhone Playwright context; Player 1 and Player 2 entered `playing`, `peer: true`, `ready: true`, with no console/page errors.

## TODO

- In Xcode, set the real Apple Developer Team/signing profile and archive a Release build for App Store Connect.
- Confirm the hosted WebSocket URL `wss://maze-heli-command.onrender.com` is the production server you want before review.

## 2026-05-20 Role Lock And Start Gate

- Added a start gate: the match does not enter `playing` until both Player 1 blue and Player 2 yellow are online.
- Added stable server role slots: a connected yellow player does not get promoted to blue if blue disconnects; a new different player fills the freed blue slot.
- Tightened duplicate identity handling: a second connection with the same `playerId` is a spectator, not another blue/yellow controller.
- Verified locally against the Render-target compact build: one-player start stayed in menu with `Waiting for second player`; two-player start entered playing; iPhone Player 2 joystick moved the yellow character while Player 1 stayed separate.
