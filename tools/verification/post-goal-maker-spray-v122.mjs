// Read-only product diagnosis. Run only after the parent releases the Native
// workload slot. This never builds, opens SQLite/DOM, changes a seed or retries.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';

const repo = fileURLToPath(new URL('../../', import.meta.url));
const args = process.argv.slice(2);
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  if (!['--mode', '--output', '--roster-json'].includes(args[i]) || !args[i + 1] || options.has(args[i])) throw Error('invalid or duplicate diagnostic option');
  options.set(args[i], args[i + 1]);
}
const mode = options.get('--mode');
if (!['initial', 'user-roster'].includes(mode) || !options.get('--output')
  || (mode === 'user-roster') !== options.has('--roster-json')) {
  throw Error('requires --mode initial|user-roster --output <new directory>; user-roster also requires --roster-json <private packet>');
}
const output = resolve(repo, options.get('--output'));
const expectedUserPacketSha256 = 'e0123a572d66bf6bd5fa92af6c9ffbe6fe47fbcf27d00135c9441bf95927b3ce';
const release = resolve(repo, '../../outputs/_candidate_v122_20261026_02');
const makerName = 'にーくら野球メーカー_v122_連続スイングと状況実行版.html';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = name => readFileSync(resolve(repo, name));
const json = name => JSON.parse(read(name).toString('utf8'));
const fail = (condition, message) => { if (!condition) throw Error(message); };

// Refuse replacement files: these diagnostics belong to the preserved V122
// release, not today's dirty Source tree or an accidentally rebuilt bundle.
const integrity = json('docs/verification/swing-remainder-v122/integrity.json');
const sourceManifest = JSON.parse(readFileSync(resolve(release, 'build-sources-v122.json'), 'utf8'));
const makerBytes = readFileSync(resolve(release, makerName)), html = makerBytes.toString('utf8');
const artifact = integrity.artifacts.find(a => a.path.endsWith(makerName));
fail(artifact && hash(makerBytes) === artifact.sha256, 'preserved V122 Maker artifact hash differs');
const marker = html.indexOf('var KneekuraBaseballWorkbench =');
fail(marker >= 0, 'V122 Workbench IIFE marker missing');
const scriptOpen = html.lastIndexOf('<script', marker), bodyStart = html.indexOf('>', scriptOpen) + 1;
const bodyEnd = html.indexOf('</script>', marker);
fail(scriptOpen >= 0 && bodyStart > scriptOpen && bodyEnd > marker, 'V122 Workbench script boundary missing');
const body = html.slice(bodyStart, bodyEnd);
const candidates = [body, body.slice(1, -1), body.trim(), body.trim() + '\n'];
const core = candidates.find(value => hash(value) === sourceManifest.makerBundle.entrySha256);
fail(core, 'Workbench IIFE bytes do not match frozen V122 makerBundle.entrySha256');

const inputs = {};
for (const path of ['docs/demos/live-game-roster-v98.json', 'docs/demos/live-game-roster-catalog-v105.json',
  'docs/demos/measured-bat-library-v1.json', 'docs/demos/baseball-maker-ball-comparison-v69.js',
  'tools/browser-bridge/measured-bat-library-v1.js']) {
  const bytes = read(path);
  fail(hash(bytes) === sourceManifest.inputs[path], 'preserved V122 input hash differs: ' + path);
  inputs[path] = { sha256: hash(bytes), bytes: bytes.length };
}
let roster = json('docs/demos/live-game-roster-v98.json'), userPacket = null;
const catalog = json('docs/demos/live-game-roster-catalog-v105.json');
if (mode === 'user-roster') {
  const bytes = readFileSync(resolve(options.get('--roster-json')));
  fail(hash(bytes) === expectedUserPacketSha256 && bytes.length === 59857, 'provided private Maker packet hash or size differs');
  const packet = JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/, ''));
  fail(packet.livePhysicalRoster && Array.isArray(packet.livePhysicalRoster.entries), 'provided packet livePhysicalRoster missing');
  // Comparison UI reads only this roster. Do not merge top.player, reference,
  // scenario, population or preview state into Nichiro's comparison controls.
  roster = packet.livePhysicalRoster;
  userPacket = { sha256: hash(bytes), bytes: bytes.length, adoptedTopPaths: ['livePhysicalRoster'],
    ignoredTopPaths: ['player', 'population', 'scenario', 'reference', 'previewDisplay'] };
}
const library = json('docs/demos/measured-bat-library-v1.json');
const identity = catalog.players.find(p => p.playerId === '1-b0');
const entry = roster.entries.find(p => p.playerId === '1-b0');
fail(identity && entry?.physical, 'selected roster Nichiro entry missing');
const rawClip = entry.physical.clipId ? library.clips.find(c => c.id === entry.physical.clipId)
  : library.clips.find(c => c.side === identity.bats && c.defaultSelection !== false);
fail(rawClip && rawClip.side === identity.bats, 'saved clip is missing from frozen library or has a different batting side');
// The checked compact library stores rows, not decoded frames. Project only
// the three fields used by the existing comparison UI, using the frozen
// decoder's exact column positions. Do not decode/execute every other clip.
fail(JSON.stringify(library.columns.slice(0, 11)) === JSON.stringify(['tick', 'gripX', 'gripY', 'gripZ',
  'tipX', 'tipY', 'tipZ', 'qw', 'qx', 'qy', 'qz']), 'frozen measured row layout differs');
const { rows, ...clipMetadata } = rawClip;
const clip = { ...clipMetadata, frames: rows.map(row => ({ tick: row[0],
  grip: { x: row[1], y: row[2], z: row[3] }, orientation: { w: row[7], x: row[8], y: row[9], z: row[10] } })) };
fail(identity.name === 'ニッチロー' && identity.bats === 'L'
  && clip.id === (mode === 'initial' ? 'obp-51_3' : 'obp-23_5'), 'selected V122 diagnosis mode or saved clip differs');
const flags = {
  independentTraits: html.includes('globalThis.KneekuraIndependentTraitsV77=true;'),
  technicalTraits: html.includes('globalThis.KneekuraTechnicalTraitsV75=true;'),
  wholeArc: html.includes('globalThis.KneekuraWholeArcTrajectoryEnabled=true;'),
};
mkdirSync(output); // New directory only: never overwrite prior diagnostics.
const save = (name, value) => writeFileSync(resolve(output, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const metadata = { kind: 'POST_GOAL_V122_MAKER_SPRAY_DIAGNOSTIC', inputMode: mode, userEditedInputAvailable: true,
  rosterSource: mode === 'initial' ? 'PRESERVED_V122_DISTRIBUTION_ROSTER' : 'USER_PACKET_LIVE_PHYSICAL_ROSTER_ONLY',
  userRosterAdopted: mode === 'user-roster', userPacket, availableUserPacketSha256: expectedUserPacketSha256,
  nativeAdmission: false, officialResult: null, productSourceChanged: false, startedAt: new Date().toISOString(),
  artifact: { name: makerName, sha256: hash(makerBytes) }, workbenchIifeSha256: hash(core), inputs, flags,
  seed: 20261019, batterId: '1-b0', pitcherId: '0-p0', catcherId: '0-b3', clipId: clip.id,
  measuredClipSourceSha256: clip.source.sha256, measuredClipRowsSha256: clip.source.sourceRowsSha256,
  seedAssumption: { source: 'COMPARISON_UI_DEFAULT_NOT_SAVED_IN_USER_PACKET', actualUserComparisonSeedKnown: false,
    topScenarioSeedAdopted: false }, pitchType: 'fastball', locations: ['zone', 'inside'],
  comparisonControlAssumptions: ['UI_DEFAULT_PITCHER_0-p0', 'UI_DEFAULT_FASTBALL', 'UI_DEFAULT_AUTO_BATTING', 'UI_DEFAULT_FORCE_SWING_TRUE'],
  locationMeaning: { zone: 'STRIKE_ZONE_TARGET_WITH_COMMAND_VARIATION_NOT_EXACT_CENTER', inside: 'HANDED_INSIDE_TARGET_WITH_COMMAND_VARIATION' },
  comparisonScope: 'SAME_PITCH_WITHIN_EACH_FOUR_LEVEL_GROUP; DO_NOT_ASSUME_SAME_PITCH_BETWEEN_MODES_OR_COURSE_GROUPS',
  diagnosticVmEnvironment: { structuredClone: 'HOST_NATIVE_CLONE_THEN_ORDINARY_GRAPH_REALM_REHOME',
    specialClonedObjects: 'REJECTED', browserCompatibilityClaim: false, preflightBeforeCoreAndSimulation: true },
  maximumPitchExecutions: 8, maximumExecutionsIfBothModesAreRunExplicitly: 16,
  seedSearch: false, automaticRetry: false, iifeTimeoutMs: 5000, perComparisonTimeoutMs: 20000 };
save('metadata.json', metadata);

const realm = vm.createContext({ console, TextEncoder, TextDecoder, performance });
try {
  const realmPrototypes = vm.runInContext('({ object: Object.prototype, array: Array.prototype })', realm, { timeout: 1000 });
  const nativeStructuredClone = globalThis.structuredClone;
  fail(typeof nativeStructuredClone === 'function', 'diagnostic host requires the real structuredClone');
  realm.structuredClone = (...args) => {
    // Native cloning happens first, with the original argument count/options
    // and native errors. Rehome only its detached ordinary graph; JSON is not
    // a substitute for undefined, -0, aliases, cycles or native clone errors.
    const cloned = Reflect.apply(nativeStructuredClone, globalThis, args), seen = new WeakSet();
    const rehome = value => {
      if (value === null || typeof value !== 'object' || seen.has(value)) return;
      const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
      if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('diagnostic structuredClone bridge supports ordinary object/array graphs only');
      }
      seen.add(value);
      Object.setPrototypeOf(value, array ? realmPrototypes.array : realmPrototypes.object);
      for (const key of Reflect.ownKeys(value)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        if (!descriptor || !('value' in descriptor)) throw new TypeError('unexpected accessor in native structuredClone output');
        rehome(descriptor.value);
      }
    };
    rehome(cloned);
    return cloned;
  };
  realm.nativeStructuredCloneControl = (...args) => Reflect.apply(nativeStructuredClone, globalThis, args);
  const vmPreflight = JSON.parse(vm.runInContext(String.raw`
    (() => {
      const leaf = { value: 3 }, input = { missing: undefined, negativeZero: -0, leaf, array: [leaf, undefined] };
      input.self = input;
      const copy = structuredClone(input), control = nativeStructuredCloneControl(input);
      const failure = clone => { try { clone(() => 1); return null; } catch (error) { return { name: error.name, message: error.message }; } };
      const nativeError = failure(nativeStructuredCloneControl), bridgeError = failure(structuredClone);
      let specialRejected = false;
      try { structuredClone(new Date(0)); } catch (error) { specialRejected = error.name === 'TypeError' && error.message.includes('ordinary object/array'); }
      const checks = {
        callable: typeof structuredClone === 'function',
        ordinaryPrototype: Object.getPrototypeOf(copy) === Object.prototype && Object.getPrototypeOf(copy.leaf) === Object.prototype,
        arrayPrototype: Array.isArray(copy.array) && Object.getPrototypeOf(copy.array) === Array.prototype,
        detachedIdentity: copy !== input && copy.leaf !== leaf,
        equalityWithNative: copy.leaf.value === control.leaf.value && copy.array.length === control.array.length,
        undefinedPreserved: Object.hasOwn(copy, 'missing') && copy.missing === undefined && Object.hasOwn(copy.array, '1') && copy.array[1] === undefined,
        negativeZeroPreserved: Object.is(copy.negativeZero, -0) && Object.is(copy.negativeZero, control.negativeZero),
        aliasPreserved: copy.leaf === copy.array[0] && control.leaf === control.array[0],
        cyclePreserved: copy.self === copy && control.self === control,
        nativeFunctionErrorPreserved: nativeError !== null && bridgeError !== null && nativeError.name === bridgeError.name && nativeError.message === bridgeError.message,
        unsupportedSpecialRejected: specialRejected,
      };
      if (Object.values(checks).some(value => value !== true)) throw Error('diagnostic VM structuredClone preflight differs: ' + JSON.stringify(checks));
      return JSON.stringify({ status: 'VM_PREFLIGHT_PASSED', checks, nativeFunctionError: nativeError,
        scope: 'ORDINARY_INERT_GRAPH_DIAGNOSTIC_ONLY_NOT_GENERAL_BROWSER_COMPATIBILITY' });
    })()
  `, realm, { timeout: 1000, filename: 'diagnostic-vm-preflight.js' }));
  save('vm-preflight.json', vmPreflight);
  delete realm.nativeStructuredCloneControl;
  vm.runInContext(core, realm, { timeout: 5000, filename: 'preserved-v122-workbench-iife.js' });
  // Parse inside the bundle's realm, preserving cloneInert's plain-object rule.
  realm.payloadText = JSON.stringify({ roster, catalog, clip, flags });
  vm.runInContext(String.raw`
    const data = JSON.parse(payloadText), C = KneekuraBaseballWorkbench;
    const clone = value => JSON.parse(JSON.stringify(value));
    const assert = (condition, message) => { if (!condition) throw Error(message); };
    function buildInput(location) {
      const players = C.applyLivePhysicalRosterV1({ players: data.catalog.players, roster: data.roster }).players;
      const batter = players.find(p => p.playerId === '1-b0'), pitcher = players.find(p => p.playerId === '0-p0'),
        catcher = players.find(p => p.playerId === '0-b3');
      const physical = p => data.flags.independentTraits ? C.resolveLiveExecutionPhysicalV77(p.physical, p.traitProfile) : p.physical;
      const bp = physical(batter), pp = physical(pitcher), cp = physical(catcher);
      assert(!bp.clipId || bp.clipId === data.clip.id, 'projected initial clip changed');
      const preferences = C.resolveLiveTraitPreferencesV54(batter.traitProfile), pitchPreferences = C.resolveLiveTraitPreferencesV54(pitcher.traitProfile);
      const b = { ...bp, clipId: data.clip.id, heightMeters: batter.heightMeters, bats: batter.bats,
        impactTrajectory: clone(bp.impactTrajectory ?? (data.flags.wholeArc ? C.DEFAULT_WHOLE_ARC_TRAJECTORY_V1
          : { level: 2, angleDegreesByLevel: [-10, 0, 10, 20], beforeSeconds: .1, afterSeconds: .06 })) };
      const technique = p => data.flags.technicalTraits ? C.resolveLiveTechnicalTraitsV75(p.traitProfile) : undefined;
      const bt = technique(batter), pt = technique(pitcher);
      if (bt) b.technicalSkills = clone(bt);
      b.swingDecision = { ...(b.swingDecision ?? { threshold: .5, aggressionWeight: .5 }), approach: 'SWING' };
      const clip = data.clip;
      return { originTick: 1000000, seed: 20261019, batter: b,
        pitcher: { ...pp, ...(pt ? { technicalSkills: clone(pt) } : {}), heightMeters: pitcher.heightMeters,
          moundPosition: clone(C.LIVE_MATCH_MOUND_SURFACE_V1), ...(pitcher.throws === undefined ? {} : { throws: pitcher.throws }),
          pitchApproach: pitchPreferences.pitchApproach },
        catcher: { gloveSpeedMps: cp.gloveSpeedMps, gloveReachMeters: cp.gloveReachMeters, gloveRadiusMeters: cp.gloveRadiusMeters,
          retentionCapacityJ: cp.retentionCapacityJ, captureDissipationPowerW: cp.captureDissipationPowerW, pocketRadiusMeters: .14 },
        measuredClips: [{ id: clip.id, side: clip.side, source: { sha256: clip.source.sha256, repository: clip.source.repository },
          contactTimeSeconds: clip.contactTimeSeconds, normalization: clone(clip.normalization),
          frames: clip.frames.map(f => ({ tick: f.tick, grip: clone(f.grip), orientation: clone(f.orientation) })), defaultSelection: clip.defaultSelection }],
        batting: { POWER: 'power', CONTACT: 'contact', BALANCED: 'balanced' }[preferences.swingMode],
        pitchType: 'fastball', location, physics: clone(C.LIVE_MATCH_PHYSICS_V1) };
    }
    function motorAt(pitch, tick) {
      const d = pitch.diagnostics.batPlaybackV88;
      if (!d) return { available: false, reason: 'NO_REFERENCE_PLAYBACK_RECIPE' };
      const registration = pitch.diagnostics.measuredBatCoordinateRegistration;
      assert(registration.storedPositionToField === '(-x,y,z)' && registration.quaternionToField === '(w,x,-y,-z)', 'unknown field registration');
      const frames = data.clip.frames.filter(f => f.tick >= d.sourceFirstTick && f.tick <= d.sourceLastTick).map(f => ({ tick: f.tick,
        grip: { x: -f.grip.x * d.heightScale, y: f.grip.y * d.heightScale, z: f.grip.z * d.heightScale },
        orientation: { w: f.orientation.w, x: f.orientation.x, y: -f.orientation.y, z: -f.orientation.z } }));
      assert(frames[0].tick === d.sourceFirstTick && frames.at(-1).tick === d.sourceLastTick, 'recipe original key window differs');
      const reference = C.createReferenceBatKinematicsV1({ ...d.reference, frames });
      const sampleTick = d.originTick + (tick - d.originTick) / d.reference.ticksPerSecond * d.reference.ticksPerSecond;
      const state = reference.sampleContinuous(sampleTick), pose = pitch.sampleBatAtTick(tick);
      let maximumPoseErrorM = null;
      if (pose) {
        maximumPoseErrorM = Math.max(...['grip', 'tip'].flatMap(point => ['x', 'y', 'z'].map(axis => Math.abs(pose[point][axis] - state.state.pose[point][axis]))));
        assert(maximumPoseErrorM <= 1e-9, 'motor recipe disagrees with actual public bat pose');
      }
      return { available: true, kind: 'PRESCRIBED_REFERENCE_MOTOR_NOT_POST_IMPACT_RECOIL', state,
        publicPose: pose, publicPlaybackAvailable: pose !== null, maximumPoseErrorM };
    }
    function runComparison(location) {
      const input = buildInput(location), result = C.compareMeasuredTrajectoriesV69({ pitch: input, afterContactSeconds: 8 });
      const first = JSON.stringify(result.cases[0].pitch.diagnostics.sourceDescriptor);
      const cases = result.cases.map(item => {
        const p = item.pitch, d = p.diagnostics, c = p.contact;
        assert(JSON.stringify(d.sourceDescriptor) === first, 'pitch Source differs between trajectory levels');
        const angle = c && Math.hypot(c.exitVelocity.x, c.exitVelocity.z) > 0 ? Math.atan2(c.exitVelocity.x, c.exitVelocity.z) * 180 / Math.PI : null;
        return { level: item.level, call: p.call, contact: c, metrics: item.metrics, diagnostics: d,
          exitFieldAngleDegrees: angle, exitBatterRelativePullAngleDegrees: angle === null ? null : -angle * (input.batter.bats === 'R' ? 1 : -1),
          actualContactMinusReferenceSeconds: c ? (c.tick - d.referenceContactTick) / d.sourceClockTicksPerSecond : null,
          motorAtContact: c ? motorAt(p, c.tick) : null };
      });
      return JSON.stringify({ input, afterContactSeconds: 8, invariants: result.invariants, cases });
    }
  `, realm, { timeout: 5000, filename: 'post-goal-diagnostic-only.js' });
  const summaries = [];
  for (const location of ['zone', 'inside']) {
    const result = JSON.parse(vm.runInContext('runComparison(' + JSON.stringify(location) + ')', realm,
      { timeout: 20000, filename: 'bounded-' + location + '-four-levels.js' }));
    result.pitchSourceDescriptorSha256 = result.cases.map(c => hash(JSON.stringify(c.diagnostics.sourceDescriptor)));
    fail(new Set(result.pitchSourceDescriptorSha256).size === 1, 'saved Source hashes differ within group');
    save(location + '.json', result);
    summaries.push({ location, inputSha256: hash(JSON.stringify(result.input)), sourceDescriptorSha256: result.pitchSourceDescriptorSha256[0],
      cases: result.cases.map(c => ({ level: c.level, contact: c.contact !== null, call: c.call,
        normal: c.contact?.normal ?? null, exitVelocity: c.contact?.exitVelocity ?? null,
        exitFieldAngleDegrees: c.exitFieldAngleDegrees, exitBatterRelativePullAngleDegrees: c.exitBatterRelativePullAngleDegrees,
        actualContactMinusReferenceSeconds: c.actualContactMinusReferenceSeconds })) });
  }
  save('summary.json', { ...metadata, finishedAt: new Date().toISOString(), status: 'DIAGNOSTIC_COMPLETED', observations: summaries,
    causalConclusion: 'NOT_ESTABLISHED_FROM_TWO_COURSE_GROUPS', sourceComparison: 'DO_NOT_EXPECT_SAME_PITCH_ACROSS_COURSE_GROUPS' });
  console.log(JSON.stringify({ output: relative(repo, output), status: 'DIAGNOSTIC_COMPLETED', maximumPitchExecutions: 8 }));
} catch (error) {
  save('failure.json', { status: 'DIAGNOSTIC_FAILED_OR_TIMED_OUT', name: error.name, message: error.message,
    automaticRetry: false, priorGroupResultsPreserved: true });
  throw error;
}
