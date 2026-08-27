import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NEWS, newsBySlug } from "@/data/news";
import { STATION } from "@/data/station";

type Params = { slug: string };

/** 一覧が経路の正本。原稿の置き場所からは経路を作らない */
export function generateStaticParams(): Params[] {
  return NEWS.map((entry) => ({ slug: entry.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { slug } = await params;
  const entry = newsBySlug(slug);
  if (!entry) return {};
  return { title: entry.title, description: entry.summary };
}

export default async function NewsEntryPage({ params }: { params: Promise<Params> }) {
  const { slug } = await params;
  const entry = newsBySlug(slug);
  if (!entry) notFound();

  // 本文は素材として読むだけ。MDX 自体はページになっていない
  const { default: Body } = await import(`../../../../content/news/${entry.date}-${entry.slug}.mdx`);

  return (
    <div className="wrap">
      <section>
        <p className="section__note">
          <time dateTime={entry.date}>{entry.date}</time>
        </p>
        <h1>{entry.title}</h1>
        <div className="news__body">
          <Body />
        </div>
      </section>

      <section>
        <p className="section__note">
          <a href="/news/">お知らせの一覧へ →</a>
        </p>
        <div className="fiction">
          <p style={{ margin: 0 }}>{STATION.fictionNotice}</p>
        </div>
      </section>
    </div>
  );
}
