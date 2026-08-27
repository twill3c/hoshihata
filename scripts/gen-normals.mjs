// 気象庁「過去の気象データ検索」日別平年値(野辺山)の vendor 済み HTML を
// 機械変換して src/data/normals.generated.ts を書き出す。
//
// 原本: data/jma/nml_amd_d_0415_{01..12}.html
//   https://www.data.jma.go.jp/stats/etrn/view/nml_amd_d.php?prec_no=48&block_no=0415&month=M
//   取得日 2026-08-27 / 統計期間 1991〜2020 / 資料年数 30
//
// 要約や第三者サイトの転記を権威値にしない(SPEC N-01)。原本の表をそのまま読む。
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BLOCK_NO = "0415";

/** 平年値表で読む列。見出し文字列は原本のとおり(照合に使う)。 */
const COLUMNS = [
  { key: "precipMm", header: "降水量(mm)" },
  { key: "tempMeanC", header: "平均気温(℃)" },
  { key: "tempMaxC", header: "日最高気温(℃)" },
  { key: "tempMinC", header: "日最低気温(℃)" },
  { key: "sunshineH", header: "日照時間(h)" },
];

/** 平年値の統計期間。原本の「統計期間」行と照合する。 */
const EXPECTED_PERIOD = "1991～2020";

const stripTags = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .trim();

/** 表の行をセル配列に割る。 */
function tableRows(html) {
  return [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)]
    .map((m) => [...m[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => stripTags(c[1])))
    .filter((cells) => cells.length > 0);
}

/**
 * 気象庁の数値セルは値のあとに品質情報の記号が付くことがある(] ) # 等)。
 * 欠測は "///" や "--" で入る。数値として読めないものは null にする。
 */
function parseValue(raw) {
  const t = raw.replace(/[\s ]/g, "");
  if (t === "" || t.includes("/") || t === "--" || t === "×") return null;
  const m = t.match(/^-?\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
}

function parseMonth(month) {
  const p = String(month).padStart(2, "0");
  const path = join(ROOT, "data", "jma", `nml_amd_d_${BLOCK_NO}_${p}.html`);
  const html = readFileSync(path, "utf-8");
  const rows = tableRows(html);

  const headerRow = rows.find((r) => r[0] === "要素");
  if (!headerRow) throw new Error(`${p}月: 「要素」の見出し行が見つからない`);

  // 見出しの並びは月によって変わりうるので、名前で列位置を引く
  const colIndex = {};
  for (const { key, header } of COLUMNS) {
    const i = headerRow.indexOf(header);
    if (i < 0) throw new Error(`${p}月: 列「${header}」が見つからない(見出し: ${headerRow.join(" / ")})`);
    colIndex[key] = i;
  }

  const periodRow = rows.find((r) => r[0] === "統計期間");
  if (!periodRow) throw new Error(`${p}月: 「統計期間」行が見つからない`);
  for (const { key, header } of COLUMNS) {
    const got = periodRow[colIndex[key]];
    if (got !== EXPECTED_PERIOD) {
      throw new Error(
        `${p}月: 列「${header}」の統計期間が ${EXPECTED_PERIOD} でない(${got})。` +
          `原本が更新された可能性がある — SPEC の平年値の記述ごと見直すこと`,
      );
    }
  }

  const days = [];
  for (const cells of rows) {
    const m = cells[0]?.match(/^(\d+)日$/);
    if (!m) continue;
    const day = Number(m[1]);
    const rec = { day };
    for (const { key } of COLUMNS) rec[key] = parseValue(cells[colIndex[key]] ?? "");
    days.push(rec);
  }
  return days;
}

/**
 * 気象庁の日別平年値は 2 月 29 日の行も持つ(30 年平均だが閏日の平年値が公表されている)。
 * 実測 2026-08-27: 野辺山 2/29 は 平均 -2.5℃ / 最低 -8.6℃。通年 366 日。
 */
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const DAYS_IN_YEAR = 366;

const months = [];
for (let m = 1; m <= 12; m++) {
  const days = parseMonth(m);
  const expected = DAYS_IN_MONTH[m - 1];
  if (days.length !== expected) {
    throw new Error(`${m}月: 日数が ${days.length}(期待 ${expected})`);
  }
  const seq = days.map((d) => d.day);
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] !== i + 1) throw new Error(`${m}月: 日付の並びが飛んでいる(${seq.join(",")})`);
  }
  months.push({ month: m, days });
}

const flat = months.flatMap(({ month, days }) =>
  days.map((d) => ({
    month,
    day: d.day,
    tempMeanC: d.tempMeanC,
    tempMaxC: d.tempMaxC,
    tempMinC: d.tempMinC,
    precipMm: d.precipMm,
    sunshineH: d.sunshineH,
  })),
);

if (flat.length !== DAYS_IN_YEAR) throw new Error(`通年の日数が ${DAYS_IN_YEAR} でない(${flat.length})`);

const missing = flat.filter((d) => d.tempMeanC === null);
if (missing.length > 0) {
  throw new Error(`平均気温に欠測がある(${missing.length} 日) — モデルの入力にできない`);
}

const lines = flat
  .map(
    (d) =>
      `  { month: ${d.month}, day: ${d.day}, tempMeanC: ${d.tempMeanC}, tempMaxC: ${d.tempMaxC}, ` +
      `tempMinC: ${d.tempMinC}, precipMm: ${d.precipMm}, sunshineH: ${d.sunshineH} },`,
  )
  .join("\n");

const out = `// 自動生成 — 手で編集しない。\`npm run gen\` で作り直す(scripts/gen-normals.mjs)。
//
// 出典: 気象庁「過去の気象データ検索」日別平年値
//   観測所 野辺山(prec_no=48 / block_no=0415、北緯35°56.9′ 東経138°28.3′ 標高1350m)
//   統計期間 1991〜2020(資料年数 30)/ 原本取得日 2026-08-27
//   原本は data/jma/nml_amd_d_0415_{01..12}.html に vendor 済み
//
// 気象庁は閏日 2 月 29 日の平年値も公表しているため、通年 366 日である。

export type DailyNormal = {
  /** 月(1-12) */
  month: number;
  /** 日(1-31) */
  day: number;
  /** 日平均気温(℃) */
  tempMeanC: number;
  /** 日最高気温(℃) */
  tempMaxC: number | null;
  /** 日最低気温(℃) */
  tempMinC: number | null;
  /** 降水量(mm) */
  precipMm: number | null;
  /** 日照時間(h) */
  sunshineH: number | null;
};

export const NORMALS_STATION = {
  name: "野辺山",
  precNo: 48,
  blockNo: "0415",
  latitudeDeg: 35 + 56.9 / 60,
  longitudeDeg: 138 + 28.3 / 60,
  elevationM: 1350,
  period: "1991-2020",
  fetchedOn: "2026-08-27",
} as const;

export const DAILY_NORMALS: readonly DailyNormal[] = [
${lines}
];
`;

const dest = join(ROOT, "src", "data", "normals.generated.ts");
writeFileSync(dest, out, "utf-8");
console.log(`${flat.length} 日 → ${dest}`);
