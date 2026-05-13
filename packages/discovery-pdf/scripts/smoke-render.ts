// Smoke: render the discovery-scan-sample-output.md gold-standard
// example into an actual PDF. Validates:
//   1. The render pipeline produces a non-empty PDF buffer
//   2. The buffer starts with the PDF magic bytes (%PDF-)
//   3. The output writes to disk so the operator can eyeball it
//
// Usage:
//   pnpm --filter @docket/discovery-pdf smoke
//
// Writes to packages/discovery-pdf/dist/sample-scan.pdf — gitignored
// because the file is generated, not source.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderDiscoveryScanPdf, type DiscoveryScanInput } from '../src/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Sample input — mirrors discovery-scan-sample-output.md (the
// gold-standard reference). Realistic numbers for a CA S-Corp owner
// with $43,400 in surfaced deductions across 4 tiers.
const SAMPLE_INPUT: DiscoveryScanInput = {
  meta: {
    firmName: 'Mendoza & Associates EAs',
    preparedFor: 'Maria Mendoza, EA',
    taxYear: 2025,
    generatedAt: '2026-05-11',
    entityType: 'S-Corp (1120-S) — Hernandez Construction Inc.',
    agiBucket: '$200K-$300K',
    schedules: ['K-1 (1120-S)', 'Schedule E', 'Schedule A (itemized)'],
    states: ['California'],
  },
  reasoning:
    'Strong fact pattern with multiple defensible deductions surfaced. Highest-confidence positions are settled-law deductions the return missed entirely (home office, self-employed health insurance, retirement contributions). One Tier 3 position requires Form 8275 disclosure. One Tier 4 position is preparer-judgment — review with the client before claiming.',
  confidence: 0.88,
  positions: [
    {
      claim:
        'Self-employed health insurance deduction under IRC §162(l) — $7,200 in shareholder-employee health premiums paid through the S-Corp, included in W-2 wages, deductible on Form 1040 above the line.',
      tier: 1,
      authority: [
        {
          source: 'irc',
          cite: '§162(l)',
          summary:
            'Self-employed individuals may deduct health insurance premiums paid for the taxpayer, spouse, dependents, and children under age 27.',
        },
        {
          source: 'irs-pub',
          cite: 'IRS Pub 535 Ch. 6',
          summary:
            'Self-employed health insurance deduction — covers the limitation to earned income from the business.',
        },
      ],
      estimatedImpact: { dollars: 7200, certainty: 'precise' },
      auditRisk: 'low',
      disclosureRequired: false,
      rationale:
        'S-Corp shareholder owns >2% of the company. Health premiums paid by the S-Corp must be included in W-2 wages (Box 1) and are then deductible on Form 1040 line 17 as an above-the-line adjustment. The return reports the premiums as wages but does not claim the §162(l) deduction. This is a one-line fix on Schedule 1.',
      gapsToConfirm: [
        'Verify premiums were actually reported in W-2 Box 1 wages (S-Corp 1120-S K-1 should show as wages or Box 14 fringe).',
      ],
    },
    {
      claim:
        'Home office deduction under IRC §280A(c)(1) — 220 sq ft dedicated office in a 2,200 sq ft home, used regularly and exclusively for management of the construction business.',
      tier: 1,
      authority: [
        {
          source: 'irc',
          cite: '§280A(c)(1)',
          summary:
            'Allows deduction for portion of dwelling unit used exclusively and regularly as principal place of business.',
        },
        {
          source: 'irs-pub',
          cite: 'IRS Pub 587',
          summary:
            'Business use of your home — actual expense method allocation rules.',
        },
      ],
      estimatedImpact: { dollars: 4100, certainty: 'estimate' },
      auditRisk: 'moderate',
      disclosureRequired: false,
      rationale:
        '10% business use of home (220/2200 sq ft). Allocable share of mortgage interest, real estate taxes, utilities, insurance, and depreciation under MACRS 39-year. Estimated impact assumes $36K total home expenses + $4K depreciation. Audit risk is moderate because home office is a historically-litigated area; the contemporaneous office-use record matters.',
      gapsToConfirm: [
        'Confirm dedicated office room (no personal use whatsoever).',
        'Obtain documentation of total annual home expenses.',
        'Calculate depreciable basis (purchase price minus land allocation).',
      ],
    },
    {
      claim:
        'SEP-IRA contribution for 2024 tax year — owner-employee can contribute up to 25% of W-2 wages, capped at $69,000.',
      tier: 1,
      authority: [
        {
          source: 'irc',
          cite: '§408(k)',
          summary:
            'Simplified Employee Pension (SEP) plan contribution and deduction rules.',
        },
      ],
      estimatedImpact: { dollars: 7300, certainty: 'precise' },
      auditRisk: 'low',
      disclosureRequired: false,
      rationale:
        'Owner W-2 = $120K. 25% × $120K = $30K maximum contribution; assume $7,300 federal + CA tax savings at marginal 24% federal + 9.3% CA on $30K contribution. Deduction goes on Form 1120-S, flows to K-1, reduces ordinary business income. Must be funded by the original or extended due date.',
      gapsToConfirm: [
        'Verify SEP plan documents executed (Form 5305-SEP or prototype).',
        'Confirm contribution made or scheduled by due date.',
      ],
    },
    {
      claim:
        'Augusta Rule — IRC §280A(g) 14-day rental of personal residence to S-Corp for board meetings, at fair-market daily rate.',
      tier: 2,
      authority: [
        {
          source: 'irc',
          cite: '§280A(g)',
          summary:
            'A dwelling unit used as a residence for less than 15 days during the year — rental income excluded from gross income; rental expenses not deductible against it.',
        },
        {
          source: 'tax-court',
          cite: 'Sinopoli v. Comm’r, T.C. Memo 2023-105',
          summary:
            'Court allowed §280A(g) rental between S-Corp and owner-employee where (a) actual board meetings held, (b) FMV daily rate documented via comparable, (c) contemporaneous minutes kept.',
        },
      ],
      estimatedImpact: { dollars: 8400, certainty: 'estimate' },
      auditRisk: 'moderate',
      disclosureRequired: false,
      rationale:
        '12 board meetings × $700 FMV daily rate × 1 day each = $8,400. S-Corp deducts as business expense (Schedule E flows through K-1). Owner excludes rental income from personal 1040 under §280A(g). Substantial authority post-Sinopoli; aggressive position 5 years ago, settled-ish now. Tier 2 because the IRS audit posture still scrutinizes documentation.',
      gapsToConfirm: [
        'Obtain board meeting minutes (12 sets) showing date, attendees, agenda, business decisions.',
        'Document FMV daily rate via 3 comparable local meeting-room rentals.',
        'Verify rental agreement between S-Corp and owner.',
      ],
    },
    {
      claim:
        'CA PTET election (AB-150) for 2024 — elective passthrough entity tax payment by S-Corp, generating federal SALT-cap workaround.',
      tier: 2,
      authority: [
        {
          source: 'ftb-pub',
          cite: 'FTB Notice 2022-01',
          summary:
            'CA Pass-Through Entity Elective Tax — eligibility, computation, and election procedure under R&TC §17052.10 + §19900-19906.',
        },
        {
          source: 'irs-pub',
          cite: 'IRS Notice 2020-75',
          summary:
            'PTET payments by entity are deductible at entity level for federal purposes; not subject to $10K SALT cap.',
        },
      ],
      estimatedImpact: { dollars: 4400, certainty: 'estimate' },
      auditRisk: 'low',
      disclosureRequired: false,
      rationale:
        '9.3% × $200K qualifying net income = $18,600 CA tax paid by S-Corp. Federal deduction at 24% marginal = $4,464 federal tax savings (CA tax becomes federal expense, bypassing $10K SALT cap). Election made on FTB Form 3804. Settled mechanism since 2021; IRS Notice 2020-75 explicit. Tier 2 not Tier 1 because the timing of payment (must be made by 3/15 of election year for the first installment) is a common compliance gap.',
      gapsToConfirm: [
        'Verify FTB Form 3804 filed timely.',
        'Confirm first installment paid by 6/15/2024 (50% of expected tax or $1K, whichever greater).',
        'Confirm balance paid by 3/15/2025.',
      ],
    },
    {
      claim:
        'Accountable-plan reimbursements for owner-employee — vehicle, phone, internet, home-office utilities reimbursed by S-Corp to owner-employee, deductible to corp + tax-free to owner.',
      tier: 3,
      authority: [
        {
          source: 'treas-reg',
          cite: 'Treas. Reg. §1.62-2',
          summary:
            'Reimbursement and other expense allowance arrangements — substantiation, return of excess, business connection.',
        },
      ],
      estimatedImpact: { dollars: 5800, certainty: 'estimate' },
      auditRisk: 'moderate',
      disclosureRequired: true,
      rationale:
        'Under Treas. Reg. §1.62-2, an accountable plan allows the corp to deduct expense reimbursements while keeping them tax-free to the owner-employee. Requires (a) business connection, (b) substantiation, (c) return of excess. Many EAs miss the formal accountable-plan documentation requirement; without it, reimbursements become taxable wages. Tier 3 because the plan documentation must exist BEFORE reimbursements are paid; retroactive adoption is the audit-risk piece.',
      gapsToConfirm: [
        'Verify written accountable-plan document executed by S-Corp board.',
        'Verify per-reimbursement substantiation (receipts, mileage logs, business purpose).',
        'Confirm any excess advances returned within 120 days.',
      ],
    },
    {
      claim:
        'Section 179 expensing for $32K in equipment purchased mid-year — full immediate expensing under IRC §179, vs. 5-year MACRS.',
      tier: 3,
      authority: [
        {
          source: 'irc',
          cite: '§179',
          summary:
            'Election to expense certain depreciable business assets — limited to taxable income from active trade or business, subject to phase-out above $3.05M placed in service (2024).',
        },
      ],
      estimatedImpact: { dollars: 3600, certainty: 'estimate' },
      auditRisk: 'low',
      disclosureRequired: true,
      rationale:
        'Construction company purchased $32K of equipment (tools, vehicle conversion, computer). §179 allows immediate expensing of qualifying property up to $1.16M (2024 cap). Tax savings ~$3,600 at marginal rates. Disclosure required if claiming on Form 4562 in a way that varies from federal-only convention (e.g., CA does not conform to bonus depreciation — must reconcile basis). Tier 3 because the election is annual, irrevocable, and interacts with PTET election timing.',
      gapsToConfirm: [
        'Obtain equipment purchase invoices with placed-in-service dates.',
        'Verify business-use percentage (must be >50% for §179).',
        'Calculate CA reconciliation (CA does not allow bonus depreciation; track basis separately).',
      ],
    },
    {
      claim:
        'Research & development credit under IRC §41 for software process improvements developed in-house for construction-management workflow.',
      tier: 4,
      authority: [
        {
          source: 'irc',
          cite: '§41',
          summary:
            'Credit for increasing research activities — qualified research expenses (wages, supplies, contract research) for new or improved business components.',
        },
      ],
      estimatedImpact: { dollars: 2600, certainty: 'estimate' },
      auditRisk: 'high',
      disclosureRequired: false,
      rationale:
        'Construction company built custom estimating software in-house (~120 hours of owner-employee time). MLTN: §41 four-part test (permitted purpose, technological uncertainty, process of experimentation, technological in nature) is plausible for novel software development but requires substantial documentation. Audit risk is high — IRS has flagged R&D credit as a focus area, and small-business software claims face heightened scrutiny. Tier 4: surface to preparer, do not claim without further development.',
      gapsToConfirm: [
        'Run §41 four-part test analysis with documentation.',
        'Compute base amount + Alternative Simplified Credit (ASC) — small company likely uses ASC at 14%.',
        'Consider Form 6765 election.',
        'Decide whether to claim — high audit risk + uncertain qualification favors deferring.',
      ],
    },
  ],
  refusedPositions: [
    {
      hypothetical:
        'Deduct 100% of vehicle expenses under actual-expense method without contemporaneous mileage log.',
      reason:
        'Lacks substantiation under IRC §274(d), which imposes strict contemporaneous recordkeeping for vehicle, travel, and entertainment. Without log, position falls below Reasonable Basis.',
    },
    {
      hypothetical:
        'Augusta Rule rental at $2,500/day instead of $700 FMV — claiming higher rate to maximize deduction.',
      reason:
        'Court precedent (Sinopoli, post-2023 audit guidance) requires daily rate be supported by 3+ local comparables for similar meeting space. $2,500/day exceeds defensible FMV for a 2,200 sq ft suburban home.',
    },
    {
      hypothetical:
        'Treat owner-employee wages of $40K as "reasonable compensation" while distributing $180K as nontaxable dividend.',
      reason:
        'S-Corp reasonable-compensation doctrine (IRC §1366; Rev. Rul. 74-44; Watson v. Comm’r, 668 F.3d 1008 (8th Cir. 2012)) requires reasonable wages relative to services performed. $40K wages on a sole-shareholder/sole-worker $220K-AGI construction company is below any defensible benchmark and would be re-characterized on audit.',
    },
  ],
};

async function main() {
  console.log('--- discovery-pdf smoke ---');
  const t0 = Date.now();
  const buffer = await renderDiscoveryScanPdf(SAMPLE_INPUT);
  const elapsedMs = Date.now() - t0;

  // Assertion 1: non-empty buffer
  if (!Buffer.isBuffer(buffer)) {
    throw new Error('renderDiscoveryScanPdf did not return a Buffer');
  }
  if (buffer.length === 0) {
    throw new Error('renderDiscoveryScanPdf returned an empty buffer');
  }

  // Assertion 2: PDF magic bytes — every valid PDF starts with "%PDF-"
  const head = buffer.subarray(0, 5).toString('utf-8');
  if (head !== '%PDF-') {
    throw new Error(
      `Output does not start with PDF magic bytes. Got: "${head}"`,
    );
  }

  // Write to disk so the operator can eyeball it
  const distDir = path.resolve(__dirname, '../dist');
  await fs.mkdir(distDir, { recursive: true });
  const outPath = path.join(distDir, 'sample-scan.pdf');
  await fs.writeFile(outPath, buffer);

  console.log(`  PASS  rendered ${buffer.length} bytes in ${elapsedMs}ms`);
  console.log(`  PASS  PDF magic bytes verified`);
  console.log(`  PASS  written to: ${outPath}`);
  console.log();
  console.log(
    `Open the PDF to verify visual layout. Sample data is the gold-standard reference from docs/discovery-scan-sample-output.md.`,
  );
}

main().catch((err) => {
  console.error('smoke-render FAILED:', err);
  process.exit(1);
});
