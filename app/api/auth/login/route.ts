import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, cookieHeader, createSession, hashPassword, safeHashEqual, publicUser, readStore, tokenHash, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Сұрау объект болуы керек" }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (email.length > 254 || password.length > 1024) return NextResponse.json({ error: "Кіру деректері тым ұзын" }, { status: 400 });
    const limit = await consumeAuthRateLimit(request, email, 10, 15 * 60 * 1000, "login");
    if (limit.limited) return NextResponse.json({ error: "Кіру әрекеті тым көп. Біраздан соң қайталап көріңіз." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "private, no-store" } });
    const store = await readStore();
    const user = store.users.find(item => item.email === email);
    if (!user || !safeHashEqual(hashPassword(password, user.salt), user.hash)) {
      await appendAuditEvent({ actorId: null, action: "auth.login_failed", resourceType: "account", metadata: { accountHash: tokenHash(email) } });
      return NextResponse.json({ error: "Email немесе құпиясөз қате" }, { status: 401 });
    }
    if (user.emailVerifiedAt === null) return NextResponse.json({ error: "Кіру алдында email мекенжайын растаңыз" }, { status: 403, headers: { "Cache-Control": "private, no-store" } });
    const token = createSession(store, user, request);
    await writeStore(store);
    await appendAuditEvent({ actorId: user.id, action: "auth.login", resourceType: "session" });
    const response = NextResponse.json({ user: publicUser(user) });
    response.headers.set("Set-Cookie", cookieHeader(token));
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Кіру кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 }); }
}
export const POST = (request: Request) => withStoreLock(() => post(request));
