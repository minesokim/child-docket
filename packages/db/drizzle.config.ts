import type { Config } from 'drizzle-kit';
import { config as loadEnv } from 'dotenv';
import path from 'node:path';

// drizzle-kit reads process.env directly and doesn't auto-load
// .env.local. The seed script (src/seed.ts) loads it manually with
// dotenv; mirror that pattern here so `pnpm --filter @docket/db
// migrate` Just Works without the user having to remember to set
// DATABASE_URL in their shell every time.
//
// We use process.cwd() instead of import.meta.url because drizzle-kit
// compiles this config through esbuild to CJS internally, where
// import.meta is undefined. process.cwd() works in both runtimes;
// pnpm --filter sets it to packages/db so ../../.env.local reaches
// the repo root.
loadEnv({ path: path.resolve(process.cwd(), '../../.env.local') });

export default {
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? 'postgres://docket:docket@localhost:5432/docket',
  },
} satisfies Config;
