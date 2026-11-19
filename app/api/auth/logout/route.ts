import { NextResponse } from "next/server";
import { appendAuditEvent, cookieHeader, getSessionToken, readStore, sessionUserId, withStoreLock, writeStore } from "../_lib";

async function post(request: Request) {
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", cookieHeader(""));
  try {
    const token = getSessionToken(request);
    if (token) {
      const store = await readStore();
      const userId = sessionUserId(store.sessions[token]);
      delete store.sessions[token];
      await writeStore(store);
      if (userId) await appendAuditEvent({ actorId: userId, action: "auth.logout", resourceType: "session" });
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Сессия серверде тоқтатылмады" }, { status: 503, headers: { "Set-Cookie": cookieHeader(""), "Cache-Control": "private, no-store" } });
  }
  return response;
}
export const POST = (request: Request) => withStoreLock(() => post(request));
