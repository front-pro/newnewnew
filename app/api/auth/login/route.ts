import { NextResponse } from "next/server";
import { cookieHeader, hashPassword, isSameHash, newToken, publicUser, readStore, writeStore } from "../_lib";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const store = await readStore();
    const user = store.users.find(item => item.email === email);
    if (!user || !isSameHash(hashPassword(password, user.salt), user.hash))
      return NextResponse.json({ error: "Email немесе құпиясөз қате" }, { status: 401 });
    const token = newToken();
    store.sessions[token] = user.id;
    await writeStore(store);
    const response = NextResponse.json({ user: publicUser(user) });
    response.headers.set("Set-Cookie", cookieHeader(token));
    return response;
  } catch { return NextResponse.json({ error: "Кіру кезінде қате шықты" }, { status: 500 }); }
}
