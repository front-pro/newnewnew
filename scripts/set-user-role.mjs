import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const [emailArgument, roleArgument] = process.argv.slice(2);
if (!emailArgument || !roleArgument || process.argv.length !== 4) {
  console.error("Usage: node scripts/set-user-role.mjs <email> <user|employee|admin>");
  process.exit(2);
}
const email = emailArgument.trim().toLocaleLowerCase();
const role = roleArgument.trim();
if (!email || !["user", "employee", "admin"].includes(role)) {
  console.error("Email must be non-empty and role must be user, employee, or admin.");
  process.exit(2);
}

const directory = process.env.KT_AGENT_DATA_DIR || path.join(process.cwd(), ".data");
const db = new DatabaseSync(path.join(directory, "agent.sqlite"));
try {
  db.exec("BEGIN IMMEDIATE");
  const row = db.prepare("SELECT payload FROM app_state WHERE id = 1").get();
  if (!row) throw new Error("Application data store is not initialized.");
  const state = JSON.parse(row.payload);
  if (!Array.isArray(state.users)) throw new Error("Application user list is invalid.");
  const matches = state.users.filter(user => typeof user.email === "string" && user.email.trim().toLocaleLowerCase() === email);
  if (matches.length !== 1) throw new Error(`Expected exactly one user matching the email; found ${matches.length}.`);
  const target = matches[0];
  const previousRole = target.role;
  target.role = role;
  if (role !== previousRole) delete target.permissions;
  db.prepare("UPDATE app_state SET payload = ?, updated_at = ? WHERE id = 1").run(JSON.stringify(state), new Date().toISOString());
  db.exec("COMMIT");
  console.log(`Updated ${target.email}: ${previousRole || "user"} -> ${role}. Existing sessions read the current role from the store on each request.`);
} catch (error) {
  db.exec("ROLLBACK");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  db.close();
}
