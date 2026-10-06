import type { DurablePersonPriors,
  SqlitePersonGenesisStore } from './SqlitePersonGenesisStore';
import type { DurablePlayerIntake,
  SqlitePlayerIntakeStore } from './SqlitePlayerIntakeStore';

export { openSqlitePlayerBodyCapabilityMaterializationStore } from './SqlitePlayerBodyCapabilityMaterializationStore';
export { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';
export type { AcceptedPlayerBattingModelV1, DurablePlayerBattingModelV1, AcceptedBattingCapability,
  AcceptedBattingRepertoire, AcceptedBattingDecisionModel, AcceptedBattingEquipment,
  AcceptedBattingObservationCalibration, AcceptedBattingPredictionCalibration,
  BattingModelAuthority, BattingModelStore } from './PlayerBattingModel';
export type { BodyMaterializationAuthority, BodyMaterializationRequest, BodyMaterializationReceipt,
  BodyMaterializationResult, BodyMaterializationStore, AcceptedBodySource, AcceptedPoseSource, AcceptedReachSource,
  BattedBodyModelAssembly, BodySourceRef } from './PlayerBodyCapabilityMaterialization';

export type MaterializedPlayerPerson = Readonly<{
  intake: DurablePlayerIntake;
  person: DurablePersonPriors;
}>;

/** Both stages are idempotent; retry the same source after a crash between them. */
export const materializeAcceptedPlayerPerson = (
  stores: Readonly<{ intake: SqlitePlayerIntakeStore;
    genesis: SqlitePersonGenesisStore }>,
  sourceId: string,
): MaterializedPlayerPerson => {
  const intake = stores.intake.accept(sourceId);
  const person = stores.genesis.materialize(sourceId);
  if (person.sourceId !== intake.source.sourceId
    || person.careerId !== intake.source.careerId
    || person.playerId !== intake.source.playerId
    || person.personId !== intake.source.personId
    || person.priors.createdAtDay !== intake.source.acceptedAtDay) {
    throw new Error('Player intake and Person genesis diverged');
  }
  return Object.freeze({ intake, person });
};
