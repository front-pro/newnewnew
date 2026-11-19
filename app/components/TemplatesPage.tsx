"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import SearchField from "./SearchField";
import type { WorkspaceProps } from "./workspace-context";

export default function TemplatesPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { sessionUser, openTemplate, setOpenTemplate, cards, editTemplate, templateTitle, setTemplateTitle, templateDesc, setTemplateDesc, templateBody, setTemplateBody, templateAccess, setTemplateAccess, createTemplate, setAuthMode, templateQuery, setTemplateQuery, filteredTemplateCount, templates } = props;

  if (!sessionUser) return <section className={`${card} text-center`}><h1 className="text-xl font-bold">{tr("Үлгілер кітапханасы жабық")}</h1><p className="my-2 text-sm text-slate-500">{tr("Үлгілерді көру үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>;

  return <div className="space-y-6">
    <header className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Құжат үлгілерінің кітапханасы")}</h1><p className="mt-1 text-slate-500">{tr("Үлгіні ашып қарап, редакторда өзгертіңіз")}</p></header>
    {openTemplate ? <section className={`${card} space-y-4`}><div><h2 className="text-2xl font-bold">{tr(openTemplate.title)}</h2><p className="text-slate-500">{tr(openTemplate.desc)}</p></div><pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-slate-50 p-5 font-mono text-sm">{openTemplate.body}</pre><div className="flex gap-2"><button onClick={() => void editTemplate(openTemplate)} className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні өзгерту")}</button><button onClick={() => setOpenTemplate(null)} className={`${button} border border-slate-200 bg-white`}>{tr("Үлгілерге қайту")}</button></div></section> : <>
      <SearchField value={templateQuery} onChange={setTemplateQuery} label={tr("Үлгілерден іздеу")} placeholder={tr("Атауы, сипаттамасы немесе мәтіні бойынша іздеу...")} count={filteredTemplateCount} total={templates.length}/>
      <div className="grid gap-5 md:grid-cols-3">{cards}</div>
      {!filteredTemplateCount && <p className={`${card} text-center text-sm text-slate-500`}>{tr("Үлгілер табылмады. Іздеу сөзін өзгертіңіз.")}</p>}
      {["employee", "admin"].includes(sessionUser.role) && <form onSubmit={createTemplate} className={`${card} space-y-3`}><h2 className="font-semibold">➕ {tr("Жаңа үлгі қосу")}</h2><div className="grid gap-3 md:grid-cols-3"><input required minLength={3} value={templateTitle} onChange={event => setTemplateTitle(event.target.value)} placeholder={tr("Атауы")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><input value={templateDesc} onChange={event => setTemplateDesc(event.target.value)} placeholder={tr("Қысқаша сипаттама")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={templateAccess} onChange={event => setTemplateAccess(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="public">{tr("Жалпы")}</option><option value="employee">{tr("Тек қызметкерлерге")}</option></select></div><textarea required value={templateBody} onChange={event => setTemplateBody(event.target.value)} placeholder={tr("Үлгі мәтіні...")} className="h-32 w-full rounded-xl border border-slate-200 p-3 font-mono text-sm"/><button className={`${button} bg-emerald-600 text-white`}>{tr("Үлгіні серверге сақтау")}</button></form>}
    </>}
  </div>;
}
