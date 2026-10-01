import { PIXEL_DIRECTIONS, type CompiledPixelAsset, type PixelPlayerAsset, type PixelFrame } from './PixelPlayerModel';

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected object');
  return value as Record<string, unknown>;
}
function integer(value: unknown, min: number, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max;
}
function point(value: unknown, width: number, height: number): void {
  const p = record(value);
  if (!integer(p.x, 0, width) || !integer(p.y, 0, height)) throw new Error('Invalid anchor');
}
function bounds(value: unknown, width: number, height: number): void {
  const b = record(value);
  if (!integer(b.x, 0, width - 1) || !integer(b.y, 0, height - 1) || !integer(b.width, 1, width) || !integer(b.height, 1, height)
    || Number(b.x) + Number(b.width) > width || Number(b.y) + Number(b.height) > height) throw new Error('Invalid bounds');
}
const actions = ['idle', 'batting', 'pitching', 'running', 'fielding', 'bunt_show', 'bunt_hold', 'bunt_contact', 'bunt_pullback'];
const sensitive = /bat|glove|throw|logo|number|text|badge/;

export function validatePixelPlayerAsset(input: unknown): asserts input is PixelPlayerAsset {
  const a = record(input), canvas = record(a.canvas), palette = record(a.palette);
  if (a.version !== 1 || typeof a.id !== 'string' || !a.id.trim()) throw new Error('Invalid asset identity');
  if (!integer(canvas.width, 1, 256) || !integer(canvas.height, 1, 256)) throw new Error('Invalid canvas');
  const width = canvas.width, height = canvas.height;
  if(a.compact!==undefined){
    if(record(a.compact).compact!==undefined)throw new Error('Nested compact assets forbidden');
    validatePixelPlayerAsset(a.compact);
    if(a.compact.canvas.width>12||a.compact.canvas.height>12)throw new Error('Compact canvas exceeds LOD footprint');
  }
  if (!Object.keys(palette).length) throw new Error('Empty palette');
  for (const [key, color] of Object.entries(palette)) {
    if (!/^[A-Za-z0-9]$/.test(key) || typeof color !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error('Invalid palette entry');
  }
  if (!Array.isArray(a.frames) || !a.frames.length) throw new Error('Missing frames');
  const ids = new Set<string>();
  for (const value of a.frames) {
    const f = record(value);
    if (typeof f.id !== 'string' || !f.id || ids.has(f.id)) throw new Error('Duplicate/missing frame id');
    ids.add(f.id);
    if (!actions.includes(String(f.action)) || !PIXEL_DIRECTIONS.includes(f.direction as typeof PIXEL_DIRECTIONS[number]) || !['R','L'].includes(String(f.hand))) throw new Error('Invalid frame identity');
    if (f.phase !== undefined && !integer(f.phase, 0, 3)) throw new Error('Invalid visual phase');
    point(record(f.anchors).root, width, height);
    bounds(f.bodyBounds, width, height);
    if (f.bat !== undefined) {
      const bat = record(f.bat); point(bat.grip, width, height); point(bat.tip, width, height); bounds(bat.corridor, width, height);
    }
    if (!Array.isArray(f.parts) || !f.parts.length) throw new Error('Missing named parts');
    const names = new Set<string>();
    for (const value of f.parts) {
      const p = record(value);
      if (typeof p.name !== 'string' || !/^[a-z][a-z0-9-]*$/.test(p.name) || names.has(p.name)) throw new Error('Invalid/duplicate part name');
      names.add(p.name);
      if (typeof p.mirrorSafe !== 'boolean' || (p.mirrorSafe && sensitive.test(p.name))) throw new Error('Unsafe mirror declaration');
      if (!Array.isArray(p.rows) || p.rows.length !== height) throw new Error('Invalid row count');
      for (const row of p.rows) {
        if (typeof row !== 'string' || row.length !== width || [...row].some(c => c !== '.' && !Object.hasOwn(palette, c))) throw new Error('Invalid palette index/row width');
      }
    }
  }
}

export function compilePixelPlayerAsset(input: unknown): CompiledPixelAsset {
  validatePixelPlayerAsset(input);
  const { width, height } = input.canvas;
  const palette = Object.fromEntries(Object.entries(input.palette).map(([key, color]) => [key, [parseInt(color.slice(1,3),16), parseInt(color.slice(3,5),16), parseInt(color.slice(5,7),16),255]]));
  const frames = input.frames.map(frame => {
    const rgba = Array<number>(width * height * 4).fill(0);
    const owners = Array<string>(width * height).fill('');
    for (const part of frame.parts) for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
      const symbol = part.rows[y][x];
      if (symbol !== '.') {rgba.splice((y * width + x) * 4, 4, ...palette[symbol]); owners[y * width + x] = part.name;}
    }
    const visibleBatCells = owners.flatMap((owner,index) => owner === 'bat' ? [{x:index%width,y:Math.floor(index/width)}] : []);
    return { ...frame, rgba, visibleBatCells };
  });
  return { version: 1, id: input.id, width, height, frames, ...(input.compact?{compact:compilePixelPlayerAsset(input.compact)}:{}) };
}

export function assertSafeMirror(frame: PixelFrame, names: readonly string[]): void {
  for (const name of names) {
    const part = frame.parts.find(p => p.name === name);
    if (!part || !part.mirrorSafe || sensitive.test(name)) throw new Error(`Cannot mirror ${name}`);
  }
}

export function validateTargetedEdit(before: unknown, after: unknown, frameId: string, partName: string): void {
  validatePixelPlayerAsset(before); validatePixelPlayerAsset(after);
  const withoutTarget = (asset: PixelPlayerAsset) => {
    const copy = structuredClone(asset);
    const target = copy.frames.find(f => f.id === frameId)?.parts.find(p => p.name === partName);
    if (!target) throw new Error('Missing edit target');
    return { ...copy, frames: copy.frames.map(f => f.id !== frameId ? f : { ...f, parts: f.parts.map(p => p.name !== partName ? p : { ...p, rows: [] }) }) };
  };
  if (JSON.stringify(withoutTarget(before)) !== JSON.stringify(withoutTarget(after))) throw new Error('Targeted edit changed other parts or metadata');
}
