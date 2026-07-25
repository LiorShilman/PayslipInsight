import { z } from 'zod';
import { Extracted, Money, Provenance } from './common.js';

export const LineItemCategory = z.enum([
  // תשלומים
  'base_salary', // שכר יסוד
  'overtime', // שעות נוספות (125/150/175/200)
  'global_overtime', // ש"נ גלובליות
  'bonus', // בונוס / מענק
  'commission', // עמלות
  'travel_allowance', // נסיעות
  'recuperation_pay', // דמי הבראה
  'clothing_allowance', // ביגוד
  'sick_pay', // דמי מחלה
  'vacation_pay', // פדיון/דמי חופשה
  'holiday_gift', // שי לחג
  'seniority_increment', // תוספת ותק
  'shift_differential', // תוספת משמרות
  'standby_pay', // כוננות
  'meal_allowance', // ארוחות
  'retro_adjustment', // רטרו
  'expense_reimbursement', // החזר הוצאות (לא חייב מס)
  'benefit_in_kind', // שווי (רכב/טלפון/ארוחות) — זקיפה
  'other_payment',

  // ניכויי חובה
  'income_tax', // מס הכנסה
  'national_insurance', // ביטוח לאומי — חלק עובד
  'health_tax', // מס בריאות
  'tax_credit_refund', // החזר מס (ערך שלילי בניכויים)

  // ניכויי רשות
  'pension_employee', // תגמולי עובד לפנסיה
  'study_fund_employee', // קרן השתלמות — עובד
  'manager_insurance_employee',
  'disability_insurance', // אובדן כושר עבודה
  'union_dues', // ועד עובדים / דמי חבר
  'loan_repayment', // החזר הלוואה
  'garnishment', // עיקול
  'charity', // תרומות (סעיף 46)
  'other_deduction',

  // הפרשות מעסיק
  'pension_employer', // תגמולי מעסיק
  'severance_employer', // פיצויים
  'study_fund_employer', // קה"ל מעסיק
  'national_insurance_employer',
  'manager_insurance_employer',
  'other_employer_contribution',
]);
export type LineItemCategory = z.infer<typeof LineItemCategory>;

export const LineItemSection = z.enum([
  'payment',
  'mandatory_deduction',
  'voluntary_deduction',
  'employer_contribution',
]);
export type LineItemSection = z.infer<typeof LineItemSection>;

export const LineItem = z.object({
  /** התווית המדויקת כפי שהופיעה בתלוש. לעולם לא מתורגמת. */
  label: z.string(),
  /** קוד הרכיב אם הופיע בתלוש (עמודת "קוד"). */
  code: z.string().nullable(),
  category: LineItemCategory,
  section: LineItemSection,
  /** כמות — שעות, ימים, יחידות. null אם לא רלוונטי. */
  quantity: z.number().nullable(),
  quantityUnit: z.enum(['hours', 'days', 'units', 'percent']).nullable(),
  rate: Money.nullable(), // תעריף ליחידה
  amount: Money, // הסכום לחודש הנוכחי
  yearToDate: Money.nullable(), // מצטבר מתחילת שנה
  /** האם הרכיב חייב במס הכנסה, ב"ל, ופנסיה — כפי שמסומן בתלוש אם מסומן. */
  taxable: z.boolean().nullable(),
  prov: Provenance.nullable(),
});
export type LineItem = z.infer<typeof LineItem>;

export const Payslip = z.object({
  schemaVersion: z.literal('1.0'),

  meta: z.object({
    docType: z.literal('payslip'),
    payrollProvider: z.string(),
    period: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }),
    payDate: z.string().nullable(), // ISO date
    currency: z.literal('ILS'),
  }),

  employee: z.object({
    fullName: Extracted(z.string()).nullable(),
    /** מאוחסן תמיד מוסתר: 4 ספרות אחרונות בלבד. ראה §12. */
    nationalIdLast4: z.string().length(4).nullable(),
    employeeNumber: z.string().nullable(),
    department: z.string().nullable(),
    jobTitle: z.string().nullable(),
    startDate: z.string().nullable(), // ISO
    seniorityMonths: z.number().int().nullable(),
    employmentScope: z.number().nullable(), // אחוז משרה 0-100
    /** דירוג/דרגה אם קיים */
    grade: z.string().nullable(),
  }),

  employer: z.object({
    name: z.string().nullable(),
    companyId: z.string().nullable(), // ח.פ.
    deductionsFileId: z.string().nullable(), // מספר תיק ניכויים
  }),

  taxProfile: z.object({
    creditPoints: z.number().nullable(), // נקודות זיכוי
    maritalStatus: z.string().nullable(),
    taxCoordination: z.boolean().nullable(), // תיאום מס
    additionalIncome: z.boolean().nullable(), // הכנסה נוספת
    residentOfDevelopmentArea: z.boolean().nullable(), // יישוב מוטב
  }),

  /** כל השורות. סדר = סדר ההופעה בתלוש. */
  lineItems: z.array(LineItem),

  totals: z.object({
    grossPay: Extracted(Money), // ברוטו
    taxableIncome: Extracted(Money).nullable(), // ברוטו למס
    niBase: Extracted(Money).nullable(), // ברוטו לביטוח לאומי
    pensionBase: Extracted(Money).nullable(), // ברוטו לפנסיה
    totalMandatoryDeductions: Extracted(Money),
    totalVoluntaryDeductions: Extracted(Money),
    totalDeductions: Extracted(Money),
    netPay: Extracted(Money), // נטו לתשלום
    totalEmployerContributions: Extracted(Money).nullable(),
  }),

  yearToDate: z.object({
    grossPay: Money.nullable(),
    taxableIncome: Money.nullable(),
    incomeTax: Money.nullable(),
    nationalInsurance: Money.nullable(),
    healthTax: Money.nullable(),
    pensionEmployee: Money.nullable(),
    pensionEmployer: Money.nullable(),
    severance: Money.nullable(),
    studyFundEmployee: Money.nullable(),
    studyFundEmployer: Money.nullable(),
  }),

  /** צבירות: חופשה, מחלה, הבראה */
  balances: z.array(
    z.object({
      type: z.enum(['vacation', 'sick', 'recuperation']),
      openingBalance: z.number().nullable(), // יתרה קודמת (ימים)
      accrued: z.number().nullable(), // צבירה החודש
      used: z.number().nullable(), // ניצול
      closingBalance: z.number().nullable(), // יתרה לסוף חודש
      prov: Provenance.nullable(),
    }),
  ),

  attendance: z
    .object({
      workDaysInMonth: z.number().nullable(), // ימי עבודה בחודש
      actualWorkDays: z.number().nullable(),
      standardHours: z.number().nullable(), // תקן שעות
      actualHours: z.number().nullable(),
      absenceDays: z.number().nullable(),
    })
    .nullable(),

  payment: z
    .object({
      method: z.enum(['bank_transfer', 'check', 'cash', 'unknown']),
      bankName: z.string().nullable(),
      accountLast4: z.string().nullable(), // 4 ספרות בלבד
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
export type Payslip = z.infer<typeof Payslip>;
