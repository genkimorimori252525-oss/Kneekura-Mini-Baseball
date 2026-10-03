import { battedContactResponseFixture } from './BattedContactResponseFixtures.test-support';
import { battedWorldAcquisitionFixture } from './BattedWorldAcquisitionFixtures.test-support';
import { openSqliteBattedWorldMotionStore, type AcceptedBattedWorldMotion } from './SqliteBattedWorldMotionStore';

export const battedWorldMotionFixture = (path?: string, kind: 'free' | 'carried' | 'later' = 'free') => {
  const capture = kind === 'free' ? null : battedWorldAcquisitionFixture(path, kind === 'later' ? 'later' : 'original');
  const base = capture ?? battedContactResponseFixture(path, 'body');
  const response = base.responses.accept(base.responseSource.sourceId);
  const acquisition = capture ? capture.acquisitions.accept(capture.acquisitionSource.sourceId) : null;
  const basisTick = acquisition?.result.kind === 'secured' ? acquisition.result.secureTick : response.result.kind === 'rebound' ? response.result.ball.tick : 0;
  const source: AcceptedBattedWorldMotion = { sourceId: 'motion-1', sourceVersion: 'fixture-v1', responseSourceId: response.source.sourceId,
    continuationSourceId: acquisition?.source.continuationSourceId ?? null, acquisitionSourceId: acquisition?.source.sourceId ?? null,
    previousMotionSourceId: null, availableAtTick: basisTick, throughTick: basisTick + 1000,
    commands: response.touch.worldContact.source.commands.map((command) => ({ playerId: command.playerId, bodyAcceleration: command.bodyAcceleration,
      primitiveMotions: command.primitiveMotions.map((motion) => ({ role: motion.role, offsetAcceleration: motion.offsetAcceleration })) })) };
  const sources = new Map([[source.sourceId, source]]), authority = { readAcceptedMotion: (id: string) => sources.get(id) ?? null };
  const motions = base.f.track(openSqliteBattedWorldMotionStore(base.f.path, base.responses, authority));
  return { ...base, response, acquisition, motionSource: source, motionSources: sources, motionAuthority: authority, motions };
};
