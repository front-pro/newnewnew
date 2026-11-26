"use client";

import { useEffect, useMemo, useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "./LanguageProvider";
import { roleKey } from "../lib/i18n";
import { accessModules, type AccessModule } from "../lib/access-control";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
import AdminAnalytics, { type AdminActivity, type AdminRoleCount, type AnalyticsPoint } from "./AdminAnalytics";

type AdminOverview = { capturedAt: string; uptimeSeconds: number; days: number; daily: AnalyticsPoint[]; roles: AdminRoleCount[]; verification: { verified: number; unverified: number }; memory: { rssBytes: number; heapUsedBytes: number; heapTotalBytes: number; systemUsedBytes: number; systemTotalBytes: number }; cpu: { cores: number; loadAverage: number[] }; counts: { users: number; verifiedUsers: number; documents: number; templates: number; analyses: number; liveSessions: number }; activity: AdminActivity[] };
const formatBytes = (bytes: number) => bytes < 1024 ** 3 ? `${(bytes / 1024 ** 2).toFixed(0)} MB` : `${(bytes / 1024 ** 3).toFixed(1)} GB`;
const formatUptime = (seconds: number) => `${Math.floor(seconds / 86400)}d ${Math.floor(seconds % 86400 / 3600)}h ${Math.floor(seconds % 3600 / 60)}m`;

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
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [overviewError, setOverviewError] = useState("");
  const [analyticsDays, setAnalyticsDays] = useState(14);
  const [adminSection, setAdminSection] = useState<"overview" | "users">("overview");
  const [openingAccount, setOpeningAccount] = useState<string | null>(null);
  useEffect(() => {
    if (props.sessionUser?.role !== "admin") return;
    let alive = true;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/admin/overview?days=${analyticsDays}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Жүйе көрсеткіштерін алу мүмкін болмады");
        if (alive) { setOverview(data); setOverviewError(""); }
      } catch (error) { if (alive) setOverviewError(error instanceof Error ? error.message : "Жүйе көрсеткіштерін алу мүмкін болмады"); }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [props.sessionUser?.role, analyticsDays]);
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
  async function openAccount(email: string) {
    setOpeningAccount(email);
    try { await props.startImpersonation(email); }
    catch (error) { props.setNotice(error instanceof Error ? tr(error.message) : tr("Аккаунтты ашу мүмкін болмады")); }
    finally { setOpeningAccount(null); }
  }

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-200 pb-5">
      <div><p className="text-xs font-semibold uppercase tracking-[.18em] text-blue-600">{tr("Жүйені басқару")}</p><h1 className="mt-1 text-3xl font-bold tracking-tight">{tr("Әкімші панелі")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Пайдаланушыларды, рөлдерді және бөлімдерге қолжетімділікті басқарыңыз.")}</p></div>
      <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500"/>{tr("Қауіпсіз басқару")}</span>
    </header>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[["Барлық пайдаланушы", props.users.length, "users", "slate"], ["Әкімшілер", admins, "shield", "violet"], ["Қызметкерлер", employees, "company", "blue"], ["Расталған аккаунттар", verifiedCount, "check", "emerald"]].map(([label, value, icon, tone]) => <div key={String(label)} className={`${card} flex items-center gap-4 p-4`}><span className={`flex size-11 items-center justify-center rounded-xl ${tone === "violet" ? "bg-violet-50 text-violet-700" : tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "emerald" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}><Icon name={String(icon) as "users" | "shield" | "company" | "check"}/></span><div><p className="text-xs text-slate-500">{tr(String(label))}</p><p className="mt-1 text-2xl font-bold">{value}</p></div></div>)}
    </div>

    <nav aria-label={tr("Әкімші бөлімдері")} className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">{([["overview", "Шолу және аналитика", "settings"], ["users", "Пайдаланушыларды басқару", "users"]] as const).map(([id, label, icon]) => <button key={id} onClick={() => setAdminSection(id)} aria-current={adminSection === id ? "page" : undefined} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${adminSection === id ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}><Icon name={icon} className="size-4"/>{tr(label)}</button>)}</nav>

    {adminSection === "overview" && <><section className={`${card} space-y-4`} aria-label={tr("Сайттың жалпы күйі")}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><h2 className="text-lg font-semibold">{tr("Сайттың жалпы күйі")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Сервер, сақтау және соңғы пайдаланушы әрекеттері · 30 секунд сайын жаңарады")}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ${overview && !overviewError ? "bg-emerald-50 text-emerald-700" : overviewError ? "bg-rose-50 text-rose-700" : "bg-slate-100 text-slate-500"}`}>{tr(overviewError ? "Көрсеткіштер қолжетімсіз" : overview ? "Сервер жұмыс істеп тұр" : "Жүктелуде…")}</span></div>
      {overviewError && <p role="alert" className="text-sm text-rose-600">{tr(overviewError)}</p>}
      {overview && <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Сервер uptime", formatUptime(overview.uptimeSeconds)], ["Белсенді сессиялар", overview.counts.liveSessions], ["Құжаттар", overview.counts.documents], ["Талдаулар", overview.counts.analyses], ["Үлгілер", overview.counts.templates]].map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"><p className="text-xs text-slate-500">{tr(String(label))}</p><p className="mt-1 text-lg font-semibold">{value}</p></div>)}</div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{tr("Жад пайдалануы")}</h3><span className="text-xs text-slate-500">{tr("ОЖ: {p0}", { p0: formatBytes(overview.memory.systemTotalBytes) })}</span></div><div className="mt-4 space-y-4"><div><div className="mb-1 flex justify-between text-xs"><span>{tr("Сервер процесі (RSS)")}</span><b>{formatBytes(overview.memory.rssBytes)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, overview.memory.rssBytes / overview.memory.systemTotalBytes * 100)}%` }}/></div></div><div><div className="mb-1 flex justify-between text-xs"><span>{tr("JavaScript heap")}</span><b>{formatBytes(overview.memory.heapUsedBytes)} / {formatBytes(overview.memory.heapTotalBytes)}</b></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-violet-500" style={{ width: `${overview.memory.heapTotalBytes ? Math.min(100, overview.memory.heapUsedBytes / overview.memory.heapTotalBytes * 100) : 0}%` }}/></div></div><p className="text-xs text-slate-500">{tr("Жүйе бос жады")}: {formatBytes(overview.memory.systemTotalBytes - overview.memory.systemUsedBytes)} · {tr("CPU өзектері")}: {overview.cpu.cores} · {tr("load average")}: {overview.cpu.loadAverage.map(value => value.toFixed(2)).join(" / ")}</p></div></div>
          <div className="rounded-xl border border-slate-200 p-4"><div className="mb-3 flex items-center justify-between gap-2"><h3 className="font-semibold">{tr("Соңғы әрекеттер")}</h3><span className="text-xs text-slate-400">{tr("Кім не істеді")}</span></div><ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto">{overview.activity.slice(0, 8).map((event, index) => <li key={`${event.actor}-${event.at}-${index}`} className="py-2.5"><p className="text-sm"><b>{event.actor}</b> · {tr(event.action)}</p><p className="mt-0.5 truncate text-xs text-slate-500">{event.title} · {event.at}</p></li>)}{!overview.activity.length && <li className="py-6 text-center text-sm text-slate-500">{tr("Әзірге әрекеттер жоқ")}</li>}</ul></div>
        </div>
        <p className="text-right text-[11px] text-slate-400">{tr("Көрсеткіш алынған уақыт")}: {new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(overview.capturedAt))}</p>
      </>}
    </section>

    {overview && <AdminAnalytics daily={overview.daily} activity={overview.activity} roles={overview.roles} verification={overview.verification} days={analyticsDays} onDaysChange={setAnalyticsDays}/> }</>}

    {adminSection === "users" && <section className={`${card} space-y-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold">{tr("Пайдаланушылар және қолжетімділік")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Рөлді өзгертіңіз немесе бөлімдерге берілетін рұқсатты баптаңыз.")}</p></div><span className="text-xs text-slate-400">{tr("Көрсетілгені")}: {filtered.length} / {props.users.length}</span></div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label className="relative"><Icon name="search" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"/><input value={query} onChange={event => setQuery(event.target.value)} placeholder={tr("Аты немесе email бойынша іздеу")} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></label><select aria-label={tr("Рөл бойынша сүзу")} value={roleFilter} onChange={event => setRoleFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">{tr("Барлық рөлдер")}</option><option value="admin">{tr("Әкімші")}</option><option value="employee">{tr("Қызметкер")}</option><option value="user">{tr("Пайдаланушы")}</option></select><select aria-label={tr("Күй бойынша сүзу")} value={statusFilter} onChange={event => setStatusFilter(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="all">{tr("Барлық күйлер")}</option><option value="verified">{tr("Расталған")}</option><option value="unverified">{tr("Расталмаған")}</option></select><select aria-label={tr("Сұрыптау тәсілі")} value={sortBy} onChange={event => setSortBy(event.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="name">{tr("Аты бойынша")}</option><option value="role">{tr("Рөлі: өсу ретімен")}</option><option value="role-desc">{tr("Рөлі: кему ретімен")}</option><option value="status">{tr("Күйі: расталған алдымен")}</option><option value="status-desc">{tr("Күйі: расталмаған алдымен")}</option></select></div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="hidden grid-cols-[minmax(220px,1fr)_150px_150px_190px] gap-3 bg-slate-50 px-4 py-3 text-xs font-semibold text-slate-500 md:grid"><span>{tr("Пайдаланушы")}</span><span>{tr("Рөлі")}</span><span>{tr("Аккаунт күйі")}</span><span className="text-right">{tr("Құқықтар")}</span></div>
        {filtered.map(user => {
          const permissions = user.role === "admin" ? accessModules : user.permissions || accessModules;
          const isExpanded = expanded === user.email;
          return <div key={user.email} className="border-t border-slate-100 first:border-t-0">
            <div className="grid items-center gap-3 px-4 py-4 md:grid-cols-[minmax(220px,1fr)_150px_150px_190px]">
              <button onClick={() => setExpanded(isExpanded ? null : user.email)} aria-expanded={isExpanded} className="flex min-w-0 items-center gap-3 text-left"><span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 text-sm font-bold text-blue-700 ring-2 ring-white shadow-sm">{user.avatar ? <img src={user.avatar} alt="" className="size-full object-cover"/> : user.name.trim().slice(0, 1).toLocaleUpperCase()}</span><span className="min-w-0"><span className="block truncate text-sm font-semibold">{user.name}</span><span className="block truncate font-mono text-xs text-slate-400">{user.email}</span>{(user.company || user.position) && <span className="block truncate text-xs text-slate-500">{[user.position, user.company].filter(Boolean).join(" · ")}</span>}</span></button>
              <select aria-label={`${user.name} ${tr("рөлі")}`} value={user.role} disabled={user.email === props.sessionUser?.email} onChange={event => void props.changeRole(user.email, event.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm disabled:opacity-60"><option value="user">{tr(roleKey("user"))}</option><option value="employee">{tr(roleKey("employee"))}</option><option value="admin">{tr(roleKey("admin"))}</option></select>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full px-2.5 py-1 text-xs font-medium ${user.emailVerified ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><span className={`size-1.5 rounded-full ${user.emailVerified ? "bg-emerald-500" : "bg-amber-500"}`}/>{tr(user.emailVerified ? "Расталған" : "Расталмаған")}</span>
              <div className="flex items-center justify-between gap-2 md:justify-end"><span className="text-xs text-slate-500">{user.role === "admin" ? tr("Толық рұқсат") : tr("{count} бөлім", { count: permissions.length })}</span><button onClick={() => setExpanded(isExpanded ? null : user.email)} aria-expanded={isExpanded} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">{tr(isExpanded ? "Жабу" : "Қолжетімділік")}</button></div>
            </div>
            {isExpanded && <div className="border-t border-slate-100 bg-slate-50/70 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h3 className="text-sm font-semibold">{tr("Бөлімдерге қолжетімділік")}</h3><p className="mt-1 text-xs text-slate-500">{tr(user.role === "admin" ? "Әкімші барлық бөлімге толық қол жеткізеді." : "Рұқсатты алып тастасаңыз, бөлім мәзірден жасырылады және API арқылы ашылмайды.")}</p></div>{saving === user.email && <span className="text-xs text-blue-600">{tr("Сақталуда…")}</span>}</div>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{accessModules.map(module => <label key={module} className={`flex items-start gap-3 rounded-xl border bg-white p-3 ${user.role === "admin" ? "border-slate-200 opacity-70" : "border-slate-200 hover:border-blue-200"}`}><input type="checkbox" checked={permissions.includes(module)} disabled={user.role === "admin" || saving === user.email} onChange={event => void updatePermissions(user.email, event.target.checked ? [...permissions, module] : permissions.filter(value => value !== module))} className="mt-1 size-4 accent-blue-600"/><span><b className="block text-xs font-semibold">{tr(moduleMeta[module].label)}</b><span className="mt-1 block text-[11px] leading-4 text-slate-500">{tr(moduleMeta[module].description)}</span></span></label>)}</div>
              <div className="mt-5 flex justify-end"><button disabled={openingAccount === user.email || user.email === props.sessionUser?.email} onClick={() => void openAccount(user.email)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"><Icon name="users" className="size-4"/>{tr(openingAccount === user.email ? "Ашылуда…" : "Аккаунт ретінде көру")}</button></div><div className="mt-4 grid gap-4 lg:grid-cols-2"><section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{tr("Соңғы әрекеттер")}</h3><span className="text-xs text-slate-400">{user.activity?.length || 0}</span></div><ul className="divide-y divide-slate-100">{user.activity?.slice(0, 8).map((entry, index) => <li key={`${entry.title}-${index}`} className="py-2"><p className="text-sm font-medium">{tr(entry.type)} · {entry.title}</p><p className="mt-0.5 text-xs text-slate-500">{entry.meta}</p></li>)}</ul>{!user.activity?.length && <p className="py-3 text-sm text-slate-500">{tr("Әзірге әрекеттер жоқ")}</p>}</section><section className="rounded-xl border border-slate-200 bg-white p-4"><div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-semibold">{tr("Құжаттар")}</h3><span className="text-xs text-slate-400">{user.documents?.length || 0}</span></div><ul className="divide-y divide-slate-100">{user.documents?.slice(0, 8).map(document => <li key={document.id} className="flex items-center justify-between gap-3 py-2"><span className="min-w-0"><span className="block truncate text-sm font-medium">{document.title}</span><span className="text-xs text-slate-500">{tr(document.source === "upload" ? "Жүктелген файл" : "Редакторда жасалған")}</span></span><time className="shrink-0 text-xs text-slate-400">{new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(document.updatedAt))}</time></li>)}</ul>{!user.documents?.length && <p className="py-3 text-sm text-slate-500">{tr("Құжаттар жоқ")}</p>}</section></div>
            </div>}
          </div>;
        })}
        {!filtered.length && <div className="p-10 text-center text-sm text-slate-500">{tr("Іздеу шартына сай пайдаланушы табылмады.")}</div>}
      </div>
    </section>}
  </div>;
}
