// Display DTO only. No access to Match Core, AI decisions, outs or runner movement.
export const DEFENDER_ROLES=Object.freeze([
 {role:'P',label:'投手',x:0,z:18.4404},{role:'C',label:'捕手',x:0,z:-3},
 {role:'1B',label:'一塁',x:27,z:25},{role:'2B',label:'二塁',x:13,z:40},{role:'3B',label:'三塁',x:-27,z:25},{role:'SS',label:'遊撃',x:-13,z:40},
 {role:'LF',label:'左翼',x:-53,z:92},{role:'CF',label:'中堅',x:0,z:108},{role:'RF',label:'右翼',x:53,z:92}
].map(Object.freeze));
const YES=Object.freeze({fieldDiagram:true}),NO=Object.freeze({fieldDiagram:false});
export const scoreboardCapabilities=style=>['koshien','niikura_dome','fukuoka_dome'].includes(style)?YES:NO;
export const defaultFieldDiagram=()=>({version:1,enabled:true,defenders:DEFENDER_ROLES.map(p=>({...p})),runners:{first:false,second:false,third:false}});
export function scoreboardFieldDiagram(architecture){return scoreboardCapabilities(architecture?.style).fieldDiagram?(architecture.scoreboard?.fieldDiagram??defaultFieldDiagram()):null;}
export function validateFieldDiagram(f,error,path='architecture.scoreboard.fieldDiagram'){
 const object=(v,keys,p)=>{if(!v||typeof v!=='object'||Array.isArray(v)){error(p,'オブジェクトを指定してください');return false;}for(const k of Object.keys(v))if(!keys.includes(k))error(p+'.'+k,'未対応の守備図項目です');return true;};
 if(!object(f,['version','enabled','defenders','runners'],path))return;
 if(f.version!==1)error(path+'.version','守備図のversionは1です');if(typeof f.enabled!=='boolean')error(path+'.enabled','守備図の表示有無を指定してください');
 if(!Array.isArray(f.defenders)||f.defenders.length!==9)error(path+'.defenders','９守備位置をそれぞれ１つ指定してください');
 else{const seen=new Set();f.defenders.forEach((p,i)=>{const at=path+'.defenders.'+i;if(!object(p,['role','label','x','z'],at))return;
  if(!DEFENDER_ROLES.some(d=>d.role===p.role)||seen.has(p.role))error(at+'.role','守備位置が不正または重複しています');seen.add(p.role);
  if(typeof p.label!=='string'||!p.label.trim()||p.label.length>12||/[\x00-\x1f<>]/.test(p.label))error(at+'.label','表示名は1〜12文字で入力してください');
  for(const k of ['x','z'])if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<-300||p[k]>300)error(at+'.'+k,'座標は−300〜300mの数値で入力してください');
 });}
 if(object(f.runners,['first','second','third'],path+'.runners'))for(const k of ['first','second','third'])if(typeof f.runners[k]!=='boolean')error(path+'.runners.'+k,'走者の有無を指定してください');
}
/** Schematic projection, not the physical field or a source of official decisions. */
export function projectFieldDiagramPoint(p){if(!Number.isFinite(p?.x)||!Number.isFinite(p?.z))return null;
 const a=Math.abs(p.x),x=Math.sign(p.x)*(a<=30?a*3.2:96+(a-30)*.9),y=p.z<=40?510-p.z*3.8:358-(p.z-40)*1.2;
 return {u:Math.max(.04,Math.min(.96,.5+x/400)),v:Math.max(.04,Math.min(.96,(y-250)/300))};}
export const SCOREBOARD_BASES=Object.freeze([
 {id:'first',label:'一塁',x:19.397,z:19.397},{id:'second',label:'二塁',x:0,z:38.794},{id:'third',label:'三塁',x:-19.397,z:19.397}
].map(Object.freeze));
/** A future caller supplies observed defenders and authoritative occupied-base booleans. */
export function fieldDiagramFromView(view,previous=defaultFieldDiagram()){
 if(!Array.isArray(view?.actors))throw Error('表示用のactorsを指定してください');
 const result={version:1,enabled:previous.enabled,defenders:DEFENDER_ROLES.map(d=>{const matches=view.actors.filter(a=>a?.role===d.role);if(matches.length!==1)throw Error(d.role+'の表示用選手は１名必要です');const actor=matches[0];return{role:d.role,label:actor.displayName??actor.name??previous.defenders.find(p=>p.role===d.role)?.label??d.label,x:actor.position?.x,z:actor.position?.z};}),runners:{...view.occupiedBases}};
 const errors=[];validateFieldDiagram(result,(path,message)=>errors.push({path,message}));if(errors.length)throw Error(errors[0].message);return result;
}
