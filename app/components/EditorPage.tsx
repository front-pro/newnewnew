"use client";

import { readDocumentFile } from "../lib/read-document";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function EditorPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { sessionUser, editorBusy, editorTitle, setEditorTitle, editorVersion, documentId, editorText, setEditorText, newDocument, saveEditor, downloadText, setNotice } = props;

  if (!sessionUser) return <section className={`${card} text-center`}><h1 className="text-xl font-bold">{tr("Редактор жабық")}</h1><p className="my-2 text-sm text-slate-500">{tr("Құжаттарды өңдеу және сақтау үшін жүйеге кіріңіз.")}</p><button onClick={() => props.setAuthMode("login")} className={`${button} bg-blue-600 text-white`}>{tr("Кіру")}</button></section>;

  return <div className="space-y-6">
    <header className="border-b border-slate-200 pb-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-3xl font-bold">{tr("Құжат редакторы")}</h1><button disabled={editorBusy} onClick={() => newDocument()} className={`${button} border border-slate-200 bg-white`}>＋ {tr("Жаңа құжат")}</button></div><p className="mt-1 text-slate-500">{tr("Мәтінді түзетіп, серверге сақтаңыз немесе файл етіп жүктеңіз")}</p></header>
    <section className={`${card} space-y-3`}><input aria-label={tr("Файл атауы")} maxLength={200} disabled={editorBusy} value={editorTitle} onChange={event => setEditorTitle(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm md:max-w-sm"/><p className="text-xs text-slate-500">{tr(documentId ? "Сақталған құжат · v{version} · Өзгерістер жаңа нұсқа ретінде сақталады" : "Жаңа құжат · Кітапханаға сақталмаған", { version: editorVersion })}</p><textarea aria-label={tr("Құжат мәтіні")} disabled={editorBusy} value={editorText} wrap="soft" spellCheck={false} onChange={event => setEditorText(event.target.value)} placeholder={tr("Мәтінді енгізіңіз немесе үлгілерден жүктеңіз…")} className="h-[55vh] w-full resize-y whitespace-pre-wrap break-words rounded-xl border border-slate-200 p-5 font-mono text-sm outline-none focus:border-blue-500"/><div className="flex flex-wrap gap-2"><button disabled={editorBusy} onClick={saveEditor} className={`${button} bg-emerald-600 text-white hover:bg-emerald-700`}>{editorBusy ? tr("Сақталуда…") : `💾 ${tr("Серверге сақтау")}`}</button><button onClick={() => downloadText(editorText, editorTitle || "edited-document.txt")} className={`${button} border border-slate-200 bg-white`}>⬇ {tr("Өзгертілген файлды жүктеу")}</button><label className={`${button} cursor-pointer border border-slate-200 bg-white`}>📎 {tr("Файл ашу")}<input className="hidden" type="file" accept=".txt,.md,.csv,.tsv,.json,.xml,.html,.log" onChange={async event => { const file = event.target.files?.[0]; if (!file) return; try { const text = await readDocumentFile(file); newDocument(); setEditorText(text); setEditorTitle(file.name); setNotice(tr("{p0} файлы жүктелді", { p0: file.name })); } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Файлды оқу мүмкін болмады.")); } finally { event.target.value = ""; } }}/></label></div></section>
  </div>;
}
