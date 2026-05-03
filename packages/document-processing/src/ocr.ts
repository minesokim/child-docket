// Tesseract OCR for binarized document images.
//
// Produces SEARCHABLE PDFs — Tesseract bakes both the original image
// AND an invisible text layer into a single PDF, with the text
// positioned exactly where the words appear in the image. PDF readers
// extract the invisible layer for selection / Cmd+F / copy.
//
// Why use Tesseract's built-in PDF output rather than our own hand-
// rolled invisible-text layer:
//   - Tesseract knows the exact pixel→PDF coordinate mapping for each
//     word it recognized; no manual scaling math.
//   - Output is a standard searchable PDF (the same format tesseract
//     CLI produces when run with `-c tessedit_create_pdf=1`); plays
//     well with every PDF reader and downstream tax-software importer.
//   - One Tesseract call per image, not one OCR + N drawText ops.
//
// COST
//   ~3-10 seconds per image on a typical phone-camera DL or W-2.
//   Worker is cached across invocations within the same lambda
//   instance, so subsequent calls in the same warm container are
//   faster (Tesseract init is the slow part, ~5s cold).
//
// FAILURE
//   Wrapped in try/catch by callers (processDocument, processMultiPage).
//   If OCR errors out, the pipeline falls back to wrapImageInPdf
//   (image-only, non-searchable but still a valid PDF).

import { createWorker, type Worker } from 'tesseract.js';

// Cached Tesseract worker — initialized lazily on first OCR call,
// reused across calls within the same Node process. Loading the
// English language model + WASM is the expensive step (~5s cold);
// after that, recognize() is fast.
//
// In a Vercel/Inngest serverless lambda, the worker survives across
// invocations as long as the container is warm.
let _workerPromise: Promise<Worker> | null = null;

function getOcrWorker(): Promise<Worker> {
  if (!_workerPromise) {
    _workerPromise = createWorker('eng');
  }
  return _workerPromise;
}

/**
 * Run Tesseract OCR on an image and return a complete searchable PDF.
 *
 * The PDF page is sized to the image's natural dimensions (no Letter
 * padding), with the image embedded as the visible page content and
 * an invisible text layer aligned to it. Selecting text in a viewer
 * extracts the OCR'd words at their on-page positions.
 *
 * Throws if Tesseract didn't return PDF bytes (worker init failure,
 * unsupported input, etc.). Caller should catch + fall back.
 */
export async function ocrToSearchablePdf(imageBytes: Buffer): Promise<Buffer> {
  const worker = await getOcrWorker();
  const result = await worker.recognize(
    imageBytes,
    {},
    {
      // Generate the searchable PDF as a side output of recognition.
      pdf: true,
      // We don't need the other formats; turning them off saves a few
      // MB of memory per call.
      blocks: false,
      hocr: false,
      tsv: false,
      text: false,
    },
  );

  const pdfBytes = result.data.pdf;
  if (!pdfBytes || pdfBytes.length === 0) {
    throw new Error('Tesseract recognize returned no PDF bytes');
  }
  return Buffer.from(pdfBytes);
}
