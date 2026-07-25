import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Anthropic from '@anthropic-ai/sdk';
import { config as loadDotenv } from 'dotenv';

/**
 * המפתח נטען מ-.env בשורש המונו-רפו (סביבת פיתוח מקומית בלבד). בפריסה
 * בפועל המפתח יהיה סוד בצד שרת (משתנה סביבה של הפלטפורמה) — לעולם לא
 * ב-localStorage, לעולם לא נשלח לדפדפן. משתמש קצה לא מזין מפתח משלו.
 *
 * טוענים לפי נתיב מפורש (לא `dotenv/config` הדיפולטיבי, שמסתמך על
 * process.cwd()) כי הקורא יכול להיות ה-CLI (cwd = שורש הרפו) או שרת
 * Next.js (cwd = apps/web) — שני מיקומים שונים לאותו קובץ .env אחד.
 *
 * Zero data retention: הגדרה ברמת הארגון אצל Anthropic (הסכם ארגוני),
 * לא פרמטר בקריאת ה-API. יש לוודא אותה מול הגדרות החשבון לפני production
 * (SPEC.md §12) — אין כאן שום דבר "להפעיל" בקוד.
 */
const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: join(here, '..', '..', '..', '.env') });

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic();
  }
  return client;
}
