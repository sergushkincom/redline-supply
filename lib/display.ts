import { formatMoney, formatNumber } from './format';
import type { Locale, Source } from './types';

const COUNTRY: Record<string, { en: string; de: string; flag: string }> = {
  DE: { en: 'Germany', de: 'Deutschland', flag: '🇩🇪' },
  AT: { en: 'Austria', de: 'Österreich', flag: '🇦🇹' },
  CH: { en: 'Switzerland', de: 'Schweiz', flag: '🇨🇭' },
  IT: { en: 'Italy', de: 'Italien', flag: '🇮🇹' },
  CZ: { en: 'Czechia', de: 'Tschechien', flag: '🇨🇿' },
  PL: { en: 'Poland', de: 'Polen', flag: '🇵🇱' },
  CN: { en: 'China', de: 'China', flag: '🇨🇳' },
  TW: { en: 'Taiwan', de: 'Taiwan', flag: '🇹🇼' },
  US: { en: 'United States', de: 'USA', flag: '🇺🇸' },
};

export function countryMeta(code: string, locale: Locale): { name: string; flag: string } {
  const item = COUNTRY[code];
  if (!item) return { name: code, flag: '🏳️' };
  return { name: item[locale], flag: item.flag };
}

const STATUS: Record<string, { en: string; de: string }> = {
  declared: { en: 'Declared', de: 'Erklärt' },
  missing: { en: 'Missing', de: 'Fehlt' },
  exempt: { en: 'Exempt', de: 'Ausgenommen' },
  unknown: { en: 'Unknown', de: 'Unbekannt' },
  complete: { en: 'Complete', de: 'Vollständig' },
  partial: { en: 'Partial', de: 'Teilweise' },
};

export function displayValue(field: string, value: unknown, locale: Locale): string {
  if (value === null || value === undefined || value === '') return locale === 'de' ? 'Keine' : 'None';
  if ((field === 'reachStatus' || field === 'rohsStatus' || field === 'lksgSelfAssessment') && typeof value === 'string') {
    return STATUS[value]?.[locale] ?? value;
  }
  if (field === 'unitPrice' && typeof value === 'number') return formatMoney(value, locale);
  if (field === 'co2eKg' && typeof value === 'number') return `${formatNumber(value, locale, 2)} kg`;
  if (field === 'paymentTermsDays' && typeof value === 'number') {
    return locale === 'de' ? `${value} Tage` : `${value} days`;
  }
  if ((field === 'moq' || field === 'riskScore') && typeof value === 'number') return formatNumber(value, locale);
  return String(value);
}

export function sourceLabel(source: Source, locale: Locale): { label: string; tone: 'neutral' | 'brand'; detail?: string } {
  if (source.kind === 'supplier_answer') {
    return { label: locale === 'de' ? 'Antwort des Lieferanten' : 'Supplier answer', tone: 'neutral' };
  }
  if (source.kind === 'extracted') {
    const file = source.fileId;
    return {
      label: locale === 'de' ? `Aus Dokument · ${file} S.${source.page}` : `Extracted · ${file} p.${source.page}`,
      tone: 'brand',
      detail: source.snippet,
    };
  }
  if (source.kind === 'buyer_edit') return { label: locale === 'de' ? 'Einkauf' : 'Buyer edit', tone: 'neutral' };
  if (source.kind === 'system_default') return { label: locale === 'de' ? 'Systemvorschlag' : 'System default', tone: 'neutral' };
  return { label: locale === 'de' ? 'Aus ERP' : 'Imported from ERP', tone: 'neutral' };
}
