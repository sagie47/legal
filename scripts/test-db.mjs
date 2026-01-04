import fs from 'node:fs';
import { config } from 'dotenv';
import { Client } from 'pg';

// Load env vars from .env then override with .env.local if present
config();
if (fs.existsSync('.env.local')) {
  config({ path: '.env.local', override: true });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL is not set. Add it to .env.local (ignored by git).');
  process.exit(1);
}

const client = new Client({
  connectionString,
  ssl: { rejectUnauthorized: false }, // required for Supabase
});

async function main() {
  await client.connect();
  const { rows } = await client.query('select now() as now, current_database() as db');
  const row = rows[0];
  console.log(`Connected to ${row.db}. Time: ${row.now.toISOString()}`);
}

main()
  .catch((err) => {
    console.error('Database connection failed:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await client.end().catch(() => {});
  });
