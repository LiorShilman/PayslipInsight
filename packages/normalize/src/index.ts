import sharp from 'sharp';
import { validateFileBuffer, assertPageCountWithinLimit } from './ingest.js';
import { loadPdfDocument } from './pdf.js';
import { renderPageToPng } from './render.js';
import { extractTextSpans } from './text.js';
import type { NormalizedDoc, NormalizedPage } from './types.js';

export * from './types.js';
export { validateFileBuffer, assertPageCountWithinLimit } from './ingest.js';
export { classifyPdfLoadError, loadPdfDocument } from './pdf.js';
export { renderPageToPng } from './render.js';
export { extractTextSpans } from './text.js';

async function normalizePdf(buffer: Buffer, password?: string): Promise<NormalizedDoc> {
  const doc = await loadPdfDocument(buffer, password);
  assertPageCountWithinLimit(doc.numPages);

  const pages: NormalizedPage[] = [];
  let hasTextLayer = false;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const spans = extractTextSpans(page, textContent);
    const rasterPng = await renderPageToPng(page, 200);

    if (spans.length > 0) hasTextLayer = true;

    pages.push({
      index: i - 1,
      width: viewport.width,
      height: viewport.height,
      textLayer: spans.length > 0 ? spans : null,
      rasterPng,
    });
  }

  return { pageCount: doc.numPages, pages, hasTextLayer };
}

async function normalizeImage(buffer: Buffer): Promise<NormalizedDoc> {
  const image = sharp(buffer);
  const metadata = await image.metadata();
  const png = await image.png().toBuffer();

  return {
    pageCount: 1,
    hasTextLayer: false,
    pages: [
      {
        index: 0,
        width: metadata.width ?? 0,
        height: metadata.height ?? 0,
        textLayer: null,
        rasterPng: png,
      },
    ],
  };
}

/**
 * PDF/PNG/JPEG → NormalizedDoc. שלב 2 בצינור העיבוד (SPEC.md §3).
 */
export async function normalizeDocument(input: { buffer: Buffer; password?: string }): Promise<NormalizedDoc> {
  const format = validateFileBuffer(input.buffer);
  if (format === 'pdf') return normalizePdf(input.buffer, input.password);
  return normalizeImage(input.buffer);
}
