# Phoenix Creator Studio

**Universe Bible + Canon Engine for Creators**

Phoenix Creator Studio is a structured world-building and canon management platform for **Bobby's World / Blue Phoenix OS**, designed for writers, game creators, comic creators, storyboard artists, and franchise builders.

It helps creators organize complex story worlds by managing characters, factions, timelines, lore, scenes, storyboard panels, and narrative arcs inside a single connected system with AI-powered generation, canvas sketching, and canon tracking.

Unlike traditional note apps, Phoenix Creator Studio focuses on continuity, canon integrity, and media-ready production pipelines.

---

## Why It Exists

Most writing tools store notes. Phoenix Creator Studio manages canon.

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

Phoenix Creator Studio gives creators a connected, AI-assisted system to maintain consistent character histories.

### Timeline Management

Stories can be organized along a master timeline.

Events can be linked to:
- Characters
- Locations
- Factions
- Major narrative arcs

This allows creators to track story progression across multiple books, games, or series.

### Story Arc Generator

Phoenix Creator Studio can generate story arc frameworks based on existing world data.

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
| **Dashboard** | Project gallery, demo loader, quick create |
| **Project Forge** | Input form → AI generates world overview, myth, themes |
| **Canon Core** | Expandable command center for all lore sections |
| **Character Engine** | Character cards with faction ties, arc potential, relationships |
| **Scenes Page** | Chronological list of story beats, forms for adding and editing |
| **Storyboard Studio** | Visual panel layout, sketch drawing canvas, mock AI generator |
| **Export Center** | Summarize project stats, outline preview, and print to PDF |
| **Faction Builder** | Faction cards with ideology, resources, allies/enemies |
| **Timeline Engine** | Chronological events with canon status and consequences |
| **Arc Forge** | AI-generated story arcs using current canon |
| **Lore Memory** | Contradiction detector, unresolved mysteries, canon rules |

---

## Data Model

Nine connected entity types:

- `universes` (Projects) — world overview, myth, themes, conflict, prophecy hooks
- `scenes` — chronological beats, location reference, summary, order
- `storyboard_panels` — panel numbers, camera shots, visual prompt details, dialog, base64 drawings
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

### Prerequisites

- Node.js 20 or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Bboy9090/SagaArchitect.git
cd SagaArchitect

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access Phoenix Creator Studio.

### Building for Production

```bash
# Build the application
npm run build

# Start production server
npm start
```

### Database Schema & Migrations (PostgreSQL + Drizzle)

The database schema is defined inside `src/db/schema.ts` and managed using Drizzle ORM.

```bash
# Generate SQL migrations files
npm run db:generate

# Apply migrations to PostgreSQL instance
npm run db:migrate

# Push schema directly (dev environment check)
npm run db:push

# Open the Drizzle Studio visualizer dashboard
npm run db:studio
```


### Testing

```bash
# Run linter
npm run lint

# Run healthcheck (basic functionality tests)
./scripts/healthcheck.sh

# Run smoke tests
./scripts/smoke-test.sh
```

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

## About Bobby's World / Blue Phoenix OS

Phoenix Creator Studio is part of the Bobby's World / Blue Phoenix OS ecosystem - a creative platform for building and managing fictional universes across multiple mediums.
