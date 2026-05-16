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
