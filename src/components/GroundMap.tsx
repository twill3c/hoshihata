// RV パークの場内図(F-07)。
//
// 区画の矩形も名前も、すべて `src/data/rv.ts` の座標から描く。図の中に座標を書かない。
// 図とデータを別に持てば、必ずどちらかが古くなる(senoto-mori G-01 と同じ考え)。
//
// 状態を持たない。テストが図を単体で描画でき、出力を直接検査できる。

import { DECK, RV_SITES } from "@/data/rv";

/** 図の余白(m)。場内の座標系そのままで viewBox を作る */
const MARGIN_M = 3;

export function GroundMap() {
  const maxX = Math.max(...RV_SITES.map((s) => s.x + s.widthM), DECK.x + DECK.widthM);
  const maxY = Math.max(...RV_SITES.map((s) => s.y + s.lengthM));
  const width = maxX + MARGIN_M;
  const height = maxY + MARGIN_M;

  return (
    <svg
      className="ground-map"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-labelledby="ground-map-title ground-map-desc"
    >
      <title id="ground-map-title">RV パークの場内図</title>
      <desc id="ground-map-desc">
        {RV_SITES.length} 区画のうち {RV_SITES.filter((s) => s.power).length} 区画に電源があります。
        北側のウッドデッキに面した {RV_SITES.filter((s) => s.deckSide).length} 区画からは八ヶ岳が見えます。
        当日先着で、予約は受けていません。
      </desc>

      {/* ウッドデッキ。八ヶ岳(西)に開いている */}
      <g className="gm-deck">
        <rect x={DECK.x} y={DECK.y} width={DECK.widthM} height={DECK.depthM} rx={0.3} />
        <text x={DECK.x + DECK.widthM / 2} y={DECK.y + DECK.depthM / 2 + 0.5}>
          ウッドデッキ
        </text>
      </g>

      {RV_SITES.map((site) => (
        <g
          key={site.id}
          className={site.power ? "gm-site gm-site--power" : "gm-site"}
          data-site-id={site.id}
          data-power={String(site.power)}
          data-deck-side={String(site.deckSide)}
        >
          {/*
            SVG の <title> は**必ずテンプレート文字列一つ**で書く。
            複数の式を並べると React の単一テキスト子要素制約で中身が丸ごと落ち、
            <title></title> だけが出荷される(HC-037。senoto-mori L2 に続き本作でも踏んだ)。
          */}
          <title>
            {`${site.id}／${site.widthM} × ${site.lengthM} m／` +
              `${site.power ? "電源あり" : "電源なし"}／` +
              `${site.deckSide ? "デッキ側" : "奥側"}`}
          </title>
          <rect x={site.x} y={site.y} width={site.widthM} height={site.lengthM} rx={0.3} />
          <text x={site.x + site.widthM / 2} y={site.y + site.lengthM / 2 + 0.5}>
            {site.id}
          </text>
        </g>
      ))}
    </svg>
  );
}
