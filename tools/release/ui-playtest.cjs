// Drives the real game UI in Chrome and reports how far a game gets.
// usage: node ui-playtest.cjs <game.html> [--pitches=N] [--seed=S] [--pitcher=robin|default] [--stadium=ID]
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [file, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
const limit = Number(opt.pitches ?? 400), seed = opt.seed ?? 'playtest-1', perPitch = Number(opt.timeout ?? 180000);

(async () => {
  const html = fs.readFileSync(file);
  const server = http.createServer((q, r) => {
    r.writeHead(q.url === '/favicon.ico' ? 204 : 200, {'Content-Type': 'text/html;charset=utf-8'});
    r.end(q.url === '/favicon.ico' ? '' : html);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const crashed = reason => {console.log('CRASH', reason); process.exit(3);};
  page.on('crash', () => crashed('page'));
  browser.on('disconnected', () => crashed('browser'));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.liveMatchPlayback);
  if (opt.pitcher) await page.selectOption('#home-pitcher-choice', opt.pitcher);
  if (opt.stadium) await page.selectOption('#stadium-choice', opt.stadium).catch(() => {});
  await page.locator('#match-seed').fill(seed);
  await page.locator('#fixed-seed').check();
  await page.click('#new-game');
  await page.selectOption('#managed-team', '0').catch(() => {});
  const log = [];
  for (let n = 1; n <= limit; n++) {
    const started = Date.now();
    await page.click('#next-pitch', {timeout: perPitch}).catch(() => {});
    try {
      await page.waitForFunction(x => {const i = window.liveMatchPlayback.inspect(); return i.error || i.host.pitchCount >= x || i.host.finished;}, n, {timeout: perPitch});
    } catch {
      log.push({n, timeout: true});
      console.log('TIMEOUT', n);
      break;
    }
    const v = await page.evaluate(() => {
      const i = window.liveMatchPlayback.inspect(), r = i.lastResult, m = r?.match;
      return {error: i.error, count: i.host.pitchCount, finished: !!i.host.finished, call: r?.play?.call ?? null, contact: !!r?.play?.contact,
        inning: m?.inning, half: m?.half, outs: m?.outs, balls: m?.balls, strikes: m?.strikes, score: m?.score};
    });
    v.ms = Date.now() - started;
    log.push(v);
    console.log('PITCH', JSON.stringify(v));
    if (v.error || v.finished) break;
  }
  console.log('RESULT', JSON.stringify({pitches: log.length, last: log.at(-1), errors: errors.slice(0, 5)}));
  await browser.close();
  server.close();
})().catch(e => {console.error(e.stack); process.exitCode = 1;});
