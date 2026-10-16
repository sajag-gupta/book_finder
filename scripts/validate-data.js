import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = loadData(root);
const errors = validateData(data);

if (errors.length) {
  console.error(`Data validation failed (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

const reviewed = data.books.filter((b) => b.status === 'reviewed').length;
console.log(
  `Data OK: ${data.books.length} books (${reviewed} reviewed), ${data.series.length} series.`,
);
