import type { Cents, IsoDate, SourceId } from '@moneytree/core';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

/** Outflows (negative) read as plain spend; inflows such as refunds get a +. */
export function formatCents(cents: Cents): string {
  const formatted = currency.format(Math.abs(cents) / 100);
  return cents > 0 ? `+${formatted}` : formatted;
}

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function formatDate(date: IsoDate): string {
  return dateFormat.format(new Date(`${date}T00:00:00Z`));
}

const relative = new Intl.RelativeTimeFormat('en-US', { numeric: 'auto' });

export function formatRelative(timestamp: string, now = Date.now()): string {
  const minutes = Math.round((Date.parse(timestamp) - now) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, 'hour');
  return relative.format(Math.round(hours / 24), 'day');
}

const SOURCE_LABELS: Record<SourceId, string> = {
  amazon: 'Amazon',
  apple: 'Apple',
  costco: 'Costco',
  ebay: 'eBay',
  meijer: 'Meijer',
  receipt: 'Receipt photos',
};

export function sourceLabel(source: SourceId): string {
  return SOURCE_LABELS[source];
}

export function todayMinusDays(days: number, now = Date.now()): IsoDate {
  return new Date(now - days * 86_400_000).toISOString().slice(0, 10);
}
