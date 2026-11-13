"use client";

import { useLanguage } from "./LanguageProvider";
import AccountPage from "./AccountPage";
import ProfilePage from "./ProfilePage";
import AnalysisPage from "./AnalysisPage";
import ApprovalInbox from "./ApprovalInbox";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspacePage from "./CompanyWorkspacePage";
import Dashboard from "./Dashboard";
import DocumentsPage from "./DocumentsPage";
import EditorPage from "./EditorPage";
import HistoryPage from "./HistoryPage";
import Icon from "./Icon";
import TemplatesPage from "./TemplatesPage";
import type { WorkspaceProps } from "./workspace-context";

export default function MainContent({ props }: { props: WorkspaceProps }) {
  const { tab, sessionUser, setNotice } = props;
  const { tr } = useLanguage();

  return <main key={tab} className={tab === "company" ? "page-enter" : "mx-auto max-w-7xl page-enter space-y-6 px-4 py-7 md:px-8"}>
    {props.canGoBack && <button onClick={props.goBackTab} aria-label={tr("Алдыңғы бетке қайту")} title={tr("Алдыңғы бетке қайту")} className="group -ml-1 inline-flex size-9 items-center justify-center rounded-lg text-slate-600 transition hover:bg-white hover:text-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"><Icon name="arrowLeft" className="size-5 transition-transform group-hover:-translate-x-0.5"/></button>}
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
    {tab === "profile" && <><ProfilePage props={props} />{sessionUser && <AccountPage props={props} mode="delete" />}</>}
    {tab === "users" && <AccountPage props={props} mode="users" />}
  </main>;
}
