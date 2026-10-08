import { expect, it } from 'vitest';
import * as terminal from './ActualFoulTerminalApplication';

// Synthetic syntax-only inputs. None of these values is physical, scoring,
// workload, retirement, accepted-input authority, or completed-play evidence.
const source = () => ({ sourceId: 'setup', sourceVersion: 'v1', capability: 'actual_foul_terminal_post_play_setup_v1',
  terminalReference: { owner: 'actual_foul_terminal_applications', sourceId: 'terminal', sourceVersion: 'v1',
    sourceHash: 'a'.repeat(64), proposalHash: 'b'.repeat(64) }, nextStartedAtTick: 100,
  worldSetup: { baseCenters: { first: { x: 1, z: 1 }, second: { x: 0, z: 2 }, third: { x: -1, z: 1 } },
    defenders: ['P','C','1B','2B','3B','SS','LF','CF','RF'].map((registeredPosition, index) => ({
      playerId: 'defender-' + index, registeredPosition, position: { x: index, z: index + 1 } })),
    activePreviousPlayControllerIds: [] as string[] }, controllerReset: 'rule_system_retire_original_play' });
const parser = () => {
  const parse = (terminal as unknown as Record<string, unknown>).actualFoulTerminalPostPlaySetupInput;
  expect(typeof parse, 'TERMINAL_POST_PLAY_SETUP_PARSER_MISSING').toBe('function');
  return parse as (raw: unknown, sourceId: string) => ReturnType<typeof source>;
};
const reject = (mutate: (value: any) => void) => {
  const parse = parser(), value = source(); mutate(value); expect(() => parse(value, 'setup')).toThrow();
};
it('CP-P01 structurally parses and freezes the exact explicit setup without certifying completion', () => {
  const parse = parser(), original = source(), actual = parse(original, 'setup');
  expect(actual).toEqual(original); expect(actual).not.toBe(original);
  expect(Object.isFrozen(actual)).toBe(true); expect(Object.isFrozen(actual.worldSetup.defenders[0].position)).toBe(true);
  original.worldSetup.defenders[0].position.x = 999;
  expect(actual.worldSetup.defenders[0].position.x).toBe(0);
});
it('CP-P02 rejects every missing or additional top-level authority field', () => {
  for (const key of Object.keys(source())) reject(value => { delete value[key]; });
  for (const key of ['receipt','match','score','completed','workload','retired','activation','nextWorld','snapshotHash']) {
    reject(value => { value[key] = true; });
  }
});
it('CP-P03 rejects invalid setup identity version capability and rule-system reset', () => {
  for (const key of ['sourceId','sourceVersion']) for (const value of ['', ' space ', 1, null]) reject(s => { s[key] = value; });
  reject(s => { s.sourceId = 'other'; }); reject(s => { s.capability = 'actual_live_closure'; });
  reject(s => { s.controllerReset = 'already_retired'; });
});
it('CP-P04 enforces exact terminal-reference fields and lowercase SHA256 digests', () => {
  for (const key of Object.keys(source().terminalReference)) reject(s => { delete s.terminalReference[key]; });
  reject(s => { s.terminalReference.extra = true; }); reject(s => { s.terminalReference.owner = 'applications'; });
  for (const key of ['sourceId','sourceVersion']) for (const value of ['', ' invalid ', null]) reject(s => { s.terminalReference[key] = value; });
  for (const key of ['sourceHash','proposalHash']) for (const value of ['A'.repeat(64),'a'.repeat(63),1,null]) {
    reject(s => { s.terminalReference[key] = value; });
  }
});
it('CP-P05 rejects unsafe negative fractional or nonfinite setup ticks', () => {
  for (const value of [-1,0.5,Number.MAX_SAFE_INTEGER + 1,NaN,Infinity,'100',null]) reject(s => { s.nextStartedAtTick = value; });
  expect(parser()({ ...source(), nextStartedAtTick: 0 }, 'setup').nextStartedAtTick).toBe(0);
});
it('CP-P06 rejects malformed exact nested setup and position envelopes', () => {
  for (const key of Object.keys(source().worldSetup)) reject(s => { delete s.worldSetup[key]; });
  reject(s => { s.worldSetup.extra = true; }); reject(s => { s.worldSetup = null; });
  reject(s => { s.worldSetup.baseCenters.home = { x:0,z:0 }; });
  reject(s => { delete s.worldSetup.baseCenters.second; });
  reject(s => { s.worldSetup.baseCenters.first.y = 0; });
  reject(s => { s.worldSetup.defenders[0].position.y = 0; });
  reject(s => { delete s.worldSetup.defenders[0].position.z; });
  reject(s => { s.worldSetup.defenders[0].activeCommand = null; });
  for (const value of [NaN,Infinity,'0',null]) {
    reject(s => { s.worldSetup.baseCenters.first.x = value; });
    reject(s => { s.worldSetup.defenders[0].position.z = value; });
  }
});
it('CP-P07 rejects malformed defender identities roles and array shapes', () => {
  reject(s => { s.worldSetup.defenders = null; }); reject(s => { s.worldSetup.defenders[0] = null; });
  reject(s => { delete s.worldSetup.defenders[0].registeredPosition; });
  for (const value of ['', ' invalid ', null]) reject(s => { s.worldSetup.defenders[0].playerId = value; });
  for (const value of ['DH','pitcher',null,1]) reject(s => { s.worldSetup.defenders[0].registeredPosition = value; });
  reject(s => { delete s.worldSetup.defenders[1]; });
});
it('CP-P08 captures controller-list syntax without treating emptiness as retirement proof', () => {
  const parse = parser(), explicit = source(); explicit.worldSetup.activePreviousPlayControllerIds = ['original-controller'];
  expect(() => parse(explicit,'setup')).toThrow();
  reject(s => { s.worldSetup.activePreviousPlayControllerIds = 'empty'; });
  for (const value of ['', ' invalid ', null, 1]) reject(s => { s.worldSetup.activePreviousPlayControllerIds = [value]; });
  reject(s => { s.worldSetup.activePreviousPlayControllerIds = ['controller','controller']; });
});
it('CP-P09 never invokes caller accessors or accepts non-inert nested data', () => {
  const parse = parser(); let invoked = 0; const value = source();
  Object.defineProperty(value, 'nextStartedAtTick', { enumerable: true, get: () => { invoked++; return 100; } });
  expect(() => parse(value,'setup')).toThrow(/accessor/); expect(invoked).toBe(0);
  reject(s => { s.worldSetup.defenders[0].position = new Date(); });
  reject(s => { s.worldSetup[Symbol('hidden')] = true; });
  reject(s => { s.worldSetup.defenders[0].position.x = () => 0; });
  reject(s => { s.worldSetup.baseCenters.first = s.worldSetup; });
});
it('CP-P10 rejects arrays and scalar substitutes at all structured boundaries', () => {
  const parse = parser();
  for (const raw of [null, [], true, 1, 'setup']) expect(() => parse(raw,'setup')).toThrow();
  for (const key of ['terminalReference','worldSetup']) reject(s => { s[key] = []; });
  reject(s => { s.worldSetup.baseCenters = []; }); reject(s => { s.worldSetup.defenders[0] = []; });
  reject(s => { s.worldSetup.baseCenters.first = []; });
});
