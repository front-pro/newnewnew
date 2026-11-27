"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function ComparePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoLoaded, setDemoLoaded] = useState(false);
  const { a, setA, b, setB, report, startAnalysis, handleFile, exportReport } = props;
  useEffect(() => { if (demoLoaded && report && !props.analysisBusy) setDemoOpen(true); }, [demoLoaded, report, props.analysisBusy]);
  const inputs = [
    { key: "before", title: "Құжат A (Редакция «Дейін») ", value: a, setValue: setA },
    { key: "after", title: "Құжат B (Редакция «Кейін») ", value: b, setValue: setB },
  ];
  function loadDemo() {
    setA("Қызмет көрсету шарты\n1. Қызмет мерзімі: 12 ай.\n2. Төлем: ай сайын, 100 000 теңге.\n3. Кешігу айыбы: 0,1%.");
    setB("Қызмет көрсету шарты\n1. Қызмет мерзімі: 18 ай.\n2. Төлем: ай сайын, 120 000 теңге.\n3. Кешігу айыбы: 0,5%.\n4. Шартты бұзу туралы 30 күн бұрын хабарлау қажет.");
    setDemoLoaded(true);
    setDemoOpen(true);
  }

  return <div className="space-y-6">
    {demoOpen && <aside className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-950"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{tr("Бір минуттық таныстыру")}</h2><ol className="mt-2 list-inside list-decimal space-y-1 text-blue-900"><li>{tr(demoLoaded ? "Мысал мәтіндері A және B жолына жүктелді." : "A және B нұсқаларын салыстырыңыз.")}</li><li>{tr(report && demoLoaded ? "Өзгерістерді қарап, дәлел мәтіндерін тексеріңіз." : "Талдауды іске қосып айырмашылықтарды көріңіз.")}</li><li>{tr("Өзгерістерді қабылдап не қабылдамай, соңында есепті экспорттаңыз.")}</li></ol></div><button onClick={() => setDemoOpen(false)} className="rounded-lg px-2 py-1 text-blue-700 hover:bg-blue-100">{tr("Жабу")}</button></div></aside>}
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><h1 className="text-3xl font-bold">{tr("Құжаттарды семантикалық салыстыру")}</h1><p className="mt-1 text-slate-500">{tr("«Дейін» және «Кейін» редакцияларын талдау")}</p></div>
      <div className="flex flex-wrap gap-2"><button disabled={props.analysisBusy} onClick={() => startAnalysis(false)} className={`${button} bg-blue-600 px-4 py-3 text-white shadow-sm hover:bg-blue-700 disabled:opacity-60`}>{props.analysisBusy ? tr("Талдау орындалуда…") : "⚡ " + tr("Талдауды іске қосу")}</button><button disabled={props.analysisBusy} onClick={loadDemo} className={`${button} border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800`}>{tr("Демо деректерін жүктеу")}</button><button disabled={props.analysisBusy} title={props.sessionUser ? tr("ИИ талдауы кезінде A және B мәтіні OpenAI API-ге талдау үшін жіберіледі.") : tr("ИИ агентпен жұмыс істеу үшін аккаунтқа кіріңіз.")} onClick={() => props.sessionUser ? startAnalysis(true) : props.setAuthMode("login")} className={`${button} gap-2 border border-violet-200 bg-violet-50 px-4 py-3 text-violet-800 disabled:opacity-60`}>✦ {tr("ИИ агентпен толық талдау")}</button><p className="basis-full text-xs text-slate-500">{tr("Демо мәтін тек осы салыстыруға жүктеледі, құжаттар тізіміне сақталмайды.")}</p><p className="basis-full text-xs text-slate-500">{props.sessionUser ? tr("ИИ талдауы кезінде A және B мәтіні OpenAI API-ге талдау үшін жіберіледі.") : tr("ИИ агентпен жұмыс істеу үшін аккаунтқа кіріңіз.")}</p></div>
    </header>

    <div className="grid gap-6 md:grid-cols-2">{inputs.map(input => <section key={input.key} className={`${card} space-y-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">{tr(input.title)}</h2><label className="cursor-pointer text-sm font-medium text-blue-600 hover:underline">📎 {tr("Құжатты жүктеу")}<input className="hidden" type="file" accept=".pdf,.docx,.xlsx,.ods,.pptx,.odt,.odp,.rtf,.txt,.md,.csv,.tsv,.json,.xml,.html,.log,.text,.png,.jpg,.jpeg" onChange={handleFile(input.setValue)} /></label></div>
      <p className="text-xs text-slate-400">{tr("PDF, DOCX, XLSX, PPTX, ODT, ODS, CSV, TSV және мәтіндік файлдар.")}</p>
      <textarea value={input.value} onChange={event => input.setValue(event.target.value)} className="h-64 w-full resize-y rounded-xl border border-slate-200 p-4 font-mono text-sm outline-none focus:border-blue-500" />
    </section>)}</div>

    {report && <section className={`${card} space-y-5`}>{report.aiAnalysisError && <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{tr(report.aiAnalysisError)}</p>}{report.aiAnalysis && <div className="rounded-xl border border-violet-200 bg-violet-50/70 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold text-violet-900">{tr("ИИ қорытындысы")}</h3><span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-violet-800">{tr("Жалпы тәуекел")}: {tr(report.aiAnalysis.overallRisk === "high" ? "Жоғары" : report.aiAnalysis.overallRisk === "medium" ? "Орташа" : "Төмен")}</span></div><p className="mt-2 text-sm text-slate-700">{report.aiAnalysis.summary}</p></div>}
      <div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex items-center gap-2"><h2 className="text-2xl font-bold">{tr("Талдау қорытындысы")}</h2><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{tr(report.isSaved ? "Сақталды" : "Уақытша")}</span></div><p className="mt-1 text-slate-600">{report.summary}</p></div>{report.isSaved && <button onClick={exportReport} className={`${button} border border-slate-200 bg-white text-slate-700`}>📥 {tr("Экспорттау CSV")}</button>}</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">{[["Барлық өзгерістер", report.metrics.total], ["Қақтығыстар", report.metrics.conflicts], ["Жоғалған функциялар", report.metrics.lost], ["Жаңа / өзгерген", report.metrics.news + report.metrics.changed]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="text-sm text-slate-500">{tr(String(label))}</div><div className="mt-1 font-mono text-3xl font-bold">{value}</div></div>)}</div>
      <div className="space-y-3"><h3 className="font-semibold">{tr("Өзгерістер")}</h3>{report.changes.length ? report.changes.map((change, index) => <article key={`${change.type}-${index}`} className="rounded-xl border border-slate-200 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-violet-50 px-2 py-1 font-mono text-xs text-violet-700">{change.type}</span><b>{tr(change.title)}</b></div><p className="mt-2 text-sm text-slate-600">{tr(change.description)}</p><p className="mt-2 font-mono text-xs text-slate-500">📍 A: {change.a} ➔ 📍 B: {change.b}</p>{report.aiAnalysis?.findings.find(item => item.changeId === change.id) && (() => { const insight = report.aiAnalysis!.findings.find(item => item.changeId === change.id)!; return <div className="mt-3 rounded-lg bg-violet-50 p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><b>{tr("ИИ түсіндірмесі")}</b><span className="rounded-full bg-white px-2 py-1 text-xs">{tr("Тәуекел")}: {tr(insight.severity === "high" ? "Жоғары" : insight.severity === "medium" ? "Орташа" : "Төмен")}</span></div><p className="mt-2"><b>{tr("Не өзгерді")}: </b>{insight.whatChanged}</p><p className="mt-1"><b>{tr("Ықпалы")}: </b>{insight.impact}</p><p className="mt-1"><b>{tr("Ұсыныс")}: </b>{insight.recommendation}</p></div>; })()}</article>) : <p className="text-sm text-slate-500">{tr("Айырмашылық табылмады.")}</p>}</div>
    </section>}
  </div>;
}
