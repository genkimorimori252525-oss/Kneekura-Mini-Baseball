import { createRequire } from 'node:module';
import type { DatabaseSync } from 'node:sqlite';
import { cloneInert } from '../../core/adjudication/OfficialWindowPolicy';
import type { AttributedOfficialPlayerOutcome } from '../../core/world/competition/OfficialPlayerOutcomeStatistics';
import type { PersistedOfficialScoring } from '../SqliteOfficialScoringStore';
import { createSqliteOfficialScoringWriter } from '../SqliteOfficialScoringWriter';
import type { OfficialParticipantBinding } from './SqliteOfficialParticipationStore';
import { actorJson as json, actorHash as hash, actorFreeze as freeze, readPhysicalActorForPlayFromSqlite } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
import { readOfficialActorPersonLink } from './SqliteOfficialInitialWorldStore';
import { readPhysicalClosureProposal } from './PhysicalPlayClosureEvidenceFromSqlite';
import { deriveCompletedPlayParticipationEvidence, deriveCompletedFoulBatterParticipationWithOriginal } from './CompletedPlayParticipationEvidenceFromSqlite';
import { deriveActualLiveParticipationEvidence } from './ActualLiveParticipationEvidenceFromSqlite';
import { actualLivePlayClosureEvidenceFromSqlite } from './ActualLivePlayClosureEvidenceFromSqlite';
import { actualLiveScoringEvidenceFromSqlite, assertActualLiveScoringStage } from './ActualLiveScoringEvidenceFromSqlite';
import { readSamePaTransitionArchive, readSamePaTerminalTransitionFromSqlite } from './SamePlateAppearanceTerminalTransitionFromSqlite';
import { readSamePaTerminalEndpointFromSqlite } from './SamePlateAppearanceTerminalEndpointFromSqlite';
import { readSamePaTerminalReleaseFromSqlite } from './SamePlateAppearanceTerminalSettlementFromSqlite';
import { nationalBinding, assertNationalMatchBindings } from './NationalMatchOriginFromSqlite';
import { withBattedVenueLegalReadSnapshot } from './SqliteBattedVenueLegalPolicyStore';
import { scoringOwnershipRows, actualScoringOriginalOwnershipRows } from './ActualLiveScoringMetadata';

export type OfficialPlayerOutcomeSource = Readonly<{
  owner: 'physical_play_closures' | 'actual_foul_terminal_applications' | 'actual_live_play_closures' | 'pa_terminal_v1_transitions';
  sourceId: string;
}>;
export type OfficialPlayerOutcomeAttribution = AttributedOfficialPlayerOutcome & Readonly<{
  kind: 'attributed'; source: OfficialPlayerOutcomeSource; sourceProofHash: string;
  batter: OfficialParticipantBinding; pitcher: OfficialParticipantBinding;
  batterPersonHash: string; pitcherPersonHash: string;
  officialApplicationId: string; durableRevision: number; scoring: PersistedOfficialScoring;
}>;
export type OfficialPlayerOutcomeUnavailable = Readonly<{
  kind: 'unavailable'; source: OfficialPlayerOutcomeSource;
  reason: 'original_batter_missing' | 'supported_official_scoring_missing';
}>;
export type OfficialPlayerOutcomeEvidence = OfficialPlayerOutcomeAttribution | OfficialPlayerOutcomeUnavailable;
const id = (v: unknown): v is string => typeof v === 'string' && !!v && v.trim() === v;
export const officialPlayerOutcomeSource = (raw: OfficialPlayerOutcomeSource): OfficialPlayerOutcomeSource => {
  const source = cloneInert(raw);
  if (!source || Object.keys(source).sort().join('|') !== 'owner|sourceId' || !id(source.sourceId)
    || !['physical_play_closures', 'actual_foul_terminal_applications', 'actual_live_play_closures', 'pa_terminal_v1_transitions'].includes(source.owner)) {
    throw new Error('invalid official player outcome Source');
  }
  return freeze(source);
};
const unavailable = (source: OfficialPlayerOutcomeSource, reason: OfficialPlayerOutcomeUnavailable['reason']): OfficialPlayerOutcomeUnavailable =>
  freeze({ kind: 'unavailable', source, reason });
const pitcherFromActor = (actor: NonNullable<ReturnType<typeof readPhysicalActorForPlayFromSqlite>>) => {
  const ids = actor.world.defenders.filter(d => d.registeredPosition === 'P').map(d => d.playerId);
  const pitchers = actor.defenderBindings.filter(b => ids.includes(b.playerId));
  if (ids.length !== 1 || pitchers.length !== 1) throw new Error('official player outcome original pitcher differs');
  return pitchers[0];
};
const result = (db: DatabaseSync, source: OfficialPlayerOutcomeSource, sourceProof: unknown,
  batter: OfficialParticipantBinding, pitcher: OfficialParticipantBinding, scoring: PersistedOfficialScoring,
  durableRevision: number): OfficialPlayerOutcomeAttribution => {
  if (batter.playerId === pitcher.playerId || batter.personId === pitcher.personId || batter.side === pitcher.side
    || ['gameId', 'careerId', 'competitionEditionId', 'gameDay', 'fixtureEventId'].some(key =>
      batter[key as keyof OfficialParticipantBinding] !== pitcher[key as keyof OfficialParticipantBinding])
    || scoring.matchId !== batter.gameId || scoring.record.battingTeam !== (batter.side === 'HOME' ? 'home' : 'away')) {
    throw new Error('official player outcome original participant scope differs');
  }
  assertNationalMatchBindings(db, [batter, pitcher]);
  const batterPerson = readOfficialActorPersonLink(db, batter), pitcherPerson = readOfficialActorPersonLink(db, pitcher);
  return freeze({ kind: 'attributed', source, sourceProofHash: hash(sourceProof),
    attributionId: json(['official_player_outcome_v1', batter.careerId, batter.gameId, scoring.record.playId]),
    careerId: batter.careerId, competitionEditionId: batter.competitionEditionId, gameId: batter.gameId,
    playId: scoring.record.playId, gameDay: batter.gameDay, batterPlayerId: batter.playerId, pitcherPlayerId: pitcher.playerId,
    classification: scoring.record.classification, batter, pitcher, batterPersonHash: hash(batterPerson), pitcherPersonHash: hash(pitcherPerson),
    officialApplicationId: scoring.officialApplicationId, durableRevision, scoring });
};

/** Original play attribution only. This does not admit participation, assign
 * scorer judgments, or reinterpret a later lineup as the original actors. */
export const deriveOfficialPlayerOutcomeFromSqlite = (db: DatabaseSync, raw: OfficialPlayerOutcomeSource): OfficialPlayerOutcomeEvidence => {
  const { DatabaseSync: Native } = createRequire(import.meta.url)('node:sqlite');
  if (!(db instanceof Native) || !db.isTransaction) throw new Error('official player outcome requires an owned Native transaction');
  const source = officialPlayerOutcomeSource(raw);
  return withBattedVenueLegalReadSnapshot(db, () => {
    if (source.owner === 'physical_play_closures') {
      const original = readPhysicalClosureProposal(db, source.sourceId);
      if (!original || original.row.status !== 'COMPLETED') throw new Error('official player outcome physical closure is incomplete');
      const p = original.proposal, frame = p.physicalPitch.frame, batter = frame.batterActor;
      if (!batter) return unavailable(source, 'original_batter_missing');
      const proof = deriveCompletedPlayParticipationEvidence(db, frame.gameId, batter.binding.playerId, source.sourceId,
        nationalBinding(batter.binding) ? 'NATIONAL_PHYSICAL_PLAY_V1' : 'PHYSICAL_PLAY_V1');
      return result(db, source, proof.receipt, batter.binding, pitcherFromActor(batter), p.expectedScoring,
        p.expectedOfficial.receipt.durableRevision);
    }
    if (source.owner === 'actual_foul_terminal_applications') {
      const { original, evidence: proof } = deriveCompletedFoulBatterParticipationWithOriginal(db, source.sourceId);
      const p = original.proposal, batters = p.participants.filter(a => a.role === 'batter');
      const pitchers = p.participants.filter(a => a.role === 'defender' && a.registeredPosition === 'P');
      if (batters.length !== 1 || pitchers.length !== 1) throw new Error('official player outcome terminal original actors differ');
      const batter = batters[0].binding;
      const reference = original.result.completion.scoringReference;
      const row = db.prepare('SELECT * FROM main.official_scoring_applications WHERE scoring_application_id=?').get(reference.scoringApplicationId);
      if (!row || hash(row) !== reference.rowHash) throw new Error('official player outcome terminal scoring differs');
      const scoring = JSON.parse(String(row.result_json)) as PersistedOfficialScoring;
      // The completion owns the assigned official call's scoring row. The
      // proposal's oracle record is a different truth layer and ruling ID.
      if (scoring.officialApplicationId !== p.source.applicationId
        || scoring.closureId !== source.sourceId || scoring.record.playId !== p.playId) throw new Error('official player outcome terminal score scope differs');
      return result(db, source, proof.receipt, batter, pitchers[0].binding, scoring, original.result.official.receipt.durableRevision);
    }
    if (source.owner === 'actual_live_play_closures') {
      const original = actualLivePlayClosureEvidenceFromSqlite(db).read(source.sourceId);
      if (!original?.result || original.status !== 'OFFICIAL_APPLIED') throw new Error('official player outcome actual-live closure is incomplete');
      const p = original.proposal, actor = readPhysicalActorForPlayFromSqlite(db, p.gameId, p.playId);
      if (!actor) return unavailable(source, 'original_batter_missing');
      const proof = deriveActualLiveParticipationEvidence(db, p.gameId, actor.binding.playerId, source.sourceId,
        nationalBinding(actor.binding) ? 'NATIONAL_ACTUAL_LIVE_V1' : 'ACTUAL_LIVE_V1');
      // An absent scoring row is pending only when no owned SCORED Source
      // requires it. Retained ownership claims must not become availability.
      if (db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='actual_live_scoring_sources'").get()) {
        const claims = actualScoringOriginalOwnershipRows(db, { source: { gameId: p.gameId,
          closureReference: { sourceId: source.sourceId } }, playId: p.playId, application: p.application });
        for (const claim of claims) {
          const owned = actualLiveScoringEvidenceFromSqlite(db).readSource(String(claim.source_id));
          if (!owned || owned.proposal.application.applicationId !== p.application.applicationId
            || owned.source.closureReference.sourceId !== source.sourceId
            || owned.source.gameId !== p.gameId || owned.proposal.playId !== p.playId) throw new Error('official player outcome scorer claim differs');
          assertActualLiveScoringStage(db, owned.proposal, owned.status === 'SCORED');
        }
      }
      if (!db.prepare("SELECT 1 FROM main.sqlite_master WHERE type='table' AND name='official_scoring_applications'").get()) {
        return unavailable(source, 'supported_official_scoring_missing');
      }
      const rows = scoringOwnershipRows(db, 'main.official_scoring_applications', [[{ column: 'official_application_id', value: p.application.applicationId,
        mirrors: [['result_json', ['officialApplicationId']], ['request_json', ['input', 'officialApplication', 'applicationId']]] }]]);
      if (!rows.length) return unavailable(source, 'supported_official_scoring_missing');
      if (rows.length !== 1 || rows[0].official_application_id !== p.application.applicationId) throw new Error('official player outcome scorer ownership differs');
      const scored = createSqliteOfficialScoringWriter(db).readAcceptedPlay(String(rows[0].scoring_application_id));
      if (!scored || json(scored.application) !== json(p.application)) throw new Error('official player outcome scorer application differs');
      const owned = actualLiveScoringEvidenceFromSqlite(db).readSource(scored.scoring.sourceEventId);
      if (!owned || owned.status !== 'SCORED' || json(owned.result) !== json(scored.scoring)) throw new Error('official player outcome accepted scorer owner is missing');
      assertActualLiveScoringStage(db, owned.proposal, true);
      return result(db, source, { receipt: proof.receipt, scoringProposal: owned.proposal }, actor.binding, pitcherFromActor(actor),
        scored.scoring, p.expectedOfficial.receipt.durableRevision);
    }
    const original = readSamePaTransitionArchive(db, source.sourceId);
    if (!original) throw new Error('official player outcome reserved terminal is missing');
    const proof = readSamePaTerminalTransitionFromSqlite(db, original.source.terminalReference, 'historical');
    const release = readSamePaTerminalReleaseFromSqlite(db, original.lineage.enrollmentReference.sourceId);
    if (proof.kind !== 'completed' || !release || json(proof.reference) !== json(release.transitionReference)) {
      throw new Error('official player outcome reserved terminal is incomplete');
    }
    const endpoint = readSamePaTerminalEndpointFromSqlite(db, original.source.terminalReference, 'historical');
    return result(db, source, { proof, release }, endpoint.actor.binding, pitcherFromActor(endpoint.actor), original.scoring, proof.durableRevision);
  });
};
