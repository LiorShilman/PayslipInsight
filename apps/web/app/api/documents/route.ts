import { deriveMetrics } from '@payslip-insight/core';
import { extractWithRetry } from '@payslip-insight/extract';
import { IngestError, normalizeDocument, type IngestErrorCode } from '@payslip-insight/normalize';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const ERROR_MESSAGES: Record<IngestErrorCode, { he: string; retryable: boolean }> = {
  FILE_TOO_LARGE: { he: 'הקובץ גדול מדי (מקסימום 10MB).', retryable: false },
  UNSUPPORTED_FORMAT: { he: 'סוג הקובץ אינו נתמך. יש להעלות PDF, PNG או JPG.', retryable: false },
  PASSWORD_REQUIRED: { he: 'המסמך מוגן בסיסמה. יש להזין את הסיסמה כדי להמשיך.', retryable: true },
  WRONG_PASSWORD: { he: 'הסיסמה שהוזנה שגויה.', retryable: true },
  TOO_MANY_PAGES: { he: 'למסמך יותר מדי עמודים (מקסימום 5).', retryable: false },
};

/**
 * שלב 1-6 בצינור העיבוד במחזור סינכרוני אחד (גרסת M2 מצומצמת — ראה תוכנית):
 * normalize → extract עם retry → validate → derive. שום דבר לא נשמר בצד
 * שרת; התוצאה המלאה חוזרת ללקוח, שמחזיק אותה רק ב-state (P5).
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const password = formData.get('password');

    if (!(file instanceof File)) {
      return errorResponse('UNSUPPORTED_FORMAT', 'לא נמצא קובץ בבקשה.', false, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const doc = await normalizeDocument({
      buffer,
      password: typeof password === 'string' && password.length > 0 ? password : undefined,
    });

    const { payslip, validation, attempts } = await extractWithRetry(doc);
    const derived = deriveMetrics(payslip, null);

    return NextResponse.json({
      payslip,
      derived,
      validation,
      attempts,
      pages: doc.pages.map((page) => ({
        index: page.index,
        width: page.width,
        height: page.height,
        png: page.rasterPng.toString('base64'),
      })),
    });
  } catch (err) {
    if (err instanceof IngestError) {
      const info = ERROR_MESSAGES[err.code];
      return errorResponse(err.code, info.he, info.retryable, err.code === 'PASSWORD_REQUIRED' ? 422 : 400);
    }
    console.error('extraction failed', err instanceof Error ? err.message : 'unknown error');
    return errorResponse('EXTRACTION_FAILED', 'החילוץ נכשל. ניתן לנסות שוב.', true, 500);
  }
}

function errorResponse(code: string, messageHe: string, retryable: boolean, status: number): NextResponse {
  return NextResponse.json({ error: { code, messageHe, retryable } }, { status });
}
