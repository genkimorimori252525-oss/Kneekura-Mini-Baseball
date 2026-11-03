import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const { chromium } = createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const normal = resolve(process.argv[2] ?? '../../outputs/ばせぼーるlv75_TBD_vs_LAD_技術得能接続版.html'),
  lab = resolve(process.argv[3] ?? '../../outputs/カメラワーク調整室_v75.html'),
  evidence = resolve(process.argv[4] ?? 'docs/verification/releases/v75/game'),
  sha = bytes => createHash('sha256').update(bytes).digest('hex');
const report = { pass: false, phase: 'load', normal, lab, faults: [], cases: [],
  scope: 'Frozen v74 exact six-pitch regression, zero/off technique regression, real six-technique roster import and pitch execution, one full regulation game, normal/lab PC and mobile-width browser checks.' };
let browser;
await mkdir(evidence, { recursive: true });
const watch = (page, label) => {
  const f = { label, errors: [], external: [] }; report.faults.push(f);
  page.on('pageerror', error => f.errors.push(String(error)));
  page.on('request', request => { if (!/^(file:|data:|blob:|about:)/.test(request.url())) f.external.push(request.url()); });
};
const open = async (page, path, workbench = false) => {
  await page.goto(pathToFileURL(path).href, { timeout: 60000 });
  await page.waitForFunction(workbench => workbench ? globalThis.KneekuraCameraLab?.inspect().ready : globalThis.liveMatchPlayback, workbench, { timeout: 60000 });
};
const generate = (page, count = 1) => page.evaluate(count => {
  const auto = document.getElementById('auto-overhead'); auto.checked = false; auto.dispatchEvent(new Event('change'));
  for (let i = 0; i < count; i++) {
    document.getElementById('next-pitch').click(); liveMatchPlayback.stop();
    const state = liveMatchPlayback.inspect(); if (state.error) throw Error(state.error);
  }
}, count);
const history = page => page.evaluate(() => liveMatchPlayback.inspect().host.history);
const stable = page => page.evaluate(() => { const s = liveMatchPlayback.inspect(); return { pending: s.physicalRoster.pending, active: s.physicalRoster.active, host: s.host }; });
const load = async (page, packet) => {
  await page.locator('#physical-roster-status').evaluate(e => delete e.dataset.error);
  await page.locator('#physical-roster-file').setInputFiles({ name: 'v75-technical-roster.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(packet)) });
  await page.waitForFunction(() => document.getElementById('physical-roster-status').dataset.error !== undefined);
  return page.locator('#physical-roster-status').evaluate(e => ({ error: e.dataset.error, message: e.textContent }));
};
const command = (page, values) => page.evaluate(values => {
  for (const [id, value] of Object.entries(values)) {
    const element = document.getElementById(id); element.value = value; element.dispatchEvent(new Event('change'));
  }
}, values);

try {
  const metadata = JSON.parse(await readFile(normal + '.build.json', 'utf8')),
    pins = JSON.parse(await readFile(normal + '.bundle-inputs.json', 'utf8'));
  report.normalSha256 = sha(await readFile(normal)); report.workbenchSha256 = sha(await readFile(lab)); report.coreSha256 = pins.entrySha256;
  assert.equal(metadata.sha256, report.normalSha256); assert.equal(metadata.sourceCoreSha256, pins.entrySha256);
  assert.equal(metadata.technicalTraitsConnected, true); assert.equal(metadata.ordinaryCadenceMs, 55); assert.equal(metadata.pitchBallCadenceMs, 22);
  for (const [path, hash] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), hash, 'source pin ' + path);
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-accelerated-2d-canvas'] });
  report.phase = 'frozen-v74-prefix';
  const old = await browser.newPage({ viewport: { width: 1200, height: 860 } }); watch(old, 'frozen-v74');
  await open(old, resolve('docs/demos/releases/v74/game.html')); await generate(old, 6);
  const baseline = await history(old), initial = await old.evaluate(() => liveMatchPlayback.inspect().physicalRoster.active),
    settings = await old.evaluate(() => { const p = liveMatchPlayback.inspect().presentation; return { ballDisplay: p.ballDisplay, nameDisplay: p.nameDisplay, timing: p.timing }; });
  report.baseline = { actualRecords: baseline.length, sourceBatRuleSha256: sha(JSON.stringify(baseline)) }; await old.close();
  const page = await browser.newPage({ viewport: { width: 1200, height: 860 } }); watch(page, 'normal-v75');
  report.phase = 'default-prefix'; await open(page, normal); await generate(page, 6);
  assert.deepEqual(await history(page), baseline, 'all six Source, bat, field and adjudication records equal frozen v74');
  assert.deepEqual(await page.evaluate(() => liveMatchPlayback.inspect().physicalRoster.active), initial);
  assert.deepEqual(await page.evaluate(() => { const p = liveMatchPlayback.inspect().presentation; return { ballDisplay: p.ballDisplay, nameDisplay: p.nameDisplay, timing: p.timing }; }), settings);
  report.defaultPrefix = { records: 6, sourceBatRulesExact: true, initialRosterSame: true, presentationSame: true };
  report.phase = 'author-all-techniques';
  const packets = await page.evaluate(initial => {
    const core = KneekuraNativeMatchCore, definitions = core.getLiveTraitCatalogV1({ includeTechnical: true });
    if (definitions.length !== 13) throw Error('Expected 13 executable families');
    const families = ['baserunning', 'bunting', 'advanced_fielding', 'bat_to_run_transition', 'slow_ball_charge', 'low_zone_command'];
    let active = structuredClone(initial), zero = structuredClone(initial), off = structuredClone(initial);
    for (const entry of initial.entries) for (const familyId of families) {
      const stateId = familyId === 'baserunning' ? 'GOLD' : familyId === 'slow_ball_charge' ? 'LEARNED' : 'MASTERED';
      active = core.setLiveTraitProfileV1({ roster: active, playerId: entry.playerId, familyId, stateId, source: { effectScale: 1 } }).roster;
      zero = core.setLiveTraitProfileV1({ roster: zero, playerId: entry.playerId, familyId, stateId, source: { effectScale: 0 } }).roster;
      off = core.setLiveTraitProfileV1({ roster: off, playerId: entry.playerId, familyId, stateId: null, source: { effectScale: 1 } }).roster;
    }
    return { active, zero, off, families, catalog: definitions.map(d => ({ familyId: d.familyId, states: d.states.map(s => s.stateId) })) };
  }, initial);
  report.catalog = packets.catalog;
  for (const packet of [packets.active, packets.zero, packets.off]) {
    assert.equal(packet.entries.length, 20);
    for (const entry of packet.entries) assert.deepEqual(entry.physical, initial.entries.find(e => e.playerId === entry.playerId).physical, 'authoring traits does not alter stored physical SI');
  }
  report.phase = 'zero-off-prefix';
  for (const name of ['zero', 'off']) {
    assert.equal((await load(page, packets[name])).error, 'false'); await page.evaluate(() => liveMatchPlayback.newGame()); await generate(page, 6);
    assert.deepEqual(await history(page), baseline, name + ' six-pitch actual records remain exact');
    assert.deepEqual(await page.evaluate(() => liveMatchPlayback.inspect().physicalRoster.active), packets[name]);
    report.cases.push({ name, records: 6, sourceBatRulesExact: true, packetPreserved: true });
  }
  report.phase = 'active-import-json'; assert.equal((await load(page, packets.active)).error, 'false');
  await page.evaluate(() => liveMatchPlayback.newGame());
  assert.deepEqual(await page.evaluate(() => liveMatchPlayback.inspect().physicalRoster.active), packets.active);
  if (await page.locator('#roster-controls').getAttribute('open') === null) await page.locator('#roster-controls > summary').click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#save-physical-roster').click()]),
    saved = JSON.parse(await readFile(await download.path(), 'utf8'));
  assert.deepEqual(saved, packets.active, 'ordinary HTML export preserves all 120 technical selections');
  report.json = { players: 20, technicalSelections: 120, packetPreserved: true, saveRoundTrip: true, filename: download.suggestedFilename() };
  report.phase = 'invalid-import-atomic';
  for (const [name, mutate] of [['unknown-family', p => { p.entries[0].traitProfile.selections.at(-1).familyId = 'unknown-technique'; }],
    ['unknown-state', p => { p.entries[0].traitProfile.selections.at(-1).stateId = 'UNRECOGNIZED'; }],
    ['invalid-strength', p => { p.entries[0].traitProfile.selections.at(-1).source.effectScale = 2.001; }]]) {
    const packet = structuredClone(packets.active); mutate(packet); const before = await stable(page);
    const status = await load(page, packet); assert.equal(status.error, 'true'); assert.deepEqual(await stable(page), before, name + ' rejected without replacing Host');
    report.cases.push({ name, ...status, atomic: true });
  }
  report.phase = 'bunt-execution'; await command(page, { 'managed-team': '0', 'batting-choice': 'bunt' });
  let bunt;
  for (let i = 0; i < 8 && !bunt; i++) { await generate(page); const record = await page.evaluate(() => liveMatchPlayback.inspect().host.history.at(-1)); if (record.play.diagnostics.buntTechnique) bunt = record; }
  assert(bunt, 'actual ordinary managed bunt reaches dedicated technique motor');
  const motor = bunt.play.diagnostics.buntTechnique; assert(motor.maximumSurfaceSpeedMps <= motor.maximumSpeedMps + 1e-10);
  assert.equal(motor.postContactResultOverride, false); assert.equal(bunt.play.diagnostics.sourceBallReanchored, false);
  const movingBats = bunt.frames.filter(f => f.phase === 'pitch' && f.bat).map(f => f.bat);
  assert(movingBats.length > 2); assert(movingBats.some(b => Math.hypot(b.grip.x - movingBats[0].grip.x, b.grip.y - movingBats[0].grip.y, b.grip.z - movingBats[0].grip.z) > .01));
  report.bunt = { batter: bunt.batterPlayerId, classification: bunt.play.classification, motor, movingBats: movingBats.length, actualContact: !!bunt.play.contact };
  report.phase = 'low-command-execution'; await command(page, { 'managed-team': '1', 'batting-choice': 'auto', 'pitch-choice': 'fastball', 'location-choice': 'low' });
  await generate(page); const low = await page.evaluate(() => liveMatchPlayback.inspect().host.history.at(-1));
  assert(low.play.diagnostics.lowZoneCommandTechnique); assert.equal(low.play.diagnostics.lowZoneCommandTechnique.releaseVelocityOnly, true);
  assert(low.play.diagnostics.lowZoneCommandTechnique.effectiveStandardDeviationMeters < low.play.diagnostics.lowZoneCommandTechnique.baselineStandardDeviationMeters);
  report.lowCommand = { pitcher: low.pitcherPlayerId, diagnostics: low.play.diagnostics.lowZoneCommandTechnique, actualPhysicalPitch: true };
  await page.screenshot({ path: resolve(evidence, 'normal-1200.png'), fullPage: true });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  report.phase = 'regulation-with-techniques';
  await command(page, { 'managed-team': '1', 'batting-choice': 'auto', 'pitch-choice': 'auto', 'location-choice': 'auto', 'baserunning-choice': 'balanced' });
  assert.equal((await load(page, packets.active)).error, 'false'); await page.evaluate(() => { liveMatchPlayback.newGame(); void liveMatchPlayback.finish(); });
  const start = Date.now(); let latest = 0;
  console.log(JSON.stringify({ phase: report.phase, coreSha256: report.coreSha256 }));
  while (true) {
    const state = await page.evaluate(() => { const s = liveMatchPlayback.inspect(); return { error: s.error, errorDetails: s.errorDetails, finished: s.host.finished, fast: s.fast, pitches: s.generatedPitches, match: s.host.match }; });
    if (state.error) { report.regulationFailure = state; throw Error(state.error); }
    if (state.pitches >= latest + 25) { latest = state.pitches; console.log(JSON.stringify({ phase: 'regulation', pitches: state.pitches, inning: state.match.inning, elapsedMs: Date.now() - start })); }
    if (state.finished) { report.regulation = { ...state, elapsedMs: Date.now() - start }; break; }
    assert(Date.now() - start < 240000, 'technical match exceeded browser verification time budget'); assert(state.pitches < 500, 'technical match exceeded 500-pitch audit budget');
    await new Promise(r => setTimeout(r, 750));
  }
  assert(report.regulation.match.inning >= 9); assert(report.regulation.pitches > 54);
  report.regulation.records = await page.evaluate(async () => {
    const records = liveMatchPlayback.inspect().host.history,
      bytes = new TextEncoder().encode(JSON.stringify(records)), digest = await crypto.subtle.digest('SHA-256', bytes);
    return { count: records.length, contacts: records.filter(r => r.play.contact).length,
      fieldPlays: records.filter(r => r.play.field).length, allFieldsComplete: records.filter(r => r.play.field).every(r => r.play.field.end.complete),
      lowCommandPitches: records.filter(r => r.play.diagnostics.lowZoneCommandTechnique).length,
      technicalFieldInputs: records.filter(r => r.play.field?.diagnostics && JSON.stringify(r.play.field.diagnostics).includes('technicalSkills')).length,
      sourceBatRuleSha256: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('') };
  });
  assert(report.regulation.records.contacts > 5); assert.equal(report.regulation.records.allFieldsComplete, true);
  assert(report.regulation.records.lowCommandPitches > 0);
  assert.deepEqual(await page.evaluate(() => liveMatchPlayback.inspect().physicalRoster.active), packets.active, 'playing a whole game does not rewrite authored strengths');
  await page.setViewportSize({ width: 390, height: 860 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.screenshot({ path: resolve(evidence, 'normal-390.png'), fullPage: true }); await page.close();
  report.phase = 'lab'; const labPage = await browser.newPage({ viewport: { width: 1200, height: 860 } }); watch(labPage, 'lab-v75');
  await open(labPage, lab, true); await labPage.evaluate(() => KneekuraCameraLab.generate(1));
  assert.equal(await labPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await labPage.screenshot({ path: resolve(evidence, 'lab-1200.png'), fullPage: true });
  await labPage.setViewportSize({ width: 390, height: 860 }); assert.equal(await labPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await labPage.screenshot({ path: resolve(evidence, 'lab-390.png'), fullPage: true }); await labPage.close();
  for (const f of report.faults) { assert.deepEqual(f.errors, [], f.label + ' page errors'); assert.deepEqual(f.external, [], f.label + ' external requests'); }
  for (const [path, hash] of Object.entries(pins.inputs)) assert.equal(sha(await readFile(path)), hash, 'final source pin ' + path);
  assert.equal(sha(await readFile(normal)), report.normalSha256); assert.equal(sha(await readFile(lab)), report.workbenchSha256);
  report.pass = true; report.phase = 'complete';
  console.log(JSON.stringify({ pass: true, normalSha256: report.normalSha256, workbenchSha256: report.workbenchSha256, pitches: report.regulation.pitches, contacts: report.regulation.records.contacts }));
} catch (error) {
  report.error = String(error.stack ?? error);
  await writeFile(resolve(evidence, 'game-failure-' + Date.now() + '.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(JSON.stringify({ pass: false, phase: report.phase, error: String(error), regulationFailure: report.regulationFailure })); process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await writeFile(resolve(evidence, 'game-check.json'), JSON.stringify(report, null, 2) + '\n');
}
