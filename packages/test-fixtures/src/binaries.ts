// Placeholder binary content for test fixtures.
//
// These are NOT real tax documents. They're tiny PNG/PDF buffers that:
//   - Satisfy MIME validation (valid file headers)
//   - Are small enough to upload fast (~70 bytes for PNGs, ~600 for PDFs)
//   - Can be deterministically replayed in tests (stable bytes)
//
// Real-image fixtures for AI classifier eval testing land in V1.5 — those
// require synthesized tax docs (W-2 templates with fake data, etc.) and
// hand-labeled expected classifications. See README §"Real-image fixtures".

// 1×1 white PNG, RFC-compliant.
//
// PNG signature (8 bytes) + IHDR (13+12 bytes) + IDAT (zlib-deflate 1 white
// pixel) + IEND. Total: 67 bytes. Decodes cleanly in every PNG reader we've
// tested (sharp, pdf-lib's embedPng, Tesseract).
const PNG_1X1_WHITE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Minimal valid PDF — single empty page.
//
// PDF spec: header `%PDF-1.4` + xref table + trailer with /Root pointing
// at /Pages → /Page with empty contents. ~600 bytes. Renders as a blank
// page in every PDF viewer.
const PDF_BLANK_BASE64 =
  'JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PCAvVHlwZSAvUGFnZSAvUGFyZW50IDEgMCBSIC9NZWRpYUJveCBbMCAwIDU5NSA4NDJdIC9SZXNvdXJjZXMgMiAwIFIgL0NvbnRlbnRzIDQgMCBSID4+CmVuZG9iago0IDAgb2JqCjw8IC9MZW5ndGggMCA+PgpzdHJlYW0KCmVuZHN0cmVhbQplbmRvYmoKMSAwIG9iago8PCAvVHlwZSAvUGFnZXMgL0tpZHMgWzMgMCBSXSAvQ291bnQgMSA+PgplbmRvYmoKMiAwIG9iago8PCAvUHJvY1NldCBbL1BERl0gPj4KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0NhdGFsb2cgL1BhZ2VzIDEgMCBSID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYNCjAwMDAwMDAyMDIgMDAwMDAgbg0KMDAwMDAwMDI1NCAwMDAwMCBuDQowMDAwMDAwMDE1IDAwMDAwIG4NCjAwMDAwMDAxMzIgMDAwMDAgbg0KMDAwMDAwMDI4OCAwMDAwMCBuDQp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgNSAwIFIgPj4Kc3RhcnR4cmVmCjMzNgolJUVPRgo=';

/** 1×1 white PNG. Use as placeholder for any image-doc fixture. */
export const PLACEHOLDER_PNG_BYTES: Buffer = Buffer.from(PNG_1X1_WHITE_BASE64, 'base64');

/** Minimal valid PDF (single blank page). Use for PDF-input fixtures. */
export const PLACEHOLDER_PDF_BYTES: Buffer = Buffer.from(PDF_BLANK_BASE64, 'base64');

/** Sanity helper — every fixture binary must pass this. */
export function isValidPng(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf[0] === 0x89 &&
    buf[1] === 0x50 && // P
    buf[2] === 0x4e && // N
    buf[3] === 0x47 && // G
    buf[4] === 0x0d &&
    buf[5] === 0x0a &&
    buf[6] === 0x1a &&
    buf[7] === 0x0a
  );
}

/** Sanity helper — every PDF fixture must pass this. */
export function isValidPdf(buf: Buffer): boolean {
  return (
    buf.length >= 8 &&
    buf.subarray(0, 5).toString('ascii') === '%PDF-'
  );
}
