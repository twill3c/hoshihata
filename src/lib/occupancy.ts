// RV パークの混み具合(F-07)。
//
// **これは実績ではなく、決定論的なモデルである。** 架空の施設に稼働実績は存在しない。
// 作り物だからこそ、満たすべき性質をテストで縛る(senoto-mori G-05 と同じ考え):
//
//   1. 決定論      — 同じ入力で常に同じ出力。乱数も実時刻も使わない
//   2. 保存則      — 0 以上、区画数以下
//   3. 偏りの不在  — 通年で「常に満」も「常に空」も無い
//   4. 需要の向き  — 夏の土曜 > 冬の平日、土曜 ≥ 平日
//
// 季節の形は思いつきでなく、このサイトが既に持っているデータに乗せる —
// 気温の平年値と、高原野菜が棚に出る期間。作り物であることは変わらないが、
// 少なくともサイトの中で辻褄が合う。

import { RV_SITES } from "../data/rv.ts";
import { DAYS_IN_YEAR, normalOf } from "./harvest.ts";
import { shelfOn } from "./shelf.ts";

export const SITE_COUNT = RV_SITES.length;

/** 曜日。0 = 日曜。 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_OF_WEEK_LABELS = ["日", "月", "火", "水", "木", "金", "土"] as const;

/**
 * 決定論的なばらつき。乱数を使わない(T-12 が `Math.random` を禁じている)。
 * 入力が同じなら必ず同じ値を返す整数ハッシュ。
 */
function jitter(doy: number, dayOfWeek: number): number {
  let h = (doy * 2654435761 + dayOfWeek * 40503) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 2246822519) >>> 0;
  h ^= h >>> 13;
  return (h % 1000) / 1000; // 0 以上 1 未満
}

/** 気温から求める「泊まりやすさ」。0〜1。 */
function warmth(doy: number): number {
  const t = normalOf(doy).tempMeanC;
  // 野辺山の日平均は -5.9 〜 20.0 ℃。0 ℃ を下限、18 ℃ を上限として正規化する
  return Math.min(1, Math.max(0, (t - 0) / 18));
}

/**
 * その日の混み具合(埋まっている区画数)。
 *
 * 当日先着なので「予約の状況」ではない。**その日どのくらい埋まりやすいかの見込み**である。
 */
export function occupancyOn(doy: number, dayOfWeek: DayOfWeek): number {
  if (!Number.isInteger(doy) || doy < 1 || doy > DAYS_IN_YEAR) {
    throw new RangeError(`通日が範囲外: ${doy}`);
  }
  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    throw new RangeError(`曜日が範囲外: ${dayOfWeek}`);
  }

  const weekend = dayOfWeek === 5 || dayOfWeek === 6 ? 0.3 : 0;
  // 高原野菜が並ぶ日は人が来る。サイトの中で辻褄を合わせる
  const harvest = shelfOn(doy).seasonal.length > 0 ? 0.12 : 0;
  const base = warmth(doy) * 0.62 + weekend + harvest;
  const noisy = base + (jitter(doy, dayOfWeek) - 0.5) * 0.12;

  return Math.min(SITE_COUNT, Math.max(0, Math.round(noisy * SITE_COUNT)));
}

export type OccupancyLevel = "空いている" | "半分ほど" | "混みあう";

/** 見込みを三段階の言葉にする。数字だけ出すより読める。 */
export function occupancyLevelOf(occupied: number): OccupancyLevel {
  const ratio = occupied / SITE_COUNT;
  if (ratio < 0.34) return "空いている";
  if (ratio < 0.67) return "半分ほど";
  return "混みあう";
}

/** 月ごとの見込み(平日と土曜)。ページの表に使う。 */
export function monthlyOutlook(): {
  month: number;
  weekday: number;
  saturday: number;
}[] {
  const byMonth = new Map<number, { weekday: number[]; saturday: number[] }>();
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    const { month } = monthOf(doy);
    if (!byMonth.has(month)) byMonth.set(month, { weekday: [], saturday: [] });
    const bucket = byMonth.get(month)!;
    bucket.weekday.push(occupancyOn(doy, 3));
    bucket.saturday.push(occupancyOn(doy, 6));
  }
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  return [...byMonth.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([month, bucket]) => ({
      month,
      weekday: Number(mean(bucket.weekday).toFixed(1)),
      saturday: Number(mean(bucket.saturday).toFixed(1)),
    }));
}

function monthOf(doy: number): { month: number } {
  const calendar = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let rest = doy;
  for (let m = 1; m <= 12; m++) {
    if (rest <= calendar[m - 1]!) return { month: m };
    rest -= calendar[m - 1]!;
  }
  /* c8 ignore next */
  throw new RangeError(`通日が範囲外: ${doy}`);
}
