// @docket/discovery-pdf — render Discovery Scan output to a branded
// PDF artifact. The PDF is the marketing deliverable for the
// Discovery Scan free-tier offer (docs/DISCOVERY-SCAN-OPERATIONAL.md):
// a prospect-facing artifact that demonstrates the Position Framework
// running over a real (redacted) return.
//
// PUBLIC API
//   - renderDiscoveryScanPdf(input): Promise<Buffer>
//     The one function callers need. Composes the document and
//     returns a Buffer ready to write to disk, R2, or pipe to Resend
//     as an email attachment.
//   - DiscoveryScanInput type — input shape
//   - DiscoveryScanDocument — the JSX component, exported for tests
//     + future variations (e.g. a partner-firm branded variant)
//
// COST + LATENCY
//   - $0 (no model calls, no external services)
//   - ~50-200ms render for a typical 6-12 page scan
//   - Pure CPU; safe to run inside an Inngest function

// React import is required at the .tsx -> .js transpile boundary
// regardless of tsconfig's `jsx: "react-jsx"` mode. tsx (the runner)
// may emit `React.createElement(...)` calls depending on its loader
// settings — without the import, runtime fails with "React is not
// defined" on the `<DiscoveryScanDocument input={...} />` call below.
// Belt-and-suspenders import keeps the package portable across
// build tooling.
import * as React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { DiscoveryScanDocument } from './DiscoveryScanDocument.js';
import { type DiscoveryScanInput } from './types.js';

export {
  DiscoveryScanDocument,
  type DiscoveryScanDocumentProps,
} from './DiscoveryScanDocument.js';
export {
  type DiscoveryScanInput,
  type PdfPosition,
  type PdfRefusedPosition,
  type PdfCitation,
  type PdfScanMeta,
  type Tier,
  sumImpactByTier,
} from './types.js';

/**
 * Render a Discovery Scan to a PDF buffer.
 *
 * @param input - The scan data (meta + positions + refused).
 * @returns Buffer ready to write to disk or pipe to email/storage.
 *
 * @example
 *   const buffer = await renderDiscoveryScanPdf({
 *     meta: { firmName: 'Vazant Consulting', preparedFor: 'Antonio Vazquez, EA', taxYear: 2024, generatedAt: '2026-05-12' },
 *     positions: [...],
 *     refusedPositions: [...],
 *   });
 *   await fs.writeFile('discovery-scan.pdf', buffer);
 */
export async function renderDiscoveryScanPdf(
  input: DiscoveryScanInput,
): Promise<Buffer> {
  return await renderToBuffer(<DiscoveryScanDocument input={input} />);
}
