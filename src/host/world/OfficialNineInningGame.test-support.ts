import { isDeepStrictEqual } from 'node:util';
import { closeOfficialPlay, createPlayAdjudicationLedger,
  recordCorrectRuleSnapshot } from '../../core/adjudication/PlayAdjudicationLedger';
import type { BetweenPlayWorldSetup } from '../../core/adjudication/BetweenPlayWorldReset';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import type { CanonicalLineScoreSnapshot } from '../../core/model/CanonicalLineScoreSnapshot';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { resolveWalkForcedAdvancement } from '../../core/rules/WalkAdvancementRule';
import { createCanonicalPlateAppearanceTimeline, recordCountedPitch } from
  '../../core/sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import type { OfficialGameResult, OfficialGameVenueBinding } from
  '../../core/world/competition/OfficialGameCompletion';
import type { SqliteOfficialStateStore } from '../SqliteOfficialStateStore';

const worldSetup: BetweenPlayWorldSetup = {
  baseCenters: { first: { x: 27, z: 0 }, second: { x: 27, z: 27 }, third: { x: 0, z: 27 } },
  defenders: (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const)
    .map((registeredPosition, i) => ({ playerId: `defender-${i}`,
      registeredPosition, position: { x: i, z: i } })),
  activePreviousPlayControllerIds: [],
};

/** Count outcomes are scripted; every PA, half transition and final is adopted by Match. */
export const playOfficialNineInningGame = (
  matches: SqliteOfficialStateStore,
  input: Readonly<{ gameId: string; seasonId: string; homeNationId: string;
    awayNationId: string; ruleProfileVersion: string; gamePolicyVersion: string;
    binding: OfficialGameVenueBinding;
    defenderPlayerIds?: Readonly<{ home: readonly string[]; away: readonly string[] }> }>,
): OfficialGameResult => {
  if (input.defenderPlayerIds && ([input.defenderPlayerIds.home, input.defenderPlayerIds.away]
    .some((ids) => !Array.isArray(ids) || ids.length !== 9 || ids.some((id) => typeof id !== 'string' || !id.trim()))
    || new Set([...input.defenderPlayerIds.home, ...input.defenderPlayerIds.away]).size !== 18)) throw new Error('invalid scripted game defender identities');
  const setupFor = (half: CanonicalMatchState['half']): BetweenPlayWorldSetup => input.defenderPlayerIds
    ? { ...worldSetup, defenders: worldSetup.defenders.map((actor, index) => ({ ...actor,
      playerId: input.defenderPlayerIds![half === 'top' ? 'home' : 'away'][index] })) } : worldSetup;
  const initial: CanonicalMatchState = { ruleProfileId: asRuleProfileId(input.ruleProfileVersion),
    inning: 1, half: 'top', outs: 0, balls: 0, strikes: 0,
    bases: { first: null, second: null, third: null }, score: { away: 0, home: 0 }, playId: 1 };
  matches.initializeMatch(input.gameId, initial);
  const innings: { inning: number; awayRuns: number | null; homeRuns: number | null }[] = [];
  const walks = { top: 0, bottom: 0 };
  for (let appearance = 0; appearance < 60; appearance++) {
    const saved = matches.getMatch(input.gameId)!;
    const before = saved.matchState;
    const tick = before.playId * 100;
    let timeline = createCanonicalPlateAppearanceTimeline(before, tick);
    const walk = before.inning === 1 && before.outs === 0
      && walks[before.half] < (before.half === 'top' ? 4 : 5);
    const context = walk ? { kind: 'walk' as const,
      batterRunnerId: `runner-${input.gameId}-${before.playId}` }
      : { kind: 'strikeout' as const };
    for (let pitch = 1; pitch <= (walk ? 4 : 3); pitch++) {
      timeline = recordCountedPitch(timeline, tick + pitch,
        walk ? { kind: 'ball' } : { kind: 'swinging_strike' });
    }
    const advancement = context.kind === 'walk'
      ? resolveWalkForcedAdvancement({ batterRunnerId: context.batterRunnerId,
        bases: before.bases }) : { bases: before.bases, scoredRunnerIds: [] };
    if (walk) walks[before.half]++;
    if (!innings[before.inning - 1]) innings.push({ inning: before.inning,
      awayRuns: null, homeRuns: null });
    const scoreKey = before.half === 'top' ? 'awayRuns' : 'homeRuns';
    innings[before.inning - 1][scoreKey] =
      (innings[before.inning - 1][scoreKey] ?? 0) + advancement.scoredRunnerIds.length;
    let adjudication = createPlayAdjudicationLedger({ playId: before.playId,
      ruleProfileId: before.ruleProfileId, playEnd: null });
    adjudication = recordCorrectRuleSnapshot(adjudication, 0, {
      eventId: `rule-${before.playId}`, tick: tick + 5,
      snapshotId: `snapshot-${before.playId}`, evidenceRevision: 1,
      ruling: { outsAfter: before.outs + (walk ? 0 : 1),
        basesAfter: advancement.bases, scoredRunnerIds: advancement.scoredRunnerIds },
    });
    adjudication = closeOfficialPlay(adjudication, 1, { eventId: `close-${before.playId}`,
      closureId: `closure-${input.gameId}-${before.playId}`, tick: tick + 6 });
    const request = { kind: 'non_live' as const, matchId: input.gameId,
      applicationId: `apply-${input.gameId}-${before.playId}`,
      expectedDurableRevision: saved.durableRevision, match: before,
      timeline, adjudication, context };
    if (before.inning === 9 && before.half === 'top' && before.outs === 2) {
      const lineScore: CanonicalLineScoreSnapshot = { innings,
        totals: { home: { runs: before.score.home, hits: 0, errors: 0 },
          away: { runs: before.score.away, hits: 0, errors: 0 } } };
      const finalRequest = { ...request, game: { seasonId: input.seasonId,
        homeClubId: input.homeNationId, awayClubId: input.awayNationId,
        venueBinding: input.binding, policy: { version: input.gamePolicyVersion,
          minimumInnings: 9, tiesAllowed: false }, lineScore } };
      const result = matches.applyAndFinalize(finalRequest);
      if (!isDeepStrictEqual(matches.applyAndFinalize(finalRequest), result)) {
        throw new Error('final application retry differs');
      }
      return result.result;
    }
    const nextHalf = !walk && before.outs === 2 ? before.half === 'top' ? 'bottom' : 'top' : before.half;
    matches.applyAndActivate({ ...request, nextStartedAtTick: tick + 7, worldSetup: setupFor(nextHalf) });
  }
  throw new Error('scripted nine-inning game did not reach its official final');
};
