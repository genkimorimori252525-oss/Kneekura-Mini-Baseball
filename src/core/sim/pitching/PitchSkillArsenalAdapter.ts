import {
  buildPitchArsenalEntry,
  type PitchArsenalEntry,
} from './PitchArsenalProfile';
import type {
  PitchNameRegistry,
} from './PitchNameRegistry';
import type {
  PitchSkillFlightSample,
} from './PitchSkillFlightSample';

export type BuildPitchSkillArsenalEntryInput = Readonly<{
  samples: readonly PitchSkillFlightSample[];
  registry: PitchNameRegistry;
  namingHorizontalMultiplier?: -1 | 1;
}>;

/**
 * Converts repeated physical observations of one stable learned pitch skill
 * into the human-readable arsenal layer.
 *
 * This adapter is deliberately downstream-only: the registered pitch name
 * cannot feed back into release mechanics or flight.
 */
export const buildPitchSkillArsenalEntry = (
  input: BuildPitchSkillArsenalEntryInput,
): PitchArsenalEntry => {
  if (input.samples.length === 0) {
    throw new Error(
      'pitch skill arsenal entry requires at least one sample',
    );
  }

  const first = input.samples[0]!;
  for (const sample of input.samples) {
    if (
      sample.pitcherId !== first.pitcherId
      || sample.pitchSkillId
        !== first.pitchSkillId
    ) {
      throw new Error(
        'pitch skill arsenal samples must share pitcherId and pitchSkillId',
      );
    }
  }

  return buildPitchArsenalEntry({
    pitchSkillId: first.pitchSkillId,
    samples: input.samples.map(
      (sample) => sample.movement,
    ),
    registry: input.registry,
    namingHorizontalMultiplier:
      input.namingHorizontalMultiplier,
  });
};
