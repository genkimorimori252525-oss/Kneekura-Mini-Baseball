(function (root) {
  'use strict';
  const core = root.KneekuraBaseballWorkbench, maker = root.baseballMaker, catalog = root.KneekuraLiveGameRosterCatalog;
  if (!maker || !catalog?.players?.length || !core?.createNeutralBatterCourseProfileV79) return;
  if (!root.KneekuraCourseChartsV79 || !root.KneekuraSeasonClientV79) throw Error('v79のコース図・シーズン保存部品を読み込めませんでした。');
  const validation=root.KneekuraMakerValidationV86;
  const $ = id => document.getElementById(id), clone = value => JSON.parse(JSON.stringify(value));
  const names = ['左翼', '左中間', '中堅', '右中間', '右翼'], colors = { red: '#f5a6a5', blue: '#c8e5f4', gray: '#e5e9e7' };
  const client = root.KneekuraSeasonClientV79.create({ core, storageKey: 'kneekura-course-seasons-v79' });
  root.KneekuraCourseSeasonsV79 = client;
  let playerId = catalog.players[0].playerId, courseId = 54, direction = 2, active = false, committing = false, lastError = '', trial = null;
  const pending = new Map(),numericErrors=new Map();
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
  function mark(id, label) { $(id).addEventListener('input', () => { pending.set(id, label); say(`${label}は未保存です。対応する反映・記録ボタンで確定してください。`); }); }
  function clearPending(ids) { for (const id of ids) { pending.delete(id); $(id)?.setCustomValidity('');validation?.field($(id),''); } }
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
  function getProfile() { const value = currentEntry().physical.batterCourseProfileV79; return value === undefined ? undefined : clone(value); }
  function draftProfile() { return getProfile() ?? clone(core.createNeutralBatterCourseProfileV79()); }
  function profileIndex(id) { return (Math.floor(id / 10) - 1) * 7 + id % 10; }
  function commitProfile(raw) {
    const accepted = raw === undefined ? undefined : core.validateBatterCourseProfileV79(raw), next = roster();
    if (accepted === undefined) delete currentEntry(next).physical.batterCourseProfileV79; else currentEntry(next).physical.batterCourseProfileV79 = accepted;
    const packet = maker.validateLiveRoster(next); committing = true;
    try { maker.commitLiveRosterEditV86(packet); } finally { committing = false; }
    trial = null; refresh(); return getProfile();
  }
  document.addEventListener('input',event=>{const input=event.target;if(!numericErrors.has(input.id)||input.value.trim()===''||!input.validity.valid||!Number.isFinite(Number(input.value)))return;const message=numericErrors.get(input.id);numericErrors.delete(input.id);validation?.field(input,'');if(lastError===message)say('入力形式のエラーは解消しました。必要な反映・試打ボタンで確定してください。');});
  const panel = el('section', undefined, 'course-maker-v79'); panel.id = 'course-panel-v79'; panel.hidden = true; panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', 'tab-course-v79');
  add(panel, 'h2', '打者のコース・方向とシーズン成績');
  add(panel, 'p', '先天設定、今季の対応、実際の成績を分けて保存します。ミート・パワー・基礎SI・独立得能はこの画面では変えません。', 'course-note-v79');
  const toolbar = add(panel, 'div', undefined, 'course-toolbar-v79'), playerLabel = add(toolbar, 'label', '打つ選手'), playerSelect = add(playerLabel, 'select'); playerSelect.id = 'course-player-v79';
  for (const player of catalog.players) { const option = add(playerSelect, 'option', player.name); option.value = player.playerId; }
  button(toolbar, 'course-cancel-v79', '未保存入力を戻す', () => { for(const id of pending.keys())validation?.field($(id),'');pending.clear(); refresh(); resetSeasonForms(); say('未保存の入力を戻しました。保存済みの選手・成績帳を表示しています。'); });
  add(panel, 'p', '', 'course-status-v79').id = 'course-status-v79'; $('maker-layout').after(panel);
  const columns = add(panel, 'div', undefined, 'course-columns-v79');
  const courseBox = add(columns, 'section', undefined, 'course-box-v79'); add(courseBox, 'h3', '先天的なコース設定 · 63マス');
  add(courseBox, 'p', 'クリック／Enter／Space：得意 .330 → 苦手 .180 → 普通 .250。矢印キーで編集するマスを選べます。実績打率の保証値ではありません。', 'course-note-v79');
  add(courseBox, 'p', '').id = 'course-origin-v79';
  const labels = add(courseBox, 'div', undefined, 'course-grid-labels-v79'); add(labels, 'span', '').id = 'course-left-label-v79'; add(labels, 'span', '高め · 捕手側の固定図'); add(labels, 'span', '').id = 'course-right-label-v79';
  const gridWrap = add(courseBox, 'div', undefined, 'course-grid-wrap-v79'), grid = add(gridWrap, 'div', undefined, 'course-grid-v79'); grid.id = 'course-grid-v79'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '左から1〜9列、下から0〜6行の63コース'); add(gridWrap, 'div', undefined, 'course-strike-v79');
  for (let r = 6; r >= 0; r--) for (let c = 1; c <= 9; c++) {
    const id = c * 10 + r, cell = button(grid, 'course-cell-' + id, '', () => cycle(id)); cell.dataset.courseId = id;
    cell.className = 'course-cell-v79'; cell.append(el('b'), el('span'));
    cell.addEventListener('focus', () => { if (!pending.size && courseId !== id) { courseId = id; refreshProfile(); refreshSeason(); } });
    cell.addEventListener('keydown', event => {
      const delta = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[event.key]; if (!delta) return;
      event.preventDefault(); guarded(() => { assertNoPending(); courseId = Math.max(1, Math.min(9, c + delta[0])) * 10 + Math.max(0, Math.min(6, r + delta[1])); refreshProfile(); refreshSeason(); $('course-cell-' + courseId).focus(); });
    });
  }
  const legend = add(courseBox, 'div', undefined, 'course-legend-v79');
  for (const [color, text] of [['red', '得意：.300以上'], ['blue', '苦手：.200以下'], ['gray', '普通']]) { const span = add(legend, 'span'); const swatch = add(span, 'i'); swatch.style.background = colors[color]; span.append(document.createTextNode(text)); }
  add(courseBox, 'p', '赤枠はストライクゾーンの5×5。表示の上下・左右・IDは左右打者でも反転しません。', 'course-note-v79');
  add(courseBox, 'h3', '').id = 'course-selected-label-v79';
  const avgPair = add(courseBox, 'div', undefined, 'course-field-pair-v79');
  input(avgPair, 'course-value-range-v79', '選択マスの目安', 'range', { min: 0, max: 1, step: .001, help: '選択マスの先天的な基準を0〜1で編集します。現在の試合成績や公開能力とは別の設定です。' });
  input(avgPair, 'course-value-v79', '数値', 'number', { min: 0, max: 1, step: .001 });
  input(courseBox, 'course-effect-v79', '効果の強さ', 'number', { min: 0, max: 3, step: .05, help: '作者調整の0〜3倍です。0はコース設定の打撃動作への効果を止めます。公開能力や得能を変えません。' });
  const profileButtons = add(courseBox, 'div', undefined, 'course-toolbar-v79');
  button(profileButtons, 'course-apply-v79', '数値を選手へ反映', applyFields);
  button(profileButtons, 'course-remove-v79', 'この選手の新設定を外す', () => { assertShared(); commitProfile(undefined); say('この選手の任意コース設定を外しました。旧方式を使用します。'); });
  const preview = add(courseBox, 'details'); add(preview, 'summary', '公開9マスの設定要約');
  add(preview, 'p', '先天設定を面積で重み付けした要約です。H/ABから求める実績打率とは別の図です。', 'course-note-v79'); add(preview, 'div', undefined, 'course-preview-grid-v79').id = 'course-setting-preview-v79';
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
  const publicBox = add(reportColumns, 'section'); add(publicBox, 'h3', '公開9コース · 実成績'); add(publicBox, 'div').id = 'course-public-report-v79';
  const sprayBox = add(reportColumns, 'section'); add(sprayBox, 'h3', '5方向 · 確定フェア打球の実績'); add(sprayBox, 'div').id = 'course-spray-report-v79';
  const json = add(panel, 'details'); add(json, 'summary', 'AIと共通の任意コース設定JSON');
  add(json, 'p', '人間の操作と同じ physical.batterCourseProfileV79 を検証して適用します。nullは任意設定を外します。全選手・成績帳をまとめる場合はメーカー全体JSONを保存してください。', 'course-note-v79');
  const area = add(json, 'textarea'); area.id = 'course-profile-json-v79'; area.setAttribute('aria-label', '選択選手の任意コース設定JSON');
  const jsonButtons = add(json, 'div', undefined, 'course-toolbar-v79'); button(jsonButtons, 'course-json-refresh-v79', '現在値を取得', () => { assertNoPending(); area.value = JSON.stringify(getProfile() ?? null, null, 2); });
  button(jsonButtons, 'course-json-apply-v79', '検証して適用', () => { assertSharedExcept(['course-profile-json-v79']); const raw = JSON.parse(area.value); commitProfile(raw === null ? undefined : raw); pending.delete(area.id); refresh(); say('共通のCore検証を通して選択選手へ適用しました。'); });
  const tab = el('button', 'コース・方向'); tab.id = 'tab-course-v79'; tab.type = 'button'; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panel.id); tab.setAttribute('aria-selected', 'false'); document.querySelector('.tabs').append(tab);
  function show() { root.KneekuraMakerModesV78?.setMode('human'); $('tab-player')?.click(); active = true; for (const other of document.querySelectorAll('.tabs [role=tab]')) other.setAttribute('aria-selected', String(other === tab)); syncVisibility(); refresh(); return inspect(); }
  function syncVisibility() { const ai = document.documentElement.dataset.makerMode === 'ai'; panel.hidden = !active || ai; if (active && !ai) { $('maker-layout').hidden = true; if ($('pitcher-panel')) $('pitcher-panel').hidden = true; if ($('maker-ai-panel')) $('maker-ai-panel').hidden = true; } }
  tab.onclick = () => guarded(show);
  for (const other of document.querySelectorAll('.tabs [role=tab]')) if (other !== tab) other.addEventListener('click', () => { active = false; tab.setAttribute('aria-selected', 'false'); panel.hidden = true; });
  new MutationObserver(() => { if (active && [...document.querySelectorAll('.tabs [role=tab]')].some(other => other !== tab && other.getAttribute('aria-selected') === 'true')) { active = false; tab.setAttribute('aria-selected', 'false'); } syncVisibility(); }).observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['data-maker-mode', 'aria-selected'] });
  function cycle(id) { assertShared(); courseId = id; const profile = draftProfile(), index = profileIndex(id), current = profile.referenceAverages[index]; profile.referenceAverages[index] = current >= .3 ? .180 : current <= .2 ? .250 : .330; commitProfile(profile); say(`コース${id}の先天設定を保存しました。`); }
  const profileFields = ['course-value-v79', 'course-value-range-v79', 'course-effect-v79', 'course-direction-value-v79', 'course-direction-range-v79'];
  function applyFields() {
    assertSharedExcept(profileFields); const profile = draftProfile(), average = number('course-value-v79'), effect = number('course-effect-v79'), percent = number('course-direction-value-v79');
    if (average < 0 || average > 1 || effect < 0 || effect > 3 || percent < 0 || percent > 100) throw Error('目安は0〜1、効果は0〜3、方向は0〜100%で指定してください。');
    profile.referenceAverages[profileIndex(courseId)] = average; profile.effectScale = effect;
    if (pending.has('course-direction-value-v79') || pending.has('course-direction-range-v79')) { const weights = profile.directionWeights ?? [.2, .2, .2, .2, .2], target = percent / 100, others = weights.reduce((sum, value, i) => sum + (i === direction ? 0 : value), 0); profile.directionWeights = weights.map((value, i) => i === direction ? target : others > 0 ? (1 - target) * value / others : (1 - target) / 4); }
    commitProfile(profile); clearPending(profileFields); refreshProfile(); say('先天設定と狙う配分を選手へ反映しました。');
  }
  function previewValues(profile) {
    const result = [];
    for (let py = 2; py >= 0; py--) for (let px = 0; px < 3; px++) { let sum = 0, area = 0;
      for (let c = 3; c <= 7; c++) for (let r = 1; r <= 5; r++) { const overlap = Math.max(0, Math.min(c - 2, (px + 1) * 5 / 3) - Math.max(c - 3, px * 5 / 3)) * Math.max(0, Math.min(r, (py + 1) * 5 / 3) - Math.max(r - 1, py * 5 / 3)); sum += profile.referenceAverages[profileIndex(c * 10 + r)] * overlap; area += overlap; } result.push(sum / area); }
    return result;
  }
  function refreshProfile() {
    const profile = draftProfile(), authored = getProfile() !== undefined, hand = currentEntry().bats ?? identity().bats;
    playerSelect.value = playerId; $('course-origin-v79').textContent = authored ? 'この選手に明示保存した任意設定を表示しています。' : '新設定は未付与です。中立 .250 の参考表示です。最初の明示編集でこの選手だけへ保存します。';
    $('course-left-label-v79').textContent = hand === 'L' ? '外角 ←' : '内角 ←'; $('course-right-label-v79').textContent = hand === 'L' ? '→ 内角' : '→ 外角';
    for (const cell of grid.querySelectorAll('[data-course-id]')) { const id = Number(cell.dataset.courseId), value = profile.referenceAverages[profileIndex(id)]; cell.style.background = colors[value >= .3 ? 'red' : value <= .2 ? 'blue' : 'gray']; cell.children[0].textContent = value.toFixed(3).replace(/^0\./, '.'); cell.children[1].textContent = id; cell.setAttribute('aria-label', `コース${id}、先天設定${value.toFixed(3)}`); cell.setAttribute('aria-pressed', String(id === courseId)); cell.tabIndex = id === courseId ? 0 : -1; }
    $('course-selected-label-v79').textContent = `選択コース ${courseId}`;
    if (!profileFields.some(id => pending.has(id))) { $('course-value-v79').value = $('course-value-range-v79').value = profile.referenceAverages[profileIndex(courseId)]; $('course-effect-v79').value = profile.effectScale; const weights = profile.directionWeights ?? [.2, .2, .2, .2, .2]; $('course-direction-value-v79').value = $('course-direction-range-v79').value = +(weights[direction] * 100).toFixed(6); }
    const weights = profile.directionWeights ?? [.2, .2, .2, .2, .2]; root.KneekuraCourseChartsV79.renderSpray($('course-direction-input-v79'), { ratios: weights });
    $('course-direction-input-v79').querySelectorAll('svg path').forEach((path, i) => { path.style.cursor = 'pointer'; path.setAttribute('stroke-width', i === direction ? '3.5' : '1.5'); path.addEventListener('click', () => guarded(() => selectDirection(i))); });
    names.forEach((_, i) => $('course-direction-' + i).setAttribute('aria-pressed', String(i === direction)));
    $('course-direction-label-v79').textContent = `${names[direction]}を編集 · 合計100%${profile.directionWeights ? '' : '（未指定・中立表示）'}`;
    $('course-hand-note-v79').textContent = hand === 'L' ? '左打者：右翼側が引っ張り、左翼側が流し方向です。' : '右打者：左翼側が引っ張り、右翼側が流し方向です。';
    const preview = $('course-setting-preview-v79'); preview.replaceChildren(); previewValues(profile).forEach(value => { const cell = add(preview, 'div', value.toFixed(3).replace(/^0\./, '.')); cell.style.background = colors[value >= .3 ? 'red' : value <= .2 ? 'blue' : 'gray']; });
    $('course-practice-target-v79').textContent = `${identity().name} · コース${courseId}へ記録`;
    if (!pending.has(area.id)) area.value = JSON.stringify(getProfile() ?? null, null, 2);
  }
  function selectedSeason(store = client.getState()) { return store.seasons.find(season => season.seasonId === store.selectedSeasonId); }
  function refreshSeason() {
    const store = client.getState(); seasonSelect.replaceChildren(); const none = add(seasonSelect, 'option', '蓄積しない'); none.value = '';
    for (const season of store.seasons) { const option = add(seasonSelect, 'option', `${season.name} (${season.status === 'closed' ? '締め済み' : '記録中'})`); option.value = season.seasonId; } seasonSelect.value = store.selectedSeasonId ?? '';
    const season = selectedSeason(store); $('course-season-summary-v79').textContent = season ? `${season.name} · ${identity().name} · ${season.status === 'closed' ? '締め済み' : '試合・練習の記録を受付中'}` : 'シーズンは未選択です。作成・選択すると、その選手の実成績を表示します。';
    $('course-practice-record-v79').disabled = !season || season.status !== 'open'; $('course-season-close-v79').disabled = !season || season.status !== 'open';
    if (!season) { $('course-public-report-v79').replaceChildren(el('p', '表示するシーズンを選んでください。', 'course-empty-v79')); $('course-spray-report-v79').replaceChildren(el('p', '選択後に確定した打球実績を表示します。', 'course-empty-v79')); return; }
    const report = core.getLiveSeasonReportV79({ store, seasonId: season.seasonId, playerId }); root.KneekuraCourseChartsV79.renderPublic($('course-public-report-v79'), report); root.KneekuraCourseChartsV79.renderSpray($('course-spray-report-v79'), report.spray);
    const effective = core.deriveLiveCourseProfileV79({ store, seasonId: season.seasonId, playerId, ...(getProfile() ? { profile: getProfile() } : {}) });
    const val = effective.referenceAverages[profileIndex(courseId)]; $('course-practice-target-v79').textContent = `${identity().name} · コース${courseId} · 今季の有効な目安 ${val.toFixed(3)}（実績打率ではありません）`;
  }
  const seasonFields = ['course-season-id-v79', 'course-season-name-v79'], practiceIds = ['course-practice-id-v79', 'course-practice-attempts-v79', 'course-practice-quality-v79'];
  function createSeason() { assertSharedExcept(seasonFields); const seasonId = $('course-season-id-v79').value.trim(), name = $('course-season-name-v79').value.trim(); if (!seasonId || !name) throw Error('新規シーズンのIDと名前を入力してください。'); client.command({ kind: 'create', seasonId, name }); clearPending(seasonFields); $('course-season-id-v79').value = $('course-season-name-v79').value = ''; refreshSeason(); say('シーズンを作成しました。デモ成績は追加していません。'); }
  function recordPractice() { assertSharedExcept(practiceIds); const season = selectedSeason(), practiceId = $('course-practice-id-v79').value.trim(), quality = number('course-practice-quality-v79'), attempts = integer('course-practice-attempts-v79', 1, 100000); if (!season || !practiceId) throw Error('記録中のシーズンと重複しない練習IDを指定してください。'); if (quality < 0 || quality > 1) throw Error('練習結果の品質は0〜1で入力してください。'); client.command({ kind: 'practice', practiceId, seasonId: season.seasonId, playerId, courseId, attempts, quality }); clearPending(practiceIds); $('course-practice-id-v79').value = ''; refreshSeason(); say('練習結果を記録しました。公開打数・安打と先天設定は変更していません。'); }
  function resetSeasonForms() { for (const id of seasonFields) $(id).value = ''; $('course-practice-id-v79').value = ''; $('course-practice-attempts-v79').value = '20'; $('course-practice-quality-v79').value = ''; area.value = JSON.stringify(getProfile() ?? null, null, 2); }
  function download(value, filename) { const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2) + '\n'], { type: 'application/json' })), anchor = el('a'); anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function runTrial() {
    assertShared(); const attempts = integer('course-trial-attempts-v79', 1, 40); if (typeof core.compareBatterCourseDirectionsV79 !== 'function') throw Error('同条件の試打Coreを読み込めませんでした。');
    const pitcher = root.KneekuraPitcherMakerV78?.inspect(), pitcherId = pitcher?.pitcherId ?? catalog.players.find(player => player.role === 'P' && player.playerId.split('-')[0] !== playerId.split('-')[0])?.playerId;
    const catcherId = catalog.players.find(player => player.role === 'C' && player.playerId.split('-')[0] === pitcherId?.split('-')[0])?.playerId;
    if (!pitcherId || !catcherId) throw Error('試打の投手と捕手を確認できませんでした。');
    const trialRoster = roster(), trialEntry = currentEntry(trialRoster), authored = trialEntry.physical.batterCourseProfileV79, seasonStore = client.getState(), season = selectedSeason(seasonStore);
    const effective = season ? core.deriveLiveCourseProfileV79({ store: seasonStore, seasonId: season.seasonId, playerId, ...(authored ? { profile: authored } : {}) }) : authored ?? core.createNeutralBatterCourseProfileV79();
    trialEntry.physical.batterCourseProfileV79 = { ...clone(effective), directionWeights: clone(effective.directionWeights ?? [.2, .2, .2, .2, .2]) };
    const physical = trialEntry.physical, hand = trialEntry.bats ?? identity().bats;
    const clips = root.KneekuraReferenceBatMotions.clips.filter(clip => clip.side === hand && (physical.clipId ? clip.id === physical.clipId : clip.defaultSelection !== false)).map(clip => ({ id: clip.id, side: clip.side, source: { sha256: clip.source.sha256, repository: clip.source.repository }, contactTimeSeconds: clip.contactTimeSeconds, normalization: clone(clip.normalization), frames: clip.frames.map(frame => ({ tick: frame.tick, grip: clone(frame.grip), orientation: clone(frame.orientation) })), defaultSelection: clip.defaultSelection }));
    const seed = $('pitcher-seed') ? integer('pitcher-seed', 0, 4294967295) : 20261020;
    trial = core.compareBatterCourseDirectionsV79({ players: catalog.players, roster: trialRoster, pitcherId, batterId: playerId, catcherId, measuredClips: clips, seed, pitchType: pitcher?.pitchType ?? 'fastball', ...(pitcher?.pitchId && trialRoster.entries.find(e => e.playerId === pitcherId)?.physical.pitchRepertoireV78 ? { pitchId: pitcher.pitchId } : {}), location: $('pitcher-location')?.value ?? 'zone', attempts });
    root.KneekuraCourseChartsV79.renderSpray($('course-trial-result-v79'), { counts: trial.counts, ratios: trial.ratios }); $('course-trial-summary-v79').textContent = `${attempts}回 · フェア${trial.total}本 · ファウル${trial.fouls}本 · 空振り等${trial.misses}回 · 番号${seed}`; say('共通Coreで試打しました。成績帳には記録していません。'); return clone(trial);
  }
  function refresh() { refreshProfile(); refreshSeason(); if (!trial) { $('course-trial-result-v79').replaceChildren(); $('course-trial-summary-v79').textContent = '試打を実行すると、入力の配分と別に計算結果を表示します。'; } root.KneekuraMakerHelp?.decorate(panel); }
  function selectDirection(index) { assertNoPending(); direction = index; refreshProfile(); refreshSeason(); }
  function selectPlayer(id) { assertNoPending(); if (!catalog.players.some(player => player.playerId === id)) throw Error('登録のない選手です。'); playerId = id; trial = null; refresh(); say('選んだ選手の設定を表示しています。'); return playerId; }
  function inspect() { return { version: 79, playerId, courseId, direction, active, mode: document.documentElement.dataset.makerMode ?? 'human', authored: getProfile() !== undefined, pending: [...pending].map(([id, label]) => ({ id, label })), seasonId: client.getState().selectedSeasonId, error: lastError, trial: trial ? clone(trial) : null }; }
  playerSelect.onchange = () => { const id = playerSelect.value; guarded(() => selectPlayer(id)); playerSelect.value = playerId; };
  seasonSelect.onchange = () => { const id = seasonSelect.value; guarded(() => { assertShared(); client.command({ kind: 'select', seasonId: id || null }); refreshSeason(); say('選んだシーズンを表示しています。'); }); seasonSelect.value = client.getState().selectedSeasonId ?? ''; };
  for (const id of profileFields) mark(id, 'コース・方向の数値'); for (const id of seasonFields) mark(id, '新規シーズン'); for (const id of practiceIds) mark(id, '練習結果'); mark(area.id, '任意設定JSON');
  for (const [rangeId, numericId] of [['course-value-range-v79', 'course-value-v79'], ['course-direction-range-v79', 'course-direction-value-v79']]) { $(rangeId).addEventListener('input', () => { $(numericId).value = $(rangeId).value; pending.set(numericId, 'コース・方向の数値'); }); $(numericId).addEventListener('input', () => { const value = Number($(numericId).value); if (Number.isFinite(value)) $(rangeId).value = value; }); }
  $('course-season-file-v79').onchange = async event => { const file = event.target.files?.[0]; if (!file) return; try { assertShared(); if (file.size > 256_000_000) throw Error('256MB以下の成績帳JSONを選んでください。'); const raw = JSON.parse(await file.text()); assertShared(); client.replaceValidated(raw); refreshSeason(); say('成績帳JSONを検証して読み込みました。'); } catch (error) { say(error.message, true); } finally { event.target.value = ''; } };
  document.addEventListener('kneekura:maker-roster-change', () => { if (committing) return; trial = null; refresh(); });
  client.subscribe(() => { guarded(refreshSeason); });
  root.KneekuraBatterMakerV79 = Object.freeze({ inspect, show, selectPlayer, getProfile, setProfile: raw => { assertShared(); return commitProfile(raw); }, getSeasonClient: () => client, assertNoPending, assertRosterImport: () => { if (!committing) assertNoPending(); }, runTrial });
  refresh(); say('選手を選んでコースまたは方向を編集できます。表示しただけでは新設定を付与しません。');
})(globalThis);
