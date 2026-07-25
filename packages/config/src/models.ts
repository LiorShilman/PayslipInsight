/**
 * מזהי מודלים ל-LLM — המקום היחיד ברפו שמכיל אותם (SPEC.md §5.1).
 * מאומת מול ה-API בפועל (GET /v1/models) לפני שנכנס לכאן.
 *
 * הערות חשובות שסוטות מהניסוח המילולי ב-SPEC.md §5.2, כי ה-API השתנה:
 * - **אין לשלוח `temperature`.** על claude-sonnet-5 ומעלה הפרמטר נדחה (400)
 *   כשהוא לא ברירת המחדל. הדטרמיניזם מושג ע"י structured output
 *   (`output_config.format`), לא ע"י temperature.
 * - **Zero data retention היא הגדרה ברמת הארגון** אצל Anthropic (חוזה
 *   ארגוני), לא פרמטר שנשלח בקריאה. אין בקוד הזה מה "להפעיל" — התיעוד כאן
 *   הוא כדי לא לשכוח לוודא זאת מול הגדרות החשבון לפני production (SPEC.md §12).
 */
export const MODELS = {
  /** חילוץ Vision + structured output — האיזון בין דיוק לעלות (SPEC.md §15). */
  extraction: 'claude-sonnet-5',
  /** סיווג מסמך זול/מהיר (M4+, לא בשימוש בגרסה המצומצמת הנוכחית). */
  classifier: 'claude-haiku-4-5',
  /** verification pass ממוקד וזול (M4+, לא בשימוש בגרסה המצומצמת הנוכחית). */
  verification: 'claude-haiku-4-5',
} as const;
