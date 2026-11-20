import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { generate } from '../lib/mock/generate';

const data = generate();
const target = path.join(process.cwd(), 'lib/mock/data/seed.json');
mkdirSync(path.dirname(target), { recursive: true });
writeFileSync(target, JSON.stringify(data));
console.log(
  `Wrote ${data.suppliers.length} suppliers, ${data.articles.length} articles, ${data.campaigns.length} campaigns, ${data.changes.length} changes.`,
);
