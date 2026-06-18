# Product Requirements Document (PRD)
## Saga Architect - MVP Foundation

**Version:** 0.1.0 (Reforged MVP)
**Date:** May 2026
**Status:** Active Development
**Product ID:** com.bobbysworld.sagaarchitect

---

## 1. Product Overview

### 1.1 Vision
Saga Architect is a **Universe Bible + Canon Engine** for creators building complex fictional worlds within Bobby's World / Blue Phoenix OS ecosystem. It enables writers, game designers, and franchise builders to maintain continuity and canon integrity across multiple creative projects.

### 1.2 Mission Statement
Build a structured world-building platform that prevents canon contradictions while empowering creators to generate rich, interconnected fictional universes across books, games, comics, and films.

### 1.3 Target Users
- Authors building series bibles
- Comic creators maintaining character continuity
- Game designers creating consistent world lore
- Worldbuilders documenting comprehensive universes
- Franchise planners managing large-scale canon

---

## 2. MVP Features (Reforged Foundation)

### 2.1 Core Features

#### Universe Dashboard
- Create new universes
- Load demo universe ("The Ashen Veil")
- View all created universes
- Quick access to universe details

#### Character Cards
- Character profiles with structured data
  - Name, title, role
  - Motivations, fears, powers, weaknesses
  - Relationships (typed connections)
  - Arc potential
  - Status (alive/dead/missing/legendary/unknown)
  - Canon status tracking
  - Appearance and speech style

#### Lore/Canon Rule Entries
- Canon rule management
  - Category-based organization
  - Rule descriptions
  - Applies-to scope
  - Canon status per rule
- Conflict detection:
  - Duplicate rule titles
  - Unresolved mysteries
  - Deprecated rules archive

#### Timeline Events
- Chronological event tracking
  - Era markers
  - Event summaries
  - Affected entities (characters, factions, locations)
  - Consequences
  - Hidden truths
  - Canon status per event

#### Export Functionality
- Export universe as JSON
- Export canon block for external tools
- Copy canon data to clipboard

### 2.2 Additional MVP Features

#### Faction Management
- Faction profiles with:
  - Ideology, leader, resources
  - Allies and enemies
  - Territory and objectives
  - Internal conflicts
  - Canon status

#### Location Tracking
- Location profiles:
  - Type, region, description
  - Strategic value
  - Mythic importance
  - Canon status

#### Story Arc Management
- Arc profiles:
  - Arc type (trilogy, season, hero, villain, etc.)
  - Summary and themes
  - Start/end points
  - Involved characters and factions
  - Turning points

#### AI Generation (Optional)
- Universe world overview generation
- Character generation with arc potential
- Faction generation with relationships
- Location generation
- Timeline event generation
- Story arc generation
- Full story generation (multiple formats)

---

## 3. Data Model

### 3.1 Core Entities

1. **Universe** - World overview, themes, conflict, prophecy hooks
2. **Character** - Structured character data with relationships
3. **Faction** - Ideology, resources, allies/enemies
4. **Location** - Type, strategic/mythic value
5. **TimelineEvent** - Era markers, consequences, affected entities
6. **StoryArc** - Arc type, involved entities, themes
7. **LoreRule** - Canon rules with category and scope

### 3.2 Canon Status System

Every entity supports one of these statuses:
- `canon` - Confirmed, active lore
- `draft` - In progress, not finalized
- `alternate` - Alternate timeline variant
- `deprecated` - Retired from active canon
- `mystery` - Intentionally unknown

---

## 4. Technical Specifications

### 4.1 Technology Stack
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS 4
- **Storage:** localStorage (MVP)
- **AI:** OpenAI API (optional, with mock fallback)

### 4.2 Architecture
- Client-side data persistence
- API routes for generation logic
- Component-based UI architecture
- LoreEngine for canon management

### 4.3 File Structure
```
src/
├── app/              # Next.js app router pages
├── components/       # React components
└── lib/             # Core logic (types, storage, lore-engine)
```

---

## 5. User Workflows

### 5.1 Create Universe
1. User navigates to dashboard
2. Clicks "Create New Universe" or loads demo
3. Fills universe form or uses AI generation
4. Universe is saved to localStorage
5. User redirected to universe Canon Core

### 5.2 Manage Canon
1. User selects universe from dashboard
2. Navigates to Canon Core
3. Expands relevant section (Characters, Factions, etc.)
4. Creates/edits/deletes entities
5. Assigns canon status
6. Views conflict detection warnings

### 5.3 Export Data
1. User views Canon Core
2. Clicks "Export Canon Block"
3. JSON data copied to clipboard or downloaded
4. Can be used in external tools or Rainstorms

---

## 6. Known Limitations (MVP)

### 6.1 Data Model
- Basic data structures
- No advanced validation
- Limited relationship types

### 6.2 Collaboration
- Single-user only
- No multi-user support
- No real-time collaboration

### 6.3 Storage
- localStorage only
- No cloud sync
- No data backup
- Limited by browser storage quota

### 6.4 Export
- JSON only
- No PDF export
- No visual timeline export

---

## 7. Success Metrics

### 7.1 MVP Success Criteria
- ✅ Build completes without errors
- ✅ All core features functional
- ✅ Healthcheck passes
- ✅ Demo universe loads correctly
- ✅ Create/save/load workflows work
- ✅ Export functionality works

### 7.2 User Experience Metrics
- Time to create first universe < 5 minutes
- Zero data loss on page refresh
- All AI generation features have mock fallback

---

## 8. Future Roadmap (Post-MVP)

### 8.1 Planned Features
- Multiple timeline support
- Import from external sources
- Collaboration features (multi-user)
- Cloud storage and sync
- MongoDB backend
- PDF export
- Visual timeline graphs
- Character relationship graphs

### 8.2 Integration Roadmap
- Rainstorms integration (story generation)
- StoryMap visualization (planned)
- GameLore narrative design (planned)

---

## 9. Dependencies

### 9.1 Required
- Node.js 20+
- npm or yarn

### 9.2 Optional
- OpenAI API key (for AI generation)

---

## 10. Release Checklist Reference

See **docs/RELEASE_CHECKLIST.md** for full pre-release verification steps.

---

## 11. Documentation

### 11.1 User Documentation
- README.md - Setup and usage guide
- docs/deployment.md - Deployment guide

### 11.2 Developer Documentation
- docs/architecture.md - System architecture
- docs/WORLDBUILDING_MODEL.md - Data model details
- docs/CANON_TRACKING.md - Canon system details
- docs/rainstorms-integration.md - Integration guide

---

## 12. Support & Feedback

**Repository:** https://github.com/Bboy9090/SagaArchitect
**Issues:** https://github.com/Bboy9090/SagaArchitect/issues

---

**Document Owner:** Bobby's World Team
**Last Updated:** May 2026
