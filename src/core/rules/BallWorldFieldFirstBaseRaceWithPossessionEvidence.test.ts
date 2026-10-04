import { expect, it } from 'vitest';
import type { BallWorldMoment } from '../sim/ball/BallWorldContinuation';
import { quantizeEventTick } from '../sim/ExactEventTime';
import type { BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import { deriveBallWorldFieldFirstBaseRace } from './BallWorldFieldFirstBaseRace';
import type { BallWorldFirstBaseRaceInput } from './BallWorldFirstBaseRace';
import {
  deriveBallWorldFieldFirstBaseRaceWithPossessionEvidence as derive,
  type BallWorldFieldFirstBaseRaceWithPossessionEvidenceInput as Input,
  type BattedWorldPossessionEvidence,
  type PendingFieldPossession,
  type BaseTouchCustodyEvidence,
} from './BallWorldFieldFirstBaseRaceWithPossessionEvidence';

const frequency = 1_000_000, secure = 0.0625001, fence = 0.062501;
const moment = (at: number, z = 60): BallWorldMoment => ({ originTick: 0, elapsedSeconds: at,
  ball: { tick: quantizeEventTick(0, at, frequency), position: { x: 0, y: 0.036, z },
    velocity: { x: 1, y: 0, z: 1 }, spin: { x: 0, y: 0, z: 0 } } });
const ground = (at = 0.01, z = 60): BallWorldBattedRuleContactFrame => ({ moment: moment(at, z), contacts: [{ kind: 'ground' }] });
const glove = (at = 0.02, playerId = 'defender'): BallWorldBattedRuleContactFrame => ({ moment: moment(at),
  contacts: [{ kind: 'actor', playerId, role: 'glove' }] });
const history = (playerId: string, at: number | null, through: number): BallWorldFirstBaseRaceInput['runnerHistory'] => ({
  playerId, originTick: 0, ticksPerSecond: frequency, startElapsedSeconds: 0, endElapsedSeconds: through,
  contactAtStart: at === 0, contactAtHorizon: at !== null,
  episodes: at === null ? [] : [{ startElapsedSeconds: at, endElapsedSeconds: through }],
  events: at === null ? [] : [{ kind: 'touch', originTick: 0, elapsedSeconds: at, tick: quantizeEventTick(0, at, frequency) }],
});
const pending = (changes: Partial<PendingFieldPossession> = {}): PendingFieldPossession => ({
  planSourceId: 'capture-plan', playerId: 'defender', contactElapsedSeconds: 0.02,
  phase: 'fence_pending', earliestPotentialControlElapsedSeconds: secure, ...changes,
});
const query = (options: Readonly<{ through?: number; runnerAt?: number | null; controlAt?: number | null;
  contacts?: readonly BallWorldBattedRuleContactFrame[]; pending?: readonly PendingFieldPossession[] }> = {}): Input => {
  const through = options.through ?? 0.0625003;
  const runnerAt = options.runnerAt === undefined ? 0.0625002 : options.runnerAt;
  const controlAt = options.controlAt ?? null;
  return {
    field: { evidence: { batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: frequency,
      field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: Math.SQRT1_2, z: Math.SQRT1_2 },
        thirdBaseLineUnit: { x: -Math.SQRT1_2, z: Math.SQRT1_2 } },
      bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 27, z: 27 }, secondBase: { x: 0, z: 54 }, thirdBase: { x: -27, z: 27 } },
      ballRadiusMeters: 0.036, horizon: moment(through), contacts: options.contacts ?? [ground(), glove()], acquisitions: [] }, baseContacts: [] },
    race: { outsAtStart: 0, batterRunnerId: 'batter', defenderIds: ['defender'], originTick: 0, ticksPerSecond: frequency,
      horizonElapsedSeconds: through, runnerHistory: history('batter', runnerAt, through),
      defenders: [{ history: history('defender', 0, through), controlledContacts: controlAt === null ? [] : [
        { playerId: 'defender', originTick: 0, elapsedSeconds: controlAt, tick: quantizeEventTick(0, controlAt, frequency) }] }] },
    possessionEvidence: { policy: 'scheduled_capture_confirmation_v1', originTick: 0, ticksPerSecond: frequency,
      throughElapsedSeconds: through, pending: options.pending ?? [pending()] },
  };
};
const legacy = (input: Input) => deriveBallWorldFieldFirstBaseRace({ field: input.field, race: input.race });

it('withholds false SAFE inside the exact capture fence without fabricating contact or erasing fair-ground evidence', () => {
  const input = query(), prior = legacy(input), result = derive(input);
  expect(prior.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('safe');
  expect(input.race.defenders[0].controlledContacts).toEqual([]);
  expect(result.groundRule).toBe(null);
  expect(result.possessionGuard).toEqual({ blocked: true, earliestPotentialControlElapsedSeconds: secure });
  expect(result.possessionEvidence).toEqual(input.possessionEvidence);
  expect(result.fieldTerritory).toEqual(prior.fieldTerritory);
  expect(result.ballEvidence).toEqual(prior.ballEvidence);
  expect(result.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
  expect(result.ballDecisionMoment).toEqual(prior.ballDecisionMoment);
  expect(result.firstGroundMoment).toEqual(prior.firstGroundMoment);
  expect(result.pendingContacts).toEqual([]);
  expect(Object.keys(result).sort()).toEqual([...Object.keys(prior), 'possessionEvidence', 'possessionGuard'].sort());
  expect(JSON.stringify(result)).not.toContain('"kind":"safe"');
});

it('allows the unchanged race to prove OUT at the original secure time when no possession gap remains', () => {
  const input = query({ through: fence, controlAt: secure, pending: [] }), result = derive(input);
  expect(result.groundRule).toEqual(legacy(input).groundRule);
  expect(result.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('out');
  expect(result.groundRule?.actualChronology.decisionMoment?.elapsedSeconds).toBe(secure);
  expect(result.possessionEvidence.throughElapsedSeconds).toBe(fence);
  expect(result.possessionGuard).toEqual({ blocked: false, earliestPotentialControlElapsedSeconds: null });
});

it.each(['safe', 'out'] as const)('preserves %s whose complete decisive prerequisites are strictly before the cutoff', (kind) => {
  const input = query({ runnerAt: kind === 'safe' ? 0.04 : 0.05, controlAt: kind === 'out' ? 0.04 : null });
  const result = derive(input);
  expect(result.groundRule).toEqual(legacy(input).groundRule);
  expect(result.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe(kind);
  expect(result.possessionGuard).toEqual({ blocked: false, earliestPotentialControlElapsedSeconds: secure });
});

it.each(['safe', 'out'] as const)('preserves strictly earlier %s within the same recorded tick as the cutoff', (kind) => {
  const earlier = 0.06250005;
  const input = query({ runnerAt: kind === 'safe' ? earlier : 0.0625002, controlAt: kind === 'out' ? earlier : null });
  expect(quantizeEventTick(0, earlier, frequency)).toBe(quantizeEventTick(0, secure, frequency));
  const result = derive(input);
  expect(result.groundRule).toEqual(legacy(input).groundRule);
  expect(result.groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe(kind);
  expect(result.possessionGuard.blocked).toBe(false);
});

it.each(['safe', 'out', 'simultaneous'] as const)('withholds %s at exact equality with the potential-control cutoff', (kind) => {
  const input = query({ runnerAt: kind === 'out' ? 0.0625002 : secure, controlAt: kind === 'safe' ? null : secure });
  expect(legacy(input).groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe(kind);
  const result = derive(input);
  expect(result.groundRule).toBe(null);
  expect(result.possessionGuard.blocked).toBe(true);
});

it('keeps a future potential-control deadline as metadata while capturing and preserves an earlier SAFE', () => {
  const input = query({ through: 0.05, runnerAt: 0.04, pending: [pending({ phase: 'capturing' })] });
  expect(derive(input).groundRule).toEqual(legacy(input).groundRule);
  expect(derive(input).possessionGuard.blocked).toBe(false);
});

it('allows an unexecuted zero-load capture plan at its current exact contact horizon without asserting custody', () => {
  const input = query({ through: 0.02, runnerAt: 0.02,
    pending: [pending({ phase: 'capturing', earliestPotentialControlElapsedSeconds: 0.02 })] });
  const result = derive(input);
  expect(result.groundRule).toBe(null);
  expect(result.possessionGuard).toEqual({ blocked: true, earliestPotentialControlElapsedSeconds: 0.02 });
  expect(input.race.defenders[0].controlledContacts).toEqual([]);
});

it('keeps the original cutoff after a later same-tick competing contact', () => {
  const collision: BallWorldBattedRuleContactFrame = { moment: moment(0.0625004), contacts: [{ kind: 'surface', surfaceId: 'wall' }] };
  const input = query({ through: 0.0625004, contacts: [ground(), glove(), collision],
    pending: [pending({ phase: 'contact_policy_pending' })] });
  expect(legacy(input).groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('safe');
  const result = derive(input);
  expect(result.groundRule).toBe(null);
  expect(result.possessionGuard.blocked).toBe(true);
  expect(result.pendingContacts).toEqual([{ elapsedSeconds: 0.0625004, tick: 62501, reason: 'surface_policy_pending' }]);
});

it('retains a conservative pre-secure interruption cutoff without claiming alternative control', () => {
  const collision: BallWorldBattedRuleContactFrame = { moment: moment(0.04), contacts: [{ kind: 'actor', playerId: 'defender', role: 'body' }] };
  const input = query({ through: 0.05, runnerAt: 0.045, contacts: [ground(), glove(), collision],
    pending: [pending({ phase: 'contact_policy_pending', earliestPotentialControlElapsedSeconds: 0.04 })] });
  expect(legacy(input).groundRule?.correctRuleResult.batterRunnerFirstBase.kind).toBe('safe');
  expect(derive(input).groundRule).toBe(null);
  expect(derive(input).pendingContacts).toEqual([]);
});

it('uses the fair-territory decision as a prerequisite even when runner touch was earlier', () => {
  const input = query({ runnerAt: 0.015, contacts: [ground(0.01, 10), glove(0.02)],
    pending: [pending({ earliestPotentialControlElapsedSeconds: 0.02 })] });
  expect(legacy(input).ballDecisionMoment?.elapsedSeconds).toBe(0.02);
  expect(legacy(input).groundRule?.actualChronology.decisionMoment?.elapsedSeconds).toBe(0.015);
  expect(derive(input).groundRule).toBe(null);
  expect(derive(input).possessionGuard.blocked).toBe(true);
});

it('uses the actual first-ground time even when fair territory and race were earlier', () => {
  const input = query({ runnerAt: 0.015, contacts: [glove(0.01), ground(0.03)],
    pending: [pending({ contactElapsedSeconds: 0.01, earliestPotentialControlElapsedSeconds: 0.02 })] });
  expect(legacy(input).ballDecisionMoment?.elapsedSeconds).toBe(0.01);
  expect(legacy(input).firstGroundMoment?.elapsedSeconds).toBe(0.03);
  expect(derive(input).groundRule).toBe(null);
  expect(derive(input).possessionGuard.blocked).toBe(true);
});

it('retains unresolved eligibility and actual contact gaps without claiming this guard suppressed a result', () => {
  const collision: BallWorldBattedRuleContactFrame = { moment: moment(0.03), contacts: [{ kind: 'surface', surfaceId: 'wall' }] };
  for (const contacts of [[glove()], [ground(), glove(), collision]]) {
    const input = query({ contacts }), prior = legacy(input), result = derive(input);
    expect(prior.groundRule).toBe(null);
    expect(result).toEqual({ ...prior, possessionEvidence: input.possessionEvidence,
      possessionGuard: { blocked: false, earliestPotentialControlElapsedSeconds: secure } });
  }
});

it('uses the executed horizon for an offered unresolved race with no decision moment', () => {
  const input = query({ runnerAt: null }), prior = legacy(input);
  expect(prior.groundRule?.correctRuleResult.kind).toBe('unresolved');
  expect(prior.groundRule?.actualChronology.decisionMoment).toBe(null);
  expect(derive(input).groundRule).toBe(null);
  expect(derive(input).possessionGuard.blocked).toBe(true);
});

it('returns detached frozen evidence without freezing or mutating inputs', () => {
  const input = query(), before = JSON.stringify(input), result = derive(input);
  expect(JSON.stringify(input)).toBe(before);
  expect(result.possessionEvidence).not.toBe(input.possessionEvidence);
  expect(result.possessionEvidence.pending[0]).not.toBe(input.possessionEvidence.pending[0]);
  expect(Object.isFrozen(result)).toBe(true);
  expect(Object.isFrozen(result.possessionEvidence.pending[0])).toBe(true);
  expect(Object.isFrozen(result.possessionGuard)).toBe(true);
  expect(Object.isFrozen(input.possessionEvidence.pending[0])).toBe(false);
  const custody: BaseTouchCustodyEvidence = { status: 'bounded_unconfirmed', originTick: 0, ticksPerSecond: frequency,
    throughElapsedSeconds: input.possessionEvidence.throughElapsedSeconds, pending: result.possessionEvidence.pending };
  expect(custody.pending).toEqual(input.possessionEvidence.pending);
});

it.each(['missing', 'null', 'injected_result', 'unknown_key'])('rejects %s wrapper scope', (kind) => {
  const input = query(), { possessionEvidence: _evidence, ...rest } = input;
  const changed = kind === 'missing' ? rest : kind === 'null' ? { ...input, possessionEvidence: null }
    : { ...input, [kind === 'injected_result' ? 'groundRule' : 'unknown']: true };
  expect(() => derive(changed as Input)).toThrow();
});

it.each(['policy', 'origin', 'frequency', 'horizon', 'negative_horizon', 'nonfinite_horizon', 'missing_key', 'extra_key', 'pending_not_array'])(
  'rejects %s possession envelope', (kind) => {
    const input = query(), original = input.possessionEvidence;
    const { originTick: _origin, ...withoutOrigin } = original;
    const evidence = kind === 'policy' ? { ...original, policy: 'caller_confirmed' }
      : kind === 'origin' ? { ...original, originTick: 1 }
        : kind === 'frequency' ? { ...original, ticksPerSecond: 2_000_000 }
          : kind === 'horizon' ? { ...original, throughElapsedSeconds: fence }
            : kind === 'negative_horizon' ? { ...original, throughElapsedSeconds: -1 }
              : kind === 'nonfinite_horizon' ? { ...original, throughElapsedSeconds: Infinity }
                : kind === 'missing_key' ? withoutOrigin : kind === 'extra_key' ? { ...original, confirmed: true }
                  : { ...original, pending: {} };
    expect(() => derive({ ...input, possessionEvidence: evidence as BattedWorldPossessionEvidence })).toThrow();
  });

it.each(['empty_plan', 'spaced_plan', 'unknown_player', 'batter', 'phase', 'negative_contact', 'future_contact', 'missing_contact',
  'negative_cutoff', 'nonfinite_cutoff', 'cutoff_before_contact', 'missing_key', 'extra_key', 'capturing_after_deadline',
  'fence_before_deadline', 'interruption_before_deadline'])(
  'rejects %s pending possession evidence', (kind) => {
    const input = query(), original = pending(), { phase: _phase, ...withoutPhase } = original;
    const changed = kind === 'empty_plan' ? { ...original, planSourceId: '' }
      : kind === 'spaced_plan' ? { ...original, planSourceId: ' capture-plan ' }
        : kind === 'unknown_player' ? { ...original, playerId: 'other' }
          : kind === 'batter' ? { ...original, playerId: 'batter' }
            : kind === 'phase' ? { ...original, phase: 'secured' }
              : kind === 'negative_contact' ? { ...original, contactElapsedSeconds: -0.01 }
                : kind === 'future_contact' ? { ...original, contactElapsedSeconds: fence }
                  : kind === 'missing_contact' ? { ...original, contactElapsedSeconds: 0.03 }
                    : kind === 'negative_cutoff' ? { ...original, earliestPotentialControlElapsedSeconds: -0.01 }
                      : kind === 'nonfinite_cutoff' ? { ...original, earliestPotentialControlElapsedSeconds: NaN }
                        : kind === 'cutoff_before_contact' ? { ...original, earliestPotentialControlElapsedSeconds: 0.01 }
                          : kind === 'missing_key' ? withoutPhase : kind === 'extra_key' ? { ...original, confirmed: true }
                            : kind === 'capturing_after_deadline' ? { ...original, phase: 'capturing' }
                              : { ...original, phase: kind === 'fence_before_deadline' ? 'fence_pending' : 'contact_policy_pending',
                                earliestPotentialControlElapsedSeconds: 0.1 };
    expect(() => derive({ ...input, possessionEvidence: { ...input.possessionEvidence, pending: [changed as PendingFieldPossession] } })).toThrow();
  });

it.each(['body', 'other_player', 'ground'] as const)('requires an actual owned glove frame rather than %s at the asserted contact time', (kind) => {
  const contact: BallWorldBattedRuleContactFrame = { moment: moment(0.02), contacts: kind === 'ground' ? [{ kind: 'ground' }]
    : [{ kind: 'actor', playerId: kind === 'other_player' ? 'batter' : 'defender', role: kind === 'body' ? 'body' : 'glove' }] };
  expect(() => derive(query({ contacts: [ground(), contact] }))).toThrow();
});

it.each(['plan', 'player', 'both'])('rejects duplicate pending %s scope', (kind) => {
  const input = query({ contacts: [ground(), glove(), glove(0.03, 'second-defender')] });
  const second = pending({ planSourceId: kind === 'player' ? 'second-plan' : 'capture-plan',
    playerId: kind === 'plan' ? 'second-defender' : 'defender', contactElapsedSeconds: kind === 'plan' ? 0.03 : 0.02 });
  const changed: Input = { ...input, field: { ...input.field, evidence: { ...input.field.evidence, defenderIds: ['defender', 'second-defender'] } },
    race: { ...input.race, defenderIds: ['defender', 'second-defender'], defenders: [...input.race.defenders,
      { history: history('second-defender', 0, input.race.horizonElapsedSeconds), controlledContacts: [] }] },
    possessionEvidence: { ...input.possessionEvidence, pending: [pending(), second] } };
  expect(() => derive(changed)).toThrow();
});

it('uses the earliest cutoff across independently scoped pending defenders without inspecting future foot contacts', () => {
  const input = query({ runnerAt: 0.05, contacts: [ground(), glove(), glove(0.03, 'second-defender')] });
  const changed: Input = { ...input, field: { ...input.field, evidence: { ...input.field.evidence, defenderIds: ['defender', 'second-defender'] } },
    race: { ...input.race, defenderIds: ['defender', 'second-defender'], defenders: [...input.race.defenders,
      { history: history('second-defender', null, input.race.horizonElapsedSeconds), controlledContacts: [] }] },
    possessionEvidence: { ...input.possessionEvidence, pending: [pending(), pending({ planSourceId: 'second-plan',
      playerId: 'second-defender', contactElapsedSeconds: 0.03, earliestPotentialControlElapsedSeconds: 0.04 })] } };
  expect(derive(changed).possessionGuard).toEqual({ blocked: true, earliestPotentialControlElapsedSeconds: 0.04 });
});

it.each(['scope', 'frame_metadata', 'controlled_contact', 'defender_metadata'])(
  'retains original adapter validation for %s even when the possession guard would suppress the race', (kind) => {
    const input = query();
    const changed = kind === 'scope' ? { ...input, race: { ...input.race, originTick: 1 } }
      : kind === 'frame_metadata' ? { ...input, field: { ...input.field, evidence: { ...input.field.evidence,
        contacts: [ground(), { ...glove(), moment: { ...moment(0.02), held: true } }] } } }
        : kind === 'controlled_contact' ? { ...input, race: { ...input.race, defenders: [{ ...input.race.defenders[0],
          controlledContacts: [{ playerId: 'defender', originTick: 0, elapsedSeconds: 0.03, tick: 1 }] }] } }
          : { ...input, race: { ...input.race, defenders: [{ ...input.race.defenders[0], custodyEvidence: {} }] } };
    expect(() => derive(changed as Input)).toThrow();
  });
