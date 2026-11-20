import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const LIST = '.github/banned-words.txt';

const SKIP = new Set([
  '.github/banned-words.txt',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

export function loadTerms(root = process.cwd()) {
  return readFileSync(path.join(root, LIST), 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function lineHits(line, terms) {
  const lower = line.toLowerCase();
  return terms.filter((term) => lower.includes(term.toLowerCase()));
}

export function scanContent(text, terms) {
  const hits = [];
  const lines = text.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    for (const term of lineHits(lines[index], terms)) {
      hits.push({ line: index + 1, term });
    }
  }
  return hits;
}

export function scanFile(file, terms) {
  const buffer = readFileSync(file);
  if (buffer.includes(0)) return [];
  return scanContent(buffer.toString('utf8'), terms);
}

export function trackedFiles(root = process.cwd()) {
  const out = execSync('git ls-files -co --exclude-standard', {
    cwd: root,
    encoding: 'utf8',
  });
  return out
    .split('\n')
    .map((file) => file.trim())
    .filter(Boolean)
    .filter((file) => {
      if (SKIP.has(file)) return false;
      if (file === 'node_modules' || file.startsWith('node_modules/')) return false;
      if (file === '.next' || file.startsWith('.next/')) return false;
      return true;
    });
}

export function scanRepo(root = process.cwd()) {
  const terms = loadTerms(root);
  const hits = [];
  for (const file of trackedFiles(root)) {
    for (const hit of scanFile(path.join(root, file), terms)) {
      hits.push({ file, line: hit.line, term: hit.term });
    }
  }
  return hits;
}

function main() {
  const hits = scanRepo();
  if (hits.length === 0) {
    console.log('Banned-word check passed.');
    return;
  }
  for (const hit of hits) {
    console.error(`${hit.file}:${hit.line}: found banned term "${hit.term}"`);
  }
  process.exit(1);
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) main();
