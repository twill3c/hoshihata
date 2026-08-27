import type { Metadata } from "next";
import { STATION } from "@/data/station";
import { FOOTER, SITE } from "@/data/site";
import { websiteJsonLd } from "@/lib/jsonld";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE.origin),
  title: {
    default: `${STATION.name} — 八ヶ岳 野辺山高原`,
    template: `%s — ${STATION.name}`,
  },
  description:
    "架空の道の駅のポートフォリオ。野辺山の気象平年値から旬カレンダーを、国土地理院の標高データから八ヶ岳の稜線を計算して描いています。写真は一枚も使っていません。",
};

const NAV = [
  { href: "/", label: "ホーム" },
  { href: "/shop/", label: "直売所" },
  { href: "/restaurant/", label: "食堂" },
  { href: "/panorama/", label: "稜線" },
  { href: "/rv/", label: "RV パーク" },
  { href: "/access/", label: "道のり" },
  { href: "/news/", label: "お知らせ" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header className="masthead">
          <div className="wrap">
            <a className="masthead__name" href="/">
              {STATION.name}
            </a>
            <span className="masthead__reading">{STATION.reading}</span>
            <nav aria-label="主要な案内">
              {NAV.map((item) => (
                <a key={item.href} href={item.href}>
                  {item.label}
                </a>
              ))}
            </nav>
          </div>
        </header>

        <main>{children}</main>

        {/*
          架空の施設に事業所の構造化データを出さない(F-03)。
          LocalBusiness や Place は、番地を書かなくても型そのものが
          「ここに店がある」と主張してしまう。出すのは WebSite だけ。
        */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd()) }}
        />

        {/*
          fleet: fixed footer。フリート共通規約(5 項目・この並び・下部固定)に、
          架空である旨の明示を先頭に足したもの。明示はここが 1 箇所目(F-03)。
          ラベルは和名+固有動詞を温存する(統一するのは並びと項目数であって文言ではない)。
        */}
        <footer className="site-footer">
          {/*
            ブランドサイト三作(senoto-mori / hoshihata / sugi-nami)は
            senoto-mori の書きっぷりに揃える —— 規約の 5 項目を先に置き、
            架空である旨をその下の一行として続ける。
          */}
          <div className="site-footer__inner">
            <a href={FOOTER.license}>MIT License</a>
            {/* 著作権表示はリンクの外に置く(規約: MIT License © 2026 坂田哲朗 ・ …) */}
            <span className="site-footer__copy">© 2026 坂田哲朗</span>
            <a href={FOOTER.repository}>GitHub</a>
            <a href={FOOTER.guide}>星畑の歩き方</a>
            <a href={FOOTER.blueprint}>星畑の設計図</a>
            <a href={FOOTER.appMenu}>App Menu</a>
            <p className="site-footer__fiction">{STATION.fictionNotice}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
