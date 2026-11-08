import { expect, it } from 'vitest';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { validateLiveSwingEnvelopeV133 } from '../../src/integration/browser/LiveSwingEnvelopeV133.ts';
import { validateSwingExecutionV122 } from '../../src/integration/browser/LiveSwingExecutionV122.ts';

const source = readFileSync('docs/demos/baseball-maker-swing-execution-v122.js', 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const limits = { version: 'swing_execution_v122', sourceId: 'author-limits', interpolation: 'cubic-c1', maximumGripAccelerationMps2: 100,
  maximumAngularAccelerationRadPerSecond2: 200, maximumSweetSpotAccelerationMps2: 300, maximumCorrectionMeters: .1 };
const envelope = { version: 'reference_bat_envelope_v133', sourceId: 'author-pose-times',
  preparation: { durationSeconds: .2, grip: { x: .1, y: .8, z: -.2 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
  recovery: { durationSeconds: .3, grip: { x: .3, y: 1, z: .2 }, orientation: { x: 0, y: 0, z: 0, w: 1 } } };
function fixture(physical = { swingExecutionV122: limits }) {
  let roster = { entries: [{ playerId: 'b', physical: copy(physical) }] }, commits = 0;
  const nodes = new Map(), specs = [
    ['maximumGripAccelerationMps2', 'grip'], ['maximumAngularAccelerationRadPerSecond2', 'angular'],
    ['maximumSweetSpotAccelerationMps2', 'sweet'], ['maximumCorrectionMeters', 'correction'],
  ];
  for (const id of ['live-roster-player', 'swing-execution-enabled-v122', 'batter-approach-json-v122', 'swing-envelope-json-v133',
    'swing-execution-undo-v122', 'swing-execution-status-v122', 'swing-execution-apply-v122', 'swing-execution-reset-v122', 'swing-execution-revert-v122',
    ...specs.map(([key]) => 'swing-execution-' + key + '-v122')]) {
    let value = '';
    const node = { checked: false, hidden: false, disabled: false, textContent: '', checkValidity: () => true, classList: { toggle() {} } };
    Object.defineProperty(node, 'value', { enumerable: true, get: () => value, set: next => { value = String(next); } });
    nodes.set(id, node);
  }
  nodes.get('live-roster-player').value = 'b';
  const listeners = {}, root = {}, context = vm.createContext({ root, specs, drafts: new Map(), envelopeSupported: true,
    $: id => nodes.get(id), clone: copy, panel: { addEventListener(type, handler) { listeners[type] = handler; } },
    maker: { getLiveRoster: () => copy(roster), commitLiveRosterEditV86: next => { roster = copy(next); commits++; } },
    // JSON is the browser authoring boundary; validators still run for real.
    core: { validateSwingExecutionV122: raw => validateSwingExecutionV122(copy(raw)),
      validateLiveSwingEnvelopeV133: (raw, execution) => validateLiveSwingEnvelopeV133(copy(raw), execution === undefined ? undefined : copy(execution)),
      validateBatterApproachV122: () => { throw Error('not used by this isolated envelope test'); } } });
  const start = source.indexOf(' const id=()=>$'), end = source.indexOf(" document.addEventListener('kneekura:maker-roster-change'", start);
  const api = source.indexOf(' root.KneekuraSwingExecutionMakerV122='), close = source.lastIndexOf('})(globalThis);');
  expect(start).toBeGreaterThan(-1); expect(end).toBeGreaterThan(start); expect(api).toBeGreaterThan(end);
  vm.runInContext(source.slice(start, end) + source.slice(api, close), context);
  return { nodes, api: root.KneekuraSwingExecutionMakerV122, apply: () => vm.runInContext('apply()', context),
    input: () => listeners.input(), physical: () => copy(roster.entries[0].physical), commits: () => commits,
    replacePhysical: p => { roster.entries[0].physical = copy(p); } };
}

it('keeps the optional JSON empty for legacy data and never materializes a boundary pose or duration', () => {
  const f = fixture();
  expect(f.nodes.get('swing-envelope-json-v133').value).toBe('');
  f.apply();
  expect(f.physical()).not.toHaveProperty('swingEnvelopeV133');
  expect(f.physical().swingExecutionV122).toEqual(limits);
});
it('applies and JSON-roundtrips explicit Source, clears it independently, and restores the previous Source with undo', () => {
  const f = fixture(); f.nodes.get('swing-envelope-json-v133').value = JSON.stringify(envelope); f.apply();
  expect(f.physical().swingEnvelopeV133).toEqual(envelope);
  expect(f.nodes.get('swing-envelope-json-v133').value).toBe(JSON.stringify(envelope, null, 2));
  f.nodes.get('swing-envelope-json-v133').value = ''; f.apply();
  expect(f.physical()).not.toHaveProperty('swingEnvelopeV133');
  expect(f.physical().swingExecutionV122).toEqual(limits);
  f.nodes.get('swing-execution-undo-v122').onclick();
  expect(f.physical().swingEnvelopeV133).toEqual(envelope);
});
it('retains unsaved JSON as a draft, blocks export until cancelled, and does not mutate the saved roster', () => {
  const f = fixture({ swingExecutionV122: limits, swingEnvelopeV133: envelope }), before = f.physical();
  f.nodes.get('swing-envelope-json-v133').value = '{'; f.input();
  expect(() => f.api.assertNoPending()).toThrow(/未適用/);
  expect(f.physical()).toEqual(before); expect(f.commits()).toBe(0);
  f.nodes.get('swing-execution-revert-v122').onclick();
  expect(() => f.api.assertNoPending()).not.toThrow();
  expect(f.nodes.get('swing-envelope-json-v133').value).toBe(JSON.stringify(envelope, null, 2));
});
it('rejects malformed/uncalibrated JSON without committing, and reset/import returns to a sparse legacy author state', () => {
  const f = fixture(), before = f.physical();
  f.nodes.get('swing-envelope-json-v133').value = '{'; expect(() => f.apply()).toThrow();
  expect(f.physical()).toEqual(before); expect(f.commits()).toBe(0);
  f.nodes.get('swing-envelope-json-v133').value = JSON.stringify(envelope);
  f.nodes.get('swing-execution-enabled-v122').checked = false;
  expect(() => f.apply()).toThrow(/C1|上限/); expect(f.physical()).toEqual(before);
  f.nodes.get('swing-execution-enabled-v122').checked = true; f.apply();
  f.api.reset(); expect(f.physical()).not.toHaveProperty('swingEnvelopeV133');
  f.replacePhysical({}); f.api.refresh();
  expect(f.nodes.get('swing-envelope-json-v133').value).toBe('');
  expect(f.nodes.get('swing-execution-enabled-v122').checked).toBe(false);
});
it.each([
  ['{', /準備・回復.*JSON.*構文/],
  [JSON.stringify({ ...envelope, sourceId: '' }), /準備・回復.*sourceId/],
  [JSON.stringify({ ...envelope, preparation: { ...envelope.preparation, durationSeconds: 0 } }), /準備・回復.*durationSeconds.*0.*10/],
])('reports a Japanese correction location for the optional envelope input: %s', (json, message) => {
  const f = fixture(), before = f.physical();
  f.nodes.get('swing-envelope-json-v133').value = json;
  expect(() => f.apply()).toThrow(message);
  expect(f.physical()).toEqual(before); expect(f.commits()).toBe(0);
});
