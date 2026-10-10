import { resolveCanonicalPitchDelivery, type CanonicalPitchDeliveryInput } from '../../core/sim/pitch/CanonicalPitchDelivery';

/** The existing explicit one-second motor interval belongs to the actual pitch
 * release; the separately declared stationary-body horizon remains finite. */
export const inFlightBattingFixtureTiming = (input: CanonicalPitchDeliveryInput, validUntilTick: number) => {
  const delivery = resolveCanonicalPitchDelivery(input), latestMotorStartTick = delivery.release.releaseAtUs + 1_000_000;
  if (!Number.isSafeInteger(validUntilTick) || !Number.isSafeInteger(latestMotorStartTick)
    || latestMotorStartTick > validUntilTick) throw new Error('fixture motor window exceeds declared stationary-body horizon');
  return { delivery, geometry: { bodyReadyTick: input.readyAtUs, latestMotorStartTick, validUntilTick } };
};
