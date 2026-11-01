import {expect,it} from 'vitest';
import {freezeBatterBeliefV122,resolveBatterIntentV122,assimilateBatterEvidenceV122,validateBatterApproachV122} from './BatterIntentV122';
const profile={version:'batter_approach_v122' as const,sourceId:'author-test',priorReliance:.7,directionCommitment:1,twoStrikeCommitmentDelta:0,
 preferredWhenCommitted:{pull:1,center:0,opposite:0},targetPullAnglesDegrees:{pull:30,center:0,opposite:-30}};
const belief={version:'batter_belief_v122' as const,sourceId:'observed-scouting',observerPlayerId:'b',pitcherId:'p',capturedAtTick:100,
 observedThroughTick:90,confidence:.6,evidenceRefs:['seen-previous'],candidates:[
 {familyId:'fast',regionId:'high-in',probability:.75,prediction:{x:-.15,y:1.3,arrivalAfterReleaseSeconds:.4}},
 {familyId:'curve',regionId:'low-out',probability:.25,prediction:{x:.2,y:.6,arrivalAfterReleaseSeconds:.6}}]};
it('keeps family and region jointly distributed and freezes knowledge before hidden pitch selection',()=>{
 const before=JSON.stringify(belief),frozen=freezeBatterBeliefV122(belief,{observerPlayerId:'b',pitcherId:'p',capturedAtTick:100}),
 a=resolveBatterIntentV122({profile,belief:frozen,selectedAtTick:100,strikes:0,bats:'R',beliefDraw:.8,commitmentDraw:0,directionDraw:.9});
 expect(a.preparedPrediction).toEqual(belief.candidates[1].prediction);expect(a.selectedJointHypothesis).toMatchObject({familyId:'curve',regionId:'low-out'});
 expect(JSON.stringify(belief)).toBe(before);expect(Object.isFrozen(frozen.candidates)).toBe(true);
 expect(()=>freezeBatterBeliefV122({...belief,observedThroughTick:101},{observerPlayerId:'b',pitcherId:'p',capturedAtTick:100})).toThrow();
 expect(()=>freezeBatterBeliefV122(belief,{observerPlayerId:'other',pitcherId:'p',capturedAtTick:100})).toThrow();
});
it('preserves exact zero directions, allows reactive intent and mirrors intent coordinates for left hitters',()=>{
 for(const draw of [0,.1,.99]){
  const i={profile,selectedAtTick:100,strikes:2,bats:'R' as const,beliefDraw:0,commitmentDraw:0,directionDraw:draw},a=resolveBatterIntentV122(i),
   b=resolveBatterIntentV122({...i,bats:'L'});
  expect(a.direction).toMatchObject({kind:'AIMED',aim:'PULL',pullAngleDegrees:30});expect(a.direction.fieldAngleDegrees).toBe(-b.direction.fieldAngleDegrees!);
 }
 expect(resolveBatterIntentV122({profile:{...profile,directionCommitment:0},selectedAtTick:100,strikes:0,bats:'R',beliefDraw:0,commitmentDraw:0,directionDraw:0}).direction.kind).toBe('REACTIVE');
 expect(()=>validateBatterApproachV122({...profile,preferredWhenCommitted:{pull:0,center:0,opposite:0}})).toThrow();
 const nearUnit={...profile,preferredWhenCommitted:{pull:.5,center:.4999999999998,opposite:0}};
 expect(resolveBatterIntentV122({profile:nearUnit,selectedAtTick:100,strikes:0,bats:'R',beliefDraw:0,commitmentDraw:0,directionDraw:1-1e-14}).direction.aim).toBe('CENTER');
 expect(()=>resolveBatterIntentV122({profile,belief:{...belief,confidence:NaN},selectedAtTick:100,strikes:0,bats:'R',beliefDraw:0,commitmentDraw:0,directionDraw:0})).toThrow();
});
it('assimilates only delivered own evidence for a future pitch, with explicit bounded learning weight',()=>{
 const evidence={evidenceId:'own-second',observerPlayerId:'b',pitcherId:'p',observedTick:150,availableTick:160,familyId:'curve',regionId:'low-out',
 prediction:{x:.1,y:.7,arrivalAfterReleaseSeconds:.55},reliability:.8},next=assimilateBatterEvidenceV122(belief,evidence,{atTick:200,learningWeight:.25});
 expect(next.evidenceRefs).toEqual(['seen-previous','own-second']);expect(next.candidates[1].probability).toBeCloseTo(.4);
 expect(next.candidates.reduce((s,c)=>s+c.probability,0)).toBeCloseTo(1);
 expect(()=>assimilateBatterEvidenceV122(belief,evidence,{atTick:159,learningWeight:.25})).toThrow();
 expect(()=>assimilateBatterEvidenceV122(next,evidence,{atTick:201,learningWeight:.25})).toThrow();
 expect(belief.candidates[1].probability).toBe(.25);
});
