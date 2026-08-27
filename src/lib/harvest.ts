// 旬カレンダーのモデル(SPEC §5)。
//
// 日平均気温の平年値を日ごとに見て「生育可能日」を数える。定植日から生育可能日を積算し、
// 作型の所要日数に達した日を収穫日とする。生育の止まる日は積算に加わらないので収穫は先送りされる。
//
// 単純な暦日の足し算ではなく、有効積算温度でもない。原典が日数と停止温度でしか
// 書いていない以上、モデルもその粒度を超えない(SPEC §5.2 / HC-016)。
//
// 実時刻・乱数に依存しない純関数だけで組む(SPEC §6・T-10)。

import { DAILY_NORMALS, type DailyNormal } from "@/data/normals.generated";
import { LETTUCE_CULTIVARS, type LettuceCultivar, plantingWindowFor } from "@/data/crops";

/** 平年値の暦。気象庁は閏日の平年値も公表しているので通年 366 日。 */
export const DAYS_IN_YEAR = 366;

const CALENDAR = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

/**
 * 原典は温度をふたつの粒度で書いている。取り違えると作期が丸ごとずれる。
 *
 * - p.1「生育温度範囲 15〜25 ℃で、10 ℃以下と 30 ℃以上では生育が阻害される」
 * - p.2「5 ℃以下の低温と 30 ℃以上の高温に於いて生育が停止する」
 *
 * 5 ℃ は**枯れずに耐える下限**、10 ℃ は**伸びる下限**である。
 * 所要日数(定植後 40/50/60 日)は生育が阻害されない条件での日数なので、
 * 積算すべきは「阻害されない日」— すなわち 10 ℃ 超 30 ℃ 未満の日である。
 *
 * 当初 5 ℃ を採ったところ、リーフレタスの収穫開始が原典の栽培暦より 16 日早くなった。
 * この取り違えはオラクル検査でしか見つからなかった(loop_001 の failure 記録を参照)。
 */
export const GROWTH_STOP_LOW_C = 5;
export const GROWTH_IMPEDED_LOW_C = 10;
export const GROWTH_STOP_HIGH_C = 30;

/**
 * 日平均気温がその日を生育可能日にするか。
 * 原典が「10 ℃以下」「30 ℃以上」と書くので、境界は開区間である(T-08)。
 */
export function isGrowingDay(tempMeanC: number): boolean {
  return tempMeanC > GROWTH_IMPEDED_LOW_C && tempMeanC < GROWTH_STOP_HIGH_C;
}

/** 株が生き延びられるか(生育はしないが枯れない範囲)。作期の外側を語るために持つ。 */
export function isSurvivableDay(tempMeanC: number): boolean {
  return tempMeanC > GROWTH_STOP_LOW_C && tempMeanC < GROWTH_STOP_HIGH_C;
}

/** 月日 → 通日(1-366)。 */
export function dayOfYearOf(month: number, day: number): number {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError(`月が範囲外: ${month}`);
  }
  const last = CALENDAR[month - 1]!;
  if (!Number.isInteger(day) || day < 1 || day > last) {
    throw new RangeError(`${month} 月に ${day} 日は無い`);
  }
  let doy = day;
  for (let m = 1; m < month; m++) doy += CALENDAR[m - 1]!;
  return doy;
}

/** 通日(1-366) → 月日。 */
export function monthDayOf(doy: number): { month: number; day: number } {
  if (!Number.isInteger(doy) || doy < 1 || doy > DAYS_IN_YEAR) {
    throw new RangeError(`通日が範囲外: ${doy}`);
  }
  let rest = doy;
  for (let m = 1; m <= 12; m++) {
    const last = CALENDAR[m - 1]!;
    if (rest <= last) return { month: m, day: rest };
    rest -= last;
  }
  /* c8 ignore next */
  throw new Error(`到達しないはず: ${doy}`);
}

/**
 * 通日で引ける平年値の索引。生成データは月日の昇順に並んでいるが、
 * その並びに頼らず月日から通日を計算して詰め直す(並びが変わっても壊れない)。
 */
const NORMAL_BY_DOY: readonly DailyNormal[] = (() => {
  const table = new Array<DailyNormal | undefined>(DAYS_IN_YEAR + 1);
  for (const d of DAILY_NORMALS) table[dayOfYearOf(d.month, d.day)] = d;
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    if (table[doy] === undefined) {
      const { month, day } = monthDayOf(doy);
      throw new Error(`平年値が無い: ${month}/${day}`);
    }
  }
  return table as DailyNormal[];
})();

/** 通日から平年値を引く。 */
export function normalOf(doy: number): DailyNormal {
  if (!Number.isInteger(doy) || doy < 1 || doy > DAYS_IN_YEAR) {
    throw new RangeError(`通日が範囲外: ${doy}`);
  }
  return NORMAL_BY_DOY[doy]!;
}

/**
 * 定植日 → 収穫日の対応表を作型ごとに一度だけ作る。
 * 逆引き(収穫日 → 定植日)も同時に持つので、`produceOn` が走査せずに済む。
 */
const HARVEST_INDEX = new Map<string, Map<number, number>>();

/** 収穫日 → その日に収穫を迎える最も早い定植日。 */
function harvestIndexFor(cultivar: LettuceCultivar): Map<number, number> {
  const cached = HARVEST_INDEX.get(cultivar.id);
  if (cached) return cached;

  const window = plantingWindowFor(cultivar);
  const byHarvest = new Map<number, number>();
  for (let planted = window.fromDoy; planted <= window.toDoy; planted++) {
    const harvest = harvestDayOf(planted, cultivar.daysToHarvest);
    // 定植日は昇順に見るので、最初に入ったものが最も早い定植日になる
    if (harvest !== null && !byHarvest.has(harvest)) byHarvest.set(harvest, planted);
  }
  HARVEST_INDEX.set(cultivar.id, byHarvest);
  return byHarvest;
}

/**
 * 定植日(通日)から、所要日数ぶんの生育可能日が積み上がる日を返す。
 *
 * 走査は暦年の末日で打ち切る(翌年へは繰り越さない)。野辺山では晩秋以降に生育可能日が
 * ほぼ無いため、打ち切りは「その年の作期が終わった」ことと実質的に同じである。
 * 積み上がらなければ null — その定植日にその作型は成立しない(T-07)。
 */
export function harvestDayOf(plantingDoy: number, daysToHarvest: number): number | null {
  if (!Number.isInteger(plantingDoy) || plantingDoy < 1 || plantingDoy > DAYS_IN_YEAR) {
    throw new RangeError(`定植日が範囲外: ${plantingDoy}`);
  }
  if (!Number.isInteger(daysToHarvest) || daysToHarvest < 1) {
    throw new RangeError(`所要日数が不正: ${daysToHarvest}`);
  }
  let grown = 0;
  for (let doy = plantingDoy + 1; doy <= DAYS_IN_YEAR; doy++) {
    if (isGrowingDay(normalOf(doy).tempMeanC)) {
      grown++;
      if (grown === daysToHarvest) return doy;
    }
  }
  return null;
}

export type ProduceItem = {
  cultivarId: string;
  name: string;
  heading: boolean;
  /** この収穫日に至る定植日(通日)。複数ありうるので最も早いものを代表に採る */
  plantedOnDoy: number;
};

/**
 * ある日に棚に並ぶものを返す。
 *
 * 作型ごとに、定植期間のすべての日から収穫日を求め、その日に当たるものを集める。
 * 定植期間が連続しているので、収穫日も概ね連続した帯になる。
 */
export function produceOn(doy: number): ProduceItem[] {
  if (!Number.isInteger(doy) || doy < 1 || doy > DAYS_IN_YEAR) {
    throw new RangeError(`通日が範囲外: ${doy}`);
  }
  const items: ProduceItem[] = [];
  for (const cultivar of LETTUCE_CULTIVARS) {
    const planted = harvestIndexFor(cultivar).get(doy);
    if (planted !== undefined) {
      items.push({
        cultivarId: cultivar.id,
        name: cultivar.name,
        heading: cultivar.heading,
        plantedOnDoy: planted,
      });
    }
  }
  return items;
}

/** 通年の旬カレンダー。日ごとに並ぶものを引ける形に畳んで返す。 */
export function seasonCalendar(): { doy: number; month: number; day: number; items: ProduceItem[] }[] {
  return Array.from({ length: DAYS_IN_YEAR }, (_, i) => {
    const doy = i + 1;
    const { month, day } = monthDayOf(doy);
    return { doy, month, day, items: produceOn(doy) };
  });
}
