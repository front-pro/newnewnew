import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Document, Packer, Paragraph, TextRun } from "docx";
import mammoth from "mammoth";
import { unzipSync } from "fflate";
import { recognizeScannedPages } from "./ocr";

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
    let total = 0;
    const files = unzipSync(buffer, { filter(entry) { total += entry.originalSize; if (total > 20 * 1024 * 1024) throw new Error("DOCX мазмұны тым үлкен"); return entry.name === "word/document.xml"; } });
    if (!files["word/document.xml"]) throw new Error("DOCX файлының пішімі қате");
    text = (await mammoth.extractRawText({ buffer })).value;
  } else throw new Error("Тек PDF және DOCX қолдайды");
  if (!text.trim()) throw new Error("Файлдан мәтін табылмады. Скан сапасын тексеріңіз.");
  if (text.length > 200000) throw new Error("Құжат тым үлкен (макс. 200 000 таңба)");
  return { text, ocrPages };
}

export async function extractDocument(buffer: Buffer, extension: string) {
  return (await extractDocumentDetailed(buffer, extension)).text;
}

export async function exportDocument(format: "pdf" | "docx", title: string, text: string) {
  if (format === "docx") return Packer.toBuffer(new Document({ sections: [{ children: text.split(/\r?\n/).map(line => new Paragraph({ children: [new TextRun({ text: line, font: "Arial", size: 24 })] })) }] }));
  const pdf = await PDFDocument.create(); pdf.registerFontkit(fontkit); pdf.setTitle(title);
  const font = await pdf.embedFont(await readFile(path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf")), { subset: true });
  const width = 595.28, height = 841.89, margin = 48, size = 11, lineHeight = 17;
  let page = pdf.addPage([width, height]), y = height - margin;
  const line = (value: string) => { if (y < margin + lineHeight) { page = pdf.addPage([width, height]); y = height - margin; } page.drawText(value, { x: margin, y, size, font }); y -= lineHeight; };
  for (const paragraph of text.replace(/\r\n/g, "\n").replace(/\t/g,"    ").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").split("\n")) {
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
