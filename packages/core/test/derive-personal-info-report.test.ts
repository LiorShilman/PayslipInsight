import { describe, expect, it } from 'vitest';
import type { PersonalInfoReport } from '@payslip-insight/schema';
import { derivePersonalInfoReportMetrics } from '../src/derive-personal-info-report.js';

function extracted<T>(value: T) {
  return { value, prov: null };
}

function baseReport(): PersonalInfoReport {
  return {
    schemaVersion: '1.0',
    meta: {
      docType: 'personal_info_report',
      fundKind: 'pension',
      fundCompanyName: null,
      planName: null,
      reportPeriod: { fromDate: null, toDate: null },
      reportSentDate: null,
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
    managementFeeRates: { feeFromDeposits: null, feeFromBalance: null },
    investmentTracks: [],
    deposits: [],
    advisor: null,
    extraction: { engine: 'llm', modelId: 'test', attempts: 1, overallConfidence: 0.9, warnings: [] },
  };
}

describe('derivePersonalInfoReportMetrics', () => {
  it('computes netGrowth as closingBalance minus openingBalance', () => {
    const derived = derivePersonalInfoReportMetrics(baseReport());
    expect(derived.netGrowth).toBe(8_932_1400 - 8_788_5000);
  });

  it('computes totalFeesAndCosts as the sum of absolute fee/cost magnitudes', () => {
    const derived = derivePersonalInfoReportMetrics(baseReport());
    expect(derived.totalFeesAndCosts).toBe(25_300 + 84_500 + 24_700);
  });

  it('returns null netGrowth when either balance was not extracted', () => {
    const r = baseReport();
    r.fundMovements.closingBalance = null;
    const derived = derivePersonalInfoReportMetrics(r);
    expect(derived.netGrowth).toBeNull();
  });

  it('treats missing fee/cost fields as 0 in totalFeesAndCosts, not a skip', () => {
    const r = baseReport();
    r.fundMovements.disabilityInsuranceCost = null;
    r.fundMovements.deathInsuranceCost = null;
    const derived = derivePersonalInfoReportMetrics(r);
    expect(derived.totalFeesAndCosts).toBe(25_300);
  });

  it('returns 0 totalFeesAndCosts when no fee/cost fields were extracted', () => {
    const r = baseReport();
    r.fundMovements.managementFees = null;
    r.fundMovements.disabilityInsuranceCost = null;
    r.fundMovements.deathInsuranceCost = null;
    const derived = derivePersonalInfoReportMetrics(r);
    expect(derived.totalFeesAndCosts).toBe(0);
  });
});
