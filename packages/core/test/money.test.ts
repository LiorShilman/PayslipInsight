import { describe, expect, it } from 'vitest';
import {
  add,
  assertAgorot,
  formatILS,
  isWithinTolerance,
  multiplyRound,
  subtract,
  sum,
} from '../src/money.js';

describe('assertAgorot', () => {
  it('does not throw for an integer', () => {
    expect(() => assertAgorot(100)).not.toThrow();
    expect(() => assertAgorot(0)).not.toThrow();
    expect(() => assertAgorot(-50)).not.toThrow();
  });

  it('throws for a non-integer', () => {
    expect(() => assertAgorot(100.5)).toThrow(/integer/);
  });

  it('includes the provided label in the error message', () => {
    expect(() => assertAgorot(1.1, 'grossPay')).toThrow(/grossPay/);
  });
});

describe('add', () => {
  it('adds two integer amounts', () => {
    expect(add(100, 250)).toBe(350);
  });

  it('throws if either operand is not an integer', () => {
    expect(() => add(1.5, 2)).toThrow();
    expect(() => add(2, 1.5)).toThrow();
  });
});

describe('subtract', () => {
  it('subtracts two integer amounts', () => {
    expect(subtract(350, 100)).toBe(250);
  });

  it('allows a negative result', () => {
    expect(subtract(100, 350)).toBe(-250);
  });

  it('throws if either operand is not an integer', () => {
    expect(() => subtract(1.5, 2)).toThrow();
  });
});

describe('sum', () => {
  it('returns 0 for an empty array', () => {
    expect(sum([])).toBe(0);
  });

  it('sums a list of integer amounts', () => {
    expect(sum([100, 200, 300])).toBe(600);
  });

  it('throws with the offending index if a value is not an integer', () => {
    expect(() => sum([100, 1.5, 200])).toThrow(/values\[1\]/);
  });
});

describe('multiplyRound', () => {
  it('multiplies quantity by an integer rate and rounds to the nearest agora', () => {
    expect(multiplyRound(7.5, 1000)).toBe(7500);
    expect(multiplyRound(3, 333)).toBe(999);
  });

  it('rounds .5 up, matching Math.round', () => {
    expect(multiplyRound(0.5, 1)).toBe(1);
    expect(multiplyRound(2.5, 1)).toBe(3);
  });

  it('throws if rate is not an integer', () => {
    expect(() => multiplyRound(2, 10.5)).toThrow();
  });
});

describe('isWithinTolerance', () => {
  it('passes on an exact match', () => {
    expect(isWithinTolerance(1000, 1000, 0)).toBe(true);
  });

  it('passes within tolerance', () => {
    expect(isWithinTolerance(1000, 1002, 2)).toBe(true);
    expect(isWithinTolerance(1002, 1000, 2)).toBe(true);
  });

  it('fails outside tolerance', () => {
    expect(isWithinTolerance(1000, 1003, 2)).toBe(false);
  });

  it('throws if either value is not an integer', () => {
    expect(() => isWithinTolerance(1000.5, 1000, 2)).toThrow();
  });
});

describe('formatILS', () => {
  it('formats agorot as an ILS currency string', () => {
    const formatted = formatILS(123456);
    expect(formatted).toContain('1,234.56');
  });

  it('throws if the value is not an integer', () => {
    expect(() => formatILS(1.5)).toThrow();
  });
});
