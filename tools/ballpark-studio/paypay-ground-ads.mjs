import {mipPyramid,sampleMip} from './texture-filter.mjs';
const k=Math.SQRT1_2;
export const PAYPAY_ADS=Object.freeze([
 {id:'third-side',x:-13.5,z:7.5,width:13.8,length:2.4,ux:k,uz:-k,quad:[[164,307],[267,346],[255,368],[152,329]]},
 {id:'first-side',x:13.5,z:7.5,width:13.8,length:2.4,ux:k,uz:k,quad:[[373,346],[476,307],[488,329],[385,368]]},
 {id:'home',x:0,z:-9,width:9,length:3,ux:1,uz:0,quad:[[281,365],[359,365],[359,385],[281,385]]}
]);
const masks=new Map(),W=256,H=64;
export function paypayAdUV(ad,p){const dx=p.x-ad.x,dz=p.z-ad.z;return{u:.5+(dx*ad.ux+dz*ad.uz)/ad.width,v:.5-(-dx*ad.uz+dz*ad.ux)/ad.length};}
function distanceField(alpha,ad){const field=new Float32Array(W*H);for(let i=0;i<field.length;i++)field[i]=alpha[i]>.1?0:1e5;
 const dx=ad.width/W,dy=ad.length/H,diag=Math.hypot(dx,dy),put=(x,y,a,b,d)=>{const nx=x+a,ny=y+b;if(nx>=0&&nx<W&&ny>=0&&ny<H)field[y*W+x]=Math.min(field[y*W+x],field[ny*W+nx]+d);};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){put(x,y,-1,0,dx);put(x,y,0,-1,dy);put(x,y,-1,-1,diag);put(x,y,1,-1,diag);}
 for(let y=H-1;y>=0;y--)for(let x=W-1;x>=0;x--){put(x,y,1,0,dx);put(x,y,0,1,dy);put(x,y,1,1,diag);put(x,y,-1,1,diag);}return field;
}
/** Read the supplied pixel-art lettering, rejecting green turf; never redraw a guessed company name. */
export async function preparePaypayAdvertisements(src){const img=new Image();await new Promise((r,j)=>{img.onload=r;img.onerror=()=>j(Error('福岡の芝広告素材を読み込めません'));img.src=src;});const canvas=document.createElement('canvas');canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0);const source=ctx.getImageData(0,0,canvas.width,canvas.height).data;
 for(const ad of PAYPAY_ADS){const alpha=new Float32Array(W*H),data=new Uint8ClampedArray(W*H*4),q=ad.quad;for(let y=0;y<H;y++)for(let x=0;x<W;x++){const u=(x+.5)/W,v=(y+.5)/H,sx=(1-v)*(q[0][0]*(1-u)+q[1][0]*u)+v*(q[3][0]*(1-u)+q[2][0]*u),sy=(1-v)*(q[0][1]*(1-u)+q[1][1]*u)+v*(q[3][1]*(1-u)+q[2][1]*u),ix=Math.min(canvas.width-1,Math.max(0,Math.round(sx))),iy=Math.min(canvas.height-1,Math.max(0,Math.round(sy))),i=(iy*canvas.width+ix)*4,c=[source[i],source[i+1],source[i+2]],a=Math.max(0,Math.min(1,(Math.min(c[0],c[2])-58)/134))*source[i+3]/255,n=y*W+x;alpha[n]=a;data.set([238,241,228,Math.round(a*255)],n*4);}masks.set(ad.id,{levels:mipPyramid({width:W,height:H,data}),distance:distanceField(alpha,ad),coverage:alpha.reduce((n,a)=>n+(a>0?1:0),0)});}
 return{ads:PAYPAY_ADS.map(ad=>({id:ad.id,coverage:masks.get(ad.id).coverage})),method:'reference_white_material_alpha'};
}
export function distanceToPaypayAds(p){let distance=Infinity;for(const ad of PAYPAY_ADS){const mask=masks.get(ad.id);if(!mask)continue;const{u,v}=paypayAdUV(ad,p),x=Math.max(0,Math.min(W-1,Math.round(u*W))),y=Math.max(0,Math.min(H-1,Math.round(v*H))),outside=Math.hypot(Math.max(0,-u,u-1)*ad.width,Math.max(0,-v,v-1)*ad.length);distance=Math.min(distance,mask.distance[y*W+x]+outside);}return distance;}
export function samplePaypayAd(g,p){if(!p||g?.architecture?.style!=='fukuoka_dome'||g.architecture.details?.logos===false)return null;for(const ad of PAYPAY_ADS){const{u,v}=paypayAdUV(ad,p),m=masks.get(ad.id);if(!m||u<0||u>1||v<0||v>1)continue;const s=sampleMip(m.levels,u,v,0,0);if(s&&s.a>.02)return{r:s.r,g:s.g,b:s.b,a:s.a*.92};}return null;}
