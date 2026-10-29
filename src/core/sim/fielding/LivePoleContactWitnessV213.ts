import { cloneInert } from '../../adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../model/geometry';
import type { BallWorldBoundaryContact, BallWorldMoment } from '../ball/BallWorldContinuation';
import type { SourceFreeBallWorldQueryResultV2, SourceFreePoleQueryInputV148, SourceFreePoleSessionInputV148 } from '../ball/SourceFreeBallWorldQuery';

type PoleSurfaceContact = Extract<BallWorldBoundaryContact, { kind: 'surface' }>;
type PoleSearch = Pick<Exclude<SourceFreeBallWorldQueryResultV2, { kind: 'unresolved' }>,
  'authority' | 'phase' | 'numericalResolution' | 'contactSearchWitnesses'>;
export type LivePoleContactCaptureV213 = Readonly<{
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  geometry: Readonly<{
    bases: Readonly<Record<'home' | 'first' | 'second' | 'third', Vec3>>;
    fence: Readonly<{ fenceCenter: Vec3; fenceRadiusMeters: number; fenceHeightMeters: number }>;
    equipment: SourceFreePoleSessionInputV148;
  }>;
  sourceQuery: SourceFreePoleQueryInputV148;
  contact: PoleSurfaceContact;
  search: PoleSearch;
  /** A binding to the emitted fact prefix and original Source interval. This
   * does not authenticate the complete Live physical contact history. */
  prefixBinding: Readonly<{
    playInitialMoment: BallWorldMoment; precedingFactCount: number; hasThrown: boolean;
    firstGroundContactSeconds: number | null; firstFielderTouchSeconds: number | null;
  }>;
}>;
export type LivePoleContactWitnessV213 = Omit<LivePoleContactCaptureV213, 'contact'> & Readonly<{
  version: 'live_pole_contact_witness_v213';
  contact: Omit<PoleSurfaceContact, 'kind'> & Readonly<{ kind: 'pole' }>;
}>;

const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};

/** Copy one already selected, unrounded Live contact before its response. No
 * numerical query, contact reconstruction, complete-prefix proof or adopted
 * legal policy is created here. The caller appends only after its existing
 * pole impulse succeeds; this packet grants no territory, HR or custody. */
export const captureLivePoleContactWitnessV213 = (input: LivePoleContactCaptureV213): LivePoleContactWitnessV213 => {
  return freeze(cloneInert({ version: 'live_pole_contact_witness_v213' as const,
    clock: input.clock, geometry: input.geometry, sourceQuery: input.sourceQuery,
    contact: { ...input.contact, kind: 'pole' as const }, search: input.search, prefixBinding: input.prefixBinding }));
};
