import { describe, expect, it } from 'vitest';
import type { Form106, Form106FundContribution } from '@payslip-insight/schema';
import { validateForm106 } from '../src/validate-form106.js';

function extracted<T>(value: T, confidence = 0.95) {
  return {
    value,
    prov: { page: 0, bbox: [0, 0, 1, 1] as [number, number, number, number], rawText: String(value), confidence },
  };
}

function fund(
  partial: Partial<Form106FundContribution> &
    Pick<Form106FundContribution, 'fundName' | 'fundType' | 'employee' | 'employer'>,
): Form106FundContribution {
  return {
    fundNumber: null,
    depositBase: null,
    prov: null,
    ...partial,
  };
}

/** טופס 106 בסיסי שבו V1 מתקיים בדיוק: 55,860 = 25,676 (פנסיה) + 30,184 (פיצויים). */
function baseForm106(): Form106 {
  return {
    schemaVersion: '1.0',
    meta: { docType: 'form_106', taxYear: 2025 },
    employee: {
      fullName: null,
      nationalIdLast4: null,
      employeeNumber: null,
      birthDate: null,
      gender: null,
      maritalStatus: null,
    },
    employer: { name: null, companyId: null, deductionsFileId: null },
    taxProfile: { creditPoints: null },
    totals: {
      taxableWages: extracted(66_024_100),
      incomeTaxWithheld: extracted(18_476_000),
      totalEmployerPensionContribution: extracted(5_586_000),
      nationalInsuranceInsuredIncome: extracted(36_551_300),
    },
    fundContributions: [
      fund({ fundName: 'אנליסט', fundType: 'pension', employee: 1_186_300, employer: 2_567_600 }),
      fund({ fundName: 'אנליסט', fundType: 'severance', employee: 0, employer: 3_018_400 }),
    ],
    lineItems: [],
    extraction: { engine: 'llm', modelId: 'test', attempts: 1, overallConfidence: 0.9, warnings: [] },
  };
}

describe('validateForm106', () => {
  it('passes V1 when the declared total matches the sum of pension+severance employer amounts', () => {
    const results = validateForm106(baseForm106());
    expect(results.find((r) => r.rule === 'V1_pension_employer_sum')?.passed).toBe(true);
  });

  it('fails V1 when the declared total does not match the fund breakdown', () => {
    const f = baseForm106();
    f.totals.totalEmployerPensionContribution = extracted(99_999_00);
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V1_pension_employer_sum')?.passed).toBe(false);
  });

  it('omits V1 when totalEmployerPensionContribution was not extracted', () => {
    const f = baseForm106();
    f.totals.totalEmployerPensionContribution = null;
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V1_pension_employer_sum')).toBeUndefined();
  });

  it('ignores non pension/severance fund types when checking V1', () => {
    const f = baseForm106();
    f.fundContributions.push(
      fund({ fundName: 'קרן השתלמות', fundType: 'study_fund', employee: 500_000, employer: 500_000 }),
    );
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V1_pension_employer_sum')?.passed).toBe(true);
  });

  it('treats a null employer (fund has no such concept) as 0 in the V1 sum, not a crash', () => {
    const f = baseForm106();
    f.fundContributions = [fund({ fundName: 'X', fundType: 'severance', employee: null, employer: null })];
    f.totals.totalEmployerPensionContribution = extracted(0);
    expect(() => validateForm106(f)).not.toThrow();
    expect(validateForm106(f).find((r) => r.rule === 'V1_pension_employer_sum')?.passed).toBe(true);
  });

  it('V2_tax_year_sanity passes for a reasonable year', () => {
    const results = validateForm106(baseForm106());
    expect(results.find((r) => r.rule === 'V2_tax_year_sanity')?.passed).toBe(true);
  });

  it('V2_tax_year_sanity fails for a year before 2000', () => {
    const f = baseForm106();
    f.meta.taxYear = 1990;
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V2_tax_year_sanity')?.passed).toBe(false);
  });

  it('V2_tax_year_sanity fails for a year in the future when now is injected', () => {
    const f = baseForm106();
    f.meta.taxYear = 2030;
    const results = validateForm106(f, { now: new Date('2026-01-01') });
    expect(results.find((r) => r.rule === 'V2_tax_year_sanity')?.passed).toBe(false);
  });

  it('V3_confidence_floor flags a low-confidence total', () => {
    const f = baseForm106();
    f.totals.taxableWages = extracted(66_024_100, 0.4);
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V3_confidence_floor[taxableWages]')?.passed).toBe(false);
  });

  it('skips V3 for totals fields that were not extracted', () => {
    const f = baseForm106();
    f.totals.incomeTaxWithheld = null;
    const results = validateForm106(f);
    expect(results.find((r) => r.rule === 'V3_confidence_floor[incomeTaxWithheld]')).toBeUndefined();
  });

  it('does not throw for an all-null Form106', () => {
    const f = baseForm106();
    f.totals = {
      taxableWages: null,
      incomeTaxWithheld: null,
      totalEmployerPensionContribution: null,
      nationalInsuranceInsuredIncome: null,
    };
    f.fundContributions = [];
    expect(() => validateForm106(f)).not.toThrow();
  });
});
