import { expect } from 'vitest';
import { policy } from '../../core/world/psychology/EmotionFixtures.test-support';
import { openSqliteBattingEmotionStore } from './SqliteBattingEmotionStore';
import { continueSamePaOccupiedWalkFixture } from './SamePlateAppearanceOccupiedContinuation.test-support';
import { prepareSamePaPhysicalLifecycleContinuation, type samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
import type { completeSamePaTerminalFixture } from './SamePlateAppearanceTerminalLifecycleFixture.test-support';
import type { SamePaInitialPlayFixtureInputs } from './SamePlateAppearanceInitialBallFixture.test-support';

type LifecycleOptions = NonNullable<Parameters<typeof prepareSamePaPhysicalLifecycleContinuation>[6]>;

/** The previous PA must already have applied a genuine walk. This adapter owns
 * no copied records: its occupied first TAKE, second TAKE, lifecycle and next
 * batting action all use the existing Native owners in the same synthetic DB.
 * The explicitly supplied initial Play precedes the occupied first pitch. */
export const prepareSamePaOccupiedPhysicalFixture = (previous: ReturnType<typeof samePaPhysicalLifecycleFixture>,
  completed: ReturnType<typeof completeSamePaTerminalFixture>, label: string,
  options: LifecycleOptions & Readonly<{ initialPlay: SamePaInitialPlayFixtureInputs }>) => {
  const occupied = continueSamePaOccupiedWalkFixture(previous,completed,label,{initialPlay:options.initialPlay});
  const { f, accepted, save } = occupied, original = occupied.action.source;
  const genesisSource = save({sourceId:label+':emotion-genesis',sourceVersion:'fixture-only-v1',capability:'owned_batting_emotion_genesis_v1',
    viewReference:original.viewReference,member:occupied.roles[0].member,policy:policy(),provenance:{assessmentSourceId:label+':genesis-assessment',
      assessmentVersion:'fixture-only-v1',calibrationSourceId:'existing-explicit-Core-fixture',calibrationVersion:'fixture-only-v1'}});
  const owner = f.x.f.track(openSqliteBattingEmotionStore(f.path,{readAcceptedGenesis:id=>accepted.get(id)}));
  const genesis = owner.acceptGenesis(genesisSource.sourceId);
  if(genesis.kind!=='batting_emotion_genesis')throw new Error('occupied fixture next batter emotion genesis pending');
  const lifecycle: ReturnType<typeof samePaPhysicalLifecycleFixture> = prepareSamePaPhysicalLifecycleContinuation(f,accepted,occupied.pitch,occupied.sceneBodyReferences,
    genesis,previous.worldOwner,options,label);
  expect(lifecycle.first.originalActor).toEqual(occupied.actor);
  expect(lifecycle.second.originalActor).toEqual(occupied.actor);
  expect(lifecycle.current().view.lineage.participantReferences).toHaveLength(11);
  expect(lifecycle.current().basis.actor).toEqual(occupied.actor);
  expect(lifecycle.current().basis.members.map(member=>member.playerId)).toEqual(occupied.enrollment.participants.map(p=>p.binding.playerId));
  return {...lifecycle,occupied,...(occupied.initialPlay===undefined?{}:{initialPlay:occupied.initialPlay})};
};
