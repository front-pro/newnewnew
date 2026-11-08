import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, cookieHeader, createSession, publicUser, readStore, tokenHash, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || token.length < 32 || token.length > 256) return NextResponse.json({ error: "Email немесе растау коды қате" }, { status: 400 });
    const result = await withStoreLock(async () => {
      const limit = await consumeAuthRateLimit(request, email, 8, 60 * 60 * 1000, "verify");
      if (limit.limited) return { limited: limit.retryAfter } as const;
      const store = await readStore();
      const key = tokenHash(token), pending = store.verificationTokens[key];
      if (!pending || Date.parse(pending.expiresAt) <= Date.now()) return { invalid: true } as const;
      const user = store.users.find(item => item.id === pending.userId && item.email === email);
      if (!user) return { invalid: true } as const;
      user.emailVerifiedAt = new Date().toISOString();
      delete store.verificationTokens[key];
      const session = createSession(store, user, request);
      await writeStore(store);
      await appendAuditEvent({ actorId: user.id, action: "auth.verify_email", resourceType: "user", resourceId: user.id });
      return { user, session };
    });
    if ("limited" in result) return NextResponse.json({ error: "Тексеру әрекеті тым көп. Кейінірек қайталаңыз." }, { status: 429, headers: { "Retry-After": String(result.limited), "Cache-Control": "private, no-store" } });
    if ("invalid" in result) return NextResponse.json({ error: "Растау коды жарамсыз немесе мерзімі өткен" }, { status: 400 });
    const response = NextResponse.json({ user: publicUser(result.user) }, { headers: { "Cache-Control": "private, no-store" } });
    response.headers.set("Set-Cookie", cookieHeader(result.session));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Email растау кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}

export const POST = (request: Request) => post(request);
