// お知らせ(F-09)。
//
// 本文は `content/news/<日付>-<slug>.mdx` に置き、ここは一覧だけを持つ。
// **MDX をページにしない**(next.config.ts)。ページにすると経路が原稿の置き場所に縛られる。
//
// 一覧と原稿の食い違いはテストで塞ぐ —
// 「一覧に載っていない原稿が content/ に残っていないこと」を見る(sugi-nami の news.test.ts)。

export type NewsEntry = {
  slug: string;
  /** 掲載日(YYYY-MM-DD)。ファイル名の日付と一致させる */
  date: string;
  title: string;
  summary: string;
};

/** 新しい順。 */
export const NEWS: readonly NewsEntry[] = [
  {
    slug: "season-end",
    date: "2026-10-13",
    title: "高原野菜の棚、今季ぶんを終えました",
    summary: "次は来年の六月です。冬の車中泊のことも書きました。",
  },
  {
    slug: "deck",
    date: "2026-08-01",
    title: "デッキの席を増やしました",
    summary: "正面に赤岳、右手に横岳と硫黄岳。見えない峰のことも。",
  },
  {
    slug: "lettuce",
    date: "2026-06-11",
    title: "高原野菜が棚に出はじめました",
    summary: "いちばん早いのはリーフレタス。結球レタスはあと十日ほど。",
  },
];

/** 原稿のファイル名。一覧の項目から機械的に決まる(手で書かない)。 */
export function fileNameOf(entry: NewsEntry): string {
  return `${entry.date}-${entry.slug}.mdx`;
}

export function newsBySlug(slug: string): NewsEntry | undefined {
  return NEWS.find((entry) => entry.slug === slug);
}
