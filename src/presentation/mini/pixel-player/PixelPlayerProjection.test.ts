import { expect, it } from 'vitest';
import { placePixelPlayer, sortPixelPlayers } from './PixelPlayerProjection';
import { selectDirection } from './PixelPlayerDirection';

it('places projected canonical anchors at integer cells with monotone discrete detail', () => {
  const placements = [1,4,9,20].map(apparentScale => placePixelPlayer('p', { x: 10.4, y: 20.7, depth: 40/apparentScale, apparentScale }, 1.8));
  expect(placements.map(p => [p.lod,p.scale])).toEqual([[0,1],[1,1],[2,1],[3,2]]);
  expect(placements.every(p => p.root.x === 10 && p.root.y === 21)).toBe(true);
  expect(placePixelPlayer('p', {x:10.4,y:20.7,depth:10,apparentScale:4},1.8)).toEqual(placements[1]);
});
it('sorts far to near independently of registered position and breaks ties by identity', () => {
  const at = (id: string, depth: number) => placePixelPlayer(id,{x:0,y:0,depth,apparentScale:4},1.8);
  expect(sortPixelPlayers([at('z',10),at('a',10),at('p',30)]).map(p=>p.playerId)).toEqual(['p','a','z']);
});
it.each([NaN,Infinity,0,-1])('rejects invalid camera scale/depth %s', value => {
  expect(()=>placePixelPlayer('p',{x:0,y:0,depth:value,apparentScale:4},1.8)).toThrow();
});
it('selects camera-relative directions without reflecting the world', () => {
  expect(selectDirection({x:0,z:1},{x:0,z:1})).toBe('FRONT');
  expect(selectDirection({x:0,z:1},{x:1,z:0})).toBe('LEFT');
  expect(selectDirection({x:0,z:1},{x:0,z:-1})).toBe('BACK');
});
it('does not double a detailed 36-cell body merely because it enters near LOD', () => {
  const near={x:75,y:70,depth:18,apparentScale:23};
  const detailed=placePixelPlayer('b',near,1.8,36);
  expect(detailed.lod).toBe(3);
  expect(detailed.scale).toBe(1);
  expect(placePixelPlayer('b',{...near,apparentScale:42},1.8,36).scale).toBe(2);
});
