"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import SearchField from "./SearchField";
import type { WorkspaceProps } from "./workspace-context";

export default function TemplatesPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { sessionUser, openTemplate, setOpenTemplate, cards, editTemplate, beginTemplateDesign, setAuthMode, templateQuery, setTemplateQuery, filteredTemplateCount, templates } = props;

  if (!sessionUser) return <section className={`${card} text-center`}><h1 className="text-xl font-bold">{tr("Үлгілер кітапханасы жабық")}</h1><p className="my-2 text-sm text-slate-500">{tr("Үлгілерді көру үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>;

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5"><div><h1 className="text-3xl font-bold">{tr("Құжат үлгілерінің кітапханасы")}</h1><p className="mt-1 text-slate-500">{tr("Үлгіні қарап, редакторда қолданыңыз немесе жеке дизайн жасаңыз")}</p></div>{["employee", "admin"].includes(sessionUser.role) && <button onClick={() => beginTemplateDesign()} className={`${button} gap-2 bg-blue-600 text-white`}>＋ {tr("Жаңа үлгі қосу")}</button>}</header>
    {openTemplate ? <section className={`${card} space-y-4`}><div><h2 className="text-2xl font-bold">{tr(openTemplate.title)}</h2><p className="text-slate-500">{tr(openTemplate.desc)}</p></div><div className="overflow-auto rounded-xl bg-slate-100 p-4 sm:p-6"><article className={`mx-auto max-w-2xl bg-white p-7 shadow-sm ${openTemplate.design?.theme === "modern" ? "rounded-3xl font-sans" : openTemplate.design?.theme === "minimal" ? "font-serif" : "rounded-sm font-serif"}`} style={{ borderTop: `6px solid ${openTemplate.design?.accent || "#2563eb"}` }}><h3 className="mb-2 text-xl font-bold" style={{ color: openTemplate.design?.accent || "#2563eb" }}>{tr(openTemplate.title)}</h3><p className="mb-4 text-xs text-slate-500">{tr(openTemplate.desc)}</p><div className="whitespace-pre-wrap border-t border-slate-200 pt-4 text-sm leading-7">{openTemplate.body}</div></article></div><div className="flex flex-wrap gap-2">{!openTemplate.locked && (sessionUser.role === "admin" || sessionUser.email === openTemplate.owner) && <button onClick={() => beginTemplateDesign(openTemplate)} className={`${button} border border-slate-200 bg-white`}>{tr("Дизайнды өзгерту")}</button>}<button onClick={() => void editTemplate(openTemplate)} className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні редакторда қолдану")}</button><button onClick={() => setOpenTemplate(null)} className={`${button} border border-slate-200 bg-white`}>{tr("Үлгілерге қайту")}</button></div></section> : <>
      <SearchField value={templateQuery} onChange={setTemplateQuery} label={tr("Үлгілерден іздеу")} placeholder={tr("Атауы, сипаттамасы немесе мәтіні бойынша іздеу...")} count={filteredTemplateCount} total={templates.length}/>
      <div className="grid gap-5 md:grid-cols-3">{cards}</div>
      {!filteredTemplateCount && <p className={`${card} text-center text-sm text-slate-500`}>{tr("Үлгілер табылмады. Іздеу сөзін өзгертіңіз.")}</p>}
    </>}
  </div>;
}
