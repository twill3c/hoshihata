// **本番**を実 curl / 実ブラウザで検品する。
//
//   node harness/verify-live.mjs
//
// ローカルの出荷 HTML 検査（scripts/verify-output.mjs）は配信の前までしか見られない。
// **配信時のヘッダは、実際にデプロイして取るまで分からない** ——
// OG 画像が Content-Type: application/octet-stream で配信され、
// 画像として認識されない事故が実際に起きた（loop_008）。
//
// 判定は `vercel ls` でなく**本番 URL への実リクエスト**で行う（vercel-deploy-quirks）。

import { chromium } from "playwright";

const ORIGIN = process.argv[2] ?? "https://hoshihata.vercel.app";

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

const PAGES = [
  "/",
  "/shop/",
  "/restaurant/",
  "/panorama/",
  "/rv/",
  "/access/",
  "/news/",
  "/news/season-end/",
  "/news/deck/",
  "/news/lettuce/",
];

const ASSETS = [
  { path: "/sitemap.xml", type: /xml/ },
  { path: "/robots.txt", type: /text\/plain/ },
];

const OG_PATHS = [
  "/opengraph-image/",
  "/shop/opengraph-image/",
  "/restaurant/opengraph-image/",
  "/panorama/opengraph-image/",
  "/rv/opengraph-image/",
  "/access/opengraph-image/",
  "/news/opengraph-image/",
];

console.log(`検品先: ${ORIGIN}`);

// ---- ページが 200 で返り、架空明示が入っているか
for (const path of PAGES) {
  const res = await fetch(ORIGIN + path);
  if (!res.ok) {
    fail(path, `HTTP ${res.status}`);
    continue;
  }
  const html = await res.text();
  if (!html.includes("この道の駅は実在しません")) {
    fail(path, "架空である旨の明示が本番に無い");
  }
  if (html.includes("<img")) fail(path, "<img> が本番に出ている");
  console.log(`  ${path.padEnd(24)} 200  ${(html.length / 1024).toFixed(1)} KB`);
}

// ---- OG 画像。**Content-Type まで見る**
for (const path of OG_PATHS) {
  const res = await fetch(ORIGIN + path);
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    fail(path, `HTTP ${res.status}`);
    continue;
  }
  if (!type.startsWith("image/png")) {
    fail(path, `Content-Type が ${type}（image/png であること）`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
  if (!isPng) fail(path, "PNG のシグネチャが無い");
  console.log(`  ${path.padEnd(34)} ${res.status} ${type} ${(bytes.length / 1024).toFixed(1)} KB`);
}

for (const { path, type } of ASSETS) {
  const res = await fetch(ORIGIN + path);
  if (!res.ok) {
    fail(path, `HTTP ${res.status}`);
    continue;
  }
  const got = res.headers.get("content-type") ?? "";
  if (!type.test(got)) fail(path, `Content-Type が ${got}`);
  console.log(`  ${path.padEnd(24)} ${res.status} ${got}`);
}

// ---- meta の og:image が実際に画像として取れるか
{
  const html = await (await fetch(ORIGIN + "/")).text();
  const match = /og:image" content="([^"]+)"/.exec(html);
  if (!match) fail("/", "og:image の meta が無い");
  else {
    const res = await fetch(match[1], { redirect: "follow" });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/png")) {
      fail("og:image", `${res.status} ${type}（meta が指す先が画像として取れない）`);
    }
  }
}

// ---- 実ブラウザ。CSS が効き、絞り込みが動くか
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

await page.goto(ORIGIN + "/shop/");
await page.waitForLoadState("networkidle");

const ink = await page.evaluate(() =>
  getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
);
if (ink === "") fail("/shop/", "色トークン --ink が空。CSS が本番で読み込まれていない");

const before = await page.locator(".cards .card").count();
const buttons = page.locator(".filter__button");
if ((await buttons.count()) < 2) fail("/shop/", "絞り込みボタンが本番に無い");
else {
  await buttons.nth(1).click();
  const after = await page.locator(".cards .card").count();
  if (after >= before) fail("/shop/", `絞り込みが本番で効いていない（${before} → ${after}）`);
  else console.log(`  絞り込み: ${before} 件 → ${after} 件`);
}

if (errors.length > 0) fail("/shop/", `本番でコンソールエラー: ${errors[0]}`);
await browser.close();

if (problems.length > 0) {
  console.error(`\n${problems.length} 件の違反:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log("\n違反なし");
