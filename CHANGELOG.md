# Changelog

All notable changes to the Phoenix Creator Studio codebase are documented in this file.

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
