import type { PersonalInfoReport } from '@payslip-insight/schema';
import type { Money } from './derive.js';

export type DerivedPersonalInfoReportMetrics = {
  /** closingBalance − openingBalance. null אם אחד מהם לא חולץ. */
  netGrowth: Money | null;
  /** |managementFees| + |disabilityInsuranceCost| + |deathInsuranceCost| — גודל, לתצוגה בלבד. */
  totalFeesAndCosts: Money;
};

/** כל הנגזרות המחושבות מדוח מידע אישי. פונקציה טהורה — אין I/O, אין Date.now(). */
export function derivePersonalInfoReportMetrics(r: PersonalInfoReport): DerivedPersonalInfoReportMetrics {
  const { openingBalance, closingBalance, managementFees, disabilityInsuranceCost, deathInsuranceCost } = r.fundMovements;

  const netGrowth = openingBalance !== null && closingBalance !== null ? closingBalance.value - openingBalance.value : null;

  const totalFeesAndCosts =
    Math.abs(managementFees?.value ?? 0) + Math.abs(disabilityInsuranceCost?.value ?? 0) + Math.abs(deathInsuranceCost?.value ?? 0);

  return { netGrowth, totalFeesAndCosts };
}
