import { expect, it } from 'vitest';
import { ownedScheduledMotionActionInput } from './OwnedScheduledBattedWorldMotion';

const knownWork = Array.from({ length: 10 }, (_, i) => ({ playerId: `player-${i}`, decisionSourceId: null, motorSourceId: null }));
const motion = () => ({ kind: 'owned_motion_v2', checkpoint: { kind: 'operation', planSourceId: 'capture-plan', throughElapsedSeconds: 0 },
  contributions: knownWork.map(w => ({ kind: 'motor', playerId: w.playerId, motorSourceId: `motor-${w.playerId}` })), knownWork });
it('parses only versioned owned plan and complete reference-only motion sources', () => {
  for (const action of [{ kind: 'owned_acquisition_plan_v1', knownWork },
    { kind: 'owned_throw_plan_v1', modelSourceId: 'model', receiverPlayerId: 'player-1', knownWork }, motion()]) {
    const parsed = ownedScheduledMotionActionInput(action as never);
    expect(parsed).toEqual(action); expect(Object.isFrozen(parsed)).toBe(true);
  }
  expect(ownedScheduledMotionActionInput({ ...motion(), checkpoint: { kind: 'motion', throughTick: 0 } } as never)).toMatchObject({ checkpoint: { kind: 'motion', throughTick: 0 } });
});
it('rejects self-supplied results, duplicate/missing Players, nonfinite time and active containers before use', () => {
  let called = false;
  const input = motion();
  for (const action of [
    { ...input, plan: {} }, { ...input, actors: [] }, { ...input, contributions: input.contributions.slice(1) },
    { ...input, knownWork: [...knownWork.slice(1), knownWork[1]] },
    { ...input, checkpoint: { ...input.checkpoint, throughElapsedSeconds: Infinity } },
    { ...input, checkpoint: { kind: 'motion', throughTick: .5 } },
    { ...input, get contributions() { called = true; return input.contributions; } },
    { ...input, contributions: input.contributions.map((c, i) => i ? c : { ...c, acceleration: {} }) },
    { kind: 'owned_throw_plan_v1', modelSourceId: '', receiverPlayerId: 'player-1', knownWork },
  ]) expect(() => ownedScheduledMotionActionInput(action as never)).toThrow();
  expect(called).toBe(false);
});
it('admits retained v2 provenance only with the exact immutable command-reference shape', () => {
  const at = { originTick: 0, elapsedSeconds: 0, tick: 0 };
  const command = { kind: 'owned_motion_v2', owner: 'batted_world_field_executions', sourceId: 'old-step', sourceVersion: 'v1', sourceHash: 'h',
    adoptionSourceId: 'old-step', adoptionSourceHash: 'h', adoptedAt: at, executedThrough: at, acceptedThroughTick: 100 };
  const action = { ...motion(), contributions: knownWork.map(w => ({ kind: 'retained', playerId: w.playerId, command })) };
  expect(ownedScheduledMotionActionInput(action as never)).toEqual(action);
  expect(() => ownedScheduledMotionActionInput({ ...action, contributions: action.contributions.map((c, i) => i ? c :
    { ...c, command: { ...command, kind: 'owned_acquisition_plan_v1' } }) } as never)).toThrow();
});
