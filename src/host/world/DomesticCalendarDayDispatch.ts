import { isDeepStrictEqual as equal } from 'node:util';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { applyScheduleRevisions } from '../../core/world/competition/LeagueSchedule';
import { readDomesticFixtureFromWorld } from '../RegisterDomesticFixture';
import { prepareDomesticOpeningMatch, resumeDomesticGameSettlement, resumeFoulDomesticGameSettlement,
  type DomesticOpeningMatchInput, type DomesticSeasonStores, type PreparedDomesticMatch } from './DomesticSeasonRuntime';
import type { DomesticCareerDay, DomesticMarketTriggerReference } from './SqliteDomesticScheduleStore';
import { AcceptedRecruitmentSourceMissingError, type SqliteRecruitmentEvidenceStore,
  type DurableRecruitmentDecision } from './SqliteRecruitmentEvidenceStore';
import type { AcceptedRecruitmentContractRequest, DurableFreeAgentContract, SqliteFreeAgentContractStore } from './SqliteFreeAgentContractStore';
import { issueManagerRosterOpportunityFromBelief, type ManagerRosterOpportunityFromBeliefInput } from './ManagerRosterOpportunityFromBelief';
import type { DurableRosterExecution, DurableRosterOpportunity, RosterExecutionRequest, SqliteManagerRosterDecisionStore } from './SqliteManagerRosterDecisionStore';
import type { SqliteManagerBeliefHistoryStore } from './SqliteManagerBeliefHistoryStore';
import type { SqliteOfficialWorldSettlementOutbox } from './SqliteOfficialWorldSettlementOutbox';
import type { SqliteMatchdayAttendanceStore } from './SqliteMatchdayAttendanceStore';
import type { FoulTerminalWorldSettlementStores } from './FoulTerminalWorldSettlementDriver';
import type { CompletedGameOutcomeStores } from './CompletedGamePlayerOutcomeDelivery';

export type DomesticCalendarDayInput = Readonly<{
  careerId: string; day: number;
  /** Required once multiple original season calendars are registered. */
  seasonId?: string;
  openings: readonly DomesticOpeningMatchInput[];
  market: readonly Readonly<{ sourceId: string; expectedRevision: number; decisionDay: number; origin: DomesticMarketTriggerReference;
    contract?: Omit<AcceptedRecruitmentContractRequest, 'recruitmentReference'> }>[];
  roster: readonly Readonly<{ opportunity: ManagerRosterOpportunityFromBeliefInput; managerBeliefRevision: number;
    execution?: RosterExecutionRequest }>[];
}>;
export type DomesticCalendarDayStores = DomesticSeasonStores & CompletedGameOutcomeStores & Readonly<{
  recruitment?: SqliteRecruitmentEvidenceStore; contracts?: SqliteFreeAgentContractStore;
  roster?: SqliteManagerRosterDecisionStore; belief?: SqliteManagerBeliefHistoryStore;
  outbox?: SqliteOfficialWorldSettlementOutbox; attendance?: SqliteMatchdayAttendanceStore;
  foulTerminal?: FoulTerminalWorldSettlementStores['foulTerminal'];
}>;
type DayItem<T = unknown> = Readonly<{ id: string; status: 'APPLIED' | 'MISSING_INPUT' | 'INCOMPLETE' | 'REJECTED';
  reason?: string; result?: T }>;
export type DomesticCalendarDayDispatch = Readonly<{
  calendar: DomesticCareerDay;
  games: readonly DayItem<PreparedDomesticMatch>[];
  settlements: readonly DayItem[];
  market: readonly DayItem<Readonly<{ decision: DurableRecruitmentDecision; contract?: DurableFreeAgentContract }>>[];
  roster: readonly DayItem<Readonly<{ opportunity: DurableRosterOpportunity; execution?: DurableRosterExecution }>>[];
  outstanding: readonly DayItem[];
}>;
const missing = (id: string, reason: string): DayItem<never> => ({ id, status: 'MISSING_INPUT', reason });
const rejected = (id: string, error: unknown): DayItem<never> => ({ id, status: 'REJECTED', reason: error instanceof Error ? error.message : String(error) });
const id = (v: unknown): v is string => typeof v === 'string' && !!v && v.trim() === v;
const revision = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;

/** Execute an explicitly accepted day against the existing durable owners.
 * There is deliberately no day-completed flag: absent commands, unfinished Match
 * execution and retained outcome obligations remain visible to the caller. */
export const dispatchDomesticCalendarDay = (stores: DomesticCalendarDayStores, raw: DomesticCalendarDayInput): DomesticCalendarDayDispatch => {
  const input = cloneInert(raw);
  if (!input || !id(input.careerId) || !revision(input.day) || !Array.isArray(input.openings)
    || (input.seasonId !== undefined && !id(input.seasonId))
    || !Array.isArray(input.market) || !Array.isArray(input.roster)
    || !unique(input.openings.map(v => v.gameId)) || !unique(input.market.map(v => v.sourceId))
    || !unique(input.roster.map(v => JSON.stringify([v.opportunity.clubId, v.opportunity.decisionId])))
    || input.openings.some(v => v.careerId !== input.careerId)
    || input.market.some(v => !id(v.sourceId) || !revision(v.expectedRevision) || !revision(v.decisionDay) || v.decisionDay > input.day || v.origin.careerId !== input.careerId
      || v.origin.trigger.day > v.decisionDay || (v.contract && (v.contract.acceptance.careerId !== input.careerId
        || v.contract.acceptance.acceptedAtDay > input.day || v.contract.clubEvent.command.effectiveDay > input.day)))
    || input.roster.some(v => !revision(v.managerBeliefRevision) || v.opportunity.careerId !== input.careerId
      || v.opportunity.clubAsOfDay !== input.day || (v.execution && (v.execution.careerId !== input.careerId
        || v.execution.clubId !== v.opportunity.clubId || v.execution.clubAsOfDay !== input.day
        || v.execution.opportunity.decisionId !== v.opportunity.decisionId)))) {
    throw new Error('invalid accepted domestic calendar day input');
  }
  // Read the actual archive, never reinterpret a World decision revision as time.
  const calendar = stores.archive.readCareerDay(input.careerId, input.day, input.seasonId);
  const seasonId = calendar.seasonId;
  if (input.openings.some(opening => opening.seasonId !== seasonId)
    || input.market.some(task => task.origin.trigger.seasonId !== seasonId)) {
    throw new Error('domestic day command differs from its accepted season scope');
  }
  const outstanding: DayItem[] = calendar.missingScheduleSeasonIds.map(seasonId => missing(seasonId, 'ACCEPTED_DATED_SCHEDULE'));
  for (const season of calendar.seasons) if (season.eventsMissing) outstanding.push(missing(season.schedule.seasonId, 'ACCEPTED_SEASON_EVENT_PROFILE'));
  const due = calendar.seasons.flatMap(season => season.games.map(game => ({ seasonId: season.schedule.seasonId, game })));
  // A command for a moved game remains rejected and visible on partial retry.
  const games: DayItem<PreparedDomesticMatch>[] = input.openings.filter(opening => !due.some(v =>
    v.seasonId === opening.seasonId && v.game.gameId === opening.gameId)).map(opening =>
    rejected(opening.gameId, new Error('opening Match is not due on the accepted calendar day')));
  const authenticateGame = (seasonId: string, gameId: string, exactDay: boolean) => {
    if (seasonId !== calendar.seasonId) throw new Error('domestic game differs from the accepted season scope');
    const archive = stores.archive.read(input.careerId, seasonId);
    if (!archive) throw new Error('domestic day original schedule is missing');
    const game = applyScheduleRevisions(archive.baseSchedule, archive.revisions).games.find(v => v.gameId === gameId);
    if (!game || (exactDay ? game.day !== input.day : game.day > input.day)) throw new Error('domestic game differs from the current accepted calendar day');
    const fixture = readDomesticFixtureFromWorld(stores.world, stores.archive, stores.match, { careerId: input.careerId, seasonId, gameId });
    return { game, fixture };
  };
  for (const { seasonId, game } of due) {
    const gameId = game.gameId;
    try {
      const original = authenticateGame(seasonId, gameId, true);
      const opening = input.openings.find(v => v.gameId === gameId && v.seasonId === seasonId);
      let match = stores.match.getMatch(gameId), fixture = original.fixture;
      const worldFinal = stores.world.readSeason(input.careerId, seasonId)?.results.find(v => v.gameId === gameId);
      if (worldFinal && (!match?.finalResult || !fixture || !equal(worldFinal, match.finalResult))) {
        throw new Error('domestic World result lacks its authentic Match final');
      }
      if (!match || match.durableRevision === 0) {
        if (!opening && !match) { games.push(missing(gameId, 'OPENING_MATCH_INPUT')); continue; }
        if (opening) {
          // Re-read schedule and World immediately before the existing real write.
          authenticateGame(seasonId, gameId, true);
          const prepared = prepareDomesticOpeningMatch(stores, opening, input.day);
          match = prepared.match; fixture = prepared.fixture;
        }
      }
      if (!fixture || !match) throw new Error('domestic Match lacks its accepted fixture');
      if (opening && match.matchState.ruleProfileId !== opening.ruleProfileId) throw new Error('opening Match rules differ from the durable Match');
      const result = { fixture, match };
      const final = stores.world.readSeason(input.careerId, seasonId)?.results.find(v => v.gameId === gameId);
      if (final && (!match.finalResult || !equal(final, match.finalResult))) throw new Error('domestic World result differs from the actual Match final');
      games.push(final ? { id: gameId, status: 'APPLIED', result }
        : { id: gameId, status: 'INCOMPLETE', reason: match.finalResult ? 'WORLD_SETTLEMENT' : 'MATCH_EXECUTION', result });
    } catch (error) { games.push(rejected(gameId, error)); }
  }
  const settlements: DayItem[] = [];
  if (!stores.outbox) outstanding.push(missing(input.careerId, 'SETTLEMENT_OUTBOX_OWNER'));
  else {
    // Pending originals survive interruption independently of supplied commands.
    const pending = [...stores.outbox.listPending().map(entry => ({ kind: 'regular' as const, entry,
      careerId: entry.request.worldInput.attendance.careerId, seasonId: entry.request.finalInput.game.seasonId,
      gameId: entry.request.finalInput.matchId, day: Math.max(entry.request.worldInput.attendance.observedAtDay, entry.request.worldInput.finalizedAtDay) })),
    ...stores.outbox.completedTerminal.listPending().map(entry => ({ kind: 'terminal' as const, entry,
      careerId: entry.request.final.careerId, seasonId: entry.request.final.game.seasonId,
      gameId: entry.request.final.game.gameId, day: Math.max(entry.request.worldInput.attendance.observedAtDay, entry.request.worldInput.finalizedAtDay) }))];
    for (const item of pending.filter(v => v.careerId === input.careerId && v.seasonId === seasonId && v.day <= input.day)) {
      const key = item.entry.applicationId;
      try {
        if (!stores.attendance) { settlements.push(missing(key, 'ACCEPTED_ATTENDANCE_OWNER')); continue; }
        authenticateGame(item.seasonId, item.gameId, false);
        const common = { ...stores, outbox: stores.outbox, attendance: stores.attendance };
        if (item.kind === 'terminal' && !stores.foulTerminal) { settlements.push(missing(key, 'FOUL_TERMINAL_OWNER')); continue; }
        const result = item.kind === 'regular' ? resumeDomesticGameSettlement(common, key)
          : resumeFoulDomesticGameSettlement({ ...common, foulTerminal: stores.foulTerminal! }, key);
        const saved = item.kind === 'regular' ? stores.outbox.read(key) : stores.outbox.completedTerminal.read(key);
        if (!saved) throw new Error('domestic settlement receipt disappeared');
        settlements.push(saved.status === 'COMPLETED' ? { id: key, status: 'APPLIED', result }
          : { id: key, status: 'INCOMPLETE', reason: 'PLAYER_OUTCOME_DELIVERY', result });
      } catch (error) { settlements.push(rejected(key, error)); }
    }
  }
  const market: DomesticCalendarDayDispatch['market'][number][] = [];
  for (const task of input.market) {
    let decision: DurableRecruitmentDecision | undefined;
    try {
      const original = stores.archive.captureMarketTriggerReference(input.careerId, task.origin.trigger);
      if (!equal(original, task.origin)) throw new Error('accepted market origin differs from its original calendar snapshot');
      if (!stores.recruitment) { market.push(missing(task.sourceId, 'ACCEPTED_RECRUITMENT_OWNER')); continue; }
      decision = stores.recruitment.acceptDecision(task.sourceId, task.expectedRevision, { origin: task.origin, decisionDay: task.decisionDay });
      if (!task.contract) { market.push({ id: task.sourceId, status: 'APPLIED', result: { decision } }); continue; }
      if (!stores.contracts) { market.push({ id: task.sourceId, status: 'MISSING_INPUT', reason: 'FREE_AGENT_CONTRACT_OWNER', result: { decision } }); continue; }
      // The contract writer reauthenticates the decision and calendar on its own
      // Native transaction, including original-source checks on historical retry.
      const contract = stores.contracts.applyAcceptedDecision({ ...task.contract, recruitmentReference: decision.reference });
      market.push({ id: task.sourceId, status: 'APPLIED', result: { decision, contract } });
    } catch (error) { market.push(error instanceof AcceptedRecruitmentSourceMissingError
      ? missing(task.sourceId, 'ACCEPTED_RECRUITMENT_SOURCE')
      : { ...rejected(task.sourceId, error), ...(decision ? { result: { decision } } : {}) }); }
  }
  for (const season of calendar.seasons) for (const trigger of season.marketTriggers) {
    if (!input.market.some(task => equal(task.origin, trigger))) outstanding.push(missing(trigger.trigger.windowId, 'ACCEPTED_MARKET_DECISION_INPUT'));
  }
  const roster: DomesticCalendarDayDispatch['roster'][number][] = [];
  for (const task of input.roster) {
    const request: ManagerRosterOpportunityFromBeliefInput = task.opportunity, key = request.decisionId;
    let acceptedOpportunity: DurableRosterOpportunity | undefined;
    try {
      if (!stores.roster || !stores.belief) { roster.push(missing(key, 'MANAGER_ROSTER_AND_BELIEF_OWNERS')); continue; }
      const belief = stores.belief.readAtRevision(input.careerId, request.managerId, task.managerBeliefRevision);
      if (!belief) { roster.push(missing(key, 'ACCEPTED_MANAGER_BELIEF')); continue; }
      let opportunity = stores.roster.readOpportunity(input.careerId, request.clubId, key);
      if (opportunity) {
        const expected = { managerBeliefRevision: task.managerBeliefRevision, careerId: request.careerId, clubId: request.clubId, clubRevision: request.expectedClubRevision,
          rosterRevision: request.expectedRosterRevision, clubAsOfDay: request.clubAsOfDay, control: request.control,
          opportunity: { decisionId: request.decisionId, contextId: request.contextId, worldRevision: request.worldRevision,
            clubId: request.clubId, domainId: 'ROSTER', managerId: request.managerId, appointmentId: request.appointmentId,
            legalActionIds: request.candidates.map(v => v.actionId) },
          bindings: request.candidates, selectionAgent: { managerId: request.managerId, appointmentId: request.appointmentId, state: belief.agent },
          candidateActionIds: request.candidateActionIds ?? null };
        const actual = { managerBeliefRevision: opportunity.managerBeliefRevision, careerId: opportunity.careerId, clubId: opportunity.clubId, clubRevision: opportunity.clubRevision,
          rosterRevision: opportunity.rosterRevision, clubAsOfDay: opportunity.clubAsOfDay, control: opportunity.control,
          opportunity: opportunity.opportunity,
          bindings: opportunity.bindings, selectionAgent: opportunity.selectionAgent, candidateActionIds: opportunity.candidateActionIds ?? null };
        if (!equal(expected, actual)) throw new Error('accepted roster opportunity differs from its original day or belief');
      } else {
        if (stores.belief.readHead(input.careerId, request.managerId)?.revision !== task.managerBeliefRevision) throw new Error('stale accepted Manager belief revision');
        opportunity = issueManagerRosterOpportunityFromBelief(stores.roster, stores.belief, request, task.managerBeliefRevision);
      }
      acceptedOpportunity = opportunity;
      if (!task.execution) { roster.push({ id: key, status: 'INCOMPLETE', reason: 'ACCEPTED_ROSTER_EXECUTION_INPUT', result: { opportunity } }); continue; }
      if (!equal(task.execution.opportunity, opportunity.opportunity) || !equal(task.execution.control, opportunity.control)
        || !equal(task.execution.selectionAgent, opportunity.selectionAgent)) throw new Error('accepted roster execution differs from its original opportunity');
      const execution = stores.roster.apply(task.execution);
      roster.push({ id: key, status: 'APPLIED', result: { opportunity, execution } });
    } catch (error) { roster.push({ ...rejected(key, error), ...(acceptedOpportunity ? { result: { opportunity: acceptedOpportunity } } : {}) }); }
  }
  return Object.freeze({ calendar, games, settlements, market, roster,
    outstanding: [...outstanding, ...games, ...settlements, ...market, ...roster].filter(item => item.status !== 'APPLIED') });
};
