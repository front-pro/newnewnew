import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, currentUser, getSessionToken, hashPassword, readStore, safeHashEqual, sessionUserId, withStoreLock, writeStore } from "../_lib";
export const POST = (request: Request) => withStoreLock(async () => {
  try {
    const store = await readStore(), user = await currentUser(request, store);
    if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
    const limit = await consumeAuthRateLimit(request, user.email, 5, 15 * 60 * 1000, "change-password");
    if (limit.limited) return NextResponse.json({ error: "Қайта орнату әрекеті тым көп" }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const body = await request.json();
    if (typeof body.currentPassword !== "string" || typeof body.password !== "string" || body.password.length < 8 || body.password.length > 1024 || body.currentPassword.length > 1024) return NextResponse.json({ error: "Құпиясөз кемінде 8 таңба болуы керек" }, { status: 400 });
    if (!safeHashEqual(hashPassword(body.currentPassword, user.salt), user.hash)) return NextResponse.json({ error: "Ағымдағы құпиясөз қате" }, { status: 400 });
    user.salt = randomBytes(16).toString("hex"); user.hash = hashPassword(body.password, user.salt);
    const token = getSessionToken(request);
    for (const [key, session] of Object.entries(store.sessions)) if (key !== token && sessionUserId(session) === user.id) delete store.sessions[key];
    await writeStore(store);
    await appendAuditEvent({ actorId: user.id, action: "auth.change_password", resourceType: "user", resourceId: user.id });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Құпиясөзді өзгерту кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 }); }
});
