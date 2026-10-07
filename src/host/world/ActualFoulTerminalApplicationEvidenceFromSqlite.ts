import type { DatabaseSync } from 'node:sqlite';
import { actualLivePlayFields as fields, actualLivePlayId as id } from './ActualLivePlayScope';
import { foulOfficialClaims, foulOfficialHeads, type FoulOfficialRow } from './ActualFoulOfficialOwnership';
import { foulTerminalApplicationIdentityRows, foulTerminalApplicationClaims, type FoulTerminalApplicationScope }
  from './ActualFoulTerminalApplicationOwnership';
import { officialApplicationOwnershipClaims, officialMatchActivationClaims } from '../OfficialApplicationOwnershipFromSqlite';
import { cloneInert, openRuleProfileOfficialStateWindow, advanceRuleProfileOfficialWindows } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall, closeOfficialPlay,
  getOfficialPlayClosure, getOfficialStateWindows } from '../../core/adjudication/PlayAdjudicationLedger';
import { derivePhysicalNonLiveClosure } from '../../core/adjudication/PhysicalNonLiveClosure';
import { deriveClosedNonLiveMatchState, confirmDurableClosedNonLiveStateApplication } from '../../core/adjudication/NonLiveOfficialApplication';
import { resolveOfficialGameProgression, type OfficialGameVenueBinding } from '../../core/world/competition/OfficialGameCompletion';
import { foulOfficialEvidenceFromSqlite } from './ActualFoulOfficialEvidenceFromSqlite';
import { foulOfficialEventInput, deriveFoulOfficialOpeningClock, foulOfficialRevision } from './ActualFoulOfficialSource';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { actualFoulTerminalApplicationInput, type AcceptedFoulTerminalApplication, type FoulTerminalApplicationEvaluation,
  type FoulTerminalApplicationBody, type FoulTerminalPhysicalPitchReference, type FoulTerminalParticipant,
  type FoulTerminalBoundGamePolicy, type FoulTerminalApplicationProposal, type DurableFoulTerminalApplicationQueue }
  from './ActualFoulTerminalApplication';

const same = (actual: unknown, expected: unknown, message: string): void => {
  if (json(actual) !== json(expected)) throw new Error(message);
};

/** The existing four-field shared policy envelope, read from main only. This
 * neither creates the shared table nor pins a policy on the caller's behalf. */
const assertExistingGamePolicy = (db: DatabaseSync, gameId: string, game: FoulTerminalBoundGamePolicy | null) => {
  const schema = db.prepare("SELECT type FROM main.sqlite_master WHERE name='physical_closure_game_policies'").all();
  if (!schema.length) return;
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('foul terminal shared game policy schema differs');
  const row = db.prepare('SELECT policy_json FROM main.physical_closure_game_policies WHERE game_id=?').get(gameId);
  if (game && row && row.policy_json !== json({ seasonId: game.seasonId, homeClubId: game.homeClubId,
    awayClubId: game.awayClubId, policy: game.policy })) throw new Error('foul terminal accepted game policy differs from the shared pin');
};

/** Read-only original-owner projection. Historical mode authenticates the
 * selected prefix and raw aliases without requiring today's journal/Match head.
 * No queue, schema, application, acknowledgement or lifecycle write is made. */
export const deriveFoulTerminalApplicationProposal = (db: DatabaseSync, raw: unknown,
  freshness: 'current' | 'historical'): FoulTerminalApplicationEvaluation => {
  const captured = cloneInert(raw) as AcceptedFoulTerminalApplication;
  const source = actualFoulTerminalApplicationInput(captured, typeof captured?.sourceId === 'string' ? captured.sourceId : '');
  if (freshness !== 'current' && freshness !== 'historical') throw new Error('invalid foul terminal freshness mode');
  return withBattedVenueLegalReadSnapshot(db, () => {
    const reader = foulOfficialEvidenceFromSqlite(db), ref = source.officialReference;
    const selected = reader.at(ref.sessionSourceId, ref.revision);
    if (!selected) throw new Error('accepted foul terminal official session or revision is missing');
    const { root, value } = selected, { end, count, match, ruleProfile } = root.facts;
    same(source.physicalEndReference, value.source.physicalEndReference, 'foul terminal physical end reference differs');
    same(ref, { sessionSourceId: value.source.sourceId, revision: value.revision, headSourceId: value.headSourceId, headHash: value.headHash },
      'foul terminal selected journal reference differs');
    if (freshness === 'current') {
      const current = reader.currentFromRoot(root).value;
      if (current.revision !== value.revision || current.headSourceId !== value.headSourceId || current.headHash !== value.headHash) {
        throw new Error('foul terminal selected journal head is stale for current projection');
      }
      reader.assertCurrentMatch(root);
    }
    const pending = (...reasons: string[]): FoulTerminalApplicationEvaluation => freeze({ kind: 'pending', source,
      pendingReasons: [...new Set(reasons)] });
    // An unadmitted absent-intent or unconfigured-policy intake has no official
    // reference and cannot be made into a historical session by this adapter.
    if (count.disposition.kind === 'pending_original_intent') return pending('original_batting_intent_missing');
    if (count.disposition.kind !== 'terminal_strikeout') return pending('not_terminal_bunt');
    const intent = count.countEvidence.battingIntent.intent, timeline = count.disposition.timeline;
    const terminal = timeline.events.at(-1);
    if (intent.kind !== 'declared' || intent.attempt !== 'bunt' || terminal?.kind !== 'FoulBattedBallResolved'
      || terminal.payload.resolution.kind !== 'uncaught_foul' || terminal.payload.resolution.countResult.kind !== 'strikeout'
      || terminal.payload.resolution.countResult.cause !== 'foul_bunt') throw new Error('foul terminal original bunt/count evidence differs');
    const reasons = value.pendingReasons.filter(reason => reason !== 'terminal_official_application_unimplemented');
    if (selected.last?.source.action.kind !== 'next_pitch_fence') reasons.push('terminal_fence_missing');
    const supported = new Set(['CorrectRuleSnapshotRecorded', 'OfficialStateWindowOpened', 'OnFieldCallRecorded', 'OfficialStateWindowClosed']);
    for (const event of value.ledger.events) if (!supported.has(event.kind)) reasons.push('unsupported_official_event_kind:' + event.kind);
    if (reasons.length) return pending(...reasons);
    const fence = selected.last!.source, callIntent = value.callIntent;
    if (!callIntent || callIntent.judgment !== 'foul' || value.handoff !== null
      || fence.action.kind !== 'next_pitch_fence' || fence.action.schedulerId !== value.source.assignment.schedulerId) {
      throw new Error('foul terminal assigned call or scheduler authority differs');
    }
    same(value.officialCount, count.disposition, 'foul terminal official count differs from original C');
    if (value.source.officialPolicy === null || ruleProfile.id !== match.ruleProfileId
      || ruleProfile.officialWindows?.review?.available !== false || ruleProfile.officialWindows?.challenge?.available !== false
      || getOfficialStateWindows(value.ledger).some(w => w.closedAtTick === null)) throw new Error('foul terminal official window authority differs');
    const journal = selected.rows.filter(row => (row.revision as number) <= ref.revision)
      .map(row => foulOfficialEventInput(JSON.parse(String(row.source_json)), String(row.source_id)));
    const calls = journal.filter(event => event.action.kind === 'record_call');
    const recorded = value.ledger.events.filter(event => event.kind === 'OnFieldCallRecorded');
    if (calls.length !== 1 || recorded.length !== 1 || recorded[0].kind !== 'OnFieldCallRecorded'
      || calls[0].action.kind !== 'record_call' || calls[0].action.intentSourceId !== callIntent.sourceId
      || recorded[0].call.callId !== calls[0].sourceId || recorded[0].eventId !== calls[0].sourceId + ':call') {
      throw new Error('foul terminal requires the one original assigned call identity');
    }
    const call = recorded[0], boundary = end.preCorePhysicalProof.boundary;
    const opening = deriveFoulOfficialOpeningClock({ originTick: boundary.originTick,
      throughTick: boundary.throughTick, ticksPerSecond: boundary.ticksPerSecond });
    if (value.cursor.originTick !== opening.originTick || value.cursor.ticksPerSecond !== opening.ticksPerSecond
      || value.cursor.openingTick !== opening.openingTick || value.cursor.openingElapsedSeconds !== opening.openingElapsedSeconds
      || opening.openingElapsedSeconds <= end.preCorePhysicalProof.boundary.lastIncludedElapsedSeconds) {
      throw new Error('foul terminal sealed opening clock differs');
    }
    const ruleEvents = value.ledger.events.filter(event => event.kind === 'CorrectRuleSnapshotRecorded');
    if (ruleEvents.length !== 1 || ruleEvents[0].kind !== 'CorrectRuleSnapshotRecorded') throw new Error('foul terminal original rule snapshot differs');
    const rule = ruleEvents[0], ruleTick = rule.tick, closureTick = value.cursor.tick;
    if (!foulOfficialRevision(ruleTick) || !foulOfficialRevision(closureTick) || ruleTick !== opening.openingTick
      || ruleTick < timeline.lastEventTick || closureTick < end.exactEnd.tick || closureTick < timeline.lastEventTick
      || value.ledger.events.some(event => event.tick > closureTick)) throw new Error('foul terminal closure clock precedes original evidence');

    const pitches = readOriginalPhysicalPitchPrefixFromSqlite(db, end.physicalPitchSourceId), pitch = pitches.at(-1);
    if (!pitch || pitches[0].source.sourceId !== count.firstPhysicalPitchSourceId || pitch.source.sourceId !== count.physicalPitchSourceId
      || pitch.frame.match.playId !== end.playId || pitch.frame.gameId !== end.gameId || !pitch.frame.batterActor
      || pitch.result.pitch.resolution.timeline.status.kind !== 'batted_ball_pending') throw new Error('foul terminal original physical pitch prefix differs');
    same(pitch.frame.match, match, 'foul terminal original Match differs');
    same(timeline.events.slice(0, -1), pitch.result.pitch.resolution.timeline.events, 'foul terminal original physical timeline was replaced');
    const effort = pitch.frame.effortPolicy;
    const oracle = derivePhysicalNonLiveClosure({ match, timeline, batterRunnerId: null, gameDay: pitch.frame.batterActor.binding.gameDay,
      effortPolicy: { policyId: effort.policyId, version: effort.version, availableAtDay: effort.availableAtDay,
        effortUnitsPerPhysicalPitch: effort.effortUnitsPerPhysicalPitch }, snapshotId: rule.snapshot.snapshotId,
      ruleTick, closureId: source.sourceId, closureTick });

    let ledger = createPlayAdjudicationLedger({ playId: end.playId, ruleProfileId: match.ruleProfileId, playEnd: null });
    for (const event of root.value!.ledger.events) {
      if (event.kind === 'CorrectRuleSnapshotRecorded') ledger = recordCorrectRuleSnapshot(ledger, ledger.revision,
        { eventId: event.eventId, tick: event.tick, ...event.snapshot });
      else if (event.kind === 'OfficialStateWindowOpened') ledger = openRuleProfileOfficialStateWindow(ledger, ledger.revision,
        { profile: ruleProfile, eventId: event.eventId, tick: event.tick, windowId: event.windowId, windowKind: event.windowKind });
      else return pending('unsupported_official_event_kind:' + event.kind);
    }
    same(ledger.events, root.value!.ledger.events, 'foul terminal opening ledger replay differs');
    let tick = opening.tick;
    for (const event of journal) {
      if (event.action.kind === 'record_call') ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: call.eventId,
        callId: call.call.callId, tick, basisSnapshotId: call.call.basisSnapshotId,
        basisEvidenceRevision: call.call.basisEvidenceRevision, ruling: call.call.ruling });
      else if (event.action.kind === 'advance_tick') tick++;
      else ledger = advanceRuleProfileOfficialWindows(ledger, ledger.revision, { profile: ruleProfile,
        boundary: 'next_play_fence', tick, eventIdPrefix: event.sourceId, inningEnding: false });
    }
    if (tick !== closureTick || ledger.revision !== value.ledger.revision) throw new Error('foul terminal journal clock or ledger revision differs');
    same(ledger.events, value.ledger.events, 'foul terminal adapted event prefix differs from the assigned journal');
    ledger = closeOfficialPlay(ledger, ledger.revision, { eventId: source.sourceId + ':closed', closureId: source.sourceId, tick: closureTick });
    const closure = getOfficialPlayClosure(ledger)!, canonical = getOfficialPlayClosure(oracle.adjudication)!;
    if (closure.finalRuling.source !== 'on_field_call' || closure.finalRuling.basisCallId !== call.call.callId) {
      throw new Error('foul terminal final ruling lost its assigned call authority');
    }
    same(closure.finalRuling.gameplay, canonical.finalRuling.gameplay, 'foul terminal assigned ruling differs from canonical strikeout');
    const nextMatch = deriveClosedNonLiveMatchState({ match, timeline, adjudication: ledger, context: oracle.context });
    same(nextMatch, oracle.nextMatch, 'foul terminal adapted Match projection differs');

    const actor = pitch.frame.batterActor, seasonFixture = actor.worldFixture;
    const row = db.prepare('SELECT game_id,venue_id,fixture_event_id,fixture_revision FROM main.official_fixtures WHERE game_id=?').get(end.gameId);
    if (!row || row.fixture_event_id !== actor.binding.fixtureEventId || typeof row.venue_id !== 'string'
      || !row.venue_id || !foulOfficialRevision(row.fixture_revision) || seasonFixture.game.gameId !== end.gameId) {
      throw new Error('foul terminal accepted fixture differs');
    }
    const fixture: OfficialGameVenueBinding = { gameId: end.gameId, venueId: row.venue_id,
      fixtureEventId: actor.binding.fixtureEventId, fixtureRevision: row.fixture_revision as number };
    const participants: FoulTerminalParticipant[] = [{ binding: actor.binding, person: actor.person, role: 'batter', registeredPosition: null },
      ...actor.defenderBindings.map((binding, i) => ({ binding, person: actor.defenderPersons[i], role: 'defender' as const,
        registeredPosition: actor.world.defenders[i].registeredPosition }))];
    if (participants.length !== 10 || new Set(participants.map(p => p.binding.playerId)).size !== 10
      || new Set(participants.map(p => p.person.personId)).size !== 10) throw new Error('foul terminal original participant membership differs');
    const game: FoulTerminalBoundGamePolicy | null = source.legalGamePolicy === null ? null : {
      seasonId: seasonFixture.competitionEditionId, homeClubId: seasonFixture.game.homeClubId,
      awayClubId: seasonFixture.game.awayClubId, policy: source.legalGamePolicy, venueBinding: fixture };
    assertExistingGamePolicy(db, end.gameId, game);
    const sameHalf = nextMatch.inning === match.inning && nextMatch.half === match.half;
    if (game === null && (!sameHalf || json(nextMatch.score) !== json(match.score))) return pending('game_policy_pending');
    // Pure validation only. This temporary expected receipt is not persisted,
    // returned, or used as evidence that the Native Match was applied.
    const projectedGameProgression = game === null ? { kind: 'same_half_no_game_boundary' as const }
      : resolveOfficialGameProgression({ ...game, gameId: end.gameId, priorMatch: match,
        application: confirmDurableClosedNonLiveStateApplication({ match, timeline, adjudication: ledger, context: oracle.context,
          persistedMatchState: nextMatch, applicationId: source.applicationId, durableRevision: root.originalOfficialRevision + 1 }) });
    const applicationBody: FoulTerminalApplicationBody = { mode: 'non_live_pending_post_play_v1', kind: 'non_live',
      matchId: end.gameId, applicationId: source.applicationId, expectedDurableRevision: root.originalOfficialRevision,
      match, timeline, adjudication: ledger, context: oracle.context, game };
    const originalPhysicalPitchPrefix: FoulTerminalPhysicalPitchReference[] = pitches.map(p => ({ owner: 'physical_pitch_progress_actions',
      sourceId: p.source.sourceId, sourceVersion: p.source.sourceVersion, sourceHash: hash(p.source), snapshotHash: hash(p), progressRevision: p.progressRevision }));
    return freeze({ kind: 'terminal_non_live_projected', officialApplied: false, source,
      gameId: end.gameId, playId: end.playId, physicalPitchSourceId: end.physicalPitchSourceId, firstPhysicalPitchSourceId: end.firstPhysicalPitchSourceId,
      runtimeSourceId: count.source.runtimeSourceId, scopeId: count.scopeId, physicalEndReference: source.physicalEndReference,
      physicalEndArchiveHash: source.physicalEndReference.snapshotHash, consumptionReference: value.consumptionReference,
      physicalPitchReference: originalPhysicalPitchPrefix.at(-1)!, originalPhysicalPitchPrefix,
      originalPhysicalTimeline: pitch.result.pitch.resolution.timeline, composedTimelineHash: hash(timeline),
      officialObligation: end.dispositionObligations.official, originalSuccessorKey: count.successor.successorKey,
      officialReference: ref, originalOfficialRevision: root.originalOfficialRevision, originalActivationJson: root.originalActivationJson,
      sessionSource: value.source, callSource: calls[0], callIntent,
      assignmentSourceHash: hash(value.source.assignment), intentSourceHash: hash(callIntent), acceptedOfficialPolicyHash: hash(value.source.officialPolicy),
      originalOfficialJournalHash: hash(value), originalOfficialLedger: value.ledger, originalOfficialLedgerHash: hash(value.ledger), applicationLedgerHash: hash(ledger),
      fixture, seasonFixture, participants, clock: { originTick: opening.originTick, ticksPerSecond: opening.ticksPerSecond,
        openingTick: opening.openingTick, openingElapsedSeconds: opening.openingElapsedSeconds, ruleTick, closureTick },
      applicationBody, nextMatch, scoring: oracle.scoring, projectedGameProgression });
  });
};

/** Queue-only schema. The reserved applied stage is not authenticated here. */
export const foulTerminalApplicationTableSql = `CREATE TABLE IF NOT EXISTS main.actual_foul_terminal_applications(
  source_id TEXT PRIMARY KEY,game_id TEXT NOT NULL,play_id INTEGER NOT NULL,application_id TEXT NOT NULL UNIQUE,
  physical_pitch_source_id TEXT NOT NULL UNIQUE,physical_end_source_id TEXT NOT NULL UNIQUE,official_obligation_key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,source_json TEXT NOT NULL,source_hash TEXT NOT NULL,proposal_json TEXT NOT NULL,proposal_hash TEXT NOT NULL,result_json TEXT,
  UNIQUE(game_id,play_id),CHECK((status='QUEUED' AND result_json IS NULL)
    OR (status='OFFICIAL_APPLIED_PENDING_POST_PLAY' AND result_json IS NOT NULL)))`;
const table = 'actual_foul_terminal_applications';
const columnNames = ['source_id','game_id','play_id','application_id','physical_pitch_source_id','physical_end_source_id',
  'official_obligation_key','status','source_json','source_hash','proposal_json','proposal_hash','result_json'] as const;
const compactSchema = (sql: string) => sql.replace(/\s+/g,'').replace(/^CREATETABLE(?:IFNOTEXISTS)?(?:main\.)?/i,'');
/** Validate installed constraints as well as the columns; no migration or DDL. */
export const assertFoulTerminalApplicationStorage = (db: DatabaseSync): boolean => {
  const schema = db.prepare('SELECT type,sql FROM main.sqlite_master WHERE name=?').all(table);
  if (!schema.length) return false;
  if (schema.length !== 1 || schema[0].type !== 'table' || typeof schema[0].sql !== 'string'
    || compactSchema(schema[0].sql) !== compactSchema(foulTerminalApplicationTableSql)) {
    throw new Error('foul terminal queue schema or constraints differ');
  }
  const columns = db.prepare('PRAGMA main.table_info(actual_foul_terminal_applications)').all();
  same(columns.map(c => [c.name,c.type,c.notnull,c.pk,c.dflt_value]), columnNames.map((name,i) =>
    [name,name === 'play_id' ? 'INTEGER' : 'TEXT',i === 0 || name === 'result_json' ? 0 : 1,i === 0 ? 1 : 0,null]),
  'foul terminal queue column shape differs');
  const indexes = db.prepare('PRAGMA main.index_list(actual_foul_terminal_applications)').all().filter(row => row.unique === 1);
  const keys = indexes.map(index => {
    if (index.partial !== 0 || !['pk','u'].includes(String(index.origin)) || typeof index.name !== 'string') {
      throw new Error('foul terminal queue unique constraint differs');
    }
    return db.prepare('PRAGMA main.index_info("'+index.name.replaceAll('"','""')+'")').all().map(row => row.name);
  });
  same(keys.map(json).sort(), [['source_id'],['application_id'],['game_id','play_id'],['physical_pitch_source_id'],
    ['physical_end_source_id'],['official_obligation_key']].map(json).sort(), 'foul terminal queue uniqueness differs');
  return true;
};
const queueScope = (p: FoulTerminalApplicationProposal): FoulTerminalApplicationScope => ({
  official: { sourceId:p.officialReference.sessionSourceId,gameId:p.gameId,playId:p.playId,
    physicalPitchSourceId:p.physicalPitchSourceId,physicalEndSourceId:p.physicalEndReference.sourceId,
    consumptionSourceId:p.consumptionReference.sourceId,officialObligationKey:p.officialObligation.obligationKey,
    originalSuccessorKey:p.originalSuccessorKey },
  applicationSourceId:p.source.sourceId,applicationId:p.source.applicationId,closureId:p.source.sourceId,
  firstPhysicalPitchSourceId:p.firstPhysicalPitchSourceId,runtimeSourceId:p.runtimeSourceId,scopeId:p.scopeId,
  selectedHeadSourceId:p.officialReference.headSourceId,intentSourceId:p.callIntent.sourceId,
});
const queueRow = (p: FoulTerminalApplicationProposal): FoulOfficialRow => ({
  source_id:p.source.sourceId,game_id:p.gameId,play_id:p.playId,application_id:p.source.applicationId,
  physical_pitch_source_id:p.physicalPitchSourceId,physical_end_source_id:p.physicalEndReference.sourceId,
  official_obligation_key:p.officialObligation.obligationKey,status:'QUEUED',source_json:json(p.source),source_hash:hash(p.source),
  proposal_json:json(p),proposal_hash:hash(p),result_json:null,
});
const policyRows = (db: DatabaseSync, p: FoulTerminalApplicationProposal) => {
  const schema = db.prepare("SELECT type FROM main.sqlite_master WHERE name='physical_closure_game_policies'").all();
  if (!schema.length) return [];
  if (schema.length !== 1 || schema[0].type !== 'table') throw new Error('foul terminal queue game policy schema differs');
  const columns = db.prepare('PRAGMA main.table_info(physical_closure_game_policies)').all();
  same(columns.map(c => [c.name,c.type,c.pk]), [['game_id','TEXT',1],['policy_json','TEXT',0]],
    'foul terminal queue game policy columns differ');
  const rows = db.prepare('SELECT * FROM main.physical_closure_game_policies WHERE game_id=?').all(p.gameId);
  if (rows.length > 1) throw new Error('foul terminal queue game policy ownership differs');
  for (const row of rows) {
    if (typeof row.policy_json !== 'string') throw new Error('foul terminal queue game policy encoding differs');
    const policy = JSON.parse(row.policy_json);
    if (!fields(policy,['seasonId','homeClubId','awayClubId','policy'])
      || ![policy.seasonId,policy.homeClubId,policy.awayClubId].every(id)) throw new Error('foul terminal queue game policy envelope differs');
    actualFoulTerminalApplicationInput({ ...p.source,legalGamePolicy:policy.policy },p.source.sourceId);
    if (policy.policy === null || row.policy_json !== json(policy)
      || policy.seasonId !== p.seasonFixture.competitionEditionId
      || policy.homeClubId !== p.seasonFixture.game.homeClubId || policy.awayClubId !== p.seasonFixture.game.awayClubId) {
      throw new Error('foul terminal queue game policy scope differs');
    }
    if (p.source.legalGamePolicy !== null) same(policy.policy,p.source.legalGamePolicy,'foul terminal queue accepted game policy differs');
  }
  return rows;
};
const assertQueueClaims = (db: DatabaseSync, p: FoulTerminalApplicationProposal, expected: FoulOfficialRow | null) => {
  const scope = queueScope(p), claims = foulTerminalApplicationClaims(db,scope);
  same(claims,expected === null ? [] : [expected],'foul terminal queue ownership claims differ');
  const applications = officialApplicationOwnershipClaims(db,scope);
  if (applications.length !== 1 || applications[0].table !== 'matches' || applications[0].row.match_id !== p.gameId
    || officialMatchActivationClaims(db,applications[0].row,scope)) throw new Error('foul terminal competing official application ownership claim');
  if (foulOfficialClaims(db,'actual_foul_official_handoffs',scope.official).length) {
    throw new Error('foul terminal official child has an ordinary handoff claim');
  }
  policyRows(db,p);
};
const queuePin = (db: DatabaseSync, p: FoulTerminalApplicationProposal) => {
  const scope = queueScope(p), events = foulOfficialClaims(db,'actual_foul_official_events',scope.official);
  return {
    terminal:foulTerminalApplicationClaims(db,scope),applications:officialApplicationOwnershipClaims(db,scope),
    sessions:foulOfficialClaims(db,'actual_foul_official_sessions',scope.official),events,
    heads:foulOfficialHeads(db,scope.official,events.map(row => String(row.source_id))),
    handoffs:foulOfficialClaims(db,'actual_foul_official_handoffs',scope.official),policies:policyRows(db,p),
    counts:db.prepare('SELECT * FROM main.actual_foul_rule_consumptions WHERE source_id=?').all(p.consumptionReference.sourceId),
    ends:db.prepare('SELECT * FROM main.actual_foul_play_ends WHERE source_id=?').all(p.physicalEndReference.sourceId),
    pitches:p.originalPhysicalPitchPrefix.map(ref => db.prepare('SELECT * FROM main.physical_pitch_progress_actions WHERE source_id=?').get(ref.sourceId)),
    fences:db.prepare('SELECT * FROM main.actual_live_play_fences WHERE (game_id=? AND play_id=?) OR physical_pitch_source_id=? OR closure_source_id=?')
      .all(p.gameId,p.playId,p.physicalPitchSourceId,p.physicalEndReference.sourceId),
    runtimes:db.prepare('SELECT * FROM main.actual_live_play_runtimes WHERE source_id=?').all(p.runtimeSourceId),
    fixture:db.prepare('SELECT * FROM main.official_fixtures WHERE game_id=?').all(p.gameId),
  };
};

/** Archive authentication owns expected-self validation; discovery grants no
 * authority. No callback or today's head is required for an exact queue read. */
export const foulTerminalApplicationEvidenceFromSqlite = (db: DatabaseSync) => {
  const read = (sourceId: string): DurableFoulTerminalApplicationQueue | null => withBattedVenueLegalReadSnapshot(db, () => {
    if (!id(sourceId)) throw new Error('invalid foul terminal queue identity');
    if (!assertFoulTerminalApplicationStorage(db)) return null;
    const rows = foulTerminalApplicationIdentityRows(db,sourceId);
    if (!rows.length) return null;
    if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('foul terminal queue Source identity ownership differs');
    const row = rows[0];
    if (row.status !== 'QUEUED' || row.result_json !== null || typeof row.source_json !== 'string') {
      throw new Error('foul terminal queue archive stage is unsupported');
    }
    const source = actualFoulTerminalApplicationInput(JSON.parse(row.source_json),sourceId);
    if (row.source_json !== json(source) || row.source_hash !== hash(source)) throw new Error('foul terminal queue Source archive differs');
    const proposal = deriveFoulTerminalApplicationProposal(db,source,'historical');
    if (proposal.kind !== 'terminal_non_live_projected') throw new Error('foul terminal queued original proof became pending');
    same(row,queueRow(proposal),'foul terminal queue archive encoding, hashes or cached scope differ');
    assertQueueClaims(db,proposal,row);
    return freeze({ source,proposal,status:'QUEUED',officialApplied:false,result:null });
  });
  return Object.freeze({ read,
    prepare(source: AcceptedFoulTerminalApplication) {
      return withBattedVenueLegalReadSnapshot(db, () => {
        if (!assertFoulTerminalApplicationStorage(db)) throw new Error('foul terminal queue owner is not installed');
        const evaluation = deriveFoulTerminalApplicationProposal(db,source,'current');
        if (evaluation.kind === 'pending') return { evaluation,pin:null };
        assertQueueClaims(db,evaluation,null);
        return { evaluation,pin:queuePin(db,evaluation) };
      });
    },
    proveQueuedCurrent(sourceId: string) {
      return withBattedVenueLegalReadSnapshot(db, () => {
        const queued = read(sourceId);
        if (!queued) throw new Error('foul terminal queue disappeared during proof');
        const current = deriveFoulTerminalApplicationProposal(db,queued.source,'current');
        same(current,queued.proposal,'foul terminal queue current proof differs from its immutable proposal');
        return { queued,pin:queuePin(db,queued.proposal) };
      });
    },
  });
};
