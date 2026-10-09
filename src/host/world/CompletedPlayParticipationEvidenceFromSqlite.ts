import { assertNationalMatchBindings, nationalBinding } from './NationalMatchOriginFromSqlite';
import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import type { CompletedPlayParticipationReceipt, OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readPhysicalClosureProposal, assertPhysicalClosureStages, readPhysicalClosureWorkload } from './PhysicalPlayClosureEvidenceFromSqlite';
import { foulTerminalPostPlayCompletionEvidenceFromSqlite } from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import { assertParticipationApplicationOwnership, assertParticipationDomesticSeason, assertParticipationMetadataNode,
  participationReceiptId, readOwnedParticipationBindingJson } from './ActualLiveParticipationMetadata';
import { defensiveMetadataId as claim } from './ActualDefensiveMetadata';
import { sqliteJsonMetadataNodes as nodes } from './SqliteOwnershipMetadata';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';

type Db = Pick<DatabaseSync, 'prepare'>;
type Actor = Readonly<{ binding: OfficialParticipantBinding; actorKind: CompletedPlayParticipationReceipt['actorKind'] }>;
export type CompletedPlayParticipationEvidence = Readonly<{
  receipt: CompletedPlayParticipationReceipt;
  current: Readonly<{ stateJson: string; activationJson: string; final: boolean }>;
}>;
const bindingFields = ['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'clubId', 'side',
  'playerId', 'personId', 'personLinkSourceId', 'rosterRevision', 'fixtureEventId'] as const;
const id = (value: unknown): value is string => typeof value === 'string' && !!value && value.trim() === value;
const nativeTransaction = (db: Db): DatabaseSync => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('completed participation requires a Native owner transaction');
  return db;
};
/** Membership comes from the closed play's original frame, never its successor World. */
const participant = (db: Db, gameId: string, playerId: string, actors: readonly Actor[], scope: Readonly<{
  careerId: string; seasonId: string; game: { gameId: string; homeClubId: string; awayClubId: string };
}>, fieldingSide: 'HOME' | 'AWAY', national = false): Actor => {
  if (!actors.length || actors.filter(a => a.actorKind === 'DEFENDER').length !== 9
    || new Set(actors.map(a => a.binding.playerId)).size !== actors.length
    || new Set(actors.map(a => a.binding.personId)).size !== actors.length || scope.game.gameId !== gameId) {
    throw new Error('completed participation original actor membership differs');
  }
  const selected = actors.filter(a => a.binding.playerId === playerId);
  if (selected.length !== 1) throw new Error('player is absent from original completed play actors');
  for (const actor of actors) {
    const b = actor.binding, document = readOwnedParticipationBindingJson(db, gameId, b.playerId);
    if (!document || json(JSON.parse(document)) !== json(b) || nationalBinding(b) !== national) {
      throw new Error(national ? 'completed participation original National binding differs' : 'completed participation original domestic binding differs');
    }
    for (const key of bindingFields) {
      const numeric = key === 'gameDay' || key === 'rosterRevision', value = b[key];
      if (numeric ? typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 : !id(value)) {
        throw new Error('completed participation binding identity or day differs');
      }
      assertParticipationMetadataNode(db, document, [key], numeric ? 'integer' : 'text', value);
    }
    const person = readOfficialActorPersonLink(db, b);
    if (b.gameId !== gameId || b.careerId !== scope.careerId || b.competitionEditionId !== scope.seasonId
      || b.gameDay !== actors[0].binding.gameDay || b.fixtureEventId !== actors[0].binding.fixtureEventId
      || b.side !== (actor.actorKind === 'DEFENDER' ? fieldingSide : fieldingSide === 'HOME' ? 'AWAY' : 'HOME')
      || b.clubId !== (b.side === 'HOME' ? scope.game.homeClubId : scope.game.awayClubId)
      || person.acceptedAtDay > b.gameDay || person.rosterRevision > b.rosterRevision) {
      throw new Error('completed participation original role or Person scope differs');
    }
  }
  if (national) {
    const origin = assertNationalMatchBindings(db, actors.map(a => a.binding));
    if (!origin || origin.fixture.competitionEditionId !== scope.seasonId || origin.fixture.careerId !== scope.careerId
      || origin.fixture.homeClubId !== scope.game.homeClubId || origin.fixture.awayClubId !== scope.game.awayClubId) {
      throw new Error('completed participation original National fixture differs');
    }
  } else assertParticipationDomesticSeason(db, scope.careerId, scope.seasonId);
  return selected[0];
};

const ordinaryOwner = (db: Db, sourceId: string) => {
  const storage = db.prepare("SELECT name,type FROM main.sqlite_master WHERE lower(name)=lower('physical_play_closures')").all();
  if (storage.length !== 1 || storage[0].name !== 'physical_play_closures' || storage[0].type !== 'table'
    || db.prepare("SELECT 1 FROM temp.sqlite_master WHERE lower(name)=lower('physical_play_closures')").get()) {
    throw new Error('completed participation physical owner storage differs');
  }
  const sourceClaims = [['source_json', ['sourceId']], ['result_json', ['sourceId']]] as const;
  const sources = db.prepare(`SELECT source_id,application_id,game_id,play_id FROM main.physical_play_closures
    WHERE source_id=$source OR ${sourceClaims.map(([column, path]) => claim(column, path, '$source')).join(' OR ')}`).all({ source: sourceId });
  if (sources.length !== 1 || sources[0].source_id !== sourceId) throw new Error('completed participation physical ownership differs');
  const first = sources[0];
  const applicationClaims = [['source_json', ['applicationId']], ['proposal_json', ['application', 'applicationId']],
    ...['receipt', 'activation', 'result'].flatMap(branch => [
      ['proposal_json', ['expectedOfficial', branch, 'applicationId']], ['proposal_json', ['expectedOfficial', branch, 'closureId']],
      ['result_json', ['official', branch, 'applicationId']], ['result_json', ['official', branch, 'closureId']],
    ] as const)] as const;
  const gameClaims = [['proposal_json', ['application', 'matchId']], ['proposal_json', ['physicalPitch', 'frame', 'gameId']],
    ['proposal_json', ['worldFixture', 'game', 'gameId']], ['result_json', ['gameId']],
    ['result_json', ['official', 'result', 'gameId']]] as const;
  const playClaims = [['proposal_json', ['application', 'match', 'playId']], ['proposal_json', ['physicalPitch', 'frame', 'match', 'playId']],
    ['proposal_json', ['expectedOfficial', 'receipt', 'previousPlayId']], ['result_json', ['playId']],
    ['result_json', ['official', 'receipt', 'previousPlayId']]] as const;
  const games = ['game_id=$game', ...gameClaims.map(([column, path]) => claim(column, path, '$game'))].join(' OR ');
  const plays = ['play_id=$play', ...playClaims.map(([column, path]) =>
    `EXISTS(SELECT 1 FROM (${nodes(column, path)}) n WHERE n.atom=$play OR (n.type='text' AND n.atom=CAST($play AS TEXT)))`)].join(' OR ');
  const rows = db.prepare(`SELECT source_id FROM main.physical_play_closures WHERE source_id=$source OR application_id=$application
    OR ((${games}) AND (${plays})) OR ${applicationClaims.map(([column, path]) => claim(column, path, '$application')).join(' OR ')}`)
    .all({ source: sourceId, application: first.application_id, game: first.game_id, play: first.play_id });
  if (rows.length !== 1 || rows[0].source_id !== sourceId) throw new Error('completed participation physical ownership differs');
  const saved = readPhysicalClosureProposal(db, sourceId);
  if (!saved || saved.row.status !== 'COMPLETED') throw new Error('participation requires completed original physical closure');
  return saved;
};

export const deriveCompletedPlayParticipationEvidence = (db: Db, gameId: string, playerId: string,
  sourceId: string, evidenceKind: CompletedPlayParticipationReceipt['evidenceKind']): CompletedPlayParticipationEvidence => {
  const connection = nativeTransaction(db);
  if (![gameId, playerId, sourceId].every(id)) throw new Error('invalid completed participation reference');
  return withBattedVenueLegalReadSnapshot(connection, () => {
  let selected: Actor, closureApplicationId: string, closureProposalHash: string, playedPlayId: number, durableRevision: number;
  let stateJson: string, activationJson: string, final: boolean;
  if (evidenceKind === 'PHYSICAL_PLAY_V1' || evidenceKind === 'NATIONAL_PHYSICAL_PLAY_V1') {
    const saved = ordinaryOwner(db, sourceId), p = saved.proposal, f = p.physicalPitch.frame, official = p.expectedOfficial;
    if (saved.row.game_id !== gameId || p.application.matchId !== gameId || f.gameId !== gameId
      || official.receipt.previousPlayId !== f.match.playId || official.receipt.durableRevision !== f.officialRevision + 1) {
      throw new Error('completed participation original game or revision differs');
    }
    assertPhysicalClosureStages(db, p);
    const workload = readPhysicalClosureWorkload(db, p);
    const result = { sourceId, gameId, playId: saved.row.play_id, official, scoring: p.expectedScoring, workload };
    if (!workload || saved.row.result_json !== json(result)) throw new Error('completed participation physical effects differ');
    assertParticipationApplicationOwnership(db, { gameId, playId: f.match.playId, application: p.application,
      source: { sourceId: p.application.applicationId }, expectedOfficial: official });
    const actors: Actor[] = f.bindings.map(binding => ({ binding, actorKind: 'DEFENDER' }));
    if (f.batterActor) actors.push({ binding: f.batterActor.binding, actorKind: 'BATTER' });
    if (f.prePitchRunner) actors.push({ binding: f.prePitchRunner.binding, actorKind: 'RUNNER' });
    if (f.world.defenders.length !== 9 || f.world.defenders.some(d => f.bindings.filter(b => b.playerId === d.playerId).length !== 1)
      || f.prePitchRunner && f.world.runners.filter(r => r.playerId === f.prePitchRunner!.binding.playerId).length !== 1) {
      throw new Error('completed participation original World membership differs');
    }
    selected = participant(db, gameId, playerId, actors, p.worldFixture, f.match.half === 'top' ? 'HOME' : 'AWAY', evidenceKind === 'NATIONAL_PHYSICAL_PLAY_V1');
    closureApplicationId = p.application.applicationId; closureProposalHash = hash(p); playedPlayId = f.match.playId;
    durableRevision = official.receipt.durableRevision;
    stateJson = json('result' in official ? official.receipt.appliedMatchState : official.activation.nextMatchState);
    activationJson = json('result' in official ? { finalResult: official.result } : { activation: official.activation, nextWorld: official.nextWorld });
    final = 'result' in official;
  } else if (evidenceKind === 'FOUL_TERMINAL_V1' || evidenceKind === 'NATIONAL_FOUL_TERMINAL_V1') {
    const completed = foulTerminalPostPlayCompletionEvidenceFromSqlite(connection).read(sourceId);
    if (!completed) throw new Error('participation requires completed original terminal closure');
    const p = completed.proposal, c = completed.result.completion, receipt = completed.result.official.receipt;
    if (p.gameId !== gameId || p.source.sourceId !== sourceId || receipt.previousPlayId !== p.playId
      || receipt.applicationId !== p.source.applicationId || receipt.durableRevision !== p.originalOfficialRevision + 1
      || p.participants.length !== 10 || p.participants.filter(a => a.role === 'batter').length !== 1) {
      throw new Error('completed participation terminal original scope differs');
    }
    selected = participant(db, gameId, playerId, p.participants.map(a => ({ binding: a.binding,
      actorKind: a.role === 'batter' ? 'BATTER' : 'DEFENDER' })), { ...p.seasonFixture, seasonId: p.seasonFixture.competitionEditionId },
    p.applicationBody.match.half === 'top' ? 'HOME' : 'AWAY', evidenceKind === 'NATIONAL_FOUL_TERMINAL_V1');
    closureApplicationId = p.source.applicationId; closureProposalHash = hash(p); playedPlayId = p.playId;
    durableRevision = receipt.durableRevision; stateJson = json('finalResult' in c ? receipt.appliedMatchState : c.activation.nextMatchState);
    activationJson = json('finalResult' in c ? { finalResult: c.finalResult } : { activation: c.activation, nextWorld: c.nextWorld });
    final = 'finalResult' in c;
  } else throw new Error('unsupported completed participation format');
  const match = db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(gameId);
  if (!match || typeof match.durable_revision !== 'number' || match.durable_revision < durableRevision
    || final && match.durable_revision !== durableRevision || match.durable_revision === durableRevision
      && (match.state_json !== stateJson || match.activation_json !== activationJson)) {
    throw new Error('completed participation historical Match differs');
  }
  return freeze({ receipt: { evidenceKind, receiptId: participationReceiptId(gameId, playerId), binding: selected.binding,
    actorKind: selected.actorKind, closureSourceId: sourceId, closureApplicationId, closureProposalHash, playedPlayId, durableRevision },
  current: { stateJson, activationJson, final } });
  });
};

/** Admission only. Exact retries and history keep the immutable original evidence. */
export const assertCompletedPlayParticipationCurrent = (db: Db, evidence: CompletedPlayParticipationEvidence): void => {
  const match = db.prepare('SELECT durable_revision,state_json,activation_json FROM matches WHERE match_id=?').get(evidence.receipt.binding.gameId);
  if (!match || match.durable_revision !== evidence.receipt.durableRevision || match.state_json !== evidence.current.stateJson
    || match.activation_json !== evidence.current.activationJson) throw new Error('completed participation current Match differs');
};
