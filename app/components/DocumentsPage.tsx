"use client";
import DocumentDownloads from "./DocumentDownloads";
import Icon from "./Icon";
import Skeleton from "./Skeleton";
import { useLanguage } from "./LanguageProvider";
import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { getDocumentDeadlineStatus, type DocumentDetail, type DocumentSummary } from "../lib/documents";
import { editorHtmlToText } from "../lib/editor-content";
import { readDocumentFile } from "../lib/read-document";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
const field = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const secondary = `${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;
const extension = (title: string) => title.includes(".") ? title.split(".").pop()!.toUpperCase().slice(0, 8) : "TXT";
type Comment = { id: string; author: string; text: string; createdAt: string; clause?: string; version?: number };
type ApprovalView = { id: string; version: number; status: string; steps: { email: string; decision: string; reason?: string }[] };
type SharedDocument = DocumentDetail & { permission?: "owner" | "editor" | "commenter" | "viewer"; shares?: { email: string; permission: "viewer" | "commenter" | "editor" }[]; groupShares?: { groupId: string; name: string; permission: "viewer" | "commenter" | "editor" }[]; approvalId?: string; approval?: ApprovalView };
type TrashedDocument = DocumentSummary & { deletedAt: string };
export default function DocumentsPage({ props, workspaceScope }: {
    props: WorkspaceProps;
    workspaceScope?: string | null;
}) {
    const { tr, locale } = useLanguage();
    const date = (value: string) => value ? new Intl.DateTimeFormat(locale, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : tr("Күні белгісіз");
    const size = (bytes: number) => `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(bytes / 1024)} ${tr("КБ")}`;
    const { sessionUser, setAuthMode, newDocument, openDocument, onDocumentsSaved, onDocumentDeleted, downloadText, setNotice } = props;
    const [documents, setDocuments] = useState<DocumentSummary[]>([]);
    const [trashDocuments, setTrashDocuments] = useState<TrashedDocument[]>([]);
    const [showTrash, setShowTrash] = useState(false);
    const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
    const [targetWorkspace, setTargetWorkspace] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState("");
    const [folder, setFolder] = useState("all"), [favorites, setFavorites] = useState(false), [clause, setClause] = useState("");
    const [source, setSource] = useState("all");
    const [versions, setVersions] = useState("all");
    const [sort, setSort] = useState("recent");
    const [uploading, setUploading] = useState(false);
    const [openingId, setOpeningId] = useState<string | null>(null);
    const [selected, setSelected] = useState<SharedDocument | null>(null);
    const [snapshotNumber, setSnapshotNumber] = useState<number | null>(null);
    const [comments, setComments] = useState<Comment[]>([]), [commentText, setCommentText] = useState("");
    const [shareEmail, setShareEmail] = useState(""), [sharePermission, setSharePermission] = useState<"viewer" | "commenter" | "editor">("viewer");
    const [shareGroupId, setShareGroupId] = useState(""), [shareGroupPermission, setShareGroupPermission] = useState<"viewer" | "commenter" | "editor">("viewer"), [companyGroups, setCompanyGroups] = useState<{ id: string; name: string }[]>([]), [groupsWorkspaceId, setGroupsWorkspaceId] = useState("");
    const [approverEmails, setApproverEmails] = useState("");
    const selectedId = selected?.id, selectedPermission = selected?.permission;
    const availableCompanyGroups = groupsWorkspaceId === selected?.workspaceId ? companyGroups : [];
    useEffect(() => {
        if (!selectedId) return;
        let cancelled = false;
        fetch(`/api/documents/${encodeURIComponent(selectedId)}/comments`, { cache: "no-store" }).then(async response => {
            const data = await response.json();
            if (response.ok && !cancelled) setComments(data);
        }).catch(() => {});
        if (selectedPermission === "owner") fetch(`/api/documents/${encodeURIComponent(selectedId)}/shares`, { cache: "no-store" }).then(async response => {
            const data = await response.json();
            if (response.ok && !cancelled) setSelected(current => current?.id === selectedId ? { ...current, shares: data } : current);
        }).catch(() => {});
        if (selectedPermission === "owner" && selected?.workspaceId) {
            fetch(`/api/documents/${encodeURIComponent(selectedId)}/group-shares`, { cache: "no-store" }).then(async response => {
                const data = await response.json();
                if (response.ok && !cancelled) setSelected(current => current?.id === selectedId ? { ...current, groupShares: data } : current);
            }).catch(() => {});
            fetch(`/api/workspaces/${encodeURIComponent(selected.workspaceId)}/groups`, { cache: "no-store" }).then(async response => {
                const data = await response.json();
                if (response.ok && !cancelled) { setCompanyGroups(data); setGroupsWorkspaceId(selected.workspaceId!); }
            }).catch(() => {});
        }
        return () => { cancelled = true; };
    }, [selectedId, selectedPermission, selected?.workspaceId]);
    useEffect(() => {
        if (!sessionUser)
            return;
        const controller = new AbortController();
        fetch(`/api/documents?workspaceId=${encodeURIComponent(workspaceScope || "")}&q=${encodeURIComponent(query.trim())}`, { signal: controller.signal })
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
    }, [sessionUser, reload, tr, workspaceScope, query]);
    useEffect(() => {
        if (!sessionUser) return;
        const controller = new AbortController();
        fetch(`/api/documents/trash?workspaceId=${encodeURIComponent(workspaceScope || "")}`, { cache: "no-store", signal: controller.signal }).then(async response => {
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || tr("Себетті жүктеу мүмкін болмады."));
            setTrashDocuments(data);
        }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? tr(error.message) : tr("Желі қатесі.")); });
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
    const filtered = documents.filter(document => (folder === "all" || (document.folder || "") === folder) && (!favorites || document.favorite) &&
        (source === "all" || document.source === source) &&
        (versions === "all" || (versions === "multiple" ? document.versionCount > 1 : document.versionCount === 1))).sort((a, b) => sort === "name" ? a.title.localeCompare(b.title, locale) : sort === "oldest" ? a.updatedAt.localeCompare(b.updatedAt) : b.updatedAt.localeCompare(a.updatedAt));
    const totalVersions = documents.reduce((sum, document) => sum + document.versionCount, 0);
    const snapshot = selected?.versions.find(version => version.version === snapshotNumber);
    const hasFilters = !!query || folder !== "all" || favorites || source !== "all" || versions !== "all";
    const resetFilters = () => { setFolder("all"); setFavorites(false); setQuery(""); setSource("all"); setVersions("all"); };
    async function organize(document: DocumentSummary, patch: { folder?: string; tags?: string[]; favorite?: boolean }) {
      try { const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/organization`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }); const data = await response.json(); if (!response.ok) throw Error(data.error); setDocuments(current => current.map(d => d.id === document.id ? { ...d, ...data } : d)); setSelected(current => current?.id === document.id ? { ...current, ...data } : current); }
      catch(e) { setNotice(e instanceof Error ? tr(e.message) : tr("Қате шықты")); }
    }
    async function saveDeadline(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!selected) return;
      const dueDate = String(new FormData(event.currentTarget).get("dueDate") || "") || null;
      try {
        const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/metadata`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dueDate }) });
        const data = await response.json();
        if (!response.ok) throw Error(data.error);
        setSelected(current => current?.id === selected.id ? { ...current, ...data } : current);
        setDocuments(current => current.map(document => document.id === selected.id ? { ...document, ...data } : document));
        setNotice(tr("Құжат мерзімі сақталды."));
      } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Құжат мерзімін сақтау мүмкін болмады.")); }
    }
    async function upload(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file)
            return;
        setUploading(true);
        try {
            if (file.size > 10 * 1024 * 1024)
                throw new Error(tr("Файл 10 МБ-тан аспауы керек"));
            let ocrPages = 0;
            const text = await readDocumentFile(file, count => { ocrPages = count; });
            const selectedWorkspace = workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined;
            const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: file.name, text, source: "upload", workspaceId: selectedWorkspace }) });
            const document = await response.json();
            if (!response.ok)
                throw new Error(document.error);
            setDocuments(current => [document, ...current]);
            setError("");
            resetFilters();
            setNotice(ocrPages ? tr("OCR мәтінді таныды. Нәтижені түпнұсқамен салыстырып тексеріңіз.") : tr("«{p0}» кітапханаға сақталды.", { p0: document.title }));
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
            const detail: SharedDocument & {
                error?: string;
            } = await response.json();
            if (!response.ok)
                throw new Error(detail.error);
            if (edit)
                openDocument(detail);
            else {
                setComments([]);
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
            setTrashDocuments(current => [{ ...document, deletedAt: new Date().toISOString() }, ...current]);
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
    async function restoreDocument(document: TrashedDocument) {
      setOpeningId(document.id);
      try { const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/restore`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTrashDocuments(current => current.filter(item => item.id !== document.id)); setDocuments(current => [data, ...current]); setNotice(tr("«{p0}» қалпына келтірілді.", { p0: document.title })); }
      catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Құжатты қалпына келтіру мүмкін болмады.")); }
      finally { setOpeningId(null); }
    }
    async function permanentlyDeleteDocument(document: TrashedDocument) {
      if (!window.confirm(tr("«{p0}» құжатын біржола жоясыз ба? Бұл әрекетті қайтару мүмкін емес.", { p0: document.title }))) return;
      setOpeningId(document.id);
      try { const response = await fetch(`/api/documents/${encodeURIComponent(document.id)}/permanent`, { method: "DELETE" }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setTrashDocuments(current => current.filter(item => item.id !== document.id)); setNotice(tr("Құжат біржола жойылды.")); }
      catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Құжатты біржола жою мүмкін болмады.")); }
      finally { setOpeningId(null); }
    }
    async function addComment() {
        if (!selected || !commentText.trim()) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: commentText, clause, version: snapshotNumber }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setComments(current => [...current, data]); setCommentText(""); setClause("");
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Пікірді сақтау мүмкін болмады.")); }
    }
    async function shareDocument(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: shareEmail, permission: sharePermission }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSelected(current => current?.id === selected.id ? { ...current, shares: data } : current); setShareEmail("");
            setNotice(tr("Құжатқа қолжетімділік берілді."));
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Құжатты бөлісу мүмкін болмады.")); }
    }
    async function revokeShare(email: string) {
        if (!selected) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/shares/${encodeURIComponent(email)}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSelected(current => current?.id === selected.id ? { ...current, shares: current.shares?.filter(item => item.email !== email) } : current);
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Қолжетімділікті алып тастау мүмкін болмады.")); }
    }
    async function shareWithGroup(event: FormEvent<HTMLFormElement>) {
        event.preventDefault(); if (!selected || !shareGroupId) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/group-shares`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ groupId: shareGroupId, permission: shareGroupPermission }) });
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            setSelected(current => current?.id === selected.id ? { ...current, groupShares: data } : current);
            setNotice(tr("Құжатқа топтық қолжетімділік берілді."));
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топпен бөлісу мүмкін болмады.")); }
    }
    async function revokeGroupShare(groupId: string) {
        if (!selected) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/group-shares/${encodeURIComponent(groupId)}`, { method: "DELETE" });
            const data = await response.json(); if (!response.ok) throw new Error(data.error);
            setSelected(current => current?.id === selected.id ? { ...current, groupShares: current.groupShares?.filter(item => item.groupId !== groupId) } : current);
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топқа қолжетімділікті алып тастау мүмкін болмады.")); }
    }
    async function restoreVersion() {
        if (!selected || !snapshot) return;
        try {
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/restore`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ version: snapshot.version, baseVersion: selected.version }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSelected(data); setSnapshotNumber(data.version);
            setDocuments(current => current.map(item => item.id === data.id ? data : item));
            setNotice(tr("Ескі нұсқа жаңа нұсқа ретінде қалпына келтірілді."));
            await onDocumentsSaved();
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Нұсқаны қалпына келтіру мүмкін болмады.")); }
    }
    async function requestApproval(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!selected) return;
        try {
            const approvers = approverEmails.split(/[;,\n]/).map(email => email.trim()).filter(Boolean);
            const response = await fetch(`/api/documents/${encodeURIComponent(selected.id)}/approval`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approvers }) });
            const data: ApprovalView & { error?: string } = await response.json();
            if (!response.ok) throw new Error(data.error);
            setSelected(current => current?.id === selected.id ? { ...current, approvalId: data.id, approval: data } : current);
            setApproverEmails(""); setNotice(tr("Бекіту сұрауы жіберілді."));
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Бекіту сұрауын жіберу мүмкін болмады.")); }
    }
    return <>
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Жұмыс кеңістігі / Кітапхана")}</p><h1 className="text-3xl font-bold">{tr("Құжаттар")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Барлық сақталған файлдар мен нұсқалар бір жерде")}</p></div>
      <div className="flex flex-wrap gap-2">
        {workspaceScope === undefined && <><label className="sr-only" htmlFor="document-workspace">{tr("Сақтау кеңістігі")}</label><select id="document-workspace" value={targetWorkspace} onChange={event => setTargetWorkspace(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">{tr("Жеке кеңістік")}</option>{workspaces.map(workspace => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></>}
        <label className={`${secondary} relative ${uploading ? "opacity-50" : "cursor-pointer"}`}>
          {uploading ? tr("Жүктелуде…") : tr("\u2191 Файл жүктеу")}
          <input aria-label={tr("Құжат жүктеу")} className="absolute inset-0 w-full cursor-pointer opacity-0" type="file" accept=".pdf,.docx,.txt,.md,.csv,.tsv,.json,.xml,.html,.log" disabled={uploading} onChange={upload}/>
        </label>
        <button onClick={() => newDocument(workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined)} className={`${button} gap-2 bg-blue-600 text-white hover:bg-blue-700`}><span aria-hidden="true">＋</span>{tr("Жаңа құжат")}</button>
      </div>
    </div>

    <div className="grid gap-3 sm:grid-cols-3">
      {[[tr("Барлық құжаттар"), documents.length, "▤", "bg-blue-50 text-blue-600"], [tr("Сақталған нұсқалар"), totalVersions, "↻", "bg-violet-50 text-violet-600"], [tr("Жүктелген файлдар"), documents.filter(document => document.source === "upload").length, "↑", "bg-emerald-50 text-emerald-600"]].map(([label, value, icon, tone]) => <div key={String(label)} className={`${card} flex items-center gap-4`}><span aria-hidden="true" className={`flex size-11 shrink-0 items-center justify-center rounded-xl text-xl ${tone}`}>{icon}</span><div><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-2xl font-bold">{loading || error ? "—" : value}</p></div></div>)}
    </div>

    <div className="flex flex-wrap items-center gap-3"><button onClick={() => setShowTrash(false)} aria-pressed={!showTrash} className={`${secondary} gap-2 ${!showTrash ? "bg-blue-50 text-blue-600" : ""}`}><Icon name="file" className="size-4"/>{tr("Құжаттар")}</button><button onClick={() => setShowTrash(true)} aria-pressed={showTrash} className={`${secondary} gap-2 ${showTrash ? "bg-blue-50 text-blue-600" : ""}`}><Icon name="trash" className="size-4"/>{tr("Себет")}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{trashDocuments.length}</span></button>{!showTrash && <><button onClick={() => setFavorites(!favorites)} aria-pressed={favorites} className={`${secondary} gap-2 ${favorites ? "bg-blue-50 text-blue-600" : ""}`}><Icon name="star" className="size-4"/>{tr("Таңдаулылар")}</button><label className="flex items-center gap-2 text-sm text-slate-500"><Icon name="folder" className="size-4"/>{tr("Қалта")}<select aria-label={tr("Қалта")} value={folder} onChange={e=>setFolder(e.target.value)} className="rounded-xl border border-slate-200 bg-white p-2 text-sm"><option value="all">{tr("Барлық қалталар")}</option><option value="">{tr("Қалтасыз")}</option>{[...new Set(documents.map(d=>d.folder).filter(Boolean))].sort().map(f=><option key={f} value={f}>{f}</option>)}</select></label></>}</div>
    {!showTrash && <section className={`${card} space-y-4`} aria-label={tr("Құжаттарды іздеу және сүзу")}>
      <div className="grid gap-3 md:grid-cols-[minmax(200px,1fr)_180px_180px_180px]">
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Іздеу")}</span><input type="search" aria-label={tr("Құжат атауы немесе мәтіні бойынша іздеу")} placeholder={tr("Құжат атауын немесе мәтінін іздеу…")} maxLength={120} value={query} onChange={event => setQuery(event.target.value)} className={field}/></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Дереккөз")}</span><select aria-label={tr("Дереккөз")} value={source} onChange={event => setSource(event.target.value)} className={field}><option value="all">{tr("Барлық құжаттар")}</option><option value="editor">{tr("Редактордан")}</option><option value="upload">{tr("Жүктелген файлдар")}</option></select></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Нұсқалар")}</span><select aria-label={tr("Нұсқалар")} value={versions} onChange={event => setVersions(event.target.value)} className={field}><option value="all">{tr("Барлық нұсқалар")}</option><option value="single">{tr("Бір нұсқасы бар")}</option><option value="multiple">{tr("Бірнеше нұсқасы бар")}</option></select></label>
        <label><span className="mb-1.5 block text-xs font-medium text-slate-500">{tr("Сұрыптау")}</span><select aria-label={tr("Сұрыптау")} value={sort} onChange={event => setSort(event.target.value)} className={field}><option value="recent">{tr("Жаңалары алдымен")}</option><option value="oldest">{tr("Ескілері алдымен")}</option><option value="name">{tr("Атауы бойынша")}</option></select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500"><p role="status">{loading ? tr("Құжаттар жүктелуде…") : tr("{p0} / {p1} құжат", { p0: filtered.length, p1: documents.length })}</p>{hasFilters ? <button onClick={resetFilters} className="font-semibold text-blue-600 hover:underline">{tr("Сүзгілерді тазалау \u00D7")}</button> : <p>{tr("PDF, DOCX және мәтіндік файлдар · 10 МБ дейін")}</p>}</div>
    </section>}

    <div className={`grid items-start gap-5 ${selected ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
      <section className={`${card} overflow-hidden p-0`} aria-label={tr(showTrash ? "Себет" : "Сақталған құжаттар")} aria-busy={loading}>
        {loading ? <Skeleton /> : error ? <div role="alert" className="space-y-3 p-10 text-center"><p className="text-sm text-rose-600">{tr(error)}</p><button onClick={() => { setLoading(true); setReload(value => value + 1); }} className={secondary}>{tr("Қайта жүктеу")}</button></div> : (showTrash ? !trashDocuments.length : !filtered.length) ? <div className="px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-50 text-3xl text-slate-400" aria-hidden="true">▤</div>
          <h2 className="text-lg font-semibold">{showTrash ? tr("Себет бос") : hasFilters ? tr("Құжаттар табылмады") : tr("Алғашқы құжатыңызды қосыңыз")}</h2>
          <p className="mx-auto mb-5 mt-2 max-w-sm text-sm text-slate-500">{showTrash ? tr("Жойылған құжаттар осында көрсетіледі.") : hasFilters ? tr("Іздеу сөзін өзгертіңіз немесе сүзгілерді тазалаңыз.") : tr("Редакторда құжат жасаңыз немесе мәтіндік файл жүктеңіз. Барлық нұсқалар осында сақталады.")}</p>
          {!showTrash && <button onClick={hasFilters ? resetFilters : () => newDocument(workspaceScope !== undefined ? workspaceScope || undefined : targetWorkspace || undefined)} className={`${button} bg-blue-50 text-blue-700`}>{hasFilters ? tr("Сүзгілерді тазалау") : tr("\uFF0B Құжат жасау")}</button>}
        </div> : <>
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_160px_220px] gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-medium text-slate-500 lg:grid"><span>{tr("Құжат атауы")}</span><span>{tr("Нұсқа")}</span><span>{tr(showTrash ? "Жойылған күні" : "Жаңартылған күні")}</span><span className="text-right">{tr("Әрекеттер")}</span></div>
          <ul className="divide-y divide-slate-100">{(showTrash ? trashDocuments : filtered).map(document => <li key={document.id} className={`grid items-center gap-3 px-5 py-4 transition hover:bg-slate-50/70 lg:grid-cols-[minmax(0,1fr)_120px_160px_220px] ${selected?.id === document.id ? "bg-blue-50/60" : ""}`}>
            <div className="flex min-w-0 items-center gap-3">{!showTrash && <button aria-label={tr(document.favorite ? "Таңдаулылардан алып тастау" : "Таңдаулыларға қосу")} aria-pressed={!!document.favorite} onClick={()=>void organize(document,{favorite:!document.favorite})} className={document.favorite ? "text-amber-500" : "text-slate-300 hover:text-amber-500"}><Icon name="star" className="size-4" fill={document.favorite ? "currentColor" : "none"}/></button>}<span className="flex h-12 w-11 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-blue-50 font-mono text-[10px] font-bold text-blue-600" aria-hidden="true">{extension(document.title)}</span><div className="min-w-0">{showTrash ? <span className="block max-w-full truncate text-sm font-semibold text-slate-800" title={document.title}>{document.title}</span> : <button onClick={() => showDocument(document)} disabled={openingId !== null} className="block max-w-full truncate text-left text-sm font-semibold text-slate-800 hover:text-blue-600" title={document.title}>{document.title}</button>}<p className="mt-1 text-xs text-slate-400">{document.source === "upload" ? tr("Жүктелген файл") : tr("Редактордан")} · {size(document.size)}</p>{document.dueDate && <p className={`mt-1 text-[11px] font-medium ${getDocumentDeadlineStatus(document.dueDate) === "overdue" ? "text-rose-600" : "text-amber-700"}`}>{tr("Мерзімі")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(`${document.dueDate}T12:00:00`))} · {tr(getDocumentDeadlineStatus(document.dueDate) === "overdue" ? "Мерзімі өтіп кеткен" : getDocumentDeadlineStatus(document.dueDate) === "today" ? "Бүгін аяқталады" : getDocumentDeadlineStatus(document.dueDate) === "soon" ? "Жақында аяқталады" : "Алдағы мерзім")}</p>}</div></div>
            <div><span className="inline-flex rounded-md border border-blue-100 bg-blue-50 px-2 py-0.5 font-mono text-xs font-semibold text-blue-700">v{document.version}</span><span className="ml-2 text-xs text-slate-400">{tr("{count} нұсқа", { count: document.versionCount })}</span></div>
            <time dateTime={(showTrash ? (document as TrashedDocument).deletedAt : document.updatedAt) || undefined} className="text-xs leading-5 text-slate-500">{date(showTrash ? (document as TrashedDocument).deletedAt : document.updatedAt)}</time>
            {showTrash ? <div className="flex flex-nowrap gap-1 lg:justify-end"><button onClick={() => void restoreDocument(document as TrashedDocument)} disabled={openingId !== null} className={`${button} border border-emerald-200 bg-emerald-50 px-2 text-xs text-emerald-700`}>{tr("Қалпына келтіру")}</button><button onClick={() => void permanentlyDeleteDocument(document as TrashedDocument)} disabled={openingId !== null} className={`${button} border border-rose-200 bg-white px-2 text-xs text-rose-600`}>{tr("Біржола жою")}</button></div> : <div className="flex flex-nowrap gap-1 lg:justify-end"><button onClick={() => showDocument(document)} disabled={openingId !== null} className={`${button} border border-slate-200 bg-white px-2 text-xs text-slate-600`}>{openingId === document.id ? "…" : tr("Нұсқалар")}</button><button onClick={() => showDocument(document, true)} disabled={openingId !== null} className={`${button} bg-blue-50 px-2 text-xs text-blue-700`}>{tr("Ашу")}</button>{(document as DocumentSummary & { permission?: string }).permission === "owner" && <button onClick={() => void deleteDocument(document)} disabled={openingId !== null} aria-label={`${tr("Себетке жіберу")}: ${document.title}`} title={tr("Себетке жіберу")} className={`${button} size-9 shrink-0 justify-center border border-rose-200 bg-white p-0 text-rose-600 hover:bg-rose-50`}><Icon name="trash" className="size-4"/></button>}</div>}
          </li>)}</ul>
        </>}
      </section>

      {selected && <aside className={`version-panel ${card} min-w-0 space-y-5`} aria-label={tr("Құжат нұсқалары")}>
        <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">{tr("Нұсқалар тарихы")}</p><h2 className="break-words font-bold">{selected.title}</h2><p className="mt-1 text-xs text-slate-400">{tr("{count} сақталған нұсқа", { count: selected.versionCount })}</p></div><button onClick={() => setSelected(null)} aria-label={tr("Нұсқалар панелін жабу")} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100">×</button></div>
        {(["owner", "editor"].includes(selected.permission || "")) && <form key={`deadline-${selected.id}`} onSubmit={saveDeadline} className="space-y-2 rounded-xl border border-amber-100 bg-amber-50/60 p-3"><label className="block space-y-1 text-xs font-semibold">{tr("Құжаттың аяқталу мерзімі")}<input name="dueDate" type="date" defaultValue={selected.dueDate || ""} className={field}/></label><p className="text-[11px] leading-5 text-slate-500">{tr("Мерзімді құжаттан табуды жеңілдету үшін белгілеңіз.")}</p><button className={`${button} w-full border border-amber-200 bg-white text-xs`}>{tr("Мерзімді сақтау")}</button></form>}
        <form key={selected.id} onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);void organize(selected,{folder:String(data.get("folder")||""),tags:String(data.get("tags")||"").split(",").map(t=>t.trim()).filter(Boolean)});}} className="space-y-2 rounded-xl bg-slate-50 p-3"><label className="block space-y-1 text-xs">{tr("Қалта")}<input name="folder" maxLength={80} defaultValue={selected.folder||""} className={field}/></label><label className="block space-y-1 text-xs">{tr("Тегтер (үтірмен бөліңіз)")}<input name="tags" defaultValue={(selected.tags||[]).join(", ")} className={field}/></label><button className={`${button} w-full border border-slate-200 bg-white text-xs`}>{tr("Реттеуді сақтау")}</button></form>
        <div className="max-h-60 space-y-2 overflow-y-auto">{[...selected.versions].reverse().map(version => <button key={version.version} onClick={() => setSnapshotNumber(version.version)} aria-pressed={snapshotNumber === version.version} className={`flex w-full items-center justify-between gap-2 rounded-xl border p-3 text-left ${snapshotNumber === version.version ? "border-blue-200 bg-blue-50" : "border-slate-200 hover:bg-slate-50"}`}><span><span className="font-mono text-sm font-bold text-slate-700">v{version.version}</span><time className="mt-1 block text-xs text-slate-500" dateTime={version.savedAt || undefined}>{date(version.savedAt)}</time></span>{version.version === selected.version && <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-semibold text-emerald-700">{tr("Соңғы нұсқа")}</span>}</button>)}</div>
        <section className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold">{tr("Пікірлер")}</h3><div className="max-h-48 space-y-2 overflow-auto">{comments.map(comment => <article key={comment.id} className="rounded-lg bg-slate-50 p-3"><p className="text-xs font-semibold text-slate-600">{comment.author}</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{comment.text}</p>{comment.clause && <button className="mt-2 text-xs text-blue-600" onClick={()=>{setSnapshotNumber(comment.version!);const v=selected.versions.find(v=>v.version===comment.version);const i=v&&editorHtmlToText(v.text).split("\n").findIndex(line=>line.trim().match(/^(\d+(?:\.\d+)*)\.?\s/)?.[1]===comment.clause);requestAnimationFrame(()=>document.getElementById(`preview-line-${i}`)?.scrollIntoView({block:"center"}));}}>v{comment.version} · §{comment.clause}</button>}<time className="mt-1 block text-[11px] text-slate-400">{date(comment.createdAt)}</time></article>)}{!comments.length && <p className="text-xs text-slate-400">{tr("Пікір әлі жоқ")}</p>}</div>{["owner", "editor", "commenter"].includes(selected.permission || "") && <div className="space-y-2"><input aria-label={tr("Тармақ нөмірі")} value={clause} onChange={e=>setClause(e.target.value)} placeholder={tr("Тармақ нөмірі (мысалы, 3.1)")} maxLength={40} className={field}/><textarea value={commentText} onChange={event => setCommentText(event.target.value)} maxLength={5000} placeholder={tr("Пікір қалдыру...")} className={`${field} min-h-20`}/><button onClick={() => void addComment()} disabled={!commentText.trim()} className={`${button} bg-blue-600 text-white disabled:opacity-50`}>{tr("Пікірді жіберу")}</button></div>}</section>
        {selected.permission === "owner" && <section className="space-y-3 border-t border-slate-100 pt-4"><h3 className="font-semibold">{tr("Құжатқа қолжетімділік")}</h3><ul className="space-y-2">{(selected.shares || []).map(share => <li key={share.email} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span className="min-w-0 truncate">{share.email} · {tr(share.permission === "viewer" ? "Оқырман" : share.permission === "commenter" ? "Пікір қалдырушы" : "Редактор")}</span><button onClick={() => void revokeShare(share.email)} className="text-rose-600 hover:underline">{tr("Алып тастау")}</button></li>)}</ul><form onSubmit={shareDocument} className="space-y-2"><input required type="email" value={shareEmail} onChange={event => setShareEmail(event.target.value)} placeholder="email@example.com" className={field}/><div className="flex gap-2"><select value={sharePermission} onChange={event => setSharePermission(event.target.value as typeof sharePermission)} className={`${field} min-w-0`}><option value="viewer">{tr("Оқырман")}</option><option value="commenter">{tr("Пікір қалдырушы")}</option><option value="editor">{tr("Редактор")}</option></select><button className={`${button} shrink-0 bg-blue-600 text-white`}>{tr("Бөлісу")}</button></div></form>{selected.workspaceId && <div className="space-y-2 border-t border-slate-200 pt-3"><h4 className="text-sm font-semibold">{tr("Топпен бөлісу")}</h4><ul className="space-y-2">{(selected.groupShares || []).map(share => <li key={share.groupId} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{share.name} · {tr(share.permission === "viewer" ? "Оқырман" : share.permission === "commenter" ? "Пікір қалдырушы" : "Редактор")}</span><button onClick={() => void revokeGroupShare(share.groupId)} className="text-rose-600 hover:underline">{tr("Алып тастау")}</button></li>)}</ul>{availableCompanyGroups.length > 0 && <form onSubmit={shareWithGroup} className="flex flex-wrap gap-2"><select required value={shareGroupId} onChange={event => setShareGroupId(event.target.value)} className={`${field} min-w-0 flex-1`}><option value="">{tr("Топты таңдаңыз")}</option>{availableCompanyGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select value={shareGroupPermission} onChange={event => setShareGroupPermission(event.target.value as typeof shareGroupPermission)} className={`${field} w-auto`}><option value="viewer">{tr("Оқырман")}</option><option value="commenter">{tr("Пікір қалдырушы")}</option><option value="editor">{tr("Редактор")}</option></select><button className={`${button} shrink-0 bg-blue-600 text-white`}>{tr("Топқа рұқсат беру")}</button></form>}</div>}</section>}
        {snapshot && <><div><div className="mb-2 flex items-center justify-between text-xs"><h3 className="font-semibold text-slate-600">{tr("Алдын ала қарау · v")}{snapshot.version}</h3><span className="text-slate-400">{size(new TextEncoder().encode(snapshot.text).length)}</span></div><pre id="document-preview" className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-xs leading-6 text-slate-600">{editorHtmlToText(snapshot.text).split("\n").map((line,i)=><span className="block scroll-mt-10" id={`preview-line-${i}`} key={i}>{line || " "}</span>)}</pre></div>
          {selected.approval && <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm"><b>{tr("Бекіту күйі")}: {tr(selected.approval.status === "pending" ? "Күтуде" : selected.approval.status === "approved" ? "Бекітілді" : selected.approval.status === "rejected" ? "Қабылданбады" : selected.approval.status === "stale" ? "Ескірген нұсқа" : "Ауыстырылған")}</b><p className="mt-1 text-xs">v{selected.approval.version} · {selected.approval.steps.map(step => `${step.email}: ${step.decision}`).join(" · ")}</p></section>}
          {["owner", "editor"].includes(selected.permission || "") && <form onSubmit={requestApproval} className="space-y-2 rounded-xl border border-slate-200 p-3"><label className="block text-xs font-semibold">{tr("Бекітушілердің email-ы (үтірмен бөліңіз)")}<input required value={approverEmails} onChange={event => setApproverEmails(event.target.value)} placeholder="reviewer@example.com" className={`${field} mt-1`}/></label><button disabled={selected.approval?.status === "pending"} className={`${button} w-full bg-blue-600 text-white disabled:opacity-50`}>{tr("Осы нұсқаны бекітуге жіберу")}</button></form>}
          <div className="flex flex-wrap gap-2"><button onClick={() => openDocument(selected, snapshot)} className={`${button} grow bg-blue-600 text-white hover:bg-blue-700`}>{tr("Редакторда ашу")}</button><button onClick={() => downloadText(editorHtmlToText(snapshot.text), snapshot.title.replace(/\.[^.]+$/, "") + ".txt")} className={secondary}>TXT</button><DocumentDownloads title={snapshot.title} text={snapshot.text} onError={setNotice}/></div>
          <button onClick={() => deleteDocument(selected)} disabled={openingId !== null} className={`${button} w-full border border-rose-200 text-rose-600 hover:bg-rose-50`}>{tr("Құжатты жою")}</button>
          {snapshot.version !== selected.version && ["owner", "editor"].includes(selected.permission || "") && <button onClick={() => void restoreVersion()} className={`${button} w-full border border-blue-200 bg-blue-50 text-blue-700`}>{tr("Осы нұсқаны қалпына келтіру")}</button>}
        </>}
      </aside>}
    </div>
  </>;
}
