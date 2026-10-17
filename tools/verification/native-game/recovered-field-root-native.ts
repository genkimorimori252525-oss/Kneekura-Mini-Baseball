import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deepStrictEqual, strictEqual } from 'node:assert';
import { readInitialJointRecoveryExecutionFromSqlite, initialJointRecoveryExecutionTable } from '../../../src/host/world/SqliteInitialJointRecoveryExecutionStore';
import { samePaExecutionReference as reference } from '../../../src/host/world/SamePlateAppearanceExecutionFromSqlite';
import { withBattedWorldPhysicalReadTraversal } from '../../../src/host/world/SqliteBattedWorldFieldExecutionStore';
import { withSamePaLifecycleReadPhase } from '../../../src/host/world/SamePlateAppearanceLifecycleFromSqlite';
import { actorJson as json } from '../../../src/host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { cloneInert } from '../../../src/core/adjudication/OfficialWindowPolicy';
import { prepareRecoveredBallFieldRootV1 } from '../../../src/core/sim/pitch/RecoveredBallFieldRootV1';
import { createSourceBallWorldMotionSessionV1 } from '../../../src/core/sim/ball/SourceBallWorldMotionV1';
import type { BattedActorResponseProfile } from '../../../src/core/sim/ball/BattedBallContactResponse';

const [inputArg, outputArg] = process.argv.slice(2);
if (!inputArg || !outputArg) throw new Error('requires original recovery directory and NEW output directory');
const input = resolve(inputArg), output = resolve(outputArg), path = resolve(input, 'match.sqlite');
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const durable = () => ({ main: sha(path), wal: existsSync(path + '-wal') && readFileSync(path + '-wal').length ? sha(path + '-wal') : null });
const beforeDurable = durable(), expected = JSON.parse(readFileSync(resolve(input, 'execution.json'), 'utf8'));
deepStrictEqual(beforeDurable, JSON.parse(readFileSync(resolve(input, 'independent-readback.json'), 'utf8')).beforeDurableContent);
mkdirSync(output);
const save = (name: string, value: unknown) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const Native = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const db = new Native.DatabaseSync(path, { readOnly: true });
const census = () => ({ schema: db.prepare('SELECT type,name,tbl_name,sql FROM main.sqlite_master ORDER BY type,name').all(),
  rows: db.prepare("SELECT name FROM main.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => [r.name,
    createHash('sha256').update(JSON.stringify(db.prepare('SELECT * FROM main."' + String(r.name).replaceAll('"', '""') + '"').all().map(v => JSON.stringify(v)).sort())).digest('hex')]) });
try {
  const before = census(); strictEqual(before.rows.length, 78); db.exec('PRAGMA query_only=1; BEGIN');
  process.stdout.write('RECONSTRUCT_OWNED_RECOVERY_WITH_NORMAL_READERS\n');
  const recovery = withBattedWorldPhysicalReadTraversal(db, () => withSamePaLifecycleReadPhase(db,
    () => readInitialJointRecoveryExecutionFromSqlite(db, reference(initialJointRecoveryExecutionTable, expected))));
  strictEqual(json(cloneInert(recovery)), json(expected));
  const w = recovery.input.control.world;
  const identity = [...w.pitch.otherActors.map(a => ({ playerId: a.playerId, role: a.primitive.role })),
    { playerId: w.pitch.pitcherPlayerId, role: 'tag_hand' as const }];
  // Explicit SYNTHETIC material fixture. No model/Native authority is inferred.
  const materialBasis = 'EXPLICIT_SYNTHETIC_SOURCE_SEAM_TEST_NOT_PLAYER_OR_VENUE_CALIBRATION';
  const actorProfiles = identity.map(a => ({ playerId: a.playerId, profile: a.role === 'glove'
    ? { role: 'glove' as const, pocketCenterOffset: { x: 0, y: 0, z: 0 }, bodyStability: 1, parameters: {
      ticksPerSecond: 1e6, ballMassKg: w.ball.massKg, ballRadiusMeters: w.ball.radiusM, pocketRadiusMeters: .1,
      centerRetentionCapacityJ: 20, captureDissipationPowerW: 1000, failedContactRestitution: .1, failedTangentialDamping: .3, failedSpinDamping: .1 } }
    : { role: a.role, material: { restitution: .3, tangentialDamping: .2, spinDamping: .1 } } as BattedActorResponseProfile }));
  const request = { version: 'recovered_ball_field_root_v1' as const, recovery: recovery.input,
    holdThroughTick: recovery.executedThroughMoment.ball.tick + 1000000, equipmentId: 'retained-original-bat',
    actorProfiles, surfaces: [], surfaceProfiles: [], baseGeometry: null };
  save('request.json', request);
  const prepared = prepareRecoveredBallFieldRootV1(request); save('root.json', prepared);
  strictEqual(json(prepared.state.cursor.moment), json(recovery.executedThroughMoment));
  strictEqual(prepared.root.response.world.actors.length, w.pitch.otherActors.length + 1);
  strictEqual(prepared.root.heldBats.length, 1); strictEqual(prepared.nativeAdmission, false);
  strictEqual(prepared.requiresNewCumulativeWorkloadAssessment, true);
  const session = createSourceBallWorldMotionSessionV1(prepared.root);
  const trace: ReturnType<typeof session.advance>[] = [];
  for (let step = 0; step < 256; step++) {
    const next = session.advance(request.holdThroughTick); trace.push(next);
    if (next.kind !== 'world' || next.state.stopped || next.state.cursor.moment.ball.tick >= request.holdThroughTick) break;
  }
  save('conditional-trace.json', trace);
  strictEqual(trace.length > 0, true);
  strictEqual(trace[0].kind, 'world');
  const terminal = session.snapshot(), tps = prepared.root.cursor.sourceCurve!.profile.air.ticksPerSecond;
  strictEqual(trace.at(-1)!.kind, 'world'); strictEqual(terminal.stopped, false);
  strictEqual(terminal.cursor.moment.elapsedSeconds, (request.holdThroughTick - prepared.root.cursor.moment.originTick) / tps);
  strictEqual(terminal.cursor.moment.ball.tick, request.holdThroughTick);
  const groundContactCount = trace.reduce((count, step) => count + (step.kind === 'world' ? step.observed.contacts.filter(c => c.kind === 'ground').length : 0), 0);
  strictEqual(groundContactCount > 0, true);
  deepStrictEqual(census(), before); db.exec('COMMIT'); deepStrictEqual(durable(), beforeDurable);
  save('native-report.json', { status: 'PASS_NATIVE_READONLY_EXACT_OFFSET_FIELD_SEAM', ownerMocks: false, authorCallbacks: false,
    actualRecoveryAuthenticated: true, all78SchemasAndRowsUnchanged: true, durableContentUnchanged: true, beforeDurableContent: beforeDurable,
    originalOriginTick: prepared.root.cursor.moment.originTick, originalSourceInitialElapsedSeconds: prepared.root.cursor.sourceCurve!.initial.elapsedSeconds,
    actualStartElapsedSeconds: prepared.root.cursor.moment.elapsedSeconds, conditionalEndElapsedSeconds: session.snapshot().cursor.moment.elapsedSeconds,
    actorCount: prepared.root.response.world.actors.length, retainedBatCount: 1, stepCount: trace.length, finalKind: trace.at(-1)!.kind,
    requestedHorizonReached: true, stopped: false, groundContactCount,
    materialBasis, modelCalibrationAuthenticated: false, geometryScope: 'original_actors_actual_held_bat_ground_only',
    stadiumGeometryConnected: false, physicalExecutionAdmitted: false, motionIssued: false, requiresNewCumulativeWorkloadAssessment: true,
    requiresSuccessorActuationRight: true, nextMotionAllowed: false, fullMatchVerified: false });
  process.stdout.write('PASS_NATIVE_READONLY_EXACT_OFFSET_FIELD_SEAM\n');
} catch (error) {
  save('rejected-query.json', { error: error instanceof Error ? error.message : String(error), physicalExecutionAdmitted: false,
    motionIssued: false, durableContentUnchanged: JSON.stringify(durable()) === JSON.stringify(beforeDurable) }); throw error;
} finally { db.close(); }
