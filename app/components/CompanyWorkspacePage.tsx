"use client";
import { useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
import DocumentsPage from "./DocumentsPage";
import CompaniesPage from "./CompaniesPage";

type Module = "overview" | "documents" | "team" | "processes";
export default function CompanyWorkspacePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const [module, setModule] = useState<Module>("overview");
  const [documentCount, setDocumentCount] = useState<number | null>(null);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const company = props.workspaces.find(item => item.id === props.activeWorkspaceId);
  useEffect(() => {
    if (!company) return;
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/documents?workspaceId=${encodeURIComponent(company.id)}`, { signal: controller.signal }).then(response => response.ok ? response.json() : []),
      fetch(`/api/workspaces/${encodeURIComponent(company.id)}/members`, { signal: controller.signal }).then(response => response.ok ? response.json() : []),
    ]).then(([documents, members]) => { setDocumentCount(documents.length); setMemberCount(members.length); }).catch(() => {});
    return () => controller.abort();
  }, [company]);

  const modules: [Module, string, string][] = [["overview", "Компания панелі", "▦"], ["documents", "Құжат айналымы", "▤"], ["team", "Қызметкерлер", "♙"], ["processes", "Жұмыс процестері", "⇢"]];
  return <div className="grid min-h-[70vh] gap-5 lg:grid-cols-[230px_minmax(0,1fr)]">
    <aside className={`${card} h-fit space-y-2 p-3`}>
      <p className="px-3 pb-2 pt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{company?.name || tr("Компания")}</p>
      {modules.map(([id, label, icon]) => <button key={id} onClick={() => setModule(id)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium ${module === id ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}><span aria-hidden="true" className="text-lg">{icon}</span>{tr(label)}</button>)}
      <div className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{tr("Компания деректері жеке кабинеттің құжаттарынан бөлек көрсетіледі.")}</div>
    </aside>
    <section className="min-w-0 space-y-5">
      {module === "overview" && <>
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-200 pb-4"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-600">{tr("Компаниялық жұмыс кеңістігі")}</p><h1 className="mt-1 text-3xl font-bold">{company?.name}</h1><p className="mt-1 text-sm text-slate-500">{tr("Құжаттар мен ұйым мүшелерін бір жұмыс орнынан басқарыңыз.")}</p></div><span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700">{tr(company?.role === "admin" ? "Компания әкімшісі" : "Компания мүшесі")}</span></header>
        <div className="grid gap-4 sm:grid-cols-2"><article className={`${card} flex items-center justify-between`}><div><p className="text-sm text-slate-500">{tr("Компания құжаттары")}</p><p className="mt-1 text-3xl font-bold">{documentCount ?? "—"}</p></div><span className="text-3xl text-blue-500">▤</span></article><article className={`${card} flex items-center justify-between`}><div><p className="text-sm text-slate-500">{tr("Қызметкерлер")}</p><p className="mt-1 text-3xl font-bold">{memberCount ?? "—"}</p></div><span className="text-3xl text-violet-500">♙</span></article></div>
        <div className="grid gap-4 md:grid-cols-2"><button onClick={() => setModule("documents")} className={`${card} text-left transition hover:border-blue-300`}><span className="text-xs font-semibold uppercase tracking-wider text-blue-600">01 · {tr("Құжат айналымы")}</span><h2 className="mt-2 text-lg font-bold">{tr("Құжаттар тізілімі")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Компанияға тиесілі құжаттарды сақтау, іздеу және нұсқаларын қарау.")}</p><span className={`${button} mt-4 bg-blue-600 text-white`}>{tr("Құжаттарға өту")}</span></button><button onClick={() => setModule("team")} className={`${card} text-left transition hover:border-blue-300`}><span className="text-xs font-semibold uppercase tracking-wider text-violet-600">02 · {tr("Ұйым")}</span><h2 className="mt-2 text-lg font-bold">{tr("Қызметкерлер мен қолжетімділік")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Команда мүшелерін шақырып, компаниядағы рөлдерін басқарыңыз.")}</p><span className={`${button} mt-4 border border-slate-200 bg-white`}>{tr("Команданы басқару")}</span></button></div>
        <article className={`${card} border-dashed bg-slate-50/70`}><h2 className="font-semibold">{tr("Жұмыс процестері")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Құжатты келісу, тапсырмалар және есептілік модульдері келесі кезеңде қосылады.")}</p></article>
      </>}
      {module === "documents" && <DocumentsPage key={`company-${company?.id}`} props={props} workspaceScope={company?.id || null} />}
      {module === "team" && company && <CompaniesPage fixedWorkspaceId={company.id} setNotice={props.setNotice} />}
      {module === "processes" && <div className={`${card} py-14 text-center`}><div className="text-4xl text-blue-500">⇢</div><h1 className="mt-3 text-2xl font-bold">{tr("Жұмыс процестері")}</h1><p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">{tr("Құжатты келісу маршруттары мен орындалу тапсырмалары әлі іске қосылған жоқ.")}</p><button onClick={() => setModule("documents")} className={`${button} mt-5 bg-blue-600 text-white`}>{tr("Құжат айналымына өту")}</button></div>}
    </section>
  </div>;
}
