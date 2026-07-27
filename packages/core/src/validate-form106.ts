import type { Form106, Form106FundContribution } from '@payslip-insight/schema';
import { sum } from './money.js';
import { CUMULATIVE_TOLERANCE_AGOROT, moneyResult, type ValidationResult } from './validate.js';

export type ValidateForm106Context = {
  /** "עכשיו" מוזרק ע"י הקורא — core לעולם לא קורא Date.now() בעצמו (כלל ברזל #4). */
  now?: Date;
};

const PENSION_EMPLOYER_FUND_TYPES: ReadonlySet<Form106FundContribution['fundType']> = new Set([
  'pension',
  'severance',
]);

/**
 * "סך הפרשות מעסיק לקצבה" (שדה מוצהר, totals.totalEmployerPensionContribution)
 * אמור להיות שווה לסכום הפקדות המעסיק לפנסיה+פיצויים בטבלת "נתוני עזר"
 * (fundContributions) — זהות שאומתה ידנית מול דוגמת טופס 106 אמיתית.
 */
function v1PensionEmployerSum(f: Form106): ValidationResult | null {
  const declared = f.totals.totalEmployerPensionContribution;
  if (declared === null) return null;
  const expected = sum(
    f.fundContributions.filter((fc) => PENSION_EMPLOYER_FUND_TYPES.has(fc.fundType)).map((fc) => fc.employer ?? 0),
  );
  return moneyResult({
    rule: 'V1_pension_employer_sum',
    severity: 'warning',
    expected,
    actual: declared.value,
    tolerance: CUMULATIVE_TOLERANCE_AGOROT,
    message:
      'סך הפרשות המעסיק לקצבה המוצהר אמור להיות שווה לסכום הפקדות המעסיק לפנסיה ולפיצויים בטבלת נתוני העזר.',
  });
}

function v2TaxYearSanity(f: Form106, ctx: ValidateForm106Context): ValidationResult {
  const year = f.meta.taxYear;
  let passed = year >= 2000;
  if (passed && ctx.now) {
    passed = year <= ctx.now.getFullYear();
  }
  return {
    rule: 'V2_tax_year_sanity',
    severity: 'warning',
    passed,
    message: 'שנת המס בטופס אמורה להיות משנת 2000 ואילך, ולא בעתיד.',
  };
}

const TOTALS_WITH_PROVENANCE: readonly (keyof Form106['totals'])[] = [
  'taxableWages',
  'incomeTaxWithheld',
  'totalEmployerPensionContribution',
  'nationalInsuranceInsuredIncome',
];

function v3ConfidenceFloor(f: Form106): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const field of TOTALS_WITH_PROVENANCE) {
    const extracted = f.totals[field];
    const confidence = extracted?.prov?.confidence;
    if (confidence === undefined) continue;
    results.push({
      rule: `V3_confidence_floor[${field}]`,
      severity: 'warning',
      passed: confidence >= 0.6,
      message: `רמת הביטחון בשדה ${field} אמורה להיות לפחות 0.6.`,
    });
  }
  return results;
}

/**
 * חוקי ולידציה לטופס 106. סט קטן ושמרני יותר מ-validatePayslip: זהו סוג
 * המסמך השני שנתמך, נבנה מדוגמה אמיתית אחת — עדיף מעט חוקים מאומתים
 * מאשר הרבה חוקים שמנחשים מבנה שלא אומת.
 */
export function validateForm106(f: Form106, ctx: ValidateForm106Context = {}): ValidationResult[] {
  const results: ValidationResult[] = [v2TaxYearSanity(f, ctx), ...v3ConfidenceFloor(f)];

  const v1 = v1PensionEmployerSum(f);
  if (v1) results.push(v1);

  return results;
}
