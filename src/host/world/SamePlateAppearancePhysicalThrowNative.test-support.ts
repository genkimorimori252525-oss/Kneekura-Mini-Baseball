import { createRequire } from 'node:module';
import { playerFieldingModelEvidenceFromSqlite } from './SqlitePlayerFieldingModelStore';
import { readSamePaLifecycleCalibrationFromSqlite } from './SamePlateAppearanceLifecycleFromSqlite';
import { samePaExecutionReference as reference } from './SamePlateAppearanceExecutionFromSqlite';
import { withSqliteReadTransaction } from './SqliteReadTransaction.test-support';
import type { AcceptedSamePaLifecycleThrowCalibration, SamePaFieldThrowValues } from './SamePlateAppearanceLifecycleCalibrationSource';
import type { samePaPhysicalLifecycleFixture } from './SamePlateAppearancePhysicalLifecycleFixture.test-support';
type Fixture = ReturnType<typeof samePaPhysicalLifecycleFixture>;
/** Additive qualification arm for an existing genuine current-cut fixture.
 * It explicitly accepts that fixture's nominal transfer/throw values as the
 * effective response; this is not a production fatigue policy or default.
 * No capture, release, field operation or synthetic row is created here. */
export const prepareNativePhysicalThrowCalibration = (h: Fixture, playerId: string, label: string, explicitValues?: SamePaFieldThrowValues) => {
  const current = h.current(), binding = h.f.actor.defenderBindings.find(b => b.playerId === playerId);
  const member = current.basis.members.find(m => m.playerId === playerId);
  if (!binding || !member) throw new Error('Native throw preparation original defender missing');
  const model = withSqliteReadTransaction(h.f.db, () => playerFieldingModelEvidenceFromSqlite(h.f.db)
    .selectAtDay(binding.careerId, playerId, binding.gameDay));
  const source: AcceptedSamePaLifecycleThrowCalibration = { sourceId: label + ':throw-calibration', sourceVersion: 'fixture-only-v1',
    capability: 'same_pa_lifecycle_execution_calibration_v1', enrollmentReference: current.view.lineage.enrollmentReference,
    viewReference: current.viewReference, firstPhysicalPitchSourceId: current.view.lineage.firstPhysicalPitchSourceId, member, route: 'defender_throw',
    nominalReference: reference('world_player_fielding_models', model), nominalParameterReference: null, acceptedAtDay: binding.gameDay,
    provenance: { assessmentSourceId: label + ':explicit-throw-response', assessmentVersion: 'fixture-only-v1',
      calibrationSourceId: label + ':explicit-nominal-throw-values', calibrationVersion: 'fixture-only-v1' },
    response: { kind: 'accepted_execution_values_v1', values: explicitValues ?? { transferParameters: model.source.transferParameters, throwCalibration: model.source.throwCalibration } } };
  current.accepted.set(source.sourceId, source);
  const value = current.owner.acceptThrowCalibration(source.sourceId);
  if (value.kind !== 'same_pa_lifecycle_calibration' || value.source.route !== 'defender_throw') throw new Error('Native throw preparation pending');
  const calibrationReference = reference('pa_lifecycle_v1_execution_calibrations', value);
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  const reopened = new DatabaseSync(h.f.path, { readOnly: true });
  try {
    const replay = withSqliteReadTransaction(reopened, () => readSamePaLifecycleCalibrationFromSqlite(reopened, calibrationReference));
    return { source, model, value, calibrationReference, replay };
  } finally { reopened.close(); }
};
