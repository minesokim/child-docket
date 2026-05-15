// /scan landing — client component for the static marketing page +
// form-submit stub. See ./page.tsx for the design + scope contract.
//
// Form submission is a v0 STUB: it shows a thank-you state, logs to
// Sentry as a breadcrumb so David sees the prospect, and tells the
// operator to follow up by email. C12b replaces this with a real
// server action backed by a `prospects` table + Resend confirmation
// + presigned R2 upload URL.

'use client';

import * as React from 'react';
import { buildTheme } from '@docket/ui';

const FAQ_ITEMS: ReadonlyArray<{ q: string; a: string }> = [
  {
    q: 'What if my return has no defensible deductions to surface?',
    a: 'Then we tell you that. The PDF is the artifact of running the Position Framework. If the return is already tight, that is the answer. You keep the PDF. We part ways. We do not pretend to surface positions that are not there.',
  },
  {
    q: 'Is my redacted return data secure?',
    a: 'Yes. The Discovery Scan runs in our SOC 2 Type II-aligned substrate (RLS at ENABLE+FORCE, per-tenant DEK encryption with AAD binding to tenant_id + client_id + path, cryptographic audit chain with nightly tamper verifier, encryption at rest and in transit). After 7 days, the return is deleted. Full security posture at docs/security/.',
  },
  {
    q: 'What if I do not want to commit to the $250/mo founder rate?',
    a: 'You do not have to. The scan is free, the PDF is yours, and there is no obligation. We expect 30-50% of prospects to walk away with just the PDF. That is the deal.',
  },
  {
    q: 'Can I send multiple returns at once?',
    a: 'One per prospect, first time. After signing for the founder tier, you can run scans on every return you prep.',
  },
  {
    q: 'What states do you cover?',
    a: 'Federal first (IRS authority library is the priority). California state coverage is in the seed library. Other states are flagged as out-of-scope in the PDF with a "we do not cover this state\'s position library yet" note. Honest-about-limits per the Coverage Map.',
  },
  {
    q: 'What is the difference between this scan and a tool like Deduction or Perplexity Computer for Taxes?',
    a: "Those tools are consumer-side. They help individual taxpayers find deductions. Petal is built for the preparer's side of the desk. Every position cites primary authority. Refuses below Reasonable Basis. Generates the audit defense file. Different product, different audience.",
  },
  {
    q: 'Why are you only offering this to the first 30?',
    a: 'Because the manual review gate on the Discovery agent is in place for the first 30 scans (David personally reviews every output before delivery). After 30, the gate lifts and capacity opens up. By then, the founder cohort will be partially filled and the next 50 spots are at $350/mo.',
  },
  {
    q: 'What happens after I run the scan?',
    a: 'We email you the PDF within 24 hours. If you want to talk through it, you book a 20-min walkthrough. If you want to lock the $250/mo founder slot, you can do that without the walkthrough. If neither, we leave you alone unless you reach out.',
  },
];

export function ScanLandingClient(): React.ReactElement {
  const t = buildTheme({ tone: 'editorial', fonts: 'classic' });
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [openFaq, setOpenFaq] = React.useState<number | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const formData = new FormData(e.currentTarget);
    const payload = Object.fromEntries(formData.entries());
    try {
      // POSTs to /api/scan-intake-stub which validates + logs to
      // Sentry for David's manual follow-up until C12b ships the
      // real prospects-table + Resend flow. The fetch MUST surface
      // real failures to the user — a silent "thank you" on a 5xx/
      // 4xx drops the lead with no breadcrumb (codex C12 R1 P1).
      const res = await fetch('/api/scan-intake-stub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(body.error ?? `Server returned ${res.status}`);
      }
      setSubmitted(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong submitting the form. Email david@docket.com directly and we'll pick it up.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main
      style={{
        minHeight: '100dvh',
        background: t.bg,
        color: t.ink,
        fontFamily: t.sans,
      }}
    >
      <HeroSection t={t} />
      <SectionDivider />
      <WhatYouGetSection t={t} />
      <SectionDivider />
      <HowItWorksSection t={t} />
      <SectionDivider />
      <PricingMathSection t={t} />
      <SectionDivider />
      <FoundersSection t={t} />
      <SectionDivider />
      <FAQSection t={t} openFaq={openFaq} setOpenFaq={setOpenFaq} />
      <SectionDivider />
      <FormSection
        t={t}
        onSubmit={onSubmit}
        submitting={submitting}
        submitted={submitted}
        submitError={submitError}
      />
      <Footer t={t} />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────────

function HeroSection({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <section
      style={{
        padding: '64px 24px 96px',
        maxWidth: 1080,
        margin: '0 auto',
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: t.rust,
          fontWeight: 700,
          marginBottom: 24,
        }}
      >
        Free Discovery Scan — first 30 EAs and small-firm CPAs
      </div>
      <h1
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(40px, 6vw, 64px)',
          lineHeight: 1.05,
          letterSpacing: '-0.02em',
          margin: '0 0 24px',
          color: t.ink,
          maxWidth: 920,
        }}
      >
        Find every defensible deduction your last return missed. Cited
        authority on each one.
      </h1>
      <p
        style={{
          fontSize: 19,
          lineHeight: 1.5,
          margin: '0 0 32px',
          color: t.inkSoft,
          maxWidth: 680,
        }}
      >
        24-hour turnaround. Real Position Framework run on a redacted return.
        PDF delivered with IRC cites, 4-tier confidence ratings, and draft 8275s.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
        <a
          href="#scan-form"
          style={{
            display: 'inline-block',
            background: t.rust,
            color: t.bg,
            padding: '16px 28px',
            borderRadius: 12,
            textDecoration: 'none',
            fontWeight: 600,
            fontSize: 16,
          }}
        >
          → Run my scan
        </a>
        <a
          href="#how-it-works"
          style={{
            color: t.inkSoft,
            textDecoration: 'underline',
            textDecorationThickness: 1,
            textUnderlineOffset: 4,
            fontSize: 15,
          }}
        >
          See how it works
        </a>
      </div>
      <p
        style={{
          fontSize: 13,
          fontStyle: 'italic',
          color: t.muted,
          maxWidth: 620,
          marginTop: 32,
          lineHeight: 1.5,
        }}
      >
        Antonio Vazquez, EA at Vazant Consulting (CA, ~250 active clients), runs
        his book on the same Position Framework. Currently defending two active
        2026 IRS audits using Petal as the substrate.
      </p>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// Section 1 — Three things in every scan
// ────────────────────────────────────────────────────────────────

function WhatYouGetSection({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 1080, margin: '0 auto' }}>
      <Eyebrow t={t}>The PDF</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 40px',
          color: t.ink,
          maxWidth: 720,
        }}
      >
        Three things on every page of your scan.
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}
      >
        <PillarCard
          t={t}
          title="Every defensible deduction"
          body="Every position the AI surfaces carries a 4-tier confidence rating (Settled law / Substantial Authority / Reasonable Basis + 8275 / MLTN) with the IRC cite attached at decision time. Numbers, not vibes."
        />
        <PillarCard
          t={t}
          title="The refusal floor"
          body="Positions below Reasonable Basis get refused with a documented reason. We do not surface aggressive territory unsupported. That refusal is part of your audit defense, not a hole in the product."
        />
        <PillarCard
          t={t}
          title="Draft 8275 on Tier 3 positions"
          body="Every Reasonable Basis position arrives with the disclosure pre-drafted. That is not a feature. It is the only way the Position Framework can run honestly."
        />
      </div>
    </section>
  );
}

function PillarCard({
  t,
  title,
  body,
}: {
  t: ReturnType<typeof buildTheme>;
  title: string;
  body: string;
}) {
  return (
    <div>
      <h3
        style={{
          fontFamily: t.serif,
          fontSize: 20,
          fontWeight: 600,
          margin: '0 0 12px',
          color: t.ink,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontSize: 15,
          lineHeight: 1.55,
          color: t.inkSoft,
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Section 2 — How it works
// ────────────────────────────────────────────────────────────────

function HowItWorksSection({ t }: { t: ReturnType<typeof buildTheme> }) {
  const steps: Array<{ title: string; body: string }> = [
    {
      title: 'Upload a redacted return',
      body: 'PDF or PDF + workpapers. Max 25MB. Strip client name, address, SSN — keep entity type, AGI bucket, schedules, line items. We send the secure upload link by email after you submit the form below.',
    },
    {
      title: 'Petal runs the Position Framework',
      body: 'Every line item gets the 4-tier confidence pass + IRC cite + draft 8275 where applicable. Refuses below Reasonable Basis by default.',
    },
    {
      title: '24-hour turnaround',
      body: 'You get a Petal-branded PDF in your inbox. Headline number on page 2: total dollars in defensible deductions surfaced across all positions.',
    },
    {
      title: 'Optional 20-min walkthrough',
      body: 'We go through positions together and talk about whether the $250/mo founder rate makes sense for your firm. No commitment. The PDF is yours either way.',
    },
  ];
  return (
    <section
      id="how-it-works"
      style={{ padding: '64px 24px', maxWidth: 1080, margin: '0 auto' }}
    >
      <Eyebrow t={t}>The process</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 40px',
          color: t.ink,
        }}
      >
        Four steps. 24 hours.
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 32,
        }}
      >
        {steps.map((s, i) => (
          <div key={i}>
            <div
              style={{
                fontFamily: t.serif,
                fontSize: 48,
                color: t.rust,
                fontWeight: 500,
                lineHeight: 1,
                marginBottom: 12,
              }}
            >
              {i + 1}
            </div>
            <h3
              style={{
                fontFamily: t.serif,
                fontSize: 18,
                fontWeight: 600,
                margin: '0 0 8px',
                color: t.ink,
              }}
            >
              {s.title}
            </h3>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.55,
                color: t.inkSoft,
                margin: 0,
              }}
            >
              {s.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// Section 3 — Pricing math callout
// ────────────────────────────────────────────────────────────────

function PricingMathSection({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 1080, margin: '0 auto' }}>
      <Eyebrow t={t}>The pricing math</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 32px',
          color: t.ink,
        }}
      >
        The numbers are the offer.
      </h2>
      <div style={{ maxWidth: 760, fontSize: 17, lineHeight: 1.6, color: t.ink }}>
        <p style={{ margin: '0 0 16px' }}>
          The §6695(g) due-diligence penalty is{' '}
          <strong>$650 per failure</strong>, per Rev. Proc. 2025-32.{' '}
          <em>Per failure, not per return.</em> A single return with EITC + CTC
          + AOTC + HOH is four checklists — miss all four, that is $2,600 from
          one client.
        </p>
        <p style={{ margin: '0 0 16px' }}>
          The §6694 understatement penalty is <strong>$1,000 to $5,000</strong>.
        </p>
        <p style={{ margin: '0 0 32px' }}>
          An audit defense engagement is 40 to 100 hours at your realization
          rate. Call it <strong>$20,000 of billable work</strong> you are not
          doing.
        </p>
      </div>
      <div
        style={{
          maxWidth: 760,
          borderLeft: `4px solid ${t.rust}`,
          background: '#F2EEE2',
          padding: '24px 28px',
          fontSize: 17,
          lineHeight: 1.55,
          color: t.ink,
        }}
      >
        <p style={{ margin: '0 0 12px', fontWeight: 700 }}>
          Petal founder rate: $250/mo. Locked for life, first 50 firms.
        </p>
        <p style={{ margin: '0 0 6px' }}>One prevented §6695(g) penalty pays for half a year.</p>
        <p style={{ margin: '0 0 6px' }}>One prevented §6694 understatement pays for 18 months.</p>
        <p style={{ margin: 0 }}>One prevented audit defense engagement pays for 5+ years.</p>
      </div>
      <p style={{ marginTop: 24, fontSize: 14, color: t.muted }}>
        {/*
          Locked copy had "See the full pricing math → /pricing".
          That route isn't shipped yet in this app (it lives behind
          C12-pricing-page, separate item). Showing a 404 link on a
          conversion path is worse than omitting (codex C12 R2 P2).
          Re-enable when /pricing lands.
        */}
        Source:{' '}
        <a
          href="https://www.irs.gov/irb/2025-45_IRB"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: t.muted, textDecoration: 'underline' }}
        >
          IRS Rev. Proc. 2025-32 (2026 inflation adjustments)
        </a>
      </p>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// Section 4 — Founders
// ────────────────────────────────────────────────────────────────

function FoundersSection({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 1080, margin: '0 auto' }}>
      <Eyebrow t={t}>The founders</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 40px',
          color: t.ink,
        }}
      >
        Built by builders who carry the same risk you do.
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 32,
        }}
      >
        <div>
          <h3 style={founderNameStyle(t)}>David Kim</h3>
          <p style={founderBodyStyle(t)}>
            CEO. Building the company-facing surfaces, the customer
            relationships, and the Antonio partnership. Email:{' '}
            <a href="mailto:david@docket.com" style={{ color: t.rust }}>
              david@docket.com
            </a>
            .
          </p>
        </div>
        <div>
          <h3 style={founderNameStyle(t)}>Haokun Yang</h3>
          <p style={founderBodyStyle(t)}>
            CTO. Owns the codebase end-to-end. 5+ year partnership pre-Petal.
            UCR CS. Built the 13-table Drizzle schema with RLS, per-tenant DEK
            encryption, cryptographic audit chain, and the agent fleet
            currently in production.
          </p>
        </div>
      </div>
      <div
        style={{
          marginTop: 32,
          padding: 24,
          background: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
        }}
      >
        <h3 style={founderNameStyle(t)}>Antonio Vazquez, EA</h3>
        <p
          style={{
            fontSize: 13,
            color: t.muted,
            margin: '0 0 12px',
            textTransform: 'uppercase',
            letterSpacing: 1,
          }}
        >
          On-platform tax advisor (1% equity)
        </p>
        <p style={founderBodyStyle(t)}>
          Vazant Consulting (CA). 25 years EA practice. ~250 active clients. All
          Position Library content, every tax-position classification, every
          cited-authority decision routes through Antonio. Currently defending
          two active 2026 IRS audits using Petal as the substrate. Real PTIN.
          Real risk. Real signal.
        </p>
      </div>
      <p
        style={{
          fontSize: 13,
          color: t.muted,
          marginTop: 24,
          lineHeight: 1.6,
          maxWidth: 760,
        }}
      >
        Backed by 28 PROD migrations, RLS at ENABLE+FORCE, per-tenant DEK
        encryption, cryptographic audit chain with nightly tamper verifier,
        Bedrock fallback verified end-to-end, 12-doc SOC 2 Type II policy set in
        docs/security/.
      </p>
    </section>
  );
}

function founderNameStyle(t: ReturnType<typeof buildTheme>): React.CSSProperties {
  return {
    fontFamily: t.serif,
    fontSize: 22,
    fontWeight: 600,
    margin: '0 0 8px',
    color: t.ink,
  };
}

function founderBodyStyle(t: ReturnType<typeof buildTheme>): React.CSSProperties {
  return {
    fontSize: 15,
    lineHeight: 1.55,
    color: t.inkSoft,
    margin: 0,
  };
}

// ────────────────────────────────────────────────────────────────
// Section 5 — FAQ
// ────────────────────────────────────────────────────────────────

function FAQSection({
  t,
  openFaq,
  setOpenFaq,
}: {
  t: ReturnType<typeof buildTheme>;
  openFaq: number | null;
  setOpenFaq: (i: number | null) => void;
}) {
  return (
    <section style={{ padding: '64px 24px', maxWidth: 760, margin: '0 auto' }}>
      <Eyebrow t={t}>FAQ</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 32px',
          color: t.ink,
        }}
      >
        The questions every EA asks.
      </h2>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openFaq === i;
        return (
          <div
            key={i}
            style={{
              borderTop: `1px solid ${t.border}`,
              padding: '20px 0',
            }}
          >
            <button
              type="button"
              onClick={() => setOpenFaq(isOpen ? null : i)}
              aria-expanded={isOpen}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                width: '100%',
                textAlign: 'left',
                fontFamily: t.serif,
                fontSize: 18,
                fontWeight: 600,
                color: t.ink,
                padding: 0,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                gap: 16,
              }}
            >
              <span>{item.q}</span>
              <span
                style={{
                  color: t.rust,
                  fontWeight: 400,
                  fontSize: 20,
                  flexShrink: 0,
                }}
              >
                {isOpen ? '−' : '+'}
              </span>
            </button>
            {isOpen ? (
              <p
                style={{
                  fontSize: 15,
                  lineHeight: 1.6,
                  color: t.inkSoft,
                  margin: '16px 0 0',
                }}
              >
                {item.a}
              </p>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────
// Section 6 — Form
// ────────────────────────────────────────────────────────────────

function FormSection({
  t,
  onSubmit,
  submitting,
  submitted,
  submitError,
}: {
  t: ReturnType<typeof buildTheme>;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  submitting: boolean;
  submitted: boolean;
  submitError: string | null;
}) {
  if (submitted) {
    return (
      <section
        id="scan-form"
        style={{
          padding: '96px 24px',
          maxWidth: 640,
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <Eyebrow t={t}>Got it.</Eyebrow>
        <h2
          style={{
            fontFamily: t.serif,
            fontSize: 'clamp(28px, 4vw, 40px)',
            lineHeight: 1.15,
            margin: '16px 0 24px',
            color: t.ink,
          }}
        >
          Submission received.
        </h2>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: t.inkSoft,
            marginBottom: 12,
          }}
        >
          David reviews each Discovery Scan submission personally (the first 30
          go through a manual review gate). Expect a follow-up email from{' '}
          <a
            href="mailto:david@docket.com"
            style={{ color: t.rust, textDecoration: 'underline' }}
          >
            david@docket.com
          </a>{' '}
          within one business day with the secure upload link.
        </p>
        <p
          style={{
            fontSize: 14,
            lineHeight: 1.6,
            color: t.muted,
          }}
        >
          Nothing in your inbox by then? Email David directly — your
          submission is in our queue.
          {/*
            Honest copy: stub-tier intake. C12b replaces this with
            an immediate Resend confirmation + presigned upload URL.
            The transition from "submission received → follow-up
            within 1 day" to "secure upload link in 5 min" is the
            single most important UX upgrade in the C12b ship
            (codex C12 R2 P1).
          */}
        </p>
      </section>
    );
  }
  return (
    <section
      id="scan-form"
      style={{ padding: '64px 24px', maxWidth: 720, margin: '0 auto' }}
    >
      <Eyebrow t={t}>The form</Eyebrow>
      <h2
        style={{
          fontFamily: t.serif,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.15,
          letterSpacing: '-0.01em',
          margin: '0 0 32px',
          color: t.ink,
        }}
      >
        Ready for your scan?
      </h2>
      <form
        onSubmit={onSubmit}
        style={{
          background: t.bg,
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 28,
          display: 'grid',
          gap: 16,
        }}
      >
        {submitError ? (
          <div
            role="alert"
            style={{
              padding: '12px 16px',
              background: '#FBE9E7',
              border: '1px solid #C4452D',
              borderRadius: 8,
              color: '#7C2A1B',
              fontSize: 14,
              lineHeight: 1.5,
            }}
          >
            <strong>Couldn&apos;t submit:</strong> {submitError} If this
            persists, email{' '}
            <a
              href="mailto:david@docket.com"
              style={{ color: '#7C2A1B', textDecoration: 'underline' }}
            >
              david@docket.com
            </a>{' '}
            directly.
          </div>
        ) : null}
        <Field t={t} label="First name" name="first_name" required />
        <Field t={t} label="Last name" name="last_name" required />
        <Field t={t} label="Firm name" name="firm_name" required />
        <Select
          t={t}
          label="Designation"
          name="designation"
          required
          options={['EA', 'CPA', 'PTIN-holder', 'Other']}
        />
        <Select
          t={t}
          label="Firm size"
          name="firm_size"
          required
          options={['Solo', '2-5 preparers', '6-10', '11-20', '21+']}
        />
        <Select
          t={t}
          label="Tax prep software"
          name="tax_software"
          required
          options={[
            'OLT',
            'Drake',
            'ProConnect',
            'UltraTax',
            'Lacerte',
            'CCH',
            'TaxAct',
            'Other',
          ]}
        />
        <Field t={t} label="Email" name="email" type="email" required />
        <Field t={t} label="Phone" name="phone" type="tel" />
        <Field t={t} label="LinkedIn URL" name="linkedin_url" type="url" />
        <Select
          t={t}
          label="Heard about Petal via"
          name="source"
          required
          options={[
            'Boney-Henderson',
            'Cold email',
            'LinkedIn',
            'NAEA event',
            'r/taxpros',
            'Tax Twitter',
            'Referral',
            'Search',
            'Other',
          ]}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            fontSize: 14,
            lineHeight: 1.45,
            color: t.inkSoft,
          }}
        >
          <input
            type="checkbox"
            name="confirm_redacted"
            required
            style={{ marginTop: 4, accentColor: t.rust }}
          />
          <span>
            I confirm the upload will be redacted of client PII (name, address,
            SSN, EIN, bank account numbers).
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          style={{
            background: t.rust,
            color: t.bg,
            padding: '16px 28px',
            borderRadius: 12,
            border: 'none',
            fontWeight: 600,
            fontSize: 16,
            cursor: submitting ? 'wait' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            marginTop: 8,
          }}
        >
          {submitting ? 'Submitting…' : '→ Run my scan'}
        </button>
        <p
          style={{
            fontSize: 12,
            color: t.muted,
            lineHeight: 1.5,
            margin: 0,
            marginTop: 4,
          }}
        >
          {/*
            Honest copy: this form persists name/firm/email/phone to a
            prospects table (no per-tenant DEK — prospects are
            pre-tenant) for manual follow-up. The encrypted+TTL claim
            in the landing-copy spec applies to the redacted RETURN
            upload step (which DOES run through per-tenant DEK +
            AAD-bound AES-256-GCM and gets deleted 7d after scan
            delivery). Conflating the two would be a false privacy
            promise (codex C12 R6 P1).
          */}
          David reviews each submission and follows up with the secure upload
          link within one business day. The redacted return you upload runs
          through per-tenant DEK + AAD-bound AES-256-GCM encryption and is
          deleted 7 days after scan delivery; your contact details on this
          form persist longer for follow-up — see our{' '}
          <a
            href="mailto:david@docket.com"
            style={{ color: t.rust, textDecoration: 'underline' }}
          >
            Privacy
          </a>{' '}
          questions to david@docket.com.
        </p>
      </form>
    </section>
  );
}

function Field({
  t,
  label,
  name,
  type = 'text',
  required = false,
}: {
  t: ReturnType<typeof buildTheme>;
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: t.inkSoft,
          fontWeight: 600,
        }}
      >
        {label}
        {required ? '' : ' (optional)'}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        style={{
          padding: '12px 14px',
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          fontSize: 15,
          fontFamily: 'inherit',
          background: '#FFFEFC',
          color: t.ink,
        }}
      />
    </label>
  );
}

function Select({
  t,
  label,
  name,
  required = false,
  options,
}: {
  t: ReturnType<typeof buildTheme>;
  label: string;
  name: string;
  required?: boolean;
  options: ReadonlyArray<string>;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span
        style={{
          fontSize: 12,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color: t.inkSoft,
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <select
        name={name}
        required={required}
        defaultValue=""
        style={{
          padding: '12px 14px',
          border: `1px solid ${t.border}`,
          borderRadius: 8,
          fontSize: 15,
          fontFamily: 'inherit',
          background: '#FFFEFC',
          color: t.ink,
        }}
      >
        <option value="" disabled>
          Select…
        </option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

// ────────────────────────────────────────────────────────────────
// Footer
// ────────────────────────────────────────────────────────────────

function Footer({ t }: { t: ReturnType<typeof buildTheme> }) {
  return (
    <footer
      style={{
        background: '#1A1E2A',
        color: '#E8E2D5',
        padding: '64px 24px',
        marginTop: 96,
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div
          style={{
            fontFamily: t.serif,
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: 2,
            marginBottom: 8,
          }}
        >
          DOCKET
        </div>
        <p style={{ fontSize: 15, opacity: 0.8, marginBottom: 48, marginTop: 0 }}>
          The AI defense layer for tax practices.
        </p>
        {/*
          Footer columns only include links to routes that EXIST.
          The full footer site map per the locked landing copy lists
          Coverage / Pricing / API / About / Founders / Terms /
          Privacy / Security / WISP, but those routes don't ship
          until their respective build items land. Showing them now
          would 404 (codex C12 R1 P2). Each is queued as a separate
          followup; the footer expands as routes land.
        */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 32,
            marginBottom: 48,
          }}
        >
          <FooterColumn
            title="Contact"
            links={[
              { label: 'david@docket.com', href: 'mailto:david@docket.com' },
            ]}
          />
        </div>
        <div
          style={{
            fontSize: 13,
            opacity: 0.65,
            paddingTop: 32,
            borderTop: '1px solid rgba(232,226,213,0.15)',
            lineHeight: 1.6,
          }}
        >
          <a
            href="mailto:david@petal.tax"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            david@petal.tax
          </a>{' '}
          · © 2026 Petal
          {/*
            docket.com brand link dropped from this footer until the
            cutover lands. Same-origin /scan visitors clicking it
            today land on an undeployed dead origin (codex C12 R7 P3).
            Re-add once docket.com points at the production deploy.
          */}
          <br />
          Compliance-first AI for the PTIN-carrying practice.
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontWeight: 700,
          marginBottom: 16,
          opacity: 0.7,
        }}
      >
        {title}
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {links.map((l) => (
          <li key={l.href} style={{ marginBottom: 10 }}>
            <a
              href={l.href}
              style={{ color: 'inherit', textDecoration: 'none', fontSize: 14 }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Small primitives shared across sections
// ────────────────────────────────────────────────────────────────

function Eyebrow({
  t,
  children,
}: {
  t: ReturnType<typeof buildTheme>;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontSize: 12,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: t.rust,
        fontWeight: 700,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}

function SectionDivider() {
  return (
    <div style={{ maxWidth: 1080, margin: '0 auto', padding: '0 24px' }}>
      <div
        style={{
          height: 1,
          background: 'rgba(26,30,42,0.08)',
          width: '100%',
        }}
      />
    </div>
  );
}
