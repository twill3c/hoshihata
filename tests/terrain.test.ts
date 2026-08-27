// 稜線同定図のオラクル検査(SPEC F-06 / N-02、T-20〜T-29)。
//
// 背骨は「二つの独立な測量 product が同じ山を指すか」。
//   稜線 — 標高タイル DEM10B(等高線由来の 30.9 m メッシュ)からだけ計算する
//   峰   — 山岳標高一覧(三角点・標高点の測量成果)からだけ採る
// 互いから生成していないので、両者の一致がそのまま検証になる。

import { describe, expect, it } from "vitest";
import { PANORAMA, PEAKS, SKYLINE, VIEWPOINT, type Peak } from "@/data/terrain.generated";
import { NORMALS_STATION } from "@/data/normals.generated";
import { estimateLabelWidthPx, peakKey, renderPanoramaSvg, panoramaCaption } from "@/lib/panorama";

/** 名札の間に要求する最小の隙間(px)。目で見て離れていること */
const MIN_LABEL_GAP_PX = 8;

const visiblePeaks = PEAKS.filter((p) => p.visibility === "visible");
const hiddenPeaks = PEAKS.filter((p) => p.visibility === "hidden");

/** 稜線の局所極大。DEM だけから決まる「山の頂」の候補。 */
const localMaxima = SKYLINE.filter((point, i) => {
  const prev = SKYLINE[i - 1];
  const next = SKYLINE[i + 1];
  return prev !== undefined && next !== undefined && point.angleDeg >= prev.angleDeg && point.angleDeg > next.angleDeg;
});

/** その方位に最も近い稜線の点。 */
function skylineAt(azimuthDeg: number) {
  return SKYLINE.reduce((best, p) =>
    Math.abs(p.azimuthDeg - azimuthDeg) < Math.abs(best.azimuthDeg - azimuthDeg) ? p : best,
  );
}

describe("T-13b ゲートの空振り防止", () => {
  it("走査対象が空でない", () => {
    // 空集合ならどんな全称命題も通ってしまう
    expect(SKYLINE.length).toBeGreaterThan(1000);
    expect(PEAKS.length).toBeGreaterThanOrEqual(10);
    expect(visiblePeaks.length).toBeGreaterThan(0);
    expect(hiddenPeaks.length).toBeGreaterThan(0);
    expect(localMaxima.length).toBeGreaterThan(0);
  });
});

describe("T-20 標高の照合(DEM と測量成果)", () => {
  // DEM の被覆内にある峰だけが照合の対象。被覆外(守屋山など)は demElevationM が null
  const inCoverage = PEAKS.filter((p) => p.demElevationM !== null);

  it("走査対象が空でなく、被覆外の峰も存在する", () => {
    expect(inCoverage.length).toBeGreaterThan(5);
    expect(PEAKS.length).toBeGreaterThan(inCoverage.length);
  });

  it("DEM の山頂標高は測量成果を上回らない", () => {
    // 出所: 不変量。30.9 m メッシュは鋭い山頂を均すので、必ず低めに出る。
    // 上回ったら座標変換かタイルの並べ方を疑う
    for (const peak of inCoverage) {
      expect(`${peak.name}: ${peak.demElevationM! - peak.surveyElevationM <= 0}`).toBe(
        `${peak.name}: true`,
      );
    }
  });

  it("DEM の山頂標高の不足は 50 m 以内", () => {
    // 出所: 実測(2026-08-27)。被覆内の峰で -4.2 〜 -37.4 m、中央 -11.4 m。
    // 定数でなく観測値。データが変わったら測り直して書き換える
    for (const peak of inCoverage) {
      const shortfall = peak.surveyElevationM - peak.demElevationM!;
      expect(`${peak.name}: ${shortfall < 50}`).toBe(`${peak.name}: true`);
    }
  });

  it("視点の DEM 標高が気象庁の観測所標高と 5 m 以内で一致する", () => {
    // 出所: 外部権威。気象庁の観測所定義が示すアメダス野辺山の標高 1350 m。
    // 実測 1351.35 m。座標変換とタイルの読み方が正しいことの、いちばん強い裏付け
    expect(Math.abs(VIEWPOINT.groundElevationM - NORMALS_STATION.elevationM)).toBeLessThan(5);
  });
});

describe("T-21 稜線の形", () => {
  it("方位が厳密に増加し、指定の範囲を覆う", () => {
    expect(SKYLINE[0]!.azimuthDeg).toBe(PANORAMA.azimuthFromDeg);
    expect(SKYLINE[SKYLINE.length - 1]!.azimuthDeg).toBe(PANORAMA.azimuthToDeg);
    for (let i = 1; i < SKYLINE.length; i++) {
      expect(SKYLINE[i]!.azimuthDeg).toBeGreaterThan(SKYLINE[i - 1]!.azimuthDeg);
    }
  });

  it("隣り合う方位で仰角が飛ばない", () => {
    // 出所: 実測(2026-08-27)。隣接差は中央 0.012°・最大 0.064°。
    // 大きく飛んだらタイルの継ぎ目で標高が食い違っている
    for (let i = 1; i < SKYLINE.length; i++) {
      const jump = Math.abs(SKYLINE[i]!.angleDeg - SKYLINE[i - 1]!.angleDeg);
      expect(`${SKYLINE[i]!.azimuthDeg}: ${jump < 0.2}`).toBe(`${SKYLINE[i]!.azimuthDeg}: true`);
    }
  });

  it("どの方位も標高データの被覆内で追い切れている", () => {
    // 追い切れていない方位があれば、その先の峰は「見える」と言ってはいけない
    for (const point of SKYLINE) {
      expect(`${point.azimuthDeg}: ${point.coveredM >= 25000}`).toBe(`${point.azimuthDeg}: true`);
    }
  });
});

describe("T-29 判定できないことを出力に残す", () => {
  // **この分岐は loop_005 まで一度も通らなかった。** 峰の採録半径を射線の届く距離と
  // 同じにしていたため、被覆外の峰は一覧から黙って消えていた。
  // 「見えない」のか「調べていない」のかが読者に伝わらない。
  // 採録半径を 40 km に広げ、判定できないものは unknown として正直に出す(loop_006)。
  const unknown = PEAKS.filter((p) => p.visibility === "unknown");

  it("判定不能の峰が実際に存在する(分岐が生きている)", () => {
    expect(unknown.length).toBeGreaterThan(0);
  });

  it("判定不能なのは、射線を追える距離より遠いか、DEM の被覆外の峰だけ", () => {
    for (const peak of unknown) {
      const tooFar = peak.distanceM > PANORAMA.rayMaxM;
      const outside = peak.demElevationM === null;
      expect(`${peak.name}: ${tooFar || outside}`).toBe(`${peak.name}: true`);
    }
  });

  it("逆に、射線が届く範囲の峰はすべて判定されている", () => {
    // 「判定不能」を逃げ道に使っていないこと
    const reachable = PEAKS.filter(
      (p) => p.distanceM <= PANORAMA.rayMaxM && p.demElevationM !== null,
    );
    expect(reachable.length).toBeGreaterThan(0);
    for (const peak of reachable) {
      expect(`${peak.name}: ${peak.visibility}`).not.toBe(`${peak.name}: unknown`);
    }
  });

  it("判定不能の峰は仰角や遮蔽の値を持たない", () => {
    // 判定していないのに数値だけ出ていたら、読者は判定したと思う
    for (const peak of unknown) {
      expect(`${peak.name}: ${peak.maxAngleInFrontDeg}`).toBe(`${peak.name}: null`);
      expect(`${peak.name}: ${peak.demAngleDeg}`).toBe(`${peak.name}: null`);
    }
  });

  it("採録半径が射線の届く距離より広い(この設計の要)", () => {
    expect(PANORAMA.peakRadiusM).toBeGreaterThan(PANORAMA.rayMaxM);
  });
});

describe("T-22 オラクル — 見える峰は稜線の山と同じ方位にある", () => {
  it("見える峰の方位が、稜線の局所極大と 0.30° 以内で一致する", () => {
    // 出所: 外部権威どうしの照合。稜線は DEM だけ、峰は測量成果だけから来ている。
    // 実測(2026-08-27)の最大ずれは 0.15°(三ッ頭)。方位の刻みが 0.05° なので、
    // その 3 倍を許容とする。ここを緩めるとオラクルの意味が消える
    for (const peak of visiblePeaks) {
      const nearest = localMaxima.reduce((best, m) =>
        Math.abs(m.azimuthDeg - peak.azimuthDeg) < Math.abs(best.azimuthDeg - peak.azimuthDeg) ? m : best,
      );
      const delta = Math.abs(nearest.azimuthDeg - peak.azimuthDeg);
      expect(`${peak.name}: ${delta.toFixed(2)}° ${delta <= 0.3}`).toBe(
        `${peak.name}: ${delta.toFixed(2)}° true`,
      );
    }
  });

  it("見える峰の位置で、稜線が指す距離が峰までの距離と一致する", () => {
    // 稜線の最大仰角を作っている地点が、その峰そのものであること。
    // 実測のずれは 30 m 以内(DEM の標本間隔 30.9 m と同じ桁)
    for (const peak of visiblePeaks) {
      const at = skylineAt(peak.azimuthDeg);
      const gap = Math.abs(at.distanceM - peak.distanceM);
      expect(`${peak.name}: ${gap < 200}`).toBe(`${peak.name}: true`);
    }
  });

  it("見える峰の仰角と稜線の仰角の差が小さく、符号は DEM 側が低い", () => {
    // 出所: 実測(2026-08-27)。差は -0.15° 〜 -0.04°。
    // DEM が山頂を均すぶん稜線がわずかに低い — 標高の照合(T-20)と同じ符号になる
    for (const peak of visiblePeaks) {
      const delta = skylineAt(peak.azimuthDeg).angleDeg - peak.apparentAngleDeg;
      expect(`${peak.name}: ${delta > -0.3 && delta < 0.1}`).toBe(`${peak.name}: true`);
    }
  });
});

describe("T-23 オラクル — 隠れる峰は稜線より低い", () => {
  it("隠れると判定した峰は、同じ方位の稜線が必ずその峰より高い", () => {
    // 隠れているのに稜線より高い、という組み合わせは矛盾である
    for (const peak of hiddenPeaks) {
      const at = skylineAt(peak.azimuthDeg);
      expect(`${peak.name}: ${at.angleDeg.toFixed(2)} >= ${peak.apparentAngleDeg.toFixed(2)}`).toBe(
        `${peak.name}: ${at.angleDeg.toFixed(2)} >= ${peak.apparentAngleDeg.toFixed(2)}`,
      );
      expect(at.angleDeg).toBeGreaterThanOrEqual(peak.apparentAngleDeg);
    }
  });

  it("見える峰の手前の地形は、その峰の DEM 仰角を超えていない", () => {
    for (const peak of visiblePeaks) {
      expect(peak.maxAngleInFrontDeg).not.toBeNull();
      expect(peak.demAngleDeg).not.toBeNull();
      expect(`${peak.name}: ${peak.maxAngleInFrontDeg! <= peak.demAngleDeg!}`).toBe(
        `${peak.name}: true`,
      );
    }
  });

  it("視通判定は DEM だけで完結している(product を混ぜない)", () => {
    // 遮蔽側を DEM、峰側を測量成果から取ると、両者の系統差が判定の余裕に化ける。
    // loop_002 で実際に起き、赤岳が 0.09° 差で辛うじて残っていた
    for (const peak of PEAKS) {
      if (peak.demElevationM === null || peak.demAngleDeg === null) continue;
      // DEM 由来の仰角は、測量成果由来の仰角より必ず低い(T-20 と同じ符号)
      expect(`${peak.name}: ${peak.demAngleDeg <= peak.apparentAngleDeg}`).toBe(
        `${peak.name}: true`,
      );
    }
  });
});

describe("T-24 ゲートが落ちることの実証", () => {
  it("方位を 1° ずらすと、稜線の局所極大との一致が崩れる", () => {
    // 新しいゲートは、わざと違反させて落ちることを確かめるまで信用しない(SPEC §6)。
    // 0.30° の許容が「何でも通る緩さ」でないことを、ずらして示す
    const peak = visiblePeaks.find((p) => p.name === "赤岳")!;
    const shifted = peak.azimuthDeg + 1.0;
    const nearest = localMaxima.reduce((best, m) =>
      Math.abs(m.azimuthDeg - shifted) < Math.abs(best.azimuthDeg - shifted) ? m : best,
    );
    expect(Math.abs(nearest.azimuthDeg - shifted)).toBeGreaterThan(0.3);
  });

  it("隠れる峰を見えることにすると、稜線との矛盾が出る", () => {
    const hidden = hiddenPeaks[0]!;
    const at = skylineAt(hidden.azimuthDeg);
    // 隠れる峰は稜線より低い。もし visible として名札を出せば、
    // 稜線の下に山頂の点が沈んだ図になる
    expect(at.angleDeg).toBeGreaterThan(hidden.apparentAngleDeg);
  });
});

describe("T-25 稜線同定図の出力", () => {
  const svg = renderPanoramaSvg();

  it("見える峰だけが名札を持ち、峰の集合と一致する", () => {
    // 二重定義の照合(senoto-mori G-01 と同じ考え)。
    // ソースを grep してもループで描いている以上は必ず一致するので、出力側を読む
    const marked = [...svg.matchAll(/data-peak="([^"]+)"/g)].map((m) => m[1]);
    expect(marked.sort()).toEqual(visiblePeaks.map(peakKey).sort());
  });

  it("名札の文言が測量成果と一致する", () => {
    for (const peak of visiblePeaks) {
      expect(svg).toContain(`>${peak.name}</text>`);
      expect(svg).toContain(`>${peak.surveyElevationM} m</text>`);
    }
  });

  it("名札どうしが重ならない", () => {
    // loop_002 で「権現岳＜三ッ頭＞」が隣に重なった。幅を字数から見積もって縛る。
    // 基準は「重ならない(>=0)」でなく「視認できる隙間がある(>=8px)」。
    // >=0 だと押しのけを切っても 1.71px の隙間で通ってしまい、ゲートを実証できない
    const centers = [...svg.matchAll(/class="hh-name" x="([\d.]+)"/g)].map((m) => Number(m[1]));
    expect(centers).toHaveLength(visiblePeaks.length);
    for (let i = 1; i < centers.length; i++) {
      const left = visiblePeaks[i - 1]!;
      const right = visiblePeaks[i]!;
      const gap =
        centers[i]! -
        estimateLabelWidthPx(right.name) / 2 -
        (centers[i - 1]! + estimateLabelWidthPx(left.name) / 2);
      expect(`${left.name}→${right.name}: ${gap.toFixed(1)}px ${gap >= MIN_LABEL_GAP_PX}`).toBe(
        `${left.name}→${right.name}: ${gap.toFixed(1)}px true`,
      );
    }
  });

  it("写真を持ち込まない(N-03)", () => {
    // ビジュアルは SVG のみ。外部画像への参照が無いこと
    expect(svg).not.toMatch(/<image\b/);
    expect(svg).not.toMatch(/xlink:href|href="http/);
    expect(svg).not.toMatch(/url\(/);
  });

  it("読み上げに必要な題と説明を持つ", () => {
    expect(svg).toMatch(/role="img"/);
    expect(svg).toContain("<title id=\"hh-panorama-title\">");
    expect(svg).toContain("<desc id=\"hh-panorama-desc\">");
  });

  it("色を決め打ちしない(明暗どちらのテーマでも読める・F-10)", () => {
    // 図の中で色を固定すると、暗い背景に暗い図を置く事故になる
    expect(svg).not.toMatch(/#[0-9a-fA-F]{3,6}/);
    expect(svg).not.toMatch(/\b(fill|stroke)="(?!none)[a-z]+"/);
  });

  it("決定論(同じ入力で同じ出力)", () => {
    expect(renderPanoramaSvg()).toBe(svg);
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("undefined");
  });
});

describe("T-26 添え文がデータと食い違わない", () => {
  it("見える・隠れるの数を数え直して書いている", () => {
    const caption = panoramaCaption();
    expect(caption).toContain(`${PEAKS.length} 座のうち`);
    expect(caption).toContain(`${visiblePeaks.length} 座が見え`);
    expect(caption).toContain(`${hiddenPeaks.length} 座は手前の尾根に隠れます`);
  });
});

describe("T-27 視点は施設の所在ではない", () => {
  it("視点は気象の基準点として明示されている(F-03)", () => {
    // 架空の施設に座標は無い。図は実在の公的な基準点から計算していると書く
    expect(VIEWPOINT.label).toContain("アメダス野辺山");
    expect(VIEWPOINT.latitudeDeg).toBeCloseTo(NORMALS_STATION.latitudeDeg, 6);
    expect(VIEWPOINT.longitudeDeg).toBeCloseTo(NORMALS_STATION.longitudeDeg, 6);
  });
});

/** 同じ山名が複数ある(横岳が 2 座)ので、キーは方位まで含めて一意になっている。 */
describe("T-28 同名の峰", () => {
  it("山名が重複しても峰のキーは一意", () => {
    const names = PEAKS.map((p: Peak) => p.name);
    const keys = PEAKS.map(peakKey);
    expect(new Set(names).size).toBeLessThan(names.length); // 横岳が 2 座ある
    expect(new Set(keys).size).toBe(keys.length);
  });
});
