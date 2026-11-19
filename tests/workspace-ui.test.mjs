import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";
const exports = {};
new Function("require", "exports", ts.transpileModule(await readFile(new URL("../app/lib/diff.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(createRequire(import.meta.url), exports);
const { compareLines } = exports;
test("line comparison aligns replacements and preserves both sources", () => {
  const before = "1. First\n2. Old clause\n3. Last\n", after = "1. First\n2. New clause\n3. Last\n4. Added\n";
  const rows = compareLines(before, after);
  assert.equal(rows[1].kind, "changed"); assert.equal(rows[1].oldLine, 2); assert.equal(rows[1].newLine, 2); assert.equal(rows.at(-1).kind, "added");
  assert.equal(rows.filter(r => r.oldLine).map(r => r.before).join("\n") + "\n", before);
  assert.equal(rows.filter(r => r.newLine).map(r => r.after).join("\n") + "\n", after);
});
test("line comparison handles empty text, deletion and literal markup", () => {
  assert.deepEqual(compareLines("", ""), []);
  assert.equal(compareLines("", "only new")[0].kind, "added");
  assert.equal(compareLines("only old", "")[0].kind, "removed");
  assert.equal(compareLines("<script>source</script>", "<script>source</script>")[0].before, "<script>source</script>");
});
