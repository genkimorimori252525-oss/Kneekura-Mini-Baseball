import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { DatabaseSync } from 'node:sqlite';
import { readOriginalPhysicalPitchPrefixFromSqlite } from './PhysicalPitchEvidenceFromSqlite';
import { readPhysicalPlateAppearanceActorFromSqlite, assertPhysicalActorOpenFrame, actorHash as hash, actorJson as json,
  actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { playerPersonLinkEvidenceFromSqlite } from './SqlitePlayerPersonLinkStore';

export type AcceptedOriginalRunnerPublicKnowledge = Readonly<{
  kind: 'original_runner_public_knowledge_v1'; sourceId: string; sourceVersion: string;
  physicalPitchSourceId: string; playerId: string; physicalActorSourceId: string; prePitchRunnerSourceId: string;
}>;
export type DurableOriginalRunnerPublicKnowledge = Readonly<{
  version: 'original_runner_public_knowledge_v1'; source: AcceptedOriginalRunnerPublicKnowledge;
  recipient: Readonly<{ careerId: string; gameId: string; playId: number; playerId: string; personId: string }>;
  availableAtTick: number;
  original: Readonly<{ physicalActorSourceId: string; prePitchRunnerSourceId: string; officialRevision: number;
    matchHash: string; actorHash: string; runnerHash: string; physicalPitchHash: string }>;
  known: Readonly<{ inning: number; half: 'top' | 'bottom'; battingSide: 'AWAY' | 'HOME'; outs: number;
    score: Readonly<{ home: number; away: number }>; battingRuns: number; defendingRuns: number;
    startingBase: 1 | 2 | 3; normalNextBase: 2 | 3 | 4 }>;
  liveContext: Readonly<{ status: 'pending'; knownContext: null; force: 'unavailable'; tagUp: 'unavailable'; consumedSignals: readonly never[] }>;
}>;
export const publicKnowledgeId = (value: unknown): value is string => typeof value === 'string' && !!value.length && value === value.trim();
const tick = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
export const originalRunnerPublicKnowledgeInput = (raw: AcceptedOriginalRunnerPublicKnowledge,
  sourceId?: string): AcceptedOriginalRunnerPublicKnowledge => {
  const source = cloneInert(raw), keys = ['kind', 'sourceId', 'sourceVersion', 'physicalPitchSourceId', 'playerId', 'physicalActorSourceId', 'prePitchRunnerSourceId'];
  if (!source || typeof source !== 'object' || Array.isArray(source) || Object.keys(source).sort().join('|') !== keys.sort().join('|')
    || source.kind !== 'original_runner_public_knowledge_v1' || sourceId !== undefined && source.sourceId !== sourceId
    || ![source.sourceId, source.sourceVersion, source.physicalPitchSourceId, source.playerId, source.physicalActorSourceId,
      source.prePitchRunnerSourceId].every(publicKnowledgeId)) throw new Error('invalid original runner public knowledge Source');
  return freeze(source);
};

/** Internal same-connection reconstruction. Public information comes from the
 * original activation only; no latest Match, true live rule or policy is read. */
export const deriveOriginalRunnerPublicKnowledge = (db: Pick<DatabaseSync, 'prepare'>,
  raw: AcceptedOriginalRunnerPublicKnowledge): DurableOriginalRunnerPublicKnowledge => {
  const source = originalRunnerPublicKnowledgeInput(raw);
  const pitch = readOriginalPhysicalPitchPrefixFromSqlite(db, source.physicalPitchSourceId).at(-1);
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, source.physicalActorSourceId), runner = pitch?.frame.prePitchRunner;
  if (!pitch || !actor || !runner || runner.binding.playerId !== source.playerId || runner.source.sourceId !== source.prePitchRunnerSourceId
    || runner.source.physicalActorSourceId !== source.physicalActorSourceId || actor.source.gameId !== pitch.frame.gameId
    || json(actor) !== json(pitch.frame.batterActor) || json(actor.match) !== json(pitch.frame.match)
    || actor.officialRevision !== pitch.frame.officialRevision || actor.world.tick !== pitch.frame.world.tick) {
    throw new Error('original runner public knowledge actor, pitch or recipient differs');
  }
  const person = playerPersonLinkEvidenceFromSqlite(db).readLink(runner.binding.personLinkSourceId);
  if (!person || json(person) !== json(runner.person) || person.playerId !== source.playerId
    || person.personId !== runner.binding.personId || person.careerId !== runner.binding.careerId
    || person.acceptedAtDay > runner.binding.gameDay) throw new Error('original runner public knowledge intake or day differs');
  const match = actor.match, side = match.half === 'top' ? 'AWAY' : 'HOME';
  if (!tick(match.inning) || match.inning < 1 || !['top', 'bottom'].includes(match.half)
    || !tick(match.outs) || match.outs > 2 || !match.score || !tick(match.score.home) || !tick(match.score.away)
    || !tick(match.playId) || !tick(actor.officialRevision) || !tick(actor.world.tick) || runner.binding.side !== side) {
    throw new Error('original runner public Match facts are incomplete or invalid');
  }
  const occupied = ([['first', 1, 2], ['second', 2, 3], ['third', 3, 4]] as const)
    .filter(([key]) => match.bases[key] === source.playerId);
  if (occupied.length !== 1 || Object.values(match.bases).filter(value => value !== null).length !== 1) {
    throw new Error('original runner public occupancy differs');
  }
  return freeze({ version: 'original_runner_public_knowledge_v1', source,
    recipient: { careerId: runner.binding.careerId, gameId: actor.source.gameId, playId: match.playId, playerId: source.playerId, personId: person.personId },
    availableAtTick: actor.world.tick,
    original: { physicalActorSourceId: actor.source.sourceId, prePitchRunnerSourceId: runner.source.sourceId, officialRevision: actor.officialRevision,
      matchHash: hash(match), actorHash: hash(actor), runnerHash: hash(runner), physicalPitchHash: hash(pitch) },
    known: { inning: match.inning, half: match.half, battingSide: side, outs: match.outs, score: { home: match.score.home, away: match.score.away },
      battingRuns: side === 'AWAY' ? match.score.away : match.score.home, defendingRuns: side === 'AWAY' ? match.score.home : match.score.away,
      startingBase: occupied[0][1], normalNextBase: occupied[0][2] },
    liveContext: { status: 'pending', knownContext: null, force: 'unavailable', tagUp: 'unavailable', consumedSignals: [] } });
};

/** Admission only. Saved baselines retain historical reads after later official
 * progress; a newly owned baseline must still refer to the current open frame. */
export const assertOriginalRunnerPublicKnowledgeCurrent = (db: Pick<DatabaseSync, 'prepare'>,
  value: DurableOriginalRunnerPublicKnowledge): void => {
  const actor = readPhysicalPlateAppearanceActorFromSqlite(db, value.source.physicalActorSourceId);
  if (!actor || hash(actor) !== value.original.actorHash) throw new Error('original public baseline actor changed before admission');
  assertPhysicalActorOpenFrame(db, actor);
};
