import { expect, it } from 'vitest';
import { officialStateSerialized as json, officialStateHash as hash } from '../OfficialStateEncoding';
import { rawCensus, schemaCensus, fileHash } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { prepareTerminalScoringCopy, requireTerminalScoring, type TerminalScoringStore } from './ActualFoulTerminalScoringFixture.test-support';

const faults = ['missing_binding','missing_person','missing_pitch_policy','missing_pitch','missing_count','missing_end','missing_journal','missing_application','missing_match','missing_terminal',
  'downgraded_acknowledgement','changed_pending_hash','rewritten_frozen_projection','changed_scoring_basis','changed_scoring_origin',
  'surviving_scoring_alias'] as const;
for (const fault of faults) it('S05 genuine scored terminal reauthenticates read retry reopen after ' + fault, async () => {
  const f = prepareTerminalScoringCopy(),db = f.db,p = f.saved.proposal;
  let owner: TerminalScoringStore | undefined;
  try {
    const open = await requireTerminalScoring(); owner = open(f.path);
    expect(owner.apply(f.sourceId)).toEqual(f.expected);
    // Deliberately corrupt only this private fixture connection. The scoring
    // writer retains its own enforced FKs; restore this setting before reads.
    const foreignKeys = db.prepare('PRAGMA foreign_keys').get()!.foreign_keys;
    expect(db.isTransaction).toBe(false);
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      if (fault === 'missing_binding') {
        const binding = p.participants[1].binding;
        expect(db.prepare('DELETE FROM official_participant_bindings WHERE game_id=? AND player_id=?').run(binding.gameId,binding.playerId).changes).toBe(1);
      } else if (fault === 'missing_person') {
        expect(db.prepare('DELETE FROM world_player_person_links WHERE source_id=?').run(p.participants[1].binding.personLinkSourceId).changes).toBe(1);
      } else if (fault === 'missing_pitch_policy') {
        const pitch = JSON.parse(String(db.prepare('SELECT snapshot_json FROM physical_pitch_progress_actions WHERE source_id=?').get(p.physicalPitchSourceId)!.snapshot_json));
        expect(db.prepare('DELETE FROM world_pitch_fatigue_policies WHERE source_id=?').run(pitch.frame.policy.sourceId).changes).toBe(1);
      } else if (fault.startsWith('missing_')) {
        const [table,key,value] = fault === 'missing_pitch' ? ['physical_pitch_progress_actions','source_id',p.physicalPitchSourceId]
          : fault === 'missing_count' ? ['actual_foul_rule_consumptions','source_id',p.consumptionReference.sourceId]
          : fault === 'missing_end' ? ['actual_foul_play_ends','source_id',p.physicalEndReference.sourceId]
          : fault === 'missing_journal' ? ['actual_foul_official_events','source_id',p.officialReference.headSourceId]
          : fault === 'missing_application' ? ['applications','application_id',p.source.applicationId]
          : fault === 'missing_match' ? ['matches','match_id',p.gameId] : ['actual_foul_terminal_applications','source_id',f.sourceId];
        expect(db.prepare('DELETE FROM ' + table + ' WHERE ' + key + '=?').run(value).changes).toBe(1);
      } else if (fault === 'downgraded_acknowledgement') {
        db.prepare('UPDATE actual_foul_terminal_applications SET status=?,result_json=? WHERE source_id=?')
          .run('OFFICIAL_APPLIED_PENDING_POST_PLAY',json({ ...f.saved.result,acknowledgement:null }),f.sourceId);
      } else if (fault === 'changed_pending_hash') {
        db.prepare('UPDATE applications SET request_hash=? WHERE application_id=?').run(hash({ kind:'game_final',request:f.request }),p.source.applicationId);
      } else if (fault === 'rewritten_frozen_projection') {
        const proposal = { ...p,scoring:{ ...p.scoring,basisRulingId:p.callSource.sourceId } };
        db.prepare('UPDATE actual_foul_terminal_applications SET proposal_json=?,proposal_hash=? WHERE source_id=?')
          .run(json(proposal),hash(proposal),f.sourceId);
      } else if (fault === 'changed_scoring_basis') {
        db.prepare('UPDATE official_scoring_applications SET result_json=? WHERE scoring_application_id=?')
          .run(json({ ...f.expected,record:{ ...f.expected.record,basisRulingId:p.scoring.basisRulingId } }),f.expected.scoringApplicationId);
      } else if (fault === 'changed_scoring_origin') {
        db.prepare('UPDATE official_scoring_applications SET request_json=? WHERE scoring_application_id=?').run(json({ input:{
          scoringApplicationId:f.expected.scoringApplicationId,officialApplication:{ ...f.request,origin:{ ...f.request.origin,sourceHash:'0'.repeat(64) } } },
          evidence:null }),f.expected.scoringApplicationId);
      } else {
        // Corrupt the one genuine row into a raw-only alias. This is not another
        // origin; every old identity column is deliberately removed or replaced.
        db.prepare('UPDATE official_scoring_applications SET scoring_application_id=?,match_id=?,official_application_id=?,closure_id=?,source_event_id=?,request_json=?,result_json=? WHERE scoring_application_id=?')
          .run('foreign-score','foreign-game','foreign-application','foreign-closure','foreign-event',
            json({ input:{ officialApplication:{ origin:{ owner:'actual_foul_terminal_applications',sourceId:f.sourceId } } } }),
            '{}',f.expected.scoringApplicationId);
      }
    } finally { db.exec('PRAGMA foreign_keys=' + foreignKeys); }
    expect(db.prepare('PRAGMA foreign_keys').get()!.foreign_keys).toBe(foreignKeys);
    const rows = rawCensus(db),schema = schemaCensus(db);
    expect(() => owner!.read(f.sourceId)).toThrow(); expect(() => owner!.apply(f.sourceId)).toThrow();
    expect(rawCensus(db)).toEqual(rows); expect(schemaCensus(db)).toEqual(schema);
    owner.close(); owner = open(f.path);
    expect(() => owner!.read(f.sourceId)).toThrow();
    expect(rawCensus(db)).toEqual(rows); expect(schemaCensus(db)).toEqual(schema);
    expect(fileHash(f.retainedPath)).toBe(f.retainedSha256);
  } finally { owner?.close(); db.close(); }
},1_200_000);
