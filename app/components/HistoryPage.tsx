"use client";

import { useState } from "react";
import { matchesSearch } from "../lib/search";
import { useLanguage } from "./LanguageProvider";
import SearchField from "./SearchField";
import { card } from "./styles";
import type { HistoryRow } from "./workspace-context";

export default function HistoryPage({ history }: { history: HistoryRow[] }) {
  const { tr, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const title = (row: HistoryRow) => row.type === "ЖИ талдауы" && /^Салыстыру #\d+$/.test(row.title) ? tr("Салыстыру #{id}", { id: row.title.split("#")[1] }) : tr(row.title);
  const metadata = (meta: string) => meta.split(" · ").map(part => {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(part)) {
      return new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(`${part.replace(" ", "T")}:00Z`));
    }
    const changes = part.match(/^(\d+) өзгеріс анықталды$/);
    return changes ? tr("{count} өзгеріс анықталды", { count: changes[1] }) : tr(part);
  }).join(" · ");
  const filtered = history.filter(row => matchesSearch(query, [row.title, title(row), row.type, tr(row.type), row.meta, metadata(row.meta)], locale));
  return <>
    <div className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Әрекеттер тарихы")}</h1><p className="mt-1 text-slate-500">{tr("Сақталған талдаулар мен құжаттар журналы")}</p></div>
    <SearchField value={query} onChange={setQuery} label={tr("Тарихтан іздеу")} placeholder={tr("Атауы, әрекет түрі немесе күні бойынша іздеу…")} count={filtered.length} total={history.length} />
    <section className={`${card} divide-y divide-slate-100`} aria-label={tr("Әрекеттер тізімі")}>
      {filtered.length ? <ul className="divide-y divide-slate-100">{filtered.map((row, i) => <li key={i} className="space-y-1 py-4 first:pt-0 last:pb-0"><p className="break-words text-sm font-semibold">{title(row)}</p><p className="break-words text-xs text-slate-500">{tr(row.type)} · {metadata(row.meta)}</p></li>)}</ul> : <div className="p-6 text-center text-sm text-slate-500">{tr(query.trim() ? "Тарихтан ештеңе табылмады. Іздеу сөзін өзгертіңіз." : "Тарих бос. Талдауды іске қосыңыз немесе құжат сақтаңыз.")}</div>}
    </section>
  </>;
}
