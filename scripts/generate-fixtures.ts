import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas } from '@napi-rs/canvas';
import { PDFDocument } from 'pdf-lib';

/**
 * מחולל fixtures — SPEC.md §13.1: אסור לשמור תלושים אמיתיים ברפו.
 * גרסה ראשונית מצומצמת (M1): fixture סינתטי יחיד, מצויר כתמונה עם
 * @napi-rs/canvas (טקסט עברי RTL תקין ללא רישום פונט, אומת ידנית) ועטוף
 * כעמוד יחיד ב-PDF דרך pdf-lib. אין שכבת טקסט — זה "מדומה-סרוק", בדיוק
 * המקרה שה-Vision הוא מקור האמת בו (SPEC.md §3). הרחבה ל-30 fixtures
 * ולפריסות ספק שונות נדחית לשלב חיזוק מאוחר יותר.
 */

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(here, '..', 'fixtures');

const WIDTH = 1240;
const HEIGHT = 1754;

type Row = { label: string; amount: number };

function ils(agorot: number): string {
  const sign = agorot < 0 ? '-' : '';
  const abs = Math.abs(agorot);
  const shekels = Math.floor(abs / 100);
  const agorotPart = abs % 100;
  return `${sign}${shekels.toLocaleString('en-US')}.${agorotPart.toString().padStart(2, '0')} ש"ח`;
}

function drawBasicPayslip(): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.direction = 'rtl';
  ctx.fillStyle = '#000000';

  const rightMargin = WIDTH - 60;
  let y = 80;

  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('תלוש שכר', WIDTH / 2, y);
  y += 42;
  ctx.font = '22px sans-serif';
  ctx.fillText('חברת דוגמה בע"מ — מרץ 2026', WIDTH / 2, y);
  y += 70;

  ctx.textAlign = 'right';
  ctx.font = '20px sans-serif';
  ctx.fillText('שם עובד: ישראל ישראלי', rightMargin, y);
  y += 32;
  ctx.fillText('ת.ז.: 000000018', rightMargin, y);
  y += 32;
  ctx.fillText('ח.פ. מעסיק: 514123456', rightMargin, y);
  y += 60;

  function sectionTitle(title: string): void {
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(title, rightMargin, y);
    y += 38;
  }

  function tableRow(label: string, agorot: number, bold = false): void {
    ctx.font = bold ? 'bold 20px sans-serif' : '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, rightMargin, y);
    ctx.textAlign = 'left';
    ctx.fillText(ils(agorot), 60, y);
    y += 34;
  }

  sectionTitle('תשלומים');
  const payments: Row[] = [
    { label: 'שכר יסוד', amount: 1_000_000 },
    { label: 'נסיעות', amount: 50_000 },
    { label: 'בונוס', amount: 100_000 },
  ];
  payments.forEach((row) => tableRow(row.label, row.amount));
  const gross = payments.reduce((sum, row) => sum + row.amount, 0);
  y += 8;
  tableRow('סה"כ ברוטו', gross, true);
  y += 34;

  sectionTitle('ניכויי חובה');
  const mandatory: Row[] = [
    { label: 'מס הכנסה', amount: 150_000 },
    { label: 'ביטוח לאומי', amount: 40_000 },
    { label: 'מס בריאות', amount: 25_000 },
  ];
  mandatory.forEach((row) => tableRow(row.label, row.amount));
  const mandatoryTotal = mandatory.reduce((sum, row) => sum + row.amount, 0);
  y += 8;

  sectionTitle('ניכויי רשות');
  const voluntary: Row[] = [{ label: 'תגמולי עובד לפנסיה', amount: 60_000 }];
  voluntary.forEach((row) => tableRow(row.label, row.amount));
  const voluntaryTotal = voluntary.reduce((sum, row) => sum + row.amount, 0);
  y += 8;

  const totalDeductions = mandatoryTotal + voluntaryTotal;
  tableRow('סה"כ ניכויים', totalDeductions, true);
  y += 8;

  const net = gross - totalDeductions;
  ctx.font = 'bold 26px sans-serif';
  tableRow('נטו לתשלום', net, true);
  y += 50;

  sectionTitle('הפרשות מעסיק');
  const employerContributions: Row[] = [
    { label: 'תגמולי מעסיק', amount: 65_000 },
    { label: 'פיצויים', amount: 83_000 },
  ];
  employerContributions.forEach((row) => tableRow(row.label, row.amount));

  return canvas.toBuffer('image/png');
}

/**
 * טופס 106 סינתטי — אותה שיטה בדיוק כמו drawBasicPayslip (עמוד יחיד,
 * מדומה-סרוק). מכיל שורות שממופות ל-totals הייעודיים (fieldCode תואם)
 * וטבלת "נתוני עזר" שבה V1_pension_employer_sum מתקיים בדיוק
 * (148,000 = 65,000 + 83,000), כדי שהפיקסצ'ר יעבור ולידציה נקייה.
 */
function drawBasicForm106(): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.direction = 'rtl';
  ctx.fillStyle = '#000000';

  const rightMargin = WIDTH - 60;
  let y = 80;

  ctx.textAlign = 'center';
  ctx.font = 'bold 32px sans-serif';
  ctx.fillText('טופס 106 לשנת המס 2025', WIDTH / 2, y);
  y += 70;

  ctx.textAlign = 'right';
  ctx.font = '20px sans-serif';
  ctx.fillText('שם עובד: ישראל ישראלי', rightMargin, y);
  y += 32;
  ctx.fillText('ת.ז.: 000000018', rightMargin, y);
  y += 32;
  ctx.fillText('מעסיק: חברת דוגמה בע"מ', rightMargin, y);
  y += 32;
  ctx.fillText('תיק ניכויים מס הכנסה: 925002040', rightMargin, y);
  y += 32;
  ctx.fillText('סה"כ נקודות זיכוי: 2.25', rightMargin, y);
  y += 60;

  function sectionTitle(title: string): void {
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(title, rightMargin, y);
    y += 38;
  }

  function fundRow(fundName: string, fundType: string, employeeAgorot: number | null, employerAgorot: number): void {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${fundName} (${fundType})`, rightMargin, y);
    ctx.textAlign = 'left';
    const employeeText = employeeAgorot === null ? 'עובד: —' : `עובד: ${ils(employeeAgorot)}`;
    ctx.fillText(`${employeeText}   מעסיק: ${ils(employerAgorot)}`, 60, y);
    y += 34;
  }

  function fieldRow(fieldCode: string | null, label: string, agorot: number): void {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(fieldCode ? `${label} (${fieldCode})` : label, rightMargin, y);
    ctx.textAlign = 'left';
    ctx.fillText(ils(agorot), 60, y);
    y += 34;
  }

  sectionTitle('נתוני עזר — הפרשה לקופות');
  fundRow('אנליסט', 'תגמולים', 60_000, 65_000);
  fundRow('אנליסט', 'פיצויים', null, 83_000);
  fundRow('ילין לפידות', 'ק.השתלמות', 20_000, 25_000);
  y += 24;

  sectionTitle('פירוט ניכויים והפרשות');
  fieldRow('172/158', 'משכורת חייבת במס', 1_200_000);
  fieldRow('42', 'מס הכנסה שנוכה במקור', 150_000);
  fieldRow(null, 'שכר שעות נוספות', 50_000);
  fieldRow('249/248', 'סך הפרשות מעסיק לקצבה', 148_000);
  fieldRow('245/244', 'הכנסת עבודה מבוטחת', 1_200_000);

  return canvas.toBuffer('image/png');
}

/**
 * "דוח מידע אישי" סינתטי — סוג פנסיה (הענף היחיד שכולל גם סעיף א',
 * תחזיות תשלום). מספרים נבחרו כך ששתי הזהויות שאומתו מול הדוח האמיתי
 * מתקיימות בדיוק: V1 (יתרת פתיחה+הפקדות+תשואה+עמלות/עלויות=יתרת סגירה)
 * ו-V2 (סכום שורות ההפקדות=הפקדות בתנועות הקרן).
 */
function drawBasicPersonalInfoReport(): Buffer {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.direction = 'rtl';
  ctx.fillStyle = '#000000';

  const rightMargin = WIDTH - 60;
  let y = 80;

  ctx.textAlign = 'center';
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText('דוח רבעוני לעמית — קרן הפנסיה החדשה קרן דוגמה', WIDTH / 2, y);
  y += 40;
  ctx.font = '20px sans-serif';
  ctx.fillText('קרן דוגמה פנסיה וגמל בע"מ', WIDTH / 2, y);
  y += 60;

  ctx.textAlign = 'right';
  ctx.font = '20px sans-serif';
  ctx.fillText('תקופת הדוח: 01/01/2025 עד 31/03/2025', rightMargin, y);
  y += 32;
  ctx.fillText('תאריך הפקת הדוח: 15/04/2025', rightMargin, y);
  y += 32;
  ctx.fillText('שם עמית: ישראל ישראלי', rightMargin, y);
  y += 32;
  ctx.fillText('ת.ז.: 000000018', rightMargin, y);
  y += 32;
  ctx.fillText('מעסיק: חברת דוגמה בע"מ', rightMargin, y);
  y += 60;

  function sectionTitle(title: string): void {
    ctx.textAlign = 'right';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(title, rightMargin, y);
    y += 38;
  }

  function labeledRow(label: string, value: string): void {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(label, rightMargin, y);
    ctx.textAlign = 'left';
    ctx.fillText(value, 60, y);
    y += 34;
  }

  sectionTitle('א. תחזית תשלומים עתידיים מהקרן (בהנחת המשך צבירה)');
  labeledRow('קצבת פרישה חודשית צפויה', ils(800_000));
  labeledRow('קצבת אלמן/ה חודשית צפויה', ils(400_000));
  labeledRow('קצבת יתום חודשית צפויה', ils(120_000));
  labeledRow('קצבת נכות חודשית צפויה', ils(600_000));
  y += 24;

  sectionTitle('ב. תנועות בקרן לתקופה');
  labeledRow('יתרה בתחילת תקופה', ils(50_000_000));
  labeledRow('כספים שהופקדו לקרן', ils(300_000));
  labeledRow('רווחים מהשקעות (תשואה)', ils(200_000));
  labeledRow('דמי ניהול מהפקדות ומצבירה', ils(-15_000));
  labeledRow('עלות ביטוח נכות', ils(-8_000));
  labeledRow('עלות ביטוח מוות (שאירים)', ils(-2_000));
  ctx.font = 'bold 20px sans-serif';
  labeledRow('יתרה בסוף תקופה', ils(50_475_000));
  y += 24;

  sectionTitle('ג. שיעור דמי ניהול');
  labeledRow('דמי ניהול מהפקדה', '1.86%');
  labeledRow('דמי ניהול מצבירה', '0.30%');
  y += 24;

  sectionTitle('ד. מסלולי השקעה ותשואה לתקופה');
  labeledRow('מסלול כללי', '4.50%');
  labeledRow('מסלול מניות', '6.20%');
  y += 24;

  sectionTitle('ה. פירוט הפקדות לתקופה');
  const deposits = [
    { month: '01/2025', date: '05/02/2025' },
    { month: '02/2025', date: '05/03/2025' },
    { month: '03/2025', date: '05/04/2025' },
  ];
  for (const d of deposits) {
    ctx.font = '20px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`חודש שכר ${d.month} — מעסיק: חברת דוגמה בע"מ — תאריך הפקדה: ${d.date}`, rightMargin, y);
    y += 30;
    ctx.font = '18px sans-serif';
    ctx.fillText(
      `שכר: ${ils(1_000_000)}   חלק עובד: ${ils(30_000)}   חלק מעסיק: ${ils(40_000)}   פיצויים: ${ils(30_000)}   סה"כ: ${ils(100_000)}`,
      rightMargin,
      y,
    );
    y += 36;
  }
  y += 12;

  sectionTitle('ו. פרטי סוכן/יועץ');
  labeledRow('שם הסוכן', 'דני כהן');
  labeledRow('טלפון', '03-1234567');

  return canvas.toBuffer('image/png');
}

async function wrapPngAsSinglePagePdf(png: Buffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(png);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return pdfDoc.save();
}

async function main(): Promise<void> {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const payslipPng = drawBasicPayslip();
  const payslipPdf = await wrapPngAsSinglePagePdf(payslipPng);
  const payslipPath = join(FIXTURES_DIR, 'basic-payslip.pdf');
  writeFileSync(payslipPath, payslipPdf);
  console.log(`נכתב: ${payslipPath}`);

  const form106Png = drawBasicForm106();
  const form106Pdf = await wrapPngAsSinglePagePdf(form106Png);
  const form106Path = join(FIXTURES_DIR, 'basic-form106.pdf');
  writeFileSync(form106Path, form106Pdf);
  console.log(`נכתב: ${form106Path}`);

  const personalInfoReportPng = drawBasicPersonalInfoReport();
  const personalInfoReportPdf = await wrapPngAsSinglePagePdf(personalInfoReportPng);
  const personalInfoReportPath = join(FIXTURES_DIR, 'basic-personal-info-report.pdf');
  writeFileSync(personalInfoReportPath, personalInfoReportPdf);
  console.log(`נכתב: ${personalInfoReportPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
