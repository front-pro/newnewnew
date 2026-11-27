"use client";
import { ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { PreferencesProvider, usePreferences } from "./components/PreferencesProvider";
import Toast from "./components/Toast";
import AppHeader from "./components/AppHeader";
import MainContent from "./components/MainContent";
import AuthDialog from "./components/AuthDialog";
import AppFooter from "./components/AppFooter";
import TemplateCard from "./components/TemplateCard";
import type { CompanyWorkspace, HistoryRow, WorkspaceProps } from "./components/workspace-context";
import { readDocumentFile } from "./lib/read-document";
import { editorHtmlToText } from "./lib/editor-content";
import { matchesSearch } from "./lib/search";
import { LanguageProvider, useLanguage } from "./components/LanguageProvider";
import { ThemeProvider } from "./components/ThemeProvider";
import type { DocumentDetail, DocumentVersion } from "./lib/documents";
import { canAccessModule, type AccessModule } from "./lib/access-control";
type Tab = "dashboard" | "profile" | "compare" | "documents" | "templates" | "template-editor" | "editor" | "history" | "approvals" | "company" | "users";
type Template = {
    id: number;
    title: string;
    desc: string;
    body: string;
    access: string;
    owner?: string;
    locked?: boolean;
    category?: "document" | "table";
    design?: { theme: "classic" | "modern" | "minimal"; accent: string };
};
type Change = {
    id: number;
    type: string;
    title: string;
    description: string;
    a: string;
    b: string;
};
type AiComparison = { summary: string; overallRisk: "low" | "medium" | "high"; findings: { changeId: number; whatChanged: string; impact: string; severity: "low" | "medium" | "high"; recommendation: string }[] };
type Report = {
    id: number;
    isSaved?: boolean;
    summary: string;
    metrics: { total: number; conflicts: number; lost: number; news: number; changed: number };
    changes: Change[];
    aiAnalysis?: AiComparison;
    aiAnalysisError?: string;
};
type SessionUser = {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions?: AccessModule[] | null;
    emailVerified?: boolean;
};
type UserRow = {
    id?: string;
    name: string;
    email: string;
    role: string;
    permissions?: AccessModule[];
    emailVerified?: boolean;
    avatar?: string | null;
    company?: string;
    position?: string;
    documents?: { id: string; title: string; source: string; createdAt: string; updatedAt: string }[];
    activity?: { type: string; title: string; meta: string; documentId?: string }[];
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
    const [tab, setTabState] = useState<Tab>("dashboard");
    const tabHistory = useRef<Tab[]>([]);
    useEffect(() => {
        const validTabs: Tab[] = ["dashboard", "profile", "compare", "documents", "templates", "template-editor", "editor", "history", "approvals", "company", "users"];
        const readLocation = () => {
            const requested = new URL(window.location.href).searchParams.get("page") as Tab | null;
            if (requested && validTabs.includes(requested)) setTabState(requested);
            else setTabState("dashboard");
        };
        readLocation();
        window.addEventListener("popstate", readLocation);
        return () => window.removeEventListener("popstate", readLocation);
    }, []);
    const setTab: Dispatch<SetStateAction<Tab>> = action => {
        const next = typeof action === "function" ? action(tab) : action;
        if (next !== tab) {
            tabHistory.current.push(tab);
            const url = next === "dashboard" ? "/" : `/?page=${encodeURIComponent(next)}`;
            window.history.pushState({ page: next }, "", url);
        }
        setTabState(next);
    };
    const goBackTab = () => {
        const previous = tabHistory.current.pop();
        if (previous) {
            setTabState(previous);
            window.history.replaceState({ page: previous }, "", previous === "dashboard" ? "/" : `/?page=${encodeURIComponent(previous)}`);
        }
    };
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
    const [sessionUser, setSessionUser] = useState<SessionUser | null>(null), [authMode, setAuthMode] = useState<"login" | "register" | "verify" | "reset" | "reset-confirm" | null>(null), [isImpersonating, setIsImpersonating] = useState(false);
    const [authName, setAuthName] = useState(""), [authEmail, setAuthEmail] = useState(""), [authPassword, setAuthPassword] = useState(""), [authBusy, setAuthBusy] = useState(false);
    const [authToken, setAuthToken] = useState("");
    const [users, setUsers] = useState<UserRow[]>([]), [templateTitle, setTemplateTitle] = useState(""), [templateDesc, setTemplateDesc] = useState(""), [templateBody, setTemplateBody] = useState(""), [templateAccess, setTemplateAccess] = useState("public");
    const [templateDesign, setTemplateDesign] = useState<{ theme: "classic" | "modern" | "minimal"; accent: string }>({ theme: "classic", accent: "#2563eb" });
    const [templateCategory, setTemplateCategory] = useState<"document" | "table">("document");
    const [templateEditingId, setTemplateEditingId] = useState<number | null>(null);
    const beginTemplateDesign = (template?: Template) => {
        setOpenTemplate(null);
        setTemplateEditingId(template?.id || null);
        setTemplateTitle(template?.title || ""); setTemplateDesc(template?.desc || ""); setTemplateBody(template?.body || ""); setTemplateAccess(template?.access || "public");
        setTemplateCategory(template?.category || (template?.body?.includes("<table") ? "table" : "document"));
        setTemplateDesign(template?.design || { theme: "classic", accent: "#2563eb" });
        setTab("template-editor");
    };
    const refreshUsers = useCallback(async () => {
        const response = await fetch("/api/users", { cache: "no-store" });
        if (!response.ok) throw new Error("Пайдаланушылар тізімін жаңарту мүмкін болмады");
        setUsers(await response.json());
    }, []);
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
        if (user.role === "admin") await refreshUsers();
    }, [refreshUsers]);
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
        fetch("/api/admin/act-as", { cache: "no-store" }).then(response => response.json()).then(data => setIsImpersonating(!!data.active)).catch(() => {});
    }, [refreshAccountData, restoreAccountDocument]);
    const startImpersonation = useCallback(async (email: string) => {
        const response = await fetch("/api/admin/act-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || tr("Аккаунтты ашу мүмкін болмады"));
        setIsImpersonating(true); setSessionUser(data.user); setTab("dashboard"); setActiveWorkspaceId(null); setNotice(tr("Пайдаланушы аккаунты ашылды. Қайтару батырмасы жоғарғы панельде."));
        await refreshAccountData(data.user);
    }, [refreshAccountData, tr]);
    const stopImpersonation = useCallback(async () => {
        const response = await fetch("/api/admin/act-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stop" }) });
        const data = await response.json(); if (!response.ok) throw new Error(data.error || tr("Әкімші аккаунтына оралу мүмкін болмады"));
        setIsImpersonating(false); setSessionUser(data.user); setTab("users"); await refreshAccountData(data.user);
    }, [refreshAccountData, tr]);
    useEffect(() => {
        if (ready) { if (preferences.autosave) localStorage.setItem("kt-agent-state", JSON.stringify({ editorText })); else localStorage.removeItem("kt-agent-state"); }
    }, [ready, editorText, preferences.autosave]);
    const allNav: [
        Tab,
        string
    ][] = activeWorkspaceId ? [["company", tr("Компаниялық жұмыс орны")], ...(tab === "editor" ? [["editor", tr("Құжат редакторы")] as [Tab, string]] : [])] : [["dashboard", tr("Басты бет")], ["compare", tr("Талдау (A/B)")], ["documents", tr("Құжаттар")], ["templates", tr("Үлгілер")], ["editor", tr("Редактор")], ["history", tr("Тарих")], ...(sessionUser ? [["approvals", tr("Бекітулер")] as [Tab, string]] : []), ["users", tr("Әкімші панелі")], ...(sessionUser && workspaces.length === 0 ? [["company", tr("Компаниялық жұмыс орны")] as [Tab, string]] : [])];
    const nav = allNav.filter(([id]) => id === "users" || id === "template-editor" || canAccessModule(sessionUser, id));
    const handleFile = (setter: (s: string) => void) => async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            const imported = await readDocumentFile(file);
            setter(/<(?:p|div|table|tr|td|th)\b/i.test(imported) ? editorHtmlToText(imported) : imported);
            setNotice(tr("{p0} файлы жүктелді", { p0: file.name }));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Файлды оқу мүмкін болмады."));
        }
        finally {
            e.target.value = "";
        }
    };
    const startAnalysis = async (withAi = false) => {
        const aiEnabled = withAi === true;
        if (analysisBusy) return;
        if (!a.trim() || !b.trim()) {
            setNotice(tr("Екі құжатты да енгізіңіз."));
            return;
        }
        setAnalysisBusy(true); setReport(null);
        const sources = { a, b };
        try {
            const response = await fetch("/api/analysis/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a, b, withAi: aiEnabled, language: locale }) });
            const result = await response.json();
            if (!response.ok)
                throw new Error(result.error);
            setAnalysisSources(sources);
            setReport(result);
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setNotice(result.aiAnalysisError ? tr(result.aiAnalysisError) : tr("Талдау аяқталды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Талдау орындалмады"));
        } finally { setAnalysisBusy(false); }
    };
    const openAnalysis = async (id: string) => {
        try {
            const response = await fetch(`/api/analysis/${encodeURIComponent(id)}`);
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Талдау ашылмады");
            setReport(result);
            setTab("compare");
        } catch (error) { setNotice(error instanceof Error ? error.message : "Талдау ашылмады"); }
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
        if (isImpersonating) await stopImpersonation();
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
            const response = await fetch(templateEditingId ? `/api/templates/${templateEditingId}` : "/api/templates", { method: templateEditingId ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: templateTitle, desc: templateDesc, body: templateBody, access: templateAccess, category: templateCategory, design: templateDesign }) });
            const data = await response.json();
            if (!response.ok)
                throw new Error(data.error);
            setTemplateTitle("");
            setTemplateDesc("");
            setTemplateBody("");
            setTemplateEditingId(null);
            setTemplateCategory("document");
            setOpenTemplate(null);
            if (sessionUser)
                await refreshAccountData(sessionUser);
            setTab("templates");
            setNotice(tr(templateEditingId ? "Үлгі жаңартылды." : "Үлгі серверге сақталды."));
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
            setUsers(current => current.map(item => item.email === email ? { ...item, ...data } : item));
            setNotice(tr("Пайдаланушы рөлі жаңартылды."));
        }
        catch (error) {
            setNotice(error instanceof Error ? tr(error.message) : tr("Рөлді жаңарту мүмкін болмады"));
        }
    };
    const changePermissions = async (email: string, permissions: AccessModule[]) => {
        try {
            const response = await fetch(`/api/users/${encodeURIComponent(email)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ permissions }) });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Қолжетімділікті өзгерту мүмкін болмады");
            setUsers(current => current.map(item => item.email === email ? { ...item, ...data } : item));
            setNotice(tr("Қолжетімділік жаңартылды."));
        } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Қолжетімділікті өзгерту мүмкін болмады")); }
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
    const cards = filteredTemplates.map(template => <TemplateCard key={template.id} template={template} onOpen={()=>setOpenTemplate(template)} onUse={()=>void editTemplate(template)} onDownload={()=>downloadText(template.body, `template-${template.id}.txt`)} onDelete={!template.locked && sessionUser && (sessionUser.role === "admin" || template.owner === sessionUser.email) ? ()=>void deleteTemplate(template) : undefined}/>);
    const viewProps: WorkspaceProps = { nav, tab, setTab, goBackTab, canGoBack: tabHistory.current.length > 0, workspaces, setWorkspaces, activeWorkspaceId, setActiveWorkspaceId, setOpenTemplate, sessionUser, setSessionUser, isImpersonating, startImpersonation, stopImpersonation, logout, setAuthMode, a, setA, b, setB, report, analysisBusy, analysisSources, templates, editorText, setEditorText, editorTitle, setEditorTitle, editorKey, documentId, editorVersion, editorBusy, newDocument, openDocument, onDocumentsSaved, onDocumentDeleted, openTemplate, notice, setNotice, history, setHistory, templateQuery, setTemplateQuery, filteredTemplateCount, users, refreshUsers, templateTitle, setTemplateTitle, templateDesc, setTemplateDesc, templateBody, setTemplateBody, templateAccess, setTemplateAccess, templateCategory, setTemplateCategory, templateDesign, setTemplateDesign, templateEditingId, setTemplateEditingId, beginTemplateDesign, startAnalysis, openAnalysis, handleFile, editTemplate, saveEditor, exportReport, createTemplate, changeRole, changePermissions, deleteTemplate, downloadText, cards, authMode, submitAuth, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, authToken, setAuthToken, authBusy, resendVerification };
    const dismissNotice = () => setNotice("");
    return <div className="workspace-shell min-h-screen text-slate-900">
    <Toast message={notice} dismiss={dismissNotice} />
    {isImpersonating && <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-between gap-3 bg-amber-400 px-4 py-2.5 text-sm font-semibold text-amber-950 shadow-md"><span>{tr("Сіз пайдаланушы аккаунтын әкімші ретінде қарап отырсыз")}: {sessionUser?.name} · {sessionUser?.email}</span><button onClick={() => void stopImpersonation().catch(error => setNotice(tr(error instanceof Error ? error.message : "Әкімші аккаунтына оралу мүмкін болмады")))} className="rounded-lg bg-amber-950 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-900">{tr("Әкімшіге оралу")}</button></div>}
    <AppHeader props={viewProps}/>
    <div className={`app-content ${tab === "company" ? "" : "xl:ml-64"}`}><MainContent props={viewProps}/><AppFooter /></div>
    <AuthDialog props={viewProps}/>
  </div>;
}
