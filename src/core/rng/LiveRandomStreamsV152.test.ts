import { expect, it } from 'vitest';
import { DeterministicRng } from './DeterministicRng';
import { SeedRoot, type CorePhase } from './SeedRoot';
import { AUTHORED_MATCH_RANDOMNESS_V152, AUTHORED_PLAY_RANDOMNESS_V152, LIVE_RANDOM_DOMAINS_V152,
  createLivePlayRandomStreamsV152, deriveLivePlayRandomnessV152, validateLiveRandomnessV152,
  type LiveRandomDomainV152 } from './LiveRandomStreamsV152';

it('provides frozen explicit authored MATCH and PLAY policies without inferred overrides', () => {
  expect(AUTHORED_MATCH_RANDOMNESS_V152).toEqual({ version:'live_randomness_v152', sourceId:'shared-live-randomness-v152', scope:'MATCH' });
  expect(AUTHORED_PLAY_RANDOMNESS_V152).toEqual({ version:'live_randomness_v152', sourceId:'shared-live-randomness-v152', scope:'PLAY' });
  expect(Object.isFrozen(AUTHORED_MATCH_RANDOMNESS_V152)).toBe(true);
  expect(Object.isFrozen(AUTHORED_PLAY_RANDOMNESS_V152)).toBe(true);
  expect(Object.isFrozen(LIVE_RANDOM_DOMAINS_V152)).toBe(true);
});

it('canonicalizes every policy key independently of input order and privately freezes its copy', () => {
  const input = { scope:'PLAY' as const, overrides:{ baserunning:4294967295, pitchChoice:0, batterExecution:123 },
    sourceId:'policy-test', version:'live_randomness_v152' as const }, before = JSON.stringify(input),
    first = validateLiveRandomnessV152(input), second = validateLiveRandomnessV152({ version:'live_randomness_v152',
      sourceId:'policy-test', overrides:{ batterExecution:123, pitchChoice:0, baserunning:4294967295 }, scope:'PLAY' });
  expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  expect(Object.keys(first)).toEqual(['version', 'sourceId', 'scope', 'overrides']);
  expect(Object.keys(first.overrides!)).toEqual(['pitchChoice', 'batterExecution', 'baserunning']);
  expect(JSON.stringify(input)).toBe(before);
  expect(Object.isFrozen(input.overrides)).toBe(false);
  input.overrides.pitchChoice = 55;
  expect(first.overrides!.pitchChoice).toBe(0);
  expect(Object.isFrozen(first.overrides)).toBe(true);
  expect(Object.hasOwn(validateLiveRandomnessV152(AUTHORED_PLAY_RANDOMNESS_V152), 'overrides')).toBe(false);
  expect(validateLiveRandomnessV152({ ...AUTHORED_PLAY_RANDOMNESS_V152, overrides:{} }).overrides).toEqual({});
});

it('rejects unsupported scopes, unknown/private fields, non-uint32 seeds and accessors without reading them', () => {
  const valid = AUTHORED_PLAY_RANDOMNESS_V152;
  for (const raw of [{ ...valid, version:'other' }, { ...valid, scope:'GAME' }, { ...valid, sourceId:'' },
    { ...valid, sourceId:' padded ' }, { ...valid, privatePitchCall:'curve' }, { ...valid, seed:1 },
    { ...valid, overrides:{ unknownDomain:1 } }, { ...valid, overrides:[] },
    ...[-1, 4294967296, 1.5, NaN, Infinity, '3'].map(seed => ({ ...valid, overrides:{ pitchExecution:seed } }))]) {
    expect(() => validateLiveRandomnessV152(raw)).toThrow();
  }
  expect(() => validateLiveRandomnessV152(valid, 'MATCH')).toThrow();
  expect(() => validateLiveRandomnessV152(valid, 'OTHER' as 'PLAY')).toThrow();
  let reads = 0;
  const accessor = { ...valid };
  Object.defineProperty(accessor, 'scope', { enumerable:true, get(){ reads++;return 'PLAY'; } });
  expect(() => validateLiveRandomnessV152(accessor)).toThrow();
  expect(reads).toBe(0);
  for (const seed of [-1, 4294967296, .5, Infinity]) expect(() => createLivePlayRandomStreamsV152(seed, valid)).toThrow();
  expect(() => createLivePlayRandomStreamsV152(0, AUTHORED_MATCH_RANDOMNESS_V152)).toThrow();
  expect(createLivePlayRandomStreamsV152(0, valid).seedFor('pitchChoice', 'zero')).toBeGreaterThanOrEqual(0);
  expect(createLivePlayRandomStreamsV152(4294967295, valid).seedFor('pitchChoice', 'max')).toBeLessThanOrEqual(4294967295);
});

it('derives MATCH override seeds by the ordinary global pitch ordinal while preserving the original', () => {
  const match = { ...AUTHORED_MATCH_RANDOMNESS_V152, overrides:{ pitchTarget:11, batterExecution:4294967295 } },
    before = JSON.stringify(match), first = deriveLivePlayRandomnessV152(match, 1), second = deriveLivePlayRandomnessV152(match, 2);
  expect(first).toEqual({ ...AUTHORED_PLAY_RANDOMNESS_V152, overrides:{ pitchTarget:2654435780, batterExecution:2654435768 } });
  expect(second.overrides).toEqual({ pitchTarget:1013904253, batterExecution:1013904241 });
  expect(deriveLivePlayRandomnessV152(match, 1)).toEqual(first);
  expect(deriveLivePlayRandomnessV152(match, 4294967295).overrides).toEqual({ pitchTarget:1640531538, batterExecution:1640531526 });
  const unordered = [7, 2, 5, 1].map(ordinal => [ordinal, deriveLivePlayRandomnessV152(match, ordinal)] as const),
    ordered = [1, 2, 5, 7].map(ordinal => [ordinal, deriveLivePlayRandomnessV152(match, ordinal)] as const);
  expect(new Map(unordered)).toEqual(new Map(ordered));
  expect(JSON.stringify(match)).toBe(before);
  expect(Object.isFrozen(first.overrides)).toBe(true);
  expect(Object.hasOwn(deriveLivePlayRandomnessV152(AUTHORED_MATCH_RANDOMNESS_V152, 1), 'overrides')).toBe(false);
  for (const ordinal of [0, -1, 1.1, 4294967296]) expect(() => deriveLivePlayRandomnessV152(match, ordinal)).toThrow();
  expect(() => deriveLivePlayRandomnessV152(AUTHORED_PLAY_RANDOMNESS_V152, 1)).toThrow();
});

const phases:readonly (readonly [LiveRandomDomainV152, CorePhase])[] = [
  ['pitchChoice', 'pitch'], ['pitchTarget', 'pitch'], ['pitchExecution', 'pitch'], ['batterForm', 'batting'], ['batterBelief', 'batting'],
  ['batterDirection', 'batting'], ['batterApproach', 'batting'], ['batterPerception', 'recognition'], ['batterExecution', 'batting'],
  ['communication', 'perception'], ['catcherPerception', 'recognition'], ['fielding', 'fielding'], ['baserunning', 'baserunning'],
];
it('uses each declared SeedRoot phase and domain/key namespace without consuming a draw', () => {
  const streams = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152), seeds:number[] = [];
  for (const [domain, phase] of phases) {
    const seed = streams.seedFor(domain, 'player/ball');seeds.push(seed);
    expect(seed).toBe(new SeedRoot(123).streamSeed(0, phase, 'live-random-v152/' + domain + '/player/ball'));
  }
  expect(new Set(seeds).size).toBe(13);
  expect(streams.captureTrace().streams.every(stream => stream.drawCount === 0)).toBe(true);
  expect(() => streams.seedFor('unknown' as LiveRandomDomainV152, 'player')).toThrow();
  expect(() => streams.rng('pitchChoice', '')).toThrow();
});

it('shares a domain/key cursor while unrelated keys and domains stay unchanged after heavy consumption', () => {
  const actual = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152), reference = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152),
    kept = actual.rng('batterExecution', 'batter-1'), seed = actual.seedFor('batterExecution', 'batter-1');
  expect(actual.rng('batterExecution', 'batter-1')).toBe(kept);
  expect(kept.uniform()).toBe(reference.rng('batterExecution', 'batter-1').uniform());
  for (let index = 0; index < 2000; index++) {
    actual.rng('pitchExecution', 'pitcher-1').normal();actual.rng('batterExecution', 'batter-2').uniform();
  }
  expect(kept.uniform()).toBe(reference.rng('batterExecution', 'batter-1').uniform());
  expect(actual.seedFor('batterExecution', 'batter-1')).toBe(seed);
  for (const domain of LIVE_RANDOM_DOMAINS_V152) if (domain !== 'pitchExecution')
    expect(actual.rng(domain, 'untouched').uniform()).toBe(reference.rng(domain, 'untouched').uniform());
});

it('changes only the overridden domain including a zero override seed', () => {
  const original = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152),
    changed = createLivePlayRandomStreamsV152(123, { ...AUTHORED_PLAY_RANDOMNESS_V152, overrides:{ batterDirection:0 } });
  for (const domain of LIVE_RANDOM_DOMAINS_V152) {
    if (domain === 'batterDirection') {
      expect(changed.seedFor(domain, 'batter')).toBe(new SeedRoot(0).streamSeed(0, 'batting', 'live-random-v152/batterDirection/batter'));
      expect(changed.seedFor(domain, 'batter')).not.toBe(original.seedFor(domain, 'batter'));
    } else expect(changed.rng(domain, 'same').uniform()).toBe(original.rng(domain, 'same').uniform());
  }
});

it('reproduces the clamped two-uniform Box-Muller policy without a spare-sample cursor', () => {
  const streams = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152), random = streams.rng('batterExecution', 'normal'),
    reference = new DeterministicRng(new SeedRoot(123).streamSeed(0, 'batting', 'live-random-v152/batterExecution/normal')),
    expectedNormal = () => Math.max(-3, Math.min(3, Math.sqrt(-2 * Math.log(Math.max(1e-12, reference.nextFloat()))) * Math.cos(2 * Math.PI * reference.nextFloat())));
  expect(random.uniform()).toBe(reference.nextFloat());
  expect(random.normal()).toBe(expectedNormal());expect(random.normal()).toBe(expectedNormal());
  expect(random.uniform()).toBe(reference.nextFloat());
  expect(streams.captureTrace().streams[0].drawCount).toBe(6);
  const replay = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152).rng('batterExecution', 'range'),
    repeated = createLivePlayRandomStreamsV152(123, AUTHORED_PLAY_RANDOMNESS_V152).rng('batterExecution', 'range');
  const values = Array.from({ length:1000 }, () => replay.normal());
  expect(values).toEqual(Array.from({ length:1000 }, () => repeated.normal()));
  expect(values.every(value => value >= -3 && value <= 3)).toBe(true);
});

it('captures pure frozen stable-order stream traces and counts only wrapper uniform draws', () => {
  const first = createLivePlayRandomStreamsV152(321, AUTHORED_PLAY_RANDOMNESS_V152), second = createLivePlayRandomStreamsV152(321, AUTHORED_PLAY_RANDOMNESS_V152);
  first.seedFor('fielding', 'delegated');first.rng('pitchTarget', 'z').normal();first.rng('pitchTarget', 'a').uniform();
  second.rng('pitchTarget', 'a').uniform();second.rng('pitchTarget', 'z').normal();second.seedFor('fielding', 'delegated');
  const trace = first.captureTrace();
  expect(trace).toEqual(second.captureTrace());
  expect(trace).toMatchObject({ version:'live_random_trace_v152', sourceId:'shared-live-randomness-v152', seedScope:'PLAY', baseSeed:321,
    policy:AUTHORED_PLAY_RANDOMNESS_V152 });
  expect(trace.streams.map(stream => [stream.domain, stream.key, stream.drawCount])).toEqual([
    ['fielding', 'delegated', 0], ['pitchTarget', 'a', 1], ['pitchTarget', 'z', 2] ]);
  expect(JSON.parse(JSON.stringify(trace))).toEqual(trace);
  expect(Object.isFrozen(trace)).toBe(true);expect(Object.isFrozen(trace.streams)).toBe(true);
  expect(Object.isFrozen(trace.streams[0])).toBe(true);expect(Object.isFrozen(trace.policy)).toBe(true);
  first.rng('pitchTarget', 'z').uniform();
  expect(trace.streams[2].drawCount).toBe(2);
  expect(first.captureTrace().streams[2].drawCount).toBe(3);
});
