import type { Form106, Form106FundContribution } from '@payslip-insight/schema';
import type { Money } from './derive.js';
import { sum } from './money.js';

export type Form106RetirementFund = 'pension' | 'severance' | 'studyFund' | 'disabilityInsurance' | 'other';

export type DerivedForm106Metrics = {
  totalEmployeeContributions: Money;
  totalEmployerContributions: Money;
  /** פירוט לפי סוג קרן, ממוזג אם יש כמה קופות מאותו סוג. */
  fundBreakdown: { fund: Form106RetirementFund; employee: Money; employer: Money }[];
};

const FUND_TYPE_MAP: Record<Form106FundContribution['fundType'], Form106RetirementFund> = {
  pension: 'pension',
  severance: 'severance',
  study_fund: 'studyFund',
  disability_insurance: 'disabilityInsurance',
  other: 'other',
};

/**
 * כל הנגזרות המחושבות מטופס 106. פונקציה טהורה — אין I/O, אין Date.now().
 * employee/employer הם null כשלקרן אין מבנית "חלק כזה" (למשל פיצויים
 * אין להם חלק עובד) — לא ערך חסר. מטופל כ-0 בסכימה, לא מדולג.
 */
export function deriveForm106Metrics(f: Form106): DerivedForm106Metrics {
  const totalEmployeeContributions = sum(f.fundContributions.map((fc) => fc.employee ?? 0));
  const totalEmployerContributions = sum(f.fundContributions.map((fc) => fc.employer ?? 0));

  const byFund = new Map<Form106RetirementFund, { employee: Money; employer: Money }>();
  for (const fc of f.fundContributions) {
    const key = FUND_TYPE_MAP[fc.fundType];
    const existing = byFund.get(key) ?? { employee: 0, employer: 0 };
    byFund.set(key, {
      employee: existing.employee + (fc.employee ?? 0),
      employer: existing.employer + (fc.employer ?? 0),
    });
  }

  return {
    totalEmployeeContributions,
    totalEmployerContributions,
    fundBreakdown: [...byFund.entries()].map(([fund, v]) => ({ fund, ...v })),
  };
}
