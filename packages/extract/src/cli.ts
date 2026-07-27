import { readFileSync } from 'node:fs';
import type { ValidationResult } from '@payslip-insight/core';
import { normalizeDocument } from '@payslip-insight/normalize';
import { classifyDocument } from './classify.js';
import { extractForm106WithRetry, extractPersonalInfoReportWithRetry, extractWithRetry } from './retry.js';

function printValidation(validation: ValidationResult[], attempts: number): void {
  console.error('');
  console.error(`--- ולידציה (ניסיון ${attempts}) ---`);
  for (const r of validation) {
    const icon = r.passed ? '✓' : '✗';
    console.error(`${icon} [${r.severity}] ${r.rule}: ${r.message}`);
  }
}

function finish(validation: ValidationResult[]): void {
  const blockingFailures = validation.filter((r) => r.severity === 'blocking' && !r.passed);
  if (blockingFailures.length > 0) {
    console.error(`\nSTATUS: needs_review (${blockingFailures.length} כשלים חוסמים)`);
    process.exit(2);
  }
  console.error('\nSTATUS: ready');
}

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('שימוש: pnpm extract <קובץ>');
    process.exit(1);
  }

  const buffer = readFileSync(filePath);
  console.error('מנרמל מסמך...');
  const doc = await normalizeDocument({ buffer });
  console.error(`נורמל: ${doc.pageCount} עמודים, שכבת טקסט: ${doc.hasTextLayer ? 'יש' : 'אין'}`);

  console.error('מסווג סוג מסמך...');
  const classification = await classifyDocument(doc);
  console.error(`סווג כ-${classification.docType} (ביטחון ${classification.confidence})`);

  if (classification.docType === 'form_106') {
    console.error('מחלץ טופס 106 (קריאה ל-Claude)...');
    const { form106, validation, attempts } = await extractForm106WithRetry(doc);
    console.log(JSON.stringify(form106, null, 2));
    printValidation(validation, attempts);
    finish(validation);
    return;
  }

  if (classification.docType === 'personal_info_report') {
    console.error('מחלץ דוח מידע אישי (קריאה ל-Claude)...');
    const { report, validation, attempts } = await extractPersonalInfoReportWithRetry(doc);
    console.log(JSON.stringify(report, null, 2));
    printValidation(validation, attempts);
    finish(validation);
    return;
  }

  if (classification.docType !== 'payslip') {
    console.error(`\nSTATUS: unsupported_document_type (${classification.docType})`);
    process.exit(3);
  }

  console.error('מחלץ נתוני תלוש (קריאה ל-Claude)...');
  const { payslip, validation, attempts } = await extractWithRetry(doc);
  console.log(JSON.stringify(payslip, null, 2));
  printValidation(validation, attempts);
  finish(validation);
}

main().catch((err: unknown) => {
  console.error('שגיאה:', err instanceof Error ? err.message : err);
  process.exit(1);
});
