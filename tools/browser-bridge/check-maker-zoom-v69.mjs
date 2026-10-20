import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url), { chromium } = require(process.env.MAKER_PLAYWRIGHT_CORE
  ?? 'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core'),
  evidence = resolve(process.argv[2] ?? 'docs/verification/releases/v69/main-zoom'),
  baselinePath = resolve('docs/demos/releases/v68/maker.html'),
  fixturePath = resolve('../../outputs/v69-main-zoom-fixture.html'),
  sha = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(evidence, { recursive: true });
const baseline = await readFile(baselinePath, 'utf8'), metadata = JSON.parse(await readFile(baselinePath + '.build.json', 'utf8')),
  ui = await readFile('docs/demos/baseball-maker-ui.mjs', 'utf8'),
  block = [...baseline.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].find(match => match[1].includes('globalThis.baseballMaker = Object.freeze'));
assert(block, 'frozen v68 base UI script required');
const addonAt = block[1].indexOf('/* Research controls use the same rigid-bat sampler as the ordinary match. */');
assert(addonAt > 0, 'frozen v68 addon boundary required');
const prefix = block[1].slice(0, addonAt), variants = [prefix];
for (let i = 0; i < 3; i++) for (const candidate of [...variants]) variants.push(candidate.replace(/^\r?\n/, ''), candidate.replace(/\r?\n$/, ''));
const oldSource = variants.find(source => sha(source) === metadata.uiSha256);
assert(oldSource, 'frozen v68 UI exact source pin required'); assert.equal(sha(baseline), metadata.sha256);
const fixture = baseline.replace(block[0], block[0].replace(oldSource, () => ui));
assert.notEqual(fixture, baseline); await writeFile(fixturePath, fixture);
const report = { pass: false, fixtureOnly: true, baselineSha256: sha(baseline), uiSha256: sha(ui), fixtureSha256: sha(fixture),
  scope: 'Only main-stage projection/gesture/optional display JSON. Frozen v68 Core, library, helpers, other panels and physics are reused unchanged.', views: [], faults: [] };
let browser;
const distance = projection => Math.hypot(projection.tip.x - projection.grip.x, projection.tip.y - projection.grip.y);
const near = (actual, expected, label) => assert(Math.abs(actual - expected) <= 1e-8 * Math.max(1, Math.abs(expected)), label);
async function open(page, path) {
  await page.goto(pathToFileURL(path).href);
  await page.waitForFunction(() => globalThis.baseballMaker?.getLiveRoster()?.entries.length === 20
    && globalThis.KneekuraBatLengthSprites?.inspect().loaded, null, { timeout: 30000 });
  await page.locator('#tab-bat').click();
}
const picture = page => page.evaluate(() => ({ projection: baseballMaker.getProjection(), frame: baseballMaker.getFrame(),
  threeViews: baseballMaker.getThreeViews(), png: document.getElementById('maker-scene').toDataURL(),
  minis: ['front', 'side', 'overhead'].map(view => document.getElementById('reference-view-' + view).toDataURL()) }));
const physical = async page => sha(await page.evaluate(() => { const state = baseballMaker.getState(); delete state.previewDisplay;
  return JSON.stringify({ state, result: baseballMaker.getResult(), physics: baseballMaker.getPhysicsResult(), frame: baseballMaker.getFrame(), revision: baseballMaker.getRevision() }); }));
try {
  browser = await chromium.launch({ executablePath: process.env.MAKER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
  for (const width of [1200, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 950 }, hasTouch: width === 390, acceptDownloads: true }),
      old = await context.newPage(), page = await context.newPage(), row = { width, defaultCameras: [], errors: [], external: [] };
    page.setDefaultTimeout(8000); report.views.push(row);
    for (const p of [old, page]) { p.on('pageerror', error => row.errors.push(String(error)));
      p.on('request', request => { if (!/^(file:|data:|blob:)/.test(request.url())) row.external.push(request.url()); }); }
    report.phase = 'default-pixels-' + width; await open(old, baselinePath); await open(page, fixturePath);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getPreviewDisplay()), { zoom: 1, panX: 0, panY: 0 });
    const sourceTime = await page.evaluate(() => KneekuraReferenceBatMotions.clips.find(clip => clip.id === KneekuraReferenceBatMotions.defaultClipId).contactTimeSeconds);
    for (const camera of ['side', 'batter', 'catcher', 'pitcher', 'overhead']) {
      for (const p of [old, page]) await p.evaluate(({ camera, time }) => { baseballMaker.setCamera(camera); baseballMaker.seek(time); }, { camera, time: sourceTime });
      const a = await picture(old), b = await picture(page); assert.deepEqual(b, a, 'default1 main/mini pixels and every sampled world/projection field must remain frozen v68 ' + camera);
      row.defaultCameras.push(camera);
    }
    await page.evaluate(time => { baseballMaker.setCamera('side'); baseballMaker.seek(time); }, sourceTime);
    const unzoomed = await picture(page), physicalSha = await physical(page), stateBefore = await page.evaluate(() => baseballMaker.getState());
    report.phase = 'zoom-pan-' + width;
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: 4 }));
    const four = await picture(page); near(distance(four.projection), distance(unzoomed.projection) * 4, 'bat expands4x in mainstage');
    assert.deepEqual(four.frame, unzoomed.frame); assert.deepEqual(four.threeViews, unzoomed.threeViews); assert.deepEqual(four.minis, unzoomed.minis);
    assert.equal(await physical(page), physicalSha, 'zoom changes no physics, source tick, player settings or revision');
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: 12 }));
    near(distance((await picture(page)).projection), distance(unzoomed.projection) * 12, 'mainstage supports12x');
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: .25 }));
    near(distance((await picture(page)).projection), distance(unzoomed.projection) / 4, 'mainstage supports quarter size');
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: 4, panX: .1, panY: -.08 }));
    const panned = (await picture(page)).projection;
    near(panned.grip.x - four.projection.grip.x, 96, 'panX is normalized canvas width');
    near(panned.grip.y - four.projection.grip.y, -.08 * 774, 'panY is normalized canvas height');
    await page.locator('#preview-zoom-center').click();
    const centered = await page.evaluate(() => ({ display: baseballMaker.getPreviewDisplay(), projection: baseballMaker.getProjection(), frame: baseballMaker.getFrame() }));
    assert.equal(centered.display.zoom, 4); assert.notEqual(centered.display.panX, .1);
    // Centering uses the true projected midpoint; perspective endpoints need not
    // average to exactly the same point, but the bat must be visibly in-frame.
    assert(centered.projection.grip.x >= 0 && centered.projection.grip.x <= 960 && centered.projection.tip.x >= 0 && centered.projection.tip.x <= 960);
    assert(centered.projection.grip.y >= 0 && centered.projection.grip.y <= 774 && centered.projection.tip.y >= 0 && centered.projection.tip.y <= 774);
    assert.equal(await physical(page), physicalSha);
    await page.locator('.stage').screenshot({ path: resolve(evidence, 'main-bat-zoom4-' + width + '.png') });
    await page.locator('#preview-zoom-reset').click(); assert.deepEqual(await picture(page), unzoomed, 'reset restores exact previous mainstage pixels');
    await page.locator('#preview-zoom').fill('6'); await page.locator('#preview-zoom').dispatchEvent('input');
    assert.equal((await page.evaluate(() => baseballMaker.getPreviewDisplay())).zoom, 6);
    await page.locator('#preview-zoom-out').click(); near((await page.evaluate(() => baseballMaker.getPreviewDisplay())).zoom, 4.8, 'minus button');
    await page.locator('#preview-zoom-in').click(); near((await page.evaluate(() => baseballMaker.getPreviewDisplay())).zoom, 6, 'plus button');
    await page.evaluate(() => baseballMaker.resetPreviewDisplay());
    const canvas = page.locator('#maker-scene'); await canvas.scrollIntoViewIfNeeded(); const rect = await canvas.boundingBox(), x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 35, y + 22, { steps: 3 }); await page.mouse.up();
    const dragged = await page.evaluate(() => baseballMaker.getPreviewDisplay());
    near(dragged.panX, 35 / rect.width, 'mouse drag panX'); near(dragged.panY, 22 / rect.height, 'mouse drag panY');
    await page.mouse.wheel(0, -180); await page.waitForTimeout(50);
    assert((await page.evaluate(() => baseballMaker.getPreviewDisplay())).zoom > 1, 'wheel zoom applies to mainstage');
    if (width === 390) {
      await page.evaluate(() => baseballMaker.resetPreviewDisplay());
      const session = await context.newCDPSession(page), r = await canvas.boundingBox(), py = r.y + r.height * .5, cx = r.x + r.width * .5;
      const touches = half => [{ x: cx - half, y: py, id: 1 }, { x: cx + half, y: py, id: 2 }];
      await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(40) });
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(65) });
      await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      const pinch = await page.evaluate(() => baseballMaker.getPreviewDisplay()); assert(pinch.zoom > 1.5 && pinch.zoom < 1.8, 'native two-finger pinch zoom');
      row.pinch = { actualTouchEvents: true, zoom: pinch.zoom }; await session.detach();
    }
    assert.equal(await physical(page), physicalSha, 'all pointer gestures retain physical world and clock');
    report.phase = 'display-json-' + width;
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: 3.5, panX: .12, panY: -.2 }));
    const saved = await page.evaluate(() => baseballMaker.getState()); assert.deepEqual(saved.previewDisplay, { zoom: 3.5, panX: .12, panY: -.2 });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]),
      downloaded = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.deepEqual(downloaded.previewDisplay, saved.previewDisplay);
    await page.evaluate(() => baseballMaker.resetPreviewDisplay()); await page.evaluate(saved => baseballMaker.importState(saved), downloaded);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getPreviewDisplay()), saved.previewDisplay);
    const rejected = await page.evaluate(() => {
      const before = JSON.stringify(baseballMaker.getState()), rows = []; let getterCalls = 0;
      const accessor = {}; Object.defineProperty(accessor, 'zoom', { enumerable: true, get() { getterCalls++; return 2; } });
      for (const patch of [{ zoom: .24 }, { zoom: 12.1 }, { panX: Infinity }, { panY: -11 }, { zoom: '2' }, { unknown: 1 }, accessor]) {
        let error = null; try { baseballMaker.setPreviewDisplay(patch); } catch (e) { error = e.message; }
        rows.push({ error, unchanged: JSON.stringify(baseballMaker.getState()) === before }); }
      const bad = baseballMaker.getState(); bad.previewDisplay = { zoom: 2, panX: 0 }; let importError = null;
      try { baseballMaker.importState(bad); } catch (e) { importError = e.message; }
      return { rows, getterCalls, importError, importUnchanged: JSON.stringify(baseballMaker.getState()) === before };
    });
    assert(rejected.rows.every(result => result.error && result.unchanged)); assert.equal(rejected.getterCalls, 0); assert(rejected.importError && rejected.importUnchanged);
    await page.evaluate(state => baseballMaker.importState(state), stateBefore);
    assert.deepEqual(await page.evaluate(() => baseballMaker.getPreviewDisplay()), { zoom: 1, panX: 0, panY: 0 });
    assert.equal(await page.evaluate(() => Object.hasOwn(baseballMaker.getState(), 'previewDisplay')), false, 'legacy JSON resets display and default JSON shape remains unchanged');
    report.phase = 'core-and-experiment-' + width;
    const modes = [];
    for (const mode of ['core', 'reference-experiment']) {
      const state = structuredClone(stateBefore); state.reference.mode = mode;
      if (mode === 'reference-experiment') state.reference.experiment = { startMs: 300, motorRate: .85, translation: { x: 0, y: 0, z: 0 } };
      await page.evaluate(state => { baseballMaker.importState(state); baseballMaker.setCamera('side'); baseballMaker.seek(.5); }, state);
      const before = await picture(page), physicalBefore = await physical(page);
      assert(before.projection?.grip && before.projection?.tip && before.frame.ball, mode + ' must expose the actual bat and ball');
      await page.evaluate(() => { baseballMaker.setPreviewDisplay({ zoom: 5 }); baseballMaker.centerPreviewOnBat(); });
      const after = await picture(page); near(distance(after.projection), distance(before.projection) * 5, mode + ' bat and ball view supports main zoom');
      assert.deepEqual(after.frame, before.frame); assert.equal(await physical(page), physicalBefore);
      await page.locator('.stage').screenshot({ path: resolve(evidence, 'main-' + mode + '-zoom5-' + width + '.png') });
      modes.push({ mode, projectionSizeRatio: 5, batAndBallPresent: true, physicalUnchanged: true });
    }
    row.modes = modes; row.invalid = rejected;
    row.zoom = { minimum: .25, maximum: 12, batSizeRatioAt4: 4, drag: dragged, wheel: true, legacyFiveCameraPixelsExact: true, miniViewsUnchanged: true, physicalUnchanged: true, optionalJsonRoundTrip: true };
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(row.errors, []); assert.deepEqual(row.external, []); await context.close();
  }
  assert.equal(sha(await readFile('docs/demos/baseball-maker-ui.mjs')), report.uiSha256);
  assert.equal(sha(await readFile(baselinePath)), report.baselineSha256);
  assert.equal(sha(await readFile(fixturePath)), report.fixtureSha256);
  report.pass = true; report.phase = 'complete'; console.log(JSON.stringify({ pass: true, fixtureOnly: true, widths: [1200, 390], zoomRange: [.25, 12], sourceUnchanged: true }));
} catch (error) {
  report.error = String(error.stack ?? error); await writeFile(resolve(evidence, 'zoom-failure-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify({ pass: false, phase: report.phase, error: String(error) })); process.exitCode = 1;
} finally { if (browser) await browser.close(); await writeFile(resolve(evidence, 'zoom-check.json'), JSON.stringify(report, null, 2) + '\n'); }
