# Borneo Tracker authentication server

This is the transactional application backend. It stores users, profiles, sessions, one-time tokens, audit events and the email outbox in PostgreSQL. It never reads or writes the indicator pipeline SQLite databases.

## Local startup

From the repository root:

```powershell
docker compose up -d
npm install
npm run db:generate
npm run db:deploy --workspace server
```

Run these in separate terminals:

```powershell
npm run dev:server
npm run dev:worker
npm run dev
```

- Web application: `http://localhost:5173`
- API health: `http://localhost:3001/api/health/ready`
- Mailpit inbox: `http://localhost:8025`
- Project PostgreSQL: `localhost:5433` (the container still uses port 5432 internally)

The committed `server/.env.example` documents every required setting. `server/.env` is local-only and ignored by Git.

## Verification

```powershell
npm run lint
npm run typecheck:server
npm run build:all
npm test
npm run db:check-drift
npm audit --audit-level=high
```

Integration tests use real PostgreSQL and truncate only the application auth tables. Do not point tests at a database containing valuable data.

## Security boundaries

- Authentication uses an opaque random session in an HttpOnly cookie; the database stores only its SHA-256 hash.
- Browser writes require an exact allowed Origin, JSON and a session/pre-auth-bound HMAC CSRF token.
- Passwords use Argon2id. Verification, reset and email-change tokens are random, hashed, expiring and single-use.
- Email work is committed transactionally to an encrypted outbox, then delivered by the separate worker.
- Production provider, domain, recovery and retention choices remain gated by `docs/STAGING_PRODUCTION_DECISIONS.md`.
- The email webhook is intentionally not enabled until the production email provider and its signature protocol are selected.
