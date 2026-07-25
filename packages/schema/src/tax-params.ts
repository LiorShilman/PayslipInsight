import { z } from 'zod';
import { Money } from './common.js';

/** שיעור (0–1). לדוגמה 0.12 = 12%. */
const Rate = z.number().min(0).max(1);

/**
 * פרמטרי שנת מס — packages/config/tax-params/{year}.json.
 * כלל ברזל #8: אף מספר רגולטורי לא hardcoded. ערך שלא אומת נשאר null,
 * וכל תובנה שתלויה בו מושבתת (ראה packages/config/src/tax-params.ts).
 */
export const TaxParams = z.object({
  year: z.number().int(),
  source: z.string(),
  /** ISO date של אימות מול המקור הרשמי, או "TODO" אם טרם אומת. */
  lastVerified: z.string(),

  creditPointMonthlyValue: Money.nullable(),
  incomeTaxBrackets: z.array(
    z.object({
      /** תקרת ההכנסה החודשית למדרגה, באגורות. null = אין תקרה (המדרגה העליונה). */
      upToMonthly: Money.nullable(),
      rate: Rate,
    }),
  ),
  surtaxThresholdAnnual: Money.nullable(),

  nationalInsurance: z.object({
    employeeReducedRate: Rate.nullable(),
    employeeFullRate: Rate.nullable(),
    employerReducedRate: Rate.nullable(),
    employerFullRate: Rate.nullable(),
    reducedRateCeilingMonthly: Money.nullable(),
    maxIncomeCeilingMonthly: Money.nullable(),
  }),

  healthTax: z.object({
    reducedRate: Rate.nullable(),
    fullRate: Rate.nullable(),
  }),

  mandatoryPension: z.object({
    employeeMin: Rate.nullable(),
    employerMin: Rate.nullable(),
    severanceMin: Rate.nullable(),
  }),

  studyFundCeilingMonthly: Money.nullable(),
});
export type TaxParams = z.infer<typeof TaxParams>;
