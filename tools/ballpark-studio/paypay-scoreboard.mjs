export function defaultPaypayScoreboard(){const positions=['8','4','9','3','5','D','7','2','6'];return{version:1,inning:5,half:'top',pitchCount:64,lineups:[0,1].map(()=>positions.map((position,i)=>({name:(i+1)+'番打者',position}))) };}
export function validatePaypayScoreboard(s,error,path='architecture.scoreboard.paypay'){
 if(!s||typeof s!=='object'||Array.isArray(s)){error(path,'表示設定をオブジェクトで指定してください');return;}
 for(const key of Object.keys(s))if(!['version','inning','half','pitchCount','lineups'].includes(key))error(path+'.'+key,'未対応の表示項目です');
 if(s.version!==1)error(path+'.version','表示設定のversionは1です');
 for(const[key,min,max]of[['inning',1,99],['pitchCount',0,999]])if(!Number.isInteger(s[key])||s[key]<min||s[key]>max)error(path+'.'+key,`${min}〜${max}の整数を入力してください`);
 if(!['top','bottom'].includes(s.half))error(path+'.half','表か裏を指定してください');
 if(!Array.isArray(s.lineups)||s.lineups.length!==2){error(path+'.lineups','2チームの打順を指定してください');return;}
 s.lineups.forEach((team,t)=>{const p=path+'.lineups.'+t;if(!Array.isArray(team)||team.length!==9){error(p,'打順は9人指定してください');return;}team.forEach((v,i)=>{const at=p+'.'+i;if(!v||typeof v!=='object'||Array.isArray(v)){error(at,'名前と守備を指定してください');return;}for(const k of Object.keys(v))if(!['name','position'].includes(k))error(at+'.'+k,'未対応の項目です');if(typeof v.name!=='string'||!v.name.trim()||v.name.length>12||/[\x00-\x1f<>]/.test(v.name))error(at+'.name','名前は1〜12文字で入力してください');if(typeof v.position!=='string'||!/^[1-9D]$/.test(v.position))error(at+'.position','守備は1〜9またはDを指定してください');});});
}
