import { LIVE_MATCH_PHYSICS_V1,type LiveIssuedPitchV1 } from './LiveBaseballMatchV1';
import { createLiveGameStatisticsV79,summarizeLiveIssuedPitchV79 } from './LiveCourseScoringV79';
export const scoringPlayersV79=[{playerId:'b',name:'B',heightMeters:1.8,bats:'R' as const},{playerId:'p',name:'P',heightMeters:1.8,bats:'R' as const}];
export function scoringPitchV79(classification='strikeout',options:Record<string,unknown>={}):LiveIssuedPitchV1{
  const before={ruleProfileId:'test',inning:1,half:'top',outs:0,balls:0,strikes:2,bases:{first:null,second:null,third:null},score:{away:0,home:0},playId:0};
  const ended=!['count','foul'].includes(classification),match={...before,playId:ended?1:0};
  return {...options,beforeMatch:before,match,batterPlayerId:'b',pitcherPlayerId:'p',finished:false,
    command:{batting:'balanced'},play:{classification,call:null,contactMoment:null,outgoingBallMoment:null,field:null,
      rules:{kind:'applied',match,batterAdvanced:ended,gameOver:ended,classification,endedAtTick:100000,scoredRunnerIds:[],outcomes:[]},
      diagnostics:{sourceDescriptor:{kind:'aero_ground_continuous_source_kernel_v2',initial:{originTick:0,elapsedSeconds:0,
        ball:{tick:0,position:{x:0,y:.75,z:1},velocity:{x:0,y:0,z:-30},spin:{x:0,y:0,z:0}}},throughElapsedSeconds:.1,profile:LIVE_MATCH_PHYSICS_V1}},
      ...(options.play as object)}} as unknown as LiveIssuedPitchV1;
}
export const gameV79=(gameId='g',pitch=scoringPitchV79('home_run'))=>createLiveGameStatisticsV79({gameId,seed:1,players:scoringPlayersV79,records:[summarizeLiveIssuedPitchV79(pitch)],finished:true});
