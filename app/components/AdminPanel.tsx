"use client";

import { useMemo, useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "./LanguageProvider";
import { roleKey } from "../lib/i18n";
import { accessModules, type AccessModule } from "../lib/access-control";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

const moduleMeta: Record<AccessModule, { label: string; description: string }> = {
  dashboard: { label: "Басты бет", description: "Жеке жұмыс кеңістігі мен көрсеткіштер" },
  compare: { label: "Талдау (A/B)", description: "Құжаттарды салыстыру және есептер" },
  documents: { label: "Құжаттар", description: "Құжаттар кітапханасы мен себет" },
  templates: { label: "Үлгілер", description: "Құжат үлгілерін қарау және басқару" },
  editor: { label: "Редактор", description: "Құжаттарды жасау және өңдеу" },
  history: { label: "Тарих", description: "Әрекеттер журналы мен таңдаулылар" },
  approvals: { label: "Бекітулер", description: "Келісу және бекіту тапсырмалары" },
  company: { label: "Компаниялық жұмыс орны", description: "Команда, құжаттар және компания баптаулары" },
};

export default function AdminPanel({ props }: { props: WorkspaceProps }) {
  const { tr, locale } = useLanguage();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("name");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const verifiedCount = props.users.filter(user => user.emailVerified).length;
  const admins = props.users.filter(user => user.role === "admin").length;
  const employees = props.users.filter(user => user.role === "employee").length;
  const filtered = useMemo(() => props.users.filter(user => (roleFilter === "all" || user.role === roleFilter)
    && (statusFilter === "all" || (statusFilter === "verified") === !!user.emailVerified)
    && `${user.name} ${user.email}`.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale)))
    .sort((a, b) => {
      if (sortBy === "role") return a.role.localeCompare(b.role, locale) || a.name.localeCompare(b.name, locale);
      if (sortBy === "status") return Number(!!b.emailVerified) - Number(!!a.emailVerified) || a.name.localeCompare(b.name, locale);
      if (sortBy === "role-desc") return b.role.localeCompare(a.role, locale) || a.name.localeCompare(b.name, locale);
      if (sortBy === "status-desc") return Number(!!a.emailVerified) - Number(!!b.emailVerified) || a.name.localeCompare(b.name, locale);
      return a.name.localeCompare(b.name, locale);
    }), [props.users, roleFilter, statusFilter, sortBy, query, locale]);

  if (props.sessionUser?.role !== "admin") return <div className="mx-auto max-w-2xl space-y-6 py-8">
    <header className="text-center"><span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Icon name="shield" className="size-7"/></span><p className="mt-4 text-xs font-semibold uppercase tracking-[.18em] text-blue-600">{tr("Қауіпсіз аймақ")}</p><h1 className="mt-2 text-3xl font-bold">{tr("Әкімші панелі")}</h1><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">{tr("Жалғастыру үшін әкімші аккаунтының логині мен құпиясөзімен кіріңіз.")}</p></header>
    <section className={`${card} space-y-4 text-center`}><div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">{props.sessionUser ? <>{tr("Қазір сіз әкімші емес аккаунтпен кірдіңіз.")}<br/>{tr("Әкімші аккаунтына ауысу үшін төмендегі батырманы басыңыз.")}</> : tr("Әкімшіге арналған құралдарды ашу үшін жүйеге кіріңіз.")}</div><button onClick={() => props.setAuthMode("login")} className={`${button} gap-2 bg-blue-600 text-white`}><Icon name="settings" className="size-4"/>{tr("Әкімші аккаунтымен кіру")}</button></section>
  </div>;

  async function updatePermissions(email: string, permissions: AccessModule[]) {
    setSaving(email);
    try { await props.changePermissions(email, permissions); }
    finally { setSaving(null); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-600">{tr("Жүйені басқару")}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Әкімші панелі")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Пайдаланушыларды, рөлдерді және бөлімдерге қолжетімділікті басқарыңыз.")}</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500"/>{tr("Қауіпсіз басқару")}</span>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Барлық пайдаланушы", props.users.length, "users", "slate"], ["Әкімшілер", admins, "shield", "violet"], ["Қызметкерлер", employees, "company", "blue"], ["Расталған аккаунттар", verifiedCount, "check", "emerald"]].map(([label, value, icon, tone]) => <div key={String(label)} className={`${card} flex items-center gap-4 p-4`}><span className={`flex size-11 items-center justify-center rounded-xl ${tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><Icon name={String(icon) as "users" | "shield" | "company" | "check"}/></span><div><p className="text-xs text-slate-500">{tr(String(label))}</p><p className="mt-1 text-2xl font-bold">{value}</p></div></div>)}
    </div>

    <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{tr("Пайдаланушылар және қолжетімділік")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Рөлді өзгертіңіз немесе бөлімдерге берілетін рұқсатты баптаңыз.")}</p></div><span className="text-xs text-slate-400">{tr("Көрсетілгені")}: {filtered.length} / {props.users.length}</span></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="relative"><Icon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tr("Аты немесе email бойынша іздеу")} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></label><select aria-label={tr("Рөл бойынша сүзу")} value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">{tr("Барлық рөлдер")}</option><option value="admin">{tr("Әкімші")}</option><option value="employee">{tr("Қызметкер")}</option><option value="user">{tr("Пайдаланушы")}</option></select><select aria-label={tr("Күй бойынша сүзу")} value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">{tr("Барлық күйлер")}</option><option value="verified">{tr("Расталған")}</option><option value="unverified">{tr("Расталмаған")}</option></select><select aria-label={tr("Сұрыптау тәсілі")} value={sortBy} onChange={event => setSortBy(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="name">{tr("Аты бойынша")}</option><option value="role">{tr("Рөлі: өсу ретімен")}</option><option value="role-desc">{tr("Рөлі: кему ретімен")}</option><option value="status">{tr("Күйі: расталған алдымен")}</option><option value="status-desc">{tr("Күйі: расталмаған алдымен")}</option></select></div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[minmax(220px,1fr)_150px_150px_190px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:grid"><span>{tr("Пайдаланушы")}</span><span>{tr("Рөлі")}</span><span>{tr("Аккаунт күйі")}</span><span className="text-right">{tr("Құқықтар")}</span></div>
        {filtered.map(user => {
          const permissions = user.role === "admin" ? accessModules : user.permissions || accessModules;
          const isExpanded = expanded === user.email;
          return <div key={user.email} className="border-t border-slate-100 first:border-t-0">
            <div className="grid items-center gap-3 px-4 py-4 md:grid-cols-[minmax(220px,1fr)_150px_150px_190px]">
              <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-bold text-blue-700">{user.name.trim().slice(0, 1).toLocaleUpperCase()}</span><div className="min-w-0"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate font-mono text-xs text-slate-400">{user.email}</p></div></div>
              <select aria-label={`${user.name} ${tr("рөлі")}`} value={user.role} disabled={user.email === props.sessionUser?.email} onChange={event => void props.changeRole(user.email, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm disabled:opacity-60"><option value="user">{tr(roleKey("user"))}</option><option value="employee">{tr(roleKey("employee"))}</option><option value="admin">{tr(roleKey("admin"))}</option></select>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${user.emailVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className={`size-1.5 rounded-full ${user.emailVerified ? "bg-emerald-500" : "bg-amber-500"}`}/>{tr(user.emailVerified ? "Расталған" : "Расталмаған")}</span>
              <div className="flex items-center justify-between gap-2 md:justify-end"><span className="text-xs text-slate-500">{user.role === "admin" ? tr("Толық рұқсат") : tr("{count} бөлім", { count: permissions.length })}</span><button onClick={() => setExpanded(isExpanded ? null : user.email)} aria-expanded={isExpanded} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{tr(isExpanded ? "Жабу" : "Қолжетімділік")}</button></div>
            </div>
            {isExpanded && <div className="border-t border-slate-100 bg-slate-50/70 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{tr("Бөлімдерге қолжетімділік")}</h3><p className="mt-1 text-xs text-slate-500">{tr(user.role === "admin" ? "Әкімші барлық бөлімге толық қол жеткізеді." : "Рұқсатты алып тастасаңыз, бөлім мәзірден жасырылады және API арқылы ашылмайды.")}</p></div>{saving === user.email && <span className="text-xs text-blue-600">{tr("Сақталуда…")}</span>}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{accessModules.map(module => <label key={module} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${user.role === "admin" ? "border-slate-200 opacity-70" : "border-slate-200 hover:border-blue-200"}`}><input type="checkbox" checked={permissions.includes(module)} disabled={user.role === "admin" || saving === user.email} onChange={event => void updatePermissions(user.email, event.target.checked ? [...permissions, module] : permissions.filter(value => value !== module))} className="mt-1 size-4 accent-blue-600"/><span><b className="block text-xs font-semibold">{tr(moduleMeta[module].label)}</b><span className="mt-1 block text-[11px] leading-4 text-slate-500">{tr(moduleMeta[module].description)}</span></span></label>)}</div>
            </div>}
          </div>;
        })}
        {!filtered.length && <div className="p-10 text-center text-sm text-slate-500">{tr("Іздеу шартына сай пайдаланушы табылмады.")}</div>}
      </div>
    </section>
  </div>;
}
