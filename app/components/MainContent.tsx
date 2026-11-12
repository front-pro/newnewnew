"use client";

import { useLanguage } from "./LanguageProvider";
import AccountPage from "./AccountPage";
import ApprovalInbox from "./ApprovalInbox";
import ComparePage from "./ComparePage";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspacePage from "./CompanyWorkspacePage";
import DocumentsPage from "./DocumentsPage";
import EditorPage from "./EditorPage";
import HistoryPage from "./HistoryPage";
import TemplatesPage from "./TemplatesPage";
import type { WorkspaceProps } from "./workspace-context";

export default function MainContent({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { tab, notice, setNotice, sessionUser } = props;

  return <main className="mx-auto max-w-7xl space-y-6 px-4 py-7 md:px-8">
    {notice && <div role="status" className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{notice}<button onClick={() => setNotice("")} className="float-right font-bold" aria-label={tr("Хабарламаны жабу")}>×</button></div>}

    {tab === "compare" && <ComparePage props={props} />}
    {tab === "documents" && <DocumentsPage key={sessionUser?.id || "guest"} props={props} />}
    {tab === "company" && (props.activeWorkspaceId ? <CompanyWorkspacePage props={props} /> : <CompaniesPage user={sessionUser} setNotice={setNotice} onWorkspaceCreated={workspace => { props.setWorkspaces(current => [...current.filter(item => item.id !== workspace.id), workspace]); props.setActiveWorkspaceId(workspace.id); props.setTab("company"); }} />)}
    {tab === "templates" && <TemplatesPage props={props} />}
    {tab === "editor" && <EditorPage props={props} />}
    {tab === "history" && (sessionUser ? <HistoryPage history={props.history} /> : <AccountPage props={props} />)}
    {tab === "approvals" && sessionUser && <ApprovalInbox setNotice={setNotice} />}
    {tab === "users" && <AccountPage props={props} />}
  </main>;
}
