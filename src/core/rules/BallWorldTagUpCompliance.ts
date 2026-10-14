import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import { quantizeEventTick } from '../sim/ExactEventTime';
import { createRunnerBaseFactsFromBallWorldHistory } from './BallWorldBaseContactPhysicalAdapter';
import { evaluateTagUpCompliance, type TagUpComplianceResult } from './TagUpCompliance';
import type { FlyBallFirstFielderTouchFact } from './PhysicalRuleFacts';

type ContactCompliance = Readonly<{ kind: 'compliant'; runnerId: string; originBase: 1 | 2 | 3;
  basis: 'contact_at_first_fielder_touch'; firstFielderTouchTick: number; departureTick: number | null;
  retouchTick: number | null; legalAdvanceFromTick: number }>;
/** Exact physical history supplements the unchanged tick-only rule API. Contact
 * spanning first fielder touch is interval evidence, never a fabricated retouch.
 * Quantization does not erase known physical order or turn early departure OUT. */
export const evaluateBallWorldTagUpCompliance = (raw: Readonly<{
  history: BallWorldPlayerBaseContactHistory; originBase: 'first' | 'second' | 'third';
  firstTouch: Readonly<{ fact: FlyBallFirstFielderTouchFact; originTick: number; elapsedSeconds: number }>;
}>) => {
  const { history, originBase, firstTouch } = cloneInert(raw), fact = firstTouch.fact;
  const physical = createRunnerBaseFactsFromBallWorldHistory({ history, base: originBase });
  if (fact.kind !== 'fly_ball_first_fielder_touch' || !fact.fielderId || firstTouch.originTick !== history.originTick
    || !Number.isFinite(firstTouch.elapsedSeconds) || firstTouch.elapsedSeconds < history.startElapsedSeconds
    || firstTouch.elapsedSeconds > history.endElapsedSeconds
    || fact.tick !== quantizeEventTick(history.originTick, firstTouch.elapsedSeconds, history.ticksPerSecond))
    throw new Error('exact tag-up first-fielder contact clock or coverage differs');
  if (!history.contactAtStart) return Object.freeze({ kind: 'pending' as const, reason: 'original_origin_base_contact_required' });
  let index = -1;
  history.events.forEach((event, i) => { if (event.kind === 'departure') index = i; });
  const departure = index < 0 ? null : history.events[index], retouch = index < 0 ? null : history.events[index + 1] ?? null;
  const departureFact = index < 0 ? null : physical[index], retouchFact = retouch ? physical[index + 1] : null;
  if (departureFact && departureFact.kind !== 'runner_base_departure' || retouchFact && retouchFact.kind !== 'runner_base_touch')
    throw new Error('exact tag-up actual departure/retouch pairing differs');
  const common = { runnerId: history.playerId, originBase: ({ first: 1, second: 2, third: 3 } as const)[originBase],
    firstFielderTouchTick: fact.tick }, time = firstTouch.elapsedSeconds;
  let rule: TagUpComplianceResult | ContactCompliance, legalAdvanceFromElapsedSeconds: number | null;
  if (departure && departure.elapsedSeconds >= time) {
    rule = { ...common, kind: 'compliant', basis: 'departed_at_or_after_first_touch', departureTick: departure.tick,
      legalAdvanceFromTick: departure.tick }; legalAdvanceFromElapsedSeconds = departure.elapsedSeconds;
  } else if (departure && retouch && retouch.elapsedSeconds >= time) {
    rule = { ...common, kind: 'compliant', basis: 'retouched_after_first_touch', departureTick: departure.tick,
      retouchTick: retouch.tick, legalAdvanceFromTick: retouch.tick }; legalAdvanceFromElapsedSeconds = retouch.elapsedSeconds;
  } else if (history.episodes.some(e => e.startElapsedSeconds <= time && e.endElapsedSeconds >= time)) {
    rule = { ...common, kind: 'compliant', basis: 'contact_at_first_fielder_touch', departureTick: departure?.tick ?? null,
      retouchTick: retouch?.tick ?? null, legalAdvanceFromTick: fact.tick }; legalAdvanceFromElapsedSeconds = time;
  } else {
    if (!departure) throw new Error('exact tag-up original departure history missing');
    rule = { ...common, kind: 'appealable_early_departure', departureTick: departure.tick, retouchTick: retouch?.tick ?? null };
    legalAdvanceFromElapsedSeconds = null;
  }
  // Reuse the existing rule result whenever its tick comparison represents the
  // actual relation. Collapsed ticks retain the exact result and original facts.
  if (departureFact && !(rule.kind === 'compliant' && rule.basis === 'contact_at_first_fielder_touch')) {
    const legacy = evaluateTagUpCompliance({ ...common, firstTouch: fact, departure: departureFact, retouch: retouchFact });
    if (legacy.kind === rule.kind && (legacy.kind !== 'compliant' || rule.kind === 'compliant' && legacy.basis === rule.basis)) rule = legacy;
  }
  return Object.freeze({ ...rule, exact: Object.freeze({ originTick: history.originTick, ticksPerSecond: history.ticksPerSecond,
    firstFielderTouchElapsedSeconds: time, departureElapsedSeconds: departure?.elapsedSeconds ?? null,
    retouchElapsedSeconds: retouch?.elapsedSeconds ?? null, legalAdvanceFromElapsedSeconds }) });
};
