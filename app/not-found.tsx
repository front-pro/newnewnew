import Link from "next/link";

export default function NotFound() {
  return <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-6 text-center">
    <p className="text-sm font-semibold uppercase tracking-widest text-blue-700">KT Docs · 404</p>
    <h1 className="mt-3 text-3xl font-bold text-slate-900">Бұл бет табылмады</h1>
    <p className="mt-3 text-slate-600">Сілтемені тексеріңіз немесе басты бетке қайтыңыз.</p>
    <Link href="/" className="mt-6 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">Басты бетке қайту</Link>
  </main>;
}
