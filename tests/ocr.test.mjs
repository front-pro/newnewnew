import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { test } from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
let create;
const exports = {};
new Function("require", "exports", ts.transpileModule(await readFile(new URL("../app/lib/ocr.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText)(name => name === "tesseract.js" ? { OEM: { LSTM_ONLY: 1 }, createWorker: (...args) => create(...args) } : require(name), exports);
const { recognizeScannedPages } = exports;

test("OCR rejects overlapping work, terminates failed workers and permits the next import", async () => {
  let release, terminated = 0;
  const ready = new Promise(resolve => { release = resolve; });
  create = async () => {
    await ready;
    return { setParameters: async () => {}, recognize: async () => { throw new Error("invalid image"); }, terminate: async () => { terminated++; } };
  };
  const job = recognizeScannedPages([1], async () => new Uint8Array([1]));
  await assert.rejects(recognizeScannedPages([1], async () => new Uint8Array()), error => error.status === 429);
  release();
  await assert.rejects(job, error => error.status === 422);
  assert.equal(terminated, 1);
  create = async () => ({ setParameters: async () => {}, recognize: async () => ({ data: { text: "Recovery text" } }), terminate: async () => { terminated++; } });
  assert.equal((await recognizeScannedPages([2], async () => new Uint8Array([1]))).get(2), "Recovery text");
  assert.equal(terminated, 2);
});

test("cancelling worker startup terminates it once ready and releases the OCR slot", async () => {
  let release, terminated = 0;
  create = () => new Promise(resolve => { release = () => resolve({ terminate: async () => { terminated++; } }); });
  const controller = new AbortController();
  const job = recognizeScannedPages([1], async () => new Uint8Array(), controller.signal);
  controller.abort();
  await assert.rejects(job, error => error.status === 408);
  release();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(terminated, 1);
  const aborted = AbortSignal.abort();
  await assert.rejects(recognizeScannedPages([1], async () => new Uint8Array(), aborted), error => error.status === 408);
  await assert.rejects(recognizeScannedPages(Array.from({ length: 11 }, (_, i) => i + 1), async () => new Uint8Array()), error => error.status === 413);
  assert.equal(globalThis.ktOcrActive, false);
});
