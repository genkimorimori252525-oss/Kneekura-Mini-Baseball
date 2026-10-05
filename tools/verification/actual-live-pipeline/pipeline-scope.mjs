import assert from 'node:assert/strict';
const names = ['all', 'official', 'supervisor_smoke', 'role', 'next'];
export const executionScope = config => {
  const scope = Object.hasOwn(config, 'executionScope') ? config.executionScope : 'all';
  assert(names.includes(scope), 'unsupported actual pipeline execution scope');
  return scope;
};
export const scopeCompletion = (scope, counts, receipts, inheritedReceipts = []) => {
  assert(names.includes(scope), 'unsupported actual pipeline execution scope');
  const official = scope === 'all' || scope === 'official' ? 1 : 0;
  const role = scope === 'all' || scope === 'role' ? 1 : 0;
  const next = scope === 'all' || scope === 'next' ? 1 : 0;
  assert.deepEqual(counts, { officialStarted: official, officialCompleted: official,
    roleStarted: role, roleCompleted: role, nextStarted: next, nextCompleted: next });
  const stages = scope === 'all' ? ['01-official', '02-role-workload', '03-next-actor-pitch']
    : scope === 'official' ? ['01-official'] : scope === 'role' ? ['02-role-workload'] : scope === 'next' ? ['03-next-actor-pitch'] : [];
  assert(Array.isArray(receipts) && Array.isArray(inheritedReceipts), 'receipt arrays required');
  assert.deepEqual(receipts.map(value => value.stage), stages, 'completed receipt scope differs');
  const inherited = scope === 'role' ? ['01-official'] : scope === 'next' ? ['01-official', '02-role-workload'] : [];
  assert.deepEqual(inheritedReceipts.map(value => value.stage), inherited, 'inherited receipt scope differs');
  const result = { status: scope === 'all' ? 'passed' : scope === 'supervisor_smoke' ? 'supervisor_smoke_passed' : 'stage_passed',
    executionScope: scope, wholePipelinePassed: scope === 'all',
    remainingStages: scope === 'all' || scope === 'next' ? [] : scope === 'official' ? ['role', 'next'] : scope === 'role' ? ['next'] : ['official', 'role', 'next'] };
  return inherited.length ? { ...result, inheritedStages: scope === 'role' ? ['official'] : ['official', 'role'] } : result;
};
