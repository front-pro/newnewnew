"use client";

import { useEffect, useMemo, useState } from "react";
import { getDocumentDeadlineStatus, type DocumentSummary } from "../lib/documents";
import { useLanguage } from "./LanguageProvider";
import Icon from "./Icon";
import Skeleton from "./Skeleton";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

type ApprovalRow = { status?: string; step?: { decision?: string }; document?: { workspaceId?: string } };
type Module = "documents" | "analysis" | "templates" | "team" | "processes";

export default function CompanyOverview({ workspaceId, companyName, props, onNavigate }: {
  workspaceId: string;
  companyName: string;
  props: WorkspaceProps;
  onNavigate: (module: Module) => void;
}) {
  const { tr, locale } = useLanguage();
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store", signal: controller.signal }).then(async response => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || tr("Құжаттарды жүктеу мүмкін болмады."));
        return Array.isArray(data) ? data as DocumentSummary[] : [];
      }),
      fetch(`/api/approvals?workspaceId=${encodeURIComponent(workspaceId)}`, { cache: "no-store", signal: controller.signal }).then(async response => response.ok ? response.json() as Promise<ApprovalRow[]> : []),
    ]).then(([rows, approvals]) => {
      if (controller.signal.aborted) return;
      setDocuments(rows);
      setPendingApprovals(approvals.filter(item => item.status === "pending" && item.step?.decision === "pending" && item.document?.workspaceId === workspaceId).length);
      setError("");
    }).catch(cause => {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Қате шықты"));
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [workspaceId, tr]);

  const dueDocuments = useMemo(() => documents
    .filter(document => {
      const status = getDocumentDeadlineStatus(document.dueDate);
      return status === "overdue" || status === "today" || status === "soon";
    })
    .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || "")), [documents]);
  const recentDocuments = useMemo(() => [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5), [documents]);
  const totalVersions = documents.reduce((total, document) => total + document.versionCount, 0);
  const date = (value?: string) => value ? new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${value.slice(0, 10)}T12:00:00`)) : tr("Күні белгісіз");

  async function openDocument(id: string) {
    try {
      const response = await fetch(`/api/documents/${encodeURIComponent(id)}`, { cache: "no-store" });
      const detail = await response.json();
      if (!response.ok) throw new Error(detail.error || tr("Құжатты ашу мүмкін болмады."));
      props.openDocument(detail);
    } catch (cause) {
      props.setNotice(cause instanceof Error ? tr(cause.message) : tr("Қате шықты"));
    }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-blue-600">KT · {tr("Әкімші шолуы")}</p>
        <h1 className="text-3xl font-bold tracking-tight">{companyName}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{tr("Құжаттардың күйін, мерзімдерін және командаға қажет әрекеттерді бір жерден бақылаңыз.")}</p>
      </div>
      <button onClick={() => props.newDocument(workspaceId)} className={`${button} gap-2 bg-blue-600 text-white`}><Icon name="plus"/>{tr("Жаңа құжат")}</button>
    </header>

    {loading ? <Skeleton rows={1}/> : error ? <p role="alert" className={`${card} border-rose-200 text-rose-700`}>{tr(error)}</p> : <>
      <section aria-label={tr("Компания көрсеткіштері")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Қолжетімді құжаттар", documents.length, "file", "bg-blue-50 text-blue-700"],
          ["Сақталған нұсқалар", totalVersions, "history", "bg-violet-50 text-violet-700"],
          ["Маған бекітуге келген", pendingApprovals, "check", "bg-amber-50 text-amber-700"],
          ["Мерзімі жақын құжаттар", dueDocuments.length, "shield", dueDocuments.length ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"],
        ].map(([label, value, icon, tone]) => <div key={String(label)} className={`${card} flex items-center justify-between gap-3 p-4`}>
          <div><p className="text-xs text-slate-500">{tr(String(label))}</p><p className="mt-1 text-3xl font-bold tabular-nums">{value}</p></div>
          <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon name={String(icon) as "file" | "history" | "check" | "shield"}/></span>
        </div>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.8fr)]">
        <div className={card}>
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="font-semibold">{tr("Жуырдағы құжаттар")}</h2><p className="mt-1 text-xs text-slate-500">{tr("Соңғы өзгерген құжаттар")}</p></div><button onClick={() => onNavigate("documents")} className="text-sm font-semibold text-blue-700 hover:underline">{tr("Барлығын көру")}</button></div>
          <ul className="divide-y divide-slate-100">
            {recentDocuments.map(document => <li key={document.id}>
              <button onClick={() => void openDocument(document.id)} className="flex w-full items-center gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon name="file"/></span>
                <span className="min-w-0 flex-1"><b className="block truncate text-sm">{document.title}</b><span className="text-xs text-slate-500">v{document.version} · {tr("Жаңартылды")}: {date(document.updatedAt)}</span></span>
                <Icon name="arrow" className="size-4 shrink-0 text-slate-400"/>
              </button>
            </li>)}
            {!recentDocuments.length && <li className="py-10 text-center"><p className="font-medium">{tr("Құжаттар әлі жоқ")}</p><p className="mt-1 text-sm text-slate-500">{tr("Бірінші құжатты қосып, компания кітапханасын бастаңыз.")}</p></li>}
          </ul>
        </div>

        <div className={card}>
          <div className="mb-3"><h2 className="font-semibold">{tr("Шұғыл назар")}</h2><p className="mt-1 text-xs text-slate-500">{tr("Мерзімі жақындаған құжаттар")}</p></div>
          <ul className="divide-y divide-slate-100">
            {dueDocuments.slice(0, 6).map(document => {
              const status = getDocumentDeadlineStatus(document.dueDate);
              const urgent = status === "overdue" || status === "today";
              return <li key={document.id}>
                <button onClick={() => void openDocument(document.id)} className="flex w-full items-center justify-between gap-3 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
                  <span className="min-w-0"><b className="block truncate text-sm">{document.title}</b><span className={`mt-1 block text-xs ${urgent ? "font-semibold text-rose-700" : "text-amber-700"}`}>{tr(status === "overdue" ? "Мерзімі өтіп кеткен" : status === "today" ? "Бүгін аяқталады" : "Жақында аяқталады")} · {date(document.dueDate)}</span></span>
                  <Icon name="arrow" className="size-4 shrink-0 text-slate-400"/>
                </button>
              </li>;
            })}
            {!dueDocuments.length && <li className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">{tr("Мерзімі жақын құжаттар жоқ. Бәрі бақылауда.")}</li>}
          </ul>
        </div>
      </section>

      <section aria-label={tr("Жылдам әрекеттер")} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([["documents", "Құжаттар тізілімі", "file"], ["processes", "Келісу және тапсырмалар", "check"], ["team", "Қызметкерлер", "users"], ["analysis", "Құжаттарды салыстыру", "compare"]] as const).map(([module, label, icon]) => <button key={module} onClick={() => onNavigate(module)} className={`${card} flex items-center gap-3 text-left transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600`}><Icon name={icon} className="size-5 text-blue-700"/><span className="flex-1 text-sm font-semibold">{tr(label)}</span><Icon name="arrow" className="size-4 text-slate-400"/></button>)}
      </section>
    </>}
  </div>;
}
