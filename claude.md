# Otto

Slack bot that syncs task ownership with Asana. TypeScript/Express/PostgreSQL.

## Commands
- `bun dev` - Dev server
- `bun run build` - Compile
- `bun test` - Tests
- `bun run lint` - Lint
- `bun run typecheck` - Type check
- `bun run db:migrate` / `db:seed` - Database

## Structure
- `src/services/` - Business logic (*.service.ts)
- `src/db/repositories/` - Data access (*.repository.ts)
- `src/handlers/` - Event handlers (*.handler.ts)
- `src/integrations/` - Slack, Asana, LLM, Sheets

## Patterns
- Layered: Handlers → Services → Repositories
- Multi-tenant with tenant_id isolation
- Provider pattern for integrations
