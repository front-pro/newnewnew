import { NextResponse } from "next/server";
import { appendAuditEvent, cookieHeader, currentUser, getSessionToken, readStore, sessionUserId, withStoreLock, withStoreReadLock, writeStore } from "../_lib";

async function get(request: Request) {
  const store = await readStore(), user = await currentUser(request, store);
  if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
  const currentToken = getSessionToken(request);
  const sessions = Object.entries(store.sessions).flatMap(([token, session]) => {
    if (sessionUserId(session) !== user.id || typeof session === "string") return [];
    return [{ id: session.id, createdAt: session.createdAt, expiresAt: session.expiresAt, userAgent: session.userAgent, current: token === currentToken }];
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return NextResponse.json({ sessions }, { headers: { "Cache-Control": "private, no-store" } });
}

async function post(request: Request) {
  return withStoreLock(async () => {
    const store = await readStore(), user = await currentUser(request, store);
    if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
    const currentToken = getSessionToken(request);
    let revoked = 0;
    Object.entries(store.sessions).forEach(([token, session]) => {
      if (token !== currentToken && sessionUserId(session) === user.id) { delete store.sessions[token]; revoked++; }
    });
    await writeStore(store);
    await appendAuditEvent({ actorId: user.id, action: "auth.revoke_other_sessions", resourceType: "session", metadata: { revoked } });
    return NextResponse.json({ ok: true, revoked }, { headers: { "Cache-Control": "private, no-store" } });
  });
}

async function remove(request: Request) {
  return withStoreLock(async () => {
    const store = await readStore(), user = await currentUser(request, store);
    if (!user) return NextResponse.json({ error: "Жүйеге кіріңіз" }, { status: 401 });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.id !== "string") return NextResponse.json({ error: "Сессия идентификаторы қажет" }, { status: 400 });
    const entry = Object.entries(store.sessions).find(([, session]) => typeof session !== "string" && session.id === body.id && sessionUserId(session) === user.id);
    if (!entry) return NextResponse.json({ error: "Сессия табылмады" }, { status: 404 });
    delete store.sessions[entry[0]];
    await writeStore(store);
    await appendAuditEvent({ actorId: user.id, action: "auth.revoke_session", resourceType: "session", resourceId: body.id });
    const response = NextResponse.json({ ok: true, current: entry[0] === getSessionToken(request) }, { headers: { "Cache-Control": "no-store" } });
    if (entry[0] === getSessionToken(request)) response.headers.set("Set-Cookie", cookieHeader(""));
    return response;
  });
}

export const GET = (request: Request) => withStoreReadLock(() => get(request));
export const POST = (request: Request) => post(request);
export const DELETE = (request: Request) => remove(request);
