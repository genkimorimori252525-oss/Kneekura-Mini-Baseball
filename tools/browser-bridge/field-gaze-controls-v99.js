(function(root){
 'use strict';
 const key='kneekura.field-head.settings.v99',defaults={yawSpeed:4.5,pitchSpeed:3.2,acceleration:18};
 let config={...defaults};try{const stored=JSON.parse(root.localStorage.getItem(key));if(stored&&Object.keys(defaults).every(k=>Number.isFinite(stored[k])&&stored[k]>=.1&&stored[k]<=60))config={...defaults,...stored};}catch{}
 function apply(){root.KneekuraFieldGazeTuningV99={...config};for(const f of root.document.querySelectorAll('iframe'))try{f.contentWindow.KneekuraFieldGazeTuningV99={...config};}catch{}}
 apply();function install(){
  if(root.document.getElementById('field-head-controls-v99'))return;
  const box=root.document.createElement('details');box.id='field-head-controls-v99';box.style.cssText='margin:12px 0;padding:10px;border:1px solid currentColor';
  const title=root.document.createElement('summary');title.textContent='守備視点：捕球後の首振り';box.append(title);
  const note=root.document.createElement('p');note.textContent='捕球後に送球先へ向き直る速さです。安全なフライ捕球後は捕った向きを保ちます。打者・走者視点や守備能力は変わりません。';box.append(note);
  const inputs=[];for(const [name,label]of [['yawSpeed','左右へ向く速さ（度/秒）'],['pitchSpeed','上下へ向く速さ（度/秒）'],['acceleration','向き直りの加速・ブレーキ（度/秒²）']]){
   const row=root.document.createElement('label'),input=root.document.createElement('input'),error=root.document.createElement('span');row.style.cssText='display:inline-flex;flex-direction:column;margin:6px;max-width:260px';
   row.append(root.document.createTextNode(label));input.type='number';input.min='5.8';input.max='3437';input.step='any';input.value=(config[name]*180/Math.PI).toFixed(1);input.dataset.fieldGaze=name;error.setAttribute('role','alert');
   input.addEventListener('input',()=>{const n=Number(input.value)*Math.PI/180;if(!input.value.trim()||!Number.isFinite(n)||n<.1||n>60){error.textContent='5.8〜3437の数値に戻してください';return;}error.textContent='';config[name]=n;apply();try{root.localStorage.setItem(key,JSON.stringify(config));}catch{}});
   row.append(input,error);box.append(row);inputs.push([name,input,error]);}
  const reset=root.document.createElement('button');reset.textContent='守備視点の初期値へ';reset.onclick=()=>{config={...defaults};apply();for(const [name,input,error]of inputs){input.value=(config[name]*180/Math.PI).toFixed(1);error.textContent='';}try{root.localStorage.setItem(key,JSON.stringify(config));}catch{}};box.append(reset);
  (root.document.querySelector('main')??root.document.body).append(box);
  for(const frame of root.document.querySelectorAll('iframe'))frame.addEventListener('load',apply);
 }
 if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);
