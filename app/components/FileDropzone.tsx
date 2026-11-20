"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Icon from "./Icon";
import { readDocumentFile } from "../lib/read-document";
import { useLanguage } from "./LanguageProvider";

export default function FileDropzone({ onRead, onError, disabled }: { onRead: (text: string, name: string, ocrPages?: number) => void; onError: (message: string) => void; disabled?: boolean }) {
  const { tr } = useLanguage();
  const [drag, setDrag] = useState(false), [busy, setBusy] = useState(false), [name, setName] = useState(""), [pdf, setPdf] = useState(false), [preview, setPreview] = useState("");
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  async function load(file?: File) {
    if (!file || disabled || busy) return;
    setBusy(true);
    const isPdf = file.name.toLowerCase().endsWith(".pdf"), isImage = /^image\/(png|jpeg)$/.test(file.type);
    setPdf(isPdf);
    if (isPdf || isImage) setPreview(URL.createObjectURL(file)); else setPreview("");
    try { let pages = 0; const text = await readDocumentFile(file, count => { pages = count; }); onRead(text, file.name, pages); setName(file.name); }
    catch (error) { onError(error instanceof Error ? tr(error.message) : tr("Файлды оқу мүмкін болмады.")); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <label onDragOver={event => { event.preventDefault(); if (!disabled) setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={event => { event.preventDefault(); setDrag(false); void load(event.dataTransfer.files[0]); }} className={`relative flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed p-4 text-sm transition ${drag ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-slate-50"} ${disabled ? "opacity-50" : ""}`}>
      <Icon name={busy ? "loader" : "upload"} className={`size-6 shrink-0 text-blue-600 ${busy ? "animate-spin" : ""}`} />
      <span className="min-w-0"><b className="block text-xs">{busy ? tr(pdf ? "PDF оқылуда. Скан болса, мәтін танылады…" : "Файл оқылуда…") : name || tr("Файл таңдаңыз немесе осында тастаңыз")}</b><span className="text-[11px] text-slate-400">PDF · DOCX · XLSX · PPTX · ODT · ODS · CSV · TSV · TXT · PNG/JPG · 10 MB · OCR: KAZ / RUS / ENG</span></span>
      <input aria-label={tr("Файл ашу")} disabled={disabled || busy} type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.png,.jpg,.jpeg,.rtf,.txt,.md,.csv,.tsv,.json,.xml,.html,.log" className="absolute inset-0 w-full opacity-0" onChange={event => { void load(event.target.files?.[0]); event.target.value = ""; }} />
    </label>
    {preview && <details className="rounded-xl border border-slate-200 bg-white p-3"><summary className="cursor-pointer text-xs font-semibold text-blue-700">{tr("Түпнұсқаны көру және мәтінмен салыстыру")}</summary>{pdf ? <iframe title={tr("Түпнұсқа PDF құжаты")} src={preview} className="mt-3 h-80 w-full rounded-lg border border-slate-100" /> : <Image unoptimized width={1000} height={800} src={preview} alt={tr("Жүктелген түпнұсқа суреті")} className="mt-3 max-h-80 max-w-full rounded-lg object-contain" />}</details>}
  </div>;
}
