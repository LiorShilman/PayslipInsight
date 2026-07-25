import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Anthropic from '@anthropic-ai/sdk';
import { MODELS } from '@payslip-insight/config';
import type { NormalizedDoc } from '@payslip-insight/normalize';
import { Payslip, type Payslip as PayslipType } from '@payslip-insight/schema';
import { getAnthropicClient } from './client.js';
import { payslipJsonSchema } from './schema-json.js';

const here = dirname(fileURLToPath(import.meta.url));
const SYSTEM_PROMPT_BASE = readFileSync(join(here, '..', 'prompts', 'extract-payslip.md'), 'utf-8');

// ראה schema-json.ts: הסכימה מוטמעת כטקסט בפרומפט ולא נשלחת כ-output_config.format
// (constrained decoding נכשל על "compiled grammar too large" עבור סכימה בעושר הזה).
const SYSTEM_PROMPT = `${SYSTEM_PROMPT_BASE}

החזר אך ורק אובייקט JSON יחיד שתואם בדיוק ל-JSON Schema הבא. אל תחזיר טקסט
נוסף, הסבר, או code fence (\`\`\`) — רק ה-JSON עצמו.

JSON Schema:
${JSON.stringify(payslipJsonSchema())}`;

function buildTextHint(doc: NormalizedDoc): string {
  if (!doc.hasTextLayer) {
    return 'אין שכבת טקסט (מסמך סרוק) — הסתמך רק על התמונות.';
  }
  return doc.pages
    .map((page) => (page.textLayer ?? []).map((span) => span.text).join(' '))
    .join('\n--- עמוד הבא ---\n');
}

/**
 * מסיר עטיפת ```json ... ``` אם המודל בכל זאת הוסיף code fence, למרות ההוראה
 * שלא. סובלני לפתיחה בלי סגירה (תלושים גדולים/דו-עמודיים עלולים לחתוך את
 * התשובה לפני שה-fence הסוגר מגיע — ראה בדיקת stop_reason למטה).
 */
function stripCodeFence(text: string): string {
  let result = text.trim();
  result = result.replace(/^```(?:json)?\s*/, '');
  result = result.replace(/\s*```$/, '');
  return result.trim();
}

export type ExtractOptions = {
  /** הוראות נוספות שמוזרקות לפרומפט (למשל שגיאות ולידציה מניסיון קודם — §5.5). */
  extraInstructions?: string;
  /** נקרא עם התווית (label) של כל שורה ברגע שה-JSON שלה הושלם בסטרים — התקדמות אמיתית, לא מדומה. */
  onLabel?: (label: string) => void;
};

/**
 * סורק את ה-snapshot המצטבר של הסטרים אחרי כל delta ומחלץ את כל ה-"label"
 * שכבר הושלמו (מחרוזת סגורה במרכאות). ה-JSON נבנה שמאל-לימין ותוסף בלבד,
 * אז אפשר להשוות לכמות שכבר דווחה ולשלוח רק את החדשים — בלי parser JSON
 * חלקי מלא.
 */
function extractNewLabels(snapshot: string, alreadyReported: number): { labels: string[]; total: number } {
  const matches = [...snapshot.matchAll(/"label"\s*:\s*"((?:\\.|[^"\\])*)"/g)];
  const newOnes = matches.slice(alreadyReported).map((m) => {
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return m[1] ?? '';
    }
  });
  return { labels: newOnes, total: matches.length };
}

/**
 * שלב 4 בצינור העיבוד (SPEC.md §5): שולח את תמונות העמודים + רמז טקסטואלי
 * ל-Claude, מקבל בחזרה Payslip תקין מול הסכימה. אין `temperature` — הפרמטר
 * נדחה על claude-sonnet-5 ומעלה; הדטרמיניזם מגיע מהוראה מפורשת + ולידציה.
 */
export async function extractPayslip(doc: NormalizedDoc, opts: ExtractOptions = {}): Promise<PayslipType> {
  const client = getAnthropicClient();

  const imageBlocks: Anthropic.Messages.ImageBlockParam[] = doc.pages.map((page) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: page.rasterPng.toString('base64'),
    },
  }));

  const textBlocks: Anthropic.Messages.TextBlockParam[] = [
    { type: 'text', text: `רמז טקסטואלי מהמסמך (לא מקור אמת אם יש סתירה עם התמונה):\n${buildTextHint(doc)}` },
  ];
  if (opts.extraInstructions) {
    textBlocks.push({ type: 'text', text: opts.extraInstructions });
  }

  // מסמכים אמיתיים (כמה עמודים, הרבה שורות, provenance מלא לכל שדה) יכולים
  // להניב JSON גדול בהרבה מהפיקסצ'ר הסינתטי — max_tokens נדיב + streaming
  // (נדרש מעל ~16K כדי לא להיתקע על timeout של ה-SDK).
  const stream = client.messages.stream({
    model: MODELS.extraction,
    max_tokens: 32000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: [...imageBlocks, ...textBlocks],
      },
    ],
  });

  if (opts.onLabel) {
    let reportedCount = 0;
    stream.on('text', (_delta, snapshot) => {
      const { labels, total } = extractNewLabels(snapshot, reportedCount);
      reportedCount = total;
      for (const label of labels) opts.onLabel!(label);
    });
  }

  const response = await stream.finalMessage();

  if (response.stop_reason === 'max_tokens') {
    throw new Error('חילוץ נכשל: התשובה נחתכה (stop_reason=max_tokens) — יש להגדיל max_tokens.');
  }

  const textBlock = response.content.find((block): block is Anthropic.Messages.TextBlock => block.type === 'text');
  if (!textBlock) {
    throw new Error(`חילוץ נכשל: אין תוכן טקסט בתשובה (stop_reason=${response.stop_reason})`);
  }

  const rawJson: unknown = JSON.parse(stripCodeFence(textBlock.text));
  return Payslip.parse(rawJson);
}
