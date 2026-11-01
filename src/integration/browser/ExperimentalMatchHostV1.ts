import {cloneInert} from '../../core/adjudication/OfficialWindowPolicy';
import {SeedRoot} from '../../core/rng/SeedRoot';
import {createLiveBaseballMatchWorkerV116,type LiveMatchInputV1,type LiveMatchContinuationV116,type LivePitchCommandV1} from './LiveBaseballMatchV1';

const ORIGINAL_SHA='27d84474f8d842a8a969b6aceb07ebac94dd92aea4267826b24fa2a31221efc8';
const GENERAL_SHA='7c3ce16289511e184ebe572314349c85e05b0137edb94314ff6edc36e4a760b0';
const ORIGINAL_IDS=['robin_2','robin_3','robin_3_slow','robin_3_horizontal','robin_3_horizontal_slow','robin_4','robin_5','robin_5_slow','robin_5_original','robin_6','robin_6_original'] as const;
type AutoPolicy=Readonly<{version:'robin_original_auto_v1';sourceSha256:string}>;
type GeneralPolicy=Readonly<{version:'general_loose_policy_v1';implementationSha256:string;partialFallback:'off'|'partial_reference_fallback_v1'}>;
export type ExperimentalPoliciesV1=Readonly<{robinAuto:AutoPolicy|null;generalLoose:GeneralPolicy|null}>;
export type ExperimentalContinuationV1=Readonly<{version:'match_experimental_continuation_v1';policies:ExperimentalPoliciesV1;inner:LiveMatchContinuationV116}>;
type ExperimentalCommand=LivePitchCommandV1&Readonly<{robinSelection?:string}>;
function assert(condition:unknown,message:string):asserts condition{if(!condition)throw Error('experimental match HOLD: '+message)}
function policy(raw:unknown):ExperimentalPoliciesV1{
 const x=cloneInert(raw);assert(x&&typeof x==='object'&&!Array.isArray(x),'invalid policies');const r=x as Record<string,unknown>;assert(Object.keys(r).sort().join('|')==='generalLoose|robinAuto','invalid policy fields');
 let robinAuto:AutoPolicy|null=null,generalLoose:GeneralPolicy|null=null;
 if(r.robinAuto!==null){assert(r.robinAuto&&typeof r.robinAuto==='object'&&!Array.isArray(r.robinAuto),'invalid robin policy');const a=r.robinAuto as Record<string,unknown>;assert(Object.keys(a).sort().join('|')==='sourceSha256|version'&&a.version==='robin_original_auto_v1'&&a.sourceSha256===ORIGINAL_SHA,'unknown robin policy');robinAuto=Object.freeze({version:'robin_original_auto_v1',sourceSha256:ORIGINAL_SHA})}
 if(r.generalLoose!==null){assert(r.generalLoose&&typeof r.generalLoose==='object'&&!Array.isArray(r.generalLoose),'invalid general policy');const g=r.generalLoose as Record<string,unknown>;assert(Object.keys(g).sort().join('|')==='implementationSha256|partialFallback|version'&&g.version==='general_loose_policy_v1'&&g.implementationSha256===GENERAL_SHA&&(g.partialFallback==='off'||g.partialFallback==='partial_reference_fallback_v1'),'unknown general policy');generalLoose=Object.freeze({version:'general_loose_policy_v1',implementationSha256:GENERAL_SHA,partialFallback:g.partialFallback})}
 assert(robinAuto||generalLoose,'empty experimental policy');return Object.freeze({robinAuto,generalLoose});
}
function unwrap(raw:unknown,expected:ExperimentalPoliciesV1):LiveMatchContinuationV116{
 const x=cloneInert(raw);assert(x&&typeof x==='object'&&!Array.isArray(x),'invalid continuation');const r=x as Record<string,unknown>;assert(Object.keys(r).sort().join('|')==='inner|policies|version'&&r.version==='match_experimental_continuation_v1','unsupported continuation version');assert(JSON.stringify(policy(r.policies))===JSON.stringify(expected),'continuation policy differs');assert(r.inner&&typeof r.inner==='object'&&!Array.isArray(r.inner)&&(r.inner as Record<string,unknown>).version==='live_match_continuation_v116','invalid inner continuation');return r.inner as LiveMatchContinuationV116;
}
function freezeDeep<T>(v:T):T{if(v&&typeof v==='object'&&!Object.isFrozen(v)){Object.values(v).forEach(freezeDeep);Object.freeze(v)}return v}
/** Read-only data view. The original continuation must be passed intact to Host/Worker. */
export function readMatchContinuationV1(raw:LiveMatchContinuationV116|ExperimentalContinuationV1){
 const inner=raw.version==='live_match_continuation_v116'?raw:raw.version==='match_experimental_continuation_v1'?unwrap(raw,policy(raw.policies)):(()=>{throw Error('experimental match HOLD: unsupported continuation version')})();
 assert(Number.isSafeInteger(inner.pitchCount)&&inner.pitchCount>=0&&Number.isSafeInteger(inner.nextTick)&&inner.nextTick>=0&&inner.match&&typeof inner.match==='object','invalid continuation view');
 return freezeDeep({version:raw.version,pitchCount:inner.pitchCount,nextTick:inner.nextTick,match:cloneInert(inner.match)});
}
/** Explicit experimental facade; actual new solvers are not connected and remain HOLD. */
export function createExperimentalMatchHostV1(raw:LiveMatchInputV1,rawPolicies:ExperimentalPoliciesV1,resume?:ExperimentalContinuationV1){
 const policies=policy(rawPolicies),clean=cloneInert(raw) as LiveMatchInputV1&{experimentalMatchPoliciesV1?:unknown};delete clean.experimentalMatchPoliciesV1;
 const host=createLiveBaseballMatchWorkerV116(clean,resume===undefined?undefined:unwrap(resume,policies));
 function captureContinuationV116():ExperimentalContinuationV1{return Object.freeze({version:'match_experimental_continuation_v1',policies,inner:host.captureContinuationV116()})}
 function issuePitch(command:ExperimentalCommand){
  const c=cloneInert(command),state=host.inspect();if(policies.generalLoose)throw Error('HOLD: general loose solver not connected to V273');if(c.robinSelection!==undefined)throw Error('HOLD: Robin original solver not connected to V273');
  const defenseManaged=c.managedTeam===1-state.team,automatic=!defenseManaged||(c.pitchType==='auto'&&c.pitchId===undefined);
  if(policies.robinAuto&&state.pitcherPlayerId==='robin'&&automatic){const ordinal=state.pitchCount+1;assert(Number.isSafeInteger(ordinal)&&ordinal>=1&&ordinal<=0xffffffff,'invalid ordinal');const rng=new SeedRoot(clean.seed).streamRng(ordinal-1,'pitch','robin-original-auto-v1'),index=Math.floor(rng.nextFloat()*ORIGINAL_IDS.length);throw Error('HOLD: Robin original solver not connected to V273; selected '+ORIGINAL_IDS[index])}
  return host.issuePitch(c);
 }
 return Object.freeze({issuePitch,inspect:host.inspect,captureContinuationV116});
}
