import { describe, expect, it } from 'vitest';
import {
  createBaseballRealityProfileV1,
  createRealityGroundFlightParameters,
} from './BaseballRealityProfileV1';

const material = (
  id: string,
) => ({
  materialId: id,
  version: 'evidence-v1',
  response: {
    kind: 'static' as const,
    contact: {
      normalRestitution: 0.4,
      tangentialRestitution: 0.2,
      frictionCoefficient: 0.3,
    },
  },
  slidingFrictionCoefficient: 0.2,
  rollingDecelerationMps2: 1,
});

describe('baseball reality profile v1', () => {
  it('requires one explicit evidence-backed physical bundle rather than hidden generic defaults', () => {
    const reality =
      createBaseballRealityProfileV1({
        atmosphere: {
          temperatureC: 25,
          relativeHumidity: 0.6,
          pressurePa: 101325,
          windVelocityMps: {
            x: 0,
            y: 0,
            z: 2,
          },
        },
        woodBat: {
          profileId: 'bat-a',
          version: 'measured-v1',
          normalRestitutionKnots: [
            {
              relativeImpactSpeedMps: 30,
              normalRestitution: 0.50,
            },
            {
              relativeImpactSpeedMps: 60,
              normalRestitution: 0.45,
            },
          ],
          tangentialRestitution: 0.46,
          frictionCoefficient: 0.15,
          evidenceIds: [
            'same-bat-speed-test',
            'game-speed-tangential-test',
          ],
        },
        field: {
          infieldDirt:
            material('dirt'),
          naturalGrass:
            material('grass'),
          artificialTurf:
            material('turf'),
          warningTrack:
            material('warning-track'),
          wall:
            material('wall'),
        },
      });

    expect(
      reality.architectureVersion,
    ).toBe(
      'baseball-physics-architecture-v1',
    );
    expect(
      reality.flightParameters
        .aerodynamics,
    ).not.toBeNull();
    expect(
      reality.flightParameters
        .groundSurfacePhysics,
    ).toBeNull();
  });

  it('selects the actual field material explicitly for each batted-ball surface segment', () => {
    const reality =
      createBaseballRealityProfileV1({
        atmosphere: {
          temperatureC: 20,
          relativeHumidity: 0.5,
          pressurePa: 100000,
          windVelocityMps: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        woodBat: {
          profileId: 'bat-a',
          version: 'measured-v1',
          normalRestitutionKnots: [
            {
              relativeImpactSpeedMps: 30,
              normalRestitution: 0.50,
            },
            {
              relativeImpactSpeedMps: 60,
              normalRestitution: 0.45,
            },
          ],
          tangentialRestitution: 0.46,
          frictionCoefficient: 0.15,
          evidenceIds: [
            'same-bat-speed-test',
          ],
        },
        field: {
          infieldDirt:
            material('dirt'),
          naturalGrass:
            material('grass'),
          warningTrack:
            material('warning-track'),
          wall:
            material('wall'),
        },
      });

    const dirt =
      createRealityGroundFlightParameters(
        reality,
        reality.field.infieldDirt,
      );
    const grass =
      createRealityGroundFlightParameters(
        reality,
        reality.field.naturalGrass,
      );

    expect(
      dirt.groundSurfacePhysics
        ?.material?.materialId,
    ).toBe('dirt');
    expect(
      grass.groundSurfacePhysics
        ?.material?.materialId,
    ).toBe('grass');
  });

  it('derives atmosphere from weather inputs and avoids fixed air density', () => {
    const cold =
      createBaseballRealityProfileV1({
        atmosphere: {
          temperatureC: 5,
          relativeHumidity: 0.5,
          pressurePa: 101325,
          windVelocityMps: {
            x: 0,
            y: 0,
            z: 0,
          },
        },
        woodBat: {
          profileId: 'bat-a',
          version: 'v1',
          normalRestitutionKnots: [
            {
              relativeImpactSpeedMps: 30,
              normalRestitution: 0.5,
            },
            {
              relativeImpactSpeedMps: 60,
              normalRestitution: 0.45,
            },
          ],
          tangentialRestitution: 0.46,
          frictionCoefficient: 0.15,
          evidenceIds: ['lab'],
        },
        field: {
          infieldDirt: material('dirt'),
          naturalGrass: material('grass'),
          warningTrack: material('track'),
          wall: material('wall'),
        },
      });

    const hot =
      createBaseballRealityProfileV1({
        atmosphere: {
          ...cold.atmosphere,
          temperatureC: 35,
        },
        woodBat: cold.woodBat,
        field: cold.field,
      });

    expect(
      cold.flightParameters
        .aerodynamics!.airDensityKgM3,
    ).toBeGreaterThan(
      hot.flightParameters
        .aerodynamics!.airDensityKgM3,
    );
  });
});
