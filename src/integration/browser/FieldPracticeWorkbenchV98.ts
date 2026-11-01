import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { CanonicalMatchState } from '../../core/model/CanonicalMatchState';
import { asRuleProfileId } from '../../core/model/RuleProfileRef';
import { simulateLiveFieldPlayV1, type LiveFieldPlayInputV1 } from '../../core/sim/fielding/LiveFieldPlayV1';
import { buildLiveFieldPlayInputV95, type LiveFieldInputRequestV95, type LiveFieldResolvedPlayerV95 } from './LiveFieldInputV95';
import { resolveLiveMatchPlayerPhysicalV98, type LiveMatchFrameV1, type LivePlayerV1 } from './LiveBaseballMatchV1';
import { resolveLiveTechnicalTraitsV75, validateLiveTraitProfileV1 } from './LiveTraitProfilesV1';
import { convertLiveFieldFramesV98 } from './LiveFieldFrameConversionV98';
import { reducePlayableMatchV1 } from './PlayableMatchRulesV1';

export type FieldPracticeContextV98 = Readonly<{
  source?: 'AUTHORED_NOCK' | 'MATCH_CONTACT';
  beforeMatch?: CanonicalMatchState;
  regulationInnings?: number;
  battingTeam?: 0 | 1;
  pitcherPlayerId?: string;
  buntAttempt?: boolean;
  sourceGameSha256?: string;
  sourceCoreSha256?: string;
}>;
export type FieldPracticeRequestV98 = Readonly<{
  /** Same request as the normal Host. Physical/technical execution values have
   * already been resolved once, e.g. by resolveFieldPracticePlayersV98. */
  fieldInput: LiveFieldInputRequestV95;
  context?: FieldPracticeContextV98;
  executionPerturbationsV95?: LiveFieldPlayInputV1['executionPerturbationsV95'];
}>;
const roles = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'] as const;
const freeze = <T>(value: T): T => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
function assert(value: unknown, message: string): asserts value {
  if (!value) throw Error('field practice V98: ' + message);
}

/** Full ordinary Host physical validation and trait resolution, without pitch
 * generation, measured-clip duplication or mutation of an authored roster. */
export function resolveFieldPracticePlayersV98(raw: readonly LivePlayerV1[]): readonly LiveFieldResolvedPlayerV95[] {
  const players = cloneInert(raw);
  assert(Array.isArray(players) && players.length > 0 && players.length <= 256, 'finite player roster required');
  assert(new Set(players.map(p => p.playerId)).size === players.length && players.every(p => p.playerId && p.name
    && Number.isFinite(p.heightMeters) && p.heightMeters > 0 && ['R', 'L'].includes(p.bats)
    && (p.throws === undefined || ['R', 'L'].includes(p.throws))), 'unique physical players required');
  return freeze(players.map(player => {
    const physical = resolveLiveMatchPlayerPhysicalV98(player);
    if (player.traitProfile !== undefined) validateLiveTraitProfileV1(player.traitProfile, physical);
    const technicalSkills = resolveLiveTechnicalTraitsV75(player.traitProfile);
    return { playerId: player.playerId, heightMeters: player.heightMeters, physical, ...(technicalSkills ? { technicalSkills } : {}),
      ...(player.traitProfile ? { traitProfile: player.traitProfile } : {}) };
  }));
}

/** A bounded, read-only observer of the same field engine and rule reducer.
 * No practice result, debug future trajectory or presentation time is supplied
 * back to an actor's controller. An incomplete Core play stays incomplete. */
export function runFieldPracticeV98(raw: FieldPracticeRequestV98) {
  const request = cloneInert(raw), spec = request.fieldInput, context = request.context ?? {};
  assert(Object.keys(request).every(k => ['fieldInput', 'context', 'executionPerturbationsV95'].includes(k)), 'unknown request field');
  assert(spec && Object.keys(spec).every(k => ['ball', 'orientation', 'physics', 'seed', 'field', 'outs', 'maxPlaySeconds',
    'frameSeconds', 'defense', 'placements', 'players', 'batterRunnerId', 'batterPosition', 'occupiedBases', 'baserunning'].includes(k)),
    'unknown field input property');
  assert(['conservative', 'balanced', 'aggressive'].includes(spec.baserunning), 'invalid baserunning policy');
  assert(context && Object.keys(context).every(k => ['source', 'beforeMatch', 'regulationInnings', 'battingTeam',
    'pitcherPlayerId', 'buntAttempt', 'sourceGameSha256', 'sourceCoreSha256'].includes(k)), 'unknown context field');
  assert(context.source === undefined || ['AUTHORED_NOCK', 'MATCH_CONTACT'].includes(context.source), 'unknown practice source');
  assert(context.battingTeam === undefined || context.battingTeam === 0 || context.battingTeam === 1, 'invalid batting team');
  assert(context.buntAttempt === undefined || typeof context.buntAttempt === 'boolean', 'invalid bunt attempt');
  const innings = context.regulationInnings ?? 9;
  assert(Number.isSafeInteger(innings) && innings >= 1, 'invalid regulation innings');
  for (const key of ['sourceGameSha256', 'sourceCoreSha256'] as const)
    assert(context[key] === undefined || /^[a-f0-9]{64}$/.test(context[key]!), 'invalid source SHA: ' + key);
  const team = context.battingTeam ?? (context.beforeMatch?.half === 'bottom' ? 1 : 0);
  const beforeMatch: CanonicalMatchState = context.beforeMatch ?? { ruleProfileId: asRuleProfileId('npb-2026'),
    inning: 1, half: team === 0 ? 'top' : 'bottom', outs: spec.outs, balls: 0, strikes: 0,
    bases: { ...spec.occupiedBases }, score: { away: 0, home: 0 }, playId: 0 };
  assert(typeof beforeMatch.ruleProfileId === 'string' && beforeMatch.ruleProfileId.length > 0
    && Number.isSafeInteger(beforeMatch.inning) && beforeMatch.inning >= 1 && ['top', 'bottom'].includes(beforeMatch.half)
    && Number.isSafeInteger(beforeMatch.playId) && beforeMatch.playId >= 0
    && Number.isInteger(beforeMatch.balls) && beforeMatch.balls >= 0 && beforeMatch.balls <= 3
    && Number.isInteger(beforeMatch.strikes) && beforeMatch.strikes >= 0 && beforeMatch.strikes <= 2
    && [beforeMatch.score.away, beforeMatch.score.home].every(n => Number.isSafeInteger(n) && n >= 0), 'invalid active match context');
  assert(beforeMatch.outs === spec.outs, 'context outs differ from physical request');
  assert((beforeMatch.half === 'top' ? 0 : 1) === team, 'context batting team differs from active half');
  assert((['first', 'second', 'third'] as const).every(base => beforeMatch.bases[base] === spec.occupiedBases[base]),
    'context bases differ from physical request');
  const pitcherId = context.pitcherPlayerId ?? spec.defense.P;
  assert(pitcherId === spec.defense.P, 'pitcher differs from defensive P');
  const occupied = Object.values(spec.occupiedBases).filter((id): id is string => id !== null);
  assert(!Object.values(spec.defense).some(id => [spec.batterRunnerId, ...occupied].includes(id)), 'one player cannot bat and defend simultaneously');
  const mapped = buildLiveFieldPlayInputV95(spec), input: LiveFieldPlayInputV1 = {
    ...mapped, recordInitialMovementV98: true,recordDecisionTraceV118:true,
    ...(request.executionPerturbationsV95 ? { executionPerturbationsV95: request.executionPerturbationsV95 } : {}) };
  const field = simulateLiveFieldPlayV1(input), ticksPerSecond = spec.physics.air.ticksPerSecond;
  const rules = field.end.complete ? reducePlayableMatchV1({ match: beforeMatch, batterRunnerId: spec.batterRunnerId,
    regulationInnings: innings, event: { kind: 'field_play', facts: { ...field.ruleFacts, buntAttempt: context.buntAttempt ?? false } } }) : null;
  const beforeFrame: LiveMatchFrameV1 = { tick: input.ball.ball.tick,
    ball: { ...field.frames[0].ball }, bat: null,
    actors: [...roles.map(role => ({ playerId: spec.defense[role], role, team: 1 - team,
      position: { ...spec.placements[role], y: 0 }, velocity: { x: 0, y: 0, z: 0 } })),
    { playerId: spec.batterRunnerId, role: 'batter', team, position: { ...spec.batterPosition }, velocity: { x: 0, y: 0, z: 0 } },
    ...input.runners.filter(r => r.initialBase !== 0).map(r => ({ playerId: r.runnerId, role: 'runner' as const, team,
      position: { ...spec.field.bases[(['home', 'first', 'second', 'third'] as const)[r.initialBase]], y: 0 },
      velocity: { x: 0, y: 0, z: 0 } }))],
    batterPlayerId: spec.batterRunnerId, pitcherPlayerId: pitcherId, phase: 'ready', ballKind: 'batted', fairKnown: false, possessedBy: null };
  const frames = convertLiveFieldFramesV98({ field, readyFrame: beforeFrame, defense: spec.defense,
    battingTeam: team, ticksPerSecond, rules });
  return freeze({ version: 'field_practice_workbench_v98' as const, input, field, frames, rules, beforeFrame, beforeMatch,
    match: rules?.kind === 'applied' ? rules.match : beforeMatch, batterPlayerId: spec.batterRunnerId, pitcherPlayerId: pitcherId,
    ticksPerSecond, context: { ...context, source: context.source ?? 'AUTHORED_NOCK', battingTeam: team, regulationInnings: innings },
    authority: 'SHARED_LIVE_FIELD_CORE_READ_ONLY_OBSERVER' as const, nativeSqliteAdmission: false, seasonRecorded: false });
}
