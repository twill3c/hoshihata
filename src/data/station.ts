// 施設設定の唯一の情報源(SPEC §2 / F-01)。
//
// ページ側はここから引く。数値を複写しない。数字を動かすときは SPEC §2 を先に直す。
//
// この施設は**架空**である。実在誤認を避けるため、番地・電話番号・地図のピン・
// 道の駅の登録番号を持たない(F-03)。持たせようとすると tests/guard.test.ts が落ちる。

import { NORMALS_STATION } from "@/data/normals.generated";

export const STATION = {
  /** 施設名 */
  name: "道の駅 星畑",
  reading: "みちのえき ほしはた",
  /** 所在。番地は持たない */
  locality: "長野県南佐久郡南牧村 野辺山",
  /** 標高(m)。気象の基準点である気象庁アメダス野辺山観測所に合わせる */
  elevationM: NORMALS_STATION.elevationM,

  /** 架空である旨の明示。フッタ / access / rv / JSON-LD の 4 箇所で使う(F-03) */
  fictionNotice:
    "この道の駅は実在しません。Web サイト制作のポートフォリオとして制作した架空の施設です。",

  /** 気象の基準点 */
  weatherBasis: {
    stationName: NORMALS_STATION.name,
    precNo: NORMALS_STATION.precNo,
    blockNo: NORMALS_STATION.blockNo,
    normalsPeriod: NORMALS_STATION.period,
    note: "気象庁「過去の気象データ検索」の日別平年値。実行時に外部 API を呼ばない(N-04)",
  },

  /** 施設。キャンプ場は隣接施設として案内するだけで、本サイトの設備ではない(SPEC §7) */
  facilities: [
    { id: "shop", name: "直売所", summary: "高原野菜・乳製品・ハム・ソーセージ・手作りパン・山道具" },
    { id: "restaurant", name: "食堂", summary: "その日の野菜とハム、チーズのサラダ" },
    { id: "deck", name: "ウッドデッキ", summary: "八ヶ岳へ開いた屋外席" },
    { id: "rv", name: "RV パーク", summary: "車中泊のための区画。当日先着" },
    { id: "info", name: "情報コーナー", summary: "道路・気象・小海線の案内" },
  ],
} as const;

export type Facility = (typeof STATION.facilities)[number];
