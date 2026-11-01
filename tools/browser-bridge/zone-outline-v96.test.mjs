import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { applyZoneOutlineV96 } from './zone-outline-v96.mjs';

const original = await readFile('../../outputs/ばせぼーるlv94_TBD_vs_LAD_立体ゾーンと打席位置版.html', 'utf8');
function guideSource(html) {
  const start = html.indexOf(' function guides(){'), end = html.indexOf('\n function history(){', start);
  assert(start >= 0 && end > start); assert.equal(html.indexOf(' function guides(){', start + 1), -1);
  return html.slice(start, end);
}
function raster(html, { camera = 'catcher', lowerY = .48, upperY = 1.05, plateFrontZ = .4318 } = {}) {
  const setup = { region: { halfWidth: .2159, lowerY, upperY }, plateFrontZ,
    volume: { platePolygon: [{ x: -.2159, z: .4318 }, { x: .2159, z: .4318 }, { x: .2159, z: .2159 },
      { x: 0, z: 0 }, { x: -.2159, z: .2159 }], lowerY, upperY } }, before = JSON.stringify(setup), dots = [], rectangles = [], calls = [];
  const project = point => { calls.push({ ...point }); const scale = 600 / (19 - point.z); return { x: 300 + point.x * scale, y: 220 - point.y * scale }; },
    context = { state: { camera, zone: true }, observed: { liveObservation: true, batter: { height: 1.8 }, fairKnown: false },
      window: { KneekuraBattingSetupViewV94: { observed: () => setup } }, project, rasterCells: new Map(), gridV84: { step: () => 4 },
      snap: n => Math.round(n / 4) * 4, BallSurface: { guideOccluded: () => false },
      ctx: { fillStyle: '', fillRect(...args) { rectangles.push({ color: this.fillStyle, args }); } }, dot: (...args) => dots.push(args) };
  vm.runInNewContext('let zoneCorners=[],blockedZoneCells=[];\n' + guideSource(html) + '\nguides();globalThis.result={zoneCorners,blockedZoneCells};', context);
  assert.equal(JSON.stringify(setup), before, 'drawing must not mutate the physical volume');
  return { ...JSON.parse(JSON.stringify(context.result)), dots, rectangles, calls };
}
function expectedPerimeter(corners) {
  const cells = new Map();
  for (let i = 0; i < 4; i++) {
    const a = corners[i], b = corners[(i + 1) % 4], length = Math.hypot(a.x - b.x, a.y - b.y), count = Math.max(1, Math.ceil(length / 4));
    for (let j = 0; j <= count; j++) {
      const x = Math.round((a.x + (b.x - a.x) * j / count) / 4) * 4, y = Math.round((a.y + (b.y - a.y) * j / count) / 4) * 4;
      cells.set(x + ',' + y, [x, y, Math.min(j, count - j) * length / count < 12 ? 1.75 : 1.40, '#e0b541', 1]);
    }
  }
  return [...cells.values()];
}

test('changes only the wire outline in the frozen release, retaining Core, PNG payloads and every other script byte', () => {
  const result = applyZoneOutlineV96(original), oldGuide = guideSource(original), newGuide = guideSource(result);
  assert.notEqual(newGuide, oldGuide); assert.equal(result.replace(newGuide, '__GUIDES__'), original.replace(oldGuide, '__GUIDES__'));
  const core = html => [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes('var KneekuraNativeMatchCore ='));
  assert.equal(core(original).length, 1); assert.deepEqual(core(result), core(original));
  const png = html => html.match(/data:image\/png;base64,[A-Za-z0-9+/=]+/g) ?? [];
  assert.deepEqual(png(result), png(original));
  // This frozen presentation stores raster masks rather than PNG data URLs.
  // Exercise literal PNG passthrough as well as the byte-exact mask coverage.
  const pngFixture = original + '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==">';
  assert.deepEqual(png(applyZoneOutlineV96(pngFixture)), png(pngFixture));
});

test('draws just four front-plane edges with the original 4px grid, gold dots and black backing', () => {
  const transformed = applyZoneOutlineV96(original);
  for (const camera of ['catcher', 'batter', 'mound']) for (const height of [1.55, 2.05]) {
    const lowerY = height * .27, upperY = height * .535, result = raster(transformed, { camera, lowerY, upperY });
    assert.equal(result.calls.length, 4, 'no back-plane or connector projections');
    assert.deepEqual(result.calls.map(p => p.y), [upperY, upperY, lowerY, lowerY]);
    assert(result.calls.every(p => p.z === .4318)); assert.deepEqual(result.dots, expectedPerimeter(result.zoneCorners));
    assert.deepEqual(result.rectangles, result.dots.map(([x, y]) => ({ color: '#000', args: [x - 4, y - 4, 8, 8] })));
    assert.deepEqual(result.blockedZoneCells, []);
  }
  assert.deepEqual(raster(transformed, { camera: 'overhead' }), { zoneCorners: [], blockedZoneCells: [], dots: [], rectangles: [], calls: [] });
});

test('supports the frozen CRLF variant and rejects a second application or unexpected/ambiguous markers', () => {
  const crlf = original.replace(/\r?\n/g, '\r\n');
  assert.deepEqual(raster(applyZoneOutlineV96(crlf)), raster(applyZoneOutlineV96(original)));
  assert.throws(() => applyZoneOutlineV96(applyZoneOutlineV96(original)), /unique V94 depth-wire outline/);
  assert.throws(() => applyZoneOutlineV96(original.replace('if(setup){const polygon=setup.volume.platePolygon', 'if(setup){const polygon=unexpected.volume.platePolygon')), /unique V94 depth-wire outline/);
  assert.throws(() => applyZoneOutlineV96(original + guideSource(original)), /ambiguous zone renderer/);
});
