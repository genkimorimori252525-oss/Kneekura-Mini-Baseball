import { applyClubCommand } from '../club/ClubLifecycle';
import type { ClubTransitionEvent, ClubWorldState } from '../club/ClubTypes';
import { same } from '../club/ClubValidation';
import { createRosterState } from '../roster/RosterState';
import type { RosterState } from '../roster/RosterTypes';
import { createTeamMoodState, TEAM_MOOD_AXES } from './TeamMood';
import type { PlayerMoodSusceptibility, TeamMoodPolicy,
  TeamMoodState, TeamMoodVector } from './TeamMood';

export type TeamMoodSeasonCarryPolicy = Readonly<{
  policyId: string;
  version: string;
  season: number;
  availableAtDay: number;
  retention: TeamMoodVector;
}>;
export type TeamMoodSeasonEvent = Readonly<{
  type: 'TEAM_MOOD_SEASON_OPENED';
  sourceClubEventId: string;
  careerId: string;
  clubId: string;
  previousSeason: number;
  nextSeason: number;
  atDay: number;
  carryPolicyId: string;
  carryPolicyVersion: string;
  retainedPlayerIds: readonly string[];
  departedPlayerIds: readonly string[];
  newPlayerIds: readonly string[];
  before: TeamMoodVector;
  after: TeamMoodVector;
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const unitVector = (value: unknown): TeamMoodVector => {
  if (value === null || typeof value !== 'object'
    || Array.isArray(value)
    || Object.keys(value).length !== TEAM_MOOD_AXES.length
    || TEAM_MOOD_AXES.some((axis) =>
      !Object.hasOwn(value, axis)
        || !Number.isFinite((value as TeamMoodVector)[axis])
        || (value as TeamMoodVector)[axis] < 0
        || (value as TeamMoodVector)[axis] > 1)) {
    throw new Error('invalid team mood season carry retention');
  }
  return Object.freeze({ ...value as TeamMoodVector });
};
const aggregate = (players: TeamMoodState['players']): TeamMoodVector =>
  Object.freeze(Object.fromEntries(TEAM_MOOD_AXES.map((axis) =>
    [axis, players.reduce((sum, player) =>
      sum + player.mood[axis], 0) / players.length])) as Record<
    typeof TEAM_MOOD_AXES[number], number>);

/** Replays the closed club's opening command before carrying social state. */
export const openTeamMoodSeason = (
  previous: TeamMoodState,
  closedClub: ClubWorldState,
  opening: ClubTransitionEvent,
  rosterInput: RosterState,
  nextMoodPolicy: TeamMoodPolicy,
  susceptibilities: readonly PlayerMoodSusceptibility[],
  carryInput: TeamMoodSeasonCarryPolicy,
): Readonly<{ state: TeamMoodState; event: TeamMoodSeasonEvent }> => {
  if (previous.careerId !== closedClub.careerId
    || previous.clubId !== closedClub.identity.clubId
    || previous.season !== closedClub.season.plan.season
    || closedClub.season.closureRef === null
    || previous.effectiveDay > closedClub.effectiveDay
    || previous.revision !== previous.events.length
    || opening.kind !== 'CLUB_CHANGED'
    || opening.command.operations.length !== 1
    || opening.command.operations[0]?.kind !== 'OPEN_SEASON') {
    throw new Error('invalid team mood season opening scope');
  }
  const replayed = applyClubCommand(closedClub, opening.command);
  if (!replayed.ok || !same(replayed.event, opening)) {
    throw new Error('invalid team mood season opening evidence');
  }
  const opened = replayed.state;
  if (opened.season.plan.season !== previous.season + 1
    || !id(carryInput.policyId) || !id(carryInput.version)
    || carryInput.season !== opened.season.plan.season
    || !Number.isSafeInteger(carryInput.availableAtDay)
    || carryInput.availableAtDay < 0
    || carryInput.availableAtDay > opened.effectiveDay
    || nextMoodPolicy.season !== opened.season.plan.season) {
    throw new Error('invalid team mood next season policy');
  }
  const retention = unitVector(carryInput.retention);
  const roster = createRosterState(rosterInput);
  if (roster.careerId !== previous.careerId
    || roster.effectiveDay !== opened.effectiveDay) {
    throw new Error('future or stale team mood season roster');
  }
  const initial = createTeamMoodState(roster, previous.clubId,
    nextMoodPolicy, susceptibilities);
  const oldPlayers = new Map(previous.players.map((item) =>
    [item.playerId, item]));
  const retainedPlayerIds: string[] = [];
  const newPlayerIds: string[] = [];
  const players = Object.freeze(initial.players.map((player) => {
    const old = oldPlayers.get(player.playerId);
    if (!old) {
      newPlayerIds.push(player.playerId);
      return player;
    }
    retainedPlayerIds.push(player.playerId);
    const mood = Object.freeze(Object.fromEntries(
      TEAM_MOOD_AXES.map((axis) => [axis,
        Math.max(0, Math.min(100, initial.policy.baseline[axis]
          + (old.mood[axis] - previous.policy.baseline[axis])
            * retention[axis]))])) as Record<
      typeof TEAM_MOOD_AXES[number], number>);
    return Object.freeze({ ...player, mood });
  }));
  const departedPlayerIds = previous.players
    .map((player) => player.playerId)
    .filter((playerId) => !initial.players.some((player) =>
      player.playerId === playerId));
  const mood = aggregate(players);
  const next: TeamMoodState = Object.freeze({ ...initial,
    effectiveDay: opened.effectiveDay, players, mood });
  const event: TeamMoodSeasonEvent = Object.freeze({
    type: 'TEAM_MOOD_SEASON_OPENED',
    sourceClubEventId: opening.command.eventId,
    careerId: next.careerId, clubId: next.clubId,
    previousSeason: previous.season, nextSeason: next.season,
    atDay: next.effectiveDay, carryPolicyId: carryInput.policyId,
    carryPolicyVersion: carryInput.version,
    retainedPlayerIds: Object.freeze(retainedPlayerIds),
    departedPlayerIds: Object.freeze(departedPlayerIds),
    newPlayerIds: Object.freeze(newPlayerIds),
    before: previous.mood, after: mood,
  });
  return Object.freeze({ state: next, event });
};
