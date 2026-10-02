import { describe, expect, it } from 'vitest';
import {
  REFERENCE_BASEBALL_AERODYNAMICS,
} from '../ball/BaseballAerodynamics';
import {
  REFERENCE_BASEBALL_RIGID_BODY,
} from '../contact/RigidBatBallContact';
import {
  IDENTITY_QUATERNION,
} from './BaseballOrientation';
import type {
  CatcherPitchCall,
} from './CatcherLead';
import {
  simulateCatcherCalledPitchSkillFlight,
} from './CatcherCalledPitchSkillFlight';
import type {
  PitchSkillCommandResponseProfile,
} from './PitchSkillCommandResponse';
import type {
  PitchSkillProfile,
} from './PitchSkillProfile';

const skill: PitchSkillProfile = {
  pitchSkillId: 'skill-1',
  releaseTemplate: {
    releasePositionOffsetM: {
      x: 0,
      y: 0,
      z: 0,
    },
    preReleaseVelocityMps: {
      x: 0,
      y: 0,
      z: -39,
    },
    preReleaseSpinRadPerSecond: {
      x: 60,
      y: 170,
      z: -20,
    },
    orientation:
      IDENTITY_QUATERNION,
    fingerImpulses: [],
  },
  repeatability: {
    releasePositionStdDevM: {
      x: 0.004,
      y: 0.004,
      z: 0.003,
    },
    preReleaseVelocityStdDevMps: {
      x: 0.12,
      y: 0.12,
      z: 0.2,
    },
    preReleaseSpinStdDevRadPerSecond: {
      x: 2,
      y: 3,
      z: 2,
    },
    orientationStdDevRad: {
      x: 0.002,
      y: 0.002,
      z: 0.002,
    },
    fingers: [],
  },
};

const response:
  PitchSkillCommandResponseProfile = {
    pitchSkillId: 'skill-1',
    attackZone: {
      inside: {
        preReleaseVelocityDeltaMps: {
          x: -0.45,
          y: 0,
          z: 0,
        },
      },
      middle: {},
      outside: {
        preReleaseVelocityDeltaMps: {
          x: 0.45,
          y: 0,
          z: 0,
        },
      },
    },
    verticalPlan: {
      low: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: -0.25,
          z: 0,
        },
      },
      middle: {},
      high: {
        preReleaseVelocityDeltaMps: {
          x: 0,
          y: 0.25,
          z: 0,
        },
      },
    },
    aggression: {
      challenge: {},
      balanced: {},
      waste: {},
    },
  };

const call = (
  attackZone:
    'inside' | 'middle' | 'outside',
  verticalPlan:
    'low' | 'middle' | 'high',
): CatcherPitchCall => ({
  catcherId: 'catcher-1',
  pitcherId: 'pitcher-1',
  pitchOrdinal: 2,
  pitchSkillId: 'skill-1',
  attackZone,
  verticalPlan,
  aggression: 'balanced',
  count: {
    balls: 1,
    strikes: 1,
  },
  managerDirective: {
    attackZone: 'outside',
    verticalPlan: 'low',
    aggression: 'balanced',
  },
});

const common = {
  skill,
  response,
  sampling: {
    matchSeed: 20260921,
    playId: 7,
    pitchOrdinal: 2,
    tick: 1_000_000,
    releaseAnchorPosition: {
      x: 0,
      y: 1.8,
      z: 16.5,
    },
    ball:
      REFERENCE_BASEBALL_RIGID_BODY,
  },
  trajectoryParameters: {
    ticksPerSecond: 1_000_000,
    integrationStepTicks: 1_000,
    gravityY: -9.81,
    aerodynamics:
      REFERENCE_BASEBALL_AERODYNAMICS,
  },
  endTick: 1_600_000,
  plateZ: 0,
} as const;

describe('catcher-called pitch skill flight', () => {
  it('lets inside/outside catcher calls change the physical release and plate path without supplying an exact target coordinate', () => {
    const inside =
      simulateCatcherCalledPitchSkillFlight({
        ...common,
        call: call(
          'inside',
          'middle',
        ),
      });
    const outside =
      simulateCatcherCalledPitchSkillFlight({
        ...common,
        call: call(
          'outside',
          'middle',
        ),
      });

    expect(
      inside.plannedSkill
        .releaseTemplate
        .preReleaseVelocityMps.x,
    ).toBeLessThan(
      outside.plannedSkill
        .releaseTemplate
        .preReleaseVelocityMps.x,
    );

    expect(
      inside.physical.flight
        .plateCrossing!.position.x,
    ).toBeLessThan(
      outside.physical.flight
        .plateCrossing!.position.x,
    );
  });

  it('applies the same deterministic execution error to the same skill/ordinal while the coarse motor plan changes', () => {
    const low =
      simulateCatcherCalledPitchSkillFlight({
        ...common,
        call: call(
          'middle',
          'low',
        ),
      });
    const high =
      simulateCatcherCalledPitchSkillFlight({
        ...common,
        call: call(
          'middle',
          'high',
        ),
      });

    expect(
      low.physical.sampledRelease
        .deltas,
    ).toEqual(
      high.physical.sampledRelease
        .deltas,
    );
    expect(
      low.physical.flight
        .plateCrossing!.position.y,
    ).toBeLessThan(
      high.physical.flight
        .plateCrossing!.position.y,
    );
  });

  it('preserves the stable pitch skill identity through catcher call and execution', () => {
    const result =
      simulateCatcherCalledPitchSkillFlight({
        ...common,
        call: call(
          'outside',
          'low',
        ),
      });

    expect(result.call.pitchSkillId)
      .toBe('skill-1');
    expect(
      result.physical.pitchSkillId,
    ).toBe('skill-1');
  });
});
