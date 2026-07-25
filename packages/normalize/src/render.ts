import { createCanvas } from '@napi-rs/canvas';
import type { PDFPageProxy } from 'pdfjs-dist';

const POINTS_PER_INCH = 72;

/** מרנדר עמוד PDF ל-PNG. ברירת המחדל 200 DPI (SPEC.md §3 שלב 2). */
export async function renderPageToPng(page: PDFPageProxy, dpi = 200): Promise<Buffer> {
  const scale = dpi / POINTS_PER_INCH;
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');

  // pdfjs-dist מצפה לטיפוס CanvasRenderingContext2D של ה-DOM; @napi-rs/canvas
  // מממש ממשק תואם-בפועל (2D canvas API) אך עם טיפוס משלו. במקום לייבא את
  // טיפוס ה-DOM (ולזהם חבילת Node טהורה בספריית lib של דפדפן), גוזרים את
  // הטיפוס הצפוי מבנית מתוך חתימת page.render עצמה.
  const renderParams = { canvasContext: context, viewport } as unknown as Parameters<PDFPageProxy['render']>[0];
  await page.render(renderParams).promise;

  return Buffer.from(canvas.toBuffer('image/png'));
}
