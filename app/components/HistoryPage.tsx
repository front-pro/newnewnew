"use client";

import { useState } from "react";
import { matchesSearch } from "../lib/search";
import { formatHistoryTimestamp, historyTimestamp } from "../lib/history";
import { useLanguage } from "./LanguageProvider";
import Icon from "./Icon";
import HistoryToolbar, { type HistorySortOrder } from "./HistoryToolbar";
import HistoryActivity from "./HistoryActivity";
import type { HistoryRow, WorkspaceProps } from "./workspace-context";

export default function HistoryPage({ props }: { props: WorkspaceProps }) {
  const { history } = props;
  const { tr, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<HistorySortOrder>("newest");
  const [openingKey, setOpeningKey] = useState<string | null>(null);
  const title = (row: HistoryRow) => row.type === "ЖИ талдауы" && /^Салыстыру #\d+$/.test(row.title) ? tr("Салыстыру #{id}", { id: row.title.split("#")[1] }) : tr(row.title);
  const metadata = (meta: string) => {
    const timestamp = historyTimestamp(meta);
    const details = timestamp === null ? meta : meta.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?: · )?/, "");
    return details.split(" · ").filter(Boolean).map(part => {
    const changes = part.match(/^(\d+) өзгеріс анықталды$/);
    return changes ? tr("{count} өзгеріс анықталды", { count: changes[1] }) : tr(part);
    }).join(" · ");
  };
  const typeOptions = [...new Set(history.map(row => row.type))].sort((a, b) => tr(a).localeCompare(tr(b), locale));
  const filtered = history.filter(row => (typeFilter === "all" || row.type === typeFilter) && matchesSearch(query, [row.title, title(row), row.type, tr(row.type), row.meta, metadata(row.meta)], locale));
  const sorted = filtered.map((row, index) => ({ row, index, timestamp: historyTimestamp(row.meta) })).sort((a, b) => {
    if (sortOrder === "title") return title(a.row).localeCompare(title(b.row), locale) || a.index - b.index;
    if (a.timestamp === null || b.timestamp === null) return a.timestamp === b.timestamp ? a.index - b.index : a.timestamp === null ? 1 : -1;
    const byDate = sortOrder === "newest" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
    return byDate || a.index - b.index;
  }).map(item => item.row);
  const analysisCount = history.filter(row => row.type === "ЖИ талдауы").length;
  const documentCount = history.filter(row => row.type === "Құжат").length;
  const hasActiveFilters = Boolean(query.trim()) || typeFilter !== "all";
  return <>
    <div className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Әрекеттер тарихы")}</h1><p className="mt-1 text-slate-500">{tr("Сақталған талдаулар мен құжаттар журналы")}</p></div>
    <div className="grid gap-3 sm:grid-cols-3" aria-label={tr("Тарих қорытындысы")}>
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{tr("Барлық әрекет")}</p><p className="mt-1 text-2xl font-bold text-slate-900">{history.length}</p></div>
      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4"><p className="text-xs font-medium text-blue-700">{tr("Талдаулар")}</p><p className="mt-1 text-2xl font-bold text-blue-800">{analysisCount}</p></div>
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4"><p className="text-xs font-medium text-emerald-700">{tr("Құжат әрекеттері")}</p><p className="mt-1 text-2xl font-bold text-emerald-800">{documentCount}</p></div>
    </div>
    <HistoryToolbar query={query} onQueryChange={setQuery} typeFilter={typeFilter} onTypeFilterChange={setTypeFilter} typeOptions={typeOptions} sortOrder={sortOrder} onSortOrderChange={setSortOrder} count={filtered.length} total={history.length} />
    <section aria-label={tr("Әрекеттер тізімі")}>
      {sorted.length ? <ul className="space-y-3">{sorted.map((row, i) => {
        const comparisonId = row.type === "ЖИ талдауы" ? row.title.match(/^Салыстыру #(\d+)$/)?.[1] : undefined;
        const rowKey = `${row.type}:${row.documentId || ""}:${row.title}:${row.meta}:${i}`;
        const timestamp = historyTimestamp(row.meta);
        const dateLabel = timestamp === null ? "" : formatHistoryTimestamp(timestamp, locale);
        const details = metadata(row.meta);
        const open = comparisonId || row.type === "Құжат" ? async () => {
          setOpeningKey(rowKey);
          try {
            if (comparisonId) { await props.openAnalysis(comparisonId); return; }
            const response = await fetch(`/api/documents${row.documentId ? `/${encodeURIComponent(row.documentId)}` : ""}`);
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Құжат ашылмады");
            const document = row.documentId ? data : data.find((item: { title: string }) => item.title === row.title);
            if (!document) throw new Error("Құжат табылмады");
            if (!row.documentId) {
              const detailResponse = await fetch(`/api/documents/${encodeURIComponent(document.id)}`);
              const detail = await detailResponse.json();
              if (!detailResponse.ok) throw new Error(detail.error || "Құжат ашылмады");
              props.openDocument(detail);
            } else props.openDocument(document);
          } catch (error) { props.setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); }
          finally { setOpeningKey(null); }
        } : undefined;
        return <HistoryActivity key={rowKey} row={row} title={title(row)} dateLabel={dateLabel} details={details} onOpen={open} opening={openingKey === rowKey} disabled={openingKey !== null} />;
      })}</ul> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-sm"><span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Icon name="history" className="size-6" /></span><h2 className="mt-4 text-base font-semibold text-slate-800">{tr(hasActiveFilters ? "Сүзгіге сай әрекет жоқ" : "Тарих бос")}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">{tr(hasActiveFilters ? "Іздеу сөзін өзгертіңіз немесе сүзгілерді тазалаңыз." : "Талдауды іске қосыңыз немесе құжатты сақтаңыз — әрекеттер осында көрінеді.")}</p>{hasActiveFilters ? <button type="button" onClick={() => { setQuery(""); setTypeFilter("all"); }} className="mt-4 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">{tr("Сүзгілерді тазалау ×")}</button> : <button type="button" onClick={() => props.setTab("editor")} className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">{tr("Құжат редакторын ашу")}</button>}</div>}
    </section>
  </>;
}
