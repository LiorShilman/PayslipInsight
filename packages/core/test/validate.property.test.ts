import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Payslip as PayslipSchema } from '@payslip-insight/schema';
import { payslipArbitrary } from './helpers/synthesizePayslip.js';
import { hasBlockingFailure, validatePayslip } from '../src/validate.js';

describe('validatePayslip — property-based (§6.1 on synthetic payslips)', () => {
  it('every synthesized payslip is schema-valid and passes all blocking identities', () => {
    fc.assert(
      fc.property(payslipArbitrary(), (payslip) => {
        const parsed = PayslipSchema.safeParse(payslip);
        expect(parsed.success).toBe(true);

        const results = validatePayslip(payslip);
        const failures = results.filter((r) => r.severity === 'blocking' && !r.passed);
        expect(failures).toEqual([]);
        expect(hasBlockingFailure(results)).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });
});
