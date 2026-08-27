// 棚と品書き(SPEC F-04 / F-05)。
//
// **品書きは旬カレンダーの出力から組み立てる。** 決め打ちの品書きを別に持たない。
// 持てば必ず旬の話と食い違う(sugi-nami の「粉と菓子」と同じ構造)。
//
// 実時刻に依らない純関数として置く。「今日」を決めるのはページ側の仕事で、
// ここは通日を受け取るだけ(決定論・T-34)。

import { MENU_ITEMS, type MenuItem } from "../data/menu.ts";
import { SEASONAL_ITEMS, SHOP_ITEMS, YEAR_ROUND_ITEMS, type ShopItem } from "../data/shop.ts";
import { DAYS_IN_YEAR, produceOn } from "./harvest.ts";

function assertDoy(doy: number): void {
  if (!Number.isInteger(doy) || doy < 1 || doy > DAYS_IN_YEAR) {
    throw new RangeError(`通日が範囲外: ${doy}`);
  }
}

export type Shelf = {
  /** その日に穫れて棚に出る高原野菜 */
  seasonal: ShopItem[];
  /** 通年の品 */
  yearRound: readonly ShopItem[];
};

/** その日の棚。 */
export function shelfOn(doy: number): Shelf {
  assertDoy(doy);
  const harvested = new Set(produceOn(doy).map((p) => p.cultivarId));
  return {
    seasonal: SEASONAL_ITEMS.filter((item) => harvested.has(item.cultivarId!)),
    yearRound: YEAR_ROUND_ITEMS,
  };
}

/** その日に棚にあるものすべて(季節の品 + 通年の品)。 */
export function shopItemsOnShelf(doy: number): ShopItem[] {
  const shelf = shelfOn(doy);
  return [...shelf.seasonal, ...shelf.yearRound];
}

/**
 * その日に出せる品書き。素材がすべて棚にあるものだけを返す。
 *
 * 「揃っていないものを出さない」だけでなく「揃っているものは必ず出す」ことが要る。
 * 前者だけなら常に空を返す実装が通ってしまう(T-33 の二方向の検査)。
 */
export function menuOn(doy: number): MenuItem[] {
  assertDoy(doy);
  const available = new Set(shopItemsOnShelf(doy).map((item) => item.id));
  return MENU_ITEMS.filter((item) => item.ingredientIds.every((id) => available.has(id)));
}

/** その品が棚に並ぶ日(通日)をすべて返す。通年の品は 366 日すべて。 */
export function seasonalDaysOf(shopItemId: string): number[] {
  const item = SHOP_ITEMS.find((i) => i.id === shopItemId);
  if (!item) throw new Error(`品が無い: ${shopItemId}`);

  const days: number[] = [];
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    if (item.cultivarId === null) {
      days.push(doy);
    } else if (produceOn(doy).some((p) => p.cultivarId === item.cultivarId)) {
      days.push(doy);
    }
  }
  return days;
}

export type SeasonSpan = { fromDoy: number; toDoy: number };

/**
 * その品が棚に並ぶ日を、続いている区間にまとめる。旬の帯を描くために使う。
 *
 * 区間に割るのは図の都合ではなく事実の都合である。作型によっては
 * 途中で途切れうるので、ひとつの帯に潰さない。
 */
export function seasonSpansOf(shopItemId: string): SeasonSpan[] {
  const days = seasonalDaysOf(shopItemId);
  const spans: SeasonSpan[] = [];
  for (const doy of days) {
    const last = spans[spans.length - 1];
    if (last !== undefined && doy === last.toDoy + 1) {
      last.toDoy = doy;
    } else {
      spans.push({ fromDoy: doy, toDoy: doy });
    }
  }
  return spans;
}

/** 棚に高原野菜が並ぶ日の帯(通日の範囲)。ページの見出しに使う。 */
export function vegetableSeason(): { fromDoy: number; toDoy: number; dayCount: number } | null {
  const days: number[] = [];
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    if (shelfOn(doy).seasonal.length > 0) days.push(doy);
  }
  if (days.length === 0) return null;
  return { fromDoy: days[0]!, toDoy: days[days.length - 1]!, dayCount: days.length };
}
