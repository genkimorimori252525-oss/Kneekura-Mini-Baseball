import {ledColor} from './crowd.mjs';
export const CROWD_TILE=Object.freeze({width:16,height:12,frameCount:3,occupancy:1,individualWorldObjects:0});
let cached=null;
const rgb=hex=>hex.slice(1).match(/../g).map(v=>parseInt(v,16)),hex=values=>'#'+values.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join(''),
 shade=(c,k)=>hex(rgb(c).map(v=>v*k)),seed=n=>(Math.imul(n+1,2654435761)^(n>>>4))>>>0;
/** A tiny shared atlas of a packed crowd block. No per-spectator world objects. */
export function crowdAtlas(colors,appearance){const key=JSON.stringify([colors,appearance]);if(cached?.key===key)return cached;
 const frames=[],W=CROWD_TILE.width,H=CROWD_TILE.height;
 for(let frame=0;frame<3;frame++){
  const cells=Array.from({length:W*H},(_,i)=>({color:shade(colors[(Math.floor(i/W/3)+Math.floor(i%W/4))%2],.45+(seed(i)%4)*.05),glow:0,kind:'crowd'})),
   put=(x,y,color,kind='crowd',glow=0)=>{if(x>=0&&x<W&&y>=0&&y<H)cells[y*W+x]={color,glow,kind};};
  // Six chunky motifs are authored ONCE in the atlas; runtime only samples block pixels.
  for(let row=0;row<2;row++)for(let column=0;column<3;column++){
   const id=row*3+column,x=2+column*5+(row%2),y=3+row*6,shirt=colors[(column+row)%2];
   if(appearance.detail!=='lights'){
    put(x,y+1,shade(shirt,.7));put(x+1,y+1,shade(shirt,.85));put(x,y+2,shade(shirt,.65));put(x+1,y+2,shade(shirt,.65));
    put(x,y,'#a99076','head');if(appearance.detail==='full'){put(x+1,y,'#d6bb98','head');put(x-1,y+1,shade(shirt,.6));}
   }
   if(seed(id+31)/4294967296<appearance.density){
    const lx=x+[-1,0,1][frame],ly=y-2+(frame===1?-1:0),color=hex(rgb(ledColor(colors[(id+row)%2])).map(v=>v*appearance.brightness));
    // A luminous island represents several nearby 7cm lights, not one elongated stick.
    for(const [dx,dy]of [[0,0],[1,0],[0,1],[1,1]])put(lx+dx,ly+dy,
     dx===0&&dy===0?hex(rgb(color).map(v=>v*.7+255*.3)):color,'led',(appearance.glow??.7)*9);
   }
  }
  frames.push(cells);
 }
 cached={key,frames,...CROWD_TILE};return cached;
}
export function sampleCrowdTile(atlas,u,v,tile,frame,frames,size=1){
 const phase=(frame+seed(tile)%frames)%frames,index=frames===2?phase*2:phase,
  fraction=n=>n-Math.floor(n),x=Math.floor(fraction((tile%2?1-u:u)/size)*atlas.width),y=Math.floor(fraction(v/size)*atlas.height);
 return atlas.frames[index][y*atlas.width+x];
}
