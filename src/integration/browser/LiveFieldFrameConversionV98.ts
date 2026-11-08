import type { LiveMatchFrameV1, LivePositionV1 } from './LiveBaseballMatchV1';
import type { PlayableMatchRuleResultV1 } from './PlayableMatchRulesV1';
import type { simulateLiveFieldPlayV1 } from '../../core/sim/fielding/LiveFieldPlayV1';

export type LiveFieldFrameConversionInputV98 = Readonly<{
  field: Pick<ReturnType<typeof simulateLiveFieldPlayV1>, 'frames' | 'facts' | 'ruleFacts'>;
  readyFrame: LiveMatchFrameV1;
  defense: Readonly<Record<LivePositionV1, string>>;
  battingTeam: 0 | 1;
  ticksPerSecond: number;
  rules: PlayableMatchRuleResultV1 | null;
  sampleBatAtTick?: (tick: number) => LiveMatchFrameV1['bat'];
}>;

/** One read-only conversion for an ordinary match and the practice observer.
 * New body poses supply the renderer's foot anchor and canonical eye. Older
 * observations retain their existing y=0 anchor. Physics, actor intent,
 * possession and adjudication remain owned by the supplied Core. */
export function convertLiveFieldFramesV98(input: LiveFieldFrameConversionInputV98): LiveMatchFrameV1[] {
  const { field, readyFrame: ready, defense, battingTeam: team, ticksPerSecond: tps, rules: result } = input;
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
  let lastThrow = -Infinity, observer: string | undefined;
  return field.frames.map(f => {
    const events = field.facts.filter(e => e.tick <= f.tick);
    lastThrow = events.filter(e => e.kind === 'throw_release').at(-1)?.tick ?? -Infinity;
    const latestCatch = events.filter(e => e.kind === 'catch_secured').at(-1);
    observer = f.ball.possessedBy ?? latestCatch?.playerId ?? f.fielders.filter(a => a.intent === 'intercept')
      .sort((a, b) => Math.hypot(a.position.x - f.ball.position.x, a.position.z - f.ball.position.z)
        - Math.hypot(b.position.x - f.ball.position.x, b.position.z - f.ball.position.z))[0]?.playerId;
    return { ...ready, tick: f.tick, ball: f.ball, bat: input.sampleBatAtTick?.(f.tick) ?? null, actors: [
      ...f.fielders.map(a => ({ playerId: a.playerId, role: positions.find(pos => defense[pos] === a.playerId)!,
        team: 1 - team, position: a.bodyPoseV105?.foot ?? { ...a.position, y: 0 }, velocity: a.velocity,
        ...(a.bodyPoseV105 ? { bodyPoseV105: a.bodyPoseV105 } : {}),
        ...(a.athleticV115 ? { athleticV115: a.athleticV115 } : {}) })),
      ...f.runners.map(r => { const out = result?.kind === 'applied' ? result.outcomes.find(o => o.runnerId === r.runnerId) : null,
        dt = out ? Math.max(0, (f.tick - out.tick) / tps) : 0, dx = (team === 0 ? -30 : 30) - r.position.x,
        dz = 3 - r.position.z, length = Math.hypot(dx, dz), travel = Math.min(length, dt * 3.2);
        return { playerId: r.runnerId, role: 'runner' as const, team,
          position: r.bodyPoseV105?.foot ?? { x: r.position.x + dx / (length || 1) * travel, y: 0, z: r.position.z + dz / (length || 1) * travel },
          velocity: !r.bodyPoseV105 && dt > 0 ? { x: dx / (length || 1) * 3.2, y: 0, z: dz / (length || 1) * 3.2 } : r.velocity,
          ...(r.bodyPoseV105 ? { bodyPoseV105: r.bodyPoseV105 } : {}),
          ...(r.athleticV115 ? { athleticV115: r.athleticV115 } : {}), retired: r.retired }; })],
      phase: f.ball.possessedBy ? 'held' : lastThrow >= (latestCatch?.tick ?? Infinity) ? 'throw' : 'batted',
      ballKind: lastThrow >= (latestCatch?.tick ?? Infinity) ? 'throw' : 'batted',
      fairKnown: events.some(e => e.kind === 'territory_determined' && e.reason === 'fair'), possessedBy: f.ball.possessedBy,
      fieldObserverPlayerId: observer, defensiveOpportunity: f.defensiveOpportunity,
      homeRunConfirmed: !field.ruleFacts.pendingEquipmentPolicyV148 && !!field.ruleFacts.overFence?.fair
        && field.ruleFacts.overFence.untouchedGround && f.tick >= field.ruleFacts.overFence.tick };
  });
}
