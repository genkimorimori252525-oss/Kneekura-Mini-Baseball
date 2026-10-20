(function (root) {
  'use strict';
  const core = root.KneekuraBaseballWorkbench, maker = root.baseballMaker, catalog = root.KneekuraLiveGameRosterCatalog;
  if (!maker || !catalog?.players?.length || !core?.createNeutralBatterCourseProfileV87) return;
  if (!root.KneekuraCourseChartsV79 || !root.KneekuraSeasonClientV79) throw Error('v79のコース図・シーズン保存部品を読み込めませんでした。');
  const validation=root.KneekuraMakerValidationV86;
  const $ = id => document.getElementById(id), clone = value => JSON.parse(JSON.stringify(value));
  const names = ['左翼', '左中間', '中堅', '右中間', '右翼'], colors = { red: '#f5a6a5', blue: '#c8e5f4', gray: '#e5e9e7' };
  const publicIds=[1,2,3,4,5,6,7,8,9,11,12,13,14],charts=root.KneekuraCourseChartsV87;
  const client = root.KneekuraSeasonClientV79.create({ core, storageKey: 'kneekura-course-seasons-v79' });
  root.KneekuraCourseSeasonsV79 = client;
  let playerId = catalog.players[0].playerId, courseId = 54, direction = 2, active = false, committing = false, lastError = '', trial = null;
  const pending = new Map(),numericErrors=new Map();
  let zoneId=5,layer='innate',previewCache=null,recognitionRole='batter',recognitionCell=54;const previewLog=[];
  const frozen=value=>{const copy=clone(value),freeze=node=>{if(node&&typeof node==='object'){Object.values(node).forEach(freeze);Object.freeze(node);}return node;};return freeze(copy);};
  function logPreview(kind){previewLog.push({sequence:previewLog.length?previewLog.at(-1).sequence+1:1,kind,playerId,zoneId,layer});if(previewLog.length>40)previewLog.shift();}
  function el(tag, text, className) { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; }
  function add(parent, tag, text, className) { const node = el(tag, text, className); parent.append(node); return node; }
  function button(parent, id, text, handler, help) { const node = add(parent, 'button', text); node.type = 'button'; node.id = id; if (handler) node.onclick = () => guarded(handler); if (help) node.dataset.help = help; return node; }
  function input(parent, id, label, type = 'number', options = {}) {
    const wrap = add(parent, 'label', label), node = add(wrap, 'input'); node.id = id; node.type = type;
    for (const [key, value] of Object.entries(options)) { if (key === 'help') node.dataset.help = value; else node.setAttribute(key, value); } return node;
  }
  function say(message, error = false) { lastError = error ? String(message) : ''; $('course-status-v79').textContent = message; $('course-status-v79').classList.toggle('error', error); }
  function guarded(action) { try { return action(); } catch (error) { say(error.message ?? error, true); if(error.fieldId){validation?.field($(error.fieldId),error.message);numericErrors.set(error.fieldId,error.message);}else validation?.action(String(error.message??error),true); return undefined; } }
  function number(id) { const node = $(id), value = Number(node.value); if (node.value.trim() === '' || !Number.isFinite(value)) {const error=Error('有限の数値を入力してください。');error.fieldId=id;throw error;} return value; }
  function integer(id, min, max) { const value = number(id); if (!Number.isInteger(value) || value < min || value > max) {const error=Error(`${min}〜${max}の整数を入力してください。`);error.fieldId=id;throw error;} return value; }
  function mark(id, label) { $(id).addEventListener('input', () => { pending.set(id, label); say(`${label}は未保存です。対応する反映・記録ボタンで確定してください。`);if(profileFields.includes(id)){logPreview('input');refreshPreview();} }); }
  function clearPending(ids) { for (const id of ids) { pending.delete(id);numericErrors.delete(id);$(id)?.setCustomValidity('');validation?.field($(id),''); } }
  function assertNoPending() { if (pending.size) throw Error(`未保存の入力があります：${[...new Set(pending.values())].join('、')}。反映・記録、または「未保存入力を戻す」を実行してください。`); }
  function assertOtherPending(allowed) { const other = [...pending.entries()].filter(([id]) => !allowed.includes(id)); if (other.length) throw Error(`先に未保存の入力を確定してください：${[...new Set(other.map(([, name]) => name))].join('、')}`); }
  function assertShared() { maker.assertCanSave(); }
  function assertSharedExcept(allowed) {
    // Independent editor commits retain every other group's draft. Canonical validation is still mandatory.
    maker.validateLiveRoster(roster());
  }
  function roster() { return maker.getLiveRoster(); }
  function currentEntry(packet = roster()) { const row = packet.entries.find(entry => entry.playerId === playerId); if (!row) throw Error('登録のない選手です。'); return row; }
  function identity() { return catalog.players.find(player => player.playerId === playerId); }
  function getAuthoredProfile(){const physical=currentEntry().physical;return physical.batterCourseProfileV87||physical.batterCourseProfileV79?clone(core.resolveBatterCourseProfileV87(physical)):undefined;}
  function getProfile(){const physical=currentEntry().physical;return physical.batterCourseProfileV87?clone(core.expandBatterCourseProfileV87ToV79(physical.batterCourseProfileV87)):physical.batterCourseProfileV79===undefined?undefined:clone(physical.batterCourseProfileV79);}
  function draftProfile() { return getAuthoredProfile() ?? clone(core.createNeutralBatterCourseProfileV87()); }
  function profileIndex(id) { return publicIds.indexOf(id); }
  function commitProfile(raw) {
    const accepted = raw === undefined ? undefined : core.validateBatterCourseProfileV87(raw), next = roster();
    if (accepted === undefined) delete currentEntry(next).physical.batterCourseProfileV87; else currentEntry(next).physical.batterCourseProfileV87 = accepted;
    const packet = maker.validateLiveRoster(next); committing = true;
    try { maker.commitLiveRosterEditV86(packet); } finally { committing = false; }
    trial = null;previewCache=null;logPreview('commit'); refresh(); return getAuthoredProfile();
  }
  document.addEventListener('input',event=>{const input=event.target;if(!numericErrors.has(input.id)||input.value.trim()===''||!input.validity.valid||!Number.isFinite(Number(input.value)))return;const message=numericErrors.get(input.id);numericErrors.delete(input.id);validation?.field(input,'');if(lastError===message)say('入力形式のエラーは解消しました。必要な反映・試打ボタンで確定してください。');});
  const panel = el('section', undefined, 'course-maker-v79'); panel.id = 'course-panel-v79'; panel.hidden = true; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-course-v79');
  add(panel, 'h2', '打者のコース・方向とシーズン成績');
  add(panel, 'p', '先天設定、今季の対応、実際の成績を分けて保存します。ミート・パワー・基礎SI・独立得能はこの画面では変えません。', 'course-note-v79');
  const toolbar = add(panel, 'div', undefined, 'course-toolbar-v79'), playerLabel = add(toolbar, 'label', '打つ選手'), playerSelect = add(playerLabel, 'select'); playerSelect.id = 'course-player-v79';
  for (const player of catalog.players) { const option = add(playerSelect, 'option', player.name); option.value = player.playerId; }
  button(toolbar, 'course-cancel-v79', '未保存入力を戻す', () => {clearPending([...pending.keys()]);numericErrors.clear();for(const owner of [panel,courseBox,directionBox,seasonBox,json,advanced])validation?.group(owner,'');previewCache=null;logPreview('cancel');refresh();resetSeasonForms();refreshRecognition();say('未保存の入力を戻しました。保存済みの選手・成績帳を表示しています。'); });
  add(panel, 'p', '', 'course-status-v79').id = 'course-status-v79'; $('maker-layout').after(panel);
  const columns = add(panel, 'div', undefined, 'course-columns-v79');
  const courseBox = add(columns, 'section', undefined, 'course-box-v79'); add(courseBox, 'h3', 'コース別の目安 · 13区画');
  add(courseBox, 'p', '区画を選んで数値を編集すると、保存前から図へ反映します。先天の目安と実際の打率は別です。', 'course-note-v79');
  const layerLabel=add(courseBox,'label','表示する内容'),layerSelect=add(layerLabel,'select');layerSelect.id='course-layer-v87';for(const [value,label]of [['innate','先天 · 作者の基準'],['adapted','後天 · 今季の対応'],['public','公開成績 · 安打÷打数'],['mlb','MLB2025 · 比較専用']]){const option=add(layerSelect,'option',label);option.value=value;}
  add(courseBox, 'p', '').id = 'course-origin-v79';
  const labels = add(courseBox, 'div', undefined, 'course-grid-labels-v79'); add(labels, 'span', '').id = 'course-left-label-v79'; add(labels, 'span', '高め · 捕手側の固定図'); add(labels, 'span', '').id = 'course-right-label-v79';
  const grid=add(courseBox,'div');grid.id='course-map-v87';
  add(courseBox,'p','','course-preview-state-v87').id='course-preview-state-v87';add(courseBox,'p','','course-note-v79').id='course-zone-detail-v87';
  const legend = add(courseBox, 'div', undefined, 'course-legend-v79');
  for (const [color, text] of [['red', '得意：.300以上'], ['blue', '苦手：.200以下'], ['gray', '普通']]) { const span = add(legend, 'span'); const swatch = add(span, 'i'); swatch.style.background = colors[color]; span.append(document.createTextNode(text)); }
  add(courseBox, 'p', '赤枠内は9区画、外側は4区画。固定した捕手側の図で、左右打者でも位置を反転しません。', 'course-note-v79');
  add(courseBox, 'h3', '').id = 'course-selected-label-v79';
  const avgPair = add(courseBox, 'div', undefined, 'course-field-pair-v79');
  input(avgPair, 'course-value-range-v79', '選択マスの目安', 'range', { min: 0, max: 1, step: .001, help: '選択マスの先天的な基準を0〜1で編集します。現在の試合成績や公開能力とは別の設定です。' });
  input(avgPair, 'course-value-v79', '数値', 'number', { min: 0, max: 1, step: .001 });
  input(courseBox, 'course-effect-v79', '効果の強さ', 'number', { min: 0, max: 3, step: .05, help: '作者調整の0〜3倍です。0はコース設定の打撃動作への効果を止めます。公開能力や得能を変えません。' });
  const profileButtons = add(courseBox, 'div', undefined, 'course-toolbar-v79');
  button(profileButtons, 'course-apply-v79', '数値を選手へ反映', applyFields);
  button(profileButtons, 'course-remove-v79', '13区画設定を解除して旧設定へ戻す', () => { assertShared(); commitProfile(undefined); say('13区画の個別設定を解除しました。保存していた旧63設定は保持しています。'); });
  button(courseBox,'course-adapt-v87','今季の対応を練習履歴で調整',()=>{const node=$('course-practice-id-v79').closest('details');node.open=true;node.scrollIntoView({block:'center'});$('course-practice-id-v79').focus();});
  const preview = add(courseBox, 'details'); add(preview, 'summary', '旧設定との対応');add(preview,'p','旧63区画の作者値は共有Coreで13区画へ要約します。13区画の保存は旧原本を残し、新設定の解除で旧設定へ戻せます。内部認識の63区画とは別の設定です。','course-note-v79');add(preview,'p','','course-note-v79').id='course-source-diff-v87';
  const directionBox = add(columns, 'section', undefined, 'course-box-v79'); add(directionBox, 'h3', '狙う方向の配分 · 入力');
  add(directionBox, 'p', '左翼から右翼までの狙う配分です。合計100%を維持します。投球の知覚・タイミング・バットの向きへ作用し、実際の飛ぶ割合は試打・成績で確かめます。', 'course-note-v79');
  add(directionBox, 'div').id = 'course-direction-input-v79';
  const directionButtons = add(directionBox, 'div', undefined, 'course-direction-buttons-v79');
  names.forEach((name, i) => button(directionButtons, 'course-direction-' + i, name, () => selectDirection(i), '編集する狙い方向を選びます。左右打者でも球場方向の図は反転しません。'));
  add(directionBox, 'p', '').id = 'course-direction-label-v79';
  const directionPair = add(directionBox, 'div', undefined, 'course-field-pair-v79');
  input(directionPair, 'course-direction-range-v79', '選択した方向の割合', 'range', { min: 0, max: 100, step: .1 });
  input(directionPair, 'course-direction-value-v79', '割合（%）', 'number', { min: 0, max: 100, step: .1, help: 'この区分を指定した割合にし、残りを他4区分の比率に応じて配り直します。ほかが0なら等分します。' });
  button(directionBox, 'course-direction-apply-v79', '方向の割合を反映', applyFields);
  add(directionBox, 'p', '').id = 'course-hand-note-v79';
  add(directionBox, 'h3', '同じ投球で試打 · 実計算');
  add(directionBox, 'p', '投手調整室の投手・球・番号・狙いを共用し、投球を固定して方向意図の試行を変えます。選択シーズンの今季対応も含めます。未指定の方向は試打内で5方向等分です。打球割合の完全一致は保証せず、HR・守備は集計しません。', 'course-note-v79');
  input(directionBox, 'course-trial-attempts-v79', '試打回数', 'number', { min: 1, max: 40, step: 1, value: 20 });
  button(directionBox, 'course-trial-v79', 'この設定で同条件の試打', runTrial); add(directionBox, 'p', '').id = 'course-trial-summary-v79'; add(directionBox, 'div').id = 'course-trial-result-v79';
  const seasonBox = add(columns, 'section', undefined, 'course-box-v79 course-full-v79'); add(seasonBox, 'h3', 'シーズンの成績帳');
  add(seasonBox, 'p', '試合の確定記録を選択シーズンへ蓄積します。練習は今季の対応だけ、締めは十分な実打数に基づく小さな長期更新だけへ作用します。JSON保存・読込が正本です。', 'course-note-v79');
  const seasonBar = add(seasonBox, 'div', undefined, 'course-toolbar-v79'), seasonLabel = add(seasonBar, 'label', '蓄積するシーズン'), seasonSelect = add(seasonLabel, 'select'); seasonSelect.id = 'course-season-v79';
  input(seasonBar, 'course-season-id-v79', '新規シーズンID', 'text', { maxlength: 96, placeholder: '例：2026-season-1' });
  input(seasonBar, 'course-season-name-v79', '新規シーズン名', 'text', { maxlength: 120, placeholder: '例：2026年シーズン' });
  button(seasonBar, 'course-season-create-v79', 'シーズンを作成', createSeason);
  const saveBar = add(seasonBox, 'div', undefined, 'course-toolbar-v79');
  button(saveBar, 'course-season-export-v79', '成績帳JSONを保存', () => { assertShared(); download(client.getState(), 'シーズン成績帳_v79.json'); });
  input(saveBar, 'course-season-file-v79', '成績帳JSONを読込', 'file', { accept: '.json,application/json' });
  button(saveBar, 'course-season-local-save-v79', 'この端末へ明示保存', () => { assertShared(); client.saveLocal(); say('シーズン成績帳をこの端末へ保存しました。'); });
  button(saveBar, 'course-season-local-load-v79', 'この端末から復元', () => { assertShared(); client.restoreLocal(); refreshSeason(); say('端末の成績帳を検証して復元しました。'); });
  add(seasonBox, 'p', '').id = 'course-season-summary-v79';
  const practice = add(seasonBox, 'details'); add(practice, 'summary', '今季の練習を記録');
  add(practice, 'p', '選択中の選手・コースへ練習を記録します。品質は試行結果の0〜1です。公開の打数・安打と先天基準を増やしません。', 'course-note-v79');
  const practiceFields = add(practice, 'div', undefined, 'course-practice-v79');
  input(practiceFields, 'course-practice-id-v79', '練習ID（重複不可）', 'text', { maxlength: 96, placeholder: '例：2026-10-20-practice-1' });
  input(practiceFields, 'course-practice-attempts-v79', '試行数', 'number', { min: 1, max: 100000, step: 1, value: 20 });
  input(practiceFields, 'course-practice-quality-v79', '結果の品質（0〜1）', 'number', { min: 0, max: 1, step: .01, placeholder: '実施結果を入力', help: '実際に行った練習の結果を0〜1で明示入力してください。量だけで成功結果を推定しません。' });
  add(practice, 'p', '').id = 'course-practice-target-v79'; button(practice, 'course-practice-record-v79', 'この練習結果を記録', recordPractice);
  button(seasonBox, 'course-season-close-v79', '選択シーズンを締める', () => { assertShared(); const season = selectedSeason(); if (!season) throw Error('シーズンを選んでください。'); client.command({ kind: 'close', seasonId: season.seasonId }); refreshSeason(); say('シーズンを締めました。実打数による長期更新を一度だけ記録しました。'); }, '選択したシーズンを締めます。確定試合成績から長期特性を一度だけ更新し、このシーズンの新規記録を終了します。');
  const reportColumns = add(seasonBox, 'div', undefined, 'course-columns-v79');
  const publicBox = add(reportColumns, 'section'); add(publicBox, 'h3', '公開13区画 · 中央9＋周囲4の実成績'); add(publicBox, 'div').id = 'course-public-report-v79';
  const sprayBox = add(reportColumns, 'section'); add(sprayBox, 'h3', '5方向 · 確定フェア打球の実績'); add(sprayBox, 'div').id = 'course-spray-report-v79';
  const json = add(panel, 'details'); add(json, 'summary', 'AIと共通の任意コース設定JSON');
  add(json, 'p', '人間の操作と同じ physical.batterCourseProfileV87 を検証して適用します。旧V79 JSONも13区画へ要約して読みます。nullは13区画設定を外します。全選手・成績帳はメーカー全体JSONで保存してください。', 'course-note-v79');
  const area = add(json, 'textarea'); area.id = 'course-profile-json-v79'; area.setAttribute('aria-label', '選択選手の任意コース設定JSON');
  const jsonButtons = add(json, 'div', undefined, 'course-toolbar-v79'); button(jsonButtons, 'course-json-refresh-v79', '現在値を取得', () => { assertNoPending(); area.value = JSON.stringify(getAuthoredProfile() ?? null, null, 2); });
  button(jsonButtons, 'course-json-apply-v79', '検証して適用', () => { assertSharedExcept(['course-profile-json-v79']); const raw = JSON.parse(area.value); commitProfile(raw === null ? undefined : raw.version==='batter_course_profile_v79'?core.projectBatterCourseProfileV79ToV87(core.validateBatterCourseProfileV79(raw)):raw); pending.delete(area.id); refresh(); say('共通のCore検証を通して選択選手へ適用しました。'); });
  const advanced=add(panel,'details');advanced.id='course-recognition-v87';add(advanced,'summary','詳細・AI · 打者／投手／捕手の63区画認識');
  add(advanced,'p','打率とは独立した、コースを認識する作者設定です。省略時は既存の能力を利用します。誤差は実測に校正した値ではありません。公式判定は実際の投球位置を使います。認識や狙いの誤差を設定すると、投げる・打つ・捕る動作が変わります。','course-note-v79');
  const recognitionToolbar=add(advanced,'div',undefined,'course-toolbar-v79'),roleLabel=add(recognitionToolbar,'label','役割'),roleSelect=add(roleLabel,'select');roleSelect.id='course-recognition-role-v87';for(const [id,name]of [['batter','打者'],['pitcher','投手'],['catcher','捕手']]){const option=add(roleSelect,'option',name);option.value=id;}
  const cellLabel=add(recognitionToolbar,'label','認識する63区画（9列×7行）'),cellSelect=add(cellLabel,'select');cellSelect.id='course-recognition-cell-v87';for(let c=1;c<=9;c++)for(let r=0;r<=6;r++){const option=add(cellSelect,'option',String(c*10+r));option.value=c*10+r;}cellSelect.value='54';
  const recognitionFrame=add(advanced,'div',undefined,'course-recognition-frame-v87'),recognitionGrid=add(recognitionFrame,'div',undefined,'course-recognition-grid-v87');recognitionGrid.setAttribute('role','group');recognitionGrid.setAttribute('aria-label','9列×7行の63区画。下の列番号1〜9、右の行番号6〜0。');
  for(let r=6;r>=0;r--)for(let c=1;c<=9;c++){const id=c*10+r,node=button(recognitionGrid,'course-recognition-cell-'+id,String(id),()=>selectRecognition(recognitionRole,id));node.dataset.recognitionCourse=id;node.dataset.recognitionColumn=c;node.dataset.recognitionRow=r;if(c>=3&&c<=7&&r>=1&&r<=5)node.dataset.recognitionInside='true';}
  const recognitionStrike=add(recognitionGrid,'div',undefined,'course-recognition-strike-v87');recognitionStrike.setAttribute('aria-hidden','true');
  for(const [className,values]of [['course-recognition-columns-v87',[1,2,3,4,5,6,7,8,9]],['course-recognition-rows-v87',[6,5,4,3,2,1,0]]]){const labels=add(recognitionFrame,'div',undefined,className);labels.setAttribute('aria-hidden','true');for(const value of values)add(labels,'span',String(value));}
  const recognitionStyle=el('style');recognitionStyle.id='maker-recognition-grid-shape-v87';recognitionStyle.textContent='#course-panel-v79 .course-recognition-frame-v87{position:relative;width:100%;max-width:500px;box-sizing:border-box;padding:0 22px 24px 0;margin:12px 0}#course-panel-v79 .course-recognition-grid-v87{position:relative;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));grid-template-rows:repeat(7,minmax(0,1fr));gap:0;width:100%;max-width:none;aspect-ratio:1;margin:0;box-sizing:border-box;border:2px solid #153e66;background:#fff}#course-panel-v79 .course-recognition-grid-v87 button{min-height:0!important;height:100%;min-width:0!important;padding:0!important;margin:0;border:0!important;border-right:1px dotted #9099a2!important;border-bottom:1px dotted #9099a2!important;border-radius:0!important;background:#fff;color:#153e66!important;font-size:clamp(10px,2.8vw,16px)!important;box-shadow:none;line-height:1.1}#course-panel-v79 .course-recognition-grid-v87 button[data-recognition-column="9"]{border-right:0!important}#course-panel-v79 .course-recognition-grid-v87 button[data-recognition-row="0"]{border-bottom:0!important}#course-panel-v79 .course-recognition-grid-v87 button[data-recognition-inside=true]{color:#eb372b!important}#course-panel-v79 .course-recognition-grid-v87 button[aria-pressed=true]{background:#e7f2eb;box-shadow:inset 0 0 0 2px #286644}#course-panel-v79 .course-recognition-grid-v87 button:focus-visible{outline:2px solid #085dc5;outline-offset:-3px}#course-panel-v79 .course-recognition-strike-v87{position:absolute;z-index:1;pointer-events:none;left:22.222222%;right:22.222222%;top:14.285714%;bottom:14.285714%;border:3px solid #eb372b;box-sizing:border-box}#course-panel-v79 .course-recognition-columns-v87{position:absolute;left:0;right:22px;bottom:0;height:24px;display:grid;grid-template-columns:repeat(9,minmax(0,1fr));align-items:center;text-align:center;font-size:13px;color:#203d2a}#course-panel-v79 .course-recognition-rows-v87{position:absolute;right:0;top:0;bottom:24px;width:22px;display:grid;grid-template-rows:repeat(7,minmax(0,1fr));align-items:center;text-align:center;font-size:13px;color:#203d2a}';document.head.append(recognitionStyle);
  const recognitionFields=add(advanced,'div',undefined,'course-recognition-fields-v87'),recognitionSpecs=[['course-recognition-bias-x-v87','左右の認識ずれ（m）','biasXM',-.5,.5],['course-recognition-bias-y-v87','高さの認識ずれ（m）','biasYM',-.5,.5],['course-recognition-uncertainty-v87','認識のばらつき（倍）','uncertaintyScale',0,3],['course-recognition-weight-v87','狙う傾向（倍）','targetWeight',0,4]];
  for(const [id,label,,min,max]of recognitionSpecs)input(recognitionFields,id,label,'number',{min,max,step:'any'});
  const recognitionIds=recognitionSpecs.map(row=>row[0]);button(advanced,'course-recognition-save-v87','この役割・区画の認識を保存',saveRecognition);button(advanced,'course-recognition-cancel-v87','認識の未保存入力を戻す',()=>{clearPending(recognitionIds);refreshRecognition();say('認識の未保存入力を戻しました。');});
  const recognitionJsonDetails=add(advanced,'details');add(recognitionJsonDetails,'summary','役割別認識の共通JSON');const recognitionJson=add(recognitionJsonDetails,'textarea');recognitionJson.id='course-recognition-json-v87';recognitionJson.setAttribute('aria-label','役割別63区画認識JSON');
  button(recognitionJsonDetails,'course-recognition-json-apply-v87','認識JSONを検証して適用',()=>{const raw=JSON.parse(recognitionJson.value),next=roster();if(raw===null)delete currentEntry(next).physical.zoneRecognitionV87;else currentEntry(next).physical.zoneRecognitionV87=core.validateZoneRecognitionV87(raw);commitRoster(next);clearPending([recognitionJson.id]);refreshRecognition();say('認識JSONを保存しました。先天設定・成績は変更していません。');});
  const tab = el('button', 'コース・方向'); tab.id = 'tab-course-v79'; tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id); tab.setAttribute('aria-selected', 'false'); document.querySelector('.tabs').append(tab);
  function show() { root.KneekuraMakerModesV78?.setMode('human'); $('tab-player')?.click(); active = true; for (const other of document.querySelectorAll('.tabs [role=tab]')) other.setAttribute('aria-selected', String(other === tab)); syncVisibility(); refresh(); return inspect(); }
  function syncVisibility() { const ai = document.documentElement.dataset.makerMode === 'ai'; panel.hidden = !active || ai; if (active && !ai) { $('maker-layout').hidden = true; if ($('pitcher-panel')) $('pitcher-panel').hidden = true; if ($('maker-ai-panel')) $('maker-ai-panel').hidden = true; } }
  tab.onclick = () => guarded(show);
  for (const other of document.querySelectorAll('.tabs [role=tab]')) if (other !== tab) other.addEventListener('click', () => { active = false; tab.setAttribute('aria-selected', 'false'); panel.hidden = true; });
  new MutationObserver(() => { if (active && [...document.querySelectorAll('.tabs [role=tab]')].some(other => other !== tab && other.getAttribute('aria-selected') === 'true')) { active = false; tab.setAttribute('aria-selected', 'false'); } syncVisibility(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-maker-mode', 'aria-selected'] });
  function selectZone(id){if(profileFields.some(key=>pending.has(key)))throw Error('先に入力した値を保存するか、未保存入力を戻してください。');zoneId=id;courseId=core.getRepresentativeCourseIdV87(id);previewCache=null;refreshProfile();refreshSeason();}
  function commitRoster(raw){const next=maker.validateLiveRoster(raw);committing=true;try{maker.commitLiveRosterEditV86(next);}finally{committing=false;}trial=null;refresh();return roster();}
  function recognitionIndex(){return (Math.floor(recognitionCell/10)-1)*7+recognitionCell%10;}
  function selectRecognition(role,id){if(recognitionIds.some(key=>pending.has(key)))throw Error('認識の入力を保存するか、認識の未保存入力を戻してください。');recognitionRole=role;recognitionCell=id;refreshRecognition();}
  function refreshRecognition(){roleSelect.value=recognitionRole;cellSelect.value=String(recognitionCell);const raw=currentEntry().physical.zoneRecognitionV87,defaults=core.createNeutralZoneRecognitionV87(),cell=(raw?.[recognitionRole]??defaults[recognitionRole]).cells[recognitionIndex()];
    for(const [id,,key]of recognitionSpecs)if(!pending.has(id))$(id).value=cell[key];
    for(const button of recognitionGrid.querySelectorAll('[data-recognition-course]'))button.setAttribute('aria-pressed',String(Number(button.dataset.recognitionCourse)===recognitionCell));
    if(!pending.has(recognitionJson.id))recognitionJson.value=JSON.stringify(raw??null,null,2);
  }
  function saveRecognition(){const raw=clone(currentEntry().physical.zoneRecognitionV87??{version:'zone_recognition_v87'}),defaults=core.createNeutralZoneRecognitionV87();if(!raw[recognitionRole])raw[recognitionRole]=clone(defaults[recognitionRole]);const cell={};
    for(const [id,,key,min,max]of recognitionSpecs){const value=number(id);if(value<min||value>max){const error=Error(`${min}〜${max}を入力してください。`);error.fieldId=id;throw error;}cell[key]=value;}
    raw[recognitionRole].cells[recognitionIndex()]=cell;const next=roster();currentEntry(next).physical.zoneRecognitionV87=core.validateZoneRecognitionV87(raw);commitRoster(next);clearPending(recognitionIds);refreshRecognition();validation?.group(advanced,'');say('選んだ役割・区画の認識を保存しました。打率・実績は変更していません。');
  }
  const profileFields = ['course-value-v79', 'course-value-range-v79', 'course-effect-v79', 'course-direction-value-v79', 'course-direction-range-v79'];
  function applyFields() {
    if(layer!=='innate')throw Error('先天のレイヤーで作者の基準を編集してください。今季の調整は練習履歴へ記録します。');
    assertSharedExcept(profileFields); const profile = draftProfile(), average = number('course-value-v79'), effect = number('course-effect-v79'), percent = number('course-direction-value-v79');
    if (average < 0 || average > 1 || effect < 0 || effect > 3 || percent < 0 || percent > 100) throw Error('目安は0〜1、効果は0〜3、方向は0〜100%で指定してください。');
    profile.referenceAverages[profileIndex(zoneId)] = average; profile.effectScale = effect;
    if (pending.has('course-direction-value-v79') || pending.has('course-direction-range-v79')) { const weights = profile.directionWeights ?? [.2, .2, .2, .2, .2], target = percent / 100, others = weights.reduce((sum, value, i) => sum + (i === direction ? 0 : value), 0); profile.directionWeights = weights.map((value, i) => i === direction ? target : others > 0 ? (1 - target) * value / others : (1 - target) / 4); }
    commitProfile(profile); clearPending(profileFields);validation?.group(courseBox,'');validation?.group(directionBox,'');refreshProfile(); say('先天設定と狙う配分を選手へ反映しました。');
  }
  function previewProfile(){const profile=draftProfile(),draft=profileFields.some(id=>pending.has(id)),values=['course-value-v79','course-effect-v79','course-direction-value-v79'].map(id=>$(id).value.trim()===''?NaN:Number($(id).value)),valid=values.every(Number.isFinite)&&values[0]>=0&&values[0]<=1&&values[1]>=0&&values[1]<=3&&values[2]>=0&&values[2]<=100;
    if(draft&&valid){profile.referenceAverages[profileIndex(zoneId)]=values[0];profile.effectScale=values[1];if(pending.has('course-direction-value-v79')||pending.has('course-direction-range-v79')){const old=profile.directionWeights??[.2,.2,.2,.2,.2],target=values[2]/100,other=old.reduce((sum,value,i)=>sum+(i===direction?0:value),0);profile.directionWeights=old.map((value,i)=>i===direction?target:other>0?(1-target)*value/other:(1-target)/4);}previewCache=clone(profile);}
    else if(!draft)previewCache=clone(profile);return {profile:clone(previewCache??profile),draft,valid};}
  function layerRegions(profile){const store=client.getState(),season=selectedSeason(store);if(layer==='public'){return season?core.getLiveSeasonReportV87({store,seasonId:season.seasonId,playerId}).regions:publicIds.map(publicZoneId=>({publicZoneId,average:null,ab:0,h:0,pending:0}));}
    if(layer==='mlb')return (root.KneekuraMlbCourseReferenceV87?.zones??[]).map(row=>({...row,ab:row.atBats,h:row.hits}));
    const current=layer==='adapted'&&season?core.deriveLiveCourseProfileV87({store,seasonId:season.seasonId,playerId,profile:draftProfile()}):layer==='adapted'?draftProfile():profile;return publicIds.map((publicZoneId,i)=>({publicZoneId,average:current.referenceAverages[i]}));}
  function refreshPreview(){const preview=previewProfile(),regions=layerRegions(preview.profile),editable=layer==='innate';charts.renderMap(grid,{regions,selectedZoneId:zoneId,draft:preview.draft&&editable,onSelect:id=>guarded(()=>selectZone(id)),label:layerSelect.selectedOptions[0]?.textContent??'13区画'});
    const weights=preview.profile.directionWeights??[.2,.2,.2,.2,.2];charts.renderSpray($('course-direction-input-v79'),{ratios:weights,selectedDirection:direction,onSelect:i=>guarded(()=>selectDirection(i))});
    $('course-preview-state-v87').textContent=editable?(preview.draft?(preview.valid?'未保存のプレビュー · 保存するまで選手の値は変わりません。':'入力途中です。図は最後の有効な値を表示しています。'):'保存済みの値 · 未設定の選手は中立の参考表示です。'):layer==='adapted'?'今季の対応 · 練習の調整は下の履歴へ記録します。':layer==='public'?'確定した安打÷打数 · 図から実績は変更しません。':'MLB2025比較 · 選手や成績へコピー・合算しません。';
    const row=regions.find(row=>(row.publicZoneId??row.zoneId)===zoneId);$('course-zone-detail-v87').textContent=`区画${zoneId}`+(row?.ab!==undefined?` · ${row.h??0}安打/${row.ab}打数 · 未確定${row.pending??0}`:'')+(layer==='mlb'?` · 位置不明 ${root.KneekuraMlbCourseReferenceV87?.unknown?.hits??0}安打/${root.KneekuraMlbCourseReferenceV87?.unknown?.atBats??0}打数は別枠`:'' );
  }
  function refreshProfile() {
    const profile=draftProfile(),physical=currentEntry().physical,authored=getAuthoredProfile()!==undefined,hand=currentEntry().bats??identity().bats;
    playerSelect.value=playerId;layerSelect.value=layer;
    $('course-origin-v79').textContent=physical.batterCourseProfileV87?'この選手に保存した13区画設定を表示しています。':physical.batterCourseProfileV79?'旧63区画の作者設定を13区画へ要約しています。保存時も旧原本を保持します。':'新設定は未付与です。中立 .250 の参考表示で、最初に保存した選手だけへ設定を付けます。';
    $('course-left-label-v79').textContent=hand==='L'?'外角 ←':'内角 ←';$('course-right-label-v79').textContent=hand==='L'?'→ 内角':'→ 外角';
    $('course-selected-label-v79').textContent='選択区画 '+zoneId;
    if(!profileFields.some(id=>pending.has(id))){$('course-value-v79').value=$('course-value-range-v79').value=profile.referenceAverages[profileIndex(zoneId)];$('course-effect-v79').value=profile.effectScale;const weights=profile.directionWeights??[.2,.2,.2,.2,.2];$('course-direction-value-v79').value=$('course-direction-range-v79').value=+(weights[direction]*100).toFixed(6);}
    for(const id of [...profileFields,'course-apply-v79','course-direction-apply-v79'])$(id).disabled=layer!=='innate';
    avgPair.hidden=layer!=='innate';$('course-effect-v79').closest('label').hidden=layer!=='innate';profileButtons.hidden=layer!=='innate';
    names.forEach((_,i)=>$('course-direction-'+i).setAttribute('aria-pressed',String(i===direction)));$('course-direction-label-v79').textContent=names[direction]+'を編集 · 合計100%';
    $('course-hand-note-v79').textContent=hand==='L'?'左打者：右翼側が引っ張り、左翼側が流し方向です。':'右打者：左翼側が引っ張り、右翼側が流し方向です。';
    $('course-source-diff-v87').textContent='13→63→13の境界は面積比による近似で、往復しても完全一致しません。旧63の作者値・役割別63認識・実績は相互に上書きしません。';
    if(!pending.has(area.id))area.value=JSON.stringify(getAuthoredProfile()??null,null,2);refreshPreview();
  }
  function selectedSeason(store = client.getState()) { return store.seasons.find(season => season.seasonId === store.selectedSeasonId); }
  function refreshSeason() {
    const store = client.getState(); seasonSelect.replaceChildren(); const none = add(seasonSelect, 'option', '蓄積しない'); none.value = '';
    for (const season of store.seasons) { const option = add(seasonSelect, 'option', `${season.name} (${season.status === 'closed' ? '締め済み' : '記録中'})`); option.value = season.seasonId; } seasonSelect.value = store.selectedSeasonId ?? '';
    const season = selectedSeason(store); $('course-season-summary-v79').textContent = season ? `${season.name} · ${identity().name} · ${season.status === 'closed' ? '締め済み' : '試合・練習の記録を受付中'}` : 'シーズンは未選択です。作成・選択すると、その選手の実成績を表示します。';
    $('course-practice-record-v79').disabled = !season || season.status !== 'open'; $('course-season-close-v79').disabled = !season || season.status !== 'open';
    if (!season) { $('course-public-report-v79').replaceChildren(el('p', '表示するシーズンを選んでください。', 'course-empty-v79')); $('course-spray-report-v79').replaceChildren(el('p', '選択後に確定した打球実績を表示します。', 'course-empty-v79'));refreshPreview();return; }
    const report = core.getLiveSeasonReportV87({ store, seasonId: season.seasonId, playerId }); root.KneekuraCourseChartsV79.renderPublic($('course-public-report-v79'), report); root.KneekuraCourseChartsV79.renderSpray($('course-spray-report-v79'), report.spray);
    const effective = core.deriveLiveCourseProfileV87({ store, seasonId: season.seasonId, playerId, ...(getAuthoredProfile() ? { profile: getAuthoredProfile() } : {}) });
    const val = effective.referenceAverages[profileIndex(zoneId)]; $('course-practice-target-v79').textContent = `${identity().name} · 区画${zoneId}（記録用63ID ${courseId}） · 今季の有効な目安 ${val.toFixed(3)}（実績打率ではありません）`;
    refreshPreview();
  }
  const seasonFields = ['course-season-id-v79', 'course-season-name-v79'], practiceIds = ['course-practice-id-v79', 'course-practice-attempts-v79', 'course-practice-quality-v79'];
  function createSeason() { assertSharedExcept(seasonFields); const seasonId = $('course-season-id-v79').value.trim(), name = $('course-season-name-v79').value.trim(); if (!seasonId || !name) throw Error('新規シーズンのIDと名前を入力してください。'); client.command({ kind: 'create', seasonId, name }); clearPending(seasonFields); $('course-season-id-v79').value = $('course-season-name-v79').value = ''; refreshSeason(); say('シーズンを作成しました。デモ成績は追加していません。'); }
  function recordPractice() { assertSharedExcept(practiceIds); const season = selectedSeason(), practiceId = $('course-practice-id-v79').value.trim(), quality = number('course-practice-quality-v79'), attempts = integer('course-practice-attempts-v79', 1, 100000); if (!season || !practiceId) throw Error('記録中のシーズンと重複しない練習IDを指定してください。'); if (quality < 0 || quality > 1) throw Error('練習結果の品質は0〜1で入力してください。'); client.command({ kind: 'practice', practiceId, seasonId: season.seasonId, playerId, courseId, attempts, quality }); clearPending(practiceIds); $('course-practice-id-v79').value = ''; refreshSeason(); say('練習結果を記録しました。公開打数・安打と先天設定は変更していません。'); }
  function resetSeasonForms() { for (const id of seasonFields) $(id).value = ''; $('course-practice-id-v79').value = ''; $('course-practice-attempts-v79').value = '20'; $('course-practice-quality-v79').value = ''; area.value = JSON.stringify(getAuthoredProfile() ?? null, null, 2); }
  function download(value, filename) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' })), anchor = el('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function runTrial() {
    assertShared(); const attempts = integer('course-trial-attempts-v79', 1, 40); if (typeof core.compareBatterCourseDirectionsV79 !== 'function') throw Error('同条件の試打Coreを読み込めませんでした。');
    const pitcher = root.KneekuraPitcherMakerV78?.inspect(), pitcherId = pitcher?.pitcherId ?? catalog.players.find(player => player.role === 'P' && player.playerId.split('-')[0] !== playerId.split('-')[0])?.playerId;
    const catcherId = catalog.players.find(player => player.role === 'C' && player.playerId.split('-')[0] === pitcherId?.split('-')[0])?.playerId;
    if (!pitcherId || !catcherId) throw Error('試打の投手と捕手を確認できませんでした。');
    const trialRoster = roster(), trialEntry = currentEntry(trialRoster), authored = getAuthoredProfile(), seasonStore = client.getState(), season = selectedSeason(seasonStore);
    const effective = season ? core.deriveLiveCourseProfileV87({ store: seasonStore, seasonId: season.seasonId, playerId, ...(authored ? { profile: authored } : {}) }) : authored ?? core.createNeutralBatterCourseProfileV87();
    trialEntry.physical.batterCourseProfileV87 = { ...clone(effective), directionWeights: clone(effective.directionWeights ?? [.2, .2, .2, .2, .2]) };trialEntry.physical.batterCourseProfileV79=core.expandBatterCourseProfileV87ToV79(trialEntry.physical.batterCourseProfileV87);
    const physical = trialEntry.physical, hand = trialEntry.bats ?? identity().bats;
    const clips = root.KneekuraReferenceBatMotions.clips.filter(clip => clip.side === hand && (physical.clipId ? clip.id === physical.clipId : clip.defaultSelection !== false)).map(clip => ({ id: clip.id, side: clip.side, source: { sha256: clip.source.sha256, repository: clip.source.repository }, contactTimeSeconds: clip.contactTimeSeconds, normalization: clone(clip.normalization), frames: clip.frames.map(frame => ({ tick: frame.tick, grip: clone(frame.grip), orientation: clone(frame.orientation) })), defaultSelection: clip.defaultSelection }));
    const seed = $('pitcher-seed') ? integer('pitcher-seed', 0, 4294967295) : 20261020;
    trial = core.compareBatterCourseDirectionsV79({ players: catalog.players, roster: trialRoster, pitcherId, batterId: playerId, catcherId, measuredClips: clips, seed, pitchType: pitcher?.pitchType ?? 'fastball', ...(pitcher?.pitchId && trialRoster.entries.find(e => e.playerId === pitcherId)?.physical.pitchRepertoireV78 ? { pitchId: pitcher.pitchId } : {}), location: $('pitcher-location')?.value ?? 'zone', attempts });
    root.KneekuraCourseChartsV79.renderSpray($('course-trial-result-v79'), { counts: trial.counts, ratios: trial.ratios }); $('course-trial-summary-v79').textContent = `${attempts}回 · フェア${trial.total}本 · ファウル${trial.fouls}本 · 空振り等${trial.misses}回 · 番号${seed}`; say('共通Coreで試打しました。成績帳には記録していません。'); return clone(trial);
  }
  function refresh() { refreshProfile(); refreshSeason();refreshRecognition();if (!trial) { $('course-trial-result-v79').replaceChildren(); $('course-trial-summary-v79').textContent = '試打を実行すると、入力の配分と別に計算結果を表示します。'; } root.KneekuraMakerHelp?.decorate(panel); }
  function selectDirection(index) { assertNoPending(); direction = index; refreshProfile(); refreshSeason(); }
  function selectPlayer(id) { assertNoPending(); if (!catalog.players.some(player => player.playerId === id)) throw Error('登録のない選手です。'); playerId = id; trial = null;previewCache=null;refresh(); say('選んだ選手の設定を表示しています。'); return playerId; }
  function inspect() { return { version: 79,displayVersion:87,playerId, courseId,zoneId,layer,direction, active, mode: document.documentElement.dataset.makerMode ?? 'human', authored: getAuthoredProfile() !== undefined, pending: [...pending].map(([id, label]) => ({ id, label })), seasonId: client.getState().selectedSeasonId, error: lastError, trial: trial ? clone(trial) : null }; }
  playerSelect.onchange = () => { const id = playerSelect.value; guarded(() => selectPlayer(id)); playerSelect.value = playerId; };
  seasonSelect.onchange = () => { const id = seasonSelect.value; guarded(() => { assertShared(); client.command({ kind: 'select', seasonId: id || null }); refreshSeason(); say('選んだシーズンを表示しています。'); }); seasonSelect.value = client.getState().selectedSeasonId ?? ''; };
  for (const id of profileFields) mark(id, 'コース・方向の数値'); for (const id of seasonFields) mark(id, '新規シーズン'); for (const id of practiceIds) mark(id, '練習結果'); mark(area.id, '任意設定JSON');for(const id of recognitionIds)mark(id,'役割別の認識');mark(recognitionJson.id,'役割別認識JSON');
  layerSelect.onchange=()=>{layer=layerSelect.value;refreshProfile();logPreview('layer');};roleSelect.onchange=()=>{guarded(()=>selectRecognition(roleSelect.value,recognitionCell));roleSelect.value=recognitionRole;};cellSelect.onchange=()=>{guarded(()=>selectRecognition(recognitionRole,Number(cellSelect.value)));cellSelect.value=String(recognitionCell);};
  for (const [rangeId, numericId] of [['course-value-range-v79', 'course-value-v79'], ['course-direction-range-v79', 'course-direction-value-v79']]) { $(rangeId).addEventListener('input', () => { $(numericId).value = $(rangeId).value; pending.set(numericId, 'コース・方向の数値');refreshPreview(); }); $(numericId).addEventListener('input', () => { const value = Number($(numericId).value); if (Number.isFinite(value)) $(rangeId).value = value;refreshPreview(); }); }
  $('course-season-file-v79').onchange = async event => { const file = event.target.files?.[0]; if (!file) return; try { assertShared(); if (file.size > 256_000_000) throw Error('256MB以下の成績帳JSONを選んでください。'); const raw = JSON.parse(await file.text()); assertShared(); client.replaceValidated(raw); refreshSeason(); say('成績帳JSONを検証して読み込みました。'); } catch (error) { say(error.message, true); } finally { event.target.value = ''; } };
  document.addEventListener('kneekura:maker-roster-change', () => { if (committing) return; trial = null; refresh(); });
  client.subscribe(() => { guarded(refreshSeason); });
  root.KneekuraBatterMakerV79 = Object.freeze({ inspect, show, selectPlayer, getProfile, setProfile: raw => { assertShared();if(raw?.version==='batter_course_profile_v87')return commitProfile(raw);const next=roster();if(raw===undefined)delete currentEntry(next).physical.batterCourseProfileV79;else currentEntry(next).physical.batterCourseProfileV79=core.validateBatterCourseProfileV79(raw);delete currentEntry(next).physical.batterCourseProfileV87;commitRoster(next);return getProfile();},getProfileV87:getAuthoredProfile,getPreviewV87:()=>frozen({...previewProfile(),layer,zoneId}),getPreviewLogV87:()=>frozen(previewLog),getSeasonClient: () => client, assertNoPending, assertRosterImport: () => { if (!committing) assertNoPending(); }, runTrial });
  courseId=core.getRepresentativeCourseIdV87(zoneId);refresh(); say('選手を選んでコースまたは方向を編集できます。表示しただけでは新設定を付与しません。');
})(globalThis);
