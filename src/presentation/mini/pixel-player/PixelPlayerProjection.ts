import type { ProjectedPoint } from '../BatterPovCamera';
import type { PixelPoint } from './PixelPlayerModel';
export type PixelPlacement = Readonly<{playerId:string;root:PixelPoint;depth:number;lod:0|1|2|3;scale:1|2;labelScale:1|2}>;
export function placePixelPlayer(id:string,p:ProjectedPoint,height:number):PixelPlacement {
  if (!id || ![p.x,p.y,p.depth,p.apparentScale,height].every(Number.isFinite) || p.depth <= 0 || p.apparentScale <= 0 || height <= 0) throw new Error('Invalid projected player');
  const apparentHeight = p.apparentScale * height;
  const lod = apparentHeight < 4 ? 0 : apparentHeight < 12 ? 1 : apparentHeight < 32 ? 2 : 3;
  return {playerId:id,root:{x:Math.round(p.x),y:Math.round(p.y)},depth:p.depth,lod,scale:lod===3?2:1,labelScale:lod===3?2:1};
}
export function sortPixelPlayers(players:readonly PixelPlacement[]):readonly PixelPlacement[] {
  return [...players].sort((a,b)=>b.depth-a.depth || (a.playerId<b.playerId?-1:a.playerId>b.playerId?1:0));
}
