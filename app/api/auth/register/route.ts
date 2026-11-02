import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { cookieHeader, hashPassword, newToken, publicUser, readStore, writeStore } from "../_lib";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!name) return NextResponse.json({ error: "Атыңызды енгізіңіз" }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Email форматы дұрыс емес" }, { status: 400 });
    if (password.length < 8) return NextResponse.json({ error: "Құпиясөз кемінде 8 таңба болуы керек" }, { status: 400 });
    const store = await readStore();
    if (store.users.some(user => user.email === email)) return NextResponse.json({ error: "Бұл email тіркелген" }, { status: 409 });
    const salt = randomBytes(16).toString("hex");
    const user = { id: randomBytes(12).toString("hex"), name, email, salt, hash: hashPassword(password, salt) };
    const token = newToken();
    store.users.push(user);
    store.sessions[token] = user.id;
    await writeStore(store);
    const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
    response.headers.set("Set-Cookie", cookieHeader(token));
    return response;
  } catch { return NextResponse.json({ error: "Тіркелу кезінде қате шықты" }, { status: 500 }); }
}
