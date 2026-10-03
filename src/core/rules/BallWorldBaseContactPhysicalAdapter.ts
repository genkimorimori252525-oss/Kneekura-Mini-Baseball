import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import { quantizeEventTick } from '../sim/ExactEventTime';
import type { BattedWorldBaseId } from '../sim/ball/BattedWorldBaseGeometry';
import type { BallWorldPlayerBaseContactHistory } from '../sim/ball/BallWorldPlayerBaseContactHistory';
import type { BallWorldControlledBaseContact } from '../sim/ball/BallWorldControlledBaseContacts';
import { createRunnerBaseTouchFact, createRunnerBaseDepartureFact, createControlledBaseContactFact,
  type BaseballBase, type RunnerBaseTouchFact, type RunnerBaseDepartureFact, type ControlledBaseContactFact } from './PhysicalRuleFacts';

const baseNumber = (base: BattedWorldBaseId): BaseballBase => {
  if (!['first', 'second', 'third', 'home'].includes(base)) throw new Error('invalid actual physical rule base');
  return ({ first: 1, second: 2, third: 3, home: 4 } as const)[base];
};
const validateHistory = (h: BallWorldPlayerBaseContactHistory) => {
  if (!h || typeof h.playerId !== 'string' || !h.playerId.length || h.playerId !== h.playerId.trim()
    || !Number.isSafeInteger(h.originTick) || h.originTick < 0 || !Number.isSafeInteger(h.ticksPerSecond) || h.ticksPerSecond <= 0
    || ![h.startElapsedSeconds, h.endElapsedSeconds].every(Number.isFinite) || h.startElapsedSeconds < 0 || h.endElapsedSeconds < h.startElapsedSeconds
    || !Array.isArray(h.episodes) || !Array.isArray(h.events)
    || h.episodes.some((e, i) => ![e.startElapsedSeconds, e.endElapsedSeconds].every(Number.isFinite)
      || e.startElapsedSeconds < h.startElapsedSeconds || e.endElapsedSeconds < e.startElapsedSeconds || e.endElapsedSeconds > h.endElapsedSeconds
      || i > 0 && e.startElapsedSeconds <= h.episodes[i - 1].endElapsedSeconds)
    || h.contactAtStart !== (h.episodes[0]?.startElapsedSeconds === h.startElapsedSeconds)
    || h.contactAtHorizon !== (h.episodes.at(-1)?.endElapsedSeconds === h.endElapsedSeconds)) {
    throw new Error('invalid actual physical rule foot history');
  }
  const expected = h.episodes.flatMap((e) => [{ kind: 'touch', elapsedSeconds: e.startElapsedSeconds },
    ...(e.endElapsedSeconds < h.endElapsedSeconds ? [{ kind: 'departure', elapsedSeconds: e.endElapsedSeconds }] : [])]);
  if (expected.length !== h.events.length || expected.some((e, i) => h.events[i].kind !== e.kind
    || h.events[i].originTick !== h.originTick || h.events[i].elapsedSeconds !== e.elapsedSeconds
    || h.events[i].tick !== quantizeEventTick(h.originTick, e.elapsedSeconds, h.ticksPerSecond))) {
    throw new Error('actual physical rule chronology or recorded clock differs');
  }
};

/** Physical contacts/departures only. Initial home contact does not imply a run, legal occupancy or PlayEnd. */
export const createRunnerBaseFactsFromBallWorldHistory = (raw: Readonly<{ history: BallWorldPlayerBaseContactHistory;
  base: BattedWorldBaseId }>): readonly (RunnerBaseTouchFact | RunnerBaseDepartureFact)[] => {
  const { history, base } = cloneInert(raw), number = baseNumber(base); validateHistory(history);
  return Object.freeze(history.events.map((event) => Object.freeze(event.kind === 'touch'
    ? createRunnerBaseTouchFact(history.playerId, number, event.tick) : createRunnerBaseDepartureFact(history.playerId, number, event.tick))));
};

/** The Native owner establishes security and active defender identity before projecting these facts. */
export const createControlledBaseFactsFromBallWorldContacts = (raw: Readonly<{ history: BallWorldPlayerBaseContactHistory;
  base: BattedWorldBaseId; contacts: readonly BallWorldControlledBaseContact[] }>): readonly ControlledBaseContactFact[] => {
  const { history, base, contacts } = cloneInert(raw), number = baseNumber(base); validateHistory(history);
  if (!Array.isArray(contacts) || contacts.some((contact, index) => contact.playerId !== history.playerId || contact.originTick !== history.originTick
    || !Number.isFinite(contact.elapsedSeconds) || contact.elapsedSeconds < history.startElapsedSeconds || contact.elapsedSeconds > history.endElapsedSeconds
    || contact.tick !== quantizeEventTick(history.originTick, contact.elapsedSeconds, history.ticksPerSecond)
    || index > 0 && contact.elapsedSeconds <= contacts[index - 1].elapsedSeconds
    || !history.episodes.some((episode) => contact.elapsedSeconds >= episode.startElapsedSeconds && contact.elapsedSeconds <= episode.endElapsedSeconds))) {
    throw new Error('actual controlled rule fact differs from own Player foot history');
  }
  return Object.freeze(contacts.map((contact) => Object.freeze(createControlledBaseContactFact(history.playerId, number, contact.tick))));
};
