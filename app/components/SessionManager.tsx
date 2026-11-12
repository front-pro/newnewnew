"use client";

import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

type Session = { id: string; createdAt: string; expiresAt: string; userAgent: string; current: boolean };
export default function SessionManager({ setNotice }: Pick<WorkspaceProps, "setNotice">) {
  const { tr, locale } = useLanguage();
  const [sessions, setSessions] = useState<Session[]>([]), [busy, setBusy] = useState(false);
  const refresh = useCallback(async () => {
    const response = await fetch("/api/auth/sessions", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || tr("Сессияларды жүктеу мүмкін болмады."));
    setSessions(data.sessions);
  }, [tr]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/sessions", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Сессияларды жүктеу мүмкін болмады."));
      if (!controller.signal.aborted) setSessions(data.sessions);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); });
    return () => controller.abort();
  }, [setNotice, tr]);
  async function revokeOthers() {
    setBusy(true);
    try {
      const response = await fetch("/api/auth/sessions", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || tr("Сессияларды тоқтату мүмкін болмады."));
      setNotice(tr("Өзге сессиялар тоқтатылды: {count}", { count: data.revoked }));
      await refresh();
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); }
    finally { setBusy(false); }
  }
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  return <section className="mt-6 space-y-3 border-t border-slate-100 pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">{tr("Белсенді сессиялар")}</h2><p className="text-xs text-slate-500">{tr("Кіру құрылғыларын қарап, басқа сессиялардан шығыңыз.")}</p></div><button disabled={busy || !sessions.some(session => !session.current)} onClick={() => void revokeOthers()} className={`${button} border border-slate-200 bg-white disabled:opacity-50`}>{tr("Басқа сессиялардан шығу")}</button></div><ul className="divide-y divide-slate-100">{sessions.map(session => <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><p className="text-sm font-medium">{session.userAgent}</p><p className="text-xs text-slate-500">{tr("Кірген уақыты")}: {date(session.createdAt)} · {tr("Жарамдылық мерзімі")}: {date(session.expiresAt)}</p></div>{session.current && <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">{tr("Осы құрылғы")}</span>}</li>)}{!sessions.length && <li className="py-3 text-sm text-slate-500">{tr("Белсенді сессия жоқ")}</li>}</ul></section>;
}
