import type { BaseScheduleSnapshot } from './LeagueSchedule';

export type MarketWindowType =
  | 'TRADE_DEADLINE' | 'REGISTRATION_WINDOW_CLOSE' | 'HYBRID';
export type EventTiming = Readonly<{ day?: number; progress?: number }>;
export type MarketWindowPolicy = Readonly<EventTiming & {
  windowId: string;
  type: MarketWindowType;
  policyVersion: string;
}>;
export type EligibilityCutoffPolicy = Readonly<EventTiming & {
  scope: 'DOMESTIC_POSTSEASON' | 'CONTINENTAL' | 'OTHER_COMPETITION';
  policyVersion: string;
}>;
export type LeagueSeasonEventProfile = Readonly<{
  version: string;
  allStarEnabled: boolean;
  allStarDay?: number;
  allStarProgress?: number;
  marketWindows: readonly MarketWindowPolicy[];
  rosterExpansionEnabled: boolean;
  rosterExpansionDay?: number;
  rosterExpansionProgress?: number;
  postseasonEligibilityCutoffs?: readonly EligibilityCutoffPolicy[];
  awardSelectionPolicyVersion: string;
}>;
export type MarketWindowSnapshot = Readonly<{
  windowId: string;
  type: MarketWindowType;
  day: number;
  policyVersion: string;
}>;
export type LeagueSeasonEventSnapshot = Readonly<{
  seasonId: string;
  leagueId: string;
  eventProfileVersion: string;
  calendarProfileVersion: string;
  actualOpeningDay: number;
  allStarEvent: Readonly<{ eventId: string; day: number }> | null;
  marketWindowSnapshots: readonly MarketWindowSnapshot[];
  rosterExpansionDay: number | null;
  eligibilityCutoffs: readonly Readonly<{
    scope: EligibilityCutoffPolicy['scope']; day: number; policyVersion: string;
  }>[];
  awardSelectionPolicyVersion: string;
}>;
export type MarketDecisionTrigger = Readonly<{
  seasonId: string;
  leagueId: string;
  windowId: string;
  type: MarketWindowType;
  day: number;
  policyVersion: string;
}>;

const resolveDay = (
  timing: EventTiming,
  firstDay: number,
  lastDay: number,
): number => {
  if ((timing.day === undefined) === (timing.progress === undefined)) {
    throw new Error('season event requires exactly one explicit day or progress');
  }
  if (timing.progress !== undefined
    && (!Number.isFinite(timing.progress) || timing.progress < 0 || timing.progress > 1)) {
    throw new Error('season event progress must be within 0..1');
  }
  const day = timing.day ?? Math.round(firstDay + (lastDay - firstDay) * timing.progress!);
  if (!Number.isSafeInteger(day) || day < firstDay || day > lastDay) {
    throw new Error('season event day must fall inside the regular season');
  }
  return day;
};

export const createLeagueSeasonEventSnapshot = (
  schedule: BaseScheduleSnapshot,
  profile: LeagueSeasonEventProfile,
): LeagueSeasonEventSnapshot => {
  if (!profile.version || !profile.awardSelectionPolicyVersion
    || typeof profile.allStarEnabled !== 'boolean'
    || typeof profile.rosterExpansionEnabled !== 'boolean') {
    throw new Error('invalid versioned league season event profile');
  }
  const days = schedule.games.map((game) => game.day);
  if (days.length === 0) throw new Error('season events require a scheduled regular season');
  const firstDay = Math.min(...days);
  const lastDay = Math.max(...days);
  const allStarDay = profile.allStarEnabled
    ? resolveDay({ day: profile.allStarDay, progress: profile.allStarProgress }, firstDay, lastDay)
    : null;
  if (allStarDay !== null && days.includes(allStarDay)) {
    throw new Error('All-Star break cannot overlap a regular-season game day');
  }
  const seenMarketWindows = new Set<string>();
  const marketWindowSnapshots = profile.marketWindows.map((policy) => {
    if (!policy.windowId || !policy.policyVersion
      || seenMarketWindows.has(policy.windowId)
      || !['TRADE_DEADLINE', 'REGISTRATION_WINDOW_CLOSE', 'HYBRID'].includes(policy.type)) {
      throw new Error('invalid or duplicate market window policy');
    }
    seenMarketWindows.add(policy.windowId);
    return Object.freeze({
      windowId: policy.windowId,
      type: policy.type,
      day: resolveDay(policy, firstDay, lastDay),
      policyVersion: policy.policyVersion,
    });
  });
  const rosterExpansionDay = profile.rosterExpansionEnabled
    ? resolveDay({
      day: profile.rosterExpansionDay,
      progress: profile.rosterExpansionProgress,
    }, firstDay, lastDay)
    : null;
  const eligibilityCutoffs = (profile.postseasonEligibilityCutoffs ?? []).map((policy) => {
    if (!policy.policyVersion
      || !['DOMESTIC_POSTSEASON', 'CONTINENTAL', 'OTHER_COMPETITION'].includes(policy.scope)) {
      throw new Error('invalid competition eligibility cutoff policy');
    }
    return Object.freeze({
      scope: policy.scope,
      day: resolveDay(policy, firstDay, lastDay),
      policyVersion: policy.policyVersion,
    });
  });
  return Object.freeze({
    seasonId: schedule.seasonId,
    leagueId: schedule.leagueId,
    eventProfileVersion: profile.version,
    calendarProfileVersion: schedule.calendarProfileVersion,
    actualOpeningDay: firstDay,
    allStarEvent: allStarDay === null ? null : Object.freeze({
      eventId: JSON.stringify(['all-star', schedule.seasonId, schedule.leagueId, profile.version]),
      day: allStarDay,
    }),
    marketWindowSnapshots: Object.freeze(marketWindowSnapshots),
    rosterExpansionDay,
    eligibilityCutoffs: Object.freeze(eligibilityCutoffs),
    awardSelectionPolicyVersion: profile.awardSelectionPolicyVersion,
  });
};

/** A deadline only triggers the Club AI. This function never selects BUY/SELL. */
export const marketDecisionTriggersOnDay = (
  snapshot: LeagueSeasonEventSnapshot,
  day: number,
): readonly MarketDecisionTrigger[] => Object.freeze(
  snapshot.marketWindowSnapshots.filter((policy) => policy.day === day).map((policy) =>
    Object.freeze({
      seasonId: snapshot.seasonId,
      leagueId: snapshot.leagueId,
      windowId: policy.windowId,
      type: policy.type,
      day: policy.day,
      policyVersion: policy.policyVersion,
    })),
);
