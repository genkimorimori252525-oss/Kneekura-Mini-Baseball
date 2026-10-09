import { NATIONAL_EXPOSURE_DEVELOPMENT_KIND, readNationalExposureDevelopmentBoundary } from './NationalExposureDevelopmentOrigin';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { readState as readClubState } from '../../core/world/club/ClubSchemas';
import { getCurrentClubManager, replayClubEvents } from '../../core/world/club/ClubEvents';
import type { ClubTransitionEvent, ClubWorldState } from '../../core/world/club/ClubTypes';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState } from '../../core/world/roster/RosterTypes';
import { createHumanControlState, resolveDecisionAuthority } from '../../core/world/control/HumanControl';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { selectControlledDecision } from '../../core/world/control/ControlledDecision';
import { attributeExecutedDecision } from '../../core/world/control/DecisionEvidence';
import type { ControlledDecision, DecisionEvidenceProjection, DecisionOpportunity, DecisionSubmission,
  ExecutedDecision, HumanControlState } from '../../core/world/control/ControlTypes';
import { appendDevelopmentLearningEvent, type DevelopmentLearningEpisode } from '../../core/world/development/DevelopmentLearningEpisode';
import type { SqliteWorldSettlementStore } from './SqliteWorldSettlementStore';
import type { SqliteWorldControlStore } from './SqliteWorldControlStore';
import type { SqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import type { SqliteDevelopmentInitiationStore } from './SqliteDevelopmentInitiationStore';
import { PRACTICE_DEVELOPMENT_KIND, readPracticeDevelopmentBoundary, type PracticeInitiationRow } from './PracticeDevelopmentOrigin';
import { sqliteJsonMetadataNodes } from './SqliteOwnershipMetadata';
import { assertManagerBeliefBoundary, readManagerBeliefBoundary, type ManagerBeliefBoundary } from './ManagerBeliefBoundary';
import type { IssuedManagerPracticeOrderDecision, ManagerPracticeOrderDecisionInput,
  ManagerPracticeOrderMethods, PracticeManagerSelectionEvidence } from './ManagerPracticeOrderFromBelief';
import { freezePractice, planPracticeDelivery, practiceAttemptId, practiceFields, practiceHash, practiceId,
  practiceJson as json, practiceRevision, validatePracticeOpportunity, type PitchPracticeAttempt, type PitchPracticeFrame, type PitchPracticeOpportunity } from './PitchPracticeAttempt';

export const PITCH_PRACTICE_DOMAIN = 'PITCH_PRACTICE' as const;
type Db = Pick<DatabaseSync, 'prepare'>;
export type AcceptedPracticePrescription = Omit<PitchPracticeOpportunity, 'workloadRevision' | 'timingRevision' | 'releaseRevision'> & Readonly<{
  clubId: string;
  participation: Readonly<{ assignmentUnitId: string; availabilityStatus: 'AVAILABLE'; availabilityEvidenceId: string }>;
  window: Readonly<{ startsAtUs: number; endsAtUs: number }>;
  managerAction?: Readonly<{ version: 'manager-practice-action-v1'; domainId: 'PITCH_PRACTICE'; actionId: string }>;
}>;
export type PracticeOrderDecisionInput = Readonly<{
  sourceId: string; prescriptionSourceId: string; careerId: string; clubId: string;
  decisionId: string; contextId: string; actionId: string;
  prospectiveExecutionId?: string;
  expected: Readonly<{ worldRevision: number; controlRevision: number; clubRevision: number; rosterRevision: number;
    workloadRevision: number; timingRevision: number; releaseRevision: number }>;
}>;
export type IssuedPracticeOrderDecision = Readonly<{
  sourceId: string; request: PracticeOrderDecisionInput; prescription: AcceptedPracticePrescription;
  opportunity: DecisionOpportunity; control: HumanControlState; hash: string;
}>;
export type OwnedPracticeOrder = Readonly<{
  sourceId: string; decisionSourceId: string; prescriptionSourceId: string;
  opportunity: PitchPracticeOpportunity; decision: ControlledDecision; execution: ExecutedDecision;
  projection: DecisionEvidenceProjection; hash: string;
}>;
export type PracticeOrderIssueInput = Readonly<{ decisionSourceId: string; executionId: string; submission: DecisionSubmission }>;
export type OwnedPracticeOrderMethods = Readonly<{
  prepareOrderDecision(input: PracticeOrderDecisionInput): Readonly<{ kind: 'pending'; reason: string }>
    | Readonly<{ kind: 'ready'; decision: IssuedPracticeOrderDecision }>;
  readOrderDecision(sourceId: string): IssuedPracticeOrderDecision | null;
  issueOrder(input: PracticeOrderIssueInput): OwnedPracticeOrder;
  readOrder(sourceId: string): OwnedPracticeOrder | null;
}>;
export type PracticeOrderSources = Readonly<{
  world: Pick<SqliteWorldSettlementStore, 'readClub' | 'readClubHistory'>;
  control: Pick<SqliteWorldControlStore, 'readHead'>;
  roster: Pick<SqliteManagerRosterDecisionStore, 'readHead'>;
}>;
export type PracticeOrderAuthority = Readonly<{
  readAcceptedPracticePrescription?(sourceId: string): AcceptedPracticePrescription | null;
}>;
type Tools = Readonly<{
  check(id: string): void;
  transaction<T>(work: () => T): T;
  inspectFrame(opportunity: PitchPracticeOpportunity, fresh: boolean): PitchPracticeFrame;
  frameEvidence(connection: Db, opportunity: PitchPracticeOpportunity, frame: PitchPracticeFrame): unknown;
  assertAdmission(opportunity: PitchPracticeOpportunity): void;
  readOriginAttempt(connection: Db, attemptId: string, maximumTimingRevision: number): PitchPracticeAttempt | null;
  assertProbeReservation(connection: Db, opportunity: PitchPracticeOpportunity): void;
  probeReservationEvidence(connection: Db, opportunity: PitchPracticeOpportunity): unknown | null;
}>;
type BodyHead = { revision: number; state_json: string };
type Heads = Readonly<{ worldRevision: number; control: HumanControlState; controlJson: string; club: ClubWorldState; roster: RosterState;
  playerId: string; body: Readonly<{ timing: BodyHead; release: BodyHead; workload: BodyHead }> }>;
type DecisionRow = { source_id: string; career_id: string; club_id: string; decision_id: string; prescription_source_id: string;
  attempt_id: string; decision_json: string; frame_json: string; episode_json: string; heads_json: string; evidence_json: string };
type OrderRow = { source_id: string; decision_source_id: string; execution_id: string; order_json: string; order_hash: string };
type Decision = IssuedPracticeOrderDecision | IssuedManagerPracticeOrderDecision;
type Request = PracticeOrderDecisionInput | ManagerPracticeOrderDecisionInput;
const same = (a: unknown, b: unknown): boolean => json(a) === json(b);
const ownSource = (careerId: string, executionId: string) => `practice-order:${practiceHash([careerId, executionId])}`;
const managerRequest = (r: PracticeOrderDecisionInput): r is ManagerPracticeOrderDecisionInput => Object.hasOwn(r, 'managerSelection');
const managerDecision = (d: Decision): d is IssuedManagerPracticeOrderDecision => Object.hasOwn(d, 'managerSelection');
const requestValue = (raw: PracticeOrderDecisionInput): Request => {
  const r = cloneInert(raw);
  if (!practiceFields(r, ['sourceId', 'prescriptionSourceId', 'careerId', 'clubId', 'decisionId', 'contextId', 'actionId', 'expected',
    ...(r && Object.hasOwn(r, 'prospectiveExecutionId') ? ['prospectiveExecutionId'] : []),
    ...(r && Object.hasOwn(r, 'managerSelection') ? ['managerSelection'] : [])])
    || ![r.sourceId, r.prescriptionSourceId, r.careerId, r.clubId, r.decisionId, r.contextId, r.actionId].every(practiceId)
    || Object.hasOwn(r, 'prospectiveExecutionId') && !practiceId(r.prospectiveExecutionId)
    || !practiceFields(r.expected, ['worldRevision', 'controlRevision', 'clubRevision', 'rosterRevision', 'workloadRevision', 'timingRevision', 'releaseRevision'])
    || !Object.values(r.expected).every(practiceRevision) || r.expected.worldRevision === Number.MAX_SAFE_INTEGER) throw new Error('invalid practice order source revisions');
  if (managerRequest(r)) {
    const m = r.managerSelection;
    if (!practiceFields(m, ['version', 'managerId', 'appointmentId', 'expectedBeliefRevision', 'traceId'])
      || m.version !== 'manager-practice-selection-v1' || ![m.managerId, m.appointmentId, m.traceId].every(practiceId)
      || !practiceRevision(m.expectedBeliefRevision)) throw new Error('invalid Manager practice selection request');
  }
  return freezePractice(r);
};
const command = (p: AcceptedPracticePrescription, r: PracticeOrderDecisionInput, sourceId = `practice-order-preview:${r.sourceId}`): PitchPracticeOpportunity => {
  const { clubId: _club, participation: _participation, window: _window, sourceId: _source, sourceVersion: _version,
    managerAction: _managerAction, ...fields } = p;
  return validatePracticeOpportunity({ ...fields, sourceId, sourceVersion: 'owned-pitch-practice-order-v1',
    workloadRevision: r.expected.workloadRevision, timingRevision: r.expected.timingRevision, releaseRevision: r.expected.releaseRevision }, sourceId);
};
const prescriptionValue = (raw: AcceptedPracticePrescription, r: PracticeOrderDecisionInput): AcceptedPracticePrescription => {
  const p = cloneInert(raw);
  if (!practiceFields(p, ['sourceId', 'sourceVersion', 'opportunityId', 'ordinal', 'previousAttemptId', 'careerId', 'playerId', 'personLinkSourceId',
    'atDay', 'readyAtUs', 'fatiguePolicySourceId', 'practiceSeed', 'timingIntent', 'moundReference', 'physics', 'episode', 'clubId', 'participation', 'window',
    ...(p && Object.hasOwn(p, 'managerAction') ? ['managerAction'] : [])])
    || p.sourceId !== r.prescriptionSourceId || !practiceId(p.sourceVersion) || p.careerId !== r.careerId || p.clubId !== r.clubId
    || !practiceFields(p.participation, ['assignmentUnitId', 'availabilityStatus', 'availabilityEvidenceId'])
    || !practiceId(p.participation.assignmentUnitId) || p.participation.availabilityStatus !== 'AVAILABLE' || !practiceId(p.participation.availabilityEvidenceId)
    || !practiceFields(p.window, ['startsAtUs', 'endsAtUs']) || !practiceRevision(p.window.startsAtUs) || !practiceRevision(p.window.endsAtUs)
    || p.window.endsAtUs <= p.window.startsAtUs || p.readyAtUs < p.window.startsAtUs || p.readyAtUs >= p.window.endsAtUs) {
    throw new Error('invalid accepted practice prescription scope, participation or window');
  }
  if (Object.hasOwn(p, 'managerAction') && (!practiceFields(p.managerAction, ['version', 'domainId', 'actionId'])
    || p.managerAction?.version !== 'manager-practice-action-v1' || p.managerAction.domainId !== PITCH_PRACTICE_DOMAIN
    || !practiceId(p.managerAction.actionId))) throw new Error('invalid accepted Manager practice action binding');
  if (managerRequest(r) && p.managerAction && p.managerAction.actionId !== r.actionId) throw new Error('Manager practice action differs from accepted prescription binding');
  command(p, r);
  return freezePractice(p);
};

export type PracticeOrderExecutionReader = (connection: Db, executionId: string,
  consumer: Readonly<{ careerId: string; managerId: string; revision: number }>) =>
  Readonly<{ order: OwnedPracticeOrder; proof: unknown }> | null;
// Only the real installed owner can bind its existing decoder. A look-alike
// readOrder function or a supplied execution DTO grants no evidence authority.
const executionReaders = new WeakMap<OwnedPracticeOrderMethods['readOrder'], PracticeOrderExecutionReader>();
export const practiceOrderExecutionEvidenceFromOwner = (owner: Pick<OwnedPracticeOrderMethods, 'readOrder'>): PracticeOrderExecutionReader => {
  const reader = executionReaders.get(owner?.readOrder);
  if (!reader) throw new Error('Manager practice observation requires a genuine practice order owner');
  return reader;
};

/** Raw immutable originals included in an actual attempt's existing source fingerprint. */
export const captureOwnedPracticeOrderEvidence = (db: Db, sourceId: string): unknown | null => {
  if (!sourceId.startsWith('practice-order:')) return null;
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='pitch_practice_orders'").get()) return null;
  const order = db.prepare('SELECT * FROM pitch_practice_orders WHERE source_id=?').get(sourceId) as OrderRow | undefined;
  if (!order) return null;
  const decision = db.prepare('SELECT * FROM pitch_practice_order_decisions WHERE source_id=?').get(order.decision_source_id) as DecisionRow | undefined;
  const parsed = JSON.parse(order.order_json) as OwnedPracticeOrder;
  const event = db.prepare('SELECT * FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
    .get(parsed.opportunity.careerId, parsed.execution.worldRevision) ?? null;
  return { order, decision: decision ?? null, event };
};

/** A single legal-action/order owner inside the existing practice transaction. */
export const installOwnedPracticeOrders = (db: DatabaseSync, sources: PracticeOrderSources | undefined,
  episodes: Pick<SqliteDevelopmentInitiationStore, 'read'>, authority: PracticeOrderAuthority | undefined, tools: Tools) => {
  if (authority?.readAcceptedPracticePrescription !== undefined && typeof authority.readAcceptedPracticePrescription !== 'function') throw new Error('invalid practice prescription authority');
  db.exec(`CREATE TABLE IF NOT EXISTS pitch_practice_order_decisions (
    source_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, club_id TEXT NOT NULL, decision_id TEXT NOT NULL,
    prescription_source_id TEXT NOT NULL UNIQUE, attempt_id TEXT NOT NULL UNIQUE,
    decision_json TEXT NOT NULL, frame_json TEXT NOT NULL, episode_json TEXT NOT NULL, heads_json TEXT NOT NULL, evidence_json TEXT NOT NULL,
    UNIQUE(career_id,decision_id)
  );
  CREATE TABLE IF NOT EXISTS pitch_practice_orders (
    source_id TEXT PRIMARY KEY, decision_source_id TEXT NOT NULL UNIQUE, execution_id TEXT NOT NULL UNIQUE,
    order_json TEXT NOT NULL, order_hash TEXT NOT NULL
  );`);
  const decisionRow = (connection: Db, sourceId: string) => connection.prepare('SELECT * FROM pitch_practice_order_decisions WHERE source_id=?').get(sourceId) as DecisionRow | undefined;
  const orderRow = (connection: Db, sourceId: string) => connection.prepare('SELECT * FROM pitch_practice_orders WHERE source_id=?').get(sourceId) as OrderRow | undefined;
  const reservedDecisions = (connection: Db, sourceId: string, attemptId?: string): DecisionRow[] => {
    // Derive the prospective Source from the frozen request rather than trusting
    // a separately mutable SQL mirror of that derived identity.
    const rows = connection.prepare(`SELECT * FROM pitch_practice_order_decisions
      WHERE attempt_id=? OR json_extract(decision_json,'$.request.prospectiveExecutionId') IS NOT NULL`)
      .all(attemptId ?? null) as DecisionRow[];
    const found = rows.filter(row => {
      const request = (JSON.parse(row.decision_json) as IssuedPracticeOrderDecision).request;
      return row.attempt_id === attemptId || request.prospectiveExecutionId !== undefined
        && ownSource(request.careerId, request.prospectiveExecutionId) === sourceId;
    });
    const owned = orderRow(connection, sourceId);
    if (owned && !found.some(row => row.source_id === owned.decision_source_id)) {
      const original = decisionRow(connection, owned.decision_source_id);
      if (!original) throw new Error('reserved practice order lacks its original decision');
      found.push(original);
    }
    return found;
  };
  const hasIssuedWorldEvidence = (connection: Db, sourceId: string): boolean => {
    if (!connection.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_decision_revision_events'").get()) return false;
    return Boolean(connection.prepare(`SELECT 1 FROM world_decision_revision_events
      WHERE (source_kind='PITCH_PRACTICE_ORDER' AND source_event_id=?)
        OR (EXISTS (SELECT 1 FROM (${sqliteJsonMetadataNodes('event_json', ['kind'])}) WHERE type='text' AND atom='PracticeOpportunityIssued')
          AND EXISTS (SELECT 1 FROM (${sqliteJsonMetadataNodes('event_json', ['sourceId'])}) WHERE type='text' AND atom=?))`).get(sourceId, sourceId));
  };
  const scope = (): PracticeOrderSources => {
    if (!sources?.world || !sources.control || !sources.roster) throw new Error('practice order World sources are not configured');
    return sources;
  };
  const bodyHeads = (connection: Db, careerId: string, playerId: string): Heads['body'] => {
    const select = (table: string): BodyHead => {
      const row = connection.prepare(`SELECT revision,state_json FROM ${table} WHERE career_id=? AND player_id=?`).get(careerId, playerId) as BodyHead | undefined;
      if (!row || !practiceRevision(row.revision) || typeof row.state_json !== 'string') throw new Error('practice Player source head is missing');
      return row;
    };
    return { timing: select('world_pitch_timing_heads'), release: select('world_player_release_heads'), workload: select('world_player_workload_heads') };
  };
  const currentHeads = (r: PracticeOrderDecisionInput, p: AcceptedPracticePrescription): Heads => {
    const accepted = scope(), control = accepted.control.readHead(r.careerId), club = accepted.world.readClub(r.careerId, r.clubId), roster = accepted.roster.readHead(r.careerId, r.clubId);
    if (!control || !club || !roster || !accepted.world.readClubHistory(r.careerId, r.clubId)) throw new Error('practice order Club or roster source is missing');
    if (control.worldRevision !== r.expected.worldRevision || control.control.revision !== r.expected.controlRevision
      || club.revision !== r.expected.clubRevision || roster.roster.revision !== r.expected.rosterRevision) throw new Error('stale practice order source revision');
    const body = bodyHeads(db, r.careerId, p.playerId);
    if (body.timing.revision !== r.expected.timingRevision || body.release.revision !== r.expected.releaseRevision
      || body.workload.revision !== r.expected.workloadRevision) throw new Error('stale practice Player source revision');
    return { worldRevision: control.worldRevision, control: control.control, controlJson: JSON.stringify(control.control),
      club: club.state, roster: roster.roster, playerId: p.playerId, body };
  };
  const opportunity = (r: PracticeOrderDecisionInput, p: AcceptedPracticePrescription, heads: Heads): DecisionOpportunity => {
    const control = createHumanControlState(heads.control), club = readClubState(heads.club), roster = createRosterState(heads.roster);
    const manager = getCurrentClubManager(club), player = roster.players.find(item => item.playerId === p.playerId);
    if (heads.worldRevision !== r.expected.worldRevision || control.revision !== r.expected.controlRevision || heads.controlJson !== JSON.stringify(control)
      || heads.playerId !== p.playerId || heads.body.timing.revision !== r.expected.timingRevision || heads.body.release.revision !== r.expected.releaseRevision
      || heads.body.workload.revision !== r.expected.workloadRevision
      || club.revision !== r.expected.clubRevision || roster.revision !== r.expected.rosterRevision || club.careerId !== r.careerId
      || club.identity.clubId !== r.clubId || roster.careerId !== r.careerId || club.effectiveDay > p.atDay || roster.effectiveDay > p.atDay
      || club.season.plan.startsOnDay > p.atDay || club.season.closureRef !== null || !manager.ok || !manager.value) throw new Error('practice order Club, manager or revision scope differs');
    if (!control.domainIds.includes(PITCH_PRACTICE_DOMAIN)) throw new Error('practice capability domain is not registered');
    if (managerRequest(r)) {
      if (r.managerSelection.managerId !== manager.value.managerId || r.managerSelection.appointmentId !== manager.value.appointmentId) {
        throw new Error('Manager practice appointment scope differs');
      }
    } else if (control.controlledClubId !== r.clubId) throw new Error('Human does not control practice Club');
    if (!player || player.assignment?.clubId !== r.clubId || player.assignment.unitId !== p.participation.assignmentUnitId
      || !roster.units.some(unit => unit.unitId === p.participation.assignmentUnitId && unit.clubId === r.clubId)
      || player.availability.status !== p.participation.availabilityStatus || player.availability.evidenceId !== p.participation.availabilityEvidenceId) {
      throw new Error('practice Player assignment or availability evidence differs');
    }
    return { decisionId: r.decisionId, contextId: r.contextId, worldRevision: r.expected.worldRevision, clubId: r.clubId,
      domainId: PITCH_PRACTICE_DOMAIN, managerId: manager.value.managerId, appointmentId: manager.value.appointmentId, legalActionIds: [r.actionId] };
  };
  const managerEvidence = (connection: Db, r: ManagerPracticeOrderDecisionInput, p: AcceptedPracticePrescription,
    legal: DecisionOpportunity, control: HumanControlState, boundary: ManagerBeliefBoundary,
    mode: 'historical' | 'current'): PracticeManagerSelectionEvidence => {
    const m = r.managerSelection;
    if (!p.managerAction || p.managerAction.actionId !== r.actionId || boundary.careerId !== r.careerId
      || boundary.managerId !== m.managerId || boundary.revision !== m.expectedBeliefRevision) throw new Error('Manager practice belief or accepted action scope differs');
    assertManagerBeliefBoundary(connection, boundary, mode, readExecution);
    const selected = selectManagerControlledDecision(control, legal,
      { managerId: m.managerId, appointmentId: m.appointmentId, state: boundary.state.agent }, m.traceId);
    if (!selected.ok) throw new Error(`Manager practice selection rejected: ${selected.reason.code}`);
    return freezePractice({ version: 'manager-practice-selection-v1', boundary, selection: selected.value });
  };
  const assertCurrentRows = (connection: Db, r: PracticeOrderDecisionInput, h: Heads, worldRevision = r.expected.worldRevision): void => {
    const control = connection.prepare('SELECT world_revision,control_revision,control_json FROM world_control_heads WHERE career_id=?').get(r.careerId);
    const club = connection.prepare('SELECT revision,state_json FROM world_club_heads WHERE career_id=? AND club_id=?').get(r.careerId, r.clubId);
    const roster = connection.prepare('SELECT revision,roster_json FROM world_roster_heads WHERE career_id=?').get(r.careerId);
    if (control?.world_revision !== worldRevision || control.control_revision !== r.expected.controlRevision || control.control_json !== h.controlJson
      || club?.revision !== r.expected.clubRevision || typeof club.state_json !== 'string' || !same(JSON.parse(club.state_json), h.club)
      || roster?.revision !== r.expected.rosterRevision || typeof roster.roster_json !== 'string' || !same(JSON.parse(roster.roster_json), h.roster)
      || !same(bodyHeads(connection, r.careerId, h.playerId), h.body)) {
      throw new Error('practice order original current source rows differ');
    }
  };
  const assertCurrentEpisode = (connection: Db, episode: DevelopmentLearningEpisode | null): void => {
    if (!episode) return;
    const row = connection.prepare('SELECT revision,current_json FROM world_development_initiations WHERE episode_id=?').get(episode.episodeId);
    if (row?.revision !== episode.revision || row.current_json !== json(episode)) throw new Error('stale practice order episode revision');
  };
  const episodeAtBoundary = (connection: Db, expected: DevelopmentLearningEpisode | null, maximumTimingRevision: number): void => {
    if (!expected) return;
    const row = connection.prepare(`SELECT episode_id,career_id,player_id,at_day,appraisal_source_id,
      request_json,prior_json,assessment_json,initial_json FROM world_development_initiations WHERE episode_id=?`)
      .get(expected.episodeId) as PracticeInitiationRow | undefined;
    if (typeof row?.initial_json !== 'string') throw new Error('practice order episode source is missing');
    const request = JSON.parse(row.request_json) as { kind?: unknown };
    if (Object.hasOwn(request, 'kind')) {
      // Reauthenticate the immutable catalyst on this actual connection without
      // following the episode's later learning head or current National roster.
      if (request.kind === NATIONAL_EXPOSURE_DEVELOPMENT_KIND) readNationalExposureDevelopmentBoundary(connection as DatabaseSync, row);
      else if (request.kind === PRACTICE_DEVELOPMENT_KIND) readPracticeDevelopmentBoundary(connection, row,
        attemptId => tools.readOriginAttempt(connection, attemptId, maximumTimingRevision));
      else throw new Error('invalid practice order initiation source kind');
    }
    let state = JSON.parse(row.initial_json) as DevelopmentLearningEpisode;
    const events = connection.prepare('SELECT before_revision,after_revision,event_json,state_json FROM world_development_learning_events WHERE episode_id=? AND after_revision<=? ORDER BY after_revision')
      .all(expected.episodeId, expected.revision) as { before_revision: number; after_revision: number; event_json: string; state_json: string }[];
    for (const event of events) {
      if (event.before_revision !== state.revision || event.after_revision !== state.revision + 1) throw new Error('practice order episode prefix differs');
      state = appendDevelopmentLearningEvent(state, state.revision, JSON.parse(event.event_json));
      if (json(state) !== event.state_json) throw new Error('practice order original episode result differs');
    }
    if (!same(state, expected)) throw new Error('practice order historical episode boundary differs');
  };
  const evidence = (connection: Db, r: PracticeOrderDecisionInput, p: AcceptedPracticePrescription, frame: PitchPracticeFrame,
    episode: DevelopmentLearningEpisode | null, bindProbeReservation = false): unknown => {
    const rosterRows = connection.prepare('SELECT * FROM world_roster_executions WHERE career_id=? AND roster_revision<=? ORDER BY roster_revision')
      .all(r.careerId, r.expected.rosterRevision) as { career_id: string; club_id: string; decision_id: string }[];
    return {
      ...(bindProbeReservation ? { probeReservation: tools.probeReservationEvidence(connection,
        command(p, r, r.prospectiveExecutionId === undefined ? undefined : ownSource(r.careerId, r.prospectiveExecutionId))) } : {}),
      worldBoundary: connection.prepare('SELECT * FROM world_decision_revision_events WHERE career_id=? AND world_revision=?').get(r.careerId, r.expected.worldRevision) ?? null,
      controlEvents: connection.prepare("SELECT * FROM world_decision_revision_events WHERE career_id=? AND source_kind='CONTROL_CHANGE' AND world_revision<=? ORDER BY world_revision")
        .all(r.careerId, r.expected.worldRevision),
      clubCheckpoint: connection.prepare('SELECT * FROM world_club_checkpoints WHERE career_id=? AND club_id=?').get(r.careerId, r.clubId) ?? null,
      clubEvents: connection.prepare('SELECT * FROM world_club_event_journal WHERE career_id=? AND club_id=? AND after_revision<=? ORDER BY after_revision')
        .all(r.careerId, r.clubId, r.expected.clubRevision),
      rosterRows, rosterOpportunities: rosterRows.map(row => connection.prepare('SELECT * FROM world_roster_opportunities WHERE career_id=? AND club_id=? AND decision_id=?')
        .get(row.career_id, row.club_id, row.decision_id) ?? null),
      body: tools.frameEvidence(connection, command(p, r), frame),
      episode: episode ? { initiation: connection.prepare(`SELECT episode_id,career_id,player_id,at_day,appraisal_source_id,
        request_json,prior_json,assessment_json,initial_json FROM world_development_initiations WHERE episode_id=?`).get(episode.episodeId) ?? null,
        events: connection.prepare('SELECT * FROM world_development_learning_events WHERE episode_id=? AND after_revision<=? ORDER BY after_revision')
          .all(episode.episodeId, episode.revision) } : null,
    };
  };
  const assertClubBoundary = (connection: Db, r: PracticeOrderDecisionInput, expected: ClubWorldState): void => {
    const checkpoint = connection.prepare('SELECT state_json FROM world_club_checkpoints WHERE career_id=? AND club_id=?').get(r.careerId, r.clubId);
    if (typeof checkpoint?.state_json !== 'string') throw new Error('practice order Club checkpoint is missing');
    const events = connection.prepare('SELECT event_json FROM world_club_event_journal WHERE career_id=? AND club_id=? AND after_revision<=? ORDER BY after_revision')
      .all(r.careerId, r.clubId, r.expected.clubRevision) as { event_json: string }[];
    const replay = replayClubEvents(readClubState(JSON.parse(checkpoint.state_json)), events.map(e => JSON.parse(e.event_json) as ClubTransitionEvent));
    if (!replay.ok || !same(replay.value, expected)) throw new Error('practice order historical Club source differs');
  };
  const decodeDecision = (connection: Db, row: DecisionRow, maximumTimingRevision = Number.MAX_SAFE_INTEGER): Decision => {
    const d = JSON.parse(row.decision_json) as Decision, r = requestValue(d.request), p = prescriptionValue(d.prescription, r);
    if (r.expected.timingRevision > maximumTimingRevision) throw new Error('practice order proof depends on a later timing source');
    const frame = JSON.parse(row.frame_json) as PitchPracticeFrame, episode = JSON.parse(row.episode_json) as DevelopmentLearningEpisode | null;
    const heads = JSON.parse(row.heads_json) as Heads, proof = JSON.parse(row.evidence_json) as unknown;
    const expectedOpportunity = opportunity(r, p, heads);
    if (managerRequest(r) !== managerDecision(d)) throw new Error('practice decision Manager evidence version differs');
    let manager: PracticeManagerSelectionEvidence | undefined;
    if (managerRequest(r) && managerDecision(d)) {
      if (!practiceFields(d.managerSelection, ['version', 'boundary', 'selection'])
        || d.managerSelection.version !== 'manager-practice-selection-v1') throw new Error('corrupt Manager practice selection evidence');
      // A later observation does not rewrite an issued proposal or disqualify
      // a real Human override of that proposal's original legal command.
      manager = managerEvidence(connection, r, p, expectedOpportunity, heads.control, d.managerSelection.boundary, 'historical');
      if (!same(manager, d.managerSelection)) throw new Error('Manager practice historical selection differs');
    }
    if (!practiceFields(d, ['sourceId', 'request', 'prescription', 'opportunity', 'control', 'hash', ...(manager ? ['managerSelection'] : [])]) || row.source_id !== d.sourceId || d.sourceId !== r.sourceId
      || row.career_id !== r.careerId || row.club_id !== r.clubId || row.decision_id !== r.decisionId || row.prescription_source_id !== p.sourceId
      || row.attempt_id !== practiceAttemptId(command(p, r)) || !same(d.opportunity, expectedOpportunity) || !same(d.control, heads.control)
      || json(d) !== row.decision_json || json(frame) !== row.frame_json || json(episode) !== row.episode_json || json(heads) !== row.heads_json || json(proof) !== row.evidence_json
      || d.hash !== practiceHash({ request: r, prescription: p, opportunity: expectedOpportunity, control: heads.control, frame, episode, heads, evidence: proof,
        ...(manager ? { managerSelection: manager } : {}) })) {
      throw new Error('corrupt frozen practice order decision');
    }
    const preview = command(p, r);
    // Authenticate the immutable footprint before following any source callback.
    const boundProbe = proof !== null && typeof proof === 'object' && Object.hasOwn(proof, 'probeReservation');
    if (!same(evidence(connection, r, p, frame, episode, boundProbe), proof)) throw new Error('practice order original source evidence differs');
    assertClubBoundary(connection, r, heads.club); episodeAtBoundary(connection, episode, maximumTimingRevision);
    if (p.episode === null ? episode !== null : !episode || episode.episodeId !== p.episode.episodeId || episode.revision !== p.episode.revision
      || episode.careerId !== p.careerId || episode.playerId !== p.playerId || episode.domain !== 'TECHNICAL'
      || !['HYPOTHESIS', 'PRACTICING'].includes(episode.stage) || episode.effectiveDay > p.atDay) throw new Error('practice order episode scope or stage differs');
    const actualFrame = tools.inspectFrame(preview, false);
    if (!same(actualFrame, frame) || planPracticeDelivery(preview, actualFrame).timeline.followThroughEndUs > p.window.endsAtUs) throw new Error('practice order frame or prescribed window differs');
    return freezePractice(d);
  };
  const orderInput = (raw: PracticeOrderIssueInput, allowManager = false): PracticeOrderIssueInput => {
    const input = cloneInert(raw);
    if (!practiceFields(input, ['decisionSourceId', 'executionId', 'submission']) || !practiceId(input.decisionSourceId) || !practiceId(input.executionId)
      || input.submission?.actor?.kind !== 'HUMAN' && !(allowManager && input.submission?.actor?.kind === 'MANAGER')) throw new Error('practice order requires a supported Human submission or original Manager selection');
    return input;
  };
  const managerSubmission = (d: Decision): DecisionSubmission => {
    if (!managerDecision(d)) throw new Error('practice decision lacks its original Manager selection proof');
    const selected = d.managerSelection.selection.decision;
    return { decisionId: selected.decisionId, contextId: selected.contextId, expectedControlRevision: selected.controlRevision,
      expectedWorldRevision: selected.worldRevision, actionId: selected.actionId, actor: selected.actor };
  };
  const materialize = (d: Decision, input: PracticeOrderIssueInput): OwnedPracticeOrder => {
    if (d.request.prospectiveExecutionId !== undefined && input.executionId !== d.request.prospectiveExecutionId) {
      throw new Error('practice order execution identity differs from its prospective reservation');
    }
    const selected = selectControlledDecision(d.control, d.opportunity, input.submission);
    if (!selected.ok) throw new Error(`practice order decision rejected: ${selected.reason.code}`);
    if (input.submission.actor.kind === 'MANAGER' && (!same(input.submission, managerSubmission(d))
      || !managerDecision(d) || !same(selected.value, d.managerSelection.selection.decision))) throw new Error('practice Manager selection attribution differs');
    const sourceId = ownSource(d.request.careerId, input.executionId), physical = command(d.prescription, d.request, sourceId);
    const execution: ExecutedDecision = { executionId: input.executionId, decisionId: d.opportunity.decisionId, contextId: d.opportunity.contextId,
      actionId: selected.value.actionId, worldRevision: d.request.expected.worldRevision + 1, eventIds: [sourceId] };
    const projection = attributeExecutedDecision(selected.value, execution);
    if (!projection.ok || (input.submission.actor.kind === 'HUMAN') !== (projection.value.managerSelfChosenEvidence === null)) throw new Error('practice order actual actor attribution differs');
    const receipt = { sourceId, decisionSourceId: d.sourceId, prescriptionSourceId: d.prescription.sourceId,
      opportunity: physical, decision: selected.value, execution, projection: projection.value };
    return freezePractice({ ...receipt, hash: practiceHash({ receipt, decisionHash: d.hash }) });
  };
  const eventValue = (order: OwnedPracticeOrder) => ({ kind: 'PracticeOpportunityIssued', sourceId: order.sourceId,
    decisionSourceId: order.decisionSourceId, executionId: order.execution.executionId, orderHash: order.hash });
  const decodeOrder = (connection: Db, row: OrderRow, maximumTimingRevision = Number.MAX_SAFE_INTEGER): OwnedPracticeOrder => {
    const order = JSON.parse(row.order_json) as OwnedPracticeOrder, original = decisionRow(connection, row.decision_source_id);
    if (!original || !order.decision) throw new Error('practice order original decision is missing');
    const d = decodeDecision(connection, original, maximumTimingRevision);
    const submission: DecisionSubmission = { decisionId: order.decision.decisionId, contextId: order.decision.contextId,
      expectedControlRevision: order.decision.controlRevision, expectedWorldRevision: order.decision.worldRevision,
      actionId: order.decision.actionId, actor: order.decision.actor };
    const expected = materialize(d, orderInput({ decisionSourceId: row.decision_source_id, executionId: row.execution_id, submission }, true));
    const world = connection.prepare('SELECT world_revision,control_revision,control_json FROM world_control_heads WHERE career_id=?').get(d.request.careerId);
    const count = connection.prepare('SELECT count(*) AS n,min(world_revision) AS first,max(world_revision) AS last FROM world_decision_revision_events WHERE career_id=?').get(d.request.careerId);
    const event = connection.prepare('SELECT source_kind,source_event_id,event_json FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
      .get(d.request.careerId, expected.execution.worldRevision);
    if (typeof world?.control_json !== 'string') throw new Error('practice order World control evidence is missing');
    const currentControl = createHumanControlState(JSON.parse(world.control_json));
    if (row.source_id !== expected.sourceId || row.order_hash !== expected.hash || row.order_json !== json(expected) || !same(order, expected)
      || typeof world.world_revision !== 'number' || !practiceRevision(world.world_revision) || world.world_revision < expected.execution.worldRevision
      || currentControl.revision !== world.control_revision || world.control_json !== JSON.stringify(currentControl)
      || count?.n !== world.world_revision || count.first !== 1 || count.last !== world.world_revision
      || event?.source_kind !== 'PITCH_PRACTICE_ORDER' || event.source_event_id !== expected.sourceId || event.event_json !== json(eventValue(expected))) {
      throw new Error('corrupt original practice order or World execution evidence');
    }
    return expected;
  };
  const readExecution: PracticeOrderExecutionReader = (connection, executionId, consumer) => {
    const row = connection.prepare('SELECT * FROM pitch_practice_orders WHERE execution_id=?').get(executionId) as OrderRow | undefined;
    if (!row) return null;
    const original = decisionRow(connection, row.decision_source_id);
    if (!original) throw new Error('practice execution lacks its original decision');
    const decision = JSON.parse(original.decision_json) as Decision;
    // Check the strictly earlier prefix before recursive owner replay. A
    // forged self/future dependency must fail without entering the decoder.
    if (!managerDecision(decision) || decision.request.careerId !== consumer.careerId
      || decision.request.managerSelection.managerId !== consumer.managerId
      || !practiceRevision(consumer.revision) || !practiceRevision(decision.managerSelection.boundary.revision)
      || decision.managerSelection.boundary.careerId !== consumer.careerId
      || decision.managerSelection.boundary.managerId !== consumer.managerId
      || decision.managerSelection.boundary.revision >= consumer.revision) {
      throw new Error('practice execution requires an earlier same-Manager belief boundary');
    }
    const order = decodeOrder(connection, row);
    if (order.execution.executionId !== executionId) throw new Error('practice execution identity differs');
    return { order, proof: captureOwnedPracticeOrderEvidence(connection, order.sourceId) };
  };
  const readOrderDecision = (sourceId: string) => { tools.check(sourceId); const row = decisionRow(db, sourceId); return row ? decodeDecision(db, row) : null; };
  const readOrder = (sourceId: string) => {
    tools.check(sourceId); const row = orderRow(db, sourceId);
    if (row) return decodeOrder(db, row);
    if (hasIssuedWorldEvidence(db, sourceId)) throw new Error('issued practice World evidence has a missing owned order');
    return null;
  };
  const prepareDecision = (raw: PracticeOrderDecisionInput, managerRoute: boolean) => {
      const r = requestValue(raw);
      if (managerRequest(r) !== managerRoute) throw new Error('practice decision request belongs to another selection route');
      tools.check(r.sourceId); const source = authority?.readAcceptedPracticePrescription?.(r.prescriptionSourceId) ?? null;
      return tools.transaction(() => {
        const existing = decisionRow(db, r.sourceId);
        if (existing) {
          const saved = decodeDecision(db, existing);
          if (!same(saved.request, r) || source && !same(prescriptionValue(source, r), saved.prescription)) throw new Error('practice order decision or prescription is already frozen differently');
          return freezePractice({ kind: 'ready' as const, decision: saved });
        }
        if (!source) return { kind: 'pending' as const, reason: 'practice_prescription_missing' };
        const p = prescriptionValue(source, r), preview = command(p, r), attemptId = practiceAttemptId(preview);
        if (managerRequest(r) && !p.managerAction) return { kind: 'pending' as const, reason: 'manager_practice_action_missing' };
        if (db.prepare('SELECT source_id FROM pitch_practice_order_decisions WHERE (career_id=? AND decision_id=?) OR prescription_source_id=? OR attempt_id=?')
          .get(r.careerId, r.decisionId, p.sourceId, attemptId)) throw new Error('practice decision or canonical opportunity identity is already reserved');
        const prospective = r.prospectiveExecutionId === undefined ? preview : command(p, r, ownSource(r.careerId, r.prospectiveExecutionId));
        if (r.prospectiveExecutionId !== undefined && (reservedDecisions(db, prospective.sourceId).length
          || db.prepare('SELECT 1 FROM pitch_practice_attempts WHERE source_id=?').get(prospective.sourceId)
          || hasIssuedWorldEvidence(db, prospective.sourceId))) throw new Error('prospective practice Source is already reserved');
        tools.assertProbeReservation(db, prospective);
        const bindProbe = tools.probeReservationEvidence(db, prospective) !== null;
        const heads = currentHeads(r, p), legal = opportunity(r, p, heads);
        let manager: PracticeManagerSelectionEvidence | undefined;
        if (managerRequest(r)) {
          const resolved = resolveDecisionAuthority(heads.control, legal);
          if (!resolved.ok) throw new Error(`Manager practice authority rejected: ${resolved.reason.code}`);
          if (resolved.value.kind === 'HUMAN_REQUIRED') return { kind: 'pending' as const, reason: 'human_input_required' };
          const boundary = readManagerBeliefBoundary(db, r.careerId, r.managerSelection.managerId, r.managerSelection.expectedBeliefRevision, readExecution);
          if (!boundary) return { kind: 'pending' as const, reason: 'manager_person_missing' };
          manager = managerEvidence(db, r, p, legal, heads.control, boundary, 'current');
        }
        assertCurrentRows(db, r, heads); tools.assertAdmission(preview);
        const frame = tools.inspectFrame(preview, true);
        if (planPracticeDelivery(preview, frame).timeline.followThroughEndUs > p.window.endsAtUs) throw new Error('practice delivery does not fit prescribed window');
        const episode = p.episode ? episodes.read(p.episode.episodeId)?.episode ?? null : null;
        const proof = evidence(db, r, p, frame, episode, bindProbe);
        const value = { sourceId: r.sourceId, request: r, prescription: p, opportunity: legal, control: heads.control,
          ...(manager ? { managerSelection: manager } : {}) };
        const d: Decision = { ...value, hash: practiceHash({ request: r, prescription: p, opportunity: legal, control: heads.control, frame, episode, heads, evidence: proof,
          ...(manager ? { managerSelection: manager } : {}) }) };
        db.prepare('INSERT INTO pitch_practice_order_decisions VALUES(?,?,?,?,?,?,?,?,?,?,?)')
          .run(r.sourceId, r.careerId, r.clubId, r.decisionId, p.sourceId, attemptId, json(d), json(frame), json(episode), json(heads), json(proof));
        const result = decodeDecision(db, decisionRow(db, r.sourceId)!);
        if (!same(result, d)) throw new Error('practice decision changed from its admitted input');
        if (r.prospectiveExecutionId !== undefined && (reservedDecisions(db, prospective.sourceId).some(other => other.source_id !== r.sourceId)
          || db.prepare('SELECT 1 FROM pitch_practice_attempts WHERE source_id=?').get(prospective.sourceId)
          || hasIssuedWorldEvidence(db, prospective.sourceId))) throw new Error('prospective practice Source reservation changed during preparation');
        tools.assertProbeReservation(db, prospective);
        assertCurrentRows(db, r, heads); assertCurrentEpisode(db, episode);
        if (managerRequest(r) && manager) managerEvidence(db, r, p, legal, heads.control, manager.boundary, 'current');
        return freezePractice({ kind: 'ready' as const, decision: result });
      });
  };
  const issueDecision = (raw: PracticeOrderIssueInput | Parameters<ManagerPracticeOrderMethods['issueManagerOrder']>[0], managerRoute: boolean) => {
      const supplied = cloneInert(raw);
      if (managerRoute) {
        if (!practiceFields(supplied, ['decisionSourceId', 'executionId']) || !practiceId(supplied.decisionSourceId)
          || !practiceId(supplied.executionId)) throw new Error('invalid Manager practice issuance request');
      } else orderInput(supplied as PracticeOrderIssueInput);
      tools.check(supplied.decisionSourceId);
      return tools.transaction(() => {
        const row = decisionRow(db, supplied.decisionSourceId);
        if (!row) throw new Error('issued practice decision is missing');
        const d = decodeDecision(db, row);
        const input = managerRoute ? orderInput({ ...supplied, submission: managerSubmission(d) }, true) : supplied as PracticeOrderIssueInput;
        const expected = materialize(d, input);
        const existing = db.prepare('SELECT * FROM pitch_practice_orders WHERE decision_source_id=? OR execution_id=? OR source_id=?')
          .get(d.sourceId, input.executionId, expected.sourceId) as OrderRow | undefined;
        if (existing) {
          const saved = decodeOrder(db, existing);
          if (!same(saved, expected)) throw new Error('practice decision already consumed under another execution identity');
          return saved;
        }
        if (reservedDecisions(db, expected.sourceId).some(other => other.source_id !== d.sourceId)) throw new Error('practice Source is already reserved by another decision');
        if (db.prepare('SELECT 1 FROM pitch_practice_attempts WHERE source_id=?').get(expected.sourceId)) throw new Error('practice order Source already belongs to a durable attempt');
        tools.assertProbeReservation(db, expected.opportunity);
        const heads = currentHeads(d.request, d.prescription);
        if (!same(heads, JSON.parse(row.heads_json))) throw new Error('stale practice order authority or source snapshot');
        // Current belief is a first Manager-write precondition. Historical
        // retries returned above, and Human overrides use their actual actor.
        if (managerRoute && managerDecision(d)) managerEvidence(db, d.request, d.prescription, d.opportunity, d.control, d.managerSelection.boundary, 'current');
        const episode = JSON.parse(row.episode_json) as DevelopmentLearningEpisode | null;
        assertCurrentRows(db, d.request, heads); assertCurrentEpisode(db, episode);
        tools.assertAdmission(expected.opportunity); tools.inspectFrame(expected.opportunity, true);
        db.prepare('INSERT INTO pitch_practice_orders (source_id,decision_source_id,execution_id,order_json,order_hash) VALUES(?,?,?,?,?)')
          .run(expected.sourceId, d.sourceId, input.executionId, json(expected), expected.hash);
        const changed = db.prepare(`UPDATE world_control_heads SET world_revision=? WHERE career_id=? AND world_revision=? AND control_revision=? AND control_json=?`)
          .run(expected.execution.worldRevision, d.request.careerId, d.request.expected.worldRevision, d.request.expected.controlRevision, heads.controlJson);
        if (changed.changes !== 1) throw new Error('stale practice World CAS');
        db.prepare(`INSERT INTO world_decision_revision_events (career_id,world_revision,source_kind,source_event_id,event_json) VALUES(?,?,'PITCH_PRACTICE_ORDER',?,?)`)
          .run(d.request.careerId, expected.execution.worldRevision, expected.sourceId, json(eventValue(expected)));
        const saved = decodeOrder(db, orderRow(db, expected.sourceId)!);
        if (!same(saved, expected)) throw new Error('practice order changed from its admitted execution');
        if (reservedDecisions(db, expected.sourceId).some(other => other.source_id !== d.sourceId)) throw new Error('practice Source reservation changed during issuance');
        if (db.prepare('SELECT 1 FROM pitch_practice_attempts WHERE source_id=?').get(expected.sourceId)) throw new Error('practice order Source gained a conflicting attempt during issuance');
        tools.assertProbeReservation(db, expected.opportunity);
        assertCurrentRows(db, d.request, heads, expected.execution.worldRevision); assertCurrentEpisode(db, episode);
        if (managerRoute && managerDecision(d)) managerEvidence(db, d.request, d.prescription, d.opportunity, d.control, d.managerSelection.boundary, 'current');
        return saved;
      });
  };
  const methods: OwnedPracticeOrderMethods & ManagerPracticeOrderMethods = {
    prepareOrderDecision: raw => prepareDecision(raw, false), readOrderDecision, readOrder,
    issueOrder: raw => issueDecision(raw, false),
    prepareManagerOrderDecision(raw) {
      const result = prepareDecision(raw, true);
      if (result.kind === 'pending') return result;
      if (!managerDecision(result.decision)) throw new Error('practice decision lacks its Manager selection');
      return freezePractice({ kind: 'ready' as const, decision: result.decision });
    },
    readManagerOrderDecision(sourceId) {
      const d = readOrderDecision(sourceId);
      if (d !== null && !managerDecision(d)) throw new Error('practice decision lacks its Manager selection');
      return d;
    },
    issueManagerOrder: raw => issueDecision(raw, true),
  };
  executionReaders.set(methods.readOrder, readExecution);
  return { methods: Object.freeze(methods),
    assertPlanOpportunity(connection: Db, o: PitchPracticeOpportunity, bodyFrameOnly: boolean): void {
      const rows = reservedDecisions(connection, o.sourceId, practiceAttemptId(o));
      for (const row of rows) {
        const d = decodeDecision(connection, row, o.timingRevision);
        const issued = connection.prepare('SELECT * FROM pitch_practice_orders WHERE decision_source_id=?').get(d.sourceId) as OrderRow | undefined;
        const expected = issued ? decodeOrder(connection, issued, o.timingRevision).opportunity
          : d.request.prospectiveExecutionId === undefined ? null : command(d.prescription, d.request, ownSource(d.request.careerId, d.request.prospectiveExecutionId));
        if (!expected || !same(expected, o) || !issued && !bodyFrameOnly) throw new Error('practice probe contradicts an owned order reservation or its prospective evidence mode');
      }
    },
    assertOpportunity(connection: Db, o: PitchPracticeOpportunity): void {
      const reserved = reservedDecisions(connection, o.sourceId, practiceAttemptId(o));
      const row = orderRow(connection, o.sourceId);
      if (!row) {
        if (reserved.length || hasIssuedWorldEvidence(connection, o.sourceId)) throw new Error('practice opportunity lacks its issued owned order');
        return;
      }
      const owned = decodeOrder(connection, row, o.timingRevision);
      if (reserved.length !== 1 || reserved[0].source_id !== owned.decisionSourceId || !same(owned.opportunity, o)) throw new Error('practice order opportunity source differs');
    },
  };
};

export const createOwnedPitchPracticeOrder = (input: Readonly<{ practice: OwnedPracticeOrderMethods }>): OwnedPracticeOrderMethods => {
  if (!input?.practice || typeof input.practice.prepareOrderDecision !== 'function') throw new Error('owned practice order producer is missing');
  const owner = input.practice;
  return Object.freeze({ prepareOrderDecision: owner.prepareOrderDecision, readOrderDecision: owner.readOrderDecision,
    issueOrder: owner.issueOrder, readOrder: owner.readOrder });
};
