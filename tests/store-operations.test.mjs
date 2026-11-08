import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";

test("backup validates a snapshot and restore preserves the replaced database", async () => {
  const directory = await mkdtemp(path.join(process.cwd(), ".tmp-store-operations-"));
  const live = path.join(directory, "agent.sqlite"), backup = path.join(directory, "backup.sqlite");
  try {
    const db = new DatabaseSync(live);
    db.exec("CREATE TABLE app_state (id INTEGER PRIMARY KEY CHECK (id = 1), payload TEXT NOT NULL, updated_at TEXT NOT NULL); INSERT INTO app_state VALUES(1, '{\"value\":1}', '2026-01-01T00:00:00.000Z');");
    db.close();
    const env = { ...process.env, KT_AGENT_DATA_DIR: directory };
    const backedUp = spawnSync(process.execPath, ["scripts/backup-store.mjs", backup], { cwd: process.cwd(), env, encoding: "utf8" });
    assert.equal(backedUp.status, 0, backedUp.stderr);
    const changed = new DatabaseSync(live);
    changed.prepare("UPDATE app_state SET payload = ? WHERE id = 1").run('{"value":2}');
    changed.close();
    const restored = spawnSync(process.execPath, ["scripts/restore-store.mjs", backup, "--apply"], { cwd: process.cwd(), env, encoding: "utf8" });
    assert.equal(restored.status, 0, restored.stderr);
    const current = new DatabaseSync(live, { readOnly: true });
    assert.equal(current.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload, '{"value":1}');
    current.close();
    const previousPath = restored.stdout.match(/Previous database preserved at (.+)\r?\n/)?.[1];
    assert.ok(previousPath);
    await stat(previousPath);
    const previous = new DatabaseSync(previousPath, { readOnly: true });
    assert.equal(previous.prepare("SELECT payload FROM app_state WHERE id = 1").get().payload, '{"value":2}');
    previous.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});
