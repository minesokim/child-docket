// DiscoveryScanDocument — the root react-pdf Document for a single
// Discovery Scan delivery. Renders cover page, executive summary,
// per-tier position cards, refused-positions section, and a
// methodology + disclaimer footer.
//
// Visual language: editorial-warm cream canvas + forest green
// primary + Fraunces display + DM Sans body. Mirrors the v4 Vazant
// portal tone (CLAUDE.md §11) because Discovery is the EA-facing
// marketing artifact; it has to feel like the rest of Docket.
//
// SCOPE NOTE: v0 lays out the structure cleanly with react-pdf
// primitives. Polish passes (paragraph hyphenation, tighter widow
// control, custom callouts) are tracked in PRODUCTION-READINESS.
// First production deliverable is Antonio's reference scan target
// 6/15 (per OVERNIGHT-HANDOFF-2026-05-11).

import * as React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { colors, fonts, sizes, tierColor, tierLabel, auditRiskColor } from './tokens.js';
import {
  type DiscoveryScanInput,
  type PdfPosition,
  type PdfRefusedPosition,
  type PdfCitation,
  type Tier,
  sumImpactByTier,
} from './types.js';

const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.canvas,
    paddingTop: sizes.margin,
    paddingBottom: sizes.margin,
    paddingLeft: sizes.margin,
    paddingRight: sizes.margin,
    fontFamily: fonts.body,
    fontSize: sizes.body.md,
    color: colors.ink,
  },
  // Cover page — single big block, centered visually
  coverWrap: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  coverHeader: {
    fontFamily: fonts.display,
    fontSize: sizes.display.lg,
    color: colors.primary,
    fontWeight: 700,
    letterSpacing: 2,
  },
  coverTitle: {
    fontFamily: fonts.display,
    fontSize: sizes.display.xl,
    color: colors.ink,
    marginTop: 80,
  },
  coverFirm: {
    fontFamily: fonts.display,
    fontSize: sizes.display.md,
    color: colors.ink,
    marginTop: 8,
  },
  coverSubtitle: {
    fontSize: sizes.body.lg,
    color: colors.inkSoft,
    marginTop: 40,
  },
  coverPreparedFor: {
    fontSize: sizes.body.md,
    color: colors.inkSoft,
    marginTop: 6,
  },
  coverTagline: {
    fontSize: sizes.body.md,
    color: colors.muted,
    fontStyle: 'italic',
    marginTop: 4,
  },
  // Section + page-internal headings
  sectionHeader: {
    fontFamily: fonts.display,
    fontSize: sizes.display.md,
    color: colors.ink,
    marginBottom: 4,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginTop: 4,
    marginBottom: sizes.sectionGap,
  },
  label: {
    fontSize: sizes.body.sm,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  body: {
    fontSize: sizes.body.md,
    color: colors.ink,
    lineHeight: 1.45,
    marginBottom: sizes.paragraphGap,
  },
  bodySoft: {
    fontSize: sizes.body.md,
    color: colors.inkSoft,
    lineHeight: 1.45,
  },
  // Executive summary table
  totalsBox: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginTop: 12,
    marginBottom: 18,
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  totalsRowLast: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    marginTop: 6,
  },
  totalsTierCell: {
    fontSize: sizes.body.md,
    color: colors.ink,
    flexBasis: '60%',
  },
  totalsCountCell: {
    fontSize: sizes.body.md,
    color: colors.inkSoft,
    flexBasis: '20%',
    textAlign: 'right',
  },
  totalsAmountCell: {
    fontSize: sizes.body.md,
    color: colors.ink,
    flexBasis: '20%',
    textAlign: 'right',
  },
  totalsAmountStrong: {
    fontWeight: 700,
  },
  // Per-position card
  positionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 14,
  },
  positionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  tierBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    fontSize: sizes.body.sm,
    color: colors.canvas,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  claim: {
    fontSize: sizes.body.lg,
    color: colors.ink,
    marginBottom: 8,
    fontWeight: 600,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 8,
    gap: 12,
  },
  metaCell: {
    flexDirection: 'column',
  },
  metaLabel: {
    fontSize: sizes.body.sm,
    color: colors.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaValue: {
    fontSize: sizes.body.md,
    color: colors.ink,
    marginTop: 2,
  },
  // Citation block
  citationBlock: {
    marginTop: 6,
    marginBottom: 6,
  },
  citationLine: {
    fontSize: sizes.body.sm,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  citationCite: {
    fontWeight: 700,
    color: colors.ink,
  },
  // Gaps list
  gapsBlock: {
    marginTop: 4,
  },
  gapItem: {
    fontSize: sizes.body.sm,
    color: colors.inkSoft,
    marginBottom: 2,
  },
  // 8275 disclosure flag — visually distinct
  disclosureFlag: {
    fontSize: sizes.body.sm,
    color: colors.tier3,
    fontWeight: 700,
    marginTop: 6,
  },
  // Refused position block — neutral, not alarming
  refusedCard: {
    backgroundColor: colors.primarySoft,
    padding: 12,
    marginBottom: 10,
  },
  refusedHypothetical: {
    fontSize: sizes.body.md,
    color: colors.ink,
    fontWeight: 600,
    marginBottom: 4,
  },
  refusedReason: {
    fontSize: sizes.body.sm,
    color: colors.inkSoft,
    lineHeight: 1.4,
  },
  // Footer methodology block
  footerBox: {
    marginTop: 18,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    fontSize: sizes.body.sm,
    color: colors.muted,
    lineHeight: 1.4,
    marginBottom: 6,
  },
});

function formatDollars(n: number): string {
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatAuditRisk(r: 'low' | 'moderate' | 'high'): string {
  return r.charAt(0).toUpperCase() + r.slice(1);
}

function CoverPage({ meta }: { meta: DiscoveryScanInput['meta'] }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <View style={styles.coverWrap}>
        <View>
          <Text style={styles.coverHeader}>DOCKET</Text>
        </View>
        <View>
          <Text style={styles.coverTitle}>Discovery Scan</Text>
          <Text style={styles.coverFirm}>{meta.firmName}</Text>
          <Text style={styles.coverSubtitle}>
            Position Framework analysis · Tax Year {meta.taxYear}
          </Text>
          <Text style={styles.coverPreparedFor}>
            Prepared for {meta.preparedFor}
          </Text>
          <Text style={styles.coverPreparedFor}>
            Generated {meta.generatedAt}
          </Text>
        </View>
        <View>
          <Text style={styles.coverTagline}>
            "The AI defense layer for tax practices. Every position cited.
            Every action audit-trailed."
          </Text>
        </View>
      </View>
    </Page>
  );
}

function ExecutiveSummary({ input }: { input: DiscoveryScanInput }) {
  const { meta, positions, refusedPositions } = input;
  const total = sumImpactByTier(positions);
  const byTier = [1, 2, 3, 4] as const;
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.sectionHeader}>Executive Summary</Text>
      <View style={styles.divider} />

      <Text style={styles.label}>What we scanned</Text>
      <Text style={styles.body}>
        {meta.entityType ? `${meta.entityType} return · ` : ''}
        Tax Year {meta.taxYear}
        {meta.states && meta.states.length > 0
          ? ` · ${meta.states.join(', ')}`
          : ''}
      </Text>
      {meta.schedules && meta.schedules.length > 0 ? (
        <Text style={styles.bodySoft}>
          Schedules: {meta.schedules.join(', ')}
        </Text>
      ) : null}
      {meta.agiBucket ? (
        <Text style={styles.bodySoft}>AGI bucket: {meta.agiBucket}</Text>
      ) : null}

      <Text style={[styles.label, { marginTop: 18 }]}>What we surfaced</Text>
      <Text style={styles.body}>
        {formatDollars(total)} in additional defensible deductions across{' '}
        {positions.length} position{positions.length === 1 ? '' : 's'}.
        {refusedPositions.length > 0
          ? ` ${refusedPositions.length} hypothetical${
              refusedPositions.length === 1 ? '' : 's'
            } refused below Reasonable Basis (see end of report).`
          : ''}
      </Text>

      <View style={styles.totalsBox}>
        {byTier.map((tier, idx) => {
          const tierPositions = positions.filter((p) => p.tier === tier);
          if (tierPositions.length === 0) return null;
          const tierTotal = sumImpactByTier(positions, tier);
          return (
            <View style={styles.totalsRow} key={tier}>
              <Text style={[styles.totalsTierCell, { color: tierColor(tier) }]}>
                Tier {tier} — {tierLabel(tier)}
              </Text>
              <Text style={styles.totalsCountCell}>
                {tierPositions.length}{' '}
                {tierPositions.length === 1 ? 'position' : 'positions'}
              </Text>
              <Text style={styles.totalsAmountCell}>
                {formatDollars(tierTotal)}
              </Text>
            </View>
          );
        })}
        <View style={[styles.totalsRow, styles.totalsRowLast]}>
          <Text style={[styles.totalsTierCell, styles.totalsAmountStrong]}>
            Total surfaced
          </Text>
          <Text style={styles.totalsCountCell}>
            {positions.length}{' '}
            {positions.length === 1 ? 'position' : 'positions'}
          </Text>
          <Text style={[styles.totalsAmountCell, styles.totalsAmountStrong]}>
            {formatDollars(total)}
          </Text>
        </View>
      </View>

      {input.reasoning ? (
        <>
          <Text style={styles.label}>Summary</Text>
          <Text style={styles.body}>{input.reasoning}</Text>
        </>
      ) : null}
    </Page>
  );
}

function PositionCard({ position }: { position: PdfPosition }) {
  return (
    <View style={styles.positionCard} wrap={false}>
      <View style={styles.positionHeader}>
        <Text
          style={[
            styles.tierBadge,
            { backgroundColor: tierColor(position.tier) },
          ]}
        >
          Tier {position.tier}
        </Text>
        <Text
          style={[
            styles.metaValue,
            { color: tierColor(position.tier), fontWeight: 700 },
          ]}
        >
          {formatDollars(position.estimatedImpact.dollars)} (
          {position.estimatedImpact.certainty})
        </Text>
      </View>
      <Text style={styles.claim}>{position.claim}</Text>

      <View style={styles.metaRow}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Confidence</Text>
          <Text style={styles.metaValue}>{tierLabel(position.tier)}</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>Audit risk</Text>
          <Text
            style={[
              styles.metaValue,
              { color: auditRiskColor(position.auditRisk) },
            ]}
          >
            {formatAuditRisk(position.auditRisk)}
          </Text>
        </View>
      </View>

      <Text style={styles.label}>Authority</Text>
      <View style={styles.citationBlock}>
        {position.authority.map((cite, i) => (
          <Text style={styles.citationLine} key={i}>
            <Text style={styles.citationCite}>{cite.cite}</Text>
            {' — '}
            {cite.summary}
          </Text>
        ))}
      </View>

      <Text style={styles.label}>Rationale</Text>
      <Text style={styles.bodySoft}>{position.rationale}</Text>

      {position.disclosureRequired ? (
        <Text style={styles.disclosureFlag}>
          Form 8275 disclosure required — Reasonable Basis tier.
        </Text>
      ) : null}

      {position.gapsToConfirm.length > 0 ? (
        <View style={styles.gapsBlock}>
          <Text style={[styles.label, { marginTop: 8 }]}>To confirm</Text>
          {position.gapsToConfirm.map((gap, i) => (
            <Text style={styles.gapItem} key={i}>
              · {gap}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function PositionsByTier({
  positions,
  tier,
}: {
  positions: PdfPosition[];
  tier: Tier;
}) {
  const filtered = positions.filter((p) => p.tier === tier);
  if (filtered.length === 0) return null;
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.sectionHeader}>
        Tier {tier} — {tierLabel(tier)}
      </Text>
      <View style={styles.divider} />
      {filtered.map((position, i) => (
        <PositionCard position={position} key={i} />
      ))}
    </Page>
  );
}

function RefusedPositionsPage({
  refused,
}: {
  refused: PdfRefusedPosition[];
}) {
  if (refused.length === 0) return null;
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.sectionHeader}>Refused — below Reasonable Basis</Text>
      <View style={styles.divider} />
      <Text style={styles.body}>
        The Position Framework's refusal floor is the structural moat
        against unsupportable positions. These hypotheticals were
        considered and explicitly refused because they fall below
        Reasonable Basis. Listed here so the preparer can see the
        analysis we ran — not just the positions we surfaced.
      </Text>
      {refused.map((r, i) => (
        <View style={styles.refusedCard} key={i} wrap={false}>
          <Text style={styles.refusedHypothetical}>{r.hypothetical}</Text>
          <Text style={styles.refusedReason}>{r.reason}</Text>
        </View>
      ))}
    </Page>
  );
}

function MethodologyFooter({ meta }: { meta: DiscoveryScanInput['meta'] }) {
  return (
    <Page size="LETTER" style={styles.page}>
      <Text style={styles.sectionHeader}>Methodology + disclaimer</Text>
      <View style={styles.divider} />
      <Text style={styles.footerText}>
        Discovery Scans run Petal's Position Framework agent against a
        redacted version of the return. Each candidate position is
        classified into one of four confidence tiers (Settled law,
        Substantial Authority, Reasonable Basis + 8275, MLTN). Positions
        below Reasonable Basis are refused; those refusals are listed
        explicitly so the preparer can see the analysis.
      </Text>
      <Text style={styles.footerText}>
        Every position cites primary authority (Internal Revenue Code,
        Treasury Regulations, IRS Publications, Revenue Rulings, Tax
        Court opinions, FTB Publications). Citations resolve against
        Petal's authority library; the citation verifier flags any
        citation that did not match a known authority.
      </Text>
      <Text style={styles.footerText}>
        Dollar figures are estimates based on the redacted return as
        provided. The preparer is the decision-maker on every position;
        the EA's PTIN is on the return. This scan is not a substitute
        for engagement-level workpapers, an audit-defense file, or
        independent professional judgment.
      </Text>
      <Text style={styles.footerText}>
        Generated {meta.generatedAt} · {meta.firmName} · Petal Inc.
      </Text>
    </Page>
  );
}

export interface DiscoveryScanDocumentProps {
  input: DiscoveryScanInput;
}

export function DiscoveryScanDocument({
  input,
}: DiscoveryScanDocumentProps): React.ReactElement {
  return (
    <Document
      title={`Discovery Scan — ${input.meta.firmName} — TY ${input.meta.taxYear}`}
      author="Petal"
      subject="Position Framework Discovery Scan"
      creator="@docket/discovery-pdf"
    >
      <CoverPage meta={input.meta} />
      <ExecutiveSummary input={input} />
      {([1, 2, 3, 4] as const).map((tier) => (
        <PositionsByTier
          positions={input.positions}
          tier={tier}
          key={tier}
        />
      ))}
      <RefusedPositionsPage refused={input.refusedPositions} />
      <MethodologyFooter meta={input.meta} />
    </Document>
  );
}
