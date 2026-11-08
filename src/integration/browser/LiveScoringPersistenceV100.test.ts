import {it,expect} from 'vitest';
import {liveMatchFixture} from './LiveBaseballMatchV1.test-support';
import {createLiveBaseballMatchV1,type LiveIssuedPitchV1} from './LiveBaseballMatchV1';
import {summarizeLiveIssuedPitchV79,createLiveGameStatisticsV79,validateLiveGameStatisticsV79} from './LiveCourseScoringV79';
import {classifyLocalScoringV100,validateLocalScoringV100} from './LiveMatchScoringV100';
import {scoringPitchV79,scoringPlayersV79,gameV79} from './LiveCourseScoringV79.test-support';
import {createLiveSeasonStoreV79,reduceLiveSeasonStoreV79,getLiveSeasonFieldingV100} from './LiveSeasonV79';
it('uses the same scored hit in Host totals, saved H/AB, and validated summary while keeping old JSON readable',()=>{
 const input=liveMatchFixture(2468),host=createLiveBaseballMatchV1(input),rows:LiveIssuedPitchV1[]=[];
 for(let i=0;i<6;i++)rows.push(host.issuePitch({managedTeam:0,batting:'balanced',pitchType:'auto',location:'auto'}));
 expect(host.inspect().hits!.away).toBe(rows.reduce((n,r)=>n+(r.beforeMatch.half==='top'?(r.play.localScoringV100?.hits??0):0),0));
 const summaries=rows.map(summarizeLiveIssuedPitchV79),game=createLiveGameStatisticsV79({gameId:'new-v100',seed:2468,players:input.players,records:summaries,finished:false});
 expect(validateLiveGameStatisticsV79(JSON.parse(JSON.stringify(game)))).toEqual(game);
 expect(summaries.every((r,i)=>r.scoring.h===rows[i].play.localScoringV100!.hits)).toBe(true);
 expect(validateLiveGameStatisticsV79(JSON.parse(JSON.stringify(gameV79()))).version).toBe('local_course_game_v79');
},60_000);
it('persists foul errors in a continuing PA and counts them once; duplicate game saving stays idempotent',()=>{
 const pitch=scoringPitchV79('foul'),local=classifyLocalScoringV100({playId:0,batterRunnerId:'b',endedAtTick:100000,ended:false,classification:'foul',outsBefore:0,bunt:false,
  initialBases:{b:0},touches:[],outs:[],scoredRunnerIds:[],firstChoice:null,candidates:[{id:'drop',tick:90000,fielderId:'p',kind:'fielding'}],
  ordinary:{available:true,outRunnerIds:['b'],furthestBases:{b:0},flyCaught:true,scoredRunnerIds:[]}}),
  first=summarizeLiveIssuedPitchV79({...pitch,play:{...pitch.play,localScoringV100:local}}),terminal=scoringPitchV79(),
  second={...summarizeLiveIssuedPitchV79(terminal),pitchId:'0:200000',endedAtTick:200000,before:first.after},
  game=createLiveGameStatisticsV79({gameId:'foul-error',seed:1,players:scoringPlayersV79,records:[first,second],finished:true});
 let store=reduceLiveSeasonStoreV79({store:createLiveSeasonStoreV79(),command:{kind:'create',seasonId:'s',name:'S'}});
 store=reduceLiveSeasonStoreV79({store,command:{kind:'record_game',seasonId:'s',game}});
 expect(getLiveSeasonFieldingV100({store,seasonId:'s',playerId:'p'}).errors).toBe(1);
 const reloaded=JSON.parse(JSON.stringify(store));expect(getLiveSeasonFieldingV100({store:reloaded,seasonId:'s',playerId:'p'}).errors).toBe(1);
 expect(()=>reduceLiveSeasonStoreV79({store,command:{kind:'record_game',seasonId:'s',game}})).toThrow();
 const reordered=Object.fromEntries(Object.entries(local).reverse());expect(()=>validateLocalScoringV100(reordered)).not.toThrow();
});
it('saves an actual completed one-inning game with the same scored H/E and reloads it into a season',()=>{
 const input={...liveMatchFixture(2468),innings:1},host=createLiveBaseballMatchV1(input),records:LiveIssuedPitchV1[]=[];
 while(!host.inspect().finished&&records.length<150)records.push(host.issuePitch({managedTeam:0,batting:'balanced',pitchType:'auto',location:'auto'}));
 expect(host.inspect().finished).toBe(true);expect(records.some(r=>r.play.field)).toBe(true);
 const game=createLiveGameStatisticsV79({gameId:'finished-v100',seed:2468,players:input.players,records:records.map(summarizeLiveIssuedPitchV79),finished:true});
 let store=reduceLiveSeasonStoreV79({store:createLiveSeasonStoreV79(),command:{kind:'create',seasonId:'actual',name:'Actual'}});
 store=reduceLiveSeasonStoreV79({store,command:{kind:'record_game',seasonId:'actual',game}});
 const reloaded=JSON.parse(JSON.stringify(store));
 for(const player of input.players){const report=getLiveSeasonFieldingV100({store:reloaded,seasonId:'actual',playerId:player.playerId});
  expect(report.errors).toBe(records.reduce((n,r)=>n+r.play.localScoringV100!.errors.filter(e=>e.fielderId===player.playerId).length,0));}
 expect(game.records.filter(r=>r.ended).reduce((n,r)=>n+(r.scoring.h??0),0)).toBe(host.inspect().hits!.away+host.inspect().hits!.home);
},120_000);
