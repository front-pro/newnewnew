import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, hashPassword, readStore, sessionUserId, tokenHash, withStoreLock, writeStore } from "../../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || token.length < 32 || token.length > 256 || password.length < 8 || password.length > 1024) return NextResponse.json({ error: "Email, код немесе құпиясөз талапқа сай емес" }, { status: 400 });
    const result = await withStoreLock(async () => {
      const limit = await consumeAuthRateLimit(request, email, 8, 60 * 60 * 1000, "password-reset-confirm");
      if (limit.limited) return { limited: limit.retryAfter } as const;
      const store = await readStore(), key = tokenHash(token), reset = store.passwordResetTokens[key];
      if (!reset || Date.parse(reset.expiresAt) <= Date.now()) return { invalid: true } as const;
      const user = store.users.find(item => item.id === reset.userId && item.email === email);
      if (!user) return { invalid: true } as const;
      const salt = randomBytes(16).toString("hex");
      user.salt = salt;
      user.hash = hashPassword(password, salt);
      delete store.passwordResetTokens[key];
      Object.keys(store.sessions).forEach(session => { if (sessionUserId(store.sessions[session]) === user.id) delete store.sessions[session]; });
      await writeStore(store);
      await appendAuditEvent({ actorId: user.id, action: "auth.password_reset", resourceType: "user", resourceId: user.id });
      return { ok: true as const };
    });
    if ("limited" in result) return NextResponse.json({ error: "Қайта орнату әрекеті тым көп" }, { status: 429, headers: { "Retry-After": String(result.limited) } });
    if ("invalid" in result) return NextResponse.json({ error: "Қалпына келтіру коды жарамсыз немесе мерзімі өткен" }, { status: 400 });
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Құпиясөзді өзгерту кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}

export const POST = (request: Request) => post(request);
