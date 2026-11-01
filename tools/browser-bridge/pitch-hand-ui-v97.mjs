import assert from 'node:assert/strict';

const once=(source,before,after)=>{
  assert.equal(source.split(before).length,2,'unique V97 UI marker required: '+before.slice(0,90));
  return source.replace(before,()=>after);
};

// Keep historical UI sources immutable. These focused substitutions make the
// same Core resolver/hand-edit transaction serve owned cards and real trials.
export function applyPitchHandUiV97({pitcher,menu,arrows,movement}){
  pitcher=once(pitcher,'core.resolvePitcherRepertoireV78(currentPlayer().physical)',
    'core.resolvePitcherRepertoireV78(currentPlayer().physical,currentPlayer().throws??\'R\')');
  pitcher=once(pitcher,'core.migratePitchRepertoireV77ToV78(physical)',
    'core.migratePitchRepertoireV77ToV78(physical,currentPlayer().throws??\'R\')');
  pitcher=once(pitcher,"handle('pitcher-hand',()=>{const next=snapshot();entry(next).throws=$('pitcher-hand').value;commit(next);});",
    "handle('pitcher-hand',()=>{const next=snapshot(),e=entry(next),p=currentPlayer(),hand=$('pitcher-hand').value;if((p.throws??'R')!==hand){const converted=core.mirrorPitcherPhysicalHandV97(p.physical,p.throws??'R',hand);delete e.physical.pitchRepertoire;e.physical.pitchRepertoireV78=clone(converted.pitchRepertoireV78);}e.throws=hand;commit(next);});");
  pitcher=once(pitcher,'右投げは投手の右側、左投げは左側から放します。回転の方向は捕手から見た世界の向きで保存するため、腕だけ変えても回転方向は反転しません。',
    '右投げは投手の右側、左投げは左側から放します。投げる腕を変更すると、所持球の左右の曲がりと縫い目の向きも反転します。速さ・上下の曲がり・変化量は維持し、保管庫の原本は変更しません。');
  menu=once(menu,'core.resolvePitcherRepertoireV78(player.physical)',
    "core.resolvePitcherRepertoireV78(player.physical,player.throws??'R')");
  arrows=once(arrows,'core.resolvePitcherRepertoireV78(player.physical)',
    "core.resolvePitcherRepertoireV78(player.physical,player.throws??'R')");
  movement=once(movement,'core.resolvePitcherRepertoireV78(player.physical)',
    "core.resolvePitcherRepertoireV78(player.physical,player.throws??'R')");
  movement=once(movement,'core.migratePitchRepertoireV77ToV78(entry.physical)',
    "core.migratePitchRepertoireV77ToV78(entry.physical,state.player.throws??'R')");
  return {pitcher,menu,arrows,movement};
}
