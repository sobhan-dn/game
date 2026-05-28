import { cp, mkdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const outDir = path.join(root, "dist");

const copyFileOrDir = async (from, to) => {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const item of ["index.html", "styles.css", "game.js", "assets"]) {
  await copyFileOrDir(path.join(root, item), path.join(outDir, item));
}

await copyFileOrDir(
  path.join(root, "node_modules/three/build/three.module.js"),
  path.join(outDir, "node_modules/three/build/three.module.js")
);
await copyFileOrDir(
  path.join(root, "node_modules/three/examples/jsm"),
  path.join(outDir, "node_modules/three/examples/jsm")
);

const size = await stat(outDir);
console.log(`Built iOS web bundle at ${path.relative(root, outDir)} (${size.isDirectory() ? "ready" : "missing"})`);
