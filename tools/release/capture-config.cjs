// Captures the real match configuration the game UI sends to the Core.
// usage: node capture-config.cjs <game.html> <output.json> [--pitcher=robin]
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [file, output, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
(async () => {
  const marker = 'nextHost=window.KneekuraBackgroundMatchV116.create({configuration:workerConfigurationV116';
  const raw = fs.readFileSync(file, 'utf8');
  if (!raw.includes(marker)) throw Error('marker missing');
  const html = raw.replace(marker, 'nextHost=window.KneekuraBackgroundMatchV116.create({configuration:(window.__cfg=workerConfigurationV116)');
  const server = http.createServer((q, r) => {r.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); r.end(html);});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.liveMatchPlayback);
  if (opt.pitcher) await page.selectOption('#home-pitcher-choice', opt.pitcher);
  if (opt.stadium) await page.selectOption('#stadium-choice', opt.stadium);
  await page.locator('#match-seed').fill(opt.seed ?? 'capture');
  await page.locator('#fixed-seed').check();
  await page.click('#new-game');
  await page.waitForFunction(() => window.__cfg);
  const json = await page.evaluate(() => JSON.stringify(window.__cfg));
  fs.writeFileSync(output, json);
  console.log('config bytes', json.length);
  await browser.close();
  server.close();
})().catch(e => {console.error(e.stack); process.exitCode = 1;});
