"use client";
import { useState, type ChangeEvent, type FormEvent } from "react";
import Image from "next/image";
import { roleKey } from "../lib/i18n";
import { useLanguage } from "./LanguageProvider";
import { card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";
export default function SettingsPage({ props }: {
    props: WorkspaceProps;
}) {
    const { tr } = useLanguage();
    const { sessionUser, settings, setSettings, setSessionUser, setNotice } = props;
    const update = (values: Partial<typeof settings>) => setSettings((current) => ({ ...current, ...values }));
    const [profileName, setProfileName] = useState(sessionUser?.name || "");
    const [avatar, setAvatar] = useState(sessionUser?.avatar || "");
    const [profileBusy, setProfileBusy] = useState(false);
    const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) { setNotice(tr("PNG, JPG, WEBP немесе GIF форматындағы суретті таңдаңыз.")); event.target.value = ""; return; }
      if (file.size > 1024 * 1024) { setNotice(tr("Аватар суреті 1 МБ-тан аспауы керек.")); event.target.value = ""; return; }
      const reader = new FileReader();
      reader.onload = () => setAvatar(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => setNotice(tr("Аватар файлын оқу мүмкін болмады."));
      reader.readAsDataURL(file);
    };
    const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault(); setProfileBusy(true);
      try {
        const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: profileName, avatar: avatar || null }) });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || tr("Профильді сақтау мүмкін болмады."));
        setSessionUser(data.user); setProfileName(data.user.name); setAvatar(data.user.avatar || ""); setNotice(tr("Профиль жаңартылды."));
      } catch (error) { setNotice(error instanceof Error ? error.message : tr("Профильді сақтау мүмкін болмады.")); }
      finally { setProfileBusy(false); }
    };
    return <section className="space-y-5">
    <div className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">{tr("Баптаулар")}</h1><p className="mt-1 text-slate-500">{tr("Құжаттармен жұмыс істеу параметрлері")}</p></div>
    {sessionUser && <form onSubmit={saveProfile} className={card + " space-y-4"}>
      <div><h2 className="font-semibold">{tr("Профильді өңдеу")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Атыңыз бен аватарыңызды жаңартыңыз.")}</p></div>
      <div className="flex flex-wrap items-center gap-4">
        {avatar ? <Image src={avatar} alt={tr("Профиль аватары")} width={80} height={80} unoptimized className="size-20 rounded-full border border-slate-200 object-cover"/> : <div aria-hidden="true" className="flex size-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-semibold text-white">{sessionUser.name.trim().charAt(0).toUpperCase()}</div>}
        <div className="flex flex-wrap gap-2"><label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50">{tr("Аватар жүктеу")}<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={onAvatarChange} className="sr-only"/></label>{avatar && <button type="button" onClick={() => setAvatar("")} className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-semibold text-rose-700">{tr("Аватарды алып тастау")}</button>}</div>
      </div>
      <label className="block max-w-md space-y-1 text-sm font-medium">{tr("Аты-жөні")}<input required minLength={2} maxLength={80} value={profileName} onChange={(event) => setProfileName(event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-blue-500"/></label>
      <p className="text-xs text-slate-500">Email: {sessionUser.email} · {tr("Email өзгертілмейді.")}</p>
      <button disabled={profileBusy} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{profileBusy ? tr("Сақталуда…") : tr("Профильді сақтау")}</button>
    </form>}
    {sessionUser && <section className={card}>
      <h2 className="font-semibold">{tr("Аккаунт")}</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">{tr("Аты-жөні")}</dt><dd className="mt-1 font-medium">{sessionUser.name}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium">{sessionUser.email}</dd></div>
        <div><dt className="text-slate-500">{tr("Рөлі")}</dt><dd className="mt-1 font-medium">{tr(roleKey(sessionUser.role))}</dd></div>
      </dl>
    </section>}
    <section className={card + " space-y-5"}>
      <div><h2 className="font-semibold">{tr("Редактор")}</h2><p className="mt-1 text-sm text-slate-500">{tr("Бұл параметрлер осы браузерде сақталады.")}</p></div>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={settings.autosaveDraft} onChange={(event) => update({ autosaveDraft: event.target.checked })} className="mt-1 size-4 accent-blue-600"/>
        <span><span className="block text-sm font-medium">{tr("Жоба мәтінін браузерде автоматты сақтау")}</span><span className="mt-1 block text-xs text-slate-500">{tr("Өшірсеңіз, серверге сақталмаған редактор мәтіні браузерде сақталмайды.")}</span></span>
      </label>
      <label className="block max-w-md space-y-2">
        <span className="block text-sm font-medium">{tr("Редактор қаріп өлшемі:")} {settings.editorFontSize}px</span>
        <input type="range" min={12} max={20} step={1} value={settings.editorFontSize} onChange={(event) => update({ editorFontSize: Number(event.target.value) })} className="w-full accent-blue-600"/>
      </label>
      <p role="status" className="text-xs text-emerald-700">{tr("Өзгерістер автоматты түрде сақталады.")}</p>
    </section>
  </section>;
}
