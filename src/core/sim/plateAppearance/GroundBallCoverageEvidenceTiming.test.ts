import { describe, expect, it } from 'vitest';
import type {
  TeamCoveragePlan,
} from '../fielding/TeamCoveragePlan';
import {
  assertGroundBallCoverageEvidenceTiming,
} from './GroundBallCoverageEvidenceTiming';

const coverage = (
  handlerEvidenceAt: number,
  receiverEvidenceAt: number,
): TeamCoveragePlan => ({
  totalPriority: 9,
  assignments: [
    {
      playerId: 'p',
      registeredPosition: 'P',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'c',
      registeredPosition: 'C',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '1b',
      registeredPosition: '1B',
      intent: { kind: 'base_cover', base: 1 },
      selectedPriority: 1,
      evidenceAvailableAt: receiverEvidenceAt,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '2b',
      registeredPosition: '2B',
      intent: { kind: 'ball_handler' },
      selectedPriority: 1,
      evidenceAvailableAt: handlerEvidenceAt,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: '3b',
      registeredPosition: '3B',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'ss',
      registeredPosition: 'SS',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'lf',
      registeredPosition: 'LF',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'cf',
      registeredPosition: 'CF',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
    {
      playerId: 'rf',
      registeredPosition: 'RF',
      intent: { kind: 'hold' },
      selectedPriority: 1,
      evidenceAvailableAt: 0,
      evidenceKinds: ['fixture'],
    },
  ],
});

describe('GroundBallCoverageEvidenceTiming', () => {
  it('accepts decisions whose evidence existed before their physical action', () => {
    expect(() =>
      assertGroundBallCoverageEvidenceTiming({
        coverage: coverage(900, 1_100),
        handlerId: '2b',
        receiverId: '1b',
        pickupContactTick: 1_000,
        throwReadyTick: 1_200,
      })
    ).not.toThrow();
  });

  it('rejects a ball-handler assignment that uses future pickup evidence', () => {
    expect(() =>
      assertGroundBallCoverageEvidenceTiming({
        coverage: coverage(1_001, 1_100),
        handlerId: '2b',
        receiverId: '1b',
        pickupContactTick: 1_000,
        throwReadyTick: 1_200,
      })
    ).toThrow(
      'ball-handler coverage evidence must exist before physical pickup contact',
    );
  });

  it('rejects first-base coverage selected from evidence that arrives after throw readiness', () => {
    expect(() =>
      assertGroundBallCoverageEvidenceTiming({
        coverage: coverage(900, 1_201),
        handlerId: '2b',
        receiverId: '1b',
        pickupContactTick: 1_000,
        throwReadyTick: 1_200,
      })
    ).toThrow(
      'first-base cover evidence must exist before the derived throw-ready tick',
    );
  });
});