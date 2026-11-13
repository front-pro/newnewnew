"use client";

import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { useLanguage } from "./LanguageProvider";
import Icon, { type IconName } from "./Icon";
import type { WorkspaceProps } from "./workspace-context";
import ApprovalInbox from "./ApprovalInbox";
import CompanyAnalysisPage from "./CompanyAnalysisPage";
import CompanyAuditPage from "./CompanyAuditPage";
import CompaniesPage from "./CompaniesPage";
import CompanyTemplatesPage from "./CompanyTemplatesPage";
import DocumentsPage from "./DocumentsPage";

type Module = "documents" | "analysis" | "templates" | "team" | "processes" | "audit";
type PanelSide = "left" | "right";
const MIN_PANEL_WIDTH = 190;
const MAX_PANEL_WIDTH = 420;
const ACTIVITY_WIDTH = 56;

export default function CompanyWorkspacePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const [module, setModule] = useState<Module>("documents");
  const [panelOpen, setPanelOpen] = useState(true);
  const [panelWidth, setPanelWidth] = useState(248);
  const [panelSide, setPanelSide] = useState<PanelSide>("left");
  const resizing = useRef(false);
  const company = props.workspaces.find(item => item.id === props.activeWorkspaceId);
  const modules: [Module, string, IconName][] = [
    ["documents", "Құжаттар тізілімі", "file"],
    ["analysis", "Құжаттарды салыстыру", "compare"],
    ["templates", "Құжат үлгілері", "template"],
    ["team", "Қызметкерлер", "users"],
    ["processes", "Келісу және тапсырмалар", "arrow"],
    ...(company?.role === "admin" ? [["audit", "Аудит журналы", "history"] as [Module, string, IconName]] : []),
  ];
  const activeLabel = modules.find(([id]) => id === module)?.[1] || "Құжаттар тізілімі";

  function selectModule(id: Module) {
    if (module === id && panelOpen) setPanelOpen(false);
    else { setModule(id); setPanelOpen(true); }
  }
  function resize(event: PointerEvent<HTMLDivElement>) {
    if (!resizing.current) return;
    const nextWidth = panelSide === "left" ? event.clientX - ACTIVITY_WIDTH : window.innerWidth - event.clientX;
    setPanelWidth(Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, nextWidth)));
  }
  function stopResize(event: PointerEvent<HTMLDivElement>) {
    resizing.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }
  function resizeByKeyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = event.key === "ArrowRight" ? 1 : -1;
    setPanelWidth(width => Math.max(MIN_PANEL_WIDTH, Math.min(MAX_PANEL_WIDTH, width + direction * (panelSide === "left" ? 1 : -1) * 16)));
  }

  const content = () => {
    if (module === "documents") return <DocumentsPage key={`company-${company?.id}`} props={props} workspaceScope={company?.id || null} />;
    if (module === "team" && company) return <CompaniesPage fixedWorkspaceId={company.id} setNotice={props.setNotice} />;
    if (module === "audit" && company?.role === "admin") return <CompanyAuditPage workspaceId={company.id} />;
    if (module === "templates") return <CompanyTemplatesPage props={props} />;
    if (module === "analysis") return <CompanyAnalysisPage props={props} />;
    if (module === "processes") return <ApprovalInbox setNotice={props.setNotice} />;
    return null;
  };

  return <div className="flex min-h-[calc(100vh-72px)] w-full bg-slate-100">
    <nav aria-label={tr("Компания бөлімдері")} style={{ order: 1 }} className="z-10 flex w-14 shrink-0 flex-col items-center gap-2 border-r border-slate-700 bg-slate-950 py-3 text-slate-300">
      <span className="mb-2 flex size-9 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white" title={company?.name}>KT</span>
      {modules.map(([id, label, icon]) => <button key={id} onClick={() => selectModule(id)} aria-label={tr(label)} aria-expanded={module === id ? panelOpen : undefined} aria-current={module === id ? "page" : undefined} title={tr(label)} className={`relative flex size-11 items-center justify-center rounded-lg transition ${module === id ? "bg-slate-800 text-white" : "hover:bg-slate-800 hover:text-white"}`}><Icon name={icon} className="size-5"/>{module === id && <span className="absolute inset-y-2 left-0 w-[2px] rounded-r bg-blue-400"/>}</button>)}
    </nav>

    {panelOpen && <>
      <aside className={`relative shrink-0 bg-slate-900 p-4 text-slate-100 ${panelSide === "left" ? "border-r" : "border-l"} border-slate-700`} style={{ width: panelWidth, order: panelSide === "left" ? 2 : 4 }}>
        <div className="mb-5 border-b border-slate-700 px-2 pb-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">KT · WORKSPACE</p><h1 className="mt-2 truncate text-lg font-bold" title={company?.name}>{company?.name || tr("Компания")}</h1></div><div className="flex shrink-0 items-center gap-1"><button onClick={() => setPanelSide(side => side === "left" ? "right" : "left")} aria-label={tr("Бүйір панельдің орнын ауыстыру")} title={tr("Бүйір панельдің орнын ауыстыру")} className="rounded px-1.5 py-1 text-slate-400 hover:bg-slate-800 hover:text-white">↔</button><button onClick={() => setPanelOpen(false)} aria-label={tr("Панельді жабу")} title={tr("Панельді жабу")} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"><Icon name="close" className="size-4"/></button></div></div><span className="mt-2 inline-flex rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{tr(company?.role === "admin" ? "Компания әкімшісі" : "Компания мүшесі")}</span></div>
        <p className="px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{tr("ТАҢДАЛҒАН БӨЛІМ")}</p>
        <div className="mt-3 flex items-center gap-3 rounded-lg bg-slate-800 px-3 py-3 text-sm font-medium text-white"><Icon name={modules.find(([id]) => id === module)?.[2] || "file"} className="size-4 shrink-0 text-blue-300"/><span className="truncate">{tr(activeLabel)}</span></div>
        <p className="mt-4 px-3 text-xs leading-5 text-slate-400">{tr("Бөлімді сол жақтағы белгішелерден таңдаңыз.")}</p>
        <div className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-400">{tr("Компанияның жұмыс кеңістігі")}</div>
      </aside>
      <div role="separator" aria-label={tr("Бүйір панель енін өзгерту")} aria-orientation="vertical" aria-valuemin={MIN_PANEL_WIDTH} aria-valuemax={MAX_PANEL_WIDTH} aria-valuenow={panelWidth} tabIndex={0} onKeyDown={resizeByKeyboard} onPointerDown={event => { resizing.current = true; event.currentTarget.setPointerCapture(event.pointerId); }} onPointerMove={resize} onPointerUp={stopResize} onPointerCancel={stopResize} style={{ order: 3 }} className={`group z-20 w-2 shrink-0 cursor-col-resize touch-none outline-none hover:bg-blue-500/30 focus-visible:bg-blue-500/40 ${panelSide === "left" ? "-ml-1" : "-mr-1"}`}><span className="mx-auto block h-full w-px bg-slate-300/60 group-hover:bg-blue-400 group-focus-visible:bg-blue-400"/></div>
    </>}

    <section style={{ order: panelSide === "left" ? 4 : 2 }} className="min-w-0 flex-1"><header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 md:px-8"><div className="text-xs text-slate-500">{company?.name} <span className="mx-2">/</span> <span className="font-semibold text-slate-800">{tr(activeLabel)}</span></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{tr("Компания режимі")}</span></header><main className="p-4 md:p-7">{content()}</main></section>
  </div>;
}
