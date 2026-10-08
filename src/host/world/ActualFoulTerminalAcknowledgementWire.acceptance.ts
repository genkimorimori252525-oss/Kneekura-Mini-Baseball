// Acceptance only. Every A-Wxx is a separately admitted genuine case.
import { expect,it } from 'vitest';
import { officialStateSerialized as json } from '../OfficialStateEncoding';
import { rawCensus,schemaCensus,terminalTable } from './ActualFoulTerminalAcknowledgementCutover.test-support';
import { withIntegrityFixture,sourceId,captureRow,finishOwned,assertAllRoutesReject,assertRestoredRead }
  from './ActualFoulTerminalAcknowledgementIntegrity.test-support';

type ObjectValue = Record<string,unknown>;
type Mutation = { name:string; status?:string; path?:readonly string[]; value?:unknown; omit?:boolean;
  raw?:(value:ObjectValue) => string };
const changed = 'not-the-derived-acknowledgement-value';
const mutations:readonly Mutation[] = [
  { name:'A-W01 acknowledged status with acknowledgement null',path:['acknowledgement'],value:null },
  { name:'A-W02 applied status with non-null acknowledgement',status:'OFFICIAL_APPLIED_PENDING_POST_PLAY' },
  { name:'A-W03 omitted acknowledgement version',path:['acknowledgement','version'],omit:true },
  { name:'A-W04 extra acknowledgement nextPitch field',path:['acknowledgement','nextPitch'],value:true },
  { name:'A-W05 wrong acknowledgementId',path:['acknowledgement','acknowledgementId'],value:changed },
  { name:'A-W06 wrong obligationKey',path:['acknowledgement','obligationKey'],value:changed },
  { name:'A-W07 wrong originalSuccessorKey',path:['acknowledgement','originalSuccessorKey'],value:changed },
  { name:'A-W08 wrong scope playId',path:['acknowledgement','scope','playId'],value:2147483647 },
  { name:'A-W09 wrong consumed status',path:['acknowledgement','status'],value:'pending' },
  { name:'A-W10 wrong consumer sourceHash',path:['acknowledgement','consumer','sourceHash'],value:'0'.repeat(64) },
  { name:'A-W11 wrong consumer snapshotHash',path:['acknowledgement','consumer','snapshotHash'],value:'0'.repeat(64) },
  { name:'A-W12 wrong physicalEndReference snapshotHash',path:['acknowledgement','physicalEndReference','snapshotHash'],value:'0'.repeat(64) },
  { name:'A-W13 wrong consumptionReference sourceHash',path:['acknowledgement','consumptionReference','sourceHash'],value:'0'.repeat(64) },
  { name:'A-W14 wrong officialReference headHash',path:['acknowledgement','officialReference','headHash'],value:'0'.repeat(64) },
  { name:'A-W15 wrong applicationReference owner',path:['acknowledgement','applicationReference','owner'],value:'matches' },
  { name:'A-W16 wrong applicationReference matchId',path:['acknowledgement','applicationReference','matchId'],value:changed },
  { name:'A-W17 wrong applicationReference applicationId',path:['acknowledgement','applicationReference','applicationId'],value:changed },
  { name:'A-W18 wrong applicationReference closureId',path:['acknowledgement','applicationReference','closureId'],value:changed },
  { name:'A-W19 wrong applicationReference previousPlayId',path:['acknowledgement','applicationReference','previousPlayId'],value:2147483647 },
  { name:'A-W20 wrong applicationReference durableRevision',path:['acknowledgement','applicationReference','durableRevision'],value:2147483647 },
  { name:'A-W21 wrong applicationReference requestHash',path:['acknowledgement','applicationReference','requestHash'],value:'0'.repeat(64) },
  { name:'A-W22 wrong applicationReference receiptHash',path:['acknowledgement','applicationReference','receiptHash'],value:'0'.repeat(64) },
  { name:'A-W23 duplicate escaped acknowledgement key hides a different claim',raw:value => {
    const good = value.acknowledgement as ObjectValue;
    const hidden = { ...good,acknowledgementId:json(['actual_foul_terminal_official_acknowledgement_v1','hidden-child','hidden-source']) };
    // Last-key-wins decoding is exactly the authentic result. Raw duplicate and
    // escaped keys still contain a claim and must never be silently normalized.
    const raw = '{"acknowledgement":'+json(hidden)+',"acknowledg\\u0065ment":'+json(good)
      +',"official":'+json(value.official)+',"sourceId":'+json(value.sourceId)+'}';
    expect(JSON.parse(raw)).toEqual(value); return raw;
  } },
  { name:'A-W24 noncanonical result JSON with equal decoded values',raw:value => {
    const raw = JSON.stringify(value,null,2); expect(JSON.parse(raw)).toEqual(value); return raw;
  } },
];

for (const mutation of mutations) it(mutation.name,async () => withIntegrityFixture(f => {
  const db = f.observer,before = rawCensus(db),schema = schemaCensus(db);
  const capture = captureRow(db,terminalTable,'source_id',sourceId);
  const result = JSON.parse(String(capture.saved.result_json)) as ObjectValue;
  let primary:unknown,failed = false;
  try {
    if (mutation.path) {
      let target = result;
      for (const part of mutation.path.slice(0,-1)) {
        const next = target[part];
        if (next === null || typeof next !== 'object' || Array.isArray(next)) throw new Error('wire fixture path is missing: '+part);
        target = next as ObjectValue;
      }
      const key = mutation.path.at(-1)!;
      if (mutation.omit) { expect(Object.hasOwn(target,key)).toBe(true); delete target[key]; }
      else { expect(target[key]).not.toEqual(mutation.value); target[key] = mutation.value; }
    }
    const wire = mutation.raw ? mutation.raw(result) : json(result);
    const status = mutation.status ?? capture.saved.status;
    expect({ status,result_json:wire }).not.toEqual({ status:capture.saved.status,result_json:capture.saved.result_json });
    expect(db.isTransaction).toBe(false);
    expect(db.prepare('UPDATE main.actual_foul_terminal_applications SET status=?,result_json=? WHERE source_id=?')
      .run(status,wire,sourceId).changes).toBe(1);
    expect(db.isTransaction).toBe(false); // corruption is visible to the separate real runner
    assertAllRoutesReject(f);
  } catch (error) { primary = error; failed = true; throw error; }
  finally { finishOwned(failed,primary,[() => capture.restore(),
    () => expect(rawCensus(db)).toEqual(before),() => expect(schemaCensus(db)).toEqual(schema)]); }
  assertRestoredRead(f);
}),1_200_000);
