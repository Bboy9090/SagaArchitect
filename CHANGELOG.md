# Changelog

All notable changes to the Phoenix Creator Studio codebase are documented in this file.

## [1.1.0] - Phase 2A: Database Foundation - 2026-06-20

### Added
- **Drizzle ORM & PostgreSQL Configuration**: Installed `drizzle-orm`, `postgres` and `drizzle-kit` dependencies. Configured migrations pathways and local/production PostgreSQL connections inside `drizzle.config.ts` and `src/db/index.ts`.
- **Relational Schema Definitions**: Created complete schema structures in `src/db/schema.ts` defining:
  - Auth.js compatibility tables: `users`, `accounts`, `sessions`, and `verification_tokens`.
  - Core lore assets: `projects` (replacing universes), `characters`, `factions`, `locations`, `timeline_events`, `story_arcs`, and `lore_rules`.
  - Production workflows: `generated_stories`, `scenes`, `storyboard_panels`, `assets` (including file size, type, provider, and timestamps), and `version_history`.
- **Database Connection Gracefulness**: Structured connection loaders that log warnings and fail gracefully without crashing when `DATABASE_URL` is omitted.
- **Database Health Check Endpoint**: Developed a live connection validation route `GET /api/health/db` executing clean database connection queries (`SELECT 1`).
- **Database Migration Scripts**: Integrated npm script commands: `db:generate`, `db:migrate`, `db:push`, and `db:studio`.

### Changed
- **Linter & React 19 Cleanup**: Cleaned up pre-existing synchronous cascading state updates in `useEffect` across all story, arcs, characters, factions, and timeline pages.

### Verified
- Generated schema migration files cleanly using Drizzle Kit.
- Built Next.js static pages with Turbopack.
- Passed all linter checks and verified 20/20 test completions in the healthcheck suite.

## [1.0.0] - Phase 1 - 2026-06-19

### Added
- **Scene Entity & Page**: Added a `Scene` model (`src/lib/types.ts`) and created a dedicated Scenes manager interface (`src/app/universe/[id]/scenes/page.tsx`) with full CRUD support, sorting/ordering, and canon status categorization.
- **Storyboard Entity & Page**: Added a `StoryboardPanel` model (`src/lib/types.ts`) and developed the Storyboard Studio (`src/app/universe/[id]/storyboard/page.tsx`). Includes:
  - Dual-column selector showing all active scene beats.
  - Interactive HTML5 canvas drawing pad for sketching panels.
  - Built-in Mock AI Sketch Generator rendering vector guidelines on canvas based on camera shot selections.
  - CRUD for panel number, shot selection (建立 established camera vocabulary like Establish, Close-Up, Wide, etc.), visual prompts, and dialog notes.
- **PDF/Print Exporter Module**: Implemented a standalone document compiler (`src/lib/pdf-exporter.ts`) exporting clean HTML styled with media print overrides for high-fidelity PDF packet exports.
- **Export Control Center Page**: Created `/universe/[id]/export/page.tsx` showing project data outlines, outline page mappings, and buttons triggering native PDF print dialogs or downloading JSON backups.

### Changed
- **Rebranded UI & Metadata**: Updated headers, layouts, sidebars, titles, and config files to **Phoenix Creator Studio** and **Project** vocabulary. Exposes "Project" in the UI while preserving internal "Universe" structures.
- **Package Identifiers**: Changed npm namespace to `phoenix-creator-studio` in `package.json` and package ID to `com.bobbysworld.phoenixcreatorstudio` in `app.metadata.json`.
- **Database Namespace Expansion**: Upgraded the client storage adapter (`src/lib/storage.ts`) to use `phoenix_*` keys. Added a safe, non-destructive migration helper that transparently copies legacy `saga_*` records if new keys are empty.

### Verified
- Built and compiled the application cleanly.
- Resolved ESLint warnings and React 19 cascading state render errors.
- Verified 20/20 test passes in the updated automated healthcheck suite (`scripts/healthcheck.sh`).
