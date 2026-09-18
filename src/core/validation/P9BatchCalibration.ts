import type {
  Vec2,
} from '../model/geometry';
import {
  DeterministicRng,
} from '../rng/DeterministicRng';
import {
  advanceDefenderMotion,
  type DefenderMotionParameters,
} from '../sim/fielding/DefenderMotion';
import {
  createDefensiveAlignment,
  type DefensiveAlignment,
} from '../sim/strategy/DefensiveAlignment';
import {
  aggregateValidationOutcomes,
  type BatchValidationStatistics,
} from './BatchValidationStatistics';
import {
  createCanonicalEvidenceFingerprint,
} from './CanonicalEvidenceFingerprint';
import {
  compareSameContactDefensiveAlignments,
  type DefensiveContactClassification,
  type SameContactComparisonContact,
} from './SameContactAlignmentComparison';

export type P9BatchCalibrationContactEvidence =
  Readonly<{
    target: Vec2;
    fieldingWindowTicks: number;
    runnerOnSecond: boolean;
    runnerOnThird: boolean;
  }>;

export type P9BatchCalibrationAlignmentResult =
  Readonly<{
    alignmentId: string;
    statistics: BatchValidationStatistics;
    extraBaseHits: number;
    evaluationsFingerprint: string;
  }>;

export type P9BatchCalibrationResult =
  Readonly<{
    seed: number;
    samples: number;
    contactsFingerprint: string;
    alignments:
      readonly P9BatchCalibrationAlignmentResult[];
    calibrationFingerprint: string;
  }>;

const MOTION_PARAMETERS:
  DefenderMotionParameters = Object.freeze({
    ticksPerSecond: 1_000_000,
    maxIntegrationStepTicks: 20_000,
    accelerationMps2: 5,
    brakingMps2: 5,
    topSpeedMps: 8,
    arrivalRadiusMeters: 0.4,
  });

const NORMAL_ALIGNMENT =
  createDefensiveAlignment([
    {
      playerId: 'p',
      registeredPosition: 'P',
      start: { x: 0, z: 18 },
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      start: { x: 0, z: -2 },
    },
    {
      playerId: '1b',
      registeredPosition: '1B',
      start: { x: 20, z: 20 },
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      start: { x: 8, z: 24 },
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      start: { x: -20, z: 20 },
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      start: { x: -8, z: 24 },
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      start: { x: -30, z: 55 },
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      start: { x: 0, z: 60 },
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      start: { x: 30, z: 55 },
    },
  ]);

const PULL_HEAVY_ALIGNMENT =
  createDefensiveAlignment([
    {
      playerId: 'p',
      registeredPosition: 'P',
      start: { x: 0, z: 18 },
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      start: { x: 0, z: -2 },
    },
    {
      playerId: '1b',
      registeredPosition: '1B',
      start: { x: 20, z: 20 },
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      start: { x: -8, z: 24 },
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      start: { x: -20, z: 20 },
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      start: { x: -16, z: 28 },
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      start: { x: -25, z: 42 },
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      start: { x: -14, z: 38 },
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      start: { x: 30, z: 55 },
    },
  ]);

const quantizeCoordinate = (
  value: number,
): number => (
  Math.round(value * 1_000_000)
  / 1_000_000
);

const validateSeed = (
  seed: number,
): void => {
  if (
    !Number.isInteger(seed)
    || seed < 0
    || seed > 0xffff_ffff
  ) {
    throw new Error(
      'calibration seed must be an unsigned 32-bit integer',
    );
  }
};

const validateSamples = (
  samples: number,
): void => {
  if (
    !Number.isSafeInteger(samples)
    || samples <= 0
  ) {
    throw new Error(
      'calibration samples must be a positive safe integer',
    );
  }
};

export const createP9BatchCalibrationContacts = (
  seed: number,
  samples: number,
): readonly SameContactComparisonContact<
  P9BatchCalibrationContactEvidence
>[] => {
  validateSeed(seed);
  validateSamples(samples);

  const rng = new DeterministicRng(seed);
  const contacts:
    SameContactComparisonContact<
      P9BatchCalibrationContactEvidence
    >[] = [];

  for (let index = 0; index < samples; index += 1) {
    const depthMeters = quantizeCoordinate(
      15 + rng.nextFloat() * 55,
    );
    const lateralMeters = quantizeCoordinate(
      (
        rng.nextFloat() * 2 - 1
      ) * depthMeters * 0.8,
    );
    const flightSeconds = (
      0.75
      + depthMeters / 40
      + rng.nextFloat() * 0.65
    );

    contacts.push({
      contactId:
        `p9-batch-${index.toString().padStart(5, '0')}`,
      evidence: {
        target: {
          x: lateralMeters,
          z: depthMeters,
        },
        fieldingWindowTicks: Math.round(
          flightSeconds * 1_000_000,
        ),
        runnerOnSecond: rng.nextFloat() < 0.28,
        runnerOnThird: rng.nextFloat() < 0.16,
      },
    });
  }

  return contacts;
};

const nearestDefenderEvidence = (
  alignment: DefensiveAlignment,
  contact: P9BatchCalibrationContactEvidence,
): Readonly<{
  playerId: string;
  distanceMeters: number;
}> => {
  let nearestPlayerId = '';
  let nearestDistanceMeters =
    Number.POSITIVE_INFINITY;

  for (const defender of alignment.defenders) {
    const final = advanceDefenderMotion(
      {
        tick: 0,
        position: defender.start,
        velocity: { x: 0, z: 0 },
      },
      contact.target,
      contact.fieldingWindowTicks,
      MOTION_PARAMETERS,
    );
    const distanceMeters = Math.hypot(
      final.position.x - contact.target.x,
      final.position.z - contact.target.z,
    );

    if (distanceMeters < nearestDistanceMeters) {
      nearestPlayerId = defender.playerId;
      nearestDistanceMeters = distanceMeters;
    }
  }

  return {
    playerId: nearestPlayerId,
    distanceMeters: nearestDistanceMeters,
  };
};

/**
 * Validation-only outcome buckets.
 *
 * They translate physical reach evidence into stable statistical
 * buckets for calibration. They are not the production hit/result
 * engine and must never feed back into Match Core decisions.
 */
const classifyCalibrationContact = (
  nearestDistanceMeters: number,
  targetDepthMeters: number,
): DefensiveContactClassification => {
  if (nearestDistanceMeters <= 2) {
    return 'out';
  }
  if (
    nearestDistanceMeters >= 10
    && targetDepthMeters >= 58
  ) {
    return 'triple';
  }
  if (
    nearestDistanceMeters >= 5
    || targetDepthMeters >= 52
  ) {
    return 'double';
  }
  return 'single';
};

const runsFor = (
  classification: DefensiveContactClassification,
  contact: P9BatchCalibrationContactEvidence,
): number => {
  if (classification === 'single') {
    return contact.runnerOnThird ? 1 : 0;
  }
  if (
    classification === 'double'
    || classification === 'triple'
  ) {
    return (
      Number(contact.runnerOnSecond)
      + Number(contact.runnerOnThird)
    );
  }
  return 0;
};

const extraBasesFor = (
  classification: DefensiveContactClassification,
): number => {
  if (classification === 'double') {
    return 1;
  }
  if (classification === 'triple') {
    return 2;
  }
  return 0;
};

export const runP9BatchCalibration = (
  seed: number,
  samples: number,
): P9BatchCalibrationResult => {
  const contacts = createP9BatchCalibrationContacts(
    seed,
    samples,
  );
  const comparison =
    compareSameContactDefensiveAlignments({
      contacts,
      alignments: [
        {
          alignmentId: 'normal',
          alignment: NORMAL_ALIGNMENT,
        },
        {
          alignmentId: 'pull-heavy',
          alignment: PULL_HEAVY_ALIGNMENT,
        },
      ],
      evaluator: ({
        contact,
        alignment,
      }) => {
        const nearest = nearestDefenderEvidence(
          alignment,
          contact.evidence,
        );
        const classification =
          classifyCalibrationContact(
            nearest.distanceMeters,
            contact.evidence.target.z,
          );

        return {
          classification,
          runsAllowed: runsFor(
            classification,
            contact.evidence,
          ),
          extraBasesAllowed:
            extraBasesFor(classification),
          evidence: {
            nearestDefenderId: nearest.playerId,
            nearestDistanceMeters:
              nearest.distanceMeters,
            target: contact.evidence.target,
            fieldingWindowTicks:
              contact.evidence.fieldingWindowTicks,
          },
        };
      },
    });

  const alignments = comparison.alignments.map(
    (entry): P9BatchCalibrationAlignmentResult => {
      const statistics = aggregateValidationOutcomes(
        entry.evaluations.map((evaluation) => ({
          classification: evaluation.classification,
          runsAllowed: evaluation.runsAllowed,
          extraBasesAllowed:
            evaluation.extraBasesAllowed,
        })),
      );

      return {
        alignmentId: entry.alignmentId,
        statistics,
        extraBaseHits: (
          statistics.doubles
          + statistics.triples
          + statistics.homeRuns
        ),
        evaluationsFingerprint:
          createCanonicalEvidenceFingerprint(
            entry.evaluations,
          ),
      };
    },
  );

  const evidence = {
    seed,
    samples,
    contactsFingerprint:
      comparison.contactsFingerprint,
    alignments,
  };

  return {
    ...evidence,
    calibrationFingerprint:
      createCanonicalEvidenceFingerprint(
        evidence,
      ),
  };
};