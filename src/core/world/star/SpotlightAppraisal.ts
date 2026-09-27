import type { AppraisalInput, ImportanceInput } from
  '../psychology/appraisal/AppraisalTypes';
import { RESPONSE_AXES } from '../psychology/appraisal/AppraisalTypes';
import { readImportance, readStamp } from
  '../psychology/appraisal/ImportanceValidation';
import { computeImportance } from '../psychology/appraisal/MatchImportance';

/** Realized response is a Player source, independent of hidden candidate tier or Star status. */
export type RealizedSpotlightResponse = Readonly<{
  careerId: string;
  playerId: string;
  profileVersion: string;
  effectiveDay: number;
  activation: number;
  stability: number;
  pressureConversion: number;
}>;
export type SpotlightAppraisalPolicy = Readonly<{
  policyId: string;
  version: string;
  availableAtDay: number;
  activationScale: number;
  stabilityScale: number;
  conversionScale: number;
}>;
export type SpotlightAppraisalInput = Readonly<{
  importance: ImportanceInput;
  player: AppraisalInput['player'];
  atDay: number;
  profile: RealizedSpotlightResponse;
  policy: SpotlightAppraisalPolicy;
}>;
export type SpotlightAppraisalProjection = Readonly<{
  player: AppraisalInput['player'];
  provenance: Readonly<{
    basePlayerSourceId: string;
    basePlayerRevision: number;
    profileVersion: string;
    policyId: string;
    policyVersion: string;
    importanceModelVersion: string;
    matchImportance: number;
  }>;
}>;

const id = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value === value.trim();
const day = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const unit = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
    && value >= 0 && value <= 1;
const clamp = (value: number): number =>
  Math.max(0, Math.min(1, value));

/** Supplies only a transient psychology source for the existing appraisal pipeline. */
export const projectSpotlightAppraisalResponse = (
  input: SpotlightAppraisalInput,
): SpotlightAppraisalProjection => {
  const importance = computeImportance(readImportance(input.importance));
  const { player, profile, policy } = input;
  const baseStamp = readStamp(player?.stamp, 'spotlight.player.stamp',
    importance.provenance.time,
    importance.provenance.model.maxSourceAgeTicks);
  if (!player || !id(player.stamp?.sourceId)
    || !Number.isSafeInteger(player.stamp.revision)
    || player.stamp.revision < 0
    || !player.scope
    || player.scope.careerId !== importance.provenance.scope.careerId
    || player.scope.matchId !== importance.provenance.scope.matchId
    || player.scope.playerId !== importance.provenance.scope.playerId
    || !unit(player.longTermStrain)
    || !player.response
    || Object.keys(player.response).length !== RESPONSE_AXES.length
    || RESPONSE_AXES.some((axis) => !unit(player.response[axis]))) {
    throw new Error('spotlight appraisal player scope mismatch');
  }
  if (!profile || !id(profile.profileVersion)
    || profile.careerId !== player.scope.careerId
    || profile.playerId !== player.scope.playerId) {
    throw new Error('spotlight response profile scope mismatch');
  }
  if (!unit(profile.activation) || !unit(profile.stability)
    || !unit(profile.pressureConversion)) {
    throw new Error('invalid spotlight response profile');
  }
  if (!day(input.atDay) || !day(profile.effectiveDay)
    || profile.effectiveDay > input.atDay) {
    throw new Error('future spotlight response profile');
  }
  if (!policy || !id(policy.policyId) || !id(policy.version)
    || !unit(policy.activationScale)
    || !unit(policy.stabilityScale)
    || !unit(policy.conversionScale)) {
    throw new Error('invalid spotlight appraisal policy');
  }
  if (!day(policy.availableAtDay)
    || policy.availableAtDay > input.atDay) {
    throw new Error('future spotlight appraisal policy');
  }
  const pressure = importance.value;
  const activation = pressure * (2 * profile.activation - 1)
    * policy.activationScale;
  const stability = pressure * (2 * profile.stability - 1)
    * policy.stabilityScale;
  const conversion = pressure
    * (2 * profile.pressureConversion - 1)
    * policy.conversionScale;
  const response = Object.freeze({ ...player.response,
    concentration: clamp(player.response.concentration + activation),
    stability: clamp(player.response.stability + stability),
    confidence: clamp(player.response.confidence + conversion / 2),
    competitiveness: clamp(player.response.competitiveness
      + conversion / 2),
  });
  const projectedPlayer: AppraisalInput['player'] = Object.freeze({
    stamp: Object.freeze({
      sourceId: JSON.stringify(['spotlight-response-v1',
        baseStamp.sourceId, profile.profileVersion,
        policy.policyId, policy.version,
        importance.provenance.contextId]),
      revision: baseStamp.revision,
      time: importance.provenance.time,
    }),
    scope: player.scope, response,
    longTermStrain: player.longTermStrain,
  });
  return Object.freeze({ player: projectedPlayer,
    provenance: Object.freeze({
      basePlayerSourceId: baseStamp.sourceId,
      basePlayerRevision: baseStamp.revision,
      profileVersion: profile.profileVersion,
      policyId: policy.policyId, policyVersion: policy.version,
      importanceModelVersion: importance.provenance.model.version,
      matchImportance: pressure,
    }),
  });
};
