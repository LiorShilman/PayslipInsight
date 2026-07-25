import fc from 'fast-check';
import type { LineItem, Payslip } from '@payslip-insight/schema';
import { multiplyRound, sum } from '../../src/money.js';

/**
 * fast-check arbitrary שמייצר תלושים (`Payslip`) תקינים אריתמטית: כל
 * שדות ה-`totals` נגזרים בפועל מסכימת `lineItems` שנוצרו, כך שזהויות
 * §6.1 מתקיימות תמיד "מבנייה". זהו מחולל דאטה בלבד — לא מייצר PDF.
 * ה-script המלא שמייצר PDF (M1, §13.1) ישתמש בבסיס דומה.
 */

function agorotRange(minILS: number, maxILS: number) {
  return fc.integer({ min: minILS * 100, max: maxILS * 100 });
}

function extracted<T>(value: T) {
  return { value, prov: null };
}

const OPTIONAL_PAYMENTS: ReadonlyArray<{ label: string; category: LineItem['category']; range: [number, number] }> = [
  { label: 'בונוס', category: 'bonus', range: [0, 8000] },
  { label: 'נסיעות', category: 'travel_allowance', range: [0, 800] },
  { label: 'תוספת ותק', category: 'seniority_increment', range: [0, 1500] },
  { label: 'דמי הבראה', category: 'recuperation_pay', range: [0, 2000] },
  { label: 'החזר הוצאות', category: 'expense_reimbursement', range: [0, 1200] },
];

const OPTIONAL_VOLUNTARY_DEDUCTIONS: ReadonlyArray<{ label: string; category: LineItem['category']; range: [number, number] }> = [
  { label: 'תגמולי עובד לפנסיה', category: 'pension_employee', range: [200, 2500] },
  { label: 'קרן השתלמות עובד', category: 'study_fund_employee', range: [100, 1200] },
  { label: 'ועד עובדים', category: 'union_dues', range: [0, 150] },
];

const OPTIONAL_EMPLOYER_CONTRIBUTIONS: ReadonlyArray<{ label: string; category: LineItem['category']; range: [number, number] }> = [
  { label: 'תגמולי מעסיק', category: 'pension_employer', range: [200, 2500] },
  { label: 'פיצויים', category: 'severance_employer', range: [200, 2500] },
  { label: 'קה"ל מעסיק', category: 'study_fund_employer', range: [100, 1200] },
];

function optionalLineArb(
  spec: { label: string; category: LineItem['category']; range: [number, number] },
  section: LineItem['section'],
) {
  return fc.option(agorotRange(spec.range[0], spec.range[1]), { nil: undefined }).map((amount):
    | LineItem
    | undefined => {
    if (amount === undefined) return undefined;
    return {
      label: spec.label,
      code: null,
      category: spec.category,
      section,
      quantity: null,
      quantityUnit: null,
      rate: null,
      amount,
      yearToDate: null,
      taxable: null,
      prov: null,
    };
  });
}

const overtimeArb = fc.record({
  include: fc.boolean(),
  hours: fc.integer({ min: 1, max: 40 }),
  rate: agorotRange(40, 120),
});

const benefitInKindArb = fc.record({
  include: fc.boolean(),
  amount: agorotRange(200, 3000),
});

export function payslipArbitrary(): fc.Arbitrary<Payslip> {
  return fc.record({
    baseSalary: agorotRange(5000, 30000),
    overtime: overtimeArb,
    benefitInKind: benefitInKindArb,
    optionalPayments: fc.tuple(...OPTIONAL_PAYMENTS.map((s) => optionalLineArb(s, 'payment'))),
    incomeTax: agorotRange(500, 8000),
    nationalInsurance: agorotRange(100, 3000),
    healthTax: agorotRange(50, 1500),
    optionalVoluntary: fc.tuple(
      ...OPTIONAL_VOLUNTARY_DEDUCTIONS.map((s) => optionalLineArb(s, 'voluntary_deduction')),
    ),
    optionalEmployerContrib: fc.tuple(
      ...OPTIONAL_EMPLOYER_CONTRIBUTIONS.map((s) => optionalLineArb(s, 'employer_contribution')),
    ),
    year: fc.integer({ min: 2015, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
  }).map((draw): Payslip => {
    const lineItems: LineItem[] = [
      {
        label: 'שכר יסוד',
        code: null,
        category: 'base_salary',
        section: 'payment',
        quantity: null,
        quantityUnit: null,
        rate: null,
        amount: draw.baseSalary,
        yearToDate: null,
        taxable: true,
        prov: null,
      },
    ];

    if (draw.overtime.include) {
      lineItems.push({
        label: 'שעות נוספות 125%',
        code: null,
        category: 'overtime',
        section: 'payment',
        quantity: draw.overtime.hours,
        quantityUnit: 'hours',
        rate: draw.overtime.rate,
        amount: multiplyRound(draw.overtime.hours, draw.overtime.rate),
        yearToDate: null,
        taxable: true,
        prov: null,
      });
    }

    let benefitInKindPaymentAmount = 0;
    if (draw.benefitInKind.include) {
      benefitInKindPaymentAmount = draw.benefitInKind.amount;
      lineItems.push({
        label: 'שווי רכב',
        code: null,
        category: 'benefit_in_kind',
        section: 'payment',
        quantity: null,
        quantityUnit: null,
        rate: null,
        amount: draw.benefitInKind.amount,
        yearToDate: null,
        taxable: true,
        prov: null,
      });
    }

    for (const li of draw.optionalPayments) {
      if (li) lineItems.push(li);
    }

    lineItems.push({
      label: 'מס הכנסה',
      code: null,
      category: 'income_tax',
      section: 'mandatory_deduction',
      quantity: null,
      quantityUnit: null,
      rate: null,
      amount: draw.incomeTax,
      yearToDate: null,
      taxable: null,
      prov: null,
    });
    lineItems.push({
      label: 'ביטוח לאומי',
      code: null,
      category: 'national_insurance',
      section: 'mandatory_deduction',
      quantity: null,
      quantityUnit: null,
      rate: null,
      amount: draw.nationalInsurance,
      yearToDate: null,
      taxable: null,
      prov: null,
    });
    lineItems.push({
      label: 'מס בריאות',
      code: null,
      category: 'health_tax',
      section: 'mandatory_deduction',
      quantity: null,
      quantityUnit: null,
      rate: null,
      amount: draw.healthTax,
      yearToDate: null,
      taxable: null,
      prov: null,
    });

    if (draw.benefitInKind.include) {
      lineItems.push({
        label: 'ניכוי שווי רכב',
        code: null,
        category: 'benefit_in_kind',
        section: 'mandatory_deduction',
        quantity: null,
        quantityUnit: null,
        rate: null,
        amount: benefitInKindPaymentAmount,
        yearToDate: null,
        taxable: null,
        prov: null,
      });
    }

    for (const li of draw.optionalVoluntary) {
      if (li) lineItems.push(li);
    }
    for (const li of draw.optionalEmployerContrib) {
      if (li) lineItems.push(li);
    }

    const sumBySection = (section: LineItem['section']) =>
      sum(lineItems.filter((li) => li.section === section).map((li) => li.amount));

    const grossPay = sumBySection('payment');
    const totalMandatoryDeductions = sumBySection('mandatory_deduction');
    const totalVoluntaryDeductions = sumBySection('voluntary_deduction');
    const totalDeductions = totalMandatoryDeductions + totalVoluntaryDeductions;
    const netPay = grossPay - totalDeductions;
    const employerContribSum = sumBySection('employer_contribution');

    const payslip: Payslip = {
      schemaVersion: '1.0',
      meta: {
        docType: 'payslip',
        payrollProvider: 'synthetic',
        period: { year: draw.year, month: draw.month },
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
        grossPay: extracted(grossPay),
        taxableIncome: extracted(grossPay),
        niBase: extracted(grossPay),
        pensionBase: extracted(grossPay),
        totalMandatoryDeductions: extracted(totalMandatoryDeductions),
        totalVoluntaryDeductions: extracted(totalVoluntaryDeductions),
        totalDeductions: extracted(totalDeductions),
        netPay: extracted(netPay),
        totalEmployerContributions: employerContribSum > 0 ? extracted(employerContribSum) : null,
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
      extraction: {
        engine: 'llm',
        modelId: 'synthetic',
        attempts: 1,
        overallConfidence: 0.9,
        warnings: [],
      },
    };

    return payslip;
  });
}
