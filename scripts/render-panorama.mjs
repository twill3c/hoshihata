// 稜線同定図を単体の HTML に書き出して、実ブラウザで目視できるようにする。
// ビルドが通ることと図が読めることは別である(chikuma-seiki の教訓)。
//
//   npm run render:panorama   → out/panorama.html
//
// Node 24 の型剥がし(--experimental-strip-types)で src/lib/panorama.ts を直接読む。
// そのため src 内部の import は相対パスにしてある(@/ はテスト側だけで使う)。

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderPanoramaSvg, panoramaCaption } from "../src/lib/panorama.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = renderPanoramaSvg();
const caption = panoramaCaption();

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>稜線同定図 — 道の駅 星畑</title>
<style>
  :root {
    color-scheme: light dark;
    --sky: #e8eef2; --ridge: #3c4a52; --ink: #22303a; --muted: #667680; --leader: #93a1aa;
  }
  @media (prefers-color-scheme: dark) {
    :root { --sky: #0f161b; --ridge: #6d818b; --ink: #dbe5ea; --muted: #93a3ad; --leader: #4d5c65; }
  }
  body { margin: 0; padding: 32px; font-family: system-ui, sans-serif; background: var(--sky); color: var(--ink); }
  figure { margin: 0 auto; max-width: 1200px; }
  .hh-panorama { width: 100%; height: auto; display: block; }
  .hh-ridge { fill: var(--ridge); stroke: none; }
  .hh-tick line { stroke: var(--leader); stroke-width: 1; stroke-dasharray: 3 4; }
  .hh-tick text { fill: var(--muted); font-size: 13px; }
  .hh-leader { fill: none; stroke: var(--leader); stroke-width: 1; }
  .hh-summit { fill: var(--ink); }
  .hh-name { fill: var(--ink); font-size: 15px; font-weight: 600; text-anchor: middle; }
  .hh-elev { fill: var(--muted); font-size: 12px; text-anchor: middle; }
  figcaption { margin-top: 16px; color: var(--muted); font-size: 14px; line-height: 1.7; }
</style>
</head>
<body>
<figure>
${svg}
<figcaption>${caption}</figcaption>
</figure>
</body>
</html>
`;

mkdirSync(join(ROOT, "out"), { recursive: true });
const dest = join(ROOT, "out", "panorama.html");
writeFileSync(dest, html, "utf-8");
console.log(`→ ${dest}`);
console.log(caption);
