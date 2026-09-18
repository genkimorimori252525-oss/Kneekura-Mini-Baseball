import { describe, expect, it } from 'vitest';
import {
  createCausalDebugTrace,
} from './CausalDebugTrace';

describe('CausalDebugTrace', () => {
  it('records deterministic causal evidence from seed/input through rules', () => {
    const trace = createCausalDebugTrace({
      scenarioId: 'shift-play-1',
      matchSeed: 20260919,
      playId: 7,
      entries: [
        {
          availableAtTick: 0,
          sequence: 0,
          stage: 'input',
          kind: 'command',
          evidence: {
            attackZone: 'outside',
          },
        },
        {
          availableAtTick: 100_000,
          sequence: 0,
          stage: 'strategy',
          kind: 'alignment_selected',
          evidence: {
            candidateId: 'pull-shift',
          },
        },
        {
          availableAtTick: 2_000_000,
          sequence: 0,
          stage: 'execution',
          kind: 'catch_contact',
          evidence: {
            defenderId: 'cf',
            tick: 2_000_000,
          },
        },
        {
          availableAtTick: 2_100_000,
          sequence: 0,
          stage: 'rules',
          kind: 'out_recorded',
          evidence: {
            runnerId: 'batter',
            base: 1,
          },
        },
      ],
    });

    expect(trace.version).toBe(1);
    expect(trace.entries).toHaveLength(4);
    expect(trace.fingerprint)
      .toMatch(/^[0-9a-f]{16}$/);
  });

  it('allows multiple causal facts on the same tick only in stable sequence order', () => {
    expect(() => createCausalDebugTrace({
      scenarioId: 'same-tick',
      matchSeed: 1,
      playId: 1,
      entries: [
        {
          availableAtTick: 10,
          sequence: 1,
          stage: 'execution',
          kind: 'second',
          evidence: {},
        },
        {
          availableAtTick: 10,
          sequence: 0,
          stage: 'execution',
          kind: 'first',
          evidence: {},
        },
      ],
    })).toThrow(
      'causal debug trace entries must be ordered by tick then sequence',
    );
  });

  it('rejects evidence time moving backward', () => {
    expect(() => createCausalDebugTrace({
      scenarioId: 'backward',
      matchSeed: 1,
      playId: 1,
      entries: [
        {
          availableAtTick: 20,
          sequence: 0,
          stage: 'perception',
          kind: 'seen',
          evidence: {},
        },
        {
          availableAtTick: 19,
          sequence: 0,
          stage: 'decision',
          kind: 'acted',
          evidence: {},
        },
      ],
    })).toThrow(
      'causal debug trace entries must be ordered by tick then sequence',
    );
  });

  it('changes fingerprint when a causal intermediate changes even if the final label is unchanged', () => {
    const run = (cfX: number) => createCausalDebugTrace({
      scenarioId: 'alignment-effect',
      matchSeed: 77,
      playId: 3,
      entries: [
        {
          availableAtTick: 100,
          sequence: 0,
          stage: 'strategy',
          kind: 'alignment_selected',
          evidence: {
            cf: {
              x: cfX,
              z: 23,
            },
          },
        },
        {
          availableAtTick: 200,
          sequence: 0,
          stage: 'rules',
          kind: 'play_result',
          evidence: {
            result: 'out',
          },
        },
      ],
    });

    expect(run(-2).fingerprint)
      .not.toBe(run(-4).fingerprint);
  });

  it('rejects non-canonical evidence values before they can enter regression logs', () => {
    expect(() => createCausalDebugTrace({
      scenarioId: 'bad-evidence',
      matchSeed: 1,
      playId: 1,
      entries: [{
        availableAtTick: 10,
        sequence: 0,
        stage: 'input',
        kind: 'bad',
        evidence: {
          value: Number.NaN,
        },
      }],
    })).toThrow(
      'canonical evidence numbers must be finite',
    );
  });
});
