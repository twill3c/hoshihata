// 平年値から出る一言(ページの本文に使う数値)。
//
// **ページ側で数えない。** 数えると、データを差し替えたのに文が古いまま、が起きる。
// SPEC §2 が「サイト上は年平均 7 ℃台までしか主張しない」と決めているので、
// 表示の丸めもここで一度だけ決める。

import { DAILY_NORMALS } from "../data/normals.generated.ts";

/** 日別平年値を平均した年平均気温(℃)。 */
export function annualMeanTempC(): number {
  const sum = DAILY_NORMALS.reduce((acc, d) => acc + d.tempMeanC, 0);
  return sum / DAILY_NORMALS.length;
}

/** 日平均気温が 30 ℃ 以上になる日の数。野辺山では 0 日。 */
export function hotDayCount(): number {
  return DAILY_NORMALS.filter((d) => d.tempMeanC >= 30).length;
}

/** 最も寒い月と最も暖かい月。 */
export function extremeMonths(): { coldest: number; warmest: number } {
  const byMonth = new Map<number, number[]>();
  for (const d of DAILY_NORMALS) {
    if (!byMonth.has(d.month)) byMonth.set(d.month, []);
    byMonth.get(d.month)!.push(d.tempMeanC);
  }
  const means = [...byMonth.entries()].map(([month, xs]) => ({
    month,
    mean: xs.reduce((a, b) => a + b, 0) / xs.length,
  }));
  return {
    coldest: means.reduce((a, b) => (a.mean <= b.mean ? a : b)).month,
    warmest: means.reduce((a, b) => (a.mean >= b.mean ? a : b)).month,
  };
}

/** 日最低気温の平年値の最小(℃)。冬の厳しさを示すために使う。 */
export function lowestDailyMinC(): number {
  const mins = DAILY_NORMALS.map((d) => d.tempMinC).filter((v): v is number => v !== null);
  if (mins.length === 0) throw new Error("日最低気温が一つも無い");
  return Math.min(...mins);
}
