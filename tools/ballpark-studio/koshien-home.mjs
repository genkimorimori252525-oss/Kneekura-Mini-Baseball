// Photo approximations for presentation only. The professional diamond stays fixed.
import {realParkFoulNodes} from './real-park-infield.mjs';
export const KOSHIEN_NET=Object.freeze({heightMeters:32,meshSpacingMeters:.08,wireAlpha:.1,panelCount:12});
// NPB's Koshien centenary column (2024-09-13): current backstop about 18.4m.
export const KOSHIEN_BACKSTOP_METERS=18.4;
export function koshienFoulNodes(foul,fencePoints=[{id:'LF',angleDegrees:-45,distanceMeters:95},{id:'RF',angleDegrees:45,distanceMeters:95}]){return realParkFoulNodes(foul,fencePoints,'koshien');}
export function koshienBowlRim(g){const back=g?.vertices.find(p=>p.id==='BACK')?.distanceMeters??KOSHIEN_BACKSTOP_METERS,first=g?.vertices.find(p=>p.id==='FIRST_SIDE')?.distanceMeters??28,third=g?.vertices.find(p=>p.id==='THIRD_SIDE')?.distanceMeters??28;
 return[[0,-back-1.2],[-third*.74,-back*.82],[-third-1.5,0],[-52,35],[-76,72],[-72,96],[-46,118],
 [0,126],[46,118],[72,96],[76,72],[52,35],[first+1.5,0],[first*.74,-back*.82]];}
