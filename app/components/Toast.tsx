"use client";
import { useEffect } from "react";
import Icon from "./Icon";
import { useLanguage } from "./LanguageProvider";
export default function Toast({ message, dismiss }: { message: string; dismiss: () => void }) {
  const { tr } = useLanguage();
  useEffect(() => { if (!message) return; const timer = setTimeout(dismiss, 10000); return () => clearTimeout(timer); }, [message, dismiss]);
  if (!message) return null;
  return <div className="toast fixed bottom-5 right-5 z-[70] flex max-w-[calc(100vw-2.5rem)] items-start gap-3 rounded-2xl border border-blue-200 bg-white p-4 shadow-xl sm:w-96" role="status" aria-live="polite"><span className="rounded-full bg-blue-50 p-1 text-blue-600"><Icon name="file" className="size-4"/></span><p className="min-w-0 flex-1 break-words text-sm leading-6">{tr(message)}</p><button onClick={dismiss} aria-label={tr("Хабарламаны жабу")} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100"><Icon name="close" className="size-4"/></button></div>;
}
