"use client";

import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import SessionManager from "./SessionManager";
import type { WorkspaceProps } from "./workspace-context";

export default function AccountPage({ props, mode = "profile" }: { props: WorkspaceProps; mode?: "profile" | "users" }) {
  const { tr } = useLanguage();
  const { sessionUser, users, changeRole, logout, setAuthMode, setNotice } = props;

  if (mode === "users" && sessionUser?.role === "admin") return <div className="space-y-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Пайдаланушыларды басқару")}</h1><p className="mt-1 text-slate-500">{tr("Аккаунттарға рөл беру (RBAC)")}</p></header><section className={`${card} divide-y divide-slate-100 p-0`}>{users.map(user => <div key={user.email} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b className="text-sm">{user.name}</b><p className="font-mono text-xs text-slate-400">{user.email}</p></div><select aria-label={`${user.name} ${tr("рөлі")}`} value={user.role} disabled={user.email === sessionUser.email} onChange={event => void changeRole(user.email, event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="user">user</option><option value="employee">employee</option><option value="admin">admin</option></select></div>)}</section></div>;

  return <div className="space-y-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Аккаунт")}</h1><p className="mt-1 text-slate-500">{tr("Тіркелгі ақпараты")}</p></header><section className={card}>{sessionUser ? <><div className="space-y-2 text-sm"><p><b>{tr("Аты-жөні:")}</b> {sessionUser.name}</p><p><b>Email:</b> {sessionUser.email}</p><p><b>{tr("Рөлі:")}</b> {sessionUser.role}</p><button onClick={() => void logout()} className={`${button} mt-3 border border-slate-200 bg-white`}>{tr("Жүйеден шығу")}</button></div><SessionManager setNotice={setNotice}/></> : <div className="space-y-3"><p className="text-sm text-slate-600">{tr("Аккаунтқа кіру немесе жаңасын тіркеу қажет.")}</p><div className="flex gap-2"><button onClick={() => setAuthMode("login")} className={`${button} border border-slate-200 bg-white`}>{tr("Кіру")}</button><button onClick={() => setAuthMode("register")} className={`${button} bg-blue-600 text-white`}>{tr("Тіркелу")}</button></div></div>}</section></div>;
}
