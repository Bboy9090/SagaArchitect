# Canon Tracking System
## Saga Architect - Canon Management & Conflict Detection

**Package ID:** com.bobbysworld.sagaarchitect
**Document Version:** 1.0 (MVP)

---

## Overview

Saga Architect's **Canon Tracking System** ensures consistency across complex fictional universes by:

1. **Tagging every entity** with a canon status
2. **Detecting conflicts** automatically
3. **Supporting alternate timelines** without breaking main canon
4. **Tracking deprecated lore** without deletion

This system is the core differentiator between Saga Architect and traditional note-taking apps.

---

## Canon Status System

### 5-Tier Status Model

Every entity (Character, Faction, Location, TimelineEvent, StoryArc, LoreRule) has one of these statuses:

```typescript
type CanonStatus =
  | 'canon'      // Official, active lore
  | 'draft'      // In progress, not finalized
  | 'alternate'  // Alternate timeline variant
  | 'deprecated' // Retired from active canon
  | 'mystery';   // Intentionally unknown
```

---

## Status Definitions

### 1. Canon

**Purpose:** The official, active lore in the main timeline.

**Usage:**
- Confirmed characters, events, factions
- Finalized story arcs
- Active magic rules and world laws

**Visual Badge:** 🟢 Green

**Rules:**
- Canon entities are included in canon block exports
- AI generation uses canon entities as context
- Canon entities appear in story generation prompts

**Example:**
```
Character: "Kael the Stormbreaker"
Status: canon
Reason: Protagonist of the main trilogy, fully developed
```

---

### 2. Draft

**Purpose:** Lore in development, not yet finalized.

**Usage:**
- New characters being fleshed out
- Experimental factions
- Rough story arc ideas
- Placeholder timeline events

**Visual Badge:** 🟡 Yellow

**Rules:**
- Draft entities are **excluded** from AI generation prompts
- Not included in canon block exports (unless explicitly requested)
- Can be promoted to `canon` or demoted to `deprecated`

**Example:**
```
Faction: "The Ember Court"
Status: draft
Reason: Ideology and leadership still being defined
```

---

### 3. Alternate

**Purpose:** Lore that exists in an alternate timeline, parallel universe, or "what if" scenario.

**Usage:**
- Alternate timeline versions of characters
- Events that didn't happen in main timeline
- Experimental story branches
- Multiverse variants

**Visual Badge:** 🔵 Blue

**Rules:**
- Alternate entities are **tagged** but isolated from main canon
- Not included in default canon block exports
- Can coexist with canon versions (e.g., "Evil Timeline Kael")

**Example:**
```
TimelineEvent: "The Fall of the Azure Kingdom"
Status: alternate
Reason: This event only occurs in the "Dark Path" timeline, not main canon
```

---

### 4. Deprecated

**Purpose:** Retired lore that is no longer active but preserved for historical reference.

**Usage:**
- Retconned characters
- Abandoned story arcs
- Replaced magic systems
- Old faction versions

**Visual Badge:** ⚫ Gray

**Rules:**
- Deprecated entities are **archived**, not deleted
- Not included in AI generation or canon block exports
- Visible in "Deprecated Archive" view for reference

**Example:**
```
LoreRule: "Magic requires blood sacrifice"
Status: deprecated
Reason: Replaced with "Magic requires willpower" in v2 of the universe
```

**Why Not Delete?**
- Preserves creative history
- Allows reverting if needed
- Maintains data integrity (no orphaned references)

---

### 5. Mystery

**Purpose:** Lore that is intentionally unknown, hidden, or unresolved.

**Usage:**
- Secret character identities
- Unresolved prophecies
- Mysterious locations
- Hidden truths in timeline events

**Visual Badge:** 🟣 Purple

**Rules:**
- Mystery entities **are canon** but with intentional unknowns
- Included in canon block exports (mystery is part of the lore)
- Conflict detection flags unresolved mysteries

**Example:**
```
Character: "The Hooded Oracle"
Status: mystery
Reason: True identity is a plot twist for Book 3
```

---

## Canon Status by Entity Type

### Universe
**No canon status** - Universes are the canon container itself.

### Character
**All 5 statuses supported**

- `canon` - Active character
- `draft` - Character in development
- `alternate` - Alternate timeline version
- `deprecated` - Removed character (e.g., cut from story)
- `mystery` - Secret identity or unknown character

### Faction
**All 5 statuses supported**

- `canon` - Active faction
- `draft` - Faction being designed
- `alternate` - Alternate timeline faction
- `deprecated` - Defunct faction (e.g., empire that fell)
- `mystery` - Secret society or hidden faction

### Location
**All 5 statuses supported**

- `canon` - Confirmed location
- `draft` - Location being mapped
- `alternate` - Alternate timeline location
- `deprecated` - Removed location
- `mystery` - Hidden realm or undiscovered place

### TimelineEvent
**All 5 statuses supported**

- `canon` - Confirmed historical event
- `draft` - Event being finalized
- `alternate` - Alternate timeline event
- `deprecated` - Retconned event
- `mystery` - Event with hidden details

### StoryArc
**All 5 statuses supported** (optional field)

- `canon` - Active story arc
- `draft` - Arc in planning
- `alternate` - Alternate timeline arc
- `deprecated` - Abandoned arc
- `mystery` - Secret arc with unrevealed details

### LoreRule
**All 5 statuses supported**

- `canon` - Active world rule
- `draft` - Rule being refined
- `alternate` - Alternate timeline rule
- `deprecated` - Replaced or retired rule
- `mystery` - Unresolved rule or prophecy

---

## Conflict Detection

Saga Architect automatically detects canon conflicts and displays warnings.

### Implemented Conflicts (MVP)

#### 1. Duplicate Lore Rule Titles

**Detection:**
- Two or more lore rules with identical titles in the same category
- Both marked as `canon`

**Warning Example:**
```
⚠️ Duplicate rule: "Dragons are immortal" appears 2 times in category "biological"
```

**Resolution:**
- Mark one as `deprecated`
- Rename one rule
- Merge the rules

---

#### 2. Unresolved Mysteries

**Detection:**
- Lore rules with `mystery` status that have no resolution

**Warning Example:**
```
⚠️ Unresolved mystery: "The prophecy of the twin moons" has no resolution
```

**Resolution:**
- Add a lore rule with the resolution
- Mark as `canon` when resolved
- Keep as `mystery` if intentional

---

#### 3. Deprecated Rules Still Active

**Detection:**
- Lore rules marked as `deprecated` but still referenced in canon entities

**Warning Example:**
```
⚠️ Deprecated rule "Blood magic is forbidden" is referenced by character "Kael"
```

**Resolution:**
- Update character to remove reference
- Restore rule to `canon`
- Create a replacement rule

---

#### 4. Dead Characters in Multiple Events

**Detection:**
- Character with `status: 'dead'` appears in multiple timeline events after death

**Warning Example:**
```
⚠️ Dead character "Eris" appears in events after death:
  - Event 1: "The Fall of the Azure Kingdom" (Year 340)
  - Event 2: "The Battle of Ashfield" (Year 350)
```

**Resolution:**
- Fix character status to `alive` in one event
- Update timeline chronology
- Mark one event as `alternate` timeline

---

#### 5. Faction Ally/Enemy Asymmetry

**Detection:**
- Faction A lists Faction B as ally, but Faction B lists Faction A as enemy

**Warning Example:**
```
⚠️ Faction relationship conflict:
  - "The Iron Legion" allies with "The Ember Court"
  - "The Ember Court" enemies with "The Iron Legion"
```

**Resolution:**
- Fix one faction's relationship list
- Explain asymmetry in lore (e.g., one-sided alliance)

---

### Planned Conflicts (Future)

#### 6. Magic Rule Violations
- Character uses magic that violates a `canon` lore rule
- Example: Character uses blood magic when rule says "Blood magic is impossible"

#### 7. Timeline Chronological Inconsistencies
- Events with era markers out of order
- Example: "Year 350" event listed before "Year 340" event

#### 8. Character Age/Era Consistency
- Character appears in events spanning impossible timespans
- Example: Human character active for 500 years without immortality

#### 9. Location Control Changes
- Location controlled by multiple factions simultaneously
- Example: "Ashfield" controlled by both "Iron Legion" and "Ember Court" in same era

---

## Canon Block Export

The **Canon Block** is a JSON snapshot of all canon entities in a universe.

### What's Included

**Canon Block Includes:**
- All entities with `canon` status
- All entities with `mystery` status
- Universe metadata
- Entity relationships

**Canon Block Excludes:**
- Entities with `draft` status
- Entities with `alternate` status
- Entities with `deprecated` status

### Structure

```json
{
  "universe": { /* Universe object */ },
  "characters": [ /* Array of canon characters */ ],
  "factions": [ /* Array of canon factions */ ],
  "locations": [ /* Array of canon locations */ ],
  "timeline_events": [ /* Array of canon events */ ],
  "story_arcs": [ /* Array of canon arcs */ ],
  "lore_rules": [ /* Array of canon rules */ ]
}
```

### Usage

**Export to Clipboard:**
- Click "Export Canon Block" button
- JSON copied to clipboard
- Paste into external tools

**Rainstorms Integration:**
- Canon block sent via `POST /api/lore-engine/canon-block`
- Rainstorms generates stories using canon context
- Maintains consistency across apps

**Backup/Restore:**
- Export full canon as JSON
- Save to file for backup
- Re-import if needed

---

## Workflow Examples

### Example 1: Creating a New Character

1. User creates character "Lyra"
2. Character automatically assigned `draft` status
3. User fills in details (motivations, powers, etc.)
4. User promotes to `canon` when finalized
5. Character now appears in AI generation prompts

---

### Example 2: Alternate Timeline Variant

1. User has canon character "Kael" (hero)
2. User wants to explore "what if Kael became evil?"
3. User creates new character "Kael (Dark Path)"
4. User assigns `alternate` status
5. Both versions coexist without conflict

---

### Example 3: Deprecating Old Lore

1. User decides "Magic requires blood sacrifice" no longer fits
2. User creates new rule "Magic requires willpower"
3. User marks old rule as `deprecated`
4. Old rule archived, new rule becomes `canon`
5. Conflict detection warns if old rule still referenced

---

### Example 4: Unresolved Mystery

1. User creates lore rule "The prophecy of the twin moons"
2. User assigns `mystery` status (intentionally unresolved)
3. Lore Memory flags it as unresolved mystery
4. User resolves in Book 3 by creating resolution rule
5. Original rule updated to `canon`

---

## Best Practices

### 1. Start as Draft
- Create all new entities as `draft`
- Promote to `canon` only when finalized
- Prevents premature inclusion in AI generation

### 2. Use Alternate for Experiments
- Test story ideas without affecting main canon
- Create "what if" scenarios safely
- Tag clearly with `alternate`

### 3. Deprecate, Don't Delete
- Preserve creative history
- Allow reverting if needed
- Maintain data integrity

### 4. Embrace Mystery
- Use `mystery` for intentional unknowns
- Track unresolved plot hooks
- Flag for future resolution

### 5. Review Conflicts Regularly
- Check Lore Memory for warnings
- Resolve conflicts promptly
- Maintain canon consistency

---

## Visual Indicators

### Status Badges

**Canon:** `[CANON]` 🟢
**Draft:** `[DRAFT]` 🟡
**Alternate:** `[ALT]` 🔵
**Deprecated:** `[DEP]` ⚫
**Mystery:** `[???]` 🟣

### Conflict Warnings

**Style:** Red/orange warning badges
**Icon:** ⚠️
**Placement:** Next to conflicting entity
**Action:** Click to view details and suggestions

---

## Canon Stats

Lore Memory displays canon statistics:

```
Canon Overview:
- Total entities: 152
- Canon: 98 (64%)
- Draft: 32 (21%)
- Alternate: 12 (8%)
- Deprecated: 7 (5%)
- Mystery: 3 (2%)

Conflicts Detected: 4
- 2 duplicate lore rules
- 1 dead character conflict
- 1 faction relationship asymmetry
```

---

## Integration with AI Generation

### Canon-Aware Generation

**AI Prompt Includes:**
- All `canon` entities
- All `mystery` entities (with mystery context)
- Universe parameters

**AI Prompt Excludes:**
- `draft` entities (not finalized)
- `alternate` entities (parallel timeline)
- `deprecated` entities (retired)

**Result:**
- Generated content respects canon
- No accidental violations
- Consistent with universe rules

---

## Future Enhancements

### Planned Features

1. **Canon Diff Viewer** - Compare canon versions over time
2. **Canon Versioning** - Tag canon snapshots (v1.0, v2.0, etc.)
3. **Canon Merge** - Merge alternate timelines into main canon
4. **Canon Rollback** - Revert to previous canon state
5. **Canon Voting** - Multi-user canon approval system

---

## Technical Implementation

### Storage

**Current (MVP):**
- Canon status stored as field in each entity
- localStorage persistence

**Future:**
- MongoDB with indexed canon_status field
- Efficient queries for canon-only entities

### Conflict Detection

**Current (MVP):**
- Client-side JavaScript checks
- Real-time warnings in UI

**Future:**
- Server-side validation
- Automated conflict resolution suggestions
- ML-powered inconsistency detection

---

**Last Updated:** May 2026
**Document Owner:** Bobby's World Team
