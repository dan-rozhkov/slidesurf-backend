# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

SlideSurf backend — a Fastify API server that turns a user prompt + optional file attachments into an AI-generated presentation (plan → slides), persists it, and serves the editor/export/payment APIs. ESM + TypeScript. The companion SPA lives in `../slidesurf-frontend`. Default content language is Russian (`ru`).

## Commands
```bash
npm run dev            # vite-node --watch src/index.ts — port 3001, Fastify HMR (swaps app without restart)
npm run build          # vite build → SSR bundle in dist/
npm run start          # node dist/index.js
npm run db:generate    # drizzle-kit generate — create a migration from schema changes
npm run db:migrate     # drizzle-kit migrate — apply migrations
npm run db:seed:models # seed the ai_models table (vite-node src/db/seed-ai-models.ts)
```
Requires `.env` (see `.env.example`) and a running Postgres. There is **no lint script and no test runner** — verify changes with `npx tsc --noEmit`.

## Architecture
- **`src/app.ts`** builds the Fastify instance: registers plugins (order matters — `cors`, `cookie`, `multipart`, `auth`, `error-handler`) then every route plugin. **`src/index.ts`** wraps it in a raw `http.Server`, wires graceful shutdown, and accepts Vite HMR to swap the app in dev.
- **Routes** (`src/routes/*`) are Fastify plugins, one folder per domain (`generate`, `chat`, `presentations`, `plans`, `themes`, `export`, `subscription`, `teams`, `search`, `upload`, `models`, `feedback`, `promo-code`). `routes/v1` is a public/external API surface. Add a route by creating the plugin and registering it in `app.ts`.
- **Auth**: `better-auth` (`src/auth/index.ts`) over Postgres, with Google + Yandex OAuth. Routes protect themselves with `authHook` (`src/hooks/auth-hook.ts`), which resolves a session from a **cookie or `Bearer` token** and sets `request.userId` / `request.session`. `subscriptionHook` (`src/hooks/subscription-hook.ts`) gates AI actions by plan.

### AI generation (the core)
- **`src/services/ai-client.ts`** wraps the Vercel AI SDK (`generateText`/`streamText`) over an OpenAI-compatible **OpenRouter** provider. Model id resolves: request `model` → `OPENROUTER_MODEL` → `openai/gpt-4o-mini`. `OPENROUTER_MODEL_STRONG` is used for the heavier slide-generation pass.
- **Pipeline** (`services/presentation-generation.ts`): **plan** (`plan-generation.ts` → `Section[]`) → **slides** (`slides-generation.ts` → `Slide[]`). Streaming variants (`generatePlanStream` / `generateSlidesStream`) back the SSE endpoints in `routes/generate` and `routes/chat`.
- **Prompts** live in `src/prompts/` (`plan-prompts.ts`, `slide-prompts.ts`). The LLM returns **plain text in a custom format**, parsed in `src/parsers/`:
  - `slide-parser.ts`: slides split on `-----`; fields are `key: value` lines; `content:` starts a multi-line block that runs until an `index:`/`isLoadingLayoutImage:` line.
  - `section-parser.ts`: sections for the plan.
  - **Changing prompt output format and the parser must stay in sync** — they are a tightly coupled pair.
- **Attachments / retrieval** (`src/retrieval/`): uploaded files are read from S3 and extracted to text by type (`processing/{pdf,csv,html,txt}.ts`, plus `mammoth` for docx) via `helpers/read-content.ts`, then injected into prompts.

### Persistence
- Drizzle ORM over Postgres. Schema is **split by domain** under `src/db/schema/` (`auth-schema`, `presentations-schema`, `presentation-plans-schema`, `themes-schema`, `subscriptions-schema`, `teams-schema`, `ai-models-schema`, `logs-schema`, `promo-codes-schema`; `relations.ts` wires cross-table relations; `index.ts` re-exports).
- Migrations live in `src/db/migrations/` — **generate them from schema changes via `db:generate`, never hand-edit**. `drizzle.config.ts` points at `DATABASE_URL`.

### External services (all keyed via env; features no-op without their key)
FAL (`@fal-ai/client`, image generation) · AWS S3 (asset storage, presigned URLs) · YooKassa (`YOUKASSA_*`, payments) · SMTP/nodemailer (`src/email/`) · Unsplash / Freepik / Noun Project (image & icon search, `routes/search`).

## Cross-cutting
- `src/shared/` holds types (`types/generation.ts`) and Zod validators (`validators/generation-schemas.ts`) that mirror the frontend contract (`../slidesurf-frontend/src/types.ts`). When you change a generation request/response shape, update both sides **and** the matching prompt/parser pair.
- Subscription limits are enforced here (`subscription-hook`, `services/subscription-service.ts`, `src/subscription-limits.ts`) and mirrored in the frontend for UI gating.
