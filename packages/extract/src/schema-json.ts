import { zodToJsonSchema } from 'zod-to-json-schema';
import type { z } from 'zod';
import { Form106, Money, PersonalInfoReport, Payslip } from '@payslip-insight/schema';

/**
 * JSON Schema הנגזר מ-Zod עבור חוזה החילוץ (SPEC.md §5.2), ממוזכר לכל סוג
 * מסמך בנפרד.
 *
 * מוטמע כטקסט בפרומפט (ראה extract.ts) ולא נשלח כ-`output_config.format`
 * ל-Anthropic API: סכימות מקוננות עשירות (Provenance בכל שדה, unions/
 * nullable מקוננים, enum גדול בתוך מערך פתוח) גרמו ל-API להחזיר
 * "The compiled grammar is too large" בפענוח מוגבל-דקדוק. הפתרון: הטמעה
 * כטקסט (בלי מגבלת compile) + ולידציה מלאה מול Zod אחרי הפענוח — עדיין
 * השער האמיתי לאיכות (כלל ברזל #2).
 */
function memoizedJsonSchema(schema: z.ZodTypeAny, name: string): () => Record<string, unknown> {
  let cache: Record<string, unknown> | null = null;
  return () => {
    if (!cache) {
      cache = zodToJsonSchema(schema, { name, target: 'jsonSchema7', definitions: { Money } }) as Record<string, unknown>;
    }
    return cache;
  };
}

export const payslipJsonSchema = memoizedJsonSchema(Payslip, 'Payslip');
export const form106JsonSchema = memoizedJsonSchema(Form106, 'Form106');
export const personalInfoReportJsonSchema = memoizedJsonSchema(PersonalInfoReport, 'PersonalInfoReport');
