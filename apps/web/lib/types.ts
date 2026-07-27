import type {
  DerivedForm106Metrics,
  DerivedMetrics,
  DerivedPersonalInfoReportMetrics,
  ValidationResult,
} from '@payslip-insight/core';
import type { Form106, Payslip, PersonalInfoReport } from '@payslip-insight/schema';

export type DocumentPage = {
  index: number;
  width: number;
  height: number;
  /** PNG בקידוד base64 (בלי data: prefix). */
  png: string;
};

export type PayslipExtractionResult = {
  docType: 'payslip';
  payslip: Payslip;
  derived: DerivedMetrics;
  validation: ValidationResult[];
  attempts: number;
  pages: DocumentPage[];
};

export type Form106ExtractionResult = {
  docType: 'form_106';
  form106: Form106;
  derived: DerivedForm106Metrics;
  validation: ValidationResult[];
  attempts: number;
  pages: DocumentPage[];
};

export type PersonalInfoReportExtractionResult = {
  docType: 'personal_info_report';
  report: PersonalInfoReport;
  derived: DerivedPersonalInfoReportMetrics;
  validation: ValidationResult[];
  attempts: number;
  pages: DocumentPage[];
};

/** discriminated union לפי docType — ראה app/dashboard/page.tsx לניתוב. */
export type ExtractionResult = PayslipExtractionResult | Form106ExtractionResult | PersonalInfoReportExtractionResult;

export type ApiError = {
  error: { code: string; messageHe: string; retryable: boolean };
};
