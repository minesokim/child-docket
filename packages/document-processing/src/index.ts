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
import { PDFDocument, PageSizes } from 'pdf-lib';

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
 *   - Image (any kind, including IDs) → grayscale + normalize + Otsu
 *     binarize → 1-bit PDF.
 */
export async function processDocument(opts: ProcessOptions): Promise<ProcessResult> {
  // PDF input — pass through. The user uploaded a clean PDF (downloaded
  // their official W-2 from ADP, etc.). Don't binarize a multi-page PDF
  // with embedded vector text — we'd lose searchability and quality.
  if (opts.inputMimeType === 'application/pdf') {
    return {
      pdf: opts.input,
      sizeBytes: opts.input.length,
      binarized: false,
    };
  }

  // All image inputs (W-2s, 1099s, IDs, statements, receipts) →
  // grayscale + normalize + Otsu binarize. Single-page PDF.
  const binarizedPng = await binarize(opts.input);
  const pdfBytes = await wrapImageInPdf(binarizedPng, 'image/png', true);
  return {
    pdf: pdfBytes,
    sizeBytes: pdfBytes.length,
    binarized: true,
  };
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
  // Binarize each page independently — phone shots vary in lighting
  // page-to-page, so a single Otsu threshold across all pages would
  // wash out one or the other.
  const binarizedPages: Buffer[] = [];
  for (const page of opts.pages) {
    if (page.inputMimeType === 'application/pdf') {
      throw new Error('processMultiPage does not accept PDF inputs');
    }
    binarizedPages.push(await binarize(page.input));
  }
  const pdfBytes = await wrapImagesInPdf(
    binarizedPages.map((bytes) => ({ bytes, mimeType: 'image/png' })),
  );
  return {
    pdf: pdfBytes,
    sizeBytes: pdfBytes.length,
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
  // We need the raw pixel buffer for this — sharp gives us a histogram
  // via .stats() but doesn't expose Otsu directly. So:
  //   - clone the pipeline
  //   - get the raw pixel buffer
  //   - compute Otsu manually
  //   - apply threshold
  const { data: rawPixels, info } = await stage1
    .clone()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const otsuValue = computeOtsuThreshold(rawPixels, info.width, info.height);

  // Stage 2: apply the threshold + output as 1-bit PNG.
  // sharp's .threshold(N) outputs 8-bit black-or-white but PNG encoder
  // will use bit-depth 1 with .png({ palette: true }) when only 2
  // colors exist. Keeps file size minimal.
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
    .png({ compressionLevel: 9, palette: true })
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
// pdf-lib embeds the raster as the page contents at full page size,
// preserving aspect ratio. Output is a minimal PDF — no metadata,
// no fonts, no frills. ~1KB overhead over the raw image bytes.
// ────────────────────────────────────────────────────────────────
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

  // Letter size by default (8.5x11). Image gets scaled to fit the page
  // while preserving aspect ratio. Looks like a real document scan.
  const [pageW, pageH] = PageSizes.Letter;
  const page = pdfDoc.addPage([pageW, pageH]);

  const imgDims = embeddedImage.scaleToFit(pageW - 36, pageH - 36); // 0.5" margin
  page.drawImage(embeddedImage, {
    x: (pageW - imgDims.width) / 2,
    y: (pageH - imgDims.height) / 2,
    width: imgDims.width,
    height: imgDims.height,
  });

  const bytes = await pdfDoc.save();
  return Buffer.from(bytes);
}

// ────────────────────────────────────────────────────────────────
// Multi-page wrap. Each entry becomes one PDF page, scaled to fit
// 8.5x11 letter with a 0.5" margin. Same per-page math as the
// single-page version (wrapImageInPdf), just iterated.
// ────────────────────────────────────────────────────────────────
export async function wrapImagesInPdf(
  pages: Array<{ bytes: Buffer; mimeType: string }>,
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.create();
  const [pageW, pageH] = PageSizes.Letter;

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

    const pdfPage = pdfDoc.addPage([pageW, pageH]);
    const imgDims = embeddedImage.scaleToFit(pageW - 36, pageH - 36);
    pdfPage.drawImage(embeddedImage, {
      x: (pageW - imgDims.width) / 2,
      y: (pageH - imgDims.height) / 2,
      width: imgDims.width,
      height: imgDims.height,
    });
  }

  const bytes = await pdfDoc.save();
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
