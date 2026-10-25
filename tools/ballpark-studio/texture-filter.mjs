/** Build once; average premultiplied coverage so transparent black never darkens gold edges. */
export function mipPyramid(source,strength=(data,i)=>data[i+3]/255){
 const levels=[{...source,strength}];let previous=levels[0];
 while(previous.width>1||previous.height>1){
  const width=Math.ceil(previous.width/2),height=Math.ceil(previous.height/2),data=new Uint8ClampedArray(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   let alpha=0,r=0,g=0,b=0,count=0;
   for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
    const sx=x*2+ox,sy=y*2+oy;if(sx>=previous.width||sy>=previous.height)continue;
    const i=(sy*previous.width+sx)*4,a=previous.strength?previous.strength(previous.data,i):previous.data[i+3]/255;
    count++;alpha+=a;r+=previous.data[i]*a;g+=previous.data[i+1]*a;b+=previous.data[i+2]*a;
   }
   const i=(y*width+x)*4;if(alpha>0){data[i]=r/alpha;data[i+1]=g/alpha;data[i+2]=b/alpha;}data[i+3]=alpha/count*255;
  }
  previous={width,height,data};levels.push(previous);
 }
 return levels;
}
function bilinear(level,u,v){
 const px=u*level.width-.5,py=v*level.height-.5,x0=Math.floor(px),y0=Math.floor(py),fx=px-x0,fy=py-y0;
 let r=0,g=0,b=0,a=0;
 for(let oy=0;oy<2;oy++)for(let ox=0;ox<2;ox++){
  const x=Math.max(0,Math.min(level.width-1,x0+ox)),y=Math.max(0,Math.min(level.height-1,y0+oy)),i=(y*level.width+x)*4,
   weight=(ox?fx:1-fx)*(oy?fy:1-fy),alpha=(level.strength?level.strength(level.data,i):level.data[i+3]/255)*weight;
  a+=alpha;r+=level.data[i]*alpha;g+=level.data[i+1]*alpha;b+=level.data[i+2]*alpha;
 }
 return {r,g,b,a};
}
export function sampleMip(levels,u,v,footprintU,footprintV){
 if(!levels.length||u<0||u>=1||v<0||v>=1)return null;
 const lod=Math.max(0,Math.min(levels.length-1,Math.log2(Math.max(1,levels[0].width*footprintU,levels[0].height*footprintV)))),
  low=Math.floor(lod),t=lod-low,p=bilinear(levels[low],u,v),q=bilinear(levels[Math.min(low+1,levels.length-1)],u,v),a=p.a*(1-t)+q.a*t;
 if(a<1/1024)return null;
 return {r:(p.r*(1-t)+q.r*t)/a,g:(p.g*(1-t)+q.g*t)/a,b:(p.b*(1-t)+q.b*t)/a,a,lod};
}
