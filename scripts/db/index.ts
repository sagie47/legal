import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';

const connectionString = process.env.SUPABASE_DB_URL;

if (!connectionString) {
    throw new Error('Missing SUPABASE_DB_URL');
}

// Disable prefetch as it is not supported for "Transaction" pool mode
const client = postgres(connectionString, { prepare: false, ssl: 'require' });
export const db = drizzle(client, { schema });
