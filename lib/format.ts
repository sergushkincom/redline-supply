import type { Locale } from './types';

export function intlLocale(locale: Locale): string {
  return locale === 'de' ? 'de-DE' : 'en-GB';
}

export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

export function formatNumber(value: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function formatPercent(ratio: number, locale: Locale, digits = 0): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: 'percent',
    maximumFractionDigits: digits,
  }).format(ratio);
}

export function formatDate(iso: string, locale: Locale, withTime = false): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: 'Europe/Berlin',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' as const } : {}),
  }).format(new Date(iso));
}

export function formatFieldValue(field: string, value: unknown, locale: Locale): string {
  if (value === null || value === undefined || value === '') return locale === 'de' ? 'Keine' : 'None';
  if (field === 'unitPrice' && typeof value === 'number') return formatMoney(value, locale);
  if (field === 'co2eKg' && typeof value === 'number') return `${formatNumber(value, locale, 2)} kg`;
  if (field === 'paymentTermsDays' && typeof value === 'number') {
    return locale === 'de' ? `${value} Tage` : `${value} days`;
  }
  if (field === 'moq' && typeof value === 'number') return formatNumber(value, locale);
  if (field === 'reachStatus' || field === 'rohsStatus' || field === 'lksgSelfAssessment') {
    return String(value);
  }
  return String(value);
}
