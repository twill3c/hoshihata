import { describe, expect, it } from "vitest";
import { DAILY_NORMALS, NORMALS_STATION } from "@/data/normals.generated";
import { LETTUCE_CULTIVARS, PLANTING_WINDOWS } from "@/data/crops";
import {
  dayOfYearOf,
  harvestDayOf,
  isGrowingDay,
  isSurvivableDay,
  monthDayOf,
  normalOf,
  produceOn,
} from "@/lib/harvest";

describe("T-01 平年値データの形", () => {
  it("通年 366 日で、月ごとの日数が暦どおり、日付が連番である", () => {
    // 出所: 実測。気象庁の日別平年値は閏日 2/29 を含む(2026-08-27 に生成器が検出)
    expect(DAILY_NORMALS).toHaveLength(366);

    const perMonth = new Map<number, number[]>();
    for (const d of DAILY_NORMALS) {
      if (!perMonth.has(d.month)) perMonth.set(d.month, []);
      perMonth.get(d.month)!.push(d.day);
    }
    const calendar = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    expect([...perMonth.keys()].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    for (const [month, days] of perMonth) {
      expect(days).toEqual(Array.from({ length: calendar[month - 1]! }, (_, i) => i + 1));
    }
  });

  it("平均気温に欠測が無い(モデルの入力になるため)", () => {
    for (const d of DAILY_NORMALS) {
      expect(Number.isFinite(d.tempMeanC)).toBe(true);
    }
  });
});

describe("T-02 観測所メタ", () => {
  it("気象庁の観測所定義と一致する", () => {
    // 出所: 外部権威。気象庁「過去の気象データ検索」の観測所定義
    //   viewPoint('a','0415','野辺山','ノベヤマ','35','56.9','138','28.3','1350',...)
    expect(NORMALS_STATION.precNo).toBe(48);
    expect(NORMALS_STATION.blockNo).toBe("0415");
    expect(NORMALS_STATION.elevationM).toBe(1350);
    expect(NORMALS_STATION.period).toBe("1991-2020");
    expect(NORMALS_STATION.latitudeDeg).toBeCloseTo(35 + 56.9 / 60, 6);
    expect(NORMALS_STATION.longitudeDeg).toBeCloseTo(138 + 28.3 / 60, 6);
  });
});

describe("T-03 平年値の妥当性", () => {
  const means = DAILY_NORMALS.map((d) => d.tempMeanC);

  it("年平均が 7 ℃台である", () => {
    // 出所: SPEC §2。南牧村公式「1 年の平均気温は 8 度前後」との整合を、
    // 観測所と村域代表点の差を許して 7 ℃台までで主張する
    const annual = means.reduce((a, b) => a + b, 0) / means.length;
    expect(annual).toBeGreaterThanOrEqual(7);
    expect(annual).toBeLessThan(8);
  });

  it("日平均が 30 ℃ 以上になる日が無い", () => {
    // 出所: 南牧村公式「真夏の昼間でも 30 度を超えることはほとんどありません」
    expect(DAILY_NORMALS.filter((d) => d.tempMeanC >= 30)).toHaveLength(0);
  });

  it("最寒月が 1 月、最暖月が 8 月である", () => {
    // 出所: 実測(平年値の月平均)。生成器が月をずらして読んだときに落ちる検算を兼ねる
    const byMonth = new Map<number, number[]>();
    for (const d of DAILY_NORMALS) {
      if (!byMonth.has(d.month)) byMonth.set(d.month, []);
      byMonth.get(d.month)!.push(d.tempMeanC);
    }
    const avg = [...byMonth.entries()].map(([m, xs]) => ({
      month: m,
      mean: xs.reduce((a, b) => a + b, 0) / xs.length,
    }));
    expect(avg.reduce((a, b) => (a.mean <= b.mean ? a : b)).month).toBe(1);
    expect(avg.reduce((a, b) => (a.mean >= b.mean ? a : b)).month).toBe(8);
  });
});

describe("T-08 生育可能日の判定", () => {
  it("10 ℃ ちょうど・30 ℃ ちょうどは生育可能日でない(開区間)", () => {
    // 出所: SPEC §5.2 / 原典 p.1「10 ℃以下と 30 ℃以上では生育が阻害される」
    expect(isGrowingDay(10)).toBe(false);
    expect(isGrowingDay(30)).toBe(false);
    expect(isGrowingDay(10.1)).toBe(true);
    expect(isGrowingDay(29.9)).toBe(true);
    expect(isGrowingDay(-5)).toBe(false);
  });

  it("5 ℃ 超 10 ℃ 以下は「生育しないが枯れない」帯である", () => {
    // 出所: SPEC §5.2。原典 p.2「5 ℃以下…に於いて生育が停止する」は耐える下限、
    // p.1 の 10 ℃ は伸びる下限。取り違えると作期が丸ごとずれる
    expect(isSurvivableDay(7)).toBe(true);
    expect(isGrowingDay(7)).toBe(false);
    expect(isSurvivableDay(5)).toBe(false);
  });
});

/**
 * 栽培暦(図 2 / 図 3)は棒グラフを目視で読む図であり、日単位の精度を保証していない。
 * 境界は旬(10 日)粒度でしか主張できないので、オラクルの窓を前後 1 旬ぶん緩めて当てる
 * (HC-016「SPEC の保証粒度を超えない」)。それでも判別力は残る —
 * 閾値 5 ℃ 版のリーフレタスは開始 5/16 で、緩めた窓(5/22 以降)からも外れて落ちる(T-04b)。
 */
const SPAN_TOLERANCE_DAYS = 10;

/** 収穫日が、旬粒度に緩めたオラクルの窓に収まることを確かめる。 */
function expectWithinOracle(
  harvestDoy: number,
  from: readonly [number, number],
  to: readonly [number, number],
) {
  const lo = dayOfYearOf(from[0], from[1]) - SPAN_TOLERANCE_DAYS;
  const hi = dayOfYearOf(to[0], to[1]) + SPAN_TOLERANCE_DAYS;
  expect(harvestDoy).toBeGreaterThanOrEqual(lo);
  expect(harvestDoy).toBeLessThanOrEqual(hi);
}

describe("T-04 オラクル A — 結球レタスの収穫期", () => {
  // 出所: 外部権威。BSI レタス 図 2「各地の結球レタス栽培暦」寒冷地・冷涼地
  //   定植 5 月中旬〜8 月中旬 → 収穫 6 月下旬〜10 月中旬
  // パラメータ(定植後 40/50/60 日・停止温度)を取った本文とは別の記述である(SPEC §5.3)
  const window = PLANTING_WINDOWS.headingLettuceCold;
  const headed = LETTUCE_CULTIVARS.filter((c) => c.heading);

  it("定植期間の起点・終点が図 2 の旬と一致する", () => {
    // 旬 → 日の変換規則(上旬 1-10 / 中旬 11-20 / 下旬 21-月末)が SPEC どおりか
    expect(window.fromDoy).toBe(dayOfYearOf(5, 11)); // 5 月中旬の初日
    expect(window.toDoy).toBe(dayOfYearOf(8, 20)); // 8 月中旬の末日
  });

  it("図 2 の定植期間に定植すると、収穫日が 6 月下旬〜10 月中旬に収まる", () => {
    expect(headed.length).toBeGreaterThan(0); // 空集合で素通りしないこと

    let checked = 0;
    for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
      for (const cultivar of headed) {
        const harvest = harvestDayOf(doy, cultivar.daysToHarvest);
        if (harvest === null) continue; // 作期に間に合わない定植は下の不変量で縛る
        expectWithinOracle(harvest, [6, 21], [10, 20]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("作期に間に合わない定植は、期間の終わり側に固まる(単調)", () => {
    // 不変量。野辺山では晩夏に定植した晩生種が秋までに所要日数を積めない。
    // これはモデルの欠陥ではなく土地の性質なので「遅い定植だけが落ちる」ことで縛る。
    // 早い定植が落ちて遅い定植が成立したらモデルが壊れている
    for (const cultivar of headed) {
      let seenFailure = false;
      for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
        const ok = harvestDayOf(doy, cultivar.daysToHarvest) !== null;
        if (!ok) seenFailure = true;
        else expect(seenFailure).toBe(false);
      }
    }
  });
});

describe("T-05 オラクル A — リーフレタスの収穫期", () => {
  // 出所: 外部権威。BSI レタス 図 3 寒冷地・冷涼地
  //   定植 4 月中旬〜8 月上旬 → 収穫 6 月上旬〜10 月上旬
  const window = PLANTING_WINDOWS.leafLettuceCold;
  const leaf = LETTUCE_CULTIVARS.filter((c) => !c.heading);

  it("定植期間の起点・終点が図 3 の旬と一致する", () => {
    expect(window.fromDoy).toBe(dayOfYearOf(4, 11)); // 4 月中旬の初日
    expect(window.toDoy).toBe(dayOfYearOf(8, 10)); // 8 月上旬の末日
  });

  it("図 3 の定植期間に定植すると、収穫日が 6 月上旬〜10 月上旬に収まる", () => {
    expect(leaf.length).toBeGreaterThan(0);

    let checked = 0;
    for (let doy = window.fromDoy; doy <= window.toDoy; doy++) {
      for (const cultivar of leaf) {
        const harvest = harvestDayOf(doy, cultivar.daysToHarvest);
        if (harvest === null) continue;
        expectWithinOracle(harvest, [6, 1], [10, 10]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe("T-04b ゲートが落ちることの実証", () => {
  it("生育可能日の下限を 5 ℃ に戻すと、リーフレタスがオラクルの窓から外れる", () => {
    // 新しいゲートは、わざと違反させて落ちることを確かめるまで信用しない(SPEC §6)。
    // 実装と同じ手順を閾値だけ変えて手で回し、オラクルが実際に反応することを示す
    const stopLow = 5;
    const cultivar = LETTUCE_CULTIVARS.find((c) => !c.heading)!;
    const window = PLANTING_WINDOWS.leafLettuceCold;

    const harvestWith = (plantingDoy: number, need: number): number | null => {
      let grown = 0;
      for (let doy = plantingDoy + 1; doy <= 366; doy++) {
        const t = normalOf(doy).tempMeanC;
        if (t > stopLow && t < 30) {
          grown++;
          if (grown === need) return doy;
        }
      }
      return null;
    };

    const earliest = harvestWith(window.fromDoy, cultivar.daysToHarvest);
    expect(earliest).not.toBeNull();
    // 5 ℃ 版は 5/16 に収穫を出す。緩めたオラクルの窓(6/1 の 1 旬前 = 5/22)より早い
    expect(earliest!).toBeLessThan(dayOfYearOf(6, 1) - SPAN_TOLERANCE_DAYS);
    expect(() => expectWithinOracle(earliest!, [6, 1], [10, 10])).toThrow();
  });
});

describe("T-06 オラクル B — 南牧村の出荷期", () => {
  it("結球レタスが並ぶ日は 6 月下旬〜10 月に収まる", () => {
    // 出所: 外部権威。南牧村公式「高原野菜のふるさと」— 出荷は 6 月下旬から 10 月まで。
    // 南牧村も旬粒度でしか書いていないので前後 1 旬を許す
    const days: number[] = [];
    for (let doy = 1; doy <= 366; doy++) {
      if (produceOn(doy).some((p) => p.heading)) days.push(doy);
    }
    expect(days.length).toBeGreaterThan(0);
    for (const doy of days) expectWithinOracle(doy, [6, 21], [10, 31]);
  });

  it("真冬(1 月・2 月・12 月)には何も並ばない", () => {
    for (const [month, day] of [
      [1, 15],
      [2, 15],
      [12, 25],
    ] as const) {
      expect(produceOn(dayOfYearOf(month, day))).toHaveLength(0);
    }
  });
});

describe("T-07 生育停止の効き", () => {
  it("冬に定植した作型は収穫日を持たない", () => {
    // 出所: SPEC §5.2。11/1 定植では生育可能日が積み上がらず、
    // 暦年の末日まで走査しても所要日数に到達しない
    expect(harvestDayOf(dayOfYearOf(11, 1), 40)).toBeNull();
    expect(harvestDayOf(dayOfYearOf(12, 1), 30)).toBeNull();
  });
});

describe("T-09 単調性", () => {
  it("同じ定植日なら所要日数が長い作型ほど収穫が遅い", () => {
    // 出所: 不変量。モデルの定義から必然に従う
    for (const [month, day] of [
      [5, 20],
      [6, 15],
      [7, 10],
    ] as const) {
      const doy = dayOfYearOf(month, day);
      const early = harvestDayOf(doy, 40);
      const mid = harvestDayOf(doy, 50);
      const late = harvestDayOf(doy, 60);
      expect(early).not.toBeNull();
      expect(mid).not.toBeNull();
      expect(late).not.toBeNull();
      expect(early!).toBeLessThanOrEqual(mid!);
      expect(mid!).toBeLessThanOrEqual(late!);
    }
  });
});

describe("T-10 決定論", () => {
  it("同じ入力で常に同じ出力になる", () => {
    const once = Array.from({ length: 366 }, (_, i) => produceOn(i + 1));
    const twice = Array.from({ length: 366 }, (_, i) => produceOn(i + 1));
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });
});

describe("通日と月日の相互変換", () => {
  it("往復して元に戻る", () => {
    for (let doy = 1; doy <= 366; doy++) {
      const { month, day } = monthDayOf(doy);
      expect(dayOfYearOf(month, day)).toBe(doy);
    }
  });

  it("範囲外は例外にする", () => {
    expect(() => monthDayOf(0)).toThrow();
    expect(() => monthDayOf(367)).toThrow();
    expect(() => dayOfYearOf(2, 30)).toThrow();
  });
});
