# CLAUDE.md

מסמך ההנחיות לעבודה ברפו הזה. `SPEC.md` הוא מסמך המקור המלא — קרא אותו לפני כל משימה משמעותית.

## מה בונים
מערכת שמקבלת תלוש שכר ישראלי, מחלצת אותו לסכימה מובנית באמצעות AI, מאמתת אריתמטית, ומציגה ניתוח ויזואלי אינטראקטיבי.

## חוקי ברזל

1. **ה-LLM מחלץ, הקוד מחשב.** אין לבקש מהמודל חישוב, סכימה, אחוז או השוואה. הוא מעתיק מספרים גולמיים בלבד.
2. **אין רינדור שנוצר ע"י AI.** ה-LLM לא מייצר JSX, HTML או SVG. לעולם.
3. **כסף = integer באגורות.** אף פעם לא `float`. כל אריתמטיקה עוברת דרך `packages/core/src/money.ts`.
4. **`packages/core` טהור.** אפס I/O, אפס תלויות מלבד Zod, אפס `Date.now()` (זמן מוזרק כפרמטר).
5. **הסכימה היא מקור האמת.** שינוי מבנה נתונים מתחיל תמיד ב-`packages/schema`, ומשם מתפשט. אין טיפוסים מקבילים.
6. **אין `any`.** `strict: true` + `noUncheckedIndexedAccess: true`. `as` רק ב-type guards מתועדים.
7. **RTL-first.** `ms-*`/`me-*`/`ps-*`/`pe-*` בלבד. `ml-*`/`mr-*`/`pl-*`/`pr-*` אסורים ב-lint.
8. **אף מספר רגולטורי לא ב-hardcode.** מדרגות מס, נקודות זיכוי, תקרות → `packages/config/tax-params/{year}.json`. ערך שלא אומת נשאר `null` והתובנה התלויה בו מושבתת. אין ניחוש.
9. **אין PII בלוגים.** לא תוכן מסמך, לא סכומים, לא שמות, לא ת.ז. לוגים = מזהים, טיימינגים, קודי שגיאה.
10. **אין תלושים אמיתיים ברפו.** כל ה-fixtures מסונתזים ע"י `scripts/generate-fixtures.ts`.

## סדר עבודה

- טסט לפני מימוש לכל דבר ב-`packages/core`.
- שינוי בסכימה → הרץ `pnpm gen:jsonschema` והתאם את הפרומפטים ב-`packages/extract/prompts/`.
- שינוי בפרומפט חילוץ → הרץ את ה-golden set (`pnpm test:extract`) ודווח על שינוי בדיוק.
- לפני commit: `pnpm typecheck && pnpm lint && pnpm test`.

## פקודות

```bash
pnpm dev                 # שרת פיתוח
pnpm test                # יוניט (מהיר)
pnpm test:extract        # golden set — איטי, דורש מפתח API
pnpm test:e2e            # Playwright
pnpm typecheck
pnpm lint
pnpm gen:fixtures        # יצירת תלושים מסונתזים
pnpm gen:jsonschema      # Zod → JSON Schema לחוזה החילוץ
pnpm extract <file>      # CLI לבדיקת חילוץ בודד
```

## מפת הרפו

| נתיב | תפקיד |
|------|-------|
| `packages/schema` | סכימות Zod — מקור האמת |
| `packages/core` | ולידציה, נגזרות, מנוע חריגות. טהור |
| `packages/normalize` | PDF/תמונה → `NormalizedDoc` עם קואורדינטות |
| `packages/extract` | סיווג, חילוץ LLM, template parsers, retry |
| `packages/config` | מזהי מודלים, פרמטרי שנת מס |
| `apps/web` | Next.js — UI ו-API routes |
| `fixtures/` | תלושים מסונתזים בלבד |

## מלכודות ידועות

- **זקיפת שווי** (רכב/טלפון) מופיעה גם בתשלומים וגם בניכויים. אם זהות `gross − deductions = net` נכשלת — בדוק קודם שזוג השווי חולץ במלואו.
- **שכבת טקסט RTL ב-PDF** חוזרת לעיתים הפוכה או מפוצלת. אל תנסה לתקן ידנית; ה-Vision הוא מקור האמת כשיש סתירה.
- **תלושים מוגנים בסיסמה** נפוצים מאוד. טפל ב-`PASSWORD_REQUIRED` כמסלול רגיל, לא כשגיאה.
- **ניכויים נשמרים כמספרים חיוביים.** הכיוון נקבע ע"י `section`. היוצא מן הכלל היחיד: `tax_credit_refund`.
- **`label` נשמר בדיוק כפי שהופיע בתלוש**, כולל קיצורים ושגיאות כתיב. `category` היא שכבת הנרמול מעליו.
- **שורה שלא ניתן לסווג לעולם לא מושמטת** — `other_payment` / `other_deduction` + warning.

## ניסוח בממשק

- המערכת אינה נותנת ייעוץ מס. כל ממצא מנוסח כהצעה לבדיקה ("שווה לבדוק מול מחלקת השכר"), לעולם לא כקביעה ("המעסיק טעה").
- `needs_review` אינו מצב שגיאה. מציגים את מה שחולץ, מסמנים מה לא ודאי, ומאפשרים תיקון.
- שגיאות מסבירות מה קרה ומה לעשות. לא מתנצלות, לא מעורפלות.

## מה לא לעשות בלי לשאול

- להוסיף תלות ל-`packages/core`.
- לשנות את `schemaVersion`.
- למלא ערך ב-`tax-params` בלי מקור מאומת.
- להוסיף persistence של PII.
- להוסיף ספריית UI או צ'ארטים נוספת.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
