// 電源容量の実演(F-07)。
//
// 「15 A まで」と書くだけでは、それが何を意味するか伝わらない。
// **同時に使える組み合わせを実際に数える。**
//
// 区画の電源は 15 A / 100 V = 1500 W。車載冷蔵庫はつけっぱなしになるので、
// 「冷蔵庫を入れたまま、あと何が使えるか」が実際の問いである。
//
// 検証は総当たり(部品数が 7 なので 2^7 = 128 通り)。近似も貪欲法も使わない。

import { APPLIANCES, POWER_LIMIT_W, type Appliance } from "../data/rv.ts";

export type Combination = {
  applianceIds: readonly string[];
  totalWatt: number;
};

/** 電力の合計。 */
export function totalWattOf(ids: readonly string[]): number {
  let total = 0;
  for (const id of ids) {
    const appliance = APPLIANCES.find((a) => a.id === id);
    if (!appliance) throw new Error(`製品が無い: ${id}`);
    total += appliance.watt;
  }
  return total;
}

/** 15 A に収まるか。 */
export function fitsInLimit(ids: readonly string[]): boolean {
  return totalWattOf(ids) <= POWER_LIMIT_W;
}

/**
 * すべての組み合わせを列挙する(空集合を含む)。
 * 製品が 7 点なので 2^7 = 128 通り。総当たりで足りる。
 */
export function allCombinations(appliances: readonly Appliance[] = APPLIANCES): Combination[] {
  const n = appliances.length;
  if (n > 20) throw new RangeError(`総当たりに大きすぎる: ${n} 点`);

  const out: Combination[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    const ids: string[] = [];
    let watt = 0;
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        ids.push(appliances[i]!.id);
        watt += appliances[i]!.watt;
      }
    }
    out.push({ applianceIds: ids, totalWatt: watt });
  }
  return out;
}

/**
 * 15 A に収まる組み合わせのうち、**製品の数が最も多いもの**。
 * 同数なら電力の小さいほうを採る(決定論のため、最後に id 順で一意に決める)。
 */
export function largestFittingCombination(
  appliances: readonly Appliance[] = APPLIANCES,
): Combination {
  const fitting = allCombinations(appliances).filter((c) => c.totalWatt <= POWER_LIMIT_W);
  return fitting.reduce((best, c) => {
    if (c.applianceIds.length !== best.applianceIds.length) {
      return c.applianceIds.length > best.applianceIds.length ? c : best;
    }
    if (c.totalWatt !== best.totalWatt) return c.totalWatt < best.totalWatt ? c : best;
    return c.applianceIds.join(",") < best.applianceIds.join(",") ? c : best;
  });
}

/**
 * ある製品を必ず入れたうえで、あと何が同時に使えるか。
 * 「冷蔵庫はつけっぱなし」という実際の使い方を表す。
 */
export function withMandatory(mandatoryIds: readonly string[]): {
  mandatoryWatt: number;
  remainingWatt: number;
  alsoUsable: string[];
  blocked: string[];
} {
  const mandatoryWatt = totalWattOf(mandatoryIds);
  const remainingWatt = POWER_LIMIT_W - mandatoryWatt;
  const rest = APPLIANCES.filter((a) => !mandatoryIds.includes(a.id));
  return {
    mandatoryWatt,
    remainingWatt,
    alsoUsable: rest.filter((a) => a.watt <= remainingWatt).map((a) => a.id),
    blocked: rest.filter((a) => a.watt > remainingWatt).map((a) => a.id),
  };
}

/**
 * その日の外気温で要る製品。旬カレンダーと同じく、決め打ちでなく気象平年値から決まる。
 * `neededBelowC` を下回る日だけ必要になる。
 */
export function appliancesNeededAt(tempMeanC: number): Appliance[] {
  return APPLIANCES.filter((a) => a.neededBelowC !== null && tempMeanC < a.neededBelowC);
}

/** 15 A に収まる組み合わせの数(空集合を除く)。 */
export function fittingCombinationCount(): number {
  return allCombinations().filter((c) => c.applianceIds.length > 0 && c.totalWatt <= POWER_LIMIT_W)
    .length;
}
