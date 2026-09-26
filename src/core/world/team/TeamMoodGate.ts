import { TEAM_MOOD_AXES } from './TeamMood';
import type { TeamMoodState, TeamMoodVector } from './TeamMood';

export type TeamMoodGatePolicy = Readonly<{
  policyId: string;
  version: string;
  season: number;
  availableAtDay: number;
  minimumAlignedFraction: number;
  positiveCohesion: number;
  positiveConfidence: number;
  positiveEnergy: number;
  severeTension: number;
  roleHarmonyCollapse: number;
}>;
export type TeamMoodGateReason =
  | 'HIGH_COHESION' | 'CONFIDENCE_AND_ENERGY'
  | 'SEVERE_TENSION' | 'ROLE_HARMONY_COLLAPSE';
export type TeamMoodGateAssessment = Readonly<{
  careerId: string;
  clubId: string;
  season: number;
  stateRevision: number;
  evaluatedAtDay: number;
  policyId: string;
  policyVersion: string;
  mode: 'NORMAL' | 'POSITIVE_EXTREME'
    | 'DYSFUNCTION_EXTREME' | 'MIXED_EXTREME';
  appraisalEligible: boolean;
  reasons: readonly TeamMoodGateReason[];
}>;
const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0
    && value === value.trim();
const fields = (value: unknown, names: readonly string[]): boolean =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === names.length
    && names.every((name) => Object.hasOwn(value, name));
const moodVector = (value: unknown): value is TeamMoodVector =>
  fields(value, TEAM_MOOD_AXES)
    && TEAM_MOOD_AXES.every((axis) =>
      Number.isFinite((value as TeamMoodVector)[axis])
        && (value as TeamMoodVector)[axis] >= 0
        && (value as TeamMoodVector)[axis] <= 100);

/** Describes rare social extremes; only individual appraisal may consume this. */
export const assessTeamMoodGate = (
  state: TeamMoodState,
  policy: TeamMoodGatePolicy,
): TeamMoodGateAssessment => {
  if (!fields(policy, ['policyId', 'version', 'season',
    'availableAtDay', 'minimumAlignedFraction',
    'positiveCohesion', 'positiveConfidence', 'positiveEnergy',
    'severeTension', 'roleHarmonyCollapse'])
    || !id(policy.policyId) || !id(policy.version)
    || policy.season !== state.season
    || !Number.isSafeInteger(policy.availableAtDay)
    || policy.availableAtDay < 0
    || policy.availableAtDay > state.effectiveDay) {
    throw new Error('invalid team mood gate scope');
  }
  if (!Number.isFinite(policy.minimumAlignedFraction)
    || policy.minimumAlignedFraction <= 0
    || policy.minimumAlignedFraction > 1
    || !moodVector(state.policy.baseline)
    || !moodVector(state.mood)
    || [policy.positiveCohesion,
      policy.positiveConfidence, policy.positiveEnergy,
      policy.severeTension, policy.roleHarmonyCollapse]
      .some((value) => !Number.isFinite(value)
        || value < 0 || value > 100)
    || policy.positiveCohesion <= state.policy.baseline.cohesion
    || policy.positiveConfidence <= state.policy.baseline.confidence
    || policy.positiveEnergy <= state.policy.baseline.energy
    || policy.severeTension <= state.policy.baseline.tension
    || policy.roleHarmonyCollapse >= state.policy.baseline.roleHarmony) {
    throw new Error('invalid team mood gate threshold');
  }
  if (!Array.isArray(state.players) || state.players.length === 0
    || !Array.isArray(state.events)
    || state.revision !== state.events.length
    || state.players.some((player) => !moodVector(player.mood))
    || TEAM_MOOD_AXES.some((axis) => Math.abs(state.mood[axis]
      - state.players.reduce((sum, player) =>
        sum + player.mood[axis], 0) / state.players.length) > 1e-9)) {
    throw new Error('invalid team mood gate state');
  }
  const aligned = (matches: (mood: TeamMoodVector) => boolean): boolean =>
    state.players.filter((player) => matches(player.mood)).length
      / state.players.length >= policy.minimumAlignedFraction;
  const reasons: TeamMoodGateReason[] = [];
  if (state.mood.cohesion >= policy.positiveCohesion
    && aligned((mood) => mood.cohesion >= policy.positiveCohesion)) {
    reasons.push('HIGH_COHESION');
  }
  if (state.mood.confidence >= policy.positiveConfidence
    && state.mood.energy >= policy.positiveEnergy
    && aligned((mood) => mood.confidence >= policy.positiveConfidence
      && mood.energy >= policy.positiveEnergy)) {
    reasons.push('CONFIDENCE_AND_ENERGY');
  }
  if (state.mood.tension >= policy.severeTension
    && aligned((mood) => mood.tension >= policy.severeTension)) {
    reasons.push('SEVERE_TENSION');
  }
  if (state.mood.roleHarmony <= policy.roleHarmonyCollapse
    && aligned((mood) => mood.roleHarmony <= policy.roleHarmonyCollapse)) {
    reasons.push('ROLE_HARMONY_COLLAPSE');
  }
  const positive = reasons.some((reason) => reason === 'HIGH_COHESION'
    || reason === 'CONFIDENCE_AND_ENERGY');
  const negative = reasons.some((reason) => reason === 'SEVERE_TENSION'
    || reason === 'ROLE_HARMONY_COLLAPSE');
  const mode = positive && negative ? 'MIXED_EXTREME'
    : positive ? 'POSITIVE_EXTREME'
      : negative ? 'DYSFUNCTION_EXTREME' : 'NORMAL';
  return Object.freeze({ careerId: state.careerId,
    clubId: state.clubId, season: state.season,
    stateRevision: state.revision,
    evaluatedAtDay: state.effectiveDay,
    policyId: policy.policyId, policyVersion: policy.version,
    mode, appraisalEligible: mode !== 'NORMAL',
    reasons: Object.freeze(reasons),
  });
};
