import assert from 'node:assert/strict';
import { firstDebugDifference, parseDebugRecord, stringifyDebugRecord } from './live-debug-record.mjs';

/** Explicit seeds change only the match seed. They never depend on a pool lane. */
export function prepareDebugBatchJobs({ configurationText, commandsText, seeds }) {
  assert(Array.isArray(seeds) && seeds.length > 0, 'explicit nonempty seed list required');
  assert(seeds.every(seed => Number.isSafeInteger(seed) && seed >= 0 && seed <= 0xffffffff && !Object.is(seed, -0)),
    'each seed must be a canonical uint32');
  assert.equal(new Set(seeds).size, seeds.length, 'duplicate seed');
  const configuration = parseDebugRecord(configurationText);
  assert(configuration && typeof configuration === 'object' && Object.hasOwn(configuration, 'seed'), 'configuration seed required');
  assert(typeof commandsText === 'string', 'commands text required');
  return Object.freeze(seeds.map(seed => Object.freeze({ jobId: 'seed-' + seed, seed,
    configurationText: stringifyDebugRecord({ ...configuration, seed }), commandsText })));
}

/** Each lane is reused; failure stops admission and drains all owned jobs. */
export async function runDebugBatchPool(jobs, width, runJob) {
  assert([1, 2, 4].includes(width), 'pool width must be 1, 2 or 4');
  const results = jobs.map(({ jobId, seed }) => ({ jobId, seed, status: 'not_run' }));
  let next = 0, stopped = false, active = 0, maximumActiveJobs = 0;
  await Promise.all(Array.from({ length: Math.min(width, jobs.length) }, async (_, slot) => {
    while (!stopped && next < jobs.length) {
      const index = next++, job = jobs[index];
      active++; maximumActiveJobs = Math.max(maximumActiveJobs, active);
      try { results[index] = { jobId: job.jobId, seed: job.seed, status: 'fulfilled', value: await runJob(job, slot) }; }
      catch (error) {
        stopped = true;
        results[index] = { jobId: job.jobId, seed: job.seed, status: 'rejected',
          error: { name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack } };
      } finally { active--; }
    }
  }));
  return { pass: results.every(result => result.status === 'fulfilled'), width, maximumActiveJobs, jobs: results };
}

const widths = values => {
  assert(Array.isArray(values) && values.length > 0 && values.every(value => [1, 2, 4].includes(value)) && new Set(values).size === values.length,
    'explicit unique pool widths must be 1, 2 or 4');
  return Object.freeze([...values]);
};
const integerList = (text, name) => {
  assert(typeof text === 'string' && text.length > 0, 'explicit ' + name + ' list required');
  const parts = text.split(',');
  assert(parts.every(value => /^(0|[1-9][0-9]*)$/.test(value)), 'canonical ' + name + ' list required');
  const values = parts.map(Number);
  assert(values.every(value => Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff) && new Set(values).size === values.length,
    'unique uint32 ' + name + ' list required');
  return values;
};

export function parseDebugCaseArguments(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    assert(/^--(manifest|html|case|out|count|mode|seeds|pools)$/.test(args[index]) && args[index + 1], 'expected named debug-case arguments');
    const name = args[index].slice(2); assert(!Object.hasOwn(options, name), 'duplicate argument'); options[name] = args[index + 1];
  }
  assert(options.manifest && options.out && (options.case || options.html), '--manifest, --out and --case or --html are required');
  options.mode ??= options.case ? 'replay' : 'parity';
  assert(['parity', 'replay', 'batch'].includes(options.mode), 'supported modes: parity, replay, batch');
  assert(options.mode !== 'parity' || options.html, 'parity requires a normal game HTML');
  if (options.mode === 'batch') {
    assert(options.case && !options.html, 'batch requires one saved --case');
    options.seeds = integerList(options.seeds, 'seed'); options.pools = widths(integerList(options.pools, 'pool'));
  } else assert(!Object.hasOwn(options, 'seeds') && !Object.hasOwn(options, 'pools'), 'seed/pool lists require batch mode');
  return options;
}

export function prepareDebugBatchRun({ packet, seeds, pools, count = packet?.count, coreSha256, backgroundRuntimeSha256, browserVersion }) {
  assert(packet?.version === 2, 'batch requires a version 2 saved case');
  assert.equal(packet.coreSha256, coreSha256, 'debug case Core differs');
  assert.equal(packet.backgroundRuntimeSha256, backgroundRuntimeSha256, 'debug case Worker runtime differs');
  assert(typeof browserVersion === 'string' && browserVersion.length > 0, 'saved browser build required');
  assert.equal(packet.browserVersion, browserVersion, 'debug case Chrome build differs');
  const commands = parseDebugRecord(packet.commandsText);
  assert(Array.isArray(commands) && Number.isSafeInteger(packet.count) && packet.count > 0 && commands.length === packet.count, 'saved command count differs');
  assert(Number.isSafeInteger(count) && count > 0 && count <= commands.length && count <= 2000, 'count must be a bounded command prefix');
  return Object.freeze({ count, pools: widths(pools), jobs: prepareDebugBatchJobs({ configurationText: packet.configurationText,
    commandsText: stringifyDebugRecord(commands.slice(0, count)), seeds }) });
}

export function compareDebugBatchResult(oracle, actual) {
  for (const [key, path] of [['recordsText', '$.records'], ['stateText', '$.state']]) {
    assert(typeof oracle[key] === 'string' && typeof actual[key] === 'string', 'lossless records and inspect state required');
    if (oracle[key] === actual[key]) continue;
    const firstDifference = firstDebugDifference(parseDebugRecord(oracle[key]), parseDebugRecord(actual[key]), path);
    if (firstDifference) return { pass: false, firstDifference };
  }
  return { pass: true, firstDifference: null };
}

/** Stop admission in runDebugBatchPool, drain its jobs, then close every page.
 * Page reuse is per lane. This does not create a persistent Worker pool. */
export async function runDebugBatchLanes(jobs, width, createLane, runJob) {
  assert([1, 2, 4].includes(width), 'pool width must be 1, 2 or 4');
  const lanes = []; let result, failure, failed = false;
  try {
    for (let slot = 0; slot < width; slot++) lanes.push(await createLane(slot));
    result = await runDebugBatchPool(jobs, width, (job, slot) => runJob(job, lanes[slot], slot));
  } catch (error) { failed = true; failure = error; }
  const cleanup = await Promise.allSettled(lanes.map(lane => Promise.resolve().then(() => lane.close())));
  const errors = cleanup.filter(item => item.status === 'rejected').map(item => item.reason);
  if (failed) throw new AggregateError([failure, ...errors], 'batch lane setup or execution failed');
  return { ...result, pass: result.pass && errors.length === 0,
    cleanupErrors: errors.map(error => ({ name: error?.name ?? 'Error', message: error?.message ?? String(error), stack: error?.stack })) };
}

/** Serialized directly into the already pinned Chrome page. Every job owns a
 * fresh host and disposes its queue; no rendering callback is requested. */
export async function runDebugBatchBrowserJob({ job, background, code }) {
  const decodeStarted = performance.now(), configuration = globalThis.__parseDebugRecord(job.configurationText), commands = globalThis.__parseDebugRecord(job.commandsText);
  const phaseMs = { decode: performance.now() - decodeStarted, initialization: 0, issuePitch: 0, encoding: 0 };
  const owners = []; let host, result, failure, failed = false;
  try {
    const started = performance.now(), initialHost = globalThis.KneekuraNativeMatchCore.createLiveBaseballMatchV1(configuration); owners.push(initialHost); host = initialHost;
    if (background) { host = globalThis.KneekuraBackgroundMatchV116.create({ configuration, initialHost, coreSource: code, lookAhead: 1, warmup: 1 }); owners.push(host); }
    phaseMs.initialization = performance.now() - started;
    const records = [], perPitchMs = [];
    for (const command of commands) {
      if (host.inspect().finished) break;
      const issued = performance.now(), record = await host.issuePitch(command); phaseMs.issuePitch += performance.now() - issued;
      if (record === null) throw Error('unfinished batch host returned no record'); records.push(record); perPitchMs.push(performance.now() - issued);
    }
    const encodingStarted = performance.now(), recordsText = globalThis.__stringifyDebugRecord(records), stateText = globalThis.__stringifyDebugRecord(host.inspect());
    phaseMs.encoding = performance.now() - encodingStarted;
    result = { recordsText, stateText, count: records.length, contacts: records.filter(record => !!record.play.contact).length,
      fieldPlays: records.filter(record => !!record.play.field).length, phaseMs, perPitchMs,
      generation: background ? host.generationV116() : null, finished: host.inspect().finished };
  } catch (error) { failed = true; failure = error; }
  const cleanupErrors = [];
  for (const owner of owners.reverse()) try { await owner.dispose?.(); } catch (error) { cleanupErrors.push(error); }
  if (failed || cleanupErrors.length) throw new AggregateError([...(failed ? [failure] : []), ...cleanupErrors], 'batch job or owned host disposal failed');
  return { ...result, ownedDisposalCompleted: true };
}
