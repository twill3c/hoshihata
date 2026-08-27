"use client";

// 直売所の絞り込み(F-04)。
//
// 初期状態が「すべて」なので、**出荷 HTML には全件が入る**。絞り込みは
// ハイドレーション後のクライアント側の操作でしかない。JS が動かない環境では
// 絞り込めないだけで、品は全件読める。出荷 HTML を読む検査(N-05)も全件を見られる。
//
// 品の中身は props で受け取り、この部品は何も知らない。

import { useState } from "react";
import type { ShopCategory } from "@/data/shop";

export type ShopListItem = {
  id: string;
  name: string;
  category: ShopCategory;
  categoryName: string;
  summary: string;
  /** 棚に並ぶ期間の説明。通年の品は「通年」 */
  seasonLabel: string;
  seasonal: boolean;
};

export function ShopList({
  items,
  categories,
}: {
  items: readonly ShopListItem[];
  categories: readonly { id: ShopCategory; name: string }[];
}) {
  const [selected, setSelected] = useState<ShopCategory | "all">("all");
  const shown = selected === "all" ? items : items.filter((i) => i.category === selected);

  return (
    <>
      <div className="filter" role="group" aria-label="分類で絞り込む">
        <button
          type="button"
          className="filter__button"
          aria-pressed={selected === "all"}
          onClick={() => setSelected("all")}
        >
          すべて（{items.length}）
        </button>
        {categories.map((category) => {
          const count = items.filter((i) => i.category === category.id).length;
          return (
            <button
              key={category.id}
              type="button"
              className="filter__button"
              aria-pressed={selected === category.id}
              onClick={() => setSelected(category.id)}
            >
              {category.name}（{count}）
            </button>
          );
        })}
      </div>

      <ul className="cards">
        {shown.map((item) => (
          <li
            key={item.id}
            className={item.seasonal ? "card card--seasonal" : "card"}
            data-item={item.id}
            data-category={item.category}
          >
            <h3>{item.name}</h3>
            <p>{item.summary}</p>
            <span className="card__season">{item.seasonLabel}</span>
          </li>
        ))}
      </ul>

      {shown.length === 0 ? <p className="section__note">この分類に品がありません。</p> : null}
    </>
  );
}
