import { existsSync } from 'node:fs';
import { expect } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert, advanceRuleProfileOfficialWindows, openRuleProfileOfficialStateWindow } from '../../core/adjudication/OfficialWindowPolicy';
import { createPlayAdjudicationLedger, recordCorrectRuleSnapshot, recordOnFieldCall, closeOfficialPlay,
  getOfficialPlayClosure, type PlayAdjudicationLedger } from '../../core/adjudication/PlayAdjudicationLedger';
import { derivePhysicalNonLiveClosure } from '../../core/adjudication/PhysicalNonLiveClosure';
import { deriveClosedNonLiveMatchState, confirmDurableClosedNonLiveStateApplication } from '../../core/adjudication/NonLiveOfficialApplication';
import { createCanonicalPlateAppearanceTimeline } from '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { resolveAndRecordPitchAgainstBatter } from '../../core/sim/pitching/PitchAgainstBatter';
import { NPB_2026_RULE_PROFILE, getRuleProfile } from '../../core/rules/RuleProfile';
import { resolveOfficialGameProgression, type GameCompletionPolicy } from '../../core/world/competition/OfficialGameCompletion';
import { match, worldSetup } from './OfficialParticipationPlayFixtures.test-support';
import type { FoulOfficialEndReference, FoulOfficialProjection, AcceptedFoulOfficialSession,
  AcceptedFoulOfficialEvent, AcceptedFoulOfficialIntent } from './ActualFoulOfficial';
import type { FoulEndedEvidence } from './ActualFoulPlayEnd';
import type { OriginalFoulEndFixture } from './ActualFoulPlayEndFixtures.test-support';

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
/** Fixed inputs, not an accepted Native fixture or a replacement model. All
 * Native/SQLite imports below are deferred until this pure gate succeeds. */
export const terminalFixtureManifest = freeze({
  version: 'foul-terminal-task1-fixture-v1',
  originalProfile: { ruleProfileId: NPB_2026_RULE_PROFILE.id }, rulesRevision: '2026',
  match: { ruleProfileId: NPB_2026_RULE_PROFILE.id, inning: 1, half: 'top' as const, outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 7 },
  gameId: 'game-1', durableRevision: 0, initialWorldSourceId: 'initial-world', activationApplicationId: null,
  careerId: 'career-a', seasonId: 'league-season-1', homeClubId: 'club-a', awayClubId: 'club-b', gameDay: 10,
  fixture: { gameId: 'game-1', venueId: 'venue-1', fixtureEventId: 'fixture-1', fixtureRevision: 0 },
  batter: { playerId: 'away-1', personId: 'person-away-1', clubId: 'club-b', side: 'AWAY' },
  defenders: ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].map((registeredPosition, i) => ({
    registeredPosition, playerId: i === 0 ? 'p2' : `home-${i}`, personId: i === 0 ? 'person-p2' : `person-home-${i}`,
    clubId: 'club-a', side: 'HOME',
  })),
  pitchIds: ['pitch-0', 'pitch-1', 'pitch-2'], progressRevision: 3,
  pitchPhysics: { velocity: { x: 3, y: 0, z: -30 } }, precedingTakenPitches: 2,
  officialPolicy: { sourceId: 'terminal-window-policy', sourceVersion: 'explicit-fixture-v1', ruleProfileId: 'npb-2026',
    officialWindows: { appeal: { available: true }, review: { available: false }, challenge: { available: false } } },
  legalGamePolicy: { version: 'fixture-v1', minimumInnings: 9, maximumInnings: 9, tiesAllowed: true },
  effortPolicy: { policyId: 'effort', version: 'v1', availableAtDay: 1, effortUnitsPerPhysicalPitch: 2 },
});

/** Compatibility only: synthetic pure pitch/call IDs never supply C/E, Native
 * official authority, a durable receipt, or acceptance credit. */
export const terminalFixtureCompatibility = () => {
  const m = terminalFixtureManifest, original = match(m.originalProfile), profile = getRuleProfile(original.ruleProfileId);
  expect(original).toEqual(m.match); expect(match().ruleProfileId).toBe('test-rules');
  expect(profile).toBe(NPB_2026_RULE_PROFILE); expect(profile.rulesRevision).toBe(m.rulesRevision);
  expect(Object.keys(original).sort()).toEqual(['ruleProfileId', 'inning', 'half', 'outs', 'balls', 'strikes', 'bases', 'score', 'playId'].sort());
  expect(worldSetup('p2').defenders.map(({ playerId, registeredPosition }) => ({ playerId, registeredPosition })))
    .toEqual(m.defenders.map(({ playerId, registeredPosition }) => ({ playerId, registeredPosition })));
  expect(new Set([m.batter, ...m.defenders].map(p => p.personId)).size).toBe(10);
  expect(new Set([m.batter, ...m.defenders].map(p => p.playerId)).size).toBe(10);
  expect(m.pitchIds[0]).not.toBe(m.pitchIds[2]); expect(m.activationApplicationId).toBeNull();
  expect(Object.keys(m.officialPolicy).sort()).toEqual(['sourceId', 'sourceVersion', 'ruleProfileId', 'officialWindows'].sort());
  expect(Object.keys(m.legalGamePolicy).sort()).toEqual(['version', 'minimumInnings', 'maximumInnings', 'tiesAllowed'].sort());
  expect(cloneInert(m)).toEqual(m);
  let timeline = createCanonicalPlateAppearanceTimeline(original, 0);
  for (let i = 0; i < 3; i++) {
    const tick = timeline.lastEventTick + 1;
    timeline = resolveAndRecordPitchAgainstBatter(timeline, { action: { kind: 'take' }, trajectory: {
      start: { tick, position: { x: 0, y: 1.5, z: 18 }, velocity: { x: 0, y: 0, z: -30 }, spin: { x: 0, y: 100, z: 0 } },
      acceleration: { x: 0, y: 0, z: 0 }, endTick: tick + 700_000, ticksPerSecond: 1_000_000 },
      plateZ: 0, strikeZone: { centerX: 0, halfWidth: 0.2, lowerY: 1.4, upperY: 1.6 }, ballRadiusMeters: 0.0366 }).timeline;
  }
  const tick = timeline.lastEventTick + 1, canonical = derivePhysicalNonLiveClosure({ match: original, timeline,
    batterRunnerId: null, gameDay: m.gameDay, effortPolicy: m.effortPolicy,
    snapshotId: 'compat-rule', ruleTick: tick, closureId: 'compat-close', closureTick: tick + 1 });
  const acceptedProfile = { ...profile, officialWindows: m.officialPolicy.officialWindows };
  expect(profile.officialWindows).toEqual({ appeal: { available: true } });
  let ledger = createPlayAdjudicationLedger({ playId: original.playId, ruleProfileId: original.ruleProfileId, playEnd: null });
  ledger = recordCorrectRuleSnapshot(ledger, ledger.revision, { eventId: 'compat-rule-event', tick,
    snapshotId: 'compat-rule', evidenceRevision: 1, ruling: { outsAfter: 1, basesAfter: original.bases, scoredRunnerIds: [] } });
  ledger = openRuleProfileOfficialStateWindow(ledger, ledger.revision, { profile: acceptedProfile,
    eventId: 'compat-open', tick, windowId: 'compat-appeal', windowKind: 'appeal' });
  ledger = recordOnFieldCall(ledger, ledger.revision, { eventId: 'compat-call:call', callId: 'compat-call', tick,
    basisSnapshotId: 'compat-rule', basisEvidenceRevision: 1, ruling: { outsAfter: 1, basesAfter: original.bases, scoredRunnerIds: [] } });
  ledger = advanceRuleProfileOfficialWindows(ledger, ledger.revision, { profile: acceptedProfile, boundary: 'next_play_fence',
    tick: tick + 1, eventIdPrefix: 'compat-fence', inningEnding: false });
  ledger = closeOfficialPlay(ledger, ledger.revision, { eventId: 'compat-close', closureId: 'compat-close', tick: tick + 1 });
  const context = { kind: 'strikeout' as const }, next = deriveClosedNonLiveMatchState({ match: original, timeline, adjudication: ledger, context });
  expect(next).toEqual(canonical.nextMatch); expect(next).toEqual({ ...original, playId: 8, outs: 1 });
  expect(getOfficialPlayClosure(ledger)!.finalRuling).toMatchObject({ source: 'on_field_call', basisCallId: 'compat-call' });
  const expectedReceipt = confirmDurableClosedNonLiveStateApplication({ match: original, timeline, adjudication: ledger, context,
    persistedMatchState: next, applicationId: 'compat-application', durableRevision: 1 });
  const progression = resolveOfficialGameProgression({ gameId: m.gameId, seasonId: m.seasonId, homeClubId: m.homeClubId,
    awayClubId: m.awayClubId, policy: m.legalGamePolicy, venueBinding: m.fixture, priorMatch: original, application: expectedReceipt });
  expect(progression).toEqual({ kind: 'GAME_CONTINUES', nextMatchState: next });
  return { original, profile: acceptedProfile, timeline, ledger, canonical, next, expectedReceipt };
};

export type TerminalSource = Readonly<{
  sourceId: string; sourceVersion: string; capability: 'actual_foul_terminal_non_live_application_v1';
  physicalEndReference: FoulOfficialEndReference;
  officialReference: Readonly<{ sessionSourceId: string; revision: number; headSourceId: string; headHash: string }>;
  applicationId: string; legalGamePolicy: GameCompletionPolicy | null;
}>;
export type TerminalProjection = Readonly<{
  kind: 'terminal_non_live_projected'; officialApplied: false; source: TerminalSource;
  physicalEndReference: FoulOfficialEndReference; consumptionReference: FoulOfficialProjection['consumptionReference'];
  officialReference: TerminalSource['officialReference']; officialObligation: FoulEndedEvidence['dispositionObligations']['official'];
  firstPhysicalPitchSourceId: string; physicalPitchSourceId: string; gameId: string; playId: number;
  originalOfficialLedgerHash: string; applicationLedgerHash: string; composedTimelineHash: string;
  assignmentSourceHash: string; intentSourceHash: string;
  applicationBody: Readonly<{ match: ReturnType<typeof match>; timeline: NonNullable<OriginalFoulEndFixture['count']['disposition']['timeline']>;
    adjudication: PlayAdjudicationLedger; context: Readonly<{ kind: 'strikeout' }>; expectedDurableRevision: number;
    applicationId: string; matchId: string }>;
  nextMatch: ReturnType<typeof match>; scoring: ReturnType<typeof derivePhysicalNonLiveClosure>['scoring'];
}>;
export type TerminalResult = TerminalProjection | Readonly<{ kind: 'pending'; source: TerminalSource; pendingReasons: readonly string[] }>;
export type TerminalDerive = (db: DatabaseSync, source: TerminalSource, freshness: 'current' | 'historical') => TerminalResult;
export const requireTerminalDerive = async (): Promise<TerminalDerive> => {
  const path = new URL('./ActualFoulTerminalApplicationEvidenceFromSqlite.ts', import.meta.url);
  const moduleId = './ActualFoulTerminalApplicationEvidenceFromSqlite';
  const module: { deriveFoulTerminalApplicationProposal?: TerminalDerive } = existsSync(path)
    ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.deriveFoulTerminalApplicationProposal,
    'TERMINAL_PROJECTION_API_MISSING_AFTER_GENUINE_FIXTURE').toBe('function');
  return module.deriveFoulTerminalApplicationProposal!;
};
export const requireTerminalParser = async () => {
  const path = new URL('./ActualFoulTerminalApplication.ts', import.meta.url);
  const moduleId = './ActualFoulTerminalApplication';
  const module: {
    actualFoulTerminalApplicationInput?: (raw: unknown, sourceId: string) => TerminalSource;
  } = existsSync(path) ? await import(/* @vite-ignore */ moduleId) : {};
  expect(typeof module.actualFoulTerminalApplicationInput,
    'TERMINAL_SOURCE_API_MISSING_AFTER_GENUINE_FIXTURE').toBe('function');
  return module.actualFoulTerminalApplicationInput!;
};

export type TerminalScenario = 'bunt' | 'ordinary_swing' | 'fair' | 'unowned_windows';
export const genuineTerminalFixture = async (path: string, scenario: TerminalScenario) => {
  terminalFixtureCompatibility();
  const { originalFoulEndFixture, assertOriginalFoulEndPrerequisites, foulEndLogicalBytes } = await import('./ActualFoulPlayEndFixtures.test-support');
  const { openSqliteActualFoulPlayEndStore, actualFoulEndArchiveEncoding, actualFoulClosedEvidenceFromSqlite } = await import('./SqliteActualFoulPlayEndStore');
  const { actualFoulRuleConsumptionEvidenceFromSqlite } = await import('./SqliteActualFoulRuleConsumptionStore');
  const { openSqliteActualFoulOfficialStore } = await import('./SqliteActualFoulOfficialStore');
  const { actorHash: hash, actorJson: json } = await import('./PhysicalPlateAppearanceActorEvidenceFromSqlite');
  const { readOriginalPhysicalPitchPrefixFromSqlite } = await import('./PhysicalPitchEvidenceFromSqlite');
  const x = originalFoulEndFixture(path, scenario === 'ordinary_swing' ? 'ordinary_swing' : 'bunt');
  try {
    assertOriginalFoulEndPrerequisites(x);
    const m = terminalFixtureManifest, frame = x.physical.frame, actor = frame.batterActor!;
    expect(frame.match).toEqual(m.match); expect(frame.officialRevision).toBe(m.durableRevision); expect(frame.activation).toBeNull();
    expect(frame.activationApplicationId).toBe(m.activationApplicationId);
    expect(frame.effortPolicy).toMatchObject(m.effortPolicy);
    expect(frame.initialWorld!.source.sourceId).toBe(m.initialWorldSourceId);
    expect(frame.initialWorld!.source.fixtureEventId).toBe(m.fixture.fixtureEventId);
    expect(x.f.db.prepare('SELECT game_id,venue_id,fixture_event_id,fixture_revision FROM official_fixtures WHERE game_id=?').get(m.gameId))
      .toEqual({ game_id: m.gameId, venue_id: m.fixture.venueId, fixture_event_id: m.fixture.fixtureEventId, fixture_revision: m.fixture.fixtureRevision });
    expect(actor.binding).toMatchObject({ ...m.batter, gameId: m.gameId, fixtureEventId: m.fixture.fixtureEventId,
      careerId: m.careerId, competitionEditionId: m.seasonId, gameDay: m.gameDay });
    expect(actor.worldFixture).toEqual({ careerId: m.careerId, competitionEditionId: m.seasonId,
      game: { gameId: m.gameId, homeClubId: m.homeClubId, awayClubId: m.awayClubId } });
    expect(frame.world.defenders.map(({ playerId, registeredPosition }) => ({ playerId, registeredPosition })))
      .toEqual(m.defenders.map(({ playerId, registeredPosition }) => ({ playerId, registeredPosition })));
    for (const defender of m.defenders) expect(actor.defenderBindings.find(b => b.playerId === defender.playerId))
      .toMatchObject({ playerId: defender.playerId, personId: defender.personId, clubId: defender.clubId, side: defender.side,
        gameId: m.gameId, fixtureEventId: m.fixture.fixtureEventId, competitionEditionId: m.seasonId, gameDay: m.gameDay });
    expect(new Set([actor.person, ...actor.defenderPersons].map(p => p.personId)).size).toBe(10);
    expect(readOriginalPhysicalPitchPrefixFromSqlite(x.f.db, x.physical.source.sourceId).map(p => p.source.sourceId)).toEqual(m.pitchIds);
    expect(x.physical.progressRevision).toBe(m.progressRevision);
    expect(x.count.firstPhysicalPitchSourceId).toBe(m.pitchIds[0]); expect(x.count.physicalPitchSourceId).toBe(m.pitchIds[2]);
    expect(x.policy.policySource.rulePolicy).toEqual({ version: 'untouched_settled_foul_dead_v1', ruleProfileId: 'npb-2026', rulesRevision: m.rulesRevision });
    const source = { sourceId: 'terminal-physical-end', sourceVersion: 'contract-v1', capability: 'actual_original_settled_foul_play_end_v1' as const,
      ruleConsumptionSourceId: x.count.source.sourceId, baseFieldSourceId: x.foul.last.source.sourceId, executionSourceId: x.endpoint.source.sourceId };
    const ends = x.f.track(openSqliteActualFoulPlayEndStore(path, { readAcceptedEnd: id => id === source.sourceId ? source : null }));
    const end = ends.accept(source.sourceId);
    expect(actualFoulClosedEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(end);
    expect(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).read(x.count.source.sourceId)).toEqual(x.count);
    const endReference: FoulOfficialEndReference = { owner: 'actual_foul_play_ends', sourceId: end.source.sourceId,
      sourceVersion: end.source.sourceVersion, sourceHash: hash(end.source), snapshotHash: actualFoulEndArchiveEncoding(end).hash };
    const sessions = new Map<string, unknown>(), events = new Map<string, unknown>(), intents = new Map<string, unknown>();
    const session: AcceptedFoulOfficialSession = { sourceId: 'terminal-official-session', sourceVersion: 'contract-v1',
      capability: 'actual_post_play_foul_official_session_v1', physicalEndReference: endReference,
      assignment: { sourceId: 'terminal-assignment', sourceVersion: 'explicit-fixture-v1', gameId: end.gameId, playId: end.playId,
        physicalPitchSourceId: end.physicalPitchSourceId, officialIds: ['umpire-1'], schedulerId: 'official-scheduler',
        clock: 'post_play_discrete_tick_v1', openingTrigger: 'sealed_foul_physical_end' },
      officialPolicy: scenario === 'unowned_windows' ? { ...m.officialPolicy, officialWindows: {
        appeal: { available: true }, review: { available: true, expiresAfterTicks: 1 }, challenge: { available: true, expiresAfterTicks: 1 } } } : m.officialPolicy };
    const official = x.f.track(openSqliteActualFoulOfficialStore(path, { readAcceptedSession: id => sessions.get(id) ?? null,
      readAcceptedEvent: id => events.get(id) ?? null, readAcceptedIntent: id => intents.get(id) ?? null }));
    // The missing-policy intake is deliberately not a terminal projection case:
    // its genuine producer writes no session, so there is no officialReference.
    sessions.set(session.sourceId, { ...session, officialPolicy: null });
    const beforeIntake = foulEndLogicalBytes(x.f.db), missingPolicy = official.acceptSession(session.sourceId);
    expect(missingPolicy).toMatchObject({ kind: 'intake_pending', pendingReasons: [
      'official_window_policy_unconfigured:review', 'official_window_policy_unconfigured:challenge'] });
    expect(foulEndLogicalBytes(x.f.db)).toBe(beforeIntake);
    sessions.set(session.sourceId, session);
    const opened = official.acceptSession(session.sourceId);
    if (opened.kind === 'intake_pending') throw new Error('genuine terminal fixture official session prerequisite failed');
    const append = (p: FoulOfficialProjection, name: string, action: AcceptedFoulOfficialEvent['action']) => {
      const s: AcceptedFoulOfficialEvent = { sourceId: name, sourceVersion: 'contract-v1', capability: 'actual_post_play_foul_official_event_v1',
        sessionSourceId: session.sourceId, expectedRevision: p.revision, parent: { sourceId: p.headSourceId, snapshotHash: p.headHash }, action };
      events.set(s.sourceId, s); return { source: s, value: official.acceptEvent(s.sourceId) };
    };
    const intent: AcceptedFoulOfficialIntent = { sourceId: 'terminal-call-intent', sourceVersion: 'contract-v1',
      capability: 'actual_post_play_foul_official_intent_v1', sessionSourceId: session.sourceId, gameId: end.gameId, playId: end.playId,
      physicalPitchSourceId: end.physicalPitchSourceId, assignmentSourceId: session.assignment.sourceId,
      officialId: 'umpire-1', judgment: scenario === 'fair' ? 'fair' : 'foul' };
    const beforeCall = foulEndLogicalBytes(x.f.db);
    expect(() => append(opened, 'invalid-early-fence', { kind: 'next_pitch_fence', schedulerId: session.assignment.schedulerId })).toThrow(/call/);
    expect(() => append(opened, 'terminal-record-call', { kind: 'record_call', intentSourceId: intent.sourceId })).toThrow(/intent/);
    for (const bad of [{ ...intent, officialId: 'unassigned' }, { ...intent, physicalPitchSourceId: 'foreign-pitch' }]) {
      intents.set(intent.sourceId, bad);
      expect(() => append(opened, 'terminal-record-call', { kind: 'record_call', intentSourceId: intent.sourceId })).toThrow(/scope|authority/);
    }
    expect(foulEndLogicalBytes(x.f.db)).toBe(beforeCall);
    intents.set(intent.sourceId, intent);
    const called = append(opened, 'terminal-record-call', { kind: 'record_call', intentSourceId: intent.sourceId });
    const beforeFence = foulEndLogicalBytes(x.f.db);
    expect(() => append(called.value, 'invalid-foreign-fence', { kind: 'next_pitch_fence', schedulerId: 'foreign-scheduler' })).toThrow(/scheduler/);
    expect(foulEndLogicalBytes(x.f.db)).toBe(beforeFence);
    const advanced = append(called.value, 'terminal-advance', { kind: 'advance_tick', schedulerId: session.assignment.schedulerId });
    const fenced = append(advanced.value, 'terminal-fence', { kind: 'next_pitch_fence', schedulerId: session.assignment.schedulerId });
    if (scenario === 'bunt') {
      expect(fenced.value).toMatchObject({ kind: 'terminal_foul_application_pending', handoff: null,
        pendingReasons: ['terminal_official_application_unimplemented'] });
      const call = fenced.value.ledger.events.find(e => e.kind === 'OnFieldCallRecorded');
      expect(call).toMatchObject({ eventId: called.source.sourceId + ':call', call: { callId: called.source.sourceId } });
    }
    const terminalSource = (p = fenced.value): TerminalSource => ({ sourceId: 'terminal-application', sourceVersion: 'contract-v1',
      capability: 'actual_foul_terminal_non_live_application_v1', physicalEndReference: endReference,
      officialReference: { sessionSourceId: session.sourceId, revision: p.revision, headSourceId: p.headSourceId, headHash: p.headHash },
      applicationId: 'terminal-match-application', legalGamePolicy: m.legalGamePolicy });
    const bytes = () => foulEndLogicalBytes(x.f.db);
    expect(x.inputArchiveBytes()).toBe(x.beforePhysicalBytes);
    expect(JSON.stringify(x.f.official.getMatch(m.gameId))).toBe(x.originalMatchBytes);
    return { x, end, endReference, session, intent, official, opened, called, advanced, fenced, append,
      terminalSource, hash, json, bytes, sources: { sessions, events, intents } };
  } catch (error) { x.f.close(); throw error; }
};
export type GenuineTerminalFixture = Awaited<ReturnType<typeof genuineTerminalFixture>>;

/** A genuine absent-intent C is an upstream pending result. No endpoint, E or
 * official journal is fabricated to make a terminal reference represent it. */
export const genuineAbsentIntentCount = async (path: string) => {
  terminalFixtureCompatibility();
  const { originalSettledFoulRuntimeFixture } = await import('./ActualSettledFoulStopFixtures.test-support');
  const { openSqliteActualSettledFoulStopProducerStore } = await import('./SqliteActualSettledFoulStopProducerStore');
  const { openSqliteActualFoulRuleConsumptionStore, actualFoulRuleConsumptionEvidenceFromSqlite } = await import('./SqliteActualFoulRuleConsumptionStore');
  const { foulEndLogicalBytes } = await import('./ActualFoulPlayEndFixtures.test-support');
  const m = terminalFixtureManifest, x = originalSettledFoulRuntimeFixture(path, {
    pitchPhysics: m.pitchPhysics, originalContact: { precedingTakenPitches: 2 },
  });
  try {
    expect(x.physical.frame.match).toEqual(m.match); expect(x.physical.progressRevision).toBe(3);
    expect(x.physical.source).not.toHaveProperty('battingIntent');
    const runtimeSource = { sourceId: 'unknown-intent-runtime', sourceVersion: 'contract-v1',
      capability: 'causal_original_settled_foul_end_runtime_v1', physicalPitchSourceId: x.physical.source.sourceId };
    x.runtimeSources.set(runtimeSource.sourceId, runtimeSource as never);
    const runtime = x.runtimes.accept(runtimeSource.sourceId), foul = x.advanceToFoul(), policy = x.acceptPolicy(foul.first);
    const stopSource = { sourceId: 'unknown-intent-stop', sourceVersion: 'contract-v1',
      capability: 'actual_original_settled_foul_stop_producer_v1' as const, physicalPitchSourceId: x.physical.source.sourceId,
      runtimeSourceId: runtime.source.sourceId, policySourceId: policy.policySource.sourceId,
      baseFieldSourceId: foul.last.source.sourceId, executionSourceId: null };
    const producer = x.f.track(openSqliteActualSettledFoulStopProducerStore(path, { readAcceptedProduction: id => id === stopSource.sourceId ? stopSource : null }));
    const production = producer.accept(stopSource.sourceId);
    const source = { sourceId: 'unknown-intent-count', sourceVersion: 'contract-v1',
      capability: 'actual_original_settled_foul_rule_consumption_v1' as const, runtimeSourceId: runtime.source.sourceId,
      stopProductionSourceId: production.source.sourceId };
    const counts = x.f.track(openSqliteActualFoulRuleConsumptionStore(path, { readAcceptedConsumption: id => id === source.sourceId ? source : null }));
    const count = counts.accept(source.sourceId), before = foulEndLogicalBytes(x.f.db);
    expect(actualFoulRuleConsumptionEvidenceFromSqlite(x.f.db).read(source.sourceId)).toEqual(count);
    expect(foulEndLogicalBytes(x.f.db)).toBe(before);
    return { x, count, bytes: () => foulEndLogicalBytes(x.f.db) };
  } catch (error) { x.f.close(); throw error; }
};
