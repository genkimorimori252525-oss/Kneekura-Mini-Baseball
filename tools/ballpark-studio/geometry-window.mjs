import {prepareNiikuraPortrait,niikuraPortraitReady} from './niikura-scoreboard-material.mjs';
import * as geometry from './model.mjs';
import {renderStadium,stadiumMesh} from './stadium-mesh.mjs';
import {prepareLogo} from './ground-logo.mjs';
import * as surface from './surface-layers.mjs';
import {lightColor,emissiveSurface} from './stadium-effects.mjs';
import {spatialLight,paintSky,sampleFlags} from './stadium-atmosphere.mjs';
import {sampleKoshienMaterial} from './koshien-materials.mjs';
let effectOcclusion=()=>false;
function effectsCamera(g){const e=stadiumMesh(g)?.envelope;if(!e)return null;const span=Math.max(e.rx,e.rz),eye={x:0,y:e.topY+span*.8,z:e.frontZ-span*1.45};return{eye,yaw:0,pitch:Math.atan2(eye.y-e.topY*.25,e.centerZ-eye.z),f:430,cx:300,cy:250};}
globalThis.KneekuraBallparkNiikuraScoreboardV14=Object.freeze({prepare:prepareNiikuraPortrait,portraitReady:niikuraPortraitReady});
globalThis.KneekuraBallparkGeometryV1=Object.freeze(geometry);
globalThis.KneekuraBallparkArchitectureV2=Object.freeze({render:options=>renderStadium({...options,onEffectOcclusion:test=>effectOcclusion=test}),effectsCamera,effectsOccluded:(x,y,d)=>effectOcclusion(x,y,d),scoreboardTarget:g=>{const s=stadiumMesh(g)?.scoreboard;if(g.architecture?.style==='niikura_dome'&&s?.boards){const b=s.mainBoard??s.boards[1];return{x:b.x,y:b.baseY+b.height/2,z:b.z,scale:1,width:b.width,height:b.height};}return s?s.boards?{x:0,y:s.baseY+8,z:s.z,scale:1}:{x:0,y:s.baseY+24*s.scale,z:s.z,scale:s.scale}:null;}});
globalThis.KneekuraBallparkEffectsV6=Object.freeze({lightColor,emissiveSurface,
 lightAt:(c,g,p,emissive=false)=>spatialLight(g,stadiumMesh(g))?.color(c,p,emissive)??c,
 paintSky,
 flags:(g,frame)=>{const e=g.architecture?.effects?.environment;if(!e?.flags&&!e?.wind)return[];const m=stadiumMesh(g),light=spatialLight(g,m);return sampleFlags(m.surfaces.filter(s=>s.material?.startsWith('koshien:flag-')),frame,(material,u,v)=>sampleKoshienMaterial(material,u,v,{footprintU:1/64,footprintV:1/64},g),(c,p)=>light.color(c,p),e.wind??null);}
});
globalThis.KneekuraBallparkGroundLogoV2=Object.freeze({prepare:prepareLogo});
globalThis.KneekuraBallparkSurfaceV3=Object.freeze(surface);
