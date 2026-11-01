export const CAMERA_VIEWS=Object.freeze(['effects','stadium','exterior','outfield','entrance','interior','scoreboard','overhead','mound-detail','backnet','catcher','mound','batter','fielder']);
const object=v=>v&&typeof v==='object'&&!Array.isArray(v),DEG=180/Math.PI;
export const cameraParkKey=d=>JSON.stringify([d.architecture?.style??d.mode,d.name]);
export function validateCameraViews(views,error,path='cameraViews'){
 if(!object(views)){error(path,'視点ごとの設定をオブジェクトで指定してください');return;}
 for(const [key,p]of Object.entries(views)){
  const at=path+'.'+key;if(!CAMERA_VIEWS.includes(key)){error(at,'登録できない視点です');continue;}
  if(!object(p)){error(at,'カメラ設定を指定してください');continue;}
  for(const field of Object.keys(p))if(!['eye','yawDegrees','pitchDegrees','zoom','f','cx','cy','roofCutaway'].includes(field))error(at+'.'+field,'カメラの登録項目ではありません');
  const number=(v,min,max,suffix)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)error(at+'.'+suffix,`${min}〜${max}の数値を入力してください`);};
  if(!object(p.eye))error(at+'.eye','カメラの位置を指定してください');
  else{for(const k of Object.keys(p.eye))if(!['x','y','z'].includes(k))error(at+'.eye.'+k,'位置はx・y・zで指定してください');number(p.eye.x,-2000,2000,'eye.x');number(p.eye.y,.1,1500,'eye.y');number(p.eye.z,-2000,2000,'eye.z');}
  for(const [k,min,max]of [['yawDegrees',-180,180],['pitchDegrees',-89.9,89.9],['zoom',.4,2.5],['f',10,4000],['cx',-600,1200],['cy',-432,864]])number(p[k],min,max,k);
  if(typeof p.roofCutaway!=='boolean')error(at+'.roofCutaway','屋根省略はtrue/falseを指定してください');
 }
}
export function cameraPresetErrors(p){const errors=[];validateCameraViews({interior:p},(path,message)=>errors.push({path,message}));return errors;}
export function cameraFromProjection(cam,zoom=1,roofCutaway=false){return{eye:{...cam.eye},yawDegrees:((cam.yaw*DEG+180)%360+360)%360-180,pitchDegrees:cam.pitch*DEG,zoom,f:cam.f/zoom,cx:cam.cx,cy:cam.cy,roofCutaway};}
export const cameraOverride=p=>({eye:{...p.eye},yaw:p.yawDegrees/DEG,pitch:p.pitchDegrees/DEG,f:p.f,cx:p.cx,cy:p.cy});
// Browser library is separate from the current design; JSON carries only that park's views.
export function parseCameraLibrary(raw){const data=JSON.parse(raw);if(!object(data)||data.version!==1||!object(data.parks))throw Error('カメラ登録データの形式が不正です');
 const entries=Object.entries(data.parks);for(const [key,views]of entries){const identity=JSON.parse(key);if(!Array.isArray(identity)||identity.length!==2||identity.some(v=>typeof v!=='string')||key.length>300)throw Error('球場の登録名が不正です');const errors=[];validateCameraViews(views,(p,m)=>errors.push(m));if(errors.length)throw Error(errors[0]);}return new Map(entries);
}
export function encodeCameraLibrary(parks){return JSON.stringify({version:1,parks:Object.fromEntries(parks)});}
