import { NextResponse } from "next/server";
import { consumeAuthRateLimit, deliverAuthEmail, newToken, readStore, tokenHash, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email форматы дұрыс емес" }, { status: 400 });
    const exposeTestTokens = process.env.NODE_ENV !== "production" || process.env.KT_EMAIL_DEV_TOKENS === "1";
    if (process.env.NODE_ENV === "production" && !exposeTestTokens && (!process.env.KT_EMAIL_DELIVERY_URL || !process.env.KT_EMAIL_DELIVERY_TOKEN)) return NextResponse.json({ error: "Email жеткізу қызметі бапталмаған" }, { status: 503 });
    const result = await withStoreLock(async () => {
      const limit = await consumeAuthRateLimit(request, email, 3, 60 * 60 * 1000, "password-reset");
      if (limit.limited) return { limited: limit.retryAfter } as const;
      const store = await readStore();
      const user = store.users.find(item => item.email === email);
      if (!user) return null;
      Object.entries(store.passwordResetTokens).forEach(([key, token]) => { if (token.userId === user.id) delete store.passwordResetTokens[key]; });
      const token = newToken();
      store.passwordResetTokens[tokenHash(token)] = { userId: user.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString() };
      await writeStore(store);
      return { token };
    });
    if (result && "limited" in result) return NextResponse.json({ error: "Қалпына келтіру сұрауы тым көп" }, { status: 429, headers: { "Retry-After": String(result.limited) } });
    if (result && !("limited" in result)) {
      let delivered = false;
      try { delivered = await deliverAuthEmail(email, "Құпиясөзді қалпына келтіру", `Құпиясөзді қалпына келтіру коды: ${result.token}\nКод 1 сағат жарамды.`); } catch {}
      if (process.env.NODE_ENV === "production" && !delivered && !exposeTestTokens) return NextResponse.json({ error: "Хат жіберілмеді. Кейінірек қайталап көріңіз." }, { status: 503 });
      if (!delivered && exposeTestTokens) return NextResponse.json({ ok: true, resetToken: result.token }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
    }
    return NextResponse.json({ ok: true, message: "Егер бұл email аккаунтқа тіркелген болса, нұсқаулық жіберілді." }, { status: 202, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Құпиясөзді қалпына келтіру кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 });
  }
}

export const POST = (request: Request) => post(request);
