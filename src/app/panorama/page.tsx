import type { Metadata } from "next";
import { PanoramaFigure } from "@/components/PanoramaFigure";
import { PANORAMA, PEAKS, VIEWPOINT } from "@/data/terrain.generated";
import { STATION } from "@/data/station";

export const metadata: Metadata = {
  title: "稜線",
  description:
    "ウッドデッキから見える八ヶ岳の稜線。国土地理院の標高タイルから方位・仰角・視通を計算し、見える峰と隠れる峰を分けています。",
};

const VISIBILITY_LABEL: Record<string, string> = {
  visible: "見える",
  hidden: "手前の尾根に隠れる",
  unknown: "標高データの範囲外で判定していない",
};

export default function PanoramaPage() {
  const visible = PEAKS.filter((p) => p.visibility === "visible");
  const hidden = PEAKS.filter((p) => p.visibility === "hidden");

  return (
    <>
      <PanoramaFigure />

      <div className="wrap">
        <section>
          <h1>ウッドデッキから見る稜線</h1>
          <p className="lede">
            方位 {PANORAMA.azimuthFromDeg}°〜{PANORAMA.azimuthToDeg}° に入る {PEAKS.length} 座のうち、
            名前を出せるのは {visible.length} 座です。残る {hidden.length} 座は手前の尾根に隠れて見えません。
            <strong>蓼科山も天狗岳も、ここからは見えません。</strong>
            それは目で見ただけでは分からないので、計算して確かめました。
          </p>
        </section>

        <section>
          <div className="section__head">
            <h2>峰の一覧</h2>
            <span className="section__note">
              標高は国土地理院「日本の主な山岳標高一覧」の測量成果です
            </span>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th scope="col">峰</th>
                  <th scope="col">標高</th>
                  <th scope="col">方位</th>
                  <th scope="col">仰角</th>
                  <th scope="col">距離</th>
                  <th scope="col">見えるか</th>
                </tr>
              </thead>
              <tbody>
                {PEAKS.map((peak) => (
                  <tr
                    key={`${peak.name}@${peak.azimuthDeg}`}
                    data-peak-name={peak.name}
                    data-visibility={peak.visibility}
                  >
                    <th scope="row">{peak.name}</th>
                    <td>{peak.surveyElevationM.toLocaleString()} m</td>
                    <td>{peak.azimuthDeg.toFixed(1)}°</td>
                    <td>{peak.apparentAngleDeg.toFixed(2)}°</td>
                    <td>{(peak.distanceM / 1000).toFixed(1)} km</td>
                    <td>{VISIBILITY_LABEL[peak.visibility]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="section__head">
            <h2>どう計算したか</h2>
          </div>
          <p>
            {VIEWPOINT.label}（標高 {VIEWPOINT.groundElevationM.toFixed(2)} m）から、
            方位を {PANORAMA.azimuthStepDeg}° ずつ刻んで射線を飛ばし、
            国土地理院の標高タイルを {PANORAMA.rayStepM} m ごとに読んで、
            見かけの仰角が最大になる点を稜線としています。
            仰角には地球の丸みと大気差（k = {PANORAMA.refractionK}）を入れました。
            入れないと 10 km 先で 0.04° ぶん高く見積もります。
          </p>
          <p>
            峰が見えるかどうかは、その峰より手前の地形が峰の仰角を超えて立ち上がっているかで決めます。
            山頂の手前 {PANORAMA.summitBufferM} m は数えません。標高タイルの標本間隔は 30.9 m なので、
            それより近い地形は山頂そのものであって、遮るものではないからです。
          </p>
          <div className="fiction">
            <p style={{ margin: 0 }}>
              {STATION.fictionNotice}
              図は{VIEWPOINT.label}という実在の公的な基準点から計算したもので、
              施設の所在を示すものではありません。
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
