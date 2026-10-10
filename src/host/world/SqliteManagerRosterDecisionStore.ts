import { practiceOrderExecutionEvidenceFromOwner, type OwnedPracticeOrderMethods, type PracticeOrderExecutionReader } from './OwnedPitchPracticeOrder';
import type { DatabaseSync } from 'node:sqlite';
import { assertBodyCompositionNativeConnection } from './BodyMaterializationSqliteOwnership';
import { readNativePracticeOrderExecutionFromSqlite } from './NativePitchPracticeEvidenceFromSqlite';
import { createRequire } from 'node:module';
import { readState as readClubState } from
  '../../core/world/club/ClubSchemas';
import type { ClubWorldState } from '../../core/world/club/ClubTypes';
import { getCurrentClubManager } from '../../core/world/club/ClubEvents';
import { createHumanControlState, resolveDecisionAuthority } from
  '../../core/world/control/HumanControl';
import type { DecisionOpportunity, HumanControlState } from
  '../../core/world/control/ControlTypes';
import { dispatchSelectedManagerRosterDecision } from
  '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import type { SelectedManagerRosterDispatch,
  SelectedManagerRosterDispatchInput, LegalRosterActionBinding } from
  '../../core/world/manager/ExecutedRosterDecisionDispatcher';
import type { ManagerDecisionAgent } from
  '../../core/world/manager/ManagerControlledDecision';
import { selectManagerControlledDecision } from
  '../../core/world/manager/ManagerControlledDecision';
import { applyRosterChange } from '../../core/world/roster/RosterCommands';
import { createRosterState } from '../../core/world/roster/RosterState';
import type { RosterState, RosterTransitionEvent } from
  '../../core/world/roster/RosterTypes';
import type { ExecutedRosterDecisionMoodInput } from
  '../../core/world/team/ExecutedRosterDecisionMood';
import type { TeamMoodState } from '../../core/world/team/TeamMood';
import { canonicalRosterEvidenceJson as canonicalJson } from './RosterEvidenceJson';
import { assertCurrentMedicalRosterAction } from './SqlitePlayerHealthRehabStore';
import { assertManagerBeliefBoundary, readManagerBeliefBoundary } from './ManagerBeliefBoundary';

export type DurableRosterHead = Readonly<{
  careerId: string;
  clubId: string;
  roster: RosterState;
  mood: TeamMoodState | null;
}>;
export type InitializeRosterHead = DurableRosterHead;
export type IssueRosterOpportunityInput = Readonly<{
  careerId: string;
  clubId: string;
  expectedClubRevision: number;
  expectedRosterRevision: number;
  clubAsOfDay: number;
  control: HumanControlState;
  decisionId: string;
  contextId: string;
  /** Supplied by the world owner; no canonical global revision is inferred. */
  worldRevision: number;
  candidates: readonly LegalRosterActionBinding[];
  selectionAgent: ManagerDecisionAgent;
  /** Optional accepted original history identity; legacy receipts omit it. */
  managerBeliefRevision?: number;
  candidateActionIds?: readonly string[];
}>;
export type DurableRosterOpportunity = Readonly<{
  careerId: string;
  clubId: string;
  clubRevision: number;
  rosterRevision: number;
  clubAsOfDay: number;
  control: HumanControlState;
  opportunity: DecisionOpportunity;
  bindings: readonly LegalRosterActionBinding[];
  selectionAgent: ManagerDecisionAgent;
  /** Optional accepted original history identity; legacy receipts omit it. */
  managerBeliefRevision?: number;
  candidateActionIds?: readonly string[];
}>;
export type RosterExecutionRequest = Omit<
  SelectedManagerRosterDispatchInput,
  'clubAtAction' | 'roster' | 'moodContext'> & Readonly<{
    careerId: string;
    clubId: string;
    expectedClubRevision: number;
    expectedRosterRevision: number;
    expectedMoodRevision: number | null;
    moodContext?: Omit<ExecutedRosterDecisionMoodInput,
      'clubAtAction' | 'clubAsOfDay' | 'roster'
      | 'rosterCommand' | 'rosterEvent' | 'decision'
      | 'execution' | 'mood'>;
  }>;
export type IssuedRosterExecutionRequest = Readonly<{
  careerId: string; clubId: string; decisionId: string;
  traceId: string; executionId: string;
  /** Consequence evidence stays explicit; selection and administrative writes are derived. */
  moodContext?: RosterExecutionRequest['moodContext'];
}>;
export type DurableRosterExecution = Readonly<{
  executionId: string;
  careerId: string;
  clubId: string;
  rosterRevision: number;
  moodRevision: number | null;
  result: SelectedManagerRosterDispatch;
}>;
export type DurableDevelopmentRosterChange = Readonly<{
  before: RosterState;
  after: RosterState;
  event: RosterTransitionEvent;
}>;
export type SqliteManagerRosterDecisionStore = Readonly<{
  initialize(input: InitializeRosterHead): void;
  readHead(careerId: string, clubId: string): DurableRosterHead | null;
  issueOpportunity(input: IssueRosterOpportunityInput):
    DurableRosterOpportunity;
  readOpportunity(careerId: string, clubId: string,
    decisionId: string): DurableRosterOpportunity | null;
  readExecution(executionId: string): DurableRosterExecution | null;
  readDevelopmentRosterChange(executionId: string):
    DurableDevelopmentRosterChange | null;
  apply(request: RosterExecutionRequest): DurableRosterExecution;
  executeIssued(request: IssuedRosterExecutionRequest): DurableRosterExecution;
  close(): void;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const revision = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const moodMatchesRoster = (mood: TeamMoodState | null,
  roster: RosterState, clubId: string): boolean => mood === null
    || canonicalIds(mood.players.map((player) => player.playerId))
      === canonicalIds(roster.players.filter((player) =>
        player.assignment?.clubId === clubId)
        .map((player) => player.playerId));
const canonicalIds = (ids: string[]): string =>
  JSON.stringify([...ids].sort());
const frozenJson = <T>(json: string): T => {
  const freeze = (value: unknown): void => {
    if (value !== null && typeof value === 'object') {
      for (const child of Object.values(value)) freeze(child);
      Object.freeze(value);
    }
  };
  const value = JSON.parse(json) as T;
  freeze(value);
  return value;
};
type HeadRow = { revision: number; roster_json: string };
type MoodRow = { mood_revision: number | null;
  mood_json: string | null };
type ClubRow = { revision: number; state_json: string };
type WorldControlRow = { world_revision: number;
  control_revision: number; control_json: string };
type ExecutionRow = { career_id: string; club_id: string;
  decision_id: string; roster_revision: number;
  mood_revision: number | null; request_json: string;
  input_json: string; result_json: string };
type OpportunityRow = { issued_json: string };

/** A separate roster head shares the world DB without writing its club head. */
const createRosterOwner = (
  databasePath: string | DatabaseSync,
  practiceReader?: PracticeOrderExecutionReader,
): SqliteManagerRosterDecisionStore => {
  const sqlite: typeof import('node:sqlite') =
    createRequire(import.meta.url)('node:sqlite');
  const ownsConnection = typeof databasePath === 'string';
  if (ownsConnection ? !id(databasePath) : !(databasePath instanceof sqlite.DatabaseSync) || !databasePath.isTransaction) {
    throw new Error('invalid world database path or Native roster snapshot');
  }
  const db = typeof databasePath === 'string' ? new sqlite.DatabaseSync(databasePath) : databasePath;
  if (ownsConnection) {
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  const rosterColumns = db.prepare(`PRAGMA table_info(world_roster_heads)`)
    .all() as { name: string }[];
  if (rosterColumns.some((column) => column.name === 'club_id')) {
    db.close();
    throw new Error('legacy per-Club roster heads require explicit reconciliation');
  }
  db.exec(`CREATE TABLE IF NOT EXISTS world_roster_heads (
    career_id TEXT PRIMARY KEY,
    revision INTEGER NOT NULL, roster_json TEXT NOT NULL,
    CHECK (revision >= 0)
  );
  CREATE TABLE IF NOT EXISTS world_roster_mood_heads (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    mood_revision INTEGER, mood_json TEXT,
    PRIMARY KEY (career_id, club_id),
    CHECK ((mood_revision IS NULL) = (mood_json IS NULL))
  );
  CREATE TABLE IF NOT EXISTS world_roster_executions (
    execution_id TEXT PRIMARY KEY,
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    decision_id TEXT NOT NULL, roster_revision INTEGER NOT NULL,
    mood_revision INTEGER, request_json TEXT NOT NULL,
    input_json TEXT NOT NULL, result_json TEXT NOT NULL,
    UNIQUE (career_id, club_id, decision_id)
  );
  CREATE TABLE IF NOT EXISTS world_roster_opportunities (
    career_id TEXT NOT NULL, club_id TEXT NOT NULL,
    decision_id TEXT NOT NULL, issued_json TEXT NOT NULL,
    PRIMARY KEY (career_id, club_id, decision_id)
  );`);
  }
  const clubStatement = db.prepare(`SELECT revision, state_json
    FROM world_club_heads WHERE career_id=? AND club_id=?`);
  const headStatement = db.prepare(`SELECT revision, roster_json
    FROM world_roster_heads WHERE career_id=?`);
  const moodStatement = db.prepare(`SELECT mood_revision, mood_json
    FROM world_roster_mood_heads
    WHERE career_id=? AND club_id=?`);
  const executionStatement = db.prepare(`SELECT career_id, club_id,
    decision_id, roster_revision, mood_revision, request_json,
    input_json, result_json FROM world_roster_executions
    WHERE execution_id=?`);
  const opportunityStatement = db.prepare(`SELECT issued_json
    FROM world_roster_opportunities
    WHERE career_id=? AND club_id=? AND decision_id=?`);
  const clubRow = (careerId: string, clubId: string): ClubRow | null =>
    (clubStatement.get(careerId, clubId) as ClubRow | undefined) ?? null;
  const headRow = (careerId: string): HeadRow | null =>
    (headStatement.get(careerId) as HeadRow | undefined) ?? null;
  const moodRow = (careerId: string, clubId: string): MoodRow | null =>
    (moodStatement.get(careerId, clubId) as MoodRow | undefined) ?? null;
  const executionRow = (executionId: string): ExecutionRow | null =>
    (executionStatement.get(executionId) as ExecutionRow | undefined)
      ?? null;
  const opportunityRow = (careerId: string, clubId: string,
    decisionId: string): OpportunityRow | null =>
    (opportunityStatement.get(careerId, clubId,
      decisionId) as OpportunityRow | undefined) ?? null;
  const worldControlRow = (careerId: string): WorldControlRow => {
    const item = db.prepare(`SELECT world_revision, control_revision,
      control_json FROM world_control_heads WHERE career_id=?`)
      .get(careerId) as WorldControlRow | undefined;
    if (!item) throw new Error('durable world control head is absent');
    const control = createHumanControlState(
      JSON.parse(item.control_json));
    const events = db.prepare(`SELECT COUNT(*) AS count
      FROM world_decision_revision_events WHERE career_id=?`)
      .get(careerId) as { count: number };
    if (!revision(item.world_revision)
      || control.revision !== item.control_revision
      || JSON.stringify(control) !== item.control_json
      || events.count !== item.world_revision) {
      throw new Error('corrupt durable world control head');
    }
    return item;
  };
  const parsedOpportunity = (careerId: string, clubId: string,
    decisionId: string, row: OpportunityRow): DurableRosterOpportunity => {
    const issued = frozenJson<DurableRosterOpportunity>(row.issued_json);
    if (canonicalJson(issued) !== row.issued_json
      || issued.careerId !== careerId || issued.clubId !== clubId
      || issued.opportunity.decisionId !== decisionId
      || issued.opportunity.clubId !== clubId
      || issued.opportunity.domainId !== 'ROSTER'
      || issued.bindings.length !== issued.opportunity.legalActionIds.length
      || issued.bindings.some((binding, index) =>
        binding.actionId !== issued.opportunity.legalActionIds[index])) {
      throw new Error('corrupt issued roster opportunity');
    }
    if (issued.managerBeliefRevision !== undefined) {
      if (!revision(issued.managerBeliefRevision)) throw new Error('invalid issued Manager belief revision');
      const belief = readManagerBeliefBoundary(db, careerId, issued.selectionAgent.managerId, issued.managerBeliefRevision, practiceReader);
      if (!belief || canonicalJson(belief.state.agent) !== canonicalJson(issued.selectionAgent.state)) {
        throw new Error('issued opportunity differs from its original Manager belief');
      }
    }
    return issued;
  };
  const transaction = <T>(work: () => T): T => {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = work();
      db.exec('COMMIT');
      return result;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  };
  const parsedHead = (careerId: string, clubId: string,
    row: HeadRow, moodRecord: MoodRow): DurableRosterHead => {
    const roster = createRosterState(JSON.parse(row.roster_json));
    const mood = moodRecord.mood_json === null ? null
      : JSON.parse(moodRecord.mood_json) as TeamMoodState;
    if (roster.careerId !== careerId
      || roster.revision !== row.revision
      || canonicalJson(roster) !== row.roster_json
      || (mood === null) !== (moodRecord.mood_revision === null)
      || (mood !== null && (mood.careerId !== careerId
        || mood.clubId !== clubId || mood.revision
          !== moodRecord.mood_revision
        || mood.revision !== mood.events.length
        || canonicalJson(mood) !== moodRecord.mood_json))
      || !moodMatchesRoster(mood, roster, clubId)) {
      throw new Error('corrupt durable roster head');
    }
    return { careerId, clubId, roster, mood };
  };
  const parsedExecution = (executionId: string,
    row: ExecutionRow): DurableRosterExecution => {
    try {
      const request = JSON.parse(row.request_json) as
        RosterExecutionRequest;
      const resolved = JSON.parse(row.input_json) as
        SelectedManagerRosterDispatchInput;
      const result = JSON.parse(row.result_json) as
        DurableRosterExecution;
      const replay = dispatchSelectedManagerRosterDecision(resolved);
      const worldControl = worldControlRow(row.career_id);
      const worldEvent = db.prepare(`SELECT source_kind,
        source_event_id, event_json
        FROM world_decision_revision_events
        WHERE career_id=? AND world_revision=?`)
        .get(row.career_id,
          result.result.execution.worldRevision) as
          { source_kind: string; source_event_id: string;
            event_json: string } | undefined;
      const issuedRow = opportunityRow(row.career_id, row.club_id,
        row.decision_id);
      const issued = issuedRow ? parsedOpportunity(row.career_id,
        row.club_id, row.decision_id, issuedRow) : null;
      const current = headRow(row.career_id);
      const currentMood = moodRow(row.career_id, row.club_id);
      const head = current && currentMood ? parsedHead(row.career_id,
        row.club_id, current, currentMood) : null;
      if (!current || !currentMood || !id(executionId)
        || !issued
        || !revision(row.roster_revision)
        || canonicalJson(request) !== row.request_json
        || canonicalJson(resolved) !== row.input_json
        || canonicalJson(result) !== row.result_json
        || canonicalJson(replay) !== canonicalJson(result.result)
        || worldControl.world_revision
          < result.result.execution.worldRevision
        || worldEvent?.source_kind !== 'MANAGER_ROSTER'
        || worldEvent.source_event_id
          !== result.result.rosterEvent.eventId
        || worldEvent.event_json !== canonicalJson({
          executionId, rosterEvent: result.result.rosterEvent })
        || result.executionId !== executionId
        || result.careerId !== row.career_id
        || result.clubId !== row.club_id
        || result.rosterRevision !== row.roster_revision
        || result.moodRevision !== row.mood_revision
        || result.result.roster.revision !== row.roster_revision
        || result.result.execution.executionId !== executionId
        || result.result.rosterEvent.causeEventId !== executionId
        || request.executionId !== executionId
        || request.selection.decision.decisionId !== row.decision_id
        || request.expectedClubRevision !== issued.clubRevision
        || request.expectedRosterRevision !== issued.rosterRevision
        || request.clubAsOfDay !== issued.clubAsOfDay
        || canonicalJson(request.control)
          !== canonicalJson(issued.control)
        || canonicalJson(request.opportunity)
          !== canonicalJson(issued.opportunity)
        || canonicalJson(request.selectionAgent)
          !== canonicalJson(issued.selectionAgent)
        || canonicalJson(request.candidateActionIds ?? null)
          !== canonicalJson(issued.candidateActionIds ?? null)
        || canonicalJson(request.binding)
          !== canonicalJson(issued.bindings.find((binding) =>
            binding.actionId === request.binding.actionId))
        || row.roster_revision > current.revision
        || (row.mood_revision === null) !== (head?.mood === null)
        || (row.mood_revision !== null && (head?.mood?.revision
          ?? -1) < row.mood_revision)
        || (result.result.mood?.mood?.state !== undefined
          && (result.result.mood.mood.state.revision
            !== row.mood_revision
            || (current.revision === row.roster_revision
              && canonicalJson(result.result.mood.mood.state)
                !== currentMood.mood_json)))
        || (current.revision === row.roster_revision
          && canonicalJson(result.result.roster)
            !== current.roster_json)) {
        throw new Error('roster execution row mismatch');
      }
      return result;
    } catch (cause) {
      throw new Error('corrupt durable roster execution', { cause });
    }
  };
  const api: SqliteManagerRosterDecisionStore = Object.freeze({
    initialize(input: InitializeRosterHead): void {
      if (!input || !id(input.careerId) || !id(input.clubId)) {
        throw new Error('invalid roster head initialization');
      }
      const roster = createRosterState(input.roster);
      const rosterJson = canonicalJson(roster);
      const moodJson = input.mood === null ? null
        : canonicalJson(input.mood);
      transaction(() => {
        const existingClub = clubRow(input.careerId, input.clubId);
        if (!existingClub) {
          throw new Error('world club head is not initialized');
        }
        const club = readClubState(JSON.parse(existingClub.state_json));
        if (club.revision !== existingClub.revision
          || canonicalJson(club) !== existingClub.state_json
          || club.identity.clubId !== input.clubId
          || roster.careerId !== club.careerId
          || !roster.profiles.some((profile) =>
            profile.season === club.season.plan.season)
          || (input.mood !== null && (input.mood.careerId
            !== club.careerId || input.mood.clubId
              !== input.clubId || input.mood.season
                !== club.season.plan.season
              || input.mood.revision !== input.mood.events.length))
          || !moodMatchesRoster(input.mood, roster, input.clubId)) {
          throw new Error('roster head Club scope mismatch');
        }
        const prior = headRow(input.careerId);
        if (prior) {
          if (prior.revision !== roster.revision
            || prior.roster_json !== rosterJson) {
            throw new Error('roster head already initialized differently');
          }
        } else {
          db.prepare(`INSERT INTO world_roster_heads
            (career_id, revision, roster_json) VALUES (?, ?, ?)`)
            .run(input.careerId, roster.revision, rosterJson);
        }
        const priorMood = moodRow(input.careerId, input.clubId);
        if (priorMood) {
          if (priorMood.mood_json !== moodJson
            || priorMood.mood_revision
              !== (input.mood?.revision ?? null)) {
            throw new Error('Mood head already initialized differently');
          }
          return;
        }
        db.prepare(`INSERT INTO world_roster_mood_heads
          (career_id, club_id, mood_revision, mood_json)
          VALUES (?, ?, ?, ?)`).run(input.careerId,
            input.clubId, input.mood?.revision ?? null, moodJson);
      });
    },
    readHead(careerId: string, clubId: string): DurableRosterHead | null {
      if (!id(careerId) || !id(clubId)) {
        throw new Error('invalid roster head scope');
      }
      const row = headRow(careerId);
      const moodRecord = moodRow(careerId, clubId);
      return row && moodRecord
        ? parsedHead(careerId, clubId, row, moodRecord) : null;
    },
    issueOpportunity(input: IssueRosterOpportunityInput):
      DurableRosterOpportunity {
      if (!input || !id(input.careerId) || !id(input.clubId)
        || !id(input.decisionId) || !id(input.contextId)
        || !revision(input.expectedClubRevision)
        || !revision(input.expectedRosterRevision)
        || !revision(input.worldRevision)
        || !revision(input.clubAsOfDay)
        || !Array.isArray(input.candidates)
        || input.candidates.length === 0) {
        throw new Error('invalid roster opportunity request');
      }
      const managerBeliefRevision = input.managerBeliefRevision;
      if (managerBeliefRevision !== undefined && !revision(managerBeliefRevision)) throw new Error('invalid accepted Manager belief revision');
      return transaction(() => {
        const clubRecord = clubRow(input.careerId, input.clubId);
        const rosterRecord = headRow(input.careerId);
        const moodRecord = moodRow(input.careerId, input.clubId);
        if (!clubRecord || !rosterRecord || !moodRecord
          || clubRecord.revision !== input.expectedClubRevision
          || rosterRecord.revision !== input.expectedRosterRevision) {
          throw new Error('stale Club or roster opportunity source');
        }
        const club = readClubState(JSON.parse(clubRecord.state_json));
        const head = parsedHead(input.careerId, input.clubId,
          rosterRecord, moodRecord);
        const control = createHumanControlState(input.control);
        const worldControl = worldControlRow(input.careerId);
        if (JSON.stringify(control) !== worldControl.control_json) {
          throw new Error('caller control differs from durable control');
        }
        if (input.worldRevision !== worldControl.world_revision) {
          throw new Error('caller worldRevision differs from durable world revision');
        }
        const manager = getCurrentClubManager(club);
        if (club.revision !== clubRecord.revision
          || club.identity.clubId !== input.clubId
          || canonicalJson(club) !== clubRecord.state_json
          || !manager.ok || manager.value === null
          || club.season.closureRef !== null
          || club.effectiveDay > input.clubAsOfDay
          || head.roster.effectiveDay > input.clubAsOfDay
          || club.season.plan.startsOnDay > input.clubAsOfDay
          || !head.roster.profiles.some((profile) =>
            profile.season === club.season.plan.season)) {
          throw new Error('Club or manager is not current for opportunity');
        }
        const personTable = db.prepare(`SELECT 1 FROM sqlite_master
          WHERE type='table' AND name='world_manager_person_heads'`)
          .get();
        const personRow = personTable ? db.prepare(`SELECT revision,
          state_json FROM world_manager_person_heads
          WHERE career_id=? AND manager_id=?`)
          .get(input.careerId, manager.value.managerId) as
            { revision: number; state_json: string } | undefined
          : undefined;
        if (managerBeliefRevision !== undefined && personRow?.revision !== managerBeliefRevision) {
          throw new Error('stale accepted Manager belief revision');
        }
        const personBoundary = personRow ? readManagerBeliefBoundary(db,
          input.careerId, manager.value.managerId, personRow.revision, practiceReader) : null;
        if (personRow) {
          const person = JSON.parse(personRow.state_json) as {
            careerId: string; managerId: string; revision: number;
            agent: ManagerDecisionAgent['state'] };
          if (person.careerId !== input.careerId
            || person.managerId !== manager.value.managerId
            || person.revision !== personRow.revision
            || canonicalJson(person) !== personRow.state_json
            || canonicalJson(person.agent)
              !== canonicalJson(input.selectionAgent.state)) {
            throw new Error('caller Manager Person belief differs from durable head');
          }
          if (!personBoundary) throw new Error('Manager Person belief boundary is absent');
          assertManagerBeliefBoundary(db, personBoundary, 'current', practiceReader);
        } else {
          // Pre-history saves may have issued opportunities. A different
          // snapshot cannot become an implicit replacement Person seed.
          const priorIssued = db.prepare(`SELECT issued_json
            FROM world_roster_opportunities WHERE career_id=?`)
            .all(input.careerId) as { issued_json: string }[];
          for (const prior of priorIssued) {
            const previous = JSON.parse(prior.issued_json) as
              DurableRosterOpportunity;
            if (previous.selectionAgent.managerId
                === manager.value.managerId
              && canonicalJson(previous.selectionAgent.state)
                !== canonicalJson(input.selectionAgent.state)) {
              throw new Error('existing Manager belief snapshots require explicit reconciliation');
            }
          }
        }
        const actionIds = input.candidates.map((item) => item.actionId);
        if (new Set(actionIds).size !== actionIds.length
          || actionIds.some((actionId) => !id(actionId))) {
          throw new Error('invalid roster candidates');
        }
        const opportunity: DecisionOpportunity = {
          decisionId: input.decisionId,
          contextId: input.contextId,
          worldRevision: input.worldRevision,
          clubId: input.clubId, domainId: 'ROSTER',
          managerId: manager.value.managerId,
          appointmentId: manager.value.appointmentId,
          legalActionIds: actionIds,
        };
        const authority = resolveDecisionAuthority(control,
          opportunity);
        if (!authority.ok || authority.value.kind !== 'MANAGER') {
          throw new Error('manager authority unavailable');
        }
        if (input.selectionAgent.managerId !== manager.value.managerId
          || input.selectionAgent.appointmentId
            !== manager.value.appointmentId) {
          throw new Error('manager belief snapshot mismatch');
        }
        if (input.candidateActionIds !== undefined
          && (!Array.isArray(input.candidateActionIds)
            || input.candidateActionIds.length === 0
            || new Set(input.candidateActionIds).size
              !== input.candidateActionIds.length
            || input.candidateActionIds.some((actionId) =>
              !actionIds.includes(actionId)))) {
          throw new Error('invalid manager candidate subset');
        }
        const selectable = selectManagerControlledDecision(control,
          opportunity, input.selectionAgent,
          'opportunity-validation', input.candidateActionIds);
        if (!selectable.ok) {
          throw new Error('manager belief snapshot cannot select candidate');
        }
        for (const binding of input.candidates) {
          assertCurrentMedicalRosterAction(db, input.careerId, binding);
          if (binding.command.commandId !== binding.actionId
            || binding.command.expectedRevision
              !== head.roster.revision
            || binding.command.effectiveDay !== input.clubAsOfDay
            || binding.command.changes.some((change) => {
              const player = head.roster.players.find((item) =>
                item.playerId === change.playerId);
              return player !== undefined
                && (player.assignment?.clubId
                  ?? player.clubRights.rightsHolderClubId)
                  !== input.clubId;
            })) {
            throw new Error('invalid roster candidate binding');
          }
          const trial = applyRosterChange(head.roster, {
            ...binding.command,
            causeEventId: `opportunity/${input.decisionId}`,
          });
          if (!trial.ok) {
            throw new Error(`invalid roster candidate: ${trial.rejection.code}`);
          }
          if (!moodMatchesRoster(head.mood, trial.state,
            input.clubId)) {
            throw new Error('roster candidate lacks Mood membership transition');
          }
        }
        const issuedJson = canonicalJson({
          careerId: input.careerId, clubId: input.clubId,
          clubRevision: club.revision,
          rosterRevision: head.roster.revision,
          clubAsOfDay: input.clubAsOfDay,
          control, opportunity, bindings: input.candidates,
          selectionAgent: input.selectionAgent,
          ...(managerBeliefRevision === undefined ? {} : { managerBeliefRevision }),
          ...(input.candidateActionIds === undefined ? {}
            : { candidateActionIds: input.candidateActionIds }),
        });
        const prior = opportunityRow(input.careerId, input.clubId,
          input.decisionId);
        if (prior) {
          if (prior.issued_json !== issuedJson) {
            throw new Error('roster opportunity already issued differently');
          }
          return parsedOpportunity(input.careerId,
            input.clubId, input.decisionId, prior);
        }
        db.prepare(`INSERT INTO world_roster_opportunities
          (career_id, club_id, decision_id, issued_json)
          VALUES (?, ?, ?, ?)`).run(input.careerId,
          input.clubId, input.decisionId, issuedJson);
        for (const binding of input.candidates) assertCurrentMedicalRosterAction(db, input.careerId, binding);
        if (personBoundary) assertManagerBeliefBoundary(db, personBoundary, 'current', practiceReader);
        const saved = opportunityRow(input.careerId, input.clubId, input.decisionId);
        if (!saved || saved.issued_json !== issuedJson) throw new Error('issued roster opportunity changed during admission');
        return parsedOpportunity(input.careerId, input.clubId, input.decisionId, saved);
      });
    },
    readOpportunity(careerId: string, clubId: string,
      decisionId: string): DurableRosterOpportunity | null {
      if (!id(careerId) || !id(clubId) || !id(decisionId)) {
        throw new Error('invalid roster opportunity scope');
      }
      const row = opportunityRow(careerId, clubId, decisionId);
      return row ? parsedOpportunity(careerId, clubId,
        decisionId, row) : null;
    },
    readExecution(executionId: string): DurableRosterExecution | null {
      if (!id(executionId)) throw new Error('invalid executionId');
      const row = executionRow(executionId);
      return row ? parsedExecution(executionId, row) : null;
    },
    readDevelopmentRosterChange(executionId: string):
    DurableDevelopmentRosterChange | null {
      if (!id(executionId)) throw new Error('invalid executionId');
      const row = executionRow(executionId);
      if (!row) return null;
      const saved = parsedExecution(executionId, row);
      const input = JSON.parse(row.input_json) as
        SelectedManagerRosterDispatchInput;
      const before = createRosterState(input.roster);
      const after = createRosterState(saved.result.roster);
      const event = saved.result.rosterEvent;
      if (before.careerId !== saved.careerId
        || after.careerId !== saved.careerId
        || before.revision + 1 !== after.revision
        || event.beforeRevision !== before.revision
        || event.afterRevision !== after.revision) {
        throw new Error('development roster source revision mismatch');
      }
      return Object.freeze({ before, after, event });
    },
    executeIssued(raw: IssuedRosterExecutionRequest): DurableRosterExecution {
      const input = frozenJson<IssuedRosterExecutionRequest>(canonicalJson(raw));
      const fields = ['careerId', 'clubId', 'decisionId', 'traceId', 'executionId',
        ...(input && Object.hasOwn(input, 'moodContext') ? ['moodContext'] : [])];
      if (!input || Object.keys(input).length !== fields.length || fields.some(key => !Object.hasOwn(input, key))
        || ![input.careerId, input.clubId, input.decisionId, input.traceId, input.executionId].every(id)
        || (input.moodContext !== undefined && (input.moodContext === null || typeof input.moodContext !== 'object'))) {
        throw new Error('invalid issued roster execution');
      }
      const issued = api.readOpportunity(input.careerId, input.clubId, input.decisionId);
      if (!issued) throw new Error('issued roster opportunity is missing');
      const selection = selectManagerControlledDecision(issued.control, issued.opportunity,
        issued.selectionAgent, input.traceId, issued.candidateActionIds);
      if (!selection.ok) throw new Error(`issued roster selection failed: ${selection.reason.code}`);
      const binding = issued.bindings.find(candidate => candidate.actionId === selection.value.decision.actionId);
      if (!binding || issued.opportunity.worldRevision === Number.MAX_SAFE_INTEGER) {
        throw new Error('issued roster execution lacks a binding or next World revision');
      }
      const prior = executionRow(input.executionId);
      let expectedMoodRevision: number | null;
      if (prior) {
        // Reuse only authenticated original request evidence. A later mood or
        // Manager/control head cannot change an exact completed retry.
        parsedExecution(input.executionId, prior);
        expectedMoodRevision = (JSON.parse(prior.request_json) as RosterExecutionRequest).expectedMoodRevision;
      } else {
        const head = api.readHead(input.careerId, input.clubId);
        if (!head) throw new Error('issued roster execution lacks its current roster head');
        expectedMoodRevision = head.mood?.revision ?? null;
      }
      // The existing writer reauthenticates these originals and current CAS in
      // its own Native transaction. A race is rejected, never silently rebased.
      return api.apply({ careerId: input.careerId, clubId: input.clubId,
        expectedClubRevision: issued.clubRevision, expectedRosterRevision: issued.rosterRevision,
        expectedMoodRevision, control: issued.control, opportunity: issued.opportunity,
        selection: selection.value, selectionAgent: issued.selectionAgent, binding,
        ...(issued.candidateActionIds === undefined ? {} : { candidateActionIds: issued.candidateActionIds }),
        clubAsOfDay: issued.clubAsOfDay, currentWorldRevision: issued.opportunity.worldRevision,
        afterWorldRevision: issued.opportunity.worldRevision + 1, executionId: input.executionId,
        ...(input.moodContext === undefined ? {} : { moodContext: input.moodContext }) });
    },
    apply(request: RosterExecutionRequest): DurableRosterExecution {
      if (!request || !id(request.careerId)
        || !id(request.clubId) || !id(request.executionId)
        || !revision(request.expectedClubRevision)
        || !revision(request.expectedRosterRevision)
        || (request.expectedMoodRevision !== null
          && !revision(request.expectedMoodRevision))) {
        throw new Error('invalid roster execution request');
      }
      const requestJson = canonicalJson(request);
      return transaction(() => {
        const issuedRow = opportunityRow(request.careerId,
          request.clubId, request.selection.decision.decisionId);
        const issued = issuedRow ? parsedOpportunity(request.careerId,
          request.clubId, request.selection.decision.decisionId,
          issuedRow) : null;
        if (!issued
          || request.expectedClubRevision !== issued.clubRevision
          || request.expectedRosterRevision !== issued.rosterRevision
          || request.clubAsOfDay !== issued.clubAsOfDay
          || canonicalJson(request.control)
            !== canonicalJson(issued.control)
          || canonicalJson(request.opportunity)
            !== canonicalJson(issued.opportunity)
          || canonicalJson(request.selectionAgent)
            !== canonicalJson(issued.selectionAgent)
          || canonicalJson(request.candidateActionIds ?? null)
            !== canonicalJson(issued.candidateActionIds ?? null)
          || canonicalJson(request.binding)
            !== canonicalJson(issued.bindings.find((binding) =>
              binding.actionId === request.binding.actionId) ?? null)) {
          throw new Error('roster action does not match issued opportunity');
        }
        const prior = executionRow(request.executionId);
        if (prior) {
          const durable = parsedExecution(request.executionId, prior);
          if (prior.request_json !== requestJson) {
            throw new Error('executionId was used for different roster evidence');
          }
          return durable;
        }
        assertCurrentMedicalRosterAction(db, request.careerId, request.binding);
        const worldControl = worldControlRow(request.careerId);
        if (request.currentWorldRevision
            !== worldControl.world_revision
          || request.afterWorldRevision
            !== worldControl.world_revision + 1) {
          throw new Error('stale durable world revision');
        }
        if (JSON.stringify(createHumanControlState(request.control))
          !== worldControl.control_json) {
          throw new Error('stale durable control state');
        }
        const clubRecord = clubRow(request.careerId, request.clubId);
        const rosterRecord = headRow(request.careerId);
        const moodRecord = moodRow(request.careerId,
          request.clubId);
        if (!clubRecord || !rosterRecord || !moodRecord) {
          throw new Error('world Club or roster head is not initialized');
        }
        if (clubRecord.revision !== request.expectedClubRevision) {
          throw new Error('stale world club revision');
        }
        if (rosterRecord.revision !== request.expectedRosterRevision) {
          throw new Error('stale world roster revision');
        }
        if (moodRecord.mood_revision
          !== request.expectedMoodRevision) {
          throw new Error('stale world mood revision');
        }
        const club: ClubWorldState = readClubState(
          JSON.parse(clubRecord.state_json));
        if (club.revision !== clubRecord.revision
          || club.identity.clubId !== request.clubId
          || canonicalJson(club) !== clubRecord.state_json) {
          throw new Error('corrupt world Club head');
        }
        const head = parsedHead(request.careerId, request.clubId,
          rosterRecord, moodRecord);
        if (request.moodContext && head.mood === null) {
          throw new Error('world mood head is not initialized');
        }
        const resolved: SelectedManagerRosterDispatchInput = {
          control: request.control,
          opportunity: request.opportunity,
          selection: request.selection,
          selectionAgent: request.selectionAgent,
          ...(request.candidateActionIds === undefined ? {}
            : { candidateActionIds: request.candidateActionIds }),
          clubAtAction: club, clubAsOfDay: request.clubAsOfDay,
          roster: head.roster, binding: request.binding,
          currentWorldRevision: request.currentWorldRevision,
          afterWorldRevision: request.afterWorldRevision,
          executionId: request.executionId,
          ...(request.moodContext ? { moodContext: {
            ...request.moodContext, mood: head.mood!,
          } } : {}),
        };
        const result = dispatchSelectedManagerRosterDecision(resolved);
        const nextMood = result.mood?.mood?.state ?? head.mood;
        if (!moodMatchesRoster(nextMood, result.roster,
          request.clubId)) {
          throw new Error('roster membership has no Mood transition');
        }
        const durable: DurableRosterExecution = Object.freeze({
          executionId: request.executionId,
          careerId: request.careerId, clubId: request.clubId,
          rosterRevision: result.roster.revision,
          moodRevision: nextMood?.revision ?? null, result,
        });
        const rosterJson = canonicalJson(result.roster);
        const moodJson = nextMood === null ? null
          : canonicalJson(nextMood);
        const updated = db.prepare(`UPDATE world_roster_heads
          SET revision=?, roster_json=?
          WHERE career_id=? AND revision=? AND roster_json=?`)
          .run(result.roster.revision, rosterJson,
            request.careerId, request.expectedRosterRevision,
            rosterRecord.roster_json);
        const updatedMood = db.prepare(`UPDATE world_roster_mood_heads
          SET mood_revision=?, mood_json=?
          WHERE career_id=? AND club_id=?
            AND mood_revision IS ? AND mood_json IS ?`)
          .run(nextMood?.revision ?? null, moodJson,
            request.careerId, request.clubId,
            moodRecord.mood_revision, moodRecord.mood_json);
        if (updated.changes !== 1 || updatedMood.changes !== 1) {
          throw new Error('stale world roster revision');
        }
        const updatedWorld = db.prepare(`UPDATE world_control_heads
          SET world_revision=? WHERE career_id=?
            AND world_revision=? AND control_revision=?
            AND control_json=?`)
          .run(request.afterWorldRevision, request.careerId,
            request.currentWorldRevision,
            worldControl.control_revision,
            worldControl.control_json);
        if (updatedWorld.changes !== 1) {
          throw new Error('stale durable world revision');
        }
        db.prepare(`INSERT INTO world_decision_revision_events
          (career_id, world_revision, source_kind,
            source_event_id, event_json)
          VALUES (?, ?, 'MANAGER_ROSTER', ?, ?)`)
          .run(request.careerId, request.afterWorldRevision,
            result.rosterEvent.eventId,
            canonicalJson({ executionId: request.executionId,
              rosterEvent: result.rosterEvent }));
        db.prepare(`INSERT INTO world_roster_executions
          (execution_id, career_id, club_id, decision_id,
            roster_revision, mood_revision, request_json,
            input_json, result_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(request.executionId, request.careerId,
            request.clubId, request.selection.decision.decisionId,
            durable.rosterRevision, durable.moodRevision,
            requestJson, canonicalJson(resolved),
            canonicalJson(durable));
        assertCurrentMedicalRosterAction(db, request.careerId, request.binding);
        return durable;
      });
    },
    close(): void { if (ownsConnection) db.close(); },
  });
  return api;
};

export const openSqliteManagerRosterDecisionStore = (databasePath: string,
  practiceOwner?: Pick<OwnedPracticeOrderMethods, 'readOrder'>): SqliteManagerRosterDecisionStore =>
  createRosterOwner(databasePath, practiceOwner === undefined ? undefined : practiceOrderExecutionEvidenceFromOwner(practiceOwner));

/** Reuse the original roster decoder on its consumer's active Native snapshot,
 * without schema setup, writes, a second connection or a fabricated execution. */
export const managerRosterEvidenceFromSqlite = (db: DatabaseSync):
  Pick<SqliteManagerRosterDecisionStore, 'readDevelopmentRosterChange' | 'readExecution' | 'readOpportunity'> => {
  const owner = createRosterOwner(db, readNativePracticeOrderExecutionFromSqlite);
  const read = <T>(body: () => T): T => {
    if (!db.isTransaction) throw new Error('Native roster evidence requires an active transaction');
    assertBodyCompositionNativeConnection(db); return body();
  };
  return Object.freeze({
    readDevelopmentRosterChange: (id: string) => read(() => owner.readDevelopmentRosterChange(id)),
    readExecution: (id: string) => read(() => owner.readExecution(id)),
    readOpportunity: (careerId: string, clubId: string, decisionId: string) =>
      read(() => owner.readOpportunity(careerId, clubId, decisionId)),
  });
};
