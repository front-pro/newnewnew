"use client";

import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function DocumentsPage({ props }: { props: WorkspaceProps }) {
  const { documents, sessionUser, openDocument, deleteDocument, setTab, setEditorText, setEditorTitle, setActiveDocumentId, downloadText } = props;
  if (!sessionUser) {
    return <section className={card + " text-center"}>
      <h1 className="text-xl font-bold">Құжаттар беті жабық</h1>
      <p className="my-2 text-sm text-slate-500">Сақталған құжаттарды көру үшін жүйеге кіріңіз.</p>
      <button onClick={() => props.setAuthMode("login")} className={button + " bg-blue-600 text-white"}>Кіру</button>
    </section>;
  }

  return <section className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><h1 className="text-3xl font-bold">Менің құжаттарым</h1><p className="mt-1 text-slate-500">Серверде сақталған құжаттар мен нұсқалар</p></div>
      <button onClick={() => { setEditorText(""); setEditorTitle("Құжат.txt"); setActiveDocumentId(null); setTab("editor"); }} className={button + " bg-blue-600 text-white"}>＋ Жаңа құжат</button>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {documents.map((document) => <article key={document.id} className={card + " space-y-3"}>
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-semibold break-all">{document.title}</h2><p className="mt-1 text-xs text-slate-500">v{document.version} · {new Date(document.updatedAt).toLocaleString()}</p></div>
          <span className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-700">Құжат</span>
        </div>
        <p className="line-clamp-3 whitespace-pre-wrap text-sm text-slate-600">{document.text}</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => openDocument(document)} className={button + " bg-blue-600 text-white"}>Ашу / өзгерту</button>
          <button onClick={() => downloadText(document.text, document.title || "document.txt")} className={button + " border border-slate-200 bg-white"}>Жүктеу</button>
          <button onClick={() => void deleteDocument(document)} className={button + " border border-rose-200 bg-white text-rose-700"}>Жою</button>
        </div>
      </article>)}
      {documents.length === 0 && <div className={card + " md:col-span-2 py-12 text-center"}>
        <div className="text-4xl">📄</div><h2 className="mt-3 font-semibold">Әзірге сақталған құжат жоқ</h2>
        <p className="mt-1 text-sm text-slate-500">Редакторда құжатты сақтаған соң, ол осы жерде көрінеді.</p>
      </div>}
    </div>
  </section>;
}
