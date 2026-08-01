import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { gzip } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 5173);
const gzipAsync = promisify(gzip);

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".fbx": "application/octet-stream",
};

const PUBLIC_FILES = new Set([
  "index.html",
  "styles.css",
  "game.js",
  "game.bundle.js",
  "cat-rig.js",
  "privacy.html",
  "privacy-policy.html",
  "support.html",
]);
const PUBLIC_PREFIXES = ["assets/", "node_modules/three/"];
const COMPRESSIBLE = new Set([".html", ".css", ".js", ".json", ".svg"]);

const server = http.createServer(async (req, res) => {
  const rawPath = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  let safePath;
  try {
    safePath = decodeURIComponent(rawPath).replace(/^\/+/, "");
  } catch {
    res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
    res.end("Bad request");
    return;
  }
  if (!isPublicPath(safePath)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }
  const filePath = path.resolve(__dirname, safePath);
  const relativePath = path.relative(__dirname, filePath);

  if (!relativePath || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    let body = await readFile(filePath);
    const extension = path.extname(filePath).toLowerCase();
    const contentType = MIME[extension] || "application/octet-stream";
    const headers = {
      "content-type": contentType,
      "cache-control": safePath === "index.html" ? "no-cache" : "public, max-age=86400, stale-while-revalidate=604800",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    };
    if (body.length > 1024 && COMPRESSIBLE.has(extension) && /\bgzip\b/.test(req.headers["accept-encoding"] || "")) {
      body = await gzipAsync(body, { level: 6 });
      headers["content-encoding"] = "gzip";
      headers.vary = "Accept-Encoding";
    }
    res.writeHead(200, headers);
    res.end(body);
  } catch {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

function isPublicPath(value) {
  if (!value || value.includes("\0") || value.split("/").some((segment) => !segment || segment === "." || segment === ".." || segment.startsWith("."))) {
    return false;
  }
  return PUBLIC_FILES.has(value) || PUBLIC_PREFIXES.some((prefix) => value.startsWith(prefix));
}

server.listen(PORT, () => {
  console.log(`Void Spheres: Riftbound running at http://localhost:${PORT}`);
});
