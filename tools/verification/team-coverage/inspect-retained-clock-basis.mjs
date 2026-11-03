import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const directory = resolve(process.argv[2]), path = join(directory, 'closed-prefix.sqlite');
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), before = sha(readFileSync(path));
const db = new DatabaseSync(path, { readOnly: true });
let report;
try {
  const root = JSON.parse(db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_roots WHERE source_id=?')
    .get('team-retained:field:field-root').snapshot_json);
  const latest = JSON.parse(db.prepare('SELECT snapshot_json FROM pa_physical_v1_field_steps ORDER BY rowid DESC LIMIT 1').get().snapshot_json);
  const physicalTPS = root.response.world.parameters.ticksPerSecond;
  const calibrations = db.prepare('SELECT source_id,source_json FROM pa_lifecycle_v1_execution_calibrations WHERE view_source_id=? AND route=? ORDER BY rowid')
    .all('team-retained:cut19:view', 'defender_observation').map(row => {
      const source = JSON.parse(row.source_json);
      assert.equal(source.nominalReference.owner, 'world_player_observation_models');
      const nominal = JSON.parse(db.prepare('SELECT snapshot_json FROM world_player_observation_models WHERE source_id=?')
        .get(source.nominalReference.sourceId).snapshot_json).source.calibration;
      const effective = source.response.values;
      return { sourceId: row.source_id, sourceVersion: source.sourceVersion, nominalReference: source.nominalReference,
        nominalTicksPerSecond: nominal.memoryDecayParameters.ticksPerSecond,
        effectiveTicksPerSecond: effective.memoryDecayParameters.ticksPerSecond,
        nominalRefreshTicks: nominal.refreshPolicy, effectiveRefreshTicks: effective.refreshPolicy,
        nominalAttendedSeconds: nominal.refreshPolicy.attendedIntervalTicks / nominal.memoryDecayParameters.ticksPerSecond,
        effectiveAttendedSeconds: effective.refreshPolicy.attendedIntervalTicks / effective.memoryDecayParameters.ticksPerSecond,
        nominalErrorParameters: nominal.errorParameters, effectiveErrorParameters: effective.errorParameters,
        projectionDeclaration: source.observationClockProjection ?? null };
    });
  assert.equal(calibrations.length, 9);
  const moment = latest.field.motion.cursor.moment;
  report = { status: 'RAW_CLOSED_RETAINED_CLOCK_INSPECTION_NOT_NEW_OWNER_AUTHENTICATION', databaseHash: before,
    rootSourceId: root.source.sourceId, rootSourceTicksPerSecond: root.source.parameters.ticksPerSecond,
    rootResponseWorldTicksPerSecond: physicalTPS,
    actorPrimitiveTicksPerSecond: [...new Set(root.field.motion.actors.map(actor => actor.primitive.ticksPerSecond))],
    latestSourceId: latest.source.sourceId, evaluationTick: latest.evaluationTick,
    cursor: { originTick: moment.originTick, ballTick: moment.ball.tick, elapsedSeconds: moment.elapsedSeconds,
      integerTickDeltaSeconds: (moment.ball.tick - moment.originTick) / physicalTPS,
      integerLatticeCeilDifferenceSeconds: (moment.ball.tick - moment.originTick) / physicalTPS - moment.elapsedSeconds },
    calibrations, historicalCalibrationFamily: 'explicit_synthetic_execution_override_not_seconds_equivalent_nominal_projection',
    empiricalTimingValidated: false, mixedNineInningsCredit: 0, teamExecutionCredit: 0, officialResult: null };
} finally { db.close(); }
assert.equal(sha(readFileSync(path)), before);
writeFileSync(join(directory, 'clock-basis-raw-inspection.json'), JSON.stringify(report, null, 2), { flag: 'wx' });
console.log(JSON.stringify({ ...report, calibrations: { count: report.calibrations.length,
  nominalTPS: [...new Set(report.calibrations.map(row => row.nominalTicksPerSecond))],
  effectiveTPS: [...new Set(report.calibrations.map(row => row.effectiveTicksPerSecond))] } }));
