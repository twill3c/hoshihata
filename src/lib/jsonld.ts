// JSON-LD(F-11)。
//
// **架空の施設に事業所の構造化データを出さない。**
//
// `LocalBusiness` や `Place` を出すと、検索エンジンにとっては実在の事業所の申告になる。
// 番地や電話番号を書かなくても、型そのものが「ここに店がある」と主張してしまう。
// 架空の施設でそれをやるのは、捏造した事業所情報を配ることに等しい。
//
// 出すのは **`WebSite`（実在するのはこのサイトである）** と、経路の `BreadcrumbList` だけ。
// 説明文には架空である旨を入れる（F-03 の明示 4 箇所のひとつ）。
//
// 禁じたものが本当に出ていないことは T-51 が縛る。

import { SITE } from "../data/site.ts";
import { STATION } from "../data/station.ts";

/** 出してはならない @type。事業所・場所・宿泊・飲食を主張する型 */
export const FORBIDDEN_TYPES: readonly string[] = [
  "LocalBusiness",
  "Place",
  "Restaurant",
  "FoodEstablishment",
  "TouristAttraction",
  "Campground",
  "LodgingBusiness",
  "Store",
  "GroceryStore",
  "Organization",
  "PostalAddress",
  "GeoCoordinates",
];

/** 出してはならない項目。座標・住所・電話・営業時間 */
export const FORBIDDEN_KEYS: readonly string[] = [
  "address",
  "streetAddress",
  "postalCode",
  "telephone",
  "geo",
  "latitude",
  "longitude",
  "openingHours",
  "openingHoursSpecification",
  "priceRange",
  "aggregateRating",
];

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: `${STATION.name} — 八ヶ岳 野辺山高原`,
    url: SITE.origin,
    inLanguage: "ja",
    description:
      `${STATION.fictionNotice}` +
      "野辺山の気象平年値から旬カレンダーを、国土地理院の標高データから八ヶ岳の稜線を計算して描いています。",
    // 実在するのはこのサイトと、その作者だけ
    creator: { "@type": "Person", name: "坂田哲朗" },
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
  };
}

export function breadcrumbJsonLd(
  trail: readonly { name: string; path: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE.origin}${item.path}`,
    })),
  };
}
