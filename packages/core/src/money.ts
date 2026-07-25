/**
 * כל האריתמטיקה הכספית של המערכת עוברת דרך הקובץ הזה בלבד.
 * כסף הוא תמיד `number` שלם באגורות (1/100 ש"ח). אסור float. כלל ברזל #3.
 */

export function assertAgorot(value: number, label = 'value'): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be an integer number of agorot, got ${value}`);
  }
}

export function add(a: number, b: number): number {
  assertAgorot(a, 'a');
  assertAgorot(b, 'b');
  return a + b;
}

export function subtract(a: number, b: number): number {
  assertAgorot(a, 'a');
  assertAgorot(b, 'b');
  return a - b;
}

export function sum(values: readonly number[]): number {
  return values.reduce<number>((total, value, index) => {
    assertAgorot(value, `values[${index}]`);
    return total + value;
  }, 0);
}

/** quantity (שעות/ימים/יחידות, יכול להיות שבר) × rate (אגורות שלמות) → אגורות שלמות, מעוגל. */
export function multiplyRound(quantity: number, rate: number): number {
  assertAgorot(rate, 'rate');
  return Math.round(quantity * rate);
}

export function isWithinTolerance(expected: number, actual: number, toleranceAgorot: number): boolean {
  assertAgorot(expected, 'expected');
  assertAgorot(actual, 'actual');
  return Math.abs(expected - actual) <= toleranceAgorot;
}

export function formatILS(agorot: number): string {
  assertAgorot(agorot, 'agorot');
  return new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS' }).format(agorot / 100);
}
