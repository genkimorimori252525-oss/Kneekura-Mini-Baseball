import {
  readFileSync,
} from 'node:fs';
import {
  join,
} from 'node:path';
import {
  describe,
  expect,
  it,
} from 'vitest';

const productionPaths = [
  'src/core/sim/plateAppearance/CommandedSwingKinematicsV1PitchAdapter.ts',
  'src/core/sim/plateAppearance/CommandedPlateAppearanceSequence.ts',
  'src/core/sim/plateAppearance/CommandedPlateAppearanceCoordinator.ts',
  'src/core/sim/pitching/CatcherLedPlateAppearanceSequence.ts',
  'src/core/sim/pitching/SwingKinematicsV1PitchAgainstBatter.ts',
] as const;

const forbiddenProductionPatterns = [
  /from\s+['"](?:\.\.\/pitching\/|\.\/)?PitchAgainstBatter['"]/,
  /from\s+['"](?:\.\.\/pitching\/|\.\/)?AerodynamicPitchAgainstBatter['"]/,
  /from\s+['"](?:\.\.\/pitching\/|\.\/)?SwingingPitchPhysicalResult['"]/,
  /from\s+['"](?:\.\.\/pitching\/|\.\/)?AerodynamicSwingingPitchPhysicalResult['"]/,
  /\bsampleCompatibilityBatterSwingState\s*\(/,
  /\bresolveAndRecordPitchAgainstBatter\s*\(/,
  /\bresolveSwingingPitchPhysicalResult\s*\(/,
  /\bresolveAerodynamicSwingingPitchPhysicalResult\s*\(/,
] as const;

const readSource = (
  path: string,
): string => readFileSync(
  join(process.cwd(), path),
  'utf8',
);

describe('production Swing Kinematics v1 path isolation', () => {
  it('keeps active production modules free of legacy first-order swing dependencies', () => {
    for (
      const path
      of productionPaths
    ) {
      const source =
        readSource(path);
      for (
        const forbidden
        of forbiddenProductionPatterns
      ) {
        expect(
          source,
          `${path} must not depend on legacy pattern ${String(forbidden)}`,
        ).not.toMatch(
          forbidden,
        );
      }
    }
  });

  it('makes the production command adapter structurally independent of the legacy adapter', () => {
    const production =
      readSource(
        'src/core/sim/plateAppearance/CommandedSwingKinematicsV1PitchAdapter.ts',
      );
    const activeSequence =
      readSource(
        'src/core/sim/plateAppearance/CommandedPlateAppearanceSequence.ts',
      );
    const catcherSequence =
      readSource(
        'src/core/sim/pitching/CatcherLedPlateAppearanceSequence.ts',
      );

    expect(production)
      .toContain(
        'SwingKinematicsV1PitchAgainstBatter',
      );
    expect(activeSequence)
      .toContain(
        'CommandedSwingKinematicsV1PitchAdapter',
      );
    expect(catcherSequence)
      .toContain(
        'simulateCatcherLedPhysicalPitch',
      );
    expect(catcherSequence)
      .toContain(
        'CommandedSwingKinematicsV1PitchAdapter',
      );
  });

  it('retains the old APIs only behind explicit compatibility markers', () => {
    const compatibilityPaths = [
      'src/core/sim/pitching/PitchAgainstBatter.ts',
      'src/core/sim/pitching/AerodynamicPitchAgainstBatter.ts',
      'src/core/sim/pitching/AnticipationAwareAerodynamicSwing.ts',
      'src/core/sim/plateAppearance/PlateAppearanceCommandPitchAdapter.ts',
      'src/core/sim/plateAppearance/PlateAppearancePitchSequence.ts',
      'src/core/sim/plateAppearance/PlateAppearanceSequenceCoordinator.ts',
      'src/core/sim/pitching/CatcherLeadCommandAdapter.ts',
    ] as const;

    for (
      const path
      of compatibilityPaths
    ) {
      expect(
        readSource(path),
        `${path} must identify itself as compatibility-only/deprecated`,
      ).toMatch(
        /compatibility|@deprecated/i,
      );
    }
  });

  it('does not introduce a biomechanics authority into the active batting path', () => {
    const combined =
      productionPaths
        .map(readSource)
        .join('\n');

    for (
      const forbidden
      of [
        'Skeletal',
        'Muscle',
        'GroundReactionForce',
        'MotionCapture',
        'JointTorque',
      ] as const
    ) {
      expect(combined)
        .not.toContain(forbidden);
    }
  });
});