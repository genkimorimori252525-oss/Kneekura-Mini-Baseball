import { battedWorldFieldExecutionFixture } from './BattedWorldFieldExecutionFixtures.test-support';
import { actualPlayersKinematicsFromPrefix } from './ActualPlayerKinematicsFromPrefix';
import { battedWorldFieldEvidenceFromSqlite } from './SqliteBattedWorldFieldStore';
import { battedWorldFieldExecutionEvidenceFromSqlite, type AcceptedBattedWorldFieldExecution } from './SqliteBattedWorldFieldExecutionStore';
import type { OwnedMotionV2Action } from './OwnedScheduledBattedWorldMotion';
import { ownedMotionKnownWorkFromSqlite } from './OwnedMotionKnownWorkFromSqlite';
import { ownedScheduledMotionPhase } from './OwnedScheduledMotionTiming.test-support';

export const ownedScheduledMotionFixture = (path?: string, capturePower = 100_000_000, initialFieldThroughTicks?: number,
  configureWorld?: Parameters<typeof battedWorldFieldExecutionFixture>[2]) => {
  const x = battedWorldFieldExecutionFixture(path, 'candidate', configureWorld,
    { contactElapsedSeconds: .01, captureDissipationPowerW: capturePower, ...(initialFieldThroughTicks === undefined ? {} : { initialFieldThroughTicks }) });
  const playerIds = x.fieldSource.commands.map(c => c.playerId);
  const prefix = (through: string | null) => ({ baseField: x.baseField, fields: battedWorldFieldEvidenceFromSqlite(x.f.db).scope(x.baseField),
    executions: battedWorldFieldExecutionEvidenceFromSqlite(x.f.db).scope(x.baseField, through) });
  const knownWork = () => ownedMotionKnownWorkFromSqlite(x.f.db, x.baseField.response.touch.worldContact.flight.source.physicalPitchSourceId, playerIds);
  const selves = (through: string | null) => ownedScheduledMotionPhase(`selves:${through}`, () => {
    const p = prefix(through); return actualPlayersKinematicsFromPrefix(playerIds, p);
  });
  const plan = (sourceId: string, previousExecutionSourceId: string | null = null) => {
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId,
      action: { kind: 'owned_acquisition_plan_v1', knownWork: knownWork() } };
    x.sources.set(sourceId, source); return ownedScheduledMotionPhase(`plan:${sourceId}`, () => x.executions.accept(sourceId));
  };
  const stepSource = (sourceId: string, previousExecutionSourceId: string, checkpoint: OwnedMotionV2Action['checkpoint'], selectedPlayers: readonly string[] = []) => {
    const known = knownWork(), action: OwnedMotionV2Action = { kind: 'owned_motion_v2', checkpoint, knownWork: known,
      contributions: selves(previousExecutionSourceId).map(s => selectedPlayers.includes(s.playerId)
        ? { kind: 'motor', playerId: s.playerId, motorSourceId: known.find(w => w.playerId === s.playerId)!.motorSourceId! }
        : { kind: 'retained', playerId: s.playerId, command: s.activeCommand }) };
    const source: AcceptedBattedWorldFieldExecution = { ...x.source, sourceId, previousExecutionSourceId, action };
    x.sources.set(sourceId, source); return source;
  };
  const step = (...args: Parameters<typeof stepSource>) => {
    const start = Date.now(), source = ownedScheduledMotionPhase(`prepare:${args[0]}`, () => stepSource(...args)), prepared = Date.now();
    const result = ownedScheduledMotionPhase(`accept:${source.sourceId}`, () => x.executions.accept(source.sourceId));
    if (process.env.OWNED_TIMINGS) console.info('owned-fixture-step', source.sourceId, 'prepare-ms', prepared - start, 'accept-ms', Date.now() - prepared);
    return result;
  };
  return { ...x, playerIds, prefix, knownWork, selves, plan, step, stepSource };
};
