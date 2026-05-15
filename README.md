# Maze Heli Command

Two-player 3D helicopter maze game with a Node/WebSocket server.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:5173`.

## Deploy

This game needs a real WebSocket-capable Node server for stable multiplayer. Temporary tunnel services can drop connections and add enough latency that the other player does not look live.

The included `render.yaml` can deploy the app as a Render web service after the repo is pushed to GitHub/GitLab/Bitbucket.
