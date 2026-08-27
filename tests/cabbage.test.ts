// キャベツとホウレンソウ(SPEC §5.5–5.9、T-54〜T-58)。
//
// レタスと同じ構造で縛る —— パラメータは原典の**本文**、検証は原典の**栽培暦**。
//
// ただし正直に書いておく: **この作物ではオラクルの判別力が弱い。**
// 下限 5/8/10 ℃ × 60/65/70 日の 18 組合せのうち、旬粒度の窓から外れるのは 1 件だけだった
// (loop_006 の実測)。だからパラメータを実測で選ばず、原典の記述だけから決めている。

import { describe, expect, it } from "vitest";
import {
  CROP_LABEL,
  CULTIVARS,
  PLANTING_WINDOWS,
  START_EVENT_LABEL,
  cropNames,
  cultivarById,
  plantingWindowFor,
} from "@/data/crops";
import {
  dayOfYearOf,
  DAYS_IN_YEAR,
  harvestDayOf,
  harvestDayOfCultivar,
  isGrowingDay,
  monthDayOf,
  produceOn,
} from "@/lib/harvest";

const CABBAGE = CULTIVARS.filter((c) => c.crop === "cabbage");
const LETTUCE = CULTIVARS.filter((c) => c.crop === "lettuce");

/** 栽培暦は棒グラフを目視で読む図なので、境界は旬(10 日)粒度でしか主張しない。 */
const SPAN_TOLERANCE_DAYS = 10;

function expectWithinOracle(
  harvestDoy: number,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  expect(harvestDoy).toBeGreaterThanOrEqual(dayOfYearOf(from[0], from[1]) - SPAN_TOLERANCE_DAYS);
  expect(harvestDoy).toBeLessThanOrEqual(dayOfYearOf(to[0], to[1]) + SPAN_TOLERANCE_DAYS);
}

describe("T-54 温度の閾値は作物ごとに違う", () => {
  it("走査対象が空でない", () => {
    expect(CABBAGE.length).toBeGreaterThan(0);
    expect(LETTUCE.length).toBeGreaterThan(0);
  });

  it("キャベツとレタスで生育可能日の範囲が違う", () => {
    // 一律の閾値を置いてはならない、という設計をテストで固定する。
    // 出所: BSI キャベツ p.12「8 ℃以下と 28 ℃以上では結球しない」／
    //       BSI レタス p.1「10 ℃以下と 30 ℃以上では生育が阻害される」
    for (const cultivar of CABBAGE) {
      expect(`${cultivar.id}: ${cultivar.growthLowC}–${cultivar.growthHighC}`).toBe(
        `${cultivar.id}: 8–28`,
      );
    }
    for (const cultivar of LETTUCE) {
      expect(`${cultivar.id}: ${cultivar.growthLowC}–${cultivar.growthHighC}`).toBe(
        `${cultivar.id}: 10–30`,
      );
    }
  });

  it("すべての作型が閾値の出所を持つ", () => {
    for (const cultivar of CULTIVARS) {
      expect(`${cultivar.id}: ${cultivar.thresholdSource.length > 20}`).toBe(
        `${cultivar.id}: true`,
      );
      expect(`${cultivar.id}: ${cultivar.source.length > 20}`).toBe(`${cultivar.id}: true`);
    }
  });

  it("耐える下限は伸びる下限より低い", () => {
    // 5 ℃ は枯れない下限、8/10 ℃ は伸びる下限。逆転したら取り違えている
    for (const cultivar of CULTIVARS) {
      expect(`${cultivar.id}: ${cultivar.survivalLowC < cultivar.growthLowC}`).toBe(
        `${cultivar.id}: true`,
      );
    }
  });

  it("閾値を渡すと判定が変わる(既定値に固定されていない)", () => {
    expect(isGrowingDay(9)).toBe(false); // レタスの既定 10 ℃ では生育しない
    expect(isGrowingDay(9, 8, 28)).toBe(true); // キャベツの閾値では生育する
    expect(isGrowingDay(29, 8, 28)).toBe(false); // 上限もキャベツの方が低い
    expect(isGrowingDay(29)).toBe(true);
  });
});

describe("T-55 オラクル — キャベツの収穫期", () => {
  // 出所: 外部権威。BSI キャベツ 図 2「各地のキャベツ栽培暦」寒冷地・冷涼地
  //   春キャベツ  定植 4 月下旬〜5 月下旬 → 収穫 7 月上旬〜8 月中旬
  //   夏秋キャベツ 定植 7 月上旬〜8 月上旬 → 収穫 9 月上旬〜10 月中旬
  // パラメータ(定植後 60〜70 日・8 ℃/28 ℃)を取った本文とは別の記述である
  const CASES = [
    { id: "cabbage-spring", from: [7, 1] as const, to: [8, 20] as const },
    { id: "cabbage-summer", from: [9, 1] as const, to: [10, 20] as const },
  ];

  it("定植期間の起点・終点が図 2 の旬と一致する", () => {
    expect(PLANTING_WINDOWS.springCabbageCold.fromDoy).toBe(dayOfYearOf(4, 21)); // 4 月下旬の初日
    expect(PLANTING_WINDOWS.springCabbageCold.toDoy).toBe(dayOfYearOf(5, 31)); // 5 月下旬の末日
    expect(PLANTING_WINDOWS.summerCabbageCold.fromDoy).toBe(dayOfYearOf(7, 1)); // 7 月上旬の初日
    expect(PLANTING_WINDOWS.summerCabbageCold.toDoy).toBe(dayOfYearOf(8, 10)); // 8 月上旬の末日
  });

  it.each(CASES)("$id の収穫日が栽培暦の窓に収まる", ({ id, from, to }) => {
    const cultivar = cultivarById(id)!;
    const window = plantingWindowFor(cultivar);
    let checked = 0;
    for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
      const harvest = harvestDayOfCultivar(doy, cultivar);
      if (harvest === null) continue;
      expectWithinOracle(harvest, from, to);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("春まきが夏まきより先に穫れる", () => {
    // 向きの検査。定植期間が違うので当然だが、窓の取り違えを捕まえる
    const spring = cultivarById("cabbage-spring")!;
    const summer = cultivarById("cabbage-summer")!;
    const first = (c: typeof spring) => {
      const w = plantingWindowFor(c);
      const days: number[] = [];
      for (let d = w.fromDoy; d <= w.toDoy; d++) {
        const h = harvestDayOfCultivar(d, c);
        if (h !== null) days.push(h);
      }
      return Math.min(...days);
    };
    expect(first(spring)).toBeLessThan(first(summer));
  });

  it("キャベツはレタスより所要日数が長い", () => {
    // 出所: 原典本文。レタス 40/50/60/35 日 対 キャベツ 65 日
    const longestLettuce = Math.max(...LETTUCE.map((c) => c.daysToHarvest));
    for (const cabbage of CABBAGE) {
      expect(`${cabbage.id}: ${cabbage.daysToHarvest >= longestLettuce}`).toBe(
        `${cabbage.id}: true`,
      );
    }
  });
});

describe("T-56 オラクルの判別力を測って記録する", () => {
  it("キャベツでは、閾値と日数をどう選んでも大半が窓に収まる", () => {
    // **この検査は「弱いこと」を確かめる。** 弱いと分かっているオラクルを
    // 強いつもりで使うと、パラメータを実測で選んでも気づけない。
    //
    // 実測 2026-08-27: 18 組合せのうち窓から外れるのは 1 件(5 ℃ × 60 日 × 春)。
    const window = PLANTING_WINDOWS.springCabbageCold;
    const inWindow = (lowC: number, days: number) => {
      const harvests: number[] = [];
      for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
        const h = harvestDayOf(doy, days, lowC, 28);
        if (h !== null) harvests.push(h);
      }
      if (harvests.length === 0) return false;
      const lo = dayOfYearOf(7, 1) - SPAN_TOLERANCE_DAYS;
      const hi = dayOfYearOf(8, 20) + SPAN_TOLERANCE_DAYS;
      return Math.min(...harvests) >= lo && Math.max(...harvests) <= hi;
    };

    const combos: { lowC: number; days: number; ok: boolean }[] = [];
    for (const lowC of [5, 8, 10]) {
      for (const days of [60, 65, 70]) combos.push({ lowC, days, ok: inWindow(lowC, days) });
    }

    const passing = combos.filter((c) => c.ok).length;
    // 9 組合せ中 8 つが通る = 判別力が弱い。これが「1 つしか通らない」に変わったら、
    // オラクルが強くなったということなので SPEC §5.6 を書き直す
    expect(`${passing}/${combos.length}`).toBe(`8/9`);
    expect(combos.find((c) => c.lowC === 5 && c.days === 60)!.ok).toBe(false);
  });

  it("対照: レタスではオラクルが効く(リーフが閾値を切り分ける)", () => {
    // 弱いオラクルばかりだと「オラクルは効かないもの」と思い込む。
    // 効く例を並べて置く
    const leaf = cultivarById("leaf")!;
    const window = plantingWindowFor(leaf);
    const at = (lowC: number) => harvestDayOf(window.fromDoy, leaf.daysToHarvest, lowC, 30)!;
    const lo = dayOfYearOf(6, 1) - SPAN_TOLERANCE_DAYS;
    expect(at(10)).toBeGreaterThanOrEqual(lo); // 原典どおりの閾値は通る
    expect(at(5)).toBeLessThan(lo); // 取り違えた閾値は落ちる
  });
});

describe("T-58 オラクル — ホウレンソウの収穫期", () => {
  // 出所: 外部権威。BSI ホウレンソウ p.2（寒冷地・冷涼地）
  //   「雪解け後の 4 月中旬から 9 月中旬まで播種して、5 月下旬から 10 月中旬までに収穫」
  // パラメータ（播種 35 日・5/25 ℃）を取った p.9 / p.1 とは別の記述である
  const spinach = cultivarById("spinach")!;

  it("**播種**から数える作型である（定植ではない）", () => {
    // 原典の日数がどちらから数えたものかを取り違えると、作期が丸ごとずれる。
    // ホウレンソウは直根性で移植を嫌うので直播きする（原典 p.2）
    expect(spinach.startEvent).toBe("sowing");
    for (const cultivar of CULTIVARS.filter((c) => c.crop !== "spinach")) {
      expect(`${cultivar.id}: ${cultivar.startEvent}`).toBe(`${cultivar.id}: transplanting`);
    }
  });

  it("播種期間の起点・終点が原典の旬と一致する", () => {
    expect(PLANTING_WINDOWS.spinachCold.fromDoy).toBe(dayOfYearOf(4, 11)); // 4 月中旬の初日
    expect(PLANTING_WINDOWS.spinachCold.toDoy).toBe(dayOfYearOf(9, 20)); // 9 月中旬の末日
  });

  it("収穫日が 5 月下旬〜10 月中旬に収まる", () => {
    const window = plantingWindowFor(spinach);
    let checked = 0;
    for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
      const harvest = harvestDayOfCultivar(doy, spinach);
      expect(harvest).not.toBeNull();
      expectWithinOracle(harvest!, [5, 21], [10, 20]);
      checked++;
    }
    // 播種期間の全日で成立する（レタスやキャベツと違い、間に合わない日が無い）
    expect(checked).toBe(window.toDoy - window.fromDoy + 1);
  });

  it("温度の閾値が 5–25 ℃ で、他の作物と違う", () => {
    expect(`${spinach.growthLowC}–${spinach.growthHighC}`).toBe("5–25");
    // 上限がいちばん低く、下限もいちばん低い
    for (const other of CULTIVARS.filter((c) => c.crop !== "spinach")) {
      expect(`${other.id}: ${other.growthLowC > spinach.growthLowC}`).toBe(`${other.id}: true`);
      expect(`${other.id}: ${other.growthHighC > spinach.growthHighC}`).toBe(`${other.id}: true`);
    }
  });

  it("いちばん早く棚に出る（5 ℃ から育つため）", () => {
    // 作物を足した意味がデータに出ていること
    const firstOf = (crop: string) => {
      for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
        if (produceOn(doy).some((p) => p.crop === crop)) return doy;
      }
      return DAYS_IN_YEAR + 1;
    };
    expect(firstOf("spinach")).toBeLessThan(firstOf("lettuce"));
    expect(firstOf("spinach")).toBeLessThan(firstOf("cabbage"));
  });
});

describe("T-59 作物の呼び名が型で縛られている", () => {
  it("すべての作物に日本語の呼び名がある", () => {
    // Record<Crop, string> なので、Crop を足したらここを埋めるまでコンパイルが通らない。
    // 以前はページ側に Record<string, string> とフォールバックを置いていて、
    // 埋め忘れが「レタスとキャベツと spinach の栽培生理」として出荷された(loop_007)
    for (const crop of new Set(CULTIVARS.map((c) => c.crop))) {
      const label = CROP_LABEL[crop];
      expect(`${crop}: ${label}`).not.toBe(`${crop}: undefined`);
      // 呼び名に英字が混ざっていない
      expect(`${crop}: ${/[A-Za-z]/.test(label)}`).toBe(`${crop}: false`);
    }
  });

  it("作物名の一覧が、出荷している作物と過不足なく一致する", () => {
    const names = cropNames();
    const crops = [...new Set(CULTIVARS.map((c) => c.crop))];
    expect(names).toHaveLength(crops.length);
    expect(names).toEqual(crops.map((c) => CROP_LABEL[c]));
  });

  it("作期の起点にも日本語の呼び名がある", () => {
    for (const cultivar of CULTIVARS) {
      const label = START_EVENT_LABEL[cultivar.startEvent];
      expect(`${cultivar.id}: ${/[A-Za-z]/.test(label)}`).toBe(`${cultivar.id}: false`);
    }
  });
});

describe("T-57 キャベツが棚と品書きに届いている", () => {
  it("キャベツが並ぶ日がある", () => {
    const days: number[] = [];
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      if (produceOn(doy).some((p) => p.crop === "cabbage")) days.push(doy);
    }
    expect(days.length).toBeGreaterThan(0);
    const first = monthDayOf(days[0]!);
    const last = monthDayOf(days[days.length - 1]!);
    // 出所: 実測 2026-08-27。春 7/1〜、秋 〜10/14
    expect(`${first.month}/${first.day}`).toBe("7/1");
    expect(`${last.month}/${last.day}`).toBe("10/14");
  });

  it("キャベツはレタスが終わったあとも棚に残る", () => {
    // 作物を足した意味がデータに出ていること
    const lastOf = (crop: string) => {
      let last = 0;
      for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
        if (produceOn(doy).some((p) => p.crop === crop)) last = doy;
      }
      return last;
    };
    expect(lastOf("cabbage")).toBeGreaterThan(lastOf("lettuce"));
  });

  it("真冬にはキャベツも並ばない", () => {
    for (const [m, d] of [
      [1, 15],
      [12, 25],
    ] as const) {
      expect(produceOn(dayOfYearOf(m, d)).filter((p) => p.crop === "cabbage")).toHaveLength(0);
    }
  });
});
