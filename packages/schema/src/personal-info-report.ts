import { z } from 'zod';
import { EmployerIdentity, Extracted, Money, PersonIdentity, Provenance } from './common.js';

/**
 * "דוח מידע אישי" — סוג-על שמכסה פנסיה / קופת גמל להשקעה / קרן השתלמות /
 * ביטוח מנהלים: כולם מבנית "דוח יתרה אישי מגוף פיננסי" (פתיחה → הפקדות
 * → תשואה → עמלות/עלויות → סגירה). ביטוחים (כיסוי/פרמיה/מוטבים) לא
 * נכללים כאן — מבנה שונה לגמרי, יטופל כסוג מסמך נפרד בעתיד אם יידרש.
 */
export const PersonalInfoReportFundKind = z.enum([
  'pension',
  'gemel_investment',
  'study_fund',
  'manager_insurance',
  'other',
]);
export type PersonalInfoReportFundKind = z.infer<typeof PersonalInfoReportFundKind>;

/** שורת סעיף ה' — פירוט הפקדה חודשית. */
export const PersonalInfoReportDeposit = z.object({
  employerName: z.string().nullable(),
  depositDate: z.string().nullable(), // ISO
  salaryMonth: z.string().nullable(), // כפי שמופיע במקור, למשל "01/26"
  salaryAmount: Money.nullable(),
  employeeContribution: Money.nullable(),
  employerContribution: Money.nullable(),
  severanceContribution: Money.nullable(),
  total: Money.nullable(),
  prov: Provenance.nullable(),
});
export type PersonalInfoReportDeposit = z.infer<typeof PersonalInfoReportDeposit>;

export const PersonalInfoReport = z.object({
  schemaVersion: z.literal('1.0'),

  meta: z.object({
    docType: z.literal('personal_info_report'),
    fundKind: PersonalInfoReportFundKind,
    fundCompanyName: z.string().nullable(), // למשל "מנורה מבטחים"
    planName: z.string().nullable(), // למשל "קרן הפנסיה החדשה מנורה מבטחים פנסיה"
    reportPeriod: z.object({
      fromDate: z.string().nullable(), // ISO
      toDate: z.string().nullable(), // ISO
    }),
    reportSentDate: z.string().nullable(), // ISO
  }),

  participant: PersonIdentity,
  employer: EmployerIdentity,

  /**
   * סעיף א' — תחזיות תשלום עתידיות. רלוונטי רק לפנסיה (fundKind='pension');
   * לגמל-להשקעה/השתלמות זה null כאובייקט שלם, לא רק שדות פנימיים —
   * המושג עצמו לא קיים שם. תצוגה בלבד ("כפי שמוצג בדוח") — לא ייעוץ.
   */
  projectedBenefits: z
    .object({
      retirementMonthlyPension: Money.nullable(),
      widowMonthlyPension: Money.nullable(),
      orphanMonthlyPension: Money.nullable(),
      dependentParentMonthlyPension: Money.nullable(),
      disabilityMonthlyPension: Money.nullable(),
    })
    .nullable(),

  /**
   * סעיף ב' — תנועות בקרן לתקופה. עמלות/עלויות ביטוח נשמרות בסימן
   * המקורי כפי שהוצג (בדרך כלל שלילי) — אין להפוך (כלל ברזל #1).
   */
  fundMovements: z.object({
    openingBalance: Extracted(Money).nullable(),
    deposits: Extracted(Money).nullable(),
    investmentGains: Extracted(Money).nullable(),
    managementFees: Extracted(Money).nullable(),
    disabilityInsuranceCost: Extracted(Money).nullable(),
    deathInsuranceCost: Extracted(Money).nullable(),
    closingBalance: Extracted(Money).nullable(),
  }),

  /** סעיף ג' — אחוזי דמי ניהול (עשרוני, למשל 0.0186 = 1.86%). */
  managementFeeRates: z.object({
    feeFromDeposits: z.number().nullable(),
    feeFromBalance: z.number().nullable(),
  }),

  /** סעיף ד' — מסלולי השקעה ותשואות לתקופה. */
  investmentTracks: z.array(
    z.object({
      trackName: z.string(),
      returnRate: z.number().nullable(),
    }),
  ),

  /** סעיף ה' — כל שורה נשמרת, לא מושמטת (כלל ברזל). */
  deposits: z.array(PersonalInfoReportDeposit),

  /** סעיף ו'. */
  advisor: z
    .object({
      name: z.string().nullable(),
      phone: z.string().nullable(),
    })
    .nullable(),

  extraction: z.object({
    engine: z.enum(['template', 'llm', 'template+llm']),
    modelId: z.string().nullable(),
    attempts: z.number().int(),
    overallConfidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
  }),
});
export type PersonalInfoReport = z.infer<typeof PersonalInfoReport>;
