// 旬の帯(F-04)。作型ごとに「棚に並ぶ日」を通年の帯で描く。
//
// 帯の位置も長さも、月の目盛の位置も、すべて `src/lib/shelf.ts` と `src/lib/harvest.ts` が
// 返す通日から計算する。座標を決め打ちしない。
//
// 月を 12 等分に置いてはならない。月の長さは 28〜31 日で揃っておらず、
// 帯は通日に比例して描かれるので、等分すると図と目盛が最大 1.5 日ぶんずれる
// (図に添える文字を図と別の根拠で置く事故 — HC-039 と同型)。

import { SEASONAL_ITEMS } from "@/data/shop";
import { dayOfYearOf, DAYS_IN_YEAR } from "@/lib/harvest";
import { seasonSpansOf } from "@/lib/shelf";

/** 通日を帯の中の位置(%)に直す。帯と目盛で同じ関数を使う。 */
function percentOf(doy: number): number {
  return ((doy - 1) / DAYS_IN_YEAR) * 100;
}

const MONTH_TICKS = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  leftPercent: percentOf(dayOfYearOf(i + 1, 1)),
}));

export function SeasonCalendar() {
  return (
    <div className="calendar">
      {SEASONAL_ITEMS.map((item) => {
        const spans = seasonSpansOf(item.id);
        return (
          <div className="calendar__row" key={item.id}>
            <span className="calendar__name">{item.name}</span>
            <div
              className="calendar__track"
              role="img"
              aria-label={`${item.name}が棚に並ぶ期間`}
              data-item={item.id}
              data-spans={spans.length}
            >
              {spans.map((span) => (
                <span
                  key={`${span.fromDoy}-${span.toDoy}`}
                  className="calendar__span"
                  data-from={span.fromDoy}
                  data-to={span.toDoy}
                  style={{
                    left: `${percentOf(span.fromDoy)}%`,
                    width: `${percentOf(span.toDoy + 1) - percentOf(span.fromDoy)}%`,
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      <div className="calendar__row">
        <span aria-hidden="true" />
        <div className="calendar__months" aria-hidden="true">
          {MONTH_TICKS.map((tick) => (
            <span
              key={tick.month}
              className="calendar__month"
              data-month={tick.month}
              style={{ left: `${tick.leftPercent}%` }}
            >
              {tick.month}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
