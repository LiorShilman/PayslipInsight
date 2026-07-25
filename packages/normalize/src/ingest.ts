import { IngestError } from './types.js';

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB, SPEC.md §3 שלב 1
const MAX_PAGES = 5;

const PDF_MAGIC = Buffer.from('%PDF');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);

export type InputFormat = 'pdf' | 'png' | 'jpeg';

function detectFormat(buffer: Buffer): InputFormat | null {
  if (buffer.subarray(0, 4).equals(PDF_MAGIC)) return 'pdf';
  if (buffer.subarray(0, 4).equals(PNG_MAGIC)) return 'png';
  if (buffer.subarray(0, 3).equals(JPEG_MAGIC)) return 'jpeg';
  return null;
}

/**
 * ולידציית קלט בסיסית לפי magic bytes (לא סומכים על סיומת הקובץ).
 * זורק IngestError עם קוד תואם ל-SPEC.md §9 אם הקובץ לא תקין.
 */
export function validateFileBuffer(buffer: Buffer): InputFormat {
  if (buffer.byteLength > MAX_FILE_BYTES) {
    throw new IngestError('FILE_TOO_LARGE', `הקובץ גדול מ-${MAX_FILE_BYTES} בייטים.`);
  }
  const format = detectFormat(buffer);
  if (!format) {
    throw new IngestError('UNSUPPORTED_FORMAT', 'הקובץ אינו PDF, PNG או JPEG (magic bytes לא תואמים).');
  }
  return format;
}

export function assertPageCountWithinLimit(pageCount: number): void {
  if (pageCount > MAX_PAGES) {
    throw new IngestError('TOO_MANY_PAGES', `מספר העמודים (${pageCount}) חורג מהמותר (${MAX_PAGES}).`);
  }
}
