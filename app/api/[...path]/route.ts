import { NextResponse } from "next/server";
import { currentUser, readStore, stamp, writeStore } from "../auth/_lib";
import type { Template, User } from "../auth/_lib";
import { handleDocumentRequest } from "../documents-handler";

type Clause = { n: string; text: string };
const clauses = (value: string): Clause[] => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => { const match = line.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/); return { n: match?.[1] || "", text: match?.[2] || line }; });
const words = (text: string) => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const similarity = (a: string, b: string) => { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let shared = 0; x.forEach(word => { if (y.has(word)) shared++; }); return shared / (x.size + y.size - shared); };
function compare(aText: string, bText: string) {
  const a = clauses(aText), b = clauses(bText), usedA = new Set<number>(), matchedB = new Set<number>();
  const changes: { id: number; type: string; title: string; description: string; a: string; b: string }[] = [];
  const ref = (item?: Clause) => item ? (item.n ? `${item.n}-тармақ` : "жол") : "Жоқ";
  const add = (type: string, title: string, description: string, old?: Clause, next?: Clause) => changes.push({ id: changes.length + 1, type, title, description, a: ref(old), b: ref(next) });
  b.forEach((item, j) => { const i = a.findIndex((old, k) => !usedA.has(k) && old.text.toLocaleLowerCase().replace(/\s+/g, " ").trim() === item.text.toLocaleLowerCase().replace(/\s+/g, " ").trim()); if (i >= 0) { usedA.add(i); matchedB.add(j); } });
  b.forEach((item, j) => { if (matchedB.has(j)) return; let best = -1, score = 0; a.forEach((old, i) => { const value = usedA.has(i) ? 0 : similarity(old.text, item.text); if (value > score) { score = value; best = i; } }); if (best >= 0 && score >= .45) { usedA.add(best); matchedB.add(j); add("CHANGED", "Өзгертілген тармақ", `«${a[best].text.slice(0, 70)}» → «${item.text.slice(0, 70)}» (ұқсастық ${Math.round(score * 100)}%)`, a[best], item); } else add("NEW_CLAUSE", "Жаңа тармақ", item.text.slice(0, 140), undefined, item); });
  a.forEach((item, i) => { if (!usedA.has(i)) add("LOST_FUNCTION", "Жоғалған функция (Lost Function)", item.text.slice(0, 140), item); });
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const score = similarity(b[i].text, b[j].text); if (score >= .6 && b[i].text.toLocaleLowerCase() !== b[j].text.toLocaleLowerCase()) add("CONFLICT", "Overlapping / қайталанатын функция", `Екі тармақ мазмұны ${Math.round(score * 100)}% сәйкес: «${b[i].text.slice(0, 60)}» және «${b[j].text.slice(0, 60)}»`, b[i], b[j]); }
  const count = (type: string) => changes.filter(change => change.type === type).length;
  const metrics = { total: changes.length, conflicts: count("CONFLICT"), lost: count("LOST_FUNCTION"), news: count("NEW_CLAUSE"), changed: count("CHANGED") };
  return { summary: `A құжаты (${a.length} тармақ) мен B құжаты (${b.length} тармақ) салыстырылды: ${metrics.total} өзгеріс табылды.`, metrics, changes };
}
const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
const fail = (message: string, status = 400) => json({ error: message }, status);
const accessible = (user: Awaited<ReturnType<typeof currentUser>>, template: Template) => template.access === "public" || user?.role === "employee" || user?.role === "admin";
const apiError = (e: unknown) => fail(e instanceof Error ? e.message : "Сервер қатесі", 500);
async function handle(request: Request) {
  try {
    const url = new URL(request.url), path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent), method = request.method;
    if (path[0] === "documents") return await handleDocumentRequest(request, path.slice(1));
    const store = await readStore(), user = await currentUser(request, store), role = user?.role || "guest";
    if (path[0] === "analysis" && path[1] === "run" && method === "POST") {
      const body = await request.json(), a = String(body.a || ""), b = String(body.b || "");
      if (!a.trim() || !b.trim()) return fail("Екі құжаттың мәтінін енгізіңіз (A және B)");
      if (a.length > 200000 || b.length > 200000) return fail("Құжат тым үлкен (макс. 200 000 таңба)", 413);
      const id = store.nextId++, result = { id, ...compare(a, b), isSaved: !!user };
      if (user) { store.analyses[String(id)] = { owner: user.email, result }; store.log.push({ owner: user.email, type: "ЖИ талдауы", tone: "blue", title: `Салыстыру #${id}`, meta: `${stamp()} · ${(result as ReturnType<typeof compare>).metrics.total} өзгеріс анықталды` }); await writeStore(store); }
      return json(result);
    }
    if (path[0] === "analysis" && path[1] && path[2] === "export" && method === "GET") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      const record = store.analyses[path[1]];
      if (!record || record.owner !== user.email) return fail("Талдау табылмады", 404);
      const result = record.result as { changes: { type: string; title: string; a: string; b: string; description: string }[] };
      const quote = (value: string) => `"${String(value).replace(/"/g, '""')}"`;
      return json({ csv: ["type,title,a,b,description", ...result.changes.map(c => [c.type, c.title, c.a, c.b, c.description].map(quote).join(","))].join("\n") });
    }
    if (path[0] === "templates" && method === "GET" && path.length === 1) {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      return json(store.templates.map(t => accessible(user, t) ? t : { id: t.id, title: t.title, desc: t.desc, access: t.access, owner: t.owner, locked: true }));
    }
    if (path[0] === "templates" && path[1] && path.length === 2 && method === "GET") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (!accessible(user, template)) return fail("Бұл үлгі тек қызметкерлерге қолжетімді", 403); return json(template);
    }
    if (path[0] === "templates" && path[1] && path[2] === "use" && method === "POST") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (!accessible(user, template)) return fail("Бұл үлгі тек қызметкерлерге қолжетімді", 403);
      store.log.push({ owner: user.email, type: "Үлгі", tone: "violet", title: template.title, meta: `${stamp()} · редакторда ашылды` }); await writeStore(store); return json(template);
    }
    if (path[0] === "templates" && method === "POST" && path.length === 1) {
      if (!user || !["employee", "admin"].includes(role)) return fail("Үлгі қосуға рұқсат жоқ", user ? 403 : 401);
      const body = await request.json(), title = String(body.title || "").trim(), desc = String(body.desc || "").trim(), text = String(body.body || ""), access = body.access === "employee" ? "employee" : "public";
      if (title.length < 3) return fail("Атауы кемінде 3 таңба болуы керек"); if (!text.trim()) return fail("Үлгі мәтіні бос");
      const template: Template = { id: Math.max(0, ...store.templates.map(t => t.id)) + 1, title, desc, body: text, access, owner: user.email };
      store.templates.push(template); store.log.push({ owner: user.email, type: "Үлгі", tone: "violet", title, meta: `${stamp()} · жаңа үлгі қосылды` }); await writeStore(store); return json(template, 201);
    }
    if (path[0] === "templates" && path[1] && method === "DELETE") {
      if (!user || !["employee", "admin"].includes(role)) return fail("Үлгіні жоюға рұқсат жоқ", user ? 403 : 401);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (role !== "admin" && template.owner !== user.email) return fail("Тек өз үлгіңізді жоя аласыз", 403);
      store.templates = store.templates.filter(t => t.id !== template.id); await writeStore(store); return json({ ok: true });
    }
    if (path[0] === "history" && method === "GET") { if (!user) return fail("Жүйеге кіріңіз", 401); return json(store.log.filter(row => row.owner === user.email).reverse()); }
    if (path[0] === "users" && method === "GET") { if (role !== "admin") return fail("Бұл бөлім тек әкімшіге арналған", user ? 403 : 401); return json(store.users.map(({ name, email, role: userRole }) => ({ name, email, role: userRole }))); }
    if (path[0] === "users" && path[1] && method === "PATCH") {
      if (role !== "admin") return fail("Бұл бөлім тек әкімшіге арналған", user ? 403 : 401);
      const email = path[1], body = await request.json(), nextRole = String(body.role); if (!["user", "employee", "admin"].includes(nextRole)) return fail("Рөл қате");
      if (email === user?.email) return fail("Өз рөліңізді өзгертуге болмайды"); const target = store.users.find(item => item.email === email); if (!target) return fail("Пайдаланушы табылмады", 404);
      target.role = nextRole as User["role"]; await writeStore(store); return json({ name: target.name, email: target.email, role: target.role });
    }
    return fail("API маршрут табылмады", 404);
  } catch (error) { return apiError(error); }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
export const DELETE = handle;
