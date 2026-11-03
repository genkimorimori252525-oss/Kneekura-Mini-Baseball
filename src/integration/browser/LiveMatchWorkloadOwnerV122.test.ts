import { expect, it } from 'vitest';
import { createLiveMatchWorkloadOwnerV122 } from './LiveMatchWorkloadOwnerV122';

const config = () => ({ version: 'live_match_workload_v122' as const, sessionId: 'session', matchId: 'match', managerId: 'manager', players: [{
  context: { sourceId: 'pitcher-workload', sourceVersion: 'v1', scope: { sessionId: 'session', matchId: 'match', careerId: 'career', playerId: 'pitcher', gameDay: 10 },
    baseline: { careerId: 'career', playerId: 'pitcher', createdAtDay: 1, fatigue: .2, recoveryCapacity: .5,
      policy: { policyId: 'workload', version: 'v1', availableAtDay: 0, workloadFatiguePerUnit: .1, travelFatiguePerKm: .001, recoveryPerHour: .1 } },
    activities: [], expectedRevision: 0 },
  timingProfile: { baseStartIntervalUs: 10000000, normalMotionToReleaseUs: 600000, followThroughUs: 200000,
    quickSpeedFactor: 1.8, cadenceExecutionControl: .8, cadenceTimingKnowledge: .8, quickRepeatability: .8, naturalVariationUs: 50000,
    normalPhaseWeights: { gather: 2, transition: 3, stride: 5 }, quickPhaseWeights: { gather: 1, transition: 2, stride: 3 } },
  pitchPolicy: { policyId: 'pitch-response', version: 'v1', availableAtDay: 1,
    motionDurationScaleAtFullFatigue: 1.5, velocityRetentionAtFullFatigue: .5, spinRetentionAtFullFatigue: .75 }, effortUnitsPerPitch: 1 }] });
const playerIds = ['pitcher', 'other-player'];
const owner = () => createLiveMatchWorkloadOwnerV122({ config: config(), playerIds, pitchCount: 0 });

it('preflights without consuming workload and commits only after an accepted pitch', () => {
  const o = owner(), before = JSON.stringify(o.capture()), rejected = o.candidateActivity('pitcher', 1);
  expect(JSON.stringify(o.capture())).toBe(before);
  const accepted = o.candidateActivity('pitcher', 1); o.commitAfterAccepted(accepted);
  expect(o.readForPitch('pitcher')!.workload.state.fatigue).toBeCloseTo(.3);
  expect(o.readForPitch('pitcher')!.workload.state.revision).toBe(1);
  expect(() => o.commitAfterAccepted(rejected)).toThrow();
  expect(() => o.commitAfterAccepted(accepted)).toThrow();
  expect(() => o.candidateActivity('pitcher', 1)).toThrow();
  expect(() => o.candidateActivity('missing', 2)).toThrow();
  expect(o.readForPitch('other-player')).toBeUndefined();
});

it('matches continuous execution after JSON resume without copying generated activity history', () => {
  const c = config(), original = JSON.stringify(c), continuous = createLiveMatchWorkloadOwnerV122({ config: c, playerIds, pitchCount: 0 });
  continuous.commitAfterAccepted(continuous.candidateActivity('pitcher', 1));
  continuous.commitAfterAccepted(continuous.candidateActivity('other-player', 2));
  const saved = JSON.parse(JSON.stringify(continuous.capture())), resumed = createLiveMatchWorkloadOwnerV122({ config: c,
    playerIds: [...playerIds].reverse(), pitchCount: 2, continuation: saved });
  for (let n = 3; n <= 10; n++) for (const current of [continuous, resumed])
    current.commitAfterAccepted(current.candidateActivity('pitcher', n));
  expect(resumed.capture()).toEqual(continuous.capture());
  expect(resumed.capture().lastAcceptedPitchNumber).toBe(10);
  expect(resumed.capture().players[0].acceptedPitchCount).toBe(9);
  expect(resumed.capture().players[0]).not.toHaveProperty('activities');
  expect(resumed.capture().players[0].workload).not.toHaveProperty('context');
  expect(JSON.stringify(c)).toBe(original);
  expect(Object.isFrozen(resumed.readForPitch('pitcher')!.policy)).toBe(true);
});

it('rejects foreign, stale and forged candidate tokens while preserving both owners', () => {
  const a = owner(), b = owner(), candidate = a.candidateActivity('pitcher', 1), before = JSON.stringify(b.capture());
  expect(() => b.commitAfterAccepted(candidate)).toThrow();
  expect(() => a.commitAfterAccepted(JSON.parse(JSON.stringify(candidate)))).toThrow();
  expect(JSON.stringify(b.capture())).toBe(before);
  a.commitAfterAccepted(candidate); expect(b.capture().lastAcceptedPitchNumber).toBe(0);
});

it('rejects existing activity ID collisions before the accepted pitch is produced', () => {
  const o = owner(), candidate = o.candidateActivity('pitcher', 1), c = config();
  const activity = { ...candidate.activity!, effortUnits: 0 };
  const changed = { ...c, players: [{ ...c.players[0], context: { ...c.players[0].context,
    activities: [{ expectedRevision: 0, activity }], expectedRevision: 1 } }] };
  const withPrior = createLiveMatchWorkloadOwnerV122({ config: changed, playerIds, pitchCount: 0 }), before = JSON.stringify(withPrior.capture());
  expect(() => withPrior.candidateActivity('pitcher', 1)).toThrow();
  expect(JSON.stringify(withPrior.capture())).toBe(before);
});

it('binds resume to exact config, participants, scope, policy, revision and Host pitch count', () => {
  const o = owner(); o.commitAfterAccepted(o.candidateActivity('pitcher', 1));
  const saved = o.capture(), c = config();
  expect(() => createLiveMatchWorkloadOwnerV122({ config: c, playerIds, pitchCount: 2, continuation: saved })).toThrow();
  expect(() => createLiveMatchWorkloadOwnerV122({ config: c, playerIds: ['pitcher'], pitchCount: 1, continuation: saved })).toThrow();
  expect(() => createLiveMatchWorkloadOwnerV122({ config: { ...c, players: [{ ...c.players[0], effortUnitsPerPitch: 2 }] }, playerIds, pitchCount: 1, continuation: saved })).toThrow();
  for (const mutate of [
    (s: typeof saved) => { (s as any).sessionId = 'other'; },
    (s: typeof saved) => { (s as any).players[0].acceptedPitchCount = 0; },
    (s: typeof saved) => { (s as any).players[0].workload.state.policy.version = 'other'; },
    (s: typeof saved) => { (s as any).players[0].workload.state.revision = 9; },
  ]) { const corrupt = JSON.parse(JSON.stringify(saved)); mutate(corrupt);
    expect(() => createLiveMatchWorkloadOwnerV122({ config: c, playerIds, pitchCount: 1, continuation: corrupt })).toThrow(); }
});

it('validates initial explicit scopes, policy, real players and baseline history once', () => {
  const c = config();
  for (const bad of [{ ...c, players: [c.players[0], c.players[0]] },
    { ...c, sessionId: 'other' }, { ...c, players: [{ ...c.players[0], effortUnitsPerPitch: -1 }] },
    { ...c, players: [{ ...c.players[0], pitchPolicy: { ...c.players[0].pitchPolicy, availableAtDay: 11 } }] },
    { ...c, players: [{ ...c.players[0], context: { ...c.players[0].context, expectedRevision: 1 } }] }])
    expect(() => createLiveMatchWorkloadOwnerV122({ config: bad, playerIds, pitchCount: 0 })).toThrow();
  expect(() => createLiveMatchWorkloadOwnerV122({ config: c, playerIds: ['other-player'], pitchCount: 0 })).toThrow();
  expect(() => createLiveMatchWorkloadOwnerV122({ config: c, playerIds, pitchCount: 1 })).toThrow();
  let calls = 0;
  expect(() => createLiveMatchWorkloadOwnerV122({ config: Object.defineProperty({ ...c }, 'players', { enumerable: true, get: () => { calls++; return c.players; } }), playerIds, pitchCount: 0 })).toThrow();
  expect(calls).toBe(0);
});
