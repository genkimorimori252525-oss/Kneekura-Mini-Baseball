import { expect,it } from 'vitest';
import { createNeutralBatterCourseProfileV79 } from './BatterCourseProfileV79';
import { createLiveGameStatisticsV79,summarizeLiveIssuedPitchV79 } from './LiveCourseScoringV79';
import { createLiveSeasonStoreV79,deriveLiveCourseProfileV79,getLiveSeasonReportV79,reduceLiveSeasonStoreV79,validateLiveSeasonStoreV79 } from './LiveSeasonV79';
import { gameV79,scoringPitchV79,scoringPlayersV79 } from './LiveCourseScoringV79.test-support';
const create=()=>reduceLiveSeasonStoreV79({store:createLiveSeasonStoreV79(),command:{kind:'create',seasonId:'s',name:'Season'}});

it('starts empty, records only finished games, and round trips the JSON source',()=>{
  expect(createLiveSeasonStoreV79()).toMatchObject({version:'live_seasons_v79',selectedSeasonId:null,seasons:[]});
  let s=create();expect(s.selectedSeasonId).toBe('s');
  s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:gameV79()}});
  expect(validateLiveSeasonStoreV79(JSON.parse(JSON.stringify(s)))).toEqual(s);
  const report=getLiveSeasonReportV79({store:s,seasonId:'s',playerId:'b'});
  expect(report.inside).toHaveLength(9);expect(report.inside.map(t=>t.publicZoneId)).toEqual([1,2,3,4,5,6,7,8,9]);
  expect(report.totals).toMatchObject({ab:1,h:1,hr:1,average:1,color:'red',pending:0});
  expect(report.inside.filter(t=>t.ab===0).every(t=>t.average===null&&t.color==='gray')).toBe(true);
  const unfinished={...gameV79('u'),finished:false};
  expect(()=>reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:unfinished}})).toThrow();
});
it('rejects duplicate IDs and forged totals atomically, preserving caller state',()=>{
  let s=create();s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:gameV79()}});
  const before=JSON.stringify(s);
  expect(()=>reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:gameV79()}})).toThrow();
  expect(JSON.stringify(s)).toBe(before);
  expect(()=>validateLiveSeasonStoreV79({...s,longTerm:[{playerId:'b',deltas:new Array(63).fill(Infinity)}]})).toThrow();
  expect(()=>reduceLiveSeasonStoreV79({store:s,command:{kind:'create',seasonId:'s',name:'again'}})).toThrow();
});
it('keeps pending H/AB unavailable and excludes them from learning',()=>{
  const g=createLiveGameStatisticsV79({gameId:'pending',seed:1,players:scoringPlayersV79,records:[summarizeLiveIssuedPitchV79(scoringPitchV79('live_ball'))],finished:true});
  const s=reduceLiveSeasonStoreV79({store:create(),command:{kind:'record_game',seasonId:'s',game:g}}),report=getLiveSeasonReportV79({store:s,seasonId:'s',playerId:'b'});
  expect(report.totals).toMatchObject({ab:0,h:0,pending:1,average:null,color:'gray'});
  expect(deriveLiveCourseProfileV79({store:s,seasonId:'s',playerId:'b'})).toEqual(createNeutralBatterCourseProfileV79());
});
it('practice changes only the selected course current season response and never public H/AB or base profile',()=>{
  const profile=createNeutralBatterCourseProfileV79(),original=JSON.stringify(profile),s=create();
  const practiced=reduceLiveSeasonStoreV79({store:s,command:{kind:'practice',practiceId:'pr',seasonId:'s',playerId:'b',courseId:42,attempts:100,quality:1}});
  const effective=deriveLiveCourseProfileV79({store:practiced,seasonId:'s',playerId:'b',profile});
  expect(effective.referenceAverages[23]).toBeGreaterThan(profile.referenceAverages[23]);
  expect(effective.referenceAverages.filter((v,i)=>v!==profile.referenceAverages[i])).toHaveLength(1);
  expect(getLiveSeasonReportV79({store:practiced,seasonId:'s',playerId:'b'}).totals.ab).toBe(0);expect(JSON.stringify(profile)).toBe(original);
  expect(()=>reduceLiveSeasonStoreV79({store:practiced,command:{kind:'practice',practiceId:'pr',seasonId:'s',playerId:'b',courseId:42,attempts:1,quality:1}})).toThrow();
  for(const command of [{courseId:17},{attempts:0},{attempts:Number.MAX_SAFE_INTEGER},{quality:NaN},{quality:1.01}]){
    expect(()=>reduceLiveSeasonStoreV79({store:s,command:{kind:'practice',practiceId:'bad',seasonId:'s',playerId:'b',courseId:42,attempts:1,quality:1,...command}})).toThrow();
  }
});
it('close learns only from H/AB once, preserves prior season, and resets practice next season',()=>{
  let s=create();s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:gameV79()}});
  s=reduceLiveSeasonStoreV79({store:s,command:{kind:'practice',practiceId:'p',seasonId:'s',playerId:'b',courseId:42,attempts:100,quality:1}});
  const before=JSON.stringify(s.seasons[0].games),closed=reduceLiveSeasonStoreV79({store:s,command:{kind:'close',seasonId:'s'}});
  expect(closed.seasons[0].status).toBe('closed');expect(JSON.stringify(closed.seasons[0].games)).toBe(before);
  expect(closed.longTerm[0].deltas.every(d=>Math.abs(d)<=.005)).toBe(true);
  expect(()=>reduceLiveSeasonStoreV79({store:closed,command:{kind:'close',seasonId:'s'}})).toThrow();
  expect(()=>reduceLiveSeasonStoreV79({store:closed,command:{kind:'record_game',seasonId:'s',game:gameV79('late')}})).toThrow();
  const next=reduceLiveSeasonStoreV79({store:closed,command:{kind:'create',seasonId:'next',name:'Next'}});
  const effective=deriveLiveCourseProfileV79({store:next,seasonId:'next',playerId:'b'});
  expect(effective.referenceAverages[23]).toBe(.25);expect(getLiveSeasonReportV79({store:next,seasonId:'next',playerId:'b'}).totals.ab).toBe(0);
});
it('combines H/AB totals by coordinates rather than averaging course averages',()=>{
  let s=create();
  for(let i=0;i<10;i++)s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:gameV79('g'+i,scoringPitchV79(i<3?'home_run':'strikeout'))}});
  const r=getLiveSeasonReportV79({store:s,seasonId:'s',playerId:'b'});expect(r.totals).toMatchObject({ab:10,h:3,average:.3,color:'red'});
  const index=s.seasons[0].games[0].records[0].course.courseIndex!,effective=deriveLiveCourseProfileV79({store:s,seasonId:'s',playerId:'b'});
  expect(effective.referenceAverages[index]).toBeCloseTo(.2515,8);
  const closed=reduceLiveSeasonStoreV79({store:s,command:{kind:'close',seasonId:'s'}});
  expect(closed.longTerm[0].deltas[index]).toBeGreaterThan(0);expect(closed.longTerm[0].deltas[index]).toBeLessThan(.005);
});
it('roundtrips and aggregates a 162-game season beyond a global inert clone budget',()=>{
  let s=create();const template=gameV79();
  for(let i=0;i<162;i++)s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:{...template,gameId:'season-'+i}}});
  const restored=validateLiveSeasonStoreV79(JSON.parse(JSON.stringify(s)));
  expect(restored.seasons[0].games).toHaveLength(162);expect(getLiveSeasonReportV79({store:restored,seasonId:'s',playerId:'b'}).totals).toMatchObject({ab:162,h:162,hr:162});
  const disabled=reduceLiveSeasonStoreV79({store:restored,command:{kind:'select',seasonId:null}});expect(disabled.selectedSeasonId).toBeNull();
});
it('keeps outside, off-grid and missing positions separate and uses blue at .200',()=>{
  let s=create();const base=summarizeLiveIssuedPitchV79(scoringPitchV79('strikeout'));
  for(const [gameId,position] of [['outside',{x:.3,y:.75}],['off',{x:3,y:.75}],['missing',null]] as const){
    const course=position?{...base.course,position}:{position:null,planeZ:.15 as const,provenance:'missing_source' as const,sourceOriginTick:null,crossingElapsedSeconds:null};
    const g=createLiveGameStatisticsV79({gameId,seed:1,players:scoringPlayersV79,records:[{...base,course}],finished:true});
    s=reduceLiveSeasonStoreV79({store:s,command:{kind:'record_game',seasonId:'s',game:g}});
  }
  const r=getLiveSeasonReportV79({store:s,seasonId:'s',playerId:'b'});expect(r.outside.ab).toBe(1);expect(r.offGrid.ab).toBe(1);expect(r.missing.ab).toBe(1);expect(r.totals.color).toBe('blue');
  let blue=create();for(let i=0;i<5;i++)blue=reduceLiveSeasonStoreV79({store:blue,command:{kind:'record_game',seasonId:'s',game:gameV79('b'+i,scoringPitchV79(i===0?'home_run':'strikeout'))}});
  expect(getLiveSeasonReportV79({store:blue,seasonId:'s',playerId:'b'}).totals).toMatchObject({average:.2,color:'blue'});
});
it('retains original author settings and limits learning for 0/1/10/100 and large AB',()=>{
  const author={...createNeutralBatterCourseProfileV79(),referenceAverages:new Array(63).fill(.33)},single=gameV79();
  const course=single.records[0].course.courseIndex!;
  for(const n of [0,1,10,100,1000]){
    const games=Array.from({length:Math.min(n,500)},(_,i)=>({...single,gameId:'large-'+i}));
    // For 1000 AB, use two distinct PAs per independent compact game.
    if(n===1000)for(let i=0;i<games.length;i++){
      const first={...single.records[0],gameOver:false},second={...single.records[0],pitchId:'1:200000',plateAppearanceId:'1',endedAtTick:200000,before:single.records[0].after,after:{...single.records[0].after,playId:2}};
      games[i]={...games[i],records:[first,second]};
    }
    const s=validateLiveSeasonStoreV79({...create(),seasons:[{...create().seasons[0],games}]});
    const effective=deriveLiveCourseProfileV79({store:s,seasonId:'s',playerId:'b',profile:author});
    expect(effective.referenceAverages[course]).toBeGreaterThanOrEqual(.33);expect(effective.referenceAverages[course]-.33).toBeLessThanOrEqual(.040000001);
    const closed=reduceLiveSeasonStoreV79({store:s,command:{kind:'close',seasonId:'s'}});
    expect(closed.longTerm.every(p=>p.deltas.every(d=>Math.abs(d)<=.005))).toBe(true);
  }
  expect(author.referenceAverages.every(v=>v===.33)).toBe(true);
});
