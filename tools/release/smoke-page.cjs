// Opens a built page in Chrome and reports load-time errors.
// usage: node smoke-page.cjs <file.html> [--wait=ms] [--click=selector]
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [file, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
(async () => {
  const html = fs.readFileSync(file);
  const server = http.createServer((q, r) => {r.writeHead(q.url === '/favicon.ico' ? 204 : 200, {'Content-Type': 'text/html;charset=utf-8'}); r.end(q.url === '/favicon.ico' ? '' : html);});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 1280, height: 900}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message.slice(0, 200)));
  page.on('console', m => {if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200));});
  await page.goto('http://127.0.0.1:' + server.address().port, {waitUntil: 'load', timeout: 120000});
  await page.waitForTimeout(Number(opt.wait ?? 8000));
  if (opt.click) {await page.click(opt.click).catch(e => errors.push('click: ' + e.message.slice(0, 120))); await page.waitForTimeout(8000);}
  const info = await page.evaluate(() => ({title: document.title, core: typeof window.KneekuraNativeMatchCore, frames: window.frames.length, buttons: document.querySelectorAll('button').length}));
  console.log(JSON.stringify({info, errors: errors.slice(0, 6)}));
  if (opt.shot) await page.screenshot({path: opt.shot});
  await browser.close();
  server.close();
})().catch(e => {console.error(e.stack); process.exitCode = 1;});
