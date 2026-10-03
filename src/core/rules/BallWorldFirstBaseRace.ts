import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../sim/ExactEventTime';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import type { BallWorldControlledBaseContact } from '../sim/ball/BallWorldControlledBaseContacts';
import { createControlledBaseFactsFromBallWorldContacts, createRunnerBaseFactsFromBallWorldHistory } from './BallWorldBaseContactPhysicalAdapter';
import type { GroundBallFirstBaseRuleInput } from './RuleEngine';
import { resolveThirdOutScoring } from './ThirdOutScoring';

export type BallWorldFirstBaseRaceInput = Readonly<{
  outsAtStart: number; batterRunnerId: string; defenderIds: readonly string[];
  originTick: number; ticksPerSecond: number; horizonElapsedSeconds: number;
  runnerHistory: BallWorldPlayerBaseContactHistory;
  defenders: readonly Readonly<{ history: BallWorldPlayerBaseContactHistory; controlledContacts: readonly BallWorldControlledBaseContact[] }>[];
}>;
type RaceMoment = Readonly<{ originTick: number; elapsedSeconds: number; tick: number }>;
export type BallWorldFirstBaseRuling = Readonly<{ kind: 'out'; runnerId: string; reason: 'batter_runner_before_first';
  outTick: number; defenderControlTick: number; runnerTouchTick: number | null }>
  | Readonly<{ kind: 'safe'; runnerId: string; base: 1; touchTick: number; defenderControlTick: number | null }>
  | Readonly<{ kind: 'simultaneous'; runnerId: string; base: 1; tick: number }>
  | Readonly<{ kind: 'unresolved'; runnerId: string; reason: 'no_first_base_event' | 'simultaneous_defender_control' }>;
const fields = (value: object, names: readonly string[]) => Object.keys(value).sort().join('|') === [...names].sort().join('|');
const id = (value: string) => typeof value === 'string' && value.length > 0 && value === value.trim();

/** The owner proves fair/live ground-ball eligibility and all active Players. No future arrival or final closure is inferred. */
export const resolveBallWorldFirstBaseRace = (raw: BallWorldFirstBaseRaceInput) => {
  const input = cloneInert(raw);
  if (!input || !fields(input, ['outsAtStart', 'batterRunnerId', 'defenderIds', 'originTick', 'ticksPerSecond', 'horizonElapsedSeconds', 'runnerHistory', 'defenders'])
    || !Number.isInteger(input.outsAtStart) || input.outsAtStart < 0 || input.outsAtStart > 2
    || !id(input.batterRunnerId) || !Array.isArray(input.defenderIds) || !input.defenderIds.length
    || input.defenderIds.some((value) => !id(value) || value === input.batterRunnerId) || new Set(input.defenderIds).size !== input.defenderIds.length
    || !Array.isArray(input.defenders) || input.defenders.length !== input.defenderIds.length
    || !Number.isFinite(input.horizonElapsedSeconds) || input.horizonElapsedSeconds < 0) throw new Error('invalid actual first-base race scope');
  quantizeEventTick(input.originTick, input.horizonElapsedSeconds, input.ticksPerSecond);
  const completeHistory = (history: BallWorldPlayerBaseContactHistory, playerId: string) => {
    if (!history || !fields(history, ['playerId', 'originTick', 'ticksPerSecond', 'startElapsedSeconds', 'endElapsedSeconds', 'contactAtStart', 'contactAtHorizon', 'episodes', 'events'])
      || history.playerId !== playerId || history.originTick !== input.originTick || history.ticksPerSecond !== input.ticksPerSecond
      || history.startElapsedSeconds !== 0 || history.endElapsedSeconds !== input.horizonElapsedSeconds) throw new Error('actual first-base race requires complete original Player history');
  };
  completeHistory(input.runnerHistory, input.batterRunnerId);
  const runnerFacts = createRunnerBaseFactsFromBallWorldHistory({ history: input.runnerHistory, base: 'first' });
  const runnerTouch = runnerFacts.find((value) => value.kind === 'runner_base_touch') ?? null;
  const touchMoment = input.runnerHistory.events.find((value) => value.kind === 'touch') ?? null;
  const seen = new Set<string>();
  const controls = input.defenders.flatMap((defender) => {
    if (!defender || !fields(defender, ['history', 'controlledContacts']) || !defender.history
      || !input.defenderIds.includes(defender.history.playerId) || seen.has(defender.history.playerId)) throw new Error('actual first-base race active defender scope differs');
    seen.add(defender.history.playerId);
    completeHistory(defender.history, defender.history.playerId);
    if (!Array.isArray(defender.controlledContacts) || defender.controlledContacts.some((value: BallWorldControlledBaseContact) => !value || !fields(value, ['playerId', 'originTick', 'elapsedSeconds', 'tick']))) {
      throw new Error('invalid actual first-base controlled contacts');
    }
    const facts = createControlledBaseFactsFromBallWorldContacts({ history: defender.history, base: 'first', contacts: defender.controlledContacts });
    return defender.controlledContacts.map((moment: BallWorldControlledBaseContact, index: number) => ({ moment, fact: facts[index] }));
  }).sort((left, right) => left.moment.elapsedSeconds - right.moment.elapsedSeconds);
  const firstControls = controls.filter((value) => value.moment.elapsedSeconds === controls[0].moment.elapsedSeconds);
  const controlMoment = firstControls[0]?.moment ?? null;
  const defenderControl = firstControls.length === 1 ? firstControls[0].fact : null;
  const physicalFacts: GroundBallFirstBaseRuleInput = { outsAtStart: input.outsAtStart, batterRunnerId: input.batterRunnerId,
    defenderControl, batterRunnerTouch: runnerTouch, homeTouches: [] };
  let firstBase: BallWorldFirstBaseRuling;
  let decisionMoment: RaceMoment | null = null;
  if (touchMoment && (!controlMoment || touchMoment.elapsedSeconds < controlMoment.elapsedSeconds)) {
    firstBase = { kind: 'safe', runnerId: input.batterRunnerId, base: 1, touchTick: touchMoment.tick, defenderControlTick: defenderControl?.tick ?? null };
    decisionMoment = touchMoment;
  } else if (firstControls.length > 1) {
    firstBase = { kind: 'unresolved', runnerId: input.batterRunnerId, reason: 'simultaneous_defender_control' };
    decisionMoment = controlMoment;
  } else if (controlMoment && touchMoment && controlMoment.elapsedSeconds === touchMoment.elapsedSeconds) {
    firstBase = { kind: 'simultaneous', runnerId: input.batterRunnerId, base: 1, tick: touchMoment.tick };
    decisionMoment = touchMoment;
  } else if (controlMoment) {
    firstBase = { kind: 'out', runnerId: input.batterRunnerId, reason: 'batter_runner_before_first', outTick: controlMoment.tick,
      defenderControlTick: controlMoment.tick, runnerTouchTick: touchMoment?.tick ?? null };
    decisionMoment = controlMoment;
  } else firstBase = { kind: 'unresolved', runnerId: input.batterRunnerId, reason: 'no_first_base_event' };
  const actualChronology = { runnerTouch: touchMoment && { originTick: touchMoment.originTick, elapsedSeconds: touchMoment.elapsedSeconds, tick: touchMoment.tick },
    firstDefenderControls: firstControls.map((value) => ({ playerId: value.moment.playerId, originTick: value.moment.originTick, elapsedSeconds: value.moment.elapsedSeconds, tick: value.moment.tick })),
    decisionMoment: decisionMoment && { originTick: decisionMoment.originTick, elapsedSeconds: decisionMoment.elapsedSeconds, tick: decisionMoment.tick } };
  if (firstBase.kind === 'unresolved' || firstBase.kind === 'simultaneous') {
    return { physicalFacts, actualChronology, correctRuleResult: { kind: 'unresolved' as const, batterRunnerFirstBase: firstBase, outsAfter: input.outsAtStart, pendingHomeTouches: [] } };
  }
  if (firstBase.kind === 'out' && input.outsAtStart === 2) {
    const thirdOutScoring = resolveThirdOutScoring({ outsAtStart: input.outsAtStart,
      thirdOutCandidate: { runnerId: input.batterRunnerId, outTick: firstBase.outTick, classification: 'batter_runner_before_first' }, homeTouches: [] });
    if (thirdOutScoring.kind !== 'resolved') throw new Error('actual first-base third-out consequence differs');
    return { physicalFacts, actualChronology, correctRuleResult: { kind: 'resolved' as const, batterRunnerFirstBase: firstBase,
      outsAfter: 3, thirdOut: true as const, runsScored: [], runsSuppressed: [], thirdOutScoring } };
  }
  return { physicalFacts, actualChronology, correctRuleResult: { kind: 'resolved' as const, batterRunnerFirstBase: firstBase,
    outsAfter: input.outsAtStart + (firstBase.kind === 'out' ? 1 : 0), thirdOut: false as const, pendingHomeTouches: [], thirdOutScoring: null } };
};
