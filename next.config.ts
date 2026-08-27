import type { NextConfig } from "next";

// 静的書き出し。サーバ関数を持たないので、実行時に外部へ問い合わせる経路が無い(N-04)。
// 天気も地図も vendor 済みのデータから計算済みで、ページは結果を出すだけである。
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  pageExtensions: ["ts", "tsx"],
  // 末尾スラッシュ付きで書き出すと、静的配信での経路が素直になる
  trailingSlash: true,
};

export default nextConfig;
