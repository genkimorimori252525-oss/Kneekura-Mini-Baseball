import {readFile, writeFile, mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve, dirname} from 'node:path';

const output=resolve(process.argv[2]??'dist/にーくら野球_20選手の初期能力一覧.html');
const rosterBytes=await readFile('docs/demos/live-game-roster-v1.json');
const catalog=JSON.parse(await readFile('docs/demos/live-game-roster-catalog-v1.json','utf8'));
const roster=JSON.parse(rosterBytes);
const byId=new Map(roster.entries.map(entry=>[entry.playerId,entry]));
if(byId.size!==20||catalog.players.length!==20)throw new Error('Expected the complete 20-player roster');
const valueAt=(entry,field)=>field.path.split('.').reduce((value,key)=>value?.[key],field.entryPath?entry:entry.physical);
const esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=value=>typeof value==='number'?String(Number(value.toPrecision(6))):String(value);
const sections=[['common','共通'],['batter','打者'],['pitcher','投手']];
const tables=sections.map(([id,label])=>{
 const fields=catalog.fields.filter(field=>field.section===id);
 const rows=catalog.players.map(player=>{
  const entry=byId.get(player.playerId);
  if(!entry)throw new Error('Missing player '+player.playerId);
  const values=fields.map(field=>{
   const value=valueAt(entry,field);
   if(value===undefined||typeof value==='number'&&!Number.isFinite(value))throw new Error('Missing/invalid field '+player.playerId+':'+field.path);
   const display=field.options?.find(option=>option.value===value)?.label??number(value);
   return '<td data-path="'+esc(field.path)+'" title="'+esc(value)+'">'+esc(display)+'</td>';
  }).join('');
  return '<tr data-player="'+esc(player.name+' '+player.teamName)+'"><th scope="row">'+esc(player.name)+'<small>'+esc(player.teamName+' · '+player.role)+'</small></th>'+values+'</tr>';
 }).join('');
 return '<section id="'+id+'"><h2>'+label+' <span>'+fields.length+'項目</span></h2><div class="scroll" tabindex="0" aria-label="'+label+'の能力一覧・横スクロール"><table><thead><tr><th scope="col">選手</th>'+fields.map(field=>'<th scope="col" title="'+esc(field.path)+'">'+esc(field.label)+'<small>'+esc(field.unit??'方針')+'</small></th>').join('')+'</tr></thead><tbody>'+rows+'</tbody></table></div></section>';
}).join('');
const sha=createHash('sha256').update(rosterBytes).digest('hex');
const html='<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>にーくら野球 · 20選手の初期能力一覧</title><style>'+
'*{box-sizing:border-box}body{margin:0;background:#0e1713;color:#edf2e9;font:15px/1.7 system-ui,sans-serif}main{max-width:1500px;margin:auto;padding:24px 16px}h1{font-size:25px;margin:0 0 12px}h2{font-size:20px;margin:28px 0 10px}h2 span,small{color:#aebcaf;font-weight:400}p{max-width:1000px}a{color:#f5d779}nav{display:flex;gap:18px;flex-wrap:wrap}label{display:block;margin:20px 0}input{padding:10px;background:#19271f;border:1px solid #6a806b;border-radius:5px;color:inherit;max-width:100%;font:inherit}.scroll{overflow:auto;border:1px solid #405344;border-radius:6px;max-height:75vh}table{border-collapse:separate;border-spacing:0;white-space:nowrap;font-variant-numeric:tabular-nums}th,td{padding:9px 12px;text-align:right;border-right:1px solid #293b2e;border-bottom:1px solid #293b2e}thead th{position:sticky;top:0;background:#233529;z-index:2;font-size:13px}th:first-child{position:sticky;left:0;z-index:1;background:#19291f;text-align:left;min-width:145px}thead th:first-child{z-index:3}small{display:block;font-size:12px}tr:nth-child(even) td{background:#132018}code{overflow-wrap:anywhere;font-size:12px}footer{color:#aebcaf;margin:28px 0}button{font:inherit;background:#f1d16b;border:0;padding:9px 14px;border-radius:5px;cursor:pointer;color:#102016}@media(max-width:500px){h1{font-size:21px}main{padding:18px 12px}th,td{padding:8px}th:first-child{min-width:125px}}</style><main>'+
'<h1>20選手の初期能力一覧</h1><p>通常試合 v40 と選手メーカーに登録した、同じ初期設定です。共通13・打者20・投手6の計39項目を、全20選手について掲載しています。投手以外の投球項目など、現在の起用では使われない値も登録しています。</p>'+
catalog.notes.map(note=>'<p>'+esc(note)+'</p>').join('')+
'<p>数値は表示上6桁に丸めています。正確な保存値はJSONとメーカーで確認できます。SI単位の設定を成績へ直接変換するものではありません。小さい誤差・遅延ほど正確／速い動作になります。</p><nav><a href="#common">共通</a><a href="#batter">打者</a><a href="#pitcher">投手</a><a href="'+encodeURI('にーくら野球メーカー_試合用20選手能力版.html')+'">メーカーで編集</a><a href="'+encodeURI('ばせぼーるlv40_TBD_vs_LAD_個人能力と守備カバー接続版.html')+'">通常試合 v40</a></nav><label>選手名・チームで絞り込み <input id="filter" type="search" placeholder="例：ちんすけ、LAD" autocomplete="off"></label><button id="download">初期能力JSONを保存</button>'+tables+
'<footer>データ識別: <code>'+esc(roster.sourceId)+'</code><br>JSON SHA-256: <code>'+sha+'</code><br>編集した能力JSONは、試合画面の「試合用の個人能力」から読み込み、新しい試合を開始すると反映されます。</footer></main><script type="application/json" id="roster">'+JSON.stringify(roster).replaceAll('<','\\u003c')+'</script><script>document.getElementById("filter").addEventListener("input",event=>{const query=event.target.value.trim().toLocaleLowerCase();document.querySelectorAll("tr[data-player]").forEach(row=>row.hidden=!row.dataset.player.toLocaleLowerCase().includes(query))});document.getElementById("download").addEventListener("click",()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(document.getElementById("roster").textContent),null,2)+"\\n"],{type:"application/json"}));const link=document.createElement("a");link.href=url;link.download="live-game-roster-v1.json";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});</script></html>';
await mkdir(dirname(output),{recursive:true});
await writeFile(output,html);
await writeFile(resolve(dirname(output),'にーくら野球_20選手の初期能力.json'),rosterBytes);
console.log(JSON.stringify({output,sha256:createHash('sha256').update(html).digest('hex'),rosterSha256:sha,players:20,fields:catalog.fields.length,values:catalog.fields.length*20},null,2));
