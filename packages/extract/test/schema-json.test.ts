import { describe, expect, it } from 'vitest';
import { form106JsonSchema, payslipJsonSchema, personalInfoReportJsonSchema } from '../src/schema-json.js';

describe('payslipJsonSchema', () => {
  it('stays stable (SPEC.md §13.2 — snapshot the derived JSON Schema)', () => {
    expect(payslipJsonSchema()).toMatchSnapshot();
  });

  it('is memoized (same object reference across calls)', () => {
    expect(payslipJsonSchema()).toBe(payslipJsonSchema());
  });
});

describe('form106JsonSchema', () => {
  it('stays stable (SPEC.md §13.2 — snapshot the derived JSON Schema)', () => {
    expect(form106JsonSchema()).toMatchSnapshot();
  });

  it('is memoized (same object reference across calls)', () => {
    expect(form106JsonSchema()).toBe(form106JsonSchema());
  });
});

describe('personalInfoReportJsonSchema', () => {
  it('stays stable (SPEC.md §13.2 — snapshot the derived JSON Schema)', () => {
    expect(personalInfoReportJsonSchema()).toMatchSnapshot();
  });

  it('is memoized (same object reference across calls)', () => {
    expect(personalInfoReportJsonSchema()).toBe(personalInfoReportJsonSchema());
  });
});
