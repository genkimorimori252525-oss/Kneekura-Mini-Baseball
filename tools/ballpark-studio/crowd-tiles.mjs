import {ledColor} from './crowd.mjs';
import {mipPyramid,sampleMip} from './texture-filter.mjs';
export const CROWD_TILE=Object.freeze({width:16,height:12,frameCount:3,variantCount:8,occupancy:1,individualWorldObjects:0});
const cache=new Map();
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)),hex=values=>'#'+values.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''),
 shade=(c,k)=>hex(rgb(c).map(v=>v*k)),seed=n=>(Math.imul(n+1,2654435761)^(n>>>4))>>>0;
/** A tiny shared atlas of a packed crowd block. No per-spectator world objects. */
export function crowdAtlas(colors,appearance,packed=false,wardrobe=null){const key=JSON.stringify([colors,appearance,packed,wardrobe]);if(cache.has(key))return cache.get(key);
 if(packed)return packedAtlas(colors,appearance,key);
 const clothing=(id,variant)=>{if(wardrobe!=='mixed-yellow')return colors[id%2];const slot=(id+variant*3)%8;return slot<3?colors[slot%2]:['#e3e0d5','#ddd8c9','#9caaa9','#314657','#775452'][slot-3];};
 const variants=[],W=CROWD_TILE.width,H=CROWD_TILE.height,order=[0,3,1,4,2,5],jumps=[0,2,3],
  budget=appearance.density<=0?0:Math.max(1,Math.min(6,Math.round(appearance.density*6)));
 for(let variant=0;variant<CROWD_TILE.variantCount;variant++){
  const frames=[];
  for(let frame=0;frame<3;frame++){
   const cells=Array.from({length:W*H},(_,i)=>({color:shade(wardrobe?clothing(Math.floor(i/W/3)+Math.floor(i%W/4),variant):colors[(Math.floor(i/W/3)+Math.floor(i%W/4)+variant)%2],.45+(seed(i+variant*193)%4)*.05),glow:0,kind:'crowd'})),
    put=(x,y,color,kind='crowd',glow=0,cluster=null)=>{if(x>=0&&x<W&&y>=0&&y<H)cells[y*W+x]={color,glow,kind,...(cluster===null?{}:{cluster})};},
    active=new Set(Array.from({length:budget},(_,i)=>order[(variant*5+jumps[frame]+i)%6]));
   // A handful of shared motifs, not individual people in the baseball world.
   for(let row=0;row<2;row++)for(let column=0;column<3;column++){
    const id=row*3+column,pose=(frame+(seed(id+variant*13)>>>8)%3)%3,
     lean=[-1,0,1][pose],x=2+column*5+(row%2)-(seed(id+variant*19)&1),y=3+row*6,bx=x+lean,shirt=wardrobe?clothing(id,variant):colors[(column+row+variant)%2];
    if(appearance.detail!=='lights'){
     put(bx,y+1,shade(shirt,.7));put(bx+1,y+1,shade(shirt,.85));put(x,y+2,shade(shirt,.65));put(x+1,y+2,shade(shirt,.65));
     put(bx,y,'#a99076','head');put(bx+lean,y-1,shade(shirt,.7));
     if(appearance.detail==='full'){put(bx+1,y,'#d6bb98','head');put(bx-1,y+1,shade(shirt,.6));}
    }
    if(active.has(id)){
     const lx=bx,ly=y-2-(pose===1?1:0),color=hex(rgb(ledColor(colors[(id+row+variant)%2])).map(v=>v*appearance.brightness));
     // Several short 7cm lights form a small island; the active pocket varies per pose.
     for(const [dx,dy]of [[0,0],[1,0],[0,1],[1,1]])put(lx+dx,ly+dy,
      dx===0&&dy===0?hex(rgb(color).map(v=>v*.7+255*.3)):color,'led',(appearance.glow??.7)*9,id);
    }
   }
   frames.push(cells);
  }
  variants.push(frames);
 }
 const atlas={key,frames:variants[0],variants,...CROWD_TILE,...(wardrobe?{wardrobe}: {})};if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,atlas);return atlas;
}
/** Denser shared texture; people stay in the background while only LED islands move. */
function packedAtlas(colors,appearance,key){const W=CROWD_TILE.width,H=CROWD_TILE.height,variants=[],order=[0,7,2,9,4,11,6,1,8,3,10,5],budget=appearance.density<=0?0:Math.max(1,Math.min(12,Math.round(appearance.density*12)));
 for(let variant=0;variant<CROWD_TILE.variantCount;variant++){
  const base=Array.from({length:W*H},(_,i)=>({color:shade(colors[(Math.floor(i/W/4)+Math.floor(i%W/4)+variant)%2],.55+(seed(i+variant*193)%4)*.05),glow:0,kind:'crowd'}));
  if(appearance.detail!=='lights')for(let row=0;row<3;row++)for(let col=0;col<4;col++){const x=col*4,y=row*4,shirt=colors[(row+col+variant)%2];for(let dx=0;dx<4;dx++){base[(y+3)*W+x+dx]={color:shade(shirt,.7+(dx%2)*.12),glow:0,kind:'crowd'};base[(y+2)*W+x+dx]={color:dx===1?'#bda084':dx===2?'#dec2a0':shade(shirt,.72),glow:0,kind:dx===1||dx===2?'head':'crowd'};}}
  const frames=[];for(let frame=0;frame<3;frame++){const cells=base.slice(),active=new Set(Array.from({length:budget},(_,i)=>order[(variant*5+frame*4+i)%12]));
   for(const id of active){const row=Math.floor(id/4),col=id%4,pose=(frame+(seed(id+variant*13)>>>8)%3)%3,x=col*4+pose,y=row*4,color=hex(rgb(ledColor(colors[(id+row+variant)%2])).map(v=>v*appearance.brightness));
    for(let dy=0;dy<2;dy++)for(let dx=0;dx<2;dx++)cells[(y+dy)*W+x+dx]={color:dx===0&&dy===0?hex(rgb(color).map(v=>v*.7+255*.3)):color,kind:'led',glow:(appearance.glow??.7)*9,cluster:id};
   }frames.push(cells);
  }variants.push(frames);
 }
 const atlas={key,frames:variants[0],variants,...CROWD_TILE,layout:'packed',pockets:12};if(cache.size>=4)cache.delete(cache.keys().next().value);cache.set(key,atlas);return atlas;
}
export function sampleCrowdTile(atlas,u,v,tile,frame,frames,size=1){
 const su=(tile%2?1-u:u)/size,sv=v/size,block=seed(tile^Math.imul(Math.floor(su),73856093)^Math.imul(Math.floor(sv),19349663)),
  phase=(frame+(block>>>11)%frames)%frames,index=frames===2?phase*2:phase,
  fraction=n=>n-Math.floor(n),x=Math.floor(fraction(su)*atlas.width),y=Math.floor(fraction(sv)*atlas.height),
  variant=atlas.variants?.[(block>>>3)%atlas.variants.length]??atlas.frames;
 return variant[index][y*atlas.width+x];
}
const metricCache=new WeakMap(),tints=new Map();
function metricLevels(atlas){let levels=metricCache.get(atlas);if(levels)return levels;
 levels=atlas.variants.map(frames=>frames.map(cells=>{const color=new Uint8ClampedArray(cells.length*4),tint=new Uint8ClampedArray(color.length),led=new Uint8ClampedArray(color.length);let glow=0;
  cells.forEach((p,i)=>{const c=rgb(p.color),a=i*4;for(let k=0;k<3;k++)color[a+k]=tint[a+k]=led[a+k]=c[k];color[a+3]=255;tint[a+3]=atlas.wardrobe?0:p.kind==='led'?0:p.kind==='head'?.3*255:.6*255;led[a+3]=p.kind==='led'?255:0;if(p.kind==='led')glow=p.glow;});
  const mip=data=>mipPyramid({width:atlas.width,height:atlas.height,data});return{color:mip(color),tint:mip(tint),led:mip(led),glow};
 }));metricCache.set(atlas,levels);return levels;
}
/** Perspective-filtered crowd, keeping lit clothing separate from emitted LED light. */
export function sampleMetricCrowdTile(atlas,u,v,tile,frame,frames,size,footprint,seatTint,shadeDiffuse){
 const su=(tile%2?1-u:u)/size,sv=v/size,block=seed(tile^Math.imul(Math.floor(su),73856093)^Math.imul(Math.floor(sv),19349663)),phase=(frame+(block>>>11)%frames)%frames,index=frames===2?phase*2:phase,
  levels=metricLevels(atlas)[(block>>>3)%atlas.variants.length][index],fu=footprint[0]/size,fv=footprint[1]/size,fx=su-Math.floor(su),fy=sv-Math.floor(sv),color=sampleMip(levels.color,fx,fy,fu,fv),tint=sampleMip(levels.tint,fx,fy,fu,fv),led=sampleMip(levels.led,fx,fy,fu,fv),coverage=led?.a??0,body=1-coverage;
 let target=tints.get(seatTint);if(!target){target=rgb(seatTint);if(tints.size>=64)tints.delete(tints.keys().next().value);tints.set(seatTint,target);}
 const total=[color.r,color.g,color.b],emitted=led?[led.r,led.g,led.b]:[0,0,0],removed=tint?[tint.r,tint.g,tint.b]:[0,0,0],weight=tint?.a??0,
  diffuse=body>1e-6?rgb(shadeDiffuse(hex(total.map((c,i)=>(c-emitted[i]*coverage-removed[i]*weight+target[i]*weight)/body)))):[0,0,0];
 return{color:hex(diffuse.map((c,i)=>c*body+emitted[i]*coverage)),glow:levels.glow*coverage,alpha:1};
}
