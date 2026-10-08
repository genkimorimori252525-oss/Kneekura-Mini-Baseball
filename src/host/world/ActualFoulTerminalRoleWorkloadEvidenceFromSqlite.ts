import type { DatabaseSync } from 'node:sqlite';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { foulTerminalAcknowledgementAncestryFromSqlite } from './ActualFoulTerminalApplicationEvidenceFromSqlite';
import { foulTerminalRoleWorkloadAssessmentInput as input, deriveFoulTerminalRoleWorkloadActivity,
  type AcceptedFoulTerminalRoleWorkloadAssessment } from './ActualFoulTerminalRoleWorkloadAssessment';
import { prepareActualRoleWorkloadSettlement } from './ActualRoleWorkloadSettlementPlan';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { assertNoArchivedActualRoleWorkloadCharge, assertNoLegacyPitchWorkloadCharge } from './ActualRoleWorkloadChargeGuard';
import { foulTerminalWorkloadIdentityRow as identity, foulTerminalWorkloadScopeRows as scopeRows } from './ActualFoulTerminalRoleWorkloadMetadata';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualLivePlayId as id } from './ActualLivePlayScope';

export const foulTerminalRoleWorkloadContextFromSqlite = (db: DatabaseSync, terminalSourceId: string) => withBattedVenueLegalReadSnapshot(db, () => {
  if (!id(terminalSourceId)) throw new Error('invalid terminal workload Source');
  const ancestry = foulTerminalAcknowledgementAncestryFromSqlite(db).read(terminalSourceId);
  if (!ancestry || ancestry.archiveStage !== 'OFFICIAL_ACKNOWLEDGED_PENDING_POST_PLAY' || !ancestry.evidence) {
    throw new Error('terminal workload requires authentic acknowledged pending post-play');
  }
  const terminal = freeze({ ...ancestry.evidence, status: ancestry.archiveStage });
  const p = terminal.proposal;
  // The terminal reader already authenticated E on this same read snapshot.
  // Retain its exact archive hash convention; E intentionally omits full history.
  const row = db.prepare('SELECT * FROM main.actual_foul_play_ends WHERE source_id=?').get(p.physicalEndReference.sourceId);
  if (!row) throw new Error('terminal workload original E is missing');
  const end = JSON.parse(String(row.snapshot_json)) as Omit<FoulEndedEvidence, 'wholeHistory'>;
  if (row.source_hash !== p.physicalEndReference.sourceHash || row.snapshot_hash !== p.physicalEndReference.snapshotHash
    || row.snapshot_json !== json(end) || hash(end) !== row.snapshot_hash || end.kind !== 'ended'
    || end.wholeHistoryHashConvention !== 'owned_scheduled_whole_history_manifest_v1') throw new Error('terminal workload original E archive differs');
  const actors = [...p.participants].sort((a, b) => a.binding.playerId < b.binding.playerId ? -1 : a.binding.playerId > b.binding.playerId ? 1 : 0);
  if (actors.length !== 10 || new Set(actors.map(a => a.binding.playerId)).size !== 10
    || new Set(actors.map(a => a.person.personId)).size !== 10 || actors.filter(a => a.role === 'batter').length !== 1
    || actors.filter(a => a.role === 'defender').length !== 9 || actors.some(a => a.binding.careerId !== actors[0].binding.careerId
      || a.binding.gameId !== p.gameId || a.binding.gameDay !== actors[0].binding.gameDay)) throw new Error('terminal workload original participant set differs');
  return freeze({ terminal, actors, reference: { terminalSourceId,
    terminalReference: { owner: 'actual_foul_terminal_applications' as const, sourceId: terminal.source.sourceId,
      sourceVersion: terminal.source.sourceVersion, sourceHash: hash(terminal.source), proposalHash: hash(p),
      officialReceiptHash: hash(terminal.result.official.receipt), acknowledgementHash: hash(terminal.result.acknowledgement) },
    careerId: actors[0].binding.careerId, gameId: p.gameId, playId: p.playId, gameDay: actors[0].binding.gameDay,
    physicalEndReference: p.physicalEndReference,
    wholeHistoryReference: { hash: end.wholeHistoryHash, convention: end.wholeHistoryHashConvention },
    originalPhysicalPitchPrefix: p.originalPhysicalPitchPrefix } });
});
export type FoulTerminalRoleWorkloadContext = ReturnType<typeof foulTerminalRoleWorkloadContextFromSqlite>;
export const deriveFoulTerminalWorkloadAssessment = (context: FoulTerminalRoleWorkloadContext, raw: AcceptedFoulTerminalRoleWorkloadAssessment) => {
  const source = input(raw, raw.sourceId), ref = context.reference;
  const actor = context.actors.find(a => a.binding.playerId === source.participantReference.playerId);
  if (!actor || json(source.terminalReference) !== json(ref.terminalReference) || json(source.physicalEndReference) !== json(ref.physicalEndReference)
    || json(source.wholeHistoryReference) !== json(ref.wholeHistoryReference) || json(source.originalPhysicalPitchPrefix) !== json(ref.originalPhysicalPitchPrefix)
    || source.participantReference.bindingHash !== hash(actor.binding) || source.participantReference.personHash !== hash(actor.person)) {
    throw new Error('terminal workload original terminal/physical/participant reference differs');
  }
  const scope = { careerId: ref.careerId, gameId: ref.gameId, playId: ref.playId, playerId: actor.binding.playerId };
  return freeze({ source, ...scope, actor, activity: deriveFoulTerminalRoleWorkloadActivity(source, { ...scope, gameDay: ref.gameDay }) });
};
const scope = (c: FoulTerminalRoleWorkloadContext) => ({ terminalSourceId: c.reference.terminalSourceId,
  careerId: c.reference.careerId, gameId: c.reference.gameId, playId: c.reference.playId,
  physicalEndSourceId: c.reference.physicalEndReference.sourceId });
export const readFoulTerminalWorkloadAssessments = (db: DatabaseSync, c: FoulTerminalRoleWorkloadContext) => {
  for (const a of c.actors) assertNoLegacyPitchWorkloadCharge(db, { ...c.reference, playerId: a.binding.playerId });
  const values = scopeRows(db, 'actual_role_workload_assessments', scope(c)).map(row => {
    const owned = identity(db, 'actual_role_workload_assessments', String(row.source_id));
    if (!owned) throw new Error('terminal workload assessment missing');
    const value = deriveFoulTerminalWorkloadAssessment(c, input(JSON.parse(String(row.source_json)), String(row.source_id)));
    if (row.source_id !== value.source.sourceId || row.closure_source_id !== c.reference.terminalSourceId || row.career_id !== value.careerId
      || row.game_id !== value.gameId || row.play_id !== value.playId || row.player_id !== value.playerId
      || row.source_json !== json(value.source) || row.source_hash !== hash(value.source)
      || row.snapshot_json !== json(value) || row.snapshot_hash !== hash(value)) throw new Error('terminal workload assessment archive differs');
    return value;
  });
  if (new Set(values.map(v => v.playerId)).size !== values.length) throw new Error('terminal workload canonical participant charge alias differs');
  return values;
};
const assessmentHashes = (assessments: ReturnType<typeof readFoulTerminalWorkloadAssessments>) => assessments
  .map(a => ({ sourceId: a.source.sourceId, hash: hash(a) })).sort((a, b) => a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0);
const actorRefs = (c: FoulTerminalRoleWorkloadContext) => c.actors.map(a => ({ playerId: a.binding.playerId, personId: a.person.personId, clubId: a.binding.clubId }));
const assessmentRefs = (values: ReturnType<typeof readFoulTerminalWorkloadAssessments>) => values.map(v => ({ assessmentSourceId: v.source.sourceId, playerId: v.playerId, activity: v.activity }));
export const prepareFoulTerminalWorkloadPlan = (db: DatabaseSync, c: FoulTerminalRoleWorkloadContext) => {
  const assessments = readFoulTerminalWorkloadAssessments(db, c);
  const states = c.actors.map(a => readActualRoleWorkloadState(db, a.binding.careerId, a.binding.playerId, undefined, a.binding.personLinkSourceId)).filter(v => v !== null);
  const prepared = prepareActualRoleWorkloadSettlement(actorRefs(c), assessmentRefs(assessments), states);
  return prepared.kind === 'pending' ? freeze({ ...c.reference, ...prepared })
    : freeze({ ...c.reference, ...prepared, assessmentHashes: assessmentHashes(assessments) });
};
type Frozen = Extract<ReturnType<typeof prepareFoulTerminalWorkloadPlan>, { kind: 'frozen' }>;
export const foulTerminalWorkloadEvidenceFromSqlite = (db: DatabaseSync) => {
  const readSettlement = (terminalSourceId: string) => withBattedVenueLegalReadSnapshot(db, () => {
    const c = foulTerminalRoleWorkloadContextFromSqlite(db, terminalSourceId), ref = c.reference;
    const row = identity(db, 'actual_role_workload_settlements', terminalSourceId);
    const peers = scopeRows(db, 'actual_role_workload_settlements', scope(c));
    if (peers.length !== (row ? 1 : 0) || row && peers[0].closure_source_id !== terminalSourceId) {
      throw new Error('terminal workload frozen settlement ownership differs');
    }
    if (!row) {
      for (const actor of c.actors) {
        assertNoArchivedActualRoleWorkloadCharge(db, { ...ref, playerId: actor.binding.playerId });
      }
      const pending = prepareFoulTerminalWorkloadPlan(db, c);
      return pending.kind === 'pending' ? pending : freeze({ ...ref, kind: 'pending' as const,
        missingAssessments: [] as string[], missingBaselines: [] as string[], reason: 'settlement_not_frozen' as const });
    }
    const saved = JSON.parse(String(row.plan_json)) as Frozen, assessments = readFoulTerminalWorkloadAssessments(db, c);
    const states = c.actors.map(actor => {
      const p = saved.participants?.find(p => p.playerId === actor.binding.playerId);
      if (!p) throw new Error('terminal workload frozen original participant missing');
      const state = readActualRoleWorkloadState(db, ref.careerId, p.playerId, p.before.revision, actor.binding.personLinkSourceId);
      if (!state || json(state) !== json(p.before)) throw new Error('terminal workload frozen BEFORE differs');
      return state;
    });
    const prepared = prepareActualRoleWorkloadSettlement(actorRefs(c), assessmentRefs(assessments), states);
    if (prepared.kind !== 'frozen') throw new Error('terminal workload frozen assessment or baseline missing');
    const plan = freeze({ ...ref, ...prepared, assessmentHashes: assessmentHashes(assessments) });
    if (peers.length !== 1 || peers[0].closure_source_id !== terminalSourceId || row.career_id !== ref.careerId || row.game_id !== ref.gameId
      || row.play_id !== ref.playId || row.plan_json !== json(plan) || row.plan_hash !== hash(plan)) throw new Error('terminal workload frozen plan differs');
    const participants = plan.participants.map(p => {
      const matches = db.prepare(`SELECT * FROM main.world_player_workload_activities WHERE source_id=$id OR ${claim('source_json', ['sourceEventId'], '$id')}`).all({ id: p.activity.sourceEventId });
      if (matches.length > 1) throw new Error('terminal workload activity ownership differs');
      const activity = matches[0];
      if (activity && (activity.source_id !== p.activity.sourceEventId || activity.career_id !== ref.careerId || activity.player_id !== p.playerId
        || activity.before_revision !== p.before.revision || activity.after_revision !== p.after.revision || activity.source_json !== json(p.activity)
        || activity.before_json !== json(p.before) || activity.after_json !== json(p.after)
        || json(readActualRoleWorkloadState(db, ref.careerId, p.playerId, p.after.revision)) !== json(p.after))) throw new Error('terminal workload applied BEFORE/AFTER differs');
      const current = readActualRoleWorkloadState(db, ref.careerId, p.playerId);
      if (!current || (activity ? current.revision < p.after.revision || current.revision === p.after.revision && json(current) !== json(p.after)
        : json(current) !== json(p.before))) throw new Error('terminal workload participant current head differs');
      return { ...p, applied: !!activity };
    });
    return freeze({ ...plan, kind: participants.every(p => p.applied) ? 'complete' as const : 'applying' as const, participants });
  });
  return { readSettlement };
};
