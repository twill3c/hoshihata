// ウッドデッキから見える八ヶ岳の稜線を、国土地理院の標高タイルから計算して
// src/data/terrain.generated.ts を書き出す(F-06)。
//
// 原本:
//   data/gsi/dem_z12_{x}_{y}.txt   標高タイル DEM10B(z=12・標本間隔 30.9 m)
//     https://cyberjapandata.gsi.go.jp/xyz/dem/12/{x}/{y}.txt
//   data/gsi/1003zan20260331.zip   日本の主な山岳標高一覧(1003 山)GeoJSON
//     https://www.gsi.go.jp/KOKUJYOHO/MOUNTAIN/1003zan20260331.zip
//   いずれも 2026-08-27 取得
//
// 循環の禁止(SPEC N-02): 稜線は DEM だけから計算し、峰の名前・座標・標高は
// 山岳標高一覧だけから採る。両者は同じ発行者だが別の測量 product である
// (DEM10B は等高線由来、山岳標高は三角点・標高点の測量成果)。互いから生成しない。

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GSI = join(ROOT, "data", "gsi");

const ZOOM = 12;
const TILE_PX = 256;
const TILES_N = 2 ** ZOOM;

/**
 * 視点。架空の施設に座標は無いので(F-03)、気象の基準点として SPEC が既に採っている
 * 気象庁アメダス野辺山観測所の地点を使う。実在の公的な基準点であって施設の所在ではない。
 */
const VIEWPOINT = { latitudeDeg: 35 + 56.9 / 60, longitudeDeg: 138 + 28.3 / 60 };
/** 立って見る目の高さ(m)。地表からの相対値 */
const EYE_HEIGHT_M = 1.5;

/** 見渡す方位の範囲(真北から時計回りの度)。八ヶ岳は 266°〜318° に並ぶ */
const AZIMUTH_FROM_DEG = 255;
const AZIMUTH_TO_DEG = 325;
/** 稜線を刻む細かさ。DEM の標本間隔 30.9 m は 10 km 先で 0.18° なので、それより細かくしても情報は増えない */
const AZIMUTH_STEP_DEG = 0.05;

/** 射線を進める刻み(m)と最大距離(m)。刻みは DEM の標本間隔より細かく採る */
const RAY_STEP_M = 15;
const RAY_MAX_M = 26000;

const EARTH_RADIUS_M = 6371008.8;
/**
 * 大気差の係数。標準的な k = 0.13 を採る。
 * 見かけの下がりは (1-k)·d²/(2R) で、10 km 先では 6.8 m(= 0.039°)。
 * 小さいが、稜線の重なりを判定する場面では効く。
 */
const REFRACTION_K = 0.13;

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

// ---------------------------------------------------------------- 標高タイル

const tileCache = new Map();

/** 緯度経度 → タイル座標(小数)。Web メルカトル。 */
function tileXY(latitudeDeg, longitudeDeg) {
  const lat = toRad(latitudeDeg);
  return {
    x: ((longitudeDeg + 180) / 360) * TILES_N,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * TILES_N,
  };
}

function loadTile(tx, ty) {
  const key = `${tx}/${ty}`;
  if (tileCache.has(key)) return tileCache.get(key);
  const path = join(GSI, `dem_z12_${tx}_${ty}.txt`);
  if (!existsSync(path)) {
    tileCache.set(key, null);
    return null;
  }
  const grid = readFileSync(path, "utf-8")
    .split("\n")
    .filter((line) => line.trim() !== "")
    // 欠測は "e" で入る。数値でないものは穴として持つ
    .map((line) => line.split(",").map((v) => (v === "e" ? null : Number(v))));
  if (grid.length !== TILE_PX) throw new Error(`${path}: 行数が ${grid.length}(期待 ${TILE_PX})`);
  for (const row of grid) {
    if (row.length !== TILE_PX) throw new Error(`${path}: 列数が ${row.length}(期待 ${TILE_PX})`);
  }
  tileCache.set(key, grid);
  return grid;
}

/** 格子点の標高。被覆外・欠測は null。 */
function sampleAt(px, py) {
  const tx = Math.floor(px / TILE_PX);
  const ty = Math.floor(py / TILE_PX);
  const grid = loadTile(tx, ty);
  if (grid === null) return null;
  const ix = px - tx * TILE_PX;
  const iy = py - ty * TILE_PX;
  return grid[iy]?.[ix] ?? null;
}

/**
 * 緯度経度の標高(双一次補間)。
 * 4 隅のどれかが欠測・被覆外なら null を返す — 埋めない。
 */
export function elevationAt(latitudeDeg, longitudeDeg) {
  const { x, y } = tileXY(latitudeDeg, longitudeDeg);
  const fx = x * TILE_PX;
  const fy = y * TILE_PX;
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const dx = fx - x0;
  const dy = fy - y0;

  const q00 = sampleAt(x0, y0);
  const q10 = sampleAt(x0 + 1, y0);
  const q01 = sampleAt(x0, y0 + 1);
  const q11 = sampleAt(x0 + 1, y0 + 1);
  if (q00 === null || q10 === null || q01 === null || q11 === null) return null;

  return (
    q00 * (1 - dx) * (1 - dy) + q10 * dx * (1 - dy) + q01 * (1 - dx) * dy + q11 * dx * dy
  );
}

// ---------------------------------------------------------------- 球面の幾何

/** 視点から方位 azimuth(度)・距離 d(m) だけ進んだ地点の緯度経度。 */
function destination(latitudeDeg, longitudeDeg, azimuthDeg, distanceM) {
  const δ = distanceM / EARTH_RADIUS_M;
  const θ = toRad(azimuthDeg);
  const φ1 = toRad(latitudeDeg);
  const λ1 = toRad(longitudeDeg);
  const φ2 = Math.asin(Math.sin(φ1) * Math.cos(δ) + Math.cos(φ1) * Math.sin(δ) * Math.cos(θ));
  const λ2 =
    λ1 +
    Math.atan2(
      Math.sin(θ) * Math.sin(δ) * Math.cos(φ1),
      Math.cos(δ) - Math.sin(φ1) * Math.sin(φ2),
    );
  return { latitudeDeg: toDeg(φ2), longitudeDeg: ((toDeg(λ2) + 540) % 360) - 180 };
}

function distanceM(a, b) {
  const φ1 = toRad(a.latitudeDeg);
  const φ2 = toRad(b.latitudeDeg);
  const dφ = φ2 - φ1;
  const dλ = toRad(b.longitudeDeg - a.longitudeDeg);
  const h =
    Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

function azimuthDeg(a, b) {
  const φ1 = toRad(a.latitudeDeg);
  const φ2 = toRad(b.latitudeDeg);
  const dλ = toRad(b.longitudeDeg - a.longitudeDeg);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * 見かけの仰角(度)。地球の丸みで沈む分と大気差で持ち上がる分を入れる。
 * 入れないと 10 km 先で 0.04°、20 km 先で 0.08° ぶん高く見積もる。
 */
function apparentElevationDeg(eyeElevationM, targetElevationM, horizontalM) {
  if (horizontalM <= 0) return 0;
  const drop = ((1 - REFRACTION_K) * horizontalM * horizontalM) / (2 * EARTH_RADIUS_M);
  return toDeg(Math.atan2(targetElevationM - eyeElevationM - drop, horizontalM));
}

// ---------------------------------------------------------------- 稜線の計算

const groundElevationM = elevationAt(VIEWPOINT.latitudeDeg, VIEWPOINT.longitudeDeg);
if (groundElevationM === null) throw new Error("視点が DEM の被覆外にある");
const eyeElevationM = groundElevationM + EYE_HEIGHT_M;

/**
 * ひとつの方位について射線を進め、見かけの仰角が最大になる点を返す。
 * DEM の被覆外に出たらそこで打ち切り、どこまで見られたかを coveredM に残す。
 */
function castRay(azimuth) {
  let bestAngle = -90;
  let bestDistanceM = 0;
  let bestElevationM = eyeElevationM;
  let coveredM = 0;

  for (let d = RAY_STEP_M; d <= RAY_MAX_M; d += RAY_STEP_M) {
    const p = destination(VIEWPOINT.latitudeDeg, VIEWPOINT.longitudeDeg, azimuth, d);
    const h = elevationAt(p.latitudeDeg, p.longitudeDeg);
    if (h === null) break; // 被覆外。ここから先は何も言わない
    coveredM = d;
    const angle = apparentElevationDeg(eyeElevationM, h, d);
    if (angle > bestAngle) {
      bestAngle = angle;
      bestDistanceM = d;
      bestElevationM = h;
    }
  }
  return { azimuth, angle: bestAngle, distanceM: bestDistanceM, elevationM: bestElevationM, coveredM };
}

const skyline = [];
for (
  let az = AZIMUTH_FROM_DEG;
  az <= AZIMUTH_TO_DEG + 1e-9;
  az += AZIMUTH_STEP_DEG
) {
  skyline.push(castRay(Number(az.toFixed(4))));
}

// ---------------------------------------------------------------- 峰の同定

function readPeaks() {
  const zip = readFileSync(join(GSI, "1003zan20260331.zip"));
  // ZIP の中身は 1 ファイル。ローカルヘッダを読んで deflate 部を取り出す
  if (zip.readUInt32LE(0) !== 0x04034b50) throw new Error("ZIP のローカルヘッダが読めない");
  const method = zip.readUInt16LE(8);
  const nameLen = zip.readUInt16LE(26);
  const extraLen = zip.readUInt16LE(28);
  const start = 30 + nameLen + extraLen;
  const body = zip.subarray(start);
  // ZIP に収まっているのは生の deflate(zlib/gzip のヘッダを持たない)。
  // unzipSync はヘッダを期待するので Z_DATA_ERROR になる。inflateRawSync が正しい
  const json = method === 0 ? body : inflateRawSync(body);
  return JSON.parse(json.toString("utf-8"));
}

const geo = readPeaks();
if (!Array.isArray(geo.features) || geo.features.length === 0) {
  throw new Error("山岳標高一覧が空 — 走査対象 0 件で素通りさせない");
}

/** 稜線の中で、その方位に最も近い射線。 */
function skylineAt(azimuth) {
  let best = skyline[0];
  for (const s of skyline) {
    if (Math.abs(s.azimuth - azimuth) < Math.abs(best.azimuth - azimuth)) best = s;
  }
  return best;
}

/**
 * 山頂の手前どれだけを遮蔽の走査から除くか(m)。
 *
 * DEM の標本間隔は 30.9 m なので、それより細かい起伏は表現されていない。
 * 山頂のすぐ手前の格子は「山頂そのもの」であって、遮るものではない。
 * 除かないと峰は自分の山頂に隠され、赤岳は 0.09° 差で辛うじて残るだけになる。
 */
const SUMMIT_BUFFER_M = 150;

/**
 * その峰より手前の地形が、峰の見かけの仰角を超えて立ち上がっているか。
 * 超えていれば隠れている。射線が峰に届く前に被覆外へ出たら判定しない。
 *
 * **判定は DEM だけで自己完結させる。** 峰の仰角も DEM 標高から計算する。
 * 遮蔽側を DEM、峰側を測量成果から取ると、両 product の系統差
 * (DEM は山頂で 1〜40 m 低く出る)がそのまま判定の余裕に化けてしまう。
 * 測量成果は同定と標高照合にだけ使う(SPEC N-02)。
 */
function occlusionOf(peak) {
  if (peak.demElevationM === null) return { status: "unknown", maxAngleInFront: null, demAngleDeg: null };
  const demAngleDeg = apparentElevationDeg(eyeElevationM, peak.demElevationM, peak.distanceM);

  const limit = peak.distanceM - SUMMIT_BUFFER_M;
  if (limit <= RAY_STEP_M) return { status: "unknown", maxAngleInFront: null, demAngleDeg };

  let maxAngleInFront = -90;
  for (let d = RAY_STEP_M; d < limit; d += RAY_STEP_M) {
    const p = destination(VIEWPOINT.latitudeDeg, VIEWPOINT.longitudeDeg, peak.azimuthDeg, d);
    const h = elevationAt(p.latitudeDeg, p.longitudeDeg);
    if (h === null) return { status: "unknown", maxAngleInFront: null, demAngleDeg };
    maxAngleInFront = Math.max(maxAngleInFront, apparentElevationDeg(eyeElevationM, h, d));
  }
  return {
    status: maxAngleInFront > demAngleDeg ? "hidden" : "visible",
    maxAngleInFront,
    demAngleDeg,
  };
}

const peaks = [];
for (const f of geo.features) {
  const p = f.properties;
  const point = { latitudeDeg: p["緯度"], longitudeDeg: p["経度"] };
  const d = distanceM(VIEWPOINT, point);
  if (d > RAY_MAX_M) continue;
  const az = azimuthDeg(VIEWPOINT, point);
  if (az < AZIMUTH_FROM_DEG || az > AZIMUTH_TO_DEG) continue;

  const surveyElevationM = p["標高値(m)"];
  const entry = {
    name: p["山名＜山頂名＞"],
    reading: p["山名よみ＜山頂名よみ＞"],
    surveyElevationM,
    surveyKind: p["種別"],
    latitudeDeg: point.latitudeDeg,
    longitudeDeg: point.longitudeDeg,
    distanceM: d,
    azimuthDeg: az,
    apparentAngleDeg: apparentElevationDeg(eyeElevationM, surveyElevationM, d),
    // DEM 側の独立な読み。照合に使うのでここでは上書きしない
    demElevationM: elevationAt(point.latitudeDeg, point.longitudeDeg),
  };
  const occ = occlusionOf(entry);
  entry.visibility = occ.status;
  entry.maxAngleInFrontDeg = occ.maxAngleInFront;
  entry.demAngleDeg = occ.demAngleDeg;
  peaks.push(entry);
}
peaks.sort((a, b) => a.azimuthDeg - b.azimuthDeg);

if (peaks.length === 0) throw new Error("方位の窓に峰が 1 座も入らない — 窓の指定を疑う");

// ---------------------------------------------------------------- 書き出し

const num = (v, digits) => (v === null ? "null" : Number(v.toFixed(digits)));

const skylineLines = skyline
  .map(
    (s) =>
      `  { azimuthDeg: ${num(s.azimuth, 2)}, angleDeg: ${num(s.angle, 4)}, ` +
      `distanceM: ${num(s.distanceM, 0)}, elevationM: ${num(s.elevationM, 1)}, coveredM: ${num(s.coveredM, 0)} },`,
  )
  .join("\n");

const peakLines = peaks
  .map(
    (p) =>
      `  { name: ${JSON.stringify(p.name)}, reading: ${JSON.stringify(p.reading)}, ` +
      `surveyElevationM: ${p.surveyElevationM}, surveyKind: ${JSON.stringify(p.surveyKind)}, ` +
      `latitudeDeg: ${num(p.latitudeDeg, 6)}, longitudeDeg: ${num(p.longitudeDeg, 6)}, ` +
      `distanceM: ${num(p.distanceM, 0)}, azimuthDeg: ${num(p.azimuthDeg, 3)}, ` +
      `apparentAngleDeg: ${num(p.apparentAngleDeg, 4)}, demElevationM: ${num(p.demElevationM, 1)}, ` +
      `demAngleDeg: ${num(p.demAngleDeg, 4)}, ` +
      `maxAngleInFrontDeg: ${num(p.maxAngleInFrontDeg, 4)}, visibility: ${JSON.stringify(p.visibility)} },`,
  )
  .join("\n");

const out = `// 自動生成 — 手で編集しない。\`npm run gen:terrain\` で作り直す(scripts/gen-terrain.mjs)。
//
// 出典(いずれも 2026-08-27 取得):
//   稜線 — 国土地理院 標高タイル DEM10B(z=12・標本間隔 30.9 m)
//     https://cyberjapandata.gsi.go.jp/xyz/dem/12/{x}/{y}.txt
//   峰   — 国土地理院「日本の主な山岳標高一覧(1003 山)」GeoJSON
//     https://www.gsi.go.jp/KOKUJYOHO/MOUNTAIN/1003zan20260331.zip
//
// 稜線は DEM だけから、峰の名前・座標・標高は山岳標高一覧だけから採っている。
// 互いから生成していないので、両者の一致が検証になる(SPEC N-02)。

export type SkylinePoint = {
  /** 真北から時計回りの方位(度) */
  azimuthDeg: number;
  /** 見かけの仰角(度)。地球の丸みと大気差(k=0.13)を入れてある */
  angleDeg: number;
  /** その仰角を作っている地点までの水平距離(m) */
  distanceM: number;
  /** その地点の標高(m) */
  elevationM: number;
  /** この方位で DEM を追えた距離(m)。RAY_MAX_M 未満なら被覆外で打ち切った */
  coveredM: number;
};

export type Peak = {
  name: string;
  reading: string;
  /** 測量成果の標高(m)。DEM とは別 product */
  surveyElevationM: number;
  /** 三角点 / 標高点 / 測定点 */
  surveyKind: string;
  latitudeDeg: number;
  longitudeDeg: number;
  distanceM: number;
  azimuthDeg: number;
  /** 測量標高から計算した見かけの仰角(度)。図に描く高さはこちらを使う */
  apparentAngleDeg: number;
  /** DEM 標高から計算した見かけの仰角(度)。視通判定はこちらで自己完結させる */
  demAngleDeg: number | null;
  /** 同じ地点の DEM 標高(m)。照合用であって、上の値の出所ではない */
  demElevationM: number | null;
  /** 峰より手前の地形の最大仰角(度)。判定できなければ null */
  maxAngleInFrontDeg: number | null;
  /** visible = 見える / hidden = 手前の尾根に隠れる / unknown = DEM の被覆外で判定しない */
  visibility: "visible" | "hidden" | "unknown";
};

export const VIEWPOINT = {
  /**
   * 架空の施設に座標は無い(F-03)。SPEC が気象の基準点として既に採っている
   * 気象庁アメダス野辺山観測所の地点から計算している。実在の公的な基準点であって、
   * 施設の所在ではない。
   */
  label: "気象庁アメダス野辺山観測所の地点",
  latitudeDeg: ${VIEWPOINT.latitudeDeg},
  longitudeDeg: ${VIEWPOINT.longitudeDeg},
  /** DEM が示す地表の標高(m) */
  groundElevationM: ${num(groundElevationM, 2)},
  /** 目の高さ(地表 + ${EYE_HEIGHT_M} m) */
  eyeElevationM: ${num(eyeElevationM, 2)},
} as const;

export const PANORAMA = {
  azimuthFromDeg: ${AZIMUTH_FROM_DEG},
  azimuthToDeg: ${AZIMUTH_TO_DEG},
  azimuthStepDeg: ${AZIMUTH_STEP_DEG},
  rayStepM: ${RAY_STEP_M},
  rayMaxM: ${RAY_MAX_M},
  summitBufferM: ${SUMMIT_BUFFER_M},
  refractionK: ${REFRACTION_K},
  earthRadiusM: ${EARTH_RADIUS_M},
} as const;

export const SKYLINE: readonly SkylinePoint[] = [
${skylineLines}
];

export const PEAKS: readonly Peak[] = [
${peakLines}
];
`;

const dest = join(ROOT, "src", "data", "terrain.generated.ts");
writeFileSync(dest, out, "utf-8");

console.log(`稜線 ${skyline.length} 点 / 峰 ${peaks.length} 座 → ${dest}`);
console.log(`視点 地表 ${groundElevationM.toFixed(2)} m / 目 ${eyeElevationM.toFixed(2)} m`);
for (const p of peaks) {
  const diff = p.demElevationM === null ? "—" : (p.demElevationM - p.surveyElevationM).toFixed(1);
  console.log(
    `  ${p.name.padEnd(14)} ${String(p.surveyElevationM).padStart(4)}m ` +
      `方位${p.azimuthDeg.toFixed(1).padStart(6)}° 仰角${p.apparentAngleDeg.toFixed(2).padStart(6)}° ` +
      `${(p.distanceM / 1000).toFixed(1).padStart(5)}km  DEM差${diff.padStart(6)}  ${p.visibility}`,
  );
}
