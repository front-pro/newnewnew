"use client";
import { useCallback, useEffect, useState } from "react";
import { useLanguage } from "./LanguageProvider";
import type { SessionUser } from "./workspace-context";
import { button, card } from "./styles";

type Workspace = { id: string; name: string; role: "member" | "admin" };
type Member = { id: string; name: string; email: string; role: "member" | "admin" };
type Group = { id: string; name: string; description: string; members: Pick<Member, "id" | "name" | "email">[] };
type Invitation = { id: string; email: string; role: "member" | "admin"; expiresAt: string; expired: boolean };
const field = "rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm";
const secondary = `${button} border border-slate-200 bg-white text-slate-700`;

export default function CompaniesPage({ user, setNotice, fixedWorkspaceId, onWorkspaceCreated }: { user?: SessionUser | null; setNotice: (message: string) => void; fixedWorkspaceId?: string; onWorkspaceCreated?: (workspace: Workspace) => void }) {
  const { tr, locale } = useLanguage();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [editingGroupId, setEditingGroupId] = useState("");
  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroupDescription, setEditingGroupDescription] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"member" | "admin">("member");
  const [inviteToken, setInviteToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdToken, setCreatedToken] = useState("");
  const activeWorkspaceId = fixedWorkspaceId || selected;
  const active = workspaces.find(item => item.id === activeWorkspaceId);

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
  const reloadGroups = useCallback(async (id: string) => {
    if (!id) { setGroups([]); return; }
    const response = await fetch(`/api/workspaces/${encodeURIComponent(id)}/groups`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setGroups(data);
  }, []);
  const reloadInvitations = useCallback(async (id: string) => {
    if (!id) { setInvitations([]); return; }
    const response = await fetch(`/api/workspaces/${encodeURIComponent(id)}/invitations`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setInvitations(data);
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
    if (!activeWorkspaceId) return;
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/members`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setMembers(data);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? error.message : "Мүшелерді жүктеу қатесі"); });
    return () => controller.abort();
  }, [activeWorkspaceId, setNotice]);
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/groups`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setGroups(data);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? tr(error.message) : tr("Топтарды жүктеу мүмкін болмады.")); });
    return () => controller.abort();
  }, [activeWorkspaceId, setNotice, tr]);
  useEffect(() => {
    if (!activeWorkspaceId || active?.role !== "admin") return;
    const controller = new AbortController();
    fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/invitations`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setInvitations(data);
    }).catch(error => { if (!controller.signal.aborted) setNotice(error instanceof Error ? tr(error.message) : tr("Шақыруларды жүктеу мүмкін болмады.")); });
    return () => controller.abort();
  }, [activeWorkspaceId, active?.role, setNotice, tr]);

  async function createWorkspace(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: companyName }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCompanyName(""); await reload(); setSelected(data.id); onWorkspaceCreated?.(data); setNotice(tr("Компания кеңістігі құрылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Компанияны құру мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  async function invite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeWorkspaceId) return; setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/invitations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: inviteEmail, role: inviteRole }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setCreatedToken(data.token); setInviteEmail(""); await reloadInvitations(activeWorkspaceId); setNotice(tr("Шақыру жасалды. Токенді шақырылған адамға қауіпсіз жеткізіңіз."));
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
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/members/${encodeURIComponent(member.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadMembers(activeWorkspaceId); setNotice(tr("Компания мүшесінің рөлі жаңартылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Рөлді жаңарту мүмкін болмады.")); }
  }
  async function removeMember(member: Member) {
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/members/${encodeURIComponent(member.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadMembers(activeWorkspaceId); setNotice(tr("Компания мүшесі шығарылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Мүшені шығару мүмкін болмады.")); }
  }
  async function createGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeWorkspaceId) return; setBusy(true);
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/groups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: groupName, description: groupDescription }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setGroupName(""); setGroupDescription(""); await reloadGroups(activeWorkspaceId); setNotice(tr("Топ құрылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топты құру мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  async function deleteGroup(group: Group) {
    if (!activeWorkspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/groups/${encodeURIComponent(group.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadGroups(activeWorkspaceId); setNotice(tr("Топ жойылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топты жою мүмкін болмады.")); }
  }
  async function saveGroup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!activeWorkspaceId || !editingGroupId) return;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/groups/${encodeURIComponent(editingGroupId)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: editingGroupName, description: editingGroupDescription }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setEditingGroupId(""); await reloadGroups(activeWorkspaceId); setNotice(tr("Топ жаңартылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топты өзгерту мүмкін болмады.")); }
  }
  async function setGroupMember(group: Group, userId: string, add: boolean) {
    if (!activeWorkspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/groups/${encodeURIComponent(group.id)}/members${add ? "" : `/${encodeURIComponent(userId)}`}`, { method: add ? "POST" : "DELETE", ...(add ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) } : {}) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadGroups(activeWorkspaceId); setNotice(tr(add ? "Қызметкер топқа қосылды." : "Қызметкер топтан шығарылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Топ мүшелігін өзгерту мүмкін болмады.")); }
  }
  async function revokeInvitation(invitation: Invitation) {
    if (!activeWorkspaceId) return;
    try {
      const response = await fetch(`/api/workspaces/${encodeURIComponent(activeWorkspaceId)}/invitations/${encodeURIComponent(invitation.id)}`, { method: "DELETE" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      await reloadInvitations(activeWorkspaceId); setNotice(tr("Компания шақыруы қайтарылды."));
    } catch (error) { setNotice(error instanceof Error ? tr(error.message) : tr("Шақыруды қайтару мүмкін болмады.")); }
  }

  if (!user) return <section className={card}><h1 className="text-2xl font-bold">{tr("Компания кеңістіктері")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Компания мүшелігін басқару үшін жүйеге кіріңіз.")}</p></section>;
  return <div className="space-y-5">
    <header className="border-b border-slate-200 pb-4"><h1 className="text-3xl font-bold">{tr("Компаниялық жұмыс орнына қосылу")}</h1><p className="mt-1 text-sm text-slate-500">{tr("Компания мүшелігі жеке аккаунттан бөлек басқарылады.")}</p></header>
    <div className="grid gap-5 lg:grid-cols-2">
      <form onSubmit={createWorkspace} className={`${card} space-y-3`}><h2 className="font-semibold">{tr("Компания құру")}</h2><div className="flex gap-2"><input required minLength={2} maxLength={120} value={companyName} onChange={event => setCompanyName(event.target.value)} placeholder={tr("Компания атауы")} className={`${field} min-w-0 flex-1`}/><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{tr("Құру")}</button></div></form>
      <form onSubmit={acceptInvitation} className={`${card} space-y-3`}><h2 className="font-semibold">{tr("Шақыруды қабылдау")}</h2><div className="flex gap-2"><input required value={inviteToken} onChange={event => setInviteToken(event.target.value)} placeholder={tr("Шақыру токені")} className={`${field} min-w-0 flex-1`}/><button disabled={busy} className={secondary}>{tr("Қабылдау")}</button></div><p className="text-xs text-slate-500">{tr("Шақыру аккаунтыңыздың email мекенжайына байланады.")}</p></form>
    </div>
    <section className={`${card} space-y-4`}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">{tr(fixedWorkspaceId ? "Компания командасы" : "Компанияға қосылу немесе құру")}</h2>{!fixedWorkspaceId && <select aria-label={tr("Компанияны таңдау")} value={selected} onChange={event => setSelected(event.target.value)} className={field}><option value="">{tr("Компанияны таңдаңыз")}</option>{workspaces.map(item => <option key={item.id} value={item.id}>{item.name} · {tr(item.role === "admin" ? "Әкімші" : "Мүше")}</option>)}</select>}</div>
      {!active ? <p className="py-6 text-center text-sm text-slate-500">{tr("Компания жоқ. Жаңа компания құрыңыз немесе шақыруды қабылдаңыз.")}</p> : <>
        {active.role === "admin" && <form onSubmit={invite} className="flex flex-wrap gap-2 border-b border-slate-100 pb-4"><input type="email" required value={inviteEmail} onChange={event => setInviteEmail(event.target.value)} placeholder="email@example.com" className={`${field} min-w-48 flex-1`}/><select value={inviteRole} onChange={event => setInviteRole(event.target.value as "member" | "admin")} className={field}><option value="member">{tr("Мүше")}</option><option value="admin">{tr("Әкімші")}</option></select><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{tr("Шақыру жасау")}</button></form>}
        {createdToken && <div className="rounded-xl bg-amber-50 p-3 text-sm"><p className="font-semibold">{tr("Шақыру токені. Ол тек осы жерде көрсетіледі:")}</p><code className="mt-2 block break-all select-all">{createdToken}</code><button className="mt-2 text-blue-700 underline" onClick={() => setCreatedToken("")}>{tr("Токенді жасыру")}</button></div>}
        {active.role === "admin" && invitations.length > 0 && <section className="space-y-2 border-b border-slate-100 pb-3"><h3 className="text-sm font-semibold">{tr("Ашық шақырулар")}</h3>{invitations.map(invitation => <div key={invitation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"><span>{invitation.email} · {tr(invitation.role === "admin" ? "Әкімші" : "Мүше")} · {tr(invitation.expired ? "Мерзімі өтті" : "Мерзімі")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(invitation.expiresAt))}</span><button onClick={() => void revokeInvitation(invitation)} className="text-rose-700 underline">{tr("Шақыруды қайтару")}</button></div>)}</section>}
        <ul className="divide-y divide-slate-100">{members.map(member => <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><p className="font-semibold">{member.name}</p><p className="text-xs text-slate-500">{member.email}</p></div><div className="flex items-center gap-2">{active.role === "admin" ? <><select aria-label={`${member.name} ${tr("рөлі")}`} value={member.role} disabled={member.id === user.id} onChange={event => void changeRole(member, event.target.value)} className={field}><option value="member">{tr("Мүше")}</option><option value="admin">{tr("Әкімші")}</option></select><button disabled={member.id === user.id} onClick={() => void removeMember(member)} className={`${button} border border-rose-200 text-rose-700`}>{tr("Шығару")}</button></> : <span className="text-sm text-slate-500">{tr(member.role === "admin" ? "Әкімші" : "Мүше")}</span>}</div></li>)}</ul>
        <section className="space-y-3 border-t border-slate-100 pt-4"><div><h3 className="font-semibold">{tr("Қызметкерлер топтары")}</h3><p className="text-xs text-slate-500">{tr("Топ мүшелері тек осы компанияның белсенді қызметкерлерінен таңдалады.")}</p></div>{active.role === "admin" && <form onSubmit={createGroup} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_auto]"><input required minLength={2} maxLength={100} value={groupName} onChange={event => setGroupName(event.target.value)} placeholder={tr("Топ атауы")} className={field}/><input maxLength={500} value={groupDescription} onChange={event => setGroupDescription(event.target.value)} placeholder={tr("Сипаттамасы (міндетті емес)")} className={field}/><button disabled={busy} className={`${button} bg-blue-600 text-white`}>{tr("Топ құру")}</button></form>}{groups.map(group => <article key={group.id} className="rounded-xl border border-slate-200 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{group.name}</h4>{group.description && <p className="text-xs text-slate-500">{group.description}</p>}</div>{active.role === "admin" && <div className="flex gap-3"><button onClick={() => { setEditingGroupId(group.id); setEditingGroupName(group.name); setEditingGroupDescription(group.description); }} className="text-xs text-blue-700 underline">{tr("Топты өзгерту")}</button><button onClick={() => void deleteGroup(group)} className="text-xs text-rose-700 underline">{tr("Топты жою")}</button></div>}</div>{editingGroupId === group.id && <form onSubmit={saveGroup} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1.5fr_auto_auto]"><input required minLength={2} maxLength={100} value={editingGroupName} onChange={event => setEditingGroupName(event.target.value)} aria-label={tr("Топ атауы")} className={field}/><input maxLength={500} value={editingGroupDescription} onChange={event => setEditingGroupDescription(event.target.value)} aria-label={tr("Сипаттамасы (міндетті емес)")} className={field}/><button className={`${button} bg-blue-600 text-white`}>{tr("Сақтау")}</button><button type="button" onClick={() => setEditingGroupId("")} className={secondary}>{tr("Болдырмау")}</button></form>}{active.role === "admin" && members.length > 0 && <label className="mt-3 flex flex-wrap items-center gap-2 text-xs"><span>{tr("Қызметкерді қосу")}</span><select value="" onChange={event => { if (event.target.value) void setGroupMember(group, event.target.value, true); }} className={field}><option value="">{tr("Мүшені таңдаңыз")}</option>{members.filter(member => !group.members.some(existing => existing.id === member.id)).map(member => <option key={member.id} value={member.id}>{member.name} · {member.email}</option>)}</select></label>}<ul className="mt-2 flex flex-wrap gap-2">{group.members.map(member => <li key={member.id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs">{member.name}{active.role === "admin" && <button aria-label={`${member.name} ${tr("топтан шығару")}`} onClick={() => void setGroupMember(group, member.id, false)} className="font-bold text-rose-700">×</button>}</li>)}{!group.members.length && <li className="text-xs text-slate-400">{tr("Топ бос")}</li>}</ul></article>)}</section>
      </>}
    </section>
  </div>;
}
