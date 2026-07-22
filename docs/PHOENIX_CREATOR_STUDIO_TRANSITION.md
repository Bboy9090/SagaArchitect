# Phoenix Creator Studio Transition

## Product identity

The repository remains `SagaArchitect` to preserve history and existing links. The public product direction is **Phoenix Creator Studio**.

Phoenix Creator Studio is a production and canon platform for creators who need to move from scattered ideas to structured characters, factions, locations, lore rules, scenes, storyboards, generated or attached assets, and exportable production packets.

## Current reality

The main branch currently provides a Next.js 16 and React 19 application with local-storage-based worldbuilding flows, optional OpenAI generation, mock fallbacks, healthcheck and smoke scripts, and a substantial planning/documentation set.

It is not yet a complete production platform. The following remain active work:

- PostgreSQL and Drizzle persistence
- Auth.js session and credentials flow
- local-development and S3-compatible storage adapters
- transactional localStorage migration
- durable asset provenance
- production-packet PDF export
- complete unit, integration, migration, and end-to-end suites
- authentic product screenshots
- supported deployment and rollback evidence

## Signature vertical slice

The first fan-favorite release candidate must prove one complete journey:

1. Create a project.
2. Add a character, faction, location, and lore rule.
3. Create a scene and storyboard panels.
4. Generate or attach a sketch while preserving provenance.
5. Detect a documented canon conflict, relationship, or unresolved dependency.
6. Export a useful production packet.
7. Reopen the project in a new session without losing its structure or media.

Issue [#14](https://github.com/Bboy9090/SagaArchitect/issues/14) owns this vertical slice.

## Naming boundary

Until a deliberate migration is complete:

- repository, package, and historical internal identifiers may remain Saga Architect
- user-facing design and current product documentation may use Phoenix Creator Studio
- API, database, storage, bundle, and package identifiers must not be renamed casually
- every identifier migration requires compatibility, redirect, data, and rollback planning

A cosmetic rename is not allowed to break saved projects, deployed environments, package locks, database rows, or external links.

## Foundation quality gate

The initial foundation workflow runs:

- locked dependency installation
- ESLint
- strict TypeScript checking
- Next.js production build
- the existing repository smoke contract
- retained logs and selected build manifests

Passing these gates does not prove persistence, authentication, asset durability, export correctness, production deployment, or user delight. It proves only that the current source satisfies the named foundation checks.

## Product boundaries

Phoenix Creator Studio owns:

- creative-project structure
- canon and relationship modeling
- scenes and storyboards
- creator-facing generation and asset provenance
- production status and packet export

It does not own:

- ARCWYRE Native operating-system services
- PhoenixCore device diagnostics
- Phoenix Key recovery media
- Ghost Writer’s general capture/edit/publishing workflow
- story-world canon itself, which remains owned by each project and its creators

## Promotion rule

The product may be called polished only when a new creator can complete the signature journey without private guidance, failures preserve work, exports are useful outside the app, and the public screenshots come from the exact tested build.
