"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { SessionUser } from "./workspace-context";
import { button, card } from "./styles";

type Workspace = { id: string; name: string; role: "member" | "admin" };
type Member = { id: string; name: string; email: string; role: "member" | "admin" };
const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const secondary = `${button} border border-slate-200 bg-white text-slate-700`;

export default function CompaniesPage({ user, setNotice }: { user: SessionUser | null; setNotice: (message: string) => void }) {
  const { tr } = useLanguage();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const active = workspaces.find(item => item.id === selected);

  const reload = useCallback(async () => {
    const response = await fetch("/api/workspaces", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setWorkspaces(data);
    setSelected(current => data.some((item: Workspace) => item.id === current) ? current : data[0]?.id || "");
  }, []);
  const reloadMembers = useCallback(async (id: string) => {
    if (!id) { setMembers([]); return; }
    const response = await fetch(`/api/workspaces/${encodeURIComponent(id)}/members`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setMembers(data);
  }, []);
  useEffect(() => {
    if (!user) return;
    const controller = new AbortController();
    fetch("/api/workspaces", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setWorkspaces(data);
      setSelected(current => data.some((item: Workspace) => item.id === current) ? current : data[0]?.id || "");
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Компанияларды жүктеу қатесі"); });
    return () => controller.abort();
  }, [user, setNotice]);
  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(selected)}/members`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMembers(data);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Мүшелерді жүктеу қатесі"); });
    return () => controller.abort();
  }, [selected, setNotice]);

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: companyName }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCompanyName(""); await reload(); setSelected(data.id); setNotice(tr("Компания кеңістігі құрылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Компанияны құру мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return; setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(selected)}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCreatedToken(data.token); setInviteEmail(""); setNotice(tr("Шақыру жасалды. Токенді шақырылған адамға қауіпсіз жеткізіңіз."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Шақыру жасау мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  async function acceptInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/workspaces/invitations/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: inviteToken }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setInviteToken(""); await reload(); setSelected(data.id); setNotice(tr("Компания шақыруы қабылданды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Шақыруды қабылдау мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  async function changeRole(member: Member, role: string) {
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(selected)}/members/${encodeURIComponent(member.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadMembers(selected); setNotice(tr("Компания мүшесінің рөлі жаңартылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Рөлді жаңарту мүмкін болмады.")); }
  }
  async function removeMember(member: Member) {
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(selected)}/members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadMembers(selected); setNotice(tr("Компания мүшесі шығарылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Мүшені шығару мүмкін болмады.")); }
  }

  if (!user) return <section className={card}><h1 className="text-2xl font-bold">{tr("Компания кеңістіктері")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Компания мүшелігін басқару үшін жүйеге кіріңіз.")}</p></section>;
  return <div className="space-y-5">
    <header className="border-b border-slate-200 pb-4"><h1 className="text-3xl font-bold">{tr("Компания кеңістіктері")}</h1><p className="mt-1 text-sm text-slate-500">{tr("Компания мүшелігі жеке аккаунттан бөлек басқарылады.")}</p></header>
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={createWorkspace} className={`${card} space-y-3`}><h2 className="font-semibold">{tr("Компания құру")}</h2><div className="flex gap-2"><input required minLength={2} maxLength={120} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={tr("Компания атауы")} className={`${field} min-w-0 flex-1`}/><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{tr("Құру")}</button></div></form>
      <form onSubmit={acceptInvitation} className={`${card} space-y-3`}><h2 className="font-semibold">{tr("Шақыруды қабылдау")}</h2><div className="flex gap-2"><input required value={inviteToken} onChange={event => setInviteToken(event.target.value)} placeholder={tr("Шақыру токені")} className={`${field} min-w-0 flex-1`}/><button disabled={busy} className={secondary}>{tr("Қабылдау")}</button></div><p className="text-xs text-slate-500">{tr("Шақыру аккаунтыңыздың email мекенжайына байланады.")}</p></form>
    </div>
    <section className={`${card} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{tr("Менің компанияларым")}</h2><select aria-label={tr("Компанияны таңдау")} value={selected} onChange={event => setSelected(event.target.value)} className={field}><option value="">{tr("Компанияны таңдаңыз")}</option>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name} · {tr(item.role === "admin" ? "Әкімші" : "Мүше")}</option>)}</select></div>
      {!active ? <p className="py-6 text-center text-sm text-slate-500">{tr("Компания жоқ. Жаңа компания құрыңыз немесе шақыруды қабылдаңыз.")}</p> : <>
        {active.role === "admin" && <form onSubmit={invite} className="flex flex-wrap gap-2 border-b border-slate-100 pb-4"><input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="email@example.com" className={`${field} min-w-48 flex-1`}/><select value={inviteRole} onChange={event => setInviteRole(event.target.value as "member" | "admin")} className={field}><option value="member">{tr("Мүше")}</option><option value="admin">{tr("Әкімші")}</option></select><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{tr("Шақыру жасау")}</button></form>}
        {createdToken && <div className="rounded-xl bg-amber-50 p-3 text-sm"><p className="font-semibold">{tr("Шақыру токені. Ол тек осы жерде көрсетіледі:")}</p><code className="mt-2 block break-all select-all">{createdToken}</code><button className="mt-2 text-blue-700 underline" onClick={() => setCreatedToken("")}>{tr("Токенді жасыру")}</button></div>}
        <ul className="divide-y divide-slate-100">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div><div className="flex items-center gap-2">{active.role === "admin" ? <><select aria-label={`${member.name} ${tr("рөлі")}`} value={member.role} disabled={member.id === user.id} onChange={event => void changeRole(member, event.target.value)} className={field}><option value="member">{tr("Мүше")}</option><option value="admin">{tr("Әкімші")}</option></select><button disabled={member.id === user.id} onClick={() => void removeMember(member)} className={`${button} border border-rose-200 text-rose-700`}>{tr("Шығару")}</button></> : <span className="text-sm text-slate-500">{tr(member.role === "admin" ? "Әкімші" : "Мүше")}</span>}</div></li>)}</ul>
      </>}
    </section>
  </div>;
}
