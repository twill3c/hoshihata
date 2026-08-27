// OG 画像。文言は src/data/og-text.ts が唯一の情報源。
//
// **`output: "export"` では force-static が要る。**
// 無いと `Failed to collect page data` でビルドが落ちる(sugi-nami の教訓)。
export const dynamic = "force-static";

import { ogTextFor } from "@/data/og-text";
import { OG_SIZE, OG_CONTENT_TYPE, renderOgImage } from "@/lib/og";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = ogTextFor("/rv/").title;

export default async function Image() {
  const text = ogTextFor("/rv/");
  return renderOgImage({ title: text.title, subtitle: text.subtitle });
}
