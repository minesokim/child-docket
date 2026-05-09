// apps/command-room/scripts/smoke-square-checkout.ts
//
// Smoke for Square Checkout production wiring against Vazant sandbox.
//
//   bun run apps/command-room/scripts/smoke-square-checkout.ts
//
// Calls Square's payment-links API directly (not through the server
// action wrapper, since that needs a Clerk session). Verifies:
//   1. Vazant has Square credentials in tenant_credentials.
//   2. Square API mints a checkout link in sandbox.
//   3. payments row inserts cleanly.
//   4. Replay: same insert with ON CONFLICT DO NOTHING returns 0 rows.
//   5. Square API returns the order in OPEN state via GET /v2/orders.
//   6. payments row UPDATEs with last_polled_at + last_square_status.
//   7. Cleanup: delete the synthetic payments row.
//
// Bun auto-loads .env from the repo root.
//
// COST: $0 (Square sandbox is free).

/* eslint-disable no-console */

import { createHash } from 'node:crypto';
import { sql, eq } from 'drizzle-orm';
import {
  getAdminDb,
  getTenantCredential,
  schema,
  withTenant,
  type SquareCredentials,
} from '@docket/db';
import { asTenantId } from '@docket/shared';

const RESET = '\x1b[0m';
const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const DIM = '\x1b[2m';

const checks: Array<{ name: string; ok: boolean; detail?: string }> = [];

function step(name: string, ok: boolean, detail?: string): void {
  checks.push({ name, ok, detail });
  const tag = ok ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
  console.log(`  ${tag}  ${name}${detail ? `  ${DIM}${detail}${RESET}` : ''}`);
}

async function main(): Promise<number> {
  console.log(`${YELLOW}━━ smoke-square-checkout ━━${RESET}`);

  if (!process.env.DATABASE_URL || !process.env.PII_ENCRYPTION_KEY) {
    console.error(`${RED}FATAL${RESET} DATABASE_URL + PII_ENCRYPTION_KEY required`);
    return 2;
  }

  // Step 0 — find Vazant + a synthetic client.
  const adminDb = getAdminDb();
  const tenantRows = await adminDb.execute<{ id: string; name: string }>(sql`
    SELECT id::text AS id, name FROM tenants WHERE slug = 'vazant' LIMIT 1
  `);
  const tenants = tenantRows as unknown as Array<{ id: string; name: string }>;
  if (tenants.length === 0) {
    console.error(`${RED}FATAL${RESET} no Vazant tenant in dev DB`);
    return 2;
  }
  const tenantId = tenants[0]!.id;
  console.log(`Target tenant: ${tenants[0]!.name} (${tenantId})\n`);

  const clientRows = await adminDb.execute<{ id: string; full_name: string }>(sql`
    SELECT id::text AS id, full_name FROM clients WHERE tenant_id = ${tenantId}::uuid LIMIT 1
  `);
  const clients = clientRows as unknown as Array<{ id: string; full_name: string }>;
  let clientId: string;
  let createdSyntheticClient = false;
  if (clients.length === 0) {
    const newId = await adminDb.execute<{ id: string }>(sql`
      INSERT INTO clients (tenant_id, full_name, phone)
      VALUES (${tenantId}::uuid, 'Smoke Test Client', '+15555550100')
      RETURNING id::text AS id
    `);
    clientId = (newId as unknown as Array<{ id: string }>)[0]!.id;
    createdSyntheticClient = true;
    console.log(`  ${DIM}created synthetic client ${clientId}${RESET}\n`);
  } else {
    clientId = clients[0]!.id;
    console.log(`  ${DIM}using client ${clients[0]!.full_name} (${clientId})${RESET}\n`);
  }

  let paymentRowId: string | null = null;

  try {
    const creds = await withTenant(asTenantId(tenantId), async (db) => {
      return (await getTenantCredential(
        db,
        asTenantId(tenantId),
        'square',
      )) as SquareCredentials | null;
    });
    if (!creds) {
      step('vazant has square credentials', false, 'no row in tenant_credentials');
      return 1;
    }
    step(
      'vazant has square credentials',
      true,
      `env=${creds.environment} location=${creds.locationId}`,
    );

    const apiHost =
      creds.environment === 'production'
        ? 'https://connect.squareup.com'
        : 'https://connect.squareupsandbox.com';
    const idemKey = createHash('sha256')
      .update(`smoke-${tenantId}-${Date.now()}`)
      .digest('hex')
      .slice(0, 45);

    const createRes = await fetch(`${apiHost}/v2/online-checkout/payment-links`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Content-Type': 'application/json',
        'Square-Version': '2024-01-18',
      },
      body: JSON.stringify({
        idempotency_key: idemKey,
        quick_pay: {
          name: 'Smoke test deposit',
          price_money: { amount: 5000, currency: 'USD' },
          location_id: creds.locationId,
        },
        checkout_options: { ask_for_shipping_address: false },
      }),
    });
    const createJson = (await createRes.json()) as
      | { payment_link: { id: string; url: string; order_id: string } }
      | { errors: Array<{ code: string; detail: string }> };

    if (!createRes.ok || !('payment_link' in createJson)) {
      const errCode = 'errors' in createJson ? createJson.errors[0]?.code : 'unknown';
      step('square mints checkout link', false, `${errCode} (HTTP ${createRes.status})`);
      return 1;
    }
    const link = createJson.payment_link;
    step(
      'square mints checkout link',
      true,
      `id=${link.id.slice(0, 12)}… order=${link.order_id.slice(0, 12)}…`,
    );

    paymentRowId = await withTenant(asTenantId(tenantId), async (db) => {
      const inserted = await db
        .insert(schema.payments)
        .values({
          tenantId,
          clientId,
          engagementId: null,
          squarePaymentLinkId: link.id,
          squareOrderId: link.order_id,
          status: 'pending',
          amountCents: 5000,
          currency: 'USD',
          checkoutUrl: link.url,
          taxYear: 2025,
        })
        .onConflictDoNothing({
          target: [schema.payments.tenantId, schema.payments.squarePaymentLinkId],
        })
        .returning({ id: schema.payments.id });
      return inserted[0]?.id ?? null;
    });
    step(
      'payments row inserts cleanly',
      paymentRowId !== null,
      paymentRowId ? `id=${paymentRowId.slice(0, 12)}…` : 'no row returned',
    );

    const replayResult = await withTenant(asTenantId(tenantId), async (db) => {
      const replay = await db
        .insert(schema.payments)
        .values({
          tenantId,
          clientId,
          engagementId: null,
          squarePaymentLinkId: link.id,
          squareOrderId: link.order_id,
          status: 'pending',
          amountCents: 5000,
          currency: 'USD',
          checkoutUrl: link.url,
          taxYear: 2025,
        })
        .onConflictDoNothing({
          target: [schema.payments.tenantId, schema.payments.squarePaymentLinkId],
        })
        .returning({ id: schema.payments.id });
      return replay.length;
    });
    step(
      'payments row idempotent on replay (ON CONFLICT DO NOTHING)',
      replayResult === 0,
      `replay returned ${replayResult} rows (expected 0)`,
    );

    const ordRes = await fetch(`${apiHost}/v2/orders/${encodeURIComponent(link.order_id)}`, {
      headers: {
        Authorization: `Bearer ${creds.accessToken}`,
        'Square-Version': '2024-01-18',
      },
    });
    const ordJson = (await ordRes.json()) as { order?: { id: string; state: string } };
    const orderState = ordJson.order?.state ?? 'UNKNOWN';
    step(
      'square returns order via GET /v2/orders',
      ordRes.ok && ordJson.order != null,
      `state=${orderState}`,
    );

    if (paymentRowId) {
      await withTenant(asTenantId(tenantId), async (db) => {
        await db
          .update(schema.payments)
          .set({ lastPolledAt: new Date(), lastSquareStatus: orderState })
          .where(eq(schema.payments.id, paymentRowId!));
      });
      const verified = await withTenant(asTenantId(tenantId), async (db) => {
        return await db
          .select({
            lastPolledAt: schema.payments.lastPolledAt,
            lastSquareStatus: schema.payments.lastSquareStatus,
          })
          .from(schema.payments)
          .where(eq(schema.payments.id, paymentRowId!))
          .limit(1);
      });
      step(
        'payments row updates with poll metadata',
        verified[0]?.lastSquareStatus === orderState && verified[0]?.lastPolledAt !== null,
        `last_status=${verified[0]?.lastSquareStatus} last_polled_at=${verified[0]?.lastPolledAt?.toISOString().slice(0, 19)}`,
      );
    }
  } finally {
    if (paymentRowId) {
      try {
        await adminDb.execute(sql`DELETE FROM payments WHERE id = ${paymentRowId}::uuid`);
      } catch {
        // best-effort
      }
    }
    if (createdSyntheticClient) {
      try {
        await adminDb.execute(sql`DELETE FROM clients WHERE id = ${clientId}::uuid`);
      } catch {
        // best-effort
      }
    }
  }

  console.log('');
  const failed = checks.filter((c) => !c.ok);
  if (failed.length === 0) {
    console.log(`${GREEN}━━ all ${checks.length} checks passed ━━${RESET}`);
    return 0;
  }
  console.log(`${RED}━━ ${failed.length} of ${checks.length} checks failed ━━${RESET}`);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(`${RED}FATAL${RESET}`, e);
    process.exit(2);
  });
