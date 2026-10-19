import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const artifact = resolve(process.argv[2] ?? '../../outputs/にーくら野球メーカー_v69_打球比較と拡大版.html'),
  evidence = resolve(process.argv[3] ?? 'docs/verification/releases/v69/maker'),
  sha = value => createHash('sha256').update(value).digest('hex'),
  { chromium } = createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
await mkdir(evidence, { recursive: true });
const report = { pass: false, phase: 'load', artifact, views: [], faults: [],
  scope: 'Actual v69 maker integration: same-pitch four-level comparison, physical profile, common-clock rendering, display-only zoom, JSON and narrow layout. Existing Core and zoom unit tests remain separate.' };
let browser;
const equal = (actual, expected, path = 'value') => {
  if (typeof expected === 'number') assert(Number.isFinite(actual) && Math.abs(actual - expected) <= 1e-9 * Math.max(1, Math.abs(expected)), path);
  else if (expected === null || typeof expected !== 'object') assert.equal(actual, expected, path);
  else { assert.deepEqual(Object.keys(actual).sort(), Object.keys(expected).sort(), path + ' keys');
    for (const key of Object.keys(expected)) equal(actual[key], expected[key], path + '.' + key); }
};
const comparison = page => page.evaluate(() => ({ input: KneekuraBallComparison.getInput(), inspect: KneekuraBallComparison.inspect(),
  result: JSON.parse(JSON.stringify(KneekuraBallComparison.getResult())),
  table: [...document.querySelector('#comparison-results').tBodies[0].rows].map(row => [...row.cells].map(cell => cell.textContent)) }));
const physicsHash = page => page.evaluate(() => JSON.stringify(KneekuraBallComparison.getResult()));
async function checkComparison(page, core) {
  const actual = await comparison(page), result = actual.result, expected = core.compareMeasuredTrajectoriesV69({ pitch: actual.input, afterContactSeconds: 8 });
  assert.equal(result.version, 69); assert.equal(result.cases.length, 4); assert.equal(actual.inspect.error, null);
  assert.deepEqual(result.fixedInput, actual.input); assert.deepEqual(result.invariants, expected.invariants);
  for (const [index, row] of result.cases.entries()) {
    const baseline = result.cases[0].pitch.diagnostics, other = row.pitch.diagnostics;
    for (const key of ['sourceDescriptor', 'timingErrorSeconds', 'aimErrorMeters', 'sweetSpotT', 'zoneJudgment', 'measuredClipId'])
      assert.deepEqual(other[key], baseline[key], 'same pitch / perception / random draws: ' + key);
    equal(row.metrics, expected.cases[index].metrics, 'independent Core metrics ' + row.level);
    equal(row.pitch.contact, expected.cases[index].pitch.contact, 'independent Core collision ' + row.level);
    assert.equal(row.pitch.call, expected.cases[index].pitch.call);
    const m = row.metrics, table = actual.table[index]; assert.equal(table[0], '弾道' + row.level);
    assert.equal(table[2], m.exitSpeedMps === null ? '—' : (m.exitSpeedMps * 3.6).toFixed(1) + ' km/h');
    assert.equal(table[3], m.launchAngleDegrees === null ? '—' : m.launchAngleDegrees.toFixed(1) + '°');
    assert.equal(table[4], m.spinRpm === null ? '—' : m.spinRpm.toFixed(0) + ' rpm');
    assert.equal(table[5], m.carryMeters === null ? row.pitch.contact ? '観測時間内に未着地' : '—' : m.carryMeters.toFixed(1) + ' m');
    if (row.pitch.call === 'swinging_strike') assert.equal(table[1], '空振り');
    if (m.firstGroundSide === 'FOUL_SIDE') assert(table[1].includes('ファウル方向'));
  }
  return actual;
}
async function observeDraw(page, seconds) {
  return page.evaluate(seconds => {
    const result = KneekuraBallComparison.getResult(), input = KneekuraBallComparison.getInput(), settings = KneekuraBallComparison.inspect(),
      colors = ['#1763a6', '#18824d', '#b05200', '#8937a3'], observed = {}, originals = [];
    for (const view of ['side', 'top']) {
      const c = document.getElementById('comparison-canvas-' + view).getContext('2d'), log = { balls: [], bats: [] }; let path = [];
      const old = Object.fromEntries(['beginPath', 'moveTo', 'lineTo', 'arc', 'stroke'].map(key => [key, c[key]])); originals.push(() => Object.assign(c, old));
      c.beginPath = function (...args) { path = []; return old.beginPath.apply(this, args); };
      c.moveTo = function (x, y) { path.push({ x, y }); return old.moveTo.call(this, x, y); };
      c.lineTo = function (x, y) { path.push({ x, y }); return old.lineTo.call(this, x, y); };
      c.arc = function (x, y, radius, ...rest) { if (colors.includes(this.fillStyle)) log.balls.push({ color: this.fillStyle, x, y, radius }); return old.arc.call(this, x, y, radius, ...rest); };
      c.stroke = function (...args) { if ([2, 6].includes(this.lineWidth) && colors.includes(this.strokeStyle) && path.length === 2) log.bats.push({ color: this.strokeStyle, path: [...path] }); return old.stroke.apply(this, args); };
      observed[view] = log;
    }
    try { KneekuraBallComparison.seek(seconds); } finally { originals.forEach(restore => restore()); }
    const points = [{ x: 0, y: 0, z: 0 }, { x: 0, y: 2, z: 18.44 }];
    for (const item of result.cases) { for (const f of item.pitch.frames) { points.push(f.ball.position); if (f.bat) points.push(f.bat.grip, f.bat.tip); }
      for (const f of item.flightFrames) points.push(f.position); }
    const expected = {};
    for (const [view, a, b] of [['side', 'z', 'y'], ['top', 'x', 'z']]) {
      const xs = points.map(p => p[a]), ys = points.map(p => p[b]), minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys),
        cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, scale = Math.min(850 / Math.max(3, maxX - minX), 365 / Math.max(3, maxY - minY)) * settings.zoom,
        project = p => ({ x: 480 + (p[a] - cx) * scale + settings.pan[view].x * 960, y: 245 - (p[b] - cy) * scale + settings.pan[view].y * 480 });
      expected[view] = { balls: [], bats: [], scale };
      for (const item of result.cases) {
        let ball;
        if (item.pitch.contact && seconds >= (item.pitch.contact.tick - input.originTick) / 1e6) ball = item.sampleFlightAtPitchElapsedSeconds(seconds);
        else { const fs = item.pitch.frames, target = input.originTick + seconds * 1e6;
          if (target <= fs.at(-1).tick) { let i = 0; while (i + 1 < fs.length && fs[i + 1].tick <= target) i++;
            const one = fs[i], two = fs[Math.min(i + 1, fs.length - 1)], u = two.tick === one.tick ? 0 : (target - one.tick) / (two.tick - one.tick);
            ball = { visible: one.ball.visible, position: Object.fromEntries(['x', 'y', 'z'].map(k => [k, one.ball.position[k] + (two.ball.position[k] - one.ball.position[k]) * u])) }; } }
        if (ball && ball.visible !== false) expected[view].balls.push({ color: colors[item.level - 1], ...project(ball.position) });
        const bat = item.pitch.sampleBatAtTick(input.originTick + seconds * 1e6);
        if (bat) expected[view].bats.push({ color: colors[item.level - 1], path: [project(bat.grip), project(bat.tip)] });
      }
    }
    return { seconds, inspectClock: KneekuraBallComparison.inspect().clockSeconds, expected, observed };
  }, seconds);
}
try {
  const bytes = await readFile(artifact), metadata = JSON.parse(await readFile(artifact + '.build.json', 'utf8')),
    pins = JSON.parse(await readFile(artifact + '.bundle-inputs.json', 'utf8')),
    initialRoster = JSON.parse(await readFile('docs/demos/live-game-roster-v62.json', 'utf8')),
    catalog = JSON.parse(await readFile('docs/demos/live-game-roster-catalog-v62.json', 'utf8'));
  report.sha256 = sha(bytes); report.coreSha256 = metadata.coreSha256; assert.equal(report.sha256, metadata.sha256);
  for (const [path, expected] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), expected, 'frozen Core input ' + path);
  const bundled = await build({ entryPoints: ['src/integration/browser/workbench-index.ts'], bundle: true, platform: 'node', format: 'esm', write: false }),
    core = await import('data:text/javascript;base64,' + Buffer.from(bundled.outputFiles[0].text).toString('base64'));
  browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  for (const width of [1200, 390]) {
    report.phase = 'default-comparison-' + width;
    const context = await browser.newContext({ viewport: { width, height: 900 }, hasTouch: width === 390, acceptDownloads: true }), page = await context.newPage(),
      faults = { width, errors: [], external: [] }, row = { width }; report.faults.push(faults); report.views.push(row); page.setDefaultTimeout(8000);
    page.on('pageerror', e => faults.errors.push(String(e))); page.on('request', r => { if (!/^(file:|data:|blob:|about:)/.test(r.url())) faults.external.push(r.url()); });
    await page.goto(pathToFileURL(artifact).href); await page.waitForFunction(() => !!globalThis.KneekuraBallComparison && !!globalThis.baseballMaker?.getLiveRoster());
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster);
    await page.locator('#comparison-jump').click(); await page.evaluate(() => KneekuraBallComparison.run());
    const actual = await checkComparison(page, core); row.default = { context: actual.inspect.context, invariants: actual.result.invariants, metrics: actual.inspect.metrics, table: actual.table };
    const projected = core.applyLivePhysicalRosterV1({ players: catalog.players, roster: initialRoster }).players,
      player = projected.find(p => p.playerId === actual.inspect.context.batterId);
    for (const [key, value] of Object.entries(player.physical)) if (!['clipId', 'impactTrajectory', 'swingDecision'].includes(key)) assert.deepEqual(actual.input.batter[key], value, 'selected player physical ' + key);
    assert.equal(actual.input.batter.heightMeters, player.heightMeters); assert.equal(actual.input.batter.bats, player.bats);
    assert.equal(actual.input.batter.swingDecision.approach, 'SWING'); assert.equal(actual.inspect.context.forceSwing, true);
    const expectedDecision = { ...(player.physical.swingDecision ?? { threshold: .5, aggressionWeight: .5 }), approach: 'SWING' };
    assert.deepEqual(actual.input.batter.swingDecision, expectedDecision, 'only the explicit test decision override changes');
    const before = await physicsHash(page);
    for (const seconds of [.15, .55]) {
      const observed = await observeDraw(page, seconds); assert.equal(observed.inspectClock, seconds);
      for (const view of ['side', 'top']) {
        assert.equal(observed.observed[view].balls.length, observed.expected[view].balls.length);
        observed.observed[view].balls.forEach((ball, i) => equal({ color: ball.color, x: ball.x, y: ball.y }, observed.expected[view].balls[i], 'same-clock projected ball'));
        equal(observed.observed[view].bats, observed.expected[view].bats, 'same-clock rigid bats');
      }
      (row.draws ??= []).push({ seconds, ballCounts: Object.fromEntries(['side', 'top'].map(v => [v, observed.observed[v].balls.length])), batCounts: Object.fromEntries(['side', 'top'].map(v => [v, observed.observed[v].bats.length])) });
    }
    await page.evaluate(() => KneekuraBallComparison.setView({ zoom: 2, pan: { side: { x: .1, y: -.1 }, top: { x: -.05, y: .1 } } }));
    await page.locator('#comparison-level').selectOption('4'); assert.equal(await physicsHash(page), before, 'zoom/pan/level never change result');
    await page.locator('#comparison-canvas-side').scrollIntoViewIfNeeded(); const box = await page.locator('#comparison-canvas-side').boundingBox(), oldPan = await page.evaluate(() => KneekuraBallComparison.inspect().pan.side);
    await page.mouse.move(box.x + box.width * .4, box.y + box.height * .5); await page.mouse.down(); await page.mouse.move(box.x + box.width * .4 + 24, box.y + box.height * .5 + 15); await page.mouse.up();
    assert.notDeepEqual(await page.evaluate(() => KneekuraBallComparison.inspect().pan.side), oldPan); assert.equal(await physicsHash(page), before, 'actual drag does not alter Source');
    row.zoomAndDrag = true; await page.evaluate(() => KneekuraBallComparison.setView({ zoom: 1, pan: { side: { x: 0, y: 0 }, top: { x: 0, y: 0 } } }));
    await page.evaluate(() => KneekuraMakerHelp.hide()); const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#comparison-export').click()]), packet = JSON.parse(await readFile(await download.path(), 'utf8'));
    assert.equal(packet.version, 69); assert.deepEqual(packet.input, actual.input); assert.deepEqual(packet.invariants, actual.result.invariants);
    for (const c of packet.cases) equal(c.metrics, actual.result.cases[c.level - 1].metrics, 'export metrics');
    await writeFile(resolve(evidence, 'comparison-record-' + width + '.json'), JSON.stringify(packet, null, 2) + '\n'); row.actualComparisonExport = true;
    await page.locator('#ball-comparison-editor').screenshot({ path: resolve(evidence, 'comparison-' + width + '.png') });
    if (width === 1200) {
      report.phase = 'curve-right'; const right = catalog.players.find(p => p.bats === 'R' && p.role !== 'P');
      await page.locator('#live-roster-player').selectOption(right.playerId); await page.locator('#comparison-pitch-type').selectOption('curve'); await page.evaluate(() => KneekuraBallComparison.run());
      const curve = await checkComparison(page, core); assert.equal(curve.input.pitchType, 'curve'); assert.equal(curve.input.batter.bats, 'R');
      row.curveRight = { playerId: right.playerId, clipId: curve.input.batter.clipId, metrics: curve.inspect.metrics };
    }
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster, 'comparison and browsing preserve all20 authored players');
    report.phase = 'main-zoom-json-' + width; await page.locator('#tab-bat').click();
    const stable = await page.evaluate(() => JSON.stringify({ result: baseballMaker.getPhysicsResult(), frame: baseballMaker.getFrame(), roster: baseballMaker.getLiveRoster() }));
    await page.evaluate(() => baseballMaker.setPreviewDisplay({ zoom: 2, panX: .1, panY: -.1 }));
    assert.equal(await page.evaluate(() => JSON.stringify({ result: baseballMaker.getPhysicsResult(), frame: baseballMaker.getFrame(), roster: baseballMaker.getLiveRoster() })), stable, 'main zoom is display-only');
    const [fullDownload] = await Promise.all([page.waitForEvent('download'), page.locator('#save-json').click()]), full = JSON.parse(await readFile(await fullDownload.path(), 'utf8'));
    assert.deepEqual(full.previewDisplay, { zoom: 2, panX: .1, panY: -.1 });
    await page.evaluate(saved => baseballMaker.importState(saved), full); assert.deepEqual(await page.evaluate(() => baseballMaker.getPreviewDisplay()), full.previewDisplay);
    const legacy = structuredClone(full); delete legacy.previewDisplay;
    await page.evaluate(saved => baseballMaker.importState(saved), legacy); assert.deepEqual(await page.evaluate(() => baseballMaker.getPreviewDisplay()), { zoom: 1, panX: 0, panY: 0 });
    assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster); row.mainZoomAndJson = { physicalUnchanged: true, actualNewDownload: true, newRoundTrip: true, missingLegacyDisplayUsesOne: true };
    await page.locator('#comparison-jump').click(); await page.evaluate(() => KneekuraMakerHelp.hide());
    if (width === 1200) {
      await page.locator('#public-ability-contact').fill('');
      const rejected = await page.evaluate(async () => { try { await KneekuraBallComparison.run(); return null; } catch (error) { return error.message; } });
      assert(rejected?.includes('未確定'), 'a pending ability input must block a comparison of accepted values');
      assert.deepEqual(await page.evaluate(() => baseballMaker.getLiveRoster()), initialRoster, 'rejected input cannot change saved player physics');
      await page.evaluate(roster => baseballMaker.importLiveRoster(roster), initialRoster); await page.evaluate(() => KneekuraBallComparison.run());
      assert.equal((await page.evaluate(() => KneekuraBallComparison.inspect())).ready, true); row.pendingAbilityGuard = { rejected, acceptedAfterRestore: true };
    }
    const help = page.locator('#comparison-force-swing').locator('..').locator('xpath=following-sibling::*[1]');
    await help.scrollIntoViewIfNeeded(); await page.waitForTimeout(80); await page.evaluate(() => KneekuraMakerHelp.hide());
    await help.click(); assert.equal(await page.locator('#maker-help-tooltip-v68').isVisible(), true); assert((await page.locator('#maker-help-tooltip-v68').innerText()).includes('判断だけ'));
    await page.keyboard.press('Escape'); row.help = { immediateQuestionButton: true, oneSecondDelayCoveredByV68HelpReceipt: true };
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(faults.errors, []); assert.deepEqual(faults.external, []); await context.close();
  }
  assert.equal(sha(await readFile(artifact)), report.sha256, 'artifact remained fixed');
  for (const [path, expected] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), expected, 'input remained fixed ' + path);
  report.pass = true; report.phase = 'complete'; console.log(JSON.stringify({ pass: true, sha256: report.sha256, coreSha256: report.coreSha256, widths: [1200, 390] }));
} catch (error) {
  report.error = String(error.stack ?? error); await writeFile(resolve(evidence, 'maker-v69-failure-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify({ pass: false, phase: report.phase, error: String(error) })); process.exitCode = 1;
} finally { if (browser) await browser.close(); await writeFile(resolve(evidence, 'maker-check.json'), JSON.stringify(report, null, 2) + '\n'); }
