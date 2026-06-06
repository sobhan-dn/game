# Speedy jumper App Store Release Plan

## Positioning

Speedy jumper is positioned as a quick-session arena battler for players who want fast action without a long tutorial or heavy progression grind.

Core hook: instant sphere battles with streaks, coins, daily targets, and best-score chasing in a neon 3D arena.

## App Store Listing

- Name: Speedy jumper
- Subtitle: Fast sphere jumping battles
- Category: Games
- Suggested subcategory: Action
- Age rating direction: Complete Apple's questionnaire based on final violence/combat answers.
- Bundle ID: `com.syd-sbn.voidspheres`
- Encryption: non-exempt encryption disabled in `Info.plist`

## Screenshot Set

Create screenshots for these moments:

1. Startup screen with instant match call to action.
2. Mid-air jump with projectiles crossing the arena.
3. Enemy pressure with the score visible.
4. Streak bonus, coins, or daily-target moment.
5. Restart/rematch state after a duel ends.

Recommended App Store Connect sizes:

- 6.7-inch iPhone: 1290 x 2796
- 6.5-inch iPhone: 1242 x 2688
- 5.5-inch iPhone: 1242 x 2208

## Launch Campaign

- Day -7: publish a 10-15 second gameplay clip focused on one clean duel moment.
- Day -5: post the app icon and a short "challenge a friend" hook.
- Day -3: post a carousel with three mechanics: jump, shoot, survive.
- Day -1: publish the App Store pre-order or launch reminder link.
- Launch day: push one direct call to action: "Download Speedy jumper and win your first duel."
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

Jump, shoot, survive, and chase streak bonuses across floating neon arenas.

Secondary retention line:

Earn coins, complete the daily target, and come back to beat your best score.

Keywords to test over time:

jumper, arena, action, shooter, platformer, ai, offline, coins, streak, neon, 3D, battle

## Monetization Roadmap

Do not make the first release paid. Ship free first and measure retention.

Best first monetization path after gameplay validation:

- Rewarded ad: optional continue after death or +25 coin bonus after a match.
- Cosmetic purchase: sphere trails, player glow colors, projectile skins.
- No pay-to-win damage or health boosts in version 1.

Add ads only after the game has stable Day-1 retention. If retention is weak, ads will reduce reviews and hurt growth.

## Final Manual Steps

1. Open `ios/App/App.xcodeproj` in Xcode.
2. Select target `App`, set the Apple Developer Team, and confirm bundle ID ownership.
3. Build on a real iPhone and verify touch controls, networking, icon, launch screen, and audio state.
4. Archive with Release configuration.
5. Upload the archive to App Store Connect.
6. Create the app record and paste the metadata from `fastlane/metadata/en-US`.
7. Replace TODO support/marketing URLs with real public URLs.
8. Add final screenshots and privacy answers.
9. Submit for App Review.
