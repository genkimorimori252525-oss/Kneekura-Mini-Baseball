import { SPIN_TECHNIQUES_V123, type SpinTechniqueV123 } from '../../traits/SpinControlMasteryV123';
import { attempt, obj, integer, text, fail, list } from '../EmotionValidation';
import type { EmotionResult } from '../EmotionTypes';
import { cloneExecutionData } from '../execution/ExecutionValidation';
import { readObservedBattingMotorInputV1, planBattingMotorV1, type BattingMotorPlanInputV1, type BattingMotorPlanV1 } from './BattingMotorPlanV1';
import { MEASURED_BATTING_REPERTOIRE_CONTACT_AIM_V138 } from './MeasuredBattingTrajectoryV1';

type Ref = Readonly<{ sourceId: string; sourceVersion: string }>;
/** A Native host authenticates the complete registered payload before adding
 * this tag. It certifies neither a C1 interpolator nor optional motor controls. */
export const REGISTERED_MEASURED_LINEAR_V133 = 'registered_measured_linear_v133' as const;
export const REGISTERED_MEASURED_AIM_V138 = 'registered_measured_contact_aim_v138' as const;
export type RegisteredMeasuredImplementationV138=typeof REGISTERED_MEASURED_LINEAR_V133|typeof REGISTERED_MEASURED_AIM_V138;
/** Identity only; Native qualification still authenticates the full original
 * profile, candidate, equipment and repertoire Source before exposing a tag. */
export const registeredMeasuredImplementationV138=(repertoireVersion:string):RegisteredMeasuredImplementationV138=>
  repertoireVersion===MEASURED_BATTING_REPERTOIRE_CONTACT_AIM_V138?REGISTERED_MEASURED_AIM_V138:REGISTERED_MEASURED_LINEAR_V133;
export type QualifiedSpinMotorV123 = Readonly<{ technique: SpinTechniqueV123; qualificationRef: Ref; acceptedAtDay: number;
  repertoireRef: Ref; calibration: Ref & Readonly<{ status: 'MODEL_VERIFIED' | 'UNVERIFIED' }>;
  motorProfileRefs: readonly Readonly<{ profileId: string; version: string; implementationV133?: RegisteredMeasuredImplementationV138 }>[] }>;
export type SpinMotorPlanInputV123 = Readonly<{ base: BattingMotorPlanInputV1; atDay: number; repertoireSourceRef: Ref;
  intent: Readonly<{ technique: SpinTechniqueV123 | 'NO_SPIN_TARGET'; selectedAtTick: number }>;
  techniques: readonly QualifiedSpinMotorV123[] }>;
export type SpinMotorContextV123 = Omit<SpinMotorPlanInputV123, 'base'>;
type Fallback = 'UNMASTERED_TECHNIQUE' | 'FUTURE_MASTERY_SOURCE' | 'UNVERIFIED_CALIBRATION' | 'REPERTOIRE_UNAVAILABLE' | 'MOTOR_INFEASIBLE';
export type SpinMotorPlanV123 = Readonly<{ boundary: 'SPIN_MOTOR_PLAN_ONLY'; selectedAtTick: number;
  declaredIntent: SpinMotorPlanInputV123['intent']['technique']; selectedIntent: SpinMotorPlanInputV123['intent']['technique'];
  selectedQualificationRef: Ref | null; fallbackReason: Fallback | null; plan: BattingMotorPlanV1 }>;
const ref = (raw: unknown, path: string): Ref => {
  const v = obj(raw, ['sourceId', 'sourceVersion'], path);
  return { sourceId: text(v.sourceId, path + '.sourceId'), sourceVersion: text(v.sourceVersion, path + '.sourceVersion') };
};
const sameRef = (a: Ref, b: Ref) => a.sourceId === b.sourceId && a.sourceVersion === b.sourceVersion;

/** Semantic planning boundary, not Native admission or an action commitment.
 * The Host must obtain Player/scope/qualification bindings from its original
 * owners. Raw JSON, Gold labels and this plan do not authenticate a skill.
 * Only the observer's already delivered forecast enters the existing motor. */
export function readSpinMotorContextV123(raw: unknown, decisionTick: number, profileCount: number): SpinMotorContextV123 {
    const p = 'batting.spinMotorV123', v = obj(cloneExecutionData(raw, p), ['atDay', 'repertoireSourceRef', 'intent', 'techniques'], p);
    const atDay = integer(v.atDay, p + '.atDay'), repertoireRef = ref(v.repertoireSourceRef, p + '.repertoireSourceRef');
    const intent = obj(v.intent, ['technique', 'selectedAtTick'], p + '.intent');
    const declaredIntent = intent.technique as SpinMotorPlanInputV123['intent']['technique'];
    const selectedAtTick = integer(intent.selectedAtTick, p + '.selectedAtTick');
    if (declaredIntent !== 'NO_SPIN_TARGET' && !SPIN_TECHNIQUES_V123.includes(declaredIntent)
      || selectedAtTick > decisionTick) fail('INVALID_INPUT', p + '.futureOrUnknownIntent');
    const techniques = list(v.techniques, (rawTechnique, q) => {
      const t = obj(rawTechnique, ['technique', 'qualificationRef', 'acceptedAtDay', 'repertoireRef', 'calibration', 'motorProfileRefs'], q);
      if (!SPIN_TECHNIQUES_V123.includes(t.technique as SpinTechniqueV123)) fail('INVALID_INPUT', q + '.technique');
      const calibration = obj(t.calibration, ['sourceId', 'sourceVersion', 'status'], q + '.calibration');
      if (calibration.status !== 'MODEL_VERIFIED' && calibration.status !== 'UNVERIFIED') fail('INVALID_INPUT', q + '.calibration.status');
      text(calibration.sourceId, q + '.calibration.sourceId'); text(calibration.sourceVersion, q + '.calibration.sourceVersion');
      const profiles = list(t.motorProfileRefs, (rawProfile, r) => {
        const explicit = !!rawProfile && typeof rawProfile === 'object' && Object.hasOwn(rawProfile, 'implementationV133');
        const profile = obj(rawProfile, ['profileId', 'version', ...(explicit ? ['implementationV133'] : [])], r);
        if (explicit && profile.implementationV133 !== REGISTERED_MEASURED_LINEAR_V133
          && profile.implementationV133 !== REGISTERED_MEASURED_AIM_V138) fail('INVALID_INPUT', r + '.implementationV133');
        return { profileId: text(profile.profileId, r + '.profileId'), version: text(profile.version, r + '.version'),
          ...(explicit ? { implementationV133: profile.implementationV133 as RegisteredMeasuredImplementationV138 } : {}) };
      }, q + '.motorProfileRefs');
      if (!profiles.length || profiles.length > profileCount
        || new Set(profiles.map(x => JSON.stringify(x))).size !== profiles.length) fail('INVALID_INPUT', q + '.motorProfileRefs');
      return { technique: t.technique as SpinTechniqueV123, qualificationRef: ref(t.qualificationRef, q + '.qualificationRef'),
        acceptedAtDay: integer(t.acceptedAtDay, q + '.acceptedAtDay'), repertoireRef: ref(t.repertoireRef, q + '.repertoireRef'),
        calibration: { ...ref({ sourceId: calibration.sourceId, sourceVersion: calibration.sourceVersion }, q + '.calibration'),
          status: calibration.status as 'MODEL_VERIFIED' | 'UNVERIFIED' }, motorProfileRefs: profiles };
    }, p + '.techniques');
    if (techniques.length > 4 || new Set(techniques.map(t => t.technique)).size !== techniques.length
      || new Set(techniques.map(t => JSON.stringify(t.qualificationRef))).size !== techniques.length) fail('INVALID_INPUT', p + '.aliasedTechnique');
    return { atDay, repertoireSourceRef: repertoireRef, intent: { technique: declaredIntent, selectedAtTick }, techniques };
}
export function calculateObservedSpinMotorPlanV123(raw: unknown): EmotionResult<SpinMotorPlanV123> {
  return attempt(() => {
    const p = 'batting.spinMotorV123', v = obj(cloneExecutionData(raw, p), ['base', 'atDay', 'repertoireSourceRef', 'intent', 'techniques'], p);
    const base = readObservedBattingMotorInputV1(v.base);
    const { atDay, repertoireSourceRef: repertoireRef, intent, techniques } = readSpinMotorContextV123({ atDay: v.atDay,
      repertoireSourceRef: v.repertoireSourceRef, intent: v.intent, techniques: v.techniques }, base.decisionTick, base.repertoire.profiles.length);
    const { technique: declaredIntent, selectedAtTick } = intent;
    const output = (selectedIntent: SpinMotorPlanV123['selectedIntent'], selectedQualificationRef: Ref | null,
      fallbackReason: Fallback | null, plan: BattingMotorPlanV1): SpinMotorPlanV123 => ({
      boundary: 'SPIN_MOTOR_PLAN_ONLY', selectedAtTick, declaredIntent, selectedIntent, selectedQualificationRef, fallbackReason, plan });
    const fallback = (reason: Fallback | null) => output('NO_SPIN_TARGET', null, reason, planBattingMotorV1(base));
    if (declaredIntent === 'NO_SPIN_TARGET') return fallback(null);
    const technique = techniques.find(t => t.technique === declaredIntent);
    if (!technique) return fallback('UNMASTERED_TECHNIQUE');
    if (technique.acceptedAtDay > atDay) return fallback('FUTURE_MASTERY_SOURCE');
    if (technique.calibration.status !== 'MODEL_VERIFIED') return fallback('UNVERIFIED_CALIBRATION');
    if (!sameRef(technique.repertoireRef, repertoireRef)) return fallback('REPERTOIRE_UNAVAILABLE');
    const candidates = technique.motorProfileRefs.filter(r => base.repertoire.profiles.some(p => p.profile.profileId === r.profileId
      && p.profile.version === r.version && p.minimumAggression <= base.aggression)
      && (base.repertoire.sampledProfiles?.some(p => p.profileId === r.profileId)
        ? r.implementationV133 === registeredMeasuredImplementationV138(base.repertoire.repertoireVersion) : r.implementationV133 === undefined));
    if (!candidates.length) return fallback('REPERTOIRE_UNAVAILABLE');
    for (const profile of candidates) {
      const candidate = attempt(() => planBattingMotorV1(base, profile));
      if (candidate.ok && candidate.value.status === 'READY') {
        const sampled = candidate.value.motion.sampledTrajectoryV1;
        if (profile.implementationV133 !== undefined && (!sampled
          || ['executionInterpolationV122', 'executionEnvelopeV133', 'motorRampSecondsV121', 'aimCorrectionV121', 'impactTrajectory'].some(k => Object.hasOwn(sampled, k)))) continue;
        return output(declaredIntent, technique.qualificationRef, null, candidate.value);
      }
    }
    return fallback('MOTOR_INFEASIBLE');
  });
}
