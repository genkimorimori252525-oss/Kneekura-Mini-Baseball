import { createRequire } from 'node:module';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { getRuleProfile } from '../../core/rules/RuleProfile';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { actualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndFixtures.test-support';
import { resumeActualFirstBasePlayEndFixture } from './ActualFirstBasePlayEndResume.test-support';
import { actualFirstBasePlayEndEvidenceFromSqlite } from './ActualFirstBasePlayEndEvidenceFromSqlite';
import { actualLiveRuntimeEvidenceFromSqlite } from './SqliteActualLivePlayRuntimeStore';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { ownedScheduledMotionArchiveHash } from './OwnedScheduledMotionArchive';
import { ownedScheduledMotionTiming as phase } from './OwnedScheduledMotionTiming.test-support';

// The explicit output path selects this construction-only artifact gate. The
// ordinary positive test can subsequently extend its verified backup unchanged.
it.runIf(!!process.env.BASEBALL_FIRST_PLAY_CHAIN_OUTPUT_DB)('builds and reopens an original all-ten chain with actual capture, decision, motor and OUT rule while operative end stays pending', async () => {
  const path = join(mkdtempSync(join(tmpdir(), 'native-first-base-connection-')), 'state.sqlite');
  console.info('native-first-base-connection-database', path);
  const explicitId = process.env.BASEBALL_FIRST_PLAY_RULE_PROFILE_ID;
  const profile = explicitId === undefined ? undefined : { ruleProfileId: getRuleProfile(asRuleProfileId(explicitId)).id };
  const x = actualFirstBasePlayEndFixture(path, profile); let closed = false;
  try {
    if (profile) expect(x.f.initial.match.ruleProfileId).toBe(profile.ruleProfileId);
    expect(x.f.db.prepare('PRAGMA journal_mode').get()!.journal_mode).toBe('wal');
    expect(x.f.db.prepare('PRAGMA database_list').all().find(r => r.name === 'main')!.file).toBe(path);
    expect(x.runtime.membership.participants).toHaveLength(10);
    expect(x.runtime.membership.producers).toHaveLength(70);
    for (const value of [x.initialized, x.damping, x.captured, x.feet, x.adopted, x.quantized]) {
      if (value.execution.kind !== 'owned_motion_v2') throw new Error('actual all-ten owner missing');
      expect(value.execution.composition.contributors).toHaveLength(10);
      expect(value.execution.field.motion.actors).toHaveLength(50);
    }
    if (x.adopted.execution.kind !== 'owned_motion_v2') throw new Error('actual motor adoption missing');
    expect(x.adopted.execution.adoption.contributors.filter(c => c.motorSourceId !== null).map(c => c.motorSourceId)).toEqual([x.motor.source.sourceId]);
    const rule = x.executions.accept(x.source.sourceId);
    if (rule.execution.kind !== 'first_base_race') throw new Error('actual first-base rule missing');
    expect(rule.execution.ballEvidence).toMatchObject({ kind: 'grounded', territory: 'fair' });
    expect(rule.execution.groundRule?.correctRuleResult).toMatchObject({ kind: 'resolved', batterRunnerFirstBase: { kind: 'out' } });
    expect(rule.execution.groundRule?.actualChronology.firstDefenderControls).toHaveLength(1);
    expect(rule.execution.groundRule?.actualChronology.runnerTouch).not.toBeNull();
    const selves = actualPlayersKinematicsFromPrefix(x.playerIds, x.prefix(rule.source.sourceId));
    expect(selves.flatMap(s => s.roles)).toHaveLength(50);
    expect(selves.find(s => s.playerId === x.motor.source.playerId)!.ownedMotionCoverage!.rootAuthority.sourceId).toBe(x.motor.source.sourceId);
    const admissions = actualLiveRuntimeEvidenceFromSqlite(x.f.db).admissions(x.runtime);
    for (const [owner, sourceId] of [['actual_field_observations', x.decision.observation.source.sourceId],
      ['actual_defensive_decisions', x.decision.decision.source.sourceId], ['actual_locomotion_receipts', x.motor.source.sourceId],
      ['batted_world_field_executions', rule.source.sourceId]]) expect(admissions.some(a => a.owner === owner && a.sourceId === sourceId)).toBe(true);
    const request = { sourceId: 'pending-physical-end', sourceVersion: 'fixture-v1', runtimeSourceId: x.runtime.source.sourceId,
      baseFieldSourceId: x.baseField.source.sourceId, executionSourceId: rule.source.sourceId,
      ruleConsumptionSourceId: 'not-yet-acknowledged', umpireCallSourceId: 'not-yet-called', communicationSourceId: 'not-yet-emitted' };
    const pending = actualFirstBasePlayEndEvidenceFromSqlite(x.f.db).derive(request);
    expect(pending).toMatchObject({ kind: 'pending', playEnd: null, pendingReasons: ['canonical_rule_consumption_pending'] });
    const hash = ownedScheduledMotionArchiveHash(rule), rows = x.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all();
    x.f.close(); closed = true;
    phase('connection:closed-original-chain', 'point');
    const reopened = resumeActualFirstBasePlayEndFixture(path);
    try {
      expect(ownedScheduledMotionArchiveHash(reopened.race)).toBe(hash);
      expect(reopened.f.db.prepare('SELECT * FROM batted_world_field_executions ORDER BY revision').all()).toEqual(rows);
      expect(reopened.runtime).toEqual(x.runtime);
    } finally { reopened.f.close(); }
    const { DatabaseSync, backup } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
    const original = new DatabaseSync(path, { readOnly: true });
    try { await backup(original, process.env.BASEBALL_FIRST_PLAY_CHAIN_OUTPUT_DB!); } finally { original.close(); }
    phase('connection:verified-chain-backup', 'point');
  } finally { if (!closed) x.f.close(); }
}, 3_600_000);
