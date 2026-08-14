import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "cloudflare");
const outputDir = path.join(root, "build", "cloudflare-pages");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });

const files = [
  [path.join(sourceDir, "index.html"), path.join(outputDir, "index.html")],
  [path.join(sourceDir, "_headers"), path.join(outputDir, "_headers")],
  [path.join(sourceDir, "robots.txt"), path.join(outputDir, "robots.txt")],
  [path.join(root, "support.html"), path.join(outputDir, "support.html")],
  [path.join(root, "privacy.html"), path.join(outputDir, "privacy.html")],
  [path.join(root, "app-ads.txt"), path.join(outputDir, "app-ads.txt")],
];

for (const [source, destination] of files) {
  await cp(source, destination);
}

console.log(`Built Cloudflare Pages site at ${path.relative(root, outputDir)}`);
