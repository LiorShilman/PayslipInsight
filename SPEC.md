# אפיון מוצר וטכני — Payslip Insight

> מערכת שמקבלת תלוש שכר ישראלי (ומסמכים פיננסיים נוספים), מחלצת ממנו נתונים מובנים באמצעות AI, מאמתת אותם אריתמטית, ומציגה אותם כניתוח ויזואלי אינטראקטיבי.

**סטטוס:** אפיון v1.0
**קהל היעד של המסמך:** Claude Code — זהו מסמך המקור לפיתוח. כל החלטה שאינה מופיעה כאן היא החלטה פתוחה שיש להעלות לפני מימוש.

---

## 0. עקרונות מנחים (Non-negotiables)

אלה חוקי ברזל. כל מימוש שסותר אותם — שגוי.

| # | עיקרון | משמעות מעשית |
|---|--------|---------------|
| P1 | **ה-LLM מחלץ, הקוד מחשב** | המודל מחזיר מספרים גולמיים כפי שהם מופיעים במסמך. כל סכימה, אחוז, יחס או השוואה מחושבים ב-TypeScript. אסור לבקש מהמודל "כמה אחוז זה מהברוטו". |
| P2 | **ולידציה אריתמטית היא שער איכות חוסם** | תלוש שלא עובר את זהויות האימות (§6) לא מוצג כ"תקין". הוא עובר retry, ואז מסומן `needs_review`. |
| P3 | **אין רינדור שנוצר ע"י AI** | ה-UI הוא קומפוננטות React דטרמיניסטיות שמונעות מהסכימה. ה-LLM כותב רק טקסט הסבר (§8.3), לעולם לא JSX/HTML/SVG. |
| P4 | **Provenance לכל שדה** | לכל ערך מחולץ נשמר מיקום במסמך המקור (עמוד + bounding box) + רמת ביטחון. שדה בלי provenance נחשב לא-אמין. |
| P5 | **Privacy by default** | אין persistence של המסמך המקורי או של PII ללא opt-in מפורש. עיבוד אפמרלי. ראה §12. |
| P6 | **RTL הוא ברירת המחדל** | כל ה-UI נבנה RTL-first עם logical properties. LTR הוא המקרה החריג. |
| P7 | **פרמטרי מס הם דאטה, לא קוד** | ערכי נקודת זיכוי, מדרגות מס, תקרות ב"ל — בקבצי קונפיגורציה לפי שנת מס. אף מספר רגולטורי לא hardcoded בלוגיקה. |

---

## 1. מטרה והיקף

### 1.1 בעיית הליבה
עובד ישראלי ממוצע לא מבין את התלוש שלו. הוא מכיר מספר אחד — הנטו. כתוצאה מכך:
- הוא לא יודע מה העלות האמיתית שלו למעסיק ומה שווי התגמול הכולל.
- הוא לא מזהה טעויות הפרשה (פנסיה, פיצויים, קה"ל) שנמשכות חודשים.
- הוא לא יודע שמגיע לו החזר מס.

### 1.2 הצעת הערך
> "העלה תלוש. תוך 20 שניות תראה בדיוק לאן הלך כל שקל, מה המעסיק שילם מעליך, ומה נראה חריג."

### 1.3 בהיקף (v1)
- העלאת תלוש בודד (PDF דיגיטלי, PDF סרוק, JPG/PNG).
- חילוץ לסכימה קנונית + ולידציה.
- דשבורד ויזואלי אינטראקטיבי עם provenance.
- העלאת מספר תלושים → ניתוח מגמות וזיהוי חריגות.
- הצלבת טופס 106 מול סכום התלושים.

### 1.4 מחוץ להיקף (v1) — לתעד, לא לממש
- ייעוץ מס אישי או המלצות פעולה מחייבות.
- הגשת בקשת החזר מס בפועל מול רשות המסים.
- אינטגרציה ישירה עם מערכות שכר (חילן/מלם/מיכפל API).
- אפליקציית מובייל נייטיב.
- מסמכים שאינם שכר (§10) — האדריכלות מוכנה להם, המימוש לא.

### 1.5 הצהרת אחריות (חובה ב-UI)
המערכת היא כלי הבנה ולא ייעוץ מס, ייעוץ פנסיוני או ייעוץ משפטי. כל "חריגה" שמזוהה היא **דגל לבדיקה**, לא קביעה. הניסוח ב-UI תמיד: "שווה לבדוק מול מחלקת השכר" ולא "המעסיק טעה".

---

## 2. Personas ו-User Stories

**P1 — "שכיר סקרן" (עיקרי).** גיל 25–45, הייטק/שירותים, לא מבין תלוש.
**P2 — "מחליף עבודה".** משווה הצעה חדשה מול תלוש נוכחי; רוצה לדעת עלות מעביד.
**P3 — "החשדן".** חושד שההפרשות שלו לא נכונות; מעלה 12 תלושים.

| ID | User Story | קריטריון קבלה |
|----|-----------|----------------|
| US-01 | כמשתמש, אני מעלה PDF של תלוש ורואה פירוק גרפי | מ-upload עד דשבורד ≤ 25 שניות ב-p90 |
| US-02 | אני לוחץ על מספר בגרף ורואה איפה הוא מופיע בתלוש המקורי | הדגשת bbox על תצוגת המסמך |
| US-03 | אני רואה כמה אני "עולה" למעסיק לעומת מה שנכנס לחשבון | כרטיס Total Compensation |
| US-04 | אני מעלה 12 תלושים ורואה מה השתנה לאורך השנה | טבלת מגמות + זיהוי סטיות |
| US-05 | אני מקבל התראה כשאחוז הפרשה סטה מהחודש הקודם | דגל `contribution_rate_drift` |
| US-06 | אני מעלה 106 ומוודא שהוא תואם לתלושים | דוח הצלבה עם דלתא לכל שדה |
| US-07 | אני מוחק את הנתונים שלי לחלוטין | מחיקה מיידית + אישור ויזואלי |

---

## 3. ארכיטקטורה — צינור העיבוד

```
┌──────────┐   ┌───────────┐   ┌────────────┐   ┌────────────┐   ┌──────────┐   ┌─────────┐
│ 1 Ingest │──▶│ 2 Normalize│──▶│ 3 Classify │──▶│ 4 Extract  │──▶│5 Validate│──▶│6 Derive │
└──────────┘   └───────────┘   └────────────┘   └────────────┘   └──────────┘   └─────────┘
                                                       ▲                │              │
                                                       │  retry ≤2      │ fail         ▼
                                                       └────────────────┘         ┌─────────┐
                                                                                  │7 Insight│
                                                                                  └────┬────┘
                                                                                       ▼
                                                                                  ┌─────────┐
                                                                                  │8 Render │
                                                                                  └─────────┘
```

### שלב 1 — Ingest
- קלט: `File` (PDF / PNG / JPG / HEIC). מקסימום 10MB, עד 5 עמודים.
- בדיקות: magic bytes (לא לסמוך על סיומת), סריקת גודל, דחיית PDF מוצפן ב-owner password.
- PDF מוגן בסיסמת פתיחה → בקשת סיסמה מהמשתמש (נפוץ מאוד בתלושים! לרוב הסיסמה היא ת.ז.).

### שלב 2 — Normalize
```ts
type NormalizedDoc = {
  pageCount: number;
  pages: Array<{
    index: number;
    width: number; height: number;      // points
    textLayer: TextSpan[] | null;        // null אם סרוק
    rasterPng: Buffer;                   // 200 DPI תמיד, גם אם יש טקסט
  }>;
  hasTextLayer: boolean;
};
```
- חילוץ שכבת טקסט: `pdfjs-dist` (שומר על קואורדינטות לכל span — קריטי ל-provenance).
- רסטור תמיד, גם כשיש טקסט: המודל ה-Vision רואה מבנה טבלאי שטקסט גולמי מאבד.
- **טיפול RTL:** שכבת טקסט עברית ב-PDF חוזרת לעיתים הפוכה או מפוצלת. אין לנסות "לתקן" ידנית — לנרמל ל-NFC, לשמור כמו שהוא, ולתת ל-Vision להיות מקור האמת כשיש סתירה.

### שלב 3 — Classify
זיהוי סוג מסמך + ספק שכר, בקריאת LLM זולה אחת (או cache hit).
```ts
type DocClassification = {
  docType: 'payslip' | 'form_106' | 'form_161' | 'pension_clearinghouse' | 'unknown';
  payrollProvider: 'hilan' | 'malam' | 'michpal' | 'oketz' | 'harmony' | 'other' | 'unknown';
  layoutFingerprint: string;   // sha256 של מבנה עוגנים מנורמל
  confidence: number;
};
```

**Layout Fingerprint Cache — אופטימיזציה מרכזית.**
- ה-fingerprint מחושב מ: רשימת התוויות הקבועות בעמוד (טקסט לא-מספרי), מנורמלת ומסודרת, + מיקומן היחסי בגריד 20×20.
- אם ה-fingerprint מוכר → שליפת template parser דטרמיניסטי מה-DB, פרסינג ללא LLM, ואז §5.4 (verification pass) בלבד.
- אם לא מוכר → חילוץ מלא ב-LLM, ואם הולידציה עברה נקי → **הפקת template אוטומטית** ושמירה.
- יעד: ≥70% מההעלאות אחרי חודש ראשון נפתרות ללא חילוץ מלא.

### שלב 4 — Extract
ראה §5.

### שלב 5 — Validate
ראה §6.

### שלב 6 — Derive
כל החישובים. פונקציות טהורות, ללא I/O, כיסוי טסטים 100%. ראה §7.

### שלב 7 — Insight
מנוע חוקים דטרמיניסטי מייצר `Finding[]`; ה-LLM רק מנסח אותם בעברית. ראה §7.3.

### שלב 8 — Render
ראה §8.

---

## 4. הסכימה הקנונית

זהו החוזה המרכזי של המערכת. כל ספק שכר ממופה אליו. נמצא ב-`packages/schema/src/payslip.ts`, מוגדר ב-Zod, וממנו נגזר ה-JSON Schema לחילוץ.

### 4.1 טיפוסי יסוד

```ts
import { z } from 'zod';

/** ערך כספי. תמיד באגורות (integer) כדי למנוע שגיאות float. */
export const Money = z.number().int().describe('amount in agorot (1/100 ILS)');

/** מקור הערך במסמך — חובה לכל שדה מחולץ. */
export const Provenance = z.object({
  page: z.number().int().min(0),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]), // x0,y0,x1,y1 normalized 0-1
  rawText: z.string(),          // הטקסט כפי שהופיע במקור, ללא עיבוד
  confidence: z.number().min(0).max(1),
});

/** עוטף כל ערך מחולץ. */
export const Extracted = <T extends z.ZodTypeAny>(inner: T) =>
  z.object({ value: inner, prov: Provenance.nullable() });
```

### 4.2 שורת רכיב

```ts
export const LineItemCategory = z.enum([
  // תשלומים
  'base_salary',          // שכר יסוד
  'overtime',             // שעות נוספות (125/150/175/200)
  'global_overtime',      // ש"נ גלובליות
  'bonus',                // בונוס / מענק
  'commission',           // עמלות
  'travel_allowance',     // נסיעות
  'recuperation_pay',     // דמי הבראה
  'clothing_allowance',   // ביגוד
  'sick_pay',             // דמי מחלה
  'vacation_pay',         // פדיון/דמי חופשה
  'holiday_gift',         // שי לחג
  'seniority_increment',  // תוספת ותק
  'shift_differential',   // תוספת משמרות
  'standby_pay',          // כוננות
  'meal_allowance',       // ארוחות
  'retro_adjustment',     // רטרו
  'expense_reimbursement',// החזר הוצאות (לא חייב מס)
  'benefit_in_kind',      // שווי (רכב/טלפון/ארוחות) — זקיפה
  'other_payment',

  // ניכויי חובה
  'income_tax',           // מס הכנסה
  'national_insurance',   // ביטוח לאומי — חלק עובד
  'health_tax',           // מס בריאות
  'tax_credit_refund',    // החזר מס (ערך שלילי בניכויים)

  // ניכויי רשות
  'pension_employee',     // תגמולי עובד לפנסיה
  'study_fund_employee',  // קרן השתלמות — עובד
  'manager_insurance_employee',
  'disability_insurance', // אובדן כושר עבודה
  'union_dues',           // ועד עובדים / דמי חבר
  'loan_repayment',       // החזר הלוואה
  'garnishment',          // עיקול
  'charity',              // תרומות (סעיף 46)
  'other_deduction',

  // הפרשות מעסיק
  'pension_employer',           // תגמולי מעסיק
  'severance_employer',         // פיצויים
  'study_fund_employer',        // קה"ל מעסיק
  'national_insurance_employer',
  'manager_insurance_employer',
  'other_employer_contribution',
]);

export const LineItem = z.object({
  /** התווית המדויקת כפי שהופיעה בתלוש. לעולם לא מתורגמת. */
  label: z.string(),
  /** קוד הרכיב אם הופיע בתלוש (עמודת "קוד"). */
  code: z.string().nullable(),
  category: LineItemCategory,
  section: z.enum(['payment', 'mandatory_deduction', 'voluntary_deduction', 'employer_contribution']),
  /** כמות — שעות, ימים, יחידות. null אם לא רלוונטי. */
  quantity: z.number().nullable(),
  quantityUnit: z.enum(['hours', 'days', 'units', 'percent']).nullable(),
  rate: Money.nullable(),          // תעריף ליחידה
  amount: Money,                   // הסכום לחודש הנוכחי
  yearToDate: Money.nullable(),    // מצטבר מתחילת שנה
  /** האם הרכיב חייב במס הכנסה, ב"ל, ופנסיה — כפי שמסומן בתלוש אם מסומן. */
  taxable: z.boolean().nullable(),
  prov: Provenance.nullable(),
});
```

### 4.3 המסמך המלא

```ts
export const Payslip = z.object({
  schemaVersion: z.literal('1.0'),

  meta: z.object({
    docType: z.literal('payslip'),
    payrollProvider: z.string(),
    period: z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }),
    payDate: z.string().nullable(),          // ISO date
    currency: z.literal('ILS'),
  }),

  employee: z.object({
    fullName: Extracted(z.string()).nullable(),
    /** מאוחסן תמיד מוסתר: 4 ספרות אחרונות בלבד. ראה §12. */
    nationalIdLast4: z.string().length(4).nullable(),
    employeeNumber: z.string().nullable(),
    department: z.string().nullable(),
    jobTitle: z.string().nullable(),
    startDate: z.string().nullable(),         // ISO
    seniorityMonths: z.number().int().nullable(),
    employmentScope: z.number().nullable(),   // אחוז משרה 0-100
    /** דירוג/דרגה אם קיים */
    grade: z.string().nullable(),
  }),

  employer: z.object({
    name: z.string().nullable(),
    companyId: z.string().nullable(),         // ח.פ.
    deductionsFileId: z.string().nullable(),  // מספר תיק ניכויים
  }),

  taxProfile: z.object({
    creditPoints: z.number().nullable(),      // נקודות זיכוי
    maritalStatus: z.string().nullable(),
    taxCoordination: z.boolean().nullable(),  // תיאום מס
    additionalIncome: z.boolean().nullable(), // הכנסה נוספת
    residentOfDevelopmentArea: z.boolean().nullable(), // יישוב מוטב
  }),

  /** כל השורות. סדר = סדר ההופעה בתלוש. */
  lineItems: z.array(LineItem),

  totals: z.object({
    grossPay: Extracted(Money),               // ברוטו
    taxableIncome: Extracted(Money).nullable(),// ברוטו למס
    niBase: Extracted(Money).nullable(),      // ברוטו לביטוח לאומי
    pensionBase: Extracted(Money).nullable(), // ברוטו לפנסיה
    totalMandatoryDeductions: Extracted(Money),
    totalVoluntaryDeductions: Extracted(Money),
    totalDeductions: Extracted(Money),
    netPay: Extracted(Money),                 // נטו לתשלום
    totalEmployerContributions: Extracted(Money).nullable(),
  }),

  yearToDate: z.object({
    grossPay: Money.nullable(),
    taxableIncome: Money.nullable(),
    incomeTax: Money.nullable(),
    nationalInsurance: Money.nullable(),
    healthTax: Money.nullable(),
    pensionEmployee: Money.nullable(),
    pensionEmployer: Money.nullable(),
    severance: Money.nullable(),
    studyFundEmployee: Money.nullable(),
    studyFundEmployer: Money.nullable(),
  }),

  /** צבירות: חופשה, מחלה, הבראה */
  balances: z.array(z.object({
    type: z.enum(['vacation', 'sick', 'recuperation']),
    openingBalance: z.number().nullable(),    // יתרה קודמת (ימים)
    accrued: z.number().nullable(),           // צבירה החודש
    used: z.number().nullable(),              // ניצול
    closingBalance: z.number().nullable(),    // יתרה לסוף חודש
    prov: Provenance.nullable(),
  })),

  attendance: z.object({
    workDaysInMonth: z.number().nullable(),   // ימי עבודה בחודש
    actualWorkDays: z.number().nullable(),
    standardHours: z.number().nullable(),     // תקן שעות
    actualHours: z.number().nullable(),
    absenceDays: z.number().nullable(),
  }).nullable(),

  payment: z.object({
    method: z.enum(['bank_transfer', 'check', 'cash', 'unknown']),
    bankName: z.string().nullable(),
    accountLast4: z.string().nullable(),      // 4 ספרות בלבד
  }).nullable(),

  extraction: z.object({
    engine: z.enum(['template', 'llm', 'template+llm']),
    modelId: z.string().nullable(),
    attempts: z.number().int(),
    overallConfidence: z.number().min(0).max(1),
    warnings: z.array(z.string()),
  }),
});

export type Payslip = z.infer<typeof Payslip>;
```

### 4.4 כללי מיפוי מחייבים
1. **`label` נשמר תמיד כלשונו.** אם בתלוש כתוב "תוס' ותק" — זה מה שנשמר. ה-`category` הוא השכבה המנורמלת מעליו.
2. **ערכים שליליים:** ניכויים נשמרים כערכים **חיוביים** ב-`amount`. השדה `section` קובע את הכיוון. יוצא דופן: החזר מס בתוך הניכויים נשמר כשלילי עם `category: 'tax_credit_refund'`.
3. **`benefit_in_kind` (שווי):** מופיע בתשלומים אבל **לא** נכנס לנטו — הוא מנופח בברוטו ומנוכה חזרה. חובה לזהות את זוג השורות (זקיפה + ניכוי שווי) ולסמן ב-`taxable: true`.
4. **שורה שלא ניתן לסווג** → `other_payment` / `other_deduction` + warning. **לעולם לא להשמיט שורה.**

---

## 5. שלב החילוץ

### 5.1 בחירת מודל
- **Primary:** מודל Vision עם structured output. הקלט = תמונות העמודים ב-200 DPI + שכבת הטקסט כ-hint נפרד.
- **Classifier:** מודל קטן/מהיר.
- מזהי המודלים נשמרים ב-`config/models.ts` בלבד — ללא hardcode בלוגיקה. **לפני מימוש: לוודא מזהי מודלים עדכניים מול התיעוד הרשמי.**

### 5.2 חוזה החילוץ
- שימוש ב-structured output עם ה-JSON Schema שנגזר מ-Zod (`zod-to-json-schema`).
- `temperature: 0`.
- קלט מפוצל: כל עמוד כתמונה נפרדת + בלוק טקסט משלים.

### 5.3 System prompt — טיוטת בסיס (`prompts/extract-payslip.md`)

```
אתה מנוע חילוץ נתונים מתלושי שכר ישראליים. אתה מחזיר JSON בלבד לפי הסכימה.

חוקים מוחלטים:
1. אתה מעתיק מספרים. אתה לא מחשב, לא מסכם, ולא מתקן. אם התלוש מציג
   סכום שנראה שגוי — העתק אותו כמו שהוא.
2. כל סכום מוחזר באגורות כמספר שלם. 12,345.67 ש"ח → 1234567.
3. שדה שלא מופיע במסמך → null. לעולם אל תנחש ואל תשלים ערך סביר.
4. כל שורה בטבלאות התשלומים והניכויים חייבת להופיע בפלט, גם אם
   לא הצלחת לסווג אותה. סיווג לא ודאי → other_payment/other_deduction.
5. השדה label מועתק בדיוק כפי שמופיע, כולל קיצורים ושגיאות כתיב.
6. לכל ערך ספק bbox מנורמל (0-1) של המיקום שממנו לקחת אותו,
   ואת rawText — המחרוזת המקורית לפני נרמול.
7. confidence משקף כמה ברור היה הערך במסמך: 1.0 = טקסט חד וברור,
   0.5 = סרוק/מטושטש אך קריא, <0.3 = ניחוש מבוסס הקשר.

הערות דומיין:
- טבלת התלוש היא RTL. עמודות טיפוסיות מימין לשמאל:
  קוד | תיאור | כמות | תעריף | סכום | מצטבר.
- "שווי" (רכב/טלפון/ארוחות) מופיע בתשלומים וגם כניכוי מקביל. החזר את שניהם.
- "מצטבר" / "מ.ת.ש" / "מתחילת שנה" → yearToDate.
- ניכויים מוחזרים כמספרים חיוביים.
```

### 5.4 Verification pass
לאחר חילוץ (או לאחר template parse), קריאה שנייה **ממוקדת** שמקבלת רק את ה-totals ואת תמונת העמוד ושואלת: "האם המספרים הבאים תואמים למה שמופיע בתמונה? החזר תיקונים בלבד." זול, ותופס טעויות ספרה בודדת שהולידציה לא תופסת (למשל כשגם הברוטו וגם הניכוי הועתקו שגוי באופן עקבי).

### 5.5 מדיניות Retry
| ניסיון | פעולה |
|--------|-------|
| 1 | חילוץ סטנדרטי |
| 2 (אם ולידציה נכשלה) | חילוץ חוזר עם הזרקת שגיאות הולידציה לפרומפט + DPI 300 |
| 3 | חילוץ per-section: הרצה נפרדת לטבלת תשלומים, טבלת ניכויים, סיכומים |
| כישלון | `status: 'needs_review'` + הצגת מה שיש עם סימון ברור + אפשרות תיקון ידני |

תיקון ידני של משתמש נשמר כ-`userCorrections` ומזין את מנגנון ה-template.

---

## 6. שכבת הולידציה

`packages/core/src/validate.ts`. כל חוק מחזיר `ValidationResult`.

```ts
type Severity = 'blocking' | 'warning' | 'info';
type ValidationResult = {
  rule: string;
  severity: Severity;
  passed: boolean;
  expected?: number; actual?: number; deltaAgorot?: number;
  message: string;
};
```

**סבילות:** ±2 אגורות לכל חוק בודד (עיגולים), ±5 אגורות לזהויות מצטברות.

### 6.1 זהויות חוסמות (blocking)

| כלל | נוסחה |
|-----|-------|
| `V1_gross_equals_payments` | `Σ(lineItems where section='payment') == totals.grossPay` |
| `V2_deductions_sum` | `totals.totalMandatoryDeductions + totals.totalVoluntaryDeductions == totals.totalDeductions` |
| `V3_net_identity` | `totals.grossPay − totals.totalDeductions == totals.netPay` |
| `V4_mandatory_sum` | `Σ(section='mandatory_deduction') == totals.totalMandatoryDeductions` |
| `V5_voluntary_sum` | `Σ(section='voluntary_deduction') == totals.totalVoluntaryDeductions` |
| `V6_line_arithmetic` | לכל שורה עם quantity ו-rate: `round(quantity × rate) == amount` |

> **הערה קריטית ל-V3:** כשקיימת "זקיפת שווי", הזהות לא נסגרת בלי טיפול נכון בזוג שווי↔ניכוי שווי. אם V3 נכשל ויש `benefit_in_kind`, לבדוק שהניכוי המקביל חולץ לפני שמכריזים על כישלון.

### 6.2 אזהרות (warning)

| כלל | תיאור |
|-----|-------|
| `V7_ytd_monotonic` | YTD של החודש הנוכחי ≥ YTD של החודש הקודם (בהעלאה מרובה) |
| `V8_ytd_delta` | `ytd[m] − ytd[m−1] ≈ amount[m]` |
| `V9_balance_identity` | `openingBalance + accrued − used == closingBalance` לכל צבירה |
| `V10_employer_contrib_sum` | `Σ(section='employer_contribution') == totals.totalEmployerContributions` |
| `V11_period_sanity` | תקופה ≤ החודש הנוכחי, ו-≥ 2000 |
| `V12_confidence_floor` | אף שדה ב-`totals` לא מתחת ל-`confidence 0.6` |

### 6.3 בדיקות סבירות (info — לא כישלון חילוץ)
`V13`: נטו/ברוטו מחוץ לטווח 0.5–1.0 → דגל.
`V14`: יחס הפרשה שחורג מטווח סטטוטורי מוכר → דגל ל-§7.3, **לא** שגיאת חילוץ.

---

## 7. שכבת הנגזרות והתובנות

### 7.1 פרמטרי שנת מס — `config/tax-params/{year}.json`

```jsonc
{
  "year": 2026,
  "source": "https://www.gov.il/he/departments/israel_tax_authority",
  "lastVerified": "TODO",
  "creditPointMonthlyValue": null,   // ₪ — TODO: לאמת מול רשות המסים
  "incomeTaxBrackets": [],           // [{ upToMonthly, rate }] — TODO
  "surtaxThresholdAnnual": null,     // מס יסף — TODO
  "nationalInsurance": {
    "employeeReducedRate": null, "employeeFullRate": null,
    "employerReducedRate": null, "employerFullRate": null,
    "reducedRateCeilingMonthly": null, "maxIncomeCeilingMonthly": null
  },
  "healthTax": { "reducedRate": null, "fullRate": null },
  "mandatoryPension": {
    "employeeMin": null, "employerMin": null, "severanceMin": null
  },
  "studyFundCeilingMonthly": null
}
```

> **חובה:** אף ערך לא מסומן `lastVerified` ≠ `TODO` לא נכנס לפרודקשן. כל התובנות שתלויות בפרמטרים אלה מושבתות כל עוד הערכים `null` — המערכת פועלת במלואה בלעדיהן, פשוט מציגה פחות תובנות. **אין ברירת מחדל מנוחשת.**

### 7.2 נגזרות (`packages/core/src/derive.ts` — פונקציות טהורות)

```ts
export function deriveMetrics(p: Payslip, params: TaxParams | null): DerivedMetrics;

type DerivedMetrics = {
  employerTotalCost: Money;          // gross + Σ employer_contribution
  takeHomeRatio: number;             // net / gross
  totalCompensation: Money;          // gross + employer contributions (ללא החזרי הוצאות)
  effectiveTaxRate: number;          // (incomeTax) / taxableIncome
  effectiveTotalDeductionRate: number;
  contributionRates: {               // מחושב, לא מחולץ
    pensionEmployee: number | null;  // amount / pensionBase
    pensionEmployer: number | null;
    severance: number | null;
    studyFundEmployee: number | null;
    studyFundEmployer: number | null;
  };
  benefitInKindTotal: Money;         // "מס נסתר"
  costOfNextShekel: number | null;   // שיעור מס שולי — דורש params
  creditPointsSavings: Money | null; // דורש params
  waterfall: WaterfallStep[];        // מוכן ישירות לרינדור
  payDistribution: { fixed: Money; variable: Money; reimbursement: Money; benefitInKind: Money };
};
```

### 7.3 מנוע החריגות — `packages/core/src/findings.ts`

**דטרמיניסטי לחלוטין.** ה-LLM לא מזהה חריגות, רק מנסח אותן.

```ts
type Finding = {
  id: string;
  code: FindingCode;
  severity: 'info' | 'attention' | 'high';
  /** נדרש כדי להציג — findings בלי ראיה לא מוצגים */
  evidence: { field: string; value: number; comparedTo?: number; period?: string }[];
  /** טקסט נוצר ע"י LLM מתוך ה-evidence, ניתן לתרגום */
  narrative?: string;
};
```

| FindingCode | תנאי הפעלה | חומרה |
|-------------|------------|-------|
| `contribution_rate_drift` | שיעור הפרשה סטה ב->0.25 נק' אחוז מהחודש הקודם | attention |
| `contribution_below_statutory` | שיעור הפרשה < מינימום חוקי (דורש params) | high |
| `severance_missing` | ותק > 6 חודשים ואין `severance_employer` | high |
| `study_fund_over_ceiling` | הפרשה מעל תקרת הפטור (דורש params) | attention |
| `no_pension_contribution` | ותק > 6 חודשים ואין `pension_employer` | high |
| `unusual_deduction` | ניכוי רשות שלא הופיע בשום חודש קודם | attention |
| `net_drop_significant` | נטו ירד >15% מול ממוצע 3 חודשים, ללא ירידה מקבילה בברוטו | attention |
| `travel_allowance_missing` | היה נסיעות בעבר, החודש 0 | info |
| `credit_points_changed` | נקודות זיכוי השתנו | info |
| `possible_tax_refund` | עודף מס מצטבר מול YTD (דורש params) | info |
| `benefit_in_kind_high` | שווי > 10% מהברוטו | info |
| `recuperation_not_paid` | ותק > 12 חודשים, ולא שולמה הבראה ב-12 החודשים האחרונים | attention |

**ניסוח ה-narrative:** קריאת LLM אחת לכל הממצאים יחד. הפרומפט מקבל **רק** את ה-`evidence` — לא את התלוש. חוק: אסור לו להוסיף מספר שלא נמצא ב-evidence, ואסור לו לנסח קביעה ("המעסיק הפריש בחסר") אלא הצעה לבדיקה. ולידציה על הפלט: כל מספר בטקסט חייב להופיע ב-evidence, אחרת ה-narrative נזרק ומוצג טקסט תבניתי סטטי.

---

## 8. שכבת התצוגה

### 8.1 עקרונות
- RTL-first. Tailwind logical properties (`ms-*`, `me-*`, `ps-*`, `pe-*`) — **אסור** `ml-*`/`mr-*`.
- מספרים: `Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' })`. תמיד להציג ספרות `dir="ltr"` בתוך טקסט RTL כדי למנוע היפוך.
- כל ויזואליזציה שמציגה מספר מחולץ חייבת לתמוך ב-provenance click.
- נגישות: כל צ'ארט מלווה בטבלת נתונים נגישה (`<table>` מוסתרת חזותית או ב-`<details>`). ניווט מקלדת מלא. `prefers-reduced-motion` מכובד.
- אין הסתמכות על צבע בלבד להעברת מידע (חיובי/שלילי) — תמיד גם סימן או אייקון.

### 8.2 מלאי הקומפוננטות

| קומפוננטה | תיאור | מקור נתונים |
|-----------|-------|--------------|
| `GrossToNetWaterfall` | ברוטו → ניכויים → נטו. הגרף הראשי. | `derived.waterfall` |
| `EmployerCostCard` | עלות מעביד מול נטו, עם פירוק ההפרשות | `derived.employerTotalCost` |
| `TaxBracketLadder` | מדרגות מס עם סימון מיקום ו"עלות השקל הבא" | `derived` + params |
| `CreditPointsPanel` | נקודות זיכוי והחיסכון מהן | `taxProfile` + params |
| `BalancesGauges` | חופשה/מחלה/הבראה — מדי-מד + מגמה | `balances` |
| `BenefitInKindCallout` | שווי ניתן למס — "המס הנסתר" | `derived.benefitInKindTotal` |
| `PayCompositionChart` | קבוע / משתנה / החזרים / שווי | `derived.payDistribution` |
| `LineItemsTable` | טבלה מלאה, מסוננת לפי section, עם provenance | `lineItems` |
| `DocumentViewer` | תצוגת המסמך המקורי עם הדגשת bbox | `NormalizedDoc` + `Provenance` |
| `FindingsList` | ממצאים ממוינים לפי חומרה | `Finding[]` |
| `TrendTimeline` | מגמות רב-חודשיות (v1.2) | `Payslip[]` |
| `Form106Reconciliation` | הצלבת 106 מול תלושים (v1.3) | `Form106` + `Payslip[]` |
| `ConfidenceBadge` | דגל על שדה בביטחון נמוך | `Provenance.confidence` |

### 8.3 טקסט מ-LLM ב-UI — מותר רק כאן
1. `Finding.narrative` (§7.3).
2. "מה זה?" — הסבר קצר לכל רכיב שכר, **נשלף מקטלוג סטטי** ולא נוצר בזמן אמת. הקטלוג נבנה מראש ונבדק ידנית.

### 8.4 מצבים
לכל מסך חובה: `idle` / `uploading` / `processing` (עם שלבים גלויים: "קורא את המסמך" → "מחלץ נתונים" → "מאמת") / `ready` / `needs_review` / `error`.
`needs_review` **אינו** מצב שגיאה — מציג את מה שיש, מסמן שדות לא ודאיים, ומאפשר עריכה ידנית.

### 8.5 כיוון עיצובי
לפני כתיבת קוד UI — לגבש תוכנית עיצוב קצרה: פלטה של 4–6 צבעים בשמות, זוג טיפוגרפי (display + body) עם תמיכה עברית מלאה, קונספט פריסה, ואלמנט חתימה אחד. להימנע מברירות המחדל הגנריות (רקע קרם עם סריף + אקסנט טרהקוטה; שחור עם אקסנט ניאון; פריסת ברודשיט). הנושא — מסמך רשמי, טבלאי, ביורוקרטי — הוא מקור טוב לשפה ויזואלית ייחודית. **האלמנט החתימתי המוצע:** המעבר מהתלוש הגולמי לתצוגה המפורקת כרגע אחד מתוזמן.

---

## 9. חוזי API

כל ה-endpoints תחת `/api`. אימות: session cookie (v1: אנונימי, session-scoped).

```
POST   /api/documents                 multipart → { docId, status }
GET    /api/documents/:id             → { status, progress?, error? }
GET    /api/documents/:id/result      → { payslip, derived, findings, validation }
GET    /api/documents/:id/page/:n     → PNG (rasterized, ephemeral)
POST   /api/documents/:id/corrections → { path, value } → recompute
DELETE /api/documents/:id             → 204 (hard delete)
POST   /api/analysis/multi            { docIds[] } → { trends, findings }
POST   /api/analysis/reconcile-106    { form106Id, payslipIds[] } → { deltas[] }
DELETE /api/session                   → 204 (מוחק הכל)
```

**סטטוסים:** `queued | normalizing | extracting | validating | ready | needs_review | failed`
**עדכוני התקדמות:** SSE על `GET /api/documents/:id/stream`.
**שגיאות:** `{ error: { code, messageHe, messageEn, retryable } }`. קודים: `FILE_TOO_LARGE`, `UNSUPPORTED_FORMAT`, `PASSWORD_REQUIRED`, `WRONG_PASSWORD`, `NOT_A_PAYSLIP`, `EXTRACTION_FAILED`, `RATE_LIMITED`.

---

## 10. הרחבה למסמכים נוספים

הארכיטקטורה גנרית. הוספת סוג מסמך = סכימה + פרומפט + חוקי ולידציה + קומפוננטות. הליבה לא משתנה.

| מסמך | עדיפות | הערה |
|------|--------|------|
| טופס 106 | v1.3 | הצלבה מול 12 תלושים — ערך גבוה, מאמץ נמוך |
| דוח מסלקה פנסיונית | v2 | **מגיע כ-XML מובנה** — אין צורך ב-LLM לחילוץ. הערך הגבוה ביותר בהרחבות |
| טופס 161 | v2 | עזיבת עבודה, פיצויים |
| דוח שנתי 1301 | v2 | |
| טופס 101 | v2 | |
| פוליסות ביטוח | v3 | זיהוי כיסויים כפולים |
| דוח נתוני אשראי | v3 | |
| חשבונות תשתית | v3 | חשמל/ארנונה/מים |

---

## 11. סטאק ומבנה הרפו

### 11.1 סטאק
- **Next.js** (App Router) + **TypeScript strict** (`noUncheckedIndexedAccess: true`)
- **Tailwind** + **shadcn/ui**, RTL-first
- **Zod** לסכימות, `zod-to-json-schema` לחוזה החילוץ
- **pdfjs-dist** לחילוץ טקסט וקואורדינטות; **pdfium/sharp** לרסטור
- **D3 / visx** ל-waterfall ו-Sankey (Recharts לא נותן שליטה מספקת ב-waterfall)
- **Vitest** ליוניט, **Playwright** ל-E2E
- **pnpm workspaces**

### 11.2 מבנה

```
.
├── CLAUDE.md
├── SPEC.md
├── apps/web/
│   ├── app/
│   │   ├── (upload)/            # מסך העלאה
│   │   ├── d/[docId]/           # דשבורד
│   │   └── api/
│   └── components/
│       ├── charts/              # GrossToNetWaterfall, ...
│       ├── viewer/              # DocumentViewer + bbox overlay
│       └── ui/                  # shadcn
├── packages/
│   ├── schema/                  # Zod — מקור האמת
│   │   └── src/{payslip,form106,common}.ts
│   ├── core/                    # לוגיקה טהורה, אפס I/O
│   │   └── src/{validate,derive,findings,money,fingerprint}.ts
│   ├── extract/                 # LLM + template parsers
│   │   ├── src/{classify,llm,template,verify,retry}.ts
│   │   └── prompts/*.md
│   ├── normalize/               # PDF → NormalizedDoc
│   └── config/                  # models.ts, tax-params/{year}.json
├── fixtures/                    # תלושים מסונתזים בלבד — ראה §13
└── e2e/
```

### 11.3 כללי קוד
- `packages/core` — **אפס** תלויות חיצוניות מלבד Zod. אפס I/O. אפס `Date.now()` (זמן מוזרק).
- כסף = `number` שלם באגורות. **אסור float לכסף.** `packages/core/src/money.ts` עוטף את כל האריתמטיקה.
- אין `any`. אין `as` מלבד type guards מתועדים.
- כל פונקציה ב-`core` — טסט לפני מימוש.

---

## 12. פרטיות ואבטחה

זהו **פיצ'ר המוצר המרכזי**, לא נספח. תלוש מכיל ת.ז., שכר, פרטי בנק וכתובת.

| כלל | מימוש |
|-----|-------|
| ברירת מחדל: אין persistence | קובץ מקור ב-memory/tmp בלבד, נמחק מיד בסיום העיבוד |
| ת.ז. לעולם לא נשמרת במלואה | חילוץ → מיסוך מיידי ל-4 ספרות אחרונות → הערך המלא לא עובר את גבול `extract` |
| שמות ופרטי בנק | לא נשמרים אלא ב-session ובהצפנה, נמחקים עם ה-session |
| לוגים | **אסור** לוג של תוכן מסמך, ערכים כספיים או PII. לוגים = מזהים, טיימינגים, קודי שגיאה בלבד |
| טלמטריה | אירועים אגרגטיביים בלבד. אף ערך מהמסמך לא יוצא לטלמטריה |
| שמירה מרצון | opt-in מפורש בלבד, למגמות רב-חודשיות. הצפנה במנוחה. מחיקה בלחיצה |
| TTL | כל אובייקט session נמחק אוטומטית תוך 24 שעות ללא יוצא מן הכלל |
| ספק ה-LLM | לוודא הגדרת zero-retention בקריאות. לתעד את ההגדרה בקוד |
| Rate limiting | לפי IP + session, למניעת שימוש כ-OCR חינמי |

**חובה ב-UI:** מסך ההעלאה מציג בבירור, לפני הבחירה בקובץ, מה קורה לנתונים ומתי הם נמחקים. ניסוח בגוף פעיל, ללא ז'רגון משפטי.

---

## 13. טסטים ו-fixtures

### 13.1 חוק ה-fixtures — קריטי
**אסור לשמור תלושים אמיתיים ברפו.** כל ה-fixtures הם מסמכים מסונתזים שנוצרים ע"י `scripts/generate-fixtures.ts` — מחולל שבונה PDF תלוש עם נתונים אקראיים אך אריתמטית עקביים, בכמה לייאאוטים שונים המדמים ספקי שכר שונים.

### 13.2 שכבות
| שכבה | כלי | כיסוי נדרש |
|------|-----|-------------|
| Unit — `core` | Vitest | 100% על validate/derive/findings/money |
| Property-based | fast-check | הזהויות ב-§6.1 מתקיימות על תלושים מסונתזים אקראיים |
| חוזה חילוץ | Vitest + snapshots | ה-JSON Schema הנגזר מ-Zod יציב |
| חילוץ (golden set) | Vitest, מסומן `@slow` | ≥30 fixtures. יעד: דיוק שדה ≥98% על totals, ≥95% על line items |
| E2E | Playwright | upload→dashboard, provenance click, correction, delete, RTL, keyboard |
| ויזואלי | Playwright screenshots | כל צ'ארט, מצבי ריק/שגיאה |
| a11y | axe-core | אפס violations ברמת serious/critical |

### 13.3 מקרי קצה שחייבים fixture ייעודי
תלוש עם שווי רכב · תלוש עם רטרו שלילי · תלוש עם החזר מס בניכויים · תלוש דו-עמודי · תלוש סרוק ומוטה 2° · תלוש עם סיסמה · תלוש חלקי (חודש ראשון/אחרון בעבודה) · תלוש עם תיאום מס · תלוש במשרה חלקית · תלוש עם עיקול · מסמך שאינו תלוש כלל.

---

## 14. אבני דרך

### M0 — יסודות
`packages/schema` מלא · `packages/core` (money, validate, derive) עם 100% טסטים · מחולל fixtures.
**קבלה:** `pnpm test` ירוק; חוקי §6.1 עוברים על 1000 תלושים מסונתזים אקראיים.

### M1 — צינור העיבוד
Normalize (טקסט + רסטור + provenance) · Classify · Extract עם structured output · Retry.
**קבלה:** CLI `pnpm extract <file>` מחזיר `Payslip` תקין על ≥28/30 fixtures.

### M2 — דשבורד הליבה
Waterfall · EmployerCostCard · LineItemsTable · DocumentViewer עם provenance · מצבי טעינה.
**קבלה:** US-01, US-02, US-03 עוברים ב-E2E. RTL תקין. axe נקי.

### M3 — תובנות
מנוע החריגות · ולידציית narrative · FindingsList · תיקון ידני.
**קבלה:** כל FindingCode מכוסה בטסט. narrative עם מספר שלא ב-evidence — נחסם.

### M4 — Fingerprint cache
זיהוי לייאאוט · הפקת template אוטומטית · verification pass.
**קבלה:** העלאה שנייה של אותו לייאאוט — ללא חילוץ LLM מלא, ≥3× מהיר.

### M5 — רב-חודשי
העלאה מרובה · TrendTimeline · חריגות חוצות-תקופות.
**קבלה:** US-04, US-05.

### M6 — טופס 106
סכימה · חילוץ · דוח הצלבה.
**קבלה:** US-06 — דלתא מדויקת לכל שדה מול סכום 12 תלושים.

---

## 15. תקציבי ביצועים ועלות

| מדד | יעד |
|-----|-----|
| Upload → ready (עמוד יחיד, דיגיטלי) | p50 ≤ 12s, p90 ≤ 25s |
| Upload → ready (template cache hit) | p90 ≤ 5s |
| עלות LLM לתלוש (חילוץ מלא) | ≤ $0.05 |
| עלות LLM לתלוש (cache hit) | ≤ $0.005 |
| LCP בדשבורד | ≤ 2.0s |
| Bundle של מסך הדשבורד | ≤ 250KB gzipped |

---

## 16. מילון מונחים (עברית → סכימה)

| מונח בתלוש | שדה |
|-------------|-----|
| ברוטו / שכר ברוטו | `totals.grossPay` |
| ברוטו למס / הכנסה חייבת | `totals.taxableIncome` |
| נטו לתשלום | `totals.netPay` |
| מס הכנסה | `income_tax` |
| ביטוח לאומי | `national_insurance` |
| מס בריאות / דמי בריאות | `health_tax` |
| תגמולים / קופ"ג / פנסיה | `pension_employee` / `pension_employer` |
| פיצויים | `severance_employer` |
| קרן השתלמות / קה"ל | `study_fund_employee` / `study_fund_employer` |
| נקודות זיכוי / נק' זיכוי | `taxProfile.creditPoints` |
| שווי רכב / שווי טלפון / זקיפה | `benefit_in_kind` |
| הבראה / דמי הבראה | `recuperation_pay` |
| נסיעות / החזר נסיעות | `travel_allowance` |
| ותק / תוספת ותק | `seniority_increment` |
| ש"נ / שעות נוספות | `overtime` |
| מצטבר / מ.ת.ש / מתחילת שנה | `yearToDate` |
| יתרת חופשה | `balances[type=vacation]` |
| תיאום מס | `taxProfile.taxCoordination` |
| תיק ניכויים | `employer.deductionsFileId` |

---

## 17. שאלות פתוחות — להכריע לפני M1

1. **אימות משתמש ב-v1:** אנונימי לחלוטין, או חשבון אופציונלי לשמירת היסטוריה? משפיע על §12 ועל M5.
2. **דו-לשוניות:** האם ה-UI צריך אנגלית מיום ראשון? משפיע על מבנה ה-i18n ועל `narrative`.
3. **תיקונים ידניים:** האם תיקון של משתמש אחד רשאי להזין template משותף בין משתמשים? (יתרון: איכות. סיכון: הרעלת נתונים.)
4. **מודל עסקי:** חינמי לחלוטין / freemium על ניתוח רב-חודשי / הפניה להחזרי מס? משפיע על תקציב העלות ב-§15.
5. **הצגת תובנות תלויות-params** כשהפרמטרים לא אומתו — להסתיר לגמרי או להציג עם disclaimer? (המלצת האפיון: להסתיר.)
