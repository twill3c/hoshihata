// 稜線同定図の描画(F-06)。
//
// 写真を一切持たない本作で、ウッドデッキから見える景色を担う図。
// 絵を描くのではなく、国土地理院の標高タイルから計算した稜線をそのまま線にする。
//
// React に依存しない純関数として置く。文字列を返すだけなので、
// テストが図を単体で描画でき、出力を直接検査できる(senoto-mori の G-01 と同じ考え)。

import { PANORAMA, PEAKS, SKYLINE, VIEWPOINT, type Peak, type SkylinePoint } from "../data/terrain.generated.ts";

export type PanoramaOptions = {
  /** 図の幅(px) */
  width?: number;
  /** 図の高さ(px) */
  height?: number;
  /** 描く仰角の下限・上限(度) */
  angleFromDeg?: number;
  angleToDeg?: number;
};

const DEFAULTS = {
  width: 1200,
  height: 420,
  angleFromDeg: -0.5,
  // 最高峰(赤岳 9.23°)の上に二行の名札が入るだけの余白を残す。
  // 10.5° だと名札が山頂に被る
  angleToDeg: 11.5,
} as const;

/** 方位の目盛に添える呼び名。真西・北西だけ入れる(それ以上は figure が混む) */
const COMPASS: readonly { azimuthDeg: number; label: string }[] = [
  { azimuthDeg: 270, label: "西" },
  { azimuthDeg: 315, label: "北西" },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const round = (v: number) => Number(v.toFixed(2));

type Scale = {
  x: (azimuthDeg: number) => number;
  y: (angleDeg: number) => number;
};

function scaleFor(width: number, height: number, angleFrom: number, angleTo: number): Scale {
  const azSpan = PANORAMA.azimuthToDeg - PANORAMA.azimuthFromDeg;
  const angleSpan = angleTo - angleFrom;
  return {
    x: (az) => ((az - PANORAMA.azimuthFromDeg) / azSpan) * width,
    // 仰角が大きいほど上。SVG の y は下向きなので反転する
    y: (angle) => height - ((angle - angleFrom) / angleSpan) * height,
  };
}

/** 稜線を塗りつぶせる閉じたパスにする。 */
function skylinePath(points: readonly SkylinePoint[], scale: Scale, height: number): string {
  const head = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${round(scale.x(p.azimuthDeg))} ${round(scale.y(p.angleDeg))}`)
    .join(" ");
  const lastX = round(scale.x(points[points.length - 1]!.azimuthDeg));
  const firstX = round(scale.x(points[0]!.azimuthDeg));
  return `${head} L${lastX} ${height} L${firstX} ${height} Z`;
}

/** 名札の字送り(px)。和文は全角なので font-size とほぼ同じ幅を見込む */
const NAME_FONT_PX = 15;
/** 名札どうしの最小の隙間(px) */
const LABEL_GAP_PX = 14;

/**
 * 名札の幅を字数から見積もる。
 * 「権現岳＜三ッ頭＞」のような長い名前を固定幅で扱うと、隣の名札に重なって読めなくなる
 * (loop_002 で実際に起きた)。半角は半分の幅で数える。
 */
export function estimateLabelWidthPx(text: string): number {
  let units = 0;
  for (const ch of text) units += /[\x20-\x7e｡-ﾟ]/.test(ch) ? 0.5 : 1;
  return units * NAME_FONT_PX;
}

/**
 * 名札が重ならないように、峰を方位順に見て左から詰める。返すのは名札の**中心**の x。
 * 押しのけた分は引き出し線で山頂に戻す。乱数は使わない(決定論・T-10)。
 */
function labelPositions(peaks: readonly Peak[], scale: Scale, width: number): Map<string, number> {
  const placed = new Map<string, number>();
  let previousRight = Number.NEGATIVE_INFINITY;

  for (const peak of peaks) {
    const half = estimateLabelWidthPx(peak.name) / 2;
    // 山頂の真上に置きたいが、直前の名札と重なるなら右へずらす
    let center = Math.max(scale.x(peak.azimuthDeg), previousRight + LABEL_GAP_PX + half);
    // 図の左右からはみ出さない
    center = Math.min(Math.max(center, half + 2), width - half - 2);
    placed.set(peakKey(peak), center);
    previousRight = center + half;
  }
  return placed;
}

/** 同じ山名が複数ある(横岳が 2 座)ので、方位まで入れて一意にする。 */
export function peakKey(peak: Peak): string {
  return `${peak.name}@${peak.azimuthDeg.toFixed(3)}`;
}

/**
 * 稜線同定図を SVG の文字列にする。
 *
 * 色は CSS カスタムプロパティ経由で受け取り、既定値を持たせる。
 * 明暗どちらのテーマでも読めるように、図側は色を決め打ちしない(F-10)。
 */
export function renderPanoramaSvg(options: PanoramaOptions = {}): string {
  const width = options.width ?? DEFAULTS.width;
  const height = options.height ?? DEFAULTS.height;
  const angleFrom = options.angleFromDeg ?? DEFAULTS.angleFromDeg;
  const angleTo = options.angleToDeg ?? DEFAULTS.angleToDeg;
  const scale = scaleFor(width, height, angleFrom, angleTo);

  const visible = PEAKS.filter((p) => p.visibility === "visible");
  const labelX = labelPositions(visible, scale, width);

  // 方位のラベルは**空の側**に置く。図の下端に置くと稜線の塗りつぶしに沈んで読めない
  // (loop_002 で実際に起きた。DOM 検査では通ってしまう種類の欠陥)
  const ticks = COMPASS.filter(
    (c) => c.azimuthDeg >= PANORAMA.azimuthFromDeg && c.azimuthDeg <= PANORAMA.azimuthToDeg,
  )
    .map((c) => {
      const x = round(scale.x(c.azimuthDeg));
      return (
        `<g class="hh-tick"><line x1="${x}" y1="0" x2="${x}" y2="${height}" />` +
        `<text x="${x + 6}" y="16">${esc(c.label)} ${c.azimuthDeg}°</text></g>`
      );
    })
    .join("\n    ");

  const marks = visible
    .map((peak) => {
      const summitX = round(scale.x(peak.azimuthDeg));
      const summitY = round(scale.y(peak.apparentAngleDeg));
      const textX = round(labelX.get(peakKey(peak))!);
      // 方位ラベルの帯(上端 16px あたり)を避ける
      const textY = round(Math.max(40, summitY - 34));
      // 引き出し線は名札の**下辺**へ引く。名札の行間へ引くと標高の文字を貫く
      const leaderY = round(textY + 22);
      return (
        `<g class="hh-peak" data-peak="${esc(peakKey(peak))}" data-visibility="${peak.visibility}">\n` +
        `      <title>${esc(peak.name)} ${peak.surveyElevationM} m ` +
        `方位 ${peak.azimuthDeg.toFixed(1)}° 距離 ${(peak.distanceM / 1000).toFixed(1)} km</title>\n` +
        `      <line class="hh-leader" x1="${summitX}" y1="${summitY}" x2="${textX}" y2="${leaderY}" />\n` +
        `      <circle class="hh-summit" cx="${summitX}" cy="${summitY}" r="3" />\n` +
        `      <text class="hh-name" x="${textX}" y="${textY}">${esc(peak.name)}</text>\n` +
        `      <text class="hh-elev" x="${textX}" y="${textY + 16}">${peak.surveyElevationM} m</text>\n` +
        `    </g>`
      );
    })
    .join("\n    ");

  const description =
    `気象庁アメダス野辺山観測所の地点(標高 ${VIEWPOINT.groundElevationM.toFixed(0)} m)から` +
    `方位 ${PANORAMA.azimuthFromDeg}°〜${PANORAMA.azimuthToDeg}° を見たときの稜線。` +
    `国土地理院の標高タイルから計算した。名前を出した ${visible.length} 座は手前の尾根に隠れずに見える峰。`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="hh-panorama-title hh-panorama-desc" class="hh-panorama">
  <title id="hh-panorama-title">ウッドデッキから見る八ヶ岳の稜線</title>
  <desc id="hh-panorama-desc">${esc(description)}</desc>
  <g class="hh-ticks">
    ${ticks}
  </g>
  <path class="hh-ridge" d="${skylinePath(SKYLINE, scale, height)}" />
  <g class="hh-peaks">
    ${marks}
  </g>
</svg>`;
}

/** 図に添える一文。峰の数を数え直して書くので、データと文が食い違わない。 */
export function panoramaCaption(): string {
  const visible = PEAKS.filter((p) => p.visibility === "visible").length;
  const hidden = PEAKS.filter((p) => p.visibility === "hidden").length;
  const unknown = PEAKS.filter((p) => p.visibility === "unknown").length;
  const tail = unknown > 0 ? `、${unknown} 座は標高データの範囲外で判定していません` : "";
  return (
    `方位 ${PANORAMA.azimuthFromDeg}°〜${PANORAMA.azimuthToDeg}° に入る ${PEAKS.length} 座のうち、` +
    `${visible} 座が見え、${hidden} 座は手前の尾根に隠れます${tail}。`
  );
}
