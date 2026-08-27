// OG 画像に出す文字の**唯一の情報源**。
//
// フォントは部分集合を vendor しているので、ここに無い字は豆腐になる。
// 「文言を変えた瞬間に豆腐になる」のを防ぐため、
//   - 文言はここだけが持つ
//   - フォントの部分集合はここから機械的に作る(scripts/gen-og-font.mjs)
//   - 使う字がすべて部分集合に入っていることをテストで縛る(T-50)
// の三点で塞ぐ。

import { NEWS } from "./news.ts";
import { STATION } from "./station.ts";

export type OgText = {
  /** 経路。opengraph-image.tsx の置き場所と対応する */
  route: string;
  title: string;
  subtitle: string;
};

export const OG_TEXTS: readonly OgText[] = [
  { route: "/", title: "八ヶ岳を見渡す棚", subtitle: "野辺山高原 標高 1,350 m" },
  { route: "/shop/", title: "直売所", subtitle: "高原野菜が並ぶ日は気象平年値から" },
  { route: "/restaurant/", title: "食堂", subtitle: "その日の野菜とハム、チーズ" },
  { route: "/panorama/", title: "稜線", subtitle: "見える峰と、隠れて見えない峰" },
  { route: "/rv/", title: "RV パーク", subtitle: "当日先着 12 区画 電源は 15 A まで" },
  { route: "/access/", title: "道のり", subtitle: "方位と距離、そして冬の道" },
  { route: "/news/", title: "お知らせ", subtitle: "棚と食堂と RV パークから" },
];

/**
 * OG 画像に現れうる文字をすべて集める。
 * 施設名とお知らせの題も入る（記事ページの OG に使う）。
 */
export function allOgCharacters(): string {
  const parts = [
    STATION.name,
    "架空の道の駅です",
    ...OG_TEXTS.flatMap((t) => [t.title, t.subtitle]),
    ...NEWS.map((n) => n.title),
    ...NEWS.map((n) => n.date),
  ];
  return [...new Set(parts.join(""))].sort().join("");
}

export function ogTextFor(route: string): OgText {
  const found = OG_TEXTS.find((t) => t.route === route);
  if (!found) throw new Error(`OG の文言が無い: ${route}`);
  return found;
}
