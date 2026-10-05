import { describe, expect, it } from 'vitest';
import { NPB_2026_RULE_PROFILE } from './RuleProfile';
import { deriveBallWorldFieldTerritory, type BallWorldFieldTerritoryInput } from './BallWorldFieldTerritory';
import type { BallWorldBattedRuleContactFrame } from './BallWorldBattedRuleEvidence';
import type { BallWorldBaseBoundaryContact } from '../sim/ball/BallWorldBaseBoundary';
import type { BattedWorldAcquisition } from '../sim/ball/BattedWorldAcquisition';
import { battedWorldBaseSurfaceId } from '../sim/ball/BattedWorldFieldMotion';
import { createSecuredCatchOutcome } from '../sim/fielding/CatchOutcome';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { deriveBallWorldSettledFoulDeadEvidence as derive } from './BallWorldSettledFoulDeadEvidence';

// Proposed test-first contract only. Runtime is held; no RED has been observed.
// These small Core frames exercise rule composition, not Native ownership or venue calibration.
const vector = (x: number, y: number, z: number) => ({ x, y, z });
const moment = (elapsedSeconds: number, x: number, stationary = false, ticksPerSecond = 1_000_000) => ({
  originTick: 0, elapsedSeconds,
  ball: { tick: quantizeEventTick(0, elapsedSeconds, ticksPerSecond),
    position: vector(x, 0.1, 1), velocity: vector(stationary ? 0 : -1, 0, 0), spin: vector(0, 0, 0) },
});
const query = (fair = false, ticksPerSecond = 1_000_000) => {
  const incoming = moment(0, fair ? 1 : -1, false, ticksPerSecond);
  const ground = fair ? { ...incoming, ball: { ...incoming.ball, velocity: vector(1, 0, 0) } } : incoming;
  const stop = moment(0.5, fair ? 1.25 : -1.25, true, ticksPerSecond);
  const field: BallWorldFieldTerritoryInput = {
    evidence: { batterRunnerId: 'batter', defenderIds: ['defender'],
      field: { homePlate: { x: 0, z: 0 }, firstBaseLineUnit: { x: 1, z: 0 }, thirdBaseLineUnit: { x: 0, z: 1 } },
      bases: { homePlate: { x: 0, z: 0 }, firstBase: { x: 2, z: 0 },
        secondBase: { x: 2, z: 2 }, thirdBase: { x: 0, z: 2 } },
      ballRadiusMeters: 0.1, originTick: 0, ticksPerSecond, horizon: stop, acquisitions: [],
      contacts: [{ moment: ground, contacts: [{ kind: 'ground' }] },
        { moment: stop, contacts: [{ kind: 'rolling_stop' }] }] },
    baseContacts: [],
  };
  return { field, count: { balls: 0, strikes: 1 },
    policy: { version: 'untouched_settled_foul_dead_v1' as const,
      ruleProfileId: NPB_2026_RULE_PROFILE.id, rulesRevision: NPB_2026_RULE_PROFILE.rulesRevision } };
};

describe('explicit settled-foul dead-ball evidence contract', () => {
  it('derives the existing dead-ball conclusion from actual foul settling and keeps its exact moment', () => {
    const input = query(), bytes = JSON.stringify(input), result = derive(input);
    expect(result).toMatchObject({ version: 'settled_foul_dead_evidence_v1',
      territory: { kind: 'resolved', territory: 'foul', basis: 'settling', moment: input.field.evidence.horizon },
      interpretation: { kind: 'dead_ball', reason: 'untouched_settled_foul', moment: input.field.evidence.horizon },
      countEffect: { kind: 'unresolved', reason: 'bunt_intent_pending' } });
    expect(result.physicalContacts).toEqual(input.field.evidence.contacts);
    expect(JSON.stringify(input)).toBe(bytes);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.physicalContacts)).toBe(true);
    for (const key of ['playEnd', 'officialClosure', 'out', 'countAfter', 'basesAfter', 'onFieldCall']) {
      expect(result).not.toHaveProperty(key);
    }
  });

  it.each([0, 1, 2, 3])('keeps count/bunt consequences pending for balls=%s at every supported strike count', (balls) => {
    for (const strikes of [0, 1, 2]) {
      const result = derive({ ...query(), count: { balls, strikes } });
      expect(result.interpretation.kind).toBe('dead_ball');
      expect(result.countEffect).toEqual({ kind: 'unresolved', reason: 'bunt_intent_pending' });
      expect(result).not.toHaveProperty('countResult');
      expect(result).not.toHaveProperty('strikeout');
    }
  });

  it('retains fair territory without turning it into a generic live-ball decision', () => {
    const result = derive(query(true));
    expect(result.territory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'settling' });
    expect(result.interpretation.kind).toBe('unresolved');
    expect(result.countEffect).toBeNull();
    expect(result).not.toHaveProperty('ballRemainsLive');
  });

  it('does not use a stationary horizon without an actual stop contact', () => {
    const input = query();
    const result = derive({ ...input, field: { ...input.field,
      evidence: { ...input.field.evidence, contacts: input.field.evidence.contacts.slice(0, 1) } } });
    expect(result.interpretation.kind).toBe('unresolved');
    expect(result.territory.kind).toBe('unresolved');
  });

  it('does not turn a foul-side airborne fielder touch into an uncaught foul', () => {
    const input = query(), at = moment(0.5, -1.5);
    const result = derive({ ...input, field: { ...input.field, evidence: { ...input.field.evidence,
      horizon: at, contacts: [{ moment: at, contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] }] } } });
    expect(result.territory).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'fielder_touch' });
    expect(result.interpretation.kind).toBe('unresolved');
  });

  it.each(['surface', 'non_defender', 'defender', 'simultaneous'] as const)(
    'retains an earlier %s contact instead of filtering it into the positive case', (kind) => {
      const input = query(), original = input.field.evidence.contacts;
      const contact = kind === 'surface' ? { kind: 'surface' as const, surfaceId: 'panel' }
        : { kind: 'actor' as const, playerId: kind === 'non_defender' ? 'batter' : 'defender', role: 'body' as const };
      const contacts = [original[0], { moment: moment(0.25, -1.25),
        contacts: kind === 'simultaneous' ? [contact, { kind: 'surface' as const, surfaceId: 'panel' }] : [contact] }, original[1]];
      const result = derive({ ...input, field: { ...input.field, evidence: { ...input.field.evidence, contacts } } });
      expect(result.interpretation.kind).toBe('unresolved');
      expect(result.physicalContacts).toEqual(contacts);
    });

  it('preserves a later unsupported surface after the independently established dead-ball interpretation', () => {
    const input = query(false, 1), later = moment(0.5000001, -1.25, true, 1), stop = input.field.evidence.horizon;
    expect(later.ball.tick).toBe(stop.ball.tick);
    const contacts = [...input.field.evidence.contacts,
      { moment: later, contacts: [{ kind: 'surface' as const, surfaceId: 'later-panel' }] }];
    const result = derive({ ...input, field: { ...input.field,
      evidence: { ...input.field.evidence, horizon: later, contacts } } });
    expect(result.interpretation).toEqual({ kind: 'dead_ball', reason: 'untouched_settled_foul', moment: stop });
    expect(result.physicalContacts).toEqual(contacts);
  });

  it('retains a strictly earlier unsupported surface even when its recorded tick equals the stop tick', () => {
    const input = query(false, 1), earlier = moment(0.4999999, -1.25, true, 1);
    const [ground, stop] = input.field.evidence.contacts;
    expect(earlier.ball.tick).toBe(stop.moment.ball.tick);
    expect(earlier.elapsedSeconds).toBeLessThan(stop.moment.elapsedSeconds);
    const contacts = [ground, { moment: earlier, contacts: [{ kind: 'surface' as const, surfaceId: 'earlier-panel' }] }, stop];
    const field = { ...input.field, evidence: { ...input.field.evidence, contacts } };
    expect(deriveBallWorldFieldTerritory(field)).toEqual({ kind: 'unresolved', reason: 'surface_policy_pending' });
    const result = derive({ ...input, field });
    expect(result.interpretation.kind).toBe('unresolved');
    expect(result.physicalContacts).toEqual(contacts);
  });

  it.each(['home', 'first', 'second', 'third'] as const)(
    'retains complete earlier/equal %s bag provenance instead of filtering the contact into an untouched foul', (baseId) => {
      for (const at of [0.25, 0.5]) {
        const input = query(), [ground, stop] = input.field.evidence.contacts;
        const atStop = at === stop.moment.elapsedSeconds;
        const contactMoment = atStop ? stop.moment : moment(at, -1.1875);
        const base: BallWorldBaseBoundaryContact = { kind: 'base', baseId, moment: contactMoment,
          point: { ...contactMoment.ball.position, y: 0 }, normal: vector(0, 1, 0) };
        const surface = { kind: 'surface' as const, surfaceId: battedWorldBaseSurfaceId(baseId) };
        const contacts: readonly BallWorldBattedRuleContactFrame[] = atStop
          ? [ground, { ...stop, contacts: [...stop.contacts, surface] }]
          : [ground, { moment: contactMoment, contacts: [surface] }, stop];
        const field: BallWorldFieldTerritoryInput = { ...input.field, baseContacts: [base],
          evidence: { ...input.field.evidence, contacts } };
        const original = JSON.stringify(field), territory = deriveBallWorldFieldTerritory(field);
        if (atStop) expect(territory).toEqual({ kind: 'unresolved', reason: 'simultaneous_contact' });
        else if (baseId === 'home') expect(territory).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'settling' });
        else if (baseId === 'second') expect(territory).toEqual({ kind: 'unresolved', reason: 'base_policy_pending' });
        else expect(territory).toMatchObject({ kind: 'resolved', territory: 'fair', basis: 'base_contact', baseId });
        const result = derive({ ...input, field });
        expect(result.territory).toEqual(territory);
        expect(result.interpretation.kind).toBe('unresolved');
        expect(result.physicalContacts).toEqual(contacts);
        expect(JSON.stringify(field)).toBe(original);
        // The rejection above concerns supported scope, not malformed companion metadata.
        expect(() => derive({ ...input, field: { ...field, baseContacts: [] } })).toThrow();
      }
    });

  it.each(['secured', 'interrupted'] as const)(
    'retains a complete %s acquisition ending earlier/equal to the stop', (kind) => {
      for (const at of [0.375, 0.5]) {
        const input = query(), [ground, stop] = input.field.evidence.contacts;
        const contactMoment = moment(0.25, -1.1875), atStop = at === stop.moment.elapsedSeconds;
        const endMoment = atStop ? stop.moment : moment(at, -1.234375, kind === 'secured');
        const candidateTick = kind === 'secured' ? endMoment.ball.tick : quantizeEventTick(0, 0.75, 1_000_000);
        const candidate = { acquirerPlayerId: 'defender', contactMoment,
          candidateSecureTick: candidateTick, archivedCandidateSecureTick: candidateTick,
          retention: { outcome: createSecuredCatchOutcome(contactMoment.ball.tick, candidateTick),
            diagnostics: { relativeVelocity: vector(-1, 0, 0), translationalEnergyJ: 1,
              rotationalEnergyJ: 0, retentionLoadJ: 1, pocketFactor: 1, effectiveCapacityJ: 1 } },
          transport: { kind: 'glove_constraint' as const, contactOffset: vector(0, 0, 0),
            initialEnergyJ: 1, remainingEnergyJ: kind === 'secured' ? 0 : 0.5 } };
        const acquisition: BattedWorldAcquisition = kind === 'secured'
          ? { ...candidate, kind, secureTick: endMoment.ball.tick, moment: endMoment }
          : { ...candidate, kind, reason: 'contact', world: { kind: 'boundary', moment: endMoment,
            contacts: [{ kind: atStop ? 'rolling_stop' : 'ground', moment: endMoment }] } };
        const glove: BallWorldBattedRuleContactFrame = { moment: contactMoment,
          contacts: [{ kind: 'actor', playerId: 'defender', role: 'glove' }] };
        const contacts: readonly BallWorldBattedRuleContactFrame[] = [ground, glove,
          ...(kind === 'interrupted' && !atStop ? [{ moment: endMoment, contacts: [{ kind: 'ground' as const }] }] : []), stop];
        const field: BallWorldFieldTerritoryInput = { ...input.field,
          evidence: { ...input.field.evidence, contacts, acquisitions: [acquisition] } };
        const original = JSON.stringify(field), territory = deriveBallWorldFieldTerritory(field);
        expect(territory).toMatchObject({ kind: 'resolved', territory: 'foul', basis: 'fielder_touch', moment: contactMoment });
        const result = derive({ ...input, field });
        expect(result.territory).toEqual(territory);
        expect(result.interpretation.kind).toBe('unresolved');
        expect(result.physicalContacts).toEqual(contacts);
        expect(JSON.stringify(field)).toBe(original);
        // A candidate cannot be accepted after discarding its own glove-contact frame.
        expect(() => derive({ ...input, field: { ...field,
          evidence: { ...field.evidence, contacts: contacts.filter(frame => frame !== glove) } } })).toThrow();
      }
    });

  it('blocks an exactly coincident unknown contact at the stop', () => {
    const input = query(), [ground, stop] = input.field.evidence.contacts;
    const contacts = [ground, { ...stop, contacts: [...stop.contacts, { kind: 'surface' as const, surfaceId: 'coincident-panel' }] }];
    const result = derive({ ...input, field: { ...input.field, evidence: { ...input.field.evidence, contacts } } });
    expect(result.interpretation.kind).toBe('unresolved');
    expect(result.physicalContacts).toEqual(contacts);
  });

  it.each(['fairResult', 'deadBall', 'out', 'buntAttempt', 'countAfter', 'playEnd'])(
    'rejects caller-injected %s instead of accepting an asserted result or intent', (key) => {
      expect(() => derive({ ...query(), [key]: true } as never)).toThrow();
    });

  it.each(['version', 'ruleProfileId', 'rulesRevision'] as const)('rejects an unsupported policy %s', (key) => {
    const input = query();
    expect(() => derive({ ...input, policy: { ...input.policy, [key]: 'foreign' } } as never)).toThrow();
  });

  it('requires explicit policy and rejects inertness violations before interpreting the frame', () => {
    const input = query();
    expect(() => derive({ ...input, policy: undefined } as never)).toThrow();
    let reads = 0;
    const policy = Object.defineProperty({ ...input.policy }, 'rulesRevision', {
      enumerable: true, get: () => { reads += 1; return '2026'; },
    });
    expect(() => derive({ ...input, policy })).toThrow();
    expect(reads).toBe(0);
  });

  it('rejects a caller RuleProfile object, extra contact fields, invalid count and non-stationary stop', () => {
    const input = query(), [ground, stop] = input.field.evidence.contacts;
    expect(() => derive({ ...input, ruleProfile: NPB_2026_RULE_PROFILE } as never)).toThrow();
    expect(() => derive({ ...input, count: { balls: 4, strikes: 0 } })).toThrow();
    expect(() => derive({ ...input, field: { ...input.field, evidence: { ...input.field.evidence,
      contacts: [ground, { ...stop, contacts: [{ kind: 'rolling_stop', ballDead: true }] }] } } } as never)).toThrow();
    const moving = moment(0.5, -1.5);
    expect(() => derive({ ...input, field: { ...input.field, evidence: { ...input.field.evidence,
      horizon: moving, contacts: [ground, { moment: moving, contacts: [{ kind: 'rolling_stop' }] }] } } })).toThrow();
  });
});
