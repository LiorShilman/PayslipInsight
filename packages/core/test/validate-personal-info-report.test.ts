import { describe, expect, it } from 'vitest';
import type { PersonalInfoReport, PersonalInfoReportDeposit } from '@payslip-insight/schema';
import { validatePersonalInfoReport } from '../src/validate-personal-info-report.js';

function extracted<T>(value: T, confidence = 0.95) {
  return {
    value,
    prov: { page: 0, bbox: [0, 0, 1, 1] as [number, number, number, number], rawText: String(value), confidence },
  };
}

function deposit(
  partial: Partial<PersonalInfoReportDeposit> & Pick<PersonalInfoReportDeposit, 'total'>,
): PersonalInfoReportDeposit {
  return {
    employerName: null,
    depositDate: null,
    salaryMonth: null,
    salaryAmount: null,
    employeeContribution: null,
    employerContribution: null,
    severanceContribution: null,
    prov: null,
    ...partial,
  };
}

/**
 * מספרים מאומתים ידנית מול דוח פנסיה אמיתי (מנורה מבטחים, דוח רבעוני):
 * 878,850 + 10,421 + 5,287 − 253 − 845 − 247 = 893,213, מוצהר 893,214
 * (הפרש 1 ש"ח — עיגול לשקל, ראה TOLERANCE ב-validate-personal-info-report.ts).
 */
function baseReport(): PersonalInfoReport {
  return {
    schemaVersion: '1.0',
    meta: {
      docType: 'personal_info_report',
      fundKind: 'pension',
      fundCompanyName: 'מנורה מבטחים',
      planName: 'קרן הפנסיה החדשה מנורה מבטחים פנסיה',
      reportPeriod: { fromDate: '2026-01-01', toDate: '2026-03-31' },
      reportSentDate: '2026-05-01',
    },
    participant: { fullName: null, nationalIdLast4: null },
    employer: { name: null, companyId: null, deductionsFileId: null },
    projectedBenefits: null,
    fundMovements: {
      openingBalance: extracted(8_788_5000),
      deposits: extracted(1_042_100),
      investmentGains: extracted(528_700),
      managementFees: extracted(-25_300),
      disabilityInsuranceCost: extracted(-84_500),
      deathInsuranceCost: extracted(-24_700),
      closingBalance: extracted(8_932_1400),
    },
    managementFeeRates: { feeFromDeposits: 0.0186, feeFromBalance: 0.0003 },
    investmentTracks: [{ trackName: 'מסלול מניות', returnRate: 0.0063 }],
    deposits: [
      deposit({ total: 349_100 }),
      deposit({ total: 347_800 }),
      deposit({ total: 345_200 }),
    ],
    advisor: null,
    extraction: { engine: 'llm', modelId: 'test', attempts: 1, overallConfidence: 0.9, warnings: [] },
  };
}

describe('validatePersonalInfoReport', () => {
  it('passes V1_fund_movements_identity for the real verified numbers (within shekel-rounding tolerance)', () => {
    const results = validatePersonalInfoReport(baseReport());
    expect(results.find((r) => r.rule === 'V1_fund_movements_identity')?.passed).toBe(true);
  });

  it('fails V1_fund_movements_identity when the closing balance is way off', () => {
    const r = baseReport();
    r.fundMovements.closingBalance = extracted(1);
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V1_fund_movements_identity')?.passed).toBe(false);
  });

  it('omits V1 when any fundMovements field was not extracted', () => {
    const r = baseReport();
    r.fundMovements.investmentGains = null;
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V1_fund_movements_identity')).toBeUndefined();
  });

  it('passes V2_deposits_sum when the deposit rows sum to fundMovements.deposits', () => {
    const results = validatePersonalInfoReport(baseReport());
    expect(results.find((r) => r.rule === 'V2_deposits_sum')?.passed).toBe(true);
  });

  it('fails V2_deposits_sum when the deposit rows do not sum to the declared total', () => {
    const r = baseReport();
    r.deposits = [deposit({ total: 1 })];
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V2_deposits_sum')?.passed).toBe(false);
  });

  it('omits V2 when there are no deposit rows', () => {
    const r = baseReport();
    r.deposits = [];
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V2_deposits_sum')).toBeUndefined();
  });

  it('V3_report_period_sanity passes for a reasonable period', () => {
    const results = validatePersonalInfoReport(baseReport());
    expect(results.find((r) => r.rule === 'V3_report_period_sanity')?.passed).toBe(true);
  });

  it('V3_report_period_sanity fails for a period before 2000', () => {
    const r = baseReport();
    r.meta.reportPeriod = { fromDate: '1990-01-01', toDate: '1990-03-31' };
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V3_report_period_sanity')?.passed).toBe(false);
  });

  it('V3_report_period_sanity fails for a period in the future when now is injected', () => {
    const r = baseReport();
    r.meta.reportPeriod = { fromDate: '2030-01-01', toDate: '2030-03-31' };
    const results = validatePersonalInfoReport(r, { now: new Date('2026-01-01') });
    expect(results.find((r2) => r2.rule === 'V3_report_period_sanity')?.passed).toBe(false);
  });

  it('omits V3 when reportPeriod has no dates at all', () => {
    const r = baseReport();
    r.meta.reportPeriod = { fromDate: null, toDate: null };
    const results = validatePersonalInfoReport(r);
    expect(results.find((r2) => r2.rule === 'V3_report_period_sanity')).toBeUndefined();
  });

  it('does not throw for an all-null report', () => {
    const r = baseReport();
    r.fundMovements = {
      openingBalance: null,
      deposits: null,
      investmentGains: null,
      managementFees: null,
      disabilityInsuranceCost: null,
      deathInsuranceCost: null,
      closingBalance: null,
    };
    r.deposits = [];
    r.meta.reportPeriod = { fromDate: null, toDate: null };
    expect(() => validatePersonalInfoReport(r)).not.toThrow();
  });
});
