import { copyFile, rename, stat } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { randomBytes } from "node:crypto";

const source = process.argv[2] ? path.resolve(process.argv[2]) : "";
if (!source || !process.argv.includes("--apply")) throw new Error("Stop the application, then run: node scripts/restore-store.mjs <backup-file.sqlite> --apply");
const dataDirectory = process.env.KT_AGENT_DATA_DIR || path.join(process.cwd(), ".data");
const live = path.resolve(dataDirectory, "agent.sqlite");
if (source.toLowerCase() === live.toLowerCase()) throw new Error("Restore source must differ from the live database");
await stat(source);
await stat(live);

function validate(file) {
  const db = new DatabaseSync(file, { readOnly: true });
  try {
    if (db.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("SQLite integrity check failed");
    if (!db.prepare("SELECT 1 AS ready FROM app_state WHERE id = 1").get()) throw new Error("Database has no initialized application state");
  } finally { db.close(); }
}

validate(source);
const temporary = `${live}.${randomBytes(8).toString("hex")}.restore`;
const previous = `${live}.pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`;
await copyFile(source, temporary);
validate(temporary);
const active = new DatabaseSync(live);
try { active.exec("PRAGMA wal_checkpoint(TRUNCATE)"); } finally { active.close(); }
const sidecars = ["-wal", "-shm"];
const movedSidecars = [];
try {
  await rename(live, previous);
  for (const suffix of sidecars) {
    try { await rename(live + suffix, previous + suffix); movedSidecars.push(suffix); }
    catch (error) { if (error?.code !== "ENOENT") throw error; }
  }
  await rename(temporary, live);
} catch (error) {
  try { await stat(previous); await rename(previous, live); } catch {}
  for (const suffix of movedSidecars) { try { await rename(previous + suffix, live + suffix); } catch {} }
  const { rm } = await import("node:fs/promises");
  await rm(temporary, { force: true });
  throw error;
}
console.log(`Restored and verified ${live}`);
console.log(`Previous database preserved at ${previous}`);
