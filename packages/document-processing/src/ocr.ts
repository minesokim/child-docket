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

// IMPORTANT — top-level imports of tesseract.js are forbidden here.
//
// tesseract.js v7 runs heavy initialization at module-load time
// (WASM detection, Worker-thread plumbing, fetch shimming). On
// Vercel's Node 24 serverless lambda, that init has historically
// crashed during cold-start. Worse, ANY module that imports this file
// at top-level inherits that crash — and ocr.ts is reachable from
// `@docket/document-processing` → `@docket/workers` → the /api/inngest
// serve handler. A tesseract load-time crash there means every
// Inngest dispatch (including classify-document, which doesn't even
// use OCR) hits a 500. Symptom: the upload "Reading…" spinner hangs
// forever because the classify event never gets handled.
//
// The fix: dynamic-import tesseract.js inside ocrToSearchablePdf()
// only. classify-document loads without paying the tesseract cost.
// finalize-document pays it on first invocation; if tesseract still
// crashes, the caller's try/catch falls back to wrapImageInPdf (image-
// only, non-searchable, but a valid PDF — pipeline does not break).

// Use a structural type for the cached worker so we don't need a
// type-only import from tesseract.js at module top.
type TesseractWorker = {
  recognize(
    image: Buffer,
    options: Record<string, unknown>,
    output: Record<string, boolean>,
  ): Promise<{ data: { pdf?: number[] | null } }>;
};

let _workerPromise: Promise<TesseractWorker> | null = null;

async function getOcrWorker(): Promise<TesseractWorker> {
  if (!_workerPromise) {
    const p = (async () => {
      // Dynamic import — runs only when this function is actually
      // called, NOT at module load. Keeps tesseract out of the
      // /api/inngest cold-start path.
      const tesseract = await import('tesseract.js');
      const worker = await tesseract.createWorker('eng');
      return worker as unknown as TesseractWorker;
    })();
    // Clear the cache on rejection so a transient crash (network
    // blip during language-data fetch, WASM init flake) doesn't
    // permanently poison the warm lambda. Without this, a single
    // failed call would cache the rejected promise — every future
    // OCR attempt in the same container returns the same rejection
    // without retrying. With this guard, the next call gets a fresh
    // attempt.
    p.catch(() => {
      if (_workerPromise === p) {
        _workerPromise = null;
      }
    });
    _workerPromise = p;
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
