// @docket/document-processing — binarize + PDF wrap + filename helpers.
//
// Pipeline (runs in services/workers/finalize-document Inngest worker
// after the user accepts the AI classification):
//
//   raw-image-buffer → binarize → embed in PDF → upload as final
//
// SHARP — image processing in Node. Native bindings via libvips, fast,
// streaming-friendly. Used for grayscale + auto-contrast + Otsu threshold.
//
// PDF-LIB — pure-JS PDF builder. No native deps. Used for wrapping the
// binarized raster in a single- or multi-page PDF (or copying a clean
// PDF input).
//
// CONVENTIONS
//   - Final output is always a PDF, regardless of input format.
//   - All image inputs are binarized → 1-bit B&W "scanner output" look,
//     including IDs. The face-photo on a DL becomes a high-contrast
//     thumbnail, but the practitioner-relevant data (DL number, name,
//     DOB, expiry, barcode pattern) is sharper than the original phone
//     camera shot. Color preservation is available via the "view raw"
//     download in command-room when the original photo is needed.
//   - PDF inputs are pass-through copies. Don't degrade clean inputs.
//   - Multi-page support (processMultiPage) handles DL front+back
//     merging — the two raw images get binarized independently, then
//     embedded as page 1 and page 2 of the same PDF.

import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { ocrToSearchablePdf } from './ocr.js';

export { ocrToSearchablePdf } from './ocr.js';

export type ProcessOptions = {
  /** Raw bytes from R2 — original upload. */
  input: Buffer;
  /** MIME type of the input (image/png, image/jpeg, image/webp, image/gif, application/pdf). */
  inputMimeType: string;
  /** Classification kind from the AI — drives binarize-vs-color routing. */
  docKind: string;
};

export type ProcessResult = {
  /** Final PDF bytes ready for R2 upload. */
  pdf: Buffer;
  /** Bytes count of the final PDF. */
  sizeBytes: number;
  /** Whether binarization was applied. */
  binarized: boolean;
};

/**
 * Run the full finalization pipeline on a document. Returns a PDF
 * buffer ready to upload to R2 at the document's final_storage_key.
 *
 * Branching:
 *   - PDF input → pass-through (no re-encoding). Don't degrade clean inputs.
 *   - Image (any kind, including IDs) → binarize → Tesseract OCR
 *     → searchable PDF (image embedded + invisible text layer).
 *
 * If OCR fails (worker init crash, language load timeout, etc.) we
 * fall back to wrapImageInPdf — same image, no text layer. The user
 * still gets a valid PDF; they just can't Cmd+F search it.
 */
export async function processDocument(opts: ProcessOptions): Promise<ProcessResult> {
  // PDF input — pass through. The user uploaded a clean PDF (downloaded
  // their official W-2 from ADP, etc.). It's already searchable if the
  // source PDF had a text layer; re-OCR'ing would just degrade it.
  if (opts.inputMimeType === 'application/pdf') {
    return {
      pdf: opts.input,
      sizeBytes: opts.input.length,
      binarized: false,
    };
  }

  // All image inputs → binarize + Tesseract OCR PDF.
  const binarizedPng = await binarize(opts.input);

  try {
    const pdfBytes = await ocrToSearchablePdf(binarizedPng);
    return {
      pdf: pdfBytes,
      sizeBytes: pdfBytes.length,
      binarized: true,
    };
  } catch (err) {
    console.error('[document-processing] OCR failed; producing image-only PDF:', err);
    const pdfBytes = await wrapImageInPdf(binarizedPng, 'image/png', true);
    return {
      pdf: pdfBytes,
      sizeBytes: pdfBytes.length,
      binarized: true,
    };
  }
}

// ────────────────────────────────────────────────────────────────
// Multi-page composite. Today's caller: DL front + back merged
// into a single 2-page PDF.
//
// Each page's raw bytes get binarized independently (so a phone
// photo of the front and a phone photo of the back both go through
// the full grayscale → normalize → Otsu pipeline before being
// embedded as a PDF page). PDF inputs aren't supported here —
// callers pass image buffers, period.
// ────────────────────────────────────────────────────────────────

export type ProcessMultiPageInput = {
  /** Raw bytes for this page. */
  input: Buffer;
  /** image/png | image/jpeg | image/webp | image/gif. PDF NOT supported. */
  inputMimeType: string;
};

export async function processMultiPage(opts: {
  pages: ProcessMultiPageInput[];
}): Promise<ProcessResult> {
  if (opts.pages.length === 0) {
    throw new Error('processMultiPage: at least one page required');
  }

  // Per-page strategy: binarize → OCR-to-PDF (preferred) or wrap-only
  // (fallback). Each page becomes its own single-page searchable PDF;
  // we then merge with mergePdfs to produce the final composite.
  //
  // Binarize + OCR per page (not in a single batch) because phone
  // shots vary in lighting page-to-page — a single Otsu threshold
  // would wash one out — and each page's invisible text layer needs
  // to align with that page's specific image dimensions.
  const perPagePdfs: Buffer[] = [];

  for (const page of opts.pages) {
    if (page.inputMimeType === 'application/pdf') {
      throw new Error('processMultiPage does not accept PDF inputs');
    }
    const binarized = await binarize(page.input);
    try {
      perPagePdfs.push(await ocrToSearchablePdf(binarized));
    } catch (err) {
      console.error('[document-processing] OCR failed for page; image-only PDF:', err);
      perPagePdfs.push(await wrapImageInPdf(binarized, 'image/png', true));
    }
  }

  const merged = await mergePdfs(perPagePdfs);
  return {
    pdf: merged,
    sizeBytes: merged.length,
    binarized: true,
  };
}

// ────────────────────────────────────────────────────────────────
// Binarization. Strategy:
//   1. Convert to grayscale
//   2. Auto-rotate via EXIF orientation
//   3. Resize to max 2400px on longest edge (kills overscanned phone
//      photos that would otherwise produce 50MB PDFs)
//   4. Normalize the histogram (auto-contrast — stretches the dynamic
//      range so dim photos become legible)
//   5. Compute Otsu's threshold from the histogram
//   6. Apply hard threshold — every pixel above → white, below → black
//   7. Output as 1-bit PNG (8x smaller than 8-bit grayscale)
// ────────────────────────────────────────────────────────────────

const MAX_DIMENSION = 2400; // longest edge in px

export async function binarize(input: Buffer): Promise<Buffer> {
  // Stage 1: grayscale + auto-rotate + resize + normalize.
  // .rotate() with no args reads the EXIF orientation tag, applies
  // the rotation, then strips the tag. Phone photos are notoriously
  // wrong-orientation by default.
  const stage1 = sharp(input)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .greyscale()
    .normalise(); // sharp's normalize stretches contrast 0..255

  // Compute the Otsu threshold from the post-normalize histogram.
  const { data: rawPixels, info } = await stage1
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const otsuValue = computeOtsuThreshold(rawPixels, info.width, info.height);

  // Stage 2: threshold + trim dead borders + output as 8-bit grayscale PNG.
  //
  // .trim() crops solid-color borders introduced by the original
  // photo (a phone shot of a DL on a dark countertop turns into a
  // black frame around the card after Otsu — without trim, the
  // resulting PDF has 30%+ dead area that makes the preview look
  // like a narrow horizontal slice).
  //
  // CRITICAL: NO `palette: true`. pdf-lib's embedPng() only accepts
  // 8-bit DeviceRGB or DeviceGray PNGs and throws on indexed/palette
  // PNGs. Tesseract.js's PDF embedder has similar limits. Outputting
  // 8-bit grayscale here keeps the file ~30% larger than 1-bit
  // indexed but guarantees BOTH downstream paths (tesseract searchable
  // PDF + the wrapImageInPdf fallback) accept the buffer. Visually the
  // pixels are still 0 or 255 — the PDF still looks like a fax-quality
  // B&W scan, just stored as grayscale rather than palette-indexed.
  const binarized = await sharp(input)
    .rotate()
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .greyscale()
    .normalise()
    .threshold(otsuValue)
    .trim({ threshold: 10 })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return binarized;
}

/**
 * Otsu's method — finds the threshold value that minimizes
 * intra-class variance between black and white pixels. Standard
 * algorithm; implementations identical across libraries.
 *
 * Pixels are an 8-bit grayscale Uint8Array (one byte per pixel).
 * Returns a threshold value in [0, 255].
 */
export function computeOtsuThreshold(
  pixels: Buffer | Uint8Array,
  _width: number,
  _height: number,
): number {
  const histogram = new Array<number>(256).fill(0);
  for (let i = 0; i < pixels.length; i++) {
    histogram[pixels[i]!]!++;
  }
  const total = pixels.length;

  let sumAll = 0;
  for (let t = 0; t < 256; t++) sumAll += t * histogram[t]!;

  let sumBackground = 0;
  let weightBackground = 0;
  let maxVariance = 0;
  // Track the FIRST and LAST t-value in the plateau of max variance.
  // For perfectly bimodal inputs, every t between the two modes has
  // equal variance — picking the centroid puts the threshold halfway
  // between the modes, which is what users intuit + what every doc-scan
  // implementation does.
  let plateauStart = 127;
  let plateauEnd = 127;

  for (let t = 0; t < 256; t++) {
    weightBackground += histogram[t]!;
    if (weightBackground === 0) continue;

    const weightForeground = total - weightBackground;
    if (weightForeground === 0) break;

    sumBackground += t * histogram[t]!;
    const meanBackground = sumBackground / weightBackground;
    const meanForeground = (sumAll - sumBackground) / weightForeground;

    const variance =
      weightBackground *
      weightForeground *
      (meanBackground - meanForeground) *
      (meanBackground - meanForeground);

    if (variance > maxVariance) {
      maxVariance = variance;
      plateauStart = t;
      plateauEnd = t;
    } else if (variance === maxVariance) {
      plateauEnd = t;
    }
  }

  return Math.round((plateauStart + plateauEnd) / 2);
}

// ────────────────────────────────────────────────────────────────
// Wrap an image (PNG/JPEG) in a single-page PDF.
//
// The PDF page is sized to the image's natural aspect ratio at a
// max long-dim of 8.5 inches (612pts). This means:
//   - Landscape DLs come out as wide pages with no top/bottom dead
//     space.
//   - Portrait W-2s come out as letter-portrait-ish pages with no
//     side dead space.
// Either way, when the PDF is rendered in a browser preview iframe,
// the image fills the visible area. No Letter-frame margins to
// produce a "narrow slice on a tall page" preview artifact.
// ────────────────────────────────────────────────────────────────

const PDF_LONG_DIM_PT = 612; // 8.5" at 72dpi

function pageSizeForImage(aspectRatio: number): [number, number] {
  if (aspectRatio >= 1) {
    return [PDF_LONG_DIM_PT, PDF_LONG_DIM_PT / aspectRatio];
  }
  return [PDF_LONG_DIM_PT * aspectRatio, PDF_LONG_DIM_PT];
}

export async function wrapImageInPdf(
  imageBytes: Buffer,
  mimeType: string,
  _binarized: boolean,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  let embeddedImage;
  if (mimeType === 'image/png') {
    embeddedImage = await pdfDoc.embedPng(imageBytes);
  } else if (mimeType === 'image/jpeg') {
    embeddedImage = await pdfDoc.embedJpg(imageBytes);
  } else {
    // GIF / WEBP — pdf-lib doesn't support these directly, so we run
    // them through sharp to produce JPEG first.
    const jpegBytes = await sharp(imageBytes).jpeg({ quality: 92 }).toBuffer();
    embeddedImage = await pdfDoc.embedJpg(jpegBytes);
  }

  const aspectRatio = embeddedImage.width / embeddedImage.height;
  const [pageW, pageH] = pageSizeForImage(aspectRatio);

  const page = pdfDoc.addPage([pageW, pageH]);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: pageW,
    height: pageH,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// ────────────────────────────────────────────────────────────────
// Multi-page wrap. Each entry becomes one PDF page sized to its
// own image's aspect ratio. Same image-fitted strategy as
// wrapImageInPdf — front and back of a DL preview at their native
// aspect, no whitespace.
// ────────────────────────────────────────────────────────────────
export async function wrapImagesInPdf(
  pages: Array<{ bytes: Buffer; mimeType: string }>,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();

  for (const page of pages) {
    let embeddedImage;
    if (page.mimeType === 'image/png') {
      embeddedImage = await pdfDoc.embedPng(page.bytes);
    } else if (page.mimeType === 'image/jpeg') {
      embeddedImage = await pdfDoc.embedJpg(page.bytes);
    } else {
      const jpegBytes = await sharp(page.bytes).jpeg({ quality: 92 }).toBuffer();
      embeddedImage = await pdfDoc.embedJpg(jpegBytes);
    }

    const aspectRatio = embeddedImage.width / embeddedImage.height;
    const [pageW, pageH] = pageSizeForImage(aspectRatio);

    const pdfPage = pdfDoc.addPage([pageW, pageH]);
    pdfPage.drawImage(embeddedImage, {
      x: 0,
      y: 0,
      width: pageW,
      height: pageH,
    });
  }

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// ────────────────────────────────────────────────────────────────
// Merge multiple single-page PDFs into one. Used by processMultiPage
// to combine per-page Tesseract searchable PDFs into the final
// composite (e.g., DL front + back as a 2-page searchable PDF).
//
// Each input is loaded as a PDFDocument; its pages are copied into
// the destination. Page order is preserved.
// ────────────────────────────────────────────────────────────────
export async function mergePdfs(pdfs: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const pdf of pdfs) {
    const src = await PDFDocument.load(pdf);
    const indices = src.getPageIndices();
    const copied = await out.copyPages(src, indices);
    for (const page of copied) out.addPage(page);
  }
  const bytes = await out.save();
  return Buffer.from(bytes);
}

// ────────────────────────────────────────────────────────────────
// Filename resolution.
//
// The convention:   {NamePrefix}_{ProcessedAISuggestion}.pdf
//
//   NamePrefix              "Minseo_Kim" (sanitized intake.personal.fullName)
//   ProcessedAISuggestion   the classifier's suggested filename, with
//                           DL side substitution baked in:
//                           DriversLicense → DriversLicenseFront / Back
//                           when the bound slot tells us which side.
//
// Output is ALWAYS .pdf — finalize converts every input to PDF, so
// the filename matches the actual MIME on disk.
//
// Examples:
//   suggested="DriversLicense_CA_2029exp.jpg"
//   namePrefix="Minseo_Kim", dlSide="front"
//   →  Minseo_Kim_DriversLicenseFront_CA_2029exp.pdf
//
//   suggested="2024_W-2_RiversideUnified.pdf"
//   namePrefix="Minseo_Kim"
//   →  Minseo_Kim_2024_W-2_RiversideUnified.pdf
//
//   no namePrefix, no suggestion → fallback original + .pdf
// ────────────────────────────────────────────────────────────────

const FILENAME_SAFE_RE = /[^A-Za-z0-9._-]+/g;
const FILENAME_MAX_LEN = 100;

export function resolveFinalFilename(opts: {
  /** The classifier's suggested filename. */
  suggested: string;
  /**
   * Sanitized name prefix from intake (e.g., "Minseo_Kim"). When
   * present, prepended to the suggestion so each doc carries the
   * taxpayer's name. Pass undefined to skip the prefix.
   */
  namePrefix?: string;
  /**
   * For driver's-license slots: which side of the card.
   *   'front' → "DriversLicense" → "DriversLicenseFront"
   *   'back'  → "DriversLicense" → "DriversLicenseBack"
   *   'merged' → strip any existing Front/Back suffix; the filename
   *              becomes the un-sided form (used when front + back
   *              are merged into one 2-page PDF).
   */
  dlSide?: 'front' | 'back' | 'merged';
  /** Fallback if the suggestion is empty — use original filename + .pdf */
  fallback: string;
}): string {
  // ─── Stage 1: pick the suggestion source + path-traversal guard ───
  const rawCandidate = (opts.suggested?.trim() || opts.fallback).trim();
  const basename = rawCandidate.split(/[\/\\]/).pop() ?? rawCandidate;

  // ─── Stage 2: strip the existing extension off so we can rewrite it ───
  const lastDot = basename.lastIndexOf('.');
  let stem: string;
  if (lastDot > 0 && lastDot > basename.length - 6) {
    stem = basename.slice(0, lastDot);
  } else {
    stem = basename;
  }

  // ─── Stage 3: DL side substitution (BEFORE sanitization so the
  //              token boundary is preserved) ───
  if (opts.dlSide === 'front') {
    stem = stem.replace(/DriversLicense(?!Front|Back)/gi, 'DriversLicenseFront');
  } else if (opts.dlSide === 'back') {
    stem = stem.replace(/DriversLicense(?!Front|Back)/gi, 'DriversLicenseBack');
  } else if (opts.dlSide === 'merged') {
    // Strip any Front/Back qualifier — the merged 2-page PDF stands
    // for the whole DL, not a side.
    stem = stem.replace(/DriversLicense(Front|Back)/gi, 'DriversLicense');
  }

  // ─── Stage 4: sanitize the stem ───
  stem = stem.replace(FILENAME_SAFE_RE, '_').replace(/^_+|_+$/g, '');

  // ─── Stage 5: prepend the name prefix ───
  if (opts.namePrefix && opts.namePrefix.trim()) {
    const cleanPrefix = opts.namePrefix
      .replace(FILENAME_SAFE_RE, '_')
      .replace(/^_+|_+$/g, '');
    if (cleanPrefix && stem) {
      stem = `${cleanPrefix}_${stem}`;
    } else if (cleanPrefix) {
      stem = cleanPrefix;
    }
  }

  // ─── Stage 6: length clamp + cleanup ───
  if (stem.length > FILENAME_MAX_LEN) {
    stem = stem.slice(0, FILENAME_MAX_LEN);
  }
  stem = stem.replace(/_+$/, '');
  if (!stem) return 'Document.pdf';

  return stem + '.pdf';
}
