import type { DatabaseSync } from 'node:sqlite';
import type { AcceptedOfficialScoringEvidenceAuthority } from '../SqliteOfficialScoringStore';
import { applyOfficialPitchingRunJudgment, type OfficialPitchingRunJudgment } from '../../core/world/competition/OfficialPitchingRunResponsibility';
import type { OfficialPitchingRunOriginal } from './OfficialPitchingRunEvidenceFromSqlite';
import { scoringOwnershipRows } from './ActualLiveScoringMetadata';
import { actorJson as json, actorFreeze as freeze } from './PhysicalPlateAppearanceActorEvidenceFromSqlite';

/** A specific accepted scorer sidecar, owned by the existing outcome store's
 * transaction. It never revises old scoring or attribution records. */
export const officialPitchingRunJudgments = (db: DatabaseSync,
  original: (careerId: string, gameId: string) => OfficialPitchingRunOriginal | null,
  authority?: Pick<AcceptedOfficialScoringEvidenceAuthority, 'readAcceptedPitchingRunJudgment'>) => {
  db.exec(`CREATE TABLE IF NOT EXISTS official_player_pitching_run_judgments(
    source_event_id TEXT PRIMARY KEY, career_id TEXT NOT NULL, game_id TEXT NOT NULL,
    evidence_json TEXT NOT NULL, original_proof_hash TEXT NOT NULL, result_json TEXT NOT NULL,
    UNIQUE(career_id,game_id))`);
  const sourceRows = (source: string) => scoringOwnershipRows(db, 'main.official_player_pitching_run_judgments', [[
    { column: 'source_event_id', value: source, mirrors: [['evidence_json', ['sourceEventId']]] },
  ]]);
  const gameRows = (career: string, game: string) => scoringOwnershipRows(db, 'main.official_player_pitching_run_judgments', [[
    { column: 'career_id', value: career, mirrors: [['evidence_json', ['careerId']]] },
    { column: 'game_id', value: game, mirrors: [['evidence_json', ['gameId']]] },
  ]]);
  const rowFor = (e: OfficialPitchingRunJudgment, o: OfficialPitchingRunOriginal) => ({
    source_event_id: e.sourceEventId, career_id: e.careerId, game_id: e.gameId,
    evidence_json: json(e), original_proof_hash: o.originalProofHash,
    result_json: json(applyOfficialPitchingRunJudgment(o.runs, e, o)),
  });
  const decode = (row: ReturnType<typeof sourceRows>[number]) => {
    const evidence = JSON.parse(String(row.evidence_json)) as OfficialPitchingRunJudgment;
    const o = original(evidence.careerId, evidence.gameId);
    if (!o || json(row) !== json(rowFor(evidence, o)) || sourceRows(evidence.sourceEventId).length !== 1
      || gameRows(evidence.careerId, evidence.gameId).length !== 1) throw new Error('pitching run judgment archive or original differs');
    return { ...o, runs: applyOfficialPitchingRunJudgment(o.runs, evidence, o), judgmentSourceEventId: evidence.sourceEventId };
  };
  const careerRows = (career: string) => scoringOwnershipRows(db, 'main.official_player_pitching_run_judgments', [[
    { column: 'career_id', value: career, mirrors: [['evidence_json', ['careerId']]] },
  ]]).sort((a, b) => String(a.source_event_id).localeCompare(String(b.source_event_id)));
  return {
    read(careerId: string, gameId: string) {
      const rows = gameRows(careerId, gameId);
      if (rows.length > 1) throw new Error('pitching run judgment game ownership differs');
      if (rows.length) { const result = decode(rows[0]);
        if (result.careerId !== careerId || result.gameId !== gameId) throw new Error('pitching run judgment scope differs');
        return freeze(result); }
      const o = original(careerId, gameId);
      return o ? freeze({ ...o, judgmentSourceEventId: null }) : null;
    },
    apply(sourceEventId: string) {
      const rows = sourceRows(sourceEventId);
      if (rows.length > 1) throw new Error('pitching run judgment Source ownership differs');
      if (rows.length) { const result = decode(rows[0]);
        if (result.judgmentSourceEventId !== sourceEventId) throw new Error('pitching run judgment Source differs');
        return freeze(result); }
      const accepted = authority?.readAcceptedPitchingRunJudgment?.(sourceEventId);
      if (!accepted || accepted.sourceEventId !== sourceEventId) throw new Error('accepted pitching run judgment is missing');
      const evidence = JSON.parse(json(accepted)) as OfficialPitchingRunJudgment;
      const o = original(evidence.careerId, evidence.gameId);
      if (!o) throw new Error('pitching run judgment requires completed original game');
      if (gameRows(evidence.careerId, evidence.gameId).length) throw new Error('pitching run judgment game already assessed');
      const before = careerRows(evidence.careerId);
      before.forEach(decode);
      const row = rowFor(evidence, o);
      db.prepare('INSERT INTO main.official_player_pitching_run_judgments VALUES(?,?,?,?,?,?)').run(...Object.values(row));
      // Fresh originals and exact saved bytes after INSERT, before owner COMMIT.
      const saved = sourceRows(sourceEventId);
      if (saved.length !== 1 || json(saved[0]) !== json(row)) throw new Error('pitching run judgment changed during admission');
      const result = decode(saved[0]);
      if (result.originalProofHash !== o.originalProofHash || json(result.runs) !== row.result_json) {
        throw new Error('pitching run judgment original changed during admission');
      }
      const expected = [...before, row].sort((a, b) => String(a.source_event_id).localeCompare(String(b.source_event_id)));
      const after = careerRows(evidence.careerId);
      if (json(after) !== json(expected)) throw new Error('pitching run judgment history changed during admission');
      after.forEach(decode);
      return freeze(result);
    },
  };
};
