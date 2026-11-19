"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
import DocumentsPage from "./DocumentsPage";
import CompaniesPage from "./CompaniesPage";
import ApprovalInbox from "./ApprovalInbox";

type Module = "documents" | "analysis" | "templates" | "team" | "processes" | "audit";
type AuditRow = { id: string; actorId: string | null; action: string; resourceType: string; resourceId: string | null; createdAt: string; metadata: Record<string, unknown> };
function AuditLog({ workspaceId }: { workspaceId: string }) {
  const { tr, locale } = useLanguage();
  const [rows, setRows] = useState<AuditRow[]>([]), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/audit?limit=100`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Аудит журналын жүктеу мүмкін болмады");
      setRows(data); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Қате шықты")); });
    return () => controller.abort();
  }, [workspaceId, tr]);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className={`${card} space-y-4`}><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Аудит журналы")}</h2><p className="mt-2 text-sm text-slate-500">{tr("Компаниядағы маңызды әрекеттердің тарихы")}</p></div>{error ? <p role="alert" className="text-sm text-rose-600">{tr(error)}</p> : <ul className="divide-y divide-slate-100">{rows.map(row => <li key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"><div><b className="font-mono text-xs text-slate-700">{row.action}</b><p className="mt-1 text-xs text-slate-500">{row.resourceType}{row.resourceId ? ` · ${row.resourceId}` : ""} · {row.actorId || tr("Жүйе")}</p></div><time className="text-xs text-slate-400">{date(row.createdAt)}</time></li>)}{!rows.length && <li className="py-8 text-center text-sm text-slate-500">{tr("Әзірге әрекет жоқ")}</li>}</ul>}</section>;
}
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
    ...(company?.role === "admin" ? [["audit", "Аудит журналы", "◷"] as [Module, string, string]] : []),
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
          {module === "audit" && company?.role === "admin" && <AuditLog workspaceId={company.id} />}
          {module === "templates" && <div className="space-y-5"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Құжат үлгілері")}</h2></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.cards}</div>{["employee", "admin"].includes(props.sessionUser?.role || "") && <form onSubmit={props.createTemplate} className={`${card} space-y-3`}><h3 className="font-semibold">{tr("Жаңа үлгі қосу")}</h3><div className="grid gap-3 md:grid-cols-3"><input required minLength={3} value={props.templateTitle} onChange={event => props.setTemplateTitle(event.target.value)} placeholder={tr("Атауы")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><input value={props.templateDesc} onChange={event => props.setTemplateDesc(event.target.value)} placeholder={tr("Қысқаша сипаттама")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={props.templateAccess} onChange={event => props.setTemplateAccess(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="public">{tr("Жалпы")}</option><option value="employee">{tr("Тек қызметкерлерге")}</option></select></div><textarea required value={props.templateBody} onChange={event => props.setTemplateBody(event.target.value)} placeholder={tr("Үлгі мәтіні...")} className="h-32 w-full rounded-xl border border-slate-200 p-3 text-sm"/><button className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні серверге сақтау")}</button></form>}</div>}
          {module === "analysis" && <div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Құжаттарды салыстыру")}</h2></div><button onClick={props.startAnalysis} className={`${button} bg-blue-600 text-white`}>{tr("Талдауды іске қосу")}</button></div><div className="grid gap-4 xl:grid-cols-2">{([["A · " + tr("Алдыңғы редакция"), props.a, props.setA], ["B · " + tr("Жаңа редакция"), props.b, props.setB]] as const).map(([label, value, setValue]) => <label key={label} className={`${card} block space-y-2`}><span className="font-semibold">{label}</span><textarea value={value} onChange={event => setValue(event.target.value)} className="h-72 w-full rounded-xl border border-slate-200 p-4 font-mono text-sm"/></label>)}</div>{props.report && <section className={`${card} space-y-3`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-xl font-bold">{tr("Талдау қорытындысы")}</h3><p className="text-sm text-slate-500">{props.report.summary}</p></div>{props.report.isSaved && <button onClick={props.exportReport} className={button}>{tr("Экспорттау CSV")}</button>}</div>{props.report.changes.map(change => <article key={`${change.type}-${change.a}-${change.b}`} className="rounded-xl border border-slate-200 p-3"><b className="text-sm">{change.title}</b><p className="mt-1 text-sm text-slate-600">{change.description}</p><p className="mt-1 font-mono text-xs text-slate-400">A: {change.a} → B: {change.b}</p></article>)}</section>}</div>}
          {module === "processes" && <ApprovalInbox setNotice={props.setNotice}/>}
        </main>
      </section>
    </div>
  </div>;
}
