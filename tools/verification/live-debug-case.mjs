import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { verifyPinnedLiveCore } from './live-debug-core.mjs';
import { firstDebugDifference, stringifyDebugRecord, parseDebugRecord } from './live-debug-record.mjs';
import { parseDebugCaseArguments, prepareDebugBatchRun, compareDebugBatchResult, runDebugBatchLanes, runDebugBatchBrowserJob } from './live-debug-batch.mjs';
export { prepareDebugBatchJobs, runDebugBatchPool, parseDebugCaseArguments, prepareDebugBatchRun, compareDebugBatchResult, runDebugBatchLanes, runDebugBatchBrowserJob } from './live-debug-batch.mjs';

const sha = bytes => createHash('sha256').update(bytes).digest('hex');

export function replaceDebugPageCore(html, code) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(match => match[1].includes('var KneekuraNativeMatchCore =') && match[1].includes('__toCommonJS'));
  assert.equal(scripts.length, 1, 'one embedded Native Core required');
  const match = scripts[0], start = match.index + match[0].indexOf('>') + 1, end = start + match[1].length;
  assert(!/<\/script/i.test(code), 'Core contains an unsafe inline script terminator');
  return { html: html.slice(0, start) + code.replace(/\n?$/, '\n') + html.slice(end),
    previousCore: match[1].replace(/\n$/, '') };
}

export function replaceDebugPageRuntime(html, code) {
  const scripts = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .filter(match => /^<script\b[^>]*\bid=["']background-match-v116["']/i.test(match[0]));
  assert.equal(scripts.length, 1, 'one embedded background runtime required');
  const match = scripts[0], start = match.index + match[0].indexOf('>') + 1;
  return { html: html.slice(0, start) + code + html.slice(start + match[1].length), previousRuntime: match[1] };
}

/** Passing a multi-million-node encoded tree directly to Playwright makes its
 * protocol serializer build a second graph. JSON text is one protocol value. */
export function debugTransport(packet) {
  if (packet.version === 2) {
    assert(typeof packet.configurationText === 'string' && typeof packet.commandsText === 'string', 'compact debug input text required');
    return { configurationText: packet.configurationText, commandsText: packet.commandsText };
  }
  return { configurationText: JSON.stringify(packet.configuration), commandsText: JSON.stringify(packet.commands) };
}

export function debugDeadline(operation, milliseconds, phase) {
  let timer;
  const expired = new Promise((_, reject) => { timer = setTimeout(() => reject(Error(phase + ' deadline exceeded')), milliseconds); });
  return Promise.race([operation, expired]).finally(() => clearTimeout(timer));
}

export async function captureDebugHarness({ root = process.cwd(), paths = [
  'tools/verification/live-debug-case.mjs', 'tools/verification/live-debug-core.mjs',
  'tools/verification/live-debug-record.mjs', 'tools/verification/live-debug-batch.mjs',
  'tools/browser-bridge/background-match-v116.js',
] } = {}) {
  return Object.fromEntries(await Promise.all(paths.map(async path => [path, sha(await readFile(resolve(root, path)))])));
}

export async function verifyDebugHarness({ root = process.cwd(), pins }) {
  const current = await captureDebugHarness({ root, paths: Object.keys(pins) });
  assert.deepEqual(current, pins, 'harness changed during execution');
}

/** Browser pages are owned here; each evaluate call creates/disposes its own
 * main host or existing single background queue. No Worker runtime is changed. */
export async function runPinnedDebugBatch({ browser, code, runtimeSource, out, plan, report, checkpoint = async () => {}, monitor = () => {} }) {
  report.seedOrder = plan.jobs.map(job => job.seed); report.poolOrder = [...plan.pools];
  report.oracleResults = []; report.poolResults = plan.pools.map(width => ({ width, status: 'not_run',
    jobs: plan.jobs.map(({ jobId, seed }) => ({ jobId, seed, status: 'not_run' })) }));
  report.performancePass = false; report.fullGameVerified = false;
  report.batchRuntimeMode = 'REUSED_PAGE_LANES_WITH_EXISTING_SINGLE_BACKGROUND_QUEUE_PER_JOB';
  report.persistentWorkerPoolClaimed = false; report.createdWorkers = 0;
  const pageWithRuntime = async () => {
    const page = await browser.newPage();
    try {
      monitor(page); await page.addScriptTag({ content: code }); await page.addScriptTag({ content: runtimeSource });
      await page.addScriptTag({ content: 'globalThis.__stringifyDebugRecord=' + stringifyDebugRecord.toString() +
        ';globalThis.__parseDebugRecord=' + parseDebugRecord.toString() + ';' });
      return page;
    } catch (error) {
      try { await debugDeadline(page.close(), 10000, 'batch-setup-page-close'); }
      catch (cleanup) { throw new AggregateError([error, cleanup], 'batch page setup and cleanup failed'); }
      throw error;
    }
  };
  const persist = async (artifact, result, identity) => {
    const directory = resolve(out, artifact); await mkdir(directory);
    const writes = await Promise.allSettled([
      writeFile(resolve(directory, 'records.lossless.json'), result.recordsText + '\n', { flag: 'wx' }),
      writeFile(resolve(directory, 'state.lossless.json'), result.stateText + '\n', { flag: 'wx' }),
    ]);
    const errors = writes.filter(item => item.status === 'rejected').map(item => item.reason);
    if (errors.length) throw new AggregateError(errors, 'batch artifact write failed');
    const { recordsText, stateText, ...measurements } = result;
    const metadata = { ...identity, ...measurements, artifact, recordSha256: sha(recordsText), stateSha256: sha(stateText),
      configurationSha256: identity.configurationSha256, browserVersion: report.browserVersion, coreSha256: report.coreSha256,
      backgroundRuntimeSha256: report.backgroundRuntimeSha256, manifestSha256: report.manifestSha256, inputCaseSha256: report.inputCaseSha256 };
    await writeFile(resolve(directory, 'result.json'), JSON.stringify(metadata, null, 2) + '\n', { flag: 'wx' }); return metadata;
  };
  await mkdir(resolve(out, 'oracle'));
  let oraclePage, oracleFailure, oracleFailed = false;
  try {
    oraclePage = await pageWithRuntime();
    for (const job of plan.jobs) {
      await checkpoint('batch-oracle-' + job.jobId); const started = performance.now();
      const result = await debugDeadline(oraclePage.evaluate(runDebugBatchBrowserJob, { job, background: false, code }), 180000, 'batch-oracle-' + job.jobId);
      const metadata = await persist('oracle/' + job.jobId, result, { jobId: job.jobId, seed: job.seed, mode: 'MAIN_HOST_NO_RENDER',
        configurationSha256: sha(job.configurationText), commandsSha256: sha(job.commandsText), wallMs: performance.now() - started });
      report.oracleResults.push(metadata);
    }
  } catch (error) { oracleFailed = true; oracleFailure = error; }
  try { await debugDeadline(Promise.resolve().then(() => oraclePage?.close()), 10000, 'batch-oracle-page-close'); }
  catch (error) { oracleFailure = new AggregateError([...(oracleFailed ? [oracleFailure] : []), error], 'batch oracle or cleanup failed'); oracleFailed = true; }
  if (oracleFailed) throw oracleFailure;
  for (const [index, width] of plan.pools.entries()) {
    await checkpoint('batch-pool-' + width); await mkdir(resolve(out, 'pool-' + width));
    const outcomes = new Map(), lanes = [], started = performance.now();
    const pool = await runDebugBatchLanes(plan.jobs, width, async slot => {
      const page = await pageWithRuntime(); let closed = false;
      const lane = { page, slot, workers: 0, close: async () => { if (closed) return; closed = true; await debugDeadline(page.close(), 10000, 'batch-lane-page-close'); } };
      page.on('worker', () => lane.workers++); lanes.push(lane); return lane;
    }, async (job, lane, slot) => {
      const jobStarted = performance.now(), workersBefore = lane.workers;
      const result = await debugDeadline(lane.page.evaluate(runDebugBatchBrowserJob, { job, background: true, code }), 180000, 'batch-worker-' + job.jobId);
      const metadata = await persist('pool-' + width + '/' + job.jobId, result, { jobId: job.jobId, seed: job.seed, mode: 'BACKGROUND_QUEUE', width, slot,
        configurationSha256: sha(job.configurationText), commandsSha256: sha(job.commandsText), createdWorkers: lane.workers - workersBefore, wallMs: performance.now() - jobStarted });
      const savedOracle = report.oracleResults.find(value => value.jobId === job.jobId);
      const readOracle = async (name, expectedHash) => {
        const text = await readFile(resolve(out, 'oracle', job.jobId, name), 'utf8');
        assert(text.endsWith('\n'), 'saved oracle framing differs'); const encoded = text.slice(0, -1);
        assert.equal(sha(encoded), expectedHash, 'saved oracle changed during execution'); return encoded;
      };
      const oracle = { recordsText: await readOracle('records.lossless.json', savedOracle.recordSha256),
        stateText: await readOracle('state.lossless.json', savedOracle.stateSha256) };
      const comparison = compareDebugBatchResult(oracle, result); outcomes.set(job.jobId, { ...metadata, comparison });
      await writeFile(resolve(out, 'pool-' + width, job.jobId, 'comparison.json'), JSON.stringify(comparison, null, 2) + '\n', { flag: 'wx' });
      assert(result.ownedDisposalCompleted, 'batch job ownership not disposed');
      assert(result.count === 0 || metadata.createdWorkers > 0, 'a real browser Worker must be created for each nonempty background job');
      if (!comparison.pass) throw Error('batch pool ' + width + ' ' + job.jobId + ' differs at ' + comparison.firstDifference.path);
      return outcomes.get(job.jobId);
    });
    report.createdWorkers += lanes.reduce((count, lane) => count + lane.workers, 0);
    report.poolResults[index] = { ...pool, status: pool.pass ? 'fulfilled' : 'failed', wallMs: performance.now() - started,
      jobs: pool.jobs.map(job => ({ ...job, ...(outcomes.has(job.jobId) ? { artifactResult: outcomes.get(job.jobId) } : {}) })) };
    const mismatch = report.poolResults[index].jobs.find(job => job.artifactResult?.comparison.pass === false);
    if (mismatch && !report.firstDifference) report.firstDifference = { poolWidth: width, jobId: mismatch.jobId, seed: mismatch.seed, ...mismatch.artifactResult.comparison.firstDifference };
    if (!pool.pass) throw Error('batch pool ' + width + ' failed; remaining pools not admitted');
  }
  return { seedOrder: report.seedOrder, poolOrder: report.poolOrder, oracleResults: report.oracleResults, poolResults: report.poolResults };
}

async function main(args) {
  const preparationStarted = performance.now();
  const options = parseDebugCaseArguments(args), mode = options.mode;
  const harnessPins = await captureDebugHarness();
  const { manifest, code } = await verifyPinnedLiveCore({ manifestPath: options.manifest });
  const runtimeSource = await readFile('tools/browser-bridge/background-match-v116.js', 'utf8');
  const out = resolve(options.out); await mkdir(out);
  const inputCaseBytes = options.case ? await readFile(options.case) : null;
  const inputCase = inputCaseBytes ? JSON.parse(inputCaseBytes.toString('utf8')) : null;
  const count = Number(options.count ?? inputCase?.count ?? 2);
  assert(Number.isSafeInteger(count) && count > 0 && count <= 2000, 'count must be 1..2000');
  const report = { pass: false, version: 2, mode, count, coreSha256: manifest.entry.sha256,
    harnessPins, harnessPinMode: 'START_AND_END_CURRENT_FILE_SHA', inputPreparationMs: performance.now() - preparationStarted,
    backgroundRuntimeSha256: sha(runtimeSource), cases: [], errors: [], networkRequests: [],
    nativeAdmission: false, fullGameVerified: false, crossRuntimeEquivalenceClaimed: false, performancePass: false,
    inputCaseSha256: inputCaseBytes ? sha(inputCaseBytes) : null, manifestSha256: sha(await readFile(options.manifest)) };
  const batchPlan = mode === 'batch' ? prepareDebugBatchRun({ packet: inputCase, seeds: options.seeds, pools: options.pools, count,
    coreSha256: report.coreSha256, backgroundRuntimeSha256: report.backgroundRuntimeSha256, browserVersion: inputCase?.browserVersion }) : null;
  let browser, packet, page;
  const checkpoint = async phase => {
    report.currentPhase = phase;
    report.heapUsedBytes = process.memoryUsage().heapUsed;
    await writeFile(resolve(out, 'progress.json'), JSON.stringify(report, null, 2) + '\n');
  };
  const { chromium } = createRequire(import.meta.url)(
    'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
  try {
    await checkpoint('launch-browser');
    browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    report.browserVersion = browser.version();
    const monitor = p => {
      p.on('pageerror', error => report.errors.push(error.message));
      p.on('request', request => { if (/^https?:/.test(request.url())) report.networkRequests.push(request.url()); });
    };
    if (mode === 'batch') {
      assert.equal(inputCase.browserVersion, report.browserVersion, 'debug case Chrome build differs');
      await runPinnedDebugBatch({ browser, code, runtimeSource, out, plan: batchPlan, report, checkpoint, monitor });
    } else {
    let expectedText;
    if (mode === 'parity') {
      const original = await readFile(resolve(options.html), 'utf8'), corePage = replaceDebugPageCore(original, code),
        patched = replaceDebugPageRuntime(corePage.html, runtimeSource);
      report.originalHtmlSha256 = sha(original); report.previousCoreSha256 = sha(corePage.previousCore);
      report.previousBackgroundRuntimeSha256 = sha(patched.previousRuntime);
      report.candidateHtmlSha256 = sha(patched.html);
      const candidate = resolve(out, 'game.html'); await writeFile(candidate, patched.html, { flag: 'wx' });
      for (const speed of ['normal-1x', 'finish-ui']) {
        await checkpoint(speed);
        page = await browser.newPage({ viewport: { width: 1200, height: 1000 } }); monitor(page);
        await page.addInitScript({ content: 'globalThis.__stringifyDebugRecord=' + stringifyDebugRecord.toString() + ';' +
          'const originalPost=Worker.prototype.postMessage;Worker.prototype.postMessage=function(m,...args){' +
          'if(m.kind==="init"&&!globalThis.__debugConfiguration)globalThis.__debugConfiguration=structuredClone(m.configuration);' +
          'return originalPost.call(this,m,...args);};' });
        await page.goto(pathToFileURL(candidate).href, { timeout: 90000 });
        await page.waitForFunction(() => globalThis.liveMatchPlayback?.inspect().host);
        await page.locator('#speed').selectOption('1');
        const started = performance.now();
        await page.evaluate(({ speed, count }) => {
          globalThis.__debugReached = false;
          const timer = setInterval(() => {
            const state = liveMatchPlayback.inspect();
            if (state.error || state.host.finished || state.generatedPitches >= count + (speed === 'normal-1x' ? 1 : 0)) {
              liveMatchPlayback.stop(); if (state.fast) void liveMatchPlayback.finish();
              clearInterval(timer); globalThis.__debugReached = true;
            }
          }, 5);
          if (speed === 'normal-1x') void liveMatchPlayback.play(); else void liveMatchPlayback.finish();
        }, { speed, count });
        await page.waitForFunction(() => globalThis.__debugReached, null, { timeout: 180000 });
        const captured = await page.evaluate(count => {
          const state = liveMatchPlayback.inspect(); if (state.error) throw Error(state.error);
          const records = state.host.history.slice(0, count);
          if (records.length !== count || !globalThis.__debugConfiguration) throw Error('debug prefix/configuration not captured');
          return { configurationText: __stringifyDebugRecord(__debugConfiguration), recordsText: __stringifyDebugRecord(records),
            commandsText: __stringifyDebugRecord(records.map(row => row.command)), fieldPlays: records.filter(record => !!record.play.field).length,
            contacts: records.filter(record => !!record.play.contact).length };
        }, count);
        if (speed === 'normal-1x') {
          expectedText = captured.recordsText;
          packet = { version: 2, count, browserVersion: report.browserVersion, coreSha256: report.coreSha256,
            capturedByHarness: harnessPins,
            backgroundRuntimeSha256: report.backgroundRuntimeSha256, configurationText: captured.configurationText,
            commandsText: captured.commandsText, expectedRecordsText: expectedText };
          // A later UI/Worker failure must retain the original reproducible case.
          await writeFile(resolve(out, 'case.json'), JSON.stringify(packet) + '\n', { flag: 'wx' });
        } else {
          const difference = packet.configurationText !== captured.configurationText
            ? firstDebugDifference(parseDebugRecord(packet.configurationText), parseDebugRecord(captured.configurationText))
            : expectedText !== captured.recordsText ? firstDebugDifference(parseDebugRecord(expectedText), parseDebugRecord(captured.recordsText)) : null;
          if (difference) {
            report.firstDifference = { mode: speed, ...difference };
            await writeFile(resolve(out, 'different-ui-records.json'), captured.recordsText, { flag: 'wx' });
            throw Error('finish UI differs from normal playback');
          }
        }
        report.cases.push({ mode: speed, count, matched: true, wallMs: performance.now() - started,
          fieldPlays: captured.fieldPlays, contacts: captured.contacts });
        await page.close(); page = null;
      }
    } else {
      assert(inputCase?.version === 2 && inputCase.count === count, 'debug case count/version differs');
      assert.equal(inputCase.coreSha256, report.coreSha256, 'debug case Core differs');
      assert.equal(inputCase.backgroundRuntimeSha256, report.backgroundRuntimeSha256, 'debug case Worker runtime differs');
      assert.equal(inputCase.browserVersion, report.browserVersion, 'debug case Chrome build differs');
      packet = inputCase;
      expectedText = packet.expectedRecordsText;
      assert(parseDebugRecord(packet.commandsText).length === count && typeof expectedText === 'string', 'debug case records differ');
    }
    await checkpoint('prepare-string-transport');
    const transport = debugTransport(packet);
    report.configurationSha256 = sha(transport.configurationText);
    packet.configurationText = null; packet.commandsText = null;
    await checkpoint('open-no-render-page');
    page = await browser.newPage(); monitor(page); let workers = 0;
    page.on('worker', () => workers++);
    await page.addScriptTag({ content: code }); await page.addScriptTag({ content: runtimeSource });
    await page.addScriptTag({ content: 'globalThis.__stringifyDebugRecord=' + stringifyDebugRecord.toString() +
      ';globalThis.__parseDebugRecord=' + parseDebugRecord.toString() + ';' });
    for (const route of ['same-Chrome-no-render', 'same-Chrome-resume-each-pitch', 'same-Chrome-background-worker']) {
      await checkpoint(route);
      const routeStarted = performance.now();
      const result = await debugDeadline(page.evaluate(async ({ route, configurationText, commandsText, code }) => {
        const decodeStarted = performance.now();
        const configuration = __parseDebugRecord(configurationText), commands = __parseDebugRecord(commandsText);
        const phaseMs = { decode: performance.now() - decodeStarted, initialization: 0, resumeInitialization: 0,
          issuePitch: 0, continuationCapture: 0, recordEncoding: 0 };
        const core = KneekuraNativeMatchCore, times = [], records = [];
        const initializationStarted = performance.now();
        let host = core.createLiveBaseballMatchV1(configuration), continuation;
        if (route === 'same-Chrome-background-worker') host = KneekuraBackgroundMatchV116.create({
          configuration, initialHost: host, coreSource: code, lookAhead: 1, warmup: 1 });
        phaseMs.initialization = performance.now() - initializationStarted;
        try {
          for (const command of commands) {
            const start = performance.now();
            if (route === 'same-Chrome-resume-each-pitch') host = core.createLiveBaseballMatchWorkerV116(configuration, continuation);
            const issueStarted = performance.now(); phaseMs.resumeInitialization += issueStarted - start;
            records.push(await host.issuePitch(command));
            const captureStarted = performance.now(); phaseMs.issuePitch += captureStarted - issueStarted;
            if (route === 'same-Chrome-resume-each-pitch') continuation = host.captureContinuationV116();
            phaseMs.continuationCapture += performance.now() - captureStarted;
            times.push(performance.now() - start);
          }
          const encodingStarted = performance.now(), encoded = __stringifyDebugRecord(records);
          phaseMs.recordEncoding = performance.now() - encodingStarted;
          return { encoded, times, phaseMs, count: records.length, contacts: records.filter(record => !!record.play.contact).length,
            fieldPlays: records.filter(record => !!record.play.field).length };
        } finally { host.dispose?.(); }
      }, { route, ...transport, code }), 180000, route);
      const difference = expectedText !== result.encoded
        ? firstDebugDifference(parseDebugRecord(expectedText), parseDebugRecord(result.encoded)) : null;
      assert.equal(result.count, count, 'debug execution count differs');
      if (difference) {
        report.firstDifference = { mode: route, ...difference };
        await writeFile(resolve(out, 'different-records.json'), result.encoded, { flag: 'wx' });
        throw Error(route + ' differs from recorded normal playback');
      }
      report.cases.push({ mode: route, count, matched: true, perPitchMs: result.times, wallMs: performance.now() - routeStarted,
        phaseMs: result.phaseMs, recordSha256: sha(result.encoded), fieldPlays: result.fieldPlays, contacts: result.contacts });
    }
    assert(workers > 0, 'a real browser Worker must be created'); report.createdWorkers = workers;
    }
    assert.deepEqual(report.errors, []); assert.deepEqual(report.networkRequests, []);
    await verifyDebugHarness({ pins: harnessPins });
    await verifyPinnedLiveCore({ manifestPath: options.manifest });
    if (mode === 'batch') {
      assert.equal(sha(await readFile(options.case)), report.inputCaseSha256, 'saved batch case changed during execution');
      assert.equal(sha(await readFile(options.manifest)), report.manifestSha256, 'batch manifest changed during execution');
      report.chromeComparisonCompleted = true;
    }
    report.pass = true;
  } catch (error) {
    report.error = String(error?.stack ?? error); process.exitCode = 1;
  } finally {
    const cleanup = await Promise.allSettled([
      debugDeadline(Promise.resolve().then(() => page?.close()), 10000, 'page-close'),
      debugDeadline(Promise.resolve().then(() => browser?.close()), 10000, 'browser-close'),
    ]);
    if (mode === 'batch') {
      const pinChecks = await Promise.allSettled([verifyDebugHarness({ pins: harnessPins }), verifyPinnedLiveCore({ manifestPath: options.manifest }),
        readFile(options.case).then(bytes => assert.equal(sha(bytes), report.inputCaseSha256, 'saved batch case changed during execution')),
        readFile(options.manifest).then(bytes => assert.equal(sha(bytes), report.manifestSha256, 'batch manifest changed during execution'))]);
      report.endPinErrors = pinChecks.filter(item => item.status === 'rejected').map(item => String(item.reason));
      if (report.endPinErrors.length) { report.pass = false; process.exitCode = 1; }
    }
    report.cleanupErrors = cleanup.filter(item => item.status === 'rejected').map(item => String(item.reason));
    if (report.cleanupErrors.length) { report.pass = false; process.exitCode = 1; }
    await writeFile(resolve(out, 'report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  }
  console.log(JSON.stringify({ pass: report.pass, mode, count, browserVersion: report.browserVersion,
    cases: report.cases.length, firstDifference: report.firstDifference, error: report.error }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main(process.argv.slice(2));
