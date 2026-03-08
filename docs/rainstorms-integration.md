# Rainstorms ↔ SagaArchitect Integration Guide

## How It Works

SagaArchitect (MythLoreBuilder) is the **canon writer** — creators build universes here.  
Rainstorms is the **canon consumer** — it generates stories using the lore that was built.

The bridge is **LoreEngine**, a shared API layer.

```
User builds universe in SagaArchitect
            ↓
  [🌧 Sync to Rainstorms button]
  Translates field names, POSTs data to Rainstorms
            ↓
  Rainstorms creates the universe in its MongoDB
            ↓
  GET /api/universes/{id}/story-context (from Rainstorms)
  Returns universe_tone, world_rules, characters, factions, etc.
            ↓
  Rainstorms injects context into AI generation prompts
            ↓
  Generated stories are canon-consistent with SagaArchitect universe
```

---

## Field Mapping: SagaArchitect → Rainstorms

The two systems were built from the same spec but with slightly different field names.
The `src/lib/rainstorms.ts` helper handles all translations automatically.

### Universe model

| SagaArchitect field | Rainstorms field | Notes |
|---|---|---|
| `tech_level: string` | `technology_level: string` | Renamed |
| `themes: string[]` | `core_theme: string` | Array joined with `", "` |
| `name` | `name` | ✅ Same |
| `genre` | `genre` | ✅ Same |
| `tone` | `tone` | ✅ Same |
| `concept` | `concept` | ✅ Same |
| `magic_system` | `magic_system` | ✅ Same |
| `era` | `era` | ✅ Same |
| `world_overview` | `world_overview` | ✅ Same |
| `creation_myth` | `creation_myth` | ✅ Same |
| `current_conflict` | `current_conflict` | ✅ Same |
| `prophecy_hooks: string[]` | `prophecy_hooks: string[]` | ✅ Same |

### story-context response

Both field names are returned from SagaArchitect so Rainstorms can use either:

| SagaArchitect field | Rainstorms expects | Notes |
|---|---|---|
| `tone: string` | `universe_tone: string` | Both returned |
| `tech_level: string` | `technology_level: string` | Both returned |
| `themes: string[]` | `core_theme: string` | Both returned |
| `timeline_context_text: string` | `timeline_context: string[]` | Both returned; array version = `timeline_context` |
| `world_rules: string[]` | `world_rules: string[]` | ✅ Same |
| `relevant_characters: object[]` | `relevant_characters: object[]` | ✅ Same |
| `relevant_factions: object[]` | `relevant_factions: object[]` | ✅ Same |
| `relevant_locations: object[]` | `relevant_locations: object[]` | ✅ Same |

---

## Integration Methods

### Method 1: Sync to Rainstorms button (recommended)

In SagaArchitect, open any universe's Canon Core page and click **🌧 Sync to Rainstorms**.

1. Enter the Rainstorms base URL (e.g. `http://localhost:8001`)
2. Click **Test** to verify connectivity
3. Click **Sync Universe to Rainstorms**

This will:
- Map field names (`tech_level → technology_level`, `themes[] → core_theme`)
- POST to `POST /api/lore/sync` (full sync endpoint including all entities)
- Fall back to `POST /api/universes` if `/api/lore/sync` is not found

### Method 2: Export Canon JSON

Click **⚡ Export Canon** on the Canon Core page. This copies raw `CanonBlockInput` JSON to clipboard:

```json
{
  "universe": { "id": "...", "name": "...", "tech_level": "Medieval", "themes": ["..."], ... },
  "factions": [...],
  "characters": [...],
  "locations": [...],
  "timeline": [...],
  "lore_rules": [...],
  "story_arcs": [...]
}
```

Then in Rainstorms: paste and POST to `/api/lore-engine/canon-block` (on SagaArchitect) or `/api/lore/sync` (on Rainstorms).

### Method 3: Direct API call from Rainstorms

Rainstorms can call SagaArchitect's API directly (CORS is configured):

```typescript
// Rainstorms calls SagaArchitect to get story context
const res = await fetch(`https://sagaarchitect.app/api/universes/${universeId}/story-context`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(canonBlockInputPayload), // exported from SagaArchitect
});
const ctx = await res.json();

// ctx.universe_tone  (Rainstorms field name) ✅
// ctx.timeline_context (string[])             ✅
// ctx.world_rules (string[])                  ✅
// ctx.relevant_characters                     ✅
// ctx.technology_level                        ✅
// ctx.core_theme                              ✅
// ctx.prompt_context (pre-formatted string)  ← inject directly into AI prompt
```

---

## Rainstorms `POST /api/lore/sync` Endpoint

The cleanest integration point. SagaArchitect posts a full universe payload and Rainstorms creates/updates everything in MongoDB.

**SagaArchitect sends:**

```json
{
  "universe": {
    "name": "The Ashen Veil",
    "genre": "Fantasy",
    "tone": "Dark",
    "concept": "...",
    "technology_level": "Medieval",
    "magic_system": "Veilweaving",
    "era": "Age of Ash",
    "core_theme": "The price of memory, Power born from forgetting",
    "world_overview": "...",
    "creation_myth": "...",
    "current_conflict": "...",
    "prophecy_hooks": ["..."]
  },
  "factions": [ ... ],
  "characters": [ ... ],
  "locations": [ ... ],
  "timeline": [ ... ],
  "story_arcs": [ ... ],
  "lore_rules": [ ... ]
}
```

**Rainstorms responds:**

```json
{
  "universe_id": "abc123",
  "message": "Universe synced successfully"
}
```

---

## Rainstorms `/api/universes/{id}/story-context` Response

When Rainstorms generates a story it calls its own internal endpoint. The fields map to what SagaArchitect produces:

```json
{
  "universe_tone": "Dark",
  "world_rules": ["[Magic System] Veilweaving Costs Memory: ..."],
  "relevant_characters": [{ "name": "Kael", "role": "hero", ... }],
  "relevant_factions": [{ "name": "The Veil Wardens", "type": "Order", ... }],
  "relevant_locations": [{ "name": "The Pale Library", ... }],
  "timeline_context": ["[Year 0] The Veilbreak: ...", "[Year 50] ..."]
}
```

---

## CORS

All LoreEngine endpoints on SagaArchitect respond with `Access-Control-Allow-Origin: *` and handle OPTIONS preflight. Rainstorms can call them from any origin.

The Rainstorms FastAPI backend must also configure CORS to allow the SagaArchitect origin. Add to the Rainstorms `server.py`:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to specific SagaArchitect URL in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

## Environment Variables

### SagaArchitect (this app)

Copy `.env.example` to `.env.local` and fill in:

```
OPENAI_API_KEY=sk-...           # required for real AI generation
RAINSTORMS_BASE_URL=http://localhost:8001  # for the Sync to Rainstorms button
```

### Rainstorms backend

Set `SAGA_ARCHITECT_BASE_URL` so Rainstorms knows where to call SagaArchitect:

```
SAGA_ARCHITECT_BASE_URL=https://your-sagaarchitect.vercel.app
# or for local dev:
SAGA_ARCHITECT_BASE_URL=http://localhost:3000
```

Then in Rainstorms backend code, read it:

```python
import os
SAGA_ARCHITECT_BASE_URL = os.getenv("SAGA_ARCHITECT_BASE_URL", "http://localhost:3000")
```

---

## Demo Universe

The **Ashen Veil** (`demo-ashen-veil-001`) is pre-loaded in SagaArchitect and accessible
via `GET /api/universes/demo-ashen-veil-001/story-context` with **no payload required**.
Use this to test the integration without any sync step.

Old Sync-to-Rainstorms flow:
1. SagaArchitect → Dashboard → **🌑 Load Demo: The Ashen Veil**
2. Universe Canon Core → **🌧 Sync to Rainstorms**
3. Enter Rainstorms URL → **Test** → **Sync**
4. Rainstorms now has The Ashen Veil in its MongoDB

New pull-from-SagaArchitect flow (recommended):
1. Set `SAGA_ARCHITECT_BASE_URL` in Rainstorms
2. Call `GET {SAGA_ARCHITECT_BASE_URL}/api/universes/demo-ashen-veil-001/story-context`
3. Inject `prompt_context` into every generation prompt — no sync step needed

---

## TypeScript helper (`src/lib/rainstorms.ts`)

```typescript
import {
  buildRainstormsSyncPayload,
  syncToRainstorms,
  pingRainstorms,
  fetchStoryContextFromSagaArchitect,
} from '@/lib/rainstorms';

// ── Rainstorms pulling FROM SagaArchitect (recommended for MVP) ──────────────
// Configure SAGA_ARCHITECT_BASE_URL in the Rainstorms backend environment.
const sagaBaseUrl = process.env.SAGA_ARCHITECT_BASE_URL;

// Fetch canon memory for the selected universe
const ctx = await fetchStoryContextFromSagaArchitect(sagaBaseUrl, universeId);
// ctx.prompt_context → inject directly into AI system message
// ctx.world_rules    → individual rule strings if needed
// ctx.stats.richness → warn user if 'empty' or 'sparse'

// ── SagaArchitect pushing TO Rainstorms (optional sync flow) ─────────────────
const payload = buildRainstormsSyncPayload(
  universe,     // SagaArchitect Universe (tech_level, themes[])
  factions,     // Faction[]
  characters,   // Character[]
  locations,    // Location[]
  timeline,     // TimelineEvent[]
  story_arcs,   // StoryArc[]
  lore_rules,   // LoreRule[]
);
// payload.universe.technology_level ← mapped automatically
// payload.universe.core_theme       ← mapped automatically

// Test connectivity to Rainstorms
const ping = await pingRainstorms('http://localhost:8001');
// { reachable: true, detail: 'Rainstorms universes endpoint responded.' }

// Sync universe from SagaArchitect into Rainstorms
const result = await syncToRainstorms('http://localhost:8001', payload);
// { success: true, universe_id: 'abc123', message: 'Universe synced...' }
```


---

## Endpoints

Base URL: `https://your-sagaarchitect-deployment.vercel.app`

All endpoints support **CORS** — Rainstorms can call them directly from the browser.

### 0. GET `/api/universes`

Lists available universes. Returns the demo/seed universes that are accessible via the
server-side API (see localStorage note below).

**Response:**

```json
{
  "universes": [
    {
      "id": "demo-ashen-veil-001",
      "name": "The Ashen Veil",
      "genre": "Fantasy",
      "tone": "Dark",
      "era": "Age of Ash — Post-Veilbreak",
      "concept": "An ancient empire fell when the sky split open...",
      "created_at": "2024-01-01T00:00:00.000Z",
      "updated_at": "2024-01-01T00:00:00.000Z",
      "universe_url": "/api/universes/demo-ashen-veil-001",
      "story_context_url": "/api/universes/demo-ashen-veil-001/story-context"
    }
  ],
  "total": 1,
  "demo_universe_id": "demo-ashen-veil-001",
  "note": "SagaArchitect stores user-created universes in browser localStorage..."
}
```

---

### 0b. GET `/api/universes/{id}`

Returns the full `CanonBlockInput` for a universe — identical to the JSON exported by
the "⚡ Export Canon" button. This is the raw, unprocessed payload that both
`/api/lore-engine/canon-block` and `/api/universes/{id}/story-context` (POST) accept.

For the demo universe (`demo-ashen-veil-001`) real data is returned. For user-created
universes the server returns 404 with instructions (localStorage constraint).

**Response (demo universe):**

```json
{
  "universe": { "id": "demo-ashen-veil-001", "name": "The Ashen Veil", ... },
  "factions": [ ... ],
  "characters": [ ... ],
  "locations": [ ... ],
  "timeline": [ ... ],
  "lore_rules": [ ... ],
  "story_arcs": [ ... ],
  "story_context_url": "/api/universes/demo-ashen-veil-001/story-context",
  "canon_block_url": "/api/lore-engine/canon-block"
}
```

---

### 1. POST `/api/lore-engine/canon-block`

The primary sync endpoint. Send universe data, receive a structured context block.

**Request body** (the JSON from the Export Canon button):

```json
{
  "universe": {
    "id": "demo-ashen-veil-001",
    "name": "The Ashen Veil",
    "concept": "An ancient empire fell when the sky split open...",
    "genre": "Fantasy",
    "tone": "Dark",
    "era": "Age of Ash — Post-Veilbreak",
    "tech_level": "Medieval",
    "magic_system": "Veilweaving — drawing on the torn fabric of the sky...",
    "world_overview": "The world of Ashenmere was once unified...",
    "creation_myth": "In the beginning, there was only the Veil...",
    "themes": ["The price of memory", "Power born from forgetting"],
    "current_conflict": "The Shattered Crown has obtained a complete Solarian Loom...",
    "prophecy_hooks": ["The Unnamed's heir shall either seal the Veil or unravel it..."],
    "created_at": "2024-01-01T00:00:00.000Z",
    "updated_at": "2024-01-01T00:00:00.000Z"
  },
  "factions": [ /* Faction[] */ ],
  "characters": [ /* Character[] */ ],
  "locations": [ /* Location[] */ ],
  "timeline": [ /* TimelineEvent[] */ ],
  "lore_rules": [ /* LoreRule[] */ ],
  "story_arcs": [ /* StoryArc[] */ ]
}
```

**Response:**

```json
{
  "canonBlock": {
    "universe": { "id": "...", "name": "The Ashen Veil", "genre": "Fantasy", "tone": "Dark", "..." },
    "factions": [ { "name": "The Veil Wardens", "type": "Order / Military Brotherhood", "..." } ],
    "characters": [ { "name": "Kael Duskmantle", "role": "hero", "status": "alive", "..." } ],
    "locations": [ { "name": "The Pale Library", "type": "Archive", "..." } ],
    "timeline": [ { "title": "The Veilbreak", "era_marker": "Year 0", "..." } ],
    "lore_rules": [ { "category": "Magic System", "title": "Veilweaving Costs Memory", "..." } ],
    "story_arcs": [ { "title": "The Loom Conspiracy", "type": "conspiracy", "..." } ],
    "generated_at": "2026-01-01T00:00:00.000Z"
  },
  "promptContext": "=== LORE ENGINE CANON CONTEXT ===\nUniverse: The Ashen Veil\n...\n=== END CANON CONTEXT ===",
  "stats": {
    "factions": 5,
    "characters": 8,
    "locations": 6,
    "timeline_events": 7,
    "lore_rules": 5,
    "story_arcs": 3,
    "richness": "complete"
  }
}
```

---

### 2. POST `/api/universes/{id}/story-context`

Same functionality, scoped to a specific universe ID. Returns flattened fields optimised for direct story prompt injection.

**URL example:** `POST /api/universes/demo-ashen-veil-001/story-context`

**Request body:** Same shape as `/api/lore-engine/canon-block`

**Response:**

```json
{
  "universe_id": "demo-ashen-veil-001",
  "universe_name": "The Ashen Veil",
  "tone": "Dark",
  "genre": "Fantasy",
  "era": "Age of Ash — Post-Veilbreak",
  "magic_system": "Veilweaving — drawing on the torn fabric of the sky...",
  "tech_level": "Medieval",
  "themes": ["The price of memory", "Power born from forgetting"],
  "current_conflict": "The Shattered Crown has obtained a complete Solarian Loom...",
  "prophecy_hooks": ["The Unnamed's heir shall either seal the Veil or unravel it..."],
  "world_overview": "The world of Ashenmere was once unified...",
  "world_rules": [
    "[Magic System] Veilweaving Costs Memory: Overuse of Veilweaving erases personal memories permanently."
  ],
  "relevant_characters": [
    {
      "name": "Kael Duskmantle",
      "title": "The Unwritten",
      "role": "hero",
      "status": "alive",
      "faction_id": "faction-ashborn-guild",
      "motivations": "Recover the name that was erased from history...",
      "arc_potential": "From nameless ghost to the anchor of a new age..."
    }
  ],
  "relevant_factions": [
    {
      "name": "The Veil Wardens",
      "type": "Order / Military Brotherhood",
      "ideology": "The Veil must be preserved at all costs...",
      "leader": "High Warden Selara Dusk",
      "objective": "Prevent the Shattered Crown from using the Solarian Loom...",
      "territory": "The Ashspine Mountains..."
    }
  ],
  "relevant_locations": [
    {
      "name": "The Pale Library",
      "type": "Archive City",
      "region": "Central Ashenmere",
      "description": "A city-sized archive built on the site of the original Veilbreak..."
    }
  ],
  "timeline_context": "[Year 0] The Veilbreak: The Emperor tears the sky...\n[Year 50] The Founding of the Veil Wardens...",
  "story_arcs": [
    { "title": "The Loom Conspiracy", "type": "conspiracy", "summary": "..." }
  ],
  "prompt_context": "=== LORE ENGINE CANON CONTEXT ===\nUniverse: The Ashen Veil\n...\n=== END CANON CONTEXT ===",
  "stats": { "factions": 5, "characters": 8, "richness": "complete" }
}
```

---

## How Rainstorms Should Use This

> **Source-of-truth rule:** When `lore_universe_id` is provided, Rainstorms must NOT query
> its own local MongoDB lore collections. Instead, call SagaArchitect and use the returned
> `prompt_context` directly. SagaArchitect is the single source of truth for canon data.
> If the remote fetch fails, return an explicit error — never silently generate without lore.

### Step 1 — Configure the SagaArchitect base URL

In your Rainstorms backend environment:

```
SAGA_ARCHITECT_BASE_URL=https://your-sagaarchitect.vercel.app
# local dev: SAGA_ARCHITECT_BASE_URL=http://localhost:3000
```

### Step 2 — Fetch story context using the TypeScript helper

```typescript
import { fetchStoryContextFromSagaArchitect } from '@/lib/rainstorms';
// or copy the function into your Rainstorms backend

const SAGA_BASE_URL = process.env.SAGA_ARCHITECT_BASE_URL;
const universeId = 'demo-ashen-veil-001'; // or user-selected ID

// Fetch canon memory — throws with a clear message if the fetch fails.
// Never silently fall back to generating without lore.
const ctx = await fetchStoryContextFromSagaArchitect(SAGA_BASE_URL, universeId);
// ✅ Logs: [LoreEngine] Fetching story context from SagaArchitect: GET ...
// ✅ Logs: [LoreEngine] Story context loaded — universe: "The Ashen Veil", richness: complete
```

Or call the endpoint directly (equivalent):

```typescript
const BASE_URL = process.env.SAGA_ARCHITECT_BASE_URL;

// GET — demo universe, no body needed (fastest for testing)
const res = await fetch(`${BASE_URL}/api/universes/${universeId}/story-context`);
if (!res.ok) {
  // Never silently fall back — surface the error to the user
  throw new Error(`SagaArchitect returned HTTP ${res.status} for universe "${universeId}"`);
}
const ctx = await res.json();
```

### Step 3 — Inject context into story generation prompt

```typescript
// ctx.prompt_context is a pre-formatted string ready for AI injection.
// Include it as the system message before every story-generation call.

const systemMessage = `You are a children's book writer.
The story must take place in the following universe and stay consistent with all canon rules.

${ctx.prompt_context}

Write age-appropriate content. Keep language simple. Every paragraph should suggest an illustration.`;

const userMessage = `Write a children's book story about ${characterName} in the ${ctx.universe_name} universe.`;

const story = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ],
});
```

### Alternative: lore_universe_id shorthand in `POST /api/generate/story`

Rainstorms can also call SagaArchitect's own story generation endpoint with just the universe ID
(no need to pass the full canon payload separately):

```typescript
const res = await fetch(`${BASE_URL}/api/generate/story`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    lore_universe_id: 'demo-ashen-veil-001',   // ← shorthand: auto-fetches story context
    format: 'short_story',
    focusPrompt: 'Focus on Kael and the Veil Wardens',
  }),
});
const { story } = await res.json();
// story.content contains a fully canon-grounded story
```

Currently supported `lore_universe_id` values: `"demo-ashen-veil-001"` (The Ashen Veil).
For user-created universes, pass the full `CanonBlockInput` body instead.

---

## What the Export Canon Button Produces

In SagaArchitect, the **Export Canon** button (on any universe's Canon Core page) copies the raw payload to clipboard. The shape is exactly what both endpoints above expect:

```json
{
  "universe": { ... },
  "factions": [ ... ],
  "characters": [ ... ],
  "locations": [ ... ],
  "timeline": [ ... ],
  "lore_rules": [ ... ],
  "story_arcs": [ ... ]
}
```

This is called a `CanonBlockInput`. Paste it directly into Rainstorms or POST it to either endpoint.

---

## CORS

All LoreEngine endpoints are configured with `Access-Control-Allow-Origin: *` and handle OPTIONS preflight. Rainstorms can call them from any origin without proxy workarounds.

For production, the SagaArchitect deployment admin can restrict CORS to the specific Rainstorms domain by updating `RAINSTORMS_ORIGIN` in the environment and updating `next.config.ts`.

---

## Richness Levels

The `stats.richness` field tells Rainstorms how much canon data is available:

| Level | Total entities | Meaning |
|---|---|---|
| `empty` | 0 | No lore — generation will be generic |
| `sparse` | 1–4 | Minimal lore — basic canon guidance |
| `moderate` | 5–14 | Moderate lore — good guidance |
| `rich` | 15–29 | Rich lore — strong canon consistency |
| `complete` | 30+ | Complete lore — maximum consistency |

Rainstorms can use this to warn users if they're generating from a sparse universe.

---

## Demo Universe

The **Ashen Veil** universe is pre-loaded in SagaArchitect.

To test the integration:
1. Open SagaArchitect → Dashboard → click "🌑 Load Demo: The Ashen Veil"
2. Go to the universe Canon Core page
3. Click "⚡ Export Canon" — copies the raw payload to clipboard
4. Paste into Rainstorms or POST to `/api/lore-engine/canon-block`
5. Use the returned `promptContext` in your Rainstorms generation prompt

The Ashen Veil has 5 factions, 8 characters, 6 locations, 7 timeline events, 5 lore rules — richness level `complete`. It's the perfect demo universe.

---

## TypeScript Types (for Rainstorms to reference)

The exported payload matches these types from SagaArchitect's `src/lib/types.ts`:

```typescript
interface CanonBlockInput {
  universe: Universe;
  factions?: Faction[];
  characters?: Character[];
  locations?: Location[];
  timeline?: TimelineEvent[];
  lore_rules?: LoreRule[];
  story_arcs?: StoryArc[];
}
```

The full type definitions are in `src/lib/types.ts` in this repository.
