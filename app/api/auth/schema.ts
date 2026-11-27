// SQLite schema for the app's persistent backend data.
export const databaseSchema = `
  PRAGMA busy_timeout=5000;
  PRAGMA journal_mode=WAL;
  PRAGMA synchronous=FULL;
  PRAGMA foreign_keys=ON;

  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS auth_rate_limits (key_hash TEXT PRIMARY KEY, window_started_at INTEGER NOT NULL, attempts INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY, workspace_id TEXT, actor_id TEXT, action TEXT NOT NULL,
    resource_type TEXT NOT NULL, resource_id TEXT, created_at TEXT NOT NULL, metadata TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS verification_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS password_reset_tokens (token TEXT PRIMARY KEY, user_id TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workspace_memberships (
    workspace_id TEXT NOT NULL, user_id TEXT NOT NULL, role TEXT NOT NULL, payload TEXT NOT NULL,
    PRIMARY KEY (workspace_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS workspace_invitations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, email TEXT NOT NULL, expires_at TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS workspace_groups (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, name TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS templates (id INTEGER PRIMARY KEY, owner TEXT NOT NULL, access TEXT NOT NULL, title TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS analyses (id TEXT PRIMARY KEY, owner TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, owner TEXT NOT NULL, workspace_id TEXT, title TEXT NOT NULL,
    updated_at TEXT NOT NULL, deleted_at TEXT, payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, workspace_id TEXT, requested_by TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS activity_log (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, payload TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS history_trash (id INTEGER PRIMARY KEY AUTOINCREMENT, owner TEXT NOT NULL, payload TEXT NOT NULL);

  CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_documents_owner_updated ON documents(owner, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_documents_workspace_updated ON documents(workspace_id, updated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_activity_owner ON activity_log(owner, id DESC);
  CREATE INDEX IF NOT EXISTS idx_analyses_owner ON analyses(owner);
`;
