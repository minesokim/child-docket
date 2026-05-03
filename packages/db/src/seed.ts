// Seed data for Docket v0.
//
// Minimal seed: just the tenant row + per-tenant DEK + the firm-owner
// user (Antonio at Vazant Consulting). No mock clients, no fake
// engagements, no synthetic messages. Real clients arrive via
// /clients/new in the command-room (preparer enters name + phone,
// client signs in via phone OTP and binds to that pre-seeded row).
//
// Why no mock data:
//   - Real onboarding shouldn't be cluttered with fake "Priya
//     Sharma" rows — the command-room is a workspace for the
//     preparer, not a demo viewer.
//   - The 10 mock clients in earlier seeds existed because the
//     intake flow / Triage UI needed something to render against.
//     Now the empty state is fine — a "+ New client" button + the
//     real client roster Antonio enters.
//   - Cleaner CCPA / SOC 2 posture: no synthetic PII shadows
//     sitting in the audit log + dev DBs.
//
// Run: pnpm --filter @docket/db seed
// Reset first: pnpm --filter @docket/db seed:reset
// Requires: DATABASE_URL env var pointing to a Neon Postgres instance.

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import * as schema from './schema.js';
import { tenants, users } from './schema.js';
import { provisionTenantDek } from './dek-cache.js';
import type { TenantId } from '@docket/shared';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set. Wire your Neon connection string into .env.local first.');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client, { schema });

async function reset() {
  console.log('▸ truncating existing data...');
  await db.execute(
    sql`TRUNCATE actions, signatures, issues, engagements, messages, documents, clients, users, tenants RESTART IDENTITY CASCADE`,
  );
}

async function seed() {
  console.log('▸ docket-db seed');
  console.log(`  database: ${DATABASE_URL!.replace(/:[^:@]+@/, ':****@')}`);

  if (process.argv.includes('--reset')) await reset();

  // ──────────────────────────────────────────────────────────────
  // TENANT 0 — Vazant Consulting
  //
  // Multi-firm note (Day 2 post-audit hardening): clerkOrgId is left
  // NULL by the seed. Antonio creates the Clerk Organization via the
  // dashboard, copies the org id, and runs:
  //
  //   UPDATE tenants SET clerk_org_id = '<org-id>' WHERE slug = 'vazant';
  //
  // Once that lands, command-room sign-ins resolve tenant via
  // auth().orgId → tenants.clerk_org_id (multi-firm path). Until then
  // the legacy email-claim path keeps the dev loop working.
  // ──────────────────────────────────────────────────────────────
  const [vazant] = await db
    .insert(tenants)
    .values({
      name: 'Vazant Consulting',
      slug: 'vazant',
      timezone: 'America/Los_Angeles',
      defaultTrustLevel: '1',
    })
    .onConflictDoNothing({ target: tenants.slug })
    .returning();

  // If the tenant already existed (re-running seed without --reset),
  // fetch it so the rest of the seed has the canonical row.
  let tenantRow = vazant;
  if (!tenantRow) {
    const [existing] = await db
      .select()
      .from(tenants)
      .where(sql`${tenants.slug} = 'vazant'`)
      .limit(1);
    tenantRow = existing;
  }
  if (!tenantRow) throw new Error('failed to insert or fetch tenant');
  console.log(`  ✓ tenant: ${tenantRow.name} (${tenantRow.id})`);

  // Provision per-tenant DEK. PII fields (SSN, EIN, bank routing) on this
  // tenant's intake_responses get encrypted with this DEK; the DEK itself
  // is encrypted with the master KEK from PII_ENCRYPTION_KEY. See
  // packages/db/src/encryption.ts header for the threat model.
  // Idempotent — provisionTenantDek no-ops if already set.
  await provisionTenantDek(db, tenantRow.id as TenantId);
  console.log(`  ✓ DEK provisioned for ${tenantRow.slug}`);

  // Antonio Vazquez — Owner.
  // Email is configurable via SEED_ADMIN_EMAIL so David can sign in with his
  // own Google account during development without manually patching this row.
  // First Clerk sign-in matching this email will claim the row (auth helper
  // updates clerkUserId from the placeholder to the real Clerk user ID).
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'antonio@vazantconsulting.com';
  await db
    .insert(users)
    .values({
      tenantId: tenantRow.id,
      clerkUserId: 'user_seed_antonio_pending', // claimed by auth helper on first matching sign-in
      email: adminEmail,
      name: 'Antonio Vazquez',
      // firm_owner: full access + only role with PTIN-holder signing
      // authority (when 8879 wires up via DocuSign + KBA). See
      // apps/command-room/src/lib/require-role.ts for the policy matrix.
      role: 'firm_owner',
    })
    .onConflictDoNothing({ target: users.clerkUserId });
  console.log(`  ✓ user: Antonio Vazquez (email: ${adminEmail})`);

  console.log('\n──────────────────────────────────────────────');
  console.log(`  ✓ Vazant Consulting seeded`);
  console.log(`  ✓ Antonio Vazquez (firm_owner, email: ${adminEmail})`);
  console.log(`  → Add real clients via the command-room: /clients/new`);
  console.log('──────────────────────────────────────────────');
}

seed()
  .catch((err) => {
    console.error('✗ seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await client.end();
  });
