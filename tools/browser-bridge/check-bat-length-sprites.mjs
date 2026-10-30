import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve, join } from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.MAKER_PLAYWRIGHT_CORE ?? 'C:/Users/genki/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core');
const evidence = resolve(process.argv[2] ?? '../bat-length-sprite-evidence');
await mkdir(evidence, { recursive: true });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifestBytes = await readFile('docs/demos/assets/bat-lengths/manifest.json');
const manifest = JSON.parse(manifestBytes);
const variants = await Promise.all(manifest.variants.map(async variant => {
  const bytes = await readFile('docs/demos/assets/bat-lengths/' + variant.file);
  assert.equal(sha(bytes), variant.sha256);
  return { ...variant, pngDataUri: 'data:image/png;base64,' + bytes.toString('base64') };
}));
const module = await readFile('docs/demos/bat-length-sprites.mjs', 'utf8');
const browser = await chromium.launch({ executablePath: process.env.MAKER_CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const checks = [], errors = [], network = [];
try {
  const page = await browser.newPage({ viewport: { width: 1000, height: 700 } });
  page.on('pageerror', error => errors.push(String(error)));
  page.on('request', request => { if (!request.url().startsWith('data:')) network.push(request.url()); });
  await page.setContent('<style>body{margin:0;background:#101a13;color:#e2cc98;font:18px monospace}.row{display:flex}canvas{width:320px;height:240px;image-rendering:pixelated;border:1px solid #43513c}p{margin:12px}</style><p>78 cm / 84 cm / 90 cm — same physical projection and radius</p><div class="row"><canvas id="a" width="320" height="240"></canvas><canvas id="b" width="320" height="240"></canvas><canvas id="c" width="320" height="240"></canvas></div><p>Length changes projection; thickness follows physical radius</p><canvas id="d" width="320" height="240"></canvas><canvas id="e" width="320" height="240"></canvas><canvas id="f" width="320" height="240"></canvas>');
  await page.evaluate(data => { globalThis.KneekuraBatLengthSpriteData = data; }, { authority: manifest.authority, manifestSha256: sha(manifestBytes), variants });
  await page.addScriptTag({ content: module });
  const result = await page.evaluate(async () => {
    const api = globalThis.KneekuraBatLengthSprites;
    await api.ready;
    const rows = [], check = (name, value) => { if (!value) throw Error(name); rows.push({ name, status: 'PASS' }); };
    const near = (a, b) => Math.abs(a - b) < 1e-9;
    check('three original sprites decoded with no physics authority', api.inspect().loaded && api.inspect().variants.every(value => value.loaded) && api.inspect().physicsAuthority === false);
    const ctx = document.getElementById('a').getContext('2d');
    const bounds = c => {
      const pixels = c.getImageData(0, 0, c.canvas.width, c.canvas.height).data;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, opaque = 0;
      for (let y = 0; y < c.canvas.height; y++) for (let x = 0; x < c.canvas.width; x++) if (pixels[(y * c.canvas.width + x) * 4 + 3] >= 128) {
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); opaque++;
      }
      return { minX, minY, maxX, maxY, width: maxX - minX + 1, height: maxY - minY + 1, opaque };
    };
    const options = Object.freeze({ grip: Object.freeze({ x: 30, y: 120, scale: 200 }), tip: Object.freeze({ x: 270, y: 120, scale: 200 }), maximumRadiusM: .035 });
    const original = JSON.stringify(options), images = [];
    for (const [index, lengthM] of [.78, .84, .9].entries()) {
      const target = document.getElementById(['a', 'b', 'c'][index]).getContext('2d'); target.imageSmoothingEnabled = true;
      check('draw image for ' + lengthM, api.draw(target, { ...options, lengthM }));
      const state = api.inspect(), b = bounds(target);
      check('nearest original variant ' + lengthM, state.lastDraw.nominalLengthM === lengthM);
      check('calibrated art spans physical endpoints ' + lengthM, b.opaque > 100 && b.minX >= 27 && b.minX <= 36 && b.maxX >= 261 && b.maxX <= 273);
      check('radius sets diameter independently of nominal artwork length ' + lengthM, near(state.lastDraw.diameterGripPx, 14) && near(state.lastDraw.diameterTipPx, 14) && b.height >= 9 && b.height <= 21);
      check('caller canvas state preserved ' + lengthM, target.imageSmoothingEnabled === true && target.getTransform().isIdentity);
      images.push({ lengthM, bounds: b, draw: state.lastDraw });
    }
    check('input projected grip and tip remain unchanged', JSON.stringify(options) === original);
    api.draw(ctx, { ...options, lengthM: .82 }); check('arbitrary length selects nearest image', api.inspect().lastDraw.nominalLengthM === .84);
    const selected = api.inspect().lastDraw.file;
    const targetD = document.getElementById('d').getContext('2d');
    api.draw(targetD, { ...options, lengthM: .82, tip: { ...options.tip, x: 150 } }); const shorter = bounds(targetD);
    check('shorter projection leaves physical diameter unchanged', api.inspect().lastDraw.file === selected && Math.abs(shorter.height - images[1].bounds.height) <= 3);
    const targetE = document.getElementById('e').getContext('2d');
    api.draw(targetE, { ...options, lengthM: .82, maximumRadiusM: .0175 }); const thinner = bounds(targetE);
    check('physical radius controls actual rendered thickness', thinner.height < images[1].bounds.height && thinner.width >= images[1].bounds.width - 6);
    const targetF = document.getElementById('f').getContext('2d');
    api.draw(targetF, { grip: { x: 50, y: 40, scale: 150 }, tip: { x: 260, y: 190, scale: 300 }, lengthM: .9, maximumRadiusM: .035 });
    check('perspective keeps distinct camera scales', near(api.inspect().lastDraw.diameterGripPx, 10.5) && near(api.inspect().lastDraw.diameterTipPx, 21) && bounds(targetF).opaque > 100);
    const pixels = targetF.getImageData(0, 0, 320, 240).data;
    let pixelGrid = true;
    for (let y = 0; y + 2 < 240; y += 3) for (let x = 0; x + 2 < 320; x += 3) for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) for (let c = 0; c < 4; c++)
      if (pixels[((y + dy) * 320 + x + dx) * 4 + c] !== pixels[(y * 320 + x) * 4 + c]) pixelGrid = false;
    check('rotated sprite uses exact nearest-neighbor 3px camera cells', pixelGrid);
    const before = Array.from(ctx.getImageData(0, 0, 320, 240).data).join(',');
    check('invalid radius rejected without drawing', api.draw(ctx, { ...options, lengthM: .84, maximumRadiusM: NaN }) === false
      && before === Array.from(ctx.getImageData(0, 0, 320, 240).data).join(','));
    const scratch = document.createElement('canvas'); scratch.width = 320; scratch.height = 240; const end = scratch.getContext('2d');
    check('end-on projection stays visible within physical radius', api.draw(end, { grip: options.grip, tip: options.grip, lengthM: .84, maximumRadiusM: .035 })
      && api.inspect().lastDraw.foreshortened && bounds(end).opaque > 0 && bounds(end).width <= 18);
    ctx.clearRect(0, 0, 320, 240); api.draw(ctx, { ...options, lengthM: .78 });
    return { checks: rows, images, inspect: api.inspect() };
  });
  checks.push(...result.checks);
  await page.screenshot({ path: join(evidence, 'sprite-camera.png') });
  assert.deepEqual(errors, []); assert.deepEqual(network, []);
  for (const variant of variants) assert.equal(sha(await readFile('docs/demos/assets/bat-lengths/' + variant.file)), variant.sha256);
  const report = { status: 'PASS', checks, results: result.images, moduleSha256: sha(module), manifestSha256: sha(manifestBytes),
    pngBytesUnchanged: true, externalRequests: network, errors, physicsAuthority: false };
  await writeFile(join(evidence, 'checks.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ status: report.status, checks: checks.length, evidence, pngBytesUnchanged: true }));
} finally { await browser.close(); }
