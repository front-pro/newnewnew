import { createCanvas, GlobalFonts } from "@napi-rs/canvas";
import { fileURLToPath } from "node:url";
import { PDFDocument, StandardFonts } from "pdf-lib";
export async function scannedPdf({ pages = 1, nativePage = false, pageNumber = false } = {}) {
  GlobalFonts.registerFromPath(fileURLToPath(new URL("../../public/fonts/NotoSans-Regular.ttf", import.meta.url)), "NotoOCR");
  const canvas = createCanvas(1200, 1600), context = canvas.getContext("2d");
  context.fillStyle = "white"; context.fillRect(0, 0, 1200, 1600); context.fillStyle = "black"; context.font = "42px NotoOCR";
  for (const [index, text] of ["ҚАЗАҚСТАН РЕСПУБЛИКАСЫ", "1.1. Сынақ құжаты", "2.1. Документ для проверки", "3.1. Scanned document OCR"].entries()) context.fillText(text, 80, 160 + index * 85);
  const image = canvas.toBuffer("image/png"), pdf = await PDFDocument.create();
  if (nativePage) { const font = await pdf.embedFont(StandardFonts.Helvetica); pdf.addPage([600,800]).drawText("Native paragraph should remain unchanged before the scan.", { x: 45, y: 700, size: 13, font }); }
  const png = await pdf.embedPng(image);
  for (let i = 0; i < pages; i++) {
    const page = pdf.addPage([600,800]);
    page.drawImage(png, { x: 0, y: 0, width: 600, height: 800 });
    if (pageNumber) page.drawText(String(i + 1), { x: 45, y: 25, size: 12 });
  }
  return { pdf: await pdf.save(), image };
}
