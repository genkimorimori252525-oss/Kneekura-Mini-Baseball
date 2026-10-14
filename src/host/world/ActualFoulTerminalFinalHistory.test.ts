import {createRequire} from 'node:module';
import {expect,it,vi} from 'vitest';
import * as completion from './ActualFoulTerminalPostPlayCompletionEvidenceFromSqlite';
import * as historyOwner from './PhysicalPlayClosureEvidenceFromSqlite';
import * as scoringOwner from './ActualFoulTerminalScoringEvidenceFromSqlite';
import {boundaryFixture} from './ActualFoulTerminalBoundaryFixtures.test-support';
import {actorJson as json,actorHash as hash} from './PhysicalPlateAppearanceActorEvidenceFromSqlite';
// STRUCTURAL MOCKED history adapters only. The legal line-score fold/Core final
// resolver are real; no original physical reader or genuine full-game is claimed.
const {DatabaseSync}=createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite');
const api=()=>{const fn=(completion as any).deriveFoulTerminalFinalHistory;expect(typeof fn,'FINAL_HISTORY_API_MISSING').toBe('function');return fn as (...args:any[])=>any;};
const fixture=(reason:'HOME_LEADS_AFTER_TOP'|'BOTTOM_COMPLETE'|'TIE_LIMIT',run:(db:InstanceType<typeof DatabaseSync>,f:any,earlier:any[],read:any)=>void)=>{
 const top=reason==='HOME_LEADS_AFTER_TOP',score=reason==='TIE_LIMIT'?{away:0,home:0}:top?{away:0,home:1}:{away:1,home:0};
 const f=boundaryFixture('half_change_continuing',{inning:top?2:1,half:top?'top':'bottom',score},top?2:1),p=f.proposal,db=new DatabaseSync(':memory:');
 const start={...p.applicationBody.match,inning:1,half:'top',outs:0,score:{away:0,home:0},playId:top?5:6};
 const middle={...start,half:'bottom',score:{away:score.away,home:0},playId:6};
 const records=top?[{before:start,after:middle,runs:0,hits:2,errors:1},{before:middle,after:p.applicationBody.match,runs:1,hits:3,errors:0}]:[{before:start,after:p.applicationBody.match,runs:score.away,hits:2,errors:1}];
 const earlier=records.map((r,i)=>({applicationId:'prior-'+i,scoringApplicationId:'score-'+i,before:r.before,after:r.after,scoring:{record:{classification:'single',battingTeam:r.before.half==='top'?'away':'home',runsScored:r.runs,hitsCredited:r.hits,errorsCharged:r.errors}},closureRowHash:'a'.repeat(64),scoringRowHash:'b'.repeat(64)}));
 db.exec('CREATE TABLE applications(application_id TEXT,result_json TEXT);CREATE TABLE official_scoring_applications(scoring_application_id TEXT,official_application_id TEXT,request_json TEXT);');
 for(const e of earlier){db.prepare('INSERT INTO applications VALUES(?,?)').run(e.applicationId,json({receipt:{durableRevision:earlier.indexOf(e)+1}}));db.prepare('INSERT INTO official_scoring_applications VALUES(?,?,?)').run(e.scoringApplicationId,e.applicationId,json({input:{officialApplication:{game:p.applicationBody.game}}}));}
 for(const e of earlier){e.closureRowHash=hash(db.prepare('SELECT * FROM applications WHERE application_id=?').get(e.applicationId));e.scoringRowHash=hash(db.prepare('SELECT * FROM official_scoring_applications WHERE official_application_id=?').get(e.applicationId));}
 const read=vi.spyOn(historyOwner,'readPhysicalClosureScoringHistory').mockImplementation((_db,frame)=>{expect(frame.officialRevision).toBe(p.originalOfficialRevision);return earlier as any;});
 const scoring=vi.spyOn(scoringOwner,'foulTerminalScoringEvidenceFromSqlite').mockReturnValue({prepare:()=>({saved:{source:p.source,proposal:p,result:f.original},result:{scoringApplicationId:json(['actual_foul_terminal_scoring_v1','terminal']),record:{classification:'strikeout',battingTeam:top?'away':'home',runsScored:0,hitsCredited:0,errorsCharged:0}}})}as any);
 try{run(db,f,earlier,read);}finally{read.mockRestore();scoring.mockRestore();db.close();}
};
it('BF-F01 derives all reachable terminal K final reasons from real fold and Core without activation',()=>{
 const derive=api();for(const reason of ['HOME_LEADS_AFTER_TOP','BOTTOM_COMPLETE','TIE_LIMIT']as const)fixture(reason,(db,f,earlier,read)=>{
 const before=db.prepare('SELECT total_changes() AS n').get(),result=derive(db,f.original,f.proposal);expect(result.finalResult.completionReason).toBe(reason);
 expect(Object.keys(result).sort()).toEqual(['finalResult','scoringHistoryReference']);expect(result.scoringHistoryReference.earlier).toEqual(earlier.map(({applicationId,scoringApplicationId,closureRowHash,scoringRowHash})=>({applicationId,scoringApplicationId,closureRowHash,scoringRowHash})));
 expect(result.finalResult.lineScore.totals.away.hits).toBe(2);expect(result.finalResult.lineScore.totals.home.errors).toBe(1);expect(read).toHaveBeenCalledTimes(1);expect(db.prepare('SELECT total_changes() AS n').get()).toEqual(before);
 if(reason==='HOME_LEADS_AFTER_TOP')expect(result.finalResult.lineScore.innings[1].homeRuns).toBeNull();
 });
});
it('BF-F02 rejects missing reordered gapped and run-mismatched earlier records',()=>{
 const derive=api();for(const mutate of [(e:any[])=>e.pop(),(e:any[])=>e.reverse(),(e:any[])=>e[0].after.playId=99,(e:any[])=>e[0].scoring.record.runsScored=5])fixture('HOME_LEADS_AFTER_TOP',(db,f,earlier)=>{mutate(earlier);expect(()=>derive(db,f.original,f.proposal)).toThrow();});
});
it('BF-F03 rejects earlier finality and non-null policy fixture disagreements',()=>{
 const derive=api();fixture('TIE_LIMIT',(db,f)=>{db.prepare('UPDATE applications SET result_json=?').run(json({finalResult:{gameId:'game'}}));expect(()=>derive(db,f.original,f.proposal)).toThrow(/final/);});
 for(const patch of [{seasonId:'other'},{venueBinding:{gameId:'game',venueId:'other',fixtureEventId:'fixture',fixtureRevision:0}},{policy:{version:'other',minimumInnings:1,tiesAllowed:false}}])fixture('TIE_LIMIT',(db,f,earlier)=>{
 db.prepare('UPDATE official_scoring_applications SET request_json=?').run(json({input:{officialApplication:{game:{...f.proposal.applicationBody.game,...patch}}}}));earlier[0].scoringRowHash=hash(db.prepare('SELECT * FROM official_scoring_applications').get());expect(()=>derive(db,f.original,f.proposal)).toThrow(/policy|fixture/);});
});
it('BF-F04 refuses continuing boundary and self-completion history references',()=>{
 const derive=api();fixture('TIE_LIMIT',(db,f,earlier)=>{const original=structuredClone(f.original);original.official.pendingPostPlay.gameProgression={kind:'GAME_CONTINUES',nextMatchState:original.official.receipt.appliedMatchState};expect(()=>derive(db,original,f.proposal)).toThrow();earlier[0].applicationId=f.original.official.receipt.applicationId;expect(()=>derive(db,f.original,f.proposal)).toThrow();});
});

it('BF-F05 binds the supplied original to the current scoring owners authenticated proposal',()=>{
 const derive=api();fixture('TIE_LIMIT',(db,f)=>{const unrelated=structuredClone(f.original);unrelated.acknowledgement.acknowledgementId='foreign';expect(()=>derive(db,unrelated,f.proposal),'FINAL_SCORING_ORIGINAL_BINDING_MISSING').toThrow();});
});
