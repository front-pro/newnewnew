import assert from "node:assert/strict";
import { randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { scannedPdf } from "./helpers/scanned-pdf.mjs";

let server, directory, base, cookie, otherCookie, document;
let output = "";

async function api(route, { method = "GET", body, session = cookie, headers: extraHeaders = {} } = {}) {
  const response = await fetch(`${base}/api/${route}`, {
    method,
    headers: { ...(session ? { Cookie: session } : {}), ...(body ? { "Content-Type": "application/json" } : {}), ...extraHeaders },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json() };
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "kt-documents-test-"));
  const user = (id, email, password) => { const salt = randomBytes(16).toString("hex"); return { id, name: email, email, salt, hash: scryptSync(password, salt, 64).toString("hex"), role: "user" }; };
  await writeFile(path.join(directory, "agent.json"), JSON.stringify({ users: [user("legacy-user", "user@kt.kz", "User12345"), user("legacy-employee", "employee@kt.kz", "Employee123")], docs: { "user@kt.kz": "Бұрын сақталған құжат" }, versions: { "user@kt.kz": 4 }, documents: { "employee@kt.kz": [{ id: "old-file", title: "Бұрынғы тізім.txt", text: "Қолданыстағы құжат", updatedAt: "2026-11-06 10:00", version: 3 }] } }));
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, KT_AGENT_DATA_DIR: directory, KT_EMAIL_DEV_TOKENS: "1" }, stdio: ["ignore", "pipe", "pipe"] });
  server.stdout.on("data", chunk => { output += chunk; });
  server.stderr.on("data", chunk => { output += chunk; });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { if ((await fetch(`${base}/`)).ok) { ready = true; break; } } catch {}
    if (server.exitCode !== null) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, output);
  const login = await api("auth/login", { method: "POST", session: "", body: { email: "user@kt.kz", password: "User12345" } });
  assert.equal(login.response.status, 200);
  cookie = login.response.headers.get("set-cookie").split(";")[0];
  const other = await api("auth/login", { method: "POST", session: "", body: { email: "employee@kt.kz", password: "Employee123" } });
  otherCookie = other.response.headers.get("set-cookie").split(";")[0];
});

after(async () => {
  if (server && server.exitCode === null) {
    const exited = once(server, "exit");
    server.kill("SIGTERM");
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("guests cannot list or save documents", async () => {
  assert.equal((await api("documents", { session: "" })).response.status, 401);
  assert.equal((await api("documents", { session: "", method: "POST", body: { text: "test" } })).response.status, 401);
});

test("legacy text is migrated without inventing previous versions", async () => {
  const { data } = await api("documents");
  assert.equal(data.length, 1);
  assert.equal(data[0].version, 4);
  assert.equal(data[0].versionCount, 1);
  const detail = await api(`documents/${data[0].id}`);
  assert.equal(detail.data.versions[0].text, "Бұрын сақталған құжат");
  assert.equal(detail.data.versions[0].savedAt, "");
});

test("multiple documents and immutable version snapshots persist", async () => {
  const created = await api("documents", { method: "POST", body: { title: "Ереже.txt", text: "Алғашқы нұсқа" } });
  assert.equal(created.response.status, 201);
  document = created.data;
  const updated = await api("documents", { method: "POST", body: { title: "Ереже — жаңартылған.txt", text: "Екінші нұсқа", documentId: document.id, baseVersion: 1 } });
  assert.equal(updated.data.version, 2);
  assert.equal(updated.data.versionCount, 2);
  assert.equal(updated.data.versions[0].title, "Ереже.txt");
  assert.equal(updated.data.versions[0].text, "Алғашқы нұсқа");
  const uploaded = await api("documents", { method: "POST", body: { title: "Тізім.csv", text: "атауы,саны\nқұжат,2", source: "upload" } });
  assert.equal(uploaded.data.source, "upload");
  const listing = await api("documents");
  assert.equal(listing.data.length, 3);
  assert.ok(listing.data.every(row => !row.owner && !row.versions));
  const database = new DatabaseSync(path.join(directory, "agent.sqlite"));
  const stored = JSON.parse(database.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload);
  database.close();
  assert.equal(stored.documents.find(row => row.id === document.id).versions.length, 2);
});

test("the per-account document store migrates with its title and latest revision", async () => {
  const { data } = await api("documents", { session: otherCookie });
  assert.equal(data.length, 1);
  assert.equal(data[0].id, "old-file");
  assert.equal(data[0].title, "Бұрынғы тізім.txt");
  assert.equal(data[0].version, 3);
  assert.equal(data[0].versionCount, 1);
  assert.equal(data[0].updatedAt, "2026-11-06T10:00:00.000Z");
  const detail = await api("documents/old-file", { session: otherCookie });
  assert.equal(detail.data.versions[0].text, "Қолданыстағы құжат");
});

test("another account cannot read or update a document", async () => {
  assert.ok((await api("documents", { session: otherCookie })).data.every(row => row.id !== document.id));
  assert.equal((await api(`documents/${document.id}`, { session: otherCookie })).response.status, 404);
  assert.equal((await api("documents", { session: otherCookie, method: "POST", body: { documentId: document.id, baseVersion: 2, text: "forbidden" } })).response.status, 404);
  assert.equal((await api(`documents/${document.id}`, { session: otherCookie, method: "DELETE" })).response.status, 404);
});

test("document owner can grant and revoke commenting without edit access", async () => {
  const shared = await api(`documents/${document.id}/shares`, { method: "POST", body: { email: "employee@kt.kz", permission: "commenter" } });
  assert.equal(shared.response.status, 201);
  const visible = await api(`documents/${document.id}`, { session: otherCookie });
  assert.equal(visible.response.status, 200);
  assert.equal(visible.data.permission, "commenter");
  const comment = await api(`documents/${document.id}/comments`, { method: "POST", session: otherCookie, body: { text: "Please review this clause." } });
  assert.equal(comment.response.status, 201);
  assert.equal((await api("documents", { method: "POST", session: otherCookie, body: { documentId: document.id, baseVersion: 2, text: "unauthorized change" } })).response.status, 404);
  assert.equal((await api(`documents/${document.id}/comments`)).data[0].text, "Please review this clause.");
  assert.equal((await api(`documents/${document.id}/shares/${encodeURIComponent("employee@kt.kz")}`, { method: "DELETE" })).response.status, 200);
  assert.equal((await api(`documents/${document.id}`, { session: otherCookie })).response.status, 404);
});

test("validation rejects empty text, oversized text, and invalid names", async () => {
  for (const body of [{ text: " " }, { text: "test", title: " " }, { text: "test", title: "x".repeat(201) }, { text: {} }]) {
    assert.equal((await api("documents", { method: "POST", body })).response.status, 400);
  }
  assert.equal((await api("documents", { method: "POST", body: { text: "x".repeat(200001) } })).response.status, 413);
});

test("simultaneous saves reject a stale version and preserve history", async () => {
  const saves = await Promise.all(["A", "B"].map(text => api("documents", { method: "POST", body: { documentId: document.id, baseVersion: 2, title: "Ереже.txt", text } })));
  assert.deepEqual(saves.map(result => result.response.status).sort(), [200, 409]);
  const detail = (await api(`documents/${document.id}`)).data;
  assert.equal(detail.versions.length, 3);
  assert.equal(detail.versions[0].text, "Алғашқы нұсқа");
});

test("restoring an older snapshot creates a new version", async () => {
  const restored = await api(`documents/${document.id}/restore`, { method: "POST", body: { version: 1, baseVersion: 3 } });
  assert.equal(restored.data.version, 4);
  assert.equal(restored.data.versions.length, 4);
  assert.equal(restored.data.versions[1].text, "Екінші нұсқа");
  const latest = await api("documents/me");
  assert.equal(latest.data.id, document.id);
  assert.equal(latest.data.text, "Алғашқы нұсқа");
  assert.equal(latest.data.version, 4);
});

test("approval is bound to an immutable version and rejects stale decisions", async () => {
  const requested = await api(`documents/${document.id}/approval`, { method: "POST", body: { approvers: ["employee@kt.kz"] } });
  assert.equal(requested.response.status, 201);
  assert.equal(requested.data.version, 4);
  const inbox = await api("approvals", { session: otherCookie });
  assert.equal(inbox.response.status, 200);
  assert.equal(inbox.data[0].document.text, "Алғашқы нұсқа");
  const changed = await api("documents", { method: "POST", body: { documentId: document.id, baseVersion: 4, title: "Ереже.txt", text: "Бесінші нұсқа" } });
  assert.equal(changed.data.version, 5);
  assert.equal((await api(`approvals/${requested.data.id}/decision`, { method: "POST", session: otherCookie, body: { decision: "approve" } })).response.status, 409);

  const fresh = await api(`documents/${document.id}/approval`, { method: "POST", body: { approvers: ["employee@kt.kz"] } });
  assert.equal(fresh.response.status, 201);
  const approved = await api(`approvals/${fresh.data.id}/decision`, { method: "POST", session: otherCookie, body: { decision: "approve" } });
  assert.equal(approved.response.status, 200);
  assert.equal(approved.data.status, "approved");
  assert.equal((await api(`documents/${document.id}`)).data.approval.status, "approved");
  assert.equal((await api(`approvals/${fresh.data.id}/decision`, { method: "POST", session: otherCookie, body: { decision: "approve" } })).response.status, 409);
});

test("deleting a document removes its snapshots and preserves other accounts", async () => {
  assert.equal((await api(`documents/${document.id}`, { method: "DELETE", session: "" })).response.status, 401);
  assert.equal((await api(`documents/${document.id}`, { method: "DELETE" })).response.status, 200);
  assert.equal((await api(`documents/${document.id}`)).response.status, 404);
  assert.equal((await api(`documents/${document.id}`, { method: "DELETE" })).response.status, 404);
  assert.equal((await api("documents/old-file", { session: otherCookie })).response.status, 200);
});

test("deleting the final document does not resurrect legacy text", async () => {
  const { data } = await api("documents");
  for (const item of data) assert.equal((await api(`documents/${item.id}`, { method: "DELETE" })).response.status, 200);
  assert.deepEqual((await api("documents")).data, []);
  assert.equal((await api("documents/me")).data.text, "");
  assert.deepEqual((await api("documents")).data, []);
});

test("registration creates a session and logout revokes it", async () => {
  const registered = await api("auth/register", { method: "POST", session: "", body: { name: "New user", email: "new-user@example.test", password: "SecurePass123" } });
  assert.equal(registered.response.status, 201);
  assert.equal(registered.data.user.emailVerified, false);
  assert.equal((await api("auth/login", { method: "POST", session: "", body: { email: "new-user@example.test", password: "SecurePass123" } })).response.status, 403);
  const resent = await api("auth/verify/resend", { method: "POST", session: "", body: { email: "new-user@example.test" } });
  assert.equal(resent.response.status, 202);
  assert.equal((await api("auth/verify", { method: "POST", session: "", body: { email: "new-user@example.test", token: registered.data.verificationToken } })).response.status, 400);
  const verified = await api("auth/verify", { method: "POST", session: "", body: { email: "new-user@example.test", token: resent.data.verificationToken } });
  assert.equal(verified.response.status, 200);
  const newCookie = verified.response.headers.get("set-cookie").split(";")[0];
  assert.equal((await api("auth/me", { session: newCookie })).data.user.email, "new-user@example.test");
  const secondLogin = await api("auth/login", { method: "POST", session: "", body: { email: "new-user@example.test", password: "SecurePass123" } });
  const secondCookie = secondLogin.response.headers.get("set-cookie").split(";")[0];
  const sessionList = await api("auth/sessions", { session: newCookie });
  assert.equal(sessionList.response.status, 200);
  assert.equal(sessionList.data.sessions.length, 2);
  assert.ok(sessionList.data.sessions.some(session => session.current));
  assert.equal((await api("auth/sessions", { method: "POST", session: newCookie })).data.revoked, 1);
  assert.equal((await api("auth/me", { session: secondCookie })).data.user, null);
  const loggedOut = await api("auth/logout", { method: "POST", session: newCookie });
  assert.equal(loggedOut.response.status, 200);
  assert.equal((await api("auth/me", { session: newCookie })).data.user, null);
  assert.equal((await api("documents", { session: newCookie })).response.status, 401);
  const activeSession = await api("auth/login", { method: "POST", session: "", body: { email: "new-user@example.test", password: "SecurePass123" } });
  const oldSessionCookie = activeSession.response.headers.get("set-cookie").split(";")[0];
  const reset = await api("auth/password-reset", { method: "POST", session: "", body: { email: "new-user@example.test" } });
  assert.equal(reset.response.status, 202);
  const changed = await api("auth/password-reset/confirm", { method: "POST", session: "", body: { email: "new-user@example.test", token: reset.data.resetToken, password: "BrandNewPass123" } });
  assert.equal(changed.response.status, 200);
  assert.equal((await api("auth/me", { session: oldSessionCookie })).data.user, null);
  assert.equal((await api("auth/login", { method: "POST", session: "", body: { email: "new-user@example.test", password: "SecurePass123" } })).response.status, 401);
  assert.equal((await api("auth/login", { method: "POST", session: "", body: { email: "new-user@example.test", password: "BrandNewPass123" } })).response.status, 200);
});

test("login attempts are rate limited by account and client address", async () => {
  let response;
  for (let attempt = 0; attempt < 10; attempt++) response = (await api("auth/login", { method: "POST", session: "", headers: { "x-real-ip": "203.0.113.2" }, body: { email: "blocked@example.test", password: "not-the-password" } })).response;
  assert.equal(response.status, 401);
  const blocked = await api("auth/login", { method: "POST", session: "", headers: { "x-real-ip": "203.0.113.2" }, body: { email: "blocked@example.test", password: "not-the-password" } });
  assert.equal(blocked.response.status, 429);
  assert.ok(Number(blocked.response.headers.get("retry-after")) > 0);
});

test("company membership, document isolation, and admin audit are enforced", async () => {
  const created = await api("workspaces", { method: "POST", body: { name: "Demo Company" } });
  assert.equal(created.response.status, 201);
  const workspaceId = created.data.id;
  const invite = await api(`workspaces/${workspaceId}/invitations`, { method: "POST", body: { email: "employee@kt.kz", role: "member" } });
  assert.equal(invite.response.status, 201);
  const accepted = await api("workspaces/invitations/accept", { method: "POST", session: otherCookie, body: { token: invite.data.token } });
  assert.equal(accepted.response.status, 200);
  const pendingInvite = await api(`workspaces/${workspaceId}/invitations`, { method: "POST", body: { email: "revoked@kt.kz", role: "member" } });
  assert.equal(pendingInvite.response.status, 201);
  assert.equal((await api(`workspaces/${workspaceId}/invitations`)).data.some(item => item.email === "revoked@kt.kz"), true);
  assert.equal((await api(`workspaces/${workspaceId}/invitations`, { session: otherCookie })).response.status, 403);
  assert.equal((await api(`workspaces/${workspaceId}/invitations/${pendingInvite.data.id}`, { method: "DELETE" })).response.status, 200);
  assert.equal((await api("workspaces/invitations/accept", { session: otherCookie, method: "POST", body: { token: pendingInvite.data.token } })).response.status, 404);
  const createdGroup = await api(`workspaces/${workspaceId}/groups`, { method: "POST", body: { name: "Заң бөлімі", description: "Шарттарды тексеру" } });
  assert.equal(createdGroup.response.status, 201);
  assert.equal((await api(`workspaces/${workspaceId}/groups`, { session: otherCookie, method: "POST", body: { name: "Denied" } })).response.status, 403);
  const employeeId = (await api(`workspaces/${workspaceId}/members`)).data.find(row => row.email === "employee@kt.kz").id;
  const groupMember = await api(`workspaces/${workspaceId}/groups/${createdGroup.data.id}/members`, { method: "POST", body: { userId: employeeId } });
  assert.equal(groupMember.response.status, 200);
  assert.equal(groupMember.data.members[0], employeeId);
  assert.equal((await api(`workspaces/${workspaceId}/groups`)).data[0].members[0].email, "employee@kt.kz");
  assert.equal((await api(`workspaces/${workspaceId}/groups/${createdGroup.data.id}`, { method: "PATCH", body: { name: "Келісім бөлімі", description: "Келісу және бақылау" } })).data.name, "Келісім бөлімі");
  const companyDoc = await api("documents?workspaceId=" + workspaceId, { method: "POST", body: { title: "Company doc", text: "Private company content", workspaceId } });
  assert.equal(companyDoc.response.status, 201);
  assert.equal((await api(`documents/${companyDoc.data.id}`, { session: otherCookie })).response.status, 404);
  const groupAccess = await api(`documents/${companyDoc.data.id}/group-shares`, { method: "POST", body: { groupId: createdGroup.data.id, permission: "commenter" } });
  assert.equal(groupAccess.response.status, 201);
  const groupVisible = await api(`documents/${companyDoc.data.id}`, { session: otherCookie });
  assert.equal(groupVisible.response.status, 200);
  assert.equal(groupVisible.data.permission, "commenter");
  assert.equal((await api(`documents/${companyDoc.data.id}/comments`, { method: "POST", session: otherCookie, body: { text: "Group review" } })).response.status, 201);
  assert.equal((await api(`documents/${companyDoc.data.id}/group-shares/${createdGroup.data.id}`, { method: "DELETE" })).response.status, 200);
  assert.equal((await api(`documents/${companyDoc.data.id}`, { session: otherCookie })).response.status, 404);
  const memberAudit = await api(`workspaces/${workspaceId}/audit`, { session: otherCookie });
  assert.equal(memberAudit.response.status, 403);
  const audit = await api(`workspaces/${workspaceId}/audit`);
  assert.equal(audit.response.status, 200);
  assert.ok(audit.data.some(row => row.action === "workspace.create"));
  assert.ok(audit.data.some(row => row.action === "membership.invite"));
  assert.ok(audit.data.some(row => row.action === "membership.accept_invitation"));
  const approval = await api(`documents/${companyDoc.data.id}/approval`, { method: "POST", body: { approvers: ["employee@kt.kz"] } });
  assert.equal(approval.response.status, 201);
  assert.equal((await api("approvals", { session: otherCookie })).data.some(flow => flow.id === approval.data.id), true);
  const database = new DatabaseSync(path.join(directory, "agent.sqlite"));
  const employee = JSON.parse(database.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload).users.find(row => row.email === "employee@kt.kz");
  database.close();
  const removed = await api(`workspaces/${workspaceId}/members/${employee.id}`, { method: "DELETE" });
  assert.equal(removed.response.status, 200);
  assert.equal((await api("approvals", { session: otherCookie })).data.some(flow => flow.id === approval.data.id), false);
  assert.equal((await api(`approvals/${approval.data.id}/decision`, { method: "POST", session: otherCookie, body: { decision: "approve" } })).response.status, 403);
  assert.deepEqual((await api(`workspaces/${workspaceId}/groups`)).data[0].members, []);
  assert.equal((await api(`documents/${companyDoc.data.id}`, { session: otherCookie })).response.status, 404);
});

test("private folders, favorites and tags do not leak through a shared document", async () => {
  const created = await api("documents", { method: "POST", body: { title: "Tagged document.txt", text: "3.1. Review this clause." } });
  const id = created.data.id;
  const organized = await api(`documents/${id}/organization`, { method: "PATCH", body: { folder: "Legal", tags: ["review", "review", "2026"], favorite: true } });
  assert.equal(organized.response.status, 200);
  assert.equal(organized.data.folder, "Legal"); assert.deepEqual(organized.data.tags, ["review", "2026"]); assert.equal(organized.data.version, 1);
  assert.equal((await api(`documents/${id}/shares`, { method: "POST", body: { email: "employee@kt.kz", permission: "commenter" } })).response.status, 201);
  const shared = await api(`documents/${id}`, { session: otherCookie });
  assert.equal(shared.data.folder, ""); assert.equal(shared.data.favorite, false); assert.deepEqual(shared.data.tags, []);
  assert.equal((await api(`documents/${id}/comments`, { method: "POST", body: { text: "Check this", clause: "3.1", version: 1 } })).response.status, 201);
  assert.equal((await api(`documents/${id}/comments`, { method: "POST", body: { text: "Invalid", clause: "9.9", version: 1 } })).response.status, 400);
  assert.equal((await api(`documents/${id}/organization`, { method: "PATCH", body: { tags: ["x".repeat(33)] } })).response.status, 400);
});

test("Word and PDF exports round-trip Kazakh text and reject invalid files", async () => {
  const text = "ҚАЗАҚША ҚҰЖАТ\n1.1. Ә Ғ Қ Ң Ө Ұ Ү Һ І — Русский and English.";
  for (const format of ["docx", "pdf"]) {
    const response = await fetch(`${base}/api/files/export`, { method: "POST", headers: { Cookie: cookie, "Content-Type": "application/json" }, body: JSON.stringify({ format, title: "Тексеру.txt", text }) });
    assert.equal(response.status, 200);
    const bytes = await response.arrayBuffer();
    assert.equal(new TextDecoder().decode(bytes.slice(0, format === "pdf" ? 4 : 2)), format === "pdf" ? "%PDF" : "PK");
    const form = new FormData(); form.set("file", new File([bytes], `test.${format}`));
    const parsed = await fetch(`${base}/api/files/parse`, { method: "POST", headers: { Cookie: cookie }, body: form });
    assert.equal(parsed.status, 200); const data = await parsed.json(); assert.equal(data.ocrPages, 0); assert.match(data.text, /ҚАЗАҚША ҚҰЖАТ/); assert.match(data.text, /Ә Ғ Қ Ң Ө Ұ Ү Һ І/);
  }
  assert.equal((await api("files/export", { method: "POST", session: "", body: { format: "pdf", text, title: "test" } })).response.status, 401);
  const form = new FormData(); form.set("file", new File(["invalid"], "test.pdf"));
  assert.equal((await fetch(`${base}/api/files/parse`, { method: "POST", headers: { Cookie: cookie }, body: form })).status, 422);
});

async function parsePdf(bytes, session = cookie) {
  const form = new FormData(); form.set("file", new File([bytes], "scanned.pdf"));
  const response = await fetch(`${base}/api/files/parse`, { method: "POST", headers: session ? { Cookie: session } : {}, body: form });
  return { response, data: await response.json() };
}

test("OCR reads Kazakh, Russian and English scans and preserves native page order", { timeout: 90000 }, async () => {
  const { pdf } = await scannedPdf({ nativePage: true, pageNumber: true });
  const { response, data } = await parsePdf(pdf);
  assert.equal(response.status, 200, JSON.stringify(data));
  assert.equal(data.ocrPages, 1);
  for (const text of ["ҚАЗАҚСТАН РЕСПУБЛИКАСЫ", "Сынақ құжаты", "Документ для проверки", "Scanned document OCR"]) assert.ok(data.text.includes(text), data.text);
  assert.ok(data.text.indexOf("Native paragraph") < data.text.indexOf("ҚАЗАҚСТАН"));
  const saved = await api("documents", { method: "POST", body: { title: "OCR review", text: data.text, source: "upload" } });
  assert.equal(saved.response.status, 201);
  assert.equal((await api(`documents/${saved.data.id}`)).data.versions.at(-1).text, data.text);
});

test("short native text and blank pages do not start OCR", async () => {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica);
  pdf.addPage().drawText("Short native text", { x: 45, y: 700, font }); pdf.addPage();
  const parsed = await parsePdf(await pdf.save());
  assert.equal(parsed.response.status, 200); assert.equal(parsed.data.ocrPages, 0);
  assert.equal(parsed.data.text.trim(), "Short native text");
  const empty = await PDFDocument.create(); empty.addPage();
  assert.equal((await parsePdf(await empty.save())).response.status, 422);
});

test("OCR enforces authentication and its ten scanned page limit", async () => {
  const { pdf } = await scannedPdf({ pages: 11 });
  assert.equal((await parsePdf(pdf, "")).response.status, 401);
  const result = await parsePdf(pdf);
  assert.equal(result.response.status, 413); assert.match(result.data.error, /10/);
});

test("profile avatar and organization persist without allowing role escalation", async () => {
  const avatar = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=";
  const result = await api("auth/profile", { method: "PATCH", body: { name: "Profile Test", avatar, company: "Test company", position: "Reviewer", role: "admin" } });
  assert.equal(result.response.status, 200); assert.equal(result.data.user.role, "user"); assert.equal(result.data.user.avatar, avatar); assert.equal(result.data.user.company, "Test company");
  assert.equal((await api("auth/me")).data.user.avatar, avatar);
  assert.equal((await api("auth/profile", { method: "PATCH", body: { name: "Profile Test", avatar: "data:image/svg+xml;base64,PHN2Zz4=" } })).response.status, 400);
});

test("password changes check the current password and revoke other sessions", async () => {
  const login = await api("auth/login", { method: "POST", session: "", headers: { "x-forwarded-for": "198.51.100.211" }, body: { email: "user@kt.kz", password: "User12345" } });
  assert.equal(login.response.status, 200);
  const extra = login.response.headers.get("set-cookie").split(";")[0];
  assert.equal((await api("auth/password", { method: "POST", body: { currentPassword: "Wrong12345", password: "Changed12345" } })).response.status, 400);
  assert.equal((await api("auth/password", { method: "POST", body: { currentPassword: "User12345", password: "Changed12345" } })).response.status, 200);
  assert.equal((await api("auth/me", { session: extra })).data.user, null);
  assert.ok((await api("auth/me")).data.user);
});
