import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieHeader, hashPassword, newToken, publicUser, readStore, withStoreLock, writeStore } from "../_lib";

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
    const store = await readStore();
    if (store.users.some(user => user.email === email)) return NextResponse.json({ error: "Бұл email тіркелген" }, { status: 409 });
    const salt = randomBytes(16).toString("hex");
    const user = { id: randomBytes(12).toString("hex"), name, email, salt, hash: hashPassword(password, salt), role: "user" as const };
    const token = newToken();
    store.users.push(user);
    store.sessions[token] = user.id;
    await writeStore(store);
    const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    response.headers.set("Set-Cookie", cookieHeader(token));
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Тіркелу кезінде қате шықты" }, { status: error instanceof SyntaxError ? 400 : 500 }); }
}
export const POST = (request: Request) => withStoreLock(() => post(request));
