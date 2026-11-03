import { cloneInert } from '../adjudication/OfficialWindowPolicy';
import { DeterministicRng } from './DeterministicRng';
import { SeedRoot, type CorePhase } from './SeedRoot';

export const LIVE_RANDOM_DOMAINS_V152 = Object.freeze(['pitchChoice', 'pitchTarget', 'pitchExecution', 'batterForm', 'batterBelief',
  'batterDirection', 'batterApproach', 'batterPerception', 'batterExecution', 'communication', 'catcherPerception', 'fielding', 'baserunning'] as const);
export type LiveRandomDomainV152 = typeof LIVE_RANDOM_DOMAINS_V152[number];
export type LiveRandomnessV152 = Readonly<{ version:'live_randomness_v152';sourceId:string;scope:'MATCH'|'PLAY';
  overrides?:Readonly<Partial<Record<LiveRandomDomainV152, number>>> }>;
export const AUTHORED_MATCH_RANDOMNESS_V152:LiveRandomnessV152 = Object.freeze({ version:'live_randomness_v152', sourceId:'shared-live-randomness-v152', scope:'MATCH' });
export const AUTHORED_PLAY_RANDOMNESS_V152:LiveRandomnessV152 = Object.freeze({ version:'live_randomness_v152', sourceId:'shared-live-randomness-v152', scope:'PLAY' });
const phases:Readonly<Record<LiveRandomDomainV152, CorePhase>> = Object.freeze({ pitchChoice:'pitch', pitchTarget:'pitch', pitchExecution:'pitch',
  batterForm:'batting', batterBelief:'batting', batterDirection:'batting', batterApproach:'batting', batterPerception:'recognition',
  batterExecution:'batting', communication:'perception', catcherPerception:'recognition', fielding:'fielding', baserunning:'baserunning' });
const uint32 = (value:unknown):value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 0xffffffff;
function assert(condition:unknown, message:string):asserts condition {
  if (!condition) throw Error('live randomness v152: ' + message);
}
/** Own inert Source data, then construct every key in a canonical order so
 * caller property order never changes a configuration binding. */
export function validateLiveRandomnessV152(raw:unknown, expectedScope?:'MATCH'|'PLAY'):LiveRandomnessV152 {
  const p = cloneInert(raw) as LiveRandomnessV152;
  assert(expectedScope === undefined || expectedScope === 'MATCH' || expectedScope === 'PLAY', 'unsupported expected scope');
  assert(p && typeof p === 'object' && !Array.isArray(p) && ['version', 'sourceId', 'scope'].every(key => Object.hasOwn(p, key)) &&
    Object.keys(p).every(key => ['version', 'sourceId', 'scope', 'overrides'].includes(key)) && p.version === 'live_randomness_v152' &&
    typeof p.sourceId === 'string' && p.sourceId.length > 0 && p.sourceId.length <= 200 && p.sourceId.trim() === p.sourceId &&
    (p.scope === 'MATCH' || p.scope === 'PLAY') && (expectedScope === undefined || p.scope === expectedScope), 'invalid policy or scope');
  const base = { version:'live_randomness_v152' as const, sourceId:p.sourceId, scope:p.scope };
  if (!Object.hasOwn(p, 'overrides')) return Object.freeze(base);
  assert(p.overrides && typeof p.overrides === 'object' && !Array.isArray(p.overrides) &&
    Object.keys(p.overrides).every(key => LIVE_RANDOM_DOMAINS_V152.includes(key as LiveRandomDomainV152) &&
      uint32(p.overrides![key as LiveRandomDomainV152])), 'invalid domain override or uint32 seed');
  const overrides:Partial<Record<LiveRandomDomainV152, number>> = {};
  for (const domain of LIVE_RANDOM_DOMAINS_V152) if (Object.hasOwn(p.overrides, domain)) overrides[domain] = p.overrides[domain];
  return Object.freeze({ ...base, overrides:Object.freeze(overrides) });
}

/** Match overrides use the same global pitch ordinal mixing as the Host's
 * ordinary play seed. They do not consume any random cursor. */
export function deriveLivePlayRandomnessV152(matchPolicy:LiveRandomnessV152, pitchOrdinal:number):LiveRandomnessV152 {
  const policy = validateLiveRandomnessV152(matchPolicy, 'MATCH');
  assert(uint32(pitchOrdinal) && pitchOrdinal > 0, 'pitch ordinal must be 1..uint32 max');
  const base = { version:'live_randomness_v152' as const, sourceId:policy.sourceId, scope:'PLAY' as const };
  if (policy.overrides === undefined) return Object.freeze(base);
  const overrides:Partial<Record<LiveRandomDomainV152, number>> = {};
  for (const domain of LIVE_RANDOM_DOMAINS_V152) if (Object.hasOwn(policy.overrides, domain))
    overrides[domain] = (policy.overrides[domain]! + Math.imul(pitchOrdinal, 0x9e3779b9)) >>> 0;
  return Object.freeze({ ...base, overrides:Object.freeze(overrides) });
}

type StreamRandom = Readonly<{ uniform:()=>number;normal:()=>number }>;
type Stream = { domain:LiveRandomDomainV152;key:string;seed:number;drawCount:number;wrapper:StreamRandom|null };

export function createLivePlayRandomStreamsV152(playSeed:number, rawPolicy:LiveRandomnessV152) {
  assert(uint32(playSeed), 'play seed must be uint32');
  const policy = validateLiveRandomnessV152(rawPolicy, 'PLAY'), streams = new Map<string, Stream>();
  function assigned(domain:LiveRandomDomainV152, key:string):Stream {
    assert(LIVE_RANDOM_DOMAINS_V152.includes(domain) && typeof key === 'string' && key.length > 0 && key.trim() === key, 'invalid random domain or key');
    const identity = JSON.stringify([domain, key]), previous = streams.get(identity);
    if (previous) return previous;
    const seed = new SeedRoot(policy.overrides?.[domain] ?? playSeed).streamSeed(0, phases[domain], 'live-random-v152/' + domain + '/' + key),
      stream:Stream = { domain, key, seed, drawCount:0, wrapper:null };
    streams.set(identity, stream);return stream;
  }
  const seedFor = (domain:LiveRandomDomainV152, key:string):number => assigned(domain, key).seed;
  function rng(domain:LiveRandomDomainV152, key:string):StreamRandom {
    const stream = assigned(domain, key);
    if (stream.wrapper === null) {
      const generator = new DeterministicRng(stream.seed), uniform = () => { stream.drawCount++;return generator.nextFloat(); },
        normal = () => Math.max(-3, Math.min(3, Math.sqrt(-2 * Math.log(Math.max(1e-12, uniform()))) * Math.cos(2 * Math.PI * uniform())));
      stream.wrapper = Object.freeze({ uniform, normal });
    }
    return stream.wrapper;
  }
  /** drawCount measures only this wrapper's uniform draws (two per normal).
   * A seed delegated to another API reports zero until this wrapper is used;
   * the delegated API's private consumption is not measured here. */
  function captureTrace() {
    const allocated = [...streams.values()].sort((one, two) => one.domain < two.domain ? -1 : one.domain > two.domain ? 1 :
      one.key < two.key ? -1 : one.key > two.key ? 1 : 0).map(stream => Object.freeze({
      domain:stream.domain, key:stream.key, seed:stream.seed, drawCount:stream.drawCount }));
    return Object.freeze({ version:'live_random_trace_v152' as const, sourceId:policy.sourceId, seedScope:'PLAY' as const,
      baseSeed:playSeed, policy, streams:Object.freeze(allocated) });
  }
  return Object.freeze({ seedFor, rng, captureTrace });
}
