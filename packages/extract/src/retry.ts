import { hasBlockingFailure, validatePayslip, type ValidationResult } from '@payslip-insight/core';
import type { NormalizedDoc } from '@payslip-insight/normalize';
import type { Payslip } from '@payslip-insight/schema';
import { extractPayslip } from './extract.js';

export type ExtractWithRetryResult = {
  payslip: Payslip;
  validation: ValidationResult[];
  attempts: number;
};

export type ExtractWithRetryOptions = {
  /** נקרא עם התווית של כל שורה ברגע שהיא הושלמה בסטרים, בכל ניסיון. */
  onLabel?: (label: string) => void;
};

/**
 * SPEC.md §5.5, גרסה מצומצמת: ניסיון 1, וניסיון 2 (עם הזרקת הנחיה ממוקדת)
 * אם ולידציה חוסמת נכשלה *או* אם טבלת הפרשות המעסיק חסרה. הטבלה הזו
 * (עמוד שני, תחת כותרת גנרית כמו "נתוני עזר") נדגמת בפחות עקביות ע"י
 * המודל מאשר הטבלה הראשית — null אמיתי לעומת "לא אותרה" לא ניתן להבחין
 * מראש, אז ניסיון שני עצמאי (לא תיקון של אותה תשובה) הוא הדרך הסבירה
 * להעלות את שיעור ההצלחה בלי לנחש ערך.
 */
const MAX_ATTEMPTS = 2;

export async function extractWithRetry(
  doc: NormalizedDoc,
  opts: ExtractWithRetryOptions = {},
): Promise<ExtractWithRetryResult> {
  let payslip = await extractPayslip(doc, { onLabel: opts.onLabel });
  let validation = validatePayslip(payslip);
  let attempts = 1;

  const validationFailed = hasBlockingFailure(validation);
  const missingEmployerContrib = payslip.totals.totalEmployerContributions === null;

  if ((validationFailed || missingEmployerContrib) && attempts < MAX_ATTEMPTS) {
    const instructions: string[] = [];
    if (validationFailed) {
      const errorSummary = validation
        .filter((r) => r.severity === 'blocking' && !r.passed)
        .map((r) => `- ${r.rule}: ${r.message} (צפוי ${r.expected}, התקבל ${r.actual})`)
        .join('\n');
      instructions.push(
        `בניסיון הקודם הולידציה האריתמטית נכשלה בחוקים הבאים. בדוק שוב את המספרים הרלוונטיים בתמונה ותקן:\n${errorSummary}`,
      );
    }
    if (missingEmployerContrib) {
      instructions.push(
        'בניסיון הקודם לא נמצאה טבלת הפרשות מעסיק לקופות (תגמולי מעסיק/פיצויים/קה"ל). בדוק שוב במיוחד ' +
          'עמודים נוספים ואזורים תחת כותרות כמו "נתוני עזר" — ייתכן שהיא שם ופשוט לא אותרה. אם היא באמת ' +
          'לא קיימת במסמך, זה בסדר — אל תנחש.',
      );
    }

    payslip = await extractPayslip(doc, {
      extraInstructions: instructions.join('\n\n'),
      onLabel: opts.onLabel,
    });
    validation = validatePayslip(payslip);
    attempts = 2;
  }

  const finalPayslip: Payslip = { ...payslip, extraction: { ...payslip.extraction, attempts } };
  return { payslip: finalPayslip, validation, attempts };
}
