import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextSpan } from './types.js';

/** תת-קבוצה של pdfjs-dist TextItem — רק השדות שבהם נעשה שימוש כאן. */
type MinimalTextItem = {
  str: string;
  transform: [number, number, number, number, number, number];
  width: number;
  height: number;
};

function isTextItem(item: unknown): item is MinimalTextItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as { str?: unknown }).str === 'string' &&
    Array.isArray((item as { transform?: unknown }).transform)
  );
}

/**
 * שולף מקטעי טקסט עם קואורדינטות מנורמלות (0-1, מקור בפינה השמאלית-עליונה).
 *
 * הערה: pdf.js נותן transform במרחב PDF (מקור בפינה שמאלית-תחתונה, y עולה
 * כלפי מעלה). ה-bbox המחושב כאן הוא קירוב סביר (משתמש בגובה התו כפרוקסי
 * ל-ascent) — מספיק כ"רמז" למודל ולתצוגת provenance ראשונית; לא דיוק גופני
 * מלא. שכבת הטקסט העברית עלולה לחזור הפוכה/מפוצלת (SPEC.md §3) — לא מתקנים
 * ידנית, רק מנרמלים ל-NFC ושומרים כמו שהוא.
 */
export function extractTextSpans(page: PDFPageProxy, textContent: { items: unknown[] }): TextSpan[] {
  const viewport = page.getViewport({ scale: 1 });
  const pageWidth = viewport.width;
  const pageHeight = viewport.height;

  const spans: TextSpan[] = [];
  for (const item of textContent.items) {
    if (!isTextItem(item) || item.str.trim() === '') continue;

    const [, , , scaleY, translateX, translateY] = item.transform;
    const width = item.width;
    const height = item.height || Math.abs(scaleY);

    const x0 = translateX;
    const x1 = translateX + width;
    const topPdf = translateY + height;
    const bottomPdf = translateY;

    const bbox: [number, number, number, number] = [
      clamp01(x0 / pageWidth),
      clamp01(1 - topPdf / pageHeight),
      clamp01(x1 / pageWidth),
      clamp01(1 - bottomPdf / pageHeight),
    ];

    spans.push({ text: item.str.normalize('NFC'), bbox });
  }
  return spans;
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}
