import {expect,it} from 'vitest';
import {evaluateLiveFieldDecisionV1,updateLiveRetouchBeliefV118,type LiveFieldDecisionContextV1,type LiveFieldAdviceV1} from './LiveFieldDecisionV1';
const v=(x=0,y=1,z=0)=>({x,y,z});
const actor=(id:string,x:number,z:number,position:'P'|'C'|'1B'|'SS'='SS')=>({playerId:id,position:v(x,1,z),velocity:v(0,0,0),homePosition:v(x,1,z),
  topSpeedMps:7,accelerationMps2:6,throwSpeedMps:32,remainingReactionSeconds:0,defensivePosition:position});
const context=():LiveFieldDecisionContextV1=>({elapsedSeconds:1,observationSeconds:.8,self:actor('self',1,30),others:[actor('other',25,20,'1B')],
  bases:{1:v(19.39,0,19.39),2:v(0,0,38.78),3:v(-19.39,0,19.39),4:v(0,0,0)},ball:v(2,.2,30),ballVelocity:v(1,0,0),
  possessionPlayerId:null,pickup:{point:v(2,.2,30),eta:.5,intercepted:true},threats:[{base:1,arrivalSeconds:3}],received:[]});
it('chooses its own near interception and yields when another observed fielder can get there sooner',()=>{
  const a=context();expect(evaluateLiveFieldDecisionV1(a).role.intent).toBe('intercept');
  const b={...a,self:actor('self',28,65),others:[actor('other',2,30)],pickup:{...a.pickup!,eta:8}};
  expect(evaluateLiveFieldDecisionV1(b).role.intent).not.toBe('intercept');
});
it('can use the same received cover suggestion or reject it for a local interception',()=>{
  const a=context(),message={sourceId:'other',targetPlayerId:'self',role:{playerId:'self',taskId:'cover:1',point:a.bases[1],intent:'base_cover' as const,targetBase:1 as const},trust:1};
  expect(evaluateLiveFieldDecisionV1({...a,received:[message]}).advice.some(r=>r.accepted===false)).toBe(true);
  const b={...a,self:actor('self',19,20,'1B'),pickup:null,possessionPlayerId:'other',received:[message]};
  expect(evaluateLiveFieldDecisionV1(b).role).toMatchObject({intent:'base_cover',targetBase:1});
  expect(evaluateLiveFieldDecisionV1(b).advice.some(r=>r.accepted)).toBe(true);
});
it('holds with no observed ball, ignores hidden future data, and retains finite alternatives',()=>{
  const a=context(),hidden={...a,get canonicalWorld(){throw Error('hidden');},get runnerMotion(){throw Error('hidden');}};
  expect(evaluateLiveFieldDecisionV1(hidden)).toEqual(evaluateLiveFieldDecisionV1(a));
  const result=evaluateLiveFieldDecisionV1({...a,observationSeconds:null,ball:null,pickup:null});
  expect(result.role.intent).toBe('hold');expect(result.reason).toBe('awaiting_observation');
});

it('can evaluate a received cover request before it has visually acquired the ball',()=>{
 const a=context(),message={sourceId:'other',targetPlayerId:'self',role:{playerId:'self',taskId:'cover:2',point:a.bases[2],intent:'base_cover' as const,targetBase:2 as const},trust:1};
 const result=evaluateLiveFieldDecisionV1({...a,self:actor('self',0,38),observationSeconds:null,ball:null,pickup:null,received:[message]});
 expect(result.role.intent).toBe('base_cover');expect(result.advice[0].accepted).toBe(true);
});

it('infers a retouch opportunity from personal observations and clears it only after seeing the return',()=>{
 const bases=context().bases,runner={runnerId:'r',initialBase:1 as const,position:{...bases[1],x:bases[1].x-2},velocity:v(-5,0,5)};
 const first=updateLiveRetouchBeliefV118(undefined,{observationSeconds:.2,firstTouchSeconds:null,flyCaught:false,bases,touchRadiusMeters:.28,runners:[runner]});
 const caught=updateLiveRetouchBeliefV118(first,{observationSeconds:.6,firstTouchSeconds:.5,flyCaught:true,bases,touchRadiusMeters:.28,runners:[runner]});
 expect(caught.required).toEqual([{runnerId:'r',base:1}]);
 const returned=updateLiveRetouchBeliefV118(caught,{observationSeconds:.8,firstTouchSeconds:.5,flyCaught:true,bases,touchRadiusMeters:.28,runners:[{...runner,position:bases[1],velocity:v(0,0,0)}]});
 expect(returned.required).toEqual([]);
});

it('keeps ability, caution, geometry and received trust as finite local costs rather than forced outcomes',()=>{
 const original=context(),a={...original,pickup:{...original.pickup!,point:v(5,.2,30)}},fast=evaluateLiveFieldDecisionV1(a),slow=evaluateLiveFieldDecisionV1({...a,self:{...a.self,topSpeedMps:2,accelerationMps2:1}}),
  candidate=(r:ReturnType<typeof evaluateLiveFieldDecisionV1>,task:string)=>r.candidates.find(c=>c.role.taskId===task)!;
 expect(candidate(slow,'pickup').arrivalSeconds).toBeGreaterThan(candidate(fast,'pickup').arrivalSeconds);
 const missed={...a,pickup:{...a.pickup!,intercepted:false}},bold=evaluateLiveFieldDecisionV1(missed),careful=evaluateLiveFieldDecisionV1({...missed,cautious:true});
 expect(candidate(careful,'pickup').cost-candidate(bold,'pickup').cost).toBeCloseTo(2,12);
 const moved=evaluateLiveFieldDecisionV1({...a,bases:{...a.bases,1:v(40,0,40)}});
 expect(candidate(moved,'cover:1').arrivalSeconds).toBeGreaterThan(candidate(fast,'cover:1').arrivalSeconds);
 const advice={sourceId:'other',targetPlayerId:'self',role:{playerId:'self',taskId:'cover:2',point:v(1,0,31),intent:'base_cover' as const,targetBase:2 as const}},
  blind={...a,observationSeconds:null,ball:null,pickup:null};
 expect(evaluateLiveFieldDecisionV1({...blind,received:[{...advice,trust:.05}]}).role.intent).toBe('hold');
 expect(evaluateLiveFieldDecisionV1({...blind,received:[{...advice,trust:1}]}).role.intent).toBe('base_cover');
 expect(evaluateLiveFieldDecisionV1({...a,received:[{...advice,trust:1}]}).candidates.some(c=>c.role.intent==='intercept')).toBe(true);
});

const coverRole=(playerId:string,base:1|2=2)=>({playerId,taskId:'cover:'+base,point:context().bases[base],intent:'base_cover' as const,targetBase:base});
function coverContext(self=actor('left',-1,38.78),peer=actor('right',1,38.78)):LiveFieldDecisionContextV1 {
 const a=context();return {...a,self,others:[peer],ball:v(-4,1,23),possessionPlayerId:'holder',pickup:null,
  threats:[{base:2,arrivalSeconds:4}],previous:coverRole(self.playerId),
  received:[{sourceId:peer.playerId,role:coverRole(peer.playerId),trust:1}]};
}
const coveringSecond=(r:ReturnType<typeof evaluateLiveFieldDecisionV1>)=>r.role.intent==='base_cover'&&r.role.targetBase===2;

it('compares marginal cover value when a received peer is already at the threatened bag, keeping the alternative finite',()=>{
 const a=coverContext(actor('SS',-.4187317113799955,38.78840036371043),actor('2B',.08204680369697041,38.76837884895324)),
  before=JSON.stringify(a),without=evaluateLiveFieldDecisionV1({...a,received:[]}),withClaim=evaluateLiveFieldDecisionV1(a),
  candidate=(r:ReturnType<typeof evaluateLiveFieldDecisionV1>)=>r.candidates.find(c=>c.role.taskId==='cover:2')!;
 expect(coveringSecond(without)).toBe(true);expect(coveringSecond(withClaim)).toBe(false);
 expect(candidate(withClaim).competitionCost).toBeGreaterThan(candidate(without).competitionCost);
 expect(Number.isFinite(candidate(withClaim).cost)).toBe(true);expect(JSON.stringify(a)).toBe(before);
});

it('settles equal-arrival mutual cover claims without both covering forever or alternating on every received revision',()=>{
 const actors=[actor('left',-1,38.78),actor('right',1,38.78)],previous:Array<ReturnType<typeof evaluateLiveFieldDecisionV1>['role']>=actors.map(a=>coverRole(a.playerId)),
  claims:LiveFieldAdviceV1[]=actors.map((a,i)=>({sourceId:a.playerId,role:previous[i],trust:1}));
 let settled:string[]|undefined;
 for(let step=0;step<16;step++){
  const results=actors.map((self,i)=>evaluateLiveFieldDecisionV1({...coverContext(self,actors[1-i]),
   elapsedSeconds:1+step*.04,previous:previous[i],received:[claims[1-i]]})),
   covers=results.filter(coveringSecond).map(r=>r.role.playerId);
  expect(covers).toHaveLength(1);if(settled)expect(covers).toEqual(settled);settled=covers;
  results.forEach((r,i)=>{previous[i]=r.role;claims[i]={sourceId:actors[i].playerId,role:r.role,trust:1};});
 }
});

it('uses observed progress and an adopted cover to avoid yielding to a newly received stationary tie',()=>{
 const self={...actor('moving',1,38.78),velocity:v(-.6,0,0)},peer=actor('stationary',-1,38.78),
  a=coverContext(self,peer),result=evaluateLiveFieldDecisionV1(a);
 expect(coveringSecond(result)).toBe(true);
 const newCandidate=evaluateLiveFieldDecisionV1({...coverContext(peer,self),previous:undefined});
 expect(coveringSecond(newCandidate)).toBe(false);
});

it('does not turn an unheard, untrusted, withdrawn or visibly departing cover claim into occupied-base truth',()=>{
 const a=coverContext(actor('outside',-1,38.78),actor('bag',0,38.78)),
  baseline=evaluateLiveFieldDecisionV1({...a,received:[]}),claim=a.received[0];
 expect(evaluateLiveFieldDecisionV1({...a,received:[{...claim,trust:0}]})).toEqual(baseline);
 expect(coveringSecond(evaluateLiveFieldDecisionV1({...a,received:[{...claim,role:{...claim.role,intent:'hold',targetBase:null}}]}))).toBe(true);
 const leaving={...a.others[0],position:v(0,1,39.4),velocity:v(0,0,2)};
 expect(coveringSecond(evaluateLiveFieldDecisionV1({...a,others:[leaving]}))).toBe(true);
});

it('retains an independent pickup and can cover another threat after observing one bag covered',()=>{
 const original=context(),claim={sourceId:'other',role:coverRole('other',1),trust:1},
  plain=evaluateLiveFieldDecisionV1(original),heard=evaluateLiveFieldDecisionV1({...original,received:[claim]});
 expect(heard.candidates.find(c=>c.role.taskId==='pickup')).toEqual(plain.candidates.find(c=>c.role.taskId==='pickup'));
 expect(heard.role.intent).toBe('intercept');
 const a=coverContext(actor('self',1,38.78),actor('bag',0,38.78)),
  multiple=evaluateLiveFieldDecisionV1({...a,threats:[{base:1,arrivalSeconds:5},{base:2,arrivalSeconds:4}]});
 expect(multiple.role).toMatchObject({intent:'base_cover',targetBase:1});
 expect(multiple.candidates.some(c=>c.role.taskId==='cover:2'&&Number.isFinite(c.cost))).toBe(true);
});

it('preserves ability and transformed field geometry without choosing a cover by player identity or position name',()=>{
 const self=actor('left',-1,38.78),peer=actor('right',1,38.78),a=coverContext(self,peer),normal=evaluateLiveFieldDecisionV1(a),
  slower={...peer,topSpeedMps:.5,accelerationMps2:.2};
 expect(coveringSecond(evaluateLiveFieldDecisionV1({...a,self:peer,others:[{...self,topSpeedMps:.5,accelerationMps2:.2}],
  received:[{sourceId:self.playerId,role:coverRole(self.playerId),trust:1}]}))).toBe(true);
 expect(coveringSecond(evaluateLiveFieldDecisionV1({...a,others:[slower]}))).toBe(true);
 const transform=(p:ReturnType<typeof v>)=>v(-p.z+200,p.y,p.x-75),
  transformed={...a,self:{...self,position:transform(self.position),homePosition:transform(self.homePosition)},
   others:[{...peer,position:transform(peer.position),homePosition:transform(peer.homePosition)}],ball:transform(a.ball!),
   bases:Object.fromEntries(Object.entries(a.bases).map(([k,p])=>[k,transform(p)])) as LiveFieldDecisionContextV1['bases'],
   previous:{...a.previous!,point:transform(a.previous!.point)},received:a.received.map(m=>({...m,role:{...m.role,point:transform(m.role.point)}}))};
 expect(evaluateLiveFieldDecisionV1(transformed).role.intent).toBe(normal.role.intent);
 expect(evaluateLiveFieldDecisionV1(transformed).role.targetBase).toBe(normal.role.targetBase);
 const renamed={...a,self:{...self,playerId:'z',defensivePosition:'1B' as const},others:[{...peer,playerId:'a',defensivePosition:'SS' as const}],
  previous:{...a.previous!,playerId:'z'},received:[{...a.received[0],sourceId:'a',role:{...a.received[0].role,playerId:'a'}}]};
 expect(evaluateLiveFieldDecisionV1(renamed).role.intent).toBe(normal.role.intent);
 expect(evaluateLiveFieldDecisionV1({...a,others:[actor('unused',30,30),peer]}).role.intent).toBe(normal.role.intent);
});
