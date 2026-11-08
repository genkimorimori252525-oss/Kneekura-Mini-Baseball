import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readSamePaPhysicalOperationFromSqlite } from '../../../src/host/world/SamePlateAppearancePhysicalEpisodeFromSqlite';
import { actorHash } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { withSqliteReadTransaction } from '../../../src/host/world/SqliteReadTransaction.test-support';
import { createSourceFreeBallKernel } from '../../../src/core/sim/ball/SourceFreeBallKernel';
import { deriveSamePaFieldRuleEvidence } from '../../../src/host/world/SamePlateAppearanceFieldRuleEvidence';

// A closed actual prefix, with no store opener or Source admission callback.
// The original owner rederives root/step and every dependency before comparison.
const directory = resolve(process.argv[2]!);
const path = join(directory, 'original-field.sqlite');
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const pin = JSON.parse(readFileSync(join(directory, 'receipt.json'), 'utf8'));
const databaseHash = sha(readFileSync(path));
assert.equal(databaseHash, pin.databaseSha256);
const sourceBytes = readFileSync(join(directory, 'accepted-sources.json'));
assert.equal(sha(sourceBytes), pin.sourceMapSha256);
const sources = new Map<string, unknown>(JSON.parse(sourceBytes.toString('utf8')));
const expected = pin.sourceReference;
assert.equal(expected.owner, 'pa_physical_v1_field_steps');
const started = Date.now(), db = new DatabaseSync(path, { readOnly: true });
let result;
try {
  result = withSqliteReadTransaction(db, () => {
    assert.equal(db.prepare('PRAGMA integrity_check').get()!.integrity_check, 'ok');
    const stepProof = readSamePaPhysicalOperationFromSqlite(db, expected);
    if (stepProof.record.kind !== 'same_pa_physical_field_step_v1') throw new Error('expected actual field step');
    const step = stepProof.record;
    const rootProof = readSamePaPhysicalOperationFromSqlite(db, step.source.fieldRootReference);
    if (rootProof.record.kind !== 'same_pa_physical_field_root_v1') throw new Error('expected actual field root');
    const root = rootProof.record;
    for (const [value, table] of [[root, 'pa_physical_v1_field_roots'], [step, 'pa_physical_v1_field_steps']] as const) {
      const row = db.prepare('SELECT source_json,source_hash,snapshot_json,snapshot_hash FROM ' + table + ' WHERE source_id=?').get(value.source.sourceId);
      assert.ok(row);
      assert.deepEqual(value.source, sources.get(value.source.sourceId));
      assert.deepEqual(value.source, JSON.parse(String(row.source_json)));
      assert.deepEqual(value, JSON.parse(String(row.snapshot_json)));
      assert.equal(actorHash(value.source), row.source_hash); assert.equal(actorHash(value), row.snapshot_hash);
    }
    const curve = root.response.world.sourceCurve;
    assert.ok(curve);
    assert.deepEqual(curve.profile, root.source.ballPhysics);
    assert.deepEqual(curve.initial.ball, root.response.world.flight.initialBall);
    assert.equal(curve.initial.originTick, 34054636);
    assert.equal(curve.initial.elapsedSeconds, 0);
    assert.equal(step.actionResult, undefined);
    assert.equal(step.field.motion.response.kind, 'ground');
    const moment = step.field.motion.world.moment;
    const admittedHorizon = (step.source.throughTick - curve.initial.originTick) / curve.profile.air.ticksPerSecond;
    const kernel = createSourceFreeBallKernel({ ...curve, throughElapsedSeconds: Math.max(curve.throughElapsedSeconds, admittedHorizon) });
    const incoming = kernel.evaluateAt(moment.elapsedSeconds, 'incoming');
    const outgoing = kernel.evaluateAt(moment.elapsedSeconds, 'outgoing');
    assert.deepEqual(moment, incoming.moment);
    assert.ok(step.field.motion.cursor);
    assert.deepEqual(step.field.motion.cursor.moment, outgoing.moment);
    assert.deepEqual(step.field.motion.cursor.sourceCurve!.initial, curve.initial);
    assert.equal(incoming.moment.originTick, outgoing.moment.originTick);
    assert.equal(incoming.moment.elapsedSeconds, outgoing.moment.elapsedSeconds);
    assert.equal(incoming.moment.ball.tick, outgoing.moment.ball.tick);
    assert.equal(incoming.moment.ball.position.y, curve.profile.ground.radiusM);
    assert.equal(outgoing.moment.ball.velocity.y, -incoming.moment.ball.velocity.y * curve.profile.ground.material.restitution);
    assert.notEqual(root.response.world.parameters.groundRestitution, curve.profile.ground.material.restitution);
    assert.notEqual(root.response.world.parameters.groundFriction, curve.profile.ground.material.slidingFriction);
    assert.throws(() => deriveSamePaFieldRuleEvidence({ fields: [root, step], batterRunnerId: stepProof.actor.binding.playerId,
      defenderIds: stepProof.actor.defenderBindings.map(value => value.playerId), outsAtStart: stepProof.actor.match.outs }), /unsupported same-PA Aero\/ground/);
    return { rootReference: rootProof.reference, stepReference: stepProof.reference, rootSourceVersion: root.source.sourceVersion,
      stepSourceVersion: step.source.sourceVersion, rootHeaderHash: actorHash(root.response.world.parameters),
      actorPrimitives: step.field.motion.actors.length, actualGroundIncoming: incoming.moment, actualGroundOutgoing: outgoing.moment,
      sameMomentAcrossResponse: true, sourceBasisPreserved: true,
      remainingSecondsUntilQuantizedTick: (moment.ball.tick - moment.originTick) / curve.profile.air.ticksPerSecond - moment.elapsedSeconds,
      solverVersion: step.ballSolverEvidence?.solverVersion ?? 'source_continuous_v2',
      rulesUnsupported: true, custodyConnected: false, officialResult: null, scoringResult: null };
  });
} finally { db.close(); }
assert.equal(sha(readFileSync(path)), databaseHash);
assert.equal(sha(readFileSync(join(directory, 'accepted-sources.json'))), sha(sourceBytes));
const receipt = { status: 'PASS_CLOSED_ACTUAL_AERO_FIELD_PREFIX_ORIGINAL_OWNER_AND_SAME_KERNEL', databaseHash,
  sourceMapHash: sha(sourceBytes), ...result, databaseBytesUnchanged: true, sourceBytesUnchanged: true,
  nodeVersion: process.version, sqliteVersion: process.versions.sqlite, elapsedMilliseconds: Date.now() - started,
  newAdmissions: 0, teamExecutionCredit: 0 };
writeFileSync(join(directory, 'closed-original-owner-read.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
console.log(JSON.stringify(receipt));
