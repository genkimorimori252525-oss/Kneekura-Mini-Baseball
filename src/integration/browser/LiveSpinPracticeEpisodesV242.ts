import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {resolveLiveBattingSetupV94} from '../../core/sim/pitching/BattingSetupV94';
import {cloneMatchInputWithMeasuredCatalogV68,resolveLiveMatchPlayerPhysicalV98,type LiveMatchInputV1} from './LiveBaseballMatchV1';
import {validateLiveContactFrameMotorV244,type LiveContactFrameMotorV244} from './LiveContactFrameMotorV244';
import {validateLiveSpinMotorV239,validateLiveSpinPracticeCriterionV239,type LiveSpinMotorV239,type LiveSpinPracticeCriterionV239} from './LiveSpinMotorPracticeV239';

export type LiveSpinEpisodeMotorV242=LiveSpinMotorV239|LiveContactFrameMotorV244;
export type LiveSpinEpisodePlanV242=Readonly<{
 version:'live_spin_practice_episodes_v242';scopeId:string;motor:LiveSpinEpisodeMotorV242;criterion:LiveSpinPracticeCriterionV239|null;
 selection:'FIRST_TARGET_PITCH';start:'NORMAL_HOST_EPISODE_LOCAL';timeScope:'EPISODE_LOCAL_NO_CAREER_CLOCK';
 memoryPrior:'RESET_TO_NORMAL_EPISODE_CONFIGURATION';workload:'RESET_TO_NORMAL_EPISODE_CONFIGURATION';
 episodes:readonly Readonly<{index:number;seed:number}>[];
 authority:'CALLER_DECLARED_NOT_OWNER_AUTHENTICATED';earnedQualification:false;nativeQualification:false;
}>;
export type LiveSpinEpisodeObservationV242=Readonly<{episodeIndex:number;status:'PA_OPEN'|'PA_ENDED'}>;
const text=(x:unknown):x is string=>typeof x==='string'&&x.length>0&&x.length<=200&&x.trim()===x;
const freeze=<T>(x:T):T=>{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freeze);Object.freeze(x)}return x};
/** This declaration is not proof of distinct physical events or earned ability. */
export function declareSpinPracticeEpisodesV242(input:Readonly<{scopeId:string;motor:LiveSpinEpisodeMotorV242;criterion:LiveSpinPracticeCriterionV239|null;episodeSeeds:readonly number[]}>):LiveSpinEpisodePlanV242 {
 const raw=cloneInert(input);
 if(!raw||!text(raw.scopeId)||!Array.isArray(raw.episodeSeeds)||raw.episodeSeeds.length===0||!raw.episodeSeeds.every(n=>Number.isSafeInteger(n)&&n>=0&&n<=4294967295))throw Error('invalid episode declaration');
 const motor=raw.motor?.version==='live_contact_frame_motor_v244'?validateLiveContactFrameMotorV244(raw.motor):validateLiveSpinMotorV239(raw.motor),criterion=raw.criterion===null?null:validateLiveSpinPracticeCriterionV239(raw.criterion);
 return freeze({version:'live_spin_practice_episodes_v242',scopeId:raw.scopeId,motor,criterion,selection:'FIRST_TARGET_PITCH',start:'NORMAL_HOST_EPISODE_LOCAL',timeScope:'EPISODE_LOCAL_NO_CAREER_CLOCK',memoryPrior:'RESET_TO_NORMAL_EPISODE_CONFIGURATION',workload:'RESET_TO_NORMAL_EPISODE_CONFIGURATION',episodes:raw.episodeSeeds.map((seed,index)=>({index,seed})),authority:'CALLER_DECLARED_NOT_OWNER_AUTHENTICATED',earnedQualification:false,nativeQualification:false});
}
/** Each configuration starts a new Host; no prior continuation or learned state is carried by this function. */
export function deriveSpinEpisodeConfigurationV242(plan:LiveSpinEpisodePlanV242,index:number,configuration:LiveMatchInputV1):LiveMatchInputV1 {
 const episode=plan.episodes[index];if(!Number.isSafeInteger(index)||!episode||episode.index!==index)throw Error('episode index is not scheduled');
 const copy=cloneMatchInputWithMeasuredCatalogV68(configuration),motor=plan.motor,player=copy.players.find(p=>p.playerId===motor.subjectId);if(!player)throw Error('target player missing');
 const physical=resolveLiveMatchPlayerPhysicalV98(player),clip=copy.measuredClips.find(c=>c.id===motor.clip.id&&c.side===motor.clip.bats&&c.source.sha256===motor.clip.sourceSha256);
 if(!clip||player.bats!==motor.clip.bats||physical.clipId!==motor.clip.id)throw Error('target clip differs');
 const setup=resolveLiveBattingSetupV94({...physical,heightMeters:player.heightMeters,bats:player.bats});
 if(!Object.is(setup.contactPlaneZ,motor.domain.plateZ))throw Error('target domain differs');
 return freeze({...copy,seed:episode.seed});
}
/** Statuses are caller declarations only. Owner must authenticate all pitch and PA evidence. */
export function assessSpinPracticeEpisodesV242(plan:LiveSpinEpisodePlanV242,observations:readonly LiveSpinEpisodeObservationV242[]) {
 const seen=new Set<number>();let complete=0;
 for(const entry of observations){if(!Number.isSafeInteger(entry.episodeIndex)||entry.episodeIndex<0||entry.episodeIndex>=plan.episodes.length||seen.has(entry.episodeIndex)||!['PA_OPEN','PA_ENDED'].includes(entry.status))throw Error('invalid episode observation');seen.add(entry.episodeIndex);if(entry.status==='PA_ENDED')complete++;}
 return freeze({status:complete===plan.episodes.length?'DECLARED_COMPLETE' as const:'HOLD' as const,planned:plan.episodes.length,complete,unstarted:plan.episodes.length-seen.size,ownerAuthenticated:false as const,earnedQualification:false as const,nativeQualification:false as const});
}
