// 架空明示ゲート(SPEC F-03 / §7、T-12〜T-14)。
//
// 道の駅は国土交通省の実在の登録制度に紐づく施設なので、番地・電話番号・登録番号を
// 持たせると実在誤認の害が大きい。持てないことをテストで縛る。
//
// 二つの落とし穴を先回りして塞いである:
//   1. コメントを消さずに走査すると、ゲートが自分の説明文を撃つ(chikuma-seiki 実例)
//   2. 走査対象が 0 件だとゲートは静かに合格する。件数の検算を先頭に置く

import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { STATION } from "@/data/station";
import { NORMALS_STATION } from "@/data/normals.generated";
import { stripComments } from "@/lib/strip-comments";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

/** 出荷ソース(src 配下の .ts / .tsx)を集める。 */
function shippedSources(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      found.push(...shippedSources(path));
    } else if ([".ts", ".tsx"].includes(extname(entry))) {
      found.push(path);
    }
  }
  return found;
}

const FILES = shippedSources(SRC).map((path) => ({
  path: relative(ROOT, path).replace(/\\/g, "/"),
  // コメントは空白化してから走査する。文字列リテラルの中身は残す
  body: stripComments(readFileSync(path, "utf-8")),
}));

describe("T-13 ゲートの空振り防止", () => {
  it("走査対象が 0 件でない", () => {
    // これが無いと、走査対象を取り違えたゲートが静かに合格する
    expect(FILES.length).toBeGreaterThanOrEqual(4);
  });

  it("走査対象に主要な出荷ファイルが含まれている", () => {
    const paths = FILES.map((f) => f.path);
    for (const must of [
      "src/data/station.ts",
      "src/data/crops.ts",
      "src/lib/harvest.ts",
      "src/data/normals.generated.ts",
    ]) {
      expect(paths).toContain(must);
    }
  });

  it("前処理がコメントだけを消し、文字列リテラルを残す", () => {
    // 前処理が壊れると、ゲートは「何も見つからない」形で静かに壊れる
    const sample = `const a = "電話 0267-00-0000"; // 番地は持たない\n/* 番地 */ const b = 1;`;
    const stripped = stripComments(sample);
    expect(stripped).toContain("電話 0267-00-0000"); // 文字列は残る
    expect(stripped).not.toContain("番地"); // コメントは消える
    expect(stripped.split("\n")).toHaveLength(sample.split("\n").length); // 行数は変わらない
  });
});

describe("T-12 架空明示ゲート", () => {
  it("電話番号の形が現れない", () => {
    // 市外局番つきの日本の電話番号。区切りはハイフン・全角ハイフン・括弧を見る
    const phone = /0\d{1,4}[-−(（]\d{1,4}[-−)）]\d{3,4}/;
    for (const { path, body } of FILES) {
      expect(`${path}: ${phone.exec(body)?.[0] ?? "なし"}`).toBe(`${path}: なし`);
    }
  });

  it("番地の形が現れない", () => {
    const banchi = /\d+\s*丁目|\d+\s*番地|字\s*[^\s]{1,8}\s*\d+/;
    for (const { path, body } of FILES) {
      expect(`${path}: ${banchi.exec(body)?.[0] ?? "なし"}`).toBe(`${path}: なし`);
    }
  });

  it("道の駅の登録番号が現れない", () => {
    // 実在の登録制度に紐づく情報は持たない(SPEC §7)
    const registration = /登録\s*第?\s*\d+\s*号|第\s*\d+\s*回登録/;
    for (const { path, body } of FILES) {
      expect(`${path}: ${registration.exec(body)?.[0] ?? "なし"}`).toBe(`${path}: なし`);
    }
  });

  it("Math.random を使わない(決定論の担保・T-10)", () => {
    for (const { path, body } of FILES) {
      expect(`${path}: ${/Math\s*\.\s*random/.test(body)}`).toBe(`${path}: false`);
    }
  });

  it("架空である旨の文言を持っている", () => {
    expect(STATION.fictionNotice).toContain("実在しません");
    expect(STATION.fictionNotice).toContain("架空");
  });
});

describe("T-12b ゲートが落ちることの実証", () => {
  it("禁止語を含む文字列を入れると、各パターンが実際に反応する", () => {
    // 新しいゲートは、わざと違反させて落ちることを確かめるまで信用しない(SPEC §6)
    const violating = stripComments(`const x = "南牧村野辺山 1234番地 電話 0267-00-1234";`);
    expect(/0\d{1,4}[-−(（]\d{1,4}[-−)）]\d{3,4}/.test(violating)).toBe(true);
    expect(/\d+\s*丁目|\d+\s*番地|字\s*[^\s]{1,8}\s*\d+/.test(violating)).toBe(true);

    const registered = stripComments(`const y = "道の駅 登録 第 1234 号";`);
    expect(/登録\s*第?\s*\d+\s*号|第\s*\d+\s*回登録/.test(registered)).toBe(true);

    const random = stripComments(`const z = Math.random();`);
    expect(/Math\s*\.\s*random/.test(random)).toBe(true);
  });
});

describe("T-14 文字種検査", () => {
  it("キリル文字・ハングルが混入しない", () => {
    // 字形が似ていて目視では気づけない(フリートで実在した事故)
    const foreign = /[Ѐ-ӿ가-힯ᄀ-ᇿ]/;
    for (const { path } of FILES) {
      const raw = readFileSync(join(ROOT, path), "utf-8");
      const hit = foreign.exec(raw);
      expect(`${path}: ${hit ? `U+${hit[0].codePointAt(0)!.toString(16)}` : "なし"}`).toBe(
        `${path}: なし`,
      );
    }
  });
});

describe("T-11 施設設定の単一情報源", () => {
  it("標高が気象平年値の観測所標高と一致する", () => {
    // 出所: SPEC §2。二重に書けば必ずどちらかが古くなるので、参照で一致させる
    expect(STATION.elevationM).toBe(NORMALS_STATION.elevationM);
    expect(STATION.elevationM).toBe(1350);
  });

  it("気象の基準点が平年値の観測所と一致する", () => {
    expect(STATION.weatherBasis.blockNo).toBe(NORMALS_STATION.blockNo);
    expect(STATION.weatherBasis.precNo).toBe(NORMALS_STATION.precNo);
    expect(STATION.weatherBasis.normalsPeriod).toBe(NORMALS_STATION.period);
  });

  it("キャンプ場を自前の設備として持たない(SPEC §7)", () => {
    // キャンプの予約は姉妹作 senoto-mori の領分。ここでは隣接施設として案内するだけ
    const ids = STATION.facilities.map((f) => f.id);
    expect(ids).not.toContain("camp");
  });
});
