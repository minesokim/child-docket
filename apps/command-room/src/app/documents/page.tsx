// /documents — operational view of every doc clients have uploaded.
//
// Closes the /documents 404 (CLAUDE.md section 18 known stub) and
// gives Antonio a single place to see what's flowing through the
// 4-phase doc-capture pipeline (uploaded → classifying → classified
// → finalized). Per docs/DOCS-CAPTURE-PIPELINE.md.
//
// Operational-modern visual language. Wraps in CommandShell.
//
// SCOPING
//   Tenant-scoped via withTenant + RLS.
//   Filter via ?filter=all|pending|classified|finalized (default all).
//
// AUTHZ
//   Role check inside the handler. firm_owner + preparer + reviewer
//   can all see this view (it's load-bearing for daily operations).
//   Lower roles get a restricted-state.

import { redirect } from 'next/navigation';
import { getCurrentDocketUser } from '@/lib/current-user';
import { CommandShell } from '@/components/command-shell';
import {
  listDocuments,
  countDocumentsByFilter,
  formatBytes,
  labelForClassification,
  labelForPhase,
  formatRelativeTime,
  type DocsListFilter,
  type DocumentRow,
} from '@/lib/documents-queries';
import './documents.css';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FILTER_TABS: { key: DocsListFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'classified', label: 'Classified' },
  { key: 'finalized', label: 'Finalized' },
];

const ALLOWED_FILTERS = new Set<DocsListFilter>([
  'all',
  'pending',
  'classified',
  'finalized',
]);

const ALLOWED_ROLES = new Set(['firm_owner', 'preparer', 'reviewer']);

function phaseClass(phase: string): string {
  if (phase === 'finalized' || phase === 'final') return 'docs-phase-finalized';
  if (phase === 'failed') return 'docs-phase-failed';
  if (phase === 'classifying' || phase === 'finalizing' || phase === 'accepted') {
    return 'docs-phase-progress';
  }
  return 'docs-phase-default';
}

function legibilityCue(legibility: number | null): {
  className: string;
  label: string;
} | null {
  if (legibility === null) return null;
  if (legibility >= 0.85) {
    return { className: 'docs-legib-good', label: 'Clear' };
  }
  if (legibility >= 0.5) {
    return { className: 'docs-legib-meh', label: 'Marginal' };
  }
  return { className: 'docs-legib-bad', label: 'Retake suggested' };
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await getCurrentDocketUser();
  if (!user) redirect('/sign-in');

  const params = await searchParams;
  const requested = params.filter as DocsListFilter | undefined;
  const filter: DocsListFilter =
    requested && ALLOWED_FILTERS.has(requested) ? requested : 'all';

  if (!ALLOWED_ROLES.has(user.role)) {
    return (
      <CommandShell user={user} tenantName={user.tenantName} activeHref="/documents">
        <div className="docs">
          <div className="docs-restricted">
            <h1 className="docs-restricted-title">Documents view restricted</h1>
            <p className="docs-restricted-body">
              Your role <span className="docs-restricted-role">{user.role}</span> does not
              include document oversight. Ask your firm owner if you need access.
            </p>
          </div>
        </div>
      </CommandShell>
    );
  }

  let docs: DocumentRow[] = [];
  let counts = { all: 0, pending: 0, classified: 0, finalized: 0 };
  let errorMessage: string | null = null;
  try {
    [docs, counts] = await Promise.all([
      listDocuments(user.tenantId, filter, 100),
      countDocumentsByFilter(user.tenantId),
    ]);
  } catch (err) {
    errorMessage = err instanceof Error ? err.message : 'Documents query failed';
  }

  return (
    <CommandShell user={user} tenantName={user.tenantName} activeHref="/documents">
      <div className="docs">
        <header className="docs-header">
          <div className="docs-eyebrow">Document pipeline</div>
          <h1 className="docs-title">Documents</h1>
          <nav className="docs-tabs" aria-label="Documents filter">
            {FILTER_TABS.map((tab) => {
              const count = counts[
                tab.key === 'all' ? 'all' : tab.key === 'pending' ? 'pending' : tab.key === 'classified' ? 'classified' : 'finalized'
              ];
              return (
                <a
                  key={tab.key}
                  href={`/documents?filter=${tab.key}`}
                  className={`docs-tab ${tab.key === filter ? 'docs-tab-active' : ''}`}
                  aria-current={tab.key === filter ? 'page' : undefined}
                >
                  <span>{tab.label}</span>
                  <span className="docs-tab-count">{count.toLocaleString()}</span>
                </a>
              );
            })}
          </nav>
        </header>

        {errorMessage ? (
          <div className="docs-error" role="alert">
            <div className="docs-error-title">Couldn't load documents</div>
            <div className="docs-error-body">{errorMessage}</div>
            <a href={`/documents?filter=${filter}`} className="docs-error-retry">
              Retry
            </a>
          </div>
        ) : docs.length === 0 ? (
          <div className="docs-empty">
            <div className="docs-empty-title">
              {filter === 'all'
                ? 'No documents uploaded yet.'
                : filter === 'pending'
                  ? 'Nothing pending classification.'
                  : filter === 'classified'
                    ? 'No documents waiting for finalize.'
                    : 'No finalized documents yet.'}
            </div>
            <div className="docs-empty-body">
              {filter === 'all'
                ? 'When clients upload documents through the portal, the doc-classifier picks them up here.'
                : filter === 'pending'
                  ? 'When new uploads arrive, they sit here until the classifier finishes.'
                  : filter === 'classified'
                    ? 'Once a document is classified and accepted, it moves through finalize and lands in the Finalized tab.'
                    : 'Finalized PDFs (with composite-merge applied where needed) appear here.'}
            </div>
          </div>
        ) : (
          <table className="docs-table" aria-label="Documents">
            <thead>
              <tr>
                <th scope="col">Client</th>
                <th scope="col">File</th>
                <th scope="col">Classification</th>
                <th scope="col">Phase</th>
                <th scope="col">Legibility</th>
                <th scope="col">Slot</th>
                <th scope="col" className="docs-th-right">Size</th>
                <th scope="col" className="docs-th-right">When</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => {
                const legib = legibilityCue(d.ai_legibility);
                return (
                  <tr key={d.id}>
                    <td className="docs-cell-client">{d.client_name ?? <em>—</em>}</td>
                    <td className="docs-cell-file">
                      <span className="docs-cell-file-name">
                        {d.final_filename ?? d.original_filename}
                      </span>
                      {d.ai_retake_hint && (
                        <span className="docs-cell-hint">{d.ai_retake_hint}</span>
                      )}
                    </td>
                    <td>
                      {d.ai_classification ? (
                        <span className="docs-class">
                          {labelForClassification(d.ai_classification)}
                          {d.ai_confidence !== null && (
                            <span className="docs-class-conf">
                              {Math.round(d.ai_confidence * 100)}%
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="docs-class-none">—</span>
                      )}
                    </td>
                    <td>
                      <span className={`docs-phase ${phaseClass(d.parse_phase)}`}>
                        {labelForPhase(d.parse_phase)}
                      </span>
                    </td>
                    <td>
                      {legib ? (
                        <span className={`docs-legib ${legib.className}`}>{legib.label}</span>
                      ) : (
                        <span className="docs-legib-none">—</span>
                      )}
                    </td>
                    <td className="docs-cell-slot">
                      {d.slot_id ?? <span className="docs-slot-none">unbound</span>}
                    </td>
                    <td className="docs-cell-right">{formatBytes(d.size_bytes)}</td>
                    <td className="docs-cell-right docs-cell-time">
                      {formatRelativeTime(d.created_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </CommandShell>
  );
}
