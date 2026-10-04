import { expect, it } from 'vitest';
import { quantizerFixture } from './OwnedScheduledQuantizerFixture.test-support';
import { deriveOwnedScheduledMotionExecution } from './OwnedScheduledMotionExecution';
import { ownedScheduledMotionActionInput } from './OwnedScheduledBattedWorldMotion';
import { actorHash, actorJson } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import type { OwnedScheduledMotionAction } from './OwnedScheduledBattedWorldMotion';
import type { DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';

it('keeps pre-variant ordinary and operation Source, result JSON and digest bytes exact', () => {
  const x = quantizerFixture(100, 3, 12, actors => actors.map(a => a.playerId === 'player-1' && a.primitive.role === 'glove'
    ? { ...a, primitive: { ...a.primitive, startCenter: { x: 2.25, y: 10, z: 10 } } } : a));
  try {
    const ordinary = x.execute({ kind: 'motion', throughTick: 102 });
    if (ordinary.kind !== 'owned_motion_v2') throw new Error('ordinary');
    const ordinarySource = x.source({ kind: 'motion', throughTick: 102 });
    const first: DurableBattedWorldFieldExecution = { source: ordinarySource, baseField: x.baseField, revision: 1,
      history: [ordinarySource], execution: ordinary };
    x.prefix.executions = [first];
    const at = ordinary.adoption.executedThrough;
    Object.assign(x.at, at);
    const source = (sourceId: string, action: OwnedScheduledMotionAction) => ({ ...ordinarySource, sourceId,
      previousExecutionSourceId: x.prefix.executions.at(-1)!.source.sourceId, action });
    const planSource = source('plan', { kind: 'owned_acquisition_plan_v1', knownWork: x.knownWork });
    const plan = deriveOwnedScheduledMotionExecution(planSource, x.prefix, [], [], null);
    if (plan.kind !== 'owned_acquisition_plan_v1') throw new Error('plan');
    const planned: DurableBattedWorldFieldExecution = { source: planSource, baseField: x.baseField, revision: 2,
      history: [ordinarySource, planSource], execution: plan };
    x.prefix.executions.push(planned);
    const operationSource = source('init', x.action({ kind: 'operation', planSourceId: 'plan',
      throughElapsedSeconds: plan.plan.contactMoment.elapsedSeconds }));
    const operation = deriveOwnedScheduledMotionExecution(operationSource, x.prefix, [], [], null);
    if (operation.kind !== 'owned_motion_v2') throw new Error('operation');
    expect(ordinary.composition).not.toHaveProperty('quantizerBoundary');
    expect(operation.composition).not.toHaveProperty('quantizerBoundary');
    const bytes = { ordinarySource: actorJson(ownedScheduledMotionActionInput(ordinarySource.action)),
      operationSource: actorJson(ownedScheduledMotionActionInput(operationSource.action)),
      ordinary: actorJson(ordinary), operation: actorJson(operation) };
    const digests = Object.fromEntries(Object.entries(bytes).map(([kind, json]) => [kind, actorHash(JSON.parse(json))]));
    expect(digests).toEqual({
      "ordinarySource": "f6e0e4caa655f35928d29342a84d1cbbe8cfdfe426e403bdb48a43a3cb4cca42",
      "operationSource": "8cbd2b56a97ca3e5e496fc5016795299d9cae04b2c3cff26af1411d2287b99c5",
      "ordinary": "8f49b9b67c23d8d1563a61c584b10fb008107121301908b7e64afafa1a49806a",
      "operation": "c729c92da7d30892aafb911a0d1feedf761b424807e7d9f2c709e5ab0c0988c2"
});
  } finally { x.restore(); }
});
