import { expect, it } from 'vitest';
import { actualDefensiveDecisionFixture as fixture } from './ActualDefensiveDecisionFixtures.test-support';
import { playerDecisionCalibrationFixture } from '../../core/sim/fielding/PlayerDecisionCalibrationFixtures.test-support';

it('starts new cognition from current receipt availability even when its remembered ball capture is older', () => {
  const x = fixture();
  try {
    x.plans.accept(x.planSource.sourceId);
    const start = x.observation.receipt.at.tick;
    const execution = { ...x.source, action: { kind: 'motion' as const, availableAtTick: start, throughTick: start + 5, commands: x.fieldSource.commands } };
    x.sources.set(execution.sourceId, execution); x.executions.accept(execution.sourceId);
    const obsSource = { ...x.observationSource, sourceId: 'new-memory-receipt', previousObservationSourceId: x.observationSource.sourceId, executionSourceId: execution.sourceId };
    x.observationSources.set(obsSource.sourceId, obsSource); const obs = x.observations.accept(obsSource.sourceId);
    expect(obs.receipt.results.find(r => r.target.kind === 'ball')?.status).toBe('refresh_not_due');
    expect(obs.receipt.samples.ball).toEqual(x.observation.receipt.samples.ball);
    expect(() => x.decisions.accept(x.decisionSource.sourceId)).toThrow(/stale|prefix changed/);
    const source = { ...x.decisionSource, observationSourceId: obsSource.sourceId }; x.decisionSources.set(source.sourceId, source);
    const saved = x.decisions.accept(source.sourceId);
    expect(saved.receipt.evidence!.captureAt.elapsedSeconds).toBeLessThan(saved.receipt.availability.elapsedSeconds);
    expect(saved.receipt.selected.evidenceAvailableAt).toBe(x.observation.receipt.perceived.ball!.sourceObservedAt);
    expect(saved.receipt.scheduling.startedAtTick).toBeGreaterThan(saved.receipt.selected.evidenceAvailableAt);
    expect(saved.receipt.scheduling.decisionTick).toBe(saved.receipt.scheduling.startedAtTick + saved.receipt.scheduling.decisionDelayTicks);
    expect(saved.receipt.lifecycle.status).toBe('pending_decision');
  } finally { x.f.close(); }
});

it('does not issue zero-delay motor eligibility between distinct exact instants sharing a quantized tick', () => {
  const calibration = { ...playerDecisionCalibrationFixture(),
    decisionTimingParameters: { minimumDecisionDelayTicks: 0, maximumDecisionDelayTicks: 0, fixedProcessingOffsetTicks: 0 },
    firstStepTimingParameters: { minimumFirstStepDelayTicks: 0, maximumFirstStepDelayTicks: 0, fixedMotorOffsetTicks: 0 } };
  const x = fixture(undefined, { kind: 'candidate', calibration, captureTiming: { contactElapsedSeconds: 0.0100002, captureDissipationPowerW: 1e12 } });
  try {
    x.plans.accept(x.planSource.sourceId); const first = x.decisions.accept(x.decisionSource.sourceId);
    const acquisition = x.executions.accept(x.source.sourceId);
    const obsSource = { ...x.observationSource, sourceId: 'after-exact-acquisition', executionSourceId: acquisition.source.sourceId,
      previousObservationSourceId: x.observationSource.sourceId };
    x.observationSources.set(obsSource.sourceId, obsSource); const obs = x.observations.accept(obsSource.sourceId);
    expect(obs.receipt.at.elapsedSeconds).toBeGreaterThan(first.receipt.availability.elapsedSeconds);
    expect(obs.receipt.at.tick).toBe(first.receipt.availability.tick);
    const due = (first.receipt.scheduling.movementStartTick - first.receipt.availability.originTick) / first.receipt.ticksPerSecond;
    expect(due).toBeGreaterThanOrEqual(first.receipt.availability.elapsedSeconds);
    expect(obs.receipt.at.elapsedSeconds).toBeLessThan(due);
    expect(first.receipt.lifecycle.status).toBe('pending_decision');
    const source = { ...x.decisionSource, sourceId: 'same-tick-progress', observationSourceId: obsSource.sourceId, previousDecisionSourceId: first.source.sourceId };
    x.decisionSources.set(source.sourceId, source); const second = x.decisions.accept(source.sourceId);
    expect(second.receipt.lifecycle.status).toBe('pending_decision');
    expect(second.receipt.scheduling).toEqual(first.receipt.scheduling);
  } finally { x.f.close(); }
});

it.each([
  [0, 1, 105, 12], [1, 0, 25, 52],
])('binds situational awareness %s and first-step %s to separate original rating effects', (awareness, firstStep, decisionDelay, motorDelay) => {
  const x = fixture(undefined, { fielding: source => ({ ...source, ratings: { ...source.ratings, situationalAwareness: awareness, firstStep } }) });
  try {
    x.plans.accept(x.planSource.sourceId); const value = x.decisions.accept(x.decisionSource.sourceId);
    expect(value.receipt.scheduling.decisionDelayTicks).toBe(decisionDelay);
    expect(value.receipt.scheduling.firstStepDelayTicks).toBe(motorDelay);
  } finally { x.f.close(); }
});

it.each(['nondetected', 'weak'] as const)('keeps %s ball information from becoming a pursuit outcome', kind => {
  const x = fixture(undefined, kind === 'nondetected' ? { observation: source => ({ ...source, calibration: { ...source.calibration,
    errorParameters: { ...source.calibration.errorParameters, minimumDetectionQuality: 1 } } }) }
    : { calibration: { ...playerDecisionCalibrationFixture(), minimumCueConfidence: 1 } });
  try {
    x.plans.accept(x.planSource.sourceId); const value = x.decisions.accept(x.decisionSource.sourceId);
    expect(value.receipt.selected.intent).toEqual({ kind: 'hold' }); expect(value.receipt.target).toBeNull();
    expect(value.receipt.evidence).toBeNull(); expect(value.receipt.lifecycle.status).toBe('pending_decision');
    expect(value).not.toHaveProperty('settled'); expect(value).not.toHaveProperty('playEnd');
  } finally { x.f.close(); }
});
