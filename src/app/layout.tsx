import type { Metadata } from "next";
import { STATION } from "@/data/station";
import "./globals.css";

export const metadata: Metadata = {
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

        {/* fleet: fixed footer。架空である旨の明示はここが 1 箇所目(F-03) */}
        <footer className="site-footer">
          <div className="site-footer__inner">
            <span>{STATION.fictionNotice}</span>
            <span>MIT License © 2026 坂田哲朗</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
