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
import { decryptTree, getTenantDek } from '@docket/db';
import { and, desc, eq } from 'drizzle-orm';
import { requireRole } from '@/lib/require-role';
import { AppShell } from '@/components/app-shell';
import { IntakeSummary } from '@/components/intake-summary';
import { DocumentsSection } from '@/components/documents-section';
import { SignaturesSection } from '@/components/signatures-section';
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
    // (SSN/EIN/bank). Antonio sees redacted values by default; the
    // preparer-side reveal flow (gated by assertRole + audit-logged)
    // lands as Day 6 work. For now the masked values let him see
    // what the client filled in without exposing plaintext PII to
    // every page render.
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
      const decrypted = decryptTree(intakeRow.answers ?? {}, dek) as IntakeState;
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

    const documents = await db
      .select()
      .from(schema.documents)
      .where(eq(schema.documents.clientId, id))
      .orderBy(desc(schema.documents.createdAt));

    const signatures = await db
      .select()
      .from(schema.signatures)
      .where(eq(schema.signatures.clientId, id))
      .orderBy(desc(schema.signatures.createdAt));

    return {
      client,
      engagement,
      issues,
      messages: messages.reverse(),
      intake,
      documents,
      signatures,
    };
  });

  if (!data) notFound();
  const { client, engagement, issues, messages, intake, documents, signatures } = data;

  const initials = client.fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('');

  return (
    <AppShell
      user={{ name: user.name, email: user.email, avatarUrl: user.avatarUrl }}
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
            <Section t={t} label="Intake">
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
              <SignaturesSection t={t} signatures={signatures} />
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
                </div>
              ) : (
                <EmptyCard t={t} text="No engagement yet" />
              )}
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
      </div>
    </AppShell>
  );
}

function Section({ t, label, count, children }: { t: ReturnType<typeof buildTheme>; label: string; count?: number; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10 }}>
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
