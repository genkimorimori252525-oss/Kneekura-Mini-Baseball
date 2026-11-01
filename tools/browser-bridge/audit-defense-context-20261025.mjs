// Read-only Core audit. Authored paired inputs, never a defensive-diagram oracle.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

assert.equal(process.versions.node.split('.')[0], '24');
const out = resolve('docs/verification/defense-reference-audit-2026-10-25/context-contrasts');
mkdirSync(out, { recursive: true });
const sha = value => createHash('sha256').update(value).digest('hex');
const save = (name, value) => writeFileSync(resolve(out, name), JSON.stringify(value, null, 2) + '\n');
const entry = `export { buildLiveFieldPlayInputV95 as map } from './src/integration/browser/LiveFieldInputV95';
export { simulateLiveFieldPlayV1 as simulate } from './src/core/sim/fielding/LiveFieldPlayV1';`;
const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'node', format: 'esm', target: 'node24', metafile: true });
const pins = Object.fromEntries(Object.keys(bundle.metafile.inputs).filter(p => p !== '<stdin>').sort()
  .map(p => [p, sha(readFileSync(p))]));
const code = bundle.outputFiles[0].text;
writeFileSync(resolve(out, 'audit-core.mjs'), code);
const api = await import('data:text/javascript;base64,' + Buffer.from(code).toString('base64'));
const fixturePath = 'docs/demos/field-rf-ground-v107.json';
const fixtureBytes = readFileSync(fixturePath);
const source = JSON.parse(fixtureBytes).fieldInput;
const infieldPath = 'docs/demos/field-infield-bounce-v108.json';
const infieldBytes = readFileSync(infieldPath);
const clone = value => structuredClone(value);
const rf = clone(source);
rf.occupiedBases.first = '0-b1';
rf.maxPlaySeconds = 30;
rf.frameSeconds = .055;
const lf = clone(source);
lf.occupiedBases.third = '0-b1';
lf.maxPlaySeconds = 30;
lf.frameSeconds = .055;
// A descending fly above the ordinary LF placement. Other actors retain their
// authored placements/body/ability; this does not claim a generated Host pitch.
lf.ball = { originTick: 0, elapsedSeconds: 0, ball: { tick: 0,
  position: { x: -46, y: 8, z: 76 }, velocity: { x: 0, y: -1, z: 0 }, spin: { x: 0, y: 0, z: 0 } } };
const vacant = clone(JSON.parse(infieldBytes)['1'].fieldInput);
vacant.placements['1B'] = { x: -27, y: .9, z: 25 };
vacant.maxPlaySeconds = 30;
vacant.frameSeconds = .055;
const errorMode = process.argv[2]?.startsWith('throw-error-');
const detailMode = process.argv[2] === 'rf-cancellation-detail';
const pairs = [
  { name: 'runner-first-rf-ground', base: rf, role: 'RF', variable: 'throwSpeedMps', value: 30 },
  { name: 'runner-third-lf-fly', base: lf, role: 'LF', variable: 'throwSpeedMps', value: 25 },
  { name: 'vacant-first-cover', base: vacant, role: 'P', variable: 'topSpeedMps', value: 4 },
].filter(p => !process.argv[2] || p.name === process.argv[2] || errorMode && p.name === 'vacant-first-cover'
  || detailMode && p.name === 'runner-first-rf-ground');
assert(pairs.length > 0, 'unknown scene');
function changes(a, b, prefix = '') {
  if (Object.is(a, b)) return [];
  if (a && b && typeof a === 'object' && typeof b === 'object')
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap(k => changes(a[k], b[k], prefix ? prefix + '.' + k : k));
  return [{ path: prefix, before: a, after: b }];
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function movement(result, input) {
  return input.fielders.map(actor => {
    let previous = actor.position, pathMeters = 0;
    const intervals = [];
    for (const frame of result.frames) {
      const f = frame.fielders.find(f => f.playerId === actor.playerId);
      pathMeters += distance(previous, f.position); previous = f.position;
      const prior = intervals.at(-1);
      if (!prior || prior.intent !== f.intent || prior.targetBase !== f.targetBase)
        intervals.push({ fromSeconds: frame.elapsedSeconds, throughSeconds: frame.elapsedSeconds,
          intent: f.intent, targetBase: f.targetBase, from: f.position, to: f.position });
      else { prior.throughSeconds = frame.elapsedSeconds; prior.to = f.position; }
    }
    return { playerId: actor.playerId, role: actor.defensivePosition, bodyModel: actor.bodyModelV105,
      physical: { topSpeedMps: actor.topSpeedMps, accelerationMps2: actor.accelerationMps2, throwSpeedMps: actor.throwSpeedMps },
      start: actor.position, end: previous, sampledHorizontalPathMeters: pathMeters,
      netHorizontalDisplacementMeters: distance(actor.position, previous), intervals,
      ballFacts: result.facts.filter(f => f.playerId === actor.playerId),
      note: 'sampled path is a lower bound; role assignment is not arrival or possession' };
  });
}
const summaries = [];
if (detailMode) {
  const baselineFile = resolve(out, 'runner-first-rf-ground-authored.json'), bytes = readFileSync(baselineFile), baseline = JSON.parse(bytes);
  assert.deepEqual(api.map(rf), baseline.input);
  assert.deepEqual(pins, JSON.parse(readFileSync(resolve(out, 'manifest.json'))).sourcePins);
  const before = JSON.stringify(baseline.input), result = api.simulate(baseline.input);
  assert.equal(JSON.stringify(baseline.input), before);
  assert.deepEqual(result.end, baseline.end);
  assert.deepEqual(result.facts, baseline.facts);
  assert.deepEqual(result.finalRunners, baseline.finalRunners);
  const report = { baseline: 'runner-first-rf-ground-authored.json', baselineSha256: sha(bytes),
    inputUnchanged: true, factsEndAndFinalRunnersIdentical: true, diagnostics: result.diagnostics };
  save('runner-first-rf-ground-cancellation-detail.json', report);
  summaries.push({ scene: 'runner-first-rf-ground', condition: 'identical-diagnostic-followup',
    throwDecisions: result.diagnostics.throwDecisions, cancellations: result.diagnostics.throwEffortCancellationsV103,
    end: result.end, factsEndAndFinalRunnersIdentical: true });
  console.log(JSON.stringify(summaries[0]));
  assert.equal(sha(readFileSync(baselineFile)), sha(bytes));
}
if (errorMode) {
  const ordinal = Number(process.argv[2].slice('throw-error-'.length));
  assert(Number.isSafeInteger(ordinal) && ordinal >= 0);
  const baselineFile = resolve(out, 'vacant-first-cover-authored.json'), baselineBytes = readFileSync(baselineFile), baseline = JSON.parse(baselineBytes);
  assert.deepEqual(api.map(vacant), baseline.input, 'reuse exactly the previously executed normal input');
  const priorManifest = JSON.parse(readFileSync(resolve(out, 'manifest-vacant-first-cover.json')));
  assert.deepEqual(pins, priorManifest.sourcePins, 'paired Core must match baseline');
  const input = { ...clone(baseline.input), executionPerturbationsV95: { throwErrors: [{ releaseOrdinal: ordinal, yawRadians: .18, pitchRadians: 0 }] } };
  assert.deepEqual(changes(baseline.input, input).map(d => d.path), ['executionPerturbationsV95']);
  const before = JSON.stringify(input), started = performance.now(), result = api.simulate(input);
  assert.equal(JSON.stringify(input), before);
  const report = { scene: 'vacant-first-cover', condition: process.argv[2], baseline: 'vacant-first-cover-authored.json', baselineSha256: sha(baselineBytes),
    input, delta: changes(baseline.input, input), runtimeMs: performance.now() - started,
    end: result.end, finalRunners: result.finalRunners, ruleFacts: result.ruleFacts, facts: result.facts,
    nineActors: movement(result, input), telemetry: result.diagnostics.aiTelemetry, diagnostics: result.diagnostics,
    throwCommands: result.diagnostics.throwEffortCommandsV103, throwDirections: result.diagnostics.throwDirectionCommands,
    unresolvedDetail: result.diagnostics.unresolvedDetail, frames: result.frames };
  save('vacant-first-cover-' + process.argv[2] + '.json', report);
  summaries.push({ ...report, input: undefined, frames: undefined, telemetry: undefined,
    runnerDecisions: report.telemetry.runnerDecisions, roleTransitions: report.telemetry.roleTransitions,
    holderDecisions: report.telemetry.holderDecisions, contactDiagnostics: report.telemetry.contactDiagnostics,
    throwTargetCancellations: report.telemetry.throwTargetCancellations });
  console.log(JSON.stringify({ condition: report.condition, end: report.end, facts: report.facts.filter(f =>
    ['throw_release', 'catch_secured', 'runner_base_touch', 'controlled_base_contact'].includes(f.kind)),
    throwDirections: report.throwDirections, finalRunners: report.finalRunners, detail: report.unresolvedDetail }));
  assert.equal(sha(readFileSync(baselineFile)), sha(baselineBytes));
}
for (const pair of errorMode || detailMode ? [] : pairs) {
  const changed = clone(pair.base), index = changed.players.findIndex(p => p.playerId === changed.defense[pair.role]);
  changed.players[index].physical[pair.variable] = pair.value;
  const delta = changes(pair.base, changed);
  assert.equal(delta.length, 1);
  assert.equal(delta[0].path, `players.${index}.physical.${pair.variable}`);
  const reports = [];
  for (const [condition, request] of [['authored', pair.base], [pair.variable === 'throwSpeedMps' ? 'slower-throw' : 'slower-movement', changed]]) {
    const input = api.map(request), before = JSON.stringify(input), started = performance.now();
    const result = api.simulate(input);
    assert.equal(JSON.stringify(input), before);
    assert.equal(result.frames[0].fielders.length, 9);
    const telemetry = result.diagnostics.aiTelemetry;
    const report = { scene: pair.name, condition, delta, request, input, runtimeMs: performance.now() - started,
      end: result.end, finalRunners: result.finalRunners, ruleFacts: result.ruleFacts, facts: result.facts,
      nineActors: movement(result, input),
      telemetry, diagnostics: result.diagnostics, athletic: result.diagnostics.athleticDecisionsV115,
      throwCommands: result.diagnostics.throwEffortCommandsV103,
      unresolvedDetail: result.diagnostics.unresolvedDetail,
      frames: result.frames.map(f => ({ elapsedSeconds: f.elapsedSeconds, ball: f.ball,
        fielders: f.fielders.map(a => ({ playerId: a.playerId, position: a.position, velocity: a.velocity, intent: a.intent, targetBase: a.targetBase })), runners: f.runners })) };
    save(pair.name + '-' + condition + '.json', report);
    const summary = { scene: pair.name, condition, delta, runtimeMs: report.runtimeMs, end: result.end,
      finalRunners: result.finalRunners, flyCatch: result.ruleFacts.flyCatch,
      actions: report.athletic, ballFacts: result.facts.filter(f => ['catch_secured', 'throw_release', 'runner_base_touch', 'controlled_base_contact'].includes(f.kind)),
      runnerDecisions: telemetry.runnerDecisions, holderDecisions: telemetry.holderDecisions,
      relayPlans: telemetry.relayPlans, nineActors: report.nineActors.map(a => ({ role: a.role,
        pathMeters: a.sampledHorizontalPathMeters, end: a.end, intents: [...new Set(a.intervals.map(i => i.intent))] })),
      unresolvedDetail: report.unresolvedDetail };
    summaries.push(summary); reports.push(report);
    console.log(JSON.stringify({ scene: pair.name, condition, runtimeMs: report.runtimeMs, end: result.end,
      secured: result.facts.filter(f => f.kind === 'catch_secured').map(f => ({ t: f.elapsedSeconds, id: f.playerId })),
      throws: result.facts.filter(f => f.kind === 'throw_release').map(f => ({ t: f.elapsedSeconds, id: f.playerId, receiver: f.receiverPlayerId, base: f.base })),
      finalRunners: result.finalRunners, unresolvedDetail: report.unresolvedDetail }));
  }
  const mappedDelta = changes(reports[0].input, reports[1].input);
  assert.equal(mappedDelta.length, 1, 'mapped contrast must still be one scalar');
  assert.match(mappedDelta[0].path, new RegExp('^fielders\\.\\d+\\.' + pair.variable + '$'));
}
for (const [file, hash] of Object.entries(pins)) assert.equal(sha(readFileSync(file)), hash, 'Source changed during audit: ' + file);
assert.equal(sha(readFileSync(fixturePath)), sha(fixtureBytes));
assert.equal(sha(readFileSync(infieldPath)), sha(infieldBytes));
const suffix = process.argv[2] ? '-' + process.argv[2] : '';
save('summary' + suffix + '.json', summaries);
save('manifest' + suffix + '.json', { task: 'MB-20261025-DEFENSE-REFERENCE-AUDIT', runtime: process.version,
  fixture: fixturePath, fixtureSha256: sha(fixtureBytes), bundleSha256: sha(code), sourcePins: pins,
  infieldFixture: infieldPath, infieldFixtureSha256: sha(infieldBytes),
  scenes: pairs.length, simulationCount: summaries.length, checks: ['immutable mapped input', 'nine actors', 'single authored and mapped scalar contrast', 'Source unchanged'],
  calibration: 'existing authored fixture SI; no claim of MLB averages; controller geometry is not a player attribute' });
