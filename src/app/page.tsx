import { PanoramaFigure } from "@/components/PanoramaFigure";
import { STATION } from "@/data/station";
import { NORMALS_STATION } from "@/data/normals.generated";
import { PEAKS } from "@/data/terrain.generated";
import { monthDayOf } from "@/lib/harvest";
import { vegetableSeason } from "@/lib/shelf";
import { annualMeanTempC, hotDayCount } from "@/lib/climate";

export default function HomePage() {
  const season = vegetableSeason();
  const visible = PEAKS.filter((p) => p.visibility === "visible").length;

  const from = season ? monthDayOf(season.fromDoy) : null;
  const to = season ? monthDayOf(season.toDoy) : null;

  return (
    <>
      <PanoramaFigure />

      <div className="wrap">
        <section>
          <h1>{STATION.name}</h1>
          <p className="lede">
            八ヶ岳の東の裾、{STATION.locality}。標高 {STATION.elevationM.toLocaleString()} m
            のウッドデッキから、{visible} 座の峰が名前つきで見えます。
            高原野菜とハム、チーズのサラダの食堂と、車中泊のための区画があります。
          </p>
        </section>

        <section>
          <div className="section__head">
            <h2>棚に並ぶもの</h2>
            <span className="section__note">気象平年値から計算しています</span>
          </div>
          {season && from && to ? (
            <p>
              高原野菜が棚に出るのは <strong>{from.month} 月 {from.day} 日</strong> から{" "}
              <strong>{to.month} 月 {to.day} 日</strong> まで、通年 {season.dayCount} 日。
              残りの {366 - season.dayCount} 日、野菜の棚は空きます。
            </p>
          ) : null}
          <p>
            年平均気温は {annualMeanTempC().toFixed(2)} ℃、日平均気温が 30 ℃ を超える日は{" "}
            {hotDayCount()} 日。夏でも涼しく、冬は長い。棚の中身がそのまま季節を示します。
          </p>
          <p className="section__note">
            <a href="/shop/">直売所の一覧と旬の帯を見る →</a>
          </p>
        </section>

        <section>
          <div className="section__head">
            <h2>この作品について</h2>
          </div>
          <div className="fiction">
            <p style={{ marginTop: 0 }}>{STATION.fictionNotice}</p>
            <p style={{ marginBottom: 0 }}>
              架空の施設に写真は存在しません。実在地の写真素材で埋めると実在の施設と紛れるため、
              このサイトは写真を一枚も持たず、絵はすべて公開データから計算しています。
              稜線は国土地理院の標高タイルから、旬は気象庁アメダス
              {NORMALS_STATION.name}の日別平年値（{NORMALS_STATION.period}）から出しました。
              番地・電話番号・地図のピン・道の駅の登録番号は持っていません。
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
