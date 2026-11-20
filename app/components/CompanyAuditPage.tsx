"use client";

import { useEffect, useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { card } from "./styles";

type AuditRow = { id: string; actorId: string | null; action: string; resourceType: string; resourceId: string | null; createdAt: string; metadata: Record<string, unknown> };

export default function CompanyAuditPage({ workspaceId }: { workspaceId: string }) {
  const { tr, locale } = useLanguage();
  const [rows, setRows] = useState<AuditRow[]>([]), [error, setError] = useState(""), [query, setQuery] = useState(""), [action, setAction] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/audit?limit=100`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Аудит журналын жүктеу мүмкін болмады"));
      setRows(data); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Қате шықты")); });
    return () => controller.abort();
  }, [workspaceId, tr]);
  const actions = useMemo(() => [...new Set(rows.map(row => row.action))].sort(), [rows]);
  const visibleRows = useMemo(() => rows.filter(row => {
    if (action !== "all" && row.action !== action) return false;
    const text = `${row.action} ${row.actorId || ""} ${row.resourceType} ${row.resourceId || ""} ${JSON.stringify(row.metadata)}`.toLocaleLowerCase();
    return text.includes(query.trim().toLocaleLowerCase());
  }), [rows, action, query]);
  function exportCsv() {
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [ ["Дата", "Действие", "Пользователь", "Тип ресурса", "ID ресурса", "Метаданные"], ...visibleRows.map(row => [row.createdAt, row.action, row.actorId || "", row.resourceType, row.resourceId || "", JSON.stringify(row.metadata)]) ].map(line => line.map(quote).join(",")).join("\r\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a"); link.href = url; link.download = "company-audit.csv"; link.click(); URL.revokeObjectURL(url);
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className={`${card} space-y-4`}><header><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h1 className="mt-1 text-3xl font-bold">{tr("Аудит журналы")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Компаниядағы маңызды әрекеттердің тарихы")}</p></header><div className="flex flex-wrap gap-2"><input aria-label={tr("Аудиттен іздеу")} value={query} onChange={event=>setQuery(event.target.value)} placeholder={tr("Әрекет, адам немесе құжат бойынша іздеу")} className="min-w-56 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select aria-label={tr("Әрекет бойынша сүзу")} value={action} onChange={event=>setAction(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="all">{tr("Барлық әрекеттер")}</option>{actions.map(item=><option key={item}>{item}</option>)}</select><button onClick={exportCsv} disabled={!visibleRows.length} className="rounded-xl border border-slate-200 px-3 py-2 text-sm disabled:opacity-50">CSV</button></div>{error ? <p role="alert" className="text-sm text-rose-600">{tr(error)}</p> : <ul className="divide-y divide-slate-100">{visibleRows.map(row => <li key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"><div><b className="font-mono text-xs text-slate-700">{row.action}</b><p className="mt-1 text-xs text-slate-500">{row.resourceType}{row.resourceId ? ` · ${row.resourceId}` : ""} · {row.actorId || tr("Жүйе")}</p></div><time className="text-xs text-slate-400">{date(row.createdAt)}</time></li>)}{!visibleRows.length && <li className="py-8 text-center text-sm text-slate-500">{tr("Әрекеттер табылмады")}</li>}</ul>}</section>;
}
