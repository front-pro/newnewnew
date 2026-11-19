"use client";

import { useState } from "react";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";
import SessionManager from "./SessionManager";
import type { WorkspaceProps } from "./workspace-context";

export default function AccountPage({ props, mode = "profile" }: { props: WorkspaceProps; mode?: "profile" | "users" | "delete" }) {
  const { tr } = useLanguage();
  const { sessionUser, users, changeRole, logout, setAuthMode, setNotice } = props;
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState("");
  const [deletePassword, setDeletePassword] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function deleteAccount() {
    if (!sessionUser || deleteEmail.trim().toLowerCase() !== sessionUser.email.toLowerCase() || !deletePassword) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/auth/profile", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: deletePassword }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Аккаунтты жою мүмкін болмады");
      setNotice(tr("Аккаунт жойылды."));
      await logout();
    } catch (error) {
      setNotice(error instanceof Error ? tr(error.message) : tr("Аккаунтты жою кезінде қате шықты"));
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "users" && sessionUser?.role === "admin") return <div className="space-y-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Пайдаланушыларды басқару")}</h1><p className="mt-1 text-slate-500">{tr("Аккаунттарға рөл беру (RBAC)")}</p></header><section className={`${card} divide-y divide-slate-100 p-0`}>{users.map(user => <div key={user.email} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><b className="text-sm">{user.name}</b><p className="font-mono text-xs text-slate-400">{user.email}</p></div><select aria-label={`${user.name} ${tr("рөлі")}`} value={user.role} disabled={user.email === sessionUser.email} onChange={event => void changeRole(user.email, event.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm"><option value="user">user</option><option value="employee">employee</option><option value="admin">admin</option></select></div>)}</section></div>;

  if (mode === "delete") return sessionUser ? <section className={`${card} border-red-200`}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-red-800">{tr("Аккаунтты жою")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Бұл әрекетті жалғастыру үшін құпиясөзді растаңыз.")}</p></div><button onClick={() => { setDeleteOpen(value => !value); setDeleteEmail(""); setDeletePassword(""); }} className={`${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`}>{tr("Аккаунтты жою")}</button></div>{deleteOpen && <div className="mt-5 space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4"><div><h3 className="font-semibold text-red-800">{tr("Аккаунтты біржола жою")}</h3><p className="mt-1 text-sm text-red-700">{tr("Жеке құжаттар мен аккаунт деректері жойылады. Компания иесі немесе соңғы әкімші болсаңыз, алдымен құқықтарды басқаға беріңіз.")}</p></div><div className="grid gap-3 sm:grid-cols-2"><input autoComplete="off" type="email" value={deleteEmail} onChange={event => setDeleteEmail(event.target.value)} placeholder={tr("Растау үшін email енгізіңіз")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"/><input autoComplete="current-password" type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder={tr("Ағымдағы құпиясөз")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"/></div><button disabled={deleting || deleteEmail.trim().toLowerCase() !== sessionUser.email.toLowerCase() || !deletePassword} onClick={() => void deleteAccount()} className={`${button} bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50`}>{deleting ? tr("Жойылуда…") : tr("Аккаунтты біржола жою")}</button></div>}</section> : null;

  return <div className="space-y-6"><header className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Аккаунт")}</h1><p className="mt-1 text-slate-500">{tr("Тіркелгі ақпараты")}</p></header><section className={card}>{sessionUser ? <><div className="space-y-2 text-sm"><p><b>{tr("Аты-жөні:")}</b> {sessionUser.name}</p><p><b>Email:</b> {sessionUser.email}</p><p><b>{tr("Рөлі:")}</b> {sessionUser.role}</p><div className="flex flex-wrap gap-2 pt-2"><button onClick={() => void logout()} className={`${button} border border-slate-200 bg-white`}>{tr("Жүйеден шығу")}</button><button onClick={() => { setDeleteOpen(value => !value); setDeleteEmail(""); setDeletePassword(""); }} className={`${button} border border-red-200 bg-white text-red-700 hover:bg-red-50`}>{tr("Аккаунтты жою")}</button></div></div>{deleteOpen && <div className="mt-5 space-y-3 rounded-xl border border-red-200 bg-red-50/60 p-4"><div><h2 className="font-semibold text-red-800">{tr("Аккаунтты біржола жою")}</h2><p className="mt-1 text-sm text-red-700">{tr("Жеке құжаттар мен аккаунт деректері жойылады. Компания иесі немесе соңғы әкімші болсаңыз, алдымен құқықтарды басқаға беріңіз.")}</p></div><div className="grid gap-3 sm:grid-cols-2"><input autoComplete="off" type="email" value={deleteEmail} onChange={event => setDeleteEmail(event.target.value)} placeholder={tr("Растау үшін email енгізіңіз")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"/><input autoComplete="current-password" type="password" value={deletePassword} onChange={event => setDeletePassword(event.target.value)} placeholder={tr("Ағымдағы құпиясөз")} className="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm"/></div><button disabled={deleting || deleteEmail.trim().toLowerCase() !== sessionUser.email.toLowerCase() || !deletePassword} onClick={() => void deleteAccount()} className={`${button} bg-red-600 text-white disabled:cursor-not-allowed disabled:opacity-50`}>{deleting ? tr("Жойылуда…") : tr("Аккаунтты біржола жою")}</button></div>}<SessionManager setNotice={setNotice}/></> : <div className="space-y-3"><p className="text-sm text-slate-600">{tr("Аккаунтқа кіру немесе жаңасын тіркеу қажет.")}</p><div className="flex gap-2"><button onClick={() => setAuthMode("login")} className={`${button} border border-slate-200 bg-white`}>{tr("Кіру")}</button><button onClick={() => setAuthMode("register")} className={`${button} bg-blue-600 text-white`}>{tr("Тіркелу")}</button></div></div>}</section></div>;
}
