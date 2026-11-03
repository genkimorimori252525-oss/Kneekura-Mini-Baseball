import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { parseCsv, originalTimeTick, worldPoint } from './import-openbiomechanics-bats.mjs';

const require = createRequire(import.meta.url), { chromium } = require(process.env.MAKER_PLAYWRIGHT_CORE ?? 'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const output = resolve(process.argv[2]), dataset = resolve(process.argv[3]), evidence = resolve(process.argv[4]);
await mkdir(evidence, { recursive: true });
const data = JSON.parse(await readFile('docs/demos/measured-bat-motions.json', 'utf8'));
const csv = await readFile(resolve(dataset, 'selected/打撃_手元基準点と芯の軌道.csv'));
const originalRows = new Map(parseCsv(csv.toString('utf8')).map(row => [row.session_swing + '/' + row.time, row]));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(data.authority, 'OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH');
assert.equal(data.clips.length, 12); assert.equal(data.index.length, 677);
assert.equal(data.selection.missingCoordinateRows, 5);
assert.throws(() => originalTimeTick('0.0000001')); assert.throws(() => originalTimeTick('-1'));
assert.deepEqual(parseCsv('id,value\n1,"a,b"\n2,"a""b"\n'), [{ id: '1', value: 'a,b' }, { id: '2', value: 'a"b' }]);
const distance = (a, b) => Math.hypot(...['x', 'y', 'z'].map(axis => a[axis] - b[axis]));
for (const clip of data.clips) {
  assert.equal(clip.source.sha256, sha(csv)); assert.equal(clip.frames.length, clip.sourceRows.length);
  assert.equal(clip.frames.length, clip.measurements.length);
  assert.ok(clip.binding.maximumHandResidualM <= .02);
  assert.equal(clip.binding.axialPhase, 'DECLARED_MINIMUM_ROTATION_TRANSPORT');
  let maximumHandResidualM = 0;
  for (let i = 0; i < clip.frames.length; i++) {
    const row = clip.sourceRows[i], frame = clip.frames[i], measurement = clip.measurements[i];
    assert.deepEqual(row, originalRows.get(clip.source.motion + '/' + row.time));
    assert.equal(frame.tick, originalTimeTick(row.time));
    const sweet = worldPoint(['sweet_spot_x', 'sweet_spot_y', 'sweet_spot_z'].map(k => Number(row[k])));
    assert.deepEqual(frame.sweetSpot, sweet); assert.deepEqual(measurement.sweetSpot, sweet);
    const hand = worldPoint(['blast_hand_x', 'blast_hand_y', 'blast_hand_z'].map(k => Number(row[k])));
    assert.deepEqual(measurement.handReference, hand);
    const predictedHand = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, frame.grip[axis]
      + (frame.tip[axis] - frame.grip[axis]) / clip.normalization.batLengthM * clip.binding.handReferenceFromKnobM]));
    maximumHandResidualM = Math.max(maximumHandResidualM, distance(predictedHand, hand));
    assert.ok(Math.abs(distance(frame.grip, frame.tip) - clip.normalization.batLengthM) < 1e-10);
    const expected = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, frame.grip[axis] + (frame.tip[axis] - frame.grip[axis]) * clip.normalization.sweetSpotT]));
    assert.ok(distance(expected, sweet) < 1e-10);
    assert.equal(clip.nativeAdmission, false); assert.equal(clip.officialResult, null);
  }
  assert.ok(Math.abs(maximumHandResidualM - clip.binding.maximumHandResidualM) < 1e-10);
}
const browser = await chromium.launch({ executablePath: process.env.MAKER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-first-run'] });
const report = { dataChecks: { trials: 677, clips: 12, originalKeys: data.clips.reduce((n, clip) => n + clip.frames.length, 0), status: 'PASS' }, viewports: [],
  limitation: 'Maker research/Core contact only; Native game adoption, bodies and nine innings NOT_PROVEN. Desktop 390px is not a real phone.' };
try {
  for (const viewport of [{ width: 1200, height: 860 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport }), errors = [], external = [];
    page.on('pageerror', error => errors.push(String(error))); page.on('request', request => { if (/^https?:/.test(request.url())) external.push(request.url()); });
    await page.goto(pathToFileURL(output).href); await page.waitForFunction(() => window.baseballMaker?.getResult() && window.KneekuraBatLengthSprites?.inspect().loaded);
    assert.equal(await page.locator('#trajectory-mode').inputValue(), 'reference');
    assert.equal(await page.locator('#bat-length').inputValue(), '86.36');
    assert.equal(await page.locator('#reference-clip option').count(), 12);
    assert.doesNotMatch(await page.locator('#reference-clip').innerText(), /MMD|VMD|ミク/);
    const coreBefore = await page.evaluate(() => ({ result: window.baseballMaker.getResult(), revision: window.baseballMaker.getRevision() }));
    const views = await page.evaluate(() => {
      const api = window.baseballMaker, data = window.KneekuraReferenceBatMotions, original = api.getState(), views = [];
      for (const clip of data.clips) {
        const saved = structuredClone(original); saved.player.bat.lengthM = clip.normalization.batLengthM; saved.player.bat.sweetSpotT = clip.normalization.sweetSpotT;
        saved.reference = { mode: 'reference', clipId: clip.id, startTimeSeconds: clip.timeRange.start, endTimeSeconds: clip.timeRange.end, speed: .5, compareClipId: null };
        api.importState(saved); api.seek(clip.contactTimeSeconds);
        for (const camera of ['side', 'batter', 'catcher', 'pitcher', 'overhead']) {
          api.setCamera(camera); const frame = api.getFrame(), source = clip.frames.find(source => source.tick === frame.batSourceTick);
          views.push({ id: clip.id, camera, frame, source, projection: api.getProjection() });
        }
      }
      api.importState(original); return views;
    });
    for (const view of views) {
      assert.equal(view.frame.authority, data.authority); assert.equal(view.frame.ball, null); assert.equal(view.frame.body, null);
      assert.equal(view.frame.contact, null); assert.equal(view.frame.officialResult, null);
      assert.deepEqual(view.frame.grip, view.source.grip); assert.deepEqual(view.frame.tip, view.source.tip);
      assert.deepEqual(view.frame.sweetSpot, view.source.sweetSpot); assert.ok(view.projection.grip && view.projection.tip);
    }
    await page.locator('#trajectory-mode').selectOption('reference');
    await page.locator('#reference-measured-right').click(); await page.locator('#reference-measured-left').click();
    assert.match(await page.locator('#reference-note').innerText(), /OpenBiomechanics実測/);
    assert.match(await page.locator('#reference-baseline').innerText(), /反転生成はしていません/);
    const sourceBefore = await page.evaluate(() => structuredClone(window.KneekuraReferenceBatMotions));
    await page.locator('details').filter({ has: page.locator('#calibration-world-yaw') }).locator('summary').click();
    await page.locator('#calibration-world-yaw').fill('20'); await page.locator('#calibration-world-yaw').dispatchEvent('change');
    const calibrated = await page.evaluate(() => ({ frame: window.baseballMaker.getFrame(), state: window.baseballMaker.getState() }));
    assert.ok(distance(calibrated.frame.grip, calibrated.frame.sourcePose.grip) > .001);
    assert.deepEqual(await page.evaluate(() => window.KneekuraReferenceBatMotions), sourceBefore);
    await page.evaluate(saved => window.baseballMaker.importState(saved), calibrated.state);
    assert.deepEqual(await page.evaluate(() => window.baseballMaker.getState()), calibrated.state);
    await page.locator('#calibration-reset').click();
    const sourceState = await page.evaluate(() => window.baseballMaker.getState());
    assert.equal(sourceState.reference.clipId, data.defaultClipId); assert.equal(sourceState.reference.compareClipId, data.comparisonClipId);
    const beforeLegacy = await page.evaluate(() => window.baseballMaker.getState());
    const rejectedLegacy = await page.evaluate(() => { const api = window.baseballMaker, saved = api.getState(); saved.reference = { mode: 'reference', clipId: 'vmd-2-18', startFrame: 0, endFrame: 9, speed: .5, compareClipId: null }; try { api.importState(saved); return false; } catch { return true; } });
    assert.equal(rejectedLegacy, true); assert.deepEqual(await page.evaluate(() => window.baseballMaker.getState()), beforeLegacy);
    for (const cm of [78, 84, 90]) {
      await page.locator('#bat-length-' + cm).click();
      const f = await page.evaluate(() => window.baseballMaker.getFrame());
      assert.ok(Math.abs(distance(f.tip, f.grip) - cm / 100) < 1e-10);
    }
    await page.locator('#trajectory-pattern-controls > summary').click();
    await page.locator('#pattern-name').fill('実測ライナー'); await page.locator('#pattern-intent').selectOption('liner'); await page.locator('#pattern-save').click();
    const patterns = await page.evaluate(() => window.baseballMaker.getState()); assert.equal(patterns.trajectoryPatterns[0].intent, 'liner');
    assert.equal(patterns.trajectoryPatterns[0].reference.clipId, data.defaultClipId);
    await page.evaluate(saved => window.baseballMaker.importState(saved), patterns); assert.deepEqual(await page.evaluate(() => window.baseballMaker.getState()), patterns);
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#export-reference').click()]);
    const exported = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(exported.authority, data.authority); assert.deepEqual(exported.sourceRows, data.clips.find(clip => clip.id === data.defaultClipId).sourceRows);
    // Place the real sampled motor next to a real Core pitch sample. This is
    // an explicit experiment placement, not a claim about measured ball data.
    const trial = await page.evaluate(() => {
      const api = window.baseballMaker, saved = api.getState(), clip = window.KneekuraReferenceBatMotions.clips.find(c => c.id === window.KneekuraReferenceBatMotions.defaultClipId);
      saved.player.capability.maximumSweetSpotSpeedMps = 90; saved.player.bat.lengthM = clip.normalization.batLengthM; saved.player.bat.sweetSpotT = clip.normalization.sweetSpotT;
      const target = api.getResult().pitchFrames.find(f => f.tick >= 400000), rate = 1;
      const first = clip.frames[0], source = clip.frames.reduce((a, b) => Math.abs(a.tick - first.tick - 200000) < Math.abs(b.tick - first.tick - 200000) ? a : b);
      const startTick = target.tick - (source.tick - first.tick), translation = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, target.position[axis] - source.sweetSpot[axis]]));
      saved.reference = { mode: 'reference-experiment', clipId: clip.id, startTimeSeconds: clip.timeRange.start, endTimeSeconds: clip.timeRange.end, speed: .5, compareClipId: null,
        experiment: { startMs: startTick / 1000, motorRate: rate, translation } };
      // Earliest measured key can precede the player's latency: use a later
      // real pitch sample if needed, rather than relaxing the capability guard.
      if (startTick < saved.player.capability.motorLatencyTicks) throw Error('Test placement precedes motor latency');
      api.importState(saved); return { input: api.getReferenceExperimentInput(), result: api.getPhysicsResult(), state: api.getState() };
    });
    assert.equal(trial.result.authority, 'CORE_REFERENCE_BAT_RESEARCH'); assert.ok(trial.result.contact);
    assert.equal(trial.result.nativeAdmission, false); assert.equal(trial.result.officialResult, null);
    assert.deepEqual(trial.result.flightFrames[0].ball.spin, trial.result.contact.exitSpin);
    assert.deepEqual(trial.result.flightFrames[0].ball.velocity, trial.result.contact.exitVelocity);
    assert.equal(trial.input.referenceTrajectory.transform.scale, 1);
    const negative = await page.evaluate(saved => { saved.player.capability.maximumSweetSpotSpeedMps = .1; saved.player.swing.speedMps = .1;
      try { window.baseballMaker.importState(saved); return false; } catch { return true; } }, trial.state);
    assert.equal(negative, true);
    await page.evaluate(saved => window.baseballMaker.importState(saved), sourceState); await page.evaluate(() => { const api = window.baseballMaker; const clip = window.KneekuraReferenceBatMotions.clips.find(c => c.id === window.KneekuraReferenceBatMotions.defaultClipId); api.seek(clip.contactTimeSeconds); api.setCamera('batter'); });
    await page.screenshot({ path: resolve(evidence, 'measured-' + viewport.width + '.png'), fullPage: true });
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    report.viewports.push({ viewport, fiveCameraSamples: views.length, originalDataUnchanged: true, originalCoreResultAvailable: !!coreBefore.result, jsonPatternsCalibrationLengthContact: 'PASS', networkRequests: 0, pageErrors: 0 });
    await page.close();
  }
  await writeFile(resolve(evidence, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { await browser.close(); }
