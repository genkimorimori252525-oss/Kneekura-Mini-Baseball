import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { BatBallContactResult } from '../../core/sim/contact/BatBallContact';
import type { Vec3 } from '../../core/model/geometry';
import { readNativeMeasuredBattingContactV182FromSqlite, type NativeMeasuredBattingContactV182 } from './NativeMeasuredBattingContactV182';
import { readNativeMeasuredOriginalPitchContactV183FromSqlite, type NativeMeasuredOriginalPitchContactV183 } from './NativeMeasuredOriginalPitchContactV183';
import { readNativeMeasuredInitialJointContactV184FromSqlite, type NativeMeasuredInitialJointContactV184 } from './NativeMeasuredInitialJointContactV184';
import { actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { samePaFields, samePaReferenceValid, samePaText, type SamePaReference } from './SamePlateAppearanceWorkPrefix';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

export type NativeMeasuredContactReferenceV185 = SamePaReference<'pa_physical_v1_resolutions'>
  | SamePaReference<'physical_pitch_progress_actions'> | SamePaReference<'pa_initial_joint_v1_executions'>;
export type NativeMeasuredContactEvidenceV185 = NativeMeasuredBattingContactV182 | NativeMeasuredOriginalPitchContactV183 | NativeMeasuredInitialJointContactV184;
export type NativeMeasuredContactCollectionRequestV185 = Readonly<{ scope: Readonly<{ careerId: string; playerId: string }>;
  references: readonly NativeMeasuredContactReferenceV185[] }>;
export type BattingContactVectorMeasurementV185 = Readonly<{ exitVelocityMps: Vec3; exitSpinRadPerSecond: Vec3; launchAngleDeg: number }>;
export type NativeMeasuredBattingContactCollectionV185 = Readonly<{
  boundary: 'NATIVE_RAW_CONTACT_COLLECTION_ONLY'; populationCompleteness: 'EXPLICIT_REFERENCES_ONLY';
  contactIdentityResolution: 'OWNER_REFERENCE_ONLY'; chronology: 'UNRESOLVED'; classification: null;
  scope: NativeMeasuredContactCollectionRequestV185['scope'];
  contacts: readonly Readonly<{ reference: NativeMeasuredContactReferenceV185; evidence: NativeMeasuredContactEvidenceV185;
    measurement: BattingContactVectorMeasurementV185 }>[];
  requests: readonly Readonly<{ reference: NativeMeasuredContactReferenceV185; status: 'CONTACT' | 'NO_CONTACT'; contactIndex: number | null }>[];
}>;

/** Pure vector measurement only. Synthetic input never confers Native authority. */
export const measureBattingContactVectorsV185 = (contact: Pick<BatBallContactResult, 'exitVelocity' | 'exitSpin'>): BattingContactVectorMeasurementV185 =>
  freeze(cloneInert({ exitVelocityMps: contact.exitVelocity, exitSpinRadPerSecond: contact.exitSpin,
    launchAngleDeg: Math.atan2(contact.exitVelocity.y, Math.hypot(contact.exitVelocity.x, contact.exitVelocity.z)) * 180 / Math.PI }));

const owners = ['pa_physical_v1_resolutions', 'physical_pitch_progress_actions', 'pa_initial_joint_v1_executions'] as const;
const identity = (reference: NativeMeasuredContactReferenceV185) => JSON.stringify([reference.owner, reference.sourceId]);
const readContact = (db: DatabaseSync, reference: NativeMeasuredContactReferenceV185): NativeMeasuredContactEvidenceV185 | null => {
  switch (reference.owner) {
    case 'pa_physical_v1_resolutions': return readNativeMeasuredBattingContactV182FromSqlite(db, reference);
    case 'physical_pitch_progress_actions': return readNativeMeasuredOriginalPitchContactV183FromSqlite(db, reference);
    case 'pa_initial_joint_v1_executions': return readNativeMeasuredInitialJointContactV184FromSqlite(db, reference);
  }
};

/** Only the normal Native readers confer evidence authority. Explicit request
 * order is not chronology, and distinct owner references do not establish
 * distinct baseball contacts or a complete population. No cross-owner merge
 * or identity inference from payload, tick or firstPhysicalPitchSourceId occurs. */
export const readNativeMeasuredBattingContactCollectionV185FromSqlite = (
  db: DatabaseSync, input: NativeMeasuredContactCollectionRequestV185,
): NativeMeasuredBattingContactCollectionV185 => {
  const request = cloneInert(input);
  if (!samePaFields(request, ['scope', 'references']) || !samePaFields(request.scope, ['careerId', 'playerId'])
    || !samePaText(request.scope.careerId) || !samePaText(request.scope.playerId) || !Array.isArray(request.references)
    || !request.references.every(reference => owners.some(owner => samePaReferenceValid(reference, owner)))) {
    throw new Error('invalid measured contact collection request');
  }
  const identities = new Map<string, NativeMeasuredContactReferenceV185>();
  for (const reference of request.references) {
    const key = identity(reference), prior = identities.get(key);
    if (prior && (prior.sourceHash !== reference.sourceHash || prior.snapshotHash !== reference.snapshotHash)) {
      throw new Error('conflicting measured contact collection reference hashes');
    }
    identities.set(key, reference);
  }
  return withBattedVenueLegalReadSnapshot(db, () => {
    const contacts: NativeMeasuredBattingContactCollectionV185['contacts'][number][] = [],
      requests: NativeMeasuredBattingContactCollectionV185['requests'][number][] = [], cache = new Map<string, number | null>();
    for (const reference of request.references) {
      const key = identity(reference);
      if (!cache.has(key)) {
        const evidence = readContact(db, reference);
        if (evidence === null) cache.set(key, null);
        else {
          if (evidence.actor.binding.careerId !== request.scope.careerId || evidence.actor.binding.playerId !== request.scope.playerId) {
            throw new Error('measured contact collection subject differs');
          }
          cache.set(key, contacts.length);
          contacts.push({ reference, evidence: cloneInert(evidence), measurement: measureBattingContactVectorsV185(evidence.contact) });
        }
      }
      const contactIndex = cache.get(key)!;
      requests.push({ reference, status: contactIndex === null ? 'NO_CONTACT' : 'CONTACT', contactIndex });
    }
    return freeze({ boundary: 'NATIVE_RAW_CONTACT_COLLECTION_ONLY' as const, populationCompleteness: 'EXPLICIT_REFERENCES_ONLY' as const,
      contactIdentityResolution: 'OWNER_REFERENCE_ONLY' as const, chronology: 'UNRESOLVED' as const, classification: null,
      scope: request.scope, contacts, requests });
  });
};
