import { expect, it } from 'vitest';
import { actualLivePlayScopeInput, deriveActualLivePlayScope } from './ActualLivePlayScope';
import { ownedBattedWorldMotionFixture } from './OwnedBattedWorldMotionFixtures.test-support';

it('derives the complete original ten-Player roster and every runtime domain, not a discovered source subset', () => {
  const x = ownedBattedWorldMotionFixture();
  try {
    const prefix = x.prefix(x.first.source.sourceId), pitch = x.baseField.response.touch.worldContact.flight.physicalPitch;
    const source = { sourceId: 'scope-1', sourceVersion: 'test-v1', capability: 'actual_live_play_scope_v1' as const,
      physicalPitchSourceId: pitch.source.sourceId, cut: { kind: 'field_execution' as const, baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: x.first.source.sourceId } };
    const scope = deriveActualLivePlayScope(source, pitch, prefix);
    expect(scope.participation).toBe('supported_empty_base');
    expect(scope.participants.map(p => p.playerId)).toEqual([x.batterId, ...pitch.frame.bindings.map(b => b.playerId)].sort());
    expect(scope.participants.every(p => p.bodyModel?.primitiveRoles.length === 5 && p.personLinkSourceId && p.personHash)).toBe(true);
    const world = x.baseField.response.touch.worldContact;
    for (const p of scope.participants) {
      const actor = world.modelActorEvidence.find(a => a.binding.playerId === p.playerId)!;
      expect(p.personId).toBe(actor.person.personId); expect(p.personLinkSourceId).toBe(actor.person.sourceId);
      expect(p.bodyModel).toMatchObject({ sourceId: world.model.sourceId, sourceVersion: world.model.sourceVersion });
    }
    for (const domain of ['pitch_admission', 'bat_ball_field', 'custody_successors', 'physical_rule_consumption', 'communication_ingress',
      'umpire_call', 'operative_offense', 'live_rule_windows', 'event_generation_consumption', 'closure_fence']) {
      expect(scope.producers.some(p => p.domain === domain && p.playerId === null)).toBe(true);
    }
    for (const domain of ['body_motion', 'observation_scheduling', 'observation_samples', 'actor_decision', 'motor_issuance', 'controller_renewal']) {
      expect(scope.producers.filter(p => p.domain === domain).map(p => p.playerId).sort()).toEqual(scope.participants.map(p => p.playerId));
    }
    expect(new Set(scope.producers.map(p => p.producerId)).size).toBe(scope.producers.length);
    const broken = { ...pitch, frame: { ...pitch.frame, bindings: pitch.frame.bindings.slice(1) } };
    expect(() => deriveActualLivePlayScope(source, broken, prefix)).toThrow(/participant|binding/);
    const bodyMissing = { ...prefix, baseField: { ...prefix.baseField, response: { ...prefix.baseField.response,
      touch: { ...prefix.baseField.response.touch, worldContact: { ...prefix.baseField.response.touch.worldContact,
        actors: prefix.baseField.response.touch.worldContact.actors.slice(1) } } } } };
    expect(() => deriveActualLivePlayScope(source, pitch, bodyMissing)).toThrow(/participant|primitive/);
  } finally { x.f.close(); }
});

it('accepts only source identities and rejects participant/result/queue overrides and active input', () => {
  const source = { sourceId: 's', sourceVersion: 'v1', capability: 'actual_live_play_scope_v1' as const,
    physicalPitchSourceId: 'pitch', cut: { kind: 'original_pitch' as const } };
  expect(actualLivePlayScopeInput(source)).toEqual(source);
  for (const key of ['participants', 'producers', 'terminal', 'settledActors', 'registry', 'queueWatermark', 'result']) {
    expect(() => actualLivePlayScopeInput({ ...source, [key]: [] })).toThrow();
  }
  let called = false;
  expect(() => actualLivePlayScopeInput({ ...source, get sourceId() { called = true; return 's'; } })).toThrow(/accessor/);
  expect(called).toBe(false);
});
