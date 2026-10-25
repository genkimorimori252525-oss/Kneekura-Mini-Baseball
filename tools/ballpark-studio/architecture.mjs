import {defaultScoreboard,validateScoreboard} from './scoreboard.mjs';
// Presentation-only authoring settings. Never an admission to Match Core.
export function russianArchitecture(){return {version:1,style:'russian_dome',capacity:120000,tiers:5,
 colors:{red:'#b72e3d',blue:'#254f9a',gold:'#d6ae4d'},roof:{type:'retractable',openingPercent:100},
 details:{factor:6,logos:true,ornaments:true},scoreboard:defaultScoreboard(),
 logo:{enabled:true,detail:'fine',widthMeters:28,centerZ:82,brightness:.8,glow:.3},surfaceDetail:{factor:6,marginMeters:.6,featherMeters:.8},
 crowd:{density:.75,detail:'simple',size:1,brightness:1,glow:.7,attendance:'full'}};}
export function validateArchitecture(a,error){
 const fields=(o,keys,path)=>{if(!o||typeof o!=='object'||Array.isArray(o)){error(path,'オブジェクトを指定してください');return false;}
  for(const k of Object.keys(o))if(!keys.includes(k))error(path+'.'+k,'この建築項目は編集できません');return true;},
  number=(v,min,max,path)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)error(path,`${min}〜${max}の数値を入力してください`);};
 if(!fields(a,['version','style','capacity','tiers','colors','roof','logo','surfaceDetail','crowd','details','scoreboard'],'architecture'))return;
 if(a.version!==1)error('architecture.version','対応していない建築設定の版です');
 if(a.style!=='russian_dome')error('architecture.style','建築形式は russian_dome です');
 number(a.capacity,1000,250000,'architecture.capacity');if(!Number.isInteger(a.capacity))error('architecture.capacity','定員は整数で入力してください');
 number(a.tiers,3,6,'architecture.tiers');if(!Number.isInteger(a.tiers))error('architecture.tiers','階層数は整数で入力してください');
 if(fields(a.colors,['red','blue','gold'],'architecture.colors'))for(const k of ['red','blue','gold'])if(typeof a.colors[k]!=='string'||!/^#[0-9a-f]{6}$/i.test(a.colors[k]))error('architecture.colors.'+k,'色は # と6桁の16進数で指定してください');
 if(fields(a.roof,['type','openingPercent'],'architecture.roof')){if(a.roof.type!=='retractable')error('architecture.roof.type','屋根は retractable です');number(a.roof.openingPercent,0,100,'architecture.roof.openingPercent');}
 if(a.logo!==undefined&&fields(a.logo,['enabled','detail','widthMeters','centerZ','brightness','glow'],'architecture.logo')){
  if(typeof a.logo.enabled!=='boolean')error('architecture.logo.enabled','表示の有無を指定してください');
  if(!['fine','dots'].includes(a.logo.detail))error('architecture.logo.detail','精密表示か光点表示を選んでください');
  number(a.logo.widthMeters,10,40,'architecture.logo.widthMeters');number(a.logo.centerZ,60,110,'architecture.logo.centerZ');
  if(a.logo.brightness!==undefined)number(a.logo.brightness,.5,3,'architecture.logo.brightness');if(a.logo.glow!==undefined)number(a.logo.glow,0,1,'architecture.logo.glow');
 }
 if(a.surfaceDetail!==undefined&&fields(a.surfaceDetail,['factor','marginMeters','featherMeters'],'architecture.surfaceDetail')){
  number(a.surfaceDetail.factor,2,8,'architecture.surfaceDetail.factor');if(!Number.isInteger(a.surfaceDetail.factor))error('architecture.surfaceDetail.factor','密度の倍率は整数で入力してください');
  number(a.surfaceDetail.marginMeters,0,30,'architecture.surfaceDetail.marginMeters');number(a.surfaceDetail.featherMeters,.1,20,'architecture.surfaceDetail.featherMeters');
 }
 if(a.scoreboard!==undefined)validateScoreboard(a.scoreboard,error);
 if(a.details!==undefined&&fields(a.details,['factor','logos','ornaments'],'architecture.details')){
  number(a.details.factor,2,8,'architecture.details.factor');if(!Number.isInteger(a.details.factor))error('architecture.details.factor','密度の倍率は整数で入力してください');
  for(const k of ['logos','ornaments'])if(typeof a.details[k]!=='boolean')error('architecture.details.'+k,'表示の有無を指定してください');
 }
 if(a.crowd!==undefined&&fields(a.crowd,['density','detail','size','brightness','glow','attendance'],'architecture.crowd')){
  number(a.crowd.density,.05,1,'architecture.crowd.density');number(a.crowd.size,.5,1.8,'architecture.crowd.size');number(a.crowd.brightness,.2,1.5,'architecture.crowd.brightness');
  if(!['lights','simple','full'].includes(a.crowd.detail))error('architecture.crowd.detail','光だけ・簡素・詳しく、のいずれかを指定してください');
  if(a.crowd.glow!==undefined)number(a.crowd.glow,0,1,'architecture.crowd.glow');
  if(a.crowd.attendance!==undefined&&!['full','empty'].includes(a.crowd.attendance))error('architecture.crowd.attendance','観客席は満員か無観客を指定してください');
 }
}
