import { describe, expect, it } from 'vitest';
import { payslipJsonSchema } from '../src/schema-json.js';

describe('payslipJsonSchema', () => {
  it('stays stable (SPEC.md §13.2 — snapshot the derived JSON Schema)', () => {
    expect(payslipJsonSchema()).toMatchSnapshot();
  });

  it('is memoized (same object reference across calls)', () => {
    expect(payslipJsonSchema()).toBe(payslipJsonSchema());
  });
});
