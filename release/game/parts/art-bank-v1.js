/* Adopted art for the broadcast renderer. A missing or unmatched pose returns
 * null and the existing silhouette stays; nothing here substitutes a direction. */
(function(root){
 'use strict';
 const pack={"pitch/over/0":{id:"b2-overhand-v3:1",referenceHeight:256.0,data:"@@ASSET:4f049e5fc53d1f8c430aec59@@"},"pitch/over/1":{id:"b2-overhand-v3:2",referenceHeight:256.0,data:"@@ASSET:a3bfd9672f5a35351783b011@@"},"pitch/over/2":{id:"b2-overhand-v3:3",referenceHeight:256.0,data:"@@ASSET:888edb1965440c548ade5479@@"},"pitch/over/3":{id:"b2-overhand-v3:4",referenceHeight:256.0,data:"@@ASSET:73e20527a163a8ef1ba28801@@"},"pitch/over/4":{id:"b2-overhand-v3:5",referenceHeight:256.0,data:"@@ASSET:245d18bbe4f635a4df7036d1@@"},"pitch/over/5":{id:"b2-overhand-v3:6",referenceHeight:256.0,data:"@@ASSET:5539369dfa2ced582e4a766a@@"},"pitch/side/0":{id:"b2-sidearm-v1:1",referenceHeight:256.0,data:"@@ASSET:c59a64082627e2f6d2e68704@@"},"pitch/side/1":{id:"b2-sidearm-v1:2",referenceHeight:256.0,data:"@@ASSET:7e22c5b04f9ae2def726348b@@"},"pitch/side/2":{id:"b2-sidearm-v1:3",referenceHeight:256.0,data:"@@ASSET:b05621418c0a09b756abc4e2@@"},"pitch/side/3":{id:"b2-sidearm-v1:4",referenceHeight:256.0,data:"@@ASSET:ed95538f7720e9094c40e89f@@"},"pitch/side/4":{id:"b2-sidearm-v1:5",referenceHeight:256.0,data:"@@ASSET:3b663ad931623ffb8143c095@@"},"pitch/side/5":{id:"b2-sidearm-v1:6",referenceHeight:256.0,data:"@@ASSET:4bf04193f06cae46fed2cff2@@"},"pitch/under/0":{id:"b2-underarm-v1:1",referenceHeight:256.0,data:"@@ASSET:7ee5ff96127bdffeb3b884ad@@"},"pitch/under/1":{id:"b2-underarm-v1:2",referenceHeight:256.0,data:"@@ASSET:498c159360a8b92128dd317e@@"},"pitch/under/2":{id:"b2-underarm-v1:3",referenceHeight:256.0,data:"@@ASSET:b969ff2e6bbbe9ce9694a304@@"},"pitch/under/3":{id:"b2-underarm-v1:4",referenceHeight:256.0,data:"@@ASSET:c746a5d62a324dd20eb495d2@@"},"pitch/under/4":{id:"b2-underarm-v1:5",referenceHeight:256.0,data:"@@ASSET:1fd53b4d01c0da181a524df6@@"},"pitch/under/5":{id:"b2-underarm-v1:6",referenceHeight:256.0,data:"@@ASSET:e6d4ffba19118e525b4a7749@@"},"bat/rear/0":{id:"b2-form-01-direct-rear-v1:ready",referenceHeight:278.26,data:"@@ASSET:e4013c5d598e5eed7238b7fa@@"},"bat/rear/1":{id:"b2-form-01-direct-rear-v1:load",referenceHeight:278.26,data:"@@ASSET:fb854663404ba13906720695@@"},"bat/rear/2":{id:"b2-form-01-direct-rear-v1:impact-middle",referenceHeight:262.25,data:"@@ASSET:3bbc72b7881d3ee332d9ce05@@"},"bat/rear/3":{id:"b2-form-01-direct-rear-v1:follow-middle",referenceHeight:278.26,data:"@@ASSET:983cf5cf802f02d698b4deb7@@"},"catch/home":{id:"b2-catcher-ready-v1:both-knees-up",referenceHeight:412.9,data:"@@ASSET:359fd91d32d6648f95c6867e@@"},"catch/away":{id:"b2-catcher-ready-v1:both-knees-up",referenceHeight:412.9,data:"@@ASSET:fbf0e0c8b92805b5244aa4bb@@"},"umpire/ready":{id:"b2-plate-umpire-ready-v1:hands-on-knees",referenceHeight:298.3,data:"@@ASSET:e8a85a4ac7d9a40a5f670ccf@@"}},bank=new Map(),hits={};
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
