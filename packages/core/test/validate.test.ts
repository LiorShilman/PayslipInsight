import { describe, expect, it } from 'vitest';
import type { LineItem, Payslip } from '@payslip-insight/schema';
import { hasBlockingFailure, validatePayslip, type ValidationResult } from '../src/validate.js';

function extracted<T>(value: T, confidence = 0.95) {
  return { value, prov: { page: 0, bbox: [0, 0, 1, 1] as [number, number, number, number], rawText: String(value), confidence } };
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

/** תלוש בסיסי שכל זהויות §6.1 מתקיימות בו בדיוק. */
function basePayslip(): Payslip {
  const lineItems: LineItem[] = [
    line({ label: 'שכר יסוד', category: 'base_salary', section: 'payment', amount: 1_000_000 }),
    line({ label: 'מס הכנסה', category: 'income_tax', section: 'mandatory_deduction', amount: 150_000 }),
    line({ label: 'ביטוח לאומי', category: 'national_insurance', section: 'mandatory_deduction', amount: 50_000 }),
    line({ label: 'מס בריאות', category: 'health_tax', section: 'mandatory_deduction', amount: 30_000 }),
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
      creditPoints: null,
      maritalStatus: null,
      taxCoordination: null,
      additionalIncome: null,
      residentOfDevelopmentArea: null,
    },
    lineItems,
    totals: {
      grossPay: extracted(1_000_000),
      taxableIncome: extracted(1_000_000),
      niBase: extracted(1_000_000),
      pensionBase: extracted(1_000_000),
      totalMandatoryDeductions: extracted(230_000),
      totalVoluntaryDeductions: extracted(60_000),
      totalDeductions: extracted(290_000),
      netPay: extracted(710_000),
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

function find(results: readonly ValidationResult[], rule: string): ValidationResult | undefined {
  return results.find((r) => r.rule === rule);
}

describe('validatePayslip — blocking identities (§6.1)', () => {
  it('passes all blocking rules for a consistent payslip', () => {
    const results = validatePayslip(basePayslip());
    expect(hasBlockingFailure(results)).toBe(false);
  });

  it('V1_gross_equals_payments fails when grossPay does not match the sum of payment lines', () => {
    const p = basePayslip();
    p.totals.grossPay = extracted(1_000_100);
    const results = validatePayslip(p);
    expect(find(results, 'V1_gross_equals_payments')?.passed).toBe(false);
    expect(hasBlockingFailure(results)).toBe(true);
  });

  it('V1 tolerates rounding drift up to the cumulative tolerance', () => {
    const p = basePayslip();
    p.totals.grossPay = extracted(1_000_005);
    expect(find(validatePayslip(p), 'V1_gross_equals_payments')?.passed).toBe(true);
  });

  it('V2_deductions_sum fails when mandatory + voluntary does not equal totalDeductions', () => {
    const p = basePayslip();
    p.totals.totalDeductions = extracted(300_000);
    expect(find(validatePayslip(p), 'V2_deductions_sum')?.passed).toBe(false);
  });

  it('V3_net_identity fails when gross - deductions does not equal net', () => {
    const p = basePayslip();
    p.totals.netPay = extracted(700_000);
    const result = find(validatePayslip(p), 'V3_net_identity');
    expect(result?.passed).toBe(false);
  });

  it('V3_net_identity hints at a missing benefit-in-kind deduction pair', () => {
    const p = basePayslip();
    p.lineItems.push(
      line({ label: 'שווי רכב', category: 'benefit_in_kind', section: 'payment', amount: 200_000 }),
    );
    p.totals.grossPay = extracted(1_200_000);
    // benefit-in-kind deduction line intentionally omitted — net identity will fail.
    const result = find(validatePayslip(p), 'V3_net_identity');
    expect(result?.passed).toBe(false);
    expect(result?.message).toMatch(/זקיפת שווי/);
  });

  it('V4_mandatory_sum fails when the sum of mandatory_deduction lines drifts from the declared total', () => {
    const p = basePayslip();
    p.totals.totalMandatoryDeductions = extracted(250_000);
    expect(find(validatePayslip(p), 'V4_mandatory_sum')?.passed).toBe(false);
  });

  it('V5_voluntary_sum fails when the sum of voluntary_deduction lines drifts from the declared total', () => {
    const p = basePayslip();
    p.totals.totalVoluntaryDeductions = extracted(70_000);
    expect(find(validatePayslip(p), 'V5_voluntary_sum')?.passed).toBe(false);
  });

  it('V6_line_arithmetic passes when quantity * rate rounds to amount', () => {
    const p = basePayslip();
    p.lineItems.push(
      line({
        label: 'שעות נוספות',
        category: 'overtime',
        section: 'payment',
        quantity: 10,
        rate: 10_000,
        amount: 100_000,
      }),
    );
    p.totals.grossPay = extracted(1_100_000);
    const results = validatePayslip(p);
    const v6 = results.filter((r) => r.rule.startsWith('V6_line_arithmetic'));
    expect(v6).toHaveLength(1);
    expect(v6[0]?.passed).toBe(true);
  });

  it('V6_line_arithmetic fails when amount does not match quantity * rate', () => {
    const p = basePayslip();
    p.lineItems.push(
      line({
        label: 'שעות נוספות',
        category: 'overtime',
        section: 'payment',
        quantity: 10,
        rate: 10_000,
        amount: 50_000,
      }),
    );
    const results = validatePayslip(p);
    const v6 = results.filter((r) => r.rule.startsWith('V6_line_arithmetic'));
    expect(v6[0]?.passed).toBe(false);
  });

  it('produces no V6 result for lines without both quantity and rate', () => {
    const results = validatePayslip(basePayslip());
    expect(results.some((r) => r.rule.startsWith('V6_line_arithmetic'))).toBe(false);
  });

  it('handles an all-zero payslip without throwing, and skips V13', () => {
    const p = basePayslip();
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
    const results = validatePayslip(p);
    expect(hasBlockingFailure(results)).toBe(false);
    expect(results.some((r) => r.rule === 'V13_net_to_gross_sanity')).toBe(false);
  });
});

describe('validatePayslip — warnings and info (§6.2, §6.3)', () => {
  it('V7_ytd_monotonic warns when this month YTD drops below last month', () => {
    const previous = basePayslip();
    previous.yearToDate.grossPay = 3_000_000;
    const current = basePayslip();
    current.yearToDate.grossPay = 2_000_000;

    const results = validatePayslip(current, { previousMonth: previous });
    const v7 = find(results, 'V7_ytd_monotonic[grossPay]');
    expect(v7?.severity).toBe('warning');
    expect(v7?.passed).toBe(false);
  });

  it('V7_ytd_monotonic passes when YTD increases', () => {
    const previous = basePayslip();
    previous.yearToDate.grossPay = 2_000_000;
    const current = basePayslip();
    current.yearToDate.grossPay = 3_000_000;

    const v7 = find(validatePayslip(current, { previousMonth: previous }), 'V7_ytd_monotonic[grossPay]');
    expect(v7?.passed).toBe(true);
  });

  it('produces no V7/V8 results without a previousMonth in context', () => {
    const p = basePayslip();
    p.yearToDate.grossPay = 1_000_000;
    const results = validatePayslip(p);
    expect(results.some((r) => r.rule.startsWith('V7_'))).toBe(false);
    expect(results.some((r) => r.rule.startsWith('V8_'))).toBe(false);
  });

  it('V8_ytd_delta passes when the YTD delta matches this month amount', () => {
    const previous = basePayslip();
    previous.yearToDate.incomeTax = 300_000;
    const current = basePayslip();
    current.yearToDate.incomeTax = 450_000; // delta 150_000 == this month's income_tax line

    const v8 = find(validatePayslip(current, { previousMonth: previous }), 'V8_ytd_delta[incomeTax]');
    expect(v8?.passed).toBe(true);
  });

  it('V8_ytd_delta handles the taxableIncome field via totals.taxableIncome', () => {
    const previous = basePayslip();
    previous.yearToDate.taxableIncome = 2_000_000;
    const current = basePayslip();
    current.yearToDate.taxableIncome = 3_000_000; // delta 1,000,000 == totals.taxableIncome.value

    const v8 = find(validatePayslip(current, { previousMonth: previous }), 'V8_ytd_delta[taxableIncome]');
    expect(v8?.passed).toBe(true);
  });

  it('V8_ytd_delta skips the taxableIncome field when totals.taxableIncome was not extracted', () => {
    const previous = basePayslip();
    previous.yearToDate.taxableIncome = 2_000_000;
    const current = basePayslip();
    current.yearToDate.taxableIncome = 3_000_000;
    current.totals.taxableIncome = null;

    const results = validatePayslip(current, { previousMonth: previous });
    expect(results.some((r) => r.rule === 'V8_ytd_delta[taxableIncome]')).toBe(false);
  });

  it('V8_ytd_delta fails when the YTD delta does not match this month amount', () => {
    const previous = basePayslip();
    previous.yearToDate.incomeTax = 300_000;
    const current = basePayslip();
    current.yearToDate.incomeTax = 500_000; // delta 200_000 != 150_000

    const v8 = find(validatePayslip(current, { previousMonth: previous }), 'V8_ytd_delta[incomeTax]');
    expect(v8?.passed).toBe(false);
  });

  it('V9_balance_identity passes when opening + accrued - used == closing', () => {
    const p = basePayslip();
    p.balances = [
      { type: 'vacation', openingBalance: 10, accrued: 1.5, used: 2, closingBalance: 9.5, prov: null },
    ];
    const v9 = find(validatePayslip(p), 'V9_balance_identity[0:vacation]');
    expect(v9?.passed).toBe(true);
  });

  it('V9_balance_identity fails when the identity does not hold', () => {
    const p = basePayslip();
    p.balances = [
      { type: 'vacation', openingBalance: 10, accrued: 1, used: 2, closingBalance: 20, prov: null },
    ];
    const v9 = find(validatePayslip(p), 'V9_balance_identity[0:vacation]');
    expect(v9?.passed).toBe(false);
  });

  it('skips V9 for a balance with any null field', () => {
    const p = basePayslip();
    p.balances = [{ type: 'sick', openingBalance: null, accrued: 1, used: 0, closingBalance: 1, prov: null }];
    expect(validatePayslip(p).some((r) => r.rule.startsWith('V9_'))).toBe(false);
  });

  it('V10_employer_contrib_sum passes when the sum matches', () => {
    const results = validatePayslip(basePayslip());
    expect(find(results, 'V10_employer_contrib_sum')?.passed).toBe(true);
  });

  it('V10_employer_contrib_sum fails when the declared total drifts', () => {
    const p = basePayslip();
    p.totals.totalEmployerContributions = extracted(200_000);
    expect(find(validatePayslip(p), 'V10_employer_contrib_sum')?.passed).toBe(false);
  });

  it('skips V10 when totalEmployerContributions is null', () => {
    const p = basePayslip();
    p.totals.totalEmployerContributions = null;
    expect(validatePayslip(p).some((r) => r.rule === 'V10_employer_contrib_sum')).toBe(false);
  });

  it('V11_period_sanity fails for a year before 2000', () => {
    const p = basePayslip();
    p.meta.period.year = 1999;
    expect(find(validatePayslip(p), 'V11_period_sanity')?.passed).toBe(false);
  });

  it('V11_period_sanity fails for a period in the future when "now" is provided', () => {
    const p = basePayslip();
    p.meta.period = { year: 2027, month: 1 };
    const results = validatePayslip(p, { now: new Date('2026-03-15T00:00:00Z') });
    expect(find(results, 'V11_period_sanity')?.passed).toBe(false);
  });

  it('V11_period_sanity only checks the lower bound when "now" is not provided', () => {
    const p = basePayslip();
    p.meta.period = { year: 2099, month: 1 };
    expect(find(validatePayslip(p), 'V11_period_sanity')?.passed).toBe(true);
  });

  it('V12_confidence_floor flags a totals field below the confidence threshold', () => {
    const p = basePayslip();
    p.totals.grossPay = extracted(1_000_000, 0.4);
    const v12 = find(validatePayslip(p), 'V12_confidence_floor[grossPay]');
    expect(v12?.passed).toBe(false);
  });

  it('skips V12 for a totals field without provenance', () => {
    const p = basePayslip();
    p.totals.taxableIncome = { value: 1_000_000, prov: null };
    expect(validatePayslip(p).some((r) => r.rule === 'V12_confidence_floor[taxableIncome]')).toBe(false);
  });

  it('V13_net_to_gross_sanity flags an implausible net/gross ratio', () => {
    const p = basePayslip();
    p.totals.netPay = extracted(100_000); // ratio 0.1, below 0.5
    const v13 = find(validatePayslip(p), 'V13_net_to_gross_sanity');
    expect(v13?.severity).toBe('info');
    expect(v13?.passed).toBe(false);
  });
});
