// サイト自身についての設定。公開先の URL はここだけが持つ。

export const SITE = {
  /** 本番の URL。sitemap と JSON-LD が使う */
  origin: "https://hoshihata.vercel.app",
  repository: "https://github.com/twill3c/hoshihata",
} as const;

/** sitemap と JSON-LD が同じ経路集合を見るように、一箇所で持つ。 */
export const STATIC_ROUTES: readonly string[] = [
  "/",
  "/shop/",
  "/restaurant/",
  "/panorama/",
  "/rv/",
  "/access/",
  "/news/",
];
