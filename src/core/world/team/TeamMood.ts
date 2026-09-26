import { createRosterState } from '../roster/RosterState';
import type { RosterState } from '../roster/RosterTypes';
import type { PlayerRelationshipNetwork } from './PlayerRelationships';

export const TEAM_MOOD_AXES = [
  'confidence', 'cohesion', 'energy', 'tension', 'roleHarmony',
] as const;
export type TeamMoodAxis = typeof TEAM_MOOD_AXES[number];
export type TeamMoodVector = Readonly<Record<TeamMoodAxis, number>>;
export type TeamMoodPolicy = Readonly<{
  policyId: string;
  version: string;
  season: number;
  availableAtDay: number;
  baseline: TeamMoodVector;
  directStrength: number;
  diffusionStrength: number;
  dailyReversion: TeamMoodVector;
}>;
export type PlayerMoodSusceptibility = Readonly<{
  playerId: string;
  axes: TeamMoodVector;
}>;
export type TeamMoodPlayer = Readonly<{
  playerId: string;
  mood: TeamMoodVector;
  susceptibility: TeamMoodVector;
}>;
export type TeamMoodSignal = Readonly<{
  eventId: string;
  sourceEventId: string;
  appraisalId: string;
  careerId: string;
  clubId: string;
  season: number;
  directPlayerId: string;
  atDay: number;
  axis: TeamMoodAxis;
  delta: number;
}>;
export type TeamMoodEvent = Readonly<{
  type: 'TEAM_MOOD_SIGNAL_APPLIED';
  eventId: string;
  sourceEventId: string;
  appraisalId: string;
  careerId: string;
  clubId: string;
  season: number;
  atDay: number;
  axis: TeamMoodAxis;
  directPlayerId: string;
  affectedPlayerIds: readonly string[];
  before: TeamMoodVector;
  after: TeamMoodVector;
}>;
export type TeamMoodState = Readonly<{
  careerId: string;
  clubId: string;
  season: number;
  revision: number;
  effectiveDay: number;
  policy: TeamMoodPolicy;
  mood: TeamMoodVector;
  players: readonly TeamMoodPlayer[];
  events: readonly TeamMoodEvent[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const vector = (value: unknown, unit: boolean): TeamMoodVector => {
  if (!fields(value, TEAM_MOOD_AXES)) {
    throw new Error('invalid team mood vector');
  }
  const source = value as TeamMoodVector;
  const maximum = unit ? 1 : 100;
  if (TEAM_MOOD_AXES.some((axis) => !Number.isFinite(source[axis])
    || source[axis] < 0 || source[axis] > maximum)) {
    throw new Error('invalid team mood vector range');
  }
  return Object.freeze({ ...source });
};
const assignedIds = (roster: RosterState, clubId: string): string[] =>
  roster.players.filter((player) => player.assignment?.clubId === clubId)
    .map((player) => player.playerId);
const aggregate = (players: readonly TeamMoodPlayer[]): TeamMoodVector =>
  Object.freeze(Object.fromEntries(TEAM_MOOD_AXES.map((axis) =>
    [axis, players.reduce((sum, player) =>
      sum + player.mood[axis], 0) / players.length])) as Record<TeamMoodAxis, number>);
const clamp = (value: number): number =>
  Math.max(0, Math.min(100, value));

/** Creates a five-axis social environment for the assigned roster only. */
export const createTeamMoodState = (
  rosterInput: RosterState,
  clubId: string,
  input: TeamMoodPolicy,
  susceptibilities: readonly PlayerMoodSusceptibility[],
): TeamMoodState => {
  const roster = createRosterState(rosterInput);
  if (!id(clubId) || !fields(input, ['policyId', 'version',
    'season', 'availableAtDay', 'baseline', 'directStrength',
    'diffusionStrength', 'dailyReversion'])
    || !id(input.policyId) || !id(input.version)
    || !Number.isSafeInteger(input.season) || input.season <= 0
    || !roster.profiles.some((profile) =>
      profile.season === input.season)
    || !day(input.availableAtDay)
    || input.availableAtDay > roster.effectiveDay
    || !Number.isFinite(input.directStrength)
    || input.directStrength < 0 || input.directStrength > 1
    || !Number.isFinite(input.diffusionStrength)
    || input.diffusionStrength < 0 || input.diffusionStrength > 1) {
    throw new Error('invalid team mood policy or roster scope');
  }
  const baseline = vector(input.baseline, false);
  const dailyReversion = vector(input.dailyReversion, true);
  const ids = assignedIds(roster, clubId);
  if (ids.length === 0 || !Array.isArray(susceptibilities)
    || susceptibilities.length !== ids.length
    || new Set(susceptibilities.map((item) => item.playerId)).size
      !== ids.length
    || ids.some((playerId) => !susceptibilities.some((item) =>
      item.playerId === playerId))) {
    throw new Error('team mood requires assigned player susceptibilities');
  }
  const players = Object.freeze(ids.map((playerId) => {
    const item = susceptibilities.find((entry) =>
      entry.playerId === playerId)!;
    if (!fields(item, ['playerId', 'axes'])) {
      throw new Error('invalid player mood susceptibility');
    }
    return Object.freeze({ playerId, mood: baseline,
      susceptibility: vector(item.axes, true) });
  }));
  const policy: TeamMoodPolicy = Object.freeze({
    policyId: input.policyId, version: input.version,
    season: input.season, availableAtDay: input.availableAtDay,
    baseline, directStrength: input.directStrength,
    diffusionStrength: input.diffusionStrength, dailyReversion,
  });
  return Object.freeze({ careerId: roster.careerId,
    clubId, season: input.season, revision: 0,
    effectiveDay: roster.effectiveDay, policy,
    mood: baseline, players, events: Object.freeze([]),
  });
};

/** Appraisal is supplied by its owner; social diffusion never changes skill. */
export const applyTeamMoodSignal = (
  state: TeamMoodState,
  rosterInput: RosterState,
  relationships: PlayerRelationshipNetwork,
  source: TeamMoodSignal,
): Readonly<{ state: TeamMoodState; event: TeamMoodEvent }> => {
  const roster = createRosterState(rosterInput);
  if (!fields(source, ['eventId', 'sourceEventId',
    'appraisalId', 'careerId', 'clubId', 'season',
    'directPlayerId', 'atDay', 'axis', 'delta'])
    || !id(source.eventId) || !id(source.sourceEventId)
    || !id(source.appraisalId) || !id(source.directPlayerId)
    || source.careerId !== state.careerId
    || source.clubId !== state.clubId
    || source.season !== state.season) {
    throw new Error('team mood signal scope mismatch');
  }
  if (!TEAM_MOOD_AXES.includes(source.axis)
    || !Number.isFinite(source.delta)
    || source.delta < -100 || source.delta > 100
    || !day(source.atDay) || source.atDay < state.effectiveDay
    || roster.careerId !== state.careerId
    || roster.effectiveDay > source.atDay
    || !state.players.some((player) =>
      player.playerId === source.directPlayerId)
    || assignedIds(roster, state.clubId).length
      !== state.players.length
    || assignedIds(roster, state.clubId).some((playerId) =>
      !state.players.some((player) =>
        player.playerId === playerId))) {
    throw new Error('invalid team mood signal or roster');
  }
  if (relationships.careerId !== state.careerId
    || relationships.effectiveDay > source.atDay) {
    throw new Error('future or foreign relationship network');
  }
  if (state.events.some((event) => event.eventId === source.eventId
    || event.sourceEventId === source.sourceEventId)) {
    throw new Error('duplicate team mood signal');
  }
  const days = source.atDay - state.effectiveDay;
  const affectedPlayerIds: string[] = [];
  const players = Object.freeze(state.players.map((player) => {
    const mood = Object.fromEntries(TEAM_MOOD_AXES.map((axis) => {
      const baseline = state.policy.baseline[axis];
      return [axis, baseline + (player.mood[axis] - baseline)
        * (1 - state.policy.dailyReversion[axis]) ** days];
    })) as Record<TeamMoodAxis, number>;
    let reach = 0;
    if (player.playerId === source.directPlayerId) {
      reach = state.policy.directStrength;
    } else {
      const receivingLink = relationships.links.find((link) =>
        link.fromPlayerId === player.playerId
          && link.toPlayerId === source.directPlayerId);
      if (receivingLink) {
        reach = state.policy.diffusionStrength
          * (receivingLink.affinity + receivingLink.trust) / 200;
      }
    }
    const impact = source.delta * reach
      * player.susceptibility[source.axis];
    if (impact !== 0) affectedPlayerIds.push(player.playerId);
    mood[source.axis] = clamp(mood[source.axis] + impact);
    return Object.freeze({ playerId: player.playerId,
      mood: Object.freeze(mood),
      susceptibility: player.susceptibility });
  }));
  const nextMood = aggregate(players);
  const event: TeamMoodEvent = Object.freeze({
    type: 'TEAM_MOOD_SIGNAL_APPLIED',
    eventId: source.eventId, sourceEventId: source.sourceEventId,
    appraisalId: source.appraisalId,
    careerId: state.careerId, clubId: state.clubId,
    season: state.season, atDay: source.atDay,
    axis: source.axis, directPlayerId: source.directPlayerId,
    affectedPlayerIds: Object.freeze(affectedPlayerIds),
    before: state.mood, after: nextMood,
  });
  const next: TeamMoodState = Object.freeze({ ...state,
    revision: state.revision + 1, effectiveDay: source.atDay,
    mood: nextMood, players,
    events: Object.freeze([...state.events, event]),
  });
  return Object.freeze({ state: next, event });
};
