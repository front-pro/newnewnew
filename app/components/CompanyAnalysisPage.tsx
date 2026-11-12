"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function CompanyAnalysisPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  return <div className="space-y-5"><header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h1 className="mt-1 text-3xl font-bold">{tr("Құжаттарды салыстыру")}</h1></div><button onClick={props.startAnalysis} className={`${button} bg-blue-600 text-white`}>{tr("Талдауды іске қосу")}</button></header><div className="grid gap-4 xl:grid-cols-2">{([ ["A · " + tr("Алдыңғы редакция"), props.a, props.setA], ["B · " + tr("Жаңа редакция"), props.b, props.setB] ] as const).map(([label, value, setValue]) => <label key={label} className={`${card} block space-y-2`}><span className="font-semibold">{label}</span><textarea aria-label={label} value={value} onChange={event => setValue(event.target.value)} className="h-72 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm"/></label>)}</div>{props.report && <section className={`${card} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-bold">{tr("Талдау қорытындысы")}</h2><p className="text-sm text-slate-500">{props.report.summary}</p></div>{props.report.isSaved && <button onClick={props.exportReport} className={button}>{tr("Экспорттау CSV")}</button>}</div>{props.report.changes.map((change, index) => <article key={`${change.type}-${index}`} className="rounded-xl border border-slate-200 p-3"><b className="text-sm">{tr(change.title)}</b><p className="mt-1 text-sm text-slate-600">{tr(change.description)}</p><p className="mt-1 font-mono text-xs text-slate-400">A: {change.a} → B: {change.b}</p></article>)}</section>}</div>;
}
