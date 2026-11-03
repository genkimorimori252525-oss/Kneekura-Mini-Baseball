import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { memoSamePaContinuationRead, withSamePaContinuationReadPhase } from './SamePlateAppearanceContinuationFromSqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** Complete pinned historical model only. Current admission, day selection and
 * Actor/participant checks remain with their original calibration owners. */
export const readSamePaPinnedBattingModelV124 = (db: DatabaseSync, pin: SamePaReference<'world_player_batting_models'>) =>
  withSamePaContinuationReadPhase(db, () => {
    // These checks run even before a hit. Keep their failure inside the
    // existing phase fence so a caller cannot catch it and revive old proof.
    assertBodyCompositionNativeConnection(db);
    const fixed = cloneInert(pin);
    if (!samePaReferenceValid(fixed, 'world_player_batting_models')) throw new Error('invalid pinned batting model reference');
    // Function-body-only live imports: no proof or phase is accessed during
    // module initialization through the calibration/continuation import cycle.
    return memoSamePaContinuationRead(db, 'pinned-batting-model-v124:' + json(fixed), () => {
      const value = playerBattingModelEvidenceFromSqlite(db).read(fixed.sourceId);
      if (!value || json(reference('world_player_batting_models', value)) !== json(fixed)) throw new Error('pinned batting model original differs');
      return freeze(value);
    });
  });
