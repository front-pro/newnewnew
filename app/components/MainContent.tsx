"use client";

import { useLanguage } from "./LanguageProvider";
import AccountPage from "./AccountPage";
import AnalysisPage from "./AnalysisPage";
import ApprovalInbox from "./ApprovalInbox";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspacePage from "./CompanyWorkspacePage";
import Dashboard from "./Dashboard";
import DocumentsPage from "./DocumentsPage";
import EditorPage from "./EditorPage";
import HistoryPage from "./HistoryPage";
import TemplatesPage from "./TemplatesPage";
import type { WorkspaceProps } from "./workspace-context";

export default function MainContent({ props }: { props: WorkspaceProps }) {
  const { tab, sessionUser, setNotice } = props;
  const { tr } = useLanguage();

  return <main key={tab} className={tab === "company" ? "page-enter" : "mx-auto max-w-7xl page-enter space-y-6 px-4 py-7 md:px-8"}>
    {props.canGoBack && <button onClick={props.goBackTab} aria-label={tr("Артқа қайту")} title={tr("Артқа қайту")} className="group -ml-2 inline-flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-white hover:text-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><span className="text-xl leading-none transition-transform group-hover:-translate-x-0.5" aria-hidden="true">←</span></button>}
    {tab === "dashboard" && <Dashboard key={sessionUser?.id || "guest"} props={props} />}
    {tab === "documents" && <DocumentsPage key={sessionUser?.id || "guest"} props={props} />}
    {tab === "company" && (props.activeWorkspaceId ? <CompanyWorkspacePage props={props} /> : <CompaniesPage user={sessionUser} setNotice={setNotice} onWorkspaceCreated={workspace => { props.setWorkspaces(current => [...current.filter(item => item.id !== workspace.id), workspace]); props.setActiveWorkspaceId(workspace.id); props.setTab("company"); }} />)}
    {tab === "compare" && <AnalysisPage props={props} />}
    {tab === "templates" && <TemplatesPage props={props} />}
    {tab === "editor" && sessionUser && <EditorPage key={`${props.documentId || "new"}-${props.editorKey}`} props={props} />}
    {tab === "editor" && !sessionUser && <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold">{tr("Редактор жабық")}</h1><p className="my-2 text-sm text-slate-500">{tr("Құжаттарды өңдеу және сақтау үшін жүйеге кіріңіз.")}</p><button onClick={() => props.setAuthMode("login")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{tr("Кіру")}</button></section>}
    {tab === "history" && sessionUser && <HistoryPage props={props} />}
    {tab === "history" && !sessionUser && <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><h1 className="text-xl font-bold">{tr("Тарих қолжетімсіз")}</h1><p className="my-2 text-sm text-slate-500">{tr("Тарихты сақтау үшін жүйеге кіріңіз.")}</p><button onClick={() => props.setAuthMode("login")} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">{tr("Кіру")}</button></section>}
    {tab === "approvals" && sessionUser && <ApprovalInbox setNotice={setNotice} />}
    {tab === "profile" && <AccountPage props={props} />}
    {tab === "users" && <AccountPage props={props} mode="users" />}
  </main>;
}
