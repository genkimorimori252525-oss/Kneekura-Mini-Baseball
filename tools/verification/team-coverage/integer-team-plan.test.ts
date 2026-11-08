import { describe,expect,it } from 'vitest';
import { integerTeamStages,nextAdoptionAction,orderedDefenders,observationEyeBaseline } from './integer-team-plan';
describe('integer team reproduction ordering (no Native authority)',()=>{
  it('retains 37 metadata and keeps every observation before the complete actor barrier',()=>{
    const stages=integerTeamStages();expect(stages).toHaveLength(37);expect(new Set(stages.map(s=>s.name)).size).toBe(37);
    for(let i=0;i<9;i++)expect(stages.slice(i*3,i*3+3).map(s=>s.kind)).toEqual(['observation','decision','candidate']);
    expect(stages.slice(27).map(s=>s.kind)).toEqual(['team',...Array(9).fill('actor')]);
    expect(stages.at(-1)?.name).toBe('actor-8');
  });
  it('keeps original binding order except the already calibrated first actor',()=>{
    const ids=Array.from({length:9},(_,i)=>'p'+i);expect(orderedDefenders(ids,'p4')).toEqual(['p4','p0','p1','p2','p3','p5','p6','p7','p8']);
    expect(()=>orderedDefenders([...ids.slice(0,8),'p0'],'p4')).toThrow();expect(()=>orderedDefenders(ids,'foreign')).toThrow();
  });
  it('preserves the admitted observation eye baseline rather than renaming the pose',()=>{
    const original={poseVersion:'original-admitted-pose-v1',bodyRelativeEyeOffset:{x:.2,y:.65,z:-.1}};
    const value=observationEyeBaseline(original);expect(value).toEqual(original);expect(value).not.toBe(original);
    expect(value.bodyRelativeEyeOffset).not.toBe(original.bodyRelativeEyeOffset);
    expect(observationEyeBaseline(null)).toEqual({poseVersion:'explicit-synthetic-current-ball-directed-integer-team-v1',bodyRelativeEyeOffset:{x:0,y:.6,z:0}});
  });
  it('recovers at each actual commit boundary without readmission',()=>{
    const totals=Array<boolean>(10).fill(false),p={physical:false,prefix:false,totals,view:false};
    expect(nextAdoptionAction(p)).toBe('physical');expect(nextAdoptionAction({...p,physical:true})).toBe('prefix');
    expect(nextAdoptionAction({...p,physical:true,prefix:true})).toBe('totals');
    expect(nextAdoptionAction({...p,physical:true,prefix:true,totals:totals.map(()=>true)})).toBe('view');
    expect(nextAdoptionAction({...p,physical:true,prefix:true,totals:totals.map(()=>true),view:true})).toBe('read');
  });
  it('fails closed rather than repairing partial sets or inventing ancestry',()=>{
    const p={physical:true,prefix:true,totals:Array<boolean>(10).fill(false),view:false};
    expect(()=>nextAdoptionAction({...p,totals:p.totals.map((_,i)=>i===0)})).toThrow(/partial/);
    expect(()=>nextAdoptionAction({...p,physical:false})).toThrow(/noncausal/);
    expect(()=>nextAdoptionAction({...p,view:true})).toThrow(/noncausal/);
    expect(()=>nextAdoptionAction({...p,totals:[]})).toThrow(/complete/);
  });
});
