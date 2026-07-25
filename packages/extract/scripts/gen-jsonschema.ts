import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { payslipJsonSchema } from '../src/schema-json.js';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'generated', 'payslip.schema.json');

writeFileSync(outPath, JSON.stringify(payslipJsonSchema(), null, 2) + '\n', 'utf-8');
console.log(`נכתב: ${outPath}`);
