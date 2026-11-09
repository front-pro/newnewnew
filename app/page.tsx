"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import { PreferencesProvider, usePreferences } from "./components/PreferencesProvider";
import Toast from "./components/Toast";
import AppHeader from "./components/AppHeader";
import MainContent from "./components/MainContent";
import AuthDialog from "./components/AuthDialog";
import AppFooter from "./components/AppFooter";
import { button, card } from "./components/styles";
import type { CompanyWorkspace, HistoryRow, WorkspaceProps } from "./components/workspace-context";
import { readDocumentFile } from "./lib/read-document";
import { matchesSearch } from "./lib/search";
import { LanguageProvider, useLanguage } from "./components/LanguageProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import type { DocumentDetail, DocumentVersion } from "./lib/documents";
type Tab = "dashboard" | "profile" | "compare" | "documents" | "templates" | "editor" | "history" | "approvals" | "company" | "users";
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
export default function Home() { return <LanguageProvider><ThemeProvider><PreferencesProvider><Workspace /></PreferencesProvider></ThemeProvider></LanguageProvider>; }
function Workspace() {
    const { tr, locale } = useLanguage();
    const { preferences } = usePreferences();
    const [templateQuery, setTemplateQuery] = useState("");
    const [tab, setTab] = useState<Tab>("dashboard");
    const [workspaces, setWorkspaces] = useState<CompanyWorkspace[]>([]);
    const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
    const [analysisBusy, setAnalysisBusy] = useState(false);
    const [analysisSources, setAnalysisSources] = useState({ a: "", b: "" });
    const [a, setA] = useState(sampleA), [b, setB] = useState(sampleB), [report, setReport] = useState<Report | null>(null);
    const [templates, setTemplates] = useState(initialTemplates), [editorText, setEditorText] = useState(""), [editorTitle, setEditorTitle] = useState(tr("Құжат.txt"));
    const [documentId, setDocumentId] = useState<string | null>(null), [editorVersion, setEditorVersion] = useState(0), [editorBusy, setEditorBusy] = useState(false);
    const [editorKey, setEditorKey] = useState(0);
    const [editorWorkspaceId, setEditorWorkspaceId] = useState<string | null>(null);
    const [openTemplate, setOpenTemplate] = useState<Template | null>(null), [notice, setNotice] = useState(""), [history, setHistory] = useState<HistoryRow[]>([]), [ready, setReady] = useState(false);
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null), [authMode, setAuthMode] = useState<"login" | "register" | "verify" | "reset" | "reset-confirm" | null>(null);
    const [authName, setAuthName] = useState(""), [authEmail, setAuthEmail] = useState(""), [authPassword, setAuthPassword] = useState(""), [authBusy, setAuthBusy] = useState(false);
    const [authToken, setAuthToken] = useState("");
    const [users, setUsers] = useState<UserRow[]>([]), [templateTitle, setTemplateTitle] = useState(""), [templateDesc, setTemplateDesc] = useState(""), [templateBody, setTemplateBody] = useState(""), [templateAccess, setTemplateAccess] = useState("public");
    const refreshAccountData = useCallback(async (user: SessionUser) => {
        const [templateResponse, historyResponse, workspaceResponse] = await Promise.all([fetch("/api/templates"), fetch("/api/history"), fetch("/api/workspaces")]);
        if (templateResponse.ok) {
            const values = await templateResponse.json();
            setTemplates(values);
        }
        if (historyResponse.ok) {
            const rows = await historyResponse.json();
            setHistory(rows);
        }
        if (workspaceResponse.ok) {
            const choices: CompanyWorkspace[] = await workspaceResponse.json();
            setWorkspaces(choices);
            setActiveWorkspaceId(current => current && choices.some(item => item.id === current) ? current : null);
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
        if (ready) { if (preferences.autosave) localStorage.setItem("kt-agent-state", JSON.stringify({ editorText })); else localStorage.removeItem("kt-agent-state"); }
    }, [ready, editorText, preferences.autosave]);
    const nav: [
        Tab,
        string
    ][] = activeWorkspaceId ? [["company", tr("Компаниялық жұмыс орны")], ...(tab === "editor" ? [["editor", tr("Құжат редакторы")] as [Tab, string]] : [])] : [["dashboard", tr("Басты бет")], ["compare", tr("Талдау (A/B)")], ["documents", tr("Құжаттар")], ["templates", tr("Үлгілер")], ["editor", tr("Редактор")], ["history", tr("Тарих")], ...(sessionUser ? [["approvals", tr("Бекітулер")] as [Tab, string]] : []), ["users", tr("Пайдаланушылар")], ...(sessionUser && workspaces.length === 0 ? [["company", tr("Компаниялық жұмыс орны")] as [Tab, string]] : [])];
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
        if (analysisBusy) return;
        if (!a.trim() || !b.trim()) {
            setNotice(tr("Екі құжатты да енгізіңіз."));
            return;
        }
        setAnalysisBusy(true); setReport(null);
        const sources = { a, b };
        try {
            const response = await fetch("/api/analysis/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b }) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error);
            setAnalysisSources(sources);
            setReport(result);
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setNotice(tr("Талдау аяқталды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Талдау орындалмады"));
        } finally { setAnalysisBusy(false); }
    };
    const newDocument = (workspaceId?: string) => { setEditorKey(key => key + 1); setDocumentId(null); setEditorVersion(0); setEditorWorkspaceId(workspaceId || null); setEditorText(""); setEditorTitle(tr("Жаңа құжат.txt")); setTab("editor"); };
    const openDocument = (document: DocumentDetail, snapshot?: DocumentVersion) => { setEditorKey(key => key + 1); const latest = document.versions[document.versions.length - 1]; const selected = snapshot || latest; setDocumentId(document.id); setEditorVersion(latest.version); setEditorWorkspaceId(document.workspaceId || null); setEditorTitle(selected.title); setEditorText(selected.text); setTab("editor"); setNotice(snapshot && snapshot.version !== latest.version ? tr("v{p0} редакторда ашылды. Сақтау жаңа нұсқа жасайды.", { p0: snapshot.version }) : tr("«{p0}» редакторда ашылды.", { p0: document.title })); };
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
            const endpoint = authMode === "reset" ? "password-reset" : authMode === "reset-confirm" ? "password-reset/confirm" : authMode;
            const payload = authMode === "register" ? { name: authName, email: authEmail, password: authPassword } : authMode === "verify" ? { email: authEmail, token: authToken } : authMode === "reset-confirm" ? { email: authEmail, token: authToken, password: authPassword } : { email: authEmail, ...(authMode === "login" ? { password: authPassword } : {}) };
            const response = await fetch(`/api/auth/${endpoint}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload), signal: controller.signal, cache: "no-store" });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error || tr("Қате шықты"));
            if (authMode === "register") {
                setAuthMode("verify");
                setAuthToken(data.verificationToken || "");
                setAuthPassword("");
                setNotice(data.verificationToken ? tr("Растау кодын енгізіңіз.") : tr("Email-ға жіберілген растау кодын енгізіңіз."));
                return;
            }
            if (authMode === "reset") {
                if (data.resetToken) { setAuthToken(data.resetToken); setAuthMode("reset-confirm"); setNotice(tr("Жаңа құпиясөзді енгізіңіз.")); }
                else { setAuthMode(null); setNotice(data.message || tr("Егер бұл email аккаунтқа тіркелген болса, нұсқаулық жіберілді.")); }
                return;
            }
            if (authMode === "reset-confirm") {
                setAuthMode("login"); setAuthToken(""); setAuthPassword(""); setNotice(tr("Құпиясөз жаңартылды. Жаңа құпиясөзбен кіріңіз."));
                return;
            }
            setSessionUser(data.user);
            setAuthMode(null);
            setAuthName("");
            setAuthEmail("");
            setAuthPassword("");
            setAuthToken("");
            setNotice(authMode === "verify" ? tr("Email расталды. Жүйеге сәтті кірдіңіз.") : tr("Жүйеге сәтті кірдіңіз."));
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
    const resendVerification = async () => {
        setAuthBusy(true);
        try {
            const response = await fetch("/api/auth/verify/resend", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: authEmail }), cache: "no-store" });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || tr("Қате шықты"));
            if (data.verificationToken) setAuthToken(data.verificationToken);
            setNotice(tr("Email-ға жаңа растау коды жіберілді."));
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Қате шықты")); }
        finally { setAuthBusy(false); }
    };
    const logout = async () => {
        let serverLogoutFailed = false;
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 8000);
        try {
            const response = await fetch("/api/auth/logout", { method: "POST", signal: controller.signal, cache: "no-store" });
            if (!response.ok) serverLogoutFailed = true;
        } catch { serverLogoutFailed = true; }
        finally { window.clearTimeout(timeout); }
        setSessionUser(null); setWorkspaces([]); setActiveWorkspaceId(null); setTab("compare"); setTemplates(initialTemplates); setUsers([]); setHistory([]); setTemplateQuery(""); setEditorText(""); setEditorTitle(tr("Құжат.txt")); setDocumentId(null); setEditorVersion(0); setEditorWorkspaceId(null); localStorage.removeItem("kt-agent-state");
        setNotice(tr(serverLogoutFailed ? "Осы құрылғыдан шықтыңыз, бірақ сервердегі сессияны тоқтату мүмкін болмады. Қайта кірмес бұрын серверді тексеріңіз." : "Жүйеден шықтыңыз."));
    };
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
    const cards = filteredTemplates.map(t => <article key={t.id} className={`${card} interactive-card flex min-h-60 flex-col gap-3 ${t.locked ? "opacity-60" : ""}`}><span className={`w-fit rounded-md border px-2 py-1 font-mono text-[11px] font-semibold ${t.locked ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>{t.locked ? tr("Құлыпталған 🔒") : tr(t.access === "public" || t.access === "Жалпы · Public" ? "Жалпы · Public" : "Корпоративтік · Employee")}</span><h3 className="font-bold">{tr(t.title)}</h3><p className="text-sm text-slate-500">{tr(t.desc)}</p><div className="mt-auto flex flex-wrap gap-2"><button disabled={t.locked} className={`${button} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`} onClick={() => t.locked ? setNotice(tr("Бұл үлгі қызметкерлерге арналған.")) : setOpenTemplate(t)}>{tr("Үлгіні ашу")}</button><button disabled={t.locked} className={`${button} bg-blue-600 text-white hover:bg-blue-700`} onClick={() => editTemplate(t)}>{tr("Үлгіні өзгерту")}</button>{!t.locked && <button className={`${button} border border-slate-200 bg-white text-slate-700`} onClick={() => downloadText(t.body, `template-${t.id}.txt`)}>⬇ .txt</button>}{!t.locked && sessionUser && (sessionUser.role === "admin" || t.owner === sessionUser.email) && <button className={`${button} border border-rose-200 bg-white text-rose-700`} onClick={() => deleteTemplate(t)}>{tr("Жою")}</button>}</div></article>);
    const viewProps: WorkspaceProps = { nav, tab, setTab, workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, setOpenTemplate, sessionUser, setSessionUser, logout, setAuthMode, a, setA, b, setB, report, analysisBusy, analysisSources, templates, editorText, setEditorText, editorTitle, setEditorTitle, editorKey, documentId, editorVersion, editorBusy, newDocument, openDocument, onDocumentsSaved, onDocumentDeleted, openTemplate, notice, setNotice, history, templateQuery, setTemplateQuery, filteredTemplateCount, users, templateTitle, setTemplateTitle, templateDesc, setTemplateDesc, templateBody, setTemplateBody, templateAccess, setTemplateAccess, startAnalysis, handleFile, editTemplate, saveEditor, exportReport, createTemplate, changeRole, deleteTemplate, downloadText, cards, authMode, submitAuth, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, authToken, setAuthToken, authBusy, resendVerification };
    const dismissNotice = () => setNotice("");
    return <div className="workspace-shell min-h-screen text-slate-900">
    <Toast message={notice} dismiss={dismissNotice} />
    <AppHeader props={viewProps}/>
    <div className="app-content xl:ml-64"><MainContent props={viewProps}/><AppFooter /></div>
    <AuthDialog props={viewProps}/>
  </div>;
}
