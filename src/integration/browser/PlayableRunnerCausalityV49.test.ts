import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { reducePlayableMatchV1, type PlayableFieldFactsV1 } from './PlayableMatchRulesV1';

const facts = (patch: Partial<PlayableFieldFactsV1>): PlayableFieldFactsV1 => ({
  contactTick: 0, throughTick: 100, territory: 'fair', firstGroundContactTick: 1, flyCatch: null,
  runnerTouches: [], runnerDepartures: [], controlledBaseContacts: [], controlledRunnerTags: [], overFence: null,
  playEnd: { kind: 'play_end', tick: 100, reason: 'live_action_complete' }, ...patch,
});
const reduce = (physical: PlayableFieldFactsV1) => reducePlayableMatchV1({
  match: { ruleProfileId: asRuleProfileId('causal-base-contact'), inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 0 },
  batterRunnerId: 'batter', event: { kind: 'field_play', facts: physical },
});

it('does not restore the first-base force after a real touch even when the runner leaves for second', () => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 10 },
      { kind: 'runner_base_touch', runnerId: 'batter', base: 2, tick: 25 }],
    runnerDepartures: [{ kind: 'runner_base_departure', runnerId: 'batter', base: 1, tick: 12 }],
    controlledBaseContacts: [{ kind: 'controlled_base_contact', defenderId: 'first', base: 1, tick: 20 }],
  }));
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') throw new Error(result.reason);
  expect(result.outcomes).toEqual([]);
  expect(result.match.bases).toEqual({ first: null, second: 'batter', third: null });
});

it('requires a physical tag after the first-base force was satisfied', () => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 10 }],
    runnerDepartures: [{ kind: 'runner_base_departure', runnerId: 'batter', base: 1, tick: 12 }],
    controlledBaseContacts: [{ kind: 'controlled_base_contact', defenderId: 'first', base: 1, tick: 15 }],
    controlledRunnerTags: [{ kind: 'controlled_runner_tag', defenderId: 'second', runnerId: 'batter', tick: 20 }],
  }));
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') throw new Error(result.reason);
  expect(result.outcomes).toMatchObject([{ runnerId: 'batter', cause: 'runner_tag', classification: 'time_play', tick: 20 }]);
});

it('keeps a quantized same-tick base race unresolved instead of awarding either array order', () => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 10 }],
    controlledBaseContacts: [{ kind: 'controlled_base_contact', defenderId: 'first', base: 1, tick: 10 }],
  }));
  expect(result).toEqual({ kind: 'unresolved', reason: 'simultaneous_force_arrival', tick: 10 });
});

it('interprets a causally bound protection exit before a tag enabled by that departure', () => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 5 }],
    runnerDepartures: [{ kind: 'runner_base_departure', runnerId: 'batter', base: 1, tick: 10 }],
    controlledRunnerTags: [{ kind: 'controlled_runner_tag', defenderId: 'first', runnerId: 'batter', tick: 10,
      protectionEndedByDeparture: { base: 1, tick: 10 } }],
  }));
  expect(result.kind).toBe('applied');
  if (result.kind !== 'applied') throw new Error(result.reason);
  expect(result.outcomes).toMatchObject([{ runnerId: 'batter', cause: 'runner_tag', classification: 'time_play', tick: 10 }]);
});

it.each([undefined, { base: 2 as const, tick: 10 }])('preserves an unknown departure/tag tie without matching protection evidence (%s)', proof => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 5 }],
    runnerDepartures: [{ kind: 'runner_base_departure', runnerId: 'batter', base: 1, tick: 10 }],
    controlledRunnerTags: [{ kind: 'controlled_runner_tag', defenderId: 'first', runnerId: 'batter', tick: 10,
      ...(proof ? { protectionEndedByDeparture: proof } : {}) }],
  }));
  expect(result.kind).toBe('unresolved');
});

it('does not let departure evidence settle an incoming touch/tag race', () => {
  const result = reduce(facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 10 }],
    runnerDepartures: [{ kind: 'runner_base_departure', runnerId: 'batter', base: 1, tick: 10 }],
    controlledRunnerTags: [{ kind: 'controlled_runner_tag', defenderId: 'first', runnerId: 'batter', tick: 10,
      protectionEndedByDeparture: { base: 1, tick: 10 } }],
  }));
  expect(result).toEqual({ kind: 'unresolved', reason: 'simultaneous_tag_arrival_or_departure', tick: 10 });
});

it('requires the referenced physical departure and its matching occurrence tick', () => {
  const physical = facts({
    runnerTouches: [{ kind: 'runner_base_touch', runnerId: 'batter', base: 1, tick: 5 }],
    controlledRunnerTags: [{ kind: 'controlled_runner_tag', defenderId: 'first', runnerId: 'batter', tick: 10,
      protectionEndedByDeparture: { base: 1, tick: 10 } }],
  });
  expect(reduce(physical)).toEqual({ kind: 'unresolved', reason: 'unbound_tag_departure_evidence', tick: 10 });
  expect(() => reduce({ ...physical, controlledRunnerTags: [{ ...physical.controlledRunnerTags[0],
    protectionEndedByDeparture: { base: 1, tick: 9 } }] })).toThrow('invalid tag departure evidence');
});
