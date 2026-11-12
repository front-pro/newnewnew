import { NextResponse } from "next/server";
import { appendAuditEvent, consumeAuthRateLimit, cookieHeader, currentUser, hashPassword, publicUser, readStore, safeHashEqual, sessionUserId, withStoreLock, writeStore } from "../_lib";

const json = (body: unknown, status = 200) => NextResponse.json(body, { status });

async function patch(request: Request) {
  try {
    const store = await readStore();
    const user = await currentUser(request, store);
    if (!user) return json({ error: "Жүйеге кіріңіз" }, 401);

    const body = await request.json();
    const name = String(body.name || "").trim();
    const avatar = body.avatar === null ? null : String(body.avatar || "");
    if (name.length < 2 || name.length > 80) return json({ error: "Аты 2–80 таңба болуы керек" }, 400);

    if (avatar) {
      const validImage = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+=*$/.test(avatar);
      if (!validImage) return json({ error: "PNG, JPG, WEBP немесе GIF форматындағы суретті таңдаңыз" }, 400);
      if (avatar.length > 1_400_000) return json({ error: "Аватар суреті 1 МБ-тан аспауы керек" }, 413);
    }

    if ((body.company !== undefined && (typeof body.company !== "string" || body.company.length > 120)) || (body.position !== undefined && (typeof body.position !== "string" || body.position.length > 120))) return json({ error: "Ұйым және лауазым 120 таңбадан аспауы керек" }, 400);
    if (body.company !== undefined) user.company = body.company.trim();
    if (body.position !== undefined) user.position = body.position.trim();
    user.name = name;
    user.avatar = avatar || undefined;
    await writeStore(store);
    return json({ user: publicUser(user) });
  } catch {
    return json({ error: "Профильді сақтау кезінде қате шықты" }, 500);
  }
}
export const PATCH = (request: Request) => withStoreLock(() => patch(request));

async function removeAccount(request: Request) {
  try {
    const store = await readStore();
    const user = await currentUser(request, store);
    if (!user) return json({ error: "Жүйеге кіріңіз" }, 401);
    const limit = await consumeAuthRateLimit(request, user.email, 5, 15 * 60 * 1000, "delete-account");
    if (limit.limited) return NextResponse.json({ error: "Қайталау әрекеті тым көп. Кейінірек көріңіз." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    let body: unknown;
    try { body = await request.json(); } catch { return json({ error: "Сұрау пішімі қате" }, 400); }
    if (!body || typeof body !== "object" || typeof (body as { password?: unknown }).password !== "string" || (body as { password: string }).password.length > 1024) return json({ error: "Құпиясөзді енгізіңіз" }, 400);
    if (!safeHashEqual(hashPassword((body as { password: string }).password, user.salt), user.hash)) return json({ error: "Құпиясөз қате" }, 400);

    const owned = store.workspaces.filter(workspace => workspace.ownerId === user.id);
    const memberships = store.memberships.filter(item => item.userId === user.id);
    const lastAdmin = memberships.some(item => item.role === "admin" && !store.memberships.some(other => other.workspaceId === item.workspaceId && other.userId !== user.id && other.role === "admin"));
    if (lastAdmin) return json({ error: "Компанияда басқа әкімші жоқ. Аккаунтты жоймас бұрын әкімші рөлін басқа мүшеге беріңіз." }, 409);
    const transfers = owned.map(workspace => ({ workspace, nextOwner: store.memberships.find(item => item.workspaceId === workspace.id && item.userId !== user.id && item.role === "admin") }));
    if (transfers.some(item => !item.nextOwner)) return json({ error: "Компания иесісіз. Алдымен басқа мүшеге әкімші рөлін беріңіз." }, 409);
    transfers.forEach(({ workspace, nextOwner }) => { workspace.ownerId = nextOwner!.userId; });

    for (const document of store.documents) {
      if (document.workspaceId && document.owner === user.email) {
        const workspace = store.workspaces.find(item => item.id === document.workspaceId);
        const replacement = store.users.find(item => item.id === workspace?.ownerId && item.id !== user.id);
        document.owner = replacement?.email || "deleted-user";
      }
      document.shares = (document.shares || []).filter(share => share.email !== user.email);
      document.comments = (document.comments || []).filter(comment => comment.author !== user.email);
      if (document.organization) delete document.organization[user.id];
    }
    store.documents = store.documents.filter(document => document.owner !== user.email || !!document.workspaceId);
    store.memberships = store.memberships.filter(item => item.userId !== user.id);
    store.groups.forEach(group => { group.members = group.members.filter(id => id !== user.id); });
    store.invitations = store.invitations.filter(item => item.invitedBy !== user.id);
    store.approvals.forEach(flow => {
      if (flow.requestedBy === user.id && flow.status === "pending") flow.status = "stale";
      flow.steps = flow.steps.filter(step => step.approverId !== user.id);
      if (flow.status === "pending" && flow.steps.length === 0) flow.status = "stale";
    });
    store.templates = store.templates.filter(template => template.owner !== user.email || template.owner === "system");
    for (const [id, analysis] of Object.entries(store.analyses)) if (analysis.owner === user.email) delete store.analyses[id];
    delete store.docs[user.email];
    delete store.versions[user.email];
    store.log = store.log.filter(item => item.owner !== user.email);
    Object.keys(store.sessions).forEach(token => { if (sessionUserId(store.sessions[token]) === user.id) delete store.sessions[token]; });
    Object.entries(store.verificationTokens).forEach(([token, item]) => { if (item.userId === user.id) delete store.verificationTokens[token]; });
    Object.entries(store.passwordResetTokens).forEach(([token, item]) => { if (item.userId === user.id) delete store.passwordResetTokens[token]; });
    store.users = store.users.filter(item => item.id !== user.id);
    await writeStore(store);
    await appendAuditEvent({ actorId: user.id, action: "account.delete", resourceType: "user", resourceId: user.id });
    const response = json({ ok: true });
    response.headers.set("Set-Cookie", cookieHeader(""));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    return json({ error: error instanceof SyntaxError ? "JSON сұрауының форматы қате" : "Аккаунтты жою кезінде қате шықты" }, error instanceof SyntaxError ? 400 : 500);
  }
}

export const DELETE = (request: Request) => withStoreLock(() => removeAccount(request));
