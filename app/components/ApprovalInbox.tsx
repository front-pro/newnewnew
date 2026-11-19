"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

type Approval = { id: string; version: number; status: "pending" | "approved" | "rejected" | "stale" | "superseded"; requestedAt: string; step: { decision: string; reason?: string }; document: { id: string; title: string; workspaceId?: string; text: string } };
export default function ApprovalInbox({ setNotice }: Pick<WorkspaceProps, "setNotice">) {
  const { tr, locale } = useLanguage();
  const [flows, setFlows] = useState<Approval[]>([]), [busy, setBusy] = useState(""), [reasons, setReasons] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const response = await fetch("/api/approvals", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || tr("Бекітулерді жүктеу мүмкін болмады."));
    setFlows(data);
  }, [tr]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/approvals", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Бекітулерді жүктеу мүмкін болмады."));
      if (!controller.signal.aborted) setFlows(data);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); });
    return () => controller.abort();
  }, [setNotice, tr]);
  async function decide(flow: Approval, decision: "approve" | "reject") {
    setBusy(flow.id);
    try {
      const response = await fetch(`/api/approvals/${encodeURIComponent(flow.id)}/decision`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, reason: reasons[flow.id] || "" }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Шешімді сақтау мүмкін болмады."));
      setNotice(tr(decision === "approve" ? "Құжат бекітілді." : "Құжат қабылданбады."));
      await load();
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); }
    finally { setBusy(""); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className="space-y-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Жұмыс процесі")}</p><h2 className="mt-1 text-3xl font-bold">{tr("Бекіту сұраулары")}</h2><p className="mt-2 text-sm text-slate-500">{tr("Сізге бекітуге жіберілген құжат нұсқалары")}</p></div>{flows.map(flow => <article key={flow.id} className={`${card} space-y-3`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{flow.document.title}</h3><p className="text-xs text-slate-500">v{flow.version} · {date(flow.requestedAt)}</p></div><span className={`rounded-full px-2 py-1 text-xs font-semibold ${flow.status === "pending" ? "bg-amber-50 text-amber-700" : flow.status === "approved" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{tr(flow.status === "pending" ? "Күтуде" : flow.status === "approved" ? "Бекітілді" : flow.status === "rejected" ? "Қабылданбады" : flow.status === "stale" ? "Ескірген нұсқа" : "Ауыстырылған")}</span></div><pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-3 text-xs leading-5">{flow.document.text}</pre>{flow.step.reason && <p className="text-sm text-slate-500">{flow.step.reason}</p>}{flow.status === "pending" && flow.step.decision === "pending" && <><label className="block text-xs text-slate-600">{tr("Шешім себебі (міндетті емес)")}<textarea maxLength={2000} value={reasons[flow.id] || ""} onChange={event => setReasons(current => ({ ...current, [flow.id]: event.target.value }))} className="mt-1 min-h-16 w-full rounded-xl border border-slate-200 p-2 text-sm" /></label><div className="flex flex-wrap gap-2"><button disabled={busy === flow.id} onClick={() => void decide(flow, "approve")} className={`${button} bg-emerald-600 text-white disabled:opacity-50`}>{tr("Бекіту")}</button><button disabled={busy === flow.id} onClick={() => void decide(flow, "reject")} className={`${button} border border-rose-200 bg-white text-rose-700 disabled:opacity-50`}>{tr("Қабылдамау")}</button></div></>}</article>)}{!flows.length && <section className={`${card} py-12 text-center text-sm text-slate-500`}>{tr("Келісімдер жоқ")}</section>}</section>;
}
