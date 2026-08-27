// RV パーク(F-07)。車中泊のための区画。
//
// **予約は扱わない。当日先着である**(SPEC §9)。区画予約は姉妹作 senoto-mori の領分で、
// そちらは八ヶ岳南麓の架空キャンプ場。ここに持つと劣化コピーになる。
//
// 区画の座標は場内図(SVG)と共有する。図とデータを別に持たない —
// 別に持てば必ずどちらかが古くなる(二重定義の照合・T-40)。

export type RvSite = {
  id: string;
  /** 場内図の中での位置(m)。原点は情報コーナーの角 */
  x: number;
  y: number;
  /** 区画の大きさ(m)。大型車が入れるかどうかを分ける */
  widthM: number;
  lengthM: number;
  /** 電源の有無。付いている区画は 15 A まで */
  power: boolean;
  /** ウッドデッキ側(八ヶ岳が見える向き)か */
  deckSide: boolean;
};

/** 電源付き区画の上限。日本の一般的な屋外コンセントに合わせる */
export const POWER_LIMIT_A = 15;
export const POWER_VOLTAGE_V = 100;
export const POWER_LIMIT_W = POWER_LIMIT_A * POWER_VOLTAGE_V;

/**
 * 区画。手で置いた座標である。
 * 「デッキ側かどうか」は**独立に**判定して照合する(循環の禁止・T-41)。
 */
export const RV_SITES: readonly RvSite[] = [
  { id: "A-1", x: 6, y: 4, widthM: 4.0, lengthM: 8.0, power: true, deckSide: true },
  { id: "A-2", x: 11, y: 4, widthM: 4.0, lengthM: 8.0, power: true, deckSide: true },
  { id: "A-3", x: 16, y: 4, widthM: 4.0, lengthM: 8.0, power: true, deckSide: true },
  { id: "A-4", x: 21, y: 4, widthM: 4.0, lengthM: 8.0, power: true, deckSide: true },
  { id: "B-1", x: 6, y: 15, widthM: 3.5, lengthM: 7.0, power: true, deckSide: false },
  { id: "B-2", x: 10.5, y: 15, widthM: 3.5, lengthM: 7.0, power: true, deckSide: false },
  { id: "B-3", x: 15, y: 15, widthM: 3.5, lengthM: 7.0, power: false, deckSide: false },
  { id: "B-4", x: 19.5, y: 15, widthM: 3.5, lengthM: 7.0, power: false, deckSide: false },
  { id: "C-1", x: 6, y: 25, widthM: 5.0, lengthM: 12.0, power: true, deckSide: false },
  { id: "C-2", x: 12, y: 25, widthM: 5.0, lengthM: 12.0, power: true, deckSide: false },
  { id: "D-1", x: 20, y: 25, widthM: 3.0, lengthM: 6.0, power: false, deckSide: false },
  { id: "D-2", x: 24, y: 25, widthM: 3.0, lengthM: 6.0, power: false, deckSide: false },
];

/**
 * ウッドデッキの位置(m)。場内図に描き、「デッキ側」の判定にも使う。
 * デッキは八ヶ岳(西)に開いているので、区画から見て北側にある。
 */
export const DECK = { x: 4, y: 0, widthM: 22, depthM: 2.5 } as const;

/** デッキ側とみなす距離(m)。この距離までなら八ヶ岳が抜けて見える、という設定 */
export const DECK_SIDE_THRESHOLD_M = 8;

export type Appliance = {
  id: string;
  name: string;
  watt: number;
  /** その日の外気温がこの値を下回るときに要るもの。通年使うものは null */
  neededBelowC: number | null;
  note: string;
};

/**
 * 車中泊で使う電気製品。消費電力は一般的な製品の定格の目安であり、
 * 特定の銘柄を指さない(F-03 — 実在の商品名を持たない)。
 */
export const APPLIANCES: readonly Appliance[] = [
  { id: "blanket", name: "電気毛布", watt: 55, neededBelowC: 5, note: "氷点下の朝はこれが要る" },
  { id: "ceramic-heater", name: "セラミックヒーター", watt: 600, neededBelowC: 0, note: "強で使うと他が使えない" },
  { id: "kettle", name: "電気ケトル", watt: 1000, neededBelowC: null, note: "沸くまでの数分だけ" },
  { id: "fridge", name: "車載冷蔵庫", watt: 45, neededBelowC: null, note: "つけっぱなしになる" },
  { id: "laptop", name: "ノート PC", watt: 65, neededBelowC: null, note: "充電しながら" },
  { id: "rice-cooker", name: "炊飯器", watt: 700, neededBelowC: null, note: "炊いているあいだ" },
  { id: "phone", name: "携帯の充電", watt: 20, neededBelowC: null, note: "気にしなくてよい" },
];
