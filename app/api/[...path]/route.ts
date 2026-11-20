import { NextResponse } from "next/server";
import os from "node:os";
import { consumeAuthRateLimit, currentUser, readStore, stamp, withStoreLock, withStoreReadLock, writeStore } from "../auth/_lib";
import { analyzeComparison, type ComparisonChangeInput } from "../../lib/ai-comparison";
import type { Template, User } from "../auth/_lib";
import { handleApprovalRequest, handleDocumentRequest } from "../documents-handler";
import { handleWorkspaceRequest } from "../workspaces-handler";
import { accessModules, canAccessModule, effectivePermissions } from "../../lib/access-control";

type Clause = { n: string; text: string };
const clauses = (value: string): Clause[] => value.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => { const match = line.match(/^(\d+(?:\.\d+)*)\.?\s+(.*)$/); return { n: match?.[1] || "", text: match?.[2] || line }; });
const words = (text: string) => new Set(text.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
const similarity = (a: string, b: string) => { const x = words(a), y = words(b); if (!x.size || !y.size) return 0; let shared = 0; x.forEach(word => { if (y.has(word)) shared++; }); return shared / (x.size + y.size - shared); };
function compare(aText: string, bText: string) {
  const a = clauses(aText), b = clauses(bText), usedA = new Set<number>(), matchedB = new Set<number>();
  const changes: { id: number; type: string; title: string; description: string; a: string; b: string; beforeText: string; afterText: string }[] = [];
  const ref = (item?: Clause) => item ? (item.n ? `${item.n}-тармақ` : "жол") : "Жоқ";
  const add = (type: string, title: string, description: string, old?: Clause, next?: Clause) => changes.push({ id: changes.length + 1, type, title, description, a: ref(old), b: ref(next), beforeText: old?.text || "", afterText: next?.text || "" });
  b.forEach((item, j) => { const i = a.findIndex((old, k) => !usedA.has(k) && old.text.toLocaleLowerCase().replace(/\s+/g, " ").trim() === item.text.toLocaleLowerCase().replace(/\s+/g, " ").trim()); if (i >= 0) { usedA.add(i); matchedB.add(j); if (a[i].n !== item.n) add("CHANGED", "Нөмірі өзгерген тармақ", `«${a[i].n || "нөмірсіз"}» тармағы «${item.n || "нөмірсіз"}» болып өзгерді.`, a[i], item); } });
  b.forEach((item, j) => { if (matchedB.has(j)) return; let best = -1, score = 0; a.forEach((old, i) => { const value = usedA.has(i) ? 0 : similarity(old.text, item.text); if (value > score) { score = value; best = i; } }); if (best >= 0 && score >= .45) { usedA.add(best); matchedB.add(j); add("CHANGED", "Өзгертілген тармақ", `«${a[best].text.slice(0, 70)}» → «${item.text.slice(0, 70)}» (ұқсастық ${Math.round(score * 100)}%)`, a[best], item); } else add("NEW_CLAUSE", "Жаңа тармақ", item.text.slice(0, 140), undefined, item); });
  a.forEach((item, i) => { if (!usedA.has(i)) add("LOST_FUNCTION", "Жоғалған функция (Lost Function)", item.text.slice(0, 140), item); });
  for (let i = 0; i < b.length; i++) for (let j = i + 1; j < b.length; j++) { const score = similarity(b[i].text, b[j].text); if (score >= .6 && b[i].text.toLocaleLowerCase() !== b[j].text.toLocaleLowerCase()) add("CONFLICT", "Overlapping / қайталанатын функция", `Екі тармақ мазмұны ${Math.round(score * 100)}% сәйкес: «${b[i].text.slice(0, 60)}» және «${b[j].text.slice(0, 60)}»`, b[i], b[j]); }
  const count = (type: string) => changes.filter(change => change.type === type).length;
  const metrics = { total: changes.length, conflicts: count("CONFLICT"), lost: count("LOST_FUNCTION"), news: count("NEW_CLAUSE"), changed: count("CHANGED") };
  return { summary: `A құжаты (${a.length} тармақ) мен B құжаты (${b.length} тармақ) салыстырылды: ${metrics.total} өзгеріс табылды.`, metrics, changes };
}
const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
const fail = (message: string, status = 400) => json({ error: message }, status);
const sameHistoryEntry = (row: { type: string; title: string; meta: string; documentId?: string }, body: Record<string, unknown>) => row.type === body.type && row.title === body.title && row.meta === body.meta && (row.documentId || "") === (typeof body.documentId === "string" ? body.documentId : "");
const accessible = (user: Awaited<ReturnType<typeof currentUser>>, template: Template) => template.access === "public" || user?.role === "employee" || user?.role === "admin";
const apiError = (e: unknown) => e instanceof SyntaxError ? fail("JSON сұрауының форматы қате", 400) : fail("Сервер қатесі", 500);
async function handle(request: Request) {
  try {
    const url = new URL(request.url), path = url.pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent), method = request.method;
    if (path[0] === "admin" && path[1] === "overview" && path.length === 2 && method === "GET") {
      const store = await readStore(), user = await currentUser(request, store);
      if (user?.role !== "admin") return fail("Бұл бөлім тек әкімшіге арналған", user ? 403 : 401);
      const now = Date.now(), liveSessions = Object.values(store.sessions).filter(session => typeof session !== "string" && Date.parse(session.expiresAt) > now).length;
      const memory = process.memoryUsage(), totalMemory = os.totalmem(), freeMemory = os.freemem();
      const requestedDays = Number(new URL(request.url).searchParams.get("days"));
      const days = [7, 14, 30].includes(requestedDays) ? requestedDays : 14;
      const start = new Date(now); start.setUTCHours(0, 0, 0, 0); start.setUTCDate(start.getUTCDate() - days + 1);
      const daily = Array.from({ length: days }, (_, index) => { const date = new Date(start); date.setUTCDate(start.getUTCDate() + index); return { day: date.toISOString().slice(0, 10), documents: 0, analyses: 0, templates: 0, companies: 0, other: 0, total: 0 }; });
      const activity = store.log.slice(-5000).flatMap(entry => {
        const at = entry.meta.split(" · ")[0] || "", day = at.slice(0, 10), point = daily.find(item => item.day === day);
        if (!point) return [];
        const kind = entry.type === "Құжат" ? "documents" : entry.type.includes("талдау") || entry.type === "ЖИ талдауы" ? "analyses" : entry.type === "Үлгі" ? "templates" : entry.type === "Компания" ? "companies" : "other";
        point[kind]++; point.total++;
        const actor = store.users.find(candidate => candidate.email === entry.owner);
        return [{ actor: actor?.name || entry.owner, actorEmail: entry.owner, actorRole: actor?.role || "unknown", kind, action: entry.meta.split(" · ").slice(1).join(" · ") || entry.type, title: entry.title, at }];
      }).reverse();
      const roles = ["admin", "employee", "user"].map(role => ({ role, count: store.users.filter(person => person.role === role).length }));
      return json({
        capturedAt: new Date(now).toISOString(), uptimeSeconds: Math.floor(process.uptime()),
        memory: { rssBytes: memory.rss, heapUsedBytes: memory.heapUsed, heapTotalBytes: memory.heapTotal, systemUsedBytes: totalMemory - freeMemory, systemTotalBytes: totalMemory },
        cpu: { cores: os.cpus().length, loadAverage: os.loadavg() },
        days, daily, roles, verification: { verified: store.users.filter(person => !!person.emailVerifiedAt).length, unverified: store.users.filter(person => !person.emailVerifiedAt).length },
        counts: { users: store.users.length, verifiedUsers: store.users.filter(person => !!person.emailVerifiedAt).length, documents: store.documents.length, templates: store.templates.length, analyses: Object.keys(store.analyses).length, liveSessions },
        activity: activity.slice(0, 500),
      });
    }
    if (path[0] === "documents") return await handleDocumentRequest(request, path.slice(1));
    if (path[0] === "approvals") {
      const user = await currentUser(request);
      if (user && !canAccessModule(user, "approvals")) return fail("Бұл бөлімге қол жеткізуге рұқсат жоқ", 403);
      return await handleApprovalRequest(request, path.slice(1));
    }
    if (path[0] === "workspaces") {
      const user = await currentUser(request);
      if (user && !canAccessModule(user, "company")) return fail("Компания бөліміне қол жеткізуге рұқсат жоқ", 403);
      return await handleWorkspaceRequest(request, path.slice(1));
    }
    const store = await readStore(), user = await currentUser(request, store), role = user?.role || "guest";
    if (path[0] === "analysis" && path[1] === "run" && method === "POST") {
      if (user && !canAccessModule(user, "compare")) return fail("Салыстыру бөліміне қол жеткізуге рұқсат жоқ", 403);
      const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Сұрау объект болуы керек");
      const a = String(body.a || ""), b = String(body.b || "");
      if (!a.trim() || !b.trim()) return fail("Екі құжаттың мәтінін енгізіңіз (A және B)");
      if (a.length > 200000 || b.length > 200000) return fail("Құжат тым үлкен (макс. 200 000 таңба)", 413);
      const countLines = (text: string) => text.split(/\r?\n/).filter(line => line.trim()).length;
      if (countLines(a) > 1000 || countLines(b) > 1000) return fail("Әр құжатта ең көбі 1 000 мәтіндік жол болуы керек", 413);
      const comparison = compare(a, b);
      let aiAnalysis: Awaited<ReturnType<typeof analyzeComparison>> | undefined;
      let aiAnalysisError: string | undefined;
      if (body.withAi === true) {
        if (!user) aiAnalysisError = "ИИ талдауы үшін жүйеге кіріңіз.";
        else {
          const limit = await withStoreLock(() => consumeAuthRateLimit(request, user.email, 4, 60_000, "ai-comparison"));
          if (limit.limited) aiAnalysisError = "ИИ талдау сұрауы жиі жіберілді. Бір минуттан кейін қайталап көріңіз.";
          else {
            const language = body.language === "ru" || body.language === "en" ? body.language : "kk";
            try { aiAnalysis = await analyzeComparison(comparison.changes as ComparisonChangeInput[], language, request.signal); }
            catch (error) { aiAnalysisError = error instanceof Error ? error.message : "ИИ талдау орындалмады."; }
          }
        }
      }
      const id = store.nextId++, result = { id, ...comparison, isSaved: !!user, ...(aiAnalysis ? { aiAnalysis } : {}), ...(aiAnalysisError ? { aiAnalysisError } : {}) };
      if (user) { store.analyses[String(id)] = { owner: user.email, result }; store.log.push({ owner: user.email, type: "ЖИ талдауы", tone: "blue", title: `Салыстыру #${id}`, meta: `${stamp()} · ${(result as ReturnType<typeof compare>).metrics.total} өзгеріс анықталды` }); await writeStore(store); }
      return json(result);
    }
    if (path[0] === "analysis" && path[1] && path.length === 2 && method === "GET") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "compare")) return fail("Салыстыру бөліміне қол жеткізуге рұқсат жоқ", 403);
      const record = store.analyses[path[1]];
      if (!record || record.owner !== user.email) return fail("Талдау табылмады", 404);
      return json(record.result);
    }
    if (path[0] === "analysis" && path[1] && path[2] === "export" && method === "GET") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "compare")) return fail("Салыстыру бөліміне қол жеткізуге рұқсат жоқ", 403);
      const record = store.analyses[path[1]];
      if (!record || record.owner !== user.email) return fail("Талдау табылмады", 404);
      const result = record.result as { changes: { type: string; title: string; a: string; b: string; description: string }[] };
      const quote = (value: string) => {
        const text = String(value);
        const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
        return `"${safe.replace(/"/g, '""')}"`;
      };
      return json({ csv: ["type,title,a,b,description", ...result.changes.map(c => [c.type, c.title, c.a, c.b, c.description].map(quote).join(","))].join("\n") });
    }
    if (path[0] === "templates" && method === "GET" && path.length === 1) {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "templates")) return fail("Үлгілер бөліміне қол жеткізуге рұқсат жоқ", 403);
      return json(store.templates.map(t => accessible(user, t) ? t : { id: t.id, title: t.title, desc: t.desc, access: t.access, owner: t.owner, category: t.category, design: t.design, locked: true }));
    }
    if (path[0] === "templates" && path[1] && path.length === 2 && method === "GET") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "templates")) return fail("Үлгілер бөліміне қол жеткізуге рұқсат жоқ", 403);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (!accessible(user, template)) return fail("Бұл үлгі тек қызметкерлерге қолжетімді", 403); return json(template);
    }
    if (path[0] === "templates" && path[1] && path[2] === "use" && method === "POST") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "templates") || !canAccessModule(user, "editor")) return fail("Үлгіні қолдануға рұқсат жоқ", 403);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (!accessible(user, template)) return fail("Бұл үлгі тек қызметкерлерге қолжетімді", 403);
      store.log.push({ owner: user.email, type: "Үлгі", tone: "violet", title: template.title, meta: `${stamp()} · редакторда ашылды` }); await writeStore(store); return json(template);
    }
    if (path[0] === "templates" && method === "POST" && path.length === 1) {
      if (!user || !["employee", "admin"].includes(role)) return fail("Үлгі қосуға рұқсат жоқ", user ? 403 : 401);
      if (!canAccessModule(user, "templates")) return fail("Үлгілер бөліміне қол жеткізуге рұқсат жоқ", 403);
      const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Сұрау объект болуы керек");
      const title = String(body.title || "").trim(), desc = String(body.desc || "").trim(), text = String(body.body || ""), access = body.access === "employee" ? "employee" : "public";
      if (title.length < 3 || title.length > 160) return fail("Атауы 3–160 таңба болуы керек"); if (desc.length > 1000) return fail("Сипаттама тым ұзын"); if (!text.trim()) return fail("Үлгі мәтіні бос"); if (text.length > 200000) return fail("Үлгі мәтіні тым үлкен", 413);
      const designBody = body.design && typeof body.design === "object" ? body.design as Record<string, unknown> : {};
      const theme = ["classic", "modern", "minimal"].includes(String(designBody.theme)) ? designBody.theme as "classic" | "modern" | "minimal" : "classic";
      const accent = /^#[0-9a-fA-F]{6}$/.test(String(designBody.accent || "")) ? String(designBody.accent) : "#2563eb";
      const category = body.category === "table" || (!body.category && /<table\b/i.test(text)) ? "table" : "document";
      const template: Template = { id: Math.max(0, ...store.templates.map(t => t.id)) + 1, title, desc, body: text, access, owner: user.email, category, design: { theme, accent } };
      store.templates.push(template); store.log.push({ owner: user.email, type: "Үлгі", tone: "violet", title, meta: `${stamp()} · жаңа үлгі қосылды` }); await writeStore(store); return json(template, 201);
    }
    if (path[0] === "templates" && path[1] && method === "PATCH" && path.length === 2) {
      if (!user || !["employee", "admin"].includes(role)) return fail("Үлгіні өзгертуге рұқсат жоқ", user ? 403 : 401);
      if (!canAccessModule(user, "templates")) return fail("Үлгілер бөліміне қол жеткізуге рұқсат жоқ", 403);
      const template = store.templates.find(item => item.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (role !== "admin" && template.owner !== user.email) return fail("Тек өз үлгіңізді өзгерте аласыз", 403);
      const body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Сұрау объект болуы керек");
      const title = String(body.title || "").trim(), desc = String(body.desc || "").trim(), text = String(body.body || ""), designBody = body.design && typeof body.design === "object" ? body.design as Record<string, unknown> : {};
      if (title.length < 3 || title.length > 160) return fail("Атауы 3–160 таңба болуы керек"); if (desc.length > 1000) return fail("Сипаттама тым ұзын"); if (!text.trim()) return fail("Үлгі мәтіні бос"); if (text.length > 200000) return fail("Үлгі мәтіні тым үлкен", 413);
      const theme = ["classic", "modern", "minimal"].includes(String(designBody.theme)) ? designBody.theme as "classic" | "modern" | "minimal" : "classic";
      const accent = /^#[0-9a-fA-F]{6}$/.test(String(designBody.accent || "")) ? String(designBody.accent) : "#2563eb";
      template.title = title; template.desc = desc; template.body = text; template.access = body.access === "employee" ? "employee" : "public"; template.category = body.category === "table" || (!body.category && /<table\b/i.test(text)) ? "table" : "document"; template.design = { theme, accent };
      store.log.push({ owner: user.email, type: "Үлгі", tone: "violet", title, meta: `${stamp()} · үлгі жаңартылды` }); await writeStore(store); return json(template);
    }
    if (path[0] === "templates" && path[1] && method === "DELETE") {
      if (!user || !["employee", "admin"].includes(role)) return fail("Үлгіні жоюға рұқсат жоқ", user ? 403 : 401);
      if (!canAccessModule(user, "templates")) return fail("Үлгілер бөліміне қол жеткізуге рұқсат жоқ", 403);
      const template = store.templates.find(t => t.id === Number(path[1])); if (!template) return fail("Үлгі табылмады", 404);
      if (role !== "admin" && template.owner !== user.email) return fail("Тек өз үлгіңізді жоя аласыз", 403);
      store.templates = store.templates.filter(t => t.id !== template.id); await writeStore(store); return json({ ok: true });
    }
    if (path[0] === "history" && path[1] === "trash" && method === "GET") { if (!user) return fail("Жүйеге кіріңіз", 401); if (!canAccessModule(user, "history")) return fail("Тарих бөліміне қол жеткізуге рұқсат жоқ", 403); return json(store.historyTrash.filter(row => row.owner === user.email).reverse()); }
    if (path[0] === "history" && path[1] === "trash" && (method === "POST" || method === "DELETE")) {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "history")) return fail("Тарих бөліміне қол жеткізуге рұқсат жоқ", 403);
      let body;
      try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
      if (!body || typeof body.type !== "string" || typeof body.title !== "string" || typeof body.meta !== "string") return fail("Тарих жазбасы көрсетілмеген");
      const index = store.historyTrash.findIndex(row => row.owner === user.email && sameHistoryEntry(row, body));
      if (index < 0) return fail("Себеттегі тарих жазбасы табылмады", 404);
      const [entry] = store.historyTrash.splice(index, 1);
      if (method === "POST") store.log.push({ owner: entry.owner, type: entry.type, tone: entry.tone, title: entry.title, meta: entry.meta, ...(entry.documentId ? { documentId: entry.documentId } : {}) });
      await writeStore(store);
      return json({ ok: true });
    }
    if (path[0] === "history" && method === "GET") { if (!user) return fail("Жүйеге кіріңіз", 401); if (!canAccessModule(user, "history")) return fail("Тарих бөліміне қол жеткізуге рұқсат жоқ", 403); return json(store.log.filter(row => row.owner === user.email).reverse()); }
    if (path[0] === "history" && method === "DELETE") {
      if (!user) return fail("Жүйеге кіріңіз", 401);
      if (!canAccessModule(user, "history")) return fail("Тарих бөліміне қол жеткізуге рұқсат жоқ", 403);
      let body;
      try { body = await request.json(); } catch { return fail("JSON сұрауының форматы қате"); }
      if (!body || typeof body.type !== "string" || typeof body.title !== "string" || typeof body.meta !== "string") return fail("Тарих жазбасы көрсетілмеген");
      const index = store.log.findIndex(row => row.owner === user.email && sameHistoryEntry(row, body));
      if (index < 0) return fail("Тарих жазбасы табылмады", 404);
      const [entry] = store.log.splice(index, 1);
      store.historyTrash.push({ ...entry, trashedAt: new Date().toISOString() });
      await writeStore(store);
      return json({ ok: true });
    }
    if (path[0] === "users" && method === "GET") { if (role !== "admin") return fail("Бұл бөлім тек әкімшіге арналған", user ? 403 : 401); return json(store.users.map(({ name, email, role: userRole, permissions, emailVerifiedAt }) => ({ name, email, role: userRole, permissions: effectivePermissions({ role: userRole, permissions }), emailVerified: !!emailVerifiedAt }))); }
    if (path[0] === "users" && path[1] && method === "PATCH") {
      if (!user || role !== "admin") return fail("Бұл бөлім тек әкімшіге арналған", user ? 403 : 401);
      const email = path[1], body = await request.json(); if (!body || typeof body !== "object" || Array.isArray(body)) return fail("Сұрау объект болуы керек");
      const target = store.users.find(item => item.email === email); if (!target) return fail("Пайдаланушы табылмады", 404);
      if (body.role !== undefined) {
        const nextRole = String(body.role); if (!["user", "employee", "admin"].includes(nextRole)) return fail("Рөл қате");
        if (email === user.email) return fail("Өз рөліңізді өзгертуге болмайды");
        if (target.role === "admin" && nextRole !== "admin" && store.users.filter(item => item.role === "admin").length <= 1) return fail("Жүйеде кемінде бір әкімші қалуы керек", 409);
        if (target.role !== nextRole) { target.role = nextRole as User["role"]; delete target.permissions; }
      }
      if (body.permissions !== undefined) {
        if (!Array.isArray(body.permissions) || body.permissions.some((value: unknown) => typeof value !== "string" || !accessModules.includes(value as typeof accessModules[number]))) return fail("Рұқсаттар тізімі қате");
        if (target.role === "admin") return fail("Әкімшіге барлық бөлімдер қолжетімді");
        target.permissions = [...new Set(body.permissions as typeof accessModules[number][])];
      }
      await writeStore(store);
      return json({ name: target.name, email: target.email, role: target.role, permissions: effectivePermissions(target), emailVerified: !!target.emailVerifiedAt });
    }
    return fail("API маршрут табылмады", 404);
  } catch (error) { return apiError(error); }
}
const lockedHandle = (request: Request) => request.method === "GET" ? withStoreReadLock(() => handle(request)) : withStoreLock(() => handle(request));
export const GET = lockedHandle;
export const POST = lockedHandle;
export const PATCH = lockedHandle;
export const DELETE = lockedHandle;
