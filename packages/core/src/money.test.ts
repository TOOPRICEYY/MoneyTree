import { allocate, toCents } from './money.ts';

describe('toCents', () => {
  it('converts decimal amounts without float drift', () => {
    expect(toCents(12.34)).toBe(1234);
    expect(toCents('-0.29')).toBe(-29);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });

  it('rejects non-numeric input', () => {
    expect(() => toCents('abc')).toThrow();
  });
});

describe('allocate', () => {
  it('always sums exactly to the total', () => {
    const parts = allocate(-100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(-100);
    expect(parts).toEqual([-34, -33, -33]);
  });

  it('splits proportionally to weights', () => {
    expect(allocate(60, [-1000, -2000, 0])).toEqual([20, 40, 0]);
  });

  it('falls back to an even split when every weight is zero', () => {
    expect(allocate(5, [0, 0])).toEqual([3, 2]);
  });
});
