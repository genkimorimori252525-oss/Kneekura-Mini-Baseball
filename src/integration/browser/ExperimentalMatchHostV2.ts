import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SeedRoot} from '../../core/rng/SeedRoot';
import {cloneMatchInputWithMeasuredCatalogV68,createLiveBaseballMatchWorkerV116,type LiveMatchInputV1,type LiveMatchContinuationV116,type LivePitchCommandV1} from './LiveBaseballMatchV1';
const SOURCE_SHA='27d84474f8d842a8a969b6aceb07ebac94dd92aea4267826b24fa2a31221efc8',GENERAL_SHA='7c3ce16289511e184ebe572314349c85e05b0137edb94314ff6edc36e4a760b0';
const IDS=['robin_2','robin_3','robin_3_slow','robin_3_horizontal','robin_3_horizontal_slow','robin_4','robin_5','robin_5_slow','robin_5_original','robin_6','robin_6_original'] as const;
type SourcePolicy=Readonly<{version:'robin_original_source_v1';sourceSha256:string}>;
type AutoPolicy=Readonly<{version:'robin_original_auto_v1';sourceSha256:string}>;
type GeneralPolicy=Readonly<{version:'general_loose_policy_v1';implementationSha256:string;partialFallback:'partial_reference_fallback_v1';catcherObservation:'fixed_release_100ms_v1';batModel:'prescribed_bat_attached_and_no_interference_v1';uncaughtThird:'uncaught_third_empty_before_two_out_v4'}>;
export type ExperimentalPoliciesV2=Readonly<{robinSource:SourcePolicy|null;robinAuto:AutoPolicy|null;generalLoose:GeneralPolicy|null}>;
export type ExperimentalContinuationV2=Readonly<{version:'match_experimental_continuation_v2';policies:ExperimentalPoliciesV2;inner:LiveMatchContinuationV116}>;
type OriginalSelection=Readonly<{version:'robin_original_command_v1';sourceSha256:string;selection:string}>;
type ExperimentalCommand=LivePitchCommandV1&Readonly<{robinOriginalV1?:OriginalSelection;robinSelection?:string}>;
function assert(value:unknown,message:string):asserts value{if(!value)throw Error('experimental match HOLD: '+message)}
function fields(value:unknown,names:string[]):Record<string,unknown>{assert(value&&typeof value==='object'&&!Array.isArray(value),'invalid data');const r=value as Record<string,unknown>;assert(Object.keys(r).sort().join('|')===names.sort().join('|'),'unknown or missing fields');return r}
function policies(raw:unknown):ExperimentalPoliciesV2{
 const r=fields(cloneInert(raw),['robinSource','robinAuto','generalLoose']);let robinSource:SourcePolicy|null=null,robinAuto:AutoPolicy|null=null,generalLoose:GeneralPolicy|null=null;
 if(r.robinSource!==null){const p=fields(r.robinSource,['version','sourceSha256']);assert(p.version==='robin_original_source_v1'&&p.sourceSha256===SOURCE_SHA,'unknown original source');robinSource=Object.freeze({version:'robin_original_source_v1',sourceSha256:SOURCE_SHA})}
 if(r.robinAuto!==null){const p=fields(r.robinAuto,['version','sourceSha256']);assert(p.version==='robin_original_auto_v1'&&p.sourceSha256===SOURCE_SHA,'unknown auto policy');robinAuto=Object.freeze({version:'robin_original_auto_v1',sourceSha256:SOURCE_SHA})}
 if(r.generalLoose!==null){const p=fields(r.generalLoose,['version','implementationSha256','partialFallback','catcherObservation','batModel','uncaughtThird']);assert(p.version==='general_loose_policy_v1'&&p.implementationSha256===GENERAL_SHA&&p.partialFallback==='partial_reference_fallback_v1'&&p.catcherObservation==='fixed_release_100ms_v1'&&p.batModel==='prescribed_bat_attached_and_no_interference_v1'&&p.uncaughtThird==='uncaught_third_empty_before_two_out_v4','unknown general policy');generalLoose=Object.freeze({version:'general_loose_policy_v1',implementationSha256:GENERAL_SHA,partialFallback:p.partialFallback,catcherObservation:p.catcherObservation,batModel:p.batModel,uncaughtThird:p.uncaughtThird})}
 assert(robinSource||generalLoose,'empty policy');assert(!robinAuto||robinSource,'auto requires original source');return Object.freeze({robinSource,robinAuto,generalLoose});
}
function continuation(raw:unknown,expected:ExperimentalPoliciesV2):LiveMatchContinuationV116{
 const r=fields(cloneInert(raw),['version','policies','inner']);assert(r.version==='match_experimental_continuation_v2','unsupported continuation version');assert(JSON.stringify(policies(r.policies))===JSON.stringify(expected),'continuation policy differs');const inner=r.inner;assert(inner&&typeof inner==='object'&&!Array.isArray(inner)&&(inner as Record<string,unknown>).version==='live_match_continuation_v116','invalid inner continuation');return inner as LiveMatchContinuationV116;
}
function freezeDeep<T>(x:T):T{if(x&&typeof x==='object'&&!Object.isFrozen(x)){Object.values(x).forEach(freezeDeep);Object.freeze(x)}return x}
export function readMatchContinuationV2(raw:LiveMatchContinuationV116|ExperimentalContinuationV2){const inner=raw.version==='live_match_continuation_v116'?raw:raw.version==='match_experimental_continuation_v2'?continuation(raw,policies(raw.policies)):(()=>{throw Error('experimental match HOLD: unsupported continuation version')})();assert(Number.isSafeInteger(inner.pitchCount)&&inner.pitchCount>=0&&Number.isSafeInteger(inner.nextTick)&&inner.nextTick>=0&&inner.match&&typeof inner.match==='object','invalid continuation view');return freezeDeep({version:raw.version,pitchCount:inner.pitchCount,nextTick:inner.nextTick,match:cloneInert(inner.match)})}
/** Proposed envelope only: original and loose solvers remain unconnected/HOLD. */
export function createExperimentalMatchHostV2(raw:LiveMatchInputV1,rawPolicies:ExperimentalPoliciesV2,resume?:ExperimentalContinuationV2){
 const p=policies(rawPolicies),clean=cloneMatchInputWithMeasuredCatalogV68(raw) as LiveMatchInputV1&{experimentalMatchPoliciesV2?:unknown};delete clean.experimentalMatchPoliciesV2;if(p.generalLoose)Object.assign(clean,{partialReferenceFallbackV1:p.generalLoose.partialFallback,causalCatcherObservationV1:p.generalLoose.catcherObservation,prescribedBatModelV1:{version:p.generalLoose.batModel,scope:'CURRENT_SWING_CLIP_ONLY'},uncaughtThirdModelV1:{version:p.generalLoose.uncaughtThird}});
 const host=createLiveBaseballMatchWorkerV116(clean,resume===undefined?undefined:continuation(resume,p));
 function captureContinuationV116():ExperimentalContinuationV2{return Object.freeze({version:'match_experimental_continuation_v2',policies:p,inner:host.captureContinuationV116()})}
 function issuePitch(command:ExperimentalCommand){const c=cloneInert(command),state=host.inspect();if(c.robinSelection!==undefined)throw Error('HOLD: unversioned original command unsupported');
  if(c.robinOriginalV1!==undefined){const q=fields(c.robinOriginalV1,['version','sourceSha256','selection']);assert(q.version==='robin_original_command_v1'&&q.sourceSha256===SOURCE_SHA&&typeof q.selection==='string'&&IDS.includes(q.selection as typeof IDS[number]),'invalid original command');assert(p.robinSource&&state.pitcherPlayerId==='robin','original source not enabled for pitcher');const {robinOriginalV1,...rest}=c;return host.issuePitch({...rest,robinSelection:q.selection} as LivePitchCommandV1)}
  const defenseManaged=c.managedTeam===1-state.team,automatic=!defenseManaged||(c.pitchType==='auto'&&c.pitchId===undefined);
  if(p.robinAuto&&state.pitcherPlayerId==='robin'&&automatic){const ordinal=state.pitchCount+1;assert(Number.isSafeInteger(ordinal)&&ordinal>=1&&ordinal<=0xffffffff,'invalid ordinal');const root=new SeedRoot(clean.seed),key='robin-original-auto-v1',streamSeed=root.streamSeed(ordinal-1,'pitch',key),rng=root.streamRng(ordinal-1,'pitch',key),index=Math.floor(rng.nextFloat()*IDS.length),selection=IDS[index];return host.issuePitch({...c,robinSelection:selection,robinAutoSelectionV1:{version:'robin_original_auto_v1',sourceSha256:SOURCE_SHA,pitcherId:'robin',matchSeed:clean.seed,pitchOrdinal:ordinal,streamKey:key,streamSeed,drawCount:1,index,selection}} as LivePitchCommandV1)}
  return host.issuePitch(c);
 }
 return Object.freeze({issuePitch,inspect:host.inspect,captureContinuationV116});
}
