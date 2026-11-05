# Saga Architect — Product Roadmap

## Vision

Build a **creative platform** where creators construct fictional universes once and generate stories, games, comics, and scripts across multiple mediums without contradictions — all within **Bobby's World / Blue Phoenix OS**.

```
LoreEngine (canonical brain)
   │
   ├── Saga Architect                   →  universe building (MVP COMPLETE)
   ├── Rainstorms                        →  books / children's stories
   ├── StoryMap                          →  plot visualization (planned)
   └── GameLore                          →  game narrative design (planned)
```

---

## Current Status: Phoenix Creator Studio Foundation + Canon Platform

**Package ID:** com.bobbysworld.sagaarchitect
**Version:** 0.1.0
**Status:** Active production foundation

The original Saga Architect universe/canon MVP remains intact, but current main has expanded into Phoenix Creator Studio: writing, book production, design, layered image editing, illustration, comics, storyboards, video/shorts, motion comics, audio, asset management, and publishing/export surfaces now share the same project/canon foundation.

### MVP Features Delivered

✅ **Universe Dashboard** - Create, load demo, manage universes
✅ **Character Cards** - Full character profiles with relationships
✅ **Lore/Canon Rule Entries** - Canon rule management with conflict detection
✅ **Timeline Events** - Chronological event tracking with affected entities
✅ **Export Functionality** - JSON export and canon block export
✅ **Faction Management** - Full faction profiles with relationships
✅ **Location Tracking** - Location profiles with strategic/mythic value
✅ **Story Arc Management** - Multi-type story arc system
✅ **AI Generation** - Optional AI-powered generation (with mock fallback)
✅ **Canon Tracking** - 5-tier canon status system (canon/draft/alternate/deprecated/mystery)
✅ **Build/Test Infrastructure** - Lint, build, healthcheck, smoke tests

---

## Phase 1 — LoreEngine Core ✅ Complete

**Goal**: The spine. Build the canonical data model and AI generation layer.

Collections:
- [x] universes
- [x] characters
- [x] factions
- [x] locations
- [x] timeline_events
- [x] story_arcs
- [x] lore_rules
- [x] generated_stories
- [x] media_projects

LoreEngine functions:
- [x] `buildCanonBlock()` — snapshot of all universe data
- [x] `formatCanonBlockAsPrompt()` — formats canon for AI prompt injection
- [x] `getCanonBlockStats()` — entity count + richness score

API endpoints:
- [x] `POST /api/lore-engine/canon-block` — cross-app canon context
- [x] `GET /api/universes/{id}/story-context` — Rainstorms integration
- [x] `POST /api/universes/{id}/story-context` — full context with data

---

## Phase 2 — Saga Architect MVP ✅ Complete (Reforged)

**Goal**: The universe builder. Writers create worlds that LoreEngine stores.

Screens:
- [x] Dashboard — universe list, load demo, create new
- [x] Universe Forge — create/configure universe parameters
- [x] Canon Core — expandable sections for all universe data
- [x] Character Engine — generate + manage characters
- [x] Faction Builder — generate + manage factions
- [x] Timeline Builder — generate + manage historical events
- [x] Arc Generator — generate + manage story arcs
- [x] Lore Memory — world rules, consistency checks, conflict dashboard

AI generation (all canon-aware):
- [x] Universe world overview + creation myth
- [x] Factions with ideologies and relationships
- [x] Characters with arc potential
- [x] Locations with strategic and mythic importance
- [x] Timeline events in chronological order
- [x] Story arcs of multiple types
- [x] Stories / books from canon (Story Forge)

Canon conflict detection:
- [x] Duplicate lore rule titles
- [x] Mystery rules with no resolution
- [x] Deprecated rules in archive
- [x] Characters without timeline context
- [x] Dead characters appearing in multiple timeline events
- [x] Faction ally/enemy asymmetry contradictions
- [x] Magic rule violation hints

Demo universe:
- [x] The Ashen Veil — complete universe with factions, characters, locations, timeline, arcs, lore rules

Data models:
- [x] `Universe` — name, genre, tone, concept, tech_level, magic_system, era, themes, world_overview, creation_myth, current_conflict, prophecy_hooks
- [x] `Character` — name, title, role, motivations, fears, powers, weaknesses, relationships, arc_potential, status, canon_status, **appearance**, **speech_style**
- [x] `Faction` — name, type, ideology, leader, resources, territory, allies, enemies, internal_conflict, objective, canon_status, **symbol**
- [x] `Location` — name, type, region, description, strategic_value, mythic_importance, controlling_faction, canon_status
- [x] `TimelineEvent` — title, era_marker, summary, affected_characters, affected_factions, affected_locations, consequences, **hidden_truths**, canon_status
- [x] `StoryArc` — title, type, summary, start_point, end_point, characters, factions, themes, **turning_points**, **canon_status**
- [x] `LoreRule` — category, title, description, applies_to, canon_status
- [x] `MediaProject` — id, universe_id, type, title, summary, status, featured_characters, featured_factions
- [x] `GeneratedStory` — id, universe_id, title, format, content, featured_characters, featured_factions, featured_locations

---

## Current Product Boundaries

- **Persistence:** Local-first mode remains available, while PostgreSQL Database Mode provides relational persistence plus Studio Cloud autosave for supported media/timeline documents and private project assets.
- **Collaboration:** Authenticated/owned project APIs exist, but real-time multi-user co-editing is not yet a verified release capability.
- **Export:** Canon/project JSON remains available alongside server-rendered PDF/production packets and studio-specific SVG, PNG/JPEG/WebP, CBZ, WebM, and WAV outputs.
- **Video codec boundary:** Browser-native WebM is the verified finished-video export. MP4/H.264 must not be advertised until a verified server/native transcode path lands.
- **Visualization:** Storyboard/comic/design canvases are live; richer graph-style StoryMap/relationship/timeline visualization remains future work.

---

## Next Planned Features (Post-MVP Issues)

### Phase 3 — Rainstorms Integration 🔄 In Progress

**Goal**: Rainstorms reads from LoreEngine to generate canon-consistent stories.

- [x] `POST /api/lore-engine/canon-block` — primary sync endpoint
- [x] `POST /api/universes/{id}/story-context` — story-context endpoint
- [x] Story Forge within Saga Architect (generate stories from any universe)
- [x] Export Canon Block button (copies canon JSON for external tools)
- [x] **Rainstorms UI integration** — Story Bench Idea Lab can load available universes
- [x] **Universe selector in Rainstorms** — selected universe ID is included with generation requests
- [x] **Auto-pull canon on story generation in Rainstorms** — backend resolves the selected universe through SagaArchitect `/story-context` before prompt construction

Story formats supported:
- [x] opening_chapter
- [x] short_story
- [x] scene
- [x] book_outline
- [x] children_book

### Phase 4 — Multiple Timelines & Import

**Goal**: Advanced timeline management and data import.

- [ ] **Multiple timeline support** (alternate timelines, parallel timelines)
- [ ] **Import from external sources** (JSON, CSV, other formats)
- [ ] Timeline chronological order verification
- [ ] Character age/era consistency checks
- [ ] Location control changes over time

### Phase 5 — Collaboration Features

**Goal**: Move from owned cloud projects toward shared, real-time creative collaboration.

- [x] **PostgreSQL + Drizzle backend foundation**
- [x] **Authenticated/owned project API foundation**
- [x] **Studio Cloud persistence for supported creative documents/assets**
- [ ] **Shared-project membership and permissions**
- [ ] **Real-time multi-user collaboration**
- [ ] **Conflict-aware collaborative editing**
- [ ] **Cross-user version/history review**

### Phase 6 — StoryMap (Planned)

**Goal**: Visual plot map. See your universe as a connected graph instead of a list.

Planned visualizations:
- [ ] Character arc lines through the timeline
- [ ] Faction relationship graph (ally/enemy network)
- [ ] Location map with faction control
- [ ] Event chains with cause-and-effect arrows
- [ ] Prophecy hook tracking

API reads from: `timeline_events`, `story_arcs`, `characters`, `factions`, `locations`

### Phase 7 — GameLore (Planned)

**Goal**: Generate game narrative design assets from universe data.

Planned generation:
- [ ] Quest chains from timeline events
- [ ] NPC backstories from character profiles
- [ ] Faction conflict tree from faction relationships
- [ ] World lore documents from universe overview + lore rules
- [ ] Dialogue trees from character speech_style + motivations

Writes to: `media_projects` with type `game`

---

## Technical Debt / Future Improvements

### Storage
- Local-first mode remains supported for lightweight/offline project workflows.
- PostgreSQL + Drizzle Database Mode is implemented for relational project data.
- Supported studios persist media/timeline documents and Asset Library metadata through Studio Cloud APIs in DB mode.
- Remaining work is collaboration semantics, conflict handling, and broader cross-user version history rather than introducing the first backend.

### Authentication
- Current: None (single-user localStorage)
- Planned: JWT auth with `user_id` scoping on all collections

### Export Features
- [x] Server-rendered project/universe PDF production output
- [x] JSON backup/export
- [x] Illustration SVG + PNG/JPEG/WebP
- [x] Comic raster/CBZ output
- [x] Video WebM rendering
- [x] Audio WAV mix rendering
- [ ] Verified MP4/H.264 transcode
- [ ] Universe cloning
- [ ] Character relationship graphs
- [ ] Rich timeline visualization (SVG/canvas)

### Autosave
- [ ] Auto-save all form changes to localStorage with debounce

---

## Target Users

1. **Authors** — build series bibles, track canon across books
2. **Comic creators** — maintain character and faction continuity
3. **Game designers** — generate consistent world lore and NPC backstories
4. **Worldbuilders** — create comprehensive universe documentation
5. **Cinematic universe planners** — manage large-scale franchise canon

---

## Product Promise

> Build your universe. Track your canon. Generate your saga.

One universe → novels, comics, games, scripts, children's books.

All while maintaining consistent canon.
