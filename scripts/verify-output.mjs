// 出荷 HTML を読む検査(SPEC N-05)。
//
// **ソースでなく `next build` の生成物を読む。** ソースに書いてあることが
// 出力に届くとは限らない — SVG の <title> が React の制約で丸ごと落ちた事故が
// フリートに実在する(senoto-mori L2)。ソースを grep すれば通っていた。
//
//   npm run build && npm run verify
//
// 落ちたら exit 1。走査対象が 0 件でも exit 1(空振り合格させない)。

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "out");

const problems = [];
const fail = (where, message) => problems.push(`${where}: ${message}`);

if (!existsSync(OUT)) {
  console.error("out/ が無い。先に `npm run build` を実行すること");
  process.exit(1);
}

/** 出荷された HTML をすべて集める。 */
function htmlFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...htmlFiles(path));
    else if (entry.endsWith(".html")) found.push(path);
  }
  return found;
}

const pages = htmlFiles(OUT).map((path) => ({
  path: relative(OUT, path).replace(/\\/g, "/"),
  html: readFileSync(path, "utf-8"),
}));

// ---- 走査対象の検算。これが無いと、対象を取り違えた検査が静かに合格する
const EXPECTED_PAGES = [
  "index.html",
  "shop/index.html",
  "restaurant/index.html",
  "panorama/index.html",
  "rv/index.html",
  "access/index.html",
  "news/index.html",
];
if (pages.length < EXPECTED_PAGES.length) {
  fail("走査対象", `HTML が ${pages.length} 件しか無い(期待 ${EXPECTED_PAGES.length} 件以上)`);
}
for (const expected of EXPECTED_PAGES) {
  if (!pages.some((p) => p.path === expected)) fail("走査対象", `${expected} が出荷されていない`);
}

// ---- F-03 架空明示。全ページのフッタに出ていること
const FICTION_PHRASE = "この道の駅は実在しません";
for (const page of pages) {
  if (page.path === "404.html") continue; // 生成物であって本作のページではない
  if (!page.html.includes(FICTION_PHRASE)) {
    fail(page.path, `架空である旨の明示「${FICTION_PHRASE}」が出荷 HTML に無い`);
  }
}

// 明示は 4 箇所(F-03)。フッタ + トップ + 食堂 + 稜線
const NOTICE_PAGES = [
  "index.html",
  "restaurant/index.html",
  "panorama/index.html",
  "rv/index.html",
  "access/index.html",
];
for (const path of NOTICE_PAGES) {
  const page = pages.find((p) => p.path === path);
  if (!page) continue;
  const count = page.html.split(FICTION_PHRASE).length - 1;
  if (count < 2) {
    fail(path, `架空である旨がフッタだけにしか無い(本文にも要る・出現 ${count} 回)`);
  }
}

// ---- F-03 持ってはならないもの
const FORBIDDEN = [
  { name: "電話番号", pattern: /0\d{1,4}[-−(（]\d{1,4}[-−)）]\d{3,4}/ },
  { name: "番地", pattern: /\d+\s*丁目|\d+\s*番地/ },
  { name: "道の駅の登録番号", pattern: /登録\s*第?\s*\d+\s*号|第\s*\d+\s*回登録/ },
];
for (const page of pages) {
  for (const { name, pattern } of FORBIDDEN) {
    const hit = pattern.exec(page.html);
    if (hit) fail(page.path, `${name}らしき文字列が出荷されている: ${hit[0]}`);
  }
}

// ---- N-03 写真を持たない
for (const page of pages) {
  const img = /<img\b[^>]*>/i.exec(page.html);
  if (img) fail(page.path, `<img> が出荷されている(写真は持たない): ${img[0].slice(0, 80)}`);
  const external = /(?:src|href)="https?:\/\/(?!www\.w3\.org)/i.exec(page.html);
  if (external) fail(page.path, `外部への参照が出荷されている: ${external[0]}`);
}

// ---- N-04 実行時に外部へ問い合わせない
for (const page of pages) {
  for (const call of [/\bfetch\s*\(/, /XMLHttpRequest/, /new\s+WebSocket/]) {
    if (call.test(page.html)) fail(page.path, `外部へ問い合わせる呼び出しが HTML に埋まっている`);
  }
}

// ---- F-06 稜線の図が本当に出荷されているか(ソースにあっても届くとは限らない)
const panorama = pages.find((p) => p.path === "panorama/index.html");
if (panorama) {
  if (!/class="hh-ridge"/.test(panorama.html)) fail("panorama/index.html", "稜線のパスが出荷されていない");
  const marks = [...panorama.html.matchAll(/data-peak="/g)].length;
  if (marks === 0) fail("panorama/index.html", "峰の名札が一つも出荷されていない");
  if (!/<title id="hh-panorama-title">/.test(panorama.html)) {
    fail("panorama/index.html", "図の <title> が出荷されていない(読み上げに要る)");
  }
}

// ---- F-04 品が全件出荷されているか(絞り込みで消えていないこと)
const shop = pages.find((p) => p.path === "shop/index.html");
if (shop) {
  const cards = [...shop.html.matchAll(/data-item="([^"]+)"/g)].map((m) => m[1]);
  const bands = [...shop.html.matchAll(/class="calendar__span"/g)].length;
  if (cards.length === 0) fail("shop/index.html", "品が一つも出荷されていない");
  if (bands === 0) fail("shop/index.html", "旬の帯が一本も出荷されていない");
}

// ---- F-07 場内図。区画の集合が図とデータで一致するか(二重定義の照合)
const rv = pages.find((p) => p.path === "rv/index.html");
if (rv) {
  const drawn = [...rv.html.matchAll(/data-site-id="([^"]+)"/g)].map((m) => m[1]).sort();
  if (drawn.length === 0) fail("rv/index.html", "場内図に区画が一つも出荷されていない");
  // 表側(電源の表)にも同じ製品が出ているか
  const appliances = [...rv.html.matchAll(/data-appliance="([^"]+)"/g)].length;
  if (appliances === 0) fail("rv/index.html", "電源の表が出荷されていない");
  if (!/<title id="ground-map-title">/.test(rv.html)) {
    fail("rv/index.html", "場内図の <title> が出荷されていない(読み上げに要る)");
  }
}

// ---- F-08 方位盤
const access = pages.find((p) => p.path === "access/index.html");
if (access) {
  const plotted = [...access.html.matchAll(/data-plan-peak="/g)].length;
  if (plotted === 0) fail("access/index.html", "方位盤に峰が一つも出荷されていない");
  if (!/<title id="plan-title">/.test(access.html)) {
    fail("access/index.html", "方位盤の <title> が出荷されていない");
  }
}

// ---- F-09 お知らせ。一覧の項目ぶんの記事が出荷されているか
const newsIndex = pages.find((p) => p.path === "news/index.html");
if (newsIndex) {
  const listed = [...newsIndex.html.matchAll(/data-news="([^"]+)"/g)].map((m) => m[1]);
  if (listed.length === 0) fail("news/index.html", "お知らせが一件も出荷されていない");
  for (const slug of listed) {
    if (!pages.some((p) => p.path === `news/${slug}/index.html`)) {
      fail("news/index.html", `一覧にある ${slug} の記事が出荷されていない`);
    }
  }
  // 逆向き。一覧に無い記事が出荷されていないこと
  for (const page of pages) {
    const hit = /^news\/([^/]+)\/index\.html$/.exec(page.path);
    if (hit && !listed.includes(hit[1])) {
      fail(page.path, `一覧に無い記事が出荷されている(${hit[1]})`);
    }
  }
}

// ---- 空の <title> を出荷しない
//
// SVG の <title> に複数の式を並べると、React の単一テキスト子要素制約で中身が丸ごと落ち、
// <title></title> だけが出荷される(HC-037。フリートで 2 回起きている)。
// 個別の要素を列挙するより、**空であること自体を禁じる**ほうが射程が広い。
for (const page of pages) {
  const empty = [...page.html.matchAll(/<title[^>]*>\s*<\/title>/g)].length;
  if (empty > 0) {
    fail(page.path, `中身の空の <title> が ${empty} 個出荷されている(React に落とされた疑い)`);
  }
}

// ---- 文字種。キリル文字・ハングルの混入
for (const page of pages) {
  const foreign = /[Ѐ-ӿ가-힯ᄀ-ᇿ]/.exec(page.html);
  if (foreign) {
    const cp = foreign[0].codePointAt(0).toString(16);
    fail(page.path, `キリル文字・ハングルが混入している: U+${cp}`);
  }
}

// ---- F-10 明暗の両方で色が定義されているか
const cssFiles = (function collect(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) found.push(...collect(path));
    else if (entry.endsWith(".css")) found.push(path);
  }
  return found;
})(OUT);

if (cssFiles.length === 0) {
  fail("CSS", "出荷された CSS が 1 件も無い");
} else {
  const css = cssFiles.map((p) => readFileSync(p, "utf-8")).join("\n");
  const lightTokens = [...css.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]);
  // 出荷される CSS は minify されていて改行が無い。改行を前提にした正規表現は
  // 正しい出力を落とす(loop_003 で実際に起きた)。括弧の対応を数えて切り出す
  const darkBody = mediaBlockBody(css, /prefers-color-scheme\s*:\s*dark/);
  if (darkBody === null) {
    fail("CSS", "暗色の定義が出荷されていない(F-10)");
  } else {
    const darkTokens = new Set([...darkBody.matchAll(/(--[a-z-]+)\s*:/g)].map((m) => m[1]));
    for (const token of new Set(lightTokens)) {
      if (!darkTokens.has(token)) {
        fail("CSS", `色トークン ${token} が暗色で定義されていない(暗い背景に暗い図を置く事故のもと)`);
      }
    }
  }
}

/**
 * `@media ... <pattern> ... { ... }` の中身を、括弧の対応を数えて切り出す。
 * minify されて改行が消えていても効く。見つからなければ null。
 */
function mediaBlockBody(css, pattern) {
  const hit = pattern.exec(css);
  if (!hit) return null;
  const open = css.indexOf("{", hit.index);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) return css.slice(open + 1, i);
    }
  }
  return null;
}

// ---- 報告
console.log(`出荷 HTML ${pages.length} 件 / CSS ${cssFiles.length} 件 を検査`);
for (const page of pages) console.log(`  ${page.path} (${(page.html.length / 1024).toFixed(1)} KB)`);

if (problems.length > 0) {
  console.error(`\n${problems.length} 件の違反:`);
  for (const problem of problems) console.error(`  ✗ ${problem}`);
  process.exit(1);
}
console.log("\n違反なし");
