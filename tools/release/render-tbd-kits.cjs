// Renders the Tambov Dragons home and away uniforms onto every registered fielding pose with the owner's uniform
// compositor (output/b2-defense-motion-probe/tbd-uniform-integration in the drawing folder), as PNGs for the art bank.
// Poses that show the back carry each player's own name and number, so they are rendered once per TBD player.
// usage: node render-tbd-kits.cjs <drawing-root> <out-dir> <match-data.json>
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [root, out, dataFile] = process.argv.slice(2);
const TYPES = {'.js': 'text/javascript', '.cjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.html': 'text/html', '.css': 'text/css'};

(async () => {
  const server = http.createServer((q, r) => {
    const file = path.join(root, decodeURIComponent(q.url.split('?')[0]));
    if (!file.startsWith(path.resolve(root)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(r);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/output/b2-defense-motion-probe/tbd-uniform-integration/index.html`);
  await page.evaluate(() => new Promise((resolve, reject) => {
    if (window.TBDUniformAdapter) return resolve();
    const s = document.createElement('script');
    s.src = '/output/b2-defense-motion-probe/tbd-uniform-integration/runtime-adapter.js';
    s.onload = resolve; s.onerror = reject; document.head.append(s);
  }));
  const sources = await page.evaluate(async () => {
    window.wardrobe = await TBDUniformAdapter.create();
    return window.wardrobe.listSources().map(s => ({id: s.id, back: JSON.stringify(s).includes('jersey-back')}));
  });
  const players = Object.values(JSON.parse(fs.readFileSync(dataFile, 'utf8')).players).filter(p => p.team === 1 && Number.isInteger(p.number));
  fs.mkdirSync(out, {recursive: true});
  const save = async (id, kit, player, name) => {
    const data = await page.evaluate(async ([id, kit, player]) => (await window.wardrobe.render(id, kit, player)).toDataURL('image/png'), [id, kit, player]);
    fs.writeFileSync(path.join(out, name), Buffer.from(data.split(',')[1], 'base64'));
  };
  const file = id => id.replace(/[:/]/g, '_');
  let count = 0;
  for (const kit of ['home', 'away']) for (const s of sources) {
    // Every pose once with a neutral player; a pose with the back registered also once per player.
    await save(s.id, kit, {name: 'TBD', number: '0', cleats: 'blue'}, `${kit}__${file(s.id)}.png`); count++;
    if (s.back) for (const p of players) { await save(s.id, kit, {name: p.name, number: String(p.number), cleats: 'blue'}, `${kit}__${file(s.id)}__${p.id}.png`); count++; }
  }
  fs.writeFileSync(path.join(out, 'sources.json'), JSON.stringify({sources, players: players.map(p => p.id)}, null, 1));
  console.log('rendered', count, 'back poses', sources.filter(s => s.back).map(s => s.id).join(' '), 'errors', JSON.stringify(errors));
  await browser.close(); server.close();
  process.exit(errors.length ? 1 : 0);
})();
