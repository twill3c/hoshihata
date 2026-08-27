// 旬カレンダーの作型定義。
//
// 出典: BSI 生物科学研究所「実用作物栽培学」レタス(data/source/bsi_lettuce.pdf、2026-08-27 取得)
//
// ここに置くのは**原典の本文**が述べている数値だけである。
// 検証に使う栽培暦(図 2 / 図 3)は tests 側にオラクルとして置き、こちらには持ち込まない。
// 両方をここに書くと、パラメータと検証が同じ出所になり循環する(SPEC §5.3 / N-02)。

export type LettuceCultivar = {
  id: string;
  /** 表示名 */
  name: string;
  /** 結球するか(リーフレタスは false) */
  heading: boolean;
  /** 定植から収穫までの所要日数。原典本文の記述による */
  daysToHarvest: number;
  /** その日数の出所 */
  source: string;
};

export const LETTUCE_CULTIVARS: readonly LettuceCultivar[] = [
  {
    id: "heading-early",
    name: "早生の結球レタス",
    heading: true,
    daysToHarvest: 40,
    source: "BSI レタス p.2「品種により定植してから早生種では 40 日…に収穫する」",
  },
  {
    id: "heading-mid",
    name: "中生の結球レタス",
    heading: true,
    daysToHarvest: 50,
    source: "BSI レタス p.2「中生種では 50 日…に収穫する」",
  },
  {
    id: "heading-late",
    name: "晩生の結球レタス",
    heading: true,
    daysToHarvest: 60,
    source: "BSI レタス p.2「晩生種では 60 日前後に収穫する」",
  },
  {
    id: "leaf",
    name: "リーフレタス",
    heading: false,
    // 原典は 30〜40 日と幅で書く。代表値として中央の 35 日を採る。
    // 幅そのものを扱いたくなったら、まず SPEC の保証粒度を上げること(HC-016)。
    daysToHarvest: 35,
    source: "BSI レタス p.2–3「定植してから 30〜40 日後…に収穫する」の中央値",
  },
];

export type PlantingWindow = {
  /** 定植期間の開始(通日 1-366) */
  fromDoy: number;
  /** 定植期間の終了(通日 1-366) */
  toDoy: number;
  /** この期間の出所 */
  source: string;
};

/**
 * 寒冷地・冷涼地の定植期間。
 *
 * 原典は「5 月中旬〜8 月中旬」のように旬で書く。旬を日に落とす規則は
 * 上旬 = 1–10 日 / 中旬 = 11–20 日 / 下旬 = 21–月末 とする(暦の通例)。
 * 期間の開始は旬の初日、終了は旬の末日を採る。
 */
export const PLANTING_WINDOWS = {
  /** 結球レタス: 定植 5 月中旬〜8 月中旬(図 2 寒冷地・冷涼地) */
  headingLettuceCold: {
    fromDoy: 132, // 5/11
    toDoy: 233, // 8/20
    source: "BSI レタス 図 2「各地の結球レタス栽培暦」寒冷地・冷涼地の定植",
  },
  /** リーフレタス: 定植 4 月中旬〜8 月上旬(図 3 寒冷地・冷涼地) */
  leafLettuceCold: {
    fromDoy: 102, // 4/11
    toDoy: 223, // 8/10
    source: "BSI レタス 図 3「各地のリーフレタス栽培暦」寒冷地・冷涼地の定植",
  },
} as const satisfies Record<string, PlantingWindow>;

/** 作型 id から、その作型に適用する定植期間を引く。 */
export function plantingWindowFor(cultivar: LettuceCultivar): PlantingWindow {
  return cultivar.heading
    ? PLANTING_WINDOWS.headingLettuceCold
    : PLANTING_WINDOWS.leafLettuceCold;
}
