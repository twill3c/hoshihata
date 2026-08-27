import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: { globals: true, include: ["tests/**/*.test.ts"] },
  // tsconfig の jsx は Next.js のために "preserve" にしてあるので、
  // テストから部品を描画するときは esbuild 側で JSX を変換する
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
