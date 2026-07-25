import type { LineItem, LineItemCategory, Payslip, TaxParams } from '@payslip-insight/schema';
import { sum } from './money.js';

export type Money = number;

export type WaterfallStep = {
  key: string;
  /** התווית המדויקת כפי שהופיעה בתלוש עבור צעדי ניכוי; טקסט קבוע עבור start/end. */
  label: string;
  kind: 'start' | 'deduction' | 'end';
  /** גודל הצעד (תמיד חיובי — הכיוון נגזר מ-kind). */
  amount: Money;
  /** היתרה המצטברת אחרי הצעד הזה. */
  cumulativeAfter: Money;
};

export type DerivedMetrics = {
  employerTotalCost: Money;
  takeHomeRatio: number | null;
  totalCompensation: Money;
  /** null אם taxableIncome לא חולץ. */
  effectiveTaxRate: number | null;
  effectiveTotalDeductionRate: number | null;
  contributionRates: {
    pensionEmployee: number | null;
    pensionEmployer: number | null;
    severance: number | null;
    studyFundEmployee: number | null;
    studyFundEmployer: number | null;
  };
  benefitInKindTotal: Money;
  /** null אם TaxParams לא סופקו (לא אומתו). */
  costOfNextShekel: number | null;
  /** null אם TaxParams לא סופקו, או שאין נקודות זיכוי מחולצות. */
  creditPointsSavings: Money | null;
  waterfall: WaterfallStep[];
  payDistribution: {
    fixed: Money;
    variable: Money;
    reimbursement: Money;
    benefitInKind: Money;
  };
};

function amountByCategory(lineItems: readonly LineItem[], category: LineItemCategory): number {
  return sum(lineItems.filter((li) => li.category === category).map((li) => li.amount));
}

/**
 * `benefit_in_kind` מופיע גם בתשלומים (זקיפה) וגם בניכויים (ניכוי שווי),
 * שניהם נשמרים כערכים חיוביים. סכימה לפי category בלבד הייתה מכפילה את
 * הסכום — כאן סוכמים רק את צד התשלום, שהוא "השווי" עצמו.
 */
function benefitInKindPaymentAmount(lineItems: readonly LineItem[]): number {
  return sum(
    lineItems
      .filter((li) => li.category === 'benefit_in_kind' && li.section === 'payment')
      .map((li) => li.amount),
  );
}

function ratio(numerator: number, denominator: number | null | undefined): number | null {
  if (denominator === null || denominator === undefined || denominator === 0) return null;
  return numerator / denominator;
}

function buildWaterfall(p: Payslip): WaterfallStep[] {
  const gross = p.totals.grossPay.value;
  const steps: WaterfallStep[] = [
    { key: 'gross', label: 'ברוטו', kind: 'start', amount: gross, cumulativeAfter: gross },
  ];

  let cumulative = gross;
  p.lineItems
    .filter((li) => li.section === 'mandatory_deduction' || li.section === 'voluntary_deduction')
    .forEach((li, index) => {
      cumulative -= li.amount;
      steps.push({
        key: `deduction-${index}`,
        label: li.label,
        kind: 'deduction',
        amount: li.amount,
        cumulativeAfter: cumulative,
      });
    });

  const net = p.totals.netPay.value;
  steps.push({ key: 'net', label: 'נטו לתשלום', kind: 'end', amount: net, cumulativeAfter: net });
  return steps;
}

/**
 * חלוקת התשלומים לקטגוריות תצוגה. סיווג זה הוא בחירת עיצוב (לא מוגדר
 * מילולית ב-SPEC.md §7.2) עבור `PayCompositionChart`: "fixed" = רכיבים
 * חוזרים וצפויים, "variable" = רכיבים שמשתנים חודש לחודש, "reimbursement"
 * = החזר הוצאות (לא הכנסה), "benefitInKind" = זקיפת שווי (מטופלת בנפרד
 * כי היא לא נכנסת לנטו בפועל).
 */
const FIXED_PAYMENT_CATEGORIES: ReadonlySet<LineItemCategory> = new Set([
  'base_salary',
  'seniority_increment',
  'meal_allowance',
  'clothing_allowance',
  'travel_allowance',
  'recuperation_pay',
  'holiday_gift',
]);

function computePayDistribution(p: Payslip): DerivedMetrics['payDistribution'] {
  const paymentLines = p.lineItems.filter((li) => li.section === 'payment');
  let fixed = 0;
  let variable = 0;
  let reimbursement = 0;
  let benefitInKind = 0;

  for (const li of paymentLines) {
    if (li.category === 'expense_reimbursement') {
      reimbursement += li.amount;
    } else if (li.category === 'benefit_in_kind') {
      benefitInKind += li.amount;
    } else if (FIXED_PAYMENT_CATEGORIES.has(li.category)) {
      fixed += li.amount;
    } else {
      variable += li.amount;
    }
  }

  return { fixed, variable, reimbursement, benefitInKind };
}

function computeCostOfNextShekel(p: Payslip, params: TaxParams): number | null {
  const taxableIncome = p.totals.taxableIncome?.value;
  if (taxableIncome === undefined || taxableIncome === null) return null;
  if (params.incomeTaxBrackets.length === 0) return null;

  const sorted = [...params.incomeTaxBrackets].sort((a, b) => {
    if (a.upToMonthly === null) return 1;
    if (b.upToMonthly === null) return -1;
    return a.upToMonthly - b.upToMonthly;
  });

  const bracket = sorted.find((b) => b.upToMonthly === null || taxableIncome <= b.upToMonthly);
  return bracket ? bracket.rate : null;
}

/**
 * כל הנגזרות המחושבות מתלוש. פונקציה טהורה — אין I/O, אין Date.now().
 * `params === null` מסמן שפרמטרי המס לא אומתו (§7.1); כל שדה שתלוי בהם
 * מוחזר `null` במקום ערך מנוחש (כלל ברזל #8).
 */
export function deriveMetrics(p: Payslip, params: TaxParams | null): DerivedMetrics {
  const gross = p.totals.grossPay.value;
  const net = p.totals.netPay.value;
  const employerContribTotal = p.totals.totalEmployerContributions?.value ?? 0;
  const reimbursementTotal = amountByCategory(p.lineItems, 'expense_reimbursement');
  const incomeTaxAmount = amountByCategory(p.lineItems, 'income_tax');
  const pensionBase = p.totals.pensionBase?.value ?? null;

  const employerTotalCost = gross + employerContribTotal;
  const totalCompensation = gross - reimbursementTotal + employerContribTotal;

  const creditPoints = p.taxProfile.creditPoints;
  const creditPointsSavings =
    params && creditPoints !== null && params.creditPointMonthlyValue !== null
      ? Math.round(creditPoints * params.creditPointMonthlyValue)
      : null;

  return {
    employerTotalCost,
    takeHomeRatio: ratio(net, gross),
    totalCompensation,
    effectiveTaxRate: ratio(incomeTaxAmount, p.totals.taxableIncome?.value),
    effectiveTotalDeductionRate: ratio(p.totals.totalDeductions.value, gross),
    contributionRates: {
      pensionEmployee: ratio(amountByCategory(p.lineItems, 'pension_employee'), pensionBase),
      pensionEmployer: ratio(amountByCategory(p.lineItems, 'pension_employer'), pensionBase),
      severance: ratio(amountByCategory(p.lineItems, 'severance_employer'), pensionBase),
      studyFundEmployee: ratio(amountByCategory(p.lineItems, 'study_fund_employee'), pensionBase),
      studyFundEmployer: ratio(amountByCategory(p.lineItems, 'study_fund_employer'), pensionBase),
    },
    benefitInKindTotal: benefitInKindPaymentAmount(p.lineItems),
    costOfNextShekel: params ? computeCostOfNextShekel(p, params) : null,
    creditPointsSavings,
    waterfall: buildWaterfall(p),
    payDistribution: computePayDistribution(p),
  };
}
