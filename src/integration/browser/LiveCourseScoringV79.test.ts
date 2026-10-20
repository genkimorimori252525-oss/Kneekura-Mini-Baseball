import { expect,it } from 'vitest';
import type { LiveIssuedPitchV1 } from './LiveBaseballMatchV1';
import { createLiveGameStatisticsV79,summarizeLiveIssuedPitchV79,validateLiveGameStatisticsV79 } from './LiveCourseScoringV79';
import { gameV79,scoringPitchV79,scoringPlayersV79 } from './LiveCourseScoringV79.test-support';
import { createLiveBaseballMatchV1 } from './LiveBaseballMatchV1';
import { liveMatchFixture } from './LiveBaseballMatchV1.test-support';

it('counts only terminal PA, distinguishes walks, strikeouts and confirmed HR',()=>{
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79('foul')).scoring).toMatchObject({status:'in_progress',ab:null,h:null,hr:null});
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79('walk')).scoring).toMatchObject({status:'confirmed',ab:0,h:0,hr:0});
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79()).scoring).toMatchObject({status:'confirmed',ab:1,h:0,hr:0});
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79('home_run')).scoring).toMatchObject({status:'confirmed',ab:1,h:1,hr:1});
  const double=scoringPitchV79('ground_rule_double',{play:{field:{ruleFacts:{runnerTouches:[],flyCatch:null},facts:[{kind:'ground_contact',tick:10000},{kind:'over_fence',tick:20000}]}}});
  expect(summarizeLiveIssuedPitchV79(double).scoring).toMatchObject({status:'confirmed',ab:1,h:1,hr:0});
});
it('keeps unsupported H/E and sacrifice decisions pending instead of inventing zero hits',()=>{
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79('live_ball')).scoring).toMatchObject({status:'pending',ab:null,h:null});
  const p=scoringPitchV79('fly_out');
  const withRunner={...p,beforeMatch:{...p.beforeMatch,bases:{first:'r',second:null,third:null}},
    play:{...p.play,rules:{...p.play.rules,scoredRunnerIds:['r']}}} as LiveIssuedPitchV1;
  expect(summarizeLiveIssuedPitchV79(withRunner).scoring.status).toBe('pending');
});
it('requires clean physical evidence for a hit and distinguishes force choice from a hit',()=>{
  const facts={territory:'fair',runnerTouches:[{runnerId:'b',base:1,tick:80000}],flyCatch:null,overFence:null};
  const hit=scoringPitchV79('live_ball',{play:{field:{ruleFacts:facts,facts:[{kind:'glove_contact',tick:90000}]} }});
  expect(summarizeLiveIssuedPitchV79(hit).scoring).toMatchObject({status:'confirmed',h:1,ab:1});
  const choice={...hit,play:{...hit.play,rules:{...hit.play.rules,outcomes:[{runnerId:'r',tick:70000,classification:'force',cause:'base_control',defenderId:'ss'}]}}} as LiveIssuedPitchV1;
  expect(summarizeLiveIssuedPitchV79(choice).scoring).toMatchObject({status:'confirmed',h:0,ab:1,reason:'fielders_choice_force'});
  const mishandle=scoringPitchV79('live_ball',{play:{field:{ruleFacts:facts,facts:[{kind:'body_contact',tick:60000},{kind:'glove_contact',tick:90000}]} }});
  expect(summarizeLiveIssuedPitchV79(mishandle).scoring.status).toBe('pending');
});
it('credits an ordinary outfield single with clean secured collection before first base, and retains ambiguous mishandles',()=>{
  const field={end:{complete:true},ruleFacts:{runnerTouches:[{runnerId:'b',base:1,tick:80000}],flyCatch:null},
    facts:[{kind:'glove_contact',tick:40000,playerId:'cf'},{kind:'catch_secured',tick:45000,playerId:'cf'}],
    diagnostics:{unresolvedDetail:null,throwDirectionCommands:[],aiTelemetry:{throwTargetCancellations:[],contactDiagnostics:[{elapsedSeconds:.04,playerId:'cf',role:'glove',retention:{outcome:'secured'}}]}}};
  const p=scoringPitchV79('live_ball',{play:{field}});
  expect(summarizeLiveIssuedPitchV79(p).scoring).toMatchObject({status:'confirmed',ab:1,h:1,reason:'clean_completed_field_play_hit'});
  const failed={...field,diagnostics:{...field.diagnostics,aiTelemetry:{...field.diagnostics.aiTelemetry,contactDiagnostics:[{elapsedSeconds:.03,playerId:'cf',role:'glove',retention:{outcome:'live-ball'}}]}}};
  expect(summarizeLiveIssuedPitchV79(scoringPitchV79('live_ball',{play:{field:failed}})).scoring.status).toBe('pending');
  const stretched={...p,play:{...p.play,rules:{...p.play.rules,outcomes:[{runnerId:'b',tick:95000,classification:'time_play',cause:'runner_tag',defenderId:'ss'}]}}} as LiveIssuedPitchV1;
  expect(summarizeLiveIssuedPitchV79(stretched).scoring.h).toBe(1);
});
it('uses Source plate front independently of rendered frames and labels front contact estimates',()=>{
  const p=scoringPitchV79();
  const a=summarizeLiveIssuedPitchV79(p),b=summarizeLiveIssuedPitchV79({...p,frames:new Array(200000).fill(null)});
  expect(a.course).toEqual(b.course);expect(a.course.position!.y).toBeGreaterThan(.7);
  expect(a.course.provenance).toBe('source_plate_crossing');
  const front={...p,play:{...p.play,contactMoment:{originTick:0,elapsedSeconds:.01,ball:{position:{x:0,y:.75,z:.7}}}}} as LiveIssuedPitchV1;
  expect(summarizeLiveIssuedPitchV79(front).course.provenance).toBe('source_estimated_after_front_contact');
});
it('classifies outgoing velocity in five fixed fair sectors and keeps fouls separate',()=>{
  for(const [angle,index] of [[-45,0],[-27,1],[-9,2],[9,3],[27,4],[45,4]]){
    const a=angle*Math.PI/180,p=scoringPitchV79('home_run',{play:{outgoingBallMoment:{ball:{velocity:{x:Math.sin(a)*40,y:10,z:Math.cos(a)*40}}}}});
    expect(summarizeLiveIssuedPitchV79(p).spray).toMatchObject({directionIndex:index,foul:false,homeRun:true});
  }
  const p=scoringPitchV79('foul',{play:{outgoingBallMoment:{ball:{velocity:{x:40,y:0,z:1}}}}});
  expect(summarizeLiveIssuedPitchV79(p).spray).toMatchObject({directionIndex:null,foul:true,homeRun:false});
});
it('validates sequence, identities and inert compact JSON, without cloning full frames',()=>{
  const g=gameV79();expect(g.version).toBe('local_course_game_v79');expect(g.nativeAdmission).toBe(false);
  expect(g.players[0]).toMatchObject(scoringPlayersV79[0]);expect(g.records[0].course.publicZoneId).not.toBeNull();
  expect(validateLiveGameStatisticsV79(JSON.parse(JSON.stringify(g)))).toEqual(g);
  expect(()=>createLiveGameStatisticsV79({gameId:'g',seed:1,players:scoringPlayersV79,records:[g.records[0],g.records[0]],finished:true})).toThrow();
  expect(()=>validateLiveGameStatisticsV79({...g,seed:Infinity})).toThrow();
  expect(()=>validateLiveGameStatisticsV79({...g,players:[{...g.players[0],playerId:'other'},g.players[1]]})).toThrow();
});
it('summarizes a complete physical game and preserves confirmed and pending coverage through JSON',()=>{
  const input=liveMatchFixture(2468),host=createLiveBaseballMatchV1(input),records=[];
  while(!host.inspect().finished&&records.length<700)records.push(summarizeLiveIssuedPitchV79(host.issuePitch({batting:'balanced',pitchType:'auto',location:'auto',managedTeam:0})));
  expect(host.inspect().finished).toBe(true);
  const game=createLiveGameStatisticsV79({gameId:'physical-2468',seed:input.seed,players:input.players,records,finished:true}),terminal=game.records.filter(r=>r.ended),
    confirmed=terminal.filter(r=>r.scoring.status==='confirmed'),pending=terminal.filter(r=>r.scoring.status==='pending');
  expect(confirmed.length+pending.length).toBe(terminal.length);expect(confirmed.some(r=>r.scoring.h===1)).toBe(true);
  expect(terminal.length).toBeGreaterThan(50);expect(validateLiveGameStatisticsV79(JSON.parse(JSON.stringify(game)))).toEqual(game);
  console.info('v79 local scoring coverage',JSON.stringify({pitches:records.length,plateAppearances:terminal.length,confirmed:confirmed.length,pending:pending.length,hits:confirmed.filter(r=>r.scoring.h===1).length,gameBytes:JSON.stringify(game).length}));
},120000);
