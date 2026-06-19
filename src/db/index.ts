import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;

export let db: PostgresJsDatabase<typeof schema> | null = null;
export let client: postgres.Sql | null = null;

if (connectionString) {
  try {
    client = postgres(connectionString, { prepare: false });
    db = drizzle(client, { schema });
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
  }
} else {
  console.warn('DATABASE_URL environment variable is missing. Database operations will be unavailable.');
}
