"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function ComparePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { a, setA, b, setB, report, startAnalysis, handleFile, exportReport } = props;
  const inputs = [
    { key: "before", title: "Құжат A (Редакция «Дейін») ", value: a, setValue: setA },
    { key: "after", title: "Құжат B (Редакция «Кейін») ", value: b, setValue: setB },
  ];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><h1 className="text-3xl font-bold">{tr("Құжаттарды семантикалық салыстыру")}</h1><p className="mt-1 text-slate-500">{tr("«Дейін» және «Кейін» редакцияларын талдау")}</p></div>
      <button onClick={startAnalysis} className={`${button} bg-blue-600 px-5 py-3 text-white shadow-sm hover:bg-blue-700`}>⚡ {tr("Талдауды іске қосу")}</button>
    </header>

    <div className="grid gap-6 md:grid-cols-2">{inputs.map(input => <section key={input.key} className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{tr(input.title)}</h2><label className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">📎 {tr("Мәтіндік файлды таңдау")}<input className="hidden" type="file" accept=".txt,.md,.csv,.tsv,.json,.xml,.html,.log,.text" onChange={handleFile(input.setValue)} /></label></div>
      <p className="text-xs text-slate-400">{tr("Қолдайды: TXT, MD, CSV, TSV, JSON, XML және HTML.")}</p>
      <textarea value={input.value} onChange={event => input.setValue(event.target.value)} className="h-64 w-full resize-y rounded-xl border border-slate-200 p-4 font-mono text-sm outline-none focus:border-blue-500" />
    </section>)}</div>

    {report && <section className={`${card} space-y-5`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-bold">{tr("Талдау қорытындысы")}</h2><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{tr(report.isSaved ? "Сақталды" : "Уақытша")}</span></div><p className="mt-1 text-slate-600">{report.summary}</p></div>{report.isSaved && <button onClick={exportReport} className={`${button} border border-slate-200 bg-white text-slate-700`}>📥 {tr("Экспорттау CSV")}</button>}</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Барлық өзгерістер", report.metrics.total], ["Қақтығыстар", report.metrics.conflicts], ["Жоғалған функциялар", report.metrics.lost], ["Жаңа / өзгерген", report.metrics.news + report.metrics.changed]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm text-slate-500">{tr(String(label))}</div><div className="mt-1 font-mono text-3xl font-bold">{value}</div></div>)}</div>
      <div className="space-y-3"><h3 className="font-semibold">{tr("Өзгерістер")}</h3>{report.changes.length ? report.changes.map((change, index) => <article key={`${change.type}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-violet-50 px-2 py-1 font-mono text-xs text-violet-700">{change.type}</span><b>{tr(change.title)}</b></div><p className="mt-2 text-sm text-slate-600">{tr(change.description)}</p><p className="mt-2 font-mono text-xs text-slate-500">📍 A: {change.a} ➔ 📍 B: {change.b}</p></article>) : <p className="text-sm text-slate-500">{tr("Айырмашылық табылмады.")}</p>}</div>
    </section>}
  </div>;
}
