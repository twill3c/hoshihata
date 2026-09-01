// サイト自身についての設定。公開先の URL はここだけが持つ。

const SITE_REPOSITORY = "https://github.com/twill3c/hoshihata";

export const SITE = {
  /** 本番の URL。sitemap と JSON-LD が使う */
  origin: "https://hoshihata.vercel.app",
  repository: SITE_REPOSITORY,
} as const;

/**
 * フリート共通フッタの 5 項目(この並び)。
 * 規約は koho-lens が正本。ラベルは和名+固有動詞を温存する。
 */
export const FOOTER = {
  // 規約では MIT License はこのリポジトリの LICENSE を指す(koho-lens が正本)。
  // 一般論の opensource.org ではない。JSON-LD の license とは別物なので混ぜない。
  license: `${SITE_REPOSITORY}/blob/main/LICENSE`,
  repository: SITE_REPOSITORY,
  guide: "https://claude.ai/code/artifact/603d766b-05bc-47ed-b706-eeb64346c142",
  blueprint: "https://claude.ai/code/artifact/38a59c53-4b96-4c8b-9e50-8100fcc3323c",
  appMenu: "https://app-menu-amber.vercel.app/",
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
