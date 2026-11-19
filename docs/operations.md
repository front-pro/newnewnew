# Backend operations

## Runtime

- Node.js 22.5 or newer is required because the data store uses the built-in `node:sqlite` driver.
- `KT_AGENT_DATA_DIR` selects the private data directory. The default is `.data/`.
- The runtime database is `agent.sqlite`. On first startup, an existing `agent.json` is imported once and retained as a legacy copy. Keep a separate backup before moving a production data directory.
- `npm run build` creates the production build. It uses webpack because the current Turbopack CSS worker fails during production builds in this environment.

## Production environment

- `KT_AGENT_DATA_DIR`: persistent writable storage location; do not place it in an ephemeral deployment directory.
- `KT_BOOTSTRAP_ADMIN_EMAIL` and `KT_BOOTSTRAP_ADMIN_PASSWORD`: create the first admin when initializing a new database. Use a unique strong password and remove the secret from the runtime environment after provisioning.
- `KT_EMAIL_DELIVERY_URL` and `KT_EMAIL_DELIVERY_TOKEN`: HTTPS JSON endpoint and bearer token for verification and password-reset emails. The endpoint receives `{ "to", "subject", "text" }` and must return a successful HTTP status only after accepting delivery.
- `KT_PLATFORM_OPERATOR_EMAILS`: comma-separated addresses that receive the separate platform-operator flag.
- `KT_EMAIL_DEV_TOKENS=1`: test-only switch that returns email tokens in API responses. Never enable it in a public production environment.

Registration and password reset return `503` in production if email delivery is not configured. Local development can complete those flows by entering the development token returned by the API.

## Backup and restore

Create a consistent SQLite backup while the application may be running:

```powershell
node scripts/backup-store.mjs C:\secure-backups\agent-2026-11-09.sqlite
```

The backup command uses SQLite `VACUUM INTO`, validates database integrity and application state, and refuses to overwrite a destination file. Store the result outside the application directory with restricted access.

Restore only during a maintenance window with the app stopped:

```powershell
node scripts/restore-store.mjs C:\secure-backups\agent-2026-11-09.sqlite --apply
```

Restore validates the backup before replacing the live database and retains the previous database and SQLite sidecars beside it as a rollback copy. Do not start another app process during restore.

## Email provider contract

The provider endpoint must accept an authenticated `POST` with JSON content type and the email payload above. Keep its token in the server environment only. Verification codes expire after 24 hours and are single-use. Password-reset codes expire after one hour and revoke all existing sessions when consumed.
