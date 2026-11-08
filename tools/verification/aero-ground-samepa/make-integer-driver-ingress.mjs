import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Packages an already completed original-owner proof. Never opens SQLite or
// authenticates a Source by trusting the accompanying declaration map.
const [directoryArgument, outputArgument] = process.argv.slice(2);
assert.ok(directoryArgument && outputArgument, 'proof directory and new ingress path required');
const directory = resolve(directoryArgument), output = resolve(outputArgument);
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const input = read(join(directory, 'manifest.json'));
const prepare = read(join(directory, 'run/prepare.json'));
const advance = read(join(directory, 'run/advance.json'));
const admitted = read(join(directory, 'run/calibrate.json'));
const cold = read(join(directory, 'run/cold-reopen.json'));
assert.equal(cold.status, 'PASS_ONE_DEFENDER_EXECUTION_SINGLE_API_AND_COLD_ORIGINAL_OWNER_READ');
assert.notEqual(cold.pid, admitted.pid);
assert.equal(cold.sourceMapAuthorityNotUsedForReopen, true);
assert.equal(cold.newCalibrationRows, 1);
assert.equal(cold.bodyExecution, false);
assert.equal(cold.officialResult, null);
assert.equal(cold.oldSourcesUnchanged, true);
assert.deepEqual(cold.currentViewReference, advance.viewReference);
assert.deepEqual(cold.currentPhysicalReference, input.stepReference);
assert.deepEqual(cold.existingObservationReference, input.existingObservationReference);
assert.deepEqual(cold.calibrationReference, admitted.calibrationReference);
assert.equal(cold.calibrationHash, admitted.calibrationHash);
assert.equal(cold.targetTicksPerSecond, prepare.exactCursor.sourceCurve.profile.air.ticksPerSecond);
const moment = prepare.worldMoment;
assert.equal(moment.elapsedSeconds, (moment.ball.tick - moment.originTick) / cold.targetTicksPerSecond);
const closed = cold.closedCheckpoint;
assert.equal(closed.allRowsAndSchemaEqual, true);
assert.equal(sha(closed.databasePath), closed.databaseHash);
assert.equal(sha(closed.sourceMapPath), closed.sourceMapHash);
assert.equal(sha(input.databasePath), input.databaseHash);
assert.equal(sha(input.sourceMapPath), input.sourceMapHash);
const originalSources = new Map(read(input.sourceMapPath));
const currentSources = new Map(read(closed.sourceMapPath));
for (const [id, source] of originalSources) assert.deepEqual(currentSources.get(id), source);
const declaration = currentSources.get(cold.calibrationReference.sourceId);
assert.ok(declaration);
const physicalSource = currentSources.get(input.stepReference.sourceId);
assert.equal(physicalSource?.sourceVersion, 'same_pa_field_step_aero_ground_integer_boundary_v1');
assert.deepEqual(declaration.viewReference, advance.viewReference);
assert.deepEqual(declaration.observationClockProjection.fieldReference, input.stepReference);
assert.equal(declaration.member.playerId, input.playerId);
const ingress = {
  status: 'CLOSED_ORIGINAL_OWNER_PROOF_DRIVER_INGRESS',
  databasePath: closed.databasePath, sourceMapPath: closed.sourceMapPath,
  databaseHash: closed.databaseHash, sourceMapHash: closed.sourceMapHash,
  rootReference: input.rootReference, viewReference: advance.viewReference,
  currentPhysicalReference: input.stepReference,
  existingObservationReference: input.existingObservationReference,
  originalCalibrationViewReference: input.originalCalibrationViewReference,
  existingSingleCalibrationReference: cold.calibrationReference,
  playerId: input.playerId, worldMoment: moment, sourceSide: prepare.exactCursor.sourceSide,
  evaluationTick: prepare.evaluationTick, fieldHash: prepare.fieldHash,
  timelineHash: prepare.timelineHash, solverEvidenceHash: prepare.solverEvidenceHash,
  sourceVersion: physicalSource.sourceVersion,
  clock: { ticksPerSecond: cold.targetTicksPerSecond,
    observationAuthority: 'UNIT_CONVERSION_NOT_ABILITY_CHANGE',
    decisionAndLocomotionEmpiricalClockCalibration: 'UNKNOWN_NOT_SCALED' },
  firstUnperformedStage: 'reuse_current_view_p2_observation_calibration_then_remaining_routes_and_37_new_metadata',
  existingO1CountsTowardNewNineObservations: false,
  currentViewCalibrationCount: 1, remainingCurrentViewCalibrations: 'NOT_ADMITTED',
  sourceComposition: {
    description: 'b16 green ZIP overlay on df61388b src plus one pinned single-calibration Store',
    snapshotManifestPath: join(directory, 'frozen-source/snapshot-manifest.json'),
    snapshotManifestHash: sha(join(directory, 'frozen-source/snapshot-manifest.json')),
    entryPath: join(directory, 'entry.mjs'), entryHash: sha(join(directory, 'entry.mjs')),
    completeLatestProductionSnapshot: false,
  },
  originalOwnerColdProofPath: join(directory, 'run/cold-reopen.json'),
  originalOwnerColdProofHash: sha(join(directory, 'run/cold-reopen.json')),
  closedManifestPath: join(closed.directory, 'manifest.json'),
  originalSourceEntriesPreserved: originalSources.size,
  bodyExecution: false, teamExecutionCredit: 0, officialResult: null,
  authority: 'POINTERS_TO_ORIGINAL_OWNER_PROOF_NOT_NEW_SOURCE_ACCEPTANCE',
};
writeFileSync(output, JSON.stringify(ingress, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: 'PASS', output, sha256: sha(output),
  databaseHash: closed.databaseHash, sourceMapHash: closed.sourceMapHash,
  bodyExecution: false, officialResult: null }));
