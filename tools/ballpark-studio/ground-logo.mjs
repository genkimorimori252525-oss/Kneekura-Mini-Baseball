import {mipPyramid,sampleMip} from './texture-filter.mjs';
import {wallAt} from './model.mjs';
let texture=null;
function logoStrength(data,index){const luminance=(.2126*data[index]+.7152*data[index+1]+.0722*data[index+2])/255,
 core=Math.max(0,Math.min(1,(luminance-.25)/.55));return Math.pow(data[index+3]/255,1.4)*core*core*.9;}
function distanceMask(t){const width=192,height=Math.round(width*t.height/t.width),pad=16,w=width+2*pad,h=height+2*pad,field=new Float32Array(w*h);field.fill(1e6);
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){let covered=false;for(const oy of [.25,.75])for(const ox of [.25,.75]){
  const sx=Math.min(t.width-1,Math.floor((x+ox)*t.width/width)),sy=Math.min(t.height-1,Math.floor((y+oy)*t.height/height));if(logoStrength(t.data,(sy*t.width+sx)*4)>.1)covered=true;}
  if(covered)field[(y+pad)*w+x+pad]=0;}
 const update=(x,y,dx,dy,cost)=>{const i=y*w+x,nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h)field[i]=Math.min(field[i],field[ny*w+nx]+cost);};
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){update(x,y,-1,0,1);update(x,y,0,-1,1);update(x,y,-1,-1,Math.SQRT2);update(x,y,1,-1,Math.SQRT2);}
 for(let y=h-1;y>=0;y--)for(let x=w-1;x>=0;x--){update(x,y,1,0,1);update(x,y,0,1,1);update(x,y,1,1,Math.SQRT2);update(x,y,-1,1,Math.SQRT2);}
 return {width,height,pad,w,h,field};}
export async function prepareLogo(src){
 const image=new Image();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(Error('芝生ロゴを読み込めません'));image.src=src;});
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
 texture={width:canvas.width,height:canvas.height,data:ctx.getImageData(0,0,canvas.width,canvas.height).data};texture.mask=distanceMask(texture);texture.mips=mipPyramid(texture,logoStrength);return {width:texture.width,height:texture.height};
}
/** The badge is a read-only texture on a world-space grass plane, never a screen HUD. */
export function logoBounds(g){const l=g?.architecture?.logo;if(!l?.enabled)return null;
 const aspect=texture?texture.height/texture.width:1189/1323;
 return {width:l.widthMeters,length:l.widthMeters*aspect,centerZ:l.centerZ};}
export function sampleGroundLogo(g,p){
 const l=g?.architecture?.logo;if(!l?.enabled||!texture||!p)return null;
 const b=logoBounds(g),u=p.x/b.width+.5,v=.5-(p.z-b.centerZ)/b.length;
 if(u<0||u>=1||v<0||v>=1||p.z<55||Math.abs(Math.atan2(p.x,p.z))>Math.PI/4)return null;
 if(Math.hypot(p.x,p.z)>wallAt(g,Math.atan2(p.x,p.z)).distanceMeters-g.trackWidthMeters-.5)return null;
 const index=(Math.floor(v*texture.height)*texture.width+Math.floor(u*texture.width))*4,a=logoStrength(texture.data,index);
 return a<.06?null:{r:texture.data[index],g:texture.data[index+1],b:texture.data[index+2],a};
}
export function distanceToLogo(footprint,p){
 if(!texture?.mask){const dx=Math.abs(p.x)-footprint.width/2,dz=Math.abs(p.z-footprint.centerZ)-footprint.length/2;return Math.hypot(Math.max(dx,0),Math.max(dz,0));}
 const m=texture.mask,qx=(p.x/footprint.width+.5)*m.width+m.pad-.5,qy=(.5-(p.z-footprint.centerZ)/footprint.length)*m.height+m.pad-.5,
  x=Math.max(0,Math.min(m.w-1,Math.round(qx))),y=Math.max(0,Math.min(m.h-1,Math.round(qy))),outside=Math.hypot(qx-x,qy-y);
 return (m.field[y*m.w+x]+outside)*footprint.width/m.width;
}
/** Shared read-only material sample for vertical emblems as well as grass. */
export function sampleLogoUV(u,v,footprint=null){
 if(!texture||u<0||u>=1||v<0||v>=1)return null;
 if(footprint)return sampleMip(texture.mips,u,v,footprint.footprintU,footprint.footprintV);
 const i=(Math.floor(v*texture.height)*texture.width+Math.floor(u*texture.width))*4,a=logoStrength(texture.data,i);
 return a<.06?null:{r:texture.data[i],g:texture.data[i+1],b:texture.data[i+2],a};
}
