import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { Vec3 } from '../../core/model/geometry';
import type { BallWorldMoment } from '../../core/sim/ball/BallWorldContinuation';
import type { SourceBallWorldMotionInputV1 } from '../../core/sim/ball/SourceBallWorldMotionV1';
import { createSourceBallWorldMotionSessionV1 } from '../../core/sim/ball/SourceBallWorldMotionV1';

type Snapshot = ReturnType<ReturnType<typeof createSourceBallWorldMotionSessionV1>['snapshot']>;
export type ExecutedFieldWorldRecordingV1 = Readonly<{
  kind: 'joint_field_successor_executed_v1';
  source: Readonly<{ sourceId: string; sourceVersion: string }>;
  root: SourceBallWorldMotionInputV1;
  steps: readonly Readonly<{ state: Snapshot }>[];
  executedThroughMoment: BallWorldMoment;
  physicalExecutionAdmitted: true;
  motionIssued: true;
  nextMotionAllowed: false;
  officialResult: null;
}>;
const axes = ['x', 'y', 'z'] as const;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error('Executed field observation: ' + message);
}
const canonical = (value: unknown) => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item);
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

/** Observes an exported execution, never issues a successor, infers possession,
 * or fills a gap with a legacy match. Admission belongs to the Native owner;
 * browser shape validation is explicitly not database authentication. Each
 * frame is a stored exact state, including physical boundary states. */
export function createExecutedFieldWorldObserverV1(raw: ExecutedFieldWorldRecordingV1) {
  const recording = cloneInert(raw);
  assert(recording?.kind === 'joint_field_successor_executed_v1'
    && recording.physicalExecutionAdmitted === true && recording.motionIssued === true
    && recording.nextMotionAllowed === false && recording.officialResult === null
    && typeof recording.source?.sourceId === 'string' && recording.source.sourceId.trim().length > 0
    && typeof recording.source.sourceVersion === 'string' && recording.source.sourceVersion.trim().length > 0
    && Array.isArray(recording.steps) && recording.steps.length > 0, 'requires a completed finite execution export');
  // Reconstruct only the already accepted start state. This does not advance a
  // Core clock and does not authorize the source in a browser.
  const initial = createSourceBallWorldMotionSessionV1(recording.root).snapshot();
  const steps = recording.steps as ExecutedFieldWorldRecordingV1['steps'];
  const states: readonly Snapshot[] = [initial, ...steps.map(step => step.state)];
  const start = initial.cursor.moment, end = recording.executedThroughMoment;
  const tps = recording.root.response.world.parameters.ticksPerSecond;
  let previous = start.elapsedSeconds;
  const identities = new Set(initial.actors.map(a => a.playerId + '\0' + a.primitive.role));
  for (const state of states) {
    const at = state?.cursor?.moment;
    assert(at?.originTick === start.originTick && Number.isFinite(at.elapsedSeconds)
      && at.elapsedSeconds >= previous && at.elapsedSeconds <= end.elapsedSeconds,
    'nonmonotonic or different-origin stored state');
    assert(state.actors.length === identities.size && new Set(state.actors.map(a => a.playerId + '\0' + a.primitive.role)).size === identities.size
      && state.actors.every(a => identities.has(a.playerId + '\0' + a.primitive.role)), 'stored actor coverage differs');
    assert(state.orientation && Object.values(state.orientation).every(Number.isFinite)
      && Math.abs(Math.hypot(...Object.values(state.orientation)) - 1) <= 32 * Number.EPSILON,
    'invalid stored material orientation');
    assert(state.heldBats.length === initial.heldBats.length
      && state.heldBats.every((bat, i) => same(bat, initial.heldBats[i])), 'retained equipment differs');
    previous = at.elapsedSeconds;
  }
  assert(same(states.at(-1)!.cursor.moment, end), 'execution endpoint differs from final stored state');
  const frames = states.map(state => {
    const moment = state.cursor.moment;
    const sampled = state.actors.map(actor => {
      const p = actor.primitive;
      const dt = (moment.originTick - p.startTick) / tps + moment.elapsedSeconds - (actor.startElapsedSeconds ?? 0);
      assert(p.ticksPerSecond === tps && dt >= 0
        && moment.elapsedSeconds <= (p.endTick - moment.originTick) / tps, 'stored primitive coverage expired');
      const position = Object.fromEntries(axes.map(axis => [axis,
        p.startCenter[axis] + p.startVelocity[axis] * dt + .5 * p.acceleration[axis] * dt * dt])) as Vec3;
      const velocity = Object.fromEntries(axes.map(axis => [axis, p.startVelocity[axis] + p.acceleration[axis] * dt])) as Vec3;
      return { playerId: actor.playerId, role: p.role, radiusM: p.radius, position, velocity };
    });
    const players = [...new Set(sampled.map(a => a.playerId))].map(playerId => {
      const primitives = sampled.filter(a => a.playerId === playerId), body = primitives.find(a => a.role === 'body');
      const feet = primitives.filter(a => a.role === 'left_foot' || a.role === 'right_foot');
      assert(body && feet.length === 2, 'player body and both feet required');
      return { playerId, primitives, bodyPosition: body.position, velocity: body.velocity,
        // Existing PNGs are ground-anchored. Feet set the visible ground height;
        // neither this anchor nor a sprite is a physical body/catch primitive.
        anchor: { x: body.position.x, y: feet.reduce((sum, foot) => sum + foot.position.y - foot.radiusM, 0) / 2, z: body.position.z } };
    });
    return freeze({ moment, players, ball: { ...moment.ball, orientation: state.orientation,
      nativeObservation: true as const, ballKind: 'batted' as const },
    heldBats: state.heldBats.map(bat => ({ equipmentId: bat.equipmentId, holderPlayerId: bat.holderPlayerId, ...bat.bat.pose,
      radiusProfile: bat.bat.physical.radiusProfile, nativeObservation: true as const })),
    stopped: state.stopped, atCoverageEnd: same(moment, end), officialResult: null });
  });
  const observe = (elapsedSeconds: number) => {
    assert(Number.isFinite(elapsedSeconds) && elapsedSeconds >= start.elapsedSeconds && elapsedSeconds <= end.elapsedSeconds,
      'requested observation exceeds executed coverage');
    let index = 0;
    while (index + 1 < frames.length && frames[index + 1].moment.elapsedSeconds <= elapsedSeconds) index++;
    return frames[index];
  };
  return freeze({ provenance: 'HOST_EXPORTED_EXECUTION_NOT_BROWSER_AUTHENTICATION' as const,
    executionSource: recording.source, fromElapsedSeconds: start.elapsedSeconds, throughElapsedSeconds: end.elapsedSeconds,
    ticksPerSecond: tps, frames, observe, officialResult: null, canIssueMotion: false as const });
}
