import { NextResponse } from "next/server";
import { consumeAuthRateLimit, currentUser, withStoreLock } from "../../auth/_lib";
import { exportDocument } from "../../../lib/document-formats";
import { editorHtmlToText } from "../../../lib/editor-content";
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
  const limit = await withStoreLock(() => consumeAuthRateLimit(request, user.email, 20, 60000, "file-export"));
  if (limit.limited) return NextResponse.json({ error: "Файл сұраулары тым көп" }, { status: 429 });
  try {
    const body = await request.json();
    if (!body || !["pdf", "docx", "xlsx"].includes(body.format) || typeof body.text !== "string" || !body.text.trim() || body.text.length > 8_000_000 || editorHtmlToText(body.text).length > 200_000 || typeof body.title !== "string" || body.title.length > 200) return NextResponse.json({ error: "Экспорт деректері қате" }, { status: 400 });
    const bytes = await exportDocument(body.format, body.title, body.text);
    const filename = (body.title.replace(/[\r\n\\/]/g, "_").replace(/\.[^.]+$/, "") || "document") + "." + body.format;
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": body.format === "pdf" ? "application/pdf" : body.format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="document.${body.format}"; filename*=UTF-8''${encodeURIComponent(filename)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return NextResponse.json({ error: "Экспорт орындалмады" }, { status: 500 }); }
}
