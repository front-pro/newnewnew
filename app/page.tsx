"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import AppHeader from "./components/AppHeader";
import MainContent from "./components/MainContent";
import AuthDialog from "./components/AuthDialog";
import AppFooter from "./components/AppFooter";
import { button, card } from "./components/styles";
import type { HistoryRow, UserSettings, WorkspaceProps } from "./components/workspace-context";
import { readDocumentFile } from "./lib/read-document";
import { matchesSearch } from "./lib/search";
import { LanguageProvider, useLanguage } from "./components/LanguageProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import type { DocumentDetail, DocumentVersion } from "./lib/documents";
type Tab = "compare" | "documents" | "templates" | "editor" | "history" | "companies" | "users" | "settings";
type Template = {
    id: number;
    title: string;
    desc: string;
    body: string;
    access: string;
    owner?: string;
    locked?: boolean;
};
type Change = {
    type: string;
    title: string;
    description: string;
    a: string;
    b: string;
};
type Report = {
    id: number;
    isSaved?: boolean;
    summary: string;
    metrics: {
        total: number;
        conflicts: number;
        lost: number;
        news: number;
        changed: number;
    };
    changes: Change[];
};
type SessionUser = {
    id: string;
    name: string;
    email: string;
    role: string;
};
type UserRow = {
    name: string;
    email: string;
    role: string;
};
const sampleA = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Құжаттарды қағаз және электронды түрде архивтеуді қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.\n3.2. Ақпараттық жүйелерді әзірлеу ұйымдастырылады.`;
const sampleB = `1.1. Департамент ұйымның құрылымдық бөлімшесі болып табылады.\n2.1. Жасанды интеллект негізіндегі құжаттарды автоматты талдауды қамтамасыз ету.\n3.1. Ақпараттық жүйелердің қауіпсіздігін тексеру және әзірлеу жүргізіледі.\n3.2. Ақпараттық жүйелердің қауіпсіздігін тексеру жүргізіледі.`;
const initialTemplates: Template[] = [
    { id: 1, title: "Қызметтік жазба үлгісі", desc: "Ішкі хат алмасуға арналған стандартты формат.", access: "Жалпы · Public", body: `ҚЫЗМЕТТІК ЖАЗБА\n\nКімге: [лауазымы, аты-жөні]\nКімнен: [лауазымы, аты-жөні]\nКүні: [күн.ай.жыл]\n\n1. Мәселенің мәні: [қысқаша сипаттаңыз]\n2. Ұсыныс: [не істеу керек]\n3. Қосымшалар: [құжаттар тізімі]` },
    { id: 2, title: "Еңбек шартына қосымша келісім", desc: "Кадрлық өзгерістерді тіркеуге арналған келісім.", access: "Жалпы · Public", body: `ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ № [нөмірі]\n\n1.1. Осы келісім [күні] жасалған еңбек шартына өзгеріс енгізеді.\n1.2. Қызметкер [лауазымы] қызметіне ауыстырылады.\n2.1. Жалақы мөлшері [сома] теңге болып белгіленеді.\n2.2. Қалған шарттар өзгеріссіз қалады.` },
    { id: 3, title: "Бөлімше ережесі және функциялар матрицасы", desc: "Қайта құрылымдау кезіндегі ішкі департамент регламенті.", access: "Корпоративтік · Employee", body: `[БӨЛІМШЕ АТАУЫ] ТУРАЛЫ ЕРЕЖЕ\n\n1.1. Бөлімше ұйымның құрылымдық бөлімшесі болып табылады.\n1.2. Бөлімше өз қызметінде заңнаманы және ішкі регламентті басшылыққа алады.\n2.1. Құжаттарды автоматты талдауды қамтамасыз ету.\n2.2. Нормативтік құжаттар редакцияларындағы қақтығыстарды анықтау.\n3.1. Құжаттарды архивтеу және сақтау.` },
];
export default function Home() { return <LanguageProvider><ThemeProvider><Workspace /></ThemeProvider></LanguageProvider>; }
function Workspace() {
    const { tr, locale } = useLanguage();
    const [templateQuery, setTemplateQuery] = useState("");
    const [tab, setTab] = useState<Tab>("compare");
    const [a, setA] = useState(sampleA), [b, setB] = useState(sampleB), [report, setReport] = useState<Report | null>(null);
    const [templates, setTemplates] = useState(initialTemplates), [editorText, setEditorText] = useState(""), [editorTitle, setEditorTitle] = useState(tr("Құжат.txt"));
    const [settings, setSettings] = useState<UserSettings>({ autosaveDraft: true, editorFontSize: 14, editorWordWrap: true, editorSpellcheck: false });
    const [documentId, setDocumentId] = useState<string | null>(null), [editorVersion, setEditorVersion] = useState(0), [editorBusy, setEditorBusy] = useState(false);
    const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(null);
    const [openTemplate, setOpenTemplate] = useState<Template | null>(null), [notice, setNotice] = useState(""), [history, setHistory] = useState<HistoryRow[]>([]), [ready, setReady] = useState(false);
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null), [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
    const [authName, setAuthName] = useState(""), [authEmail, setAuthEmail] = useState(""), [authPassword, setAuthPassword] = useState(""), [authBusy, setAuthBusy] = useState(false);
    const [users, setUsers] = useState<UserRow[]>([]), [templateTitle, setTemplateTitle] = useState(""), [templateDesc, setTemplateDesc] = useState(""), [templateBody, setTemplateBody] = useState(""), [templateAccess, setTemplateAccess] = useState("public");
    const refreshAccountData = useCallback(async (user: SessionUser) => {
        const [templateResponse, historyResponse] = await Promise.all([fetch("/api/templates"), fetch("/api/history")]);
        if (templateResponse.ok) {
            const values = await templateResponse.json();
            setTemplates(values);
        }
        if (historyResponse.ok) {
            const rows = await historyResponse.json();
            setHistory(rows);
        }
        if (user.role === "admin") {
            const response = await fetch("/api/users");
            if (response.ok)
                setUsers(await response.json());
        }
    }, []);
    const restoreAccountDocument = useCallback(async () => {
        const response = await fetch("/api/documents/me");
        if (response.ok) {
            const doc = await response.json();
            setEditorText(doc.text || "");
            setEditorTitle(doc.title || "Құжат.txt");
            setDocumentId(doc.id || null);
            setEditorVersion(doc.version || 0);
        }
    }, []);
    // Restore editor data from browser storage after mount.
    useEffect(() => {
        queueMicrotask(() => {
            try {
                const storedSettings = localStorage.getItem("kt-agent-settings");
                if (storedSettings) {
                    const saved = JSON.parse(storedSettings);
                    setSettings({ autosaveDraft: true, editorFontSize: 14, editorWordWrap: true, editorSpellcheck: false, ...saved });
                }
                const raw = localStorage.getItem("kt-agent-state");
                if (raw) {
                    const d = JSON.parse(raw);
                    if (d.editorText)
                        setEditorText(d.editorText);
                }
            }
            catch { }
            setReady(true);
        });
        fetch("/api/auth/me").then(r => r.json()).then(async (d) => {
            if (d.user) {
                setSessionUser(d.user);
                await refreshAccountData(d.user);
                await restoreAccountDocument();
            }
        }).catch(() => { });
    }, [refreshAccountData, restoreAccountDocument]);
    useEffect(() => {
        if (ready) {
            if (settings.autosaveDraft)
                localStorage.setItem("kt-agent-state", JSON.stringify({ editorText }));
            else
                localStorage.removeItem("kt-agent-state");
            localStorage.setItem("kt-agent-settings", JSON.stringify(settings));
        }
    }, [ready, editorText, settings]);
    const nav: [
        Tab,
        string
    ][] = [["compare", tr("Талдау (A/B)")], ["documents", tr("Құжаттар")], ["templates", tr("Үлгілер")], ["editor", tr("Редактор")], ["history", tr("Тарих")], ["companies", tr("Компаниялар")], ["users", tr("Пайдаланушылар")], ["settings", tr("Баптаулар")]];
    const handleFile = (setter: (s: string) => void) => async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            setter(await readDocumentFile(file));
            setNotice(tr("{p0} файлы жүктелді", { p0: file.name }));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Файлды оқу мүмкін болмады."));
        }
        finally {
            e.target.value = "";
        }
    };
    const startAnalysis = async () => {
        if (!a.trim() || !b.trim()) {
            setNotice(tr("Екі құжатты да енгізіңіз."));
            return;
        }
        try {
            const response = await fetch("/api/analysis/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b }) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error);
            setReport(result);
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setNotice(tr("Талдау аяқталды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Талдау орындалмады"));
        }
    };
    const newDocument = (workspaceId?: string) => { setDocumentId(null); setEditorVersion(0); setEditorWorkspaceId(workspaceId || null); setEditorText(""); setEditorTitle(tr("Жаңа құжат.txt")); setTab("editor"); };
    const openDocument = (document: DocumentDetail, snapshot?: DocumentVersion) => { const latest = document.versions[document.versions.length - 1]; const selected = snapshot || latest; setDocumentId(document.id); setEditorVersion(latest.version); setEditorWorkspaceId(document.workspaceId || null); setEditorTitle(selected.title); setEditorText(selected.text); setTab("editor"); setNotice(snapshot && snapshot.version !== latest.version ? tr("v{p0} редакторда ашылды. Сақтау жаңа нұсқа жасайды.", { p0: snapshot.version }) : tr("«{p0}» редакторда ашылды.", { p0: document.title })); };
    const onDocumentDeleted = (id: string) => {
        if (documentId === id) {
            setDocumentId(null);
            setEditorVersion(0);
        }
    };
    const onDocumentsSaved = async () => {
        if (sessionUser)
            await refreshAccountData(sessionUser);
    };
    const editTemplate = async (t: Template) => {
        if (t.locked) {
            setNotice(tr("Бұл үлгі қызметкерлерге арналған."));
            return;
        }
        await fetch(`/api/templates/${t.id}/use`, { method: "POST" });
        setDocumentId(null);
        setEditorWorkspaceId(null);
        setEditorVersion(0);
        setEditorText(t.body);
        setEditorTitle(`${t.title}.txt`);
        setOpenTemplate(null);
        setTab("editor");
        setNotice(tr("«{p0}» үлгісі редакторда ашылды.", { p0: t.title }));
    };
    const saveEditor = async () => {
        if (editorBusy)
            return;
        if (!editorText.trim()) {
            setNotice(tr("Құжат мәтіні бос."));
            return;
        }
        setEditorBusy(true);
        try {
            const response = await fetch("/api/documents", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: editorText, title: editorTitle, documentId, baseVersion: editorVersion, workspaceId: editorWorkspaceId || undefined }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setDocumentId(data.id);
            setEditorVersion(data.version);
            setNotice(tr("«{p0}» серверге сақталды. Нұсқа: v{p1}", { p0: data.title, p1: data.version }));
            await onDocumentsSaved();
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Сақтау орындалмады"));
        }
        finally {
            setEditorBusy(false);
        }
    };
    const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setAuthBusy(true);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(`/api/auth/${authMode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: authName, email: authEmail, password: authPassword }), signal: controller.signal, cache: "no-store" });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || tr("Қате шықты"));
            setSessionUser(data.user);
            setAuthMode(null);
            setAuthName("");
            setAuthEmail("");
            setAuthPassword("");
            setNotice(authMode === "register" ? tr("Тіркелу сәтті аяқталды.") : tr("Жүйеге сәтті кірдіңіз."));
            void Promise.all([refreshAccountData(data.user), restoreAccountDocument()]).catch(() => {
                setNotice(tr("Аккаунтқа кірдіңіз, бірақ қосымша деректерді жүктеу мүмкін болмады. Бетті жаңартып көріңіз."));
            });
        }
        catch (error) {
            setNotice(controller.signal.aborted ? tr("Серверден жауап келмеді. Серверді қайта іске қосып, қайталап көріңіз.") : error instanceof Error ? tr(error.message) : tr("Қате шықты"));
        }
        finally {
            window.clearTimeout(timeout);
            setAuthBusy(false);
        }
    };
    const logout = async () => { await fetch("/api/auth/logout", { method: "POST" }).catch(() => { }); setSessionUser(null); setTemplates(initialTemplates); setUsers([]); setHistory([]); setTemplateQuery(""); setEditorText(""); setEditorTitle(tr("Құжат.txt")); setDocumentId(null); setEditorVersion(0); localStorage.removeItem("kt-agent-state"); setNotice(tr("Жүйеден шықтыңыз.")); };
    const downloadText = (text: string, filename: string, type = "text/plain;charset=utf-8") => { const url = URL.createObjectURL(new Blob(["\ufeff", text], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); };
    const exportReport = async () => {
        if (!report)
            return;
        try {
            const response = await fetch(`/api/analysis/${report.id}/export`);
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            downloadText(data.csv, `analysis-${report.id}.csv`, "text/csv;charset=utf-8");
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Экспорт орындалмады"));
        }
    };
    const createTemplate = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        try {
            const response = await fetch("/api/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: templateTitle, desc: templateDesc, body: templateBody, access: templateAccess }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setTemplateTitle("");
            setTemplateDesc("");
            setTemplateBody("");
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setNotice(tr("Үлгі серверге сақталды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Үлгіні сақтау орындалмады"));
        }
    };
    const changeRole = async (email: string, role: string) => {
        try {
            const response = await fetch(`/api/users/${encodeURIComponent(email)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setUsers(users.map(item => item.email === email ? data : item));
            setNotice(tr("Пайдаланушы рөлі жаңартылды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Рөлді жаңарту мүмкін болмады"));
        }
    };
    const deleteTemplate = async (t: Template) => {
        try {
            const response = await fetch(`/api/templates/${t.id}`, { method: "DELETE" });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setNotice(tr("Үлгі жойылды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Үлгіні жою мүмкін болмады"));
        }
    };
    const filteredTemplates = templates.filter(t => matchesSearch(templateQuery, [t.title, t.desc, t.locked ? "" : t.body, t.owner], locale));
    const filteredTemplateCount = filteredTemplates.length;
    const cards = filteredTemplates.map(t => <article key={t.id} className={`${card} flex min-h-60 flex-col gap-3 ${t.locked ? "opacity-60" : ""}`}><span className={`w-fit rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${t.locked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{t.locked ? tr("Құлыпталған 🔒") : tr(t.access === "public" || t.access === "Жалпы · Public" ? "Жалпы · Public" : "Корпоративтік · Employee")}</span><h3 className="font-bold">{tr(t.title)}</h3><p className="text-sm text-slate-500">{tr(t.desc)}</p><div className="mt-auto flex flex-wrap gap-2"><button disabled={t.locked} className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => t.locked ? setNotice(tr("Бұл үлгі қызметкерлерге арналған.")) : setOpenTemplate(t)}>{tr("Үлгіні ашу")}</button><button disabled={t.locked} className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => editTemplate(t)}>{tr("Үлгіні өзгерту")}</button>{!t.locked && <button className={`${button} border border-slate-200 bg-white text-slate-700`} onClick={() => downloadText(t.body, `template-${t.id}.txt`)}>⬇ .txt</button>}{!t.locked && sessionUser && (sessionUser.role === "admin" || t.owner === sessionUser.email) && <button className={`${button} border border-rose-200 bg-white text-rose-700`} onClick={() => deleteTemplate(t)}>{tr("Жою")}</button>}</div></article>);
    const viewProps: WorkspaceProps = { nav, tab, setTab, setOpenTemplate, sessionUser, setSessionUser, logout, setAuthMode, a, setA, b, setB, report, templates, editorText, setEditorText, editorTitle, setEditorTitle, documentId, editorVersion, editorBusy, newDocument, openDocument, onDocumentsSaved, onDocumentDeleted, settings, setSettings, openTemplate, notice, setNotice, history, templateQuery, setTemplateQuery, filteredTemplateCount, users, templateTitle, setTemplateTitle, templateDesc, setTemplateDesc, templateBody, setTemplateBody, templateAccess, setTemplateAccess, startAnalysis, handleFile, editTemplate, saveEditor, exportReport, createTemplate, changeRole, deleteTemplate, downloadText, cards, authMode, submitAuth, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, authBusy };
    return <div className="workspace-shell min-h-screen text-slate-900">
    <AppHeader props={viewProps}/>
    <MainContent props={viewProps}/>
    <AuthDialog props={viewProps}/>
    <AppFooter />
  </div>;
}
