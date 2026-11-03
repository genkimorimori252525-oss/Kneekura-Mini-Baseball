import {expect,it} from 'vitest';
import {createLiveBaseballMatchV1,createLiveBaseballMatchWorkerV116} from './LiveBaseballMatchV1';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
const command={batting:'take' as const,pitchType:'auto',location:'auto',managedTeam:0 as const};
it('resumes every physical/count clock and discards a speculative command without changing the accepted next pitch',()=>{
 const input=liveMatchFixture(2468),normal=createLiveBaseballMatchV1(input),worker=createLiveBaseballMatchWorkerV116(input);
 expect(Object.keys(normal)).toEqual(['issuePitch','inspect']);
 for(let i=0;i<5;i++){
  const expected=normal.issuePitch(command),actual=worker.issuePitch(command);
  expect(actual).toEqual(expected);
 }
 const saved=worker.captureContinuationV116(),before=JSON.stringify(saved),resumed=createLiveBaseballMatchWorkerV116(input,saved),
  speculative=createLiveBaseballMatchWorkerV116(input,saved);
 speculative.issuePitch({...command,batting:'balanced'});
 for(let i=0;i<3;i++)expect(resumed.issuePitch(command)).toEqual(normal.issuePitch(command));
 expect(JSON.stringify(saved)).toBe(before);expect(saved.pitchCount).toBe(5);expect(Object.isFrozen(saved.match)).toBe(true);
 const {history:a,...one}=resumed.inspect(),{history:b,...two}=normal.inspect();
 expect(one).toEqual(two);expect(a).toHaveLength(3);expect(b).toHaveLength(8);
});
it('rejects an incompatible, malformed or accessor-bearing worker continuation',()=>{
 const input=liveMatchFixture(),host=createLiveBaseballMatchWorkerV116(input),saved=host.captureContinuationV116();
 for(const patch of [{seed:saved.seed+1},{innings:saved.innings+1},{pitchCount:-1},{nextTick:NaN},
  {battingOrderIndices:[0,9]},{match:{...saved.match,outs:4}},{hits:{...saved.hits,away:-1}}]){
  expect(()=>createLiveBaseballMatchWorkerV116(input,{...saved,...patch})).toThrow();
 }
 let invoked=false;const accessor={...saved};Object.defineProperty(accessor,'pitchCount',{get(){invoked=true;return 0;},enumerable:true});
 expect(()=>createLiveBaseballMatchWorkerV116(input,accessor)).toThrow();expect(invoked).toBe(false);
});
