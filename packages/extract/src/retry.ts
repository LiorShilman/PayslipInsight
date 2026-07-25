import { hasBlockingFailure, validatePayslip, type ValidationResult } from '@payslip-insight/core';
import type { NormalizedDoc } from '@payslip-insight/normalize';
import type { Payslip } from '@payslip-insight/schema';
import { extractPayslip } from './extract.js';

export type ExtractWithRetryResult = {
  payslip: Payslip;
  validation: ValidationResult[];
  attempts: number;
};

/** SPEC.md §5.5, גרסה מצומצמת: ניסיון 1, ואם ולידציה חוסמת נכשלה — ניסיון 2 עם הזרקת השגיאות. */
const MAX_ATTEMPTS = 2;

export async function extractWithRetry(doc: NormalizedDoc): Promise<ExtractWithRetryResult> {
  let payslip = await extractPayslip(doc);
  let validation = validatePayslip(payslip);
  let attempts = 1;

  if (hasBlockingFailure(validation) && attempts < MAX_ATTEMPTS) {
    const errorSummary = validation
      .filter((r) => r.severity === 'blocking' && !r.passed)
      .map((r) => `- ${r.rule}: ${r.message} (צפוי ${r.expected}, התקבל ${r.actual})`)
      .join('\n');

    payslip = await extractPayslip(doc, {
      extraInstructions: `בניסיון הקודם הולידציה האריתמטית נכשלה בחוקים הבאים. בדוק שוב את המספרים הרלוונטיים בתמונה ותקן:\n${errorSummary}`,
    });
    validation = validatePayslip(payslip);
    attempts = 2;
  }

  const finalPayslip: Payslip = { ...payslip, extraction: { ...payslip.extraction, attempts } };
  return { payslip: finalPayslip, validation, attempts };
}
