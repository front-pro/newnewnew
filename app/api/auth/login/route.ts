import { NextResponse } from "next/server";
import { cookieHeader, hashPassword, safeHashEqual, newToken, publicUser, readStore, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Сұрау объект болуы керек" }, { status: 400 });
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (email.length > 254 || password.length > 1024) return NextResponse.json({ error: "Кіру деректері тым ұзын" }, { status: 400 });
    const store = await readStore();
    const user = store.users.find(item => item.email === email);
    if (!user || !safeHashEqual(hashPassword(password, user.salt), user.hash))
      return NextResponse.json({ error: "Email немесе құпиясөз қате" }, { status: 401 });
    const token = newToken();
    store.sessions[token] = user.id;
    await writeStore(store);
    const response = NextResponse.json({ user: publicUser(user) });
    response.headers.set("Set-Cookie", cookieHeader(token));
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Кіру кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 }); }
}
export const POST = (request: Request) => withStoreLock(() => post(request));
