import { describe, expect, it } from 'vitest';
import type {
  EvidenceBackedSurfaceMaterial,
} from '../sim/ball/BaseballRealityProfileV1';
import {
  NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
} from '../sim/contact/WoodBatProductionProfileV1';
import {
  BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
} from '../sim/ball/BaseballPhysicsV1';
import {
  CURRENT_BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID,
  createCurrentBaseballPhysicsV1ProductionProfile,
} from './CurrentBaseballPhysicsV1ProductionProfile';

const material = (
  materialId: string,
): EvidenceBackedSurfaceMaterial => ({
  material: {
    materialId,
    version: 'ballpark-measured-v1',
    response: {
      kind: 'static',
      contact: {
        normalRestitution: 0.3,
        tangentialRestitution: 0.2,
        frictionCoefficient: 0.4,
      },
    },
    slidingFrictionCoefficient: 0.3,
    rollingDecelerationMps2: 1.2,
  },
  evidenceIds: [
    `fixture:${materialId}`,
  ],
  calibrationStatus: 'measured',
});

describe('current baseball physics v1 production profile', () => {
  it('uses the green readiness gate and freezes the selected global evidence profile', () => {
    const profile =
      createCurrentBaseballPhysicsV1ProductionProfile({
        atmosphere: {
          temperatureC: 20,
          relativeHumidity: 0.5,
          pressurePa: 101325,
          windVelocityMps: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        field: {
          infieldDirt: material('dirt'),
          naturalGrass: material('grass'),
          artificialTurf: material('turf'),
          warningTrack:
            material('warning-track'),
          wall: material('wall'),
        },
      });

    expect(
      CURRENT_BASEBALL_PHYSICS_V1_PRODUCTION_PROFILE_ID,
    ).toBe('baseball-reality-profile-v1');
    expect(profile.architectureVersion)
      .toBe(
        BASEBALL_PHYSICS_ARCHITECTURE_VERSION,
      );
    expect(profile.woodBat)
      .toBe(
        NATHAN_2012_WOOD_LOCAL_CONTACT_PROFILE_V1,
      );
    expect(
      profile.flightParameters.aerodynamics,
    ).not.toBeNull();
    expect(
      profile.flightParameters
        .aerodynamics?.spinDecay,
    ).toBeDefined();
    expect(
      profile.flightParameters
        .groundSurfacePhysics,
    ).toBeNull();
  });

  it('keeps scoped-out field materials explicit instead of synthesizing universal defaults', () => {
    const dirt = material('stadium-dirt');
    const grass = material('stadium-grass');
    const track = material('stadium-track');
    const wall = material('stadium-wall');

    const profile =
      createCurrentBaseballPhysicsV1ProductionProfile({
        atmosphere: {
          temperatureC: 25,
          relativeHumidity: 0.6,
          pressurePa: 100800,
          windVelocityMps: {
            x: 1,
            y: 0,
            z: 0,
          },
        },
        field: {
          infieldDirt: dirt,
          naturalGrass: grass,
          warningTrack: track,
          wall,
        },
      });

    expect(profile.field.infieldDirt)
      .toBe(dirt);
    expect(profile.field.naturalGrass)
      .toBe(grass);
    expect(profile.field.warningTrack)
      .toBe(track);
    expect(profile.field.wall)
      .toBe(wall);
  });
});
