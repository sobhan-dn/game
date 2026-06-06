# Speedy jumper

Three.js action platformer with textured floating spheres, shooting, enemies, scoring, and mobile touch controls. The Node server serves the game and can relay realtime WebSocket messages for player roles, movement, shots, damage, and restart events.

## Run locally

```bash
npm install
npm start
```

Open `http://localhost:5173`.

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

Before submission, replace the TODO support and marketing URLs with real public links.

## Deploy

The included `render.yaml` deploys the static game through a small Node web server on Render.
