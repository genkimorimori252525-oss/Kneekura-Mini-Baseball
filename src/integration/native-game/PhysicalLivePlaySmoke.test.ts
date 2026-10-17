import { createHash } from 'node:crypto';
import { appendFileSync, constants, copyFileSync, readFileSync, writeFileSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { expect, it } from 'vitest';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import { actorHash } from '../../host/world/PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { runPhysicalLivePlaySmoke } from './PhysicalLivePlaySmoke';

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const original = new URL('../../../docs/verification/fixtures/first-base-known-profile-ended-56d96a.sqlite.gz.b64', import.meta.url);
const rawSha = '585ab7862ab93991e97cd5032ba8d520e113635559aa0019b5dd9bd43257a04a';
const gzipSha = '5d3e2af1326fa0d8bbf6325c80ddb0d467e14dfd2d13d02e305eb5064861a08b';
const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

const exactOriginalEndBytes = () => {
  const b64 = readFileSync(original, 'utf8');
  const gz = Buffer.from(b64.replace(/\s/g, ''), 'base64');
  expect(sha256(gz)).toBe(gzipSha);
  const bytes = gunzipSync(gz);
  expect(sha256(bytes)).toBe(rawSha);
  return bytes;
};

it('preserves the original physically sealed fair play and refuses an absent end without an official result', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kneekura-native-live-fail-closed-'));
  const path = join(dir, 'original-ended.sqlite');
  try {
    writeFileSync(path, exactOriginalEndBytes(), { flag: 'wx' });
    const before = new DatabaseSync(path, { readOnly: true });
    try {
      expect(before.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(before.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(before.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()).toEqual({ n: 1 });
      expect(before.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()).toEqual({ n: 1 });
      expect(before.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 0 });
    } finally { before.close(); }
    expect(() => runPhysicalLivePlaySmoke({
      databasePath: path, gameId: 'game-1', physicalEndSourceId: 'nonexistent-physical-end',
      adjudicationSource: { sourceId: 'rejected-adjudication', sourceVersion: 'fixture-v1',
        physicalEndSourceId: 'nonexistent-physical-end', policy: null },
      createClosureSource: () => { throw new Error('invalid missing physical end must never authorize a closure Source'); },
      createScoringSource: () => { throw new Error('invalid missing physical end must never authorize a scorer Source'); },
    })).toThrow('original physical fair-ground first-base retirement is not complete');
    const after = new DatabaseSync(path, { readOnly: true });
    try {
      expect(after.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 0 });
      expect(after.prepare('SELECT count(*) AS n FROM official_scoring_applications').get()).toEqual({ n: 0 });
      expect(after.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()).toEqual({ n: 1 });
    } finally { after.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}, 60_000);

// The complete path requires repeated original physical-history derivations and
// exceeded the separate 340-second external Native bound. Run it explicitly with
// BASEBALL_NATIVE_LIVE_FULL_ACCEPTANCE=1 under a supervisor that owns that bound;
// never convert an unfinished Native closure into a pretend ground-out result.
const fullNative = process.env.BASEBALL_NATIVE_LIVE_FULL_ACCEPTANCE === '1' ? it : it.skip;
fullNative('accepts the original sealed physically fielded fair-ground first-base OUT through Native official Match and scorer owners', () => {
  const began = performance.now();
  const evidenceDirectory = process.env.BASEBALL_NATIVE_LIVE_EVIDENCE_DIR;
  if (evidenceDirectory) mkdirSync(evidenceDirectory);
  const progress = (phase: string) => {
    const elapsedMs = Math.round(performance.now() - began);
    console.info(`Native physical live acceptance: ${phase} (${elapsedMs} ms)`);
    if (evidenceDirectory) appendFileSync(join(evidenceDirectory, 'phases.jsonl'), JSON.stringify({ phase, elapsedMs }) + '\n');
  };
  const dir = mkdtempSync(join(tmpdir(), 'kneekura-native-physical-live-smoke-'));
  const path = join(dir, 'original-fair-ground.sqlite');
  try {
    // Published fictional-player fixture: a genuinely owned end/fence, no official
    // application or scoring yet. Never reopen or mutate the repository's artifact.
    writeFileSync(path, exactOriginalEndBytes(), { flag: 'wx' });
    progress('original physical archive SHA authenticated');

    const db = new DatabaseSync(path, { readOnly: true });
    let nextWorldSetup: BetweenPlayWorldSetup;
    let batterRunnerId: string;
    try {
      expect(db.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      expect(db.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()).toEqual({ n: 1 });
      expect(db.prepare('SELECT count(*) AS n FROM actual_live_play_fences').get()).toEqual({ n: 1 });
      expect(db.prepare('SELECT count(*) AS n FROM applications').get()).toEqual({ n: 0 });
      const row = db.prepare('SELECT snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?')
        .get('pitch-0') as { snapshot_json: string };
      const physical = JSON.parse(row.snapshot_json) as {
        frame: { world: { defenders: readonly Readonly<{ playerId: string; registeredPosition: string; position: { x: number; z: number } }>[] };
          batterActor: { binding: { playerId: string } } };
      };
      const geometryRow = db.prepare('SELECT snapshot_json FROM batted_world_base_geometries LIMIT 1')
        .get() as { snapshot_json: string };
      const field = JSON.parse(geometryRow.snapshot_json) as {
        geometry: { bases: Record<'first' | 'second' | 'third',
          { region: { center: { x: number; z: number } } }> };
      };
      batterRunnerId = physical.frame.batterActor.binding.playerId;
      // These are the exact original accepted pitch/venue data, and are checked
      // again against physical sources by the unchanged Native closure owner.
      nextWorldSetup = {
        baseCenters: { first: field.geometry.bases.first.region.center,
          second: field.geometry.bases.second.region.center, third: field.geometry.bases.third.region.center },
        defenders: physical.frame.world.defenders.map(defender => ({
          playerId: defender.playerId,
          registeredPosition: defender.registeredPosition as BetweenPlayWorldSetup['defenders'][number]['registeredPosition'],
          position: defender.position,
        })),
        activePreviousPlayControllerIds: [],
      };
    } finally { db.close(); }

    const receipt = runPhysicalLivePlaySmoke({
      databasePath: path, gameId: 'game-1', physicalEndSourceId: 'physical-end',
      adjudicationSource: { sourceId: 'native-live-smoke-adjudication', sourceVersion: 'fixture-v1',
        physicalEndSourceId: 'physical-end',
        // Reuse the original, explicitly supplied NPB-window fixture contract.
        // The published NPB profile leaves review/challenge unspecified; an
        // unspecified window must never silently become disabled.
        policy: { sourceId: 'explicit-fixture-official-policy', sourceVersion: 'fixture-v1',
          ruleProfileId: 'npb-2026',
          officialWindows: { appeal: { available: true }, review: { available: false },
            challenge: { available: false } } } },
      createClosureSource: ({ physicalEnd, adjudication }) => {
        progress('physical end and official_ready authenticated');
        return {
          sourceId: 'native-live-smoke-closure', sourceVersion: 'fixture-v1',
          adjudicationSourceId: adjudication.source.sourceId, applicationId: 'native-live-smoke-application',
          closureTick: physicalEnd.playEnd.tick + 1, nextStartedAtTick: physicalEnd.playEnd.tick + 2,
          controllerReset: 'rule_system_retire_original_play',
          worldSetup: nextWorldSetup,
        };
      },
      createScoringSource: ({ physicalEnd, closure }) => {
        progress('official closure durably applied');
        return {
          sourceId: 'native-live-smoke-ground-out', sourceVersion: 'fixture-v1',
          gameId: physicalEnd.gameId, scoringApplicationId: 'native-live-smoke-scoring',
          closureReference: { sourceId: closure.source.sourceId, proposalHash: actorHash(closure.proposal) },
          evidence: { schemaVersion: 1, sourceKind: 'owned_ground_out',
            sourceEventId: 'native-live-smoke-ground-out', playId: physicalEnd.playId,
            closureId: closure.source.sourceId, batterRunnerId },
        };
      },
    });
    progress('owned ground-out scorer durably applied');
    if (evidenceDirectory) writeFileSync(join(evidenceDirectory, 'receipt.json'), JSON.stringify(receipt, null, 2), { flag: 'wx' });
    expect(receipt).toMatchObject({ authority: 'NODE_NATIVE_PHYSICAL_FAIR_GROUND_OUT', gameId: 'game-1',
      playId: 7, physicalPitchSourceId: 'pitch-0', physicalEndSourceId: 'physical-end',
      officialReceipt: { previousPlayId: 7, durableRevision: 1,
        appliedMatchState: { outs: 1, playId: 8, balls: 0, strikes: 0,
          bases: { first: null, second: null, third: null } } },
      scoring: { record: { classification: 'ground_out', runsScored: 0, hitsCredited: 0, errorsCharged: 0 } } });

    // Owners were closed by the harness. Independently reopen the real disk
    // archive and compare its actual stored application and scoring receipts.
    const reopened = new DatabaseSync(path, { readOnly: true });
    try {
      expect(reopened.prepare('PRAGMA integrity_check').get()).toEqual({ integrity_check: 'ok' });
      expect(reopened.prepare('PRAGMA foreign_key_check').all()).toEqual([]);
      const official = reopened.prepare('SELECT result_json FROM applications WHERE application_id=?')
        .get(receipt.officialReceipt.applicationId) as { result_json: string };
      const score = reopened.prepare('SELECT result_json FROM official_scoring_applications WHERE scoring_application_id=?')
        .get(receipt.scoring.scoringApplicationId) as { result_json: string };
      expect(JSON.parse(official.result_json).receipt).toEqual(receipt.officialReceipt);
      expect(JSON.parse(score.result_json)).toEqual(receipt.scoring);
      expect(reopened.prepare('SELECT count(*) AS n FROM actual_first_base_play_ends').get()).toEqual({ n: 1 });
      expect(reopened.prepare('SELECT count(*) AS n FROM actual_live_play_closures WHERE status=?').get('OFFICIAL_APPLIED'))
        .toEqual({ n: 1 });
      expect(reopened.prepare('SELECT count(*) AS n FROM actual_live_scoring_sources WHERE status=?').get('SCORED'))
        .toEqual({ n: 1 });
    } finally { reopened.close(); }
  } finally {
    if (evidenceDirectory) copyFileSync(path, join(evidenceDirectory, 'native-physical-live.sqlite'), constants.COPYFILE_EXCL);
    rmSync(dir, { recursive: true, force: true });
  }
}, 350_000);
