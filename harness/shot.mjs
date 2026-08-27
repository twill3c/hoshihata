// out/*.html を実ブラウザで撮る。ビルドが通ることと図が読めることは別(chikuma-seiki の教訓)。
//
//   node harness/shot.mjs [ファイル名] [--dark]
//
// このファイルはシェル経由で書かないこと。正規表現のバックスラッシュが潰れる(HC-028)。

import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const name = process.argv[2] ?? "panorama.html";
const dark = process.argv.includes("--dark");

mkdirSync(join(ROOT, "harness", "shots"), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 1280, height: 760 },
  deviceScaleFactor: 2,
  colorScheme: dark ? "dark" : "light",
});

// パス区切りを手で置換せず、標準の変換に任せる(Windows のバックスラッシュ対策)
await page.goto(pathToFileURL(join(ROOT, "out", name)).href);
await page.waitForLoadState("networkidle");

const base = name.endsWith(".html") ? name.slice(0, -".html".length) : name;
const out = join(ROOT, "harness", "shots", `${base}${dark ? "-dark" : ""}.png`);
await page.screenshot({ path: out, fullPage: true });
await browser.close();

console.log(out);
