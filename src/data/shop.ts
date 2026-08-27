// 直売所に並ぶもの(F-04)。
//
// **この施設は架空である。** 実在の生産者・銘柄・企業名を一切持たない(F-03)。
// 品名は一般名詞にとどめ、固有名詞を作らない — 作れば実在の商品と紛れる。
//
// 高原野菜だけは「並ぶ日」が旬カレンダー(src/lib/harvest.ts)から決まる。
// それ以外は通年の品として持つ。両者を混ぜないのは、
// 計算で決まるものと決め打ちのものを取り違えないためである。

export type ShopCategory = "vegetable" | "dairy" | "meat" | "bakery" | "gear";

export const SHOP_CATEGORIES: readonly { id: ShopCategory; name: string; summary: string }[] = [
  { id: "vegetable", name: "高原野菜", summary: "並ぶ日が気象平年値から決まる。冬は棚が空く" },
  { id: "dairy", name: "乳製品", summary: "牛乳・ヨーグルト・チーズ" },
  { id: "meat", name: "ハム・ソーセージ", summary: "自家製の加工品" },
  { id: "bakery", name: "手作りパン", summary: "その日に焼く" },
  { id: "gear", name: "山道具", summary: "八ヶ岳に登る人・車中泊の人向け" },
];

export type ShopItem = {
  id: string;
  name: string;
  category: ShopCategory;
  summary: string;
  /**
   * 高原野菜のうち、並ぶ日が旬カレンダーで決まるもの。
   * `src/data/crops.ts` の作型 id を指す。通年の品は null。
   */
  cultivarId: string | null;
};

export const SHOP_ITEMS: readonly ShopItem[] = [
  // 高原野菜 — 並ぶ日は計算で決まる(F-02)
  {
    id: "lettuce-heading-early",
    name: "早生の結球レタス",
    category: "vegetable",
    summary: "作期のいちばん早い玉。六月の下旬から",
    cultivarId: "heading-early",
  },
  {
    id: "lettuce-heading-mid",
    name: "中生の結球レタス",
    category: "vegetable",
    summary: "夏のあいだ最も長く棚にある",
    cultivarId: "heading-mid",
  },
  {
    id: "lettuce-heading-late",
    name: "晩生の結球レタス",
    category: "vegetable",
    summary: "作期の終わりを受け持つ。十月まで",
    cultivarId: "heading-late",
  },
  {
    id: "lettuce-leaf",
    name: "リーフレタス",
    category: "vegetable",
    summary: "結球しないぶん早く穫れる。六月の中旬から",
    cultivarId: "leaf",
  },

  // 通年の品
  {
    id: "milk",
    name: "牛乳",
    category: "dairy",
    summary: "冷たいまま瓶で",
    cultivarId: null,
  },
  {
    id: "yogurt",
    name: "ヨーグルト",
    category: "dairy",
    summary: "加糖と無糖の二種",
    cultivarId: null,
  },
  {
    id: "fresh-cheese",
    name: "フレッシュチーズ",
    category: "dairy",
    summary: "熟成させない。サラダに合わせる",
    cultivarId: null,
  },
  {
    id: "aged-cheese",
    name: "熟成チーズ",
    category: "dairy",
    summary: "半年おいたもの。薄く削って使う",
    cultivarId: null,
  },
  {
    id: "roast-ham",
    name: "ロースハム",
    category: "meat",
    summary: "塩漬けにして低い温度で燻す",
    cultivarId: null,
  },
  {
    id: "raw-ham",
    name: "生ハム",
    category: "meat",
    summary: "冬の乾いた空気で乾かす",
    cultivarId: null,
  },
  {
    id: "sausage",
    name: "ソーセージ",
    category: "meat",
    summary: "粗挽き。焼いて食べる",
    cultivarId: null,
  },
  {
    id: "pain-de-campagne",
    name: "田舎パン",
    category: "bakery",
    summary: "大きく焼いて量り売り",
    cultivarId: null,
  },
  {
    id: "rye-bread",
    name: "ライ麦のパン",
    category: "bakery",
    summary: "生ハムと合わせる",
    cultivarId: null,
  },
  {
    id: "milk-roll",
    name: "牛乳のロールパン",
    category: "bakery",
    summary: "朝のうちに売り切れる",
    cultivarId: null,
  },
  {
    id: "gas-canister",
    name: "ガスカートリッジ",
    category: "gear",
    summary: "寒い時期用の混合ガスも置く",
    cultivarId: null,
  },
  {
    id: "map-yatsugatake",
    name: "八ヶ岳の地形図",
    category: "gear",
    summary: "登山口までの道も入っている",
    cultivarId: null,
  },
  {
    id: "thermal-blanket",
    name: "保温シート",
    category: "gear",
    summary: "車中泊の窓に貼る。冬の朝は氷点下十度を下回る",
    cultivarId: null,
  },
  {
    id: "insulated-bottle",
    name: "保温ボトル",
    category: "gear",
    summary: "デッキで飲むために",
    cultivarId: null,
  },
];

/** 通年で並ぶ品(旬カレンダーに依らないもの)。 */
export const YEAR_ROUND_ITEMS: readonly ShopItem[] = SHOP_ITEMS.filter(
  (item) => item.cultivarId === null,
);

/** 並ぶ日が旬カレンダーで決まる品。 */
export const SEASONAL_ITEMS: readonly ShopItem[] = SHOP_ITEMS.filter(
  (item) => item.cultivarId !== null,
);

export function shopItemById(id: string): ShopItem | undefined {
  return SHOP_ITEMS.find((item) => item.id === id);
}

export function categoryName(id: ShopCategory): string {
  const found = SHOP_CATEGORIES.find((c) => c.id === id);
  if (!found) throw new Error(`分類が無い: ${id}`);
  return found.name;
}
