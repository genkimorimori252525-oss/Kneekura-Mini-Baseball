import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { test } from 'node:test';
import { applyAthleticPresentationV115, athleticPresentationChangesV115, replaceAthleticSeamV115 } from './athletic-body-presentation-v115.mjs';
const scope = vm.createContext({});
vm.runInContext(readFileSync('tools/browser-bridge/athletic-body-presentation-v115.js', 'utf8'), scope);
const create = scope.KneekuraAthleticBodyPresentationV115.pixelMap,
 sprite = { originX: 48, baseline: 96, referenceHeight: 80, minX: 30, maxX: 65, minY: 15, maxY: 96 },
 input = { sprite, unit: 1, foot: { x: 200, y: 300 }, head: { x: 272, y: 300 },
  athletic: { kind: 'dive', phase: 'slide' }, retroScale: .9 };
test('V115 projects the original PNG onto Source foot/head and preserves input without using time or intent', () => {
 const before = JSON.stringify(input), map = create(input), foot = map.map(sprite.originX, sprite.baseline),
  head = map.map(sprite.originX, sprite.baseline - sprite.referenceHeight);
 assert.equal(foot.x, sprite.originX); assert.equal(foot.y, sprite.baseline);
 assert(Math.abs(head.x - foot.x - 72 * .9) < 1e-12); assert.equal(head.y, foot.y);
 for (let y = 15; y <= 96; y += 3) for (let x = 30; x <= 65; x += 3) {
  const p = map.map(x, y), back = map.unmap(p.x, p.y);
  assert(Math.abs(back.x - x) < 1e-10); assert(Math.abs(back.y - y) < 1e-10);
  const b = map.bounds(sprite); assert(p.x >= b.x - 1e-9 && p.x <= b.x + b.w + 1e-9 && p.y >= b.y - 1e-9 && p.y <= b.y + b.h + 1e-9);
 }
 assert.equal(JSON.stringify(input), before);
});
test('V115 reflects jump, prone and recovery Source snapshots, independent of the action phase label', () => {
 for (const kind of ['jump', 'dive', 'feet_slide', 'head_slide']) for (const head of [{ x: 200, y: 220 }, { x: 240, y: 260 }, { x: 272, y: 300 }]) {
  const a = create({ ...input, head, athletic: { kind, phase: 'airborne' } }),
   b = create({ ...input, head, athletic: { kind, phase: 'recover' } });
  assert.deepEqual(a.map(40, 20), b.map(40, 20));
  assert(Object.values(a.bounds(sprite)).every(Number.isFinite));
 }
 const oldPng = { ...sprite }; delete oldPng.referenceHeight;
 const legacy = create({ ...input, sprite: oldPng }), head = legacy.map(sprite.originX, sprite.baseline - 44);
 assert(Math.abs(head.x - sprite.originX - 72 * .9) < 1e-12);
});
test('V115 rejects missing legacy pose, clipping and collapsed projection without singular or NaN raster coordinates', () => {
 for (const patch of [{ athletic: undefined }, { athletic: { kind: 'run' } }, { head: null }, { head: { x: NaN, y: 0 } },
  { head: input.foot }, { head: { x: 200 + 1e-14, y: 300 } }, { unit: 0 }]) assert.equal(create({ ...input, ...patch }), null);
 const map = create({ ...input, head: { x: 200.000001, y: 300 } });
 assert(Object.values(map.unmap(48, 96)).every(Number.isFinite));
});
test('V115 builder seams are unique and reversible without changing portraits, Core or PNG bytes', () => {
 const changes = athleticPresentationChangesV115(), untouched = '<aside id="portrait-v114">PRIVATE_CORE_AND_PNG_BYTES</aside>',
  original = untouched + changes.map(c => c.before).join('\n<!-- seam -->\n'), patched = applyAthleticPresentationV115(original);
 let restored = patched;
 for (const c of [...changes].reverse()) restored = replaceAthleticSeamV115(restored, c.after, c.before);
 assert.equal(restored, original); assert(patched.includes(untouched));
 assert.throws(() => applyAthleticPresentationV115(original + changes[0].before), /ambiguous/);
 assert.throws(() => applyAthleticPresentationV115(patched), /missing/);
});

// Frozen V105 raster, small and independent of generated HTML or outputs/.
const raster = `function spriteAtGrid(sprite,unit,left,top,visit,rowMapV105=null){
 const gridV84=window.KneekuraPresentationControlsV84.grid,q=window.KneekuraPresentationControlsV84.qualityScale;
 const mappedRowV105=y=>rowMapV105?rowMapV105.map(y):y,topRowV105=mappedRowV105(sprite.minY),bottomRowV105=mappedRowV105(sprite.maxY+1),bounds={x:left+sprite.minX*unit,y:top+topRowV105*unit,w:(sprite.maxX-sprite.minX+1)*unit,h:(bottomRowV105-topRowV105)*unit};
 const get=(x,y)=>{const i=Math.floor(x),j=Math.floor(rowMapV105?rowMapV105.unmap(y):y);return i>=0&&i<sprite.size&&j>=0&&j<sprite.size?sprite.pixels[j*sprite.size+i]:0};
 for(const y of gridV84.range(Math.max(gridV84.step(),gridV84.floor(bounds.y)),Math.min((432-gridV84.step()),gridV84.ceil((bounds.y+bounds.h)))))for(const x of gridV84.range(Math.max(gridV84.step(),gridV84.floor(bounds.x)),Math.min((600-gridV84.step()),gridV84.ceil((bounds.x+bounds.w))))){
  const samples=[[0,0],[-1,-1],[1,-1],[-1,1],[1,1]].map(([dx,dy])=>get((x+dx/q-left)/unit,(y+dy/q-top)/unit));const visible=samples.filter(Boolean);if(!visible.length)continue;visit(x,y,samples[0]||visible[0],Math.max(.4,visible.length/5));
 }return bounds;
}`;
const grid = { step: () => 4, floor: x => Math.floor(x / 4) * 4, ceil: x => Math.ceil(x / 4) * 4,
 range: (a, b) => Array.from({ length: Math.max(0, Math.ceil((b - a) / 4)) }, (_, i) => a + i * 4) };
function rasterFunction(source) {
 const context = vm.createContext({ window: { KneekuraPresentationControlsV84: { grid, qualityScale: 1 } } });
 vm.runInContext(source, context); return context.spriteAtGrid;
}
test('V115 keeps legacy raster results exact and transforms Source poses on the original four-pixel grid and palette', () => {
 let changed = raster;
 for (const c of athleticPresentationChangesV115().slice(1, 4)) changed = replaceAthleticSeamV115(changed, c.before, c.after);
 const old = rasterFunction(raster), next = rasterFunction(changed),
  png = { size: 100, ...sprite, pixels: Array.from({ length: 10000 }, (_, i) => i % 100 >= 30 && i % 100 <= 65 && Math.floor(i / 100) >= 15 && Math.floor(i / 100) <= 96 ? i % 3 + 1 : 0) },
  before = JSON.stringify(png), observe = (fn, map) => { const rows = [], bounds = fn(png, 1, 152, 204, (...row) => rows.push(row), null, map); return JSON.parse(JSON.stringify({ rows, bounds })); };
 assert.deepEqual(observe(next, null), observe(old, null));
 const prone = observe(next, create(input)); assert(prone.rows.length > 0);
 assert(prone.bounds.w > prone.bounds.h, 'Source prone axis becomes horizontal');
 for (const [x, y, index, coverage] of prone.rows) {
  assert.equal(x % 4, 0); assert.equal(y % 4, 0); assert([1, 2, 3].includes(index)); assert(coverage >= .4 && coverage <= 1);
 }
 assert.equal(JSON.stringify(png), before);
});
