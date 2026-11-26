"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { useLanguage } from "./LanguageProvider";
import { button, card } from "./styles";

type Value = string | number | boolean;
type SectionValues = Record<string, Value>;
type Settings = Record<string, SectionValues>;
type Field = { key: string; label: string; type?: "text" | "number" | "select" | "toggle"; min?: number; max?: number; options?: string[]; hint?: string };
const defaults: Settings = {
  general: { name: "Құжат кеңістігі", timezone: "Asia/Almaty", language: "kk", dateFormat: "dd.MM.yyyy" },
  appearance: { theme: "system", accent: "#1a56ff", density: "comfortable", fontSize: 16, reducedMotion: false },
  security: { twoFactor: false, minPasswordLength: 8, sessionHours: 168, loginLimit: 5 },
  documents: { maxFileMb: 25, formats: "PDF, DOCX, XLSX, JPG, PNG", ocrLanguages: "kk, ru, en", autoCategorize: true, duplicateDetection: true, retentionDays: 365 },
  storage: { quotaGb: 20, provider: "local", backups: "Апта сайын" },
  notifications: { email: true, push: false, quietHours: "22:00–08:00" },
  integrations: { ncalayer: false, smtp: false, erp: false },
  license: { plan: "Жұмыс кеңістігі", userLimit: 100 },
  data: { exportEnabled: true, retentionDays: 365, privacyNotice: true },
};
const definitions: { id: string; title: string; description: string; icon: "settings" | "sun" | "shield" | "file" | "folder" | "mail" | "company" | "users" | "history"; fields: Field[] }[] = [
  { id: "general", title: "Жалпы баптаулар", description: "Жүйенің негізгі атауы мен тілдік параметрлері.", icon: "settings", fields: [{ key: "name", label: "Жүйе атауы" }, { key: "timezone", label: "Уақыт белдеуі", type: "select", options: ["Asia/Almaty", "Asia/Qyzylorda", "Asia/Aqtobe", "UTC"] }, { key: "language", label: "Әдепкі тіл", type: "select", options: ["kk", "ru", "en"] }, { key: "dateFormat", label: "Күн пішімі" }] },
  { id: "appearance", title: "Көрініс", description: "Әкімші интерфейсінің тақырыбы, түсі және тығыздығы.", icon: "sun", fields: [{ key: "theme", label: "Тақырып", type: "select", options: ["system", "light", "dark"] }, { key: "accent", label: "Акцент түсі" }, { key: "density", label: "Карточка тығыздығы", type: "select", options: ["comfortable", "compact"] }, { key: "fontSize", label: "Қаріп өлшемі", type: "number", min: 12, max: 22 }, { key: "reducedMotion", label: "Анимацияны азайту", type: "toggle" }] },
  { id: "security", title: "Қауіпсіздік", description: "Құпиясөз және сессия саясатына арналған басқару мәндері.", icon: "shield", fields: [{ key: "twoFactor", label: "Екі факторлы растау саясаты", type: "toggle", hint: "TOTP қосылымы осы нұсқада іске қосылмаған." }, { key: "minPasswordLength", label: "Құпиясөздің ең аз ұзындығы", type: "number", min: 8, max: 128 }, { key: "sessionHours", label: "Сессия ұзақтығы (сағат)", type: "number", min: 1, max: 720 }, { key: "loginLimit", label: "Кіру әрекеттерінің шегі", type: "number", min: 3, max: 20 }] },
  { id: "documents", title: "Құжат өңдеу", description: "Жүктеу, OCR және сақтау саясатының баптаулары.", icon: "file", fields: [{ key: "formats", label: "Рұқсат етілген форматтар" }, { key: "maxFileMb", label: "Файлдың ең үлкен көлемі (МБ)", type: "number", min: 1, max: 500 }, { key: "ocrLanguages", label: "OCR тілдері" }, { key: "autoCategorize", label: "Автоматты санаттау", type: "toggle" }, { key: "duplicateDetection", label: "Дубликатты анықтау", type: "toggle" }, { key: "retentionDays", label: "Сақтау мерзімі (күн)", type: "number", min: 1, max: 36500 }] },
  { id: "storage", title: "Сақтау орны", description: "Қолданыстағы сақтау ортасы мен резервтік көшіру жоспары.", icon: "folder", fields: [{ key: "quotaGb", label: "Квота (GB)", type: "number", min: 1, max: 100000 }, { key: "provider", label: "Сақтау түрі", type: "select", options: ["local", "S3", "MinIO"] }, { key: "backups", label: "Резервтік көшірме жиілігі", type: "select", options: ["Күн сайын", "Апта сайын", "Ай сайын"] }] },
  { id: "notifications", title: "Хабарламалар", description: "Оқиғалар туралы хабарлау арналары мен тыныш уақыт.", icon: "mail", fields: [{ key: "email", label: "Email хабарламалары", type: "toggle" }, { key: "push", label: "Push хабарламалары", type: "toggle", hint: "Push қызметі осы ортада бапталмаған." }, { key: "quietHours", label: "Тыныш сағаттар" }] },
  { id: "integrations", title: "Интеграциялар", description: "Қосымша қызметтерді қосу күйі.", icon: "company", fields: [{ key: "ncalayer", label: "NCALayer / ЭЦҚ", type: "toggle", hint: "Қызмет қосылымы осы ортада әлі орнатылмаған." }, { key: "smtp", label: "SMTP пошта қызметі", type: "toggle", hint: "SMTP құпиясөздерін бұл формаға енгізбеңіз." }, { key: "erp", label: "1C / ERP", type: "toggle", hint: "Webhook/API қосылымы бөлек іске асырылуы керек." }] },
  { id: "license", title: "Лицензия және тариф", description: "Қазіргі жоспар мен пайдаланушы шегі.", icon: "users", fields: [{ key: "plan", label: "Жоспар атауы" }, { key: "userLimit", label: "Пайдаланушы лимиті", type: "number", min: 1, max: 100000 }] },
  { id: "data", title: "Деректер", description: "Экспорт және сақтау мерзіміне қатысты саясат.", icon: "history", fields: [{ key: "exportEnabled", label: "Әкімшіге деректерді экспорттауға рұқсат", type: "toggle" }, { key: "retentionDays", label: "Журналды сақтау мерзімі (күн)", type: "number", min: 1, max: 36500 }, { key: "privacyNotice", label: "Дербес дерек туралы ескертуді қосу", type: "toggle" }] },
];

export default function AdminSettings({ setNotice }: { setNotice: (notice: string) => void }) {
  const { tr } = useLanguage();
  const [values, setValues] = useState<Settings>(defaults);
  const [saved, setSaved] = useState<Settings>(defaults);
  const [active, setActive] = useState("general");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { let live = true; fetch("/api/admin/settings", { cache: "no-store" }).then(async response => { const data = await response.json(); if (!response.ok) throw new Error(data.error || "Баптауларды жүктеу мүмкін болмады"); if (live) { const merged = { ...defaults, ...data }; setValues(merged); setSaved(merged); } }).catch(reason => { if (live) setError(reason instanceof Error ? reason.message : "Баптауларды жүктеу мүмкін болмады"); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, []);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);
  const section = definitions.find(item => item.id === active) || definitions[0];
  const update = (key: string, value: Value) => setValues(current => ({ ...current, [active]: { ...current[active], [key]: value } }));
  async function save() { setSaving(true); setError(""); try { const response = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ settings: { [active]: values[active] } }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Сақтау мүмкін болмады"); const merged = { ...values, ...data }; setValues(merged); setSaved(merged); setNotice(tr("Баптаулар сақталды.")); } catch (reason) { setError(reason instanceof Error ? tr(reason.message) : tr("Сақтау мүмкін болмады")); } finally { setSaving(false); } }
  return <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
    <nav aria-label={tr("Жүйе баптаулары")} className={`${card} h-fit space-y-1 p-2`}>{definitions.map(item => <button key={item.id} onClick={() => setActive(item.id)} aria-current={active === item.id ? "page" : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${active === item.id ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50"}`}><Icon name={item.icon} className="size-4"/>{tr(item.title)}</button>)}</nav>
    <section className={`${card} min-h-[480px] p-0`}><header className="border-b border-slate-100 px-5 py-5 sm:px-7"><p className="text-xs font-semibold uppercase tracking-[.14em] text-blue-600">{tr("Жүйе конфигурациясы")}</p><h2 className="mt-1 text-xl font-bold">{tr(section.title)}</h2><p className="mt-1 text-sm text-slate-500">{tr(section.description)}</p></header>
      {loading ? <div className="space-y-4 p-7" aria-label={tr("Жүктелуде")}>{[1, 2, 3, 4].map(item => <div key={item} className="h-12 animate-pulse rounded-xl bg-slate-100"/>)}</div> : <><div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-7">{section.fields.map(field => <label key={field.key} className={`space-y-2 text-sm font-medium text-slate-700 ${field.type === "toggle" ? "flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4" : "block"}`}><span>{tr(field.label)}{field.hint && <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">{tr(field.hint)}</span>}</span>{field.type === "toggle" ? <input type="checkbox" checked={Boolean(values[active]?.[field.key])} onChange={event => update(field.key, event.target.checked)} className="size-5 accent-blue-600"/> : field.type === "select" ? <select value={String(values[active]?.[field.key] ?? "")} onChange={event => update(field.key, event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none">{field.options?.map(option => <option key={option} value={option}>{tr(option)}</option>)}</select> : <input type={field.type || "text"} min={field.min} max={field.max} value={String(values[active]?.[field.key] ?? "")} onChange={event => update(field.key, field.type === "number" ? Number(event.target.value) : event.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"/>}</label>)}</div>
        {error && <p role="alert" className="mx-7 mb-3 text-sm text-rose-600">{tr(error)}</p>}
        <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><span className={`text-sm ${dirty ? "text-amber-700" : "text-slate-500"}`}>{tr(dirty ? "Сақталмаған өзгерістер бар" : "Барлық өзгеріс сақталған")}</span><div className="flex gap-2"><button disabled={!dirty || saving} onClick={() => setValues(saved)} className={`${button} border border-slate-200 bg-white`}>{tr("Қайтару")}</button><button disabled={!dirty || saving} onClick={() => void save()} className={`${button} gap-2 bg-blue-600 text-white`}><Icon name="check" className="size-4"/>{tr(saving ? "Сақталуда…" : "Өзгерістерді сақтау")}</button></div></footer></>}
    </section>
  </div>;
}
