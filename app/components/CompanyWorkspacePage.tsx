"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { WorkspaceProps } from "./workspace-context";
import ApprovalInbox from "./ApprovalInbox";
import CompanyAnalysisPage from "./CompanyAnalysisPage";
import CompanyAuditPage from "./CompanyAuditPage";
import CompaniesPage from "./CompaniesPage";
import CompanyTemplatesPage from "./CompanyTemplatesPage";
import DocumentsPage from "./DocumentsPage";

type Module = "documents" | "analysis" | "templates" | "team" | "processes" | "audit";

export default function CompanyWorkspacePage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const [module, setModule] = useState<Module>("documents");
  const company = props.workspaces.find(item => item.id === props.activeWorkspaceId);
  const modules: [Module, string, string][] = [
    ["documents", "Құжаттар тізілімі", "▤"],
    ["analysis", "Құжаттарды салыстыру", "⇄"],
    ["templates", "Құжат үлгілері", "▧"],
    ["team", "Қызметкерлер", "♙"],
    ["processes", "Келісу және тапсырмалар", "⇢"],
    ...(company?.role === "admin" ? [["audit", "Аудит журналы", "◷"] as [Module, string, string]] : []),
  ];
  const activeLabel = modules.find(([id]) => id === module)?.[1] || "Құжаттар тізілімі";
  const content = () => {
    if (module === "documents") return <DocumentsPage key={`company-${company?.id}`} props={props} workspaceScope={company?.id || null} />;
    if (module === "team" && company) return <CompaniesPage fixedWorkspaceId={company.id} setNotice={props.setNotice} />;
    if (module === "audit" && company?.role === "admin") return <CompanyAuditPage workspaceId={company.id} />;
    if (module === "templates") return <CompanyTemplatesPage props={props} />;
    if (module === "analysis") return <CompanyAnalysisPage props={props} />;
    if (module === "processes") return <ApprovalInbox setNotice={props.setNotice} />;
    return null;
  };

  return <div className="-mx-4 -my-7 min-h-[calc(100vh-70px)] bg-slate-100 md:-mx-8">
    <div className="grid min-h-[calc(100vh-70px)] lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="border-r border-slate-700 bg-slate-900 p-4 text-slate-100"><div className="mb-6 border-b border-slate-700 px-2 pb-4"><p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-300">KT · WORKSPACE</p><h1 className="mt-2 truncate text-lg font-bold" title={company?.name}>{company?.name || tr("Компания")}</h1><span className="mt-1 inline-flex rounded-md bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{tr(company?.role === "admin" ? "Компания әкімшісі" : "Компания мүшесі")}</span></div><p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">{tr("МОДУЛЬДЕР")}</p><nav aria-label={tr("Компания бөлімдері")} className="space-y-1">{modules.map(([id, label, icon]) => <button key={id} onClick={() => setModule(id)} aria-current={module === id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition ${module === id ? "bg-blue-600 text-white shadow" : "text-slate-300 hover:bg-slate-800 hover:text-white"}`}><span aria-hidden="true" className="w-5 text-center text-lg">{icon}</span>{tr(label)}</button>)}</nav><div className="mt-8 border-t border-slate-700 pt-4 text-xs text-slate-400">{tr("Компанияның жұмыс кеңістігі")}</div></aside>
      <section className="min-w-0"><header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-3 md:px-8"><div className="text-xs text-slate-500">{company?.name} <span className="mx-2">/</span> <span className="font-semibold text-slate-800">{tr(activeLabel)}</span></div><span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">{tr("Компания режимі")}</span></header><main className="p-4 md:p-7">{content()}</main></section>
    </div>
  </div>;
}
