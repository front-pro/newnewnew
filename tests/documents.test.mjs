import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";

let server, directory, base, cookie, otherCookie, document;
let output = "";

async function api(route, { method = "GET", body, session = cookie } = {}) {
  const response = await fetch(`${base}/api/${route}`, {
    method,
    headers: { ...(session ? { Cookie: session } : {}), ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, data: await response.json() };
}

before(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "kt-documents-test-"));
  await writeFile(path.join(directory, "agent.json"), JSON.stringify({ docs: { "user@kt.kz": "Бұрын сақталған құжат" }, versions: { "user@kt.kz": 4 }, documents: { "employee@kt.kz": [{ id: "old-file", title: "Бұрынғы тізім.txt", text: "Қолданыстағы құжат", updatedAt: "2026-11-06 10:00", version: 3 }] } }));
  const socket = createServer();
  socket.listen(0, "127.0.0.1");
  await once(socket, "listening");
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  base = `http://127.0.0.1:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], { env: { ...process.env, KT_AGENT_DATA_DIR: directory }, stdio: ["ignore", "pipe", "pipe"] });
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
  const stored = JSON.parse(await readFile(path.join(directory, "agent.json"), "utf8"));
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
  const restored = await api("documents", { method: "POST", body: { documentId: document.id, baseVersion: 3, title: "Ереже.txt", text: "Алғашқы нұсқа" } });
  assert.equal(restored.data.version, 4);
  assert.equal(restored.data.versions.length, 4);
  assert.equal(restored.data.versions[1].text, "Екінші нұсқа");
  const latest = await api("documents/me");
  assert.equal(latest.data.id, document.id);
  assert.equal(latest.data.text, "Алғашқы нұсқа");
  assert.equal(latest.data.version, 4);
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
