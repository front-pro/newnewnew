"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

type Tab = "compare" | "templates" | "editor" | "history" | "users";
type Template = { id: number; title: string; desc: string; body: string; access: string };
type Change = { type: string; title: string; description: string; a: string; b: string };
type Report = { summary: string; metrics: { total: number; conflicts: number; lost: number; news: number; changed: number }; changes: Change[] };


const sampleA = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Құжаттарды қағаз және электронды түрде архивтеуді қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.\n3.2. Ақпараттық жүйелерді әзірлеу ұйымдастырылады.`;
const sampleB = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Жасанды интеллект негізіндегі құжаттарды автоматты талдауды қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру және әзірлеу жүргізіледі.\n3.2. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.`;
const initialTemplates: Template[] = [
  { id: 1, title: "Қызметтік жазба үлгісі", desc: "Ішкі хат алмасуға арналған стандартты формат.", access: "Жалпы · Public", body: `ҚЫЗМЕТТІК ЖАЗБА\n\nКімге: [лауазымы, аты-жөні]\nКімнен: [лауазымы, аты-жөні]\nКүні: [күн.ай.жыл]\n\n1. Мәселенің мәні: [қысқаша сипаттаңыз]\n2. Ұсыныс: [не істеу керек]\n3. Қосымшалар: [құжаттар тізімі]` },
  { id: 2, title: "Еңбек шартына қосымша келісім", desc: "Кадрлық өзгерістерді тіркеуге арналған келісім.", access: "Жалпы · Public", body: `ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ № [нөмірі]\n\n1.1. Осы келісім [күні] жасалған еңбек шартына өзгеріс енгізеді.\n1.2. Қызметкер [лауазымы] қызметіне ауыстырылады.\n2.1. Жалақы мөлшері [сома] теңге болып белгіленеді.\n2.2. Қалған шарттар өзгеріссіз қалады.` },
  { id: 3, title: "Бөлімше ережесі және функциялар матрицасы", desc: "Қайта құрылымдау кезіндегі ішкі департамент регламенті.", access: "Корпоративтік · Employee", body: `[БӨЛІМШЕ АТАУЫ] ТУРАЛЫ ЕРЕЖЕ\n\n1.1. Бөлімше ұйымның құрылымдық бөлімшесі болып табылады.\n1.2. Бөлімше өз қызметінде заңнаманы және ішкі регламентті басшылыққа алады.\n2.1. Құжаттарды автоматты талдауды қамтамасыз ету.\n2.2. Нормативтік құжаттар редакцияларындағы қақтығыстарды анықтау.\n3.1. Құжаттарды архивтеу және сақтау.` },
];
const words = (s: string) => new Set(s.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const similarity = (a: string, b: string) => { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let n = 0; x.forEach(w => { if (y.has(w)) n++; }); return n / (x.size + y.size - n); };
const clauses = (value: string) => value.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(s => { const m = s.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/); return { n: m?.[1] || "", text: m?.[2] || s }; });
const compareDocs = (aText: string, bText: string): Report => {
  const a = clauses(aText), b = clauses(bText), used = new Set<number>(), matched = new Set<number>(), changes: Change[] = [];
 const ref = (c?: { n: string }) => c ? (c.n ? `${c.n}-тармақ` : "жол") : "Жоқ";
  b.forEach((clause, j) => { const i = a.findIndex((old, k) => !used.has(k) && old.text.toLocaleLowerCase().replace(/\s+/g, " ").trim() === clause.text.toLocaleLowerCase().replace(/\s+/g, " ").trim()); if (i >= 0) { used.add(i); matched.add(j); } });
  b.forEach((clause, j) => { if (matched.has(j)) return; let best = -1, score = 0; a.forEach((old, i) => { const s = used.has(i) ? 0 : similarity(old.text, clause.text); if (s > score) { score = s; best = i; } }); if (best >= 0 && score >= .45) { used.add(best); matched.add(j); changes.push({ type: "CHANGED", title: "Өзгертілген тармақ", description: `${a[best].text.slice(0, 100)} → ${clause.text.slice(0, 100)} (${Math.round(score * 100)}%)`, a: ref(a[best]), b: ref(clause) }); } else changes.push({ type: "NEW_CLAUSE", title: "Жаңа тармақ", description: clause.text, a: "Жоқ", b: ref(clause) }); });
  a.forEach((clause, i) => { if (!used.has(i)) changes.push({ type: "LOST_FUNCTION", title: "Жоғалған функция", description: clause.text, a: ref(clause), b: "Жоқ (Жоғалған)" }); });
    for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) if (similarity(b[i].text, b[j].text) >= .6 && b[i].text !== b[j].text) changes.push({ type: "CONFLICT", title: "Қайталанатын функция", description: `Тармақтар ұқсастығы ${Math.round(similarity(b[i].text, b[j].text) * 100)}%`, a: ref(b[i]), b: ref(b[j]) });
  const count = (type: string) => changes.filter(c => c.type === type).length;
  const metrics = { total: changes.length, conflicts: count("CONFLICT"), lost: count("LOST_FUNCTION"), news: count("NEW_CLAUSE"), changed: count("CHANGED") };
  return { summary: `A құжаты (${a.length} тармақ) мен B құжаты (${b.length} тармақ) салыстырылды: ${metrics.total} өзгеріс табылды.`, metrics, changes };
};
