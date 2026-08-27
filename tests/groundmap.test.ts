// 場内図と方位盤の二重定義の照合(SPEC F-07 / F-08、T-47〜T-48)。
//
// **ソースを grep しても意味がない。** ループで描いている以上、ソース上は必ず一致する。
// 見るべきは描画結果である。さらに、出荷 HTML にも同じ集合が届いているかを見る —
// ソースに書いてあることが出力に届くとは限らない(senoto-mori G-01 / HC-037)。

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GroundMap } from "@/components/GroundMap";
import { PlanView, visiblePeaksInPlan } from "@/components/PlanView";
import { RV_SITES } from "@/data/rv";
import { PEAKS } from "@/data/terrain.generated";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

const groundMapHtml = renderToStaticMarkup(createElement(GroundMap));
const planViewHtml = renderToStaticMarkup(createElement(PlanView));

/** 出荷 HTML。ビルド前なら null(その場合は描画結果だけを見る)。 */
function shipped(path: string): string | null {
  const file = join(ROOT, "out", path);
  return existsSync(file) ? readFileSync(file, "utf-8") : null;
}

const idsIn = (html: string, attribute: string) =>
  [...html.matchAll(new RegExp(`${attribute}="([^"]+)"`, "g"))].map((m) => m[1]!).sort();

describe("T-46b <title> が空にならない", () => {
  // SVG の <title> に複数の式を並べると、React の単一テキスト子要素制約で
  // 中身が丸ごと落ちる(HC-037)。本作では場内図と方位盤の 22 個が実際に空になっていた。
  // ビルド前に落とせるよう、描画結果の段階で見る。
  it.each([
    ["場内図", groundMapHtml],
    ["方位盤", planViewHtml],
  ])("%s の <title> がすべて中身を持つ", (name, html) => {
    const titles = [...html.matchAll(/<title[^>]*>([\s\S]*?)<\/title>/g)].map((m) => m[1]!);
    expect(titles.length).toBeGreaterThan(0);
    for (const [i, body] of titles.entries()) {
      expect(`${name}[${i}]: ${body.trim().length > 0}`).toBe(`${name}[${i}]: true`);
    }
  });

  it("複数式で書いた <title> は実際に落ちる(この制約が実在することの実証)", () => {
    const multi = renderToStaticMarkup(
      createElement("svg", null, createElement("title", null, "あ", "い")),
    );
    const single = renderToStaticMarkup(
      createElement("svg", null, createElement("title", null, "あい")),
    );
    expect(multi).toContain("<title></title>");
    expect(single).toContain("<title>あい</title>");
  });
});

describe("T-47 場内図の二重定義の照合", () => {
  it("描画結果の区画集合が、区画データと完全に一致する", () => {
    expect(RV_SITES.length).toBeGreaterThan(0); // 空集合で素通りさせない
    expect(idsIn(groundMapHtml, "data-site-id")).toEqual(RV_SITES.map((s) => s.id).sort());
  });

  it("電源の有無が、描画結果でも区画データと一致する", () => {
    for (const site of RV_SITES) {
      const found = new RegExp(
        `data-site-id="${site.id}" data-power="(true|false)" data-deck-side="(true|false)"`,
      ).exec(groundMapHtml);
      expect(`${site.id}: ${found ? found[1] : "属性なし"}`).toBe(`${site.id}: ${site.power}`);
      expect(`${site.id}: ${found ? found[2] : "属性なし"}`).toBe(`${site.id}: ${site.deckSide}`);
    }
  });

  it("区画の名前が描画結果に文字として出ている", () => {
    // SVG の <text> が React の制約で落ちた事故がフリートに実在する(HC-037)。
    // 属性だけ見ていると気づけない
    for (const site of RV_SITES) {
      expect(`${site.id}: ${groundMapHtml.includes(`>${site.id}</text>`)}`).toBe(
        `${site.id}: true`,
      );
    }
  });

  it("出荷 HTML にも同じ区画集合が届いている", () => {
    const html = shipped("rv/index.html");
    if (html === null) return; // ビルド前は描画結果だけで足りる
    expect(idsIn(html, "data-site-id")).toEqual(RV_SITES.map((s) => s.id).sort());
    for (const site of RV_SITES) {
      expect(`${site.id}: ${html.includes(`>${site.id}</text>`)}`).toBe(`${site.id}: true`);
    }
  });

  it("図の外形が区画をすべて含む", () => {
    // viewBox が足りないと、右下の区画が図からはみ出して見えなくなる
    const viewBox = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(groundMapHtml);
    expect(viewBox).not.toBeNull();
    const width = Number(viewBox![1]);
    const height = Number(viewBox![2]);
    for (const site of RV_SITES) {
      expect(`${site.id}: ${site.x + site.widthM <= width}`).toBe(`${site.id}: true`);
      expect(`${site.id}: ${site.y + site.lengthM <= height}`).toBe(`${site.id}: true`);
    }
  });
});

describe("T-48 方位盤の二重定義の照合", () => {
  const inRange = PEAKS.filter((p) => p.distanceM <= 14000);

  it("描画結果の峰集合が、範囲内の峰と一致する", () => {
    expect(inRange.length).toBeGreaterThan(0);
    expect(idsIn(planViewHtml, "data-plan-peak")).toEqual(inRange.map((p) => p.name).sort());
  });

  it("番号を出しているのは見える峰だけで、方位順に 1 から振られる", () => {
    // 名札は置かない(峰が西に集中して互いに重なるため)。番号でカード一覧と対応させる
    const visible = inRange.filter((p) => p.visibility === "visible");
    const hidden = inRange.filter((p) => p.visibility === "hidden");
    expect(visible.length).toBeGreaterThan(0);
    expect(hidden.length).toBeGreaterThan(0);

    const numbered = visiblePeaksInPlan();
    expect(numbered.map((n) => n.number)).toEqual(
      Array.from({ length: visible.length }, (_, i) => i + 1),
    );
    // 方位順であること
    for (let i = 1; i < numbered.length; i++) {
      expect(numbered[i]!.peak.azimuthDeg).toBeGreaterThan(numbered[i - 1]!.peak.azimuthDeg);
    }
    // 図に出ている番号の集合が一致する
    const drawn = [...planViewHtml.matchAll(/class="pv-number"[^>]*>(\d+)</g)].map((m) =>
      Number(m[1]),
    );
    expect(drawn.sort((a, b) => a - b)).toEqual(numbered.map((n) => n.number));
    // 峰の名前は図に文字として出さない(名札をやめた)
    for (const peak of visible) {
      expect(`${peak.name}: ${planViewHtml.includes(`>${peak.name}</text>`)}`).toBe(
        `${peak.name}: false`,
      );
    }
  });

  it("道路や鉄道の線を描かない(実在の経路を案内図にしない・F-03)", () => {
    // 図に出てよい line は方位の軸 2 本だけ
    const lines = [...planViewHtml.matchAll(/<line\b/g)].length;
    expect(lines).toBe(2);
    expect(planViewHtml).not.toMatch(/<path\b/);
  });

  it("出荷 HTML にも同じ峰集合が届いている", () => {
    const html = shipped("access/index.html");
    if (html === null) return;
    expect(idsIn(html, "data-plan-peak")).toEqual(inRange.map((p) => p.name).sort());
  });
});
