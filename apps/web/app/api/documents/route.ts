import { derivePersonalInfoReportMetrics, deriveForm106Metrics, deriveMetrics } from '@payslip-insight/core';
import {
  classifyDocument,
  extractForm106WithRetry,
  extractPersonalInfoReportWithRetry,
  extractWithRetry,
} from '@payslip-insight/extract';
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
 * שלב 1-6 בצינור העיבוד (גרסת M2 מצומצמת — ראה תוכנית): normalize →
 * classify → extract עם retry (לפי סוג מסמך) → validate → derive. שום
 * דבר לא נשמר בצד שרת; התוצאה המלאה מגיעה ללקוח דרך אירוע SSE אחרון.
 *
 * normalize רץ *לפני* שפותחים את הסטרים כדי ששגיאות כמו PASSWORD_REQUIRED
 * יוכלו לחזור כ-JSON רגיל עם status code נכון (SSE תמיד 200). מ-classify
 * ואילך — סטרים, כי extract הוא השלב הארוך והזמן להתקדמות אמיתית.
 */
export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const file = formData.get('file');
  const password = formData.get('password');

  if (!(file instanceof File)) {
    return errorResponse('UNSUPPORTED_FORMAT', 'לא נמצא קובץ בבקשה.', false, 400);
  }

  let doc;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    doc = await normalizeDocument({
      buffer,
      password: typeof password === 'string' && password.length > 0 ? password : undefined,
    });
  } catch (err) {
    if (err instanceof IngestError) {
      const info = ERROR_MESSAGES[err.code];
      return errorResponse(err.code, info.he, info.retryable, err.code === 'PASSWORD_REQUIRED' ? 422 : 400);
    }
    console.error('normalize failed', err instanceof Error ? err.message : 'unknown error');
    return errorResponse('EXTRACTION_FAILED', 'עיבוד הקובץ נכשל. ניתן לנסות שוב.', true, 500);
  }

  const normalizedDoc = doc;
  const encoder = new TextEncoder();
  /** המשתמש יכול לסגור טאב/לנווט משם באמצע חילוץ ארוך — זה תרחיש רגיל,
   * לא שגיאה. בלי זה, ניסיון enqueue אחרי ניתוק זורק "Controller is
   * already closed" ומזהם את הלוג עם שגיאה מטעה. */
  let clientDisconnected = false;
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: string, data: unknown) {
        if (clientDisconnected) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          clientDisconnected = true;
        }
      }
      try {
        send('stage', { stage: 'classifying' });
        const classification = await classifyDocument(normalizedDoc);

        const pages = normalizedDoc.pages.map((page) => ({
          index: page.index,
          width: page.width,
          height: page.height,
          png: page.rasterPng.toString('base64'),
        }));

        if (classification.docType === 'payslip') {
          send('stage', { stage: 'extracting' });
          const { payslip, validation, attempts } = await extractWithRetry(normalizedDoc, {
            onLabel: (label) => send('progress', { label }),
          });
          send('stage', { stage: 'validating' });
          const derived = deriveMetrics(payslip, null);
          send('done', { docType: 'payslip', payslip, derived, validation, attempts, pages });
        } else if (classification.docType === 'form_106') {
          send('stage', { stage: 'extracting' });
          const { form106, validation, attempts } = await extractForm106WithRetry(normalizedDoc, {
            onLabel: (label) => send('progress', { label }),
          });
          send('stage', { stage: 'validating' });
          const derived = deriveForm106Metrics(form106);
          send('done', { docType: 'form_106', form106, derived, validation, attempts, pages });
        } else if (classification.docType === 'personal_info_report') {
          send('stage', { stage: 'extracting' });
          const { report, validation, attempts } = await extractPersonalInfoReportWithRetry(normalizedDoc, {
            onLabel: (label) => send('progress', { label }),
          });
          send('stage', { stage: 'validating' });
          const derived = derivePersonalInfoReportMetrics(report);
          send('done', { docType: 'personal_info_report', report, derived, validation, attempts, pages });
        } else {
          send('error', {
            code: 'UNSUPPORTED_DOCUMENT_TYPE',
            messageHe: 'זה סוג מסמך שהמערכת עדיין לא תומכת בו. כרגע נתמכים תלושי שכר, טופסי 106, ודוחות מידע אישי.',
            retryable: false,
          });
        }
      } catch (err) {
        console.error('extraction failed', err instanceof Error ? err.message : 'unknown error');
        send('error', { code: 'EXTRACTION_FAILED', messageHe: 'החילוץ נכשל. ניתן לנסות שוב.', retryable: true });
      } finally {
        if (!clientDisconnected) {
          try {
            controller.close();
          } catch {
            // הלקוח ניתק בדיוק בין הבדיקה לסגירה — לא שגיאה אמיתית.
          }
        }
      }
    },
    cancel() {
      clientDisconnected = true;
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
  });
}

function errorResponse(code: string, messageHe: string, retryable: boolean, status: number): NextResponse {
  return NextResponse.json({ error: { code, messageHe, retryable } }, { status });
}
