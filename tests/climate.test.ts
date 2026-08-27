// ページ本文に出る数値(SPEC §2、T-36〜T-38)。
//
// ページ側で数えない、という規律をテストで固定する。数えると、
// データを差し替えたのに文が古いまま、が起きる。

import { describe, expect, it } from "vitest";
import { annualMeanTempC, extremeMonths, hotDayCount, lowestDailyMinC } from "@/lib/climate";
import { DAYS_IN_YEAR, dayOfYearOf, monthDayOf } from "@/lib/harvest";
import { SEASONAL_ITEMS } from "@/data/shop";
import { seasonalDaysOf, seasonSpansOf, vegetableSeason } from "@/lib/shelf";

describe("T-36 平年値から出る一言", () => {
  it("年平均が 7 ℃台(サイトが主張してよい粒度)", () => {
    // 出所: SPEC §2。南牧村公式の「8 度前後」との差は観測所と村域代表点の違いとみなし、
    // 7 ℃台までしか主張しない
    const mean = annualMeanTempC();
    expect(mean).toBeGreaterThanOrEqual(7);
    expect(mean).toBeLessThan(8);
  });

  it("日平均が 30 ℃ 以上の日が 0 日", () => {
    expect(hotDayCount()).toBe(0);
  });

  it("最寒月が 1 月・最暖月が 8 月", () => {
    expect(extremeMonths()).toEqual({ coldest: 1, warmest: 8 });
  });

  it("日最低気温の平年値の最小が氷点下 10 ℃ を下回る", () => {
    // 出所: 実測 2026-08-27。-13.1 ℃。
    // 「冬の朝は氷点下十度を下回る」と書いている以上、データで裏を取る
    expect(lowestDailyMinC()).toBeLessThan(-10);
  });
});

describe("T-37 旬の帯の区間", () => {
  it("区間が、並ぶ日の集合をちょうど覆う", () => {
    // 帯の図はこの区間から描かれる。区間が日の集合とずれたら図が嘘になる
    for (const item of SEASONAL_ITEMS) {
      const days = new Set(seasonalDaysOf(item.id));
      const covered = new Set<number>();
      for (const span of seasonSpansOf(item.id)) {
        for (let doy = span.fromDoy; doy <= span.toDoy; doy++) covered.add(doy);
      }
      expect(`${item.id}: ${covered.size}`).toBe(`${item.id}: ${days.size}`);
      for (const doy of days) {
        expect(`${item.id}@${doy}: ${covered.has(doy)}`).toBe(`${item.id}@${doy}: true`);
      }
    }
  });

  it("区間が昇順で、重ならず、隣り合わない", () => {
    for (const item of SEASONAL_ITEMS) {
      const spans = seasonSpansOf(item.id);
      for (let i = 0; i < spans.length; i++) {
        expect(spans[i]!.fromDoy).toBeLessThanOrEqual(spans[i]!.toDoy);
        if (i > 0) {
          // 隣り合っていたら一つの区間にまとまっているはず
          expect(spans[i]!.fromDoy).toBeGreaterThan(spans[i - 1]!.toDoy + 1);
        }
      }
    }
  });

  it("高原野菜の作期は夏に寄り、冬を含まない", () => {
    const season = vegetableSeason();
    expect(season).not.toBeNull();
    expect(season!.dayCount).toBeGreaterThan(0);
    expect(season!.dayCount).toBeLessThan(DAYS_IN_YEAR);
    // 出所: 実測 2026-08-27(L7 時点)。5/16〜10/25、163 日。
    // ホウレンソウを足して作期が早まった(5 ℃ から育つのでレタスより 1 か月近く早い)。
    // 旬粒度で緩めて縛る
    expect(season!.fromDoy).toBeGreaterThanOrEqual(dayOfYearOf(5, 6));
    expect(season!.toDoy).toBeLessThanOrEqual(dayOfYearOf(11, 4));
  });
});

describe("T-38 月の目盛が通日に比例する", () => {
  it("12 等分ではなく、月の長さに応じた位置になる", () => {
    // 帯は通日に比例して描かれる。目盛を 12 等分に置くと最大 1.5 日ぶんずれる
    // (図に添える文字を図と別の根拠で置く事故・HC-039 と同型)
    const percentOf = (doy: number) => ((doy - 1) / DAYS_IN_YEAR) * 100;
    const ticks = Array.from({ length: 12 }, (_, i) => percentOf(dayOfYearOf(i + 1, 1)));

    expect(ticks[0]).toBe(0);
    // 2 月 1 日は 31/366 = 8.47%。12 等分なら 8.33% になるので、一致しないことを示す
    expect(ticks[1]).toBeCloseTo((31 / DAYS_IN_YEAR) * 100, 6);
    expect(ticks[1]).not.toBeCloseTo(100 / 12, 3);

    // 目盛は厳密に増加する
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]!).toBeGreaterThan(ticks[i - 1]!);
    }
  });

  it("月の初日の通日が暦と一致する", () => {
    // 出所: 暦(閏年 366 日)。生成データの暦と目盛の暦が同じものであること
    expect(dayOfYearOf(3, 1)).toBe(31 + 29 + 1);
    expect(dayOfYearOf(12, 31)).toBe(DAYS_IN_YEAR);
    expect(monthDayOf(DAYS_IN_YEAR)).toEqual({ month: 12, day: 31 });
  });
});
