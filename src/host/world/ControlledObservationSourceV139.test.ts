import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { authoredNativeMatchFixture } from '../../integration/native-game/AuthoredNativeMatchV1.test-support';
import { initializeAuthoredNativeMatchV1 } from '../../integration/native-game/AuthoredNativeMatchV1';
import { acceptAuthoredMeasuredBattingFixture } from '../../integration/native-game/AuthoredMeasuredBattingV1.test-support';
import { openSqlitePlayerBattingModelStore } from './SqlitePlayerBattingModelStore';

const contactAimV138 = { version: 'measured_bat_contact_aim_v138' as const, lateralOffsetM: 0, verticalOffsetM: -.01, maximumOffsetM: .02 };
function originalWorld() {
  const path = join(mkdtempSync(join(tmpdir(), 'controlled-observer-source-v139-')), 'match.sqlite');
  const declaration = authoredNativeMatchFixture({ bodyDay: 1 }), genesis = initializeAuthoredNativeMatchV1(path, declaration);
  return { path, genesis, ns: declaration.clocks[0].namespace };
}

/** Real model/Person/body Owners, eighteen original people. No practice,
 * qualification, game SWING or physical contact is claimed by this small test. */
it('COS139 admits a separate day1 model whose only observation value changes are the two explicit synthetic error ceilings', () => {
  const old = originalWorld(), controlled = originalWorld();
  const options = { bodyMaterializationSourceId: old.ns + ':materialization:batter:practice', contactAimV138 };
  const baseline = acceptAuthoredMeasuredBattingFixture(old.path, old.genesis, old.ns, 1, options);
  const controlledOptions = { ...options, controlledObservationV139: true as const };
  const next = acceptAuthoredMeasuredBattingFixture(controlled.path, controlled.genesis, controlled.ns, 1, controlledOptions);
  expect(next.source.sourceId).toBe(baseline.source.sourceId + ':controlled-observer-v139');
  expect(next.parameters.observationCalibration.sourceId).toBe(baseline.parameters.observationCalibration.sourceId + ':controlled-observer-v139');
  expect(next.source.sourceVersion).not.toBe(baseline.source.sourceVersion);
  expect(next.parameters.observationCalibration.sourceVersion).not.toBe(baseline.parameters.observationCalibration.sourceVersion);
  expect(next.source.acceptedAtDay).toBe(1);
  const originalValues = baseline.parameters.observationCalibration.values;
  expect(next.parameters.observationCalibration.values).toEqual({ ...originalValues, calibration: { ...originalValues.calibration,
    errorParameters: { ...originalValues.calibration.errorParameters, maximumPositionErrorMeters: .02, maximumVelocityErrorMps: .05 } } });
  expect(baseline.parameters.observationCalibration.values.calibration.errorParameters).toMatchObject({ maximumPositionErrorMeters: 2, maximumVelocityErrorMps: 4 });
  expect(next.parameters.repertoire).toEqual(baseline.parameters.repertoire);
  for (const key of ['capability', 'decisionModel', 'equipment', 'predictionCalibration'] as const) expect(next.parameters[key]).toEqual(baseline.parameters[key]);
  expect(next.model.bodyMaterialization).toEqual(baseline.model.bodyMaterialization);
  const reader = openSqlitePlayerBattingModelStore(controlled.path);
  try { expect(reader.read(next.source.sourceId)).toEqual(next.model); } finally { reader.close(); }
}, 30_000);

it('COS139 rejects the controlled observer option without the independently explicit V138 candidate', () => {
  const f = originalWorld();
  const options = { bodyMaterializationSourceId: f.ns + ':materialization:batter:practice', controlledObservationV139: true as const };
  expect(() => acceptAuthoredMeasuredBattingFixture(f.path, f.genesis, f.ns, 1, options)).toThrow(/contact.*aim|candidate/i);
}, 30_000);
