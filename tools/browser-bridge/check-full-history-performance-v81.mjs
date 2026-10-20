import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

if (!process.argv[2] || !process.argv[3]) throw Error('Usage: node check-full-history-performance-v81.mjs <normal.html> <output-directory> [baseline-report.json]');
const artifact = resolve(process.argv[2]), output = resolve(process.argv[3]), baselinePath = process.argv[4] ? resolve(process.argv[4]) : null;
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), bytes = await readFile(artifact), artifactSha256 = sha(bytes), meta = JSON.parse(await readFile(artifact + '.build.json'));
assert.equal(meta.sha256, artifactSha256, 'artifact metadata pin');
const baseline = baselinePath ? JSON.parse(await readFile(baselinePath, 'utf8')) : null;
if (baseline) { assert(baseline.pass); assert.equal(baseline.historyAlgorithm, 'SHA256_JSON_RECORD_DIGEST_LIST_V81'); }
const { chromium } = createRequire(import.meta.url)('C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const report = { pass: false, artifact, artifactSha256, coreSha256: meta.sourceCoreSha256, baselinePath,
  historyAlgorithm: 'SHA256_JSON_RECORD_DIGEST_LIST_V81', startedAt: new Date().toISOString(),
  environment: { browser: 'Chrome headless', viewport: { width: 1200, height: 860 }, deviceScaleFactor: 1, actualMobileDevice: false },
  scope: 'Whole canonical history JSON is hashed inside the browser per record and then as an ordered digest list. No physics fields are dropped from a record. UI clocks and random local game IDs are outside Host history. Node helper timing is separate from this application timing.',
  scenarios: [], faults: { errors: [], external: [] } };
await mkdir(output, { recursive: true });
let browser, page, heartbeat, current = { phase: 'launch' };
const checkpoint = async () => { await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2) + '\n'); };
const heap = () => page.evaluate(() => performance.memory ? { usedJSHeapSize: performance.memory.usedJSHeapSize, totalJSHeapSize: performance.memory.totalJSHeapSize, jsHeapSizeLimit: performance.memory.jsHeapSizeLimit } : null);
try {
  heartbeat = setInterval(() => console.log(JSON.stringify({ elapsedMs: Date.now() - Date.parse(report.startedAt), ...current })), 20000);
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-accelerated-2d-canvas', '--enable-precise-memory-info'] });
  page = await browser.newPage({ viewport: report.environment.viewport, deviceScaleFactor: 1 }); page.setDefaultTimeout(120000);
  page.on('pageerror', error => report.faults.errors.push(String(error))); page.on('request', request => { if (!/^(file:|data:|blob:|about:)/.test(request.url())) report.faults.external.push(request.url()); });
  const coldAt = Date.now(); await page.goto(pathToFileURL(artifact).href, { timeout: 120000 });
  await page.waitForFunction(() => globalThis.liveMatchPlayback && globalThis.liveMatchSeasonsV79, undefined, { timeout: 120000 });
  report.coldReadyWallMs = Date.now() - coldAt; report.coldHeap = await heap();
  const initial = await page.evaluate(() => ({ seedText: document.getElementById('match-seed').value, host: liveMatchPlayback.inspect().host.match, generatedPitches: liveMatchPlayback.inspect().generatedPitches }));
  assert.equal(initial.generatedPitches, 0); report.defaultSeedText = initial.seedText;
  report.warmNewGameMs = await page.evaluate(() => { const times = []; for (let i = 0; i < 3; i++) { const start = performance.now(); liveMatchPlayback.newGame(); times.push(performance.now() - start); if (liveMatchPlayback.inspect().error) throw Error(liveMatchPlayback.inspect().error); } return times; });
  report.warmHeap = await heap(); await checkpoint();
  for (const configuration of [{ id: 'default-nine', seedText: initial.seedText, innings: 9 }, { id: 'alternate-three', seedText: 'v81-performance-alternate', innings: 3 }]) {
    current = { phase: 'prepare', scenario: configuration.id };
    const start = await page.evaluate(configuration => {
      const api = liveMatchSeasonsV79, core = KneekuraNativeMatchCore;
      if (api.getState().seasons.length) api.replaceState(core.createLiveSeasonStoreV79());
      document.getElementById('auto-overhead').checked = false;
      for (const [id, value] of [['match-seed', configuration.seedText], ['inning-limit', String(configuration.innings)], ['batting-choice', 'balanced'], ['pitch-choice', 'auto'], ['location-choice', 'auto'], ['managed-team', '0'], ['baserunning-choice', 'balanced']]) {
        const node = document.getElementById(id); node.value = value; if (node.value !== value) throw Error('Unavailable control value ' + id + ':' + value);
      }
      api.command({ kind: 'create', seasonId: configuration.id, name: configuration.id }); api.command({ kind: 'select', seasonId: configuration.id });
      const before = performance.now(); liveMatchPlayback.newGame(); const newGameMs = performance.now() - before;
      if (liveMatchPlayback.inspect().error) throw Error(liveMatchPlayback.inspect().error);
      let closeError = null, replaceError = null; try { api.command({ kind: 'close', seasonId: configuration.id }); } catch (error) { closeError = error.message; }
      try { api.replaceState(core.createLiveSeasonStoreV79()); } catch (error) { replaceError = error.message; }
      return { newGameMs, closeError, replaceError, active: api.inspect().active, roster: JSON.stringify(liveMatchPlayback.inspect().physicalRoster.active) };
    }, configuration);
    assert(start.closeError && start.replaceError); assert.equal(start.active.pitches, 0);
    const scenario = { ...configuration, start: { ...start, roster: undefined, rosterSha256: sha(start.roster) }, progress: [] }; report.scenarios.push(scenario); await checkpoint();
    const generationAt = Date.now(); let finished = false;
    for (let batch = 0; batch < 150; batch++) {
      current = { phase: 'generating', scenario: configuration.id, pitches: scenario.progress.at(-1)?.pitches ?? 0 };
      const next = await page.evaluate(() => {
        const began = performance.now(); let pitches = 0;
        while (pitches < 8 && performance.now() - began < 18000) {
          if (liveMatchPlayback.inspect().host.finished) break;
          document.getElementById('next-pitch').click(); liveMatchPlayback.stop(); pitches++;
          if (liveMatchPlayback.inspect().error) throw Error(liveMatchPlayback.inspect().error);
        }
        const state = liveMatchPlayback.inspect(); return { pitches: state.generatedPitches, finished: state.host.finished, inning: state.host.match.inning, half: state.host.match.half, batchMs: performance.now() - began };
      });
      scenario.progress.push({ ...next, elapsedMs: Date.now() - generationAt }); current = { phase: 'generating', scenario: configuration.id, pitches: next.pitches, inning: next.inning }; await checkpoint();
      if (next.finished) { finished = true; break; }
    }
    assert(finished, configuration.id + ' finished within pitch budget'); scenario.generationWallMs = Date.now() - generationAt;
    current = { phase: 'hashing-full-history', scenario: configuration.id };
    scenario.complete = await page.evaluate(async ({ seasonId, authoredRoster }) => {
      const state = liveMatchPlayback.inspect(), api = liveMatchSeasonsV79, core = KneekuraNativeMatchCore;
      const digest = async value => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, '0')).join('');
      const hashes = []; for (const record of state.host.history) hashes.push(await digest(JSON.stringify(record)));
      const historySha256 = await digest(JSON.stringify({ format: 'SHA256_JSON_RECORD_DIGEST_LIST_V81', recordSha256: hashes }));
      const before = api.getState(), early = api.inspect(); let prematureCloseError = null;
      try { api.command({ kind: 'close', seasonId }); } catch (error) { prematureCloseError = error.message; }
      liveMatchPlayback.seekPresentationMs(state.presentation.durationMs); api.playbackEnded(); api.playbackEnded();
      const store = api.getState(), game = api.exportGame(), fields = state.host.history.filter(record => record.play.field), currentRoster = JSON.stringify(state.physicalRoster.active);
      api.replaceState(core.createLiveSeasonStoreV79()); api.replaceState(JSON.parse(JSON.stringify(store)));
      const roundTripExact = JSON.stringify(store) === JSON.stringify(api.getState()), prior = JSON.stringify(api.getState()); let duplicateError = null;
      try { api.command({ kind: 'record_game', seasonId, game }); } catch (error) { duplicateError = error.message; }
      const duplicateAtomic = prior === JSON.stringify(api.getState()), playerId = game.players[0].playerId,
        totalsBefore = core.getLiveSeasonReportV79({ store: api.getState(), seasonId, playerId }).totals;
      api.command({ kind: 'practice', practiceId: 'practice-' + seasonId, seasonId, playerId, courseId: 33, attempts: 100, quality: .7 });
      const totalsAfter = core.getLiveSeasonReportV79({ store: api.getState(), seasonId, playerId }).totals;
      api.command({ kind: 'close', seasonId });
      return { finished: state.host.finished, match: state.host.match, records: state.host.history.length, generatedPitches: state.generatedPitches, historySha256,
        fieldPlays: fields.length, allFieldComplete: fields.every(record => record.play.field.end.complete),
        error: state.error, legacyFallback: state.legacyResultFallback, rosterUnchanged: authoredRoster === currentRoster,
        embeddedMeasuredClipIds: JSON.parse(document.getElementById('v68-measured-bat-library').textContent).clips.map(clip => clip.id),
        beforeCommitGames: before.seasons.find(season => season.seasonId === seasonId).games.length,
        earlySaved: early.active.saved, prematureCloseError, gamesAfterTwoCommits: store.seasons.find(season => season.seasonId === seasonId).games.length,
        gameRecords: game.records.length, activeSaved: api.inspect().active.saved, roundTripExact, duplicateError, duplicateAtomic,
        practicePublicTotalsUnchanged: JSON.stringify(totalsBefore) === JSON.stringify(totalsAfter), closed: api.getState().seasons.find(season => season.seasonId === seasonId).status };
    }, { seasonId: configuration.id, authoredRoster: start.roster });
    const complete = scenario.complete;
    assert(complete.finished && complete.allFieldComplete && complete.rosterUnchanged); assert.equal(complete.error, null); assert.equal(complete.legacyFallback, false);
    assert.equal(complete.records, complete.generatedPitches); assert.equal(complete.gameRecords, complete.records); assert(complete.fieldPlays > 0);
    assert.equal(complete.embeddedMeasuredClipIds.length, 673); assert.equal(complete.beforeCommitGames, 0); assert.equal(complete.earlySaved, false); assert(complete.prematureCloseError);
    assert.equal(complete.gamesAfterTwoCommits, 1); assert(complete.activeSaved && complete.roundTripExact && complete.duplicateError && complete.duplicateAtomic && complete.practicePublicTotalsUnchanged); assert.equal(complete.closed, 'closed');
    if (baseline) {
      const expected = baseline.scenarios.find(row => row.id === configuration.id); assert(expected); assert.equal(expected.seedText, configuration.seedText); assert.equal(expected.innings, configuration.innings);
      assert.equal(complete.historySha256, expected.complete.historySha256, configuration.id + ' complete canonical history'); assert.deepEqual(complete.match, expected.complete.match); assert.equal(complete.records, expected.complete.records); assert.deepEqual(complete.embeddedMeasuredClipIds, expected.complete.embeddedMeasuredClipIds);
      scenario.baselineWholeHistoryExact = true;
    }
    scenario.heapAfterGame = await heap(); await checkpoint();
  }
  assert.deepEqual(report.faults.errors, []); assert.deepEqual(report.faults.external, []);
  report.artifactSha256AtEnd = sha(await readFile(artifact)); assert.equal(report.artifactSha256AtEnd, artifactSha256, 'artifact stayed pinned during comparison');
  report.pass = true; current = { phase: 'complete' }; await checkpoint();
} catch (error) { report.error = String(error.stack ?? error); await checkpoint(); throw error; }
finally { clearInterval(heartbeat); await browser?.close(); }
console.log(JSON.stringify({ pass: report.pass, artifactSha256, coldReadyWallMs: report.coldReadyWallMs, warmNewGameMs: report.warmNewGameMs, scenarios: report.scenarios.map(row => ({ id: row.id, records: row.complete?.records, historySha256: row.complete?.historySha256, baselineWholeHistoryExact: row.baselineWholeHistoryExact })), report: resolve(output, 'report.json') }));
