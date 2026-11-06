import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SavedDocument } from "../../lib/documents";

export type User = { id: string; name: string; email: string; salt: string; hash: string; role: "user" | "employee" | "admin"; avatar?: string };
export type Template = { id: number; title: string; desc: string; access: "public" | "employee"; owner: string; body: string };
type LegacyDocument = { id: string; title: string; text: string; updatedAt: string; version: number };
export type Store = {
  users: User[]; sessions: Record<string, string>; templates: Template[]; analyses: Record<string, { owner: string; result: Record<string, unknown> }>;
  docs: Record<string, string>; versions: Record<string, number>; documents: SavedDocument[]; log: { owner: string; type: string; tone: string; title: string; meta: string }[]; nextId: number;
};
const pathToStore = path.join(process.env.KT_AGENT_DATA_DIR || path.join(process.cwd(), ".data"), "agent.json");
const makeUser = (name: string, email: string, password: string, role: User["role"]): User => {
  const salt = randomBytes(16).toString("hex");
  return { id: randomBytes(12).toString("hex"), name, email, salt, hash: scryptSync(password, salt, 64).toString("hex"), role };
};
const templates: Template[] = [
  { id: 1, title: "Қызметтік жазба үлгісі", desc: "Ішкі хат алмасуға арналған стандартты формат.", access: "public", owner: "system", body: `ҚЫЗМЕТТІК ЖАЗБА\n\nКімге: [лауазымы, аты-жөні]\nКімнен: [лауазымы, аты-жөні]\nКүні: [күн.ай.жыл]\n\n1. Мәселенің мәні: [қысқаша сипаттаңыз]\n2. Ұсыныс: [не істеу керек]\n3. Қосымшалар: [құжаттар тізімі]` },
  { id: 2, title: "Еңбек шартына қосымша келісім", desc: "Кадрлық өзгерістерді тіркеуге арналған келісім.", access: "public", owner: "system", body: `ЕҢБЕК ШАРТЫНА ҚОСЫМША КЕЛІСІМ № [нөмірі]\n\n1.1. Осы келісім [күні] жасалған еңбек шартына өзгеріс енгізеді.\n1.2. Қызметкер [лауазымы] қызметіне ауыстырылады.\n2.1. Жалақы мөлшері [сома] теңге болып белгіленеді.\n2.2. Қалған шарттар өзгеріссіз қалады.` },
  { id: 3, title: "Бөлімше ережесі және функциялар матрицасы", desc: "Қайта құрылымдау кезіндегі ішкі департамент регламенті.", access: "employee", owner: "system", body: `[БӨЛІМШЕ АТАУЫ] ТУРАЛЫ ЕРЕЖЕ\n\n1.1. Бөлімше ұйымның құрылымдық бөлімшесі болып табылады.\n1.2. Бөлімше өз қызметінде заңнаманы және ішкі регламентті басшылыққа алады.\n2.1. Құжаттарды автоматты талдауды қамтамасыз ету.\n2.2. Нормативтік құжаттар редакцияларындағы қақтығыстарды анықтау.\n3.1. Құжаттарды архивтеу және сақтау.` },
];
function initialStore(): Store {
  return { users: [makeUser("Әкімші", "admin@kt.kz", "Admin123", "admin"), makeUser("Қызметкер", "employee@kt.kz", "Employee123", "employee"), makeUser("Пайдаланушы", "user@kt.kz", "User12345", "user")], sessions: {}, templates, analyses: {}, docs: {}, versions: {}, documents: [], log: [], nextId: 1 };
}
export async function readStore(): Promise<Store> {
  try {
    const raw = JSON.parse(await readFile(pathToStore, "utf8")) as Omit<Partial<Store>, "documents"> & { documents?: SavedDocument[] | Record<string, LegacyDocument[]> };
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
    return { ...defaults, ...raw, documents, users: raw.users || defaults.users, templates: raw.templates || defaults.templates, analyses: raw.analyses || {}, docs: raw.docs || {}, versions: raw.versions || {}, log: raw.log || [], sessions: raw.sessions || {}, nextId: raw.nextId || 1 };
  } catch { return initialStore(); }
}
export async function writeStore(store: Store) {
  await mkdir(path.dirname(pathToStore), { recursive: true });
  const temporary = `${pathToStore}.${randomBytes(8).toString("hex")}.tmp`;
  await writeFile(temporary, JSON.stringify(store, null, 2), "utf8");
  await rename(temporary, pathToStore);
}
export const publicUser = ({ id, name, email, role, avatar }: User) => ({ id, name, email, role, avatar: avatar || null });
export const hashPassword = (password: string, salt: string) => scryptSync(password, salt, 64).toString("hex");
export function safeHashEqual(left: string, right: string) { const a = Buffer.from(left, "hex"), b = Buffer.from(right, "hex"); return a.length === b.length && timingSafeEqual(a, b); }
export const newToken = () => randomBytes(32).toString("hex");
export function getSessionToken(request: Request) { const item = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("kt_session=")); return item ? decodeURIComponent(item.slice(11)) : ""; }
export function cookieHeader(token: string) { return `kt_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? 604800 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`; }
export async function currentUser(request: Request, store?: Store) { const data = store || await readStore(); const id = data.sessions[getSessionToken(request)]; return data.users.find(user => user.id === id) || null; }
export const stamp = () => new Date().toISOString().slice(0, 16).replace("T", " ");
