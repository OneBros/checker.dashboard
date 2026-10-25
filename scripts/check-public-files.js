import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { privateRuns, assertPublicText } from './private-data-check.js';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const runs = await privateRuns();
for (const file of files) {
  if (/(^|\/)(\.local|node_modules|dist|__pycache__)(\/|$)|\.(xlsx?|xlsm|csv|pem|key)$|(^|\/)\.env(\.|$)/i.test(file)) throw new Error('Private/generated file is tracked: ' + file);
  const text = await readFile(file, 'utf8');
  assertPublicText(text, runs);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AIza[A-Za-z0-9_-]{30,}/.test(text)) throw new Error('Potential credential in tracked file: ' + file);
}
console.log(`PASS: ${files.length} tracked files checked; no private snapshot records, exports or credentials detected.`);
