export async function downloadDocument(format: "pdf" | "docx" | "xlsx", title: string, text: string) {
  const response = await fetch("/api/files/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, title, text }) });
  if (!response.ok) { const data = await response.json(); throw new Error(data.error || "Экспорт орындалмады"); }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a"); link.href = url; link.download = title.replace(/\.[^.]+$/, "") + "." + format; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
