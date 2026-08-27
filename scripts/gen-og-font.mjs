// OG 画像に使うフォントの部分集合を取ってきて data/font/ に vendor する。
//
//   node --experimental-strip-types scripts/gen-og-font.mjs
//
// **ビルド時にネットワークへ出ないようにするための一度きりの取得である。**
// 生成物は repo に入れる(N-01 の趣旨 — 使うものは手元に持つ)。
//
// Satori(next/og)は **woff2 を読めない**。Google Fonts は今どきの User-Agent には
// woff2 を返すので、古い UA を送って woff を返させる(sugi-nami の recipe)。
//
// 字は `src/data/og-text.ts` から機械的に集める。文言を変えたらこれを回し直す。
// 回し忘れると豆腐になるので、テスト(T-50)が字の網羅を確かめる。

import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { allOgCharacters } from "../src/data/og-text.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEST = join(ROOT, "data", "font");

const FAMILY = "Noto Sans JP";
const WEIGHTS = [
  { weight: 400, file: "subset-regular.woff" },
  { weight: 700, file: "subset-bold.woff" },
];

// 古い UA。今どきの UA を送ると woff2 が返り、Satori が読めない
const OLD_UA =
  "Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/28.0.1500.95 Safari/537.36";

const characters = allOgCharacters();
if (characters.length === 0) throw new Error("OG に使う字が 1 つも無い");

mkdirSync(DEST, { recursive: true });

for (const { weight, file } of WEIGHTS) {
  const cssUrl =
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(FAMILY)}:wght@${weight}` +
    `&text=${encodeURIComponent(characters)}`;

  const css = await fetch(cssUrl, { headers: { "User-Agent": OLD_UA } }).then((r) => {
    if (!r.ok) throw new Error(`CSS の取得に失敗: ${r.status}`);
    return r.text();
  });

  const src = /src:\s*url\(([^)]+)\)\s*format\('(truetype|opentype|woff)'\)/.exec(css);
  if (!src) {
    throw new Error(
      `woff の URL が見つからない。woff2 が返っている可能性がある(Satori は読めない)。\n${css.slice(0, 400)}`,
    );
  }

  const body = await fetch(src[1]).then((r) => {
    if (!r.ok) throw new Error(`フォントの取得に失敗: ${r.status}`);
    return r.arrayBuffer();
  });

  const bytes = Buffer.from(body);
  if (bytes.length < 1000) throw new Error(`フォントが小さすぎる(${bytes.length} B)`);

  writeFileSync(join(DEST, file), bytes);
  console.log(`${file}  ${(bytes.length / 1024).toFixed(1)} KB  (${src[2]})`);
}

// 何の字を要求したかを残す。テストがこれと OG の文言を突き合わせる
writeFileSync(
  join(DEST, "subset.json"),
  JSON.stringify(
    {
      family: FAMILY,
      weights: WEIGHTS.map((w) => w.weight),
      fetchedOn: "2026-08-27",
      characters,
      characterCount: [...characters].length,
      note: "src/data/og-text.ts から機械的に集めた字。文言を変えたら gen-og-font を回し直す",
    },
    null,
    2,
  ) + "\n",
  "utf-8",
);

console.log(`字 ${[...characters].length} 種 → data/font/subset.json`);
