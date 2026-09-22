import type {
  CanonicalPlateAppearanceEvent,
  CanonicalPlateAppearanceTimeline,
} from '../../../sim/plateAppearance/CanonicalPlateAppearanceTimeline';
import { createRigidBatSwingWindowFromKinematicsV1 } from '../../../sim/pitching/AerodynamicRigidBatSwingingPitchPhysicalResult';
import {
  resolveAndRecordAerodynamicRigidPitchAgainstBatter,
  type AerodynamicRigidPitchAgainstBatterResolution,
} from '../../../sim/pitching/AerodynamicRigidPitchAgainstBatter';
import { NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1 } from '../../../sim/contact/WoodBatProductionProfileV1';
import { resolveWoodBatSpeedResponse } from '../../../sim/contact/WoodBatSpeedResponseProfile';
import { same } from '../EmotionValidation';
import type { BattingPhysicalResolution } from './BattingTypes';

export type BattingForecastQueueStatus = Readonly<{
  kind: 'PENDING_EVENT' | 'ADOPTED' | 'UNRESOLVED_FORECAST';
  tick: number;
  settledThroughTick: number;
  nextPendingTick: number | null;
}>;

export type BattingForecastAdoption = Readonly<{
  status: 'WAITING' | 'ADOPTED' | 'MISSED_EVENT' | 'ALREADY_ADOPTED' | 'UNRESOLVED_FORECAST';
  timeline: CanonicalPlateAppearanceTimeline;
  adoptedEvents: readonly CanonicalPlateAppearanceEvent[];
  dueTick: number | null;
}>;

const validateTick = (tick: number): number => {
  if (!Number.isSafeInteger(tick) || tick < 0) {
    throw new Error('batting adoption tick must be a non-negative safe integer');
  }
  return tick;
};

const normalizeTrustedCoreOutput = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map(normalizeTrustedCoreOutput) as T;
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .map(([key, child]) => [key, normalizeTrustedCoreOutput(child)]),
  ) as T;
};

const resolutionTimeline = (
  forecast: BattingPhysicalResolution,
): CanonicalPlateAppearanceTimeline => forecast.resolution.timeline;

const assertForecastTimelineRelationship = (
  forecast: BattingPhysicalResolution,
): {
  base: CanonicalPlateAppearanceTimeline;
  final: CanonicalPlateAppearanceTimeline;
  suffix: readonly CanonicalPlateAppearanceEvent[];
  dueTick: number | null;
} => {
  const base = forecast.request.timeline;
  const final = resolutionTimeline(forecast);
  if (forecast.resolution.kind === 'unresolved') {
    if (!same(final, base)) {
      throw new Error('unresolved batting forecast must not create canonical events');
    }
    return { base, final, suffix: [], dueTick: null };
  }
  if (final.events.length <= base.events.length || final.nextSequence <= base.nextSequence) {
    throw new Error('resolved batting forecast must append canonical events');
  }
  if (
    !same(final.events.slice(0, base.events.length), base.events)
    || final.playId !== base.playId
    || final.startedAtTick !== base.startedAtTick
    || final.nextSequence !== final.events.length
    || base.nextSequence !== base.events.length
  ) {
    throw new Error('batting forecast does not extend the saved canonical timeline');
  }
  const suffix = final.events.slice(base.events.length);
  const dueTick = suffix[0]!.tick;
  if (suffix.some((event) => event.tick !== dueTick)) {
    throw new Error('one batting physical forecast may adopt only one same-tick canonical event batch');
  }
  return { base, final, suffix, dueTick };
};

const assertCurrentTimeline = (
  current: CanonicalPlateAppearanceTimeline,
  base: CanonicalPlateAppearanceTimeline,
  final: CanonicalPlateAppearanceTimeline,
  currentTick: number,
): 'BASE' | 'FINAL' => {
  if (same(current, base)) return 'BASE';
  if (same(current, final)) {
    if (current.lastEventTick > currentTick) {
      throw new Error('canonical timeline cannot contain a future batting event');
    }
    return 'FINAL';
  }
  throw new Error('canonical batting timeline cursor changed since forecast creation');
};

const recomputeResolution = (
  forecast: BattingPhysicalResolution,
  timeline: CanonicalPlateAppearanceTimeline,
): AerodynamicRigidPitchAgainstBatterResolution => {
  const source = forecast.request.accepted.proposal.request.source;
  const commitment = forecast.commitment;
  const actualTrajectory = forecast.request.actualTrajectory;
  const computed = commitment.action === 'TAKE'
    ? resolveAndRecordAerodynamicRigidPitchAgainstBatter(timeline, {
        action: { kind: 'take' },
        trajectory: actualTrajectory,
        plateZ: source.plateZ,
        strikeZone: source.strikeZone,
        ballRadiusMeters: source.ball.radiusM,
      })
    : resolveAndRecordAerodynamicRigidPitchAgainstBatter(timeline, {
        action: {
          kind: 'swing',
          swing: createRigidBatSwingWindowFromKinematicsV1(
            commitment.trajectory!,
            source.batPhysical,
          ),
        },
        trajectory: actualTrajectory,
        ball: source.ball,
        parameterResolver: (kinematics) => resolveWoodBatSpeedResponse(
          NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
          kinematics.normalApproachSpeedMps,
        ),
      });
  return normalizeTrustedCoreOutput(computed);
};

export const battingForecastQueueStatus = (
  forecast: BattingPhysicalResolution,
  currentTimeline: CanonicalPlateAppearanceTimeline,
  currentTickInput: number,
): BattingForecastQueueStatus => {
  const currentTick = validateTick(currentTickInput);
  const { base, final, dueTick } = assertForecastTimelineRelationship(forecast);
  const state = assertCurrentTimeline(currentTimeline, base, final, currentTick);
  if (state === 'FINAL') {
    return Object.freeze({
      kind: 'ADOPTED',
      tick: currentTick,
      settledThroughTick: currentTick,
      nextPendingTick: null,
    });
  }
  if (dueTick === null) {
    return Object.freeze({
      kind: 'UNRESOLVED_FORECAST',
      tick: currentTick,
      settledThroughTick: Math.min(currentTick, base.lastEventTick),
      nextPendingTick: null,
    });
  }
  if (currentTick < dueTick) {
    return Object.freeze({
      kind: 'PENDING_EVENT',
      tick: currentTick,
      settledThroughTick: currentTick,
      nextPendingTick: dueTick,
    });
  }
  return Object.freeze({
    kind: 'PENDING_EVENT',
    tick: currentTick,
    settledThroughTick: dueTick - 1,
    nextPendingTick: dueTick,
  });
};

export const adoptBattingForecastAtTick = (
  forecast: BattingPhysicalResolution,
  currentTimeline: CanonicalPlateAppearanceTimeline,
  currentTickInput: number,
): BattingForecastAdoption => {
  const currentTick = validateTick(currentTickInput);
  const relation = assertForecastTimelineRelationship(forecast);
  const state = assertCurrentTimeline(currentTimeline, relation.base, relation.final, currentTick);
  if (state === 'FINAL') {
    return Object.freeze({
      status: 'ALREADY_ADOPTED',
      timeline: currentTimeline,
      adoptedEvents: Object.freeze([]),
      dueTick: relation.dueTick,
    });
  }
  if (relation.dueTick === null) {
    return Object.freeze({
      status: 'UNRESOLVED_FORECAST',
      timeline: currentTimeline,
      adoptedEvents: Object.freeze([]),
      dueTick: null,
    });
  }
  if (currentTick < relation.dueTick) {
    return Object.freeze({
      status: 'WAITING',
      timeline: currentTimeline,
      adoptedEvents: Object.freeze([]),
      dueTick: relation.dueTick,
    });
  }
  if (currentTick > relation.dueTick) {
    return Object.freeze({
      status: 'MISSED_EVENT',
      timeline: currentTimeline,
      adoptedEvents: Object.freeze([]),
      dueTick: relation.dueTick,
    });
  }

  const recomputed = recomputeResolution(forecast, currentTimeline);
  if (!same(recomputed, forecast.resolution)) {
    throw new Error('batting physical forecast changed when recomputed at adoption');
  }
  const nextTimeline = recomputed.timeline;
  const adoptedEvents = nextTimeline.events.slice(currentTimeline.events.length);
  if (adoptedEvents.length === 0 || adoptedEvents.some((event) => event.tick !== currentTick)) {
    throw new Error('batting adoption did not produce the expected same-tick canonical event batch');
  }
  return Object.freeze({
    status: 'ADOPTED',
    timeline: nextTimeline,
    adoptedEvents: Object.freeze(adoptedEvents),
    dueTick: relation.dueTick,
  });
};
