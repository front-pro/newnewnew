"use client";
import { roleKey } from "../lib/i18n";
import { useLanguage } from "./LanguageProvider";
import LanguageSelect from "./LanguageSelect";
import { button } from "./styles";
import Image from "next/image";
import type { WorkspaceProps } from "./workspace-context";
export default function AppHeader({ props }: {
    props: WorkspaceProps;
}) {
    const { tr } = useLanguage();
    const { nav } = props;
    const { tab, setTab, setOpenTemplate, sessionUser, logout, setAuthMode } = props;
    return (<header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap items-center gap-5"><div className="flex items-center gap-2"><span className="rounded-lg bg-blue-600 px-2.5 py-1.5 font-mono font-bold text-white">KT</span><b>Neural Agent</b><span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-xs text-emerald-700">● online</span></div><nav className="flex flex-wrap gap-1">{nav.filter(([id]) => id !== "users" || sessionUser?.role === "admin").map(([id, label]) => <button key={id} onClick={() => { setTab(id); setOpenTemplate(null); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === id ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200" : "text-slate-500 hover:bg-slate-100"}`}>{label}</button>)}</nav></div><div className="flex flex-wrap items-center gap-2"><LanguageSelect />{sessionUser ? <><button type="button" onClick={() => { setTab("settings"); setOpenTemplate(null); }} aria-label={tr("Профиль и баптаулар")} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-left text-xs hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300">{sessionUser.avatar ? <Image src={sessionUser.avatar} alt="" width={36} height={36} unoptimized className="size-9 rounded-full object-cover"/> : <span aria-hidden="true" className="flex size-9 items-center justify-center rounded-full bg-blue-600 font-semibold text-white">{sessionUser.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>}<span><b className="block">{sessionUser.name}</b><span className="font-mono text-blue-700">{tr(roleKey(sessionUser.role))}</span></span></button><button onClick={logout} className={`${button} border border-slate-200 bg-white text-slate-700`}>{tr("Шығу")}</button></> : <><button onClick={() => setAuthMode("login")} className={`${button} border border-slate-200 bg-white text-slate-700`}>{tr("Кіру")}</button><button onClick={() => setAuthMode("register")} className={`${button} bg-blue-600 text-white hover:bg-blue-700`}>{tr("Тіркелу")}</button></>}</div></div></header>);
}
