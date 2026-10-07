import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { getOfficialPlayClosure } from '../../core/adjudication/PlayAdjudicationLedger';
import { deriveClosedNonLiveMatchState } from '../../core/adjudication/NonLiveOfficialApplication';
import { resolveOfficialGameProgression } from '../../core/world/competition/OfficialGameCompletion';
import { match } from './OfficialParticipationPlayFixtures.test-support';
import { terminalFixtureManifest as manifest, terminalFixtureCompatibility } from './ActualFoulTerminalApplicationFixtures.test-support';

// These seven cases import no SQLite owner and construct no Native fixture.
// Passing establishes compatibility only; it is not terminal qualification.
it('preflight pins registered npb-2026 and original play seven without changing the legacy profile default', () => {
  const p = terminalFixtureCompatibility();
  expect(p.original).toEqual(manifest.match); expect(p.profile.rulesRevision).toBe('2026');
  expect(match().ruleProfileId).toBe('test-rules');
  expect(() => match({ ruleProfileId: asRuleProfileId('unknown-terminal-profile') })).toThrow(/unsupported rule profile/);
  expect(() => match({ ...manifest.originalProfile, outs: 2 } as never)).toThrow(/invalid original fixture rule profile/);
});

it('preflight fixes the ten original actor identities roles season and fixture before Native construction', () => {
  terminalFixtureCompatibility();
  expect(manifest.batter.playerId).toBe('away-1');
  expect(manifest.defenders.map(d => d.playerId)).toEqual(['p2', 'home-1', 'home-2', 'home-3', 'home-4', 'home-5', 'home-6', 'home-7', 'home-8']);
  expect(manifest.defenders.map(d => d.registeredPosition)).toEqual(['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']);
  expect(manifest.fixture).toEqual({ gameId: 'game-1', venueId: 'venue-1', fixtureEventId: 'fixture-1', fixtureRevision: 0 });
  expect([manifest.careerId, manifest.seasonId, manifest.homeClubId, manifest.awayClubId]).toEqual(['career-a', 'league-season-1', 'club-a', 'club-b']);
  expect(manifest.pitchIds).toEqual(['pitch-0', 'pitch-1', 'pitch-2']);
});

it('preflight validates the explicit appeal fence and preserves callId separately from eventId', () => {
  const p = terminalFixtureCompatibility(), call = p.ledger.events.find(e => e.kind === 'OnFieldCallRecorded');
  expect(call).toMatchObject({ eventId: 'compat-call:call', call: { callId: 'compat-call' } });
  const closure = getOfficialPlayClosure(p.ledger)!;
  expect(closure.finalRuling).toMatchObject({ source: 'on_field_call', basisCallId: 'compat-call' });
  expect(closure.finalRuling.basisCallId).not.toBe(call!.eventId);
  expect(manifest.officialPolicy.officialWindows).toEqual({ appeal: { available: true }, review: { available: false }, challenge: { available: false } });
});

it('preflight checks existing game policy validity without adding an innings or tie default', () => {
  const p = terminalFixtureCompatibility();
  const input = { gameId: manifest.gameId, seasonId: manifest.seasonId, homeClubId: manifest.homeClubId,
    awayClubId: manifest.awayClubId, priorMatch: p.original, application: p.expectedReceipt };
  for (const policy of [{ ...manifest.legalGamePolicy, minimumInnings: 0 },
    { ...manifest.legalGamePolicy, maximumInnings: 8 }, { ...manifest.legalGamePolicy, tiesAllowed: false }]) {
    expect(() => resolveOfficialGameProgression({ ...input, policy })).toThrow(/invalid versioned game completion policy/);
  }
});

it('preflight preserves a valid game policy with maximum innings omitted and ties disallowed', () => {
  const p = terminalFixtureCompatibility();
  const policy = { version: manifest.legalGamePolicy.version,
    minimumInnings: manifest.legalGamePolicy.minimumInnings, tiesAllowed: false };
  const before = JSON.stringify(policy);
  expect(resolveOfficialGameProgression({ gameId: manifest.gameId, seasonId: manifest.seasonId,
    homeClubId: manifest.homeClubId, awayClubId: manifest.awayClubId,
    priorMatch: p.original, application: p.expectedReceipt, policy }))
    .toEqual({ kind: 'GAME_CONTINUES', nextMatchState: p.next });
  expect(policy).not.toHaveProperty('maximumInnings'); expect(JSON.stringify(policy)).toBe(before);
});

it('preflight rejects active fixture input and extra original profile fields without invoking an accessor', () => {
  let reads = 0;
  const active = { ...manifest.originalProfile, get unwanted() { reads++; return 'caller authority'; } };
  expect(() => cloneInert(active)).toThrow(/accessors/); expect(reads).toBe(0);
  expect(Object.isFrozen(manifest)).toBe(true); expect(Object.isFrozen(manifest.match)).toBe(true);
  expect(() => match({ ...manifest.originalProfile, gameRules: {} } as never)).toThrow(/invalid original fixture rule profile/);
});

it('preflight proves pure non-live compatibility only and rejects the E-bearing ledger convention', () => {
  const p = terminalFixtureCompatibility();
  expect(p.next).toEqual({ ...manifest.match, playId: 8, outs: 1 });
  expect(p.canonical.scoring.classification).toBe('strikeout');
  expect(p.expectedReceipt).toMatchObject({ previousPlayId: 7, durableRevision: 1, appliedMatchState: p.next });
  expect(() => deriveClosedNonLiveMatchState({ match: p.original, timeline: p.timeline, context: { kind: 'strikeout' },
    adjudication: { ...p.ledger, playEnd: { kind: 'play_end', tick: p.timeline.lastEventTick, reason: 'dead_ball' } } })).toThrow();
});
