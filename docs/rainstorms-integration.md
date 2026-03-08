# Rainstorms ↔ SagaArchitect Integration Guide

## How It Works

SagaArchitect (MythLoreBuilder) is the **canon writer** — creators build universes here.  
Rainstorms is the **canon consumer** — it generates stories using the lore that was built.

The bridge is **LoreEngine**, a shared API layer.

```
User builds universe in SagaArchitect
            ↓
  [Export Canon button]
  Copies CanonBlockInput JSON to clipboard
            ↓
  Rainstorms POSTs that JSON to LoreEngine API
            ↓
  LoreEngine returns { canonBlock, promptContext, stats }
            ↓
  Rainstorms injects promptContext into AI generation prompt
            ↓
  Generated story is canon-consistent with SagaArchitect universe
```

---

## Endpoints

Base URL: `https://your-sagaarchitect-deployment.vercel.app`

Both endpoints support **CORS** — Rainstorms can call them directly from the browser.

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

### Step 1 — User selects a universe in Rainstorms

Show a list of available universes. Either:
- Let user paste exported JSON from SagaArchitect, OR
- Have them enter the SagaArchitect base URL and universe ID

### Step 2 — Fetch story context

```typescript
// Option A: User pasted the exported JSON from the Export Canon button
const exportedPayload = JSON.parse(pastedText); // { universe, factions[], characters[], ... }

const res = await fetch('https://sagaarchitect.app/api/lore-engine/canon-block', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(exportedPayload),
});
const { canonBlock, promptContext, stats } = await res.json();

// Option B: POST to universe-specific endpoint (same data)
const res = await fetch(`https://sagaarchitect.app/api/universes/${universeId}/story-context`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(exportedPayload),
});
const { prompt_context, relevant_characters, world_rules, tone } = await res.json();
```

### Step 3 — Inject context into story generation prompt

```typescript
// The promptContext / prompt_context field is a pre-formatted string.
// Inject it as a system message before the user's story request.

const systemMessage = `You are a children's book writer.
The story must take place in the following universe and stay consistent with all canon rules.

${promptContext}

Write age-appropriate content. Keep language simple. Every paragraph should suggest an illustration.`;

const userMessage = `Write a children's book story about ${characterName} in the ${universeName} universe.`;

// Send to your LLM
const story = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: systemMessage },
    { role: 'user', content: userMessage },
  ],
});
```

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

Both LoreEngine endpoints are configured with `Access-Control-Allow-Origin: *` and handle OPTIONS preflight. Rainstorms can call them from any origin without proxy workarounds.

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
