import assert from 'node:assert/strict';
import { test } from 'vitest';
import { fixture, value, change } from './BattingFixtures.test-support';
import { prepareBattingExecution } from './BattingCommitment';
import { acceptBattingExecution } from './BattingAcceptance';
test('acceptance returns current world and gate versions with full commitment',()=>{const r=fixture(),p=value(prepareBattingExecution(r)),a=value(acceptBattingExecution(r,p));assert.equal(a.kind,'BattingCommitmentAccepted');assert.equal(a.afterWorldRevision,r.currentFrame.worldRevision+1);assert.equal(a.emotionRevision,r.currentEmotion.revision);assert.deepEqual(a.proposal,p);});
test('source IDs cannot create multiple action keys for the same physical pitch',()=>{
 const r=fixture(),a=value(acceptBattingExecution(r,value(prepareBattingExecution(r))));
 const s=change(r,d=>d.source.sourceId='renamed'),b=value(acceptBattingExecution(s,value(prepareBattingExecution(s))));assert.equal(a.actionKey,b.actionKey);
});
test('pitch ordinal creates a distinct physical action key',()=>{
 const r=fixture(),a=value(acceptBattingExecution(r,value(prepareBattingExecution(r))));
 const s=change(r,d=>d.source.pitchOrdinal++),b=value(acceptBattingExecution(s,value(prepareBattingExecution(s))));assert.notEqual(a.actionKey,b.actionKey);
});
test('changed current source cannot adopt the old proposal',()=>{const r=fixture(),p=value(prepareBattingExecution(r));assert.equal(acceptBattingExecution(change(r,d=>d.source.revision++),p).ok,false);});
for(const name of ['action','predictionId','profileId','decisionTick','motorStartTick','motorDelayTicks'])test('altered commitment '+name+' rejects',()=>{
 const r=fixture(),p=change(value(prepareBattingExecution(r)),d=>d.commitment[name]=typeof d.commitment[name]==='number'?d.commitment[name]+1:'forged');assert.equal(acceptBattingExecution(r,p).ok,false);
});
test('modified contact knot rejects',()=>{const r=fixture(),p=change(value(prepareBattingExecution(r)),d=>d.commitment.trajectory.contact.sweetSpotPosition.y++);assert.equal(acceptBattingExecution(r,p).ok,false);});
test('waiting proposal is not executable acceptance',()=>{const r=change(fixture(),d=>{d.currentFrame.time.tick--;d.source.frame=structuredClone(d.currentFrame);});assert.equal(acceptBattingExecution(r,value(prepareBattingExecution(r))).ok,false);});
test('deterministic repeated acceptance has no side effect',()=>{const r=fixture(),p=value(prepareBattingExecution(r));assert.deepEqual(acceptBattingExecution(r,p),acceptBattingExecution(r,p));});
