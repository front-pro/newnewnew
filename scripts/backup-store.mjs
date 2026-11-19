import { chmod, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const dataDirectory = process.env.KT_AGENT_DATA_DIR || path.join(process.cwd(), ".data");
const source = path.resolve(dataDirectory, "agent.sqlite");
const destination = process.argv[2] ? path.resolve(process.argv[2]) : "";
if (!destination) throw new Error("Usage: node scripts/backup-store.mjs <backup-file.sqlite>");
if (source.toLowerCase() === destination.toLowerCase()) throw new Error("Backup destination must differ from the live database");
await stat(source);
try { await stat(destination); throw new Error("Backup destination already exists; choose a new file"); }
catch (error) { if (error?.code !== "ENOENT") throw error; }
await mkdir(path.dirname(destination), { recursive: true });
const db = new DatabaseSync(source);
try {
  db.exec("PRAGMA busy_timeout=5000");
  db.prepare("VACUUM INTO ?").run(destination);
  const backup = new DatabaseSync(destination, { readOnly: true });
  try {
    const integrity = backup.prepare("PRAGMA integrity_check").get();
    if (integrity.integrity_check !== "ok") throw new Error("Backup integrity check failed");
    const state = backup.prepare("SELECT 1 AS ready FROM app_state WHERE id = 1").get();
    if (!state) throw new Error("Backup has no initialized application state");
  } finally { backup.close(); }
  await chmod(destination, 0o600).catch(() => {});
  console.log(`Verified SQLite backup: ${destination}`);
} catch (error) {
  const { rm } = await import("node:fs/promises");
  await rm(destination, { force: true });
  throw error;
} finally { db.close(); }
