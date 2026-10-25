import test from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicText } from '../scripts/private-data-check.js';
import { demoSubmissions } from '../src/data/demo-data.js';
import { summarize, statuses } from '../src/data/submissions.js';
test('public preview has only complete synthetic records and all workflow states', () => {
  const data = demoSubmissions();
  assert.equal(data.source.kind, 'demo');
  assert.equal(new Set(data.runs.map(r => r.id)).size, data.runs.length);
  for (const run of data.runs) {
    assert.ok(run.id.startsWith('demo-') && run.runner.startsWith('Demo '));
    assert.equal(typeof run.checker, 'string');
    assert.ok(statuses.includes(run.status));
    assert.ok(Array.isArray(run.warnings));
  }
  const stats = summarize(data.runs);
  assert.equal(Object.values(stats.byStatus).reduce((a,b) => a+b,0), data.runs.length);
  assert.ok(statuses.every(s => stats.byStatus[s] > 0));
});
test('privacy scan detects literal punctuation without false matches inside longer words', () => {
  const data = [{ runner: 'Example.Name+', checker: 'Example', notes: 'Private sample note', evidence: 'https://example.test/private?v=1' }];
  assert.throws(() => assertPublicText('Example.Name+', data));
  assert.throws(() => assertPublicText('https://example.test/private?v=1', data));
  assert.throws(() => assertPublicText('Private sample note', data));
  assert.doesNotThrow(() => assertPublicText('ExampleName and Examples', data));
});
