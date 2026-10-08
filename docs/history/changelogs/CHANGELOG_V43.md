# V43 — Durability & Production Operations

- PostgreSQL mutations now await persistence before returning success.
- Persistence failures are retained and exposed through `/api/health`.
- Added graceful shutdown for SIGTERM/SIGINT and PostgreSQL pool closure.
- Added durability regression tests.
- Existing security, migrations, backup/restore and curriculum features remain unchanged.
