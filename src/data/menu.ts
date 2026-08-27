// 食堂の品書き(F-05)。
//
// サラダは「その日に穫れた野菜 + ハム + チーズ」で組む。
// 野菜が旬カレンダーで決まるので、**品書きは日によって変わる**。
// 決め打ちの品書きを別に持たない — 持てば必ず旬の話と食い違う。
//
// 素材は `src/data/shop.ts` の id で指す。文字列で書き写さない。
// 書き写すと、直売所の品を直したのに品書きが古いまま、が起きる
// (sugi-nami の soba.test.ts と同じ考え)。

export type MenuItem = {
  id: string;
  name: string;
  summary: string;
  /**
   * この品に要る素材。`SHOP_ITEMS` の id。
   * 高原野菜の id が入っていれば、その野菜が並ぶ日にしか出せない。
   */
  ingredientIds: readonly string[];
};

export const MENU_ITEMS: readonly MenuItem[] = [
  {
    id: "salad-heading-ham",
    name: "結球レタスとロースハムのサラダ",
    summary: "玉を大きく割って、ハムを挟むだけ。いちばん出る",
    ingredientIds: ["lettuce-heading-mid", "roast-ham", "fresh-cheese"],
  },
  {
    id: "salad-leaf-raw-ham",
    name: "リーフレタスと生ハムのサラダ",
    summary: "葉の薄いほうに、塩気の強いほうを合わせる",
    ingredientIds: ["lettuce-leaf", "raw-ham", "aged-cheese"],
  },
  {
    id: "salad-early-cheese",
    name: "早生レタスとフレッシュチーズ",
    summary: "作期の頭だけ。葉がやわらかいうちに",
    ingredientIds: ["lettuce-heading-early", "fresh-cheese"],
  },
  {
    id: "salad-late-aged",
    name: "晩生レタスと熟成チーズ",
    summary: "秋の玉は締まっている。削ったチーズを多めに",
    ingredientIds: ["lettuce-heading-late", "aged-cheese"],
  },
  {
    id: "plate-ham-bread",
    name: "ハムとパンの皿",
    summary: "野菜の無い季節はこれになる",
    ingredientIds: ["roast-ham", "sausage", "pain-de-campagne"],
  },
  {
    id: "plate-cheese-rye",
    name: "チーズとライ麦パンの皿",
    summary: "通年。冬のデッキは寒いので中の席で",
    ingredientIds: ["aged-cheese", "rye-bread"],
  },
  {
    id: "yogurt-bowl",
    name: "ヨーグルト",
    summary: "通年。器で出す",
    ingredientIds: ["yogurt"],
  },
];
