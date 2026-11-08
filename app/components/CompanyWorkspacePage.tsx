"use client";
import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
import DocumentsPage from "./DocumentsPage";
import CompaniesPage from "./CompaniesPage";

type Module = "documents" | "analysis" | "templates" | "team" | "processes";
export default function CompanyWorkspacePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const [module, setModule] = useState<Module>("documents");
  const company = props.workspaces.find(item => item.id === props.activeWorkspaceId);
  const modules: [Module, string, string][] = [
    ["documents", "Құжаттар тізілімі", "▤"],
    ["analysis", "Құжаттарды салыстыру", "⇄"],
    ["templates", "Құжат үлгілері", "▧"],
    ["team", "Қызметкерлер", "♙"],
    ["processes", "Келісу және тапсырмалар", "⇢"],
  ];
  const activeLabel = modules.find(([id]) => id === module)?.[1] || "Құжаттар тізілімі";
  return <div className="-mx-4 -my-7 min-h-[calc(100vh-70px)] bg-slate-100 md:-mx-8">
    <div className="grid min-h-[calc(100vh-70px)] lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-r border-slate-200 bg-slate-900 p-4 text-slate-100">
        <div className="mb-6 border-b border-slate-700 px-2 pb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">KT · WORKSPACE</p><h1 className="mt-2 truncate text-lg font-bold" title={company?.name}>{company?.name || tr("Компания")}</h1><span className="mt-1 inline-flex rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{tr(company?.role === "admin" ? "Компания әкімшісі" : "Компания мүшесі")}</span></div>
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{tr("МОДУЛЬДЕР")}</p>
        <nav aria-label={tr("Компания бөлімдері")} className="space-y-1">{modules.map(([id, label, icon]) => <button key={id} onClick={() => setModule(id)} aria-current={module === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${module === id ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><span aria-hidden="true" className="w-5 text-center text-lg">{icon}</span>{tr(label)}</button>)}</nav>
        <div className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-400">{tr("Компанияның жұмыс кеңістігі")}</div>
      </aside>
      <section className="min-w-0">
        <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 md:px-8"><div className="text-xs text-slate-500">{company?.name} <span className="mx-2">/</span> <span className="font-semibold text-slate-800">{tr(activeLabel)}</span></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{tr("Компания режимі")}</span></header>
        <main className="p-4 md:p-7">
          {module === "documents" && <DocumentsPage key={`company-${company?.id}`} props={props} workspaceScope={company?.id || null} />}
          {module === "team" && company && <CompaniesPage fixedWorkspaceId={company.id} setNotice={props.setNotice} />}
          {module === "templates" && <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Құжат үлгілері")}</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.cards}</div>{["employee", "admin"].includes(props.sessionUser?.role || "") && <form onSubmit={props.createTemplate} className={`${card} space-y-3`}><h3 className="font-semibold">{tr("Жаңа үлгі қосу")}</h3><div className="grid gap-3 md:grid-cols-3"><input required minLength={3} value={props.templateTitle} onChange={event => props.setTemplateTitle(event.target.value)} placeholder={tr("Атауы")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><input value={props.templateDesc} onChange={event => props.setTemplateDesc(event.target.value)} placeholder={tr("Қысқаша сипаттама")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={props.templateAccess} onChange={event => props.setTemplateAccess(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="public">{tr("Жалпы")}</option><option value="employee">{tr("Тек қызметкерлерге")}</option></select></div><textarea required value={props.templateBody} onChange={event => props.setTemplateBody(event.target.value)} placeholder={tr("Үлгі мәтіні...")} className="h-32 w-full rounded-xl border border-slate-200 p-3 text-sm"/><button className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні серверге сақтау")}</button></form>}</div>}
          {module === "analysis" && <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Құжаттарды салыстыру")}</h2></div><button onClick={props.startAnalysis} className={`${button} bg-blue-600 text-white`}>{tr("Талдауды іске қосу")}</button></div><div className="grid gap-4 xl:grid-cols-2">{([["A · " + tr("Алдыңғы редакция"), props.a, props.setA], ["B · " + tr("Жаңа редакция"), props.b, props.setB]] as const).map(([label, value, setValue]) => <label key={label} className={`${card} block space-y-2`}><span className="font-semibold">{label}</span><textarea value={value} onChange={event => setValue(event.target.value)} className="h-72 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm"/></label>)}</div>{props.report && <section className={`${card} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">{tr("Талдау қорытындысы")}</h3><p className="text-sm text-slate-500">{props.report.summary}</p></div>{props.report.isSaved && <button onClick={props.exportReport} className={button}>{tr("Экспорттау CSV")}</button>}</div>{props.report.changes.map(change => <article key={`${change.type}-${change.a}-${change.b}`} className="rounded-xl border border-slate-200 p-3"><b className="text-sm">{change.title}</b><p className="mt-1 text-sm text-slate-600">{change.description}</p><p className="mt-1 font-mono text-xs text-slate-400">A: {change.a} → B: {change.b}</p></article>)}</section>}</div>}
          {module === "processes" && <section className={`${card} max-w-3xl space-y-4`}><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Келісу және тапсырмалар")}</h2></div><p className="text-sm leading-6 text-slate-600">{tr("Құжат келісу маршруты, жауаптылар және мерзімдер осы интерфейсте көрсетіледі. Бұл модуль әзірге іске қосылмаған.")}</p><button onClick={() => setModule("documents")} className={`${button} bg-blue-600 text-white`}>{tr("Құжаттар тізіліміне өту")}</button></section>}
        </main>
      </section>
    </div>
  </div>;
}
