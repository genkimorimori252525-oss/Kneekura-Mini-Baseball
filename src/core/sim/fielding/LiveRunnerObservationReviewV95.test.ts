import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from './LiveFieldPlayV1';
import { buildAverageFieldCaseV95, findHeldMultipleAdvancesV95 } from '../../../integration/browser/LiveFieldAverageHarnessV95';

it('keeps a slow batter inside its own observation cutoff when a faster base runner populates the shared bucket first', () => {
  const stored = JSON.parse(readFileSync(new URL('../../../../docs/verification/releases/v95-investigation/runners/ss-overthrow.raw.json', import.meta.url), 'utf8')) as { input: LiveFieldPlayInputV1 },
    input: LiveFieldPlayInputV1 = { ...stored.input, runners: stored.input.runners.map(r => ({ ...r,
      reactionSeconds: r.initialBase === 0 ? .8 : .18 })) }, before = JSON.stringify(input), result = simulateLiveFieldPlayV1(input),
    observations = result.diagnostics.aiTelemetry.runnerObservationsV95;
  expect(result.end.complete).toBe(true);
  expect(observations.some(o => o.reactionSeconds === .8)).toBe(true);
  expect(observations.some(o => o.reactionSeconds === .18)).toBe(true);
  for (const o of observations) expect(o.observedAtSeconds).toBeLessThanOrEqual(o.elapsedSeconds - o.reactionSeconds + 1e-10);
  const release = result.facts.find(f => f.kind === 'throw_release')!;
  expect(release).toBeDefined();
  const seenThrowBySlowBatter = observations.filter(o => o.runnerId === 'runner-0' && o.observedAtSeconds >= release.elapsedSeconds);
  expect(seenThrowBySlowBatter.length).toBeGreaterThan(0);
  expect(seenThrowBySlowBatter[0].elapsedSeconds).toBeGreaterThanOrEqual(release.elapsedSeconds + .8);
  expect(result.diagnostics.playClosure).toMatchObject({ runnerDecisionPending: false, activeRunnerIds: [] });
  expect(result.diagnostics.playClosure.possessedBy).not.toBeNull();
  expect(JSON.stringify(input)).toBe(before);
}, 60_000);

it('contains the routine reference RF ground ball after secure recovery instead of carrying it through an uncontested home circuit', () => {
  const built = buildAverageFieldCaseV95({ caseId: 'RF_ground_pull', seed: 1, bats: 'R', parkRadiusMeters: 110 }),
    result = simulateLiveFieldPlayV1(built.input), batter = result.finalRunners.find(r => r.runnerId === 'runner-0')!;
  expect(result.end.complete).toBe(true);
  expect(result.ruleFacts.flyCatch).toBeNull(); expect(result.ruleFacts.overFence).toBeNull();
  expect(result.facts.some(f => f.kind === 'catch_secured' && f.playerId === 'def-RF')).toBe(true);
  // A single selected, ordinary physical intervention, not a league-frequency
  // target. Errors, weak arms and inaccessible receivers belong in other cases.
  expect(batter.scored).toBe(false);
  expect(findHeldMultipleAdvancesV95({ facts: result.facts, throughSeconds: result.end.elapsedSeconds,
    overFenceAward: false })).toEqual([]);
}, 60_000);

it('limits advances after deep recovery whether a justified return is issued or the holder keeps the ball', () => {
  const saved = JSON.parse(readFileSync(new URL('../../../../docs/verification/releases/v95-investigation/runners/review-deep-final-budget3/deep-retrieved.raw.json', import.meta.url), 'utf8')) as {
    input: LiveFieldPlayInputV1 }, result = simulateLiveFieldPlayV1(saved.input),
    batter = result.finalRunners.find(r => r.runnerId === saved.input.runners.find(s => s.initialBase === 0)!.runnerId)!,
    release = result.facts.find(f => f.kind === 'throw_release')!;
  expect(result.end.complete).toBe(true);
  // This is a legacy synthetic input, not the MLB-average reference. Its real
  // V99 may retain this ball when a further advance is not visible. If it
  // throws, custody must still be real; holding must not prove a free home run.
  if (release) expect(result.facts.some(f => f.kind === 'catch_secured' && f.playerId !== 'fielder-7'
    && f.elapsedSeconds > release.elapsedSeconds)).toBe(true);
  else expect(result.diagnostics.aiTelemetry.holderDecisions.some(d => d.state === 'hold_no_positive_margin')).toBe(true);
  expect(batter).toMatchObject({ retired: false, scored: false });
  expect(batter.base).toBeLessThan(4);
}, 60_000);

it.each([
  { name: 'deep RF catch', file: 'fly-probes/deep-RF-17-22-25.json' },
  { name: 'middle RF catch', file: 'fly-probe-fourth/middle-RF-16-21-24.json' },
])('separates a supported third-base attempt from an uncertified home commitment after $name', ({ name, file }) => {
  const path = new URL('../../../../docs/verification/releases/v95-investigation/' + file, import.meta.url),
    bytes = readFileSync(path), saved = JSON.parse(bytes.toString('utf8')) as { input: LiveFieldPlayInputV1 },
    sha = (value: string | Buffer) => createHash('sha256').update(value).digest('hex'),
    before = sha(JSON.stringify(saved.input)), result = simulateLiveFieldPlayV1(saved.input),
    runner = result.finalRunners.find(r => r.runnerId === 'runner-2')!, spec = saved.input.runners.find(r => r.runnerId === runner.runnerId)!,
    caught = result.ruleFacts.flyCatch!, secured = result.facts.find(f => f.kind === 'catch_secured' && f.playerId === 'def-RF')!,
    observations = result.diagnostics.aiTelemetry.runnerObservationsV95.filter(o => o.runnerId === runner.runnerId),
    decisions = result.diagnostics.aiTelemetry.runnerDecisions.filter(d => d.runnerId === runner.runnerId),
    advance = decisions.find(d => d.advance)!;
  expect(result.end.complete).toBe(true); expect(caught.fielderId).toBe('def-RF');
  // V103 charges each relay leg using the same raw output/transfer model as
  // execution. Its finite return is later than this runner's third-base touch;
  // the old V95 blanket hold at second conflicts with that supported race.
  expect(advance).toMatchObject({ targetBase: 3, reason: 'safe_race_advance' });
  expect(advance.elapsedSeconds).toBeGreaterThan(secured.elapsedSeconds);
  expect(advance.defenderControlSeconds).not.toBeNull(); expect(advance.runnerArrivalSeconds).not.toBeNull();
  expect(advance.raceMarginSeconds!).toBeGreaterThan(spec.advanceSafetyMarginSeconds ?? .35);
  expect(advance.defenderControlSeconds! - advance.runnerArrivalSeconds!).toBe(advance.raceMarginSeconds);
  const advanceObservation = observations.find(o => o.elapsedSeconds === advance.elapsedSeconds && o.targetBase === 3)!;
  expect(advanceObservation.route).toBe('relay');
  expect(advanceObservation.observedAtSeconds).toBeGreaterThanOrEqual(secured.elapsedSeconds);
  for (const row of observations) expect(row.observedAtSeconds).toBeLessThanOrEqual(row.elapsedSeconds - spec.reactionSeconds + 1e-10);
  expect(decisions.filter(d => d.reason === 'no_defense_forecast').every(d => !d.advance && d.defenderControlSeconds === null)).toBe(true);
  const motions = result.diagnostics.aiTelemetry.runnerMotions.filter(m => m.runnerId === runner.runnerId),
    homeMotions = motions.filter(m => m.throughBases.includes(4)),
    thirdTouch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runner.runnerId && f.base === 3)!,
    homeTouch = result.facts.find(f => f.kind === 'runner_base_touch' && f.runnerId === runner.runnerId && f.base === 4);
  expect(thirdTouch).toBeDefined();
  expect(result.ruleFacts.runnerTouches).toContainEqual({ kind: 'runner_base_touch', runnerId: runner.runnerId, base: 3, tick: thirdTouch.tick });
  // The uncertified C1 gap cannot justify rolling second-to-home. A later
  // departure from third needs its own newly observed, finite safe race.
  for (const motion of homeMotions) {
    expect(motion.throughBases).toEqual([4]); expect(motion.elapsedSeconds).toBeGreaterThan(thirdTouch.elapsedSeconds);
    const homeDecision = decisions.find(d => d.elapsedSeconds === motion.elapsedSeconds && d.targetBase === 4 && d.advance)!,
      observation = observations.find(o => o.elapsedSeconds === motion.elapsedSeconds && o.targetBase === 4)!;
    expect(homeDecision.reason).toBe('safe_race_advance');
    expect(Number.isFinite(homeDecision.defenderControlSeconds)).toBe(true);
    expect(homeDecision.raceMarginSeconds!).toBeGreaterThan(spec.advanceSafetyMarginSeconds ?? .35);
    expect(homeDecision.defenderControlSeconds! - homeDecision.runnerArrivalSeconds!).toBe(homeDecision.raceMarginSeconds);
    expect(observation.controlSeconds).toBe(homeDecision.defenderControlSeconds);
    expect(observation.observedAtSeconds).toBeLessThanOrEqual(motion.elapsedSeconds - spec.reactionSeconds + 1e-10);
  }
  if (runner.scored) {
    expect(homeMotions.length).toBeGreaterThan(0); expect(homeTouch).toBeDefined();
    expect(homeTouch!.tick).toBeGreaterThan(thirdTouch.tick);
    expect(result.ruleFacts.runnerTouches).toContainEqual({ kind: 'runner_base_touch', runnerId: runner.runnerId, base: 4, tick: homeTouch!.tick });
    expect(runner).toMatchObject({ base: 4, retired: false, retouchRequiredBase: null });
  } else expect(runner).toMatchObject({ base: 3, retired: false, scored: false });
  if (name === 'deep RF catch') {
    const afterCatch = observations.filter(o => o.elapsedSeconds > advance.elapsedSeconds && o.targetBase === 4),
      uncertain = afterCatch.find(o => o.controlSeconds === null)!,
      recovered = afterCatch.find(o => o.elapsedSeconds > uncertain.elapsedSeconds && o.controlSeconds !== null)!;
    expect(uncertain).toBeDefined(); expect(recovered).toBeDefined();
    expect(homeMotions.some(m => m.elapsedSeconds >= uncertain.elapsedSeconds && m.elapsedSeconds < recovered.elapsedSeconds)).toBe(false);
  }
  const after = sha(JSON.stringify(saved.input)); expect(after).toBe(before); expect(sha(readFileSync(path))).toBe(sha(bytes));
  if (process.env.FIELDING_DIAG_REPORT === '1') console.info(JSON.stringify({ case: name, sourceSha256: sha(bytes), inputShaBefore: before,
    inputShaAfter: after, firstCatchSeconds: secured.elapsedSeconds, advance, advanceObservation, finalRunner: runner,
    homeMotions: homeMotions.map(m => ({ elapsedSeconds: m.elapsedSeconds, throughBases: m.throughBases })),
    homeDecisions: decisions.filter(d => d.advance && d.targetBase === 4), thirdTouch, homeTouch }));
}, 60_000);
