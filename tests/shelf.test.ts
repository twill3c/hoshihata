// 直売所と食堂(SPEC F-04 / F-05、T-30〜T-37)。
//
// 背骨は「品書きを旬カレンダーの出力から組み立てる」こと。
// 決め打ちの品書きを別に持たない。持てば必ず旬の話と食い違う。
//
// データどうしは id で結び、穴をテストで塞ぐ(sugi-nami の soba.test.ts と同型)。

import { describe, expect, it } from "vitest";
import { CULTIVARS } from "@/data/crops";
import { MENU_ITEMS } from "@/data/menu";
import { SHOP_CATEGORIES, SHOP_ITEMS, SEASONAL_ITEMS, YEAR_ROUND_ITEMS } from "@/data/shop";
import { dayOfYearOf, DAYS_IN_YEAR, produceOn } from "@/lib/harvest";
import { menuOn, shelfOn, seasonalDaysOf, shopItemsOnShelf } from "@/lib/shelf";

describe("T-30 直売所のデータの整合", () => {
  it("id が一意で、分類がすべて定義済み", () => {
    const ids = SHOP_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known = new Set(SHOP_CATEGORIES.map((c) => c.id));
    for (const item of SHOP_ITEMS) {
      expect(`${item.id}: ${known.has(item.category)}`).toBe(`${item.id}: true`);
    }
  });

  it("どの分類にも品が一つ以上ある", () => {
    // 分類だけあって空、という棚を出さない
    for (const category of SHOP_CATEGORIES) {
      const count = SHOP_ITEMS.filter((i) => i.category === category.id).length;
      expect(`${category.name}: ${count > 0}`).toBe(`${category.name}: true`);
    }
  });

  it("季節の品の作型 id が、すべて実在の作型を指す", () => {
    // 二重定義の照合。文字列で書き写した id は必ずいつか腐る
    const cultivarIds = new Set(CULTIVARS.map((c) => c.id));
    expect(SEASONAL_ITEMS.length).toBeGreaterThan(0);
    for (const item of SEASONAL_ITEMS) {
      expect(`${item.id} → ${item.cultivarId}: ${cultivarIds.has(item.cultivarId!)}`).toBe(
        `${item.id} → ${item.cultivarId}: true`,
      );
    }
  });

  it("すべての作型が、直売所のどれかの品に割り当たっている", () => {
    // 逆向きの穴。作型を足したのに棚に出ない、が起きないように縛る
    const covered = new Set(SEASONAL_ITEMS.map((i) => i.cultivarId));
    for (const cultivar of CULTIVARS) {
      expect(`${cultivar.id}: ${covered.has(cultivar.id)}`).toBe(`${cultivar.id}: true`);
    }
  });

  it("季節の品と通年の品で、全品を過不足なく二分する", () => {
    expect(SEASONAL_ITEMS.length + YEAR_ROUND_ITEMS.length).toBe(SHOP_ITEMS.length);
    expect(SEASONAL_ITEMS.some((i) => i.cultivarId === null)).toBe(false);
    expect(YEAR_ROUND_ITEMS.some((i) => i.cultivarId !== null)).toBe(false);
  });
});

describe("T-31 品書きのデータの整合", () => {
  it("id が一意", () => {
    const ids = MENU_ITEMS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("すべての素材が実在の直売所の品を指す", () => {
    // 素材名を文字列で書き写さず id で結ぶ、という規律をテストで固定する
    const known = new Set(SHOP_ITEMS.map((i) => i.id));
    expect(MENU_ITEMS.length).toBeGreaterThan(0);
    for (const item of MENU_ITEMS) {
      expect(item.ingredientIds.length).toBeGreaterThan(0);
      for (const ingredient of item.ingredientIds) {
        expect(`${item.id} → ${ingredient}: ${known.has(ingredient)}`).toBe(
          `${item.id} → ${ingredient}: true`,
        );
      }
    }
  });

  it("すべての作型が、いずれかの品書きで使われている", () => {
    // 「その日の野菜」を謳う以上、棚に出る野菜は必ずどれかの品に使われるべき
    const used = new Set(MENU_ITEMS.flatMap((m) => m.ingredientIds));
    for (const item of SEASONAL_ITEMS) {
      expect(`${item.id}: ${used.has(item.id)}`).toBe(`${item.id}: true`);
    }
  });

  it("野菜を使わない品が一つ以上ある(冬に品書きが空にならない)", () => {
    const seasonalIds = new Set(SEASONAL_ITEMS.map((i) => i.id));
    const yearRoundMenus = MENU_ITEMS.filter(
      (m) => !m.ingredientIds.some((id) => seasonalIds.has(id)),
    );
    expect(yearRoundMenus.length).toBeGreaterThan(0);
  });
});

describe("T-32 棚が旬カレンダーと一致する", () => {
  it("季節の品が並ぶ日は、その作型の収穫日と完全に一致する", () => {
    // 棚を旬カレンダーから作っていることの直接の検査。
    // どちらかを他方から独立に決めた瞬間、この検査は意味を失う
    for (const item of SEASONAL_ITEMS) {
      const shelfDays = seasonalDaysOf(item.id);
      const harvestDays = new Set<number>();
      for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
        if (produceOn(doy).some((p) => p.cultivarId === item.cultivarId)) harvestDays.add(doy);
      }
      expect(`${item.id}: ${shelfDays.length}`).toBe(`${item.id}: ${harvestDays.size}`);
      for (const doy of shelfDays) {
        expect(`${item.id}@${doy}: ${harvestDays.has(doy)}`).toBe(`${item.id}@${doy}: true`);
      }
    }
  });

  it("通年の品はどの日でも棚にある", () => {
    for (const doy of [dayOfYearOf(1, 15), dayOfYearOf(7, 15), dayOfYearOf(12, 25)]) {
      const ids = new Set(shopItemsOnShelf(doy).map((i) => i.id));
      for (const item of YEAR_ROUND_ITEMS) {
        expect(`${doy}/${item.id}: ${ids.has(item.id)}`).toBe(`${doy}/${item.id}: true`);
      }
    }
  });

  it("真冬の棚に高原野菜が一つも無い", () => {
    // SPEC §1 の「冬は何も並ばない」を、文でなく計算で示していること
    for (const [month, day] of [
      [1, 15],
      [2, 15],
      [12, 25],
    ] as const) {
      const shelf = shelfOn(dayOfYearOf(month, day));
      expect(`${month}/${day}: ${shelf.seasonal.length}`).toBe(`${month}/${day}: 0`);
      expect(shelf.yearRound.length).toBeGreaterThan(0);
    }
  });

  it("盛夏の棚には高原野菜が並ぶ", () => {
    const shelf = shelfOn(dayOfYearOf(8, 1));
    expect(shelf.seasonal.length).toBeGreaterThan(0);
  });
});

describe("T-33 品書きが棚と一致する", () => {
  it("出せる品は、素材がすべてその日の棚にあるものに限る", () => {
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      const available = new Set(shopItemsOnShelf(doy).map((i) => i.id));
      for (const item of menuOn(doy)) {
        for (const ingredient of item.ingredientIds) {
          expect(`${doy}/${item.id}/${ingredient}: ${available.has(ingredient)}`).toBe(
            `${doy}/${item.id}/${ingredient}: true`,
          );
        }
      }
    }
  });

  it("素材が揃っている品は、必ず品書きに出る(取りこぼしが無い)", () => {
    // 上の検査だけだと「常に空を返す」実装が通ってしまう。逆向きも縛る
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      const available = new Set(shopItemsOnShelf(doy).map((i) => i.id));
      const expected = MENU_ITEMS.filter((m) => m.ingredientIds.every((i) => available.has(i)));
      expect(`${doy}: ${menuOn(doy).map((m) => m.id).sort().join(",")}`).toBe(
        `${doy}: ${expected.map((m) => m.id).sort().join(",")}`,
      );
    }
  });

  it("どの日でも品書きが空にならない", () => {
    // 冬でも出せるものがある、という設定がデータで担保されていること
    for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
      expect(`${doy}: ${menuOn(doy).length > 0}`).toBe(`${doy}: true`);
    }
  });

  it("夏のほうが冬より品書きが長い", () => {
    // 向きの検査。旬に連動していなければ、この差は出ない
    const summer = menuOn(dayOfYearOf(8, 1)).length;
    const winter = menuOn(dayOfYearOf(1, 15)).length;
    expect(summer).toBeGreaterThan(winter);
  });
});

describe("T-34 決定論", () => {
  it("同じ日で常に同じ棚と品書きになる", () => {
    for (const doy of [1, 100, 200, 300, 366]) {
      expect(JSON.stringify(shelfOn(doy))).toBe(JSON.stringify(shelfOn(doy)));
      expect(JSON.stringify(menuOn(doy))).toBe(JSON.stringify(menuOn(doy)));
    }
  });

  it("範囲外の日は例外にする", () => {
    expect(() => shelfOn(0)).toThrow();
    expect(() => shelfOn(367)).toThrow();
    expect(() => menuOn(0)).toThrow();
  });
});

describe("T-35 ゲートが落ちることの実証", () => {
  it("素材が揃わない品を組むと、その日には出てこない", () => {
    // 品書きが本当に棚を見ていることを、真冬で確かめる。
    // 冬に高原野菜を使う品が出てきたら、品書きが棚を見ていない
    const winter = dayOfYearOf(1, 15);
    const seasonalIds = new Set(SEASONAL_ITEMS.map((i) => i.id));
    const winterMenu = menuOn(winter);
    expect(winterMenu.length).toBeGreaterThan(0);
    for (const item of winterMenu) {
      expect(`${item.id}: ${item.ingredientIds.some((i) => seasonalIds.has(i))}`).toBe(
        `${item.id}: false`,
      );
    }
    // 逆に、野菜を使う品は夏には出る
    const summerIds = menuOn(dayOfYearOf(8, 1)).map((m) => m.id);
    expect(summerIds).toContain("salad-heading-ham");
  });
});
