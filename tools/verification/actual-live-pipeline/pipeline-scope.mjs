import assert from 'node:assert/strict';
const names = ['all', 'official', 'supervisor_smoke'];
export const executionScope = config => {
  const scope = Object.hasOwn(config, 'executionScope') ? config.executionScope : 'all';
  assert(names.includes(scope), 'unsupported actual pipeline execution scope');
  return scope;
};
export const scopeCompletion = (scope, counts, receipts) => {
  assert(names.includes(scope), 'unsupported actual pipeline execution scope');
  const official = scope === 'all' || scope === 'official' ? 1 : 0, downstream = scope === 'all' ? 1 : 0;
  assert.deepEqual(counts, { officialStarted: official, officialCompleted: official,
    roleStarted: downstream, roleCompleted: downstream, nextStarted: downstream, nextCompleted: downstream });
  const stages = scope === 'all' ? ['01-official', '02-role-workload', '03-next-actor-pitch'] : scope === 'official' ? ['01-official'] : [];
  assert.deepEqual(receipts.map(value => value.stage), stages, 'completed receipt scope differs');
  return { status: scope === 'all' ? 'passed' : scope === 'official' ? 'stage_passed' : 'supervisor_smoke_passed',
    executionScope: scope, wholePipelinePassed: scope === 'all',
    remainingStages: scope === 'all' ? [] : scope === 'official' ? ['role', 'next'] : ['official', 'role', 'next'] };
};
