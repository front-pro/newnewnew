"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function CompanyTemplatesPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  return <div className="space-y-5"><header><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компания модулі")}</p><h1 className="mt-1 text-3xl font-bold">{tr("Құжат үлгілері")}</h1></header><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{props.cards}</div>{["employee", "admin"].includes(props.sessionUser?.role || "") && <form onSubmit={props.createTemplate} className={`${card} space-y-3`}><h2 className="font-semibold">{tr("Жаңа үлгі қосу")}</h2><div className="grid gap-3 md:grid-cols-3"><input required minLength={3} value={props.templateTitle} onChange={event => props.setTemplateTitle(event.target.value)} placeholder={tr("Атауы")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><input value={props.templateDesc} onChange={event => props.setTemplateDesc(event.target.value)} placeholder={tr("Қысқаша сипаттама")} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"/><select value={props.templateAccess} onChange={event => props.setTemplateAccess(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm"><option value="public">{tr("Жалпы")}</option><option value="employee">{tr("Тек қызметкерлерге")}</option></select></div><textarea required value={props.templateBody} onChange={event => props.setTemplateBody(event.target.value)} placeholder={tr("Үлгі мәтіні...")} className="h-32 w-full rounded-xl border border-slate-200 p-3 text-sm"/><button className={`${button} bg-blue-600 text-white`}>{tr("Үлгіні серверге сақтау")}</button></form>}</div>;
}
