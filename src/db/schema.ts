import { pgTable, uuid, varchar, text, integer, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ─────────────────────────────────────────────────────────────────────────────
// AUTH & USERS TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }),
  email: varchar('email', { length: 255 }).unique().notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 255 }).notNull(),
  providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
  refresh_token: text('refresh_token'),
  access_token: text('access_token'),
  expires_at: integer('expires_at'),
  token_type: varchar('token_type', { length: 255 }),
  scope: varchar('scope', { length: 255 }),
  id_token: text('id_token'),
  session_state: varchar('session_state', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable('sessions', {
  sessionToken: varchar('session_token', { length: 255 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
  identifier: varchar('identifier', { length: 255 }).notNull(),
  token: varchar('token', { length: 255 }).primaryKey(),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// PROJECT & CREATIVE CONTENT TABLES
// ─────────────────────────────────────────────────────────────────────────────

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  concept: text('concept'),
  genre: varchar('genre', { length: 100 }),
  tone: varchar('tone', { length: 100 }),
  era: varchar('era', { length: 100 }),
  techLevel: varchar('tech_level', { length: 100 }),
  magicSystem: text('magic_system'),
  worldOverview: text('world_overview'),
  creationMyth: text('creation_myth'),
  themes: text('themes').array().default(sql`ARRAY[]::text[]`).notNull(),
  currentConflict: text('current_conflict'),
  prophecyHooks: text('prophecy_hooks').array().default(sql`ARRAY[]::text[]`).notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const factions = pgTable('factions', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }),
  ideology: text('ideology'),
  leader: varchar('leader', { length: 255 }),
  resources: text('resources'),
  allies: uuid('allies').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  enemies: uuid('enemies').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  territory: text('territory'),
  internalConflict: text('internal_conflict'),
  objective: text('objective'),
  symbol: varchar('symbol', { length: 100 }),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  factionId: uuid('faction_id').references(() => factions.id, { onDelete: 'set null' }),
  name: varchar('name', { length: 255 }).notNull(),
  title: varchar('title', { length: 255 }),
  role: varchar('role', { length: 255 }),
  motivations: text('motivations'),
  fears: text('fears'),
  powers: text('powers'),
  weaknesses: text('weaknesses'),
  relationships: jsonb('relationships').default(sql`'[]'::jsonb`).notNull(),
  arcPotential: text('arc_potential'),
  status: varchar('status', { length: 50 }).default('alive').notNull(),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  appearance: text('appearance'),
  speechStyle: text('speech_style'),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const locations = pgTable('locations', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }),
  region: varchar('region', { length: 255 }),
  description: text('description'),
  strategicValue: text('strategic_value'),
  mythicImportance: text('mythic_importance'),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const timelineEvents = pgTable('timeline_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  eraMarker: varchar('era_marker', { length: 100 }),
  summary: text('summary'),
  affectedCharacters: uuid('affected_characters').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  affectedFactions: uuid('affected_factions').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  affectedLocations: uuid('affected_locations').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  consequences: text('consequences'),
  hiddenTruths: text('hidden_truths'),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const storyArcs = pgTable('story_arcs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  type: varchar('type', { length: 100 }).notNull(),
  summary: text('summary'),
  startPoint: text('start_point'),
  endPoint: text('end_point'),
  involvedCharacters: uuid('involved_characters').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  involvedFactions: uuid('involved_factions').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  themes: text('themes').array().default(sql`ARRAY[]::text[]`).notNull(),
  turningPoints: text('turning_points').array().default(sql`ARRAY[]::text[]`).notNull(),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loreRules = pgTable('lore_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  category: varchar('category', { length: 100 }),
  title: varchar('title', { length: 255 }).notNull(),
  description: text('description'),
  appliesTo: uuid('applies_to').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const generatedStories = pgTable('generated_stories', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  format: varchar('format', { length: 100 }).notNull(),
  content: text('content').notNull(),
  featuredCharacters: uuid('featured_characters').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  featuredFactions: uuid('featured_factions').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  featuredLocations: uuid('featured_locations').array().default(sql`ARRAY[]::uuid[]`).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const scenes = pgTable('scenes', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 255 }).notNull(),
  summary: text('summary'),
  order: integer('order').notNull(),
  locationId: uuid('location_id').references(() => locations.id, { onDelete: 'set null' }),
  canonStatus: varchar('canon_status', { length: 50 }).default('draft').notNull(),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  filePath: text('file_path').notNull(),
  fileSize: integer('file_size').notNull(),
  mimeType: varchar('mime_type', { length: 100 }).notNull(),
  storageProvider: varchar('storage_provider', { length: 50 }).default('local').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const storyboardPanels = pgTable('storyboard_panels', {
  id: uuid('id').primaryKey().defaultRandom(),
  sceneId: uuid('scene_id').notNull().references(() => scenes.id, { onDelete: 'cascade' }),
  panelNumber: integer('panel_number').notNull(),
  visualPrompt: text('visual_prompt').notNull(),
  actionDescription: text('action_description').notNull(),
  dialogue: text('dialogue'),
  cameraShot: varchar('camera_shot', { length: 100 }).notNull(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'set null' }),
  version: integer('version').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const versionHistory = pgTable('version_history', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  action: varchar('action', { length: 50 }).notNull(), // 'create', 'update', 'delete'
  entityType: varchar('entity_type', { length: 50 }).notNull(), // 'character', 'scene', etc.
  entityId: uuid('entity_id').notNull(),
  changeData: jsonb('change_data').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
