import { diffLines } from "diff";
export type DiffRow = { before: string; after: string; kind: "same" | "added" | "removed" | "changed"; oldLine?: number; newLine?: number };
const lines = (value: string) => value.replace(/\n$/, "").split("\n");
export function compareLines(before: string, after: string): DiffRow[] {
  if (!before && !after) return [];
  const chunks = diffLines(before, after, { timeout: 150 }) || [{ value: before, removed: true, added: false }, { value: after, added: true, removed: false }];
  const rows: DiffRow[] = []; let oldLine = 0, newLine = 0;
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (chunk.removed && chunks[i + 1]?.added) {
      const old = lines(chunk.value), next = lines(chunks[++i].value);
      for (let n = 0; n < Math.max(old.length, next.length); n++) rows.push({ before: old[n] ?? "", after: next[n] ?? "", kind: old[n] !== undefined && next[n] !== undefined ? "changed" : old[n] !== undefined ? "removed" : "added", oldLine: old[n] !== undefined ? ++oldLine : undefined, newLine: next[n] !== undefined ? ++newLine : undefined });
    } else for (const line of lines(chunk.value)) rows.push({ before: chunk.added ? "" : line, after: chunk.removed ? "" : line, kind: chunk.added ? "added" : chunk.removed ? "removed" : "same", oldLine: chunk.added ? undefined : ++oldLine, newLine: chunk.removed ? undefined : ++newLine });
  }
  return rows;
}
