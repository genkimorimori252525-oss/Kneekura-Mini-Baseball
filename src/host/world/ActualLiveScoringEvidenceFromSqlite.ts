import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import type { PersistedOfficialScoring, PersistOfficialScoringInput } from '../SqliteOfficialScoringStore';
import type { ActualAdjudicationDb } from './ActualLiveAdjudicationFromSqlite';
import { actualLivePlayClosureEvidenceFromSqlite, actualLiveClosureApplicationRows } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualLiveScoringInput as input, type AcceptedActualLiveScoringSource } from './ActualLiveScoringSource';
import { actualScoringIdentityRow, assertActualScoringOwnership, scoringOwnershipRows } from './ActualLiveScoringMetadata';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { deriveActualGroundOutScoringEvidence } from './ActualGroundOutScoringEvidenceFromSqlite';
import type { AcceptedOfficialScoringEvidence } from '../SqliteOfficialScoringStore';

/** Authenticate original historical application/closure, not the later Match
 * head. Exact proposal hash includes original physics and selected review head. */
export const deriveActualLiveScoringProposal = (db: ActualAdjudicationDb, source: AcceptedActualLiveScoringSource) => {
  const s = input(source, source.sourceId);
  const closure = actualLivePlayClosureEvidenceFromSqlite(db).read(s.closureReference.sourceId);
  if (!closure || closure.status !== 'OFFICIAL_APPLIED' || !closure.officialApplied || !closure.result) {
    throw new Error('actual live scoring requires an applied original closure');
  }
  const p = closure.proposal, a = p.application;
  if (p.gameId !== s.gameId || a.matchId !== s.gameId || p.playId !== s.evidence.playId
    || hash(p) !== s.closureReference.proposalHash) throw new Error('actual live scoring closure/game/proposal differs');
  const owners = scoringOwnershipRows(db, 'actual_live_play_closures', [
    [{ column: 'source_id', value: closure.source.sourceId, mirrors: [
      ['source_json', ['sourceId']], ['proposal_json', ['source', 'sourceId']], ['result_json', ['sourceId']],
      ['proposal_json', ['application', 'adjudication', 'events', { array: 'all' }, 'closureId']],
      ...(['receipt', 'activation', 'result'] as const).flatMap(branch => [
        ['proposal_json', ['expectedOfficial', branch, 'closureId']], ['result_json', ['official', branch, 'closureId']],
      ] as const),
    ] }],
    [{ column: 'game_id', value: s.gameId, mirrors: [
      ['proposal_json', ['gameId']], ['proposal_json', ['application', 'matchId']],
      ['proposal_json', ['application', 'game', 'venueBinding', 'gameId']],
      ['proposal_json', ['expectedOfficial', 'result', 'gameId']], ['result_json', ['official', 'result', 'gameId']],
      ['proposal_json', ['expectedOfficial', 'result', 'venueBinding', 'gameId']], ['result_json', ['official', 'result', 'venueBinding', 'gameId']],
    ] }, { column: 'play_id', value: p.playId, mirrors: [
      ['proposal_json', ['playId']], ['proposal_json', ['application', 'match', 'playId']],
      ['proposal_json', ['application', 'adjudication', 'playId']], ['proposal_json', ['application', 'physicalTimeline', 'playId']],
      ...(['receipt', 'activation'] as const).flatMap(branch => [
        ['proposal_json', ['expectedOfficial', branch, 'previousPlayId']], ['result_json', ['official', branch, 'previousPlayId']],
      ] as const),
    ] }],
  ]);
  if (owners.length !== 1 || owners[0].source_id !== closure.source.sourceId) throw new Error('actual scoring original closure ownership differs');
  if (actualLiveClosureApplicationRows(db, a.applicationId).length !== 1) throw new Error('actual scoring closure application ownership differs');
  const official = scoringOwnershipRows(db, 'applications', [
    [{ column: 'application_id', value: a.applicationId, mirrors: (['receipt', 'activation', 'result'] as const).map(branch => ['result_json', [branch, 'applicationId']] as const) }],
    [{ column: 'closure_id', value: closure.source.sourceId, mirrors: (['receipt', 'activation', 'result'] as const).map(branch => ['result_json', [branch, 'closureId']] as const) }],
    [{ column: 'match_id', value: s.gameId, mirrors: [
      ['result_json', ['result', 'gameId']], ['result_json', ['result', 'venueBinding', 'gameId']],
    ] }, { column: 'NULL', value: p.playId, mirrors: [
      ['result_json', ['receipt', 'previousPlayId']], ['result_json', ['activation', 'previousPlayId']],
    ] }],
  ]);
  if (official.length !== 1 || official[0].application_id !== a.applicationId) throw new Error('actual scoring official application ownership differs');
  const batter = p.workload.participants.filter(participant => participant.role === 'BATTER_RUNNER');
  if (batter.length !== 1 || batter[0].playerId !== s.evidence.batterRunnerId) throw new Error('actual scoring original batter identity differs');
  const judgment = s.evidence.sourceKind === 'official_scorer_judgment' ? s.evidence.judgment : null;
  if (judgment?.kind === 'reached_on_error' && !p.workload.participants.some(participant => participant.role === 'DEFENDER'
    && participant.playerId === judgment.chargedFielderId)) throw new Error('actual scoring charged fielder is not an original defensive participant');
  if (s.evidence.sourceKind === 'official_caught_foul_scorer_judgment') {
    const catcher = s.evidence.catcherPlayerId;
    if (!p.workload.participants.some(participant => participant.role === 'DEFENDER' && participant.playerId === catcher)) {
      throw new Error('caught-foul scorer catcher is not an original defender');
    }
  }
  const ownedGroundOutEvidence = s.evidence.sourceKind === 'owned_ground_out'
    ? deriveActualGroundOutScoringEvidence(db, p, s.sourceId) : undefined;
  const classified = classifyClosedPlayForOfficialScoring({ kind: 'live_ball', match: a.match,
    timeline: a.physicalTimeline, adjudication: a.adjudication,
    ...(s.evidence.sourceKind === 'owned_ground_out' ? { groundOutEvidence: ownedGroundOutEvidence!.ground } : s.evidence.sourceKind === 'official_caught_foul_scorer_judgment'
      ? { caughtFoulEvidence: s.evidence } : { scoringEvidence: s.evidence }) });
  if (classified.kind !== 'supported') throw new Error('actual live scoring remains unsupported');
  const expectedScoring: PersistedOfficialScoring = { scoringApplicationId: s.scoringApplicationId, matchId: s.gameId,
    officialApplicationId: a.applicationId, closureId: closure.source.sourceId, sourceEventId: s.sourceId, record: classified.record };
  return freeze({ source: s, gameId: p.gameId, playId: p.playId, closureReference: s.closureReference,
    physicalEndReference: p.physicalEndReference, wholeHistoryReference: p.wholeHistoryReference,
    adjudicationReference: p.adjudicationReference,
    ...(p.postPlayReviewReference ? { postPlayReviewReference: p.postPlayReviewReference } : {}),
    application: a, originalReceipt: p.expectedOfficial, expectedScoring,
    ...(ownedGroundOutEvidence === undefined ? {} : { ownedGroundOutEvidence }) });
};
export type ActualLiveScoringProposal = ReturnType<typeof deriveActualLiveScoringProposal>;
export type ActualLiveScoringArchive = Readonly<{ source: AcceptedActualLiveScoringSource; proposal: ActualLiveScoringProposal;
  status: 'QUEUED' | 'SCORED'; result: PersistedOfficialScoring | null }>;
export const actualLiveAcceptedScoringEvidence = (p: ActualLiveScoringProposal): AcceptedOfficialScoringEvidence => {
  if (p.source.evidence.sourceKind !== 'owned_ground_out') return p.source.evidence;
  if (!p.ownedGroundOutEvidence) throw new Error('actual ground-out scoring physical sidecar missing');
  return p.ownedGroundOutEvidence;
};
export const actualLiveScoringRequest = (p: ActualLiveScoringProposal): PersistOfficialScoringInput => ({
  scoringApplicationId: p.source.scoringApplicationId, officialApplication: p.application, sourceEventId: p.source.sourceId,
});

/** This guard does not call a scoring store or an authority callback, so it is
 * safe on the generic scorer's writer connection without recursive decoding. */
export const assertActualLiveScoringStage = (db: ActualAdjudicationDb, p: ActualLiveScoringProposal, required = false) => {
  const s = p.source, e = p.expectedScoring;
  const rows = scoringOwnershipRows(db, 'official_scoring_applications', [
    [{ column: 'scoring_application_id', value: s.scoringApplicationId, mirrors: [
      ['request_json', ['input', 'scoringApplicationId']], ['result_json', ['scoringApplicationId']],
    ] }],
    [{ column: 'source_event_id', value: s.sourceId, mirrors: [
      ['request_json', ['input', 'sourceEventId']], ['request_json', ['evidence', 'sourceEventId']], ['result_json', ['sourceEventId']],
    ] }],
    [{ column: 'official_application_id', value: p.application.applicationId, mirrors: [
      ['request_json', ['input', 'officialApplication', 'applicationId']], ['result_json', ['officialApplicationId']],
    ] }],
    [{ column: 'closure_id', value: e.closureId, mirrors: [
      ['request_json', ['evidence', 'closureId']], ['result_json', ['closureId']], ['result_json', ['record', 'closureId']],
      ['request_json', ['input', 'officialApplication', 'adjudication', 'events', { array: 'all' }, 'closureId']],
    ] }],
    [{ column: 'match_id', value: p.gameId, mirrors: [
      ['request_json', ['input', 'officialApplication', 'matchId']],
      ['request_json', ['input', 'officialApplication', 'game', 'venueBinding', 'gameId']], ['result_json', ['matchId']],
    ] }, { column: 'NULL', value: p.playId, mirrors: [
      ['request_json', ['evidence', 'playId']], ['request_json', ['input', 'officialApplication', 'match', 'playId']],
      ['request_json', ['input', 'officialApplication', 'adjudication', 'playId']],
      ['request_json', ['input', 'officialApplication', 'physicalTimeline', 'playId']], ['result_json', ['record', 'playId']],
    ] }],
  ]);
  if (rows.length === 0 && !required) return null;
  const row = rows[0];
  if (rows.length !== 1 || row.scoring_application_id !== e.scoringApplicationId || row.match_id !== e.matchId
    || row.official_application_id !== e.officialApplicationId || row.closure_id !== e.closureId || row.source_event_id !== e.sourceEventId
    || row.request_json !== json({ input: actualLiveScoringRequest(p), evidence: actualLiveAcceptedScoringEvidence(p) }) || row.result_json !== json(e)) {
    throw new Error('actual live scoring application archive differs or is missing');
  }
  return e;
};

export const actualLiveScoringEvidenceFromSqlite = (db: ActualAdjudicationDb) => ({
  /** Source/dependency authentication deliberately excludes generic scoring. */
  readSource(sourceId: string): ActualLiveScoringArchive | null {
    const row = actualScoringIdentityRow(db, sourceId); if (!row) return null;
    const source = input(JSON.parse(String(row.source_json)), sourceId), proposal = deriveActualLiveScoringProposal(db, source);
    assertActualScoringOwnership(db, proposal, true);
    if (row.game_id !== source.gameId || row.play_id !== proposal.playId || row.closure_id !== source.closureReference.sourceId
      || row.scoring_application_id !== source.scoringApplicationId || row.official_application_id !== proposal.application.applicationId
      || row.source_json !== json(source) || row.source_hash !== hash(source)
      || row.proposal_json !== json(proposal) || row.proposal_hash !== hash(proposal)
      || !['QUEUED', 'SCORED'].includes(String(row.status))) throw new Error('actual scoring Source/proposal archive differs');
    const result = row.status === 'SCORED' ? proposal.expectedScoring : null;
    if (row.result_json !== (result === null ? null : json(result))) throw new Error('actual scoring stage receipt differs');
    return freeze({ source, proposal, status: row.status as 'QUEUED' | 'SCORED', result });
  },
});
