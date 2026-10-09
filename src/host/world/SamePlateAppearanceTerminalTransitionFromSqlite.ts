import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { deriveClosedNonLiveMatchState, confirmDurableClosedNonLiveStateApplication } from '../../core/adjudication/NonLiveOfficialApplication';
import { classifyClosedPlayForOfficialScoring } from '../../core/adjudication/OfficialScoring';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveClosedLiveBallMatchState } from '../../core/adjudication/PlayAdjudicationLedger';
import { confirmDurableClosedLiveBallStateApplication } from '../../core/adjudication/NextPlayActivation';
import { prepareBetweenPlayWorld } from '../../core/adjudication/BetweenPlayWorldReset';
import { resolveOfficialGameProgression } from '../../core/world/competition/OfficialGameCompletion';
import { deriveOfficialPlayResult, deriveOfficialFinalResult } from '../SqliteOfficialStateWriter';
import { actorFreeze as freeze, actorJson as json, actorHash as hash } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readPhysicalClosureScoringHistory, derivePhysicalClosureLineScore } from './PhysicalPlayClosureEvidenceFromSqlite';
import { readSamePaTerminalEndpointFromSqlite } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { readSamePaTerminalSettlementFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { readActualRoleWorkloadState } from './ActualRoleWorkloadState';
import { foulApplicationOwnershipRows as ownerRows } from './ActualFoulTerminalApplicationOwnership';
import { originalFoulMetadataValues as values } from './OriginalFoulOwnershipMetadata';
import { samePaSettlementMetadataIdentity as claim } from './SamePlateAppearanceTerminalSettlementStorage';
import { assertSamePaTerminalEndpointStorage } from './SamePlateAppearanceTerminalStorage';
import { samePaReferenceValid, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import type { SamePaTerminalEndpoint, SamePaTerminalProofMode, SamePaTerminalTransitionRead } from './SamePlateAppearanceTerminalEndpoint';
import { samePaTerminalTransitionInput, type AcceptedSamePaTerminalTransition, type SamePaTerminalTransitionRecord, type SamePaTransitionDefender } from './SamePlateAppearanceTerminalTransition';

const same = (a: unknown, b: unknown, detail: string) => { if (json(a) !== json(b)) throw new Error('same-PA transition ' + detail); };
const nativeRead = (db: DatabaseSync) => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction || db.prepare('PRAGMA query_only').get()!.query_only !== 1
    || db.prepare('PRAGMA database_list').all().some(r => r.name !== 'main' && r.name !== 'temp')
    || db.prepare("SELECT 1 FROM temp.sqlite_master WHERE type IN ('table','view')").get())
    throw new Error('same-PA transition requires an owned main-only Native read proof');
};
export const samePaTransitionReference = (value: SamePaTerminalTransitionRecord): SamePaReference<'pa_terminal_v1_transitions'> => ({
  owner: 'pa_terminal_v1_transitions', sourceId: value.source.sourceId, sourceHash: hash(value.source), snapshotHash: hash(value),
});
export const samePaTransitionRow = (value: SamePaTerminalTransitionRecord) => ({
  source_id: value.source.sourceId, source_version: value.source.sourceVersion, career_id: value.lineage.careerId,
  game_id: value.lineage.gameId, play_id: value.lineage.playId, enrollment_source_id: value.lineage.enrollmentReference.sourceId,
  actor_source_id: value.lineage.actorReference.sourceId, first_pitch_source_id: value.lineage.firstPhysicalPitchSourceId,
  terminal_source_id: value.source.terminalReference.sourceId, settlement_source_id: value.source.settlementReference.sourceId,
  application_id: value.source.applicationId, source_json: json(value.source), source_hash: hash(value.source), snapshot_json: json(value), snapshot_hash: hash(value),
});
/** Metadata discovery includes independent indexed and raw Source mirrors. */
export const samePaTransitionRows = (db: Pick<DatabaseSync, 'prepare'>) => {
  if (!assertSamePaTerminalEndpointStorage(db)) return [];
  return db.prepare('SELECT * FROM main.pa_terminal_v1_transitions').all();
};
export const readSamePaTransitionArchive = (db: DatabaseSync, sourceId: string): SamePaTerminalTransitionRecord | null => {
  if (!assertSamePaTerminalEndpointStorage(db)) return null;
  const rows = db.prepare(`SELECT * FROM main.pa_terminal_v1_transitions WHERE source_id=$id
    OR ${claim('source_json', ['sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'sourceId'], '$id')}`).all({ id: sourceId });
  if (!rows.length) return null;
  if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('same-PA transition Source ownership differs');
  const value = JSON.parse(String(rows[0].snapshot_json)) as SamePaTerminalTransitionRecord;
  samePaTerminalTransitionInput(value.source, sourceId);
  if (value.kind !== 'same_pa_terminal_transition_v1') throw new Error('same-PA transition archive kind differs');
  same(rows[0], samePaTransitionRow(value), 'canonical archive differs');
  const aliases = db.prepare(`SELECT source_id FROM main.pa_terminal_v1_transitions WHERE terminal_source_id=$terminal
    OR enrollment_source_id=$enrollment OR application_id=$app OR (game_id=$game AND play_id=$play)
    OR ${claim('source_json', ['terminalReference', 'sourceId'], '$terminal')}
    OR ${claim('source_json', ['applicationId'], '$app')}
    OR ${claim('snapshot_json', ['source', 'terminalReference', 'sourceId'], '$terminal')}
    OR ${claim('snapshot_json', ['source', 'applicationId'], '$app')}
    OR ${claim('snapshot_json', ['lineage', 'enrollmentReference', 'sourceId'], '$enrollment')}`)
    .all({ terminal: value.source.terminalReference.sourceId, enrollment: value.lineage.enrollmentReference.sourceId,
      app: value.source.applicationId, game: value.lineage.gameId, play: value.lineage.playId });
  if (aliases.length !== 1 || aliases[0].source_id !== sourceId) throw new Error('same-PA transition terminal/application alias differs');
  return value;
};
const fixture = (db: DatabaseSync, endpoint: SamePaTerminalEndpoint, source: AcceptedSamePaTerminalTransition) => {
  const actor = endpoint.actor, world = actor.worldFixture;
  if (source.game.seasonId !== world.competitionEditionId || source.game.homeClubId !== world.game.homeClubId
    || source.game.awayClubId !== world.game.awayClubId || world.game.gameId !== endpoint.lineage.gameId
    || world.careerId !== endpoint.lineage.careerId) throw new Error('same-PA transition accepted game identity differs');
  const rows = ownerRows(db, 'official_fixtures', { game_id: 'TEXT', venue_id: 'TEXT', fixture_event_id: 'TEXT', fixture_revision: 'INTEGER' })
    .filter(r => r.game_id === world.game.gameId);
  if (rows.length !== 1 || hash(rows[0]) !== actor.fixtureHash || rows[0].fixture_event_id !== actor.binding.fixtureEventId)
    throw new Error('same-PA transition original fixture differs');
  for (const row of ownerRows(db, 'physical_closure_game_policies', { game_id: 'TEXT', policy_json: 'TEXT' }).filter(r => r.game_id === world.game.gameId))
    same(row.policy_json, json(source.game), 'prior accepted game policy differs');
  for (const row of ownerRows(db, 'actual_foul_terminal_applications', { game_id: 'TEXT', proposal_json: 'TEXT' }).filter(r => r.game_id === world.game.gameId)) {
    const game = JSON.parse(String(row.proposal_json)).applicationBody?.game;
    if (game) same({ seasonId: game.seasonId, homeClubId: game.homeClubId, awayClubId: game.awayClubId, policy: game.policy }, source.game, 'prior terminal game policy differs');
  }
  for (const row of samePaTransitionRows(db).filter(r => r.game_id === world.game.gameId)) {
    const original = readSamePaTransitionArchive(db, String(row.source_id))!;
    same(original.source.game, source.game, 'reserved game policy differs');
  }
  return { gameId: String(rows[0].game_id), venueId: String(rows[0].venue_id), fixtureEventId: String(rows[0].fixture_event_id), fixtureRevision: Number(rows[0].fixture_revision) };
};
const defenders = (db: DatabaseSync, endpoint: SamePaTerminalEndpoint, source: Extract<AcceptedSamePaTerminalTransition, { kind: 'continuing' }>,
  next: SamePaTerminalTransitionRecord['official']['receipt']['appliedMatchState'], archived?: readonly SamePaTransitionDefender[]) => {
  same(source.worldSetup.baseCenters, endpoint.baseCenters, 'accepted venue base centers differ');
  prepareBetweenPlayWorld(next, source.nextStartedAtTick, source.worldSetup);
  const old = endpoint.actor, sameHalf = next.half === old.match.half && next.inning === old.match.inning;
  if (sameHalf) same(source.worldSetup.defenders.map(d => [d.playerId, d.registeredPosition]).sort(),
    old.world.defenders.map(d => [d.playerId, d.registeredPosition]).sort(), 'same-half defense identity differs');
  const ids = source.worldSetup.defenders.map(d => d.playerId).sort(), side = next.half === 'top' ? 'HOME' : 'AWAY';
  if (archived) same(archived.map(d => d.playerId), ids, 'defender archive membership differs');
  const result = ids.map((playerId, index) => {
    const rows = ownerRows(db, 'official_participant_bindings', { game_id: 'TEXT', player_id: 'TEXT', binding_json: 'TEXT' }).filter(row => {
      const document = String(row.binding_json), matches = (path: string[], value: string) => !!db.prepare(`SELECT 1 WHERE ${claim('$doc', path, '$value')}`).get({ doc: document, value });
      return (row.game_id === endpoint.lineage.gameId || matches(['gameId'], endpoint.lineage.gameId)) && (row.player_id === playerId || matches(['playerId'], playerId));
    });
    const b = rows[0] && JSON.parse(String(rows[0].binding_json)) as OfficialParticipantBinding;
    if (rows.length !== 1 || !b || rows[0].game_id !== endpoint.lineage.gameId || rows[0].player_id !== playerId
      || rows[0].binding_json !== JSON.stringify(b) || b.gameId !== endpoint.lineage.gameId || b.playerId !== playerId || b.side !== side
      || b.careerId !== endpoint.lineage.careerId || b.gameDay !== endpoint.gameDay || b.competitionEditionId !== source.game.seasonId
      || b.clubId !== (side === 'HOME' ? source.game.homeClubId : source.game.awayClubId) || b.fixtureEventId !== old.binding.fixtureEventId)
      throw new Error('same-PA transition incoming defender binding differs');
    const person = readOfficialActorPersonLink(db, b);
    if (person.personId !== b.personId) throw new Error('same-PA transition incoming defender Person differs');
    const state = readActualRoleWorkloadState(db, b.careerId, playerId, archived?.[index].workloadRevision, b.personLinkSourceId);
    if (!state || state.effectiveDay > endpoint.gameDay) throw new Error('same-PA transition incoming defender accepted workload missing');
    const value = { playerId, personId: b.personId, bindingHash: hash(b), workloadRevision: state.revision, workloadHash: hash(state) };
    if (archived) same(value, archived[index], 'incoming defender original workload differs');
    return value;
  });
  if (new Set(result.map(d => d.personId)).size !== 9) throw new Error('same-PA transition incoming defender Persons overlap');
  return result;
};
/** The complete immutable endpoint and all ten normal workload effects are
 * authenticated before deriving any Match/scoring/activation mutation. */
export const deriveSamePaTerminalTransition = (db: DatabaseSync, raw: AcceptedSamePaTerminalTransition,
  archived?: SamePaTerminalTransitionRecord, mode: SamePaTerminalProofMode = archived ? 'historical' : 'current'): SamePaTerminalTransitionRecord => {
  nativeRead(db); const source = samePaTerminalTransitionInput(raw);
  const endpoint = readSamePaTerminalEndpointFromSqlite(db, source.terminalReference, mode);
  same(source.terminalReference, { owner: 'pa_terminal_v1_endpoints', sourceId: endpoint.source.sourceId, sourceHash: hash(endpoint.source), snapshotHash: hash(endpoint) }, 'endpoint reference differs');
  const settled = readSamePaTerminalSettlementFromSqlite(db, source.settlementReference);
  if (settled.kind !== 'settled' || settled.participants.length !== 10 || settled.participants.some(p => !p.applied)
    || new Set(settled.participants.map(p => p.playerId)).size !== 10) throw new Error('same-PA transition requires ten settled normal workload effects');
  same(settled.plan.source.terminalReference, source.terminalReference, 'settlement endpoint differs');
  same(settled.plan.lineage, endpoint.lineage, 'settlement lineage differs');
  same(settled.plan.coverageHash, endpoint.coverageHash, 'final coverage differs');
  same(settled.plan.participants, endpoint.participants, 'final ten TOTALs differ');
  const actor = endpoint.actor, basis = endpoint.controllerRetirementBasis, closure = getOfficialPlayClosure(endpoint.officialLedger);
  if (actor.source.gameId !== endpoint.lineage.gameId || actor.match.playId !== endpoint.lineage.playId || actor.binding.careerId !== endpoint.lineage.careerId
    || !closure || basis.completedAtTick !== endpoint.physicalCompletedAtTick || endpoint.physicalCompletedAtTick > closure.closedAtTick
    || basis.participants.length !== 10 || new Set(basis.participants.map(p => p.playerId)).size !== 10)
    throw new Error('same-PA transition final physical/official identity differs');
  const bindings = [actor.binding, ...actor.defenderBindings];
  same(basis.participants.map(p => [p.playerId, p.personId]).sort(), bindings.map(p => [p.playerId, p.personId]).sort(), 'retirement ten-player membership differs');
  if (mode === 'current') for (const participant of settled.participants) {
    const binding = bindings.find(b => b.playerId === participant.playerId);
    if (!binding) throw new Error('same-PA transition settled Player membership differs');
    same(readActualRoleWorkloadState(db, binding.careerId, binding.playerId, undefined, binding.personLinkSourceId),
      participant.projectedState, 'current settled workload AFTER differs');
  }
  const atTick = source.kind === 'continuing' ? source.nextStartedAtTick : source.completedAtTick;
  if (atTick <= closure.closedAtTick || atTick < endpoint.physicalCompletedAtTick || basis.participants.some(p => p.ownedCommands.some(c => hash(c.originalCommand) !== c.originalCommandHash)))
    throw new Error('same-PA transition original controller retirement differs');
  const identity = { matchId: endpoint.lineage.gameId, applicationId: source.applicationId,
    expectedDurableRevision: actor.officialRevision, match: actor.match, adjudication: endpoint.officialLedger };
  const common = (() => {
    if(endpoint.fairCatch)return {...identity,kind:'live_ball' as const,physicalTimeline:endpoint.timeline};
    if(!endpoint.context)throw new Error('same-PA terminal non-live context missing');
    return {...identity,kind:'non_live' as const,timeline:endpoint.timeline,context:endpoint.context};
  })();
  const next = common.kind==='live_ball'?deriveClosedLiveBallMatchState(common.match,common.physicalTimeline,common.adjudication):deriveClosedNonLiveMatchState(common);
  const receipt = common.kind==='live_ball'?confirmDurableClosedLiveBallStateApplication({...common,persistedMatchState:next,durableRevision:actor.officialRevision+1})
    :confirmDurableClosedNonLiveStateApplication({...common,persistedMatchState:next,durableRevision:actor.officialRevision+1});
  const venueBinding = fixture(db, endpoint, source), game = { ...source.game, venueBinding };
  const boundary = resolveOfficialGameProgression({ ...game, gameId: common.matchId, priorMatch: actor.match, application: receipt });
  if ((source.kind === 'game_final') !== (boundary.kind === 'GAME_FINAL_PENDING_SCORING')) throw new Error('same-PA transition Source does not match official game boundary');
  const scoringEvidence = endpoint.fairCatch ? {schemaVersion:1 as const,sourceKind:'owned_fair_catch' as const,
    sourceEventId:'same-pa-fair-catch:'+endpoint.source.sourceId,physical:endpoint.fairCatch.scoringEvidence} : undefined;
  const classified = common.kind==='live_ball'?classifyClosedPlayForOfficialScoring({kind:'live_ball',match:common.match,timeline:common.physicalTimeline,
    adjudication:common.adjudication,fairCatchEvidence:scoringEvidence!.physical}):classifyClosedPlayForOfficialScoring(common);
  if (classified.kind !== 'supported') throw new Error('same-PA transition official scoring unsupported');
  const scoring = { scoringApplicationId: source.scoringApplicationId, matchId: common.matchId, officialApplicationId: source.applicationId,
    closureId: receipt.closureId, sourceEventId: scoringEvidence?.sourceEventId ?? 'official-non-live:' + source.applicationId, record: classified.record };
  const earlier = source.kind === 'game_final' ? readPhysicalClosureScoringHistory(db, { gameId: common.matchId, officialRevision: actor.officialRevision }) : [];
  if (earlier.some(e => e.applicationId === source.applicationId || e.scoringApplicationId === source.scoringApplicationId)) throw new Error('same-PA final history cannot include current transition');
  const officialApplication = source.kind === 'game_final'
    ? { ...common, game: { ...game, lineScore: derivePhysicalClosureLineScore([...earlier, { before: actor.match, after: next, scoring }]) } }
    : { ...common, nextStartedAtTick: source.nextStartedAtTick, worldSetup: source.worldSetup };
  const official = 'game' in officialApplication ? deriveOfficialFinalResult(officialApplication, receipt.durableRevision) : deriveOfficialPlayResult(officialApplication, receipt.durableRevision);
  const incomingDefenders = source.kind === 'continuing' ? defenders(db, endpoint, source, next, archived?.incomingDefenders) : [];
  return freeze({ kind: 'same_pa_terminal_transition_v1', source, lineage: endpoint.lineage, officialApplication, official, scoring,
    ...(scoringEvidence?{scoringEvidence}:{}),
    completion: source.kind === 'game_final' ? 'game_final' : next.half === actor.match.half && next.inning === actor.match.inning ? 'next_play' : 'half_inning',
    controllerRetirement: { kind: 'rule_system_retire_original_play', atTick, previousPlayId: actor.match.playId, basis }, incomingDefenders,
    earlierHistory: earlier.map(({ applicationId, scoringApplicationId, closureRowHash, scoringRowHash }) => ({ applicationId, scoringApplicationId, closureRowHash, scoringRowHash })) });
};
export const assertSamePaTransitionEffects = (db: DatabaseSync, value: SamePaTerminalTransitionRecord, mode: SamePaTerminalProofMode) => {
  const a = value.officialApplication, result = value.official;
  const apps = ownerRows(db, 'applications', { application_id: 'TEXT', match_id: 'TEXT', closure_id: 'TEXT', request_hash: 'TEXT', result_json: 'TEXT' })
    .filter(r => r.application_id === a.applicationId || r.match_id === a.matchId && r.closure_id === result.receipt.closureId
      || values(db, String(r.result_json), ['receipt', 'applicationId']).includes(a.applicationId));
  same(apps, [{ application_id: a.applicationId, match_id: a.matchId, closure_id: result.receipt.closureId,
    request_hash: hash('game' in a ? { kind: 'game_final', request: a } : a), result_json: json(result) }], 'official effect differs');
  const s = value.scoring;
  const scores = ownerRows(db, 'official_scoring_applications', { scoring_application_id: 'TEXT', official_application_id: 'TEXT', request_json: 'TEXT', result_json: 'TEXT' })
    .filter(r => r.scoring_application_id === s.scoringApplicationId || r.official_application_id === a.applicationId || r.match_id === a.matchId && r.closure_id === s.closureId
      || values(db, String(r.request_json), ['input', 'scoringApplicationId']).includes(s.scoringApplicationId)
      || values(db, String(r.request_json), ['input', 'officialApplication', 'applicationId']).includes(a.applicationId)
      || values(db, String(r.result_json), ['officialApplicationId']).includes(a.applicationId));
  same(scores, [{ scoring_application_id: s.scoringApplicationId, match_id: a.matchId, official_application_id: a.applicationId, closure_id: s.closureId,
    source_event_id: s.sourceEventId, request_json: json({ input: { scoringApplicationId: s.scoringApplicationId, officialApplication: a,
      ...(value.scoringEvidence?{sourceEventId:value.scoringEvidence.sourceEventId}:{}) }, evidence: value.scoringEvidence??null }), result_json: json(s) }], 'scoring effect differs');
  if (mode === 'current') same(ownerRows(db, 'matches', { match_id: 'TEXT', durable_revision: 'INTEGER', state_json: 'TEXT', activation_json: 'TEXT' })
    .filter(r => r.match_id === a.matchId || values(db, String(r.activation_json), ['activation', 'applicationId']).includes(a.applicationId)
      || values(db, String(r.activation_json), ['finalResult', 'applicationId']).includes(a.applicationId)), [{ match_id: a.matchId,
    durable_revision: result.receipt.durableRevision, state_json: json(result.receipt.appliedMatchState),
    activation_json: json('result' in result ? { finalResult: result.result } : { activation: result.activation, nextWorld: result.nextWorld }) }], 'current Match effect differs');
};
export const readSamePaTerminalTransitionFromSqlite = (db: DatabaseSync, rawReference: SamePaReference<'pa_terminal_v1_endpoints'>,
  mode: SamePaTerminalProofMode): SamePaTerminalTransitionRead => {
  nativeRead(db); const terminalReference = cloneInert(rawReference);
  if (!samePaReferenceValid(terminalReference, 'pa_terminal_v1_endpoints') || !['current', 'historical'].includes(mode)) throw new Error('invalid same-PA transition terminal reference');
  if (!assertSamePaTerminalEndpointStorage(db)) throw new Error('same-PA transition endpoint storage missing');
  const rows = db.prepare(`SELECT source_id FROM main.pa_terminal_v1_transitions WHERE terminal_source_id=$id
    OR ${claim('source_json', ['terminalReference', 'sourceId'], '$id')} OR ${claim('snapshot_json', ['source', 'terminalReference', 'sourceId'], '$id')}`).all({ id: terminalReference.sourceId });
  if (!rows.length) {
    readSamePaTerminalEndpointFromSqlite(db, terminalReference, mode);
    return freeze({ kind: 'pending', reason: 'terminal_transition_missing', terminalReference });
  }
  if (rows.length !== 1) throw new Error('same-PA terminal transition ownership differs');
  const saved = readSamePaTransitionArchive(db, String(rows[0].source_id))!;
  same(saved.source.terminalReference, terminalReference, 'terminal reference differs');
  same(deriveSamePaTerminalTransition(db, saved.source, saved, mode), saved, 'completed derivation differs');
  assertSamePaTransitionEffects(db, saved, mode);
  return freeze({ kind: 'completed', reference: samePaTransitionReference(saved), terminalReference, settlementReference: saved.source.settlementReference,
    gameId: saved.lineage.gameId, playId: saved.lineage.playId, durableRevision: saved.official.receipt.durableRevision,
    resultingMatch: saved.official.receipt.appliedMatchState, officialReceipt: saved.official.receipt, completion: saved.completion });
};
