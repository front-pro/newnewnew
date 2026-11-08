import { NextResponse } from "next/server";
import { cookieHeader, getSessionToken, readStore, writeStore } from "../_lib";

async function post(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", cookieHeader(""));
  try {
    const token = getSessionToken(request);
    if (token) {
      const store = await readStore();
      delete store.sessions[token];
      await writeStore(store);
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Сессия серверде тоқтатылмады" }, { status: 503, headers: { "Set-Cookie": cookieHeader(""), "Cache-Control": "private, no-store" } });
  }
  return response;
}
export const POST = (request: Request) => post(request);
