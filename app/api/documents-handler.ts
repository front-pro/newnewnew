import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { summarizeDocument } from "../lib/documents";
import { editorHtmlToText, sanitizeEditorHtml } from "../lib/editor-content";
import type { SavedDocument } from "../lib/documents";
import { appendAuditEvent, currentUser, readStore, stamp, writeStore } from "./auth/_lib";
import type { ApprovalFlow, Store, User } from "./auth/_lib";

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
  const url = new URL(request.url);
  const permission = (document: SavedDocument): "owner" | "editor" | "commenter" | "viewer" | "none" => {
    if (document.workspaceId) {
      const isMember = store.memberships.some(item => item.workspaceId === document.workspaceId && item.userId === user.id);
      if (!isMember) return "none";
      if (document.owner === user.email) return "owner";
      const direct = document.shares?.find(item => item.email === user.email)?.permission;
      const inGroups = store.groups.filter(group => group.workspaceId === document.workspaceId && group.members.includes(user.id)).map(group => document.groupShares?.find(share => share.groupId === group.id)?.permission).filter((value): value is "viewer" | "commenter" | "editor" => !!value);
      return [direct, ...inGroups].sort((a, b) => ({ none: 0, viewer: 1, commenter: 2, editor: 3 }[b || "none"] - { none: 0, viewer: 1, commenter: 2, editor: 3 }[a || "none"]))[0] || "none";
    }
    if (document.owner === user.email) return "owner";
    return document.shares?.find(item => item.email === user.email)?.permission || "none";
  };
  const canEdit = (document: SavedDocument) => ["owner", "editor"].includes(permission(document));
  const owned = store.documents.filter(document => !document.deletedAt && permission(document) !== "none" && (workspaceScope === undefined || (workspaceScope === null ? !document.workspaceId : document.workspaceId === workspaceScope)));

  if (path.length === 1 && path[0] === "trash" && method === "GET") {
    return json(store.documents.filter(document => document.deletedAt && permission(document) === "owner" && (workspaceScope === undefined || (workspaceScope === null ? !document.workspaceId : document.workspaceId === workspaceScope))).sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || "")).map(document => ({ ...summarizeDocument(document, user.id), deletedAt: document.deletedAt, permission: "owner" })));
  }
  if (path.length === 2 && path[1] === "restore" && method === "POST") {
    const document = store.documents.find(item => item.id === path[0] && item.deletedAt && permission(item) === "owner");
    if (!document) return fail("Себеттегі құжат табылмады", 404);
    delete document.deletedAt;
    document.updatedAt = new Date().toISOString();
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.restore", resourceType: "document", resourceId: document.id });
    return json({ ...summarizeDocument(document, user.id), permission: permission(document) });
  }
  if (path.length === 2 && path[1] === "permanent" && method === "DELETE") {
    const document = store.documents.find(item => item.id === path[0] && item.deletedAt && permission(item) === "owner");
    if (!document) return fail("Себеттегі құжат табылмады", 404);
    store.documents = store.documents.filter(item => item !== document);
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.delete_permanent", resourceType: "document", resourceId: document.id, metadata: { title: document.title } });
    return json({ ok: true });
  }

  if (path.length === 2 && path[1] === "organization" && method === "PATCH") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    let body; try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    if (!body || typeof body !== "object") return fail("Сұрау пішімі қате");
    if (body.folder !== undefined && (typeof body.folder !== "string" || body.folder.length > 80)) return fail("Қалта атауы 80 таңбадан аспауы керек");
    if (body.tags !== undefined && (!Array.isArray(body.tags) || body.tags.length > 12 || body.tags.some((tag: unknown) => typeof tag !== "string" || tag.length > 32))) return fail("Ең көбі 12 тег, әрқайсысы 32 таңбаға дейін");
    if (body.favorite !== undefined && typeof body.favorite !== "boolean") return fail("Сұрау пішімі қате");
    const previous = document.organization?.[user.id] || { folder: "", tags: [], favorite: false };
    document.organization = { ...document.organization, [user.id]: { folder: body.folder === undefined ? previous.folder : body.folder.trim(), tags: body.tags === undefined ? previous.tags : [...new Set<string>(body.tags.map((tag: string) => tag.trim()).filter(Boolean))], favorite: body.favorite === undefined ? previous.favorite : body.favorite } };
    await writeStore(store);
    return json(summarizeDocument(document, user.id));
  }

  if (path.length === 2 && path[1] === "metadata" && method === "PATCH") {
    const document = owned.find(item => item.id === path[0] && canEdit(item));
    if (!document) return fail("Құжат табылмады", 404);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    if (!body || typeof body !== "object" || !("dueDate" in body)) return fail("Сұрау пішімі қате");
    const dueDate = body.dueDate;
    const parsedDate = typeof dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? new Date(`${dueDate}T00:00:00.000Z`) : null;
    if (dueDate !== null && (!parsedDate || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== dueDate)) {
      return fail("Мерзім күнін дұрыс енгізіңіз");
    }
    document.dueDate = dueDate || undefined;
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.deadline_update", resourceType: "document", resourceId: document.id, metadata: { dueDate: document.dueDate || null } });
    return json({ ...summarizeDocument(document, user.id), permission: permission(document) });
  }
  if (path.length === 2 && path[1] === "approval" && method === "POST") {
    const document = owned.find(item => item.id === path[0] && canEdit(item));
    if (!document) return fail("Құжат табылмады", 404);
    if (document.approvalId && store.approvals.some(flow => flow.id === document.approvalId && flow.status === "pending")) return fail("Құжатта аяқталмаған бекіту сұрауы бар", 409);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const emails: string[] = Array.isArray(body?.approvers) ? [...new Set((body.approvers as unknown[]).filter((email): email is string => typeof email === "string").map(email => email.trim().toLowerCase()))] : [];
    if (!emails.length || emails.length > 10 || emails.some(email => !/^\S+@\S+\.\S+$/.test(email))) return fail("1–10 жарамды бекітушінің email-ын енгізіңіз");
    const approvers = emails.map(email => store.users.find(candidate => candidate.email === email));
    if (approvers.some(approver => !approver || approver.id === user.id)) return fail("Бекітуші тіркелген пайдаланушы болуы және өзіңіз болмауы керек", 400);
    if (document.workspaceId && approvers.some(approver => !store.memberships.some(member => member.workspaceId === document.workspaceId && member.userId === approver!.id))) return fail("Компания құжатын тек сол компания мүшесіне бекітуге жіберуге болады", 403);
    approvers.forEach(approver => {
      if (approver!.email !== document.owner) {
        const existingShare = document.shares?.find(share => share.email === approver!.email);
        if (!existingShare) document.shares = [...(document.shares || []), { email: approver!.email, permission: "commenter" }];
      }
    });
    const flow: ApprovalFlow = { id: randomUUID(), documentId: document.id, workspaceId: document.workspaceId, requestedBy: user.id, requestedAt: new Date().toISOString(), version: document.versions.at(-1)!.version, status: "pending", steps: approvers.map(approver => ({ approverId: approver!.id, email: approver!.email, decision: "pending" })) };
    store.approvals.push(flow); document.approvalId = flow.id;
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "approval.request", resourceType: "approval", resourceId: flow.id, metadata: { documentId: document.id, version: flow.version, approvers: flow.steps.length } });
    return json(flow, 201);
  }

  if (path.length === 2 && path[1] === "restore" && method === "POST") {
    const document = owned.find(item => item.id === path[0] && canEdit(item));
    if (!document) return fail("Құжат табылмады", 404);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const versionNumber = Number(body?.version), latest = document.versions[document.versions.length - 1];
    if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) return fail("Қалпына келтіретін нұсқаның нөмірі қате");
    if (body?.baseVersion !== latest.version) return fail("Құжаттың жаңа нұсқасы бар. Құжатты қайта ашып қайталаңыз.", 409);
    const snapshot = document.versions.find(item => item.version === versionNumber);
    if (!snapshot) return fail("Нұсқа табылмады", 404);
    const restored = { version: latest.version + 1, title: snapshot.title, text: snapshot.text, savedAt: new Date().toISOString() };
    document.versions.push(restored); document.title = restored.title; document.updatedAt = restored.savedAt;
    if (document.approvalId) {
      const approval = store.approvals.find(flow => flow.id === document.approvalId && flow.status === "pending");
      if (approval) approval.status = "stale";
      if (approval) await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "approval.stale", resourceType: "approval", resourceId: approval.id, metadata: { documentId: document.id, reason: "document_restored" } });
      delete document.approvalId;
    }
    store.docs[document.owner] = restored.text; store.versions[document.owner] = restored.version;
    store.log.push({ owner: user.email, type: "Құжат", tone: "green", title: document.title, documentId: document.id, meta: `${stamp()} · v${restored.version} · v${versionNumber} нұсқасынан қалпына келтірілді` });
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.restore_version", resourceType: "document", resourceId: document.id, metadata: { restoredFrom: versionNumber, version: restored.version } });
    const approval = document.approvalId ? store.approvals.find(flow => flow.id === document.approvalId) : undefined;
    return json({ ...summarizeDocument(document, user.id), permission: permission(document), shares: document.shares || [], versions: document.versions, approval });
  }

  if (path.length === 2 && path[1] === "comments" && method === "GET") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.read_comments", resourceType: "document", resourceId: document.id });
    return json(document.comments || []);
  }
  if (path.length === 2 && path[1] === "comments" && method === "POST") {
    const document = owned.find(item => item.id === path[0]);
    if (!document || !["owner", "editor", "commenter"].includes(permission(document))) return fail("Пікір қалдыруға рұқсат жоқ", 403);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const text = typeof body?.text === "string" ? body.text.trim() : "";
    if (!text || text.length > 5000) return fail("Пікір 1–5 000 таңба болуы керек");
    const clause = typeof body.clause === "string" ? body.clause.trim() : "";
    const version = clause ? document.versions.find(v => v.version === Number(body.version)) : undefined;
    if (clause && (!/^\d+(?:\.\d+)*$/.test(clause) || clause.length > 40 || !version || !version.text.split(/\r?\n/).some(line => line.trim().match(/^(\d+(?:\.\d+)*)\.?\s/)?.[1] === clause))) return fail("Тармақ нөмірі немесе нұсқа табылмады");
    const comment = { ...(clause ? { clause, version: version!.version } : {}), id: randomUUID(), author: user.email, text, createdAt: new Date().toISOString() };
    document.comments = [...(document.comments || []), comment];
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.comment", resourceType: "document", resourceId: document.id, metadata: { commentId: comment.id } });
    return json(comment, 201);
  }

  if (path.length === 2 && path[1] === "shares" && method === "GET") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.read_shares", resourceType: "document", resourceId: document.id });
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
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.share", resourceType: "document", resourceId: document.id, metadata: { email, permission: access } });
    return json(document.shares, 201);
  }
  if (path.length === 2 && path[1] === "group-shares" && method === "GET") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document || !document.workspaceId) return fail("Компания құжаты немесе иесінің рұқсаты табылмады", 404);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.read_group_shares", resourceType: "document", resourceId: document.id });
    return json((document.groupShares || []).flatMap(share => {
      const group = store.groups.find(item => item.id === share.groupId && item.workspaceId === document.workspaceId);
      return group ? [{ groupId: group.id, name: group.name, permission: share.permission }] : [];
    }));
  }
  if (path.length === 2 && path[1] === "group-shares" && method === "POST") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document || !document.workspaceId) return fail("Компания құжаты немесе иесінің рұқсаты табылмады", 404);
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    const groupId = typeof body?.groupId === "string" ? body.groupId : "", access = body?.permission;
    const group = store.groups.find(item => item.id === groupId && item.workspaceId === document.workspaceId);
    if (!group || !["viewer", "commenter", "editor"].includes(access)) return fail("Топ немесе құжат рұқсаты қате", 400);
    document.groupShares = [...(document.groupShares || []).filter(item => item.groupId !== group.id), { groupId, permission: access }];
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.group_share", resourceType: "document", resourceId: document.id, metadata: { groupId, permission: access } });
    return json((document.groupShares || []).map(share => ({ ...share, name: store.groups.find(item => item.id === share.groupId)?.name })), 201);
  }
  if (path.length === 3 && path[1] === "group-shares" && method === "DELETE") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document || !document.workspaceId) return fail("Компания құжаты немесе иесінің рұқсаты табылмады", 404);
    const groupId = path[2];
    document.groupShares = (document.groupShares || []).filter(item => item.groupId !== groupId);
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.group_unshare", resourceType: "document", resourceId: document.id, metadata: { groupId } });
    return json({ ok: true });
  }
  if (path.length === 3 && path[1] === "shares" && method === "DELETE") {
    const document = store.documents.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    const email = decodeURIComponent(path[2]).toLowerCase();
    document.shares = (document.shares || []).filter(item => item.email !== email);
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.unshare", resourceType: "document", resourceId: document.id, metadata: { email } });
    return json({ ok: true });
  }

  if (!path.length && method === "GET") {
    const terms = (url.searchParams.get("q") || "").trim().slice(0, 120).toLocaleLowerCase().split(/\s+/).filter(Boolean);
    const matching = owned.filter(document => {
      if (!terms.length) return true;
      const latest = document.versions.at(-1);
      const organization = document.organization?.[user.id];
      const searchable = [document.title, editorHtmlToText(latest?.text || ""), organization?.folder || "", ...(organization?.tags || [])].join("\n").toLocaleLowerCase();
      return terms.every(term => searchable.includes(term));
    });
    return json(matching.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(document => ({ ...summarizeDocument(document, user.id), permission: permission(document) })));
  }
  if (path.length === 1 && path[0] === "me" && method === "GET") {
    const latest = owned.filter(document => document.owner === user.email).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return json(latest ? { id: latest.id, title: latest.title, text: latest.versions[latest.versions.length - 1].text, version: latest.versions[latest.versions.length - 1].version } : { text: "", version: 0 });
  }
  if (path.length === 1 && method === "GET") {
    const document = owned.find(item => item.id === path[0]);
    if (!document) return fail("Құжат табылмады", 404);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.read", resourceType: "document", resourceId: document.id, metadata: { version: document.versions[document.versions.length - 1].version } });
    const approval = document.approvalId ? store.approvals.find(flow => flow.id === document.approvalId) : undefined;
    return json({ ...summarizeDocument(document, user.id), permission: permission(document), shares: document.shares || [], versions: document.versions, approval });
  }
  if (path.length === 1 && path[0] !== "me" && method === "DELETE") {
    const document = owned.find(item => item.id === path[0] && permission(item) === "owner");
    if (!document) return fail("Құжат табылмады", 404);
    const pendingApproval = document.approvalId ? store.approvals.find(flow => flow.id === document.approvalId && flow.status === "pending") : undefined;
    if (pendingApproval) pendingApproval.status = "stale";
    delete document.approvalId;
    document.deletedAt = new Date().toISOString();
    const latest = owned.filter(item => item !== document).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (latest) {
      const snapshot = latest.versions[latest.versions.length - 1];
      store.docs[user.email] = snapshot.text;
      store.versions[user.email] = snapshot.version;
    } else { delete store.docs[user.email]; delete store.versions[user.email]; }
    store.log.push({ owner: user.email, type: "Құжат", tone: "green", title: document.title, documentId: document.id, meta: `${stamp()} · себетке жіберілді` });
    await writeStore(store);
    if (pendingApproval) await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "approval.stale", resourceType: "approval", resourceId: pendingApproval.id, metadata: { documentId: document.id, reason: "document_trashed" } });
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: "document.trash", resourceType: "document", resourceId: document.id, metadata: { title: document.title } });
    return json({ ok: true });
  }
  if (!path.length && method === "POST") {
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    if (!body || typeof body !== "object" || typeof body.text !== "string") return fail("Құжат мәтінін енгізіңіз");
    const rawText: string = body.text;
    if (rawText.length > 8_000_000) return fail("Құжат тым үлкен (макс. 8 МБ)", 413);
    if (rawText.length > 200_000 && !/<img\b/i.test(rawText)) return fail("Құжат тым үлкен (макс. 200 000 таңба)", 413);
    const text = sanitizeEditorHtml(rawText);
    const title = typeof body.title === "string" ? body.title.trim() : "Құжат.txt";
    if (!text.trim()) return fail("Құжат мәтіні бос");
    if (editorHtmlToText(text).length > 200_000) return fail("Құжат мәтіні тым үлкен (макс. 200 000 таңба)", 413);
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
    if (existing?.approvalId) {
      const approval = store.approvals.find(flow => flow.id === existing.approvalId && flow.status === "pending");
      if (approval) {
        approval.status = "stale";
        await appendAuditEvent({ workspaceId: existing.workspaceId, actorId: user.id, action: "approval.stale", resourceType: "approval", resourceId: approval.id, metadata: { documentId: existing.id, reason: "document_updated" } });
      }
      delete existing.approvalId;
    }
    if (!existing) store.documents.push(document);
    // Retain compatibility with the previous editor endpoint.
    store.docs[user.email] = text;
    store.versions[user.email] = version;
    store.log.push({ owner: user.email, type: "Құжат", tone: "green", title, documentId: document.id, meta: `${stamp()} · v${version}` });
    await writeStore(store);
    await appendAuditEvent({ workspaceId: document.workspaceId, actorId: user.id, action: existing ? "document.update" : "document.create", resourceType: "document", resourceId: document.id, metadata: { version } });
    return json({ ...summarizeDocument(document, user.id), permission: permission(document), shares: document.shares || [], versions: document.versions }, existing ? 200 : 201);
  }
  return fail("API маршрут табылмады", 404);
}

export async function handleApprovalRequest(request: Request, path: string[]) {
  const store = await readStore(), user = await currentUser(request, store);
  if (!user) return fail("Жүйеге кіріңіз", 401);
  if (!path.length && request.method === "GET") {
    const assigned = store.approvals.filter(flow => flow.steps.some(step => step.approverId === user.id));
    return json(assigned.map(flow => {
      const document = store.documents.find(item => item.id === flow.documentId);
      const step = flow.steps.find(item => item.approverId === user.id);
      const version = document?.versions.find(item => item.version === flow.version);
      const inWorkspace = !flow.workspaceId || store.memberships.some(item => item.workspaceId === flow.workspaceId && item.userId === user.id);
      return document && !document.deletedAt && version && step && inWorkspace ? { ...flow, step, document: { id: document.id, title: version.title, workspaceId: document.workspaceId, text: version.text } } : null;
    }).filter(Boolean));
  }
  if (path.length === 2 && path[1] === "decision" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return fail("Сұрау пішімі қате"); }
    if (body?.decision !== "approve" && body?.decision !== "reject") return fail("Шешім approve немесе reject болуы керек");
    const flow = store.approvals.find(item => item.id === path[0]);
    if (!flow) return fail("Бекіту сұрауы табылмады", 404);
    if (flow.status !== "pending") return fail(flow.status === "stale" ? "Құжат нұсқасы өзгерген. Жаңа нұсқаны қайта бекітуге жіберіңіз." : "Бұл бекіту аяқталған", 409);
    const step = flow.steps.find(item => item.approverId === user.id && item.decision === "pending");
    if (!step) return fail("Бұл бекітуді шешуге рұқсатыңыз жоқ", 403);
    const document = store.documents.find(item => item.id === flow.documentId);
    if (!document) return fail("Құжат табылмады", 404);
    if (flow.workspaceId && !store.memberships.some(item => item.workspaceId === flow.workspaceId && item.userId === user.id)) return fail("Компания мүшелігі жоқ", 403);
    const currentVersion = document.versions.at(-1)?.version;
    if (currentVersion !== flow.version) {
      flow.status = "stale";
      if (document.approvalId === flow.id) delete document.approvalId;
      await writeStore(store);
      await appendAuditEvent({ workspaceId: flow.workspaceId, actorId: user.id, action: "approval.stale", resourceType: "approval", resourceId: flow.id });
      return fail("Құжат нұсқасы өзгерген. Жаңа нұсқаны қайта бекітуге жіберіңіз.", 409);
    }
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    if (reason.length > 2000) return fail("Себеп 2 000 таңбадан аспауы керек");
    step.decision = body.decision === "approve" ? "approved" : "rejected";
    step.decidedAt = new Date().toISOString();
    if (reason) step.reason = reason;
    if (step.decision === "rejected") flow.status = "rejected";
    else if (flow.steps.every(item => item.decision === "approved")) flow.status = "approved";
    await writeStore(store);
    await appendAuditEvent({ workspaceId: flow.workspaceId, actorId: user.id, action: `approval.${step.decision}`, resourceType: "approval", resourceId: flow.id, metadata: { documentId: document.id, version: flow.version } });
    return json(flow);
  }
  return fail("API маршрут табылмады", 404);
}
