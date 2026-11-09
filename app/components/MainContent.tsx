"use client";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
import SearchField from "./SearchField";
import AnalysisPage from "./AnalysisPage";
import EditorPage from "./EditorPage";
import ProfilePage from "./ProfilePage";
import Dashboard from "./Dashboard";
import DocumentsPage from "./DocumentsPage";
import HistoryPage from "./HistoryPage";
import CompaniesPage from "./CompaniesPage";
import CompanyWorkspacePage from "./CompanyWorkspacePage";

import ApprovalInbox from "./ApprovalInbox";
export default function MainContent({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { tab, openTemplate, setOpenTemplate, history, templateQuery, setTemplateQuery, filteredTemplateCount, templates, sessionUser, setAuthMode, users, templateTitle, setTemplateTitle, templateDesc, setTemplateDesc, templateBody, setTemplateBody, templateAccess, setTemplateAccess, editTemplate, createTemplate, changeRole, cards, setNotice } = props;
  return (
    <main key={tab} className="mx-auto max-w-7xl page-enter space-y-6 px-4 py-7 md:px-8">
      {tab === "dashboard" && <Dashboard key={sessionUser?.id || "guest"} props={props}/>}
      {tab === "documents" && <DocumentsPage key={sessionUser?.id || "guest"} props={props} />}
      {tab === "company" && (props.activeWorkspaceId ? <CompanyWorkspacePage props={props} /> : <CompaniesPage user={sessionUser} setNotice={setNotice} onWorkspaceCreated={workspace => { props.setWorkspaces(current => [...current.filter(item => item.id !== workspace.id), workspace]); props.setActiveWorkspaceId(workspace.id); props.setTab("company"); }} />)}
      {tab === "compare" && <AnalysisPage props={props}/>}
      {tab === "templates" && !sessionUser && <section className={`${card} text-center`}><h2 className="text-xl font-bold">{tr("Үлгілер кітапханасы жабық")}</h2><p className="my-2 text-sm text-slate-500">{tr("Үлгілерді көру үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>}
      {tab === "templates" && sessionUser && <><div className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Құжат үлгілерінің кітапханасы")}</h1><p className="mt-1 text-slate-500">{tr("Үлгіні ашып қарап, редакторда өзгертіңіз")}</p></div>{openTemplate ? <section className={`${card} space-y-4`}><div><h2 className="text-2xl font-bold">{tr(openTemplate.title)}</h2><p className="text-slate-500">{tr(openTemplate.desc)}</p></div><pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-sm">{openTemplate.body}</pre><div className="flex gap-2"><button onClick={() => editTemplate(openTemplate)} className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні өзгерту")}</button><button onClick={() => setOpenTemplate(null)} className={`${button} border border-slate-200 bg-white`}>{tr("Үлгілерге қайту")}</button></div></section> : <><SearchField value={templateQuery} onChange={setTemplateQuery} label={tr("Үлгілерден іздеу")} placeholder={tr("Атауы, сипаттамасы немесе мәтіні бойынша іздеу…")} count={filteredTemplateCount} total={templates.length}/><div className="grid gap-5 md:grid-cols-3">{cards}</div>{!filteredTemplateCount && <p className={`${card} text-center text-sm text-slate-500`}>{tr("Үлгілер табылмады. Іздеу сөзін өзгертіңіз.")}</p>}{["employee", "admin"].includes(sessionUser.role) && <form onSubmit={createTemplate} className={`${card} space-y-3`}><h2 className="font-semibold">➕ {tr("Жаңа үлгі қосу")}</h2><div className="grid gap-3 md:grid-cols-3"><input required minLength={3} value={templateTitle} onChange={e => setTemplateTitle(e.target.value)} placeholder={tr("Атауы")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><input value={templateDesc} onChange={e => setTemplateDesc(e.target.value)} placeholder={tr("Қысқаша сипаттама")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={templateAccess} onChange={e => setTemplateAccess(e.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="public">{tr("Жалпы")}</option><option value="employee">{tr("Тек қызметкерлерге")}</option></select></div><textarea required value={templateBody} onChange={e => setTemplateBody(e.target.value)} placeholder={tr("Үлгі мәтіні...")} className="h-32 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"/><button className={`${button} bg-emerald-600 text-white`}>{tr("Үлгіні серверге сақтау")}</button></form>}</>}</>}
      {tab === "editor" && !sessionUser && <section className={`${card} text-center`}><h2 className="text-xl font-bold">{tr("Редактор жабық")}</h2><p className="my-2 text-sm text-slate-500">{tr("Құжаттарды өңдеу және сақтау үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>}
      {tab === "editor" && sessionUser && <EditorPage key={`${props.documentId || "new"}-${props.editorKey}`} props={props}/>}
      {tab === "history" && !sessionUser && <section className={`${card} text-center`}><h2 className="text-xl font-bold">{tr("Тарих қолжетімсіз")}</h2><p className="my-2 text-sm text-slate-500">{tr("Тарихты сақтау үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>}
      {tab === "history" && sessionUser && <HistoryPage history={history} />}
      {tab === "approvals" && sessionUser && <ApprovalInbox setNotice={setNotice}/>}
      {tab === "profile" && <ProfilePage key={sessionUser?.id || "guest"} props={props}/>}
      {tab === "users" && sessionUser?.role === "admin" && <><div><h1 className="text-3xl font-bold">{tr("Пайдаланушыларды басқару")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Аккаунттарға рөл беру (RBAC)")}</p></div><section className={card}>{users.map(user=><div key={user.email} className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 py-4"><div><b className="text-sm">{user.name}</b><p className="text-xs text-slate-400">{user.email}</p></div><select value={user.role} disabled={user.email===sessionUser.email} onChange={e=>changeRole(user.email,e.target.value)} className="rounded-xl border border-slate-200 bg-white p-2 text-sm"><option value="user">{tr("Пайдаланушы")}</option><option value="employee">{tr("Қызметкер")}</option><option value="admin">{tr("Әкімші")}</option></select></div>)}</section></>}
      {tab === "users" && sessionUser?.role !== "admin" && <ProfilePage key={sessionUser?.id || "guest"} props={props}/>}
    </main>
  );
}
