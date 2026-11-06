"use client";

import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

export default function SettingsPage({ props }: { props: WorkspaceProps }) {
  const { sessionUser, settings, setSettings } = props;
  const update = (values: Partial<typeof settings>) => setSettings((current) => ({ ...current, ...values }));

  return <section className="space-y-5">
    <div className="border-b border-slate-200 pb-5"><h1 className="text-3xl font-bold">Баптаулар</h1><p className="mt-1 text-slate-500">Құжаттармен жұмыс істеу параметрлері</p></div>
    {sessionUser && <section className={card}>
      <h2 className="font-semibold">Аккаунт</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-slate-500">Аты-жөні</dt><dd className="mt-1 font-medium">{sessionUser.name}</dd></div>
        <div><dt className="text-slate-500">Email</dt><dd className="mt-1 font-medium">{sessionUser.email}</dd></div>
        <div><dt className="text-slate-500">Рөлі</dt><dd className="mt-1 font-medium">{sessionUser.role}</dd></div>
      </dl>
    </section>}
    <section className={card + " space-y-5"}>
      <div><h2 className="font-semibold">Редактор</h2><p className="mt-1 text-sm text-slate-500">Бұл параметрлер осы браузерде сақталады.</p></div>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={settings.autosaveDraft} onChange={(event) => update({ autosaveDraft: event.target.checked })} className="mt-1 size-4 accent-blue-600" />
        <span><span className="block text-sm font-medium">Жоба мәтінін браузерде автоматты сақтау</span><span className="mt-1 block text-xs text-slate-500">Өшірсеңіз, серверге сақталмаған редактор мәтіні браузерде сақталмайды.</span></span>
      </label>
      <label className="block max-w-md space-y-2">
        <span className="block text-sm font-medium">Редактор қаріп өлшемі: {settings.editorFontSize}px</span>
        <input type="range" min={12} max={20} step={1} value={settings.editorFontSize} onChange={(event) => update({ editorFontSize: Number(event.target.value) })} className="w-full accent-blue-600" />
      </label>
      <p role="status" className="text-xs text-emerald-700">Өзгерістер автоматты түрде сақталады.</p>
    </section>
  </section>;
}
