import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { createCompetitionSourceReader, withCompetitionSourceReadPhase } from './CompetitionSourceReadScope';
import type { PracticeOrderExecutionReader } from './OwnedPitchPracticeOrder';
import { MANAGER_PRACTICE_OBSERVATION_KIND, managerPracticeExecutionObservation, type ManagerPracticeObservationSource } from './ManagerPracticeExecutionObservation';
import { createHash } from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { createHumanControlState } from '../../core/world/control/HumanControl';
import { parseOpportunity } from '../../core/world/control/ControlValidation';
import { selectManagerControlledDecision } from '../../core/world/manager/ManagerControlledDecision';
import { dispatchSelectedManagerRosterDecision, type SelectedManagerRosterDispatchInput } from '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import { applyManagerExecutionObservation, createManagerBeliefHistory, type ManagerBeliefHistory,
  type ManagerExecutionObservation } from '../../core/world/manager/ManagerBeliefHistory';
import type { DurableRosterExecution, DurableRosterOpportunity, RosterExecutionRequest } from './SqliteManagerRosterDecisionStore';
import { canonicalRosterEvidenceJson as json } from './RosterEvidenceJson';

type Db = Pick<DatabaseSync, 'prepare'>;
type Seed = Readonly<{ careerId: string; clubId: string; decisionId: string;
  opportunity: DurableRosterOpportunity['opportunity']; policy: ManagerBeliefHistory['policy']; agent: ManagerBeliefHistory['agent'] }>;
type Head = { career_id: string; manager_id: string; revision: number; seed_json: string };
type IssuedRow = { career_id: string; club_id: string; decision_id: string; issued_json: string };
type ExecutionRow = { execution_id: string; career_id: string; club_id: string; decision_id: string;
  roster_revision: number; mood_revision: number | null; request_json: string; input_json: string; result_json: string };
type ObservationRow = { execution_id: string; career_id: string; manager_id: string; revision: number;
  request_json: string; source_json: string; before_json: string; result_json: string };
export type ManagerBeliefBoundary = Readonly<{
  version: 'manager_belief_boundary_v1'; careerId: string; managerId: string; revision: number; state: ManagerBeliefHistory;
  evidence: Readonly<{ seedClubId: string; seedDecisionId: string; seedHash: string; prefixHash: string; observationCount: number }>;
  hash: string;
}>;
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && Number(v) >= 0;
const same = (a: unknown, b: unknown) => json(a) === json(b);
const hash = (value: unknown) => createHash('sha256').update(json(value)).digest('hex');
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};
const corrupt = (detail: string): never => { throw new Error(`corrupt Manager belief boundary: ${detail}`); };
const parse = <T>(text: string, label: string): T => {
  const value = JSON.parse(text) as T;
  if (json(value) !== text) return corrupt(`${label} is not canonical`);
  return value;
};
const fields = (value: unknown, keys: readonly string[]) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

const issued = (db: Db, careerId: string, clubId: string, decisionId: string) => {
  const row = db.prepare('SELECT * FROM world_roster_opportunities WHERE career_id=? AND club_id=? AND decision_id=?')
    .get(careerId, clubId, decisionId) as IssuedRow | undefined;
  if (!row) return corrupt('original roster opportunity is missing');
  const value = parse<DurableRosterOpportunity>(row.issued_json, 'roster opportunity');
  const opportunity = parseOpportunity(value.opportunity), control = createHumanControlState(value.control);
  if (value.careerId !== careerId || value.clubId !== clubId || opportunity.decisionId !== decisionId
    || opportunity.clubId !== clubId || opportunity.domainId !== 'ROSTER' || !same(opportunity, value.opportunity)
    || !same(control, value.control) || value.bindings.length !== opportunity.legalActionIds.length
    || value.bindings.some((binding, i) => binding.actionId !== opportunity.legalActionIds[i])
    || !selectManagerControlledDecision(control, opportunity, value.selectionAgent, 'boundary-validation', value.candidateActionIds).ok) {
    return corrupt('original roster opportunity scope or Manager selection differs');
  }
  return { row, value };
};

/** Authenticate the original resolved roster command using its existing Core
 * dispatcher and immutable issued binding/event, on this same connection.
 * Mutable current roster/Manager heads are not substituted for the old input.
 */
const execution = (db: Db, executionId: string) => {
  const row = db.prepare('SELECT * FROM world_roster_executions WHERE execution_id=?').get(executionId) as ExecutionRow | undefined;
  if (!row) return corrupt('original roster execution is missing');
  const request = parse<RosterExecutionRequest>(row.request_json, 'roster request');
  const input = parse<SelectedManagerRosterDispatchInput>(row.input_json, 'roster input');
  const value = parse<DurableRosterExecution>(row.result_json, 'roster result');
  const replay = dispatchSelectedManagerRosterDecision(input);
  const original = issued(db, row.career_id, row.club_id, row.decision_id);
  // Bind the historical Mood BEFORE and AFTER to the original request/resolved
  // evidence. Today's Mood head may legitimately have advanced since this action.
  if (request.expectedMoodRevision !== null && !revision(request.expectedMoodRevision)
    || (request.moodContext === undefined) !== (input.moodContext === undefined)) return corrupt('historical Mood request or resolved context differs');
  if (input.moodContext !== undefined) {
    const { mood: beforeMood, ...acceptedContext } = input.moodContext;
    const afterMood = replay.mood?.mood?.state ?? beforeMood;
    if (!revision(beforeMood.revision) || request.expectedMoodRevision !== beforeMood.revision
      || !same(acceptedContext, request.moodContext) || replay.mood === null
      || !revision(afterMood.revision) || row.mood_revision !== afterMood.revision) return corrupt('historical Mood request, resolved or result revision differs');
  } else if (replay.mood !== null || request.expectedMoodRevision !== row.mood_revision) {
    return corrupt('historical unchanged Mood owner revision differs');
  }
  const event = db.prepare('SELECT * FROM world_decision_revision_events WHERE career_id=? AND world_revision=?')
    .get(row.career_id, value.result.execution.worldRevision);
  // These current rows are an integrity envelope only. They never enter the
  // historical input or its immutable digest, so later valid writes preserve it.
  const world = db.prepare('SELECT world_revision,control_revision,control_json FROM world_control_heads WHERE career_id=?').get(row.career_id);
  const extent = db.prepare('SELECT count(*) AS n,min(world_revision) AS first,max(world_revision) AS last FROM world_decision_revision_events WHERE career_id=?').get(row.career_id);
  const roster = db.prepare('SELECT revision,roster_json FROM world_roster_heads WHERE career_id=?').get(row.career_id);
  const mood = db.prepare('SELECT mood_revision,mood_json FROM world_roster_mood_heads WHERE career_id=? AND club_id=?').get(row.career_id, row.club_id);
  if (typeof world?.control_json !== 'string') return corrupt('roster World owner is missing');
  const currentControl = createHumanControlState(JSON.parse(world.control_json));
  if (!revision(world.world_revision) || world.world_revision < value.result.execution.worldRevision
    || world.control_revision !== currentControl.revision || world.control_json !== JSON.stringify(currentControl)
    || extent?.n !== world.world_revision || extent.first !== 1 || extent.last !== world.world_revision
    || !revision(roster?.revision) || Number(roster?.revision) < row.roster_revision || !mood
    || (row.mood_revision === null) !== (mood.mood_revision === null)
    || row.mood_revision !== null && (!revision(mood.mood_revision) || Number(mood.mood_revision) < row.mood_revision)
    || roster?.revision === row.roster_revision && roster.roster_json !== json(value.result.roster)
    || value.result.mood?.mood?.state !== undefined && mood.mood_revision === row.mood_revision
      && mood.mood_json !== json(value.result.mood.mood.state)) return corrupt('roster current owner extent differs');
  if (row.execution_id !== executionId || request.executionId !== executionId || value.executionId !== executionId
    || request.careerId !== row.career_id || request.clubId !== row.club_id
    || value.careerId !== row.career_id || value.clubId !== row.club_id || value.rosterRevision !== row.roster_revision
    || value.moodRevision !== row.mood_revision || !revision(row.roster_revision)
    || value.result.roster.revision !== row.roster_revision || value.result.execution.executionId !== executionId
    || value.result.rosterEvent.causeEventId !== executionId || !same(replay, value.result)
    || request.selection.decision.decisionId !== row.decision_id || input.opportunity.decisionId !== row.decision_id
    || request.expectedClubRevision !== original.value.clubRevision || input.clubAtAction.revision !== request.expectedClubRevision
    || request.expectedRosterRevision !== original.value.rosterRevision
    || request.clubAsOfDay !== original.value.clubAsOfDay || !same(request.control, original.value.control)
    || !same(request.opportunity, original.value.opportunity) || !same(request.selectionAgent, original.value.selectionAgent)
    || !same(request.candidateActionIds ?? null, original.value.candidateActionIds ?? null)
    || !same(request.binding, original.value.bindings.find(b => b.actionId === request.binding.actionId))
    || !same(input.control, request.control) || !same(input.opportunity, request.opportunity)
    || !same(input.selection, request.selection) || !same(input.selectionAgent, request.selectionAgent)
    || !same(input.candidateActionIds ?? null, request.candidateActionIds ?? null) || !same(input.binding, request.binding)
    || input.clubAsOfDay !== request.clubAsOfDay || input.currentWorldRevision !== request.currentWorldRevision
    || input.afterWorldRevision !== request.afterWorldRevision || input.executionId !== request.executionId
    || input.afterWorldRevision !== input.currentWorldRevision + 1
    || event?.source_kind !== 'MANAGER_ROSTER' || event.source_event_id !== value.result.rosterEvent.eventId
    || event.event_json !== json({ executionId, rosterEvent: value.result.rosterEvent })) {
    return corrupt('original roster execution, binding or World event differs');
  }
  return { value, proof: { row, issued: original.row, event } };
};
const observation = (source: DurableRosterExecution): ManagerExecutionObservation => {
  const evidence = source.result.projection.managerSelfChosenEvidence;
  if (!evidence || evidence.eventIds.length !== 1 || evidence.eventIds[0] !== source.result.rosterEvent.eventId
    || evidence.executionId !== source.executionId) return corrupt('roster execution lacks Manager self-chosen evidence');
  return { executionId: source.executionId, sourceEventId: source.result.rosterEvent.eventId,
    careerId: source.careerId, clubId: source.clubId, managerId: evidence.managerId, appointmentId: evidence.appointmentId,
    decisionId: evidence.decisionId, actionId: evidence.actionId, observedAtDay: source.result.rosterEvent.effectiveDay };
};

/** No writes, new connection, policy defaults or observation generation.
 * Only the selected earlier prefix is replayed. Its digest keeps consumer proof
 * size bounded without treating a stored hash as a substitute for replay.
 */
const readManagerBeliefBoundaryUncached = (db: Db, careerId: string, managerId: string, requestedRevision: number, practiceReader?: PracticeOrderExecutionReader): ManagerBeliefBoundary | null => {
  if (!id(careerId) || !id(managerId) || !revision(requestedRevision)) throw new Error('invalid Manager belief boundary scope or revision');
  if (!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='world_manager_person_heads'").get()) return null;
  const head = db.prepare('SELECT career_id,manager_id,revision,seed_json FROM world_manager_person_heads WHERE career_id=? AND manager_id=?')
    .get(careerId, managerId) as Head | undefined;
  if (!head) return null;
  if (!revision(head.revision) || requestedRevision > head.revision) throw new Error('Manager belief revision is unavailable');
  try {
    const seed = parse<Seed>(head.seed_json, 'Manager seed');
    if (!fields(seed, ['careerId', 'clubId', 'decisionId', 'opportunity', 'policy', 'agent'])
      || seed.careerId !== careerId || !id(seed.clubId) || !id(seed.decisionId)) return corrupt('seed scope differs');
    const original = issued(db, careerId, seed.clubId, seed.decisionId);
    const originalState = createManagerBeliefHistory(careerId, managerId, original.value.selectionAgent.state, seed.policy);
    let state = createManagerBeliefHistory(careerId, managerId, seed.agent, seed.policy);
    if (original.value.selectionAgent.managerId !== managerId || original.value.opportunity.managerId !== managerId
      || !same(seed.opportunity, original.value.opportunity) || !same(state, originalState)
      || !same(state.agent, seed.agent) || !same(state.policy, seed.policy)) return corrupt('seed differs from original issued Manager belief');
    const seedHash = hash({ careerId, managerId, seedJson: head.seed_json, issued: original.row });
    let prefixHash = seedHash;
    const rows = db.prepare(`SELECT * FROM world_manager_belief_observations
      WHERE career_id=? AND manager_id=? AND revision<=? ORDER BY revision`).all(careerId, managerId, requestedRevision) as ObservationRow[];
    if (rows.length !== requestedRevision) return corrupt('observation prefix is incomplete');
    for (const row of rows) {
      const request = parse<{ careerId: string; managerId: string; expectedRevision: number; executionId: string; kind?: unknown }>(row.request_json, 'Manager observation request');
      const before = parse<ManagerBeliefHistory>(row.before_json, 'Manager observation BEFORE');
      const savedSource = parse<DurableRosterExecution | ManagerPracticeObservationSource>(row.source_json, 'Manager observation source');
      const isPractice = Object.hasOwn(request, 'kind');
      if (isPractice && request.kind !== MANAGER_PRACTICE_OBSERVATION_KIND
        || Object.hasOwn(savedSource, 'kind') !== isPractice) return corrupt('observation source kind differs');
      const saved = parse<unknown>(row.result_json, 'Manager observation result');
      if (!fields(request, ['careerId', 'managerId', 'expectedRevision', 'executionId', ...(isPractice ? ['kind'] : [])]) || !id(row.execution_id)
        || row.career_id !== careerId || row.manager_id !== managerId || row.revision !== state.revision + 1
        || request.careerId !== careerId || request.managerId !== managerId || request.executionId !== row.execution_id
        || request.expectedRevision !== state.revision || !same(before, state)) return corrupt('observation BEFORE or revision chain differs');
      let actualObservation: ManagerExecutionObservation;
      let sourceProof: unknown;
      if (isPractice) {
        if (!practiceReader) throw new Error('Manager practice observation requires its genuine practice order reader');
        const actual = practiceReader(db, row.execution_id, { careerId, managerId, revision: row.revision });
        const source = actual ? { kind: MANAGER_PRACTICE_OBSERVATION_KIND, order: actual.order } : null;
        if (!source || !same(source, savedSource)) return corrupt('practice observation original execution source differs');
        actualObservation = managerPracticeExecutionObservation(source); sourceProof = actual!.proof;
      } else {
        const source = execution(db, row.execution_id);
        if (!same(source.value, savedSource)) return corrupt('observation original execution source differs');
        actualObservation = observation(source.value); sourceProof = source.proof;
      }
      const next = applyManagerExecutionObservation(state, state.revision, actualObservation);
      const expected = { executionId: row.execution_id, careerId, managerId, revision: next.revision,
        event: next.recent.at(-1), state: next };
      if (!same(saved, expected)) return corrupt('observation result differs from replay');
      prefixHash = hash({ prior: prefixHash, observation: row, source: sourceProof });
      state = next;
    }
    if (state.revision !== requestedRevision) return corrupt('selected revision was not reached');
    if (requestedRevision === head.revision) {
      const current = db.prepare('SELECT state_json FROM world_manager_person_heads WHERE career_id=? AND manager_id=?').get(careerId, managerId);
      if (current?.state_json !== json(state)) return corrupt('current Manager state differs from its replayed prefix');
    }
    const value = { version: 'manager_belief_boundary_v1' as const, careerId, managerId, revision: requestedRevision, state,
      evidence: { seedClubId: seed.clubId, seedDecisionId: seed.decisionId, seedHash, prefixHash, observationCount: rows.length } };
    return freeze({ ...value, hash: hash(value) });
  } catch (cause) {
    throw new Error('corrupt Manager belief boundary source or prefix', { cause });
  }
};

// Reuse the existing guarded, operation-local source traversal. A sequence of
// practice orders can refer to earlier Manager prefixes without replaying the
// same immutable ancestry exponentially. No result survives this root read.
const noPracticeReader = Object.freeze({});
const boundaryReaders = new WeakMap<Db, WeakMap<object, (careerId: string, managerId: string, revision: number) => ManagerBeliefBoundary | null>>();
const activeReads = new WeakSet<Db>();
export const readManagerBeliefBoundary = (db: Db, careerId: string, managerId: string, requestedRevision: number,
  practiceReader?: PracticeOrderExecutionReader): ManagerBeliefBoundary | null => {
  let readers = boundaryReaders.get(db);
  if (!readers) { readers = new WeakMap(); boundaryReaders.set(db, readers); }
  const identity = practiceReader ?? noPracticeReader;
  let reader = readers.get(identity);
  if (!reader) {
    reader = createCompetitionSourceReader((career: string, manager: string, selected: number) =>
      readManagerBeliefBoundaryUncached(db, career, manager, selected, practiceReader));
    readers.set(identity, reader);
  }
  if (activeReads.has(db)) return reader(careerId, managerId, requestedRevision);
  return withBattedVenueLegalReadSnapshot(db as DatabaseSync, () => withCompetitionSourceReadPhase(() => {
    activeReads.add(db);
    try { return reader!(careerId, managerId, requestedRevision); }
    finally { activeReads.delete(db); }
  }));
};

/** Historical reads retain their original prefix; a first writer must separately
 * demand currentness on its own connection before and after the consuming write.
 */
export const assertManagerBeliefBoundary = (db: Db, boundary: ManagerBeliefBoundary, mode: 'historical' | 'current', practiceReader?: PracticeOrderExecutionReader): void => {
  if (!['historical', 'current'].includes(mode) || !fields(boundary, ['version', 'careerId', 'managerId', 'revision', 'state', 'evidence', 'hash'])
    || boundary.version !== 'manager_belief_boundary_v1') throw new Error('invalid Manager belief consumer boundary');
  const actual = readManagerBeliefBoundary(db, boundary.careerId, boundary.managerId, boundary.revision, practiceReader);
  if (!actual || !same(actual, boundary)) throw new Error('Manager belief boundary original source evidence differs');
  if (mode === 'current') {
    const head = db.prepare('SELECT revision,state_json FROM world_manager_person_heads WHERE career_id=? AND manager_id=?')
      .get(boundary.careerId, boundary.managerId);
    const extent = db.prepare('SELECT count(*) AS n,max(revision) AS last FROM world_manager_belief_observations WHERE career_id=? AND manager_id=?')
      .get(boundary.careerId, boundary.managerId);
    if (head?.revision !== boundary.revision || head.state_json !== json(boundary.state) || extent?.n !== boundary.revision
      || (boundary.revision === 0 ? extent.last !== null : extent.last !== boundary.revision)) throw new Error('stale or inconsistent current Manager belief revision');
  }
};
