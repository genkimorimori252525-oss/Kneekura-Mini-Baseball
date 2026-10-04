import { assertActualLiveRuleApplicability } from './ActualLiveRuleApplicability';
import { actualLiveAdjudicationIdentityRow } from './ActualLiveAdjudicationMetadata';
import type { DatabaseSync } from 'node:sqlite';
import type { CorrectRuleEvidenceSnapshot, OwnedLiveCallImportInput } from '../../core/adjudication/PlayAdjudicationLedger';
import { projectActualFairFieldTimeline } from '../../core/sim/plateAppearance/ActualFairFieldTimeline';
import { actualFirstBaseClosedEvidenceFromSqlite, actualFirstBaseEndArchiveEncoding } from './SqliteActualFirstBasePlayEndStore';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type DurableBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import { battedWorldFieldPhysicalPrefix } from './BattedWorldFieldPhysicalPrefix';
import { actualObservationPhysicalPrefixEvidence } from './ActualObservationPhysicalPrefixHash';
import { actualFirstBaseUmpireEvidenceFromSqlite } from './SqliteActualFirstBaseUmpireStore';
import { actualLiveAdjudicationInput as input, actualLiveAdjudicationProfile, type AcceptedActualLiveAdjudication } from './ActualLiveAdjudicationSource';
import { projectActualLiveAdjudication } from './ActualLiveAdjudication';
import { ownedScheduledMotionArchiveHash as executionHash } from './OwnedScheduledMotionArchive';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
export type ActualAdjudicationDb = Pick<DatabaseSync, 'prepare'>;
const snapshot = (execution: DurableBattedWorldFieldExecution): CorrectRuleEvidenceSnapshot => {
  const rule = execution.execution;
  if (rule.kind !== 'first_base_race') throw new Error('actual adjudication requires original first-base rule evidence');
  const common = { snapshotId: `actual_first_base_rule:${execution.source.sourceId}`, evidenceRevision: execution.revision };
  const correct = rule.groundRule?.correctRuleResult;
  if (!correct || correct.kind === 'unresolved') return { ...common, resolution: 'unresolved',
    reason: correct?.batterRunnerFirstBase.kind === 'simultaneous' ? 'exact_simultaneity' : 'insufficient_evidence' };
  const race = correct.batterRunnerFirstBase;
  return { ...common, ruling: { outsAfter: correct.outsAfter,
    basesAfter: { first: race.kind === 'safe' ? race.runnerId : null, second: null, third: null }, scoredRunnerIds: [] } };
};
/** Same-connection proof reconstruction; a derivable proposal is never a persisted, sealed physical end. */
export const actualLiveAdjudicationEvidenceFromSqlite = (db: ActualAdjudicationDb) => {
  const derive = (raw: AcceptedActualLiveAdjudication) => {
    const source = input(raw, raw.sourceId);
    if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='actual_first_base_play_ends'").get()) throw new Error('accepted actual physical end is missing');
    const closed = actualFirstBaseClosedEvidenceFromSqlite(db), end = closed.read(source.physicalEndSourceId);
    if (!end) throw new Error('accepted actual physical end is missing');
    const endReference = { owner: 'actual_first_base_play_ends' as const, sourceId: end.source.sourceId, sourceVersion: end.source.sourceVersion,
      sourceHash: hash(end.source), snapshotHash: actualFirstBaseEndArchiveEncoding(end).hash };
    // The authenticated end owns rule-evidence applicability through its later retained suffix.
    // Its physical cut need not mint a new rule snapshot or replace the original call basis.
    const fields = battedWorldFieldEvidenceFromSqlite(db), executions = battedWorldFieldExecutionEvidenceFromSqlite(db);
    const baseField = fields.read(end.source.baseFieldSourceId), finalRule = executions.read(end.finalRuleReference.sourceId);
    if (!baseField || !finalRule || end.finalRuleReference.sourceId !== finalRule.source.sourceId
      || end.finalRuleReference.snapshotHash !== executionHash(finalRule)) throw new Error('actual adjudication final rule differs from sealed end');
    assertActualLiveRuleApplicability({ source: end.source, exactEnd: end.exactEnd, physicalPrefixReference: end.physicalPrefixReference,
      finalRuleReference: end.finalRuleReference, operativeCallReferences: end.operativeCallReferences,
      firstBaseEvidenceApplicability: end.firstBaseEvidenceApplicability }, finalRule.revision);
    const prefix = { baseField, fields: fields.scope(baseField, end.source.baseFieldSourceId), executions: executions.scope(baseField, end.source.executionSourceId) };
    if (json(actualObservationPhysicalPrefixEvidence(prefix)) !== json(end.physicalPrefixReference)) throw new Error('actual adjudication physical prefix differs');
    const physical = battedWorldFieldPhysicalPrefix({ ...prefix, custodyPolicy: 'release_exclusive_v1' });
    const frame = baseField.response.touch.worldContact.flight.physicalPitch.frame;
    const profile = actualLiveAdjudicationProfile(frame.match.ruleProfileId, source.policy);
    if (frame.gameId !== end.gameId || frame.match.playId !== end.playId || frame.world.runners.length
      || Object.values(frame.match.bases).some(v => v !== null) || finalRule.execution.kind !== 'first_base_race'
      || finalRule.execution.ballEvidence.kind !== 'grounded' || finalRule.execution.ballEvidence.territory !== 'fair') {
      throw new Error('actual adjudication original empty-base grounded scope differs');
    }
    const umpire = actualFirstBaseUmpireEvidenceFromSqlite(db), call = umpire.readAvailableCall(end.source.umpireCallSourceId, end.exactEnd);
    const references = umpire.importReferences(end.source.umpireCallSourceId);
    if (!call || call.schedule.kind !== 'called' || !call.onFieldCall || !references
      || json(references) !== json(end.operativeCallReferences)) throw new Error('actual adjudication operative call differs from sealed end');
    const originalRule = executions.read(call.observation.source.ruleExecutionSourceId);
    if (!originalRule || originalRule.baseField.source.sourceId !== baseField.source.sourceId
      || call.observation.gameId !== end.gameId || call.observation.playId !== end.playId
      || call.observation.physicalPitchSourceId !== end.physicalPitchSourceId) throw new Error('actual adjudication original call rule scope differs');
    const snapshots = [snapshot(originalRule)];
    if (originalRule.source.sourceId !== finalRule.source.sourceId) snapshots.push(snapshot(finalRule));
    const importCall: OwnedLiveCallImportInput = { eventId: `${source.sourceId}:call`, tick: end.playEnd.tick, call: call.onFieldCall,
      provenance: { version: 'owned_live_call_import_v1', gameId: end.gameId, playId: end.playId, physicalPitchSourceId: end.physicalPitchSourceId,
        clock: call.observation.clock, calledAtElapsedSeconds: call.schedule.calledAtElapsedSeconds,
        availableAtElapsedSeconds: call.schedule.availableAtElapsedSeconds, importedAtElapsedSeconds: end.exactEnd.elapsedSeconds,
        ...references, reception: null } };
    const projected = projectActualLiveAdjudication({ sourceId: source.sourceId, playId: end.playId, ruleProfile: profile,
      playEnd: end.playEnd, recordedAt: end.exactEnd, snapshots, call: importCall, appealApplicability: 'no_supported_tag_up_appeal' });
    const timeline = projectActualFairFieldTimeline({ originalTimeline: end.wholeHistory.originalTimeline, field: physical.field, playEnd: end.playEnd });
    const pendingReasons = [...projected.pendingReasons, ...(timeline.kind === 'unsupported' ? [`physical_timeline_projection_unsupported:${timeline.reason}`] : [])];
    return freeze({ source, kind: pendingReasons.length ? 'official_pending' as const : 'official_ready' as const,
      gameId: end.gameId, playId: end.playId, physicalPitchSourceId: end.physicalPitchSourceId, endReference,
      ruleApplicability: end.firstBaseEvidenceApplicability,
      wholeHistoryReference: { hash: end.wholeHistoryHash, convention: end.wholeHistoryHashConvention },
      originalMatch: frame.match, originalOfficialRevision: frame.officialRevision,
      ruleProfile: profile, policyReference: source.policy === null ? null : { sourceId: source.policy.sourceId, sourceHash: hash(source.policy) },
      appealApplicability: { kind: 'no_supported_tag_up_appeal' as const, basis: endReference,
        scope: 'original_empty_bases_grounded_first_base_only' as const },
      timeline, ledger: projected.ledger, pendingReasons });
  };
  const read = (sourceId: string): ReturnType<typeof derive> | null => {
    const row = actualLiveAdjudicationIdentityRow(db, 'actual_live_adjudications', sourceId);
    if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), sourceId), value = derive(source);
    const owners = db.prepare('SELECT source_id FROM actual_live_adjudications WHERE physical_end_source_id=? OR (game_id=? AND play_id=?)')
      .all(source.physicalEndSourceId, value.gameId, value.playId);
    if (owners.length !== 1 || owners[0].source_id !== sourceId || row.game_id !== value.gameId || row.play_id !== value.playId
      || row.physical_end_source_id !== source.physicalEndSourceId || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('actual adjudication archive differs');
    return value;
  };
  return { derive, read };
};
export type DurableActualLiveAdjudication = ReturnType<ReturnType<typeof actualLiveAdjudicationEvidenceFromSqlite>['derive']>;
