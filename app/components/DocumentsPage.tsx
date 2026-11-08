"use client";
import { useLanguage } from "./LanguageProvider";
import { useEffect, useState, type ChangeEvent } from "react";
import type { DocumentDetail, DocumentSummary } from "../lib/documents";
import { readDocumentFile } from "../lib/read-document";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const secondary = `${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const extension = (title: string) => title.includes(".") ? title.split(".").pop()!.toUpperCase().slice(0, 8) : "TXT";
export default function DocumentsPage({ props, workspaceScope }: {
    props: WorkspaceProps;
    workspaceScope?: string | null;
}) {
    const { tr, locale } = useLanguage();
    const date = (value: string) => value ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : tr("Күні белгісіз");
    const size = (bytes: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} ${tr("КБ")}`;
    const { sessionUser, setAuthMode, newDocument, openDocument, onDocumentsSaved, onDocumentDeleted, downloadText, setNotice } = props;
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
    const [targetWorkspace, setTargetWorkspace] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState("");
    const [source, setSource] = useState("all");
    const [versions, setVersions] = useState("all");
    const [sort, setSort] = useState("recent");
    const [uploading, setUploading] = useState(false);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [selected, setSelected] = useState<DocumentDetail | null>(null);
    const [snapshotNumber, setSnapshotNumber] = useState<number | null>(null);
    useEffect(() => {
        if (!sessionUser)
            return;
        const controller = new AbortController();
        fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceScope || "")}`, { signal: controller.signal })
            .then(async (response) => {
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || tr("Құжаттарды жүктеу мүмкін болмады."));
            setDocuments(data);
            setError("");
        })
            .catch(error => {
            if (!controller.signal.aborted)
                setError(error instanceof Error ? tr(error.message) : tr("Желі қатесі."));
        })
            .finally(() => {
            if (!controller.signal.aborted)
                setLoading(false);
        });
        return () => controller.abort();
    }, [sessionUser, reload, tr, workspaceScope]);
    useEffect(() => {
        if (!sessionUser || workspaceScope !== undefined) return;
        const controller = new AbortController();
        fetch("/api/workspaces", { cache: "no-store", signal: controller.signal }).then(async response => {
            const data = await response.json();
            if (response.ok) setWorkspaces(data);
        }).catch(() => {});
        return () => controller.abort();
    }, [sessionUser, workspaceScope]);
    if (!sessionUser)
        return <section className={`${card} py-14 text-center`}>
    <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl" aria-hidden="true">▤</div>
    <h1 className="text-2xl font-bold">{tr("Құжаттар кітапханасы")}</h1>
    <p className="mx-auto mb-5 mt-2 max-w-md text-sm text-slate-500">{tr("Сақталған файлдар мен олардың нұсқаларын көру үшін жүйеге кіріңіз.")}</p>
    <button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Жүйеге кіру")}</button>
  </section>;
    const search = query.trim().toLocaleLowerCase();
    const filtered = documents.filter(document => (!search || document.title.toLocaleLowerCase().includes(search)) &&
        (source === "all" || document.source === source) &&
        (versions === "all" || (versions === "multiple" ? document.versionCount > 1 : document.versionCount === 1))).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title, locale) : sort === "oldest" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
    const totalVersions = documents.reduce((sum, document) => sum + document.versionCount, 0);
    const snapshot = selected?.versions.find(version => version.version === snapshotNumber);
    const hasFilters = !!query || source !== "all" || versions !== "all";
    const resetFilters = () => { setQuery(""); setSource("all"); setVersions("all"); };
    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file)
            return;
        setUploading(true);
        try {
            if (file.size > 2 * 1024 * 1024)
                throw new Error(tr("Файл көлемі 2 МБ-тан аспауы керек."));
            const text = await readDocumentFile(file);
            const selectedWorkspace = workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined;
            const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: file.name, text, source: "upload", workspaceId: selectedWorkspace }) });
            const document = await response.json();
            if (!response.ok)
                throw new Error(document.error);
            setDocuments(current => [document, ...current]);
            setError("");
            resetFilters();
            setNotice(tr("«{p0}» кітапханаға сақталды.", { p0: document.title }));
            await onDocumentsSaved();
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Файлды сақтау мүмкін болмады."));
        }
        finally {
            setUploading(false);
        }
    }
    async function showDocument(document: DocumentSummary, edit = false) {
        setOpeningId(document.id);
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`);
            const detail: DocumentDetail & {
                error?: string;
            } = await response.json();
            if (!response.ok)
                throw new Error(detail.error);
            if (edit)
                openDocument(detail);
            else {
                setSelected(detail);
                setSnapshotNumber(detail.version);
            }
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Құжатты ашу мүмкін болмады."));
        }
        finally {
            setOpeningId(null);
        }
    }
    async function deleteDocument(document: DocumentSummary) {
        setOpeningId(document.id);
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setDocuments(current => current.filter(item => item.id !== document.id));
            if (selected?.id === document.id)
                setSelected(null);
            onDocumentDeleted(document.id);
            setNotice(tr("«{p0}» жойылды.", { p0: document.title }));
            await onDocumentsSaved();
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Құжатты жою мүмкін болмады."));
        }
        finally {
            setOpeningId(null);
        }
    }
    return <>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Жұмыс кеңістігі / Кітапхана")}</p><h1 className="text-3xl font-bold">{tr("Құжаттар")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Барлық сақталған файлдар мен нұсқалар бір жерде")}</p></div>
      <div className="flex flex-wrap gap-2">
        {workspaceScope === undefined && <><label className="sr-only" htmlFor="document-workspace">{tr("Сақтау кеңістігі")}</label><select id="document-workspace" value={targetWorkspace} onChange={event => setTargetWorkspace(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">{tr("Жеке кеңістік")}</option>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></>}
        <label className={`${secondary} relative ${uploading ? "opacity-50" : "cursor-pointer"}`}>
          {uploading ? tr("Жүктелуде…") : tr("\u2191 Файл жүктеу")}
          <input aria-label={tr("Құжат жүктеу")} className="absolute inset-0 w-full cursor-pointer opacity-0" type="file" accept=".txt,.md,.csv,.tsv,.json,.xml,.html,.log" disabled={uploading} onChange={upload}/>
        </label>
        <button onClick={() => newDocument(workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined)} className={`${button} gap-2 bg-blue-600 text-white hover:bg-blue-700`}><span aria-hidden="true">＋</span>{tr("Жаңа құжат")}</button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {[[tr("Барлық құжаттар"), documents.length, "▤", "bg-blue-50 text-blue-600"], [tr("Сақталған нұсқалар"), totalVersions, "↻", "bg-violet-50 text-violet-600"], [tr("Жүктелген файлдар"), documents.filter(document => document.source === "upload").length, "↑", "bg-emerald-50 text-emerald-600"]].map(([label, value, icon, tone]) => <div key={String(label)} className={`${card} flex items-center gap-4`}><span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${tone}`}>{icon}</span><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{loading || error ? "—" : value}</p></div></div>)}
    </div>

    <section className={`${card} space-y-4`} aria-label={tr("Құжаттарды іздеу және сүзу")}>
      <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_180px_180px_180px]">
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Іздеу")}</span><input type="search" aria-label={tr("Құжат атауы бойынша іздеу")} placeholder={tr("Құжат атауын енгізіңіз…")} value={query} onChange={event => setQuery(event.target.value)} className={field}/></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Дереккөз")}</span><select aria-label={tr("Дереккөз")} value={source} onChange={event => setSource(event.target.value)} className={field}><option value="all">{tr("Барлық құжаттар")}</option><option value="editor">{tr("Редактордан")}</option><option value="upload">{tr("Жүктелген файлдар")}</option></select></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Нұсқалар")}</span><select aria-label={tr("Нұсқалар")} value={versions} onChange={event => setVersions(event.target.value)} className={field}><option value="all">{tr("Барлық нұсқалар")}</option><option value="single">{tr("Бір нұсқасы бар")}</option><option value="multiple">{tr("Бірнеше нұсқасы бар")}</option></select></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Сұрыптау")}</span><select aria-label={tr("Сұрыптау")} value={sort} onChange={event => setSort(event.target.value)} className={field}><option value="recent">{tr("Жаңалары алдымен")}</option><option value="oldest">{tr("Ескілері алдымен")}</option><option value="name">{tr("Атауы бойынша")}</option></select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p role="status">{loading ? tr("Құжаттар жүктелуде…") : tr("{p0} / {p1} құжат", { p0: filtered.length, p1: documents.length })}</p>{hasFilters ? <button onClick={resetFilters} className="font-semibold text-blue-600 hover:underline">{tr("Сүзгілерді тазалау \u00D7")}</button> : <p>{tr("Мәтіндік файлдар · 2 МБ дейін · 200 000 таңбаға дейін")}</p>}</div>
    </section>

    <div className={`grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <section className={`${card} overflow-hidden p-0`} aria-label={tr("Сақталған құжаттар")} aria-busy={loading}>
        {loading ? <div className="p-12 text-center text-sm text-slate-500">{tr("Құжаттар жүктелуде…")}</div> : error ? <div role="alert" className="space-y-3 p-10 text-center"><p className="text-sm text-rose-600">{tr(error)}</p><button onClick={() => { setLoading(true); setReload(value => value + 1); }} className={secondary}>{tr("Қайта жүктеу")}</button></div> : !filtered.length ? <div className="px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-50 text-3xl text-slate-400" aria-hidden="true">▤</div>
          <h2 className="text-lg font-semibold">{hasFilters ? tr("Құжаттар табылмады") : tr("Алғашқы құжатыңызды қосыңыз")}</h2>
          <p className="mx-auto mb-5 mt-2 max-w-sm text-sm text-slate-500">{hasFilters ? tr("Іздеу сөзін өзгертіңіз немесе сүзгілерді тазалаңыз.") : tr("Редакторда құжат жасаңыз немесе мәтіндік файл жүктеңіз. Барлық нұсқалар осында сақталады.")}</p>
          <button onClick={hasFilters ? resetFilters : () => newDocument(workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined)} className={`${button} bg-blue-50 text-blue-700`}>{hasFilters ? tr("Сүзгілерді тазалау") : tr("\uFF0B Құжат жасау")}</button>
        </div> : <>
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_160px_160px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 lg:grid"><span>{tr("Құжат атауы")}</span><span>{tr("Нұсқа")}</span><span>{tr("Жаңартылған күні")}</span><span className="text-right">{tr("Әрекеттер")}</span></div>
          <ul className="divide-y divide-slate-100">{filtered.map(document => <li key={document.id} className={`grid items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1fr)_120px_160px_160px] ${selected?.id === document.id ? "bg-blue-50/60" : ""}`}>
            <div className="flex min-w-0 items-center gap-3"><span className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 font-mono text-[10px] font-bold text-blue-600" aria-hidden="true">{extension(document.title)}</span><div className="min-w-0"><button onClick={() => showDocument(document)} disabled={openingId !== null} className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-blue-600" title={document.title}>{document.title}</button><p className="mt-1 text-xs text-slate-400">{document.source === "upload" ? tr("Жүктелген файл") : tr("Редактордан")} · {size(document.size)}</p></div></div>
            <div><span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">v{document.version}</span><span className="ml-2 text-xs text-slate-400">{tr("{count} нұсқа", { count: document.versionCount })}</span></div>
            <time dateTime={document.updatedAt || undefined} className="text-xs leading-5 text-slate-500">{date(document.updatedAt)}</time>
            <div className="flex gap-2 lg:justify-end"><button onClick={() => showDocument(document)} disabled={openingId !== null} className={`${button} border border-slate-200 bg-white px-3 text-xs text-slate-600`}>{openingId === document.id ? "…" : tr("Нұсқалар")}</button><button onClick={() => showDocument(document, true)} disabled={openingId !== null} className={`${button} bg-blue-50 px-3 text-xs text-blue-700`}>{tr("Ашу")}</button></div>
          </li>)}</ul>
        </>}
      </section>

      {selected && <aside className={`${card} min-w-0 space-y-5`} aria-label={tr("Құжат нұсқалары")}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">{tr("Нұсқалар тарихы")}</p><h2 className="break-words font-bold">{selected.title}</h2><p className="mt-1 text-xs text-slate-400">{tr("{count} сақталған нұсқа", { count: selected.versionCount })}</p></div><button onClick={() => setSelected(null)} aria-label={tr("Нұсқалар панелін жабу")} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div>
        <div className="max-h-60 space-y-2 overflow-y-auto">{[...selected.versions].reverse().map(version => <button key={version.version} onClick={() => setSnapshotNumber(version.version)} aria-pressed={snapshotNumber === version.version} className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left ${snapshotNumber === version.version ? "border-blue-200 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}><span><span className="font-mono text-sm font-bold text-slate-700">v{version.version}</span><time className="mt-1 block text-xs text-slate-500" dateTime={version.savedAt || undefined}>{date(version.savedAt)}</time></span>{version.version === selected.version && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{tr("Соңғы нұсқа")}</span>}</button>)}</div>
        {snapshot && <><div><div className="mb-2 flex items-center justify-between text-xs"><h3 className="font-semibold text-slate-600">{tr("Алдын ала қарау · v")}{snapshot.version}</h3><span className="text-slate-400">{size(new TextEncoder().encode(snapshot.text).length)}</span></div><pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-600">{snapshot.text}</pre></div>
          <div className="flex flex-wrap gap-2"><button onClick={() => openDocument(selected, snapshot)} className={`${button} grow bg-blue-600 text-white hover:bg-blue-700`}>{tr("Редакторда ашу")}</button><button onClick={() => downloadText(snapshot.text, snapshot.title)} className={secondary}>{tr("\u2193 Жүктеу")}</button></div>
          <button onClick={() => deleteDocument(selected)} disabled={openingId !== null} className={`${button} w-full border border-rose-200 text-rose-600 hover:bg-rose-50`}>{tr("Құжатты жою")}</button>
          {snapshot.version !== selected.version && <p className="text-xs leading-5 text-slate-500">{tr("Алдыңғы нұсқаны редакторда ашып, сақтасаңыз, жаңа нұсқа жасалады. Тарих сақталады.")}</p>}
        </>}
      </aside>}
    </div>
  </>;
}
