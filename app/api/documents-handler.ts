import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { summarizeDocument } from "../lib/documents";
import type { SavedDocument } from "../lib/documents";
import { currentUser, readStore, stamp, writeStore } from "./auth/_lib";
import type { Store, User } from "./auth/_lib";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);

export async function handleDocumentRequest(request: Request, path: string[]) {
  const store = await readStore();
  const url = new URL(request.url);
  const workspaceScope = url.searchParams.has("workspaceId") ? url.searchParams.get("workspaceId") || null : undefined;
  return handleDocuments(request, path, store, await currentUser(request, store), workspaceScope);
}

export async function handleDocuments(request: Request, path: string[], store: Store, user: User | null, workspaceScope?: string | null) {
  if (!user) return fail("Жүйеге кіріңіз", 401);
  const method = request.method;
  const permission = (document: SavedDocument): "owner" | "editor" | "commenter" | "viewer" | "none" => {
    if (document.owner === user.email) return "owner";
    if (document.workspaceId && store.memberships.some(item => item.workspaceId === document.workspaceId && item.userId === user.id)) {
      return document.shares?.find(item => item.email === user.email)?.permission || "none";
    }
    return document.shares?.find(item => item.email === user.email)?.permission || "none";
  };
  const canEdit = (document: SavedDocument) => ["owner", "editor"].includes(permission(document));
  const owned = store.documents.filter(document => permission(document) !== "none" && (workspaceScope === undefined || (workspaceScope === null ? !document.workspaceId : document.workspaceId === workspaceScope)));

  if (path.length === 2 && path[1] === "comments" && method === "GET") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    return json(document.comments || []);
  }
  if (path.length === 2 && path[1] === "comments" && method === "POST") {
    const document = owned.find(item => item.id === path[0]);
    if (!document || !["owner", "editor", "commenter"].includes(permission(document))) return fail("Пікір қалдыруға рұқсат жоқ", 403);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 5000) return fail("Пікір 1–5 000 таңба болуы керек");
    const comment = { id: randomUUID(), author: user.email, text, createdAt: new Date().toISOString() };
    document.comments = [...(document.comments || []), comment];
    await writeStore(store);
    return json(comment, 201);
  }

  if (path.length === 2 && path[1] === "shares" && method === "GET") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    return json(document.shares || []);
  }
  if (path.length === 2 && path[1] === "shares" && method === "POST") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const access = body?.permission;
    if (!/^\S+@\S+\.\S+$/.test(email) || !["viewer", "commenter", "editor"].includes(access)) return fail("Email немесе құжат рұқсаты қате");
    if (!store.users.some(item => item.email === email)) return fail("Бұл email арқылы тіркелген пайдаланушы табылмады", 404);
    document.shares = (document.shares || []).filter(item => item.email !== email);
    document.shares.push({ email, permission: access });
    await writeStore(store);
    return json(document.shares, 201);
  }
  if (path.length === 3 && path[1] === "shares" && method === "DELETE") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    const email = decodeURIComponent(path[2]).toLowerCase();
    document.shares = (document.shares || []).filter(item => item.email !== email);
    await writeStore(store);
    return json({ ok: true });
  }

  if (!path.length && method === "GET") {
    return json(owned.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(document => ({ ...summarizeDocument(document), permission: permission(document) })));
  }
  if (path.length === 1 && path[0] === "me" && method === "GET") {
    const latest = owned.filter(document => document.owner === user.email).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return json(latest ? { id: latest.id, title: latest.title, text: latest.versions[latest.versions.length - 1].text, version: latest.versions[latest.versions.length - 1].version } : { text: "", version: 0 });
  }
  if (path.length === 1 && method === "GET") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    return json({ ...summarizeDocument(document), permission: permission(document), shares: document.shares || [], versions: document.versions });
  }
  if (path.length === 1 && path[0] !== "me" && method === "DELETE") {
    const document = owned.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    store.documents = store.documents.filter(item => item !== document);
    const latest = owned.filter(item => item !== document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) {
      const snapshot = latest.versions[latest.versions.length - 1];
      store.docs[user.email] = snapshot.text;
      store.versions[user.email] = snapshot.version;
    } else { delete store.docs[user.email]; delete store.versions[user.email]; }
    store.log.push({ owner: user.email, type: "Құжат", tone: "green", title: document.title, meta: `${stamp()} · жойылды` });
    await writeStore(store);
    return json({ ok: true });
  }
  if (!path.length && method === "POST") {
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    if (!body || typeof body !== "object" || typeof body.text !== "string") return fail("Құжат мәтінін енгізіңіз");
    const text: string = body.text;
    const title = typeof body.title === "string" ? body.title.trim() : "Құжат.txt";
    if (!text.trim()) return fail("Құжат мәтіні бос");
    if (text.length > 200000) return fail("Құжат тым үлкен (макс. 200 000 таңба)", 413);
    if (!title || title.length > 200) return fail("Атауы 1–200 таңба болуы керек");
    const existing = body.documentId ? owned.find(item => item.id === body.documentId && canEdit(item)) : undefined;
    if (body.documentId && !existing) return fail("Құжат табылмады", 404);
    const last = existing?.versions[existing.versions.length - 1];
    // Reject saves from a stale editor instead of silently overwriting newer work.
    if (existing && body.baseVersion !== last?.version) return fail("Құжаттың жаңа нұсқасы бар. Құжатты қайта ашып, өзгерістерді сақтаңыз.", 409);
    const now = new Date().toISOString();
    const version = (last?.version || 0) + 1;
    let workspaceId: string | undefined;
    if (!existing && body.workspaceId !== undefined) {
      workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : "";
      const member = store.memberships.some(item => item.workspaceId === workspaceId && item.userId === user.id);
      if (!member) return fail("Компания кеңістігіне құжат сақтауға рұқсат жоқ", 403);
    }
    const document: SavedDocument = existing || {
      id: randomUUID(), owner: user.email, title,
      workspaceId,
      source: body.source === "upload" ? "upload" : "editor",
      createdAt: now, updatedAt: now, versions: [],
    };
    document.title = title;
    document.updatedAt = now;
    document.versions.push({ version, title, text, savedAt: now });
    if (!existing) store.documents.push(document);
    // Retain compatibility with the previous editor endpoint.
    store.docs[user.email] = text;
    store.versions[user.email] = version;
    store.log.push({ owner: user.email, type: "Құжат", tone: "green", title, meta: `${stamp()} · v${version}` });
    await writeStore(store);
    return json({ ...summarizeDocument(document), permission: permission(document), shares: document.shares || [], versions: document.versions }, existing ? 200 : 201);
  }
  return fail("API маршрут табылмады", 404);
}
