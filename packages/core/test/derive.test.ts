import { describe, expect, it } from 'vitest';
import type { LineItem, Payslip, TaxParams } from '@payslip-insight/schema';
import { deriveMetrics } from '../src/derive.js';

function extracted<T>(value: T) {
  return { value, prov: null };
}

function line(partial: Partial<LineItem> & Pick<LineItem, 'label' | 'category' | 'section' | 'amount'>): LineItem {
  return {
    code: null,
    quantity: null,
    quantityUnit: null,
    rate: null,
    yearToDate: null,
    taxable: null,
    prov: null,
    ...partial,
  };
}

function fixturePayslip(): Payslip {
  const lineItems: LineItem[] = [
    line({ label: 'שכר יסוד', category: 'base_salary', section: 'payment', amount: 1_000_000 }),
    line({ label: 'נסיעות', category: 'travel_allowance', section: 'payment', amount: 50_000 }),
    line({ label: 'בונוס', category: 'bonus', section: 'payment', amount: 100_000 }),
    line({ label: 'החזר הוצאות', category: 'expense_reimbursement', section: 'payment', amount: 20_000 }),
    line({ label: 'שווי רכב', category: 'benefit_in_kind', section: 'payment', amount: 30_000 }),
    line({ label: 'מס הכנסה', category: 'income_tax', section: 'mandatory_deduction', amount: 150_000 }),
    line({ label: 'ביטוח לאומי', category: 'national_insurance', section: 'mandatory_deduction', amount: 50_000 }),
    line({ label: 'מס בריאות', category: 'health_tax', section: 'mandatory_deduction', amount: 30_000 }),
    line({ label: 'ניכוי שווי רכב', category: 'benefit_in_kind', section: 'mandatory_deduction', amount: 30_000 }),
    line({ label: 'תגמולי עובד', category: 'pension_employee', section: 'voluntary_deduction', amount: 60_000 }),
    line({ label: 'תגמולי מעסיק', category: 'pension_employer', section: 'employer_contribution', amount: 65_000 }),
    line({ label: 'פיצויים', category: 'severance_employer', section: 'employer_contribution', amount: 83_000 }),
  ];

  return {
    schemaVersion: '1.0',
    meta: {
      docType: 'payslip',
      payrollProvider: 'test',
      period: { year: 2026, month: 3 },
      payDate: null,
      currency: 'ILS',
    },
    employee: {
      fullName: null,
      nationalIdLast4: null,
      employeeNumber: null,
      department: null,
      jobTitle: null,
      startDate: null,
      seniorityMonths: null,
      employmentScope: null,
      grade: null,
    },
    employer: { name: null, companyId: null, deductionsFileId: null },
    taxProfile: {
      creditPoints: 2.25,
      maritalStatus: null,
      taxCoordination: null,
      additionalIncome: null,
      residentOfDevelopmentArea: null,
    },
    lineItems,
    totals: {
      grossPay: extracted(1_200_000),
      taxableIncome: extracted(1_000_000),
      niBase: extracted(1_200_000),
      pensionBase: extracted(1_000_000),
      totalMandatoryDeductions: extracted(260_000),
      totalVoluntaryDeductions: extracted(60_000),
      totalDeductions: extracted(320_000),
      netPay: extracted(880_000),
      totalEmployerContributions: extracted(148_000),
    },
    yearToDate: {
      grossPay: null,
      taxableIncome: null,
      incomeTax: null,
      nationalInsurance: null,
      healthTax: null,
      pensionEmployee: null,
      pensionEmployer: null,
      severance: null,
      studyFundEmployee: null,
      studyFundEmployer: null,
    },
    balances: [],
    attendance: null,
    payment: null,
    extraction: { engine: 'llm', modelId: 'test', attempts: 1, overallConfidence: 0.9, warnings: [] },
  };
}

function fixtureTaxParams(): TaxParams {
  return {
    year: 2026,
    source: 'test',
    lastVerified: '2026-01-01',
    creditPointMonthlyValue: 23_500,
    incomeTaxBrackets: [
      { upToMonthly: 700_000, rate: 0.1 },
      { upToMonthly: 1_400_000, rate: 0.14 },
      { upToMonthly: null, rate: 0.2 },
    ],
    surtaxThresholdAnnual: null,
    nationalInsurance: {
      employeeReducedRate: null,
      employeeFullRate: null,
      employerReducedRate: null,
      employerFullRate: null,
      reducedRateCeilingMonthly: null,
      maxIncomeCeilingMonthly: null,
    },
    healthTax: { reducedRate: null, fullRate: null },
    mandatoryPension: { employeeMin: null, employerMin: null, severanceMin: null },
    studyFundCeilingMonthly: null,
  };
}

describe('deriveMetrics', () => {
  it('computes employer cost and total compensation excluding reimbursements', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.employerTotalCost).toBe(1_348_000); // 1,200,000 + 148,000
    expect(derived.totalCompensation).toBe(1_328_000); // 1,200,000 - 20,000 + 148,000
  });

  it('computes takeHomeRatio and effectiveTotalDeductionRate', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.takeHomeRatio).toBeCloseTo(880_000 / 1_200_000, 10);
    expect(derived.effectiveTotalDeductionRate).toBeCloseTo(320_000 / 1_200_000, 10);
  });

  it('computes contribution rates against pensionBase', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.contributionRates.pensionEmployee).toBeCloseTo(0.06, 10);
    expect(derived.contributionRates.pensionEmployer).toBeCloseTo(0.065, 10);
    expect(derived.contributionRates.severance).toBeCloseTo(0.083, 10);
    expect(derived.contributionRates.studyFundEmployee).toBe(0);
  });

  it('returns null contribution rates when pensionBase is missing', () => {
    const p = fixturePayslip();
    p.totals.pensionBase = null;
    const derived = deriveMetrics(p, null);
    expect(derived.contributionRates.pensionEmployee).toBeNull();
    expect(derived.contributionRates.pensionEmployer).toBeNull();
  });

  it('sums only the payment-side benefit_in_kind line into benefitInKindTotal', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.benefitInKindTotal).toBe(30_000);
  });

  it('builds a waterfall from gross through each deduction line to net', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.waterfall[0]).toMatchObject({ kind: 'start', amount: 1_200_000, cumulativeAfter: 1_200_000 });
    const last = derived.waterfall[derived.waterfall.length - 1];
    expect(last).toMatchObject({ kind: 'end', amount: 880_000, cumulativeAfter: 880_000 });
    const deductionSteps = derived.waterfall.filter((s) => s.kind === 'deduction');
    expect(deductionSteps).toHaveLength(5); // 4 mandatory + 1 voluntary
    expect(deductionSteps[deductionSteps.length - 1]?.cumulativeAfter).toBe(880_000);
  });

  it('splits pay distribution into fixed / variable / reimbursement / benefitInKind summing to gross', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    const { fixed, variable, reimbursement, benefitInKind } = derived.payDistribution;
    expect(fixed).toBe(1_050_000); // base_salary + travel_allowance
    expect(variable).toBe(100_000); // bonus
    expect(reimbursement).toBe(20_000);
    expect(benefitInKind).toBe(30_000);
    expect(fixed + variable + reimbursement + benefitInKind).toBe(1_200_000);
  });

  it('leaves params-dependent fields null when TaxParams is null', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.costOfNextShekel).toBeNull();
    expect(derived.creditPointsSavings).toBeNull();
  });

  it('computes effectiveTaxRate from extracted taxableIncome', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.effectiveTaxRate).toBeCloseTo(150_000 / 1_000_000, 10);
  });

  it('returns null effectiveTaxRate when taxableIncome was not extracted', () => {
    const p = fixturePayslip();
    p.totals.taxableIncome = null;
    const derived = deriveMetrics(p, null);
    expect(derived.effectiveTaxRate).toBeNull();
  });

  it('computes costOfNextShekel as the marginal bracket rate when params are provided', () => {
    const derived = deriveMetrics(fixturePayslip(), fixtureTaxParams());
    expect(derived.costOfNextShekel).toBe(0.14); // taxableIncome 1,000,000 falls in the 700k–1.4m bracket
  });

  it('computes creditPointsSavings from creditPoints * creditPointMonthlyValue', () => {
    const derived = deriveMetrics(fixturePayslip(), fixtureTaxParams());
    expect(derived.creditPointsSavings).toBe(52_875); // 2.25 * 23,500
  });

  it('costOfNextShekel is null when taxableIncome was not extracted, even with params', () => {
    const p = fixturePayslip();
    p.totals.taxableIncome = null;
    const derived = deriveMetrics(p, fixtureTaxParams());
    expect(derived.costOfNextShekel).toBeNull();
  });

  it('costOfNextShekel is null when incomeTaxBrackets is empty', () => {
    const params = { ...fixtureTaxParams(), incomeTaxBrackets: [] };
    const derived = deriveMetrics(fixturePayslip(), params);
    expect(derived.costOfNextShekel).toBeNull();
  });

  it('costOfNextShekel sorts out-of-order brackets before matching', () => {
    const params = {
      ...fixtureTaxParams(),
      incomeTaxBrackets: [
        { upToMonthly: null, rate: 0.2 },
        { upToMonthly: 700_000, rate: 0.1 },
        { upToMonthly: 1_400_000, rate: 0.14 },
      ],
    };
    // taxableIncome = 1,000,000 in the fixture — falls between 700k and 1.4m.
    const derived = deriveMetrics(fixturePayslip(), params);
    expect(derived.costOfNextShekel).toBe(0.14);
  });

  it('costOfNextShekel falls in the unbounded top bracket for high income', () => {
    const p = fixturePayslip();
    p.totals.taxableIncome = extracted(2_000_000);
    const derived = deriveMetrics(p, fixtureTaxParams());
    expect(derived.costOfNextShekel).toBe(0.2);
  });

  it('costOfNextShekel is null when income exceeds every bounded bracket and there is no unbounded one', () => {
    const p = fixturePayslip();
    p.totals.taxableIncome = extracted(2_000_000);
    const params = { ...fixtureTaxParams(), incomeTaxBrackets: [{ upToMonthly: 700_000, rate: 0.1 }] };
    const derived = deriveMetrics(p, params);
    expect(derived.costOfNextShekel).toBeNull();
  });

  it('computes trueNet as bankNet + employee long-term savings + employer contributions', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    // fixture: pension_employee 60,000; pension_employer 65,000; severance_employer 83,000
    expect(derived.trueNet).toEqual({
      bankNet: 880_000,
      employeeSavings: 60_000,
      employerSavings: 148_000,
      total: 1_088_000,
    });
  });

  it('excludes non-savings voluntary deductions and employer contributions from trueNet', () => {
    const p = fixturePayslip();
    p.lineItems.push(
      line({ label: 'ועד עובדים', category: 'union_dues', section: 'voluntary_deduction', amount: 15_000 }),
      line({
        label: 'ביטוח לאומי מעסיק',
        category: 'national_insurance_employer',
        section: 'employer_contribution',
        amount: 40_000,
      }),
    );
    const derived = deriveMetrics(p, null);
    expect(derived.trueNet.employeeSavings).toBe(60_000); // union_dues not counted
    expect(derived.trueNet.employerSavings).toBe(148_000); // national_insurance_employer not counted
  });

  it('builds a retirementBreakdown per fund, omitting funds with no employee or employer amount', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    // fixture only has pension (employee+employer) and severance (employer only)
    expect(derived.retirementBreakdown).toEqual([
      { fund: 'pension', employee: 60_000, employer: 65_000 },
      { fund: 'severance', employee: 0, employer: 83_000 },
    ]);
  });

  it('includes studyFund and managerInsurance in retirementBreakdown when present', () => {
    const p = fixturePayslip();
    p.lineItems.push(
      line({ label: 'קרן השתלמות עובד', category: 'study_fund_employee', section: 'voluntary_deduction', amount: 20_000 }),
      line({ label: 'קה"ל מעסיק', category: 'study_fund_employer', section: 'employer_contribution', amount: 25_000 }),
    );
    const derived = deriveMetrics(p, null);
    const studyFund = derived.retirementBreakdown.find((r) => r.fund === 'studyFund');
    expect(studyFund).toEqual({ fund: 'studyFund', employee: 20_000, employer: 25_000 });
  });

  it('returns empty yearToDateComparison when no yearToDate fields were extracted', () => {
    const derived = deriveMetrics(fixturePayslip(), null);
    expect(derived.yearToDateComparison).toEqual([]);
  });

  it('computes yearToDateComparison only for metrics with an extracted yearToDate value', () => {
    const p = fixturePayslip(); // period.month = 3, grossPay = 1,200,000
    p.yearToDate.grossPay = 3_000_000; // ytdAverage = 1,000,000
    p.yearToDate.incomeTax = 450_000; // ytdAverage = 150,000, matches this month's income_tax line
    const derived = deriveMetrics(p, null);
    expect(derived.yearToDateComparison).toEqual([
      { metric: 'grossPay', thisMonth: 1_200_000, ytdAverage: 1_000_000 },
      { metric: 'incomeTax', thisMonth: 150_000, ytdAverage: 150_000 },
    ]);
  });

  it('rounds ytdAverage when yearToDate does not divide evenly by the month number', () => {
    const p = fixturePayslip();
    p.meta.period.month = 4;
    p.yearToDate.grossPay = 5_000_001; // /4 = 1,250,000.25
    const derived = deriveMetrics(p, null);
    expect(derived.yearToDateComparison[0]).toEqual({ metric: 'grossPay', thisMonth: 1_200_000, ytdAverage: 1_250_000 });
  });

  it('does not throw and returns 0-valued metrics for an all-zero payslip', () => {
    const p = fixturePayslip();
    p.lineItems = [];
    p.totals = {
      grossPay: extracted(0),
      taxableIncome: extracted(0),
      niBase: extracted(0),
      pensionBase: extracted(0),
      totalMandatoryDeductions: extracted(0),
      totalVoluntaryDeductions: extracted(0),
      totalDeductions: extracted(0),
      netPay: extracted(0),
      totalEmployerContributions: null,
    };
    const derived = deriveMetrics(p, null);
    expect(derived.takeHomeRatio).toBeNull(); // 0/0 guarded, not NaN
    expect(derived.effectiveTotalDeductionRate).toBeNull();
    expect(derived.waterfall).toHaveLength(2); // just start + end
    expect(derived.trueNet).toEqual({ bankNet: 0, employeeSavings: 0, employerSavings: 0, total: 0 });
    expect(derived.retirementBreakdown).toEqual([]);
  });
});
