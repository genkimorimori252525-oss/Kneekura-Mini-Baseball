import { createRequire } from 'node:module';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { bodySourceId as id } from './PlayerBodyCapabilityMaterialization';
import { withBodyCompositionTransaction } from './BodyMaterializationSqliteOwnership';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { battingModelSourceInput, type AcceptedPlayerBattingModelV1, type BattingModelAuthority,
  type BattingModelStore, type BattingModelParameters } from './PlayerBattingModel';

/** Immutable model compositions, with explicit accepted calibration inputs and original native body evidence. */
export const openSqlitePlayerBattingModelStore = (path: string, authority?: BattingModelAuthority): BattingModelStore => {
  if (!id(path) || authority !== undefined && ['readAcceptedModel', 'readAcceptedCapability', 'readAcceptedRepertoire',
    'readAcceptedDecisionModel', 'readAcceptedEquipment', 'readAcceptedObservationCalibration', 'readAcceptedPredictionCalibration']
    .some(key => typeof authority[key as keyof BattingModelAuthority] !== 'function')) throw new Error('invalid accepted Player batting model authority');
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite'), db = new DatabaseSync(path);
  try {
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS main.world_player_batting_models (
        source_id TEXT PRIMARY KEY,source_version TEXT NOT NULL,career_id TEXT NOT NULL,player_id TEXT NOT NULL,person_id TEXT NOT NULL,
        person_link_source_id TEXT NOT NULL,accepted_at_day INTEGER NOT NULL,
        source_json TEXT NOT NULL,source_hash TEXT NOT NULL,snapshot_json TEXT NOT NULL,snapshot_hash TEXT NOT NULL,
        UNIQUE(career_id,player_id,accepted_at_day)
      );`);
    const own = playerBattingModelEvidenceFromSqlite(db);
    let closed = false;
    const check = () => { if (closed) throw new Error('closed Player batting model store'); };
    const parameters = (source: AcceptedPlayerBattingModelV1): BattingModelParameters => cloneInert({
      capability: authority!.readAcceptedCapability(source.capabilityRef.sourceId),
      repertoire: authority!.readAcceptedRepertoire(source.repertoireRef.sourceId),
      decisionModel: authority!.readAcceptedDecisionModel(source.decisionModelRef.sourceId),
      equipment: authority!.readAcceptedEquipment(source.equipmentRef.sourceId),
      observationCalibration: authority!.readAcceptedObservationCalibration(source.observationCalibrationRef.sourceId),
      predictionCalibration: authority!.readAcceptedPredictionCalibration(source.predictionCalibrationRef.sourceId),
    }) as BattingModelParameters;
    return Object.freeze({
      read(sourceId: string) { check(); return withBodyCompositionTransaction(db, false, () => own.read(sourceId)); },
      selectAtDay(careerId: string, playerId: string, atDay: number) {
        check(); return withBodyCompositionTransaction(db, false, () => own.selectAtDay(careerId, playerId, atDay));
      },
      accept(sourceId: string) {
        check();
        return withBodyCompositionTransaction(db, true, () => {
          const prior = own.read(sourceId);
          if (prior) {
            if (authority) {
              const raw = authority.readAcceptedModel(sourceId);
              if (raw === null) throw new Error('accepted retry Player batting model Source is missing');
              const source = battingModelSourceInput(raw, sourceId);
              if (json(source) !== json(prior.source) || json(own.derive(source, parameters(source))) !== json(prior)) {
                throw new Error('Player batting model Source or parameter bytes are frozen differently');
              }
            }
            const current = own.read(sourceId);
            if (json(current) !== json(prior)) throw new Error('original Player batting model changed during retry');
            return current!;
          }
          const raw = authority?.readAcceptedModel(sourceId) ?? null;
          if (raw === null) throw new Error('accepted Player batting model Source is missing');
          const source = battingModelSourceInput(raw, sourceId), inputs = parameters(source), value = own.derive(source, inputs);
          own.assertHistory(source.careerId, source.playerId); own.assertParameterPins(value);
          db.prepare('INSERT INTO main.world_player_batting_models VALUES (?,?,?,?,?,?,?,?,?,?,?)')
            .run(source.sourceId, source.sourceVersion, source.careerId, source.playerId, source.personId, source.personLinkSourceId,
              source.acceptedAtDay, json(source), hash(source), json(value), hash(value));
          own.assertHistory(source.careerId, source.playerId);
          const saved = own.read(sourceId), current = own.derive(source, inputs);
          if (json(saved) !== json(value) || json(current) !== json(value)) throw new Error('Player batting model original owners changed during write');
          return saved!;
        });
      },
      close() { if (!closed) { db.close(); closed = true; } },
    });
  } catch (error) { db.close(); throw error; }
};
