import type { PersonalInfoReport } from '@payslip-insight/schema';
import { sum } from './money.js';
import { moneyResult, type ValidationResult } from './validate.js';

export type ValidatePersonalInfoReportContext = {
  /** "עכשיו" מוזרק ע"י הקורא — core לעולם לא קורא Date.now() בעצמו (כלל ברזל #4). */
  now?: Date;
};

/**
 * דוחות מסוג זה מוצגים לרוב מעוגלים לשקל הקרוב (לא אגורה, בניגוד לתלוש/
 * טופס 106) — ראה הערת "מעוגלים לשקל הקרוב" בדוגמה אמיתית שממנה נגזרו
 * החוקים. זהות עם עד 7 מרכיבים, כל אחד עם שגיאת עיגול של עד חצי שקל,
 * יכולה לצבור עד כ-3.5 ש"ח סטייה — סבילות רחבה בהתאם, לא CUMULATIVE_TOLERANCE
 * הרגיל של validate.ts שמניח דיוק ברמת אגורה.
 */
const SHEKEL_ROUNDING_TOLERANCE_AGOROT = 500;

/**
 * openingBalance + deposits + investmentGains + managementFees +
 * disabilityInsuranceCost + deathInsuranceCost ≈ closingBalance.
 * עמלות/עלויות נשמרות בסימן המקורי (בד"כ שלילי) — לכן חיבור פשוט, לא
 * חיסור. זהות אומתה ידנית מול דוח פנסיה אמיתי (878,850+10,421+5,287
 * −253−845−247 = 893,213, מוצהר 893,214).
 */
function v1FundMovementsIdentity(r: PersonalInfoReport): ValidationResult | null {
  const { openingBalance, deposits, investmentGains, managementFees, disabilityInsuranceCost, deathInsuranceCost, closingBalance } =
    r.fundMovements;
  if (
    openingBalance === null ||
    deposits === null ||
    investmentGains === null ||
    managementFees === null ||
    disabilityInsuranceCost === null ||
    deathInsuranceCost === null ||
    closingBalance === null
  ) {
    return null;
  }
  const expected =
    openingBalance.value +
    deposits.value +
    investmentGains.value +
    managementFees.value +
    disabilityInsuranceCost.value +
    deathInsuranceCost.value;
  return moneyResult({
    rule: 'V1_fund_movements_identity',
    severity: 'warning',
    expected,
    actual: closingBalance.value,
    tolerance: SHEKEL_ROUNDING_TOLERANCE_AGOROT,
    message: 'יתרת פתיחה + הפקדות + תשואה + עמלות/עלויות אמור להיות שווה בקירוב ליתרת הסגירה המוצהרת.',
  });
}

/** סכום עמודת "סה"כ" בטבלת ההפקדות (סעיף ה') אמור לשקף את "הפקדות" בסעיף ב'. */
function v2DepositsSum(r: PersonalInfoReport): ValidationResult | null {
  const declared = r.fundMovements.deposits;
  if (declared === null || r.deposits.length === 0) return null;
  const expected = sum(r.deposits.map((d) => d.total ?? 0));
  return moneyResult({
    rule: 'V2_deposits_sum',
    severity: 'warning',
    expected,
    actual: declared.value,
    tolerance: SHEKEL_ROUNDING_TOLERANCE_AGOROT,
    message: 'סכום שורות טבלת ההפקדות אמור להיות שווה בקירוב ל"הפקדות" בתנועות הקרן.',
  });
}

function v3ReportPeriodSanity(r: PersonalInfoReport, ctx: ValidatePersonalInfoReportContext): ValidationResult | null {
  const { fromDate, toDate } = r.meta.reportPeriod;
  if (fromDate === null && toDate === null) return null;
  const year = Number((fromDate ?? toDate)?.slice(0, 4));
  let passed = Number.isFinite(year) && year >= 2000;
  if (passed && ctx.now) {
    passed = year <= ctx.now.getFullYear();
  }
  return {
    rule: 'V3_report_period_sanity',
    severity: 'warning',
    passed,
    message: 'תקופת הדוח אמורה להיות משנת 2000 ואילך, ולא בעתיד.',
  };
}

/**
 * חוקי ולידציה לדוח מידע אישי (פנסיה/גמל להשקעה/השתלמות). סוג מסמך
 * שלישי — סט קטן ושמרני, מבוסס על זהויות שאומתו ידנית מול דוגמה אמיתית.
 */
export function validatePersonalInfoReport(
  r: PersonalInfoReport,
  ctx: ValidatePersonalInfoReportContext = {},
): ValidationResult[] {
  const results: ValidationResult[] = [];

  const v1 = v1FundMovementsIdentity(r);
  if (v1) results.push(v1);

  const v2 = v2DepositsSum(r);
  if (v2) results.push(v2);

  const v3 = v3ReportPeriodSanity(r, ctx);
  if (v3) results.push(v3);

  return results;
}
