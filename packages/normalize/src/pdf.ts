// triple-slash reference (לא import): pdfjs-worker.d.ts מכיל אך ורק
// `declare module 'חבילה-חיצונית'` — ברגע שהקובץ עצמו הופך למודול (יש לו
// import/export), TypeScript מפרש את ה-declare כ"הרחבה" של מודול קיים
// ונכשל, כי החבילה המקורית לא טיפוסה כלל. חייב להישאר global script,
// שלא ניתן לייבוא — triple-slash הוא המנגנון התקני של TS בדיוק לזה.
// נחוץ כי חבילות אחרות במונו-רפו מייבאות את pdf.ts דרך המקור הגולמי שלהן
// (אין project references/composite build), וה-"include" שלהן לא מכיל
// את pdfjs-worker.d.ts.
// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference path="./pdfjs-worker.d.ts" />

import { getDocument, PasswordResponses } from 'pdfjs-dist/legacy/build/pdf.mjs';

// ייבוא סטטי של מודול ה-worker עצמו: תחת bundler (Next.js/webpack) pdfjs-dist
// לא מצליח לאתר את pdf.worker.mjs דינמית בזמן ריצה (הנתיב היחסי הפנימי שלו
// נשבר ע"י מבנה ה-vendor-chunks). זהו התבנית המתועדת של pdfjs-dist עצמו
// ל-Node.js (ראה PDFWorker#mainThreadWorkerMessageHandler ב-pdf.mjs): קודם
// בודק globalThis.pdfjsWorker, ורק אם זה חסר מנסה import דינמי לפי workerSrc.
import * as pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { IngestError } from './types.js';

declare global {
  var pdfjsWorker: unknown;
}
globalThis.pdfjsWorker ??= pdfjsWorker;

type PasswordExceptionLike = { name: 'PasswordException'; code: number };

function isPasswordException(err: unknown): err is PasswordExceptionLike {
  return typeof err === 'object' && err !== null && (err as { name?: unknown }).name === 'PasswordException';
}

/**
 * ממפה שגיאת טעינת PDF לכדי IngestError כשמדובר בסיסמה. מופרד מ-loadPdfDocument
 * כדי שאפשר יהיה לבדוק את מיפוי הקודים ביוניט טסט בלי לטעון PDF מוצפן אמיתי.
 */
export function classifyPdfLoadError(err: unknown): IngestError | null {
  if (!isPasswordException(err)) return null;
  if (err.code === PasswordResponses.NEED_PASSWORD) {
    return new IngestError('PASSWORD_REQUIRED', 'המסמך מוגן בסיסמה. יש להזין סיסמה כדי להמשיך.');
  }
  return new IngestError('WRONG_PASSWORD', 'הסיסמה שהוזנה שגויה.');
}

export async function loadPdfDocument(data: Buffer, password?: string): Promise<PDFDocumentProxy> {
  const loadingTask = getDocument({ data: new Uint8Array(data), password });
  try {
    return await loadingTask.promise;
  } catch (err) {
    const mapped = classifyPdfLoadError(err);
    if (mapped) throw mapped;
    throw err;
  }
}
