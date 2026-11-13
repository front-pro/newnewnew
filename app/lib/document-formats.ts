import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { AlignmentType, Document, HeadingLevel, ImageRun, Packer, Paragraph, TextRun, type ParagraphChild } from "docx";
import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { recognizeScannedPages } from "./ocr";
import { editorHtmlToText, sanitizeEditorHtml } from "./editor-content";

export async function extractDocumentDetailed(buffer: Buffer, extension: string, signal?: AbortSignal) {
  let text: string;
  let ocrPages = 0;
  if (extension === "xlsx") {
    text = extractXlsxText(buffer);
  } else if (extension === "pdf") {
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
    let total = 0;
    const files = unzipSync(buffer, { filter(entry) { total += entry.originalSize; if (total > 20 * 1024 * 1024) throw new Error("DOCX мазмұны тым үлкен"); return entry.name === "word/document.xml"; } });
    if (!files["word/document.xml"]) throw new Error("DOCX файлының пішімі қате");
    text = (await mammoth.extractRawText({ buffer })).value;
  } else throw new Error("PDF, DOCX және XLSX файлдары қолдайды");
  if (!text.trim()) throw new Error("Файлдан мәтін табылмады. Скан сапасын тексеріңіз.");
  if (text.length > 200000) throw new Error("Құжат тым үлкен (макс. 200 000 таңба)");
  return { text, ocrPages };
}

function extractXlsxText(buffer: Buffer) {
  let files: Record<string, Uint8Array>;
  let total = 0;
  try { files = unzipSync(buffer, { filter: entry => { total += entry.originalSize; if (total > 20 * 1024 * 1024) throw new Error("XLSX мазмұны тым үлкен"); return true; } }); }
  catch { throw new Error("XLSX файлының пішімі қате немесе мазмұны тым үлкен"); }
  const xml = (name: string) => files[name] ? new TextDecoder().decode(files[name]) : "";
  const decode = (value: string) => value.replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16))).replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
  const strings = [...xml("xl/sharedStrings.xml").matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(match => [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part => decode(part[1])).join(""));
  const sheets = Object.keys(files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name)).sort((a, b) => Number(a.match(/sheet(\d+)/)?.[1]) - Number(b.match(/sheet(\d+)/)?.[1]));
  if (!sheets.length) throw new Error("XLSX файлында парақ табылмады");
  const columnIndex = (ref: string) => { let n = 0; for (const char of ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() || "") n = n * 26 + char.charCodeAt(0) - 64; return n - 1; };
  return sheets.map((name, sheetIndex) => {
    const rows = [...xml(name).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row => {
      const cells: string[] = [];
      for (const cell of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
        const ref = cell[1].match(/\br="([A-Z]+\d+)"/i)?.[1] || "A1", idx = columnIndex(ref);
        const type = cell[1].match(/\bt="([^"]+)"/)?.[1];
        const value = type === "inlineStr" ? [...cell[2].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(part => decode(part[1])).join("") : decode(cell[2].match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] || "");
        cells[idx] = type === "s" ? strings[Number(value)] || "" : value;
      }
      return cells.map(value => value || "").join("\t");
    });
    return `Парақ ${sheetIndex + 1}\n${rows.join("\n")}`;
  }).join("\n\n");
}

export async function extractDocument(buffer: Buffer, extension: string) {
  return (await extractDocumentDetailed(buffer, extension)).text;
}

export async function exportDocument(format: "pdf" | "docx", title: string, text: string) {
  const html = sanitizeEditorHtml(text);
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
