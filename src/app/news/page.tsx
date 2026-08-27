import type { Metadata } from "next";
import { NEWS } from "@/data/news";

export const metadata: Metadata = {
  title: "お知らせ",
  description: "棚と食堂と RV パークからのお知らせ。",
};

export default function NewsIndexPage() {
  return (
    <div className="wrap">
      <section>
        <h1>お知らせ</h1>
        <p className="lede">棚と食堂と RV パークから。{NEWS.length} 件。</p>
      </section>

      <section>
        <ul className="cards">
          {NEWS.map((entry) => (
            <li className="card" key={entry.slug} data-news={entry.slug}>
              <h3>
                <a href={`/news/${entry.slug}/`}>{entry.title}</a>
              </h3>
              <p>{entry.summary}</p>
              <span className="card__season">
                <time dateTime={entry.date}>{entry.date}</time>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
