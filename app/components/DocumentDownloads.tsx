"use client";
import { useState } from "react";
import { downloadDocument } from "../lib/download-document";
import { useLanguage } from "./LanguageProvider";
import { button } from "./styles";
import Icon from "./Icon";
export default function DocumentDownloads({title,text,onError}:{title:string;text:string;onError:(message:string)=>void}){
 const {tr}=useLanguage();const[busy,setBusy]=useState(false);
 async function download(format:"pdf"|"docx"){setBusy(true);try{await downloadDocument(format,title,text);}catch(e){onError(e instanceof Error?tr(e.message):tr("Экспорт орындалмады"));}finally{setBusy(false);}}
 return <div className="flex gap-2">{(["docx","pdf"] as const).map(format=><button key={format} disabled={busy} onClick={()=>void download(format)} className={`${button} gap-2 border border-slate-200 bg-white text-xs`}>{busy&&<Icon name="loader" className="size-3 animate-spin"/>}{format.toUpperCase()}</button>)}</div>;
}
