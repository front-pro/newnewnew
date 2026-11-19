"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { card } from "./styles";

type AuditRow = { id: string; actorId: string | null; action: string; resourceType: string; resourceId: string | null; createdAt: string; metadata: Record<string, unknown> };

export default function CompanyAuditPage({ workspaceId }: { workspaceId: string }) {
  const { tr, locale } = useLanguage();
  const [rows, setRows] = useState<AuditRow[]>([]), [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(workspaceId)}/audit?limit=100`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Аудит журналын жүктеу мүмкін болмады"));
      setRows(data); setError("");
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : tr("Қате шықты")); });
    return () => controller.abort();
  }, [workspaceId, tr]);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className={`${card} space-y-4`}><header><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h1 className="mt-1 text-3xl font-bold">{tr("Аудит журналы")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Компаниядағы маңызды әрекеттердің тарихы")}</p></header>{error ? <p role="alert" className="text-sm text-rose-600">{tr(error)}</p> : <ul className="divide-y divide-slate-100">{rows.map(row => <li key={row.id} className="grid gap-1 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto]"><div><b className="font-mono text-xs text-slate-700">{row.action}</b><p className="mt-1 text-xs text-slate-500">{row.resourceType}{row.resourceId ? ` · ${row.resourceId}` : ""} · {row.actorId || tr("Жүйе")}</p></div><time className="text-xs text-slate-400">{date(row.createdAt)}</time></li>)}{!rows.length && <li className="py-8 text-center text-sm text-slate-500">{tr("Әзірге әрекет жоқ")}</li>}</ul>}</section>;
}
