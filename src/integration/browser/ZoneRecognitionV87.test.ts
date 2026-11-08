import {expect,it} from 'vitest';
import {createNeutralZoneRecognitionV87,validateZoneRecognitionV87,recognizeZoneV87,selectZoneTargetV87} from './ZoneRecognitionV87';
const zone={centerX:0,halfWidth:.22,lowerY:.5,upperY:1.5};
const request={role:'batter' as const,position:{x:0,y:1},zone,seed:7,sourceTick:100,observationTick:100,planeZ:.15,standardDeviationMeters:.04,abilityBasis:'zoneJudgmentStdMeters'};
it('validates independent bounded dense 63-cell role profiles without modifying input',()=>{
 const neutral=createNeutralZoneRecognitionV87(),before=JSON.stringify(neutral);expect(neutral.batter!.cells).toHaveLength(63);
 expect(validateZoneRecognitionV87(neutral)).toEqual(neutral);expect(JSON.stringify(neutral)).toBe(before);
 for(const cell of [{biasXM:.51},{biasYM:NaN},{uncertaintyScale:-1},{targetWeight:4.1}]){
  const changed=structuredClone(neutral);Object.assign(changed.batter!.cells[0],cell);expect(()=>validateZoneRecognitionV87(changed)).toThrow();
 }
 const short=structuredClone(neutral);(short.batter!.cells as unknown[]).pop();expect(()=>validateZoneRecognitionV87(short)).toThrow();
});
it('preserves legacy errors when omitted and applies explicit zero uncertainty and bias deterministically',()=>{
 const baselineErrorMeters={x:.01,y:-.02},legacy=recognizeZoneV87({...request,baselineErrorMeters});expect(legacy.position).toEqual({x:.01,y:.98});
 expect(Object.isFrozen(request.position)).toBe(false);expect(Object.isFrozen(baselineErrorMeters)).toBe(false);
 const profile=createNeutralZoneRecognitionV87(),edited={...profile,batter:{cells:profile.batter!.cells.map(cell=>({...cell,biasXM:.1,biasYM:-.05,uncertaintyScale:0}))}};
 const changed=recognizeZoneV87({...request,profile:edited});expect(changed.position).toEqual({x:.1,y:.95});
 expect(recognizeZoneV87({...request,profile:edited})).toEqual(changed);expect(changed.diagnostics.role).toBe('batter');
 expect(()=>recognizeZoneV87({...request,sourceTick:101})).toThrow(/future/);
});
it('isolates role random streams and constrains weighted targets to permitted courses and manual commands',()=>{
 const profile=createNeutralZoneRecognitionV87(),weighted={...profile,pitcher:{cells:profile.pitcher!.cells.map((cell,index)=>({...cell,targetWeight:index===32?4:0}))}};
 const selected=selectZoneTargetV87({role:'pitcher',profile:weighted,position:{x:.1,y:.9},zone,seed:7,allowRetarget:true,allowedCourseIds:[54]});expect(selected.courseId).toBe(54);
 expect(selectZoneTargetV87({role:'pitcher',profile:weighted,position:{x:.1,y:.9},zone,seed:7,allowRetarget:false}).position).toEqual({x:.1,y:.9});
 const batter=recognizeZoneV87({...request,profile}),catcher=recognizeZoneV87({...request,profile,role:'catcher'});
 expect(batter.diagnostics.stream).not.toBe(catcher.diagnostics.stream);expect(batter.position).not.toEqual(catcher.position);
});
