export interface ExtractHit {
  field: string;
  entity: 'supplier' | 'article';
  value: unknown;
  page: number;
  snippet: string;
}

const PATTERNS: { field: string; entity: 'supplier' | 'article'; pattern: RegExp; parse: (match: RegExpMatchArray) => unknown }[] = [
  {
    field: 'reachStatus',
    entity: 'supplier',
    pattern: /REACH status:\s*(declared|missing|exempt|unknown)/i,
    parse: (match) => match[1].toLowerCase(),
  },
  {
    field: 'rohsStatus',
    entity: 'supplier',
    pattern: /RoHS status:\s*(declared|missing|exempt|unknown)/i,
    parse: (match) => match[1].toLowerCase(),
  },
  {
    field: 'paymentTermsDays',
    entity: 'supplier',
    pattern: /Payment terms:\s*(\d+)\s*days/i,
    parse: (match) => Number(match[1]),
  },
  {
    field: 'bankName',
    entity: 'supplier',
    pattern: /Bank:\s*(.+)/i,
    parse: (match) => match[1].trim(),
  },
  {
    field: 'iban',
    entity: 'supplier',
    pattern: /IBAN:\s*([A-Z0-9]+)/i,
    parse: (match) => match[1].trim(),
  },
  {
    field: 'unitPrice',
    entity: 'article',
    pattern: /Unit price EUR\s*([0-9]+(?:[.,][0-9]+)?)/i,
    parse: (match) => Math.round(Number(match[1].replace(',', '.')) * 100),
  },
  {
    field: 'moq',
    entity: 'article',
    pattern: /MOQ\s*(\d+)/i,
    parse: (match) => Number(match[1]),
  },
  {
    field: 'co2eKg',
    entity: 'article',
    pattern: /CO2e kg\s*([0-9]+(?:[.,][0-9]+)?)/i,
    parse: (match) => Number(match[1].replace(',', '.')),
  },
  {
    field: 'drawingFileId',
    entity: 'article',
    pattern: /File:\s*(\S+)/i,
    parse: (match) => match[1].trim(),
  },
];

export function extractHits(text: string): ExtractHit[] {
  const pages = text.split(/---\s*page\s+(\d+)\s*---/i);
  const chunks: { page: number; body: string }[] = [];
  if (pages[0]?.trim()) chunks.push({ page: 1, body: pages[0] });
  for (let index = 1; index < pages.length; index += 2) {
    chunks.push({ page: Number(pages[index]), body: pages[index + 1] ?? '' });
  }
  const hits: ExtractHit[] = [];
  for (const chunk of chunks) {
    for (const line of chunk.body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      for (const pattern of PATTERNS) {
        const match = trimmed.match(pattern.pattern);
        if (!match) continue;
        hits.push({
          field: pattern.field,
          entity: pattern.entity,
          value: pattern.parse(match),
          page: chunk.page,
          snippet: trimmed,
        });
      }
    }
  }
  return hits;
}
