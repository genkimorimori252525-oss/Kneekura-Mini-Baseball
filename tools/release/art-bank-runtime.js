/* Adopted art for the broadcast renderer. A missing or unmatched pose returns
 * null and the existing silhouette stays; nothing here substitutes a direction. */
(function(root){
 'use strict';
 const pack={/*ART_PACK*/},bank=new Map(),hits={};
 function decode(key,row){
  const image=new Image();
  image.onload=()=>{
   const w=image.naturalWidth,h=image.naturalHeight,size=Math.max(w,h),c=document.createElement('canvas');c.width=size;c.height=size;
   const ctx=c.getContext('2d',{willReadFrequently:true}),x0=Math.floor((size-w)/2),y0=size-h;ctx.drawImage(image,x0,y0);
   const bytes=ctx.getImageData(0,0,size,size).data,pixels=new Uint16Array(size*size),lut=new Map(),colors=['rgba(0,0,0,0)'];
   let minX=size,minY=size,maxX=0,maxY=0;
   for(let n=0;n<pixels.length;n++){const k=n*4;if(bytes[k+3]<96)continue;const id=(bytes[k]&248)<<16|(bytes[k+1]&248)<<8|bytes[k+2]&248;
    let index=lut.get(id);if(index===undefined){index=colors.length;lut.set(id,index);colors.push('rgb('+bytes[k]+','+bytes[k+1]+','+bytes[k+2]+')');}
    pixels[n]=index;const x=n%size,y=Math.floor(n/size);if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
   bank.set(key,{sprite:{pixels,size,originX:size/2,baseline:size-1,referenceHeight:row.referenceHeight,minX,minY,maxX,maxY,artBankV1:row.id},palette:colors,id:row.id});
  };
  image.src='data:image/png;base64,'+row.data;
 }
 for(const [key,row] of Object.entries(pack))decode(key,row);
 function pick({role,action,frame,camera,hand,form,team,running,isRobin}){
  if(running||isRobin)return null;
  let key=null;
  if(role==='umpire')key='umpire/ready';
  else if(action==='pitch'&&hand==='R'&&(camera==='catcher'||camera==='batter')&&['over','side','under'].includes(form)&&frame>=0&&frame<6)key='pitch/'+form+'/'+frame;
  else if(action==='bat'&&camera==='catcher'&&hand==='R'&&frame>=0&&frame<4)key='bat/rear/'+frame;
  else if(action==='catch'&&camera==='mound')key=team===1?'catch/home':'catch/away';
  const found=key&&bank.get(key);if(!found)return null;hits[key]=(hits[key]??0)+1;return found;
 }
 root.KneekuraArtBankV1=Object.freeze({pick,inspect:()=>({loaded:bank.size,total:Object.keys(pack).length,hits:{...hits}})});
})(globalThis);
