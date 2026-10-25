import {logoBounds,sampleGroundLogo,distanceToLogo} from './ground-logo.mjs';
export const DEFAULT_SURFACE_DETAIL=Object.freeze({factor:3,marginMeters:.6,featherMeters:.8});
const rgbCache=new Map(),rgb=color=>{if(!rgbCache.has(color))rgbCache.set(color,[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)));return rgbCache.get(color);};
/** Overlay colors are material samples BEFORE any point rasterization. */
export function blendMaterial(base,overlay,{brightness=1,glow=0}={}){if(!base||!overlay||overlay.a<=0)return base;
 const old=rgb(base.color),lift=Math.max(0,brightness-1)*.12,n=[overlay.r,overlay.g,overlay.b].map(v=>v+(255-v)*lift),a=Math.max(0,Math.min(1,overlay.a*brightness));
 return {...base,color:'#'+old.map((v,i)=>Math.round(v+(n[i]-v)*a).toString(16).padStart(2,'0')).join(''),logoCoverage:a,logoGlow:glow*a*4};}
export const materialAt=(g,p,base)=>blendMaterial(base,sampleGroundLogo(g,p),g?.architecture?.logo);
export function detailZone(g){const b=logoBounds(g);if(!b||g.architecture.logo.detail!=='fine')return null;
 const d=g.architecture.surfaceDetail??DEFAULT_SURFACE_DETAIL;
 return {id:'grass-wolf-material',shape:'material_alpha_distance',footprint:b,center:{x:0,z:b.centerZ},halfX:b.width/2+d.marginMeters,halfZ:b.length/2+d.marginMeters,
  factor:d.factor,marginMeters:d.marginMeters,featherMeters:d.featherMeters,materials:['original_ground','gold_wolf_image_v1']};}
export function densityWeight(zone,p,distanceProvider=distanceToLogo){if(!zone||!p)return 0;
 const distance=distanceProvider(zone.footprint,p)-zone.marginMeters;
 if(distance<=0)return 1;if(distance>=zone.featherMeters)return 0;
 const t=distance/zone.featherMeters;return 1-t*t*(3-2*t);}
/** Same surface query and same circle-dot primitive for turf and decal, on one subdivided lattice. */
export function renderDetailRegion({geometry:g,project,groundAt,surfaceAt,grid,paint,coarseLogoCells=0}){
 const zone=detailZone(g),b=logoBounds(g),logo=b?{cells:coarseLogoCells,mode:g.architecture.logo.detail,glyph:'gold_wolf_image_v1',widthMeters:b.width,lengthMeters:b.length,centerZ:b.centerZ,brightness:g.architecture.logo.brightness??1,glow:g.architecture.logo.glow??0}:null,
  report={zone,finePoints:0,fineGrassPoints:0,fineLogoPoints:0,transitionPoints:0,samples:0,logo,
   raster:'shared_circle_dots',layerOrder:'ground_and_image_material_then_density_then_dots',integration:'DESIGN_ONLY_NOT_MATCH_CORE_ADMITTED'};
 if(!zone)return report;
 const ex=zone.halfX+zone.featherMeters,ez=zone.halfZ+zone.featherMeters,
  corners=[[-ex,-ez],[ex,-ez],[ex,ez],[-ex,ez]].map(([x,z])=>project({x:x+zone.center.x,y:0,z:z+zone.center.z})),qs=corners.filter(Boolean),all=qs.length===4;
 if(!qs.length)return report;
 const step=grid.step()/zone.factor,minX=Math.max(0,all?Math.min(...qs.map(p=>p.x)):0),maxX=Math.min(600,all?Math.max(...qs.map(p=>p.x)):600),
  minY=Math.max(0,all?Math.min(...qs.map(p=>p.y)):0),maxY=Math.min(432,all?Math.max(...qs.map(p=>p.y)):432),
  x0=Math.ceil(minX/step),x1=Math.floor(maxX/step),y0=Math.ceil(minY/step),y1=Math.floor(maxY/step);
 report.bounds={minX,maxX,minY,maxY};report.step=step;
 for(let iy=y0;iy<=y1;iy++)for(let ix=x0;ix<=x1;ix++){
  report.samples++;const x=ix*step,y=iy*step,p=groundAt(x,y),w=densityWeight(zone,p);if(w<=0)continue;
  const base=surfaceAt(p);if(!base)continue;const material=materialAt(g,p,base),q=project({...p,y:0});if(!q)continue;
  paint(x,y,material.color,material.alpha*w,zone.factor,q.depth,!!material.logoCoverage,material.logoGlow??0);report.finePoints++;
  if(material.logoCoverage){report.fineLogoPoints++;}else report.fineGrassPoints++;
  if(w<1)report.transitionPoints++;
 }
 if(logo)logo.cells=report.fineLogoPoints;
 return report;
}
