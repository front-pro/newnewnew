"use client";

import { useRef, useState, type FormEvent, type MouseEvent } from "react";
import { useLanguage } from "./LanguageProvider";
import { usePreferences } from "./PreferencesProvider";
import { downloadDocument } from "../lib/download-document";
import { editorHtmlFromText, editorHtmlToText, sanitizeEditorHtml } from "../lib/editor-content";
import Icon from "./Icon";
import FileDropzone from "./FileDropzone";
import { button, card } from "./styles";
import type { WorkspaceProps } from "./workspace-context";

const imageLimit = 3 * 1024 * 1024;
const toolTitles: Record<string, string> = { bold: "Қалың", italic: "Көлбеу", underline: "Асты сызылған", strikeThrough: "Сызылған", formatBlock: "Тақырып", insertUnorderedList: "Маркерленген тізім", insertOrderedList: "Нөмірленген тізім", justifyLeft: "Сол жаққа туралау", justifyCenter: "Ортаға туралау", justifyRight: "Оң жаққа туралау" };

export default function EditorPage({ props }: { props: WorkspaceProps }) {
  const { tr } = useLanguage();
  const { preferences } = usePreferences();
  const area = useRef<HTMLDivElement>(null);
  const imageInput = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);
  const selectedImage = useRef<HTMLImageElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [undoState, setUndoState] = useState({ undo: false, redo: false });
  const history = useRef({ values: [props.editorText], index: 0, typing: false, timer: 0 });
  const [query, setQuery] = useState("");
  const [exporting, setExporting] = useState(false);

  function edit(value: string, isTyping = false) {
    const safe = sanitizeEditorHtml(value);
    const h = history.current;
    if (!isTyping || !h.typing) { h.values = h.values.slice(0, h.index + 1); h.values.push(safe); if (h.values.length > 40) h.values.shift(); h.index = h.values.length - 1; }
    else h.values[h.index] = safe;
    h.typing = isTyping;
    window.clearTimeout(h.timer);
    if (isTyping) h.timer = window.setTimeout(() => { h.typing = false; }, 700);
    if (area.current && area.current.innerHTML !== safe) area.current.innerHTML = safe;
    props.setEditorText(safe);
    setUndoState({ undo: h.index > 0, redo: false });
  }
  function undo(step: number) {
    const h = history.current;
    h.index = Math.max(0, Math.min(h.values.length - 1, h.index + step)); h.typing = false; window.clearTimeout(h.timer);
    const value = h.values[h.index];
    if (area.current) area.current.innerHTML = value;
    props.setEditorText(value);
    setUndoState({ undo: h.index > 0, redo: h.index < h.values.length - 1 });
  }
  function format(command: string, value?: string) {
    if (savedRange.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current); }
    area.current?.focus();
    document.execCommand(command, false, value);
    if (area.current) edit(area.current.innerHTML);
  }
  function rememberSelection() {
    const selection = window.getSelection();
    if (selection?.rangeCount && area.current?.contains(selection.anchorNode)) savedRange.current = selection.getRangeAt(0).cloneRange();
  }
  function toolbarClick(event: MouseEvent<HTMLButtonElement>, command: string, value?: string) {
    event.preventDefault();
    format(command, value);
  }
  function find(event: FormEvent) {
    event.preventDefault();
    area.current?.focus();
    let found = false;
    if (query && area.current) {
      const walker = document.createTreeWalker(area.current, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const index = (node.textContent || "").toLocaleLowerCase().indexOf(query.toLocaleLowerCase());
        if (index < 0) continue;
        const range = document.createRange(); range.setStart(node, index); range.setEnd(node, index + query.length);
        const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); rememberSelection(); found = true; break;
      }
    }
    if (!found) props.setNotice(tr("Мәтін табылмады"));
  }
  async function exportFile(format: "pdf" | "docx") {
    setExporting(true);
    try { await downloadDocument(format, props.editorTitle, sanitizeEditorHtml(props.editorText)); }
    catch (error) { props.setNotice(error instanceof Error ? tr(error.message) : tr("Экспорт орындалмады")); }
    finally { setExporting(false); }
  }
  async function insertImage(file?: File) {
    if (!file) return;
    if (!/^image\/(png|jpeg|gif)$/.test(file.type) || file.size > imageLimit) { props.setNotice(tr("PNG, JPG немесе GIF суреті 3 МБ-тан аспауы керек.")); return; }
    const reader = new FileReader();
    reader.onerror = () => props.setNotice(tr("Суретті оқу мүмкін болмады"));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !area.current) return;
      const image = new Image();
      image.onerror = () => props.setNotice(tr("Сурет файлы ашылмады"));
      image.onload = () => {
        if (!area.current || typeof reader.result !== "string") return;
        if (savedRange.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current); }
        area.current.focus();
        document.execCommand("insertHTML", false, `<img src="${reader.result}" width="${image.naturalWidth}" height="${image.naturalHeight}" alt="${file.name.replace(/[&<>\"]/g, "")}" style="max-width:100%;height:auto;width:100%">`);
        edit(area.current.innerHTML);
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  }
  function insertTable() {
    if (!area.current) return;
    if (savedRange.current) { const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(savedRange.current); }
    area.current.focus();
    const cells = Array.from({ length: 4 }, () => "<td><br></td>").join("");
    const rows = Array.from({ length: 4 }, () => `<tr>${cells}</tr>`).join("");
    document.execCommand("insertHTML", false, `<table><tbody>${rows}</tbody></table><p><br></p>`);
    edit(area.current.innerHTML);
  }
  function resizeImage(width: string) {
    const image = selectedImage.current;
    if (!image) { props.setNotice(tr("Өлшемін өзгерту үшін құжаттағы суретті таңдаңыз.")); return; }
    image.style.width = `${width}%`; image.style.height = "auto"; edit(area.current?.innerHTML || "");
  }

  const initialHtml = useRef(editorHtmlFromText(props.editorText)).current;
  const plainText = editorHtmlToText(props.editorText);
  const words = plainText ? plainText.split(/\s+/u).length : 0;
  const tools: [string, string, string?][] = [["bold", "B"], ["italic", "I"], ["underline", "U"], ["strikeThrough", "S"], ["formatBlock", "H1", "<h1>"], ["insertUnorderedList", "•"], ["insertOrderedList", "1."], ["justifyLeft", "≡"], ["justifyCenter", "≡"], ["justifyRight", "≡"]];

  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-3xl font-bold">{tr("Құжат редакторы")}</h1><p className="mt-2 text-sm text-slate-500">{tr("Мәтінді пішімдеп, сурет қосып, өзгерістерді жаңа нұсқа ретінде сақтаңыз.")}</p></div><div className="flex gap-2"><button disabled={props.editorBusy} onClick={() => props.newDocument()} className={`${button} gap-2 border border-slate-200 bg-white`}><Icon name="plus" className="size-4"/>{tr("Жаңа құжат")}</button><button disabled={props.editorBusy} onClick={props.saveEditor} className={`${button} gap-2 bg-blue-600 text-white`}><Icon name={props.editorBusy ? "loader" : "save"} className={`size-4 ${props.editorBusy ? "animate-spin" : ""}`}/>{tr(props.editorBusy ? "Сақталуда…" : "Серверге сақтау")}</button></div></div>

    <section className={`${card} space-y-3`} aria-label={tr("Құжат құралдары")}>
      <div className="flex flex-wrap items-center gap-3"><input aria-label={tr("Файл атауы")} maxLength={200} disabled={props.editorBusy} value={props.editorTitle} onChange={event => props.setEditorTitle(event.target.value)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"/><span className="text-xs text-slate-400">{props.documentId ? `v${props.editorVersion}` : tr("Кітапханаға сақталмаған")}</span></div>
      <div className="flex flex-wrap items-center gap-1 border-t border-slate-100 pt-3">
        <button disabled={!undoState.undo || props.editorBusy} onMouseDown={event => event.preventDefault()} onClick={() => undo(-1)} aria-label={tr("Болдырмау")} title={tr("Болдырмау")} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><Icon name="undo" className="size-4"/></button>
        <button disabled={!undoState.redo || props.editorBusy} onMouseDown={event => event.preventDefault()} onClick={() => undo(1)} aria-label={tr("Қайталау")} title={tr("Қайталау")} className="rounded-lg border border-slate-200 p-2 disabled:opacity-30"><Icon name="redo" className="size-4"/></button>
        <span className="mx-1 h-7 w-px bg-slate-200"/>
        {tools.map(([command, label, value]) => <button key={command} type="button" onMouseDown={event => { history.current.typing = false; toolbarClick(event, command, value); }} aria-label={tr(toolTitles[command])} title={tr(toolTitles[command])} className={`min-w-9 rounded-lg border border-slate-200 px-2 py-2 text-sm ${command === "bold" ? "font-bold" : command === "italic" ? "italic" : command === "underline" ? "underline" : ""}`}>{label}</button>)}
        <select aria-label={tr("Қаріп өлшемі")} defaultValue="3" onMouseDown={rememberSelection} onChange={event => format("fontSize", event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-xs">{[["2", "10"], ["3", "12"], ["4", "16"], ["5", "20"], ["6", "24"]].map(([size, label]) => <option key={size} value={size}>{label}</option>)}</select>
        <button type="button" onMouseDown={event => { rememberSelection(); event.preventDefault(); }} onClick={insertTable} className={`${button} gap-2 border border-slate-200 text-xs`}>{tr("4×4 кесте қосу")}</button>
        <button type="button" onMouseDown={event => { rememberSelection(); event.preventDefault(); }} onClick={() => imageInput.current?.click()} className={`${button} gap-2 border border-slate-200 text-xs`}><Icon name="upload" className="size-4"/>{tr("Сурет қосу")}</button>
        <input ref={imageInput} type="file" accept="image/png,image/jpeg,image/gif" className="hidden" onChange={event => { void insertImage(event.target.files?.[0]); event.currentTarget.value = ""; }}/>
        <select aria-label={tr("Сурет өлшемі")} defaultValue="100" onChange={event => resizeImage(event.target.value)} className="rounded-lg border border-slate-200 bg-white p-2 text-xs"><option value="100">{tr("Сурет: толық")}</option><option value="75">75%</option><option value="50">50%</option><option value="25">25%</option></select>
        <form onSubmit={find} className="ml-auto flex min-w-0 gap-1"><input aria-label={tr("Мәтіннен іздеу")} placeholder={tr("Мәтіннен іздеу")} value={query} onChange={event => setQuery(event.target.value)} className="min-w-0 max-w-40 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"/><button aria-label={tr("Келесісін табу")} className="rounded-lg border border-slate-200 p-2"><Icon name="search" className="size-4"/></button></form>
        <div className="flex gap-2">{(["docx", "pdf"] as const).map(format => <button key={format} disabled={exporting || !plainText} onClick={() => void exportFile(format)} className={`${button} gap-2 border border-slate-200 text-xs`}>{exporting && <Icon name="loader" className="size-3 animate-spin"/>}{format.toUpperCase()}</button>)}</div>
      </div>
    </section>

    <div className="overflow-x-auto rounded-xl bg-slate-200 p-3 sm:p-6"><div className="mx-auto min-h-[1056px] w-full max-w-[794px] rounded-sm bg-white px-8 py-12 shadow-lg sm:px-20 sm:py-20"><div className="mb-8 flex items-center justify-between border-b border-slate-100 pb-3 text-[10px] uppercase tracking-wider text-slate-400"><span>{tr("Құжат парағы")}</span><span>{preferences.autosave ? tr("Жоба браузерде сақталады") : tr("Автосақтау өшірілген")}</span></div><div ref={node => { area.current = node; if (node && !initialized.current) { node.innerHTML = initialHtml; initialized.current = true; } }} contentEditable={!props.editorBusy} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label={tr("Құжат мәтіні")} onInput={event => edit(event.currentTarget.innerHTML, true)} onClick={event => { const target = event.target; selectedImage.current = target instanceof HTMLImageElement ? target : null; rememberSelection(); }} onKeyUp={() => { selectedImage.current = window.getSelection()?.anchorNode?.parentElement?.closest("img") || null; rememberSelection(); }} style={{ fontSize: preferences.fontSize }} className="document-editor min-h-[850px] whitespace-pre-wrap break-words font-sans leading-8 text-slate-800 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)] [&_h1]:my-4 [&_h1]:text-3xl [&_h1]:font-bold [&_h2]:my-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_img]:my-3 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_li]:ml-6 [&_ol]:list-decimal [&_ul]:list-disc" data-placeholder={tr("Мәтінді теріңіз немесе құралдар тақтасынан сурет қосыңыз…")}/><div className="mt-12 flex justify-between border-t border-slate-100 pt-3 text-xs text-slate-400"><span>{words.toLocaleString()} {tr("сөз")} · {plainText.length.toLocaleString()} {tr("таңба")}</span><span>{tr("Жеке кабинет")}</span></div></div></div>
    <div className="mx-auto w-full max-w-[820px]"><FileDropzone disabled={props.editorBusy} onRead={(text, name, pages) => { props.newDocument(); props.setEditorText(text); props.setEditorTitle(name); if (pages) props.setNotice(tr("OCR мәтінді таныды. Нәтижені түпнұсқамен салыстырып тексеріңіз.")); }} onError={props.setNotice}/></div>
  </div>;
}
