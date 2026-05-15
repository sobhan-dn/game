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

## TODO

- Push the repo to GitHub/GitLab/Bitbucket before deploying with `render.yaml`; there is no git remote configured yet.
