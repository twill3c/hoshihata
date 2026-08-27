// 公開まわり(SPEC F-11、T-50〜T-52)。
//
// OG 画像のフォント網羅・JSON-LD の禁止事項・sitemap の経路。
// どれも「出してしまってから気づく」類なので、出す前に縛る。

import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEWS } from "@/data/news";
import { OG_TEXTS, allOgCharacters, ogTextFor } from "@/data/og-text";
import { SITE, STATIC_ROUTES } from "@/data/site";
import { STATION } from "@/data/station";
import { FORBIDDEN_KEYS, FORBIDDEN_TYPES, breadcrumbJsonLd, websiteJsonLd } from "@/lib/jsonld";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const FONT_DIR = join(ROOT, "data", "font");

describe("T-50 OG 画像のフォントに字が足りている", () => {
  const manifestPath = join(FONT_DIR, "subset.json");

  it("部分集合の台帳がある", () => {
    expect(existsSync(manifestPath)).toBe(true);
  });

  it("OG に使う字が、部分集合にすべて入っている", () => {
    // 「文言を変えた瞬間に豆腐になる」のを防ぐ本命の検査(sugi-nami の教訓)。
    // 台帳は scripts/gen-og-font.mjs が書く。文言を変えたら回し直す
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const covered = new Set([...String(manifest.characters)]);
    const needed = [...allOgCharacters()];
    expect(needed.length).toBeGreaterThan(0);
    for (const ch of needed) {
      expect(`U+${ch.codePointAt(0)!.toString(16)} (${ch}): ${covered.has(ch)}`).toBe(
        `U+${ch.codePointAt(0)!.toString(16)} (${ch}): true`,
      );
    }
  });

  it("woff が二つとも vendor されていて、空でない", () => {
    // Satori は woff2 を読めない。woff であることは生成器が確かめている
    for (const file of ["subset-regular.woff", "subset-bold.woff"]) {
      const path = join(FONT_DIR, file);
      expect(`${file}: ${existsSync(path)}`).toBe(`${file}: true`);
      expect(`${file}: ${statSync(path).size > 1000}`).toBe(`${file}: true`);
    }
  });

  it("ゲートの実証 — 台帳に無い字を要求すると落ちる", () => {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
    const covered = new Set([...String(manifest.characters)]);
    // 使っていない字。これが台帳に入っていたら、検査が緩すぎることになる
    expect(covered.has("鬱")).toBe(false);
  });

  it("すべての経路に OG の文言がある", () => {
    for (const route of STATIC_ROUTES) {
      expect(() => ogTextFor(route)).not.toThrow();
    }
    expect(OG_TEXTS.map((t) => t.route).sort()).toEqual([...STATIC_ROUTES].sort());
  });

  it("知らない経路は例外にする", () => {
    expect(() => ogTextFor("/no-such-route/")).toThrow();
  });
});

describe("T-51 JSON-LD に事業所の主張を出さない", () => {
  const documents = [
    websiteJsonLd(),
    breadcrumbJsonLd([
      { name: "ホーム", path: "/" },
      { name: "直売所", path: "/shop/" },
    ]),
  ];

  /** 入れ子をすべて平らにして、型と項目名を集める。 */
  function walk(value: unknown, types: string[], keys: string[]): void {
    if (Array.isArray(value)) {
      for (const item of value) walk(item, types, keys);
      return;
    }
    if (value === null || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (key === "@type" && typeof child === "string") types.push(child);
      else keys.push(key);
      walk(child, types, keys);
    }
  }

  it("走査対象が空でない", () => {
    const types: string[] = [];
    const keys: string[] = [];
    for (const doc of documents) walk(doc, types, keys);
    expect(types.length).toBeGreaterThan(0);
    expect(keys.length).toBeGreaterThan(0);
  });

  it("事業所・場所を主張する @type を出さない", () => {
    const types: string[] = [];
    for (const doc of documents) walk(doc, types, []);
    for (const forbidden of FORBIDDEN_TYPES) {
      expect(`${forbidden}: ${types.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
    // 出してよい型は出ている(空集合で素通りさせない)
    expect(types).toContain("WebSite");
    expect(types).toContain("BreadcrumbList");
  });

  it("住所・座標・電話・営業時間の項目を出さない", () => {
    const keys: string[] = [];
    for (const doc of documents) walk(doc, [], keys);
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(`${forbidden}: ${keys.includes(forbidden)}`).toBe(`${forbidden}: false`);
    }
  });

  it("架空である旨が説明文に入っている(F-03 の明示 4 箇所のひとつ)", () => {
    expect(String(websiteJsonLd().description)).toContain("実在しません");
  });

  it("ゲートの実証 — 禁じた型を混ぜると検出される", () => {
    const bad = { "@context": "https://schema.org", "@type": "LocalBusiness", telephone: "x" };
    const types: string[] = [];
    const keys: string[] = [];
    walk(bad, types, keys);
    expect(types.some((t) => FORBIDDEN_TYPES.includes(t))).toBe(true);
    expect(keys.some((k) => FORBIDDEN_KEYS.includes(k))).toBe(true);
  });
});

describe("T-52 sitemap の経路", () => {
  it("静的な経路とお知らせを漏れなく持つ", () => {
    // 経路の集合はデータが持つ。sitemap に書き写さない
    expect(STATIC_ROUTES.length).toBeGreaterThan(0);
    expect(NEWS.length).toBeGreaterThan(0);
  });

  it("公開先の URL が https で、末尾にスラッシュを持たない", () => {
    expect(SITE.origin).toMatch(/^https:\/\//);
    expect(SITE.origin.endsWith("/")).toBe(false);
  });

  it("経路がすべてスラッシュで始まり、末尾スラッシュで終わる", () => {
    // trailingSlash: true でビルドしているので、経路の形を揃える
    for (const route of STATIC_ROUTES) {
      expect(`${route}: ${route.startsWith("/") && route.endsWith("/")}`).toBe(`${route}: true`);
    }
  });

  it("施設名がサイトの題に入っている", () => {
    expect(String(websiteJsonLd().name)).toContain(STATION.name);
  });
});
