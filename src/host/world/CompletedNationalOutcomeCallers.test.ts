import { expect, it } from 'vitest';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import type { OfficialGameResult } from '../../core/world/competition/OfficialGameCompletion';
import type { CompletedMatchPlayerOutcomes } from './SqliteOfficialPlayerOutcomeStore';
import { completeWorldBoundWbcFinals, type WorldBoundWbcFinalsStores } from './WorldBoundWbcFinalsRuntime';
import { completeWorldBoundWbcQualifier, type WorldBoundWbcQualifierStores } from './WorldBoundWbcQualifierRuntime';
import { createCompetitionSourceReader, withCompetitionSourceReadScope } from './CompetitionSourceReadScope';

// Structural completion-driver tests. Competition evidence and outcome owners
// are explicitly substituted; these cases do not qualify National Native proof.
const fixture = (kind: 'finals' | 'qualifier') => {
  const editionId = kind === 'finals' ? 'wbc' : 'qualifier';
  const finals: OfficialGameResult[] = Array.from({ length: kind === 'finals' ? 51 : 12 }, (_, i) => ({
    gameId: `${editionId}-${i}`, seasonId: editionId, homeClubId: 'nation-home', awayClubId: 'nation-away', homeRuns: 1, awayRuns: 0,
    winnerClubId: 'nation-home', completionReason: 'HOME_LEADS_AFTER_TOP', ruleProfileId: asRuleProfileId('npb-2026'),
    gamePolicyVersion: 'fixture', closureId: `closure-${i}`, applicationId: `official-${i}`, durableRevision: 1,
    lineScore: { innings: [{ inning: 1, awayRuns: 0, homeRuns: 1 }], totals: {
      away: { runs: 0, hits: 0, errors: 0 }, home: { runs: 1, hits: 1, errors: 0 } } },
    venueBinding: { gameId: `${editionId}-${i}`, venueId: 'venue', fixtureEventId: `fixture-${i}`, fixtureRevision: 0 },
  }));
  const state = { complete: true, failAt: -1, mismatch: false, calls: [] as string[], events: [] as string[], writes: new Set<string>(), evidenceMissing: false };
  const original: CompletedMatchPlayerOutcomes[] = finals.map((finalResult, i) => ({ finalResult,
    coverage: i === 0 ? 'attributed_supported_plays_only' : 'all_official_plays_attributed', plays: i ? [] : [{
      applicationId: finalResult.applicationId, playId: 0, durableRevision: 1,
      outcome: { kind: 'unavailable', reason: 'original_owner_missing', sources: [] },
    }] }));
  const outcomeOwner = { applyCompletedGame(input: { careerId: string; gameId: string }): CompletedMatchPlayerOutcomes {
    expect(input.careerId).toBe('career');
    const index = finals.findIndex(final => final.gameId === input.gameId);
    expect(index).toBeGreaterThanOrEqual(0);
    state.calls.push(input.gameId); state.events.push(`outcome:${index}`);
    if (state.failAt === index) throw new Error('interrupted National outcome');
    state.writes.add(input.gameId);
    return state.mismatch ? { ...original[index], finalResult: { ...finals[index], venueBinding: { ...finals[index].venueBinding!, fixtureRevision: 7 } } } : original[index];
  } };
  const finalsStores = {
    outcomes: outcomeOwner, editions: { readSnapshot: () => ({ kind: 'WBC' }) },
    knockout: { readPlan: () => ({}), finalize: () => state.complete ? {} : null,
      readEvidence: () => state.evidenceMissing ? null : ({ source: { groupEdition: { editionId }, knockoutEdition: { editionId }, groupResults: finals.slice(0, 36) },
        roundOf16Results: finals.slice(36, 44), quarterfinalResults: finals.slice(44, 48), semifinalResults: finals.slice(48, 50), finalResult: finals[50] }) },
    history: { record: () => { state.events.push('history'); return { snapshotId: 'history' }; } },
    rankingHistory: { recordWbc: () => { state.events.push('ranking'); return { snapshotId: 'ranking' }; } },
  } as unknown as WorldBoundWbcFinalsStores;
  const qualifierStores = {
    outcomes: outcomeOwner, qualification: { readSnapshot: () => ({ input: { qualifierEditionId: editionId } }) },
    pods: { finalize: () => state.complete ? {} : null, readEvidence: () => state.evidenceMissing ? null : ({ edition: { editionId },
      semifinalResults: finals.slice(0, 8), finalResults: finals.slice(8) }) },
    history: { recordQualifier: () => { state.events.push('history'); return {}; } },
    hosts: { recordCompletedEdition: () => { state.events.push('hosting'); return {}; } },
    berths: { initialize: () => { state.events.push('berths'); return { entrantNationIds: ['nation-home'] }; } },
  } as unknown as WorldBoundWbcQualifierStores;
  const run = (authority = true) => kind === 'finals'
    ? completeWorldBoundWbcFinals({ ...finalsStores, outcomes: authority ? outcomeOwner : undefined }, 'career', 'wbc')
    : completeWorldBoundWbcQualifier({ ...qualifierStores, outcomes: authority ? outcomeOwner : undefined }, 'career', 'wbc');
  return { state, finals, run, original };
};

it.each(['finals', 'qualifier'] as const)('delivers all WBC %s originals after existing completion and preserves partial coverage', kind => {
  const f = fixture(kind), result = f.run()!;
  expect(f.state.calls).toEqual(f.finals.map(final => final.gameId));
  expect(f.state.events.slice(0, kind === 'finals' ? 2 : 3)).toEqual(kind === 'finals' ? ['history', 'ranking'] : ['history', 'hosting', 'berths']);
  expect(result.playerOutcomes).toMatchObject({ kind: 'delivered', competitionEditionId: kind === 'finals' ? 'wbc' : 'qualifier',
    coverage: 'attributed_supported_plays_only', games: f.original });
  expect(f.run()).toEqual(result); expect(f.state.writes.size).toBe(f.finals.length);
});
it.each(['finals', 'qualifier'] as const)('resumes WBC %s outcome interruption by retrying existing owners', kind => {
  const f = fixture(kind); f.state.failAt = 1;
  expect(() => f.run()).toThrow('interrupted National outcome'); expect(f.state.writes.size).toBe(1);
  f.state.failAt = -1; expect(f.run()!.playerOutcomes.kind).toBe('delivered');
  expect(f.state.calls.filter(gameId => gameId === f.finals[0].gameId)).toHaveLength(2);
  expect(f.state.writes.size).toBe(f.finals.length);
});
it.each(['finals', 'qualifier'] as const)('reports missing WBC %s outcome authority and skips incomplete competition', kind => {
  const f = fixture(kind);
  expect(f.run(false)!.playerOutcomes).toMatchObject({ kind: 'unavailable', reason: 'outcome_authority_missing', gameIds: f.finals.map(final => final.gameId) });
  expect(f.state.calls).toEqual([]); f.state.complete = false; f.state.events.length = 0;
  expect(f.run()).toBeNull(); expect(f.state.events).toEqual([]);
});
it.each(['finals', 'qualifier'] as const)('rejects WBC %s missing original evidence and a changed delivered fixture', kind => {
  const f = fixture(kind); f.state.evidenceMissing = true;
  expect(() => f.run()).toThrow('lacks completed original evidence'); expect(f.state.calls).toEqual([]);
  f.state.evidenceMissing = false; f.state.mismatch = true;
  expect(() => f.run()).toThrow('outcome delivery original final differs');
});
it('clears an enclosing competition proof scope after outcome delivery writes', () => {
  const f = fixture('qualifier'), count = createCompetitionSourceReader(() => f.state.writes.size);
  withCompetitionSourceReadScope(() => { expect(count()).toBe(0); f.run(); expect(count()).toBe(12); });
});
