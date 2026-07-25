import type { DerivedMetrics, ValidationResult } from '@payslip-insight/core';
import type { Payslip } from '@payslip-insight/schema';

export type DocumentPage = {
  index: number;
  width: number;
  height: number;
  /** PNG בקידוד base64 (בלי data: prefix). */
  png: string;
};

export type ExtractionResult = {
  payslip: Payslip;
  derived: DerivedMetrics;
  validation: ValidationResult[];
  attempts: number;
  pages: DocumentPage[];
};

export type ApiError = {
  error: { code: string; messageHe: string; retryable: boolean };
};
