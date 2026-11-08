"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function AuthDialog({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { authMode, setAuthMode, submitAuth, authName, setAuthName, authEmail, setAuthEmail, authPassword, setAuthPassword, authToken, setAuthToken, authBusy, resendVerification } = props;
  if (!authMode) return null;
  const title = authMode === "register" ? "Тіркелу" : authMode === "verify" ? "Email растау" : authMode === "reset" ? "Құпиясөзді қалпына келтіру" : authMode === "reset-confirm" ? "Жаңа құпиясөз" : "Жүйеге кіру";
  const needsPassword = authMode === "login" || authMode === "register" || authMode === "reset-confirm";
  const needsToken = authMode === "verify" || authMode === "reset-confirm";

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget) setAuthMode(null); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="auth-title" className={`${card} w-full max-w-md space-y-4 shadow-xl`}>
      <div className="flex items-center justify-between">
        <h2 id="auth-title" className="text-2xl font-bold">{tr(title)}</h2>
        <button onClick={() => setAuthMode(null)} className="rounded-lg px-2 py-1 text-xl text-slate-400 hover:bg-slate-100" aria-label={tr("Жабу")}>×</button>
      </div>
      <form onSubmit={submitAuth} className="space-y-3">
        {authMode === "register" && <label className="block space-y-1 text-sm font-medium">{tr("Аты-жөні")}<input required maxLength={100} autoComplete="name" value={authName} onChange={event => setAuthName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>}
        <label className="block space-y-1 text-sm font-medium">Email<input required type="email" autoComplete="email" value={authEmail} onChange={event => setAuthEmail(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" /></label>
        {needsToken && <label className="block space-y-1 text-sm font-medium">{tr(authMode === "verify" ? "Растау коды" : "Қалпына келтіру коды")}<input required autoComplete="one-time-code" value={authToken} onChange={event => setAuthToken(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono font-normal outline-none focus:border-blue-500" /></label>}
        {needsPassword && <label className="block space-y-1 text-sm font-medium">{tr(authMode === "reset-confirm" ? "Жаңа құпиясөз" : "Құпиясөз")}<input required minLength={8} maxLength={1024} type="password" autoComplete={authMode === "login" ? "current-password" : "new-password"} value={authPassword} onChange={event => setAuthPassword(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500" />{(authMode === "register" || authMode === "reset-confirm") && <span className="text-xs font-normal text-slate-500">{tr("Кемінде 8 таңба")}</span>}</label>}
        <button disabled={authBusy} className={`${button} w-full bg-blue-600 text-white hover:bg-blue-700`}>{authBusy ? tr("Күте тұрыңыз…") : tr(authMode === "register" ? "Аккаунт жасау" : authMode === "verify" ? "Email-ды растау" : authMode === "reset" ? "Қалпына келтіру кодын алу" : authMode === "reset-confirm" ? "Құпиясөзді сақтау" : "Кіру")}</button>
      </form>
      {authMode === "verify" && <button disabled={authBusy} onClick={() => void resendVerification()} className="w-full text-sm font-semibold text-blue-700 hover:underline">{tr("Растау кодын қайта жіберу")}</button>}
      {authMode === "login" && <button onClick={() => setAuthMode("reset")} className="w-full text-sm font-semibold text-blue-700 hover:underline">{tr("Құпиясөзді ұмыттыңыз ба?")}</button>}
      {(authMode === "login" || authMode === "register") && <p className="text-center text-sm text-slate-500">{authMode === "register" ? tr("Аккаунтыңыз бар ма?") : tr("Аккаунтыңыз жоқ па?")} <button onClick={() => setAuthMode(authMode === "register" ? "login" : "register")} className="font-semibold text-blue-700 hover:underline">{tr(authMode === "register" ? "Кіру" : "Тіркелу")}</button></p>}
      {(authMode === "reset" || authMode === "reset-confirm" || authMode === "verify") && <button onClick={() => setAuthMode("login")} className="w-full text-sm text-slate-500 hover:underline">{tr("Кіру бетіне оралу")}</button>}
    </section>
  </div>;
}
