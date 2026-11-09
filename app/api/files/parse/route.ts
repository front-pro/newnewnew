import { NextResponse } from "next/server";
import { consumeAuthRateLimit, currentUser, withStoreLock } from "../../auth/_lib";
import { extractDocument } from "../../../lib/document-formats";
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
  const limit = await withStoreLock(() => consumeAuthRateLimit(request, user.email, 20, 60000, "file-parse"));
  if (limit.limited) return NextResponse.json({ error: "Файл сұраулары тым көп" }, { status: 429 });
  if (Number(request.headers.get("content-length")) > 11 * 1024 * 1024) return NextResponse.json({ error: "Файл 10 МБ-тан аспауы керек" }, { status: 413 });
  try {
    const form = await request.formData(), file = form.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Файл 10 МБ-тан аспауы керек" }, { status: 400 });
    const extension = file.name.split(".").at(-1)?.toLowerCase() || "";
    const text = await extractDocument(Buffer.from(await file.arrayBuffer()), extension);
    return NextResponse.json({ text }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Файлды оқу мүмкін болмады." }, { status: 422 }); }
}
