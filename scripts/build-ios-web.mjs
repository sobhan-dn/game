import { cp, mkdir, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const outDir = path.join(root, "dist");
const gameEntry = path.join(root, "game.js");
const bundlePath = path.join(root, "game.bundle.js");
const embeddedTextureFiles = [
  "assets/textures/cosmic-bg-v2.webp",
  "assets/textures/planet-earth-v1.webp",
  "assets/textures/planet-mars-v1.webp",
  "assets/textures/planet-venus-v1.webp",
  "assets/textures/planet-jupiter-v1.webp",
  "assets/textures/planet-saturn-v1.webp",
  "assets/textures/planet-uranus-v1.webp",
  "assets/textures/planet-neptune-v1.webp",
  "assets/textures/planet-mercury-v1.webp",
];

const copyFileOrDir = async (from, to) => {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const item of [
  "index.html",
  "styles.css",
  "support.html",
  "privacy.html",
  "privacy-policy.html",
  "assets/textures/cosmic-bg-v2.webp",
  "assets/textures/planet-earth-v1.webp",
  "assets/textures/planet-mars-v1.webp",
  "assets/textures/planet-venus-v1.webp",
  "assets/textures/planet-jupiter-v1.webp",
  "assets/textures/planet-saturn-v1.webp",
  "assets/textures/planet-uranus-v1.webp",
  "assets/textures/planet-neptune-v1.webp",
  "assets/textures/planet-mercury-v1.webp",
  "assets/textures/sphere-ice.webp",
  "assets/textures/sphere-lava.webp",
  "assets/textures/sphere-emerald.webp",
  "assets/textures/sphere-amber.webp",
]) {
  await copyFileOrDir(path.join(root, item), path.join(outDir, item));
}

const embeddedAssets = new Map();
for (const file of embeddedTextureFiles) {
  const data = await readFile(path.join(root, file));
  embeddedAssets.set(`./${file}`, `data:image/webp;base64,${data.toString("base64")}`);
}

await build({
  entryPoints: [gameEntry],
  outfile: bundlePath,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["ios15"],
  sourcemap: false,
  minify: true,
  plugins: [{
    name: "embed-local-textures",
    setup(buildContext) {
      buildContext.onLoad({ filter: /game\.js$/ }, async (args) => {
        if (path.resolve(args.path) !== gameEntry) return null;
        let contents = await readFile(gameEntry, "utf8");
        for (const [assetUrl, dataUrl] of embeddedAssets) {
          contents = contents.replaceAll(assetUrl, dataUrl);
        }
        return { contents, loader: "js" };
      });
    },
  }],
});

await copyFileOrDir(bundlePath, path.join(outDir, "game.bundle.js"));

const size = await stat(outDir);
console.log(`Built standalone browser/iOS bundle at ${path.relative(root, bundlePath)} and ${path.relative(root, outDir)} (${size.isDirectory() ? "ready" : "missing"})`);
