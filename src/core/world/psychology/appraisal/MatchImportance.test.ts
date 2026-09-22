import { describe,it } from 'vitest';
import assert from 'node:assert/strict';
import { deriveMatchImportance } from './MatchImportance';
import { change,importanceInput,value } from './AppraisalFixtures.test-support';
describe('source-backed MatchImportance',()=>{
 it('computes rank movement from win/loss scenarios, not a manual importance field',()=>{
  const r=deriveMatchImportance(importanceInput());assert.equal(r.ok,true);if(!r.ok)return;
  assert.equal(r.value.components.standings,2/3); assert.equal(r.value.components.matchup,2/3);
  assert.equal(r.value.components.urgency,0.1);assert.ok(Math.abs(r.value.components.personal-0.6)<1e-12);
  assert.ok(r.value.value>=0 && r.value.value<=1);
 });
 it('detects title, qualification and elimination on opposite outcomes',()=>{
  const x=change(importanceInput(),d=>{d.competition.win.champion=true;d.competition.win.qualified=true;d.competition.loss.eliminated=true;});
  const r=value(deriveMatchImportance(x));assert.equal(r.components.championship,1);assert.equal(r.components.qualification,1);assert.equal(r.components.elimination,1);
 });
 it('keeps absent knockout ranks explicit instead of inventing standings',()=>{
  const x=change(importanceInput(),d=>{d.competition.win.rank=null;d.competition.loss.rank=null;d.competition.win.opponentRank=null;d.competition.loss.opponentRank=null;});
  assert.equal(value(deriveMatchImportance(x)).components.standings,0);
 });
 it('increases final-stage importance under the same calibration',()=>{
  const a=value(deriveMatchImportance(importanceInput()));const b=value(deriveMatchImportance(change(importanceInput(),d=>{d.competition.stage='FINAL';})));
  assert.ok(b.value>a.value);
 });
 it('remaining schedule is not a hand-entered importance switch',()=>{
  const a=value(deriveMatchImportance(importanceInput()));const b=value(deriveMatchImportance(change(importanceInput(),d=>{d.competition.remainingGamesAfterMatch=0;})));
  assert.ok(b.value>a.value);assert.equal(b.components.urgency,1);
 });
 it('rivalry is directed and attenuated by THIS player identification',()=>{
  const x=change(importanceInput(),d=>{d.personal.clubIdentification=0;});assert.equal(value(deriveMatchImportance(x)).components.personal,0);
 });
 it('does not sum overlapping personal reasons twice',()=>{
  const r=value(deriveMatchImportance(change(importanceInput(),d=>{d.personal.recordStake=0.9;d.personal.returnStake=0.7;d.personal.historyStake=0.9;})));
  assert.equal(r.components.personal,0.9);
 });
 it('detaches and freezes normalized provenance',()=>{
  const x=importanceInput(),before=structuredClone(x),r=value(deriveMatchImportance(x));
  assert.deepEqual(x,before);assert.notEqual(r.provenance,x);assert.ok(Object.isFrozen(r.provenance.competition.win));
 });
 for(const [name,edit] of [
  ['different match',(d:any)=>d.competition.matchId='other'],['different player',(d:any)=>d.personal.scope.playerId='other'],
  ['reverse directed rivalry',(d:any)=>{d.rivalry.fromClubId='opponent';d.rivalry.toClubId='club';}],
  ['self opponent',(d:any)=>d.opponentClubId='club'],['stale source',(d:any)=>d.rivalry.stamp.time.tick=79],
  ['future source',(d:any)=>d.personal.stamp.time.tick=101],['later same-tick source',(d:any)=>d.competition.stamp.time.sequence=1],
  ['missing source',(d:any)=>delete d.rivalry],['manual importance',(d:any)=>d.importance=1],
  ['rank outside field',(d:any)=>d.competition.win.rank=5],['inverted win/loss rank',(d:any)=>d.competition.win.rank=4],
  ['partial rank availability',(d:any)=>d.competition.loss.rank=null],['contradictory champion',(d:any)=>d.competition.win.champion=true],
  ['qualified eliminated',(d:any)=>{d.competition.loss.qualified=true;d.competition.loss.eliminated=true;}],
  ['zero weights',(d:any)=>Object.keys(d.model.weights).forEach(k=>d.model.weights[k]=0)],
  ['nonfinite input',(d:any)=>d.personal.historyStake=NaN],['semantic stamp collision',(d:any)=>d.rivalry.stamp.sourceId='personal'],
 ] as const) it('rejects '+name,()=>assert.equal(deriveMatchImportance(change(importanceInput(),edit)).ok,false));
});
