import { NextResponse } from "next/server";
import { cookieHeader, getSessionToken, readStore, writeStore } from "../_lib";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const store = await readStore();
  delete store.sessions[getSessionToken(request)];
  await writeStore(store);
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", cookieHeader("").replace("Max-Age=604800", "Max-Age=0"));
  return response;
}
