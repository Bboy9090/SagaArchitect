# SagaLoreBuilder

**Build your universe bible. Track your canon. Generate your saga.**

SagaLoreBuilder is a **Universe Bible Generator + Canon Tracker + Story Arc Engine** for serious creators building worlds, franchises, timelines, factions, and canon — the kind of structured creative infrastructure that powers books, games, comics, and films.

---

## What It Does

SagaLoreBuilder gives creators a connected, AI-assisted system to:

- **Forge universes** from a single concept prompt
- **Build factions** with ideology, power structures, conflicts, and objectives
- **Define characters** tied to factions, timelines, and story arcs
- **Map locations** with strategic and mythic significance
- **Track timelines** with canon status and consequence chains
- **Generate story arcs** (trilogy, villain, prophecy, war, and more)
- **Monitor lore consistency** with a built-in contradiction detector

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

## Demo Universe: The Ashen Veil

A built-in demo universe is included:

> An ancient empire fell when the sky split open and released memory-eating storms across the world. Now kingdoms, outlaw guilds, relic hunters, and forgotten bloodlines battle over the shattered remains of history.

Includes 5 factions, 8 characters, 8 locations, 10 timeline events, 3 story arcs, and 5 lore rules — ready to explore immediately.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access SagaLoreBuilder.

### AI Generation (Optional)

To enable AI-powered generation, add your OpenAI API key:

```bash
# .env.local
OPENAI_API_KEY=your_key_here
```

Without an API key, the app uses built-in mock data for all generation features so you can explore the full flow.

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
