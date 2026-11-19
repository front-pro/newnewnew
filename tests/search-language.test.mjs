import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = async file => ts.transpileModule(await readFile(new URL(`../app/lib/${file}.ts`, import.meta.url), "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const messagesUrl = moduleUrl(await source("messages"));
const { messages } = await import(messagesUrl);
const { createTranslator, isLocale, analysisSummary, analysisReference, analysisDescription } = await import(moduleUrl((await source("i18n")).replace('"./messages"', JSON.stringify(messagesUrl))));
const { matchesSearch } = await import(moduleUrl(await source("search")));

test("search ignores case, extra spaces and Unicode presentation differences", () => {
  assert.equal(matchesSearch("  ҚЫЗМЕТТІК   жазба ", ["Қызметтік жазба үлгісі"]), true);
  assert.equal(matchesSearch("ＲＥＰＯＲＴ", ["Report 2026"], "en"), true);
  assert.equal(matchesSearch("СОХРАНЁННЫЙ", ["Сохранённый документ"], "ru"), true);
});

test("search combines title, description, body and history metadata", () => {
  assert.equal(matchesSearch("келісім жалақы", ["Еңбек келісімі", "Кадрлық үлгі", "Жалақы мөлшері"]), true);
  assert.equal(matchesSearch("аудит 2026-11", ["Аудит есебі", "Құжат", "2026-11-06 · v2"]), true);
  assert.equal(matchesSearch("аудит missing", ["Аудит есебі", undefined]), false);
  assert.equal(matchesSearch(" \t\n ", []), true);
});

test("all three locales interpolate values without changing document names", () => {
  assert.equal(createTranslator("kk")("Табылды: {count} / {total}", { count: 2, total: 3 }), "Табылды: 2 / 3");
  assert.equal(createTranslator("ru")("Табылды: {count} / {total}", { count: 2, total: 3 }), "Найдено: 2 / 3");
  assert.equal(createTranslator("en")("Табылды: {count} / {total}", { count: 2, total: 3 }), "Found: 2 / 3");
  const name = "Қазақша есеп <script>.txt";
  assert.equal(createTranslator("en")("{p0} файлы жүктелді", { p0: name }), `File ${name} uploaded`);
  assert.equal(createTranslator("en")("Unrecognized content"), "Unrecognized content");
});

test("every translated message keeps its named placeholders", () => {
  const placeholders = value => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]).sort();
  for (const [key, translations] of Object.entries(messages)) {
    assert.equal(translations.length, 2, key);
    for (const translation of translations) {
      assert.ok(translation.trim(), key);
      assert.deepEqual(placeholders(translation), placeholders(key), key);
    }
  }
});

test("only supported locales are accepted from browser preferences", () => {
  for (const locale of ["kk", "ru", "en"]) assert.equal(isLocale(locale), true);
  for (const locale of [null, undefined, "fr", "EN", "", {}, "<script>"]) assert.equal(isLocale(locale), false);
});

test("generated analysis labels are localized while source excerpts stay intact", () => {
  const tr = createTranslator("en");
  assert.equal(analysisSummary("A құжаты (2 тармақ) мен B құжаты (3 тармақ) салыстырылды: 4 өзгеріс табылды.", tr), "Compared document A (2 clauses) with document B (3 clauses): 4 changes found.");
  assert.equal(analysisReference("3.2-тармақ", tr), "clause 3.2");
  assert.equal(analysisDescription("«Құжат мәтіні» → «Жаңа мәтін» (ұқсастық 62%)", tr), "«Құжат мәтіні» → «Жаңа мәтін» (similarity 62%)");
  assert.equal(analysisSummary("Custom analysis content", tr), "Custom analysis content");
});
