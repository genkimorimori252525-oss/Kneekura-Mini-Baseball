// Plays until the first batted ball, then saves screenshots during and after it.
// usage: node ui-shot.cjs <game.html> <output-dir> [--seed=S] [--pitcher=robin] [--trail=all]
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [file, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const html = fs.readFileSync(file);
  const server = http.createServer((q, r) => {r.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); r.end(html);});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.liveMatchPlayback);
  if (opt.pitcher) await page.selectOption('#home-pitcher-choice', opt.pitcher);
  await page.locator('#match-seed').fill(opt.seed ?? 'shot-1');
  await page.locator('#fixed-seed').check();
  await page.click('#new-game');
  await page.selectOption('#managed-team', '0').catch(() => {});
  if (opt.trail) await page.evaluate(m => document.querySelector(`[data-trail="${m}"]`)?.click(), opt.trail);
  let shots = 0;
  for (let n = 1; n <= Number(opt.pitches ?? 60) && shots < 3; n++) {
    await page.click('#play').catch(() => {});
    await page.waitForFunction(x => {const i = window.liveMatchPlayback.inspect(); return i.error || i.host.pitchCount >= x;}, n, {timeout: 120000});
    const info = await page.evaluate(() => {const i = window.liveMatchPlayback.inspect(); return {error: i.error, contact: !!i.lastResult?.play?.contact};});
    if (info.error) {console.log('ERROR', info.error); break;}
    if (info.contact) {
      for (let k = 0; k < 3; k++) {
        await page.waitForTimeout(1300);
        await page.screenshot({path: path.join(out, `shot-${++shots}.png`)});
      }
    }
    await page.waitForFunction(() => {const i = window.liveMatchPlayback.inspect(); return i.error || !i.playing;}, null, {timeout: 60000}).catch(() => {});
  }
  console.log('shots', shots, 'errors', errors.slice(0, 3));
  await browser.close();
  server.close();
})().catch(e => {console.error(e.stack); process.exitCode = 1;});
