import path from "node:path";
import { createWorker, OEM, type Worker } from "tesseract.js";

export const MAX_OCR_PAGES = 10;
const state = globalThis as typeof globalThis & { ktOcrActive?: boolean };
export class OcrError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}

/** One bounded worker per process; all language data stays on this server. */
export async function recognizeScannedPages(pages: number[], render: (page: number) => Promise<Uint8Array>, signal?: AbortSignal) {
  if (!pages.length) return new Map<number, string>();
  if (pages.length > MAX_OCR_PAGES) throw new OcrError("OCR үшін бір файлда ең көбі 10 скан беті болуы керек", 413);
  if (state.ktOcrActive) throw new OcrError("OCR қазір бос емес. Сәл кейін қайталаңыз.", 429);
  if (signal?.aborted) throw new OcrError("OCR тоқтатылды", 408);
  state.ktOcrActive = true;
  let worker: Worker | undefined;
  let stopped = false, cleaned = false;
  const cleanup = async () => {
    if (cleaned) return;
    cleaned = true;
    try { await worker?.terminate(); } catch {} finally { state.ktOcrActive = false; }
  };
  const creation = createWorker(["kaz", "rus", "eng"], OEM.LSTM_ONLY, {
    langPath: path.join(process.cwd(), "assets", "ocr"),
    cacheMethod: "none", gzip: true, errorHandler: () => {},
  }).then(async created => {
    worker = created;
    if (stopped) { await cleanup(); throw new OcrError("OCR тоқтатылды", 408); }
    return created;
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  let abort: (() => void) | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new OcrError("OCR уақыты аяқталды. Файлды шағын бөліктерге бөліп көріңіз.", 408)), 90000);
    abort = () => reject(new OcrError("OCR тоқтатылды", 408));
    signal?.addEventListener("abort", abort, { once: true });
  });
  const task = async () => {
    const engine = await creation;
    await engine.setParameters({ preserve_interword_spaces: "1", user_defined_dpi: "200" });
    const output = new Map<number, string>();
    let length = 0;
    for (const number of pages) {
      if (signal?.aborted || stopped) throw new OcrError("OCR тоқтатылды", 408);
      const image = await render(number);
      if (stopped) throw new OcrError("OCR тоқтатылды", 408);
      const result = await engine.recognize(Buffer.from(image));
      const text = result.data.text.trim();
      length += text.length;
      if (length > 200000) throw new OcrError("Құжат тым үлкен (макс. 200 000 таңба)", 413);
      output.set(number, text);
    }
    return output;
  };
  try { return await Promise.race([task(), limit]); }
  catch (error) {
    if (error instanceof OcrError) throw error;
    throw new OcrError("OCR мәтінді тани алмады. Скан сапасын тексеріңіз.");
  } finally {
    stopped = true;
    clearTimeout(timer);
    if (abort) signal?.removeEventListener("abort", abort);
    if (worker) await cleanup();
    else void creation.then(cleanup, cleanup);
  }
}
