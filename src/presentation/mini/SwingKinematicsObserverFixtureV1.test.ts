import { describe, expect, it } from 'vitest';
import {
  createSwingKinematicsObserverFixtureV1,
} from './SwingKinematicsObserverFixtureV1';

describe('swing kinematics observer fixture v1', () => {
  it('exports nine courses from the production planner', () => {
    const fixture =
      createSwingKinematicsObserverFixtureV1();

    expect(fixture.source)
      .toBe(
        'core-generated-swing-kinematics-v1',
      );
    expect(fixture.courses)
      .toHaveLength(9);
    expect(
      fixture.courses.map(
        (course) => course.id,
      ),
    ).toEqual([
      'high_inside',
      'high_middle',
      'high_outside',
      'middle_inside',
      'middle_middle',
      'middle_outside',
      'low_inside',
      'low_middle',
      'low_outside',
    ]);
  });

  it('retains fixed bat length in every diagnostic sample', () => {
    const fixture =
      createSwingKinematicsObserverFixtureV1();

    for (const course of fixture.courses) {
      for (
        const frame
        of course.highFidelityFrames
      ) {
        const length =
          Math.hypot(
            frame.tip.x - frame.grip.x,
            frame.tip.y - frame.grip.y,
            frame.tip.z - frame.grip.z,
          );
        expect(length)
          .toBeCloseTo(0.84, 5);
      }
    }
  });

  it('uses 55ms Mini cadence plus exact physical boundaries without inventing interpolated display poses', () => {
    const fixture =
      createSwingKinematicsObserverFixtureV1();

    for (const course of fixture.courses) {
      const ticks =
        course.miniFrames.map(
          (frame) => frame.tick,
        );
      expect(ticks)
        .toContain(course.startTick);
      expect(ticks)
        .toContain(course.contactTick);
      expect(ticks)
        .toContain(course.endTick);

      for (const tick of ticks) {
        const isBoundary =
          tick === course.startTick
          || tick === course.contactTick
          || tick === course.endTick;
        expect(
          isBoundary
          || tick
            % fixture.miniCadenceMicros
            === 0,
        ).toBe(true);
      }
    }
  });

  it('keeps the evidence relations visible in the observer fixture', () => {
    const fixture =
      createSwingKinematicsObserverFixtureV1();
    const byId =
      new Map(
        fixture.courses.map(
          (course) => [
            course.id,
            course,
          ] as const,
        ),
      );

    expect(
      byId.get('high_inside')!
        .preferredContactDepthM,
    ).toBeGreaterThan(
      byId.get('low_outside')!
        .preferredContactDepthM,
    );
    expect(
      byId.get('middle_inside')!
        .preferredContactDepthM,
    ).toBeGreaterThan(
      byId.get('middle_outside')!
        .preferredContactDepthM,
    );
    expect(
      byId.get('low_middle')!
        .attackAngleDeg,
    ).toBeGreaterThan(
      byId.get('high_middle')!
        .attackAngleDeg,
    );
  });

  it('is deterministic including existing Mini Batter POV projection', () => {
    expect(
      createSwingKinematicsObserverFixtureV1(),
    ).toEqual(
      createSwingKinematicsObserverFixtureV1(),
    );
  });

  it('emits deterministic fixture chunks for repository snapshot generation', () => {
    const encoded =
      Buffer.from(
        JSON.stringify(
          createSwingKinematicsObserverFixtureV1(),
        ),
        'utf8',
      ).toString('base64');
    const chunkSize = 3_000;

    for (
      let offset = 0, index = 0;
      offset < encoded.length;
      offset += chunkSize, index += 1
    ) {
      console.log(
        'SWING_OBSERVER_FIXTURE_CHUNK '
        + String(index).padStart(4, '0')
        + ' '
        + encoded.slice(
          offset,
          offset + chunkSize,
        ),
      );
    }

    expect(encoded.length)
      .toBeGreaterThan(0);
  });

});