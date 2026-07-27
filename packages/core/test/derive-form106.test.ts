import { describe, expect, it } from 'vitest';
import type { Form106, Form106FundContribution } from '@payslip-insight/schema';
import { deriveForm106Metrics } from '../src/derive-form106.js';

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

function baseForm106(fundContributions: Form106FundContribution[]): Form106 {
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
      taxableWages: null,
      incomeTaxWithheld: null,
      totalEmployerPensionContribution: null,
      nationalInsuranceInsuredIncome: null,
    },
    fundContributions,
    lineItems: [],
    extraction: { engine: 'llm', modelId: 'test', attempts: 1, overallConfidence: 0.9, warnings: [] },
  };
}

describe('deriveForm106Metrics', () => {
  it('sums employee and employer contributions across all funds', () => {
    const f = baseForm106([
      fund({ fundName: 'אנליסט', fundType: 'pension', employee: 1_186_300, employer: 2_567_600 }),
      fund({ fundName: 'אנליסט', fundType: 'severance', employee: 0, employer: 3_018_400 }),
      fund({ fundName: 'ילין לפידות', fundType: 'study_fund', employee: 500_000, employer: 500_000 }),
    ]);
    const derived = deriveForm106Metrics(f);
    expect(derived.totalEmployeeContributions).toBe(1_686_300);
    expect(derived.totalEmployerContributions).toBe(6_086_000);
  });

  it('groups fundBreakdown by fund type, merging multiple funds of the same type', () => {
    const f = baseForm106([
      fund({ fundName: 'אנליסט', fundType: 'pension', employee: 100_000, employer: 200_000 }),
      fund({ fundName: 'מבטחים החדשה', fundType: 'pension', employee: 50_000, employer: 60_000 }),
      fund({ fundName: 'ילין לפידות', fundType: 'study_fund', employee: 10_000, employer: 20_000 }),
    ]);
    const derived = deriveForm106Metrics(f);
    expect(derived.fundBreakdown).toContainEqual({ fund: 'pension', employee: 150_000, employer: 260_000 });
    expect(derived.fundBreakdown).toContainEqual({ fund: 'studyFund', employee: 10_000, employer: 20_000 });
  });

  it('returns zero totals and an empty breakdown when there are no fund contributions', () => {
    const derived = deriveForm106Metrics(baseForm106([]));
    expect(derived.totalEmployeeContributions).toBe(0);
    expect(derived.totalEmployerContributions).toBe(0);
    expect(derived.fundBreakdown).toEqual([]);
  });

  it('maps disability_insurance and other fund types correctly', () => {
    const f = baseForm106([
      fund({ fundName: 'X', fundType: 'disability_insurance', employee: 1_000, employer: 2_000 }),
      fund({ fundName: 'Y', fundType: 'other', employee: 3_000, employer: 4_000 }),
    ]);
    const derived = deriveForm106Metrics(f);
    expect(derived.fundBreakdown).toContainEqual({ fund: 'disabilityInsurance', employee: 1_000, employer: 2_000 });
    expect(derived.fundBreakdown).toContainEqual({ fund: 'other', employee: 3_000, employer: 4_000 });
  });

  it('treats a null employee/employer (fund has no such concept, e.g. severance) as 0, not a skip', () => {
    const f = baseForm106([
      fund({ fundName: 'אנליסט', fundType: 'severance', employee: null, employer: 1_509_200 }),
    ]);
    const derived = deriveForm106Metrics(f);
    expect(derived.totalEmployeeContributions).toBe(0);
    expect(derived.totalEmployerContributions).toBe(1_509_200);
    expect(derived.fundBreakdown).toContainEqual({ fund: 'severance', employee: 0, employer: 1_509_200 });
  });
});
