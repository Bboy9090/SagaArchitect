# LoreEngine Architecture

## Overview

LoreEngine is the shared canonical brain that powers multiple creative tools. It stores, validates, and exposes universe lore so every tool in the ecosystem generates content that stays consistent with canon.

```
                    LoreEngine
             (canon memory + AI context)

             /            |             \           \
      SagaArchitect   Rainstorms     StoryMap    GameLore
    (universe builder) (stories)  (plot visual)  (game lore)
    writes canon      reads canon   reads canon   reads canon
```

**SagaArchitect** builds the universe — factions, characters, timelines, arcs, lore rules.  
**Rainstorms** consumes the canon to generate stories, books, and other written output.  
**StoryMap** *(future)* visualizes character arcs, faction conflicts, and timeline relationships.  
**GameLore** *(future)* generates quests, NPC backstories, and world lore for game designers.

The core insight: **one universe, many outputs**. A creator builds their world once and produces books, games, comics, and films from the same canon without contradictions.

---

## The Canon Block

The **CanonBlock** is the fundamental data structure of LoreEngine. It is a structured snapshot of everything known about a universe at a point in time.

Every AI generation request includes the full CanonBlock as context. This is what prevents contradictions — the AI knows the world's rules, timeline, characters, and factions before generating anything new.

### Structure

```typescript
interface CanonBlock {
  universe: {
    id, name, genre, tone, era,
    tech_level, magic_system,
    world_overview, creation_myth,
    themes[], current_conflict, prophecy_hooks[]
  };
  factions: Array<{
    name, type, ideology, leader,
    objective, territory, allies[], enemies[], canon_status
  }>;
  characters: Array<{
    name, title, role, faction_id,
    motivations, powers, weaknesses,
    status, arc_potential, canon_status
  }>;
  locations: Array<{
    name, type, region, description,
    strategic_value, mythic_importance, canon_status
  }>;
  timeline: Array<{
    title, era_marker, summary,
    consequences, canon_status
  }>;
  lore_rules: Array<{
    category, title, description, applies_to[]
  }>;
  story_arcs: Array<{
    title, type, summary
  }>;
  generated_at: string;
}
```

### Canon Status

Every lore entity carries a `canon_status` field:

| Status | Meaning |
|--------|---------|
| `canon` | Confirmed, active lore — AI must not contradict this |
| `draft` | In progress — AI uses as context but treats as flexible |
| `alternate` | An alternate timeline variant |
| `deprecated` | Retired from active canon |
| `mystery` | Intentionally unknown — AI should treat as ambiguous |

---

## API Endpoints

### LoreEngine Core

#### `POST /api/lore-engine/canon-block`

The primary cross-app endpoint. Accepts raw universe data and returns a structured CanonBlock, a pre-formatted prompt context string, and richness statistics.

**Used by**: Rainstorms, StoryMap, GameLore, any external tool

**Request body**:
```json
{
  "universe": { "id": "...", "name": "The Ashen Veil", ... },
  "factions": [...],
  "characters": [...],
  "locations": [...],
  "timeline": [...],
  "lore_rules": [...],
  "story_arcs": [...]
}
```

**Response**:
```json
{
  "canonBlock": { ... },
  "promptContext": "=== LORE ENGINE CANON CONTEXT ===\n...",
  "stats": {
    "factions": 5,
    "characters": 8,
    "richness": "rich"
  }
}
```

**`GET /api/lore-engine/canon-block`** returns API documentation.

---

### AI Generation (all canon-aware)

All generation endpoints accept an optional full canon payload. When provided, `formatCanonBlockAsPrompt()` injects the canon context into the AI prompt so generated content stays consistent.

| Endpoint | Generates | Canon-aware |
|----------|-----------|-------------|
| `POST /api/generate/universe` | World overview, myth, themes | ✓ |
| `POST /api/generate/factions` | Faction list | ✓ |
| `POST /api/generate/characters` | Character list | ✓ |
| `POST /api/generate/locations` | Location list | ✓ |
| `POST /api/generate/timeline` | Timeline events | ✓ |
| `POST /api/generate/arc` | Story arc | ✓ |
| `POST /api/generate/story` | Full story / chapter / outline | ✓ |

All endpoints have mock fallbacks when `OPENAI_API_KEY` is absent.

---

## Data Models

### Core entities (per universe)

```
universes
  └─ factions
  └─ characters
  └─ locations
  └─ timeline_events
  └─ story_arcs
  └─ lore_rules
  └─ generated_stories   ← output of Story Forge
  └─ media_projects      ← book, game, comic, film projects
```

### Media Projects

A `MediaProject` links a creative output (book, game, comic, film) to its source universe. One universe can spawn many projects.

```typescript
interface MediaProject {
  id: string;
  universe_id: string;
  type: 'book' | 'children_book' | 'game' | 'comic' | 'film' | 'short_story' | 'script';
  title: string;
  summary: string;
  status: 'concept' | 'in_progress' | 'complete';
  featured_characters: string[];
  featured_factions: string[];
  created_at: string;
  updated_at: string;
}
```

---

## LoreEngine Library (`src/lib/lore-engine.ts`)

Core functions (pure, no I/O, safe on both client and server):

### `buildCanonBlock(input: CanonBlockInput): CanonBlock`

Builds a structured CanonBlock from raw entity data. Pure function — no side effects.

### `formatCanonBlockAsPrompt(block: CanonBlock): string`

Formats a CanonBlock as a structured text block for AI prompt injection. This is the "memory" that keeps AI generation consistent.

### `getCanonBlockStats(block: CanonBlock): CanonStats`

Returns counts of all entities plus a `richness` score:
- `empty` — no lore loaded
- `sparse` — less than 5 total entities
- `moderate` — 5–14 entities
- `rich` — 15–29 entities
- `complete` — 30+ entities

---

## Rainstorms Integration

Rainstorms (the story/book creation tool) connects to LoreEngine like this:

```
1. User selects a universe in Rainstorms
2. Rainstorms calls POST /api/lore-engine/canon-block
   with all universe entities as the body
3. LoreEngine returns { canonBlock, promptContext, stats }
4. Rainstorms injects promptContext into every story generation prompt
5. Generated stories reference real characters, factions, locations
6. No contradictions — stories stay canon-consistent
```

Example creator workflow:
```
SagaArchitect → build universe "The Ashen Veil"
    → generate: 5 factions, 8 characters, 8 locations, 10 timeline events

Rainstorms → select universe "The Ashen Veil"
    → LoreEngine pulls canon block
    → generate: "Kael and the Storm Dragon" (opening chapter)
    → generated chapter references Iron Empire, Ember Citadel, Kael
    → no contradictions because all facts came from canon
```

---

## Story Forge (in SagaArchitect)

The **Story Forge** page (`/universe/[id]/stories`) lets creators generate stories directly from their universe without switching to Rainstorms. It uses the same `POST /api/generate/story` endpoint with the full canon payload.

Supported formats:
- **Opening Chapter** — first chapter of a novel
- **Short Story** — complete, self-contained story
- **Scene** — single powerful moment
- **Book Outline** — full structural outline with chapter breakdown
- **Children's Book** — complete picture book text

---

## Future Tools

### StoryMap (planned)

Visualizes the universe as a connected graph:
- Character arcs as lines through the timeline
- Faction conflicts as relationship edges
- Location importance as node size
- Event chains with cause-and-effect arrows

Reads from: `timeline_events`, `story_arcs`, `characters`, `factions`

### GameLore (planned)

Generates game design assets from universe data:
- Quest chains derived from timeline events
- NPC backstories from character profiles
- Faction conflict trees from faction relationships
- World lore documents from universe overview + lore rules

Reads from: all collections. Writes to: `media_projects` with type `game`.

---

## Current Storage

SagaArchitect v1 uses `localStorage` for all persistence. This is intentional for the MVP — no backend required.

When a real backend is added, the same `CanonBlock` structure and all API contracts remain unchanged. Only the storage layer (`src/lib/storage.ts`) needs updating.

Planned collections for a MongoDB backend:
```
universes
factions
characters
locations
timeline_events
story_arcs
lore_rules
generated_stories
media_projects
```

---

## Canon Validator (Lore Memory)

The **Lore Memory** screen (`/universe/[id]/lore`) runs a `detectConflicts()` function that checks for:

1. **Contradictions** — duplicate lore rule titles with different meanings
2. **Missing links** — characters with no faction in a faction-heavy world
3. **Orphaned content** — story arcs with no matching characters
4. **Mysteries** — unresolved prophecy hooks with no arc connection

These are surfaced as `LoreConflictEntry` objects with severity ratings (`low`, `medium`, `high`). High-severity conflicts appear prominently — they represent real canon breaks that would create reader confusion.

---

## Adding a New Tool to the Ecosystem

To add a new tool that consumes LoreEngine:

1. Call `POST /api/lore-engine/canon-block` with the universe data
2. Use the returned `promptContext` string as a system message in every AI generation prompt
3. Respect `canon_status` values — only use `canon` entries as hard constraints
4. Write back any new entities via SagaArchitect's UI (or direct API calls in the future)

The LoreEngine contract is stable. New tools don't require changes to the core engine.
