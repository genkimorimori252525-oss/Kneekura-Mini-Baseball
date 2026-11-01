import type { Vec3 } from '../../model/geometry';
import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import { observeBattedBallSpinV123 } from '../../sim/contact/BattedBallSpinObservationV123';
import { SPIN_TECHNIQUES_V123, type SpinTechniqueV123 } from './SpinControlMasteryV123';

type ProfileRef = Readonly<{ profileId: string; version: string }>;
export type SpinMotorContactV123 = Readonly<{ profileRef: ProfileRef; velocityMps: Vec3; spinRadPerSecond: Vec3; bats: 'R' | 'L' }>;
export type SpinMotorQualificationInputV123 = Readonly<{ technique: SpinTechniqueV123; minimumIntentionalContacts: number;
  minimumDirectionalSpinRadPerSecond: number; minimumSuccessFraction: number; contacts: readonly SpinMotorContactV123[] }>;
const fields = (v: unknown, keys: readonly string[]) => !!v && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const id = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.trim() === v;
const component = { SLICE: 'sliceRadPerSecond', HOOK: 'hookRadPerSecond', BACKSPIN: 'backspinRadPerSecond', TOPSPIN: 'topspinRadPerSecond' } as const;
function freeze<T>(v: T): T { if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

/** Necessary physical evidence only, not practice ownership or a human skill
 * certification. Every bound motor must separately meet the explicit minimum;
 * an aggregate success rate cannot certify a different, unsuccessful motor. */
export function assessSpinMotorProfilesV123(raw: SpinMotorQualificationInputV123) {
  const i = cloneInert(raw);
  if (!fields(i, ['technique', 'minimumIntentionalContacts', 'minimumDirectionalSpinRadPerSecond', 'minimumSuccessFraction', 'contacts'])
    || !SPIN_TECHNIQUES_V123.includes(i.technique) || !Number.isSafeInteger(i.minimumIntentionalContacts) || i.minimumIntentionalContacts < 1
    || !Number.isFinite(i.minimumDirectionalSpinRadPerSecond) || i.minimumDirectionalSpinRadPerSecond <= 0
    || !Number.isFinite(i.minimumSuccessFraction) || i.minimumSuccessFraction <= 0 || i.minimumSuccessFraction > 1
    || !Array.isArray(i.contacts)) throw Error('invalid explicit per-profile spin qualification');
  const groups = new Map<string, { profileRef: ProfileRef; contacts: number; successful: number }>();
  let successfulContacts = 0;
  for (const c of i.contacts) {
    if (!fields(c, ['profileRef', 'velocityMps', 'spinRadPerSecond', 'bats']) || !fields(c.profileRef, ['profileId', 'version'])
      || !Object.values(c.profileRef).every(id)) throw Error('invalid original spin motor contact profile');
    const observation = observeBattedBallSpinV123({ velocityMps: c.velocityMps, spinRadPerSecond: c.spinRadPerSecond, bats: c.bats });
    const key = JSON.stringify([c.profileRef.profileId, c.profileRef.version]), group = groups.get(key)
      ?? { profileRef: c.profileRef, contacts: 0, successful: 0 };
    group.contacts++;
    if (observation.basisStatus === 'DEFINED' && observation[component[i.technique]] >= i.minimumDirectionalSpinRadPerSecond) {
      group.successful++; successfulContacts++;
    }
    groups.set(key, group);
  }
  const qualifiedProfiles: ProfileRef[] = [], rejectedProfiles: { profileRef: ProfileRef; contacts: number; successful: number;
    reason: 'INSUFFICIENT_CONTACTS' | 'DIRECTIONAL_CONTROL_NOT_REPRODUCED' }[] = [];
  for (const [, group] of [...groups].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) {
    if (group.contacts < i.minimumIntentionalContacts) rejectedProfiles.push({ ...group, reason: 'INSUFFICIENT_CONTACTS' });
    else if (group.successful / group.contacts < i.minimumSuccessFraction) rejectedProfiles.push({ ...group, reason: 'DIRECTIONAL_CONTROL_NOT_REPRODUCED' });
    else qualifiedProfiles.push(group.profileRef);
  }
  return freeze({ qualifiedProfiles, rejectedProfiles, totalContacts: i.contacts.length, successfulContacts });
}
