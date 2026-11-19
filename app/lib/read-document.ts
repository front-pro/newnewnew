
function delimitedHtml(source:string,delimiter:string) {
 const quote=String.fromCharCode(34),rows:string[][]=[];let row:string[]=[],cell="",quoted=false;
 for(let i=0;i<source.length;i++){const c=source[i];if(quoted&&c===quote&&source[i+1]===quote){cell+=quote;i++;}else if(c===quote)quoted=!quoted;else if(!quoted&&c===delimiter){row.push(cell);cell="";}else if(!quoted&&(c==="\n"||c==="\r")){if(c==="\r"&&source[i+1]==="\n")i++;row.push(cell);if(row.some(v=>v))rows.push(row);row=[];cell="";}else cell+=c;}
 row.push(cell);if(row.some(v=>v))rows.push(row);if(!rows.length)throw new Error("Файлда оқылатын мәтін жоқ.");
 const esc=(v:string)=>v.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
 return "<table><tbody>"+rows.slice(0,500).map((r,n)=>"<tr>"+r.slice(0,50).map(v=>n===0?"<th>"+esc(v)+"</th>":"<td>"+esc(v)+"</td>").join("")+"</tr>").join("")+"</tbody></table>";
}
function rtfText(raw:string) {
 return raw.replace(/\\par[d]?\b/g,"\n").replace(/\\tab\b/g,"\t").replace(/\\'([\da-f]{2})/gi,(_,hex:string)=>String.fromCharCode(parseInt(hex,16))).replace(/\\u(-?\d+)\??/g,(_,code:string)=>String.fromCharCode((Number(code)+65536)%65536)).replace(/\\[a-z]+-?\d* ?/gi,"").replace(/[{}]/g,"").trim();
}

export async function readDocumentFile(file: File, onOcr?: (pages: number) => void): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Файл 10 МБ-тан аспауы керек");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension && ["pdf", "docx", "xlsx", "ods", "pptx", "odt", "odp", "png", "jpg", "jpeg"].includes(extension)) {
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/files/parse", { method: "POST", body: form });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (data.ocrPages > 0) onOcr?.(data.ocrPages);
    return data.text;
  }
  if (extension === "csv" || extension === "tsv") {
    const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer()).replace(/^\uFEFF/, "");
    return delimitedHtml(source, extension === "tsv" ? "\\t" : ",");
  }
  if (extension === "rtf") return rtfText(new TextDecoder("windows-1252").decode(await file.arrayBuffer()));
  const binaryDocumentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"]);
  if (extension && binaryDocumentExtensions.has(extension)) {
    throw new Error("Бұл файл кеңейтімі таңдалды, бірақ оның ішіндегі мәтінді оқу әлі қосылмаған. PDF немесе DOCX форматына айналдырып көріңіз.");
  }
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const preview = bytes.subarray(0, Math.min(bytes.length, 8192));
  const binaryBytes = preview.filter((byte) => byte === 0 || (byte < 9) || (byte > 13 && byte < 32)).length;

  if (bytes.length > 0 && binaryBytes / preview.length > 0.01) {
    throw new Error(
      "Файл таңдалды, бірақ оның мәтінін оқу мүмкін болмады. Қазір PDF, DOCX, XLSX сияқты бинарлық форматтарды мәтінге айналдыру қолжетімсіз."
    );
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer).replace(/^\uFEFF/, "");
  } catch {
    try {
      return new TextDecoder("windows-1251").decode(buffer).replace(/^\uFEFF/, "");
    } catch {
      throw new Error("Файл кодтамасын оқу мүмкін болмады.");
    }
  }
}
