export async function readDocumentFile(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const binaryDocumentExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp"]);
  if (extension && binaryDocumentExtensions.has(extension)) {
    throw new Error("Бұл файл кеңейтімі таңдалды, бірақ оның ішіндегі мәтінді оқу әлі қосылмаған. Қазір PDF, DOCX, XLSX және басқа бинарлық пішімдер талданбайды.");
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
