import type { Vec2, Vec3 } from '../../core/model/geometry';
import type { AcceptedActualFieldObservation } from './ActualFieldObservation';

export type SamePaInitialDefenderObservationModelV214 = Readonly<{
  sourceId: string;
  sourceVersion: 'same_pa_initial_defender_observation_view_v214';
  evidenceAuthority: 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW';
  empiricallyCalibrated: false;
  scope: 'INITIAL_VIEW_ONLY';
  params: Readonly<{
    eyeHeightRatio: 0.92;
    eyeHorizontalOffsetMeters: Readonly<{ x: 0; z: 0 }>;
    crouchMeters: 0;
    forwardPolicy: 'PRE_PITCH_HOME_PLATE_CORE_ATAN2_SIN_COS';
    attentionPolicy: 'KNOWN_BALL_INTENT';
  }>;
}>;
export type SamePaInitialDefenderObservationInputV214 = Readonly<{
  playerId: string;
  heightMeters: number;
  bodyOriginHeightMeters: number;
  bodyPrimitiveOffset: Vec3;
  prePitchPosition: Vec2;
}>;
type View = AcceptedActualFieldObservation['view'];
const fail = (detail: string): never => { throw Error('initial defender observation nominal view ' + detail); };
const fields = (value: unknown, names: readonly string[]): value is Record<string, unknown> => value !== null && typeof value === 'object'
  && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...names].sort().join('|');
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const planar = (value: unknown): value is Vec2 => fields(value, ['x', 'z']) && Object.values(value).every(finite);
const spatial = (value: unknown): value is Vec3 => fields(value, ['x', 'y', 'z']) && Object.values(value).every(finite);
const clean = (value: number) => Object.is(value, -0) ? 0 : value;

/** A new authored model, not recovery of a saved head pose or measured eyes.
 * The .92 ratio follows LiveFielderBodyGeometryV105's existing nominal default;
 * initial home-facing follows LiveFieldPlayV1's pre-pitch yaw policy. */
export const createSamePaInitialDefenderObservationModelV214 = (sourceId: string): SamePaInitialDefenderObservationModelV214 => {
  if (!text(sourceId)) return fail('requires an explicit model Source ID');
  return Object.freeze({ sourceId, sourceVersion: 'same_pa_initial_defender_observation_view_v214',
    evidenceAuthority: 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW', empiricallyCalibrated: false, scope: 'INITIAL_VIEW_ONLY',
    params: Object.freeze({ eyeHeightRatio: 0.92, eyeHorizontalOffsetMeters: Object.freeze({ x: 0, z: 0 }), crouchMeters: 0,
      forwardPolicy: 'PRE_PITCH_HOME_PLATE_CORE_ATAN2_SIN_COS', attentionPolicy: 'KNOWN_BALL_INTENT' }) });
};
const modelInput = (raw: unknown): SamePaInitialDefenderObservationModelV214 => {
  if (!fields(raw, ['sourceId', 'sourceVersion', 'evidenceAuthority', 'empiricallyCalibrated', 'scope', 'params']) || !text(raw.sourceId)
    || raw.sourceVersion !== 'same_pa_initial_defender_observation_view_v214'
    || raw.evidenceAuthority !== 'EXPLICIT_UNCALIBRATED_GAME_NOMINAL_INITIAL_VIEW' || raw.empiricallyCalibrated !== false || raw.scope !== 'INITIAL_VIEW_ONLY')
    return fail('model identity or evidence scope differs');
  const params = raw.params;
  if (!fields(params, ['eyeHeightRatio', 'eyeHorizontalOffsetMeters', 'crouchMeters', 'forwardPolicy', 'attentionPolicy'])
    || !Object.is(params.eyeHeightRatio, 0.92) || !Object.is(params.crouchMeters, 0)
    || !fields(params.eyeHorizontalOffsetMeters, ['x', 'z']) || !Object.is(params.eyeHorizontalOffsetMeters.x, 0) || !Object.is(params.eyeHorizontalOffsetMeters.z, 0)
    || params.forwardPolicy !== 'PRE_PITCH_HOME_PLATE_CORE_ATAN2_SIN_COS' || params.attentionPolicy !== 'KNOWN_BALL_INTENT')
    return fail('requires the declared initial-only model parameters');
  return createSamePaInitialDefenderObservationModelV214(raw.sourceId);
};

/** Pure Source authoring only. The caller normally reads the existing body,
 * pre-pitch placement and home geometry; the normal observation Owner derives
 * visibility and measurements. No current ball, cursor or assignment is input. */
export const createSamePaInitialDefenderObservationViewsV214 = (rawModel: unknown,
  defenders: readonly SamePaInitialDefenderObservationInputV214[], homePlate: Vec2): Readonly<{
    model: SamePaInitialDefenderObservationModelV214;
    views: readonly Readonly<{ playerId: string; view: View }>[];
  }> => {
  const model = modelInput(rawModel);
  if (!Array.isArray(defenders) || defenders.length !== 9 || !planar(homePlate)) return fail('requires nine existing defenders and finite known home geometry');
  const players = new Set<string>(), views: Readonly<{ playerId: string; view: View }>[] = [];
  for (const body of defenders) {
    if (!fields(body, ['playerId', 'heightMeters', 'bodyOriginHeightMeters', 'bodyPrimitiveOffset', 'prePitchPosition']) || !text(body.playerId)
      || players.has(body.playerId) || !finite(body.heightMeters) || body.heightMeters <= 0
      || !finite(body.bodyOriginHeightMeters) || body.bodyOriginHeightMeters < 0 || body.bodyOriginHeightMeters > body.heightMeters
      || !spatial(body.bodyPrimitiveOffset) || !planar(body.prePitchPosition)) return fail('existing body scope or geometry differs');
    players.add(body.playerId);
    const dx = homePlate.x - body.prePitchPosition.x, dz = homePlate.z - body.prePitchPosition.z;
    if (!finite(dx) || !finite(dz)) return fail('home direction is outside finite range');
    // The sampler adds this world-axis offset to the body primitive center.
    // Subtract its existing pose offset to place the nominal eye above the root.
    const bodyRelativeEyeOffset = { x: clean(-body.bodyPrimitiveOffset.x),
      y: clean(model.params.eyeHeightRatio * body.heightMeters - body.bodyOriginHeightMeters - body.bodyPrimitiveOffset.y), z: clean(-body.bodyPrimitiveOffset.z) };
    const yaw = Math.atan2(dx, dz);
    const forward = { x: Math.sin(yaw), y: 0, z: Math.cos(yaw) };
    if (!spatial(bodyRelativeEyeOffset) || !spatial(forward)) return fail('derived nominal view overflows');
    const view: View = Object.freeze({ poseVersion: model.sourceId + ':' + model.sourceVersion,
      bodyRelativeEyeOffset: Object.freeze(bodyRelativeEyeOffset), forward: Object.freeze(forward), attentionTarget: Object.freeze({ kind: 'ball' }) });
    views.push(Object.freeze({ playerId: body.playerId, view }));
  }
  return Object.freeze({ model, views: Object.freeze(views) });
};
