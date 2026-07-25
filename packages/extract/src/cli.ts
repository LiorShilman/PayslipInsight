import { readFileSync } from 'node:fs';
import { normalizeDocument } from '@payslip-insight/normalize';
import { extractWithRetry } from './retry.js';

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

  console.error('מחלץ נתונים (קריאה ל-Claude)...');
  const { payslip, validation, attempts } = await extractWithRetry(doc);

  console.log(JSON.stringify(payslip, null, 2));

  console.error('');
  console.error(`--- ולידציה (ניסיון ${attempts}) ---`);
  for (const r of validation) {
    const icon = r.passed ? '✓' : '✗';
    console.error(`${icon} [${r.severity}] ${r.rule}: ${r.message}`);
  }

  const blockingFailures = validation.filter((r) => r.severity === 'blocking' && !r.passed);
  if (blockingFailures.length > 0) {
    console.error(`\nSTATUS: needs_review (${blockingFailures.length} כשלים חוסמים)`);
    process.exit(2);
  }
  console.error('\nSTATUS: ready');
}

main().catch((err: unknown) => {
  console.error('שגיאה:', err instanceof Error ? err.message : err);
  process.exit(1);
});
