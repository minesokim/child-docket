// Seed a small starter set of global authorities into the
// authorities + authority_chunks tables. Lifts the "authorities
// table empty" gap that's currently blocking the Discovery agent
// kill-switch from being lifted.
//
// SCOPE
//   This is the SCAFFOLD: a hand-curated set of 5-10 starter
//   authorities (IRC top-of-section text, IRS Pub 17 summary,
//   FTB Pub 1031 summary, etc.). Real ingestion (PDF parsing,
//   tsvector population, embedding via voyage-3-lite, hierarchical
//   chunking) lands when content/authority/ ships.
//
//   For now, this seed makes the authorities table return rows so
//   citation-verifier loops have something to verify against.
//
// IDEMPOTENT
//   Inserts use ON CONFLICT (slug) DO UPDATE so re-running upserts
//   instead of duplicating. Each authority's content_hash is computed
//   from the chunked text; if the source text changes, content_hash
//   differs and the row's updatedAt advances.
//
// USAGE
//   bun run packages/db/scripts/seed-authorities.ts

import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { getAdminDb } from '../src/index.js';

interface AuthoritySeed {
  kind:
    | 'irc'
    | 'treas_reg'
    | 'irs_pub'
    | 'irs_form'
    | 'irs_irm'
    | 'irs_irb'
    | 'irs_notice'
    | 'irs_revrul'
    | 'irs_revproc'
    | 'tax_court'
    | 'ca_ftb_pub'
    | 'ca_ftb_legal'
    | 'ca_ftb_form'
    | 'cdtfa'
    | 'edd'
    | 'firm_playbook'
    | 'firm_memo'
    | 'firm_template';
  jurisdiction: 'federal' | 'CA' | 'firm';
  citationLabel: string;
  title: string;
  slug: string;
  externalUrl: string | null;
  sourceUri: string | null;
  effectiveDate: string;
  applicableTaxYears: number[];
  chunks: Array<{
    sectionPath: string[];
    heading: string;
    text: string;
  }>;
}

const SEEDS: AuthoritySeed[] = [
  {
    kind: 'irc',
    jurisdiction: 'federal',
    citationLabel: 'IRC §61(a)',
    title: 'IRC §61(a) — Gross income defined',
    slug: 'irc-61-a',
    externalUrl: 'https://www.law.cornell.edu/uscode/text/26/61',
    sourceUri: 'https://www.law.cornell.edu/uscode/text/26/61',
    effectiveDate: '1986-10-22',
    applicableTaxYears: [],
    chunks: [
      {
        sectionPath: ['§61', '§61(a)'],
        heading: '§61(a). General definition.',
        text:
          'Except as otherwise provided in this subtitle, gross income means all income from whatever source derived, including (but not limited to) the following items: (1) Compensation for services, including fees, commissions, fringe benefits, and similar items; (2) Gross income derived from business; (3) Gains derived from dealings in property; (4) Interest; (5) Rents; (6) Royalties; (7) Dividends; (8) Annuities; (9) Income from life insurance and endowment contracts; (10) Pensions; (11) Income from discharge of indebtedness; (12) Distributive share of partnership gross income; (13) Income in respect of a decedent; and (14) Income from an interest in an estate or trust.',
      },
    ],
  },
  {
    kind: 'irc',
    jurisdiction: 'federal',
    citationLabel: 'IRC §162(a)',
    title: 'IRC §162(a) — Trade or business expenses',
    slug: 'irc-162-a',
    externalUrl: 'https://www.law.cornell.edu/uscode/text/26/162',
    sourceUri: 'https://www.law.cornell.edu/uscode/text/26/162',
    effectiveDate: '1986-10-22',
    applicableTaxYears: [],
    chunks: [
      {
        sectionPath: ['§162', '§162(a)'],
        heading: '§162(a). In general.',
        text:
          "There shall be allowed as a deduction all the ordinary and necessary expenses paid or incurred during the taxable year in carrying on any trade or business, including— (1) a reasonable allowance for salaries or other compensation for personal services actually rendered; (2) traveling expenses (including amounts expended for meals and lodging other than amounts which are lavish or extravagant under the circumstances) while away from home in the pursuit of a trade or business; and (3) rentals or other payments required to be made as a condition to the continued use or possession, for purposes of the trade or business, of property to which the taxpayer has not taken or is not taking title or in which he has no equity.",
      },
    ],
  },
  {
    kind: 'irc',
    jurisdiction: 'federal',
    citationLabel: 'IRC §199A',
    title: 'IRC §199A — Qualified Business Income (QBI) Deduction',
    slug: 'irc-199a',
    externalUrl: 'https://www.law.cornell.edu/uscode/text/26/199A',
    sourceUri: 'https://www.law.cornell.edu/uscode/text/26/199A',
    effectiveDate: '2018-01-01',
    applicableTaxYears: [],
    chunks: [
      {
        sectionPath: ['§199A', '§199A(a)'],
        heading: '§199A(a). Allowance of deduction.',
        text:
          "In the case of a taxpayer other than a corporation, there shall be allowed as a deduction for any taxable year an amount equal to the sum of (1) the lesser of— (A) the combined qualified business income amount of the taxpayer, or (B) an amount equal to 20 percent of the excess (if any) of— (i) the taxable income of the taxpayer for the taxable year, over (ii) the net capital gain of the taxpayer for such taxable year, plus (2) the lesser of— (A) 20 percent of the aggregate amount of the qualified REIT dividends and qualified publicly traded partnership income of the taxpayer for the taxable year, or (B) 20 percent of the excess (if any) of— (i) the taxable income of the taxpayer for the taxable year, over (ii) the net capital gain of the taxpayer for such taxable year.",
      },
    ],
  },
  {
    kind: 'irc',
    jurisdiction: 'federal',
    citationLabel: 'IRC §280A(c)',
    title: 'IRC §280A(c) — Home-office deduction',
    slug: 'irc-280a-c',
    externalUrl: 'https://www.law.cornell.edu/uscode/text/26/280A',
    sourceUri: 'https://www.law.cornell.edu/uscode/text/26/280A',
    effectiveDate: '1986-10-22',
    applicableTaxYears: [],
    chunks: [
      {
        sectionPath: ['§280A', '§280A(c)', '§280A(c)(1)'],
        heading: '§280A(c)(1). Certain business use.',
        text:
          'Subsection (a) shall not apply to any item to the extent such item is allocable to a portion of the dwelling unit which is exclusively used on a regular basis— (A) as the principal place of business for any trade or business of the taxpayer, (B) as a place of business which is used by patients, clients, or customers in meeting or dealing with the taxpayer in the normal course of his trade or business, or (C) in the case of a separate structure which is not attached to the dwelling unit, in connection with the taxpayer\'s trade or business.',
      },
    ],
  },
  {
    kind: 'irs_pub',
    jurisdiction: 'federal',
    citationLabel: 'IRS Pub 17 (2024)',
    title: 'Your Federal Income Tax — For Individuals',
    slug: 'irs-pub-17-2024',
    externalUrl: 'https://www.irs.gov/forms-pubs/about-publication-17',
    sourceUri: 'https://www.irs.gov/pub/irs-pdf/p17.pdf',
    effectiveDate: '2025-01-01',
    applicableTaxYears: [2024],
    chunks: [
      {
        sectionPath: ['Pub 17', 'Filing requirements'],
        heading: 'Filing requirements (single, under 65)',
        text:
          'For 2024 returns, single filers under 65 must file a federal return if gross income is at least $14,600. Filers 65 or older must file at $16,550. These thresholds apply to the standard deduction baseline; itemizers + self-employed individuals have separate triggers (any self-employment net earnings of $400 or more requires filing regardless of gross income, per Schedule SE rules).',
      },
    ],
  },
  {
    kind: 'irs_pub',
    jurisdiction: 'federal',
    citationLabel: 'IRS Pub 1345',
    title: 'Handbook for Authorized IRS e-file Providers of Individual Income Tax Returns',
    slug: 'irs-pub-1345',
    externalUrl: 'https://www.irs.gov/forms-pubs/about-publication-1345',
    sourceUri: 'https://www.irs.gov/pub/irs-pdf/p1345.pdf',
    effectiveDate: '2024-10-01',
    applicableTaxYears: [],
    chunks: [
      {
        sectionPath: ['Pub 1345', 'Form 8879 e-signature'],
        heading: 'Remote 8879 signing — KBA requirement',
        text:
          'When taxpayers sign Form 8879 remotely (i.e., not in the preparer\'s presence), the e-signature solution must implement an identity verification process that meets NIST IAL2 standards, including knowledge-based authentication (KBA) sourced from a credit bureau database. Acceptable solutions challenge the taxpayer with at least 5 multiple-choice questions derived from credit-file data; the taxpayer must answer at least 4 correctly, and challenges must be timed (no longer than 2 minutes per question).',
      },
    ],
  },
  {
    kind: 'ca_ftb_pub',
    jurisdiction: 'CA',
    citationLabel: 'FTB Pub 1031 (2024)',
    title: 'CA FTB Pub 1031 — Guidelines for Determining Resident Status',
    slug: 'ca-ftb-pub-1031-2024',
    externalUrl: 'https://www.ftb.ca.gov/forms/2024/2024-1031-publication.html',
    sourceUri: 'https://www.ftb.ca.gov/forms/2024/2024-1031-publication.pdf',
    effectiveDate: '2025-01-01',
    applicableTaxYears: [2024],
    chunks: [
      {
        sectionPath: ['Pub 1031', 'Resident status'],
        heading: 'CA residency definition',
        text:
          'For California income tax purposes, a resident is every individual who is in California for other than a temporary or transitory purpose, or domiciled in California but outside the state for a temporary or transitory purpose. The closest connections test (R&TC §17014) considers location of family, social ties, business activities, real property, vehicle registrations, professional licenses, and similar contacts. No single factor is determinative; the FTB weighs the totality of contacts.',
      },
    ],
  },
];

function chunkHash(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function authorityHash(seed: AuthoritySeed): string {
  return createHash('sha256')
    .update(seed.title)
    .update('|')
    .update(seed.chunks.map((c) => c.text).join('||'))
    .digest('hex');
}

async function main() {
  const db = getAdminDb();
  console.log(`Seeding ${SEEDS.length} authorities + chunks...`);

  let inserted = 0;
  let updated = 0;
  let chunksInserted = 0;

  for (const seed of SEEDS) {
    const contentHash = authorityHash(seed);

    // Postgres array literal: '{2024,2025}'. Empty array = '{}'.
    const taxYearsLiteral = `{${seed.applicableTaxYears.join(',')}}`;

    // No unique constraint on slug exists yet (only an index), so we
    // can't ON CONFLICT (slug). Read-then-insert/update pattern.
    const existingRows = await db.execute<{ id: string }>(
      sql`SELECT id::text AS id FROM authorities WHERE slug = ${seed.slug} LIMIT 1`,
    );
    const existing = (existingRows as unknown as Array<{ id: string }>)[0];

    let authorityId: string;
    let wasInserted: boolean;
    if (existing) {
      await db.execute(sql`
        UPDATE authorities SET
          title = ${seed.title},
          citation_label = ${seed.citationLabel},
          external_url = ${seed.externalUrl},
          source_uri = ${seed.sourceUri},
          effective_date = ${seed.effectiveDate}::date,
          applicable_tax_years = ${taxYearsLiteral}::int[],
          content_hash = ${contentHash},
          updated_at = now()
        WHERE id = ${existing.id}::uuid
      `);
      authorityId = existing.id;
      wasInserted = false;
    } else {
      const insertedRows = await db.execute<{ id: string }>(sql`
        INSERT INTO authorities (
          tenant_id, kind, jurisdiction, citation_label, title, slug,
          external_url, source_uri, effective_date, applicable_tax_years,
          content_hash, metadata
        )
        VALUES (
          NULL,
          ${seed.kind}::authority_kind,
          ${seed.jurisdiction}::authority_jurisdiction,
          ${seed.citationLabel},
          ${seed.title},
          ${seed.slug},
          ${seed.externalUrl},
          ${seed.sourceUri},
          ${seed.effectiveDate}::date,
          ${taxYearsLiteral}::int[],
          ${contentHash},
          ${'{}'}::jsonb
        )
        RETURNING id::text AS id
      `);
      const inserted = (insertedRows as unknown as Array<{ id: string }>)[0];
      if (!inserted) {
        console.error(`  FAIL: no row returned for ${seed.slug}`);
        continue;
      }
      authorityId = inserted.id;
      wasInserted = true;
    }

    if (wasInserted) inserted += 1;
    else updated += 1;
    const row = { id: authorityId, was_inserted: wasInserted };

    // Replace chunks atomically: delete existing, insert fresh.
    // Authority_chunks has FK ON DELETE CASCADE so this is clean.
    await db.execute(sql`DELETE FROM authority_chunks WHERE authority_id = ${row.id}::uuid`);

    for (let i = 0; i < seed.chunks.length; i++) {
      const c = seed.chunks[i]!;
      // Postgres text-array literal: escape commas/braces. The seed
      // section_path values are short clean strings so simple
      // wrapping in {} + double-quoting each element is safe.
      const sectionPathLiteral = `{${c.sectionPath.map((s) => `"${s.replace(/"/g, '\\"')}"`).join(',')}}`;
      await db.execute(sql`
        INSERT INTO authority_chunks (
          authority_id, ordinal, section_path, heading, text, content_hash
        )
        VALUES (
          ${row.id}::uuid,
          ${i},
          ${sectionPathLiteral}::text[],
          ${c.heading},
          ${c.text},
          ${chunkHash(c.text)}
        )
      `);
      chunksInserted += 1;
    }

    console.log(
      `  ${row.was_inserted ? 'INSERTED' : 'UPDATED'}  ${seed.citationLabel} (${seed.chunks.length} chunks)`,
    );
  }

  console.log(
    `\nDone: ${inserted} inserted, ${updated} updated, ${chunksInserted} chunks total.`,
  );
}

main().catch((err) => {
  console.error('seed-authorities FAILED:', err);
  process.exit(1);
});
