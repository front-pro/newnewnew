import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, type ParagraphChild } from "docx";
import mammoth from "mammoth";
import { unzipSync, zipSync } from "fflate";
import { recognizeScannedPages } from "./ocr";
import { editorHtmlToText, sanitizeEditorHtml } from "./editor-content";


const xmlDecode = (v: string) => v.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"').replace(/&apos;/g,"'");
const htmlEscape = (v: string) => v.replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]!));
const xmlText = (v: string) => xmlDecode(v.replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim());
function zipOffice(buffer: Buffer) { let total=0; return unzipSync(buffer,{filter(entry){total+=entry.originalSize;if(total>20*1024*1024)throw new Error("Құжат мазмұны тым үлкен");return true;}}); }
function colIndex(ref:string) { const letters=ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase()||"A";return [...letters].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1; }
function rowsHtml(rows:string[][],title?:string) { if(!rows.length)return "";const prefix=title?"<h2>"+htmlEscape(title)+"</h2>":"";return prefix+"<table><tbody>"+rows.map((row,i)=>"<tr>"+row.map(cell=>i===0?"<th>"+htmlEscape(cell)+"</th>":"<td>"+htmlEscape(cell)+"</td>").join("")+"</tr>").join("")+"</tbody></table>"; }
function xlsxHtml(files:Record<string,Uint8Array>) {
 const shared=[...(new TextDecoder().decode(files["xl/sharedStrings.xml"]||new Uint8Array()).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g))].map(m=>[...m[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join(""));
 const sheets=Object.keys(files).filter(n=>/^xl\/worksheets\/sheet\d+\.xml$/.test(n)).sort((a,b)=>Number(a.match(/sheet(\d+)/)?.[1])-Number(b.match(/sheet(\d+)/)?.[1])).slice(0,10);
 return sheets.map((name,index)=>{const xml=new TextDecoder().decode(files[name]),rows:string[][]=[];for(const rm of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){const row:string[]=[];for(const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const attrs=cm[1],body=cm[2]||"",ref=attrs.match(/\br="([A-Z]+\d+)"/i)?.[1]||"",idx=ref?colIndex(ref):row.length;if(idx>49)continue;const type=attrs.match(/\bt="([^"]+)"/)?.[1],value=body.match(/<v>([\s\S]*?)<\/v>/)?.[1]||"",formula=body.match(/<f[^>]*>([\s\S]*?)<\/f>/)?.[1];let text=type==="s"?shared[Number(xmlText(value))]||"":type==="inlineStr"?[...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(t=>xmlText(t[1])).join(""):xmlText(value);if(!text&&formula)text="="+xmlText(formula);row[idx]=text;}if(row.length)rows.push(Array.from({length:Math.min(50,row.length)},(_,i)=>row[i]||""));if(rows.length>=500)break;}return rowsHtml(rows,"Sheet "+(index+1));}).join("");
}
function odsHtml(files:Record<string,Uint8Array>) {
 const xml=files["content.xml"]?new TextDecoder().decode(files["content.xml"]):"",tables=[...xml.matchAll(/<table:table\b[^>]*>([\s\S]*?)<\/table:table>/g)].slice(0,10);
 return tables.map((tm,index)=>{const rows:string[][]=[];for(const rm of tm[1].matchAll(/<table:table-row\b[^>]*>([\s\S]*?)<\/table:table-row>/g)){const row:string[]=[];for(const cm of rm[1].matchAll(/<table:table-cell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/table:table-cell>)/g)){const repeat=Math.max(1,Math.min(50,Number(cm[1].match(/table:number-columns-repeated="(\d+)"/)?.[1]||1))),p=cm[2]?.match(/<text:p\b[^>]*>([\s\S]*?)<\/text:p>/)?.[1],value=p?xmlText(p):cm[1].match(/office:value="([^"]+)"/)?.[1]||"";for(let i=0;i<repeat&&row.length<50;i++)row.push(value);}if(row.length)rows.push(row);if(rows.length>=500)break;}return rowsHtml(rows,"Sheet "+(index+1));}).join("");
}
function officeXmlText(files:Record<string,Uint8Array>,ext:string) { const names=Object.keys(files).filter(n=>ext==="pptx"?/^ppt\/slides\/slide\d+\.xml$/.test(n):n==="content.xml").sort();return names.slice(0,100).map(n=>[...new TextDecoder().decode(files[n]).matchAll(/<(?:a:t|text:p|w:t)\b[^>]*>([\s\S]*?)<\/(?:a:t|text:p|w:t)>/g)].map(m=>xmlText(m[1])).filter(Boolean).map(t=>"<p>"+htmlEscape(t)+"</p>").join("")).join(""); }

export async function extractDocumentDetailed(buffer: Buffer, extension: string, signal?: AbortSignal) {
  let text: string;
  let ocrPages = 0;
  if (extension === "pdf") {
    if (!buffer.subarray(0, 1024).includes(Buffer.from("%PDF-"))) throw new Error("PDF файлының пішімі қате");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer), isEvalSupported: false });
    try {
      const info = await parser.getInfo({ parsePageInfo: true });
      if (info.total > 100) throw new Error("PDF 100 беттен аспауы керек");
      const result = await parser.getText({ pageJoiner: "\n\n" });
      // Preserve short native text; only pages with a large image need OCR.
      // A scan may still have a native page number or a short header.
      const shortPages = result.pages.filter(page => page.text.replace(/[^\p{L}\p{N}]/gu, "").length < 24).map(page => page.num);
      const images = shortPages.length ? await parser.getImage({ partial: shortPages, imageThreshold: 256, imageBuffer: false, imageDataUrl: false }) : null;
      const candidates = images?.pages.filter(page => page.images.length).map(page => page.pageNumber) ?? [];
      const recognized = await recognizeScannedPages(candidates, async number => {
        const pageInfo = info.pages.find(page => page.pageNumber === number);
        if (!pageInfo || pageInfo.width <= 0 || 1600 * 1600 * pageInfo.height / pageInfo.width > 12_000_000) throw new Error("OCR суреті тым үлкен");
        const screenshot = await parser.getScreenshot({ partial: [number], desiredWidth: 1600, imageBuffer: true, imageDataUrl: false });
        const image = screenshot.pages[0];
        if (!image || image.width * image.height > 12_000_000) throw new Error("OCR суреті тым үлкен");
        return image.data;
      }, signal);
      ocrPages = recognized.size;
      text = result.pages.map(page => recognized.get(page.num) || page.text).join("\n\n");
    } finally { await parser.destroy(); }
  } else if (extension === "docx") {
    const files = zipOffice(buffer);
    if (!files["word/document.xml"]) throw new Error("DOCX файлының пішімі қате");
    text = (await mammoth.convertToHtml({ buffer })).value;
  } else if (["png", "jpg", "jpeg"].includes(extension)) {
    if (buffer.length > 4 * 1024 * 1024) throw new Error("OCR суреті тым үлкен");
    if (extension === "png" && buffer.subarray(0,8).toString("hex") !== "89504e470d0a1a0a" || ["jpg","jpeg"].includes(extension) && !(buffer[0] === 0xff && buffer[1] === 0xd8)) throw new Error("Сурет файлының пішімі қате");
    const recognized = await recognizeScannedPages([1], async () => new Uint8Array(buffer), signal);
    text = recognized.get(1) || ""; ocrPages = recognized.size;
  } else if (extension === "xlsx") {
    const files = zipOffice(buffer);
    if (!files["xl/workbook.xml"]) throw new Error("XLSX файлының пішімі қате");
    text = xlsxHtml(files);
  } else if (extension === "ods") {
    const files = zipOffice(buffer);
    if (!files["content.xml"]) throw new Error("ODS файлының пішімі қате");
    text = odsHtml(files);
  } else if (["pptx", "odt", "odp"].includes(extension)) {
    text = officeXmlText(zipOffice(buffer), extension);
  } else throw new Error("Қолдау көрсетілетін форматтар: PDF, DOCX, XLSX, ODS, PPTX, ODT, ODP");
  if (!text.trim() || !editorHtmlToText(text).trim()) throw new Error("Файлдан оқылатын мәтін табылмады.");
  if (text.length > 200000) throw new Error("Құжат тым үлкен (макс. 200 000 таңба)");
  return { text, ocrPages };
}

export async function extractDocument(buffer: Buffer, extension: string) {
  return (await extractDocumentDetailed(buffer, extension)).text;
}


function xlsxExport(html: string) {
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(row =>
    [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => editorHtmlToText(cell[1]).replace(/\n/g, " ").trim())
  ).filter(row => row.length).slice(0, 500);
  if (!rows.length) rows.push(...editorHtmlToText(html).split(/\n+/).slice(0, 500).map(line => [line]));
  const escape = (value: string) => value.replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]!);
  const column = (n: number) => { let label = ""; for (n++; n; n = Math.floor((n - 1) / 26)) label = String.fromCharCode(65 + (n - 1) % 26) + label; return label; };
  const sheet = rows.map((row, r) => "<row r=\"" + (r + 1) + "\">" + row.slice(0, 50).map((value, c) => {
    const ref = column(c) + (r + 1);
    const formula = value.match(/^=([A-Z][A-Z0-9_.]*\(.+\))$/i)?.[1];
    if (formula) return "<c r=\"" + ref + "\"><f>" + escape(formula) + "</f><v></v></c>";
    if (/^-?\d+(?:\.\d+)?$/.test(value)) return "<c r=\"" + ref + "\"><v>" + value + "</v></c>";
    return "<c r=\"" + ref + "\" t=\"inlineStr\"><is><t xml:space=\"preserve\">" + escape(value) + "</t></is></c>";
  }).join("") + "</row>").join("");
  const files: Record<string, Uint8Array> = {
    "[Content_Types].xml": new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'),
    "_rels/.rels": new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    "xl/workbook.xml": new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets><calcPr calcMode="auto"/></workbook>'),
    "xl/_rels/workbook.xml.rels": new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
    "xl/worksheets/sheet1.xml": new TextEncoder().encode('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>' + sheet + '</sheetData></worksheet>')
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

export async function exportDocument(format: "pdf" | "docx" | "xlsx", title: string, text: string) {
  const html = sanitizeEditorHtml(text);
  if (format === "xlsx") return xlsxExport(html);
  if (format === "docx") {
    const paragraphs: Paragraph[] = [];
    const tokens = html.match(/<[^>]+>|[^<]+/g) || [];
    let runs: ParagraphChild[] = [];
    const style = { bold: false, italics: false, underline: false, strike: false };
    let runSize = 24;
    let heading = 0;
    let alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT;
    const finish = () => {
      paragraphs.push(new Paragraph({ children: runs.length ? runs : [new TextRun("")], alignment, ...(heading ? { heading: heading === 1 ? HeadingLevel.HEADING_1 : heading === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3 } : {}) }));
      runs = []; heading = 0; alignment = AlignmentType.LEFT;
    };
    for (const token of tokens) {
      const tag = token.match(/^<(\/)?([a-z0-9]+)([^>]*)>$/i);
      if (!tag) { if (token) runs.push(new TextRun({ text: decodeHtml(token), font: "Arial", size: runSize, bold: style.bold, italics: style.italics, underline: style.underline ? {} : undefined, strike: style.strike })); continue; }
      const closing = !!tag[1], name = tag[2].toLowerCase();
      if (!closing && /^h[1-3]$/.test(name)) heading = Number(name[1]);
      if (!closing && name === "p") {
        const align = tag[3].match(/text-align:(left|center|right|justify)/i)?.[1]?.toLowerCase();
        if (align === "center") alignment = AlignmentType.CENTER; else if (align === "right") alignment = AlignmentType.RIGHT; else if (align === "justify") alignment = AlignmentType.BOTH;
      }
      if (name === "span") {
        if (closing) runSize = 24;
        else { const px = tag[3].match(/font-size:(\d{1,2})px/i)?.[1]; if (px) runSize = Math.round(Math.max(10, Math.min(48, Number(px))) * 1.5); }
      }
      if (!closing && name === "li") runs.push(new TextRun({ text: "• ", font: "Arial", size: 24 }));
      if (name === "strong" || name === "b") style.bold = !closing;
      if (name === "em" || name === "i") style.italics = !closing;
      if (name === "u") style.underline = !closing;
      if (name === "s") style.strike = !closing;
      if (!closing && name === "img") {
        const src = tag[3].match(/\bsrc="(data:image\/(png|jpeg|gif);base64,[^"]+)"/i);
        if (src) { const kind = src[2].toLowerCase(); const data = Buffer.from(src[1].split(",")[1], "base64"); if (data.length <= 3_100_000) { const imageWidth = Number(tag[3].match(/\bwidth="(\d{1,4})"/i)?.[1] || 480), imageHeight = Number(tag[3].match(/\bheight="(\d{1,4})"/i)?.[1] || 320), scale = Math.min(1, 480 / imageWidth, 640 / imageHeight); runs.push(new ImageRun({ data, type: kind === "jpeg" ? "jpg" : kind as "png" | "gif", transformation: { width: Math.round(imageWidth * scale), height: Math.round(imageHeight * scale) }, altText: { description: "Құжатқа енгізілген сурет" } })); } }
      }
      if (closing && /^(p|div|li|h[1-3]|blockquote)$/.test(name)) finish();
      if (name === "br" && !closing) finish();
    }
    if (runs.length || !paragraphs.length) finish();
    return Packer.toBuffer(new Document({ sections: [{ children: paragraphs }] }));
  }
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit); pdf.setTitle(title);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")), { subset: true });
  const width = 595.28, height = 841.89, margin = 48, size = 11, lineHeight = 17;
  let page = pdf.addPage([width, height]), y = height - margin;
  const line = (value: string) => { if (y < margin + lineHeight) { page = pdf.addPage([width, height]); y = height - margin; } page.drawText(value, { x: margin, y, size, font }); y -= lineHeight; };
  for (const paragraph of editorHtmlToText(html).replace(/\r\n/g, "\n").replace(/\t/g,"    ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").split("\n")) {
    if (!paragraph) { line(""); continue; }
    let current = "";
    for (const word of paragraph.split(/(\s+)/)) {
      if (font.widthOfTextAtSize(current + word, size) <= width - 2 * margin) { current += word; continue; }
      if (current) { line(current.trimEnd()); current = ""; }
      if (!word.trim()) continue;
      for (const character of word) { if (font.widthOfTextAtSize(current + character, size) > width - 2 * margin) { line(current); current = ""; } current += character; }
    }
    line(current);
  }
  pdf.getPages().forEach((p,i) => p.drawText(`${i + 1} / ${pdf.getPageCount()}`, { x: margin, y: 24, size: 8, font }));
  return Buffer.from(await pdf.save());
}

function decodeHtml(value: string) {
  return value.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}
