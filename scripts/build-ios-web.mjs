import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { build } from "esbuild";

const root = process.cwd();
const outDir = path.join(root, "dist");

const copyFileOrDir = async (from, to) => {
  await mkdir(path.dirname(to), { recursive: true });
  await cp(from, to, { recursive: true });
};

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

for (const item of ["index.html", "styles.css", "assets"]) {
  await copyFileOrDir(path.join(root, item), path.join(outDir, item));
}

const indexPath = path.join(outDir, "index.html");
const indexHtml = await readFile(indexPath, "utf8");
await writeFile(
  indexPath,
  indexHtml.replace('<script type="module" src="./game.js"></script>', '<script defer src="./game.js"></script>')
);

await build({
  entryPoints: [path.join(root, "game.js")],
  outfile: path.join(outDir, "game.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["ios15"],
  sourcemap: "inline",
});

const size = await stat(outDir);
console.log(`Built iOS web bundle at ${path.relative(root, outDir)} (${size.isDirectory() ? "ready" : "missing"})`);
