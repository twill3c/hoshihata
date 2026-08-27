// 旬カレンダーの作型定義。
//
// 出典（いずれも 2026-08-27 取得）:
//   BSI 生物科学研究所「実用作物栽培学」レタス  data/source/bsi_lettuce.pdf
//   BSI 生物科学研究所「実用作物栽培学」キャベツ data/source/bsi_cabbage.pdf
//
// ここに置くのは**原典の本文**が述べている数値だけである。
// 検証に使う栽培暦（図）は tests 側にオラクルとして置き、こちらには持ち込まない。
// 両方をここに書くと、パラメータと検証が同じ出所になり循環する（SPEC §5.3 / N-02）。
//
// **温度の閾値は作物ごとに違う。** 原典は作物ごとに違う言い方をしていて、
// どの記述が「収穫に到達する律速」かも違う。一律の閾値を置いてはならない。

export type Crop = "lettuce" | "cabbage";

export type Cultivar = {
  id: string;
  /** 表示名 */
  name: string;
  crop: Crop;
  /** 結球するか（リーフレタスは false） */
  heading: boolean;
  /** 定植から収穫までの所要日数。原典本文の記述による */
  daysToHarvest: number;
  /** その日数の出所 */
  source: string;
  /** 定植期間の id（`PLANTING_WINDOWS` の鍵） */
  windowId: PlantingWindowId;
  /**
   * 生育可能日とみなす日平均気温の範囲（開区間）。
   * 上下ともこの値「以下」「以上」では生育可能日に数えない。
   */
  growthLowC: number;
  growthHighC: number;
  /** その閾値の出所と、なぜその記述を採ったか */
  thresholdSource: string;
  /** 枯れずに耐える下限。作期の外側を語るために持つ（積算には使わない） */
  survivalLowC: number;
};

export const CULTIVARS: readonly Cultivar[] = [
  // ------------------------------------------------------------ レタス
  //
  // 原典は温度をふたつの粒度で書く。
  //   p.1「生育温度範囲 15〜25 ℃で、10 ℃以下と 30 ℃以上では生育が阻害される」
  //   p.2「5 ℃以下の低温と 30 ℃以上の高温に於いて生育が停止する」
  // 5 ℃ は枯れずに耐える下限、10 ℃ は伸びる下限。所要日数は阻害されない条件での
  // 日数なので、積算すべきは 10 ℃ 超の日である。
  //
  // 当初 5 ℃ を採ったところリーフレタスの収穫開始が栽培暦より 16 日早くなった。
  // **結球レタスはどちらの閾値でも 1 日差で一致し、判別力が無かった**（loop_001）。
  {
    id: "heading-early",
    name: "早生の結球レタス",
    crop: "lettuce",
    heading: true,
    daysToHarvest: 40,
    source: "BSI レタス p.2「品種により定植してから早生種では 40 日…に収穫する」",
    windowId: "headingLettuceCold",
    growthLowC: 10,
    growthHighC: 30,
    thresholdSource: "BSI レタス p.1「10 ℃以下と 30 ℃以上では生育が阻害される」",
    survivalLowC: 5,
  },
  {
    id: "heading-mid",
    name: "中生の結球レタス",
    crop: "lettuce",
    heading: true,
    daysToHarvest: 50,
    source: "BSI レタス p.2「中生種では 50 日…に収穫する」",
    windowId: "headingLettuceCold",
    growthLowC: 10,
    growthHighC: 30,
    thresholdSource: "BSI レタス p.1「10 ℃以下と 30 ℃以上では生育が阻害される」",
    survivalLowC: 5,
  },
  {
    id: "heading-late",
    name: "晩生の結球レタス",
    crop: "lettuce",
    heading: true,
    daysToHarvest: 60,
    source: "BSI レタス p.2「晩生種では 60 日前後に収穫する」",
    windowId: "headingLettuceCold",
    growthLowC: 10,
    growthHighC: 30,
    thresholdSource: "BSI レタス p.1「10 ℃以下と 30 ℃以上では生育が阻害される」",
    survivalLowC: 5,
  },
  {
    id: "leaf",
    name: "リーフレタス",
    crop: "lettuce",
    heading: false,
    // 原典は 30〜40 日と幅で書く。代表値として中央の 35 日を採る。
    // 幅そのものを扱いたくなったら、まず SPEC の保証粒度を上げること（HC-016）。
    daysToHarvest: 35,
    source: "BSI レタス p.2–3「定植してから 30〜40 日後…に収穫する」の中央値",
    windowId: "leafLettuceCold",
    growthLowC: 10,
    growthHighC: 30,
    thresholdSource: "BSI レタス p.1「10 ℃以下と 30 ℃以上では生育が阻害される」",
    survivalLowC: 5,
  },

  // ------------------------------------------------------------ キャベツ
  //
  // 温度はレタスと違う。原典は
  //   p.1「生育温度範囲 5〜28 ℃、結球適温 13〜20 ℃」
  //   p.12「気温低い（8 ℃以下）と高い（28 ℃以上）環境に於いても結球しない」
  // と書く。**定植から収穫までは結球を含むので、収穫に到達する律速は 8 ℃ の方**である。
  // 5 ℃ は枯れずに耐える下限として持つ。
  //
  // 注意: この作物ではオラクル（栽培暦）の判別力が弱い。SPEC §5.6 を参照。
  {
    id: "cabbage-spring",
    name: "春まきのキャベツ",
    crop: "cabbage",
    heading: true,
    // 原典は 60〜70 日と幅で書く。代表値として中央の 65 日を採る
    daysToHarvest: 65,
    source: "BSI キャベツ p.12「春キャベツと夏秋キャベツが定植 60〜70 日後…収穫時期である」の中央値",
    windowId: "springCabbageCold",
    growthLowC: 8,
    growthHighC: 28,
    thresholdSource:
      "BSI キャベツ p.12「気温低い(8 ℃以下)と高い(28 ℃以上)環境に於いても結球しない」" +
      "（定植→収穫は結球を含むので、収穫に到達する律速はこちら）",
    survivalLowC: 5,
  },
  {
    id: "cabbage-summer",
    name: "夏まきのキャベツ",
    crop: "cabbage",
    heading: true,
    daysToHarvest: 65,
    source:
      "BSI キャベツ p.12「春キャベツと夏秋キャベツが定植 60〜70 日後…収穫時期である」の中央値",
    windowId: "summerCabbageCold",
    growthLowC: 8,
    growthHighC: 28,
    thresholdSource:
      "BSI キャベツ p.12「気温低い(8 ℃以下)と高い(28 ℃以上)環境に於いても結球しない」" +
      "（定植→収穫は結球を含むので、収穫に到達する律速はこちら）",
    survivalLowC: 5,
  },
];

/** レタスだけを取り出す。既存の呼び出し元との互換のために残してある。 */
export const LETTUCE_CULTIVARS: readonly Cultivar[] = CULTIVARS.filter(
  (c) => c.crop === "lettuce",
);

export type PlantingWindowId =
  | "headingLettuceCold"
  | "leafLettuceCold"
  | "springCabbageCold"
  | "summerCabbageCold";

export type PlantingWindow = {
  /** 定植期間の開始（通日 1-366） */
  fromDoy: number;
  /** 定植期間の終了（通日 1-366） */
  toDoy: number;
  /** この期間の出所 */
  source: string;
};

/**
 * 寒冷地・冷涼地の定植期間。
 *
 * 原典は「5 月中旬〜8 月中旬」のように旬で書く。旬を日に落とす規則は
 * 上旬 = 1–10 日 / 中旬 = 11–20 日 / 下旬 = 21–月末 とする（暦の通例）。
 * 期間の開始は旬の初日、終了は旬の末日を採る。
 */
export const PLANTING_WINDOWS = {
  /** 結球レタス: 定植 5 月中旬〜8 月中旬（図 2 寒冷地・冷涼地） */
  headingLettuceCold: {
    fromDoy: 132, // 5/11
    toDoy: 233, // 8/20
    source: "BSI レタス 図 2「各地の結球レタス栽培暦」寒冷地・冷涼地の定植",
  },
  /** リーフレタス: 定植 4 月中旬〜8 月上旬（図 3 寒冷地・冷涼地） */
  leafLettuceCold: {
    fromDoy: 102, // 4/11
    toDoy: 223, // 8/10
    source: "BSI レタス 図 3「各地のリーフレタス栽培暦」寒冷地・冷涼地の定植",
  },
  /** 春まきキャベツ: 定植 4 月下旬〜5 月下旬（図 2 寒冷地・冷涼地） */
  springCabbageCold: {
    fromDoy: 112, // 4/21
    toDoy: 152, // 5/31
    source: "BSI キャベツ 図 2「各地のキャベツ栽培暦」寒冷地・冷涼地 春キャベツの定植",
  },
  /** 夏まきキャベツ: 定植 7 月上旬〜8 月上旬（図 2 寒冷地・冷涼地） */
  summerCabbageCold: {
    fromDoy: 183, // 7/1
    toDoy: 223, // 8/10
    source: "BSI キャベツ 図 2 寒冷地・冷涼地 夏秋キャベツの定植",
  },
} as const satisfies Record<PlantingWindowId, PlantingWindow>;

/** 作型に適用する定植期間を引く。 */
export function plantingWindowFor(cultivar: Cultivar): PlantingWindow {
  return PLANTING_WINDOWS[cultivar.windowId];
}

export function cultivarById(id: string): Cultivar | undefined {
  return CULTIVARS.find((c) => c.id === id);
}

/** 後方互換の別名。 */
export type LettuceCultivar = Cultivar;
