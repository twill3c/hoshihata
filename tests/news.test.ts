// お知らせ(SPEC F-09、T-49)。
//
// 一覧(`src/data/news.ts`)と原稿(`content/news/*.mdx`)は別々に置いてある。
// 別々に置いた以上、**双方向で塞がないと必ずどちらかが取り残される** —
// 一覧に載っていない原稿が残る／原稿の無い項目が一覧に載る。

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { NEWS, fileNameOf, newsBySlug } from "@/data/news";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const CONTENT = join(ROOT, "content", "news");

const files = readdirSync(CONTENT).filter((name) => name.endsWith(".mdx"));

describe("T-49 一覧と原稿の照合", () => {
  it("走査対象が空でない", () => {
    expect(NEWS.length).toBeGreaterThan(0);
    expect(files.length).toBeGreaterThan(0);
  });

  it("一覧のすべての項目に原稿がある", () => {
    for (const entry of NEWS) {
      const path = join(CONTENT, fileNameOf(entry));
      expect(`${entry.slug}: ${existsSync(path)}`).toBe(`${entry.slug}: true`);
    }
  });

  it("一覧に載っていない原稿が content/ に残っていない", () => {
    // こちらが本題。書きかけの原稿が公開されないのは当然として、
    // 「消したつもりの原稿が残っている」ことに気づけないのが怖い
    const listed = new Set(NEWS.map(fileNameOf));
    for (const file of files) {
      expect(`${file}: ${listed.has(file)}`).toBe(`${file}: true`);
    }
  });

  it("slug と日付が一意で、ファイル名と一致する", () => {
    const slugs = NEWS.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const entry of NEWS) {
      expect(fileNameOf(entry)).toBe(`${entry.date}-${entry.slug}.mdx`);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(newsBySlug(entry.slug)).toBe(entry);
    }
  });

  it("新しい順に並んでいる", () => {
    for (let i = 1; i < NEWS.length; i++) {
      expect(NEWS[i - 1]!.date >= NEWS[i]!.date).toBe(true);
    }
  });

  it("原稿が空でなく、題名を二重に持たない", () => {
    // 題名は一覧が持つ。原稿の先頭にも書くと、直したときに食い違う
    for (const entry of NEWS) {
      const body = readFileSync(join(CONTENT, fileNameOf(entry)), "utf-8").trim();
      expect(`${entry.slug}: ${body.length > 0}`).toBe(`${entry.slug}: true`);
      expect(`${entry.slug}: ${body.startsWith("#")}`).toBe(`${entry.slug}: false`);
    }
  });

  it("原稿が外部へのリンクを持たない(N-04)", () => {
    for (const entry of NEWS) {
      const body = readFileSync(join(CONTENT, fileNameOf(entry)), "utf-8");
      const external = /\]\(https?:\/\//.exec(body);
      expect(`${entry.slug}: ${external ? external[0] : "なし"}`).toBe(`${entry.slug}: なし`);
    }
  });

  it("原稿の中のリンク先が、実在する経路を指す", () => {
    // 本文に書いたリンクが 404 になっていないこと
    const routes = new Set(["/", "/shop/", "/restaurant/", "/panorama/", "/rv/", "/access/", "/news/"]);
    for (const entry of NEWS) {
      const body = readFileSync(join(CONTENT, fileNameOf(entry)), "utf-8");
      for (const match of body.matchAll(/\]\((\/[^)]*)\)/g)) {
        const href = match[1]!;
        const known = routes.has(href) || NEWS.some((e) => `/news/${e.slug}/` === href);
        expect(`${entry.slug} → ${href}: ${known}`).toBe(`${entry.slug} → ${href}: true`);
      }
    }
  });
});
