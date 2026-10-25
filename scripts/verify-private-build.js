import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { privateRuns, assertPublicText } from './private-data-check.js';
const runs = await privateRuns();
async function walk(directory) {
  for (const item of await readdir(directory)) {
    const file = path.join(directory, item);
    if ((await stat(file)).isDirectory()) { await walk(file); continue; }
    if (/\.(xlsx?|xlsm|csv|pem|key)$/i.test(file) || file.includes(`${path.sep}.local${path.sep}`)) throw new Error('Private file in build');
    const text = await readFile(file, 'utf8');
    assertPublicText(text, runs);
    if (/__local_snapshot|excel-snapshot/.test(text)) throw new Error('Private adapter code retained in build');
  }
}
await walk(path.join(process.cwd(), 'dist'));
console.log(`PASS: static build excludes private data and endpoints; ${runs.length ? 'local snapshots checked' : 'no local snapshots available'}.`);
