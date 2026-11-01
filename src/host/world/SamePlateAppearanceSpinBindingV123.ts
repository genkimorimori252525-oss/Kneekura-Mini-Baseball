import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { SPIN_TECHNIQUES_V123 } from '../../core/world/traits/SpinControlMasteryV123';
import type { SpinMotorContextV123 } from '../../core/world/psychology/batting/SpinMotorPlanV123';
import type { BattingRepertoireValues } from '../../core/world/psychology/batting/BattingTypes';
import { actorFreeze as freeze, actorHash as hash, actorJson as json, type DurablePhysicalPlateAppearanceActor } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields as fields, samePaReferenceValid as ref, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { playerBattingModelEvidenceFromSqlite } from './PlayerBattingModelEvidence';
import { readNativeSpinControlMasteryV123 } from './SqliteSpinControlMasteryV123';
import { registeredMeasuredMotorBindingV133 } from './StandaloneMeasuredPracticeV133';

/** Fixed evidence pins, never a live inventory query or caller-supplied mastery.
 * The action's existing model pin remains the physical model authority. */
export type SamePaSpinBindingV123 = Readonly<{
  kind: 'fixed_native_spin_binding_v123'; modelReference: SamePaReference<'world_player_batting_models'>;
  intent: SpinMotorContextV123['intent']; qualificationReferences: readonly SamePaReference<'world_spin_mastery_v123'>[];
}>;
export const samePaSpinBindingInputV123 = (raw: unknown): SamePaSpinBindingV123 => {
  const b = cloneInert(raw) as SamePaSpinBindingV123;
  if (!fields(b, ['kind', 'modelReference', 'intent', 'qualificationReferences']) || b.kind !== 'fixed_native_spin_binding_v123'
    || !ref(b.modelReference, 'world_player_batting_models') || !fields(b.intent, ['technique', 'selectedAtTick'])
    || b.intent.technique !== 'NO_SPIN_TARGET' && !SPIN_TECHNIQUES_V123.includes(b.intent.technique)
    || !Number.isSafeInteger(b.intent.selectedAtTick) || b.intent.selectedAtTick < 0
    || !Array.isArray(b.qualificationReferences) || b.qualificationReferences.length > 4
    || b.qualificationReferences.some(r => !ref(r, 'world_spin_mastery_v123'))
    || new Set(b.qualificationReferences.map(r => r.sourceId)).size !== b.qualificationReferences.length) {
    throw new Error('invalid fixed Native spin binding v123');
  }
  return freeze(b);
};

/** Transfer policy only, not a Native authenticator. Existing owners have
 * already validated both repertoires and qualified refs. Equal IDs alone do
 * not certify a calibrated motor: bind its course, admission threshold,
 * optional measured keys and registration mode to the original payload. */
export const samePaSpinTechniquesForEffectiveRepertoireV123 = (techniques: SpinMotorContextV123['techniques'],
  original: BattingRepertoireValues, effective: BattingRepertoireValues): SpinMotorContextV123['techniques'] => {
  if (original.repertoireId !== effective.repertoireId || original.repertoireVersion !== effective.repertoireVersion) return [];
  return techniques.flatMap(technique => {
    const motorProfileRefs = technique.motorProfileRefs.filter(r => {
      const accepted = original.profiles.find(p => p.profile.profileId === r.profileId && p.profile.version === r.version);
      const actual = effective.profiles.find(p => p.profile.profileId === r.profileId && p.profile.version === r.version);
      return accepted !== undefined && actual !== undefined && json(accepted) === json(actual)
        && json(original.sampledProfiles?.find(p => p.profileId === r.profileId) ?? null)
          === json(effective.sampledProfiles?.find(p => p.profileId === r.profileId) ?? null);
    });
    return motorProfileRefs.length ? [{ ...technique, motorProfileRefs }] : [];
  });
};

/** Called only by the physical owner inside its current/historical Native
 * transaction. Replays reread these exact Source IDs, never selectAtDay. */
export const readSamePaSpinContextV123 = (db: DatabaseSync, raw: SamePaSpinBindingV123, basis: Readonly<{
  actor: DurablePhysicalPlateAppearanceActor; modelReference: SamePaReference<'world_player_batting_models'>; decisionTick: number;
  effectiveRepertoire: BattingRepertoireValues;
}>): SpinMotorContextV123 => {
  const b = samePaSpinBindingInputV123(raw), { actor } = basis;
  if (json(b.modelReference) !== json(basis.modelReference) || b.intent.selectedAtTick > basis.decisionTick) {
    throw new Error('physical spin original model or intent timing differs');
  }
  const model = playerBattingModelEvidenceFromSqlite(db).read(b.modelReference.sourceId);
  if (!model || hash(model.source) !== b.modelReference.sourceHash || hash(model) !== b.modelReference.snapshotHash
    || model.source.careerId !== actor.binding.careerId || model.source.playerId !== actor.binding.playerId
    || model.source.personId !== actor.binding.personId || model.source.personLinkSourceId !== actor.person.sourceId
    || model.source.acceptedAtDay > actor.binding.gameDay) throw new Error('physical spin original Player/model differs');
  const techniques = b.qualificationReferences.map(pin => {
    const qualification = readNativeSpinControlMasteryV123(db, pin.sourceId);
    if (!qualification || hash(qualification.source) !== pin.sourceHash || hash(qualification) !== pin.snapshotHash) {
      throw new Error('physical spin fixed qualification missing or hash differs');
    }
    const s = qualification.source;
    if (s.careerId !== actor.binding.careerId || s.playerId !== actor.binding.playerId
      || s.personLinkSourceId !== actor.person.sourceId || qualification.person.personId !== actor.binding.personId
      || s.acceptedAtDay > actor.binding.gameDay || json(s.repertoireRef) !== json(model.source.repertoireRef)) {
      throw new Error('physical spin qualification Player, day or repertoire differs');
    }
    const motorProfileRefs = qualification.motorProfileRefs.flatMap(r => {
      const measured = basis.effectiveRepertoire.sampledProfiles?.some(p => p.profileId === r.profileId);
      if (!measured) return !qualification.motorBindingsV133 || qualification.courseMotorProfileRefsV133?.some(p => json(p) === json(r)) ? [r] : [];
      if (!qualification.motorBindingsV133) return [];
      const effective = registeredMeasuredMotorBindingV133(basis.effectiveRepertoire, model.equipment.values, r);
      const matches = qualification.motorBindingsV133.filter(p => json(p) === json(effective));
      return matches.length === 1 ? [{ ...r, implementationV133: matches[0].implementationV133 }] : [];
    });
    return { technique: s.technique, qualificationRef: { sourceId: s.sourceId, sourceVersion: s.sourceVersion },
      acceptedAtDay: s.acceptedAtDay, repertoireRef: s.repertoireRef,
      calibration: { sourceId: qualification.calibration.sourceId, sourceVersion: qualification.calibration.sourceVersion,
        status: qualification.calibration.status }, motorProfileRefs };
  });
  if (new Set(techniques.map(t => t.technique)).size !== techniques.length) throw new Error('physical spin duplicate technique qualification');
  return freeze({ atDay: actor.binding.gameDay, repertoireSourceRef: model.source.repertoireRef, intent: b.intent,
    techniques: samePaSpinTechniquesForEffectiveRepertoireV123(techniques, model.repertoire.values, basis.effectiveRepertoire) });
};
