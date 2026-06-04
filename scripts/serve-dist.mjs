import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../dist");
const host = process.env.CMDPET_HOST || "127.0.0.1";
const port = Number(process.env.CMDPET_PORT || 5190);

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || "/", `http://${host}:${port}`);
  const cleanPath = url.pathname === "/" ? "/index.html" : url.pathname;
  const decoded = decodeURIComponent(cleanPath);
  const filePath = path.resolve(root, `.${decoded}`);
  const relative = path.relative(root, filePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }
  return filePath;
}

const server = http.createServer((request, response) => {
  let filePath = resolveRequestPath(request.url);
  if (!filePath) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("forbidden");
    return;
  }

  if (!existsSync(filePath)) {
    filePath = path.join(root, "index.html");
  }

  if (statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  const type = mimeTypes.get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
  response.writeHead(200, { "content-type": type, "cache-control": "no-store" });
  createReadStream(filePath).pipe(response);
});

server.listen(port, host, () => {
  console.log(`CastRoom AI dist preview: http://${host}:${port}/`);
});
