import { expect } from 'vitest';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { continueSamePaOccupiedWalkFixture, type SamePaOccupiedWalkBase } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { prepareSamePaPhysicalLifecycleContinuation, type samePaPhysicalLifecycleFixture, type SamePaPhysicalContinuationContext, type SamePaPreparedPhysicalLifecycle } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import type { SamePaInitialPlayFixtureInputs, prepareSamePaInitialPlayFixture } from './SamePlateAppearanceInitialBallFixture.test-support';

type LifecycleOptions = NonNullable<Parameters<typeof prepareSamePaPhysicalLifecycleContinuation>[6]>;

/** The previous PA must already have applied a genuine walk. This adapter owns
 * no copied records: its occupied first TAKE, second TAKE, lifecycle and next
 * batting action all use the existing Native owners in the same synthetic DB.
 * The explicitly supplied initial Play precedes the occupied first pitch. */
export const prepareSamePaOccupiedPhysicalFixture = (previous: ReturnType<typeof samePaPhysicalLifecycleFixture>,
  completed: ReturnType<typeof completeSamePaTerminalFixture>, label: string,
  options: LifecycleOptions & Readonly<{ initialPlay: SamePaInitialPlayFixtureInputs; occupiedHoldDurationUs?: number }>) => {
  const occupied = continueSamePaOccupiedWalkFixture(previous,completed,label,{initialPlay:options.initialPlay,occupiedHoldDurationUs:options.occupiedHoldDurationUs});
  return completeSamePaOccupiedPhysicalFixture(previous, occupied, label, options);
};

/** Exact original emotion/second-TAKE/lifecycle tail, after occupied first TAKE.
 * Retained LAN01 supplies only accepted owners from the original baseline tail. */
export const completeSamePaOccupiedPhysicalFixture = <F extends SamePaOccupiedWalkBase & {
  close: () => void; x: SamePaPhysicalContinuationContext['x'];
}>(previous: Pick<ReturnType<typeof samePaPhysicalLifecycleFixture>, 'worldOwner'>,
  occupied: ReturnType<typeof continueSamePaOccupiedWalkFixture<F>>, label: string,
  options: LifecycleOptions & Readonly<{ initialPlay: SamePaInitialPlayFixtureInputs; occupiedHoldDurationUs?: number }>) => {
  const { f, accepted, save } = occupied, original = occupied.action.source;
  const genesisSource = save({sourceId:label+':emotion-genesis',sourceVersion:'fixture-only-v1',capability:'owned_batting_emotion_genesis_v1',
    viewReference:original.viewReference,member:occupied.roles[0].member,policy:policy(),provenance:{assessmentSourceId:label+':genesis-assessment',
      assessmentVersion:'fixture-only-v1',calibrationSourceId:'existing-explicit-Core-fixture',calibrationVersion:'fixture-only-v1'}});
  const owner = f.x.f.track(openSqliteBattingEmotionStore(f.path,{readAcceptedGenesis:id=>accepted.get(id)}));
  const genesis = owner.acceptGenesis(genesisSource.sourceId);
  if(genesis.kind!=='batting_emotion_genesis')throw new Error('occupied fixture next batter emotion genesis pending');
  const lifecycle = prepareSamePaPhysicalLifecycleContinuation(f,accepted,occupied.pitch,occupied.sceneBodyReferences,
    genesis,previous.worldOwner,options,label);
  return finishSamePaOccupiedPhysicalFixtureAssertions(lifecycle, occupied);
};

type OccupiedPhysicalAssertions = Readonly<{
  actor: import('./PhysicalPlateAppearanceActorEvidenceFromSqlite').DurablePhysicalPlateAppearanceActor;
  enrollment: import('./SamePlateAppearanceEnrollment').ReservedSamePlateAppearanceEnrollment;
  hold: import('./SqliteSamePlateAppearanceOccupiedRunnerHoldStore').DurableSamePaOccupiedRunnerHold;
  initialPlay?: Pick<ReturnType<typeof prepareSamePaInitialPlayFixture>, 'play'>;
}>;

/** The same original post-cut assertions serve fresh and retained callers.
 * Dispatch members have role order; enrollment participants have player-key
 * order. Compare exact membership without mutating either accepted sequence. */
export const finishSamePaOccupiedPhysicalFixtureAssertions = <L extends SamePaPreparedPhysicalLifecycle, O extends OccupiedPhysicalAssertions>(
  lifecycle: L, occupied: O) => {
  expect(lifecycle.first.originalActor).toEqual(occupied.actor);
  expect(lifecycle.second.originalActor).toEqual(occupied.actor);
  expect(lifecycle.current().view.lineage.participantReferences).toHaveLength(11);
  expect(lifecycle.current().basis.actor).toEqual(occupied.actor);
  const members = lifecycle.current().basis.members.map(member=>member.playerId);
  const participants = occupied.enrollment.participants.map(p=>p.binding.playerId);
  expect(new Set(members).size).toBe(members.length);
  expect(new Set(participants).size).toBe(participants.length);
  expect(members).toHaveLength(11);
  expect(participants).toHaveLength(11);
  expect([...members].sort()).toEqual([...participants].sort());
  return {...lifecycle,occupied,...(occupied.initialPlay===undefined?{}:{initialPlay:occupied.initialPlay})};
};

export type SamePaOccupiedPhysicalSuffix = ReturnType<typeof finishSamePaOccupiedPhysicalFixtureAssertions>;
