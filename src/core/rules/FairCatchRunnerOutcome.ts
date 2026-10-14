import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import { interpretOriginalLiveAppealRights, type OfficialGameplayRuling, type BallWorldAppealComplianceEvidence,
  type OwnedLiveAppealRightsEvidence, type OwnedLiveAppealRightsDisposition } from '../adjudication/PlayAdjudicationLedger';
import type { ActualFairCatchStationaryOccupiedRunners } from '../adjudication/ActualFairCatchScoring';
import type { BaseOccupancy, CanonicalMatchState } from '../model/CanonicalMatchState';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import type { ActualFairFieldTimelineInput } from '../sim/plateAppearance/ActualFairFieldTimeline';
import { createRunnerBaseFactsFromBallWorldHistory } from './BallWorldBaseContactPhysicalAdapter';
import { deriveBallWorldBattedRuleChronology } from './BallWorldBattedRuleChronology';
import { deriveBallWorldFieldTerritory } from './BallWorldFieldTerritory';
import { evaluateBallWorldTagUpCompliance } from './BallWorldTagUpCompliance';
import { createFlyBallFirstFielderTouchFact, type RunnerBaseTouchFact, type DefensiveAppealAttemptFact } from './PhysicalRuleFacts';
import { createRunnerPrecedence, compareRunnerPrecedence } from './RunnerPrecedence';
import { resolveThirdOutScoring, type ThirdOutScoringResult } from './ThirdOutScoring';
import { evaluateSustainedTagUpAppealScoring, type AppealOutScoringResult, type SustainedTagUpAppealOut } from './AppealOutScoring';
import { quantizeEventTick } from '../sim/ExactEventTime';

const baseNames = ['first', 'second', 'third'] as const;
const allBases = ['first', 'second', 'third', 'home'] as const;
type OccupiedBase = typeof baseNames[number];
type ContactBase = typeof allBases[number];
const baseNumber = (base: ContactBase) => ({ first: 1, second: 2, third: 3, home: 4 } as const)[base];

/** Native authenticates these holds and all four complete physical histories.
 * This sidecar is evidence, never a producer-completion or PlayEnd assertion. */
export type ActualFairCatchRunnerAppealEvidence = Readonly<{
  executionReference: Readonly<{ owner: 'pa_physical_v1_field_steps'; sourceId: string; sourceHash: string; snapshotHash: string }>;
  attempt: DefensiveAppealAttemptFact; complianceEvidence: BallWorldAppealComplianceEvidence;
  clock: Readonly<{ originTick: number; ticksPerSecond: number }>;
  indicatedAtElapsedSeconds: number; executedAtElapsedSeconds: number; evaluatedThroughElapsedSeconds: number;
  evidence: OwnedLiveAppealRightsEvidence;
}>;
export type ActualFairCatchOccupiedRunnerEvidence = Readonly<{
  kind: 'same_pa_occupied_fair_catch_runner_evidence_v1';
  appeals?: readonly ActualFairCatchRunnerAppealEvidence[];
  runners: readonly Readonly<{
    playerId: string; startingBase: OccupiedBase;
    holdReference: ActualFairCatchStationaryOccupiedRunners['runners'][number]['holdReference'];
    bases: readonly Readonly<{ base: ContactBase; history: BallWorldPlayerBaseContactHistory }>[];
  }>[];
}>;
export type FinalRunnerLedger = Readonly<{
  bases: BaseOccupancy; scoredRunnerIds: readonly string[]; retiredRunnerIds: readonly string[];
}>;
type Compliance = Extract<ReturnType<typeof evaluateBallWorldTagUpCompliance>, { kind: 'compliant' }>;
type ExactTouch = Readonly<{ base: ContactBase; elapsedSeconds: number; fact: RunnerBaseTouchFact }>;
export type FairCatchRunnerClaim = Readonly<{
  runnerId: string; startingBase: OccupiedBase; tagUpCompliance: Compliance;
  sequentialTouches: readonly ExactTouch[];
}> & (Readonly<{ kind: 'base'; base: OccupiedBase; touch: ExactTouch }>
  | Readonly<{ kind: 'scored'; homeTouch: ExactTouch }>);
export type ActualFairCatchOccupiedRunnerOutcome = Readonly<{
  kind: 'same_pa_occupied_fair_catch_runner_outcome_v1';
  finalRunnerLedger: FinalRunnerLedger; correctRuling: OfficialGameplayRuling;
  runnerClaims: readonly FairCatchRunnerClaim[]; thirdOutScoring: ThirdOutScoringResult;
  appeals?: readonly Readonly<{ executionReference: ActualFairCatchRunnerAppealEvidence['executionReference'];
    executedAtElapsedSeconds: number; disposition: OwnedLiveAppealRightsDisposition }>[];
  appealOutScoring?: AppealOutScoringResult;
}>;
export type FairCatchRunnerOutcomePendingReason = 'fair_catch_required' | 'tag_up_or_retouch_unresolved'
  | 'conflicting_base_contacts' | 'missing_sequential_touch' | 'unsupported_reverse_entitlement'
  | 'stopped_between_bases' | 'occupancy_conflict' | 'precedence_conflict' | 'third_out_runner_entitlement_unresolved'
  | 'appeal_rights_unresolved' | 'appeal_ordering_unresolved' | 'appeal_scoring_simultaneous_unresolved';
export type FairCatchRunnerOutcomeResult = ActualFairCatchOccupiedRunnerOutcome
  | Readonly<{ kind: 'pending'; reason: FairCatchRunnerOutcomePendingReason }>;
const fields = (value: unknown, keys: readonly string[]) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join('|') === [...keys].sort().join('|');
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value === value.trim();
const hash = (value: unknown) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const freeze = <T>(value: T): T => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const same = (a: unknown, b: unknown) => JSON.stringify(a, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : value)
  === JSON.stringify(b, (_key, value: unknown) => value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) : value);
const prefix = (history: BallWorldPlayerBaseContactHistory, through: number): BallWorldPlayerBaseContactHistory => {
  const episodes = history.episodes.filter(episode => episode.startElapsedSeconds <= through)
    .map(episode => ({ ...episode, endElapsedSeconds: Math.min(episode.endElapsedSeconds, through) }));
  return { ...history, endElapsedSeconds: through, contactAtHorizon: episodes.at(-1)?.endElapsedSeconds === through, episodes,
    events: episodes.flatMap(episode => [{ kind: 'touch' as const, originTick: history.originTick, elapsedSeconds: episode.startElapsedSeconds,
      tick: quantizeEventTick(history.originTick, episode.startElapsedSeconds, history.ticksPerSecond) },
    ...(episode.endElapsedSeconds < through ? [{ kind: 'departure' as const, originTick: history.originTick, elapsedSeconds: episode.endElapsedSeconds,
      tick: quantizeEventTick(history.originTick, episode.endElapsedSeconds, history.ticksPerSecond) }] : [])]) };
};
const pending = (reason: FairCatchRunnerOutcomePendingReason): FairCatchRunnerOutcomeResult => Object.freeze({ kind: 'pending', reason });

/** Participation can be validated while runner claims remain unresolved. This
 * validates shape/clock/completeness, not Native ownership or legal occupancy. */
export const validateActualFairCatchOccupiedRunnerEvidence = (raw: Readonly<{
  originalMatch: CanonicalMatchState; batterRunnerId: string; originTick: number;
  ticksPerSecond: number; endElapsedSeconds: number; runnerEvidence: ActualFairCatchOccupiedRunnerEvidence;
}>): void => {
  const input = cloneInert(raw), match = input.originalMatch, proof = input.runnerEvidence;
  if (!fields(match.bases, baseNames) || !text(input.batterRunnerId)
    || !Number.isInteger(match.outs) || match.outs < 0 || match.outs > 2
    || !Number.isSafeInteger(input.originTick) || input.originTick < 0
    || !Number.isSafeInteger(input.ticksPerSecond) || input.ticksPerSecond <= 0
    || !Number.isFinite(input.endElapsedSeconds) || input.endElapsedSeconds < 0
    || baseNames.some(base => match.bases[base] !== null && (!text(match.bases[base]) || match.bases[base] === input.batterRunnerId))) {
    throw new Error('fair catch runner original occupancy or clock differs');
  }
  const occupied = baseNames.filter(base => match.bases[base] !== null);
  if (!occupied.length || new Set(occupied.map(base => match.bases[base])).size !== occupied.length
    || !fields(proof, ['kind', 'runners', ...(proof && Object.hasOwn(proof, 'appeals') ? ['appeals'] : [])]) || proof.kind !== 'same_pa_occupied_fair_catch_runner_evidence_v1'
    || !Array.isArray(proof.runners) || proof.runners.length !== occupied.length) {
    throw new Error('fair catch requires complete original runner evidence');
  }
  const players = new Set<string>(), holds = new Set<string>();
  const originalRunners: ActualFairCatchOccupiedRunnerEvidence['runners'] = proof.runners;
  for (const runner of originalRunners) {
    if (!fields(runner, ['playerId', 'startingBase', 'holdReference', 'bases']) || !text(runner.playerId)
      || !occupied.includes(runner.startingBase) || match.bases[runner.startingBase] !== runner.playerId || players.has(runner.playerId)) {
      throw new Error('fair catch runner membership differs');
    }
    const pin = runner.holdReference;
    if (!fields(pin, ['owner', 'sourceId', 'sourceHash', 'snapshotHash']) || pin.owner !== 'world_same_pa_occupied_runner_holds'
      || !text(pin.sourceId) || !hash(pin.sourceHash) || !hash(pin.snapshotHash) || holds.has(pin.sourceId)) {
      throw new Error('fair catch original runner hold reference differs');
    }
    if (!Array.isArray(runner.bases) || runner.bases.length !== 4
      || new Set(runner.bases.map((entry: ActualFairCatchOccupiedRunnerEvidence['runners'][number]['bases'][number]) => entry.base)).size !== 4) throw new Error('fair catch runner requires all four base histories');
    const originalBases: ActualFairCatchOccupiedRunnerEvidence['runners'][number]['bases'] = runner.bases;
    for (const entry of originalBases) {
      const history = entry.history;
      if (!fields(entry, ['base', 'history']) || !allBases.includes(entry.base)
        || !fields(history, ['playerId', 'originTick', 'ticksPerSecond', 'startElapsedSeconds', 'endElapsedSeconds',
          'contactAtStart', 'contactAtHorizon', 'episodes', 'events'])
        || history.playerId !== runner.playerId || history.originTick !== input.originTick || history.ticksPerSecond !== input.ticksPerSecond
        || history.startElapsedSeconds !== 0 || history.endElapsedSeconds !== input.endElapsedSeconds
        || !Array.isArray(history.episodes) || history.episodes.some((episode: BallWorldPlayerBaseContactHistory['episodes'][number]) => !fields(episode, ['startElapsedSeconds', 'endElapsedSeconds']))
        || !Array.isArray(history.events) || history.events.some((event: BallWorldPlayerBaseContactHistory['events'][number]) => !fields(event, ['kind', 'originTick', 'elapsedSeconds', 'tick']))) {
        throw new Error('fair catch runner requires complete exact base histories');
      }
      createRunnerBaseFactsFromBallWorldHistory({ history, base: entry.base });
      if (entry.base === runner.startingBase && !history.contactAtStart) throw new Error('fair catch runner original hold contact differs');
    }
    players.add(runner.playerId); holds.add(pin.sourceId);
  }
  if (Object.hasOwn(proof, 'appeals')) {
    if (!Array.isArray(proof.appeals)) throw new Error('fair catch appeals must retain their original evidence');
    const executions = new Set<string>();
    for (const appeal of proof.appeals) {
      if (!fields(appeal, ['executionReference', 'attempt', 'complianceEvidence', 'clock', 'indicatedAtElapsedSeconds',
        'executedAtElapsedSeconds', 'evaluatedThroughElapsedSeconds', 'evidence'])
        || !fields(appeal.clock, ['originTick', 'ticksPerSecond']) || appeal.clock.originTick !== input.originTick
        || appeal.clock.ticksPerSecond !== input.ticksPerSecond || appeal.evaluatedThroughElapsedSeconds !== input.endElapsedSeconds
        || !Number.isFinite(appeal.executedAtElapsedSeconds) || appeal.executedAtElapsedSeconds < 0
        || appeal.executedAtElapsedSeconds > input.endElapsedSeconds) throw new Error('fair catch appeal original clock differs');
      const pin = appeal.executionReference;
      if (!fields(pin, ['owner', 'sourceId', 'sourceHash', 'snapshotHash']) || pin.owner !== 'pa_physical_v1_field_steps'
        || !text(pin.sourceId) || !hash(pin.sourceHash) || !hash(pin.snapshotHash) || executions.has(pin.sourceId)) {
        throw new Error('fair catch appeal execution identity differs');
      }
      const runner = originalRunners.find(value => value.playerId === appeal.attempt?.runnerId), compliance = appeal.complianceEvidence;
      if (!runner || !fields(compliance, ['kind', 'history', 'originBase', 'firstTouch']) || compliance.kind !== 'ball_world_tag_up_history_v1'
        || compliance.originBase !== runner.startingBase || appeal.attempt.base !== baseNumber(runner.startingBase)
        || !same(compliance.history, prefix(runner.bases.find(entry => entry.base === runner.startingBase)!.history, appeal.executedAtElapsedSeconds))) {
        throw new Error('fair catch appeal must preserve the exact original runner execution prefix');
      }
      executions.add(pin.sourceId);
    }
  }
};

const overlaps = (left: BallWorldPlayerBaseContactHistory, right: BallWorldPlayerBaseContactHistory) =>
  left.episodes.some(a => right.episodes.some(b => a.startElapsedSeconds <= b.endElapsedSeconds && b.startElapsedSeconds <= a.endElapsedSeconds));

/** A narrow claim composition for the caught-batter path. No last/farthest-touch
 * award, raw-home score, violation-as-out, or array-order entitlement is used.
 * Reverse routes, contested claims and unproved retouch obligations stay pending. */
export const deriveActualFairCatchOccupiedRunnerOutcome = (raw: Readonly<{
  originalMatch: CanonicalMatchState; field: ActualFairFieldTimelineInput['field'];
  runnerEvidence: ActualFairCatchOccupiedRunnerEvidence;
}>): FairCatchRunnerOutcomeResult => {
  const { originalMatch: match, field, runnerEvidence } = cloneInert(raw), evidence = field.evidence;
  validateActualFairCatchOccupiedRunnerEvidence({ originalMatch: match, batterRunnerId: evidence.batterRunnerId,
    originTick: evidence.originTick, ticksPerSecond: evidence.ticksPerSecond,
    endElapsedSeconds: evidence.horizon.elapsedSeconds, runnerEvidence });
  const chronology = deriveBallWorldBattedRuleChronology(evidence), caught = chronology.ballEvidence, territory = deriveBallWorldFieldTerritory(field);
  if (caught.kind !== 'fly_catch' || territory.kind !== 'resolved' || territory.territory !== 'fair') return pending('fair_catch_required');
  const firstTouch = evidence.contacts.find(frame => frame.contacts.some(contact => contact.kind === 'actor'
    && evidence.defenderIds.includes(contact.playerId)))!.moment;
  const appealResults: NonNullable<ActualFairCatchOccupiedRunnerOutcome['appeals']>[number][] = [];
  const appealOuts: { out: SustainedTagUpAppealOut; elapsedSeconds: number }[] = [];
  for (const appeal of [...(runnerEvidence.appeals ?? [])].sort((a, b) => a.executedAtElapsedSeconds - b.executedAtElapsedSeconds)) {
    if (!same(appeal.complianceEvidence.firstTouch, { fact: createFlyBallFirstFielderTouchFact(caught.firstFielderTouch.fielderId, caught.firstFielderTouch.tick),
      originTick: firstTouch.originTick, elapsedSeconds: firstTouch.elapsedSeconds })) throw new Error('fair catch appeal first touch differs from original ball');
    if (appeal.executedAtElapsedSeconds <= chronology.ballDecisionMoment!.elapsedSeconds
      || appealResults.at(-1)?.executedAtElapsedSeconds === appeal.executedAtElapsedSeconds) return pending('appeal_ordering_unresolved');
    let disposition: OwnedLiveAppealRightsDisposition;
    try {
      disposition = interpretOriginalLiveAppealRights({ ruleProfileId: match.ruleProfileId, attempt: appeal.attempt,
        complianceEvidence: appeal.complianceEvidence, clock: appeal.clock, indicatedAtElapsedSeconds: appeal.indicatedAtElapsedSeconds,
        executedAtElapsedSeconds: appeal.executedAtElapsedSeconds, evaluatedThroughElapsedSeconds: appeal.evaluatedThroughElapsedSeconds,
        evidence: appeal.evidence });
    } catch (error) {
      if (error instanceof Error && error.message.includes('unresolved')) return pending('appeal_rights_unresolved');
      throw error;
    }
    if (disposition.kind === 'eligible' && disposition.result.kind === 'simultaneous_unresolved') return pending('appeal_ordering_unresolved');
    if (disposition.kind === 'eligible' && disposition.result.kind === 'out') {
      const out = disposition.result;
      if (appealOuts.some(value => value.out.runnerId === out.runnerId)) return pending('appeal_ordering_unresolved');
      appealOuts.push({ out, elapsedSeconds: appeal.executedAtElapsedSeconds });
    }
    appealResults.push({ executionReference: appeal.executionReference, executedAtElapsedSeconds: appeal.executedAtElapsedSeconds, disposition });
  }
  if (match.outs + 1 + appealOuts.length > 3) return pending('appeal_ordering_unresolved');
  const retiredRunnerIds = [evidence.batterRunnerId, ...appealOuts.map(value => value.out.runnerId)];
  const runners = baseNames.flatMap(base => runnerEvidence.runners.filter(runner => runner.startingBase === base && !retiredRunnerIds.includes(runner.playerId)));
  const claims: FairCatchRunnerClaim[] = [];
  for (const runner of runners) {
    const histories = allBases.map(base => runner.bases.find(entry => entry.base === base)!);
    if (histories.some((left, index) => histories.slice(index + 1).some(right => overlaps(left.history, right.history)))) {
      return pending('conflicting_base_contacts');
    }
    const origin = histories.find(entry => entry.base === runner.startingBase)!;
    const compliance = evaluateBallWorldTagUpCompliance({ history: origin.history, originBase: runner.startingBase,
      firstTouch: { fact: createFlyBallFirstFielderTouchFact(caught.firstFielderTouch.fielderId, caught.firstFielderTouch.tick),
        originTick: firstTouch.originTick, elapsedSeconds: firstTouch.elapsedSeconds } });
    if (compliance.kind !== 'compliant' || compliance.exact.legalAdvanceFromElapsedSeconds === null) return pending('tag_up_or_retouch_unresolved');
    const touches = histories.flatMap(entry => {
      const facts = createRunnerBaseFactsFromBallWorldHistory(entry);
      return entry.history.events.flatMap((event, index): ExactTouch[] => event.kind === 'touch'
        ? [{ base: entry.base, elapsedSeconds: event.elapsedSeconds, fact: facts[index] as RunnerBaseTouchFact }] : []);
    }).sort((a, b) => a.elapsedSeconds - b.elapsedSeconds || baseNumber(a.base) - baseNumber(b.base));
    const advances = touches.filter(touch => touch.base !== runner.startingBase);
    const current = histories.filter(entry => entry.history.contactAtHorizon);
    let attained = baseNumber(runner.startingBase);
    for (const touch of advances) {
      if (touch.elapsedSeconds <= compliance.exact.legalAdvanceFromElapsedSeconds) return pending('tag_up_or_retouch_unresolved');
      if (baseNumber(touch.base) < attained || attained === 4) return pending('unsupported_reverse_entitlement');
      if (baseNumber(touch.base) > attained + 1) return pending('missing_sequential_touch');
      attained = baseNumber(touch.base);
    }
    if (advances.length && touches.some(touch => touch.base === runner.startingBase && touch.elapsedSeconds > advances[0].elapsedSeconds)) {
      return pending('unsupported_reverse_entitlement');
    }
    const common = { runnerId: runner.playerId, startingBase: runner.startingBase, tagUpCompliance: compliance, sequentialTouches: advances };
    const homeTouch = advances.find(touch => touch.base === 'home');
    if (homeTouch) claims.push({ ...common, kind: 'scored', homeTouch });
    else {
      if (current.length !== 1) return pending('stopped_between_bases');
      const base = current[0].base;
      if (base === 'home' || baseNumber(base) !== attained) return pending('unsupported_reverse_entitlement');
      const touch = touches.find(value => value.base === base && value.elapsedSeconds === current[0].history.episodes.at(-1)!.startElapsedSeconds)!;
      claims.push({ ...common, kind: 'base', base, touch });
    }
  }
  const precedence = createRunnerPrecedence(match.bases, evidence.batterRunnerId);
  for (let index = 0; index < runners.length; index++) {
    const following = runners[index], followingClaim = claims[index];
    for (let next = index + 1; next < runners.length; next++) {
      const preceding = runners[next], precedingClaim = claims[next];
      if (compareRunnerPrecedence(precedence, preceding.playerId, following.playerId) !== 'preceding') throw new Error('fair catch original precedence differs');
      if (allBases.some(base => overlaps(following.bases.find(entry => entry.base === base)!.history,
        preceding.bases.find(entry => entry.base === base)!.history))) return pending('occupancy_conflict');
      const followingBase = followingClaim.kind === 'scored' ? 4 : baseNumber(followingClaim.base);
      const precedingBase = precedingClaim.kind === 'scored' ? 4 : baseNumber(precedingClaim.base);
      if (followingBase >= precedingBase && precedingBase !== 4) return pending('precedence_conflict');
      for (const touch of followingClaim.sequentialTouches.filter(touch => baseNumber(touch.base) > baseNumber(preceding.startingBase))) {
        const earlier = precedingClaim.sequentialTouches.find(value => value.base === touch.base);
        if (!earlier || earlier.elapsedSeconds >= touch.elapsedSeconds) return pending('precedence_conflict');
      }
    }
  }
  const homeTouches = claims.flatMap(claim => claim.kind === 'scored' ? [claim.homeTouch.fact] : []);
  const thirdOutScoring = resolveThirdOutScoring({ outsAtStart: match.outs, thirdOutCandidate: {
    runnerId: evidence.batterRunnerId, outTick: caught.correctRuleResult.outTick, classification: 'batter_runner_before_first',
  }, homeTouches });
  if (thirdOutScoring.kind !== 'not_third_out' && homeTouches.length) return pending('third_out_runner_entitlement_unresolved');
  let appealOutScoring: AppealOutScoringResult | undefined;
  if (match.outs + 1 + appealOuts.length === 3 && appealOuts.length) {
    appealOutScoring = evaluateSustainedTagUpAppealScoring({ precedence, appealOut: appealOuts.at(-1)!.out, homeTouches });
    if (appealOutScoring.kind === 'simultaneous_unresolved') return pending('appeal_scoring_simultaneous_unresolved');
    if (appealOutScoring.suppressed.length) return pending('third_out_runner_entitlement_unresolved');
  }
  const bases: { first: string | null; second: string | null; third: string | null } = { first: null, second: null, third: null };
  for (const claim of claims) if (claim.kind === 'base') {
    if (bases[claim.base] !== null) return pending('occupancy_conflict');
    bases[claim.base] = claim.runnerId;
  }
  // Home order follows exact legal attainment, with original precedence already
  // established above. A caller's evidence-array order cannot change the ledger.
  const scoredRunnerIds = claims.filter((claim): claim is Extract<FairCatchRunnerClaim, { kind: 'scored' }> => claim.kind === 'scored')
    .sort((a, b) => a.homeTouch.elapsedSeconds - b.homeTouch.elapsedSeconds).map(claim => claim.runnerId);
  const finalRunnerLedger = { bases, scoredRunnerIds, retiredRunnerIds };
  return freeze({ kind: 'same_pa_occupied_fair_catch_runner_outcome_v1', finalRunnerLedger,
    correctRuling: { outsAfter: match.outs + 1 + appealOuts.length, basesAfter: bases, scoredRunnerIds }, runnerClaims: claims, thirdOutScoring,
    ...(Object.hasOwn(runnerEvidence, 'appeals') ? { appeals: appealResults } : {}), ...(appealOutScoring ? { appealOutScoring } : {}) });
};
