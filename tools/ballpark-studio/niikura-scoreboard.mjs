// Optional presentation data, never player abilities or authoritative match state.
export function defaultNiikuraScoreboard(){return {version:1,inning:5,half:'top',portrait:true,monitors:true,
 lineups:[[['森田','8'],['近藤','4'],['ニッチロー','9'],['山崎','3'],['渡辺','D'],['中村','7'],['小川','5'],['田中','2'],['藤原','6']],
 [['佐藤','8'],['鈴木','6'],['高橋','9'],['山田','3'],['伊藤','D'],['中島','7'],['加藤','5'],['吉田','2'],['松本','4']]].map(team=>team.map(([name,position])=>({name,position}))),
 batter:{name:'ニッチロー',number:51,average:.315,homeRuns:18,rbis:62,salaryManYen:125000},pitcher:{pitchCount:64,era:2.35}};}
export function formatSalaryManYen(n){if(n===0)return '0万円';const cho=Math.floor(n/1e8),oku=Math.floor(n%1e8/1e4),man=n%1e4;return(cho?cho+'兆':'')+(oku?oku+'億':'')+(man?man+'万':'')+'円';}
export function validateNiikuraScoreboard(s,error,path='architecture.scoreboard.niikura'){
 const object=(o,keys,p)=>{if(!o||typeof o!=='object'||Array.isArray(o)){error(p,'オブジェクトを指定してください');return false;}for(const k of Object.keys(o))if(!keys.includes(k))error(p+'.'+k,'未対応の表示項目です');return true;},
 number=(v,min,max,p,integer=false)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max||(integer&&!Number.isInteger(v)))error(p,`${min}〜${max}の${integer?'整数':'数値'}を入力してください`);},
 name=(v,p)=>{if(typeof v!=='string'||!v.trim()||v.length>12||/[\x00-\x1f<>]/.test(v))error(p,'表示名は1〜12文字で入力してください');};
 if(!object(s,['version','inning','half','portrait','monitors','lineups','batter','pitcher'],path))return;
 if(s.version!==1)error(path+'.version','表示設定のversionは1です');number(s.inning,1,99,path+'.inning',true);
 if(!['top','bottom'].includes(s.half))error(path+'.half','表か裏を指定してください');if(s.monitors!==undefined&&typeof s.monitors!=='boolean')error(path+'.monitors','モニターの表示有無を指定してください');if(typeof s.portrait!=='boolean')error(path+'.portrait','顔写真の表示有無を指定してください');
 if(!Array.isArray(s.lineups)||s.lineups.length!==2)error(path+'.lineups','2チームの打順を指定してください');
 else s.lineups.forEach((team,i)=>{const p=path+'.lineups.'+i;if(!Array.isArray(team)||team.length!==9){error(p,'打順は9人指定してください');return;}team.forEach((v,j)=>{const at=p+'.'+j;if(object(v,['name','position'],at)){name(v.name,at+'.name');if(!/^[1-9D]$/.test(v.position)||typeof v.position!=='string')error(at+'.position','守備は1〜9またはDを指定してください');}});});
 if(object(s.batter,['name','number','average','homeRuns','rbis','salaryManYen'],path+'.batter')){const p=path+'.batter';name(s.batter.name,p+'.name');number(s.batter.number,0,999,p+'.number',true);number(s.batter.average,0,1,p+'.average');for(const k of ['homeRuns','rbis'])number(s.batter[k],0,999,p+'.'+k,true);number(s.batter.salaryManYen,0,999999999,p+'.salaryManYen',true);}
 if(object(s.pitcher,['pitchCount','era'],path+'.pitcher')){number(s.pitcher.pitchCount,0,999,path+'.pitcher.pitchCount',true);number(s.pitcher.era,0,99.99,path+'.pitcher.era');}
}
