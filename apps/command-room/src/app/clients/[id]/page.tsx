// Per-client view. Server Component. Loads:
//   - client record
//   - latest engagement
//   - open issues
//   - recent messages
//   - intake_responses (decrypted + masked)  ← Day 5 wiring
//   - documents (uploaded files for this client)
//   - signatures (engagement letter, §7216 consent, 8879)
// All scoped by tenant via withTenant() (RLS enforced).

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { buildTheme } from '@docket/ui';
import { withTenant, schema } from '@docket/db/client';
import { decryptTreeWithAAD, deriveAAD, getTenantDek } from '@docket/db';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { requireRole } from '@/lib/require-role';
import { CommandShell } from '@/components/command-shell';
import { IntakeSummary } from '@/components/intake-summary';
import { DocumentsSection } from '@/components/documents-section';
import { SignaturesSection } from '@/components/signatures-section';
import { Sign8879Form } from '@/components/sign-8879-form';
import { DepositWaiverToggle } from '@/components/deposit-waiver-toggle';
import { PaymentsSection, type PaymentRow } from '@/components/payments-section';
import { DeleteClientButton } from '@/components/delete-client-button';
import { PIIUnlockProvider } from '@/components/pii-unlock-provider';
import { PIIUnlockButton } from '@/components/pii-unlock-button';
import { ClientMemoriesSection, type ClientMemory } from '@/components/client-memories-section';
import {
  ClientProjectPicker,
  type AttachedProject,
  type AvailableProject,
} from '@/components/client-project-picker';
import { hasRole } from '@/lib/require-role';
import type { TenantId, IntakeState } from '@docket/shared';
import { asTenantId, maskSensitiveFields } from '@docket/shared';

type PageProps = { params: Promise<{ id: string }> };

export default async function ClientDetailPage({ params }: PageProps) {
  const { id } = await params;
  // The detail page surfaces engagement fees, internal notes, message
  // history, and open issues — sensitive practice context. Narrow to
  // roles that touch the actual prep work; admin + assistant get
  // bounced to /clients (basic list view they can use for triage but
  // not deep dives). When a per-client billing surface exists, it'll
  // be a sibling route gated to ['firm_owner', 'admin'].
  const user = await requireRole(['firm_owner', 'preparer', 'reviewer']);

  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });

  const data = await withTenant(user.tenantId as TenantId, async (db) => {
    const [client] = await db
      .select()
      .from(schema.clients)
      .where(eq(schema.clients.id, id))
      .limit(1);

    if (!client) return null;

    const [engagement] = await db
      .select()
      .from(schema.engagements)
      .where(eq(schema.engagements.clientId, id))
      .orderBy(desc(schema.engagements.createdAt))
      .limit(1);

    const issues = await db
      .select()
      .from(schema.issues)
      .where(and(eq(schema.issues.clientId, id), eq(schema.issues.status, 'open')))
      .orderBy(desc(schema.issues.createdAt));

    const messages = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.clientId, id))
      .orderBy(desc(schema.messages.createdAt))
      .limit(50);

    // Intake responses — decrypt with tenant DEK, mask sensitive paths
    // (SSN/EIN/bank). Antonio sees masked values by default; the
    // per-session unlock flow lives in lib/intake/unlock.ts. One click
    // on the "Show SSN, EIN, bank" button unlocks all sensitive surfaces
    // for 15 minutes, then auto-locks. ONE audit row per unlock (not
    // per field viewed). Role-gated firm_owner | preparer | reviewer.
    // PIIUnlockProvider holds the unlock state on the client; MaskedPII
    // consumes the context to flip between masked + plaintext.
    const dek = await getTenantDek(db, asTenantId(user.tenantId));
    const [intakeRow] = await db
      .select()
      .from(schema.intakeResponses)
      .where(eq(schema.intakeResponses.clientId, id))
      .orderBy(desc(schema.intakeResponses.taxYear))
      .limit(1);

    let intake: {
      taxYear: number;
      status: string;
      completedSteps: string[];
      answers: IntakeState;
      startedAt: Date;
      updatedAt: Date;
      completedAt: Date | null;
    } | null = null;
    if (intakeRow) {
      // AAD-aware tree decrypt: mirrors what saveIntakeField writes.
      // (tenantId, clientId, taxYear, path) tuple. Pre-AAD + master-KEK
      // legacy leaves fall through the 3-tier fallback inside
      // decryptIfMarkedForTenantWithAAD.
      const intakeTaxYear = intakeRow.taxYear;
      const decrypted = decryptTreeWithAAD(
        intakeRow.answers ?? {},
        dek,
        (leafPath) =>
          deriveAAD({
            tenantId: user.tenantId,
            clientId: id,
            taxYear: intakeTaxYear,
            path: leafPath,
          }),
      ) as IntakeState;
      intake = {
        taxYear: intakeRow.taxYear,
        status: intakeRow.status,
        completedSteps: intakeRow.completedSteps,
        answers: maskSensitiveFields(decrypted),
        startedAt: intakeRow.startedAt,
        updatedAt: intakeRow.updatedAt,
        completedAt: intakeRow.completedAt,
      };
    }

    // Filter out rows that have been merged into a composite (today:
    // DL front merged into back's 2-page PDF). Those rows still hold
    // their raw upload for "view raw" debug, but they shouldn't show
    // up as standalone entries in the listing — the composite row is
    // what Antonio cares about.
    const documents = await db
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.clientId, id),
          isNull(schema.documents.mergedIntoDocumentId),
        ),
      )
      .orderBy(desc(schema.documents.createdAt));

    const signatures = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.clientId, id))
      .orderBy(desc(schema.signatures.createdAt));

    // Memories — plain-English bullets of "what we know" surfaced
    // as a first-class object on the client page. Slant-validated
    // primitive (CLAUDE.md §4 Memories tab + §8 Memories section).
    // RLS-scoped via withTenant; pinned + recent ordering at the
    // index level (client_memories_active_idx).
    const memoriesRaw = await db
      .select({
        id: schema.clientMemories.id,
        text: schema.clientMemories.text,
        pinned: schema.clientMemories.pinned,
        dismissed: schema.clientMemories.dismissed,
        sourceKind: schema.clientMemories.sourceKind,
        extractedByAgent: schema.clientMemories.extractedByAgent,
        confidence: schema.clientMemories.confidence,
        createdAt: schema.clientMemories.createdAt,
        updatedAt: schema.clientMemories.updatedAt,
      })
      .from(schema.clientMemories)
      .where(eq(schema.clientMemories.clientId, id))
      .orderBy(desc(schema.clientMemories.pinned), desc(schema.clientMemories.createdAt));

    // Square Checkout deposit links for this client. Surfaces in the
    // Deposits section (sibling to Engagement). Hide the row's
    // checkout_url is non-secret (already a hosted Square URL the
    // client gets sent), but the Refresh action is firm_owner|preparer
    // gated server-side regardless of what the UI shows.
    const payments = await db
      .select({
        id: schema.payments.id,
        status: schema.payments.status,
        amountCents: schema.payments.amountCents,
        collectedCents: schema.payments.collectedCents,
        refundedCents: schema.payments.refundedCents,
        currency: schema.payments.currency,
        checkoutUrl: schema.payments.checkoutUrl,
        taxYear: schema.payments.taxYear,
        paidAt: schema.payments.paidAt,
        refundedAt: schema.payments.refundedAt,
        lastPolledAt: schema.payments.lastPolledAt,
        lastSquareStatus: schema.payments.lastSquareStatus,
        createdAt: schema.payments.createdAt,
      })
      .from(schema.payments)
      .where(eq(schema.payments.clientId, id))
      .orderBy(desc(schema.payments.createdAt));

    // Probe which integration credentials the tenant has. Drives
    // whether per-section CTAs render in their "configured" or
    // "not yet configured" state. tenant_credentials is RLS-scoped
    // via withTenant so this is safe (one round-trip, returns kinds
    // for THIS tenant only).
    const credRows = await db
      .select({ kind: schema.tenantCredentials.kind })
      .from(schema.tenantCredentials);
    const credKinds = new Set(credRows.map((r) => r.kind));
    const hasSquareCred = credKinds.has('square');
    const hasDocuSignCred = credKinds.has('docusign');

    // Projects attached to the current engagement + the broader
    // pool of non-template active projects this engagement could
    // attach to. Picker hides entirely when there's no engagement.
    // Two queries (one JOIN, one filtered SELECT) — both RLS-scoped
    // via withTenant so cross-tenant rows can never surface.
    // LIMIT 200 on available is the v0 cap: firms with more than
    // 200 active project instances will need pagination in V1.5.
    let attachedProjects: AttachedProject[] = [];
    let availableProjects: AvailableProject[] = [];
    if (engagement) {
      const attachedRows = await db.execute<{
        id: string;
        kind: string;
        name: string;
        taxYear: number | null;
        colorHint: string | null;
        isPrimary: boolean;
        addedAt: string;
      }>(sql`
        SELECT
          p.id::text AS id,
          p.kind,
          p.name,
          p.tax_year AS "taxYear",
          p.color_hint AS "colorHint",
          ep.is_primary AS "isPrimary",
          to_char(ep.added_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "addedAt"
        FROM engagement_projects ep
        JOIN projects p ON p.id = ep.project_id
        WHERE ep.engagement_id = ${engagement.id}::uuid
        ORDER BY ep.is_primary DESC, ep.added_at DESC
      `);
      attachedProjects = attachedRows as unknown as AttachedProject[];

      // v0: templates are valid attachment targets. Codex round 1
      // caught that without this, the picker was unreachable — the
      // only in-product way to create projects today is the
      // /projects seed-button which inserts is_template=true rows.
      // V1.5 will add a "clone template → instance" flow; until
      // then, an engagement attaching to "Annual Return Prep" (a
      // template) is the natural verb. Templates sort first so
      // the most-common attachment targets surface at the top.
      //
      // Codex round 3 P2: exclude already-attached projects in SQL
      // BEFORE LIMIT, not after. Without this, tenants with >200
      // active projects whose engagement is attached to the first
      // 200 sorted rows would see candidates.length === 0 and the
      // "All available projects are attached" empty state even
      // though projects 201+ are still unattached.
      //
      // Codex round 5 P2: also exclude templates whose derived
      // instance is already attached to this engagement. After
      // clone-on-attach (round 4 fix), the engagement_projects
      // row points at the instance, not the template. The naive
      // anti-join would still surface the template as available,
      // and another attach would just re-find the same derived
      // instance — a confusing repeat-attach no-op. The added
      // EXISTS-via-source_template_id branch closes that loop.
      const availableRows = await db.execute<{
        id: string;
        kind: string;
        name: string;
        taxYear: number | null;
        colorHint: string | null;
      }>(sql`
        SELECT
          p.id::text AS id,
          p.kind,
          p.name,
          p.tax_year AS "taxYear",
          p.color_hint AS "colorHint"
        FROM projects p
        WHERE p.is_active
          AND NOT EXISTS (
            SELECT 1
              FROM engagement_projects ep
             WHERE ep.engagement_id = ${engagement.id}::uuid
               AND (
                 ep.project_id = p.id
                 OR ep.project_id IN (
                   SELECT pi.id
                     FROM projects pi
                    WHERE pi.source_template_id = p.id
                 )
               )
          )
        ORDER BY p.is_template DESC, p.name
        LIMIT 200
      `);
      availableProjects = availableRows as unknown as AvailableProject[];
    }

    return {
      client,
      engagement,
      issues,
      messages: messages.reverse(),
      intake,
      documents,
      signatures,
      payments,
      hasSquareCred,
      hasDocuSignCred,
      attachedProjects,
      availableProjects,
      memories: memoriesRaw.map((m) => ({
        id: m.id,
        text: m.text,
        pinned: m.pinned,
        dismissed: m.dismissed,
        sourceKind: m.sourceKind,
        extractedByAgent: m.extractedByAgent,
        confidence: m.confidence,
        createdAt: m.createdAt.toISOString(),
        updatedAt: m.updatedAt.toISOString(),
      })),
    };
  });

  if (!data) notFound();
  const { client, engagement, issues, messages, intake, documents, signatures, payments, hasSquareCred, hasDocuSignCred, attachedProjects, availableProjects, memories } = data;
  const canEditProjects = hasRole(user, ['firm_owner', 'preparer', 'reviewer']);

  const initials = client.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <CommandShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
      tenantName={user.tenantName}
      activeHref="/clients"
    >
      <div style={{ padding: '32px 36px 60px', maxWidth: 1200 }}>
        {/* Breadcrumb */}
        <Link
          href="/clients"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontFamily: t.sans,
            fontSize: 13,
            color: t.muted,
            textDecoration: 'none',
            marginBottom: 16,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M9 3l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          All clients
        </Link>

        {/* Header */}
        <header style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 28 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: `radial-gradient(circle at 30% 30%, ${t.rustSoft}, ${t.bgElev})`,
              border: `1px solid ${t.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: t.serif,
              fontSize: 22,
              color: t.rustInk,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1
              style={{
                fontFamily: t.serif,
                fontSize: 32,
                color: t.ink,
                letterSpacing: -0.6,
                margin: 0,
                marginBottom: 4,
              }}
            >
              {client.fullName}
            </h1>
            <div
              style={{
                display: 'flex',
                gap: 14,
                fontFamily: t.mono,
                fontSize: 12,
                color: t.muted,
                letterSpacing: 0.3,
              }}
            >
              {client.email && <span>{client.email}</span>}
              {client.phone && <span>{client.phone}</span>}
              {client.state && <span>{client.state}</span>}
              {client.preferredLanguage !== 'en' && (
                <span style={{ textTransform: 'uppercase' }}>{client.preferredLanguage}</span>
              )}
            </div>
          </div>
        </header>

        <PIIUnlockProvider clientId={client.id}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 1fr',
            gap: 28,
            alignItems: 'flex-start',
          }}
        >
          {/* Left column — intake summary, documents, signatures, engagement, messages */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <Section
              t={t}
              label="Intake"
              actions={
                hasRole(user, ['firm_owner', 'preparer', 'reviewer']) && intake ? (
                  <PIIUnlockButton t={t} />
                ) : null
              }
            >
              <IntakeSummary t={t} intake={intake} />
            </Section>

            <Section
              t={t}
              label="Documents"
              count={documents.length > 0 ? documents.length : undefined}
            >
              <DocumentsSection t={t} documents={documents} />
            </Section>

            <Section
              t={t}
              label="Signatures"
              count={signatures.length > 0 ? signatures.length : undefined}
            >
              <SignaturesSection
                t={t}
                signatures={signatures}
                canRefresh={hasRole(user, ['firm_owner', 'preparer'])}
              />
              <Sign8879Form
                t={t}
                clientId={client.id}
                defaultTaxYear={engagement?.taxYear ?? new Date().getFullYear()}
                portalBaseUrl={
                  process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL ?? 'https://docket-portal.vercel.app'
                }
                canRequest={hasRole(user, ['firm_owner', 'preparer'])}
                hasDocuSignCred={hasDocuSignCred}
              />
            </Section>

            <Section t={t} label="Engagement">
              {engagement ? (
                <div
                  style={{
                    background: t.card,
                    border: `1px solid ${t.border}`,
                    borderRadius: 14,
                    padding: '18px 20px',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
                    <div>
                      <div style={{ fontFamily: t.serif, fontSize: 19, color: t.ink, letterSpacing: -0.2 }}>
                        {humanizeEngagementType(engagement.type)}
                      </div>
                      <div style={{ fontFamily: t.mono, fontSize: 11, color: t.muted, marginTop: 4, letterSpacing: 0.3 }}>
                        TY {engagement.taxYear ?? '—'} · {engagement.status}
                      </div>
                    </div>
                    {engagement.deadline && (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: t.mono, fontSize: 9.5, color: t.muted, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                          Deadline
                        </div>
                        <div style={{ fontFamily: t.serif, fontSize: 15, color: t.ink, marginTop: 2 }}>
                          {new Date(engagement.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                      </div>
                    )}
                  </div>
                  {engagement.feeQuotedCents != null && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.borderSoft}`, display: 'flex', gap: 24, fontSize: 13, color: t.inkSoft }}>
                      <span><span style={{ color: t.muted }}>Quoted:</span> ${(engagement.feeQuotedCents / 100).toLocaleString()}</span>
                      <span><span style={{ color: t.muted }}>Deposit:</span> ${(engagement.depositPaidCents / 100).toLocaleString()}</span>
                      <span><span style={{ color: t.muted }}>Collected:</span> ${(engagement.feeCollectedCents / 100).toLocaleString()}</span>
                    </div>
                  )}
                  {engagement.notes && (
                    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${t.borderSoft}`, fontSize: 13.5, color: t.inkSoft, lineHeight: 1.5, fontStyle: 'italic' }}>
                      &ldquo;{engagement.notes}&rdquo;
                    </div>
                  )}
                  <DepositWaiverToggle
                    t={t}
                    engagementId={engagement.id}
                    initialWaived={engagement.depositWaived}
                    canEdit={hasRole(user, ['firm_owner', 'preparer'])}
                  />
                </div>
              ) : (
                <EmptyCard t={t} text="No engagement yet" />
              )}
              {/* Project assignment — attach the current engagement
                  to one or more projects (the third organizing primitive
                  per CLAUDE.md §4). Picker hides entirely without an
                  engagement to anchor against. */}
              {engagement && (
                <ClientProjectPicker
                  engagementId={engagement.id}
                  attached={attachedProjects}
                  available={availableProjects}
                  canEdit={canEditProjects}
                />
              )}
            </Section>

            <Section t={t} label="Deposits" count={payments.length > 0 ? payments.length : undefined}>
              <PaymentsSection
                t={t}
                rows={payments.map((p) => ({
                  ...p,
                  // Status is text in the DB (CHECK-constrained to 6
                  // values); narrow at the server boundary so the UI
                  // never sees an unexpected value. Defensive default
                  // 'pending' covers a row written by a future migration
                  // that adds new states without updating this consumer.
                  status: narrowPaymentStatus(p.status),
                }))}
                clientId={client.id}
                defaultTaxYear={engagement?.taxYear ?? new Date().getFullYear()}
                hasSquareCred={hasSquareCred}
                canEdit={hasRole(user, ['firm_owner', 'preparer'])}
              />
            </Section>

            <Section t={t} label="Messages" count={messages.length > 0 ? messages.length : undefined}>
              <div
                style={{
                  background: t.card,
                  border: `1px solid ${t.border}`,
                  borderRadius: 14,
                  padding: messages.length > 0 ? '14px 16px' : '0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  maxHeight: 480,
                  overflowY: 'auto',
                }}
              >
                {messages.length === 0 ? (
                  <EmptyCard t={t} text="No messages yet" />
                ) : (
                  messages.map((m) => (
                    <MessageBubble key={m.id} t={t} from={m.direction === 'inbound' ? 'them' : 'me'} time={formatTime(m.createdAt)}>
                      {m.body}
                    </MessageBubble>
                  ))
                )}
              </div>
              {/* Composer (UI-only for now; sending lands in Layer 5) */}
              <ComposerStub t={t} />
            </Section>
          </div>

          {/* Right column — open issues */}
          <div>
            <Section t={t} label="Open issues" count={issues.length}>
              {issues.length === 0 ? (
                <EmptyCard t={t} text="No open issues" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {issues.map((iss) => (
                    <div
                      key={iss.id}
                      style={{
                        background: t.card,
                        border: `1px solid ${iss.severity === 'high' ? t.rust : t.border}`,
                        borderLeft: `3px solid ${iss.severity === 'high' ? t.rust : iss.severity === 'medium' ? '#D9A441' : t.border}`,
                        borderRadius: 10,
                        padding: '12px 14px',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                        <span
                          style={{
                            fontFamily: t.mono,
                            fontSize: 9.5,
                            color: t.rustInk,
                            letterSpacing: 0.6,
                            textTransform: 'uppercase',
                          }}
                        >
                          {humanizeIssueType(iss.type)}
                        </span>
                        <span
                          style={{
                            fontFamily: t.mono,
                            fontSize: 9,
                            color: t.muted,
                            letterSpacing: 0.4,
                            textTransform: 'uppercase',
                          }}
                        >
                          {iss.severity}
                        </span>
                      </div>
                      <div style={{ fontSize: 14, color: t.ink, fontWeight: 500, lineHeight: 1.35, marginBottom: 4 }}>
                        {iss.title}
                      </div>
                      <div style={{ fontSize: 12.5, color: t.inkSoft, lineHeight: 1.4 }}>
                        {iss.summary}
                      </div>
                      {iss.recommendedAction && (
                        <div
                          style={{
                            marginTop: 10,
                            paddingTop: 8,
                            borderTop: `1px dashed ${t.borderSoft}`,
                            fontSize: 12,
                            color: t.muted,
                            fontStyle: 'italic',
                          }}
                        >
                          → {iss.recommendedAction}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        </div>
        </PIIUnlockProvider>

        {/* Memories section — Slant-validated primitive. Renders
            below the two-column main layout so it spans full width.
            Plain-English bullets of "what we know" about this client,
            curated by the Memory Curator agent (V1.5) + manually
            editable by firm_owner/preparer/reviewer roles. */}
        <ClientMemoriesSection
          clientId={client.id}
          clientName={client.fullName ?? 'this client'}
          memories={memories as ClientMemory[]}
          canEdit={hasRole(user, ['firm_owner', 'preparer', 'reviewer'])}
        />

        {/* Danger zone — delete client. firm_owner + admin only.
            CCPA right-to-delete path: cascades intake_responses,
            documents, messages, signatures, engagements, issues;
            actions audit history is preserved with client_id null. */}
        {hasRole(user, ['firm_owner', 'admin']) && (
          <div
            style={{
              marginTop: 48,
              paddingTop: 24,
              borderTop: `1px dashed ${t.borderSoft}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: t.mono,
                  fontSize: 9.5,
                  color: t.muted,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                Danger zone
              </div>
              <div style={{ fontSize: 13, color: t.inkSoft, lineHeight: 1.4 }}>
                Permanently delete this client and everything tied to them.
                The audit log keeps the trail.
              </div>
            </div>
            <DeleteClientButton clientId={client.id} clientName={client.fullName} />
          </div>
        )}
      </div>
    </CommandShell>
  );
}

function Section({
  t,
  label,
  count,
  actions,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  label: string;
  count?: number;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontFamily: t.mono,
              fontSize: 10.5,
              color: t.muted,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            {label}
          </span>
          {count !== undefined && (
            <span
              style={{
                fontFamily: t.mono,
                fontSize: 10.5,
                color: t.rustInk,
                letterSpacing: 0.4,
              }}
            >
              {count}
            </span>
          )}
        </div>
        {actions ? <div>{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyCard({ t, text }: { t: ReturnType<typeof buildTheme>; text: string }) {
  return (
    <div
      style={{
        background: t.card,
        border: `1px dashed ${t.border}`,
        borderRadius: 10,
        padding: '24px 20px',
        textAlign: 'center',
        fontSize: 13,
        color: t.muted,
      }}
    >
      {text}
    </div>
  );
}

function MessageBubble({
  t,
  from,
  time,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  from: 'me' | 'them';
  time?: string;
  children: React.ReactNode;
}) {
  const mine = from === 'me';
  return (
    <div style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
      <div style={{ maxWidth: '78%' }}>
        <div
          style={{
            background: mine ? t.rust : t.bgElev,
            color: mine ? '#fff' : t.ink,
            border: mine ? 'none' : `1px solid ${t.borderSoft}`,
            borderRadius: 16,
            borderBottomRightRadius: mine ? 4 : 16,
            borderBottomLeftRadius: mine ? 16 : 4,
            padding: '8px 12px',
            fontSize: 13.5,
            lineHeight: 1.4,
          }}
        >
          {children}
        </div>
        {time && (
          <div
            style={{
              textAlign: mine ? 'right' : 'left',
              fontSize: 9.5,
              color: t.muted,
              fontFamily: t.mono,
              letterSpacing: 0.3,
              marginTop: 3,
              padding: '0 6px',
            }}
          >
            {time}
          </div>
        )}
      </div>
    </div>
  );
}

function ComposerStub({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <div
      style={{
        marginTop: 10,
        background: t.card,
        border: `1px solid ${t.border}`,
        borderRadius: 999,
        padding: '6px 8px 6px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        opacity: 0.6,
        cursor: 'not-allowed',
      }}
      title="Sending lands in Layer 5"
    >
      <span style={{ flex: 1, fontSize: 13, color: t.muted, fontStyle: 'italic' }}>
        Reply as Antonio · sending wired in Layer 5
      </span>
      <button
        disabled
        style={{
          background: t.borderSoft,
          color: t.muted,
          border: 'none',
          borderRadius: 999,
          padding: '6px 14px',
          fontSize: 12,
          fontFamily: t.sans,
          cursor: 'not-allowed',
        }}
      >
        Send
      </button>
    </div>
  );
}

function formatTime(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

const ENGAGEMENT_LABEL: Record<string, string> = {
  return_1040: '1040 individual return',
  return_1120s: '1120-S corporation',
  return_1065: '1065 partnership',
  return_1120: '1120 C-corporation',
  representation: 'IRS representation',
  advisory: 'Advisory',
  bookkeeping: 'Bookkeeping',
};

function humanizeEngagementType(t: string): string {
  return ENGAGEMENT_LABEL[t] ?? t;
}

const KNOWN_PAYMENT_STATUSES = new Set<PaymentRow['status']>([
  'pending',
  'paid',
  'partial',
  'refunded',
  'cancelled',
  'failed',
]);
function narrowPaymentStatus(raw: string): PaymentRow['status'] {
  return KNOWN_PAYMENT_STATUSES.has(raw as PaymentRow['status'])
    ? (raw as PaymentRow['status'])
    : 'pending';
}

const ISSUE_LABEL: Record<string, string> = {
  doc_mismatch: 'Doc mismatch',
  doc_gap: 'Missing doc',
  ero_pending: 'ERO pending',
  prep_decision: 'Prep decision',
  signature_pending: 'Signature pending',
  extension_risk: 'Extension risk',
  payment_status: 'Payment',
  meeting_prep: 'Meeting prep',
  missing_info: 'Missing info',
  quick_reply: 'Quick reply',
  irs_notice: 'IRS notice',
};

function humanizeIssueType(t: string): string {
  return ISSUE_LABEL[t] ?? t;
}
