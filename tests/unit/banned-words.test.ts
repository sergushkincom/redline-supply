import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { lineHits, loadTerms, scanContent, scanFile, scanRepo } from '../../scripts/check-banned-words.mjs';

describe('banned words', () => {
  it('fails when a planted term is present', () => {
    const term = ['Tac', 'to'].join('');
    const hits = lineHits(`Hello ${term} team`, [term]);
    expect(hits).toContain(term);
    const contentHits = scanContent(`line one\nsee ${term} here\n`, [term]);
    expect(contentHits).toEqual([{ line: 2, term }]);

    const directory = mkdtempSync(path.join(tmpdir(), 'redline-'));
    const file = path.join(directory, 'note.txt');
    writeFileSync(file, `prefix ${term} suffix\n`);
    expect(scanFile(file, [term])).toEqual([{ line: 1, term }]);
  });

  it('passes on this repository', () => {
    const terms = loadTerms();
    expect(terms.length).toBeGreaterThan(5);
    expect(scanRepo()).toEqual([]);
  });
});