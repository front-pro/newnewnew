"use client";

import { useMemo, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import SearchField from "./SearchField";
import TemplateCard from "./TemplateCard";
import { editorHtmlFromText } from "../lib/editor-content";
import { matchesSearch } from "../lib/search";
import type { WorkspaceProps } from "./workspace-context";

export default function TemplatesPage({ props }: { props: WorkspaceProps }) {
  const { tr, locale } = useLanguage();
  const { sessionUser, openTemplate, setOpenTemplate, editTemplate, beginTemplateDesign, setAuthMode, templateQuery, setTemplateQuery, templates, newDocument, deleteTemplate, downloadText } = props;
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("az");
  const filtered = useMemo(() => templates.filter(template => {
    const type = template.category || (template.body?.includes("<table") ? "table" : "document");
    return (category === "all" || type === category) && matchesSearch(templateQuery, [template.title, template.desc, template.locked ? "" : template.body, template.owner], locale);
  }).sort((a, b) => sort === "za" ? b.title.localeCompare(a.title, locale) : a.title.localeCompare(b.title, locale)), [templates, category, templateQuery, locale, sort]);

  if (!sessionUser) return <section className={`${card} text-center`}><h1 className="text-xl font-bold">{tr("Үлгілер кітапханасы жабық")}</h1><p className="my-2 text-sm text-slate-500">{tr("Үлгілерді көру үшін жүйеге кіріңіз.")}</p><button onClick={() => setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>;

  const templateCards = filtered.map(template => <TemplateCard key={template.id} template={template} onOpen={() => setOpenTemplate(template)} onUse={() => void editTemplate(template)} onDownload={() => downloadText(template.body || "", `template-${template.id}.txt`)} onDelete={!template.locked && (sessionUser.role === "admin" || template.owner === sessionUser.email) ? () => void deleteTemplate(template) : undefined}/>);
  const bodyMarkup = openTemplate && editorHtmlFromText(openTemplate.body || "");
  const accent = openTemplate?.design?.accent || "#2563eb";

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-5"><div><h1 className="text-3xl font-bold">{tr("Құжат үлгілерінің кітапханасы")}</h1><p className="mt-1 text-slate-500">{tr("Құжатты нөлден бастаңыз немесе дайын үлгіні таңдаңыз.")}</p></div><div className="flex flex-wrap gap-2"><button onClick={() => newDocument()} className={`${button} border border-slate-200 bg-white`}>{tr("Жаңа құжат")}</button>{["employee", "admin"].includes(sessionUser.role) && <button onClick={() => beginTemplateDesign()} className={`${button} gap-2 bg-blue-600 text-white`}>＋ {tr("Жаңа үлгі қосу")}</button>}</div></header>
    {openTemplate ? <section className={`${card} space-y-4`}><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr(openTemplate.category === "table" ? "Кесте үлгісі" : "Құжат үлгісі")}</p><h2 className="mt-1 text-2xl font-bold">{tr(openTemplate.title)}</h2><p className="text-slate-500">{tr(openTemplate.desc)}</p></div><div className="overflow-auto rounded-xl bg-slate-100 p-4 sm:p-6"><article className={`document-preview mx-auto max-w-2xl bg-white p-7 shadow-sm [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-50 [&_th]:p-2 ${openTemplate.design?.theme === "modern" ? "rounded-3xl font-sans" : openTemplate.design?.theme === "minimal" ? "font-serif" : "rounded-sm font-serif"}`} style={{ borderTop: `6px solid ${accent}` }}><h3 className="mb-2 text-xl font-bold" style={{ color: accent }}>{tr(openTemplate.title)}</h3><p className="mb-4 text-xs text-slate-500">{tr(openTemplate.desc)}</p><div className="border-t border-slate-200 pt-4 text-sm leading-7" dangerouslySetInnerHTML={{ __html: bodyMarkup || "" }}/></article></div><div className="flex flex-wrap gap-2">{!openTemplate.locked && (sessionUser.role === "admin" || sessionUser.email === openTemplate.owner) && <button onClick={() => beginTemplateDesign(openTemplate)} className={`${button} border border-slate-200 bg-white`}>{tr("Дизайнды өзгерту")}</button>}<button onClick={() => void editTemplate(openTemplate)} className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні редакторда қолдану")}</button><button onClick={() => setOpenTemplate(null)} className={`${button} border border-slate-200 bg-white`}>{tr("Үлгілерге қайту")}</button></div></section> : <>
      <SearchField value={templateQuery} onChange={setTemplateQuery} label={tr("Үлгілерден іздеу")} placeholder={tr("Атауы, сипаттамасы немесе мәтіні бойынша іздеу...")} count={filtered.length} total={templates.length}/>
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" role="group" aria-label={tr("Үлгі санаты")}><button aria-pressed={category === "all"} onClick={() => setCategory("all")} className={`${button} border ${category === "all" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white"}`}>{tr("Барлығы")} · {templates.length}</button><button aria-pressed={category === "document"} onClick={() => setCategory("document")} className={`${button} border ${category === "document" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white"}`}>{tr("Құжаттар")} · {templates.filter(item => (item.category || (item.body?.includes("<table") ? "table" : "document")) === "document").length}</button><button aria-pressed={category === "table"} onClick={() => setCategory("table")} className={`${button} border ${category === "table" ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white"}`}>{tr("Кестелер")} · {templates.filter(item => item.category === "table" || item.body?.includes("<table")).length}</button></div><label className="text-xs font-medium text-slate-500">{tr("Сұрыптау")}<select aria-label={tr("Үлгілерді сұрыптау")} value={sort} onChange={event => setSort(event.target.value)} className="ml-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="az">{tr("Атауы: A–Z")}</option><option value="za">{tr("Атауы: Z–A")}</option></select></label></div>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"><button onClick={() => newDocument()} className={`${card} group flex min-h-64 flex-col items-center justify-center gap-4 border-dashed text-center transition hover:border-blue-400 hover:bg-blue-50/40`}><span className="flex h-36 w-28 items-center justify-center border border-slate-200 bg-white text-5xl text-blue-600 shadow-sm transition group-hover:-translate-y-1">＋</span><span><b className="block">{tr("Бос құжат")}</b><small className="mt-1 block text-slate-500">{tr("Редакторда жаңадан бастаңыз")}</small></span></button>{templateCards}</div>
      {!filtered.length && <p className={`${card} text-center text-sm text-slate-500`}>{tr("Сүзгіге сай үлгі табылмады. Сүзгілерді тазалап көріңіз.")}</p>}
    </>}
  </div>;
}
