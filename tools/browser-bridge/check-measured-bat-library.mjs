import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const libraryPath = resolve(process.argv[2] ?? 'docs/demos/measured-bat-library-v1.json'),
  evidence = resolve(process.argv[3] ?? 'docs/verification/releases/v68/measured-library');
await mkdir(evidence, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const decoder = await readFile('tools/browser-bridge/measured-bat-library-v1.js', 'utf8'),
  libraryText = await readFile(libraryPath, 'utf8'), library = JSON.parse(libraryText),
  legacy = JSON.parse(await readFile('docs/demos/measured-bat-motions.json', 'utf8')),
  manifest = JSON.parse(await readFile('docs/verification/releases/v68/measured-library/build-manifest.json', 'utf8'));
const report = { pass: false, decoderSha256: sha(decoder), librarySha256: sha(libraryText), libraryBytes: Buffer.byteLength(libraryText), checks: [], browser: [] };
let browser;
try {
  assert.equal(report.librarySha256, manifest.sha256); assert.equal(report.decoderSha256, manifest.decoderSha256);
  vm.runInThisContext(decoder, { filename: 'measured-bat-library-v1.js' });
  const api = globalThis.KneekuraMeasuredBatLibrary, decoded = api.decode(libraryText);
  assert.equal(decoded.schemaVersion, 2); assert.equal(decoded.authority, legacy.authority);
  assert.equal(decoded.clips.length, 673); assert.equal(decoded.index.length, 677);
  assert.deepEqual(decoded.index, legacy.index); assert.equal(decoded.licenseText, legacy.licenseText);
  assert.deepEqual(decoded.clock, legacy.clock); assert.deepEqual(decoded.coordinateRegistration, legacy.coordinateRegistration);
  const defaults = decoded.clips.filter(clip => clip.defaultSelection);
  assert.deepEqual(defaults.map(clip => clip.id), legacy.clips.map(clip => clip.id));
  for (const old of legacy.clips) {
    const actual = decoded.clips.find(clip => clip.id === old.id), { sourceRows, ...runtime } = old,
      { defaultSelection, sourceRowRange, ...newRuntime } = actual;
    assert.deepEqual(newRuntime, runtime, old.id + ' runtime geometry/metadata changed');
  }
  for (const clip of decoded.clips) {
    const proof = manifest.perClip.find(item => item.id === clip.id);
    assert.equal(sha(JSON.stringify(clip.frames)), proof.frameSha256);
    assert.equal(sha(JSON.stringify(clip.measurements)), proof.measurementSha256);
    assert.equal(clip.frames.length, 137); assert.equal(clip.measurements.length, 137);
    assert.equal(Object.hasOwn(clip, 'sourceRows'), false);
    assert.equal(clip.nativeAdmission, false); assert.equal(clip.officialResult, null);
    assert.equal(Object.isFrozen(clip.frames[0].grip), true);
  }
  assert.equal(decoded.clips.reduce((n, clip) => n + clip.frames.length, 0), 92201);
  assert.throws(() => { decoded.clips[0].frames[0].grip.x = 100; }, TypeError);
  report.checks.push('673 original windows / 92201 keys / provenance; legacy12 entire runtime JSON and automatic ordering exact; frozen detached output');
  const fromObject = api.decode(library);
  assert.deepEqual(fromObject.clips[12], decoded.clips[12]);
  assert.equal(Object.isFrozen(library), false);
  assert.equal(Object.isFrozen(library.clips[0].rows), false);
  report.checks.push('Node plain-object and JSON-text entry points agree without freezing caller input');
  let reads = 0;
  const accessor = {}; Object.defineProperty(accessor, 'schemaVersion', { enumerable: true, get() { reads++; return 1; } });
  assert.throws(() => api.decode(accessor), /unsafe data field/); assert.equal(reads, 0);
  const decorated = Object.create({ inherited: true }); decorated.schemaVersion = 1;
  assert.throws(() => api.decode(decorated), /plain JSON object/);
  assert.throws(() => api.decode({ constructor: 1 }), /unsafe data field/);
  assert.throws(() => api.decode({ [Symbol('field')]: 1 }), /symbol fields/);
  assert.throws(() => api.decode('x'), SyntaxError);
  const cases = [
    ['unknown top field', data => { data.unknown = true; }, /unexpected library fields/],
    ['nonfinite key', data => { data.clips[0].rows[0][1] = NaN; }, /nonfinite number/],
    ['duplicate key time', data => { data.clips[0].rows[1][0] = data.clips[0].rows[0][0]; }, /sample or clock/],
    ['nonunit quaternion', data => { data.clips[0].rows[0][7] += .2; }, /nonunit sample orientation/],
    ['unit orientation unrelated to bat', data => { data.clips[0].rows[0].splice(7, 4, 1, 0, 0, 0); }, /orientation does not describe/],
    ['unmeasured authority', data => { data.clips[0].nativeAdmission = true; }, /ungranted authority/],
    ['new trial automatic selection', data => { data.clips[12].defaultSelection = true; }, /automatic selection/],
    ['legacy trial automatic selection removed', data => { data.clips[0].defaultSelection = false; }, /automatic selection/],
    ['provenance replacement', data => { data.clips[0].source.sha256 = '0'.repeat(64); }, /raw provenance/],
    ['missing source row', data => { data.clips[0].rows.pop(); }, /original sample row range/],
    ['sparse source array', data => { delete data.clips[0].rows[0][1]; }, /sparse or decorated array/],
  ];
  for (const [name, mutate, expected] of cases) { const candidate = JSON.parse(libraryText); mutate(candidate); assert.throws(() => api.decode(candidate), expected, name); report.checks.push('reject: ' + name); }
  const require = createRequire(import.meta.url), { chromium } = require(process.env.MAKER_PLAYWRIGHT_CORE
    ?? 'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  browser = await chromium.launch({ executablePath: process.env.MAKER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  for (const viewport of [{ width: 1200, height: 860 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }), errors = [], requests = [];
    page.on('pageerror', error => errors.push(String(error))); page.on('request', request => requests.push(request.url()));
    await page.setContent('<!doctype html><meta charset="utf-8"><title>Measured library decoder test</title>');
    await page.addScriptTag({ content: decoder });
    const observed = await page.evaluate(text => {
      const result = globalThis.KneekuraMeasuredBatLibrary.decode(text);
      let reads = 0; const bad = {}; Object.defineProperty(bad, 'schemaVersion', { enumerable: true, get() { reads++; return 1; } });
      let rejected = false; try { globalThis.KneekuraMeasuredBatLibrary.decode(bad); } catch { rejected = true; }
      const runtime = result.clips.filter(clip => clip.defaultSelection).map(clip => { const { defaultSelection, sourceRowRange, ...rest } = clip; return rest; });
      return { schemaVersion: result.schemaVersion, authority: result.authority, clips: result.clips.length, index: result.index.length,
        measuredKeys: result.clips.reduce((n, clip) => n + clip.frames.length, 0), defaults: runtime,
        frozen: Object.isFrozen(result.clips[672].frames[136].orientation), getterReads: reads, rejected,
        sourceRowsDuplicated: result.clips.some(clip => Object.hasOwn(clip, 'sourceRows')) };
    }, libraryText);
    assert.equal(observed.clips, 673); assert.equal(observed.index, 677); assert.equal(observed.measuredKeys, 92201);
    assert.equal(observed.authority, legacy.authority); assert.equal(observed.schemaVersion, 2);
    assert.deepEqual(observed.defaults, legacy.clips.map(({ sourceRows, ...runtime }) => runtime));
    assert.equal(observed.frozen, true); assert.equal(observed.getterReads, 0); assert.equal(observed.rejected, true); assert.equal(observed.sourceRowsDuplicated, false);
    assert.deepEqual(errors, []); assert.deepEqual(requests, []);
    report.browser.push({ viewport, decodedClips: 673, originalKeys: 92201, legacyDefaultRuntimeExact: true, getterReads: 0, requests: 0, errors: 0 });
    await page.close();
  }
  report.pass = true;
} catch (error) { report.error = String(error); report.stack = error.stack; }
finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidence, 'decoder-check.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: report.pass, checks: report.checks.length, browserWidths: report.browser.map(item => item.viewport.width), error: report.error }));
if (!report.pass) process.exitCode = 1;
