/* Read-only audit panel: observations and actual outcomes never feed the AI. */
(function(root){
 'use strict';
 if(!root.liveMatchPlayback||!root.KneekuraNativeMatchCore)return;
 const core=root.KneekuraNativeMatchCore,node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
 const panel=node('details');panel.id='course-debug-v87';panel.className='season-match-v79';panel.append(node('summary','コース認識のデバッグ（打者・捕手・投手）'));
 panel.append(node('p','各役の認識したコースと、実際の通過位置を分けて確認します。実際の結果は監査用で、AIの判断へ戻しません。'));
 const bar=node('div');bar.className='season-row';const refreshButton=node('button','選択中の投球を更新'),exportButton=node('button','認識ログJSONを保存');
 refreshButton.type=exportButton.type='button';refreshButton.id='course-debug-refresh-v87';exportButton.id='course-debug-export-v87';bar.append(refreshButton,exportButton);panel.append(bar);
 const status=node('p','投球を選んで更新してください。');status.setAttribute('role','status');const pre=node('pre');pre.id='course-debug-log-v87';pre.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;max-height:550px;overflow:auto';panel.append(status,pre);
 (document.getElementById('season-controls-v79')??document.querySelector('details.settings')).after(panel);
 function inspect(){
  const state=root.liveMatchPlayback.inspect(),result=state.lastResult;
  if(!result)return {version:87,available:false,reason:'投球記録がありません。'};
  let actual=null,error=null;
  try{actual=core.summarizeLiveIssuedPitchV79(result).course;}catch(e){error=String(e.message??e);}
  return root.structuredClone({version:87,available:true,pitchIndex:state.selectedPitch,pitchId:result.pitchId??result.id??null,
   recognition:result.play?.diagnostics?.courseRecognitionV87??result.play?.diagnostics?.pitch?.courseRecognitionV87??null,
   actualCourse:actual,actualCourseError:error,
   authority:'READ_ONLY_DEBUG_OBSERVATIONS_AND_PHYSICAL_RESULT_SEPARATED',
   note:'Actual crossing may be a source estimate after earlier contact; provenance is retained.'});
 }
 function refresh(){const value=inspect();pre.textContent=JSON.stringify(value,null,2);status.textContent=value.available?'選択中の投球の認識・実際の位置を表示しています。':'投球記録がありません。';return value;}
 refreshButton.onclick=refresh;panel.addEventListener('toggle',()=>{if(panel.open)refresh();});
 exportButton.onclick=()=>{const value=refresh(),url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)+'\n'],{type:'application/json'})),a=node('a');a.href=url;a.download='コース認識ログ_v87.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
 root.KneekuraCourseDebugV87=Object.freeze({version:87,inspect,refresh});
})(globalThis);
