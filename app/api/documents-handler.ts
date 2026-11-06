import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { summarizeDocument } from "../lib/documents";
import type { SavedDocument } from "../lib/documents";
import { currentUser, readStore, stamp, writeStore } from "./auth/_lib";
import type { Store, User } from "./auth/_lib";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (error: string, status = 400) => json({ error }, status);

let saveQueue: Promise<unknown> = Promise.resolve();

// Read the store inside the queue so simultaneous saves cannot share a base version.
export async function handleDocumentRequest(request: Request, path: string[]) {
  const run = async () => {
    const store = await readStore();
    return handleDocuments(request, path, store, await currentUser(request, store));
  };
  if (request.method === "GET") return run();
  const result = saveQueue.then(run);
  saveQueue = result.catch(() => {});
  return result;
}

export async function handleDocuments(request: Request, path: string[], store: Store, user: User | null) {
  if (!user) return fail("Жүйеге кіріңіз", 401);
  const method = request.method;
  const owned = store.documents.filter(document => document.owner === user.email);

  if (!path.length && method === "GET") {
    return json(owned.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarizeDocument));
  }
  if (path.length === 1 && path[0] === "me" && method === "GET") {
    const latest = owned.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return json(latest ? { id: latest.id, title: latest.title, text: latest.versions[latest.versions.length - 1].text, version: latest.versions[latest.versions.length - 1].version } : { text: "", version: 0 });
  }
  if (path.length === 1 && method === "GET") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    return json({ ...summarizeDocument(document), versions: document.versions });
  }
  if (path.length === 1 && path[0] !== "me" && method === "DELETE") {
    const document = owned.find(item => item.id === path[0]);
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
    const existing = body.documentId ? owned.find(item => item.id === body.documentId) : undefined;
    if (body.documentId && !existing) return fail("Құжат табылмады", 404);
    const last = existing?.versions[existing.versions.length - 1];
    // Reject saves from a stale editor instead of silently overwriting newer work.
    if (existing && body.baseVersion !== last?.version) return fail("Құжаттың жаңа нұсқасы бар. Құжатты қайта ашып, өзгерістерді сақтаңыз.", 409);
    const now = new Date().toISOString();
    const version = (last?.version || 0) + 1;
    const document: SavedDocument = existing || {
      id: randomUUID(), owner: user.email, title,
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
    return json({ ...summarizeDocument(document), versions: document.versions }, existing ? 200 : 201);
  }
  return fail("API маршрут табылмады", 404);
}
