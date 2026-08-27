// RV パーク(SPEC F-07、T-40〜T-46)。
//
// 三つを縛る:
//   - 電源容量の実演 … 総当たりの厳密解をオラクルにする
//   - 混み具合のモデル … 作り物だからこそ 4 性質で縛る(senoto-mori G-05)
//   - 場内図 … 図とデータの二重定義を照合する(senoto-mori G-01)

import { describe, expect, it } from "vitest";
import {
  APPLIANCES,
  DECK,
  DECK_SIDE_THRESHOLD_M,
  POWER_LIMIT_A,
  POWER_LIMIT_W,
  RV_SITES,
} from "@/data/rv";
import {
  allCombinations,
  appliancesNeededAt,
  fitsInLimit,
  fittingCombinationCount,
  largestFittingCombination,
  totalWattOf,
  withMandatory,
} from "@/lib/power";
import {
  DAY_OF_WEEK_LABELS,
  SITE_COUNT,
  monthlyOutlook,
  occupancyLevelOf,
  occupancyOn,
  type DayOfWeek,
} from "@/lib/occupancy";
import { dayOfYearOf, DAYS_IN_YEAR, normalOf } from "@/lib/harvest";

describe("T-40 区画のデータ", () => {
  it("id が一意で、区画が空でない", () => {
    expect(RV_SITES.length).toBeGreaterThan(0);
    const ids = RV_SITES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("区画どうしが重ならない", () => {
    // 図に描く以上、重なっていたら図が嘘になる
    for (let i = 0; i < RV_SITES.length; i++) {
      for (let j = i + 1; j < RV_SITES.length; j++) {
        const a = RV_SITES[i]!;
        const b = RV_SITES[j]!;
        const overlapX = a.x < b.x + b.widthM && b.x < a.x + a.widthM;
        const overlapY = a.y < b.y + b.lengthM && b.y < a.y + a.lengthM;
        expect(`${a.id}×${b.id}: ${overlapX && overlapY}`).toBe(`${a.id}×${b.id}: false`);
      }
    }
  });

  it("電源付きと電源なしの両方がある", () => {
    // どちらかが空だと、電源の話をする意味が無くなる
    expect(RV_SITES.some((s) => s.power)).toBe(true);
    expect(RV_SITES.some((s) => !s.power)).toBe(true);
  });
});

describe("T-41 循環の禁止 — デッキ側の判定", () => {
  it("手で書いた deckSide が、デッキとの距離から独立に計算した結果と一致する", () => {
    // データの `deckSide` は人手で書いたフラグ。座標から独立に計算して照合する。
    // どちらか一方を他方から生成した瞬間、この検査は何も検証しなくなる
    // (senoto-mori G-03 と同じ構造)
    for (const site of RV_SITES) {
      const gap = site.y - (DECK.y + DECK.depthM);
      const computed = gap <= DECK_SIDE_THRESHOLD_M;
      expect(`${site.id}: ${computed}`).toBe(`${site.id}: ${site.deckSide}`);
    }
  });

  it("デッキ側とそうでない区画が両方ある(常に true/false の実装を落とす)", () => {
    expect(RV_SITES.some((s) => s.deckSide)).toBe(true);
    expect(RV_SITES.some((s) => !s.deckSide)).toBe(true);
  });
});

describe("T-42 電源容量 — 総当たりのオラクル", () => {
  it("上限が 15 A / 1500 W である", () => {
    expect(POWER_LIMIT_A).toBe(15);
    expect(POWER_LIMIT_W).toBe(1500);
  });

  it("組み合わせを漏れなく列挙する", () => {
    // 2^n。近似も枝刈りもしていないことの検算
    expect(allCombinations()).toHaveLength(2 ** APPLIANCES.length);
  });

  it("最も多く同時に使える組み合わせが、総当たりの厳密解と一致する", () => {
    // オラクルは総当たりそのもの。実装が同じ総当たりなので、
    // ここでは「独立に書いた素朴な走査」と突き合わせる
    const best = largestFittingCombination();

    let bestCount = -1;
    let bestWatt = Number.POSITIVE_INFINITY;
    for (let mask = 0; mask < 1 << APPLIANCES.length; mask++) {
      let watt = 0;
      let count = 0;
      for (let i = 0; i < APPLIANCES.length; i++) {
        if (mask & (1 << i)) {
          watt += APPLIANCES[i]!.watt;
          count++;
        }
      }
      if (watt > POWER_LIMIT_W) continue;
      if (count > bestCount || (count === bestCount && watt < bestWatt)) {
        bestCount = count;
        bestWatt = watt;
      }
    }
    expect(best.applianceIds.length).toBe(bestCount);
    expect(best.totalWatt).toBe(bestWatt);
    expect(best.totalWatt).toBeLessThanOrEqual(POWER_LIMIT_W);
  });

  it("収まる組み合わせが 1 つ以上あり、全部は入らない", () => {
    // 「何でも使える」なら実演の意味が無く、「何も使えない」なら設定が壊れている
    expect(fittingCombinationCount()).toBeGreaterThan(0);
    expect(fitsInLimit(APPLIANCES.map((a) => a.id))).toBe(false);
  });

  it("冷蔵庫をつけたままだと、電気ケトルと炊飯器は同時に使えない", () => {
    // 出所: 実測。冷蔵庫 45 W + ケトル 1000 W + 炊飯器 700 W = 1745 W > 1500 W
    expect(totalWattOf(["fridge", "kettle", "rice-cooker"])).toBe(1745);
    expect(fitsInLimit(["fridge", "kettle", "rice-cooker"])).toBe(false);
    expect(fitsInLimit(["fridge", "kettle"])).toBe(true);
  });

  it("必須の製品を入れたときの残りが、使えるものと使えないものに過不足なく分かれる", () => {
    const result = withMandatory(["fridge"]);
    expect(result.mandatoryWatt).toBe(45);
    expect(result.remainingWatt).toBe(POWER_LIMIT_W - 45);
    const rest = APPLIANCES.filter((a) => a.id !== "fridge").map((a) => a.id);
    expect([...result.alsoUsable, ...result.blocked].sort()).toEqual([...rest].sort());
    for (const id of result.alsoUsable) {
      expect(`${id}: ${fitsInLimit(["fridge", id])}`).toBe(`${id}: true`);
    }
    for (const id of result.blocked) {
      expect(`${id}: ${fitsInLimit(["fridge", id])}`).toBe(`${id}: false`);
    }
  });

  it("知らない製品は例外にする", () => {
    expect(() => totalWattOf(["no-such-appliance"])).toThrow();
  });
});

describe("T-43 気温で要るものが変わる", () => {
  it("真冬には電気毛布が要り、真夏には要らない", () => {
    // 決め打ちでなく気象平年値から決まる(旬カレンダーと同じ構造)
    const winter = normalOf(dayOfYearOf(1, 15)).tempMeanC;
    const summer = normalOf(dayOfYearOf(8, 1)).tempMeanC;
    expect(appliancesNeededAt(winter).map((a) => a.id)).toContain("blanket");
    expect(appliancesNeededAt(summer)).toHaveLength(0);
  });

  it("暖房を足しても 15 A に収まる組み合わせが残る", () => {
    // 「冬は電源があっても何も使えない」では設定として破綻している
    const winter = normalOf(dayOfYearOf(1, 15)).tempMeanC;
    const needed = appliancesNeededAt(winter).map((a) => a.id);
    expect(needed.length).toBeGreaterThan(0);
    expect(fitsInLimit(needed)).toBe(true);
    expect(withMandatory(needed).alsoUsable.length).toBeGreaterThan(0);
  });
});

describe("T-44 混み具合のモデル — 4 つの性質", () => {
  const ALL_DOW: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];

  it("決定論(同じ入力で常に同じ出力)", () => {
    for (const doy of [1, 100, 200, 300, 366]) {
      for (const dow of ALL_DOW) {
        expect(occupancyOn(doy, dow)).toBe(occupancyOn(doy, dow));
      }
    }
  });

  it("保存則(0 以上、区画数以下)", () => {
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      for (const dow of ALL_DOW) {
        const value = occupancyOn(doy, dow);
        expect(`${doy}/${dow}: ${value >= 0 && value <= SITE_COUNT}`).toBe(`${doy}/${dow}: true`);
      }
    }
  });

  it("偏りの不在(通年で常に満も常に空も無い)", () => {
    // これが無いと「常に 0 を返す」実装が上の二つを通過してしまう
    const values = new Set<number>();
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      for (const dow of ALL_DOW) values.add(occupancyOn(doy, dow));
    }
    expect(values.size).toBeGreaterThan(3);
    expect([...values].some((v) => v === 0)).toBe(true);
    expect([...values].some((v) => v > SITE_COUNT * 0.6)).toBe(true);
    expect([...values].every((v) => v === SITE_COUNT)).toBe(false);
  });

  it("需要の向き(夏の土曜 > 冬の平日)", () => {
    const summerSaturday = occupancyOn(dayOfYearOf(8, 1), 6);
    const winterWeekday = occupancyOn(dayOfYearOf(1, 15), 3);
    expect(summerSaturday - winterWeekday).toBeGreaterThan(SITE_COUNT * 0.4);
  });

  it("需要の向き(通年で土曜の平均 ≥ 水曜の平均)", () => {
    const mean = (dow: DayOfWeek) => {
      let sum = 0;
      for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) sum += occupancyOn(doy, dow);
      return sum / DAYS_IN_YEAR;
    };
    expect(mean(6)).toBeGreaterThan(mean(3));
  });

  it("範囲外は例外にする", () => {
    expect(() => occupancyOn(0, 3)).toThrow();
    expect(() => occupancyOn(367, 3)).toThrow();
    expect(() => occupancyOn(1, 7 as DayOfWeek)).toThrow();
  });
});

describe("T-45 見込みの言葉と表", () => {
  it("三段階が値域を過不足なく覆う", () => {
    const levels = new Set<string>();
    for (let occupied = 0; occupied <= SITE_COUNT; occupied++) {
      levels.add(occupancyLevelOf(occupied));
    }
    expect(levels).toEqual(new Set(["空いている", "半分ほど", "混みあう"]));
    expect(occupancyLevelOf(0)).toBe("空いている");
    expect(occupancyLevelOf(SITE_COUNT)).toBe("混みあう");
  });

  it("月ごとの表が 12 か月そろい、夏が冬より混む", () => {
    const outlook = monthlyOutlook();
    expect(outlook.map((o) => o.month)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const august = outlook.find((o) => o.month === 8)!;
    const january = outlook.find((o) => o.month === 1)!;
    expect(august.saturday).toBeGreaterThan(january.saturday);
    for (const row of outlook) {
      expect(`${row.month}: ${row.saturday >= row.weekday}`).toBe(`${row.month}: true`);
    }
  });

  it("曜日の呼び名が 7 つそろっている", () => {
    expect(DAY_OF_WEEK_LABELS).toHaveLength(7);
    expect(DAY_OF_WEEK_LABELS[0]).toBe("日");
    expect(DAY_OF_WEEK_LABELS[6]).toBe("土");
  });
});

describe("T-46 ゲートが落ちることの実証", () => {
  it("常に 0 を返すモデルは「偏りの不在」で落ちる", () => {
    // 決定論と保存則だけなら、常に 0 を返す実装が通過してしまう。
    // 「偏りの不在」がその実装を実際に弾くことを、両方を並べて示す
    const distinctValuesOf = (model: (doy: number) => number) => {
      const values = new Set<number>();
      for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) values.add(model(doy));
      return values;
    };

    const fake = distinctValuesOf(() => 0);
    const real = distinctValuesOf((doy) => occupancyOn(doy, 6));

    expect(fake.size).toBe(1); // 偽物は 1 種類しか返さない → 性質を満たさない
    expect(real.size).toBeGreaterThan(3); // 本物は満たす
  });

  it("デッキ側のフラグを一つ反転させると、独立計算との照合が落ちる", () => {
    const site = RV_SITES.find((s) => s.deckSide)!;
    const flipped = !site.deckSide;
    const gap = site.y - (DECK.y + DECK.depthM);
    const computed = gap <= DECK_SIDE_THRESHOLD_M;
    expect(computed).not.toBe(flipped);
  });
});
