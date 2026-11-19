import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { test } from "node:test";

test("production CSS contains utility layouts, icon sizes and reduced-motion rules", async () => {
  const directory = new URL("../.next/static/", import.meta.url);
  const files = (await readdir(directory, { recursive: true })).filter(file => file.endsWith(".css"));
  assert.ok(files.length, "Run npm run build before this test");
  const css = (await Promise.all(files.map(file => readFile(new URL(file, directory), "utf8")))).join("\n");
  assert.match(css, /\.flex\s*\{\s*display:\s*flex/);
  assert.match(css, /\.size-4\s*\{/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /NotoSans-Regular\.ttf/);
});
