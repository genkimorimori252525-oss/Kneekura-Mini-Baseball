import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifact = resolve(process.argv[2] ?? '../../outputs/にーくら野球メーカー_v68.html'),
  evidence = resolve(process.argv[3] ?? 'docs/verification/releases/v68/maker'), smokeOnly = process.argv.includes('--smoke'),
  sha = bytes => createHash('sha256').update(bytes).digest('hex'),
  require = createRequire(import.meta.url), { chromium } = require(process.env.MAKER_PLAYWRIGHT_CORE
    ?? 'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(evidence, { recursive: true });
const report = { pass: false, phase: 'load', artifact, smokeOnly, views: [], faults: [],
  scope: 'Actual maker UI / measured form selection / shared Core preview / saved player settings. Game integration is separately verified.' };
let browser;
const equalNumericTree = (actual, expected, path = 'sample') => {
  if (typeof expected === 'number') { assert(Number.isFinite(actual), path + ' is not finite');
    if (Number.isInteger(expected) && /(?:tick|sourceTick)$/.test(path)) assert.equal(actual, expected, path);
    else assert(Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), path + ' differs from shared Core');
  } else if (expected === null || typeof expected !== 'object') assert.equal(actual, expected, path);
  else { assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path + ' keys');
    for (const key of Object.keys(expected)) equalNumericTree(actual[key], expected[key], path + '.' + key); }
};
try {
  const bytes = await readFile(artifact), metadata = JSON.parse(await readFile(artifact + '.build.json', 'utf8')),
    inputBytes = await readFile(artifact + '.bundle-inputs.json'), inputs = JSON.parse(inputBytes),
    initialRoster = JSON.parse(await readFile('docs/demos/live-game-roster-v62.json', 'utf8')),
    compact = JSON.parse(await readFile('docs/demos/measured-bat-library-v1.json', 'utf8')),
    catalog = JSON.parse(await readFile('docs/demos/live-game-roster-catalog-v62.json', 'utf8'));
  report.sha256 = sha(bytes); assert.equal(report.sha256, metadata.sha256);
  assert.equal(sha(inputBytes), metadata.bundleInputManifestSha256);
  for (const [path, expected] of Object.entries(inputs.inputs)) assert.equal(sha(await readFile(path)), expected, 'input pin ' + path);
  const presentationPins = Object.fromEntries([
    ['uiSha256', 'docs/demos/baseball-maker-ui.mjs'], ['swingUiSha256', 'docs/demos/baseball-maker-swing-v68.js'],
    ['helpUiSha256', 'docs/demos/baseball-maker-help-v68.js'], ['lightCssSha256', 'docs/demos/baseball-maker-light-v68.css'],
    ['referenceSha256', 'docs/demos/measured-bat-library-v1.json'], ['libraryDecoderSha256', 'tools/browser-bridge/measured-bat-library-v1.js']
  ].map(([key, path]) => { assert(metadata[key], 'missing presentation pin ' + key); return [path, metadata[key]]; }));
  for (const [path, expected] of Object.entries(presentationPins)) assert.equal(sha(await readFile(path)), expected, 'presentation pin ' + path);
  report.inputCount = Object.keys(inputs.inputs).length;
  const libraryById = new Map(compact.clips.map(clip => [clip.id, clip]));
  let core;
  if (!smokeOnly) { const bundled = await build({ entryPoints: ['src/integration/browser/workbench-index.ts'], bundle: true,
    platform: 'node', format: 'esm', write: false });
    core = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64')); }
  const expectedCache = new Map();
  const expectedMotions = (clipId, settings) => {
    const cacheKey = JSON.stringify([clipId, settings.angleDegreesByLevel, settings.beforeSeconds, settings.afterSeconds]);
    if (expectedCache.has(cacheKey)) return expectedCache.get(cacheKey);
    const clip = libraryById.get(clipId), input = { provenance: { clipId, sourceSha256: clip.source.sha256 },
      frames: clip.rows.map(row => ({ tick: row[0], grip: { x: row[1], y: row[2], z: row[3] }, orientation: { w: row[7], x: row[8], y: row[9], z: row[10] } })),
      batLengthM: clip.normalization.batLengthM, sweetSpotT: clip.normalization.sweetSpotT,
      sourceTicksPerSecond: 1e6, startTick: 0, ticksPerSecond: 1e6, playbackRate: 1,
      transform: { rotation: { w: 1, x: 0, y: 0, z: 0 }, translation: { x: 0, y: 0, z: 0 }, scale: 1 } },
      contact = Math.round(clip.contactTimeSeconds * 1e6), motions = [core.createReferenceBatKinematicsV1(input),
        ...[1, 2, 3, 4].map(level => core.createReferenceBatKinematicsV1(core.withReferenceImpactTrajectoryV1(input, contact, { ...settings, level })))];
    expectedCache.set(cacheKey, motions); return motions;
  };
  browser = await chromium.launch({ executablePath: process.env.MAKER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  for (const width of smokeOnly ? [1200] : [1200, 390]) {
    report.phase = 'open-' + width;
    const context = await browser.newContext({ viewport: { width, height: 900 }, acceptDownloads: true, hasTouch: width === 390 }),
      page = await context.newPage(), errors = [], external = [], row = { width, players: [], explicitClips: [], comparisonSamples: 0 };
    page.setDefaultTimeout(8000);
    report.faults.push({ width, errors, external }); report.views.push(row);
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => { if (!/^(?:file:|data:|blob:)/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(artifact).href);
    await page.waitForFunction(() => globalThis.baseballMaker?.getLiveRoster()?.entries.length === 20
      && globalThis.KneekuraSwingMaker?.inspect().ready && globalThis.KneekuraMakerHelp?.inspect().installed, null, { timeout: 30000 });
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster, 'initial 20 players must preserve every SI/trait/source byte');
    await page.locator('#tab-player').click(); assert(await page.locator('#player-swing-editor').isVisible());
    row.startup = await page.evaluate(() => ({ swing: KneekuraSwingMaker.inspect(),
      colorScheme: getComputedStyle(document.documentElement).colorScheme, background: getComputedStyle(document.body).backgroundColor,
      panels: [...document.querySelectorAll('#player-panel')].map(panel => getComputedStyle(panel).backgroundColor),
      libraryClips: KneekuraReferenceBatMotions.clips.length,
      defaultIds: KneekuraReferenceBatMotions.clips.filter(clip => clip.defaultSelection).map(clip => clip.id) }));
    assert.equal(row.startup.libraryClips, 673); assert.equal(row.startup.swing.error, null);
    assert.equal(row.startup.colorScheme, 'light');
    const backgroundChannels = row.startup.background.match(/\d+/g).map(Number); assert(backgroundChannels.slice(0, 3).every(n => n >= 230), 'maker background must be light');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow at startup');
    if (smokeOnly) { await page.locator('#player-swing-editor').screenshot({ path: resolve(evidence, 'maker-v68-smoke.png') });
      assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close(); continue; }
    report.phase = 'hand-filter-' + width;
    for (const identity of catalog.players) {
      await page.locator('#live-roster-player').selectOption(identity.playerId);
      const observed = await page.evaluate(() => ({ swing: KneekuraSwingMaker.inspect(),
        options: [...document.querySelector('#swing-clip').options].map(option => option.value).filter(Boolean) }));
      assert.equal(observed.swing.error, null, identity.name + ' preview must be ready');
      assert.equal(observed.swing.playerId, identity.playerId); assert.equal(observed.swing.enabled, false); assert.equal(observed.swing.explicitClipId, null);
      const expected = compact.clips.filter(clip => clip.side === identity.bats).map(clip => clip.id);
      assert.deepEqual(observed.options, expected, identity.name + ' can choose every original same-handed trial, no mirrored substitutes');
      row.players.push({ id: identity.playerId, bats: identity.bats, options: expected.length });
    }
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster, 'browsing all20 players and comparisons is read-only');
    const ranks = [0, 19, 19.999, 20, 39, 40, 49, 50, 59, 60, 69, 70, 79, 80, 89, 90, 100, -1, 101, null];
    const expectedRanks = ['G', 'G', 'G', 'F', 'F', 'E', 'E', 'D', 'D', 'C', 'C', 'B', 'B', 'A', 'A', 'S', 'S', '範囲外', '範囲外', '未算出'];
    assert.deepEqual(await page.evaluate(values => values.map(value => baseballMaker.publicRank(value)), ranks), expectedRanks);
    row.rankBoundaries = { values: ranks, ranks: expectedRanks };
    report.phase = 'form-comparison-' + width;
    for (const side of ['R', 'L']) {
      const identity = catalog.players.find(player => player.bats === side && player.role !== 'P'),
        clip = compact.clips.find(item => item.side === side && !item.defaultSelection);
      await page.locator('#live-roster-player').selectOption(identity.playerId);
      const prior = await page.evaluate(() => baseballMaker.getLiveRoster());
      await page.locator('#swing-clip').selectOption(clip.id);
      let view = await page.evaluate(() => KneekuraSwingMaker.inspect());
      assert.equal(view.explicitClipId, clip.id); assert.equal(view.clipId, clip.id); assert.equal(view.error, null);
      const edited = await page.evaluate(() => baseballMaker.getLiveRoster());
      for (const entry of edited.entries) { const old = prior.entries.find(item => item.playerId === entry.playerId);
        if (entry.playerId !== identity.playerId) assert.deepEqual(entry, old, 'form selection cannot change another player');
        else { const { clipId, ...physical } = entry.physical; assert.equal(clipId, clip.id); assert.deepEqual(physical, old.physical, 'form selection changes no SI/trait controls'); } }
      await page.locator('#swing-enabled').check();
      const cases = [];
      for (const activeLevel of [1, 2, 3, 4]) {
        await page.locator('#swing-grade').selectOption(String(activeLevel));
        const atLevel = await page.evaluate(() => KneekuraSwingMaker.inspect());
        assert.equal(atLevel.enabled, true); assert.equal(atLevel.settings.level, activeLevel); assert.equal(atLevel.error, null);
        const motions = expectedMotions(clip.id, atLevel.settings);
        for (const ms of [-150, -100, -50, 0, 25, 60, 70]) {
          const actual = await page.evaluate(ms => { KneekuraSwingMaker.seek(ms); return KneekuraSwingMaker.inspect(); }, ms);
          assert.equal(actual.clockMs, ms); assert.equal(actual.samples.length, 5);
          for (let level = 0; level <= 4; level++) { const { level: displayedLevel, ...sample } = actual.samples[level];
            assert.equal(displayedLevel, level); equalNumericTree(sample, motions[level].sampleAtSourceTick(actual.sourceTick)); row.comparisonSamples++; }
          if (ms <= -100 || ms >= 60) for (const sample of actual.samples.slice(1)) { const { level, ...rest } = sample;
            const { level: baseLevel, ...base } = actual.samples[0]; assert.deepEqual(rest, base, 'outside local window all original motion must remain'); }
          if (ms === 0) for (const sample of actual.samples.slice(1)) equalNumericTree(sample.sweetSpot, actual.samples[0].sweetSpot, 'impact pivot');
        }
        cases.push({ level: activeLevel, settings: atLevel.settings, sharedCoreMatch: true });
      }
      await page.locator('#player-swing-editor details').evaluate(element => { element.open = true; });
      await page.locator('#swing-angle-3').fill('17'); await page.locator('#swing-angle-3').press('Tab');
      await page.locator('#swing-grade').selectOption('3');
      const custom = await page.evaluate(() => { KneekuraSwingMaker.seek(-30); return KneekuraSwingMaker.inspect(); });
      assert.equal(custom.settings.angleDegreesByLevel[2], 17); assert.equal(custom.settings.level, 3); assert.equal(custom.error, null);
      const customMotions = expectedMotions(clip.id, custom.settings);
      for (let level = 0; level <= 4; level++) { const { level: displayedLevel, ...sample } = custom.samples[level]; equalNumericTree(sample, customMotions[level].sampleAtSourceTick(custom.sourceTick)); }
      const pixels = await page.evaluate(() => ['front', 'side', 'top'].map(view => {
        const canvas = document.getElementById('swing-preview-' + view), rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        let colored = 0; for (let i = 0; i < rgba.length; i += 4) if (rgba[i + 3] > 0 && Math.max(rgba[i], rgba[i + 1], rgba[i + 2]) - Math.min(rgba[i], rgba[i + 1], rgba[i + 2]) > 35) colored++;
        return { view, colored, width: canvas.width, height: canvas.height }; }));
      for (const p of pixels) assert(p.colored > 150, p.view + ' must show actual colored trajectories and bats, not just the grid');
      assert.equal(await page.locator('#swing-comparison-values [data-level]').count(), 5);
      row.explicitClips.push({ playerId: identity.playerId, side, clipId: clip.id, cases, customAngle: 17, pixels });
    }
    const beforeInvalidAngle = await page.evaluate(() => baseballMaker.getLiveRoster());
    await page.locator('#swing-angle-3').fill('31'); await page.locator('#swing-angle-3').press('Tab');
    assert.equal(await page.locator('#swing-angle-3').inputValue(), '17', 'rejected angle must restore the actual accepted setting');
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), beforeInvalidAngle, 'rejected UI angle cannot mutate roster or source revision');
    assert(await page.locator('#swing-editor-status').innerText(), 'rejected angle needs an explanation');
    row.invalidAngle = { requested: 31, restored: 17, rosterUnchanged: true };
    await page.evaluate(() => KneekuraSwingMaker.refresh());
    report.phase = 'roster-validation-' + width;
    const invalid = await page.evaluate(() => {
      const saved = baseballMaker.getLiveRoster(), state = baseballMaker.getState(), id = document.getElementById('live-roster-player').value,
        identity = KneekuraLiveGameRosterCatalog.players.find(player => player.playerId === id), results = [];
      const cases = [
        ['unknown-clip', next => { next.entries.find(entry => entry.playerId === id).physical.clipId = 'obp-99999_999'; }],
        ['wrong-handed-clip', next => { next.entries.find(entry => entry.playerId === id).physical.clipId = KneekuraReferenceBatMotions.clips.find(clip => clip.side !== identity.bats).id; }],
        ['unknown-impact-key', next => { next.entries.find(entry => entry.playerId === id).physical.impactTrajectory.unknown = 1; }],
        ['invalid-impact-level', next => { next.entries.find(entry => entry.playerId === id).physical.impactTrajectory.level = 5; }],
        ['unsupported-source-window', next => { next.entries.find(entry => entry.playerId === id).physical.impactTrajectory.afterSeconds = .3; }],
      ];
      for (const [name, mutate] of cases) { const next = structuredClone(saved); mutate(next); let message = null;
        try { baseballMaker.importLiveRoster(next); } catch (error) { message = String(error.message); }
        results.push({ name, message, unchanged: JSON.stringify(baseballMaker.getLiveRoster()) === JSON.stringify(saved) }); }
      const bad = structuredClone(state); bad.livePhysicalRoster.entries.find(entry => entry.playerId === id).physical.clipId = 'obp-99999_999'; let stateMessage = null;
      try { baseballMaker.importState(bad); } catch (error) { stateMessage = String(error.message); }
      return { cases: results, stateUnknownRejected: !!stateMessage, stateUnchanged: JSON.stringify(baseballMaker.getState()) === JSON.stringify(state) };
    });
    for (const result of invalid.cases) assert(result.message && result.unchanged, result.name + ' must be rejected atomically');
    assert(invalid.stateUnknownRejected && invalid.stateUnchanged, 'full JSON must reject unknown clip atomically'); row.invalid = invalid;
    report.phase = 'vision-and-help-' + width;
    const selectedId = await page.locator('#live-roster-player').inputValue();
    await page.locator('#public-ability-vision').fill('90');
    assert.equal(await page.locator('#public-ability-vision').evaluate(input => input.validationMessage), '');
    row.visionEdit = await page.evaluate(id => ({ selectedId: document.getElementById('live-roster-player').value,
      requested: 90, inputValue: document.getElementById('public-ability-vision').value,
      projection: baseballMaker.getPublicProjection().abilities.find(ability => ability.id === 'vision'),
      physical: baseballMaker.getLiveRoster().entries.find(entry => entry.playerId === id).physical,
      rosterStatus: document.getElementById('live-roster-status').textContent,
      swing: KneekuraSwingMaker.inspect().error }), selectedId);
    const leagueDetails = page.locator('details').filter({ has: page.locator('#live-public-league') });
    if (!(await leagueDetails.evaluate(element => element.open))) await leagueDetails.locator('summary').click();
    for (const leagueId of ['MLB', 'NLB', 'NPB', 'KBO', 'CUSTOM']) {
      await page.locator('#live-public-league').selectOption(leagueId);
      const vision = await page.evaluate(id => ({ value: baseballMaker.getPublicProjection().abilities.find(ability => ability.id === 'vision').value,
        physical: baseballMaker.getLiveRoster().entries.find(entry => entry.playerId === id).physical.plateVision,
        displayed: document.getElementById('public-ability-vision').closest('.control').querySelector('.public-grade').textContent,
        preview: [...document.querySelectorAll('#live-public-league-preview .rating')].find(item => item.textContent.includes('選球眼'))?.textContent }), selectedId);
      assert.equal(vision.value, 90); assert.equal(vision.physical, 90); assert.equal(vision.displayed, 'S'); assert.match(vision.preview, /S/);
    }
    row.absoluteVision = { value: 90, rank: 'S', unchangedAcrossLeagues: ['MLB', 'NLB', 'NPB', 'KBO', 'CUSTOM'] };
    const helpInput = page.locator('#swing-clip'); await helpInput.scrollIntoViewIfNeeded();
    await page.mouse.move(1, 1); await page.evaluate(() => KneekuraMakerHelp.hide());
    await helpInput.hover(); await page.waitForTimeout(600);
    assert.equal((await page.evaluate(() => KneekuraMakerHelp.inspect())).visible, false, 'help must not appear before1s');
    await page.waitForTimeout(500);
    let help = await page.evaluate(() => KneekuraMakerHelp.inspect()); assert.equal(help.delayMs, 1000); assert.equal(help.visible, true);
    const helpText = await page.locator('#maker-help-tooltip-v68').innerText(); assert.match(helpText, /右打者|左打者|打ち方/);
    assert(helpText.length < 500, 'help must describe the setting without including hundreds of option labels');
    await page.keyboard.press('Escape'); assert.equal((await page.evaluate(() => KneekuraMakerHelp.inspect())).visible, false);
    const matchingButton = page.getByRole('button', { name: /この選手が使う打ち方の説明/ });
    assert.equal(await matchingButton.count(), 1);
    if (width === 390) await matchingButton.tap(); else await matchingButton.click();
    assert.equal((await page.evaluate(() => KneekuraMakerHelp.inspect())).visible, true, 'click/tap explanation is immediate');
    const helpBox = await page.locator('#maker-help-tooltip-v68').boundingBox();
    assert(helpBox.x >= 0 && helpBox.x + helpBox.width <= width && helpBox.y >= 0 && helpBox.y + helpBox.height <= 900, 'tooltip must fit viewport');
    await page.keyboard.press('Escape'); row.help = { delayMs: 1000, notVisibleAt600ms: true, visibleAfter1100ms: true, clickImmediate: true, touchImmediate: width === 390, viewportClamped: true };
    report.phase = 'json-roundtrip-' + width;
    const editedRoster = await page.evaluate(() => baseballMaker.getLiveRoster());
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-live-roster').click()]);
    const savedRoster = JSON.parse(await readFile(await download.path(), 'utf8')); assert.deepEqual(savedRoster, editedRoster);
    await page.locator('#live-roster-file').setInputFiles({ name: 'swing-player-settings.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(savedRoster)) });
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), savedRoster);
    const [fullDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]);
    const full = JSON.parse(await readFile(await fullDownload.path(), 'utf8')); assert.deepEqual(full, await page.evaluate(() => baseballMaker.getState()));
    await writeFile(resolve(evidence, 'edited-roster-' + width + '.json'), JSON.stringify(savedRoster, null, 2) + '\n');
    await page.reload(); await page.waitForFunction(() => globalThis.KneekuraSwingMaker?.inspect().ready);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster, 'a fresh page keeps original defaults');
    await page.evaluate(saved => baseballMaker.importState(saved), full);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getState()), full); assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), savedRoster);
    await page.locator('#live-roster-player').selectOption(selectedId); const restored = await page.evaluate(() => KneekuraSwingMaker.inspect());
    assert.equal(restored.enabled, true); assert.equal(restored.settings.angleDegreesByLevel[2], 17); assert.equal(restored.error, null);
    row.json = { realRosterDownload: true, fileInputReload: true, realFullDownload: true, freshDefaultsRetained: true, fullReloadRoundTrip: true,
      authoredRosterSha256: sha(JSON.stringify(savedRoster)) };
    await page.locator('#player-swing-editor').scrollIntoViewIfNeeded();
    await page.locator('#player-swing-editor').screenshot({ path: resolve(evidence, 'maker-swing-' + width + '.png') });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'no horizontal overflow after all authoring');
    await page.screenshot({ path: resolve(evidence, 'maker-v68-' + width + '.png') });
    assert.deepEqual(errors, []); assert.deepEqual(external, []); await context.close();
  }
  assert.equal(sha(await readFile(artifact)), report.sha256, 'artifact changed during verification');
  for (const [path, expected] of Object.entries(inputs.inputs)) assert.equal(sha(await readFile(path)), expected, 'input changed during verification ' + path);
  for (const [path, expected] of Object.entries(presentationPins)) assert.equal(sha(await readFile(path)), expected, 'presentation changed during verification ' + path);
  report.pass = true; report.phase = 'complete';
  console.log(JSON.stringify({ pass: true, smokeOnly, sha256: report.sha256, widths: report.views.map(row => row.width),
    comparisonSamples: report.views.reduce((n, row) => n + row.comparisonSamples, 0), initialPlayers: 20, libraryClips: 673 }));
} catch (error) {
  report.error = String(error.stack ?? error); await writeFile(resolve(evidence, 'maker-v68-failure-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify({ pass: false, phase: report.phase, error: String(error) })); process.exitCode = 1;
} finally { if (browser) await browser.close(); await writeFile(resolve(evidence, smokeOnly ? 'smoke-check.json' : 'maker-check.json'), JSON.stringify(report, null, 2) + '\n'); }
