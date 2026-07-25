import { zodToJsonSchema } from 'zod-to-json-schema';
import { Money, Payslip } from '@payslip-insight/schema';

let cached: Record<string, unknown> | null = null;

/**
 * JSON Schema הנגזר מ-Zod עבור חוזה החילוץ (SPEC.md §5.2). ממוזכר.
 *
 * מוטמע כטקסט בפרומפט (§`extract.ts`) ולא נשלח כ-`output_config.format`
 * ל-Anthropic API: הסכימה המלאה (Provenance מקונן בכל שדה — טוטלים, כל
 * שורת lineItem, כל צבירה) גרמה ל-API להחזיר
 * `"The compiled grammar is too large"` בפענוח מוגבל-דקדוק (constrained
 * decoding). לא בעיית גודל טקסט (הסכימה כ-9.6KB) — מורכבות ה-grammar
 * המהודר: הרבה unions/nullable מקוננים כפול enum גדול (36 ערכי
 * LineItemCategory) בתוך מערך פתוח. הפתרון: הטמעת הסכימה כטקסט בפרומפט
 * (בלי מגבלת compile) + ולידציה מלאה מול Zod אחרי הפענוח — עדיין השער
 * האמיתי לאיכות (כלל ברזל #2), כמו שהיה מתוכנן ממילא.
 */
export function payslipJsonSchema(): Record<string, unknown> {
  if (!cached) {
    cached = zodToJsonSchema(Payslip, {
      name: 'Payslip',
      target: 'jsonSchema7',
      definitions: { Money },
    }) as Record<string, unknown>;
  }
  return cached;
}
