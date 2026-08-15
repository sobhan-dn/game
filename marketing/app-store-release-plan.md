# Void Spheres: Riftbound App Store Release Plan

## Positioning

Void Spheres: Riftbound is positioned as a quick-session arena battler for players who want fast action without a long tutorial or heavy progression grind.

Core hook: instant sphere battles with Rift Shards, Surge bursts, streaks, coins, daily targets, and best-score chasing in a neon 3D arena.

## App Store Listing

- Name: Void Spheres: Riftbound
- Subtitle: Fast Rift Arena Battles
- Category: Games
- Suggested subcategory: Action
- Age rating direction: Complete Apple's questionnaire based on final violence/combat answers.
- Bundle ID: `com.syd-sbn.voidspheres`
- Encryption: non-exempt encryption disabled in `Info.plist`

## Screenshot Set

Ready screenshots are in `marketing/app-store-screenshots/`:

1. `01-mode-select.png` - Offline Solo Raid launch screen with adaptive AI positioning.
2. `02-live-arena.png` - Main Solar System arena and touch HUD.
3. `03-aim-fire.png` - Touch-control aiming, firing, and hostile cats.
4. `04-streak-coins.png` - Phase Dash combat feedback and projectile evasion.
5. `05-two-minute-score.png` - Planet-to-planet long-jump traversal.

Recommended App Store Connect sizes:

- 6.7-inch iPhone: 1290 x 2796
- 6.5-inch iPhone: 1242 x 2688
- 5.5-inch iPhone: 1242 x 2208

## Launch Campaign

- Day -7: publish a 10-15 second gameplay clip focused on one clean combat moment.
- Day -5: post the app icon and a short "outsmart the AI" hook.
- Day -3: post a carousel with three mechanics: jump, shoot, survive.
- Day -1: publish the App Store pre-order or launch reminder link.
- Launch day: push one direct call to action: "Download Void Spheres: Riftbound and win your first Rift battle."
- Day +2: post a short clip showing the highest-score moment from testing.
- Day +7: ask early players for reviews after a clean win/rematch session.

## Paid Test

Run a small creative test before scaling:

- Audience: mobile action game players, arcade action interests.
- Creatives: app icon, 10-second gameplay clip, 3-screenshot carousel.
- Primary metric: App Store product page conversion rate.
- Kill rule: pause any creative under 2% click-through rate after enough impressions.
- Scale rule: increase spend only on creatives with both strong click-through and install conversion.

## Store Optimization

Use the subtitle and first two description lines to sell the loop immediately:

Offline-ready solo sphere battles against adaptive AI, with no account required. Jump, collect Rift Shards, trigger Surge bursts, and chase streak bonuses across floating neon arenas.

Secondary retention line:

Earn coins, complete the daily target, and come back to beat your best score and fastest Surge routes.

Keywords to test over time:

jumper, arena, action, shooter, platformer, rift, surge, shards, ai, offline, neon, 3D, battle

## Monetization Roadmap

Ship free first and measure retention. The current native iOS build now has the first monetization layer:

- Standard interstitial: one preloaded ad at the natural break after each completed match, with fail-open behavior for offline, consent, no-fill, initialization, and presentation failures.
- Rewarded ad (future, optional only): continue after death or a coin bonus after a match. It must always provide a no-ad path.
- Cosmetic purchase: sphere trails, player glow colors, projectile skins.
- No pay-to-win damage or health boosts in version 1.

Before release, replace Google's sample App ID and interstitial unit with identifiers owned by this app, disable testing mode, publish that account's `app-ads.txt` at the root of the verified developer website domain, verify the bundled SKAdNetwork entries against Google's current list, and complete App Store privacy disclosures. Monitor Day-1 retention, ad frequency, and reviews after launch.

## Final Manual Steps

1. Replace the sample identifiers, then run `npm run ios:release:prepare`; do not archive if this production guard fails. Open `ios/App/App.xcodeproj` in Xcode afterward.
2. Select target `App`, set the Apple Developer Team, and confirm bundle ID ownership.
3. Build on a real iPhone and verify offline fallback, consent/privacy options, one post-match ad per completed match, touch controls, icon, launch screen, and audio restoration.
4. Archive with Release configuration.
5. Upload the archive to App Store Connect.
6. Create the app record and paste the metadata from `fastlane/metadata/en-US`.
7. Merge the release PR, enable GitHub Pages with GitHub Actions as the publishing source, then confirm `https://sobhan-dn.github.io/game/`, `/support.html`, and `/privacy.html` are live. Publish the production AdMob publisher record at the root-domain `https://sobhan-dn.github.io/app-ads.txt` (not under `/game/`) before submission.
8. Add final screenshots and privacy answers.
9. Paste `marketing/review-notes.txt` into App Review Notes so Apple can test the unique Rift Shard / Rift Surge loop.
10. Submit for App Review.
