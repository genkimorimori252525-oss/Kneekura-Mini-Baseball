/* Shared read-only 13-region and proportional-direction views. */
(function(root){
 'use strict';
 const ids=[1,2,3,4,5,6,7,8,9,11,12,13,14],names=['左翼','左中間','中堅','右中間','右翼'],colors={red:'#f5a6a5',blue:'#c8e5f4',gray:'#e5e9e7'},ns='http://www.w3.org/2000/svg';
 const finite=Number.isFinite,average=value=>finite(value)?value.toFixed(3).replace(/^0\./,'.'):'—',percent=value=>finite(value)?(value*100).toFixed(1)+'%':'—';
 const el=(tag,text)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;return node;},svgEl=(tag,attrs={})=>{const node=document.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;};
 const zoneName=id=>id<=9?['高め','中央','低め'][Math.floor((id-1)/3)]+'・'+['左','中央','右'][(id-1)%3]:({11:'上左の外側',12:'上右の外側',13:'下左の外側',14:'下右の外側'})[id];
 function geometry(id){
  if(id<=9){const x=80+((id-1)%3)*80,y=80+Math.floor((id-1)/3)*80;return {d:`M${x} ${y}h80v80h-80Z`,x:x+40,y:y+44};}
  return {11:{d:'M0 0H200V80H80V200H0Z',x:43,y:48},12:{d:'M200 0H400V200H320V80H200Z',x:357,y:48},13:{d:'M0 200H80V320H200V400H0Z',x:43,y:365},14:{d:'M320 200H400V400H200V320H320Z',x:357,y:365}}[id];
 }
 function renderMap(container,{regions,selectedZoneId=5,onSelect,label='捕手から見た13区画',draft=false}={}){
  if(!container||!Array.isArray(regions))throw Error('13区画の表示先と値を指定してください。');
  const svg=svgEl('svg',{viewBox:'0 0 400 400',role:'group','aria-label':label});svg.classList.add('course-map-v87');svg.dataset.draft=String(draft);
  for(const id of ids){const row=regions.find(row=>(row.zoneId??row.publicZoneId)===id)??{},value=row.average,g=geometry(id),group=svgEl('g',{'data-zone-id':id,tabindex:id===selectedZoneId?'0':'-1',role:onSelect?'button':'group','aria-label':zoneName(id)+' '+average(value),'aria-pressed':String(id===selectedZoneId)});
   const path=svgEl('path',{d:g.d,fill:!finite(value)?colors.gray:value>=.3?colors.red:value<=.2?colors.blue:colors.gray,stroke:'#ffffff','stroke-width':2});
   const title=svgEl('title');title.textContent=zoneName(id)+' · '+average(value)+(row.ab!==undefined?` · ${row.h??0}安打/${row.ab}打数 · 未確定${row.pending??0}`:'');
   const text=svgEl('text',{x:g.x,y:g.y,'text-anchor':'middle','data-zone-average':'',class:'course-map-average-v87'});text.textContent=average(value);
   const caption=svgEl('text',{x:g.x,y:g.y+17,'text-anchor':'middle',class:'course-map-id-v87'});caption.textContent=String(id);
   group.append(title,path,text,caption);if(onSelect){group.style.cursor='pointer';group.addEventListener('click',()=>onSelect(id));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();onSelect(id);}const n=ids.indexOf(id),step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[event.key];if(step){event.preventDefault();const next=ids[Math.max(0,Math.min(ids.length-1,n+step))];onSelect(next);container.querySelector('[data-zone-id="'+next+'"]')?.focus();}});}
   svg.append(group);
  }
  const strike=svgEl('rect',{x:80,y:80,width:240,height:240,fill:'none',stroke:'#a94141','stroke-width':3,'pointer-events':'none'});svg.append(strike);container.replaceChildren(svg);return container;
 }
 function renderPublic(container,report){
  const regions=report.regions??[...(report.inside??[]),...(Array.isArray(report.outside)?report.outside:[])].map((row,i)=>({...row,publicZoneId:row.publicZoneId??ids[i]}));
  renderMap(container,{regions,selectedZoneId:null,label:'確定記録の13区画 · 安打÷打数'});
  const note=el('p','打率は確定した安打÷打数。打数0・未確定は「—」。設定値とは別の実績です。');note.className='course-note-v79';container.append(note);
  const missing=report.missing??report.unknown;if(missing){const node=el('p',`位置不明：${missing.h??missing.hits??0}安打／${missing.ab??missing.atBats??0}打数 · 未確定${missing.pending??0}`);node.className='course-note-v79';container.append(node);}return container;
 }
 function renderSpray(container,data){
  if(!container||!Array.isArray(data?.ratios)||data.ratios.length!==5||data.ratios.some(value=>value!==null&&(!finite(value)||value<0||value>1)))throw Error('打球方向は5区分の0〜1の割合（未計測はnull）で指定してください。');
  const svg=svgEl('svg',{viewBox:'0 0 400 250',role:'img','aria-label':names.map((name,i)=>name+' '+percent(data.ratios[i])).join('、')});svg.classList.add('course-spray-v79','course-spray-v87');
  const point=(angle,r)=>[200+Math.sin(angle*Math.PI/180)*r,220-Math.cos(angle*Math.PI/180)*r],sector=(i,r)=>{const a=point(-45+i*18,r),b=point(-27+i*18,r);return `M200 220L${a[0]} ${a[1]}A${r} ${r} 0 0 1 ${b[0]} ${b[1]}Z`;};
  for(let i=0;i<5;i++){const group=svgEl('g',{'data-direction':i}),boundary=svgEl('path',{d:sector(i,205),fill:'#edf4ef',stroke:'#739982','stroke-width':i===data.selectedDirection?3.5:1.5,'data-direction-boundary':''}),ratio=data.ratios[i],fill=svgEl('path',{d:sector(i,205*Math.sqrt(ratio??0)),fill:'#69ac85','data-direction-fill':'','pointer-events':'none'});
   const p=point(-36+i*18,152),text=svgEl('text',{x:p[0],y:p[1],'text-anchor':'middle',fill:'#173d28','font-size':12,'pointer-events':'none'});
   for(const [n,value]of [names[i],percent(ratio),...(data.homeRuns?[`${data.homeRuns[i]??0}HR`]:[])].entries()){const span=svgEl('tspan',{x:p[0],dy:n?17:0});span.textContent=value;if(n===1){span.setAttribute('font-size','17');span.setAttribute('font-weight','700');}text.append(span);}
   group.append(boundary,fill,text);if(data.onSelect){group.setAttribute('role','button');group.setAttribute('tabindex',i===data.selectedDirection?'0':'-1');group.setAttribute('aria-label',names[i]+' '+percent(ratio));group.style.cursor='pointer';group.addEventListener('click',()=>data.onSelect(i));group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();data.onSelect(i);}});}svg.append(group);
  }
  const list=el('ul');list.className='course-spray-list-v79';names.forEach((name,i)=>list.append(el('li',name+' '+percent(data.ratios[i])+(data.counts?` · ${data.counts[i]??0}本`:''))));container.replaceChildren(svg,list);
  if(data.total!==undefined)container.append(el('p',`確定フェア打球 ${data.total}本 · ファウル ${data.fouls??0}本`));return container;
 }
 const api=Object.freeze({version:87,renderMap,renderPublic,renderSpray});root.KneekuraCourseChartsV87=api;root.KneekuraCourseChartsV79=api;
})(globalThis);
