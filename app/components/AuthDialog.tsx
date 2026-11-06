"use client";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
export default function AuthDialog({ props }: {
    props: WorkspaceProps;
}) {
    const { tr } = useLanguage();
    const { authMode, setAuthMode, submitAuth, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, authBusy } = props;
    if (!authMode)
        return null;
    return (<div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={e => {
            if (e.target === e.currentTarget)
                setAuthMode(null);
        }}><section role="dialog" aria-modal="true" aria-labelledby="auth-title" className={`${card} w-full max-w-md space-y-4 shadow-xl`}><div className="flex items-center justify-between"><h2 id="auth-title" className="text-2xl font-bold">{authMode === "register" ? tr("Тіркелу") : tr("Жүйеге кіру")}</h2><button onClick={() => setAuthMode(null)} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label={tr("Жабу")}>×</button></div><form onSubmit={submitAuth} className="space-y-3">{authMode === "register" && <label className="block space-y-1 text-sm font-medium">{tr("Аты-жөні")}<input required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/></label>}<label className="block space-y-1 text-sm font-medium">Email<input required type="email" autoComplete="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/></label><label className="block space-y-1 text-sm font-medium">{tr("Құпиясөз")}<input required minLength={8} type="password" autoComplete={authMode === "register" ? "new-password" : "current-password"} value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/><span className="text-xs font-normal text-slate-500">{tr("Кемінде 8 таңба")}</span></label><button disabled={authBusy} className={`${button} w-full bg-blue-600 text-white hover:bg-blue-700`}>{authBusy ? tr("Күте тұрыңыз…") : authMode === "register" ? tr("Аккаунт жасау") : tr("Кіру")}</button></form><p className="text-center text-sm text-slate-500">{authMode === "register" ? tr("Аккаунтыңыз бар ма?") : tr("Аккаунтыңыз жоқ па?")} <button onClick={() => setAuthMode(authMode === "register" ? "login" : "register")} className="font-semibold text-blue-700 hover:underline">{authMode === "register" ? tr("Кіру") : tr("Тіркелу")}</button></p></section></div>);
}
