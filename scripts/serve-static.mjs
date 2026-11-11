#!/usr/bin/env node
// 컨테이너용 정적 파일 서버. Expo 웹 빌드(dist)를 BASE_PATH 아래에서 제공한다.
// 데이터와 로그인은 같은 사이트의 API가 맡으므로 이 서버는 파일만 내보낸다.
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const port = Number(process.env.PORT ?? 80);
const host = process.env.HOST ?? "0.0.0.0";
const staticDir = path.resolve(process.env.STATIC_DIR ?? "dist");
const basePath = `/${String(process.env.BASE_PATH ?? "/").replace(/^\/+|\/+$/g, "")}/`.replace(/^\/\/$/, "/");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

const securityHeaders = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "SAMEORIGIN",
};

function send(res, status, headers, body) {
  res.writeHead(status, { ...securityHeaders, ...headers });
  res.end(body);
}

function resolveFile(relativePath) {
  const target = path.resolve(staticDir, relativePath);
  if (target !== staticDir && !target.startsWith(staticDir + path.sep)) return null;
  try {
    return fs.statSync(target).isFile() ? target : null;
  } catch {
    return null;
  }
}

function serveFile(res, filePath, method) {
  const isIndex = path.basename(filePath) === "index.html";
  // 빌드 결과의 assets/는 파일 이름에 해시가 붙어 오래 캐시해도 되고, index.html은 매번 새로 확인한다.
  const cacheControl = isIndex ? "no-cache" : (filePath.includes(`${path.sep}assets${path.sep}`) || filePath.includes(`${path.sep}_expo${path.sep}static${path.sep}`)) ? "public, max-age=31536000, immutable" : "public, max-age=3600";
  const headers = {
    "Content-Type": contentTypes[path.extname(filePath).toLowerCase()] ?? "application/octet-stream",
    "Cache-Control": cacheControl,
  };
  if (method === "HEAD") return send(res, 200, headers);
  res.writeHead(200, { ...securityHeaders, ...headers });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, { Allow: "GET, HEAD" });

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    return send(res, 400, {});
  }
  if (pathname.includes("\0")) return send(res, 400, {});
  if (pathname === "/healthz") return send(res, 200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" }, "ok");
  if (`${pathname}/` === basePath) return send(res, 308, { Location: basePath });
  if (!pathname.startsWith(basePath)) return send(res, 404, {});

  // Reject source maps before file lookup or SPA fallback, including encoded paths.
  if (/\.map(?:\/|$)/i.test(pathname)) return send(res, 404, { "Cache-Control": "no-store" });

  const relativePath = pathname.slice(basePath.length);
  const filePath = relativePath ? resolveFile(relativePath) : null;
  if (filePath) return serveFile(res, filePath, req.method);
  // 확장자가 있는 경로는 없는 파일로 보고, 나머지는 앱 화면(index.html)으로 돌려준다.
  if (path.extname(relativePath)) return send(res, 404, {});
  const indexPath = resolveFile("index.html");
  if (!indexPath) return send(res, 500, {}, "index.html not found");
  return serveFile(res, indexPath, req.method);
});

server.listen(port, host, () => {
  console.log(`static server on http://${host}:${port}${basePath} (${staticDir})`);
});
