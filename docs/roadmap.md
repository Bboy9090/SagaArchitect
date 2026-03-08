# LoreEngine + MythLoreBuilder — Product Roadmap

## Vision

Build a **creative platform** where creators construct fictional universes once and generate stories, games, comics, and scripts across multiple mediums without contradictions.

```
LoreEngine (canonical brain)
   │
   ├── MythLoreBuilder / SagaArchitect  →  universe building
   ├── Rainstorms                        →  books / children's stories
   ├── StoryMap                          →  plot visualization (planned)
   └── GameLore                          →  game narrative design (planned)
```

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

## Phase 2 — MythLoreBuilder / SagaArchitect ✅ Complete

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

## Phase 3 — Rainstorms Integration 🔄 In Progress

**Goal**: Rainstorms reads from LoreEngine to generate canon-consistent stories.

- [x] `POST /api/lore-engine/canon-block` — primary sync endpoint
- [x] `POST /api/universes/{id}/story-context` — story-context endpoint
- [x] Story Forge within SagaArchitect (generate stories from any universe)
- [x] Export Canon Block button (copies canon JSON for external tools)
- [ ] Rainstorms UI integration (happens in Rainstorms repo)
- [ ] Universe selector in Rainstorms
- [ ] Auto-pull canon on story generation in Rainstorms

Story formats supported:
- [x] opening_chapter
- [x] short_story
- [x] scene
- [x] book_outline
- [x] children_book

---

## Phase 4 — Extended Fields & Canon Validation 🔄 In Progress

**Goal**: Richer data models, sharper conflict detection.

- [x] Character: `appearance`, `speech_style`
- [x] Faction: `symbol`
- [x] TimelineEvent: `hidden_truths`
- [x] StoryArc: `turning_points`, `canon_status`
- [x] Conflict: dead characters in multiple events
- [x] Conflict: faction ally/enemy asymmetry
- [x] Conflict: magic rule violation hints
- [ ] Conflict: timeline chronological order verification
- [ ] Conflict: character age/era consistency checks
- [ ] Conflict: location control changes over time

---

## Phase 5 — StoryMap (Planned)

**Goal**: Visual plot map. See your universe as a connected graph instead of a list.

Planned visualizations:
- [ ] Character arc lines through the timeline
- [ ] Faction relationship graph (ally/enemy network)
- [ ] Location map with faction control
- [ ] Event chains with cause-and-effect arrows
- [ ] Prophecy hook tracking

API reads from: `timeline_events`, `story_arcs`, `characters`, `factions`, `locations`

---

## Phase 6 — GameLore (Planned)

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
- Current: `localStorage` (MVP, no backend required)
- Planned: MongoDB collections matching the schema in `docs/architecture.md`
- Migration: Only `src/lib/storage.ts` changes — all CanonBlock contracts stay the same

### Authentication
- Current: None (single-user localStorage)
- Planned: JWT auth with `user_id` scoping on all collections

### Export Features
- [ ] Export universe as PDF (formatted universe bible)
- [ ] Universe cloning
- [ ] Character relationship graphs
- [ ] Timeline visualization (SVG/canvas)

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
