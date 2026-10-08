// Static preparation only. No test supplies or mocks an original owner's read.
import { expect,it } from 'vitest';
import { rawCensus,schemaCensus } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withIntegrityFixture,captureRow,finishOwned,assertAllRoutesReject,assertRestoredRead,quote,withIntegrityObserverForeignKeysDisabled,
  type IntegrityFixture } from './ActualFoulTerminalAcknowledgementIntegrity.test-support';

type Fault = { name:string; target:'end'|'count'|'journal'|'application'|'match'|'pitch'; kind:'missing'|'damaged'|'replaced'|'stale' };
const faults:readonly Fault[] = [
  { name:'A-D01 missing original E',target:'end',kind:'missing' },
  { name:'A-D02 damaged original E',target:'end',kind:'damaged' },
  { name:'A-D03 missing original C',target:'count',kind:'missing' },
  { name:'A-D04 damaged original C',target:'count',kind:'damaged' },
  { name:'A-D05 missing selected official journal event',target:'journal',kind:'missing' },
  { name:'A-D06 damaged selected official journal event',target:'journal',kind:'damaged' },
  { name:'A-D07 missing shared official application',target:'application',kind:'missing' },
  { name:'A-D08 damaged shared official application',target:'application',kind:'damaged' },
  { name:'A-D09 missing current Match',target:'match',kind:'missing' },
  { name:'A-D10 damaged Match pending marker',target:'match',kind:'damaged' },
  { name:'A-D11 missing original physical pitch',target:'pitch',kind:'missing' },
  { name:'A-D12 damaged original physical pitch',target:'pitch',kind:'damaged' },
  { name:'A-D13 replaced Match pending marker',target:'match',kind:'replaced' },
  { name:'A-D14 stale Match revision',target:'match',kind:'stale' },
];
const location = (f:IntegrityFixture,fault:Fault) => {
  const p = f.applied.proposal;
  switch (fault.target) {
    case 'end': return { table:'actual_foul_play_ends',key:'source_id',value:p.physicalEndReference.sourceId,column:'snapshot_hash' };
    case 'count': return { table:'actual_foul_rule_consumptions',key:'source_id',value:p.consumptionReference.sourceId,column:'snapshot_hash' };
    case 'journal': return { table:'actual_foul_official_events',key:'source_id',value:p.officialReference.headSourceId,column:'source_hash' };
    case 'application': return { table:'applications',key:'application_id',value:p.source.applicationId,column:'request_hash' };
    case 'pitch': return { table:'physical_pitch_progress_actions',key:'source_id',value:p.physicalPitchSourceId,column:'snapshot_hash' };
    case 'match': return { table:'matches',key:'match_id',value:p.gameId,column:'activation_json' };
  }
};

for (const fault of faults) it(fault.name,async () => withIntegrityFixture(f => {
  const db = f.observer,before = rawCensus(db),schema = schemaCensus(db);
  const target = location(f,fault),capture = captureRow(db,target.table,target.key,target.value);
  const table = 'main.'+quote(target.table),where = quote(target.key)+'=?';
  let primary:unknown,failed = false;
  try {
    expect(db.isTransaction).toBe(false);
    if (fault.kind === 'missing') withIntegrityObserverForeignKeysDisabled(db,() => {
      expect(db.prepare('DELETE FROM '+table+' WHERE '+where).run(target.value).changes).toBe(1);
    });
    else if (fault.kind === 'stale') {
      expect(db.prepare('UPDATE '+table+' SET durable_revision=durable_revision+1 WHERE '+where).run(target.value).changes).toBe(1);
    } else {
      // A parseable replacement is distinct from damaged JSON, and cannot be
      // mistaken for an independently authenticated second terminal origin.
      const value = fault.kind === 'replaced' ? '{"pendingPostPlay":{"version":"replacement"}}' : 'damaged-original-or-official-sibling';
      expect(db.prepare('UPDATE '+table+' SET '+quote(target.column)+'=? WHERE '+where).run(value,target.value).changes).toBe(1);
    }
    expect(db.isTransaction).toBe(false); // no observer SAVEPOINT spans owner reads
    assertAllRoutesReject(f);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => capture.restore(),
    () => expect(rawCensus(db)).toEqual(before),() => expect(schemaCensus(db)).toEqual(schema)]); }
  assertRestoredRead(f);
}),1_200_000);

// OPEN GATE: a foreign receipt swap requires a second independently genuine
// terminal origin. No synthetic metadata, retained applied path or cloned
// origin counts as that second producer, and no skipped test claims coverage.
