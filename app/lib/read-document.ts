export async function readDocumentFile(file: File, onOcr?: (pages: number) => void): Promise<string> {
  if (file.size > 10 * 1024 * 1024) throw new Error("Файл 10 МБ-тан аспауы керек");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "pdf" || extension === "docx" || extension === "xlsx") {
    const form = new FormData(); form.set("file", file);
    const response = await fetch("/api/files/parse", { method: "POST", body: form });
    const data = await response.json(); if (!response.ok) throw new Error(data.error);
    if (data.ocrPages > 0) onOcr?.(data.ocrPages);
    return data.text;
  }
  const binaryDocumentExtensions = new Set(["pdf", "doc", "docx", "xls", "ppt", "pptx", "odt", "ods", "odp"]);
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
