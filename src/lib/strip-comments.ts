// 禁止語の走査に掛ける前処理。
//
// コメントを消してから走査する。消さないと「番地を持たない」と書いたコメント自体が
// 禁止語に当たり、ゲートが自分の説明文を撃つ(chikuma-seiki の loop_001 で実在した事故)。
//
// 文字列リテラルは**消さない**。実在誤認を招くデータが入るとしたら、そこだからである。

/**
 * TypeScript / JavaScript のソースから行コメントとブロックコメントを取り除く。
 * 文字列リテラル・テンプレートリテラル・正規表現リテラルの中身は保つ。
 * 取り除いた分は空白に置き換えるので、文字位置と行数は変わらない。
 */
export function stripComments(source: string): string {
  const out = source.split("");
  let i = 0;
  const n = source.length;

  const blank = (from: number, to: number) => {
    for (let k = from; k < to; k++) {
      if (out[k] !== "\n") out[k] = " ";
    }
  };

  while (i < n) {
    const c = source[i]!;
    const next = source[i + 1];

    // 行コメント
    if (c === "/" && next === "/") {
      let j = i + 2;
      while (j < n && source[j] !== "\n") j++;
      blank(i, j);
      i = j;
      continue;
    }

    // ブロックコメント
    if (c === "/" && next === "*") {
      let j = i + 2;
      while (j < n && !(source[j] === "*" && source[j + 1] === "/")) j++;
      j = Math.min(j + 2, n);
      blank(i, j);
      i = j;
      continue;
    }

    // 文字列 / テンプレートリテラル。中身は保つので読み飛ばすだけ
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let j = i + 1;
      while (j < n) {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === quote) break;
        // テンプレートリテラルの ${...} は入れ子になりうるが、
        // 走査の目的(データに実在情報が無いこと)には読み飛ばしで足りる
        j++;
      }
      i = Math.min(j + 1, n);
      continue;
    }

    i++;
  }

  return out.join("");
}
