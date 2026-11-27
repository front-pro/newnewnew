"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
    <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">KT Docs</p>
    <h1 className="mt-3 text-3xl font-bold text-slate-900">Бетте қате пайда болды</h1>
    <p className="mt-3 text-slate-600">Деректеріңіз сақталған болуы мүмкін. Бетті қайта жүктеп көріңіз.</p>
    <button type="button" onClick={reset} className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Қайта көру</button>
  </main>;
}
