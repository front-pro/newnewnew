import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { currentUser, readStore, stamp, writeStore } from "./auth/_lib";
import type { Store, WorkspaceRole } from "./auth/_lib";

const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const digest = (token: string) => createHash("sha256").update(token).digest("hex");
const isAdmin = (store: Store, workspaceId: string, userId: string) => store.memberships.some(item => item.workspaceId === workspaceId && item.userId === userId && item.role === "admin");

export async function handleWorkspaceRequest(request: Request, path: string[]) {
  const store = await readStore();
  const user = await currentUser(request, store);
  if (!user) return fail("Жүйеге кіріңіз", 401);
  const method = request.method;

  if (!path.length && method === "GET") {
    const memberships = store.memberships.filter(item => item.userId === user.id);
    return json(memberships.flatMap(item => {
      const workspace = store.workspaces.find(value => value.id === item.workspaceId);
      return workspace ? [{ ...workspace, role: item.role }] : [];
    }));
  }
  if (!path.length && method === "POST") {
    let body;
    try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (name.length < 2 || name.length > 120) return fail("Компания атауы 2–120 таңба болуы керек");
    const workspace = { id: randomUUID(), name, ownerId: user.id, createdAt: new Date().toISOString() };
    store.workspaces.push(workspace);
    store.memberships.push({ workspaceId: workspace.id, userId: user.id, role: "admin", joinedAt: workspace.createdAt });
    store.log.push({ owner: user.email, type: "Компания", tone: "blue", title: name, meta: `${stamp()} · компания кеңістігі жасалды` });
    await writeStore(store);
    return json({ ...workspace, role: "admin" }, 201);
  }

  if (path[0] === "invitations" && path[1] === "accept" && method === "POST") {
    let body;
    try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
    const token = typeof body?.token === "string" ? body.token : "";
    const hash = digest(token);
    const invitation = store.invitations.find(item => {
      const left = Buffer.from(item.tokenHash, "hex"), right = Buffer.from(hash, "hex");
      return left.length === right.length && timingSafeEqual(left, right);
    });
    if (!invitation || invitation.email !== user.email || Date.parse(invitation.expiresAt) <= Date.now()) return fail("Шақыру жарамсыз, мерзімі өткен немесе басқа email-ға арналған", 404);
    if (store.memberships.some(item => item.workspaceId === invitation.workspaceId && item.userId === user.id)) return fail("Сіз бұл компанияның мүшесісіз", 409);
    store.memberships.push({ workspaceId: invitation.workspaceId, userId: user.id, role: invitation.role, joinedAt: new Date().toISOString() });
    store.invitations = store.invitations.filter(item => item.id !== invitation.id);
    await writeStore(store);
    const workspace = store.workspaces.find(item => item.id === invitation.workspaceId)!;
    return json({ ...workspace, role: invitation.role });
  }

  const workspaceId = path[0];
  const workspace = store.workspaces.find(item => item.id === workspaceId);
  const membership = store.memberships.find(item => item.workspaceId === workspaceId && item.userId === user.id);
  if (!workspace || !membership) return fail("Компания табылмады", 404);

  if (path.length === 2 && path[1] === "members" && method === "GET") {
    return json(store.memberships.filter(item => item.workspaceId === workspaceId).flatMap(item => {
      const member = store.users.find(value => value.id === item.userId);
      return member ? [{ id: member.id, name: member.name, email: member.email, role: item.role, joinedAt: item.joinedAt }] : [];
    }));
  }
  if (path.length === 2 && path[1] === "invitations" && method === "POST") {
    if (!isAdmin(store, workspaceId, user.id)) return fail("Компания әкімшісінің рұқсаты қажет", 403);
    let body;
    try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
    const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
    const role: WorkspaceRole = body?.role === "admin" ? "admin" : "member";
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) return fail("Email форматы дұрыс емес");
    const target = store.users.find(item => item.email === email);
    if (target && store.memberships.some(item => item.workspaceId === workspaceId && item.userId === target.id)) return fail("Бұл адам компанияның мүшесі", 409);
    const invitationToken = randomBytes(32).toString("hex");
    const invitation = { id: randomUUID(), workspaceId, email, role, tokenHash: digest(invitationToken), expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), invitedBy: user.id };
    store.invitations = store.invitations.filter(item => !(item.workspaceId === workspaceId && item.email === email));
    store.invitations.push(invitation);
    store.log.push({ owner: user.email, type: "Компания", tone: "blue", title: workspace.name, meta: `${stamp()} · ${email} шақырылды` });
    await writeStore(store);
    return json({ id: invitation.id, email, role, expiresAt: invitation.expiresAt, token: invitationToken }, 201);
  }
  if (path.length === 3 && path[1] === "members" && method === "DELETE") {
    if (!isAdmin(store, workspaceId, user.id)) return fail("Компания әкімшісінің рұқсаты қажет", 403);
    const target = store.users.find(item => item.id === path[2]);
    if (!target) return fail("Мүше табылмады", 404);
    if (target.id === user.id) return fail("Өзіңізді компаниядан шығара алмайсыз", 400);
    const wasMember = store.memberships.some(item => item.workspaceId === workspaceId && item.userId === target.id);
    store.memberships = store.memberships.filter(item => !(item.workspaceId === workspaceId && item.userId === target.id));
    if (!wasMember) return fail("Мүше табылмады", 404);
    await writeStore(store);
    return json({ ok: true });
  }
  if (path.length === 3 && path[1] === "members" && method === "PATCH") {
    if (!isAdmin(store, workspaceId, user.id)) return fail("Компания әкімшісінің рұқсаты қажет", 403);
    let body;
    try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
    if (body?.role !== "admin" && body?.role !== "member") return fail("Компания рөлі admin немесе member болуы керек");
    const target = store.memberships.find(item => item.workspaceId === workspaceId && item.userId === path[2]);
    if (!target) return fail("Мүше табылмады", 404);
    if (target.userId === workspace.ownerId && body.role !== "admin") return fail("Компания иесінің әкімші рөлін төмендетуге болмайды", 409);
    if (target.role === "admin" && body.role !== "admin" && store.memberships.filter(item => item.workspaceId === workspaceId && item.role === "admin").length < 2) return fail("Компанияда кемінде бір әкімші қалуы керек", 409);
    target.role = body.role;
    await writeStore(store);
    return json({ userId: target.userId, role: target.role });
  }
  return fail("API маршрут табылмады", 404);
}
