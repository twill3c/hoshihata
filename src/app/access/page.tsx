import type { Metadata } from "next";
import { PlanView, visiblePeaksInPlan } from "@/components/PlanView";
import { STATION } from "@/data/station";
import { NORMALS_STATION } from "@/data/normals.generated";
import { PEAKS, VIEWPOINT } from "@/data/terrain.generated";
import { dayOfYearOf, DAYS_IN_YEAR, monthDayOf, normalOf } from "@/lib/harvest";
import { extremeMonths, lowestDailyMinC } from "@/lib/climate";

export const metadata: Metadata = {
  title: "道のり",
  description:
    "八ヶ岳の東の裾、野辺山高原。基準点から見た方位と距離の図と、冬の道の条件を気象平年値から示します。",
};

/** 日平均気温が 0 ℃ を下回る日の数と、その期間。凍結の目安として使う。 */
function freezingSpell(): { dayCount: number; fromLabel: string; toLabel: string } {
  const days: number[] = [];
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    if (normalOf(doy).tempMeanC < 0) days.push(doy);
  }
  // 冬は年をまたぐので、11 月以降から始まる帯を「冬の入口」とみなす
  const late = days.filter((d) => d >= dayOfYearOf(11, 1));
  const early = days.filter((d) => d < dayOfYearOf(11, 1));
  const from = late.length > 0 ? monthDayOf(late[0]!) : monthDayOf(days[0]!);
  const to = early.length > 0 ? monthDayOf(early[early.length - 1]!) : monthDayOf(days[days.length - 1]!);
  return {
    dayCount: days.length,
    fromLabel: `${from.month} 月 ${from.day} 日`,
    toLabel: `${to.month} 月 ${to.day} 日`,
  };
}

export default function AccessPage() {
  const spell = freezingSpell();
  const { coldest } = extremeMonths();
  const visible = PEAKS.filter((p) => p.visibility === "visible");
  const nearest = [...PEAKS].sort((a, b) => a.distanceM - b.distanceM)[0]!;

  return (
    <div className="wrap">
      <section>
        <h1>道のり</h1>
        <p className="lede">
          八ヶ岳の東の裾、{STATION.locality}。標高 {STATION.elevationM.toLocaleString()} m の高原です。
          最寄りは JR 小海線で、南牧村によれば野辺山駅は全国で最も標高の高いところにある駅です。
        </p>
        <div className="fiction">
          <p style={{ margin: 0 }}>
            {STATION.fictionNotice}
            そのため、番地・電話番号・地図のピンは持っていません。
            下の図は{VIEWPOINT.label}という実在の公的な基準点から見た方位と距離であって、
            施設の所在を示すものではありません。道路や鉄道の線も描いていません。
          </p>
        </div>
      </section>

      <section>
        <div className="section__head">
          <h2>方位と距離</h2>
          <span className="section__note">北が上。番号のついた {visible.length} 座が下の一覧に対応します</span>
        </div>
        <PlanView />
        <p className="section__note" style={{ marginTop: "1rem" }}>
          いちばん近い峰は {nearest.name}（{(nearest.distanceM / 1000).toFixed(1)} km、方位{" "}
          {nearest.azimuthDeg.toFixed(0)}°）。八ヶ岳の主稜線はすべて西から北西にあり、
          ウッドデッキはその方向へ開いています。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>冬の道</h2>
          <span className="section__note">
            気象庁アメダス{NORMALS_STATION.name}の平年値（{NORMALS_STATION.period}）から
          </span>
        </div>
        <p>
          日平均気温が 0 ℃ を下回る日は、平年値で <strong>年 {spell.dayCount} 日</strong>。
          {spell.fromLabel} ごろから {spell.toLabel} ごろまでが目安です。
          最も寒いのは {coldest} 月で、日最低気温の平年値は年間の底で{" "}
          <strong>{lowestDailyMinC().toFixed(1)} ℃</strong> まで下がります。
        </p>
        <p>
          この期間は路面の凍結を前提にしてください。とくに朝は、日平均が氷点下ということは
          日中に融けた水が夜のあいだに凍り直すということです。
          冬用タイヤか鎖のどちらかは要ります。
        </p>
        <p className="section__note">
          これは平年値であって、その年の実際の天候ではありません。
          出発前にその日の予報を確かめてください。このサイトは外部の気象サービスに接続していません。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>デッキから見えるもの</h2>
        </div>
        <ul className="cards">
          {visiblePeaksInPlan().map(({ peak, number }) => (
            <li className="card" key={`${peak.name}@${peak.azimuthDeg}`} data-plan-number={number}>
              <h3>
                <span className="card__number">{number}</span> {peak.name}
              </h3>
              <p>
                方位 {peak.azimuthDeg.toFixed(0)}°／{(peak.distanceM / 1000).toFixed(1)} km／
                標高 {peak.surveyElevationM.toLocaleString()} m
              </p>
              <span className="card__season">仰角 {peak.apparentAngleDeg.toFixed(1)}°</span>
            </li>
          ))}
        </ul>
        <p className="section__note" style={{ marginTop: "1rem" }}>
          <a href="/panorama/">稜線の図と、隠れて見えない峰の一覧 →</a>
        </p>
      </section>
    </div>
  );
}
