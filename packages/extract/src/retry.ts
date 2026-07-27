import {
  hasBlockingFailure,
  validateForm106,
  validatePayslip,
  validatePersonalInfoReport,
  type ValidationResult,
} from '@payslip-insight/core';
import type { NormalizedDoc } from '@payslip-insight/normalize';
import type { Form106, PersonalInfoReport, Payslip } from '@payslip-insight/schema';
import { extractForm106, extractPayslip, extractPersonalInfoReport } from './extract.js';

export type ExtractWithRetryResult = {
  payslip: Payslip;
  validation: ValidationResult[];
  attempts: number;
};

export type ExtractForm106WithRetryResult = {
  form106: Form106;
  validation: ValidationResult[];
  attempts: number;
};

export type ExtractPersonalInfoReportWithRetryResult = {
  report: PersonalInfoReport;
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

/**
 * מקביל ל-extractWithRetry עבור טופס 106: רק טריגר ולידציה חוסמת —
 * לטופס 106 אין (עדיין) את הבעיה הספציפית של "טבלה שלפעמים חסרה"
 * שהוגדרה עבור תלוש (V1_pension_employer_sum הוא warning, לא blocking).
 */
export async function extractForm106WithRetry(
  doc: NormalizedDoc,
  opts: ExtractWithRetryOptions = {},
): Promise<ExtractForm106WithRetryResult> {
  let form106 = await extractForm106(doc, { onLabel: opts.onLabel });
  let validation = validateForm106(form106);
  let attempts = 1;

  if (hasBlockingFailure(validation) && attempts < MAX_ATTEMPTS) {
    const errorSummary = validation
      .filter((r) => r.severity === 'blocking' && !r.passed)
      .map((r) => `- ${r.rule}: ${r.message} (צפוי ${r.expected}, התקבל ${r.actual})`)
      .join('\n');

    form106 = await extractForm106(doc, {
      extraInstructions: `בניסיון הקודם הולידציה האריתמטית נכשלה בחוקים הבאים. בדוק שוב את המספרים הרלוונטיים בתמונה ותקן:\n${errorSummary}`,
      onLabel: opts.onLabel,
    });
    validation = validateForm106(form106);
    attempts = 2;
  }

  const finalForm106: Form106 = { ...form106, extraction: { ...form106.extraction, attempts } };
  return { form106: finalForm106, validation, attempts };
}

/**
 * מקביל ל-extractWithRetry עבור דוח מידע אישי: רק טריגר ולידציה חוסמת.
 * הערה: כל חוקי validatePersonalInfoReport היום הם 'warning', אז זה
 * בפועל לא יופעל עדיין — נשמר לעקביות המבנה ולעתיד, כמו ב-Form106.
 */
export async function extractPersonalInfoReportWithRetry(
  doc: NormalizedDoc,
  opts: ExtractWithRetryOptions = {},
): Promise<ExtractPersonalInfoReportWithRetryResult> {
  let report = await extractPersonalInfoReport(doc, { onLabel: opts.onLabel });
  let validation = validatePersonalInfoReport(report);
  let attempts = 1;

  if (hasBlockingFailure(validation) && attempts < MAX_ATTEMPTS) {
    const errorSummary = validation
      .filter((r) => r.severity === 'blocking' && !r.passed)
      .map((r) => `- ${r.rule}: ${r.message} (צפוי ${r.expected}, התקבל ${r.actual})`)
      .join('\n');

    report = await extractPersonalInfoReport(doc, {
      extraInstructions: `בניסיון הקודם הולידציה האריתמטית נכשלה בחוקים הבאים. בדוק שוב את המספרים הרלוונטיים בתמונה ותקן:\n${errorSummary}`,
      onLabel: opts.onLabel,
    });
    validation = validatePersonalInfoReport(report);
    attempts = 2;
  }

  const finalReport: PersonalInfoReport = { ...report, extraction: { ...report.extraction, attempts } };
  return { report: finalReport, validation, attempts };
}
