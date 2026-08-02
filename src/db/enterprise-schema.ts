import { integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { users } from './schema';

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: varchar('id', { length: 64 }).primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  route: varchar('route', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  requestHash: varchar('request_hash', { length: 64 }).notNull(),
  state: varchar('state', { length: 20 }).default('processing').notNull(),
  responseStatus: integer('response_status'),
  responseBody: jsonb('response_body'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
});

export const dataLifecycleEvents = pgTable('data_lifecycle_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  actorUserId: uuid('actor_user_id').notNull(),
  subjectUserId: uuid('subject_user_id').notNull(),
  projectId: uuid('project_id'),
  operation: varchar('operation', { length: 50 }).notNull(),
  status: varchar('status', { length: 30 }).notNull(),
  details: jsonb('details').default({}).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
