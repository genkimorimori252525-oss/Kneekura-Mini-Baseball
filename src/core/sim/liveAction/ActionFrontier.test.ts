import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  createLiveActionFrontier,
  resolvePlayEndFromFrontier,
  type LiveActionFrontierInput,
} from './ActionFrontier';

const base = (): LiveActionFrontierInput => ({
  tick: 100,
  physical: [],
  intents: [],
  information: [],
  decisions: [],
  ruleWindows: [],
  actors: [
    { actorId: 'runner-1', kind: 'settled_for_play', settledAt: 99, basisEventId: 'settled-1' },
    { actorId: 'defender-1', kind: 'settled_for_play', settledAt: 100, basisEventId: 'settled-2' },
  ],
  eventQueueSettledThroughTick: 100,
});

const resolve = (change: (input: LiveActionFrontierInput) => void = () => {}, terminal: 'none' | 'dead_ball' | 'all_offense_terminal' | 'terminal_rule_event' = 'none') => {
  const input = structuredClone(base());
  change(input);
  return resolvePlayEndFromFrontier(createLiveActionFrontier(input), terminal);
};

test('quiescent frontier ends live action only after explicit actor settlement and event watermark', () => {
  const result = resolve();
  assert.equal(result.kind, 'ended');
  if (result.kind !== 'ended') return;
  assert.equal(result.reason, 'action_frontier_empty');
  assert.deepEqual(result.playEnd, { kind: 'play_end', tick: 100, reason: 'live_action_complete' });
});

test('event queue watermark blocks same-tick PlayEnd', () => {
  const result = resolve((input) => { input.eventQueueSettledThroughTick = 99; });
  assert.equal(result.kind, 'continues');
  if (result.kind !== 'continues') return;
  assert.ok(result.blockers.some((blocker) => blocker.kind === 'event_queue_unsettled'));
});

for (const [name, field, item, blocker] of [
  ['physical work', 'physical', { workId: 'p1', kind: 'runner_motion', actorId: 'runner-1', throughTick: 120, actionKey: 'a1' }, 'pending_physical'],
  ['intent work', 'intents', { workId: 'i1', kind: 'issued_intent', actorId: 'runner-1', dueTick: 110, actionKey: 'a1' }, 'pending_intent'],
  ['information work', 'information', { workId: 'n1', kind: 'in_flight_information', actorId: 'runner-1', dueTick: 105, causeEventId: 'cause-1' }, 'pending_information'],
  ['decision work', 'decisions', { workId: 'd1', kind: 'actor_decision', actorId: 'runner-1', dueTick: 101 }, 'pending_decision'],
  ['live rule window', 'ruleWindows', { workId: 'r1', kind: 'live_rule_window', windowId: 'tag-window', openedAtTick: 90 }, 'pending_rule_window'],
] as const) {
  test(`${name} blocks quiescent PlayEnd`, () => {
    const result = resolve((input) => { (input[field] as unknown[]).push(item); });
    assert.equal(result.kind, 'continues');
    if (result.kind !== 'continues') return;
    assert.ok(result.blockers.some((item) => item.kind === blocker));
  });
}

test('decision-pending actor blocks even at zero-motion quiescence', () => {
  const result = resolve((input) => {
    input.actors[0] = { actorId: 'runner-1', kind: 'decision_pending', dueTick: 100 };
  });
  assert.equal(result.kind, 'continues');
  if (result.kind !== 'continues') return;
  assert.ok(result.blockers.some((item) => item.kind === 'actor_not_settled'));
});

test('waiting-on-trigger actor blocks without inventing a generic timeout', () => {
  const result = resolve((input) => {
    input.actors[0] = { actorId: 'runner-1', kind: 'waiting_on_pending_trigger', triggerId: 'throw-arrival' };
  });
  assert.equal(result.kind, 'continues');
});

test('dead ball can terminate irrelevant motion after same-tick event and live-rule consequences settle', () => {
  const result = resolve((input) => {
    input.physical.push({ workId: 'p1', kind: 'runner_motion', actorId: 'runner-1', throughTick: 120, actionKey: 'a1' });
    input.intents.push({ workId: 'i1', kind: 'issued_intent', actorId: 'runner-1', dueTick: 110, actionKey: 'a1' });
    input.actors[0] = { actorId: 'runner-1', kind: 'acting' };
  }, 'dead_ball');
  assert.equal(result.kind, 'ended');
  if (result.kind !== 'ended') return;
  assert.equal(result.reason, 'dead_ball');
  assert.equal(result.playEnd.reason, 'dead_ball');
});

test('terminal exit still waits for same-tick queue watermark', () => {
  const result = resolve((input) => { input.eventQueueSettledThroughTick = 99; }, 'all_offense_terminal');
  assert.equal(result.kind, 'continues');
});

test('terminal exit still waits for a live-action rule window', () => {
  const result = resolve((input) => {
    input.ruleWindows.push({ workId: 'r1', kind: 'live_rule_window', windowId: 'active-tag', openedAtTick: 100 });
  }, 'terminal_rule_event');
  assert.equal(result.kind, 'continues');
});

test('all-offense-terminal produces live-action PlayEnd after watermark and live windows settle', () => {
  const result = resolve((input) => { input.actors[0] = { actorId: 'runner-1', kind: 'acting' }; }, 'all_offense_terminal');
  assert.equal(result.kind, 'ended');
  if (result.kind !== 'ended') return;
  assert.equal(result.reason, 'all_offense_terminal');
  assert.equal(result.playEnd.reason, 'live_action_complete');
});

test('duplicate work ids are rejected across frontier categories', () => {
  const input = base();
  input.physical.push({ workId: 'dup', kind: 'runner_motion', actorId: 'runner-1', throughTick: 120, actionKey: 'a1' });
  input.intents.push({ workId: 'dup', kind: 'issued_intent', actorId: 'runner-1', dueTick: 110, actionKey: 'a1' });
  assert.throws(() => createLiveActionFrontier(input));
});

test('duplicate actor ids are rejected', () => {
  const input = base();
  input.actors.push({ actorId: 'runner-1', kind: 'acting' });
  assert.throws(() => createLiveActionFrontier(input));
});

test('settled actor cannot claim a future settlement event', () => {
  const input = base();
  input.actors[0] = { actorId: 'runner-1', kind: 'settled_for_play', settledAt: 101, basisEventId: 'future' };
  assert.throws(() => createLiveActionFrontier(input));
});
