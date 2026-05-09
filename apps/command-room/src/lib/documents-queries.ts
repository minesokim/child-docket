// Documents queries — reads the documents table for the /documents
// route. Joins with clients for display, filters out merged-into rows,
// and ranks by recency.

import { sql } from 'drizzle-orm';
import { withTenant } from '@docket/db';
import type { TenantId } from '@docket/shared';

export type DocsListFilter = 'all' | 'pending' | 'classified' | 'finalized';

export interface DocumentRow {
  id: string;
  tenant_id: string;
  client_id: string;
  client_name: string | null;
  original_filename: string;
  mime_type: string;
  size_bytes: number;
  ai_classification: string | null;
  ai_confidence: number | null;
  ai_legibility: number | null;
  ai_retake_hint: string | null;
  parse_phase: string;
  slot_id: string | null;
  final_filename: string | null;
  finalized_at: string | null;
  accepted_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

const FILTER_TO_WHERE: Record<DocsListFilter, string> = {
  all: '',
  pending: "AND d.parse_phase IN ('uploaded', 'classifying')",
  classified: "AND d.ai_classification IS NOT NULL AND d.finalized_at IS NULL",
  finalized: 'AND d.finalized_at IS NOT NULL',
};

export async function listDocuments(
  tenantId: string,
  filter: DocsListFilter = 'all',
  limit = 100,
): Promise<DocumentRow[]> {
  const whereClause = FILTER_TO_WHERE[filter] ?? '';
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<DocumentRow>(sql`
      SELECT
        d.id::text AS id,
        d.tenant_id::text AS tenant_id,
        d.client_id::text AS client_id,
        c.full_name AS client_name,
        d.original_filename,
        d.mime_type,
        d.size_bytes,
        d.ai_classification,
        d.ai_confidence,
        d.ai_legibility,
        d.ai_retake_hint,
        d.parse_phase,
        d.slot_id,
        d.final_filename,
        CASE WHEN d.finalized_at IS NOT NULL
             THEN to_char(d.finalized_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             ELSE NULL END AS finalized_at,
        CASE WHEN d.accepted_at IS NOT NULL
             THEN to_char(d.accepted_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
             ELSE NULL END AS accepted_at,
        to_char(d.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
      FROM documents d
      LEFT JOIN clients c ON c.id = d.client_id
      WHERE d.merged_into_document_id IS NULL
        ${sql.raw(whereClause)}
      ORDER BY d.created_at DESC
      LIMIT ${limit}
    `);
    return rows as unknown as DocumentRow[];
  });
}

export async function countDocumentsByFilter(tenantId: string): Promise<{
  all: number;
  pending: number;
  classified: number;
  finalized: number;
}> {
  return await withTenant(tenantId as TenantId, async (db) => {
    const rows = await db.execute<{
      total: number;
      pending: number;
      classified: number;
      finalized: number;
    }>(sql`
      SELECT
        COUNT(*) FILTER (WHERE merged_into_document_id IS NULL)::int AS total,
        COUNT(*) FILTER (
          WHERE merged_into_document_id IS NULL
            AND parse_phase IN ('uploaded', 'classifying')
        )::int AS pending,
        COUNT(*) FILTER (
          WHERE merged_into_document_id IS NULL
            AND ai_classification IS NOT NULL
            AND finalized_at IS NULL
        )::int AS classified,
        COUNT(*) FILTER (
          WHERE merged_into_document_id IS NULL
            AND finalized_at IS NOT NULL
        )::int AS finalized
      FROM documents
    `);
    const r = (rows as unknown as Array<{
      total: number;
      pending: number;
      classified: number;
      finalized: number;
    }>)[0] ?? { total: 0, pending: 0, classified: 0, finalized: 0 };
    return {
      all: r.total,
      pending: r.pending,
      classified: r.classified,
      finalized: r.finalized,
    };
  });
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

const CLASSIFICATION_LABELS: Record<string, string> = {
  w2: 'W-2',
  '1099_nec': '1099-NEC',
  '1099_misc': '1099-MISC',
  '1099_div': '1099-DIV',
  '1099_int': '1099-INT',
  '1099_b': '1099-B',
  '1099_r': '1099-R',
  '1099_g': '1099-G',
  '1099_k': '1099-K',
  '1099_q': '1099-Q',
  '1099_sa': '1099-SA',
  '1099_misc_rents': '1099-MISC (rents)',
  '1098': '1098',
  '1098_t': '1098-T',
  '1098_e': '1098-E',
  k1: 'K-1',
  ssa_1099: 'SSA-1099',
  social_security_card: 'SSN card',
  drivers_license: 'Driver license',
  drivers_license_back: 'Driver license (back)',
  passport: 'Passport',
  i9: 'I-9',
  bank_statement: 'Bank statement',
  brokerage_statement: 'Brokerage statement',
  hsa_statement: 'HSA statement',
  prior_year_return: 'Prior year return',
  receipt: 'Receipt',
  invoice: 'Invoice',
  other: 'Other',
};

export function labelForClassification(s: string | null): string {
  if (!s) return 'Unknown';
  return CLASSIFICATION_LABELS[s] ?? s.replace(/_/g, ' ');
}

const PHASE_LABELS: Record<string, string> = {
  uploaded: 'Uploaded',
  classifying: 'Classifying',
  classified: 'Classified',
  accepted: 'Accepted',
  finalizing: 'Finalizing',
  finalized: 'Finalized',
  // 'final' is the legacy short form some seed/older rows use; treat as
  // synonymous with 'finalized' so the UI doesn't render the bare token.
  final: 'Finalized',
  failed: 'Failed',
};

export function labelForPhase(s: string): string {
  return PHASE_LABELS[s] ?? s;
}

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - t) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
