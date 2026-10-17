import assert from 'node:assert/strict';

export type TeamStage = Readonly<{name:string;kind:'observation'|'decision'|'candidate'|'team'|'actor';index:number|null}>;
/** Ordering only; neither a Source nor a Native authority. All actors share the
 * same policy. No future position or index-specific role is introduced. */
export const integerTeamStages = ():readonly TeamStage[] => [
  ...Array.from({length:9},(_,index)=>(['observation','decision','candidate'] as const).map(kind=>({name:kind+'-'+index,kind,index}))).flat(),
  {name:'team',kind:'team',index:null},
  ...Array.from({length:9},(_,index)=>({name:'actor-'+index,kind:'actor' as const,index})),
];
export const orderedDefenders = (originalIds:readonly string[],firstPlayer:string):readonly string[] => {
  assert.equal(originalIds.length,9);assert.equal(new Set(originalIds).size,9);assert.ok(originalIds.includes(firstPlayer));
  return [firstPlayer,...originalIds.filter(id=>id!==firstPlayer)];
};
type EyeBaseline=Readonly<{poseVersion:string;bodyRelativeEyeOffset:Readonly<{x:number;y:number;z:number}>}>;
/** A view baseline belongs to the existing observation chain. A new diagnostic
 * label must not silently replace its immutable pose/eye-anchor convention. */
export const observationEyeBaseline = (previous:EyeBaseline|null):EyeBaseline => previous
  ?{poseVersion:previous.poseVersion,bodyRelativeEyeOffset:{...previous.bodyRelativeEyeOffset}}
  :{poseVersion:'explicit-synthetic-current-ball-directed-integer-team-v1',bodyRelativeEyeOffset:{x:0,y:.6,z:0}};
export type AdoptionPresence = Readonly<{physical:boolean;prefix:boolean;totals:readonly boolean[];view:boolean}>;
/** Raw inventory determines which owner to call, never whether a record is
 * genuine. Original exported readers/writers still authenticate every branch. */
export const nextAdoptionAction = (p:AdoptionPresence):'physical'|'prefix'|'totals'|'view'|'read' => {
  assert.ok(p.totals.length>=10&&p.totals.length<=13,'complete original participant set required');
  assert.ok(!(p.prefix&&!p.physical)&&!(p.totals.some(Boolean)&&!p.prefix)&&!(p.view&&!p.totals.every(Boolean)),'noncausal adoption inventory');
  assert.ok(!p.totals.some(Boolean)||p.totals.every(Boolean),'partial TOTAL set cannot be repaired');
  return !p.physical?'physical':!p.prefix?'prefix':!p.totals.every(Boolean)?'totals':!p.view?'view':'read';
};
