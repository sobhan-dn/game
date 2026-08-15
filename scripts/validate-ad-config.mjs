import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sampleAppId = "ca-app-pub-3940256099942544~1458002511";
const sampleInterstitialId = "ca-app-pub-3940256099942544/4411468910";
const requireProduction = process.env.REQUIRE_PRODUCTION_ADS === "1";

const [adsSource, infoPlist] = await Promise.all([
  readFile(path.join(root, "ads.js"), "utf8"),
  readFile(path.join(root, "ios/App/App/Info.plist"), "utf8"),
]);

const interstitialId = adsSource.match(/GOOGLE_IOS_TEST_INTERSTITIAL_ID\s*=\s*"([^"]+)"/)?.[1];
const appId = infoPlist.match(/<key>GADApplicationIdentifier<\/key>\s*<string>([^<]+)<\/string>/)?.[1];
const testingEnabled = /isTesting:\s*true/.test(adsSource);
const errors = [];

if (!interstitialId) errors.push("Could not read the iOS interstitial ad unit from ads.js.");
if (!appId) errors.push("Could not read GADApplicationIdentifier from Info.plist.");

if (requireProduction) {
  if (interstitialId === sampleInterstitialId) errors.push("Replace Google's sample interstitial ID before a production archive.");
  if (appId === sampleAppId) errors.push("Replace Google's sample AdMob App ID before a production archive.");
  if (testingEnabled) errors.push("Set replayAdConfig.isTesting to false before a production archive.");
}

if (errors.length) {
  for (const error of errors) console.error(`AD CONFIG: ${error}`);
  process.exitCode = 1;
} else {
  console.log(JSON.stringify({
    ok: true,
    mode: requireProduction ? "production" : "development",
    sampleIds: appId === sampleAppId && interstitialId === sampleInterstitialId,
    testingEnabled,
  }));
}
