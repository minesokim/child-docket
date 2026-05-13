// /trust — public Trust Center page.
//
// Per CLAUDE.md L8 + PRODUCT-ROADMAP §6 Marketing site structure:
// "Static read-only listing of shipped security controls. Defer
// Drata / Vanta tooling until capital lands. Ship the page now
// as a pre-sale trust signal."
//
// Content source: docs/security/trust-center-content.md. This
// page renders the canonical control listing as a public static
// page. No auth required, no analytics tracking, TLS-only.
//
// Updates: when a new control ships, update both this file AND
// docs/security/trust-center-content.md. The doc file is the
// strategic source-of-truth; this page is the rendered surface.

import type { Metadata } from 'next';

export const runtime = 'nodejs';
export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Trust Center · Docket',
  description:
    'Security controls shipped in production. Multi-tenant isolation, cryptographic audit chain, per-tenant DEK encryption, SOC 2 posture, IRS compliance.',
  openGraph: {
    title: 'Trust Center · Docket',
    description:
      'Security controls shipped in production at Docket — the AI-native operating system for tax practices.',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

const SECTIONS: Array<{
  id: string;
  label: string;
  intro: string;
  controls: Array<{ name: string; detail: string }>;
}> = [
  {
    id: 'infrastructure',
    label: 'Infrastructure security',
    intro:
      'How data is stored, transmitted, and accessed at the platform layer.',
    controls: [
      {
        name: 'Multi-tenant isolation via Postgres row-level security',
        detail:
          'Every tenant-scoped table has ENABLE + FORCE ROW LEVEL SECURITY applied. The current_tenant_id() function gates every read and write at the database layer. Application code wraps every database operation in withTenant(tenantId, fn) which SET LOCAL app.current_tenant_id for the transaction. RLS-bypass paths are limited to two locations (intake auth chicken-and-egg + Clerk session resolution) and audited via grep on every change.',
      },
      {
        name: 'Cryptographic audit chain',
        detail:
          'Every state-changing action writes to the actions table via BEFORE INSERT trigger. The trigger fills chain_seq (monotonic), prev_hash (SHA-256 of prior row), and row_hash (SHA-256 of current row including prev_hash). The audit chain forms a tamper-evident linked list. A nightly cron walks the chain and surfaces tampering to monitoring + the audit log itself. Any auditor can replay the chain offline given a database dump.',
      },
      {
        name: 'Per-tenant data encryption keys',
        detail:
          'Each tenant gets a unique 256-bit DEK encrypted by a master KEK. All sensitive fields (SSN, EIN, bank account, financial IDs) are AES-256-GCM encrypted with the tenant DEK. AAD binds ciphertexts to (tenant_id, client_id, path) to prevent cross-tenant ciphertext substitution. In-process LRU cache for hot DEKs; eviction on tenant deletion.',
      },
      {
        name: 'Encryption at rest + in transit',
        detail:
          'All Postgres data on hosted infrastructure with AES-256 disk encryption. Object storage encrypted at rest. Backups encrypted at rest. TLS 1.3 enforced on external surfaces; TLS 1.2+ on application-to-database connections. HSTS headers applied to all marketing and app surfaces.',
      },
      {
        name: 'Webhook signature verification',
        detail:
          'Every inbound webhook (DocuSign, Square, Twilio, Inngest, Resend) signature-verified via @docket/shared/webhooks with timing-safe comparison. 32 webhook verification tests passing on every commit. Test secrets explicitly separated from production secrets.',
      },
      {
        name: 'Multi-factor authentication',
        detail:
          'Phone-OTP via Clerk + Twilio (SMS-delivered one-time codes). Clerk manages session tokens; the application does not persist long-lived auth tokens. MFA enforced on every sign-in.',
      },
      {
        name: 'Rate limiting on public endpoints',
        detail:
          'In-process token-bucket rate limiter on intake-flush, scan-intake-stub, SSN-reveal, and other abusable endpoints. IP + tenant-keyed buckets. 429 responses on bucket exhaustion with Retry-After headers.',
      },
    ],
  },
  {
    id: 'organizational',
    label: 'Organizational security',
    intro: 'How people access the system and what they can do.',
    controls: [
      {
        name: 'Role-based access control',
        detail:
          'Five roles: firm_owner / preparer / reviewer / admin / assistant. Sensitive operations (SSN reveal, 8879 sign, payment data) gated to specific roles. Policy matrix documented in docs/security/access-control-policy.md. Per-session SSN/EIN reveal with 15-minute TTL and 6-per-minute rate limit, audit row per unlock.',
      },
      {
        name: 'No password-based authentication',
        detail:
          'Phone-OTP via Clerk + Twilio is the only authentication path. Eliminates password-database compromise risk. Session tokens managed by Clerk with industry-standard rotation and invalidation.',
      },
      {
        name: 'Limited personnel access',
        detail:
          'Production database access limited to CEO + CTO. Production credentials stored as encrypted environment variables. No third-party engineering access; no contractors with production access.',
      },
      {
        name: 'Data classification policy',
        detail:
          'Four-tier classification: Public / Internal / Confidential / Restricted. SSN, EIN, bank account = Restricted (DEK-encrypted, masked-by-default UI, audit-logged reveals). Tax positions + memos + client communications = Confidential. Tenant configuration = Internal. Marketing content = Public.',
      },
    ],
  },
  {
    id: 'product',
    label: 'Product security',
    intro: 'How the application is built to be safe by default.',
    controls: [
      {
        name: 'Data minimization at the form layer',
        detail:
          'Intake forms collect only the data required for tax preparation. §7216 consent captured before any disclosure-eligible data is collected. Optional fields explicitly marked. No third-party trackers on intake routes.',
      },
      {
        name: 'PII scrubbing in observability',
        detail:
          'Sentry beforeSend scrubber redacts SSN / EIN / email / phone substrings before events leave our processes. Field-name-based redaction for sensitive-looking field names. 32 PII scrubber tests verifying every edge case.',
      },
      {
        name: 'Input validation at every boundary',
        detail:
          'Zod schemas on every server action. Reject malformed inputs at the API boundary before any database write. Type errors surface as structured 400 responses; no internal errors leak.',
      },
      {
        name: 'Compliance-first AI position framework',
        detail:
          'Every AI-surfaced tax position carries a cited IRC authority, confidence tier (1-4), audit-risk assessment, and refusal floor below Reasonable Basis. AI never auto-files a position above Tier 1. Refusal floor is non-negotiable: the AI returns "I refuse" rather than surfacing a position below reasonable basis.',
      },
      {
        name: 'Trust escalation gate',
        detail:
          'Every external-effect action (send email, write to tax software, file with IRS) gated through assertTrustGate. Per-tenant trust level × action class × position tier matrix. L1 firms (default): all external actions require human approval. L2+ firms: progressive auto-acceptance based on action class and position tier.',
      },
      {
        name: 'Audit-immutable design',
        detail:
          'Actions table is INSERT-only via trigger. Audit chain prevents tampering; any modification is detectable by chain re-verification. 7-year tax-document retention default (configurable per tenant). Soft-delete only at the application layer; never hard-delete operational data.',
      },
    ],
  },
  {
    id: 'internal',
    label: 'Internal security procedures',
    intro: 'How we operate the system day-to-day.',
    controls: [
      {
        name: 'Change management',
        detail:
          'Every commit must pass: typecheck across 15 workspaces, @docket/shared test suite, @docket/db integration tests, protocol-gate trailer validation, and codex review. Protocol-gate enforces edge-case enumeration, score ≥95, alignment check, craft check, codex review verdict, and compliance check. CI re-validates every protocol on every commit; locally, pre-commit + commit-msg hooks block first.',
      },
      {
        name: 'Logging and monitoring',
        detail:
          'All AI agent calls logged to actions table with cost telemetry, latency, model used, token counts. Per-tenant + per-agent cost dashboards. Sentry exception monitoring with structured tags. Cost-outlier alert thresholds (spike detection on hourly + daily cost-per-tenant baselines).',
      },
      {
        name: 'Incident response',
        detail:
          'Documented IR playbook covering data breach, vendor outage, agent malfunction, compliance issue, and billing dispute. Severity 1-4 escalation matrix. Customer notification SLA: 72 hours per relevant state breach laws.',
      },
      {
        name: 'Vendor management',
        detail:
          'Sub-processor list maintained: Anthropic, AWS Bedrock, Neon, Clerk, Twilio, Square, DocuSign, Cloudflare, Resend, Vercel, Voyage AI, Cohere, Sentry. Each vendor evaluated for security posture, data residency, sub-processor disclosure, and SOC 2 or equivalent attestation. All sub-processors have ZDR or equivalent enterprise data handling.',
      },
      {
        name: 'Backup and recovery',
        detail:
          'Automated continuous backups with point-in-time recovery. Object storage versioning (90-day retention on delete). Backup restoration tested quarterly.',
      },
    ],
  },
  {
    id: 'data',
    label: 'Data and privacy',
    intro: 'How customer data is handled across its full lifecycle.',
    controls: [
      {
        name: 'Customer data ownership',
        detail:
          'Customers own their data outright; we provide infrastructure to manage it. Data export endpoint per CCPA / GDPR. Data deletion procedure: 30-day grace period + permanent deletion on request.',
      },
      {
        name: 'Data retention',
        detail:
          '7-year tax-document retention default (matches IRS audit window). Configurable per tenant. Customer data deleted upon tenant offboarding (30-day grace). Audit chain entries retained for the life of the platform (immutable per design).',
      },
      {
        name: 'Zero Data Retention with AI providers',
        detail:
          'Anthropic API requests configured for ZDR — prompts and completions not stored for training. AWS Bedrock (fallover provider) configured equivalently. Voyage AI embeddings: ZDR per Voyage enterprise data handling. No customer data fed into model training, evaluation, or fine-tuning pipelines.',
      },
      {
        name: 'Cross-border data residency',
        detail:
          'Primary infrastructure US-based. Sub-processor data flows documented in vendor management policy. No customer data leaves the US unless customer explicitly enables (e.g., for international clients).',
      },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance and audits',
    intro: 'External standards we conform to.',
    controls: [
      {
        name: 'SOC 2 posture',
        detail:
          'All controls listed above are built into the codebase. Drata / Vanta automation deferred until capital lands; the controls themselves ship now. Independent attestation audit planned for Q1 2027.',
      },
      {
        name: 'IRS compliance',
        detail:
          'Form 8879 KBA per IRS Pub 1345 NIST IAL2 standard. §7216 consent captured before any taxpayer information disclosure. §6695(g) due-diligence checklist support (Form 8867) for EITC / CTC / AOTC / HOH returns. §6694 understatement penalty protection via Position Framework refusal floor + cited authority on every position.',
      },
      {
        name: 'State compliance',
        detail:
          'California §17530.5 disclosure compliance built into intake flow. CCPA-compliant data export and deletion endpoints. State-specific tax-position content (CA FTB Residency Manual + Legal Rulings) in position library.',
      },
      {
        name: 'Privacy laws',
        detail:
          'CCPA-compliant by design (data export, deletion, opt-out). GDPR-equivalent practices for international clients when added. No third-party tracking on intake routes. Cookie banners default to privacy-preserving option.',
      },
    ],
  },
];

const GAPS: string[] = [
  'Not yet SOC 2 Type II certified. Posture-ready, not attestation-ready. Q1 2027 target.',
  'Not yet HIPAA-eligible Twilio account. Tax data is not strictly PHI, but HIPAA-eligible posture is defensive. Will add when capital lands.',
  'Not yet penetration-tested by external firm. External pentest scheduled Q4 2026 pre-launch.',
  'Not yet ISO 27001 certified. No immediate plan; SOC 2 Type II covers buyer expectations at our segment.',
  'Not yet FedRAMP authorized. Not in scope; we do not sell to federal government.',
];

export default function TrustCenterPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'oklch(98% 0.01 85)',
        fontFamily:
          'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        color: 'oklch(20% 0.01 85)',
      }}
    >
      <div
        style={{
          maxWidth: 880,
          margin: '0 auto',
          padding: '80px 32px 120px',
        }}
      >
        <header style={{ marginBottom: 56 }}>
          <div
            style={{
              fontSize: 12,
              color: 'oklch(48% 0.01 85)',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Trust Center
          </div>
          <h1
            style={{
              fontSize: 44,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 16px 0',
              letterSpacing: -0.8,
              lineHeight: 1.1,
            }}
          >
            Security controls in production.
          </h1>
          <p
            style={{
              fontSize: 17,
              color: 'oklch(40% 0.01 85)',
              margin: 0,
              lineHeight: 1.55,
              maxWidth: 680,
            }}
          >
            Docket is the AI-native operating system for tax practices. Every
            control listed below is actually shipped in production. We list
            what we have, and we list what we do not yet have. Honesty about
            gaps is part of the trust contract.
          </p>
        </header>

        {/* Table of contents */}
        <nav
          aria-label="Sections"
          style={{
            marginBottom: 56,
            padding: '20px 24px',
            background: 'oklch(99% 0.005 85)',
            border: '1px solid oklch(92% 0.008 85)',
            borderRadius: 12,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: 'oklch(50% 0.01 85)',
              letterSpacing: 0.3,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Sections
          </div>
          <ol
            style={{
              listStyle: 'none',
              padding: 0,
              margin: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  style={{
                    fontSize: 14,
                    color: 'oklch(30% 0.01 85)',
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'baseline',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      color: 'oklch(60% 0.01 85)',
                      letterSpacing: 0.2,
                      minWidth: 22,
                    }}
                  >
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        {/* Sections */}
        {SECTIONS.map((section) => (
          <section
            key={section.id}
            id={section.id}
            style={{ marginBottom: 56, scrollMarginTop: 24 }}
          >
            <h2
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: 'oklch(20% 0.01 85)',
                margin: '0 0 8px 0',
                letterSpacing: -0.3,
              }}
            >
              {section.label}
            </h2>
            <p
              style={{
                fontSize: 14,
                color: 'oklch(48% 0.01 85)',
                margin: '0 0 24px 0',
                lineHeight: 1.55,
              }}
            >
              {section.intro}
            </p>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              {section.controls.map((control, ci) => (
                <li
                  key={ci}
                  style={{
                    padding: '18px 22px',
                    background: 'oklch(99.5% 0.003 85)',
                    border: '1px solid oklch(93% 0.008 85)',
                    borderRadius: 10,
                  }}
                >
                  <h3
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      color: 'oklch(20% 0.01 85)',
                      margin: '0 0 6px 0',
                      letterSpacing: -0.1,
                    }}
                  >
                    {control.name}
                  </h3>
                  <p
                    style={{
                      fontSize: 13.5,
                      color: 'oklch(38% 0.01 85)',
                      margin: 0,
                      lineHeight: 1.6,
                    }}
                  >
                    {control.detail}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {/* What we do NOT claim */}
        <section
          id="gaps"
          style={{ marginBottom: 56, scrollMarginTop: 24 }}
        >
          <h2
            style={{
              fontSize: 24,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 8px 0',
              letterSpacing: -0.3,
            }}
          >
            What we do not yet claim
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'oklch(48% 0.01 85)',
              margin: '0 0 20px 0',
              lineHeight: 1.55,
            }}
          >
            Honesty about gaps protects trust. Here is what we are working
            toward but have not yet shipped.
          </p>
          <ul
            style={{
              listStyle: 'none',
              padding: '18px 22px',
              margin: 0,
              background: 'oklch(98% 0.015 75)',
              border: '1px solid oklch(90% 0.025 75)',
              borderRadius: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {GAPS.map((gap, i) => (
              <li
                key={i}
                style={{
                  fontSize: 13.5,
                  color: 'oklch(35% 0.01 85)',
                  lineHeight: 1.6,
                  paddingLeft: 18,
                  position: 'relative',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 9,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'oklch(58% 0.13 75)',
                  }}
                />
                {gap}
              </li>
            ))}
          </ul>
        </section>

        {/* Contact */}
        <section
          id="contact"
          style={{
            padding: '24px 28px',
            background: 'oklch(99% 0.005 85)',
            border: '1px solid oklch(92% 0.008 85)',
            borderRadius: 12,
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: 'oklch(20% 0.01 85)',
              margin: '0 0 8px 0',
            }}
          >
            Reporting security issues
          </h2>
          <p
            style={{
              fontSize: 14,
              color: 'oklch(38% 0.01 85)',
              margin: '0 0 12px 0',
              lineHeight: 1.6,
            }}
          >
            If you discover a security vulnerability, please email{' '}
            <a
              href="mailto:security@docket.com"
              style={{
                color: 'oklch(42% 0.09 150)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              security@docket.com
            </a>{' '}
            with a description, reproduction steps, expected impact, and your
            contact information. We will respond within 24 hours, acknowledge
            within 72 hours, and remediate per severity. Coordinated
            disclosure preferred (90-day default before public disclosure).
          </p>
          <p
            style={{
              fontSize: 13,
              color: 'oklch(48% 0.01 85)',
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            We do not currently offer paid bug bounties. We do publicly
            acknowledge security researchers who report responsibly in our
            quarterly security update.
          </p>
        </section>

        <footer
          style={{
            marginTop: 64,
            paddingTop: 24,
            borderTop: '1px solid oklch(92% 0.008 85)',
            fontSize: 12,
            color: 'oklch(55% 0.01 85)',
            lineHeight: 1.55,
          }}
        >
          Last updated 2026-05-13. This page reflects the canonical control
          listing maintained at docs/security/trust-center-content.md in the
          Docket repository. Updates to that file propagate here.
        </footer>
      </div>
    </main>
  );
}
