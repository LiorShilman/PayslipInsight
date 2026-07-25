import { TaxParams as TaxParamsSchema, type TaxParams } from '@payslip-insight/schema';
import taxParams2026 from '../tax-params/2026.json' with { type: 'json' };

const RAW_TAX_PARAMS_BY_YEAR: Record<number, unknown> = {
  2026: taxParams2026,
};

/**
 * טוען את פרמטרי שנת המס לשנה נתונה.
 *
 * מחזיר `null` אם השנה לא קיימת, או אם `lastVerified === "TODO"` —
 * כלל ברזל #8: אף ערך רגולטורי לא מאומת לא נכנס לפרודקשן. כשמוחזר `null`,
 * כל התובנות שתלויות בפרמטרים (deriveMetrics, findings) מושבתות אוטומטית
 * ולא מנחשות ערך.
 */
export function loadTaxParams(year: number): TaxParams | null {
  const raw = RAW_TAX_PARAMS_BY_YEAR[year];
  if (raw === undefined) return null;

  const parsed = TaxParamsSchema.parse(raw);
  if (parsed.lastVerified === 'TODO') return null;

  return parsed;
}
