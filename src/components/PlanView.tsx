// 方位盤(F-08)。
//
// 架空の施設に地図のピンは持てない(F-03)。代わりに、基準点から見た**方位と距離**を描く。
// 峰の位置は稜線と同じ `src/data/terrain.generated.ts` から来ているので、
// 図のために座標を新しく作っていない。
//
// 道路や鉄道の線は描かない。実在の経路を模式化すると、それ自体が案内図になってしまう。

import { PEAKS, VIEWPOINT } from "@/data/terrain.generated";

/** 図の半径が表す距離(m)。八ヶ岳の主稜線が収まる大きさに採る */
const RANGE_M = 14000;
/** 描く円の半径(図の座標) */
const R = 100;

const RINGS_KM = [5, 10];

/** 方位・距離 → 図の座標。北が上、東が右。 */
function place(azimuthDeg: number, distanceM: number): { x: number; y: number } {
  const r = (Math.min(distanceM, RANGE_M) / RANGE_M) * R;
  const rad = (azimuthDeg * Math.PI) / 180;
  return { x: r * Math.sin(rad), y: -r * Math.cos(rad) };
}

/**
 * 見える峰に方位順の番号を振る。図には番号だけを出し、名前と距離はカード側に置く。
 *
 * 名札を図に置くと、峰が方位 266〜302° に集中しているせいで互いに重なり、
 * 方位の目盛(「西」)とも衝突する(loop_002 の稜線図と同型)。
 * 押しのけで解くと峰の分布に依存した調整が要るので、**名札そのものをやめた**。
 * 番号は下のカード一覧と同じ順序から導くので、図と文が食い違わない。
 */
export function visiblePeaksInPlan() {
  return PEAKS.filter((p) => p.distanceM <= RANGE_M && p.visibility === "visible")
    .slice()
    .sort((a, b) => a.azimuthDeg - b.azimuthDeg)
    .map((peak, i) => ({ peak, number: i + 1 }));
}

export function PlanView() {
  const shown = PEAKS.filter((p) => p.distanceM <= RANGE_M);
  const visible = shown.filter((p) => p.visibility === "visible");
  const numbers = new Map(visiblePeaksInPlan().map(({ peak, number }) => [peak.name, number]));

  return (
    <svg
      className="plan-view"
      viewBox={`${-R - 30} ${-R - 20} ${(R + 30) * 2} ${(R + 20) * 2}`}
      role="img"
      aria-labelledby="plan-title plan-desc"
    >
      <title id="plan-title">基準点から見た八ヶ岳の方位と距離</title>
      <desc id="plan-desc">
        {VIEWPOINT.label}を中心に、半径 {RANGE_M / 1000} km までの峰を方位と距離で置いた図です。
        北が上。番号のついた {visible.length} 座は手前の尾根に隠れずに見える峰で、下の一覧と同じ番号です。
        道路や鉄道は描いていません。
      </desc>

      <g className="pv-rings">
        {RINGS_KM.map((km) => (
          <g key={km}>
            <circle cx={0} cy={0} r={(km / (RANGE_M / 1000)) * R} />
            <text x={2} y={-(km / (RANGE_M / 1000)) * R - 2}>
              {km} km
            </text>
          </g>
        ))}
        <circle cx={0} cy={0} r={R} />
      </g>

      <g className="pv-axes">
        <line x1={-R} y1={0} x2={R} y2={0} />
        <line x1={0} y1={-R} x2={0} y2={R} />
        <text className="pv-compass" x={0} y={-R - 6} textAnchor="middle">
          北
        </text>
        <text className="pv-compass" x={-R - 8} y={4} textAnchor="middle">
          西
        </text>
        <text className="pv-compass" x={R + 8} y={4} textAnchor="middle">
          東
        </text>
        <text className="pv-compass" x={0} y={R + 14} textAnchor="middle">
          南
        </text>
      </g>

      <circle className="pv-origin" cx={0} cy={0} r={2.5} />

      <g className="pv-peaks">
        {shown.map((peak) => {
          const at = place(peak.azimuthDeg, peak.distanceM);
          return (
            <g
              key={`${peak.name}@${peak.azimuthDeg}`}
              className={peak.visibility === "visible" ? "pv-peak pv-peak--visible" : "pv-peak"}
              data-plan-peak={peak.name}
              data-visibility={peak.visibility}
            >
              {/* テンプレート文字列一つで書く。複数式は React に落とされる(HC-037) */}
              <title>
                {`${peak.name} ${peak.surveyElevationM} m／` +
                  `方位 ${peak.azimuthDeg.toFixed(0)}°／${(peak.distanceM / 1000).toFixed(1)} km`}
              </title>
              <circle cx={at.x} cy={at.y} r={peak.visibility === "visible" ? 3.4 : 1.6} />
              {peak.visibility === "visible" ? (
                <text className="pv-number" x={at.x} y={at.y}>
                  {numbers.get(peak.name)}
                </text>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
