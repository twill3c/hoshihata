import type { Metadata } from "next";
import { SeasonCalendar } from "@/components/SeasonCalendar";
import { ShopList, type ShopListItem } from "@/components/ShopList";
import { CROP_LABEL, CULTIVARS, cropNames } from "@/data/crops";
import { SHOP_CATEGORIES, SHOP_ITEMS, categoryName } from "@/data/shop";
import { monthDayOf } from "@/lib/harvest";
import { seasonSpansOf, vegetableSeason } from "@/lib/shelf";

export const metadata: Metadata = {
  title: "直売所",
  description:
    "高原野菜・乳製品・ハム・ソーセージ・手作りパン・山道具。高原野菜が棚に並ぶ日は、野辺山の気象平年値から計算しています。",
};

/** 棚に並ぶ期間の一言。区間から作るので、帯の図と食い違わない。 */
function seasonLabelOf(itemId: string, seasonal: boolean): string {
  if (!seasonal) return "通年";
  const spans = seasonSpansOf(itemId);
  if (spans.length === 0) return "並びません";
  return spans
    .map((span) => {
      const from = monthDayOf(span.fromDoy);
      const to = monthDayOf(span.toDoy);
      return `${from.month}/${from.day}〜${to.month}/${to.day}`;
    })
    .join("、");
}

export default function ShopPage() {
  // 作物の呼び名はデータ側が持つ（src/data/crops.ts）。
  // ページ側にフォールバック付きの対応表を置くと、埋め忘れが英語キーのまま本文に出る
  const crops = cropNames().join("と");

  // 閾値の一覧も作型データから作る。文に書き写すと作物を足したときに古くなる
  const thresholdSentence = [
    ...new Map(
      CULTIVARS.map((c) => [c.crop, `${CROP_LABEL[c.crop]}は ${c.growthLowC}〜${c.growthHighC} ℃`]),
    ).values(),
  ].join("、") + " で日数を数えています。";

  const items: ShopListItem[] = SHOP_ITEMS.map((item) => ({
    id: item.id,
    name: item.name,
    category: item.category,
    categoryName: categoryName(item.category),
    summary: item.summary,
    seasonal: item.cultivarId !== null,
    seasonLabel: seasonLabelOf(item.id, item.cultivarId !== null),
  }));

  const season = vegetableSeason();

  return (
    <div className="wrap">
      <section>
        <h1>直売所</h1>
        <p className="lede">
          高原野菜の棚は季節でまるごと入れ替わります。並ぶ日は決め打ちではなく、
          気象庁アメダス野辺山の日別平年値と{crops}の栽培生理から計算した収穫日です。
          {season ? `通年 366 日のうち、野菜が並ぶのは ${season.dayCount} 日。` : null}
          <strong>温度の閾値は作物ごとに違います。</strong>
          {thresholdSentence}
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>旬の帯</h2>
          <span className="section__note">横軸は通年 366 日。帯が棚に出る期間です</span>
        </div>
        <SeasonCalendar />
      </section>

      <section>
        <div className="section__head">
          <h2>品</h2>
          <span className="section__note">分類で絞り込めます</span>
        </div>
        <ShopList
          items={items}
          categories={SHOP_CATEGORIES.map((c) => ({ id: c.id, name: c.name }))}
        />
      </section>

      <section>
        <div className="section__head">
          <h2>置いていない野菜</h2>
          <span className="section__note">同じ計算で「合わない」と出たもの</span>
        </div>
        <p>
          <strong>ブロッコリー</strong>は 10 ℃ を下回ると育ちません。
          ここで日平均が 10 ℃ を超えるのは 5 月 8 日から 10 月 12 日までの 158 日だけで、
          定植から収穫まで 70〜90 日かかる作物にはこの窓が足りません。
          四月に植えても五月八日まで一日も進まないので、
          <strong>四月のいつ植えても収穫日が同じ</strong>になります。
        </p>
        <p>
          <strong>ダイコン</strong>は、参照している原典に「何度を下回ると育たないか」の記述が
          ありません。上限（25 ℃ 以上で主根の肥大が抑制される）だけが書かれています。
          分からないものを推測で埋めないことにしているので、置いていません。
        </p>
      </section>

      <section>
        <div className="section__head">
          <h2>分類</h2>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">分類</th>
                <th scope="col">品数</th>
                <th scope="col">説明</th>
              </tr>
            </thead>
            <tbody>
              {SHOP_CATEGORIES.map((category) => (
                <tr key={category.id}>
                  <th scope="row">{category.name}</th>
                  <td>{SHOP_ITEMS.filter((i) => i.category === category.id).length}</td>
                  <td style={{ whiteSpace: "normal" }}>{category.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
