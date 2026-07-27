import { z } from 'zod';

/** ערך כספי. תמיד באגורות (integer) כדי למנוע שגיאות float. */
export const Money = z.number().int().describe('amount in agorot (1/100 ILS)');
export type Money = z.infer<typeof Money>;

/** מקור הערך במסמך — חובה לכל שדה מחולץ. */
export const Provenance = z.object({
  page: z.number().int().min(0),
  /** x0,y0,x1,y1 מנורמל 0-1 */
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  /** הטקסט כפי שהופיע במקור, ללא עיבוד */
  rawText: z.string(),
  confidence: z.number().min(0).max(1),
});
export type Provenance = z.infer<typeof Provenance>;

/** עוטף כל ערך מחולץ. */
export const Extracted = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({ value: inner, prov: Provenance.nullable() });

export type ExtractedValue<T> = { value: T; prov: Provenance | null };

/** סוגי מסמכים נתמכים ע"י שלב ה-Classify. ראה SPEC.md §5.3 ל-enum המלא (העתידי). */
export const DocumentType = z.enum(['payslip', 'form_106', 'personal_info_report', 'unknown']);
export type DocumentType = z.infer<typeof DocumentType>;

/**
 * זהות אדם — הבסיס המשותף לכל סוגי המסמכים. סכימות ספציפיות (Payslip,
 * Form106) מרחיבות עם `.extend()` לפי מה שרלוונטי להן (למשל Payslip
 * מוסיף jobTitle/department; Form106 מוסיף birthDate/gender).
 * nationalIdLast4 נשמר תמיד מוסתר: 4 ספרות אחרונות בלבד (§12).
 */
export const PersonIdentity = z.object({
  fullName: Extracted(z.string()).nullable(),
  nationalIdLast4: z.string().length(4).nullable(),
});
export type PersonIdentity = z.infer<typeof PersonIdentity>;

/** זהות מעסיק — משותפת בין סוגי מסמכים ללא הרחבה נוספת עד כה. */
export const EmployerIdentity = z.object({
  name: z.string().nullable(),
  companyId: z.string().nullable(), // ח.פ.
  deductionsFileId: z.string().nullable(), // מספר תיק ניכויים
});
export type EmployerIdentity = z.infer<typeof EmployerIdentity>;
