import assert from 'node:assert/strict';
import test from 'node:test';
import { executionScope, scopeCompletion } from './pipeline-scope.mjs';
const all = { officialStarted: 1, officialCompleted: 1, roleStarted: 1, roleCompleted: 1, nextStarted: 1, nextCompleted: 1 };
const official = { ...all, roleStarted: 0, roleCompleted: 0, nextStarted: 0, nextCompleted: 0 };
const none = Object.fromEntries(Object.keys(all).map(key => [key, 0]));
const refs = names => names.map(stage => ({ stage, path: `/${stage}.receipt.json`, sha256: 'a'.repeat(64) }));
const allRefs = refs(['01-official', '02-role-workload', '03-next-actor-pitch']);
test('keeps the existing all-stage scope for omitted configuration', () => assert.equal(executionScope({}), 'all'));
test('selects the explicit official-only scope', () => assert.equal(executionScope({ executionScope: 'official' }), 'official'));
test('selects control-only supervisor smoke', () => assert.equal(executionScope({ executionScope: 'supervisor_smoke' }), 'supervisor_smoke'));
for (const value of ['', null, true, 1, {}, ['official']]) {
  test(`rejects unsupported execution scope ${JSON.stringify(value)}`, () => assert.throws(() => executionScope({ executionScope: value })));
}
test('full completion retains a whole-pipeline pass', () => assert.deepEqual(scopeCompletion('all', all, allRefs), {
  status: 'passed', executionScope: 'all', wholePipelinePassed: true, remainingStages: [],
}));
test('official completion explicitly leaves role and next pending', () => assert.deepEqual(scopeCompletion('official', official, refs(['01-official'])), {
  status: 'stage_passed', executionScope: 'official', wholePipelinePassed: false, remainingStages: ['role', 'next'],
}));
test('smoke completion has no domain stage receipts or passes', () => assert.deepEqual(scopeCompletion('supervisor_smoke', none, []), {
  status: 'supervisor_smoke_passed', executionScope: 'supervisor_smoke', wholePipelinePassed: false, remainingStages: ['official', 'role', 'next'],
}));
test('official scope rejects extra helper execution', () => assert.throws(() => scopeCompletion('official', all, allRefs)));
test('all scope rejects official-only evidence', () => assert.throws(() => scopeCompletion('all', official, refs(['01-official']))));
test('official scope rejects a missing completed count', () => assert.throws(() => scopeCompletion('official', { ...official, officialCompleted: 0 }, refs(['01-official']))));
test('official scope rejects a mismatched receipt stage', () => assert.throws(() => scopeCompletion('official', official, refs(['02-role-workload']))));
test('smoke scope rejects a domain helper count', () => assert.throws(() => scopeCompletion('supervisor_smoke', official, refs(['01-official']))));
test('completion rejects unknown scope even with full evidence', () => assert.throws(() => scopeCompletion('unknown', all, allRefs)));

// Downstream extension contract only: runtime execution is held until its RED is observed.
const roleOnly = { ...none, roleStarted: 1, roleCompleted: 1 };
const nextOnly = { ...none, nextStarted: 1, nextCompleted: 1 };
test('role continuation explicitly selects only the role helper', () => assert.equal(executionScope({ executionScope: 'role' }), 'role'));
test('next continuation explicitly selects only the next helper', () => assert.equal(executionScope({ executionScope: 'next' }), 'next'));
test('role completion keeps one official proof inherited and actual official calls zero', () => assert.deepEqual(
  scopeCompletion('role', roleOnly, refs(['02-role-workload']), refs(['01-official'])), {
    status: 'stage_passed', executionScope: 'role', wholePipelinePassed: false, remainingStages: ['next'], inheritedStages: ['official'],
  }));
test('next completion keeps both predecessor proofs inherited and actual predecessor calls zero', () => assert.deepEqual(
  scopeCompletion('next', nextOnly, refs(['03-next-actor-pitch']), refs(['01-official', '02-role-workload'])), {
    status: 'stage_passed', executionScope: 'next', wholePipelinePassed: false, remainingStages: [], inheritedStages: ['official', 'role'],
  }));
test('role continuation requires the inherited official proof', () => assert.throws(() => scopeCompletion('role', roleOnly, refs(['02-role-workload']), [])));
test('next continuation requires both predecessor proofs', () => assert.throws(() => scopeCompletion('next', nextOnly, refs(['03-next-actor-pitch']), refs(['01-official']))));
test('role cannot relabel inherited official evidence as a new helper execution', () => assert.throws(() => scopeCompletion('role', { ...roleOnly, officialStarted: 1, officialCompleted: 1 }, refs(['02-role-workload']), refs(['01-official']))));
test('next cannot relabel inherited role evidence as a new helper execution', () => assert.throws(() => scopeCompletion('next', { ...nextOnly, roleStarted: 1, roleCompleted: 1 }, refs(['03-next-actor-pitch']), refs(['01-official', '02-role-workload']))));
test('a full execution cannot substitute inherited proofs for its own helpers', () => assert.throws(() => scopeCompletion('all', all, allRefs, refs(['01-official']))));
