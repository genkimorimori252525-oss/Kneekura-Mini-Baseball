import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BaseballSeamForceV1 } from '../../core/sim/ball/BaseballSeamForceV1';
import type { Quaternion } from '../../core/sim/pitching/BaseballOrientation';
import { validatePitchSnapshotV78, type PitchSnapshotV78 } from './LivePitchAuthoringV78';

export type LivePitchReleasePlanV168 = Readonly<{
  version:'live_pitch_release_plan_v168';
  pitchId:string;
  qualityState:'KIRE_CIRCLE' | 'KIRE_DOUBLE_CIRCLE' | 'THREATENING_DOUBLE_CIRCLE';
  expectedBase:Readonly<{ releaseSpeedMps:number; spinRadPerSecond:Vec3;
    releaseOrientation?:Quaternion; seamForce?:BaseballSeamForceV1 }>;
  nominal:Readonly<{ spinRadPerSecond:Vec3; releaseOrientation:Quaternion }>;
}>;

function assert(value:unknown, message:string):asserts value {
  if (!value) throw Error('live pitch release plan: ' + message);
}
function fields(raw:unknown, required:readonly string[], optional:readonly string[] = []):asserts raw is Record<string, unknown> {
  assert(raw && typeof raw === 'object' && !Array.isArray(raw)
    && required.every(key => Object.hasOwn(raw, key))
    && Object.keys(raw).every(key => required.includes(key) || optional.includes(key)), 'unknown or missing fields');
}
function sameFlat(expected:unknown, actual:unknown, keys:readonly string[]):void {
  fields(expected, keys);fields(actual, keys);
  assert(keys.every(key => Object.is(expected[key], actual[key])), 'selected pitch base changed');
}

/** Resolve author-supplied nominal spin/material only. The identifier is not a
 * force multiplier, skill assessment or authorization to change the base ball. */
export function resolveLivePitchReleasePlanV168(raw:Readonly<{
  selected:PitchSnapshotV78; request:LivePitchReleasePlanV168; maximumPitchSpeedMps?:number;
}>) {
  const input = cloneInert(raw);
  fields(input, ['selected', 'request'], ['maximumPitchSpeedMps']);
  const selected = validatePitchSnapshotV78(input.selected, input.maximumPitchSpeedMps), request = input.request;
  fields(request, ['version', 'pitchId', 'qualityState', 'expectedBase', 'nominal']);
  assert(request.version === 'live_pitch_release_plan_v168' && request.pitchId === selected.pitchId, 'plan version or pitch ID differs');
  assert(['KIRE_CIRCLE', 'KIRE_DOUBLE_CIRCLE', 'THREATENING_DOUBLE_CIRCLE'].includes(request.qualityState), 'unknown quality state');
  const expected = request.expectedBase;
  fields(expected, ['releaseSpeedMps', 'spinRadPerSecond'], ['releaseOrientation', 'seamForce']);
  assert(Object.is(expected.releaseSpeedMps, selected.releaseSpeedMps), 'selected pitch speed changed');
  sameFlat(expected.spinRadPerSecond, selected.spinRadPerSecond, ['x', 'y', 'z']);
  for (const key of ['releaseOrientation', 'seamForce'] as const)
    assert(Object.hasOwn(expected, key) === Object.hasOwn(selected, key), 'selected pitch optional base field changed');
  if (Object.hasOwn(expected, 'releaseOrientation'))
    sameFlat(expected.releaseOrientation, selected.releaseOrientation, ['w', 'x', 'y', 'z']);
  if (Object.hasOwn(expected, 'seamForce'))
    sameFlat(expected.seamForce, selected.seamForce, ['version', 'coefficientScale']);
  fields(request.nominal, ['spinRadPerSecond', 'releaseOrientation']);
  // A fresh snapshot delegates finite values, vector bounds, unit material q
  // and the unchanged speed limit to the established V78 authoring boundary.
  const nominal = validatePitchSnapshotV78({ ...selected, spinRadPerSecond:request.nominal.spinRadPerSecond,
    releaseOrientation:request.nominal.releaseOrientation }, input.maximumPitchSpeedMps);
  return Object.freeze({ pitchId:selected.pitchId, qualityState:request.qualityState,
    spinRadPerSecond:nominal.spinRadPerSecond, releaseOrientation:nominal.releaseOrientation!,
    authority:'AUTHOR_SUPPLIED_NOMINAL_RELEASE_NOT_QUALIFIED_SKILL' as const });
}
