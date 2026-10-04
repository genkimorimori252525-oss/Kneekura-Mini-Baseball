import type { ActualObservationMoment, ActualObservationTarget, ActualFieldObservationReceipt } from './ActualFieldObservation';
import type { ObservationRefreshPolicy } from '../../core/sim/perception/Observation';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import { actorFreeze as freeze, actorJson as json } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
type Observation = Readonly<{ sourceId: string; at: ActualObservationMoment; attentionTarget: ActualObservationTarget;
  refreshPolicy: ObservationRefreshPolicy; results: ActualFieldObservationReceipt['results'] }>;
type Due = Readonly<{ target: ActualObservationTarget; causeSourceId: string; dueTick: number }>;
/** One causal refresh successor per actually detected target. Failed attempts do
 * not manufacture perpetual invisible-event scheduling. The next due tick uses
 * the same original attended/peripheral interval as the actual sampler. */
export const deriveActualLiveObservationSchedule = (raw: readonly Observation[]) => {
  const observations = cloneInert(raw), pending = new Map<string, Due>();
  const consumed: (Due & Readonly<{ consumerSourceId: string; at: ActualObservationMoment;
    disposition: 'sampled' | 'superseded_by_actual_sample' }>)[] = [];
  let previous: ActualObservationMoment | null = null;
  for (const observation of observations) {
    if (!observation.sourceId || previous && (observation.at.originTick !== previous.originTick || observation.at.elapsedSeconds < previous.elapsedSeconds)
      || !Number.isSafeInteger(observation.at.tick) || observation.at.tick < 0
      || !Object.values(observation.refreshPolicy).every(n => Number.isSafeInteger(n) && n > 0)) throw new Error('invalid actual observation schedule chronology or calibration');
    const seen = new Set<string>();
    for (const result of observation.results) {
      const key = json(result.target);
      if (seen.has(key)) throw new Error('duplicate actual observation schedule target');
      seen.add(key);
      if (result.status === 'refresh_not_due') continue;
      const prior = pending.get(key);
      if (prior) {
        consumed.push({ ...prior, consumerSourceId: observation.sourceId, at: observation.at,
          disposition: observation.at.tick >= prior.dueTick ? 'sampled' : 'superseded_by_actual_sample' });
        pending.delete(key);
      }
      if (result.status === 'detected') {
        const interval = key === json(observation.attentionTarget) ? observation.refreshPolicy.attendedIntervalTicks : observation.refreshPolicy.peripheralIntervalTicks;
        const dueTick = observation.at.tick + interval;
        if (!Number.isSafeInteger(dueTick)) throw new Error('actual observation schedule exceeds safe clock');
        pending.set(key, { target: result.target, causeSourceId: observation.sourceId, dueTick });
      }
    }
    previous = observation.at;
  }
  return freeze({ pending: [...pending.values()], consumed });
};
