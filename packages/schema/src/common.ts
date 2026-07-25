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
