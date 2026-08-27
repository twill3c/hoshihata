import type { Metadata } from "next";
import { MENU_ITEMS } from "@/data/menu";
import { SEASONAL_ITEMS, shopItemById } from "@/data/shop";
import { STATION } from "@/data/station";
import { dayOfYearOf, DAYS_IN_YEAR, monthDayOf } from "@/lib/harvest";
import { menuOn } from "@/lib/shelf";

export const metadata: Metadata = {
  title: "食堂",
  description:
    "高原野菜とハム、チーズのサラダ。品書きはその日に棚へ出る野菜から組み立てるので、日によって変わります。",
};

const SEASONAL_IDS = new Set(SEASONAL_ITEMS.map((i) => i.id));

/** その品が出せる日の数と期間。品書きから逆に数えるので、棚の話と食い違わない。 */
function availabilityOf(menuId: string): { dayCount: number; label: string } {
  const days: number[] = [];
  for (let doy = 1; doy <= DAYS_IN_YEAR; doy++) {
    if (menuOn(doy).some((m) => m.id === menuId)) days.push(doy);
  }
  if (days.length === DAYS_IN_YEAR) return { dayCount: days.length, label: "通年" };
  if (days.length === 0) return { dayCount: 0, label: "出せません" };
  const from = monthDayOf(days[0]!);
  const to = monthDayOf(days[days.length - 1]!);
  return {
    dayCount: days.length,
    label: `${from.month}/${from.day}〜${to.month}/${to.day}（${days.length} 日）`,
  };
}

export default function RestaurantPage() {
  const midsummer = menuOn(dayOfYearOf(8, 1));
  const midwinter = menuOn(dayOfYearOf(1, 15));

  return (
    <div className="wrap">
      <section>
        <h1>食堂</h1>
        <p className="lede">
          ウッドデッキは八ヶ岳に開いています。サラダは、その日に棚へ出た高原野菜に
          ハムとチーズを合わせて組みます。<strong>品書きは決め打ちではありません。</strong>
          野菜が並ばない季節には、その野菜を使う品が消えます。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>品書き</h2>
          <span className="section__note">出せる期間は棚から逆算しています</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">品</th>
                <th scope="col">素材</th>
                <th scope="col">出せる期間</th>
              </tr>
            </thead>
            <tbody>
              {MENU_ITEMS.map((item) => {
                const availability = availabilityOf(item.id);
                return (
                  <tr key={item.id} data-menu={item.id} data-days={availability.dayCount}>
                    <th scope="row" style={{ whiteSpace: "normal" }}>
                      {item.name}
                      <span
                        className="section__note"
                        style={{ display: "block", fontWeight: 400 }}
                      >
                        {item.summary}
                      </span>
                    </th>
                    <td style={{ whiteSpace: "normal" }}>
                      {item.ingredientIds
                        .map((id) => shopItemById(id)?.name ?? id)
                        .join("・")}
                    </td>
                    <td>{availability.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="section__head">
          <h2>夏と冬でどれだけ変わるか</h2>
        </div>
        <ul className="cards">
          <li className="card card--seasonal">
            <h3>8 月 1 日</h3>
            <p>{midsummer.map((m) => m.name).join("／")}</p>
            <span className="card__season">{midsummer.length} 品</span>
          </li>
          <li className="card">
            <h3>1 月 15 日</h3>
            <p>{midwinter.map((m) => m.name).join("／")}</p>
            <span className="card__season">{midwinter.length} 品</span>
          </li>
        </ul>
        <p className="section__note" style={{ marginTop: "1rem" }}>
          差の {midsummer.length - midwinter.length} 品は、
          {MENU_ITEMS.filter((m) => m.ingredientIds.some((i) => SEASONAL_IDS.has(i))).length}{" "}
          品ある高原野菜の料理が冬に出せないためです。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>この食堂について</h2>
        </div>
        <div className="fiction">
          <p style={{ margin: 0 }}>
            {STATION.fictionNotice}
            品書きも架空のものです。実在の生産者・銘柄は一切登場しません。
          </p>
        </div>
      </section>
    </div>
  );
}
