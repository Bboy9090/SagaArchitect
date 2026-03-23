# Saga Architect

**Universe Bible + Canon Engine for creators**

Saga Architect is a **Universe Bible Generator + Canon Tracker + Story Arc Engine** for serious creators building worlds, franchises, timelines, factions, and canon — the kind of structured creative infrastructure that powers books, games, comics, and films.
**Universe Bible + Canon Engine for Creators**

Saga Architect is a structured world-building and canon management platform designed for writers, game creators, comic creators, and franchise builders.

It helps creators organize complex story worlds by managing characters, factions, timelines, lore, and narrative arcs inside a single connected system.

Unlike traditional note apps, Saga Architect focuses on continuity and canon integrity.

---

## Why It Exists

Most writing tools store notes. Saga Architect manages canon.

---

## Core Features

### Universe Engine

Create and manage entire fictional universes.

Each universe can contain:
- Factions
- Characters
- Locations
- Artifacts
- Timelines
- Story arcs

### Canon Tracking

Every entry can be assigned a canon status.

Examples:
- Canon
- Alternate Timeline
- Experimental
- Deprecated

This allows creators to track official lore without losing experimental ideas.

### Character System

Characters include structured data fields such as:
- Name
- Faction
- Abilities
- Relationships
- Narrative arc
- Timeline appearances

Saga Architect gives creators a connected, AI-assisted system to:
This makes it easy to maintain consistent character histories.

### Timeline Management

Stories can be organized along a master timeline.

Events can be linked to:
- Characters
- Locations
- Factions
- Major narrative arcs

This allows creators to track story progression across multiple books, games, or series.

### Story Arc Generator

Saga Architect can generate story arc frameworks based on existing world data.

Example outputs include:
- Conflict arcs
- Faction wars
- Prophecy arcs
- Character redemption arcs
- Empire collapse arcs

These tools help creators expand their worlds while maintaining internal logic.

---

## Who It's For

Novelists
Comic creators
Game writers
Franchise builders
Lore-heavy worldbuilders

---

## Core Screens

| Screen | Purpose |
|--------|---------|
| **Dashboard** | Universe gallery, demo loader, quick create |
| **Universe Forge** | Input form → AI generates world overview, myth, themes |
| **Canon Core** | Expandable command center for all lore sections |
| **Character Engine** | Character cards with faction ties, arc potential, relationships |
| **Faction Builder** | Faction cards with ideology, resources, allies/enemies |
| **Timeline Engine** | Chronological events with canon status and consequences |
| **Arc Forge** | AI-generated story arcs using current canon |
| **Lore Memory** | Contradiction detector, unresolved mysteries, canon rules |

---

## Data Model

Seven connected entity types:

- `universes` — world overview, myth, themes, conflict, prophecy hooks
- `factions` — ideology, leader, resources, allies, enemies, objectives
- `characters` — motivations, powers, relationships, arc potential, status
- `locations` — type, region, strategic value, mythic importance
- `timeline_events` — era markers, affected entities, consequences
- `story_arcs` — type, involved characters/factions, start/end, themes
- `lore_rules` — canon rules with category, description, applies-to scope

### Canon Status Tags

Every entity supports a canon status:

| Status | Meaning |
|--------|---------|
| `canon` | Confirmed, active lore |
| `draft` | In progress, not finalized |
| `alternate` | An alternate timeline variant |
| `deprecated` | Retired from active canon |
| `mystery` | Intentionally unknown |

---

## Example Universe

### Universe: The Ashen Veil

> An ancient empire fell when the sky split open and released memory-eating storms across the world. Now kingdoms, outlaw guilds, relic hunters, and forgotten bloodlines battle over the shattered remains of history.

**Factions:** 5
**Characters:** 8
**Timeline events:** 10
**Story arcs:** 3

Includes 8 locations and 5 lore rules — ready to explore immediately.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access Saga Architect.

### AI Generation (Optional)

To enable AI-powered generation, add your OpenAI API key:

```bash
# .env.local
OPENAI_API_KEY=your_key_here
```

Without an API key, the app uses built-in mock data for all generation features so you can explore the full flow.

---

## Deployment

For a full deployment guide — Vercel, Railway, Docker, CORS configuration, and Rainstorms integration — see **[docs/deployment.md](docs/deployment.md)**.

**Quick deploy to Vercel:**

1. Push this repository to GitHub.
2. Import the project at [vercel.com](https://vercel.com) — Next.js is auto-detected.
3. Add `OPENAI_API_KEY` (optional) in **Settings → Environment Variables**.
4. Click **Deploy**.

---

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **Tailwind CSS**
- **localStorage** for data persistence
- **OpenAI API** for AI generation (with mock fallback)

---

## Design

Dark cinematic theme — feels like opening a forbidden archive:

- Background: `#0a0a0f` / `#0f0f1a`
- Accent: gold `#c9a84c`, crimson, deep blue
- Expandable lore panels
- Canon status badges
- Premium dashboard cards

---

## Screenshots

### Universe Forge
*Coming soon*

### Character Engine
*Coming soon*

### Timeline Engine
*Coming soon*
## License

MIT License
