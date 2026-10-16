// Shared light-cell painter: world, markings and authored players use one 4px lattice.
export function light(ctx,x,y,color,replace=false){
 if(!Number.isInteger(x)||!Number.isInteger(y))throw new Error('Light must occupy an integer cell');
 if(replace){ctx.fillStyle='#000';ctx.fillRect(x*4,y*4,4,4);}
 ctx.fillStyle=color;ctx.beginPath();ctx.arc(x*4+2,y*4+2,1.45,0,Math.PI*2);ctx.fill();
}
export function lineCells(points){
 const cells=new Map();
 for(let i=1;i<points.length;i++){
  const a=points[i-1],b=points[i];if(!a||!b)continue;
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)));
  // Projected reference polygons are already finite and camera-clipped by the builder.
  if(n>4000)continue;
  for(let j=0;j<=n;j++){const t=j/n,x=Math.round(a.x+(b.x-a.x)*t),y=Math.round(a.y+(b.y-a.y)*t);if(x>=0&&x<150&&y>=0&&y<108)cells.set(x+','+y,{x,y});}
 }
 return [...cells.values()];
}
export function fieldCells(camera){
 const result=[];
 for(let y=0;y<108;y++)for(let x=0;x<150;x++){
  const side=(x-camera.centerX)/camera.focalLength,up=(camera.centerY-y)/camera.focalLength;
  const ahead=Math.sin(camera.pitch)*up+Math.cos(camera.pitch),dy=Math.cos(camera.pitch)*up-Math.sin(camera.pitch);
  if(dy>=-.0001)continue;
  const t=-camera.eye.y/dy;
  const wx=camera.eye.x+t*(Math.cos(camera.yaw)*side+Math.sin(camera.yaw)*ahead);
  const wz=camera.eye.z+t*(-Math.sin(camera.yaw)*side+Math.cos(camera.yaw)*ahead);
  const rad=Math.hypot(wx,wz),theta=Math.atan2(wx,Math.max(.001,wz));
  const edge=100+22*Math.cos(2*Math.max(-Math.PI/4,Math.min(Math.PI/4,theta)));
  if(wz< -18.288||Math.abs(wx)>Math.max(20,wz+10)||rad>edge+3)continue;
  const fair=wz>=0&&Math.abs(wx)<=wz;
  const B=27.432/Math.SQRT2,diamond=Math.abs(wx)+Math.abs(wz-B)<B-3;
  const soil=rad<3.9624||(fair&&((Math.hypot(wx,wz-18.4404)<28.956&&!diamond)||Math.hypot(wx,wz-17.9832)<2.7432));
  const stripe=(Math.floor((wx+wz)/9)+Math.floor((wz-wx)/9))%2===0;
  result.push({x,y,color:soil?'#a88e63':rad>edge-3.5?'#84744f':stripe?'#437a39':'#37692e'});
 }
 return result;
}
