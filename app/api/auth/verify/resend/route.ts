import { NextResponse } from "next/server";
import { consumeAuthRateLimit, deliverAuthEmail, newToken, readStore, tokenHash, withStoreLock, writeStore } from "../../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email форматы дұрыс емес" }, { status: 400 });
    const exposeTestTokens = process.env.NODE_ENV !== "production" || process.env.KT_EMAIL_DEV_TOKENS === "1";
    if (process.env.NODE_ENV === "production" && !exposeTestTokens && (!process.env.KT_EMAIL_DELIVERY_URL || !process.env.KT_EMAIL_DELIVERY_TOKEN)) return NextResponse.json({ error: "Email жеткізу қызметі бапталмаған" }, { status: 503 });
    const pending = await withStoreLock(async () => {
      const limit = await consumeAuthRateLimit(request, email, 3, 60 * 60 * 1000, "verify-resend");
      if (limit.limited) return { limited: limit.retryAfter } as const;
      const store = await readStore();
      const user = store.users.find(item => item.email === email && item.emailVerifiedAt === null);
      if (!user) return null;
      Object.entries(store.verificationTokens).forEach(([key, token]) => { if (token.userId === user.id) delete store.verificationTokens[key]; });
      const token = newToken();
      store.verificationTokens[tokenHash(token)] = { userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
      await writeStore(store);
      return { userId: user.id, token };
    });
    if (pending && "limited" in pending) return NextResponse.json({ error: "Қайта жіберу әрекеті тым көп" }, { status: 429, headers: { "Retry-After": String(pending.limited) } });
    if (pending && !("limited" in pending)) {
      let delivered = false;
      try { delivered = await deliverAuthEmail(email, "Email мекенжайын растау", `Аккаунтыңызды растау коды: ${pending.token}\nКод 24 сағат жарамды.`); } catch {}
      if (process.env.NODE_ENV === "production" && !delivered && !exposeTestTokens) return NextResponse.json({ error: "Растау хаты жіберілмеді" }, { status: 503 });
      return NextResponse.json({ ok: true, ...(!delivered && exposeTestTokens ? { verificationToken: pending.token } : {}) }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ ok: true }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Хатты қайта жіберу кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}

export const POST = (request: Request) => post(request);
