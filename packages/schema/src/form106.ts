import { z } from 'zod';
import { EmployerIdentity, Extracted, Money, PersonIdentity, Provenance } from './common.js';

/**
 * שורת עמוד 2 של טופס 106 — שדה/תיאור/סכום שטוח. fieldCode הוא הקוד
 * הרשמי הרגולטורי (למשל "245/244") כשהוא מופיע; null אם השורה ללא קוד גלוי.
 */
export const Form106LineItem = z.object({
  fieldCode: z.string().nullable(),
  /** התיאור המדויק כפי שמופיע בטופס, בלי תרגום/נרמול. */
  description: z.string(),
  amount: Money,
  prov: Provenance.nullable(),
});
export type Form106LineItem = z.infer<typeof Form106LineItem>;

/**
 * שורת "נתוני עזר" — טבלת הפרשות לקופות (עמוד 1). מקבילה מבנית לטבלת
 * הפרשות המעסיק בתלוש, אבל כאן זו סכימה שנתית עם עמודת "משכורת להפקדות".
 */
export const Form106FundContribution = z.object({
  fundNumber: z.string().nullable(),
  fundName: z.string(),
  fundType: z.enum(['pension', 'severance', 'study_fund', 'disability_insurance', 'other']),
  /** "משכורת להפקדות" — הבסיס השנתי שממנו חושבו ההפקדות. */
  depositBase: Money.nullable(),
  /**
   * null, לא 0: בקרנות מסוימות (למשל פיצויים) אין מבנית "חלק עובד" בכלל
   * — זה לא ערך חסר, זה מושג שלא רלוונטי לקרן הזו. 0 נשמר לערך אמיתי
   * שהוא אפס. אין לנחש (כלל ברזל #3).
   */
  employee: Money.nullable(),
  employer: Money.nullable(),
  prov: Provenance.nullable(),
});
export type Form106FundContribution = z.infer<typeof Form106FundContribution>;

export const Form106 = z.object({
  schemaVersion: z.literal('1.0'),

  meta: z.object({
    docType: z.literal('form_106'),
    taxYear: z.number().int(),
  }),

  employee: PersonIdentity.extend({
    employeeNumber: z.string().nullable(),
    birthDate: z.string().nullable(), // ISO
    gender: z.enum(['male', 'female']).nullable(),
    maritalStatus: z.string().nullable(),
  }),

  employer: EmployerIdentity,

  taxProfile: z.object({
    /** סה"כ נקודות זיכוי שנתיות. */
    creditPoints: Extracted(z.number()).nullable(),
  }),

  /**
   * שדות מצטברים רשמיים ומזוהים בבירור בטופס — אותו עיקרון כמו
   * Payslip.totals: שדות ייעודיים לוולידציה/דשבורד, לא חיפוש טקסט חופשי
   * בתוך lineItems (שברירי). כל שדה null אם לא חולץ בוודאות (כלל ברזל #3).
   */
  totals: z.object({
    taxableWages: Extracted(Money).nullable(), // "משכורת חייבת במס"
    incomeTaxWithheld: Extracted(Money).nullable(), // "מס הכנסה שנוכה במקור"
    totalEmployerPensionContribution: Extracted(Money).nullable(), // "סך הפרשות מעסיק לקצבה"
    nationalInsuranceInsuredIncome: Extracted(Money).nullable(), // "הכנסת עבודה מבוטחת"
  }),

  fundContributions: z.array(Form106FundContribution),

  /** כל שורות עמוד 2, בסדר הופעתן בטופס. אף שורה לא מושמטת (כלל ברזל). */
  lineItems: z.array(Form106LineItem),

  extraction: z.object({
    engine: z.enum(['template', 'llm', 'template+llm']),
    modelId: z.string().nullable(),
    attempts: z.number().int(),
    overallConfidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
  }),
});
export type Form106 = z.infer<typeof Form106>;
