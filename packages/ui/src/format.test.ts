import { formatCents, formatDate, formatRelative } from './format.ts';

describe('formatCents', () => {
  it('shows spend without a sign and refunds with a plus', () => {
    expect(formatCents(-11580)).toBe('$115.80');
    expect(formatCents(500)).toBe('+$5.00');
    expect(formatCents(0)).toBe('$0.00');
  });
});

describe('formatDate', () => {
  it('formats ISO dates without shifting time zones', () => {
    expect(formatDate('2026-02-09')).toBe('Feb 9, 2026');
  });
});

describe('formatRelative', () => {
  it('picks a sensible unit', () => {
    const now = Date.parse('2026-10-04T12:00:00Z');
    expect(formatRelative('2026-10-04T11:55:00Z', now)).toBe('5 minutes ago');
    expect(formatRelative('2026-10-04T09:00:00Z', now)).toBe('3 hours ago');
    expect(formatRelative('2026-10-01T12:00:00Z', now)).toBe('3 days ago');
  });
});
