/* Local, accessible validation feedback. Never changes authoring values. */
(function(root){
 'use strict';
 let serial=0,lastAction=null;
 function notice(owner){
  if(!owner)return null;
  let node=owner.querySelector(':scope > [data-maker-local-message]');
  if(!node){node=document.createElement('p');node.id='maker-local-v86-'+(++serial);node.dataset.makerLocalMessage='';node.className='maker-local-message-v86';node.setAttribute('role','status');node.hidden=true;owner.append(node);}
  return node;
 }
 function field(input,message='',error=true){
  if(!input)return;
  const owner=input.closest('label,.control')??input.parentElement;
  let node=owner?.querySelector(':scope > [data-maker-local-message]');if(!message&&!node){input.setAttribute('aria-invalid','false');return;}node??=notice(owner);if(!node)return;
  node.textContent=message;node.hidden=!message;node.classList.toggle('error',!!message&&error);
  input.setAttribute('aria-invalid',String(!!message&&error));
  const ids=new Set((input.getAttribute('aria-describedby')??'').split(/\s+/).filter(Boolean));ids.add(node.id);input.setAttribute('aria-describedby',[...ids].join(' '));
 }
 function group(owner,message='',error=true){
  const existing=owner?.querySelector(':scope > [data-maker-local-message]');if(!message&&!existing)return;const node=existing??notice(owner);if(!node)return;node.textContent=message;node.hidden=!message;node.classList.toggle('error',!!message&&error);
 }
 function action(message='',error=true){
  const anchor=lastAction?.isConnected?lastAction:document.activeElement;
  const owner=anchor?.closest?.('details,.pitcher-lab-box,.course-section-v79,.control,section');
  group(owner,message,error);
 }
 function clearActions(){const anchor=lastAction?.isConnected?lastAction:document.activeElement;const owner=anchor?.closest?.('details,.pitcher-lab-box,.course-section-v79,.control,section');if(owner&&!owner.matches('label,.control'))group(owner,'');}
 document.addEventListener('click',event=>{const button=event.target.closest?.('button');if(button)lastAction=button;},true);
 root.KneekuraMakerValidationV86=Object.freeze({version:86,field,group,action,clearActions});
})(globalThis);
