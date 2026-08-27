import type { NextConfig } from "next";
import createMDX from "@next/mdx";

// 静的書き出し。サーバ関数を持たないので、実行時に外部へ問い合わせる経路が無い(N-04)。
// 天気も地図も vendor 済みのデータから計算済みで、ページは結果を出すだけである。
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // **MDX をページにしない。** ページにすると経路が原稿の置き場所に縛られる。
  // お知らせの本文は content/news/*.mdx を素材として動的 import で読むだけにする
  // (sugi-nami と同じ構成)。
  pageExtensions: ["ts", "tsx"],
  trailingSlash: true,
};

export default createMDX({})(nextConfig);
