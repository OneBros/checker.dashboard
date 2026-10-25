import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
export async function privateRuns(root = process.cwd()) {
  const runs = [];
  try {
    for (const name of await readdir(path.join(root, '.local'))) {
      if (!/^snapshot.*\.json$/.test(name)) continue;
      const data = JSON.parse(await readFile(path.join(root, '.local', name), 'utf8'));
      if (Array.isArray(data.runs)) runs.push(...data.runs);
    }
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  return runs;
}
export function assertPublicText(text, runs) {
  for (const run of runs) {
    for (const field of ['runner', 'checker', 'notes', 'evidence']) {
      const value = run[field]?.trim();
      if (!value || value.length < 3) continue;
      const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(String.raw`(?<![\p{L}\p{N}_])${escaped}(?![\p{L}\p{N}_])`, 'u');
      if (pattern.test(text)) throw new Error(`Private ${field} content found in public files`);
    }
  }
}
