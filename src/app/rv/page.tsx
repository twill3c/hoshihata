import type { Metadata } from "next";
import { GroundMap } from "@/components/GroundMap";
import { APPLIANCES, POWER_LIMIT_A, POWER_LIMIT_W, RV_SITES } from "@/data/rv";
import { STATION } from "@/data/station";
import { dayOfYearOf, normalOf } from "@/lib/harvest";
import {
  appliancesNeededAt,
  largestFittingCombination,
  totalWattOf,
  withMandatory,
} from "@/lib/power";
import { monthlyOutlook, occupancyLevelOf, SITE_COUNT } from "@/lib/occupancy";
import { lowestDailyMinC } from "@/lib/climate";

export const metadata: Metadata = {
  title: "RV パーク",
  description:
    "車中泊のための 12 区画。当日先着で予約は受けていません。15 A の電源で何が同時に使えるかを計算しています。",
};

const nameOf = (id: string) => APPLIANCES.find((a) => a.id === id)?.name ?? id;

export default function RvPage() {
  const powered = RV_SITES.filter((s) => s.power);
  const deckSide = RV_SITES.filter((s) => s.deckSide);

  const best = largestFittingCombination();
  const withFridge = withMandatory(["fridge"]);

  const winterTemp = normalOf(dayOfYearOf(1, 15)).tempMeanC;
  const winterNeeded = appliancesNeededAt(winterTemp);
  const winterPlan = withMandatory([...winterNeeded.map((a) => a.id), "fridge"]);

  const outlook = monthlyOutlook();

  return (
    <div className="wrap">
      <section>
        <h1>RV パーク</h1>
        <p className="lede">
          車中泊のための {SITE_COUNT} 区画。<strong>当日先着で、予約は受けていません。</strong>
          {powered.length} 区画に電源があり、{deckSide.length} 区画はウッドデッキ側で八ヶ岳が正面に来ます。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>場内図</h2>
          <span className="section__note">濃い区画に電源があります</span>
        </div>
        <GroundMap />
      </section>

      <section>
        <div className="section__head">
          <h2>電源は {POWER_LIMIT_A} A まで</h2>
          <span className="section__note">
            {POWER_LIMIT_A} A × 100 V = {POWER_LIMIT_W} W
          </span>
        </div>
        <p>
          「{POWER_LIMIT_A} A まで」と書かれても、それが何を意味するかは分かりません。
          そこで、実際に同時に使える組み合わせを数えました。
        </p>
        <p>
          いちばん多く挿せる組み合わせは{" "}
          <strong>{best.applianceIds.map(nameOf).join("・")}</strong> の {best.applianceIds.length} 点で、
          合計 {best.totalWatt} W。
        </p>
        <p>
          車載冷蔵庫（{withFridge.mandatoryWatt} W）はつけっぱなしになるので、残りは{" "}
          {withFridge.remainingWatt} W。この範囲に<strong>1 点だけ</strong>足すなら、
          {withFridge.alsoUsable.map(nameOf).join("・")} のどれでも入ります。
          {withFridge.blocked.length > 0 ? (
            <>
              {" "}
              1 点でも入らないのが <strong>{withFridge.blocked.map(nameOf).join("・")}</strong> です。
            </>
          ) : null}{" "}
          ただし <strong>2 点以上を同時に</strong>挿すなら話は別で、たとえば電気ケトルと炊飯器は
          冷蔵庫と合わせて {totalWattOf(["fridge", "kettle", "rice-cooker"])} W になり、
          {POWER_LIMIT_W} W を超えます。
        </p>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">製品</th>
                <th scope="col">消費電力</th>
                <th scope="col">冷蔵庫＋この 1 点</th>
                <th scope="col">備考</th>
              </tr>
            </thead>
            <tbody>
              {APPLIANCES.map((appliance) => (
                <tr key={appliance.id} data-appliance={appliance.id}>
                  <th scope="row">{appliance.name}</th>
                  <td>{appliance.watt} W</td>
                  <td>{withFridge.alsoUsable.includes(appliance.id) ? "使える" : appliance.id === "fridge" ? "—" : "使えない"}</td>
                  <td style={{ whiteSpace: "normal" }}>{appliance.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section__head">
          <h2>冬の朝のこと</h2>
          <span className="section__note">気象平年値から</span>
        </div>
        <p>
          1 月 15 日の日平均気温は平年値で {winterTemp.toFixed(1)} ℃、
          日最低気温の平年値は年間で最も低いところが {lowestDailyMinC().toFixed(1)} ℃ まで下がります。
          この気温では <strong>{winterNeeded.map((a) => a.name).join("・")}</strong> が要ります。
          冷蔵庫と合わせて {winterPlan.mandatoryWatt} W なので、残り {winterPlan.remainingWatt} W。
          {winterPlan.alsoUsable.length > 0 ? (
            <>
              {" "}
              ここに 1 点だけ足すなら{" "}
              <strong>{winterPlan.alsoUsable.map(nameOf).join("・")}</strong> のどれでも入ります。
            </>
          ) : null}
        </p>
        <p className="section__note">
          電源の無い区画では、保温シートと寝袋で越すことになります。直売所に置いています。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>混み具合の見込み</h2>
          <span className="section__note">実績ではありません（下記）</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">月</th>
                <th scope="col">平日</th>
                <th scope="col">土曜</th>
                <th scope="col">土曜の目安</th>
              </tr>
            </thead>
            <tbody>
              {outlook.map((row) => (
                <tr key={row.month} data-month={row.month}>
                  <th scope="row">{row.month} 月</th>
                  <td>
                    {row.weekday} / {SITE_COUNT}
                  </td>
                  <td>
                    {row.saturday} / {SITE_COUNT}
                  </td>
                  <td>{occupancyLevelOf(Math.round(row.saturday))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="fiction" style={{ marginTop: "1.2rem" }}>
          <p style={{ margin: 0 }}>
            {STATION.fictionNotice}
            この表は稼働の実績ではありません。架空の施設に実績は存在しないので、
            気温の平年値と高原野菜の作期から組んだ決定論的な見込みです。
            同じ日を何度見ても同じ数字が出ます。
          </p>
        </div>
      </section>
    </div>
  );
}
