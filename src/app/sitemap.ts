import type { MetadataRoute } from "next";
import { NEWS } from "@/data/news";
import { SITE, STATIC_ROUTES } from "@/data/site";

// 静的書き出しなので sitemap.xml として出る。
// 経路の集合は src/data/site.ts と src/data/news.ts が持つ(ここで書き写さない)。
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    ...STATIC_ROUTES.map((path) => ({ url: `${SITE.origin}${path}` })),
    ...NEWS.map((entry) => ({ url: `${SITE.origin}/news/${entry.slug}/` })),
  ];
}
