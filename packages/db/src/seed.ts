// Seed data for Docket v0.
//
// Creates Antonio at Vazant Consulting (tenant 0) + 10 realistic mock clients
// matching the v4 dashboard screenshots. Populates engagements, documents,
// messages, issues, and historical actions so the Triage view shows real data
// from day 1.
//
// Run: pnpm --filter @docket/db seed
// Requires: DATABASE_URL env var pointing to a Neon Postgres instance.

import { config as loadEnv } from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { sql } from 'drizzle-orm';
import {
  tenants,
  users,
  clients,
  engagements,
  issues,
  documents,
  messages,
  signatures,
  actions,
} from './schema.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env.local'), override: true });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('✗ DATABASE_URL not set. Wire your Neon connection string into .env.local first.');
  process.exit(1);
}

const client = postgres(DATABASE_URL, { max: 1 });
const db = drizzle(client);

const NOW = new Date();
const days = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);
const minutes = (n: number) => new Date(NOW.getTime() + n * 60 * 1000);

async function reset() {
  console.log('▸ truncating existing data...');
  await db.execute(sql`TRUNCATE actions, signatures, issues, engagements, messages, documents, clients, users, tenants RESTART IDENTITY CASCADE`);
}

async function seed() {
  console.log('▸ docket-db seed');
  console.log(`  database: ${DATABASE_URL!.replace(/:[^:@]+@/, ':****@')}`);

  if (process.argv.includes('--reset')) await reset();

  // ──────────────────────────────────────────────────────────────
  // TENANT 0 — Vazant Consulting
  // ──────────────────────────────────────────────────────────────
  const [vazant] = await db
    .insert(tenants)
    .values({
      name: 'Vazant Consulting',
      slug: 'vazant',
      timezone: 'America/Los_Angeles',
      defaultTrustLevel: '1',
    })
    .returning();
  if (!vazant) throw new Error('failed to insert tenant');
  console.log(`  ✓ tenant: ${vazant.name} (${vazant.id})`);

  // Antonio Ramirez — Owner
  const [antonio] = await db
    .insert(users)
    .values({
      tenantId: vazant.id,
      clerkUserId: 'user_seed_antonio',
      email: 'antonio@vazantconsulting.com',
      name: 'Antonio Ramirez',
      role: 'owner',
    })
    .returning();
  if (!antonio) throw new Error('failed to insert user');
  console.log(`  ✓ user: ${antonio.name}`);

  // ──────────────────────────────────────────────────────────────
  // 10 CLIENTS — matching v4 dashboard screenshots
  // ──────────────────────────────────────────────────────────────
  const clientSeeds = [
    { fullName: 'Priya Sharma',                email: 'priya.sharma@example.com',    phone: '+15555550101', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'James & Sofia Rodriguez',     email: 'james.rodriguez@example.com', phone: '+15555550102', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Miguel Sandoval',             email: 'miguel@sandovalholdings.com', phone: '+15555550103', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Aisha Johnson',               email: 'aisha.johnson@example.com',   phone: '+15555550104', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Mei-Lin Wu',                  email: 'meilin.wu@example.com',       phone: '+15555550105', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Carlos & Elena Mendez',       email: 'carlos@mendezpaint.com',      phone: '+15555550106', state: 'CA', preferredLanguage: 'es' },
    { fullName: 'David Park',                  email: 'david@parkconsulting.io',     phone: '+15555550107', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Anthony Russo',               email: 'tony.russo@example.com',      phone: '+15555550108', state: 'CA', preferredLanguage: 'en' },
    { fullName: 'Vladimir Petrov',             email: 'vlad.petrov@example.com',     phone: '+15555550109', state: 'NY', preferredLanguage: 'en' },
    { fullName: 'Sara Patel',                  email: 'sara.patel@example.com',      phone: '+15555550110', state: 'CA', preferredLanguage: 'en' },
  ];

  const insertedClients = await db
    .insert(clients)
    .values(
      clientSeeds.map((c) => ({
        tenantId: vazant.id,
        fullName: c.fullName,
        email: c.email,
        phone: c.phone,
        state: c.state,
        preferredLanguage: c.preferredLanguage,
        intakeStatus: 'complete',
        kycStatus: 'verified',
      })),
    )
    .returning();
  console.log(`  ✓ clients: ${insertedClients.length}`);

  const byName = (n: string) => insertedClients.find((c) => c.fullName === n)!;

  // ──────────────────────────────────────────────────────────────
  // ENGAGEMENTS — one per client for tax year 2025
  // ──────────────────────────────────────────────────────────────
  const engagementSeeds: Array<{ name: string; type: 'return_1040' | 'return_1120s' | 'return_1065' | 'representation'; status: 'docs' | 'prep' | 'review' | 'signature' | 'pay' | 'done' | 'intake' | 'extended'; feeQuoted: number; feeCollected: number; deposit: number; complexity: string[]; deadline: Date }> = [
    { name: 'Priya Sharma',            type: 'return_1040',  status: 'prep',      feeQuoted: 65000,  feeCollected: 0,     deposit: 50000,  complexity: ['social_media_income'], deadline: days(76) },
    { name: 'James & Sofia Rodriguez', type: 'return_1040',  status: 'signature', feeQuoted: 75000,  feeCollected: 75000, deposit: 50000,  complexity: ['joint'],               deadline: days(76) },
    { name: 'Miguel Sandoval',         type: 'return_1120s', status: 'prep',      feeQuoted: 165000, feeCollected: 0,     deposit: 50000,  complexity: ['s_corp', 'entity_decision'], deadline: days(76) },
    { name: 'Aisha Johnson',           type: 'return_1040',  status: 'signature', feeQuoted: 55000,  feeCollected: 55000, deposit: 50000,  complexity: [],                      deadline: days(76) },
    { name: 'Mei-Lin Wu',              type: 'return_1040',  status: 'docs',      feeQuoted: 85000,  feeCollected: 0,     deposit: 50000,  complexity: ['schedule_c'],          deadline: days(76) },
    { name: 'Carlos & Elena Mendez',   type: 'return_1065',  status: 'review',    feeQuoted: 195000, feeCollected: 50000, deposit: 50000,  complexity: ['partnership', 'multi_owner'], deadline: days(76) },
    { name: 'David Park',              type: 'return_1120s', status: 'prep',      feeQuoted: 145000, feeCollected: 50000, deposit: 50000,  complexity: ['s_corp', 'qbi'],       deadline: days(76) },
    { name: 'Anthony Russo',           type: 'return_1040',  status: 'docs',      feeQuoted: 95000,  feeCollected: 0,     deposit: 0,      complexity: ['capital_gains'],       deadline: days(76) },
    { name: 'Vladimir Petrov',         type: 'return_1040',  status: 'intake',    feeQuoted: 0,      feeCollected: 0,     deposit: 0,      complexity: ['complex_international'], deadline: days(76) },
    { name: 'Sara Patel',              type: 'return_1040',  status: 'docs',      feeQuoted: 65000,  feeCollected: 0,     deposit: 50000,  complexity: ['health_marketplace'],  deadline: days(76) },
  ];

  const insertedEngagements = await db
    .insert(engagements)
    .values(
      engagementSeeds.map((e) => ({
        tenantId: vazant.id,
        clientId: byName(e.name).id,
        type: e.type,
        status: e.status,
        taxYear: 2025,
        feeQuotedCents: e.feeQuoted,
        feeCollectedCents: e.feeCollected,
        depositPaidCents: e.deposit,
        deadline: e.deadline,
        complexityFlags: e.complexity,
      })),
    )
    .returning();
  console.log(`  ✓ engagements: ${insertedEngagements.length}`);

  const engByName = (n: string) => insertedEngagements.find((e) => e.clientId === byName(n).id)!;

  // ──────────────────────────────────────────────────────────────
  // ISSUES — the Triage queue. THIS IS THE PRODUCT.
  // ──────────────────────────────────────────────────────────────
  await db.insert(issues).values([
    {
      tenantId: vazant.id,
      clientId: byName('Priya Sharma').id,
      engagementId: engByName('Priya Sharma').id,
      type: 'doc_mismatch',
      severity: 'high',
      status: 'open',
      title: "Priya's TikTok 1099 doesn't match her intake",
      summary: "TikTok 1099 doesn't match intake — $4,320 vs $2,300 reported",
      whyThisMatters:
        "The 1099-NEC from TikTok shows $4,320 in earnings, which doesn't match the $2,300 Priya reported in her intake. We need to confirm the correct amount to avoid filing delays or IRS notices.",
      recommendedAction:
        'Send a message to Priya to confirm which amount is correct and request any additional TikTok income not received.',
      evidence: {
        intakeAmount: { value: 230000, source: 'Intake response (Jan 18)', confidence: 'high' },
        documentAmount: { value: 432000, source: 'TikTok 1099-NEC', confidence: 'high' },
        difference: 202000,
        field: 'income_1099_nec',
      },
      sources: [
        { kind: 'intake_response', ref: 'intake-priya-2025', label: 'Intake response (Jan 18)' },
        { kind: 'document', ref: 'doc-priya-1099', label: 'TikTok 1099-NEC' },
        { kind: 'prior_return', ref: 'return-priya-2024', label: 'Prior return (2024)' },
      ],
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.94,
      etaMinutes: 15,
    },
    {
      tenantId: vazant.id,
      clientId: byName('James & Sofia Rodriguez').id,
      engagementId: engByName('James & Sofia Rodriguez').id,
      type: 'ero_pending',
      severity: 'high',
      status: 'open',
      title: 'Rodriguez return ready for ERO countersignature',
      summary: 'Paid and signed, waiting on ERO countersignature — return is complete',
      whyThisMatters:
        'James and Sofia have paid their fee and signed Form 8879. Return is complete and ready to file pending ERO countersignature.',
      recommendedAction: 'Sign 8879 ERO authorization and queue for e-file.',
      sources: [
        { kind: 'document', ref: 'doc-rodriguez-8879', label: '8879 (signed by client Mar 12)' },
      ],
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.99,
      etaMinutes: 10,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Miguel Sandoval').id,
      engagementId: engByName('Miguel Sandoval').id,
      type: 'prep_decision',
      severity: 'medium',
      status: 'open',
      title: "Miguel's S-Corp vs LLC entity decision",
      summary: 'Prep-ready: S-Corp vs LLC discussion — call scheduled today at 11:00 AM',
      whyThisMatters:
        "Miguel is on the fence between continuing as an S-Corp vs. revoking and electing LLC pass-through. Decision affects 2025 prep approach. Call scheduled today at 11 AM.",
      recommendedAction:
        'Prepare comparison memo for the 11 AM call: S-corp reasonable comp scenarios vs LLC SE tax projections.',
      sources: [
        { kind: 'calendar_event', ref: 'cal-miguel-1100', label: 'Call today at 11:00 AM' },
      ],
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.88,
      etaMinutes: 20,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Aisha Johnson').id,
      engagementId: engByName('Aisha Johnson').id,
      type: 'signature_pending',
      severity: 'medium',
      status: 'open',
      title: 'Aisha — payment completed, ready for signature',
      summary: 'Payment completed, ready for signature — return is ready',
      recommendedAction: 'Send 8879 to Aisha for KBA + signature.',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.96,
      etaMinutes: 10,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Mei-Lin Wu').id,
      engagementId: engByName('Mei-Lin Wu').id,
      type: 'doc_gap',
      severity: 'medium',
      status: 'open',
      title: 'Mei-Lin uploaded a new Schedule C',
      summary: 'New Schedule C uploaded — needs review before prep',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.92,
      etaMinutes: 15,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Carlos & Elena Mendez').id,
      engagementId: engByName('Carlos & Elena Mendez').id,
      type: 'missing_info',
      severity: 'medium',
      status: 'open',
      title: "Mendez partnership: K-1s need review",
      summary: 'Partnership K-1s need review — 2 K-1s uploaded',
      recommendedAction: "Review the 2 partner K-1s; confirm allocation matches operating agreement.",
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.9,
      etaMinutes: 20,
    },
    {
      tenantId: vazant.id,
      clientId: byName('David Park').id,
      engagementId: engByName('David Park').id,
      type: 'meeting_prep',
      severity: 'medium',
      status: 'open',
      title: "David Park — call at 3 PM, prep brief ready",
      summary: 'Call at 3 PM, prep brief ready — client expects guidance on QBI',
      recommendedAction: 'Review QBI scenario brief before 3 PM call.',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.91,
      etaMinutes: 15,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Anthony Russo').id,
      engagementId: engByName('Anthony Russo').id,
      type: 'quick_reply',
      severity: 'low',
      status: 'open',
      title: 'Anthony — portal setup incomplete',
      summary: 'Portal setup incomplete — client replied this morning',
      recommendedAction: 'Send a short reply with the portal setup link.',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.97,
      etaMinutes: 5,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Vladimir Petrov').id,
      engagementId: engByName('Vladimir Petrov').id,
      type: 'extension_risk',
      severity: 'high',
      status: 'open',
      title: 'Vladimir — no portal activity in 12 days',
      summary: 'No portal activity in 12 days — extension likely needed',
      whyThisMatters:
        'Vladimir started intake 12 days ago and has not returned. Zero documents uploaded. With 12 days to go, an extension may be the only viable path. Reach out today.',
      recommendedAction:
        'Send Vladimir a personal note plus extension paperwork. Do not wait another week.',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.85,
      etaMinutes: 20,
    },
    {
      tenantId: vazant.id,
      clientId: byName('Sara Patel').id,
      engagementId: engByName('Sara Patel').id,
      type: 'missing_info',
      severity: 'medium',
      status: 'open',
      title: 'Sara — Missing 1095-A',
      summary: 'Missing 1095-A — requested 3 days ago',
      recommendedAction: 'Send a follow-up reminder for the 1095-A.',
      classifiedBy: 'triage-classifier',
      aiConfidence: 0.95,
      etaMinutes: 10,
    },
  ]);
  console.log(`  ✓ issues: 10 surfaced in Triage queue`);

  // ──────────────────────────────────────────────────────────────
  // MESSAGES — recent inbound that the Inbox Drafter can work on
  // ──────────────────────────────────────────────────────────────
  await db.insert(messages).values([
    {
      tenantId: vazant.id,
      clientId: byName('Priya Sharma').id,
      channel: 'portal_chat',
      direction: 'inbound',
      body: "Hi Antonio, I uploaded my 1099 from TikTok. Please let me know if you need anything else.",
      sentAt: minutes(-180),
    },
    {
      tenantId: vazant.id,
      clientId: byName('David Park').id,
      channel: 'email',
      direction: 'inbound',
      body: "Antonio — can we move our call to 3 PM today? I have a conflict at 1.",
      sentAt: minutes(-420),
    },
    {
      tenantId: vazant.id,
      clientId: byName('Carlos & Elena Mendez').id,
      channel: 'sms',
      direction: 'inbound',
      body: "Hola Antonio, una pregunta sobre la deducción de la cabina de pintura — ¿podemos deducir el 100%?",
      sentAt: days(-1),
    },
  ]);
  console.log(`  ✓ messages: 3 inbound (Inbox Drafter input)`);

  // ──────────────────────────────────────────────────────────────
  // SIGNATURES — pending engagement letters / 8879s
  // ──────────────────────────────────────────────────────────────
  await db.insert(signatures).values([
    {
      tenantId: vazant.id,
      clientId: byName('Aisha Johnson').id,
      engagementId: engByName('Aisha Johnson').id,
      type: 'form_8879',
      status: 'pending',
      kbaRequired: true,
    },
    {
      tenantId: vazant.id,
      clientId: byName('James & Sofia Rodriguez').id,
      engagementId: engByName('James & Sofia Rodriguez').id,
      type: 'form_8879',
      status: 'signed',
      kbaRequired: true,
      kbaPassedAt: days(-2),
      signedAt: days(-2),
      kbaProvider: 'lexisnexis',
    },
  ]);
  console.log(`  ✓ signatures: 2 (1 pending, 1 signed awaiting ERO)`);

  // ──────────────────────────────────────────────────────────────
  // ACTIONS — historical ledger entries (so practice intelligence has data)
  // ──────────────────────────────────────────────────────────────
  await db.insert(actions).values(
    Array.from({ length: 15 }).map((_, i) => ({
      tenantId: vazant.id,
      clientId: byName('Priya Sharma').id,
      userId: null,
      agentId: 'triage-classifier' as const,
      actionClass: 'classify' as const,
      toolName: 'classify_gmail_message',
      toolInput: { messageId: `gmail-msg-${i}` },
      toolOutput: { issueType: 'doc_mismatch', confidence: 0.94 },
      modelUsed: 'haiku-4-5' as const,
      inputTokens: 850,
      outputTokens: 120,
      cachedTokens: 600,
      costUsd: 0.0008,
      latencyMs: 1200,
      success: true,
      errorMessage: null,
    })),
  );
  console.log(`  ✓ actions: 15 historical ledger entries`);

  console.log('\n──────────────────────────────────────────────');
  console.log(`  ✓ Vazant Consulting seeded`);
  console.log(`  ✓ Antonio Ramirez (owner)`);
  console.log(`  ✓ ${insertedClients.length} clients · ${insertedEngagements.length} engagements`);
  console.log(`  ✓ 10 issues in Triage queue (mapped to v4 mockup)`);
  console.log(`  ✓ 15 historical actions (practice ledger has data)`);
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
