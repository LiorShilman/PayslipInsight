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

async function wrapPngAsSinglePagePdf(png: Buffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const image = await pdfDoc.embedPng(png);
  const page = pdfDoc.addPage([image.width, image.height]);
  page.drawImage(image, { x: 0, y: 0, width: image.width, height: image.height });
  return pdfDoc.save();
}

async function main(): Promise<void> {
  mkdirSync(FIXTURES_DIR, { recursive: true });

  const png = drawBasicPayslip();
  const pdfBytes = await wrapPngAsSinglePagePdf(png);
  const outPath = join(FIXTURES_DIR, 'basic-payslip.pdf');
  writeFileSync(outPath, pdfBytes);
  console.log(`נכתב: ${outPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
