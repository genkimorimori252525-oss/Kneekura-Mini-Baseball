import { describe, expect, it } from 'vitest';
import { compilePixelPlayerAsset, validatePixelPlayerAsset, assertSafeMirror, validateTargetedEdit } from './PixelPlayerAsset';

// These assertions catch lost layer order, invalid source acceptance and collateral cell edits.
const source = () => ({
  version: 1, id: 'test', palette: { W: '#ffffff', B: '#123456' },
  canvas: { width: 3, height: 2 },
  frames: [{ id: 'idle-front', action: 'idle', direction: 'FRONT', hand: 'R',
    anchors: { root: { x: 1, y: 2 } }, bodyBounds: { x: 0, y: 0, width: 3, height: 2 },
    parts: [{ name: 'body', mirrorSafe: true, rows: ['.W.', 'WWW'] },
      { name: 'glove-left', mirrorSafe: false, rows: ['...', 'B..'] }] }],
});

describe('editable pixel source contract', () => {
  it('compiles transparent cells and ordered named parts deterministically', () => {
    const asset = compilePixelPlayerAsset(source());
    expect(asset.frames[0].rgba).toEqual([0,0,0,0,255,255,255,255,0,0,0,0,18,52,86,255,255,255,255,255,255,255,255,255]);
    expect(compilePixelPlayerAsset(source())).toEqual(asset);
  });
  it('preserves authored reference height and rejects an impossible body scale', () => {
    expect(compilePixelPlayerAsset({...source(),referenceHeight:2})).toHaveProperty('referenceHeight',2);
    expect(()=>compilePixelPlayerAsset({...source(),referenceHeight:0})).toThrow();
    expect(()=>compilePixelPlayerAsset({...source(),referenceHeight:3})).toThrow();
  });
  it.each(['duplicate', 'root', 'palette', 'rows', 'bounds'])('rejects malformed %s source before compilation', (fault) => {
    const input = source();
    if (fault === 'duplicate') input.frames.push(structuredClone(input.frames[0]));
    if (fault === 'root') delete (input.frames[0].anchors as { root?: unknown }).root;
    if (fault === 'palette') input.frames[0].parts[0].rows[0] = '.Z.';
    if (fault === 'rows') input.frames[0].parts[0].rows[0] = 'W';
    if (fault === 'bounds') input.frames[0].bodyBounds.width = 4;
    expect(() => validatePixelPlayerAsset(input)).toThrow();
  });
  it('rejects semantically unsafe mirror while allowing safe shared body', () => {
    const input = source(); validatePixelPlayerAsset(input);
    expect(() => assertSafeMirror(input.frames[0], ['glove-left'])).toThrow();
    expect(() => assertSafeMirror(input.frames[0], ['body'])).not.toThrow();
  });
  it('allows one named part cell edit and rejects collateral edits or metadata changes', () => {
    const before = source(), after = source();
    after.frames[0].parts[0].rows[0] = 'WW.';
    expect(() => validateTargetedEdit(before, after, 'idle-front', 'body')).not.toThrow();
    after.frames[0].parts[1].rows[0] = 'B..';
    expect(() => validateTargetedEdit(before, after, 'idle-front', 'body')).toThrow();
    after.frames[0].parts[1].rows[0] = '...'; after.frames[0].anchors.root.x = 2;
    expect(() => validateTargetedEdit(before, after, 'idle-front', 'body')).toThrow();
  });
});
