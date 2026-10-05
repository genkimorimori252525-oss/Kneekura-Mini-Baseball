import { ownedRunnerFieldInputs } from './OwnedRunnerFieldFixtures.test-support';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import type { ActualOriginalContactPlayerKinematics } from './ActualPlayerKinematicsFromOriginalContact';
import type { BallWorldPlayerBaseContactSegment } from '../../core/sim/ball/BallWorldPlayerBaseContactHistory';

/** Test-only proposed interface. No production reader, controller or motion implementation is supplied. */
export type OwnedRunnerFieldCutContract = Readonly<{ kind: 'owned_runner_field_v1'; physicalPitchSourceId: string; fieldSourceId: string; playerId: string }>;
export type OwnedRunnerFieldKinematicsContract = Omit<ActualOriginalContactPlayerKinematics, 'version' | 'authority' | 'physicalPrefix'> & Readonly<{
  version: 'owned_runner_field_kinematics_v1'; cut: OwnedRunnerFieldCutContract;
  authority: Readonly<{ owner: 'physical_pitch_progress_actions' | 'batted_world_field_actions'; sourceId: string; sourceVersion: string; sourceHash: string;
    runnerSourceId?: string; runnerSourceHash?: string; motionRevision?: number; acceptedThroughTick: number }>;
  execution: Readonly<{ owner: 'batted_world_field_actions'; sourceId: string; revision: number; sourceHash: string; snapshotHash: string;
    executedThrough: ActualOriginalContactPlayerKinematics['at'] }>;
  physicalPrefix: Readonly<{ version: 'owned_runner_field_physical_prefix_v1'; at: ActualOriginalContactPlayerKinematics['at'];
    participants: readonly Readonly<{ playerId: string; personId: string; role: 'batter' | 'defender' | 'runner' }>[];
    segments: readonly BallWorldPlayerBaseContactSegment[] }>;
  dependencyHashes: Readonly<{ physicalPrefix: string; physicalPitch: string; worldContact: string; model: string; field: string }>;
}>;
type ReaderContract = { readOwnedRunnerField(cut: OwnedRunnerFieldCutContract): OwnedRunnerFieldKinematicsContract };
/** Each test obtains the required API before asserting a hostile input throws,
 * so an absent method cannot masquerade as a passing rejection test. */
export const requireOwnedRunnerFieldRead = (reader: unknown): ReaderContract['readOwnedRunnerField'] => {
  const method = (reader as Partial<ReaderContract>)?.readOwnedRunnerField;
  if (typeof method !== 'function') throw new Error('owned runner field kinematics reader capability is not implemented');
  return method.bind(reader);
};

/** Genuine bounded field derivation with explicit upstream source-reader mocks.
 * This fixture proves neither legal producer construction nor Native admission. */
export const ownedRunnerKinematicsFixture = (state: { flight: unknown; response: unknown; bases: unknown }, path?: string,
  configure?: (inputs: ReturnType<typeof ownedRunnerFieldInputs>) => void) => {
  const x = ownedRunnerFieldInputs(path); configure?.(x); state.flight = x.flight;
  const world = x.deriveWorld(), root = x.deriveRoot(world); state.response = root.response; state.bases = x.bases;
  const own = battedWorldFieldEvidenceFromSqlite(x.db), first = own.derive(x.source); x.archive(first);
  const secondSource = { ...x.source, sourceId: 'runner-field-2', previousFieldSourceId: first.source.sourceId, throughTick: x.source.throughTick + 100_000,
    commands: x.source.commands.map(command => command.playerId !== 'defender-0' ? command : { ...command, bodyAcceleration: { x: 2, y: 0, z: 0 },
      primitiveMotions: command.primitiveMotions.map(part => part.role !== 'right_foot' ? part : { ...part, offsetAcceleration: { x: 0, y: 0, z: 0.4 } }) }) };
  const second = own.derive(secondSource); x.archive(second);
  const cut: OwnedRunnerFieldCutContract = { kind: 'owned_runner_field_v1', physicalPitchSourceId: x.flight.source.physicalPitchSourceId,
    fieldSourceId: second.source.sourceId, playerId: 'runner' };
  return { ...x, ...root, world, own, first, second, cut };
};
