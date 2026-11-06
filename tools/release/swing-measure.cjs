// Measures the swing drawing (docs/ai-continuity/DESIGN-2026-11-06-swing-drawing.md) on a built game page: plays a game
// fast, then steps every swing frame by frame and reads what the renderer drew (batterRig.swing).
// usage: node swing-measure.cjs <game.html> <out.json> [--seed=S] [--pitches=N] [--camera=mound]
//        [--shots=<dir> --shotPitches=i,j,k --offsets=-132,-88,...] (screenshots of the batter around each contact, in ms)
//        [--wild=1|0] (every batter in the wild swing of a poor meet, or none: for comparing the two on the same pitches)
// Per frame: the screen angle of the drawn and of the Core's bat; at the contact: the ball's distance from the drawn bat
// in px against the ball's radius. Prints the medians.
const fs = require('fs'), http = require('http'), path = require('path');
const {chromium} = require(process.env.PLAYWRIGHT_PATH || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const [file, out, ...rest] = process.argv.slice(2);
const opt = Object.fromEntries(rest.map(a => a.replace(/^--/, '').split('=')));
const median = v => {const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.floor((s.length - 1) / 2)] : null;};
const quantile = (v, q) => {const s = [...v].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : null;};
(async () => {
  const html = fs.readFileSync(file);
  const server = http.createServer((q, r) => {r.writeHead(200, {'Content-Type': 'text/html;charset=utf-8'}); r.end(html);});
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch({headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page = await browser.newPage({viewport: {width: 1400, height: 1000}});
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto('http://127.0.0.1:' + server.address().port);
  await page.waitForFunction(() => window.liveMatchPlayback && window.KneekuraArtBankV1?.inspect().loaded === window.KneekuraArtBankV1?.inspect().total, null, {timeout: 120000});
  if (opt.wild !== undefined) await page.evaluate(w => {globalThis.__swingWildV1 = w;}, opt.wild === '1');
  await page.locator('#match-seed').fill(opt.seed ?? 'swing-1');
  await page.locator('#fixed-seed').check();
  await page.click('#new-game');
  await page.evaluate(m => document.querySelector(`[data-camera="${m}"]`)?.click(), opt.camera ?? 'mound');
  // Fast play until enough pitches, then stop the fast play.
  const want = Number(opt.pitches ?? 80);
  // Show progress while the game plays fast, so a guard watching the output sees it alive.
  const ticker = setInterval(() => page.evaluate(() => window.liveMatchPlayback.inspect().generatedPitches).then(n => process.stdout.write(`played ${n}
`), () => {}), 20000);
  await page.click('#finish-game');
  await page.waitForFunction(n => {const i = window.liveMatchPlayback.inspect(); return i.error || i.generatedPitches >= n || i.host.finished;}, want, {timeout: 600000});
  await page.click('#finish-game');
  await page.waitForTimeout(500);
  clearInterval(ticker);
  const count = await page.evaluate(() => window.liveMatchPlayback.inspect().generatedPitches);
  const rows = [], contacts = [];
  for (let i = 0; i < (opt.measure === '0' ? 0 : count); i++) {
    const got = await page.evaluate(i => {
      const p = window.liveMatchPlayback;
      p.seekPitch(i, 0);
      const r = p.inspect().lastResult, d = r.play.diagnostics;
      if (!d.swingOffered) return null;
      const contactTick = r.play.contactMoment?.ball?.tick ?? null, out = [];
      for (let f = 0; f < r.frames.length; f++) {
        if (!r.frames[f].bat && !(contactTick !== null && r.frames[f].tick <= contactTick + 2e5)) continue;
        p.seekFrame(f);
        const s = p.inspect().rendered?.batterRig?.swing;
        if (s) out.push({frame: f, tick: r.frames[f].tick, key: s.key, wild: s.wild, drawn: s.drawnAngle, physical: s.physicalAngle, turn: s.turn, batTurn: s.batTurn, torso: s.torso, stand: s.stand, stretch: s.stretch, contact: s.contact,
          gripGap: s.physicalGrip ? Math.hypot(s.physicalGrip.x - s.drawnGrip.x, s.physicalGrip.y - s.drawnGrip.y) : null});
      }
      return {hit: contactTick !== null, batter: r.batterPlayerId, side: d.battingSide, out};
    }, i);
    process.stdout.write(`pitch ${i}/${count}${got ? ' swing' : ''}
`);
    if (!got) continue;
    for (const row of got.out) {
      rows.push({pitch: i, hit: got.hit, batter: got.batter, side: got.side, ...row});
      if (row.contact && !contacts.some(c => c.pitch === i)) contacts.push({pitch: i, batter: got.batter, key: row.key, wild: row.wild, physical: row.physical, drawn: row.drawn, gripGap: row.gripGap, ...row.contact, turn: row.turn, batTurn: row.batTurn, torso: row.torso, stand: row.stand});
    }
  }
  const gaps = rows.filter(r => r.physical !== null).map(r => Math.abs(((r.drawn - r.physical) % 360 + 540) % 360 - 180));
  // The stance holds still most of a pitch and matches by construction: the swing proper is every other frame.
  const swingGaps = rows.filter(r => r.physical !== null && r.key !== '0').map(r => Math.abs(((r.drawn - r.physical) % 360 + 540) % 360 - 180));
  const contactGaps = contacts.map(c => Math.abs(((c.drawn - c.physical) % 360 + 540) % 360 - 180));
  const byKey = {};
  for (const r of rows.filter(r => r.physical !== null)) (byKey[r.key] ??= []).push(Math.abs(((r.drawn - r.physical) % 360 + 540) % 360 - 180));
  const summary = {
    pitches: count, swings: new Set(rows.map(r => r.pitch)).size, frames: gaps.length,
    angleGap: {median: median(gaps), p75: quantile(gaps, .75), p90: quantile(gaps, .9)},
    swingAngleGap: {frames: swingGaps.length, median: median(swingGaps), p75: quantile(swingGaps, .75), p90: quantile(swingGaps, .9)},
    contactAngleGap: {median: median(contactGaps), p90: quantile(contactGaps, .9)},
    angleGapByKey: Object.fromEntries(Object.entries(byKey).map(([k, v]) => [k, {n: v.length, median: median(v)}])),
    contacts: contacts.length,
    contactDistance: {median: median(contacts.map(c => c.distancePx)), max: Math.max(...contacts.map(c => c.distancePx)), withinBall: contacts.filter(c => c.distancePx <= c.ballRadiusPx).length,
      ballRadiusMedian: median(contacts.map(c => c.ballRadiusPx))},
    wildBatters: [...new Set(rows.filter(r => r.wild).map(r => r.batter))],
    contactsByStyle: Object.fromEntries(['adopted', 'wild'].map(k => {const c = contacts.filter(c => !!c.wild === (k === 'wild')); return [k, {n: c.length, median: median(c.map(c => c.distancePx)), withinBall: c.filter(c => c.distancePx <= c.ballRadiusPx).length}];})),
    impactKeys: contacts.reduce((a, c) => ({...a, [c.key]: (a[c.key] ?? 0) + 1}), {}),
    errors: errors.slice(0, 5),
  };
  fs.writeFileSync(out, JSON.stringify({summary, contacts, rows}, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  // Screenshots of the batter around chosen contacts, for a before/after sheet.
  if (opt.shots) {
    fs.mkdirSync(opt.shots, {recursive: true});
    if (opt.whole) await page.evaluate(() => {window.__swingShotWhole = true;});
    const offsets = (opt.offsets ?? '-132,-88,-66,-44,-22,0,44').split(',').map(Number);
    for (const i of (opt.shotPitches ?? '').split(',').filter(Boolean).map(Number)) {
      for (const ms of offsets) {
        // The field and its overlays (the Core's bat is drawn on one), cropped around the batter, read straight off the canvases.
        const data = await page.evaluate(([i, ms]) => {
          const p = window.liveMatchPlayback;
          p.seekPitch(i, 0);
          const s = p.inspect(), r = s.lastResult, tps = r.play.diagnostics.sourceClockTicksPerSecond ?? 1e6;
          const at = r.play.contactMoment?.ball?.tick ?? r.play.diagnostics.referenceContactTick;
          p.seekPresentationMs(s.presentation.timing.preparationMs + (at - r.frames[0].tick) / tps * 1000 + ms);
          const field = document.getElementById('field'), k = field.width / 600, bat = p.inspect().rendered?.actors?.find(a => a.id === 'BAT');
          // Centred on the batter's feet across, at a fixed height: the same crop in every version of the page.
          const whole = window.__swingShotWhole, cx = whole ? 300 : bat ? bat.nameAnchor.x : 300, cy = whole ? 216 : 205,
           size = (whole ? 600 : 150) * k, c = document.createElement('canvas');
          c.width = c.height = size;
          const g = c.getContext('2d');
          for (const id of ['field', 'bat-overlay', 'ball-overlay']) g.drawImage(document.getElementById(id), cx * k - size / 2, cy * k - size / 2, size, size, 0, 0, size, size);
          return c.toDataURL('image/png');
        }, [i, ms]);
        process.stdout.write(`shot ${i} ${ms}
`);
        fs.writeFileSync(path.join(opt.shots, `p${i}_${ms}.png`), Buffer.from(data.split(',')[1], 'base64'));
      }
    }
  }
  await browser.close();
  server.close();
})().catch(e => {console.error(e.stack); process.exitCode = 1;});
