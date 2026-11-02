import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type User = { id: string; name: string; email: string; salt: string; hash: string };
type Store = { users: User[]; sessions: Record<string, string> };
const storePath = path.join(process.cwd(), ".data", "auth.json");

export async function readStore(): Promise<Store> {
  try { return JSON.parse(await readFile(storePath, "utf8")) as Store; }
  catch { return { users: [], sessions: {} }; }
}
export async function writeStore(store: Store) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}
export const publicUser = ({ id, name, email }: User) => ({ id, name, email, role: "user" });
export function getSessionToken(request: Request) {
  const entry = request.headers.get("cookie")?.split(";").map(s => s.trim()).find(s => s.startsWith("kt_session="));
  return entry ? decodeURIComponent(entry.slice("kt_session=".length)) : "";
}
export function hashPassword(password: string, salt: string) { return scryptSync(password, salt, 64).toString("hex"); }
export function newToken() { return randomBytes(32).toString("hex"); }
export function cookieHeader(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `kt_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800${secure}`;
}
export function isSameHash(a: string, b: string) {
  const aa = Buffer.from(a, "hex"), bb = Buffer.from(b, "hex");
  return aa.length === bb.length && timingSafeEqual(aa, bb);
}
