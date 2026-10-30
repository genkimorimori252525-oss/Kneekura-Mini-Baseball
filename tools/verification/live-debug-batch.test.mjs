import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import * as batch from './live-debug-case.mjs';
import { parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

const configurationText = stringifyDebugRecord({ seed: 77, retained: { minusZero: -0, missing: undefined, limit: Infinity } });
const commandsText = stringifyDebugRecord([{ direction: 'AUTO' }]);
const input = seeds => ({ configurationText, commandsText, seeds });
const nextTurn = () => new Promise(resolve => setImmediate(resolve));

test('seed jobs preserve every configuration value except the explicit seed and keep stable identities', () => {
  const jobs = batch.prepareDebugBatchJobs(input([0, 4294967295, 17]));
  assert.deepEqual(jobs.map(j => [j.jobId, j.seed]), [['seed-0', 0], ['seed-4294967295', 4294967295], ['seed-17', 17]]);
  for (const job of jobs) {
    assert.deepEqual(parseDebugRecord(job.configurationText), { seed: job.seed, retained: { minusZero: -0, missing: undefined, limit: Infinity } });
    assert.equal(job.commandsText, commandsText);
  }
  assert.equal(parseDebugRecord(configurationText).seed, 77);
});

test('invalid or duplicate uint32 seeds are rejected before work is scheduled', () => {
  for (const seeds of [[], [1, 1], [-1], [4294967296], [1.5], [NaN], [Infinity], [-0], ['1']])
    assert.throws(() => batch.prepareDebugBatchJobs(input(seeds)), /seed/i);
});

test('a bounded pool reuses its lanes while returning results in seed order', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0, 17, 23, 31]));
  let active = 0, peak = 0;
  const slots = [];
  const result = await batch.runDebugBatchPool(jobs, 2, async (job, slot) => {
    active++; peak = Math.max(peak, active); slots.push(slot);
    await nextTurn(); if (job.seed === 0) await nextTurn();
    active--; return job.seed * 2;
  });
  assert.equal(peak, 2); assert.equal(active, 0);
  assert.equal(result.pass, true); assert.equal(result.maximumActiveJobs, 2);
  assert.deepEqual(result.jobs.map(j => [j.jobId, j.status, j.value]), [
    ['seed-0', 'fulfilled', 0], ['seed-17', 'fulfilled', 34], ['seed-23', 'fulfilled', 46], ['seed-31', 'fulfilled', 62],
  ]);
  assert(slots.every(slot => slot === 0 || slot === 1)); assert.equal(slots.length, 4);
});

test('a failed lane stops new jobs and drains owned work before returning the failure', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0, 17, 23, 31]));
  let active = 0;
  const result = await batch.runDebugBatchPool(jobs, 2, async job => {
    active++;
    try { if (job.seed === 17) throw Error('retained failure'); await nextTurn(); return 5; }
    finally { active--; }
  });
  assert.equal(result.pass, false); assert.equal(active, 0);
  assert.deepEqual(result.jobs.map(j => j.status), ['fulfilled', 'rejected', 'not_run', 'not_run']);
  assert.match(result.jobs[1].error.message, /retained failure/);
});

test('pool widths outside the planned 1/2/4 conditions reject before invoking a job', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0])); let invoked = 0;
  for (const width of [0, 3, 5, 1.5, NaN])
    await assert.rejects(batch.runDebugBatchPool(jobs, width, async () => { invoked++; }), /pool/i);
  assert.equal(invoked, 0);
});

const argumentsFor = extra => ['--manifest', 'core.json', '--case', 'case.json', '--out', 'new-out', '--mode', 'batch', ...extra];
test('batch CLI requires canonical explicit seeds and planned unique pool widths in input order', () => {
  const options = batch.parseDebugCaseArguments(argumentsFor(['--seeds', '0,4294967295,17', '--pools', '4,1,2']));
  assert.equal(options.mode, 'batch'); assert.deepEqual(options.seeds, [0, 4294967295, 17]); assert.deepEqual(options.pools, [4, 1, 2]);
  for (const seeds of ['', '01', '-0', '1e2', '0x10', ' 1', '1,', '1,,2', '1,1', '4294967296'])
    assert.throws(() => batch.parseDebugCaseArguments(argumentsFor(['--seeds', seeds, '--pools', '1,2,4'])));
  for (const pools of ['', '01', '3', '2,2', '1,2,4,8'])
    assert.throws(() => batch.parseDebugCaseArguments(argumentsFor(['--seeds', '1', '--pools', pools])));
  assert.throws(() => batch.parseDebugCaseArguments(argumentsFor(['--pools', '1,2,4'])));
  assert.throws(() => batch.parseDebugCaseArguments(['--manifest', 'm', '--html', 'g', '--out', 'o', '--mode', 'batch', '--seeds', '1', '--pools', '1']));
  assert.equal(batch.parseDebugCaseArguments(['--manifest', 'm', '--html', 'g', '--out', 'o']).mode, 'parity');
  assert.equal(batch.parseDebugCaseArguments(['--manifest', 'm', '--case', 'c', '--out', 'o']).mode, 'replay');
  assert.throws(() => batch.parseDebugCaseArguments(['--manifest', 'm', '--case', 'c', '--out', 'o', '--seeds', '1']));
});

test('batch preparation retains case pins, bounded commands and every non-seed input', () => {
  const commands = [{ direction: 'AUTO', tick: 7 }, { direction: 'PULL', tick: 11 }];
  const packet = { version: 2, count: 2, configurationText, commandsText: stringifyDebugRecord(commands), coreSha256: 'core',
    backgroundRuntimeSha256: 'runtime', browserVersion: 'chrome-build' };
  const parameters = { packet, seeds: [17, 0], pools: [4, 1, 2], count: 1, coreSha256: 'core', backgroundRuntimeSha256: 'runtime', browserVersion: 'chrome-build' };
  const before = stringifyDebugRecord(packet), plan = batch.prepareDebugBatchRun(parameters);
  assert.equal(stringifyDebugRecord(packet), before); assert.deepEqual(plan.pools, [4, 1, 2]); assert.equal(plan.count, 1);
  assert.deepEqual(plan.jobs.map(j => j.jobId), ['seed-17', 'seed-0']);
  for (const job of plan.jobs) assert.deepEqual(parseDebugRecord(job.commandsText), commands.slice(0, 1));
  for (const change of [{ count: 3 }, { coreSha256: 'other' }, { backgroundRuntimeSha256: 'other' }, { browserVersion: 'other' }, { pools: [3] }])
    assert.throws(() => batch.prepareDebugBatchRun({ ...parameters, ...change }));
});

test('batch comparisons retain exact records, inspect facts and clocks and expose first difference', () => {
  const oracle = { recordsText: stringifyDebugRecord([{ tick: 19, minusZero: -0, quality: NaN }]),
    stateText: stringifyDebugRecord({ facts: { unknown: undefined }, clock: { tick: 23 }, limit: Infinity }) };
  assert.deepEqual(batch.compareDebugBatchResult(oracle, oracle), { pass: true, firstDifference: null });
  const recordMismatch = batch.compareDebugBatchResult(oracle, { ...oracle, recordsText: stringifyDebugRecord([{ tick: 19, minusZero: 0, quality: NaN }]) });
  assert.equal(recordMismatch.pass, false); assert.equal(recordMismatch.firstDifference.path, '$.records[0].minusZero'); assert.equal(recordMismatch.firstDifference.tick, 19);
  const stateMismatch = batch.compareDebugBatchResult(oracle, { ...oracle, stateText: stringifyDebugRecord({ facts: { unknown: undefined }, clock: { tick: 24 }, limit: Infinity }) });
  assert.equal(stateMismatch.firstDifference.path, '$.state.clock.tick');
});

test('page lanes are reused per width and all owned pages close after a failed job drains', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0, 17, 23, 31])), opened = [], closed = [], used = [];
  let active = 0;
  const result = await batch.runDebugBatchLanes(jobs, 2, async slot => { opened.push(slot); return { slot, close: async () => { assert.equal(active, 0); closed.push(slot); } }; },
    async (job, lane) => { active++; used.push([job.seed, lane.slot]); try { if (job.seed === 17) throw Error('job failed'); await nextTurn(); return job.seed; } finally { active--; } });
  assert.equal(result.pass, false); assert.deepEqual(opened, [0, 1]); assert.deepEqual(closed, [0, 1]);
  assert.deepEqual(result.jobs.map(j => j.status), ['fulfilled', 'rejected', 'not_run', 'not_run']); assert.equal(used.length, 2);
});

test('a partial page-lane setup failure closes previously owned pages and preserves cleanup failure', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0])); let closed = 0;
  await assert.rejects(batch.runDebugBatchLanes(jobs, 2, async slot => {
    if (slot === 1) throw Error('setup failed'); return { close: async () => { closed++; throw Error('close failed'); } };
  }, async () => 0), error => error instanceof AggregateError && error.errors.some(e => /setup failed/.test(e.message)) && error.errors.some(e => /close failed/.test(e.message)));
  assert.equal(closed, 1);
});


test('batch session saves each main-host oracle then drains a mismatching pool in input order', async () => {
  const area = resolve('work'), out = await mkdtemp(resolve(area, 'batch-session-unit-'));
  const jobs = batch.prepareDebugBatchJobs(input([0, 17, 23, 31])), phases = [], pages = []; let active = 0;
  const browser = { newPage: async () => {
    const handlers = {}, page = { id: pages.length, closed: false, on: (name, callback) => { handlers[name] = callback; },
      addScriptTag: async () => {}, close: async () => { assert.equal(active, 0); page.closed = true; },
      evaluate: async (_fn, { job, background }) => {
        active++; if (background) handlers.worker?.({}); phases.push([background ? 'worker' : 'oracle', job.seed, page.id]);
        try { await nextTurn(); if (job.seed === 0) await nextTurn();
          const records = [{ tick: 5, seed: job.seed, play: { contact: null, field: null } }];
          return { recordsText: stringifyDebugRecord(records), stateText: stringifyDebugRecord({ history: records, facts: { seed: job.seed },
            clock: { tick: background && job.seed === 17 ? 6 : 5 } }), count: 1, contacts: 0, fieldPlays: 0, finished: false, ownedDisposalCompleted: true };
        } finally { active--; }
      } }; pages.push(page); return page;
  } };
  const report = { browserVersion: 'unit-fake-not-Chrome', coreSha256: 'core', backgroundRuntimeSha256: 'runtime' };
  try {
    await assert.rejects(batch.runPinnedDebugBatch({ browser, code: 'core', runtimeSource: 'runtime', out, plan: { count: 1, jobs, pools: [2, 1] }, report }), /batch pool/);
    assert.deepEqual(phases.slice(0, 4).map(row => row.slice(0, 2)), [['oracle', 0], ['oracle', 17], ['oracle', 23], ['oracle', 31]]);
    assert.deepEqual(phases.slice(4, 6).map(row => row.slice(0, 2)), [['worker', 0], ['worker', 17]]);
    assert.equal(active, 0); assert(pages.every(page => page.closed));
    assert.deepEqual(report.poolResults.map(pool => pool.status), ['failed', 'not_run']);
    // A different lane can finish before mismatch I/O completes. Pool admission itself is covered above.
    assert.deepEqual(report.poolResults[0].jobs.map(job => job.seed), [0, 17, 23, 31]);
    assert.equal(report.poolResults[0].jobs[0].status, 'fulfilled'); assert.equal(report.poolResults[0].jobs[1].status, 'rejected');
    assert.equal(report.firstDifference.path, '$.state.clock.tick');
    assert.equal(parseDebugRecord(await readFile(resolve(out, 'pool-2/seed-17/state.lossless.json'), 'utf8')).clock.tick, 6);
    assert.equal(report.performancePass, false); assert.equal(report.fullGameVerified, false);
  } finally { assert(out.startsWith(area + sep)); await rm(out, { recursive: true }); }
});


test('serialized browser jobs use fresh hosts, stop at the actual terminal state and dispose every owned queue', async () => {
  const names = ['__parseDebugRecord', '__stringifyDebugRecord', 'KneekuraNativeMatchCore', 'KneekuraBackgroundMatchV116'];
  const prior = names.map(name => [name, Object.hasOwn(globalThis, name), globalThis[name]]), created = [], disposed = [];
  const host = seed => {
    const history = []; return { inspect: () => ({ history: [...history], facts: { seed }, clock: { tick: history.length }, finished: history.length === 1 }),
      issuePitch: () => { if (history.length) throw Error('terminal host must not be issued again'); const record = { tick: 1, play: { contact: null, field: null } }; history.push(record); return record; },
      dispose: () => { disposed.push('main-' + seed); } };
  };
  globalThis.__parseDebugRecord = parseDebugRecord; globalThis.__stringifyDebugRecord = stringifyDebugRecord;
  globalThis.KneekuraNativeMatchCore = { createLiveBaseballMatchV1: configuration => { created.push(configuration.seed); return host(configuration.seed); } };
  globalThis.KneekuraBackgroundMatchV116 = { create: ({ configuration }) => {
    const value = host(configuration.seed); return { ...value, generationV116: () => ({ consumed: 1 }), dispose: () => { disposed.push('queue-' + configuration.seed); } };
  } };
  try {
    const jobs = batch.prepareDebugBatchJobs({ configurationText, commandsText: stringifyDebugRecord([{}, {}]), seeds: [17, 23] });
    for (const job of jobs) {
      const result = await batch.runDebugBatchBrowserJob({ job, background: true, code: 'pinned-unit-fake' });
      assert.equal(result.count, 1); assert.equal(result.finished, true); assert.equal(result.ownedDisposalCompleted, true);
      assert.equal(parseDebugRecord(result.stateText).facts.seed, job.seed);
    }
    assert.deepEqual(created, [17, 23]); assert.deepEqual(disposed, ['queue-17', 'main-17', 'queue-23', 'main-23']);
    globalThis.KneekuraBackgroundMatchV116.create = ({ configuration }) => ({ ...host(configuration.seed), issuePitch: async () => { throw Error('pitch failed'); },
      dispose: () => { disposed.push('failed-queue'); throw Error('queue cleanup failed'); } });
    await assert.rejects(batch.runDebugBatchBrowserJob({ job: jobs[0], background: true, code: 'pinned-unit-fake' }), error =>
      error instanceof AggregateError && error.errors.some(e => /pitch failed/.test(e.message)) && error.errors.some(e => /queue cleanup failed/.test(e.message)));
    assert.deepEqual(disposed.slice(-2), ['failed-queue', 'main-17']);
    globalThis.KneekuraBackgroundMatchV116.create = ({ configuration }) => ({ ...host(configuration.seed), issuePitch: async () => { throw 0; }, dispose: () => { disposed.push('zero-queue'); } });
    await assert.rejects(batch.runDebugBatchBrowserJob({ job: jobs[0], background: true, code: 'pinned-unit-fake' }), error => error instanceof AggregateError && error.errors[0] === 0);
    assert.deepEqual(disposed.slice(-2), ['zero-queue', 'main-17']);
  } finally { for (const [name, existed, value] of prior) { if (existed) globalThis[name] = value; else delete globalThis[name]; } }
});


test('non-Error job rejections still stop admission and drain every owned lane', async () => {
  const jobs = batch.prepareDebugBatchJobs(input([0, 17, 23])); let active = 0;
  const result = await batch.runDebugBatchPool(jobs, 2, async job => {
    active++; try { if (job.seed === 17) throw null; await nextTurn(); return 7; } finally { active--; }
  });
  assert.equal(active, 0); assert.equal(result.pass, false); assert.equal(result.jobs[1].error.message, 'null');
  assert.deepEqual(result.jobs.map(job => job.status), ['fulfilled', 'rejected', 'not_run']);
});
