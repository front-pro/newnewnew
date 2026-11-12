import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, deliverAuthEmail, hashPassword, newToken, publicUser, readStore, tokenHash, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Сұрау объект болуы керек" }, { status: 400 });
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name || name.length > 100) return NextResponse.json({ error: "Атыңызды енгізіңіз (ең көбі 100 таңба)" }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email форматы дұрыс емес" }, { status: 400 });
    if (email.length > 254) return NextResponse.json({ error: "Email тым ұзын" }, { status: 400 });
    if (password.length < 8 || password.length > 1024) return NextResponse.json({ error: "Құпиясөз 8–1024 таңба болуы керек" }, { status: 400 });
    const exposeTestTokens = process.env.NODE_ENV !== "production" || process.env.KT_EMAIL_DEV_TOKENS === "1";
    if (process.env.NODE_ENV === "production" && !exposeTestTokens && (!process.env.KT_EMAIL_DELIVERY_URL || !process.env.KT_EMAIL_DELIVERY_TOKEN)) return NextResponse.json({ error: "Email жеткізу қызметі әлі бапталмаған" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    const result = await withStoreLock(async () => {
      const limit = await consumeAuthRateLimit(request, email, 5, 60 * 60 * 1000, "register");
      if (limit.limited) return { limited: limit.retryAfter } as const;
      const store = await readStore();
      if (store.users.some(user => user.email === email)) return { conflict: true as const };
      const salt = randomBytes(16).toString("hex");
      const user = { id: randomBytes(12).toString("hex"), name, email, salt, hash: hashPassword(password, salt), role: "user" as const, emailVerifiedAt: null };
      const verificationToken = newToken();
      store.users.push(user);
      store.verificationTokens[tokenHash(verificationToken)] = { userId: user.id, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() };
      await writeStore(store);
      await appendAuditEvent({ actorId: user.id, action: "auth.register", resourceType: "user", resourceId: user.id });
      return { user, verificationToken };
    });
    if ("limited" in result) return NextResponse.json({ error: "Тіркелу әрекеті тым көп. Кейінірек қайталап көріңіз." }, { status: 429, headers: { "Retry-After": String(result.limited), "Cache-Control": "private, no-store" } });
    if ("conflict" in result) return NextResponse.json({ error: "Бұл email тіркелген" }, { status: 409 });
    const { user, verificationToken } = result;
    let delivered = false;
    try { delivered = await deliverAuthEmail(email, "Email мекенжайын растау", `Аккаунтыңызды растау коды: ${verificationToken}\nКод 24 сағат жарамды.`); }
    catch { /* Keep the account pending; its token can be resent. */ }
    if (process.env.NODE_ENV === "production" && !delivered && !exposeTestTokens) return NextResponse.json({ error: "Растау хаты жіберілмеді. Кейінірек қайта жіберіңіз.", verificationRequired: true }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    return NextResponse.json({ user: publicUser(user), verificationRequired: true, ...(!delivered && exposeTestTokens ? { verificationToken } : {}) }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Тіркелу кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 }); }
}
export const POST = (request: Request) => post(request);
