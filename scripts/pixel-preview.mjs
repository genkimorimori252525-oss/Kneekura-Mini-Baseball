import {build} from 'esbuild';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {fieldCells,lineCells} from './pixel-review-raster.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
async function bundle(contents){const b=await build({stdin:{contents,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});return import('data:text/javascript;base64,'+Buffer.from(b.outputFiles[0].contents).toString('base64'));}
const api=await bundle(`export * from './src/presentation/mini/pixel-player/index'; export * from './src/core/sim/plateAppearance/ContactVerticalSlice';`);
const author=await bundle(`export * from './tools/pixel-player/authoring';`);
const raster=await build({entryPoints:[root+'scripts/pixel-review-raster.mjs'],bundle:true,platform:'browser',format:'iife',globalName:'DroneRaster',write:false});
const load=(name)=>api.compilePixelPlayerAsset(JSON.parse(readFileSync(root+'assets/pixel-players/players/'+name+'.pixel.json','utf8')));
const asset=load('b1-recovery'),old=load('b1-test'),catcher=load('b1-catcher');
const raw=JSON.parse(readFileSync(root+'assets/pixel-players/players/b1-recovery.pixel.json','utf8'));
const defense=api.compilePixelPlayerAsset({...raw,id:'b1-defense-review',palette:{...raw.palette,U:'#88c9ef',V:'#5a9ac4',D:'#386383'}});
author.runPixelAuthoring(['compile',root+'assets/pixel-players/players/b1-recovery.pixel.json',root+'.pixel-build/recovery'],root+'assets/fonts/NotoSansJP-review.woff');
const worlds=[0,55000,110000,137000,165000,220000].map(tick=>({tick,defenders:[{playerId:'p',registeredPosition:'P',position:{x:0,z:18.44},velocity:{x:0,z:0},assignment:{kind:'hold'}}],runners:[],ball:null}));
const contact=api.simulateContactVerticalSlice({pitch:{tick:137000,position:{x:0,y:1,z:.06},velocity:{x:0,y:-1.5,z:-35},spin:{x:0,y:0,z:0}},swing:{pose:{grip:{x:-.42,y:1,z:0},tip:{x:.42,y:1,z:0}},linearVelocity:{x:0,y:0,z:22},angularVelocity:{x:0,y:0,z:0}},defenders:worlds[0].defenders,runners:[],durationTicks:110000,cadenceTicks:55000});
const scenes={};
const rect=(x0,z0,x1,z1)=>[{x:x0,y:0,z:z0},{x:x1,y:0,z:z0},{x:x1,y:0,z:z1},{x:x0,y:0,z:z1},{x:x0,y:0,z:z0}];
for(const hand of ['R','L'])for(const mode of ['PITCHER_POV','BATTER_POV','CATCHER_POV','FIELD_OVERHEAD']){
 let camera=api.createPixelReviewCamera(mode,hand);
 // Optical zoom restores the adopted broadcast composition, without moving any player.
 if(mode==='PITCHER_POV')camera={...camera,focalLength:400,centerY:48};
 if(mode==='BATTER_POV')camera={...camera,eye:{x:hand==='R'?-.4:.4,y:1.30,z:-.95},focalLength:100,centerY:20,pitch:.08};
 if(mode==='CATCHER_POV')camera={...camera,eye:{x:0,y:1.03,z:-1},focalLength:110,centerY:26,pitch:.018};
 if(mode==='FIELD_OVERHEAD')camera={...camera,eye:{x:0,y:100,z:-35},pitch:Math.atan2(100,85),focalLength:117.5,centerY:56};
 const project=p=>api.projectPixelCamera(p,camera);
 const polygons=[rect(-1.5875,-.6985,-.3683,1.1303),rect(.3683,-.6985,1.5875,1.1303),[{x:-.5461,y:0,z:-.6985},{x:-.5461,y:0,z:-2.4384},{x:.5461,y:0,z:-2.4384},{x:.5461,y:0,z:-.6985}],rect(-.3048,18.4404,.3048,18.5928),[{x:0,y:0,z:0},{x:.2159,y:0,z:.2159},{x:.2159,y:0,z:.4318},{x:-.2159,y:0,z:.4318},{x:-.2159,y:0,z:.2159},{x:0,y:0,z:0}]];
 const B=27.432/Math.SQRT2;
 for(const [x,z] of [[B,B],[0,2*B],[-B,B]])polygons.push(rect(x-.2286,z-.2286,x+.2286,z+.2286));
 for(const sign of [-1,1])polygons.push([{x:sign*1.1303,y:0,z:1.1303},{x:sign*100/Math.SQRT2,y:0,z:100/Math.SQRT2}]);
 const fence=[];for(let i=0;i<=80;i++){const a=-Math.PI/4+i*Math.PI/160,r=100+22*Math.cos(2*a);fence.push({x:r*Math.sin(a),y:0,z:r*Math.cos(a)});}
 const chalk=polygons.flatMap(ps=>lineCells(ps.map(project)));
 const walls=lineCells(fence.map(project));
 const zone=mode==='FIELD_OVERHEAD'?[]:lineCells([{x:-.2159,y:.486,z:0},{x:.2159,y:.486,z:0},{x:.2159,y:.963,z:0},{x:-.2159,y:.963,z:0},{x:-.2159,y:.486,z:0}].map(project));
 const zoneBounds=zone.length?{x:Math.min(...zone.map(p=>p.x)),y:Math.min(...zone.map(p=>p.y)),width:Math.max(...zone.map(p=>p.x))-Math.min(...zone.map(p=>p.x))+1,height:Math.max(...zone.map(p=>p.y))-Math.min(...zone.map(p=>p.y))+1}:undefined;
 scenes[`${hand}-${mode}`]={ground:fieldCells(camera),chalk,walls,zone,frames:worlds.map((world,i)=>{
  const phase=i<2?i:i===2||i===3?2:3;
  const batter={playerId:'b',role:'batter',name:hand==='R'?'浅野':'吉田',position:{x:hand==='R'?-.97:.97,y:0,z:.72},height:1.8,facing:{x:hand==='R'?-1:1,z:1},facts:{action:'batting',direction:hand==='R'?'FRONT_LEFT':'FRONT_RIGHT',hand,phase}};
  const pitcher={playerId:'p',role:'pitcher',name:'森',position:{x:0,y:0,z:18.44},height:1.86,facing:{x:0,z:-1},facts:{action:'pitching',direction:'FRONT',hand:'R',phase}};
  const visibleActors=[batter];
  const observation={...batter,batterState:{handedness:hand,action:'normal_swing',bat:contact.initialBat??{grip:{x:-.42,y:1,z:0},tip:{x:.42,y:1,z:0}}}};
  const current=api.buildPixelPlayerScene(world,visibleActors.map(a=>a.role==='batter'?observation:a),asset,camera,contact.events,zoneBounds);
  // Historic comparison is display-only: do not assert its old pose matches the new optical framing's exact contact.
  const previous=api.buildPixelPlayerScene(world,visibleActors,old,camera,[],zoneBounds);
  if(mode!=='PITCHER_POV'){
   const pitching=api.buildPixelPlayerScene(world,[pitcher],defense,camera,[],zoneBounds);
   current.cells.push(...pitching.cells);current.labels.push(...pitching.labels);current.players.push(...pitching.players);
   const previousPitch=api.buildPixelPlayerScene(world,[pitcher],old,camera,[],zoneBounds);
   previous.cells.push(...previousPitch.cells);previous.labels.push(...previousPitch.labels);previous.players.push(...previousPitch.players);
  }
  let c={cells:[],labels:[],players:[]};
  if(mode==='PITCHER_POV')c=api.buildPixelPlayerScene(world,[{playerId:'c',role:'catcher',name:'田村',position:{x:0,y:0,z:-.8},height:1.8,facing:{x:0,z:-1},facts:{action:'fielding',direction:'BACK',hand:'R',phase:0}}],catcher,camera,[],zoneBounds);
  return {tick:world.tick,phase,current,previous,catcher:c,ball:world.tick===137000?project(contact.contact.point):null};
 })};
}
const metadata=JSON.parse(readFileSync(root+'.pixel-build/recovery/atlas.json','utf8'));
const atlas=readFileSync(root+'.pixel-build/recovery/atlas.png').toString('base64');
const groups=[['右打者',metadata.frames.filter(f=>f.id.startsWith('batting-R'))],['左打者',metadata.frames.filter(f=>f.id.startsWith('batting-L'))],['右投げ',metadata.frames.filter(f=>f.id.startsWith('pitching-FRONT-R'))],['左投げ',metadata.frames.filter(f=>f.id.startsWith('pitching-FRONT-L'))]];
const gallery=groups.map(([label,frames])=>{
 const batting=label.includes('打者');
 const labels=batting?['構え','ため','インパクト','振り抜き']:['構え','足上げ','踏み出し','投げ終わり'];
 return `<section><h2>${label}の4コマ</h2><div class="frames">${frames.map((f,i)=>`<${batting?'button':'figure'} class="pose${batting?' batting-pose':''}" ${batting?`data-hand="${label==='左打者'?'L':'R'}" data-index="${[0,1,2,4][i]}"`:''}><canvas width="288" height="288" data-defense="${!batting}" data-x="${f.x}" data-y="${f.y}"></canvas><span>${labels[i]}</span></${batting?'button':'figure'}>`).join('')}</div></section>`;
}).join('');
const font=readFileSync(root+'assets/fonts/NotoSansJP-review.woff').toString('base64');
const html=`<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kneekura B1 · 描画比較</title><style>
@font-face{font-family:PixelReview;src:url(data:font/woff;base64,${font}) format('woff')}*{box-sizing:border-box}body{margin:0;background:#000;color:#e9e9e3;font:15px PixelReview,sans-serif}main{max-width:760px;margin:auto;padding:20px 16px}h1{font-size:22px;font-weight:500;margin:0 0 12px}p{color:#aaa;line-height:1.7;margin:8px 0 16px}button,select{font:inherit;color:#ccc;border:1px solid #444;background:#0b0d0b;padding:10px 12px;border-radius:2px;cursor:pointer}button:focus-visible,select:focus-visible{outline:2px solid #e0b541;outline-offset:3px}button.active{color:#e0b541;border-color:#e0b541;background:#252114}.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:16px 0}.versions{display:flex;gap:8px;border-top:1px solid #333;padding-top:16px}.versions button{flex:1}.screen{border-top:1px solid #333;border-bottom:1px solid #333;margin-top:16px;background:#000}.screen canvas{display:block;margin:auto;max-width:100%}.view-label{display:flex;justify-content:space-between;color:#aaa;font-size:13px;padding:12px 0}.status{display:flex;justify-content:space-between;padding:12px 0;color:#c3ac61;font-size:13px}.players{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid #333;border-bottom:1px solid #333}.players>div{padding:12px}.players>div+div{border-left:1px solid #333}.players small{color:#999}.players strong{display:block;font-size:24px;font-weight:500;margin:5px 0}.tag{font-size:13px;border:1px solid #668294;padding:2px 6px;color:#aacfe9}.battertag{border-color:#9c6771;color:#e4a2ad}section{margin-top:32px}h2{font-size:17px;font-weight:500;margin:0 0 12px}.frames{display:flex;gap:10px;overflow-x:auto;padding-bottom:10px}.pose{margin:0;padding:0;border:1px solid #333;flex:0 0 288px;background:#000}.pose canvas{display:block;width:288px;height:288px}.pose span{display:block;padding:12px;border-top:1px solid #222;color:#aaa}.note{font-size:13px;line-height:1.7;color:#888;border-top:1px solid #333;padding-top:16px;margin-top:24px}@media(max-width:420px){main{padding:16px 12px}.toolbar button,.toolbar select{padding:9px 10px}.players strong{font-size:22px}h1{font-size:20px}}
</style><main><h1>B1の描画比較</h1><p>小顔、厚い肩、丸い手足。選手と球場を、同じ光の点で描く。</p><div class="versions"><button id="new" class="active">描き直し</button><button id="old">前の確認版</button></div><div class="toolbar"><select id="camera" aria-label="視点"><option value="PITCHER_POV">投手目線</option><option value="BATTER_POV">打者目線</option><option value="CATCHER_POV">捕手目線</option><option value="FIELD_OVERHEAD">俯瞰</option></select><button id="hand">右打者</button><button id="play">再生</button><button id="step">1コマ</button></div><div class="view-label"><span id="view"></span><span id="pose-name">構え</span></div><div class="screen"><canvas id="stage" width="600" height="432" aria-label="B1の試合描画比較"></canvas></div><div class="status"><span id="time"></span><span id="info"></span></div><div class="players"><div><small>投手 18</small><strong>森 <span class="tag">右投</span></strong></div><div><small>打者</small><strong id="batter-name">浅野 <span class="tag battertag">右打</span></strong></div></div>${gallery}<p class="note">描画を比べる短い試験映像です。4px格子、55ms標準表示。接触137msは正史の時刻で表示します。「前の確認版」は同じ画角に置いた旧原画の比較表示です。打者目線・捕手目線の全身表示と、俯瞰のストライクゾーンは省いています。</p></main><script>${Buffer.from(raster.outputFiles[0].contents).toString()}
const scenes=${JSON.stringify(scenes)},galleryImage=new Image();galleryImage.src='data:image/png;base64,${atlas}';galleryImage.onload=()=>document.querySelectorAll('.pose canvas').forEach(c=>{const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(galleryImage,+c.dataset.x,+c.dataset.y,72,72,0,0,72,72);const raw=g.getImageData(0,0,72,72);g.clearRect(0,0,288,288);for(let y=0;y<72;y++)for(let x=0;x<72;x++){const i=(y*72+x)*4;if(raw.data[i+3]){let rgb=[...raw.data.slice(i,i+3)].join(',');if(c.dataset.defense==='true')rgb=({'232,155,153':'136,201,239','197,123,130':'90,154,196','144,84,94':'56,99,131'})[rgb]||rgb;DroneRaster.light(g,x,y,'rgb('+rgb+')');}}});
let hand='R',index=0,playing=false,timer,version='current';const stage=document.getElementById('stage'),ctx=stage.getContext('2d'),camera=document.getElementById('camera');const cache=new Map();
function background(key){if(cache.has(key))return cache.get(key);const c=document.createElement('canvas');c.width=600;c.height=432;const g=c.getContext('2d');g.fillStyle='#000';g.fillRect(0,0,600,432);const s=scenes[key];for(const p of s.ground)DroneRaster.light(g,p.x,p.y,p.color);for(const p of s.chalk)DroneRaster.light(g,p.x,p.y,'#e8e4d6',true);for(const p of s.walls)DroneRaster.light(g,p.x,p.y,'#ad923f',true);cache.set(key,c);return c;}
function names(labels){for(const l of labels){ctx.fillStyle='rgba(0,0,0,.72)';ctx.fillRect(l.bounds.x*4,l.bounds.y*4,l.bounds.width*4,l.bounds.height*4);ctx.fillStyle='#eeeee9';ctx.font=(12*l.scale)+'px PixelReview, sans-serif';ctx.textBaseline='top';ctx.fillText(l.text,(l.bounds.x+1)*4,l.bounds.y*4);}}
function draw(){const key=hand+'-'+camera.value,s=scenes[key],f=s.frames[index],shift=Math.round((600-stage.width)/8)*4;ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,stage.width,432);ctx.translate(-shift,0);ctx.drawImage(background(key),0,0);for(const p of f.catcher.cells)DroneRaster.light(ctx,p.x,p.y,p.color,true);for(const p of f[version].cells)DroneRaster.light(ctx,p.x,p.y,p.color,true);for(const p of s.zone)DroneRaster.light(ctx,p.x,p.y,'#e0b541',true);names(f.catcher.labels);names(f[version].labels);if(f.ball)DroneRaster.light(ctx,f.ball.x,f.ball.y,'#fffdf7',true);ctx.setTransform(1,0,0,1,0,0);document.getElementById('time').textContent=(f.tick/1000000).toFixed(3)+' s';document.getElementById('info').textContent=f.tick===137000?'インパクト':'55ms / コマ';document.getElementById('view').textContent=camera.options[camera.selectedIndex].text;document.getElementById('pose-name').textContent=['構え','ため','インパクト','振り抜き'][f.phase];document.getElementById('batter-name').innerHTML=(hand==='R'?'浅野':'吉田')+' <span class="tag battertag">'+(hand==='R'?'右打':'左打')+'</span>';document.getElementById('new').classList.toggle('active',version==='current');document.getElementById('old').classList.toggle('active',version==='previous');}
function resize(){stage.width=Math.min(600,Math.floor(stage.parentElement.clientWidth/4)*4);draw();}
function stop(){clearTimeout(timer);playing=false;document.getElementById('play').textContent='再生';}function next(){index=(index+1)%6;draw();}function schedule(){const list=scenes[hand+'-'+camera.value].frames;const delay=index===5?550:Math.max(1,(list[index+1].tick-list[index].tick)/1000);timer=setTimeout(()=>{next();if(playing)schedule()},delay);}
document.getElementById('play').onclick=()=>{if(playing){stop();return}playing=true;document.getElementById('play').textContent='停止';schedule();};document.getElementById('step').onclick=()=>{stop();next();};document.getElementById('hand').onclick=()=>{hand=hand==='R'?'L':'R';document.getElementById('hand').textContent=hand==='R'?'右打者':'左打者';draw();};document.getElementById('new').onclick=()=>{version='current';draw();};document.getElementById('old').onclick=()=>{version='previous';draw();};camera.onchange=draw;document.querySelectorAll('.batting-pose').forEach(b=>b.onclick=()=>{stop();hand=b.dataset.hand;index=+b.dataset.index;camera.value='PITCHER_POV';document.getElementById('hand').textContent=hand==='R'?'右打者':'左打者';draw();});window.addEventListener('resize',resize);document.fonts.ready.then(resize);resize();window.pixelPlayerReview={scenes,get index(){return index;},get hand(){return hand;},get version(){return version;},draw};
</script></html>`;
mkdirSync(root+'.pixel-build/review',{recursive:true});writeFileSync(root+'.pixel-build/review/pixel-player-v2.html',html);console.log('Review -> .pixel-build/review/pixel-player-v2.html');
