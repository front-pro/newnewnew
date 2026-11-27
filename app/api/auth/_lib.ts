import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SavedDocument } from "../../lib/documents";
import type { AccessModule } from "../../lib/access-control";
import { databaseSchema } from "./schema";

export type User = { id: string; name: string; email: string; salt: string; hash: string; role: "user" | "employee" | "admin"; permissions?: AccessModule[]; platformRole?: "operator"; avatar?: string; company?: string; position?: string; emailVerifiedAt?: string | null; suspendedAt?: string | null };
export type SessionRecord = string | { id: string; userId: string; createdAt: string; expiresAt: string; userAgent: string };
export type WorkspaceRole = "member" | "admin";
export type Workspace = { id: string; name: string; ownerId: string; createdAt: string };
export type WorkspaceMembership = { workspaceId: string; userId: string; role: WorkspaceRole; joinedAt: string };
export type WorkspaceInvitation = { id: string; workspaceId: string; email: string; role: WorkspaceRole; tokenHash: string; expiresAt: string; invitedBy: string };
export type WorkspaceGroup = { id: string; workspaceId: string; name: string; description: string; createdAt: string; members: string[] };
export type Template = { id: number; title: string; desc: string; access: "public" | "employee"; owner: string; body: string; category?: "document" | "table"; design?: { theme: "classic" | "modern" | "minimal"; accent: string } };
export type ApprovalStep = { approverId: string; email: string; decision: "pending" | "approved" | "rejected"; decidedAt?: string; reason?: string };
export type ApprovalFlow = { id: string; documentId: string; workspaceId?: string; requestedBy: string; requestedAt: string; version: number; status: "pending" | "approved" | "rejected" | "stale" | "superseded"; steps: ApprovalStep[] };
export type AuditEventInput = { workspaceId?: string | null; actorId: string | null; action: string; resourceType: string; resourceId?: string | null; metadata?: Record<string, string | number | boolean | null> };
type LegacyDocument = { id: string; title: string; text: string; updatedAt: string; version: number };
export type HistoryLogEntry = { owner: string; type: string; tone: string; title: string; meta: string; documentId?: string };
export type HistoryTrashEntry = HistoryLogEntry & { trashedAt: string };
export type Store = {
  users: User[]; sessions: Record<string, SessionRecord>; verificationTokens: Record<string, { userId: string; expiresAt: string }>; passwordResetTokens: Record<string, { userId: string; expiresAt: string }>; approvals: ApprovalFlow[]; workspaces: Workspace[]; memberships: WorkspaceMembership[]; invitations: WorkspaceInvitation[]; groups: WorkspaceGroup[]; templates: Template[]; analyses: Record<string, { owner: string; result: Record<string, unknown> }>;
  docs: Record<string, string>; versions: Record<string, number>; documents: SavedDocument[]; log: HistoryLogEntry[]; historyTrash: HistoryTrashEntry[]; adminSettings?: Record<string, unknown>; nextId: number;
};
const dataDirectory = process.env.KT_AGENT_DATA_DIR || path.join(process.cwd(), ".data");
const pathToStore = path.join(dataDirectory, "agent.json");
const pathToDatabase = path.join(dataDirectory, "agent.sqlite");
let storeQueue: Promise<void> = Promise.resolve();
let databaseReady: Promise<DatabaseSync> | undefined;

async function getDatabase() {
  if (!databaseReady) databaseReady = (async () => {
    await mkdir(dataDirectory, { recursive: true });
    const db = new DatabaseSync(pathToDatabase);
    db.exec(databaseSchema);
    db.prepare("INSERT OR IGNORE INTO schema_migrations(version, applied_at) VALUES(1, ?)").run(new Date().toISOString());
    const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string } | undefined;
    if (!row) {
      let payload: string;
      try { payload = await readFile(pathToStore, "utf8"); }
      catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") payload = JSON.stringify(initialStore()); else throw error; }
      // Validate the legacy JSON before importing it so a damaged file is not silently replaced.
      const parsed: unknown = JSON.parse(payload);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Data store has an invalid format");
      db.prepare("INSERT OR IGNORE INTO app_state(id, payload, updated_at) VALUES(1, ?, ?)").run(payload, new Date().toISOString());
    }
    if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version = 2").get()) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string };
        const payload = JSON.parse(state.payload) as Partial<Store>;
        const now = new Date().toISOString(), expiresAt = new Date(Date.now() + 7 * 86400000).toISOString();
        const sessions = Object.fromEntries(Object.entries(payload.sessions || {}).map(([token, session]) => [token, typeof session === "string" ? { id: randomBytes(12).toString("hex"), userId: session, createdAt: now, expiresAt, userAgent: "legacy-session" } : session]));
        db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1").run(JSON.stringify({ ...payload, sessions }), now);
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(2, ?)").run(now);
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
    if (!db.prepare("SELECT 1 FROM schema_migrations WHERE version = 3").get()) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const state = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string };
        const store = normalizeStore(JSON.parse(state.payload));
        replaceRelationalRows(db, store);
        db.prepare("INSERT INTO schema_migrations(version, applied_at) VALUES(3, ?)").run(new Date().toISOString());
        db.exec("COMMIT");
      } catch (error) { db.exec("ROLLBACK"); throw error; }
    }
    return db;
  })();
  return databaseReady;
}

async function withStoreQueue<T>(operation: () => Promise<T>): Promise<T> {
  const previous = storeQueue;
  let release!: () => void;
  storeQueue = new Promise<void>(resolve => { release = resolve; });
  await previous;
  try { return await operation(); } finally { release(); }
}
export function withStoreReadLock<T>(operation: () => Promise<T>) { return withStoreQueue(operation); }
export function withStoreLock<T>(operation: () => Promise<T>): Promise<T> {
  return withStoreQueue(async () => {
    const db = await getDatabase();
    db.exec("BEGIN IMMEDIATE");
    try { const result = await operation(); db.exec("COMMIT"); return result; }
    catch (error) { db.exec("ROLLBACK"); throw error; }
  });
}
const makeUser = (name: string, email: string, password: string, role: User["role"]): User => {
  const salt = randomBytes(16).toString("hex");
  return { id: randomBytes(12).toString("hex"), name, email, salt, hash: scryptSync(password, salt, 64).toString("hex"), role };
};
function assignPlatformOperators(users: User[]) {
  const operators = new Set((process.env.KT_PLATFORM_OPERATOR_EMAILS || "").split(",").map(email => email.trim().toLowerCase()).filter(Boolean));
  users.forEach(user => { user.platformRole = operators.has(user.email) ? "operator" : undefined; });
  return users;
}
const templates: Template[] = [
  { id: 1, title: "Қызметтік жазба үлгісі", desc: "Ішкі хат алмасуға арналған стандартты формат.", access: "public", owner: "system", body: `ҚЫЗМЕТТІК ЖАЗБА\n\nКімге: [лауазымы, аты-жөні]\nКімнен: [лауазымы, аты-жөні]\nКүні: [күн.ай.жыл]\n\n1. Мәселенің мәні: [қысқаша сипаттаңыз]\n2. Ұсыныс: [не істеу керек]\n3. Қосымшалар: [құжаттар тізімі]`, category: "document", design: { theme: "classic", accent: "#1d4ed8" } },
  { id: 2, title: "Еңбек шартына қосымша келісім", desc: "Кадрлық өзгерістерді тіркеуге арналған келісім.", access: "public", owner: "system", body: `ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ № [нөмірі]\n\n1.1. Осы келісім [күні] жасалған еңбек шартына өзгеріс енгізеді.\n1.2. Қызметкер [лауазымы] қызметіне ауыстырылады.\n2.1. Жалақы мөлшері [сома] теңге болып белгіленеді.\n2.2. Қалған шарттар өзгеріссіз қалады.`, category: "document", design: { theme: "classic", accent: "#334155" } },
  { id: 3, title: "Бөлімше ережесі және функциялар матрицасы", desc: "Ішкі департамент регламентіне арналған құрылым.", access: "employee", owner: "system", body: `[БӨЛІМШЕ АТАУЫ] ТУРАЛЫ ЕРЕЖЕ\n\n1.1. Бөлімше ұйымның құрылымдық бөлімшесі болып табылады.\n1.2. Бөлімше өз қызметінде заңнаманы және ішкі регламентті басшылыққа алады.\n2.1. Құжаттарды автоматты талдауды қамтамасыз ету.\n2.2. Нормативтік құжаттар редакцияларындағы қақтығыстарды анықтау.\n3.1. Құжаттарды архивтеу және сақтау.`, category: "document", design: { theme: "modern", accent: "#0f766e" } },
  { id: 1001, title: "Жиналыс хаттамасы", desc: "Күн тәртібі, талқылау және қабылданған шешімдерді тіркеу.", access: "public", owner: "system", body: `ЖИНАЛЫС ХАТТАМАСЫ № [нөмір]\n\nКүні мен уақыты: [күні, уақыты]\nӨтетін орны: [орны]\nҚатысқандар: [аты-жөндері]\nТөраға: [аты-жөні] · Хатшы: [аты-жөні]\n\nКҮН ТӘРТІБІ\n1. [Мәселе және баяндамашы]\n\nТЫҢДАЛДЫ\n[Талқылаудың қысқаша мазмұны]\n\nШЕШІМ ҚАБЫЛДАНДЫ\n1. [Тапсырма] · Жауапты: [аты-жөні] · Мерзімі: [күн]`, category: "document", design: { theme: "minimal", accent: "#7c3aed" } },
  { id: 1002, title: "Жоба тапсырмалары кестесі", desc: "Жауапты адам, мерзім және орындалу күйін бақылау.", access: "public", owner: "system", body: `<table><thead><tr><th>№</th><th>Тапсырма</th><th>Жауапты</th><th>Мерзімі</th><th>Күйі</th></tr></thead><tbody><tr><td>1</td><td>[Тапсырма атауы]</td><td>[Аты-жөні]</td><td>[Күні]</td><td>Жоспарда</td></tr><tr><td>2</td><td>[Тапсырма атауы]</td><td>[Аты-жөні]</td><td>[Күні]</td><td>Орындалуда</td></tr><tr><td>3</td><td>[Тапсырма атауы]</td><td>[Аты-жөні]</td><td>[Күні]</td><td>Дайын</td></tr></tbody></table>`, category: "table", design: { theme: "modern", accent: "#0f766e" } },
  { id: 1003, title: "Құжаттарды салыстыру есебі", desc: "A/B нұсқаларындағы айырмашылық пен тәуекелді қорытындылау.", access: "public", owner: "system", body: `ҚҰЖАТТАРДЫ САЛЫСТЫРУ ЕСЕБІ\n\nA құжаты: [атауы, нұсқасы]\nB құжаты: [атауы, нұсқасы]\nСалыстырылған күні: [күн]\n\nҚЫСҚАША ҚОРЫТЫНДЫ\n[Негізгі өзгерістер мен ықтимал әсер]\n\nӨЗГЕРІСТЕР\n• Жаңа тармақтар: [саны, тізімі]\n• Алып тасталған тармақтар: [саны, тізімі]\n• Өзгертілген тармақтар: [саны, тізімі]\n• Тәуекел/ескерту: [сипаттама]`, category: "document", design: { theme: "modern", accent: "#2563eb" } },
  { id: 1004, title: "Түйіндеме (CV)", desc: "Жұмыс тәжірибесі, дағдылар және байланыс деректері.", access: "public", owner: "system", body: `[АТЫ-ЖӨНІ]\n[Лауазым / кәсіби бағыт]\n[Телефон] · [Email] · [Қала]\n\nКӘСІБИ ҚОРЫТЫНДЫ\n[Тәжірибеңіз бен мақсатыңызды 2–3 сөйлеммен жазыңыз]\n\nЖҰМЫС ТӘЖІРИБЕСІ\n[Компания] · [Лауазым] · [Кезең]\n• [Нәтиже және жауапкершілік]\n\nБІЛІМІ\n[Оқу орны] · [Мамандық] · [Жыл]\n\nДАҒДЫЛАР\n[Құралдар, тілдер, сертификаттар]`, category: "document", design: { theme: "minimal", accent: "#be123c" } },
  { id: 1005, title: "Іс-шара бағдарламасы", desc: "Уақыт кестесі мен спикерлерге арналған бір беттік макет.", access: "public", owner: "system", body: `[ІС-ШАРА АТАУЫ]\n[Ұраны немесе қысқаша сипаттама]\n\nКүні: [күн] · Өтетін орны: [мекенжай]\n\nБАҒДАРЛАМА\n09:00 · Қатысушыларды тіркеу\n09:30 · Ашылу сөзі · [Спикер]\n10:00 · [Сессия тақырыбы] · [Спикер]\n11:00 · Үзіліс\n11:30 · [Практикалық бөлім]\n12:30 · Қорытынды және байланыс`, category: "document", design: { theme: "modern", accent: "#1d4ed8" } },
  { id: 1006, title: "Апталық жоспар кестесі", desc: "Апта міндеттері мен орындалу белгісіне арналған тор.", access: "public", owner: "system", body: `<table><thead><tr><th>Күн</th><th>Басымдық</th><th>Міндет</th><th>Уақыт</th><th>Белгі</th></tr></thead><tbody><tr><td>Дүйсенбі</td><td>Жоғары</td><td>[Міндет]</td><td>[09:00]</td><td>□</td></tr><tr><td>Сейсенбі</td><td>Орташа</td><td>[Міндет]</td><td>[10:00]</td><td>□</td></tr><tr><td>Сәрсенбі</td><td>Орташа</td><td>[Міндет]</td><td>[11:00]</td><td>□</td></tr><tr><td>Бейсенбі</td><td>Төмен</td><td>[Міндет]</td><td>[14:00]</td><td>□</td></tr><tr><td>Жұма</td><td>Жоғары</td><td>[Апта қорытындысы]</td><td>[16:00]</td><td>□</td></tr></tbody></table>`, category: "table", design: { theme: "classic", accent: "#d97706" } },
];
function initialStore(): Store {
  const users: User[] = process.env.NODE_ENV === "production"
    ? []
    : [makeUser("Әкімші", "admin@kt.kz", "Admin123", "admin"), makeUser("Қызметкер", "employee@kt.kz", "Employee123", "employee"), makeUser("Пайдаланушы", "user@kt.kz", "User12345", "user")];
  if (process.env.KT_BOOTSTRAP_ADMIN_EMAIL && process.env.KT_BOOTSTRAP_ADMIN_PASSWORD) {
    users.push(makeUser("Әкімші", process.env.KT_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(), process.env.KT_BOOTSTRAP_ADMIN_PASSWORD, "admin"));
  }
  assignPlatformOperators(users);
  return { users, sessions: {}, verificationTokens: {}, passwordResetTokens: {}, approvals: [], workspaces: [], memberships: [], invitations: [], groups: [], templates, analyses: {}, docs: {}, versions: {}, documents: [], log: [], historyTrash: [], adminSettings: {}, nextId: 1 };
}
function normalizeStore(value: unknown): Store {
  const raw = value as Omit<Partial<Store>, "documents"> & { documents?: SavedDocument[] | Record<string, LegacyDocument[]> };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Data store has an invalid format");
  const defaults = initialStore();
  // Older stores kept only the latest text per account. Preserve that snapshot;
  // earlier versions cannot be recovered and must not be fabricated.
  const documents: SavedDocument[] = Array.isArray(raw.documents) ? raw.documents : Object.entries(raw.documents || {}).flatMap(([owner, items]) => items.map(item => {
    const savedAt = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(item.updatedAt) ? `${item.updatedAt.replace(" ", "T")}:00.000Z` : item.updatedAt;
    return { id: item.id, owner, title: item.title, source: "editor" as const, createdAt: savedAt, updatedAt: savedAt, versions: [{ version: item.version, title: item.title, text: item.text, savedAt }] };
  }));
  if (!Array.isArray(raw.documents)) {
    for (const [owner, text] of Object.entries(raw.docs || {})) {
      if (!text.trim() || documents.some(document => document.owner === owner)) continue;
      documents.push({ id: `legacy-${Buffer.from(owner).toString("hex")}`, owner, title: "Құжат.txt", source: "editor", createdAt: "", updatedAt: "", versions: [{ version: raw.versions?.[owner] || 1, title: "Құжат.txt", text, savedAt: "" }] });
    }
  }
  const users = Array.isArray(raw.users) ? raw.users.map(user => ({ ...user, emailVerifiedAt: user.emailVerifiedAt === undefined ? "legacy" : user.emailVerifiedAt })) : defaults.users;
  const storedTemplates = Array.isArray(raw.templates) ? [...raw.templates] : [...defaults.templates];
  for (const starter of defaults.templates.filter(template => template.owner === "system")) if (!storedTemplates.some(template => template.id === starter.id)) storedTemplates.push(starter);
  return { ...defaults, ...raw, documents: documents.map(document => ({ ...document, shares: document.shares || [], groupShares: document.groupShares || [], comments: document.comments || [] })), users: assignPlatformOperators(users), verificationTokens: raw.verificationTokens || {}, passwordResetTokens: raw.passwordResetTokens || {}, approvals: Array.isArray(raw.approvals) ? raw.approvals : [], workspaces: Array.isArray(raw.workspaces) ? raw.workspaces : [], memberships: Array.isArray(raw.memberships) ? raw.memberships : [], invitations: Array.isArray(raw.invitations) ? raw.invitations : [], groups: Array.isArray(raw.groups) ? raw.groups : [], templates: storedTemplates, analyses: raw.analyses || {}, docs: raw.docs || {}, versions: raw.versions || {}, log: Array.isArray(raw.log) ? raw.log : [], historyTrash: Array.isArray(raw.historyTrash) ? raw.historyTrash : [], adminSettings: raw.adminSettings && typeof raw.adminSettings === "object" && !Array.isArray(raw.adminSettings) ? raw.adminSettings : {}, sessions: raw.sessions || {}, nextId: Number.isSafeInteger(raw.nextId) && raw.nextId! > 0 ? raw.nextId! : 1 };
}

function replaceRelationalRows(db: DatabaseSync, store: Store) {
  db.exec("DELETE FROM sessions; DELETE FROM verification_tokens; DELETE FROM password_reset_tokens; DELETE FROM workspace_memberships; DELETE FROM workspace_invitations; DELETE FROM workspace_groups; DELETE FROM analyses; DELETE FROM documents; DELETE FROM activity_log; DELETE FROM history_trash; DELETE FROM approvals; DELETE FROM workspaces; DELETE FROM templates; DELETE FROM users;");
  const json = (value: unknown) => JSON.stringify(value);
  const insertUser = db.prepare("INSERT INTO users(id, email, role, payload) VALUES(?, ?, ?, ?)");
  for (const user of store.users) insertUser.run(user.id, user.email, user.role, json(user));
  const insertSession = db.prepare("INSERT INTO sessions(token, user_id, expires_at, payload) VALUES(?, ?, ?, ?)");
  for (const [token, value] of Object.entries(store.sessions)) {
    const session = typeof value === "string" ? { id: "legacy", userId: value, createdAt: "", expiresAt: "", userAgent: "legacy-session" } : value;
    insertSession.run(token, session.userId, session.expiresAt, json(value));
  }
  const insertVerification = db.prepare("INSERT INTO verification_tokens(token, user_id, expires_at, payload) VALUES(?, ?, ?, ?)");
  for (const [token, value] of Object.entries(store.verificationTokens)) insertVerification.run(token, value.userId, value.expiresAt, json(value));
  const insertReset = db.prepare("INSERT INTO password_reset_tokens(token, user_id, expires_at, payload) VALUES(?, ?, ?, ?)");
  for (const [token, value] of Object.entries(store.passwordResetTokens)) insertReset.run(token, value.userId, value.expiresAt, json(value));
  const insertWorkspace = db.prepare("INSERT INTO workspaces(id, owner_id, name, payload) VALUES(?, ?, ?, ?)");
  for (const item of store.workspaces) insertWorkspace.run(item.id, item.ownerId, item.name, json(item));
  const insertMembership = db.prepare("INSERT INTO workspace_memberships(workspace_id, user_id, role, payload) VALUES(?, ?, ?, ?)");
  for (const item of store.memberships) insertMembership.run(item.workspaceId, item.userId, item.role, json(item));
  const insertInvitation = db.prepare("INSERT INTO workspace_invitations(id, workspace_id, email, expires_at, payload) VALUES(?, ?, ?, ?, ?)");
  for (const item of store.invitations) insertInvitation.run(item.id, item.workspaceId, item.email, item.expiresAt, json(item));
  const insertGroup = db.prepare("INSERT INTO workspace_groups(id, workspace_id, name, payload) VALUES(?, ?, ?, ?)");
  for (const item of store.groups) insertGroup.run(item.id, item.workspaceId, item.name, json(item));
  const insertTemplate = db.prepare("INSERT INTO templates(id, owner, access, title, payload) VALUES(?, ?, ?, ?, ?)");
  for (const item of store.templates) insertTemplate.run(item.id, item.owner, item.access, item.title, json(item));
  const insertAnalysis = db.prepare("INSERT INTO analyses(id, owner, payload) VALUES(?, ?, ?)");
  for (const [id, item] of Object.entries(store.analyses)) insertAnalysis.run(id, item.owner, json(item));
  const insertDocument = db.prepare("INSERT INTO documents(id, owner, workspace_id, title, updated_at, deleted_at, payload) VALUES(?, ?, ?, ?, ?, ?, ?)");
  for (const item of store.documents) insertDocument.run(item.id, item.owner, item.workspaceId || null, item.title, item.updatedAt, item.deletedAt || null, json(item));
  const insertLog = db.prepare("INSERT INTO activity_log(owner, payload) VALUES(?, ?)");
  for (const item of store.log) insertLog.run(item.owner, json(item));
  const insertTrash = db.prepare("INSERT INTO history_trash(owner, payload) VALUES(?, ?)");
  for (const item of store.historyTrash) insertTrash.run(item.owner, json(item));
  const insertApproval = db.prepare("INSERT INTO approvals(id, document_id, workspace_id, requested_by, payload) VALUES(?, ?, ?, ?, ?)");
  for (const item of store.approvals) insertApproval.run(item.id, item.documentId, item.workspaceId || null, item.requestedBy, json(item));
}

function readRelationalStore(db: DatabaseSync, snapshot: Store): Store {
  const rows = (table: string) => db.prepare(`SELECT payload FROM ${table} ORDER BY rowid`).all() as { payload: string }[];
  const parseRows = <T>(table: string) => rows(table).map(row => JSON.parse(row.payload) as T);
  const keyedRows = <T>(table: string, keyColumn: string) => Object.fromEntries((db.prepare(`SELECT ${keyColumn}, payload FROM ${table} ORDER BY rowid`).all() as unknown as { payload: string; [key: string]: unknown }[]).map(row => [String(row[keyColumn]), JSON.parse(row.payload) as T]));
  return {
    ...snapshot,
    users: assignPlatformOperators(parseRows<User>("users")),
    sessions: keyedRows<SessionRecord>("sessions", "token"),
    verificationTokens: keyedRows<{ userId: string; expiresAt: string }>("verification_tokens", "token"),
    passwordResetTokens: keyedRows<{ userId: string; expiresAt: string }>("password_reset_tokens", "token"),
    workspaces: parseRows<Workspace>("workspaces"),
    memberships: parseRows<WorkspaceMembership>("workspace_memberships"),
    invitations: parseRows<WorkspaceInvitation>("workspace_invitations"),
    groups: parseRows<WorkspaceGroup>("workspace_groups"),
    templates: parseRows<Template>("templates"),
    analyses: keyedRows<{ owner: string; result: Record<string, unknown> }>("analyses", "id"),
    documents: parseRows<SavedDocument>("documents"),
    log: parseRows<HistoryLogEntry>("activity_log"),
    historyTrash: parseRows<HistoryTrashEntry>("history_trash"),
    approvals: parseRows<ApprovalFlow>("approvals"),
  };
}

export async function readStore(): Promise<Store> {
  const db = await getDatabase();
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get() as { payload: string } | undefined;
  if (!row) throw new Error("Data store is not initialized");
  const snapshot = normalizeStore(JSON.parse(row.payload));
  return readRelationalStore(db, snapshot);
}
export async function writeStore(store: Store) {
  const db = await getDatabase();
  const save = () => {
    replaceRelationalRows(db, store);
    db.prepare("INSERT INTO app_state(id, payload, updated_at) VALUES(1, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at").run(JSON.stringify(store), new Date().toISOString());
  };
  if (db.isTransaction) save();
  else { db.exec("BEGIN IMMEDIATE"); try { save(); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } }
}
export async function consumeAuthRateLimit(request: Request, email: string, maximum: number, windowMs: number, scope = "auth") {
  const db = await getDatabase();
  const address = request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const keyHashes = [
    createHash("sha256").update(`${scope}\nip\n${address.toLowerCase()}`).digest("hex"),
    createHash("sha256").update(`${scope}\nemail\n${email.toLowerCase()}`).digest("hex"),
  ];
  const now = Date.now();
  const check = () => {
    let retryAfter = 0;
    for (const keyHash of keyHashes) {
      const row = db.prepare("SELECT window_started_at, attempts FROM auth_rate_limits WHERE key_hash = ?").get(keyHash) as { window_started_at: number; attempts: number } | undefined;
      if (!row || now - row.window_started_at >= windowMs) db.prepare("INSERT INTO auth_rate_limits(key_hash, window_started_at, attempts) VALUES(?, ?, 1) ON CONFLICT(key_hash) DO UPDATE SET window_started_at = excluded.window_started_at, attempts = 1").run(keyHash, now);
      else if (row.attempts >= maximum) retryAfter = Math.max(retryAfter, Math.max(1, Math.ceil((row.window_started_at + windowMs - now) / 1000)));
      else db.prepare("UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE key_hash = ?").run(keyHash);
    }
    return retryAfter ? { limited: true as const, retryAfter } : { limited: false as const, retryAfter: 0 };
  };
  if (db.isTransaction) return check();
  db.exec("BEGIN IMMEDIATE");
  try { const result = check(); db.exec("COMMIT"); return result; }
  catch (error) { db.exec("ROLLBACK"); throw error; }
}
export async function appendAuditEvent(event: AuditEventInput) {
  const db = await getDatabase();
  const insert = () => db.prepare("INSERT INTO audit_events(id, workspace_id, actor_id, action, resource_type, resource_id, created_at, metadata) VALUES(?, ?, ?, ?, ?, ?, ?, ?)").run(randomBytes(16).toString("hex"), event.workspaceId || null, event.actorId, event.action, event.resourceType, event.resourceId || null, new Date().toISOString(), JSON.stringify(event.metadata || {}));
  if (db.isTransaction) insert();
  else { db.exec("BEGIN IMMEDIATE"); try { insert(); db.exec("COMMIT"); } catch (error) { db.exec("ROLLBACK"); throw error; } }
}
export async function readWorkspaceAudit(workspaceId: string, limit = 100) {
  const db = await getDatabase();
  return db.prepare("SELECT id, workspace_id AS workspaceId, actor_id AS actorId, action, resource_type AS resourceType, resource_id AS resourceId, created_at AS createdAt, metadata FROM audit_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?").all(workspaceId, Math.max(1, Math.min(500, limit))).map((row: unknown) => {
    const event = row as { metadata: string; [key: string]: unknown };
    return { ...event, metadata: JSON.parse(event.metadata) };
  });
}
export async function readUserAudit(actorId: string, limit = 30) {
  const db = await getDatabase();
  return db.prepare("SELECT id, action, resource_type AS resourceType, resource_id AS resourceId, created_at AS createdAt, metadata FROM audit_events WHERE actor_id = ? ORDER BY created_at DESC LIMIT ?").all(actorId, Math.max(1, Math.min(5000, limit))).map((row: unknown) => {
    const event = row as { metadata: string; [key: string]: unknown };
    return { ...event, metadata: JSON.parse(event.metadata) };
  });
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export async function deliverAuthEmail(to: string, subject: string, text: string) {
  const endpoint = process.env.KT_EMAIL_DELIVERY_URL;
  const secret = process.env.KT_EMAIL_DELIVERY_TOKEN;
  if (!endpoint || !secret) return false;
  const url = new URL(endpoint);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Production email delivery must use HTTPS");
  const response = await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: JSON.stringify({ to, subject, text }), signal: AbortSignal.timeout(8000), cache: "no-store" });
  return response.ok;
}
export const publicUser = ({ id, name, email, role, permissions, platformRole, avatar, company, position, emailVerifiedAt }: User) => ({ id, name, email, role, permissions: permissions || null, platformRole: platformRole || null, avatar: avatar || null, company: company || "", position: position || "", emailVerified: !!emailVerifiedAt });
export const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
export function safeHashEqual(left: string, right: string) { const a = Buffer.from(left, "hex"), b = Buffer.from(right, "hex"); return a.length === b.length && timingSafeEqual(a, b); }
export const newToken = () => randomBytes(32).toString("hex");
export function createSession(store: Store, user: User, request: Request) {
  const token = newToken(), createdAt = new Date().toISOString();
  store.sessions[token] = { id: randomBytes(12).toString("hex"), userId: user.id, createdAt, expiresAt: new Date(Date.now() + 7 * 86400000).toISOString(), userAgent: (request.headers.get("user-agent") || "unknown").slice(0, 256) };
  return token;
}
export function sessionUserId(session: SessionRecord | undefined) {
  if (typeof session === "string") return session;
  if (!session || Date.parse(session.expiresAt) <= Date.now()) return null;
  return session.userId;
}
export function getSessionToken(request: Request) {
  const item = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("kt_session="));
  if (!item) return "";
  try { return decodeURIComponent(item.slice("kt_session=".length)); } catch { return ""; }
}
export function cookieHeader(token: string) { return `kt_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 604800 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
export async function currentUser(request: Request, store?: Store) { const data = store || await readStore(); const id = sessionUserId(data.sessions[getSessionToken(request)]); return data.users.find(user => user.id === id && !user.suspendedAt) || null; }
export const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");
