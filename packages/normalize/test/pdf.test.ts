import { describe, expect, it } from 'vitest';
import { PasswordResponses } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { classifyPdfLoadError } from '../src/pdf.js';
import { IngestError } from '../src/types.js';

/**
 * בודק את מיפוי שגיאות הסיסמה בלי לטעון PDF מוצפן אמיתי — מדמה את
 * ה-PasswordException שpdf.js זורק. ראה תוכנית M1: qpdf לא מותקן בסביבה,
 * ולכן אין לנו fixture מוצפן אמיתי בשלב הזה.
 */
describe('classifyPdfLoadError', () => {
  it('maps NEED_PASSWORD to PASSWORD_REQUIRED', () => {
    const err = { name: 'PasswordException', code: PasswordResponses.NEED_PASSWORD };
    const mapped = classifyPdfLoadError(err);
    expect(mapped).toBeInstanceOf(IngestError);
    expect(mapped?.code).toBe('PASSWORD_REQUIRED');
  });

  it('maps INCORRECT_PASSWORD to WRONG_PASSWORD', () => {
    const err = { name: 'PasswordException', code: PasswordResponses.INCORRECT_PASSWORD };
    const mapped = classifyPdfLoadError(err);
    expect(mapped).toBeInstanceOf(IngestError);
    expect(mapped?.code).toBe('WRONG_PASSWORD');
  });

  it('returns null for a non-password error', () => {
    expect(classifyPdfLoadError(new Error('some other failure'))).toBeNull();
  });
});
