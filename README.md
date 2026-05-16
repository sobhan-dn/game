# Void Spheres Duel

Online two-player Three.js action platformer with textured floating spheres, shooting, enemies, scoring, and mobile touch controls. The Node server serves the game and relays realtime WebSocket messages for player roles, movement, shots, damage, and restart events.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:5173`.

## Deploy

The included `render.yaml` deploys the static game through a small Node web server on Render.
