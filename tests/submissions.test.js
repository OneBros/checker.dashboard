import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRuns, summarize, checkerNames } from '../src/data/submissions.js';
const rows = [
  { id: 'a', runner: 'Example Ember', game: 'Example Game', tier: 'Master', status: 'New', checker: '', submitted: '2026-01-01T12:00:00' },
  { id: 'b', runner: 'Example Moss', game: 'Example Game', tier: 'Champion', status: 'In Progress', checker: 'Example Checker', submitted: null },
  { id: 'c', runner: 'Example Ash', game: 'Other Game', tier: 'Master', status: 'Accepted (Not announced)', checker: 'Example Checker', submitted: '2026-02-01T12:00:00' },
  { id: 'd', runner: 'Example Mist', game: 'Other Game', tier: 'Master', status: 'Rejected', checker: 'example checker', submitted: '2026-03-01T12:00:00' },
];
test('combined filters and case-insensitive search retain exact checker identities', () => {
  assert.deepEqual(selectRuns(rows,{search:'  ASH ',game:'Other Game',tier:'Master',status:'Accepted (Not announced)',checker:'Example Checker',sort:'newest'}).map(r=>r.id),['c']);
  assert.equal(selectRuns(rows,{search:'',checker:'__unassigned'}).length,1);
  assert.deepEqual(checkerNames(rows),['example checker','Example Checker'].sort((a,b)=>a.localeCompare(b)));
});
test('sorting keeps missing dates last and never mutates the source',()=>{
  assert.deepEqual(selectRuns(rows,{search:'',sort:'oldest'}).map(r=>r.id),['a','c','d','b']);
  assert.deepEqual(selectRuns(rows,{search:'',sort:'newest'}).map(r=>r.id),['d','c','a','b']);
  assert.deepEqual(rows.map(r=>r.id),['a','b','c','d']);
});
test('completion preserves both accepted states and rejected, without merging aliases',()=>{
  const stats=summarize(rows);
  assert.equal(stats.completed,2);
  assert.equal(stats.byStatus['Accepted (Not announced)'],1);
  assert.equal(stats.byStatus.Accepted,0);
  assert.deepEqual(stats.checkers,{'Example Checker':1,'example checker':1});
});
test('counter status presets select exactly the requested states and clear cleanly', () => {
  const accepted = { ...rows[2], id: 'e', status: 'Accepted' };
  const all = [...rows, accepted];
  assert.deepEqual(selectRuns(all,{search:'',status:'New'}).map(r=>r.id),['a']);
  assert.deepEqual(selectRuns(all,{search:'',status:'In Progress'}).map(r=>r.id),['b']);
  const completed = selectRuns(all,{search:'',status:'__completed'});
  assert.deepEqual(new Set(completed.map(r=>r.status)),new Set(['Accepted','Accepted (Not announced)','Rejected']));
  assert.equal(completed.length,summarize(all).completed);
  assert.equal(selectRuns(all,{search:'',status:''}).length,all.length);
  assert.equal(selectRuns(all,{search:'',status:'__completed',checker:'Example Checker'}).length,2);
});
