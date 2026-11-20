import type { Source } from './types';

export function proposeAnswer(field: string, current: unknown, rng: () => number): unknown {
  if (field === 'reachStatus' || field === 'rohsStatus') {
    return current === 'declared' ? 'exempt' : 'declared';
  }
  if (field === 'lksgSelfAssessment') return current === 'complete' ? 'partial' : 'complete';
  if (field === 'paymentTermsDays' && typeof current === 'number') return current >= 45 ? 30 : current + 15;
  if (field === 'unitPrice' && typeof current === 'number') {
    const next = Math.max(50, Math.round((current * (0.9 + rng() * 0.25)) / 10) * 10);
    return next === current ? current + 100 : next;
  }
  if (field === 'moq' && typeof current === 'number') return current < 100 ? Math.max(1, current * 2) : current + 50;
  if (field === 'co2eKg') return Math.round((0.4 + rng() * 8) * 100) / 100;
  if (field === 'drawingFileId') return 'drawing-24423.pdf';
  if (field === 'legalName' && typeof current === 'string') {
    if (current.includes('& Co.')) return `${current} Gruppe`;
    return current.replace(/ GmbH$/, ' GmbH & Co. KG');
  }
  if (field === 'iban' && typeof current === 'string') return `${current.slice(0, -2)}99`;
  if (field === 'bankName') return 'Nordhafen Clearing';
  if (field === 'address' && typeof current === 'string') return current.replace(/\d+/, (value) => String(Number(value) + 2));
  if (field === 'vatId' && typeof current === 'string') return `${current.slice(0, -1)}9`;
  if (typeof current === 'string') return `${current} revised`;
  return current;
}

export function answerSource(requestId: string, contactId: string, at: string): Source {
  return { kind: 'supplier_answer', requestId, contactId, at };
}

export function extractedSource(requestId: string, fileId: string, page: number, snippet: string, at: string): Source {
  return { kind: 'extracted', requestId, fileId, page, snippet, at };
}
