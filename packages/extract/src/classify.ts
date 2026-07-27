import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@payslip-insight/config';
import type { NormalizedDoc } from '@payslip-insight/normalize';
import { getAnthropicClient } from './client.js';
import { stripCodeFence } from './extract.js';

const here = dirname(fileURLToPath(import.meta.url));
const CLASSIFY_SYSTEM_PROMPT = readFileSync(join(here, '..', 'prompts', 'classify.md'), 'utf-8');

export type DocClassification = {
  docType: 'payslip' | 'form_106' | 'personal_info_report' | 'unknown';
  confidence: number;
};

const KNOWN_DOC_TYPES: readonly DocClassification['docType'][] = [
  'payslip',
  'form_106',
  'personal_info_report',
];

function isKnownDocType(value: unknown): value is DocClassification['docType'] {
  return typeof value === 'string' && (KNOWN_DOC_TYPES as readonly string[]).includes(value);
}

/**
 * שלב 3 בצינור העיבוד (SPEC.md §5.3), גרסה מצומצמת: רק docType+confidence,
 * בלי payrollProvider/layoutFingerprint (fingerprint cache הוא M4, לא כאן).
 * קריאה זולה ומהירה במכוון: עמוד ראשון בלבד, מודל MODELS.classifier
 * (Haiku) — לא streaming, אין צורך לתשובה קטנה כזו.
 */
export async function classifyDocument(doc: NormalizedDoc): Promise<DocClassification> {
  const firstPage = doc.pages[0];
  if (!firstPage) return { docType: 'unknown', confidence: 0 };

  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: MODELS.classifier,
    max_tokens: 200,
    system: CLASSIFY_SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/png', data: firstPage.rasterPng.toString('base64') },
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((block): block is Anthropic.Messages.TextBlock => block.type === 'text');
  if (!textBlock) return { docType: 'unknown', confidence: 0 };

  try {
    const parsed = JSON.parse(stripCodeFence(textBlock.text)) as { docType?: unknown; confidence?: unknown };
    const docType = isKnownDocType(parsed.docType) ? parsed.docType : 'unknown';
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0;
    return { docType, confidence };
  } catch {
    return { docType: 'unknown', confidence: 0 };
  }
}
