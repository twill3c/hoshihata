// 出荷サイトの**操作**を実ブラウザで検査する。
//
//   npm run build && npm run verify:ui
//
// 出荷 HTML を読む検査(scripts/verify-output.mjs)は、静的な出力しか見られない。
// 分類の絞り込みはハイドレーション後のクライアント側の振る舞いなので、
// 実際にボタンを押して確かめるほかない。
//
// **`file://` では駄目。** 静的書き出しは資産を絶対パスで参照するので読み込まれない。
// out/ を HTTP で配信してから開く(HC-043)。
//
// 手続きが成立したことを先に確かめる: CSS が効いていること、ハイドレーションが
// 済んでいること(ボタンが反応すること)を確認してから本題の検査に入る。
// 成立を確かめずに得た「問題なし」は、問題が無いことの証拠にならない。

import { createServer } from "node:http";
import { chromium } from "playwright";
import { createReadStream, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, normalize } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

if (!existsSync(OUT)) {
  console.error("out/ が無い。先に `npm run build` を実行すること");
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".woff": "font/woff",
};

const server = createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  let path = normalize(join(OUT, url));
  if (!path.startsWith(OUT)) {
    res.writeHead(403).end();
    return;
  }
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  if (!existsSync(path)) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(path)] ?? "application/octet-stream" });
  createReadStream(path).pipe(res);
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const consoleErrors = [];
page.on("pageerror", (error) => consoleErrors.push(String(error)));
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

const response = await page.goto(`${base}/shop/`);
if (!response || !response.ok()) {
  fail("/shop/", `HTTP ${response ? response.status() : "応答なし"}`);
}
await page.waitForLoadState("networkidle");

// ---- 手続きの成立を先に確かめる
const inkToken = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
);
if (inkToken === "") fail("/shop/", "色トークン --ink が空。CSS が読み込まれていない");

const buttons = page.locator(".filter__button");
const buttonCount = await buttons.count();
if (buttonCount < 2) fail("/shop/", `絞り込みボタンが ${buttonCount} 個しかない`);

const allCards = page.locator(".cards .card");
const totalShown = await allCards.count();
if (totalShown === 0) fail("/shop/", "品が一つも描画されていない");

// ---- 初期状態は「すべて」で、全件が出ている
const firstPressed = await buttons.first().getAttribute("aria-pressed");
if (firstPressed !== "true") fail("/shop/", `初期状態で「すべて」が押されていない(${firstPressed})`);

// 出荷 HTML(= JS を動かす前)の品数と、描画後の品数が同じであること。
// 初期状態で絞り込まれていたら、JS が無い環境で品が減る
const shippedHtml = await (await fetch(`${base}/shop/`)).text();
const shippedCount = shippedHtml.match(/class="card [^"]*" data-item="|class="card" data-item="/g)?.length ?? 0;
if (shippedCount !== totalShown) {
  fail("/shop/", `出荷 HTML の品数 ${shippedCount} と描画後 ${totalShown} が違う`);
}

// ---- 本題: 分類ごとに押して、実際に絞られるか
const categories = await page.evaluate(() =>
  [...document.querySelectorAll(".cards .card")].reduce((acc, card) => {
    const key = card.getAttribute("data-category") ?? "";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {}),
);

if (Object.keys(categories).length < 2) {
  fail("/shop/", "分類が 1 種類しかない(絞り込みの検査にならない)");
}

for (let i = 1; i < buttonCount; i++) {
  const button = buttons.nth(i);
  const label = (await button.textContent())?.trim() ?? `#${i}`;
  await button.click();

  const pressed = await button.getAttribute("aria-pressed");
  if (pressed !== "true") fail("/shop/", `${label} を押しても aria-pressed が true にならない`);

  const shownCategories = await page.evaluate(() =>
    [...document.querySelectorAll(".cards .card")].map((c) => c.getAttribute("data-category")),
  );

  if (shownCategories.length === 0) {
    fail("/shop/", `${label} を押すと品が 0 件になる`);
    continue;
  }
  const distinct = [...new Set(shownCategories)];
  if (distinct.length !== 1) {
    fail("/shop/", `${label} を押しても分類が絞られていない(${distinct.join(",")})`);
    continue;
  }
  const expected = categories[distinct[0]];
  if (shownCategories.length !== expected) {
    fail("/shop/", `${label} の件数が ${shownCategories.length}(期待 ${expected})`);
  }
  // 絞り込みは表示だけの機能。押しても他のボタンが消えたりしない
  if ((await buttons.count()) !== buttonCount) {
    fail("/shop/", `${label} を押すとボタンの数が変わる`);
  }
}

// ---- 「すべて」に戻すと全件に戻る
await buttons.first().click();
const restored = await allCards.count();
if (restored !== totalShown) {
  fail("/shop/", `「すべて」に戻しても ${restored} 件(期待 ${totalShown} 件)`);
}

// ---- キーボードで操作できるか
await page.keyboard.press("Tab");
const focusVisible = await page.evaluate(() => {
  const active = document.activeElement;
  return active !== null && active !== document.body;
});
if (!focusVisible) fail("/shop/", "Tab でどこにも焦点が移らない");

if (consoleErrors.length > 0) {
  fail("/shop/", `コンソールにエラーが出ている: ${consoleErrors.slice(0, 2).join(" / ")}`);
}

await browser.close();
server.close();

console.log(`分類 ${Object.keys(categories).length} 種 / 品 ${totalShown} 件 / ボタン ${buttonCount} 個を操作して検査`);
for (const [key, count] of Object.entries(categories)) console.log(`  ${key}: ${count} 件`);

if (problems.length > 0) {
  console.error(`\n${problems.length} 件の違反:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log("\n違反なし");
