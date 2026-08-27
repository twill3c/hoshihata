// 出荷サイトを実ブラウザで撮る。
//
//   npm run build && node harness/shot-site.mjs [--dark]
//
// **file:// で撮ってはならない。** Next の静的書き出しは CSS を絶対パス
// (/_next/static/css/...)で参照するので、file:// ではファイルシステムの根に解決されて
// 読み込まれず、素の HTML を見ることになる(loop_003 で実際に踏んだ)。
// ここでは out/ を HTTP で配信してから撮る。
//
// このファイルはシェル経由で書かないこと(HC-028)。

import { createServer } from "node:http";
import { chromium } from "playwright";
import { createReadStream, existsSync, mkdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");
const dark = process.argv.includes("--dark");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

if (!existsSync(OUT)) {
  console.error("out/ が無い。先に `npm run build` を実行すること");
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let path = normalize(join(OUT, url));
  // out/ の外へ出る要求は受けない
  if (!path.startsWith(OUT)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found: " + url);
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const PAGES = [
  { name: "home", path: "/" },
  { name: "shop", path: "/shop/" },
  { name: "restaurant", path: "/restaurant/" },
  { name: "panorama", path: "/panorama/" },
  { name: "rv", path: "/rv/" },
  { name: "access", path: "/access/" },
  { name: "news", path: "/news/" },
  { name: "news-entry", path: "/news/season-end/" },
];

mkdirSync(join(ROOT, "harness", "shots"), { recursive: true });
const browser = await chromium.launch();

for (const page of PAGES) {
  const tab = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: dark ? "dark" : "light",
  });
  const response = await tab.goto(base + page.path);
  if (!response || !response.ok()) {
    throw new Error(`${page.path}: HTTP ${response ? response.status() : "応答なし"}`);
  }
  await tab.waitForLoadState("networkidle");

  // CSS が本当に効いているか確かめる。効いていない画像を見ても意味がない
  const styled = await tab.evaluate(() => {
    const body = getComputedStyle(document.body);
    const token = getComputedStyle(document.documentElement).getPropertyValue("--ink").trim();
    return { background: body.backgroundColor, token };
  });
  if (styled.token === "") {
    throw new Error(`${page.path}: 色トークン --ink が空。CSS が読み込まれていない`);
  }

  const file = join(ROOT, "harness", "shots", `site-${page.name}${dark ? "-dark" : ""}.png`);
  await tab.screenshot({ path: file, fullPage: true });
  await tab.close();
  console.log(`${file}  (--ink: ${styled.token})`);
}

await browser.close();
server.close();
