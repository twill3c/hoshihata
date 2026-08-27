// OG 画像(F-11)。
//
// 図の主題はこのサイトと同じ —— **八ヶ岳の稜線**。写真を持たないので、
// 稜線同定図と同じ生成データからシルエットを描く。
//
// フォントは `data/font/` に vendor 済みの部分集合を読む(N-01)。
// ビルド時にネットワークへ出ない。字が足りないと豆腐になるので、
// **使う字がすべて部分集合に入っていること**をテストで縛る(T-50)。
//
// Satori(next/og)の癖:
//   - **woff2 を読めない**。vendor するのは woff
//   - 放射グラデーションの再現が弱い。使わない
//   - `output: "export"` では `export const dynamic = "force-static"` が要る。
//     無いと `Failed to collect page data` でビルドが落ちる

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { PANORAMA, SKYLINE } from "@/data/terrain.generated";
import { STATION } from "@/data/station";

export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

/** 図の中で稜線が占める高さ(px)。上に文字を置く余白を残す */
const RIDGE_TOP_PX = 300;

const INK = "#1f2b33";
const SKY = "#eef2f4";
const RIDGE = "#46555e";
const MUTED = "#5f6f79";

/** 稜線のシルエットをパスにする。稜線図と同じデータから引く。 */
function ridgePath(width: number, height: number): string {
  const azSpan = PANORAMA.azimuthToDeg - PANORAMA.azimuthFromDeg;
  const angles = SKYLINE.map((p) => p.angleDeg);
  const minAngle = Math.min(...angles);
  const maxAngle = Math.max(...angles) + 0.8;
  const span = maxAngle - minAngle;

  const x = (az: number) => ((az - PANORAMA.azimuthFromDeg) / azSpan) * width;
  const y = (angle: number) =>
    height - ((angle - minAngle) / span) * (height - RIDGE_TOP_PX) - 0;

  // 点が 1401 個あると SVG のパスが長くなりすぎるので間引く。
  // 4 点に 1 点でも 0.2° 刻みで、1200 px 幅なら 1 px あたり 0.058° より細かい
  const step = 4;
  const points = SKYLINE.filter((_, i) => i % step === 0 || i === SKYLINE.length - 1);

  const head = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(p.azimuthDeg).toFixed(1)} ${y(p.angleDeg).toFixed(1)}`)
    .join(" ");
  return `${head} L${width} ${height} L0 ${height} Z`;
}

/** vendor 済みのフォント。無ければ null(呼び出し側が字なしに落とす)。 */
function loadFont(file: string): Buffer | null {
  try {
    return readFileSync(join(process.cwd(), "data", "font", file));
  } catch {
    return null;
  }
}

export type OgOptions = {
  /** 大きく出す文字。ページの題 */
  title: string;
  /** 小さく添える文字 */
  subtitle?: string;
};

export async function renderOgImage({ title, subtitle }: OgOptions): Promise<ImageResponse> {
  const { width, height } = OG_SIZE;
  const bold = loadFont("subset-bold.woff");
  const regular = loadFont("subset-regular.woff");

  const fonts = [
    ...(regular ? [{ name: "Subset", data: regular, weight: 400 as const, style: "normal" as const }] : []),
    ...(bold ? [{ name: "Subset", data: bold, weight: 700 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div
        style={{
          width,
          height,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-start",
          background: SKY,
          fontFamily: "Subset",
          position: "relative",
        }}
      >
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <path d={ridgePath(width, height)} fill={RIDGE} />
        </svg>

        <div style={{ display: "flex", flexDirection: "column", padding: "56px 64px", gap: 14 }}>
          <div style={{ fontSize: 30, color: MUTED, fontWeight: 400 }}>{STATION.name}</div>
          <div style={{ fontSize: 76, color: INK, fontWeight: 700, lineHeight: 1.15 }}>{title}</div>
          {subtitle ? (
            <div style={{ fontSize: 28, color: MUTED, fontWeight: 400 }}>{subtitle}</div>
          ) : null}
        </div>

        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 36,
            fontSize: 22,
            color: "#ffffff",
            fontWeight: 400,
            display: "flex",
          }}
        >
          架空の道の駅です
        </div>
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length > 0 ? fonts : undefined },
  );
}
