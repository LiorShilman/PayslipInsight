import type { LineItem, LineItemSection, Payslip } from '@payslip-insight/schema';
import { isWithinTolerance, multiplyRound, sum } from './money.js';

export type Severity = 'blocking' | 'warning' | 'info';

export type ValidationResult = {
  rule: string;
  severity: Severity;
  passed: boolean;
  expected?: number;
  actual?: number;
  deltaAgorot?: number;
  message: string;
};

/** סבילות לחוק בודד (עיגולים). */
export const SINGLE_RULE_TOLERANCE_AGOROT = 2;
/** סבילות לזהויות מצטברות (סכימה על פני שורות רבות). */
export const CUMULATIVE_TOLERANCE_AGOROT = 5;
/** סבילות לזהויות צבירה (ימים, לא כסף). */
const BALANCE_TOLERANCE_DAYS = 0.01;

export type ValidateContext = {
  /** התלוש של החודש הקודם, לחוקי V7/V8 בהעלאה מרובה. */
  previousMonth?: Payslip;
  /** "עכשיו" מוזרק ע"י הקורא — core לעולם לא קורא Date.now() בעצמו (כלל ברזל #4). */
  now?: Date;
};

function sumBySection(lineItems: readonly LineItem[], section: LineItemSection): number {
  return sum(lineItems.filter((li) => li.section === section).map((li) => li.amount));
}

function moneyResult(args: {
  rule: string;
  severity: Severity;
  expected: number;
  actual: number;
  tolerance: number;
  message: string;
}): ValidationResult {
  const { rule, severity, expected, actual, tolerance, message } = args;
  const passed = isWithinTolerance(expected, actual, tolerance);
  return {
    rule,
    severity,
    passed,
    expected,
    actual,
    deltaAgorot: actual - expected,
    message,
  };
}

function v1GrossEqualsPayments(p: Payslip): ValidationResult {
  const expected = sumBySection(p.lineItems, 'payment');
  const actual = p.totals.grossPay.value;
  return moneyResult({
    rule: 'V1_gross_equals_payments',
    severity: 'blocking',
    expected,
    actual,
    tolerance: CUMULATIVE_TOLERANCE_AGOROT,
    message: 'סכום שורות התשלומים אמור להיות שווה לברוטו המוצהר.',
  });
}

function v2DeductionsSum(p: Payslip): ValidationResult {
  const expected = p.totals.totalMandatoryDeductions.value + p.totals.totalVoluntaryDeductions.value;
  const actual = p.totals.totalDeductions.value;
  return moneyResult({
    rule: 'V2_deductions_sum',
    severity: 'blocking',
    expected,
    actual,
    tolerance: SINGLE_RULE_TOLERANCE_AGOROT,
    message: 'ניכויי חובה + ניכויי רשות אמורים להיות שווים לסך הניכויים.',
  });
}

function v3NetIdentity(p: Payslip): ValidationResult {
  const expected = p.totals.grossPay.value - p.totals.totalDeductions.value;
  const actual = p.totals.netPay.value;
  const result = moneyResult({
    rule: 'V3_net_identity',
    severity: 'blocking',
    expected,
    actual,
    tolerance: SINGLE_RULE_TOLERANCE_AGOROT,
    message: 'ברוטו פחות סך הניכויים אמור להיות שווה לנטו לתשלום.',
  });

  if (result.passed) return result;

  const hasBenefitPayment = p.lineItems.some(
    (li) => li.category === 'benefit_in_kind' && li.section === 'payment',
  );
  const hasBenefitDeduction = p.lineItems.some(
    (li) => li.category === 'benefit_in_kind' && li.section !== 'payment',
  );
  if (hasBenefitPayment && !hasBenefitDeduction) {
    return {
      ...result,
      message: `${result.message} התלוש מכיל זקיפת שווי (benefit_in_kind) בתשלומים ללא ניכוי שווי מקביל — סביר שזה מקור הפער (ראה §6.1 הערה קריטית).`,
    };
  }
  return result;
}

function v4MandatorySum(p: Payslip): ValidationResult {
  const expected = sumBySection(p.lineItems, 'mandatory_deduction');
  const actual = p.totals.totalMandatoryDeductions.value;
  return moneyResult({
    rule: 'V4_mandatory_sum',
    severity: 'blocking',
    expected,
    actual,
    tolerance: CUMULATIVE_TOLERANCE_AGOROT,
    message: 'סכום שורות ניכויי החובה אמור להיות שווה לסך ניכויי החובה המוצהר.',
  });
}

function v5VoluntarySum(p: Payslip): ValidationResult {
  const expected = sumBySection(p.lineItems, 'voluntary_deduction');
  const actual = p.totals.totalVoluntaryDeductions.value;
  return moneyResult({
    rule: 'V5_voluntary_sum',
    severity: 'blocking',
    expected,
    actual,
    tolerance: CUMULATIVE_TOLERANCE_AGOROT,
    message: 'סכום שורות ניכויי הרשות אמור להיות שווה לסך ניכויי הרשות המוצהר.',
  });
}

function v6LineArithmetic(p: Payslip): ValidationResult[] {
  const results: ValidationResult[] = [];
  p.lineItems.forEach((li, index) => {
    if (li.quantity === null || li.rate === null) return;
    const expected = multiplyRound(li.quantity, li.rate);
    results.push(
      moneyResult({
        rule: `V6_line_arithmetic[${index}:${li.label}]`,
        severity: 'blocking',
        expected,
        actual: li.amount,
        tolerance: SINGLE_RULE_TOLERANCE_AGOROT,
        message: `כמות × תעריף עבור "${li.label}" אמור להיות שווה לסכום השורה.`,
      }),
    );
  });
  return results;
}

const YTD_NUMERIC_FIELDS = [
  'grossPay',
  'taxableIncome',
  'incomeTax',
  'nationalInsurance',
  'healthTax',
  'pensionEmployee',
  'pensionEmployer',
  'severance',
  'studyFundEmployee',
  'studyFundEmployer',
] as const satisfies readonly (keyof Payslip['yearToDate'])[];

function v7YtdMonotonic(p: Payslip, ctx: ValidateContext): ValidationResult[] {
  if (!ctx.previousMonth) return [];
  const results: ValidationResult[] = [];
  for (const field of YTD_NUMERIC_FIELDS) {
    const current = p.yearToDate[field];
    const previous = ctx.previousMonth.yearToDate[field];
    if (current === null || previous === null) continue;
    const passed = current >= previous - SINGLE_RULE_TOLERANCE_AGOROT;
    results.push({
      rule: `V7_ytd_monotonic[${field}]`,
      severity: 'warning',
      passed,
      expected: previous,
      actual: current,
      deltaAgorot: current - previous,
      message: `מצטבר שנתי (${field}) לא אמור לרדת מהחודש הקודם.`,
    });
  }
  return results;
}

const YTD_CATEGORY_MAP: Partial<Record<(typeof YTD_NUMERIC_FIELDS)[number], LineItem['category']>> = {
  incomeTax: 'income_tax',
  nationalInsurance: 'national_insurance',
  healthTax: 'health_tax',
  pensionEmployee: 'pension_employee',
  pensionEmployer: 'pension_employer',
  severance: 'severance_employer',
  studyFundEmployee: 'study_fund_employee',
  studyFundEmployer: 'study_fund_employer',
};

function monthAmountFor(p: Payslip, field: (typeof YTD_NUMERIC_FIELDS)[number]): number | null {
  if (field === 'grossPay') return p.totals.grossPay.value;
  if (field === 'taxableIncome') return p.totals.taxableIncome?.value ?? null;
  // YTD_CATEGORY_MAP covers every remaining field in YTD_NUMERIC_FIELDS by construction.
  const category = YTD_CATEGORY_MAP[field] as LineItem['category'];
  return sum(p.lineItems.filter((li) => li.category === category).map((li) => li.amount));
}

function v8YtdDelta(p: Payslip, ctx: ValidateContext): ValidationResult[] {
  if (!ctx.previousMonth) return [];
  const results: ValidationResult[] = [];
  for (const field of YTD_NUMERIC_FIELDS) {
    const current = p.yearToDate[field];
    const previous = ctx.previousMonth.yearToDate[field];
    if (current === null || previous === null) continue;
    const monthAmount = monthAmountFor(p, field);
    if (monthAmount === null) continue;
    const expected = current - previous;
    results.push(
      moneyResult({
        rule: `V8_ytd_delta[${field}]`,
        severity: 'warning',
        expected,
        actual: monthAmount,
        tolerance: CUMULATIVE_TOLERANCE_AGOROT,
        message: `ההפרש במצטבר השנתי (${field}) אמור לשקף בקירוב את סכום החודש הנוכחי.`,
      }),
    );
  }
  return results;
}

function v9BalanceIdentity(p: Payslip): ValidationResult[] {
  const results: ValidationResult[] = [];
  p.balances.forEach((balance, index) => {
    const { openingBalance, accrued, used, closingBalance } = balance;
    if (openingBalance === null || accrued === null || used === null || closingBalance === null) return;
    const expected = openingBalance + accrued - used;
    const passed = Math.abs(expected - closingBalance) <= BALANCE_TOLERANCE_DAYS;
    results.push({
      rule: `V9_balance_identity[${index}:${balance.type}]`,
      severity: 'warning',
      passed,
      expected,
      actual: closingBalance,
      deltaAgorot: closingBalance - expected,
      message: `יתרת פתיחה + צבירה − ניצול אמור להיות שווה ליתרת הסגירה עבור צבירת "${balance.type}".`,
    });
  });
  return results;
}

function v10EmployerContribSum(p: Payslip): ValidationResult | null {
  const declared = p.totals.totalEmployerContributions;
  if (declared === null) return null;
  const expected = sumBySection(p.lineItems, 'employer_contribution');
  return moneyResult({
    rule: 'V10_employer_contrib_sum',
    severity: 'warning',
    expected,
    actual: declared.value,
    tolerance: CUMULATIVE_TOLERANCE_AGOROT,
    message: 'סכום שורות הפרשות המעסיק אמור להיות שווה לסך הפרשות המעסיק המוצהר.',
  });
}

function v11PeriodSanity(p: Payslip, ctx: ValidateContext): ValidationResult {
  const { year, month } = p.meta.period;
  let passed = year >= 2000;
  if (passed && ctx.now) {
    const periodYm = year * 12 + month;
    const nowYm = ctx.now.getFullYear() * 12 + (ctx.now.getMonth() + 1);
    passed = periodYm <= nowYm;
  }
  return {
    rule: 'V11_period_sanity',
    severity: 'warning',
    passed,
    message: 'תקופת התלוש אמורה להיות משנת 2000 ואילך, ולא בעתיד.',
  };
}

const TOTALS_WITH_PROVENANCE: readonly (keyof Payslip['totals'])[] = [
  'grossPay',
  'taxableIncome',
  'niBase',
  'pensionBase',
  'totalMandatoryDeductions',
  'totalVoluntaryDeductions',
  'totalDeductions',
  'netPay',
  'totalEmployerContributions',
];

function v12ConfidenceFloor(p: Payslip): ValidationResult[] {
  const results: ValidationResult[] = [];
  for (const field of TOTALS_WITH_PROVENANCE) {
    const extracted = p.totals[field];
    const confidence = extracted?.prov?.confidence;
    if (confidence === undefined) continue;
    results.push({
      rule: `V12_confidence_floor[${field}]`,
      severity: 'warning',
      passed: confidence >= 0.6,
      message: `רמת הביטחון בשדה ${field} אמורה להיות לפחות 0.6.`,
    });
  }
  return results;
}

function v13NetToGrossSanity(p: Payslip): ValidationResult | null {
  const gross = p.totals.grossPay.value;
  if (gross === 0) return null;
  const ratio = p.totals.netPay.value / gross;
  return {
    rule: 'V13_net_to_gross_sanity',
    severity: 'info',
    passed: ratio >= 0.5 && ratio <= 1.0,
    message: 'יחס נטו/ברוטו אמור להיות בטווח סביר (0.5–1.0).',
  };
}

/**
 * מריץ את כל חוקי הולידציה (§6) על תלוש. חוקים שלא ניתן להעריך בגלל
 * שדה חסר (null) — לא נכללים בתוצאה, ולא נחשבים ככישלון.
 *
 * V14 (יחס הפרשה מול מינימום סטטוטורי) לא מומש כאן במתכוון: הוא כפול
 * ל-`contribution_below_statutory` במנוע הממצאים (§7.3), ותלוי בפרמטרי
 * מס מאומתים. ייושם שם, לא כאן.
 */
export function validatePayslip(p: Payslip, ctx: ValidateContext = {}): ValidationResult[] {
  const results: ValidationResult[] = [
    v1GrossEqualsPayments(p),
    v2DeductionsSum(p),
    v3NetIdentity(p),
    v4MandatorySum(p),
    v5VoluntarySum(p),
    ...v6LineArithmetic(p),
    ...v7YtdMonotonic(p, ctx),
    ...v8YtdDelta(p, ctx),
    ...v9BalanceIdentity(p),
    v11PeriodSanity(p, ctx),
    ...v12ConfidenceFloor(p),
  ];

  const v10 = v10EmployerContribSum(p);
  if (v10) results.push(v10);

  const v13 = v13NetToGrossSanity(p);
  if (v13) results.push(v13);

  return results;
}

export function hasBlockingFailure(results: readonly ValidationResult[]): boolean {
  return results.some((r) => r.severity === 'blocking' && !r.passed);
}
