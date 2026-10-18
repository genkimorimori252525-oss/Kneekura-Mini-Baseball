(() => {
  'use strict';
  const $ = id => document.getElementById(id), core = globalThis.KneekuraBaseballWorkbench;
  const canvas = $('maker-scene'), context = canvas.getContext('2d');
  const clone = value => JSON.parse(JSON.stringify(value));
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const set = (object, path, value) => { const keys = path.split('.'); const key = keys.pop(); const parent = keys.reduce((v, k) => v[k], object); parent[key] = value; };
  const scenarioDefaults = { seed: 20261015, pitch: { speedMps: 40, spinRpm: 2200, spinAxis: 'backspin', courseX: 0, courseY: 1 },
    timingOffsetMs: 0, positionOffsetM: 0, throughSeconds: 8 };
  let player, draft, population = [], scenario = clone(scenarioDefaults), result = null, time = 0, duration = 1;
  let playing = false, lastPaint = null, revision = 0, timer, camera = 'side', league = 'NPB';
  const scenarioDirty = new Set();
  let trajectoryPatterns = [], patternsTouched = false, selectedPatternId = '', experimentResult = null, experimentInput = null;
  const liveCatalog = globalThis.KneekuraLiveGameRosterCatalog;
  const livePublicReference = globalThis.KneekuraLivePublicAbilityReference;
  let livePublicControls = [];
  let livePhysicalRoster = null, liveRosterPlayerId = '', liveRosterRevision = 0;
  const liveRosterPending = new Map();
  function validateLiveRoster(raw) {
    if (!liveCatalog?.players?.length || !Array.isArray(liveCatalog.fields) || typeof core.applyLivePhysicalRosterV1 !== 'function')
      throw Error('試合用能力の定義・検証Coreを読み込めませんでした。');
    const proof = core.applyLivePhysicalRosterV1({ players: liveCatalog.players, roster: raw }), packet = clone(raw);
    const ids = liveCatalog.players.map(p => p.playerId);
    if (packet.entries.length !== ids.length || packet.entries.some(e => !ids.includes(e.playerId) || !e.physical || e.workbenchPlayer))
      throw Error('全選手のphysicalを含む試合用能力JSONを選択してください。単体実験用の選手JSONはこの欄へ適用できません。');
    if (livePublicReference) core.projectLivePublicAbilitiesV1({ roster: packet, reference: livePublicReference, playerId: liveRosterPlayerId || ids[0] });
    return { packet, proof };
  }
  function assertLiveRosterEdits() {
    if (liveRosterPending.size) throw Error('試合用能力に未確定の入力があります。選手と項目のエラーを修正してから保存してください。');
    if (livePhysicalRoster) validateLiveRoster(livePhysicalRoster);
  }
  function rosterStatus() {
    const pending = [...liveRosterPending.values()];
    $('live-roster-status').textContent = pending.length ? pending.map(p => `${p.playerName} · ${p.label}: ${p.error}`).join('\n')
      : `${livePhysicalRoster.entries.length}選手 · 入力値の形式・範囲を確認しました。通常試合への反映には「試合用能力JSON」を読み込んでください。`;
    $('live-roster-status').classList.toggle('error', pending.length > 0);
  }
  function publicProjection() {
    return core.projectLivePublicAbilitiesV1({ roster: livePhysicalRoster, reference: livePublicReference, playerId: liveRosterPlayerId });
  }
  function refreshPublicLeague() {
    if (!livePublicReference || !livePhysicalRoster) return;
    const preview = core.previewLivePublicLeagueV1({ roster: livePhysicalRoster, reference: livePublicReference,
      playerId: liveRosterPlayerId, leagueId: $('live-public-league').value });
    $('live-public-league-status').textContent = `${preview.leagueId} · 現在の登録サンプル ${preview.sampleCount}人。リーグ全人口の査定ではありません。`;
    $('live-public-league-preview').replaceChildren();
    for (const metric of preview.metrics) {
      const item = document.createElement('div'); item.className = 'rating';
      const value = document.createElement('strong'); value.textContent = numeric(metric.value) ? metric.value.toLocaleString('ja-JP', { maximumFractionDigits: 1 }) : '未算出';
      item.append(document.createTextNode(`${metric.label}（${metric.sampleCount}人）`), value);
      $('live-public-league-preview').append(item);
    }
  }
  function refreshPublicValues() {
    if (!livePublicReference || !livePhysicalRoster) return;
    const projection = publicProjection();
    for (const control of livePublicControls) {
      const ability = projection.abilities.find(a => a.id === control.abilityId), value = ability?.value;
      const displayed = numeric(value) ? Number(value.toPrecision(12)) : value;
      const pending = liveRosterPending.get(liveRosterPlayerId + ':public:' + control.abilityId);
      control.input.value = pending ? pending.raw : displayed;
      control.input.setCustomValidity(pending?.error ?? '');
      control.rangeNote.textContent = numeric(displayed) && (displayed < ability.min || displayed > ability.max) ? '詳細設定から算出・範囲外' : '';
      control.rangeNote.hidden = control.rangeNote.textContent === '';
    }
    refreshPublicLeague();
  }
  function refreshInternalValues() {
    const entry = livePhysicalRoster.entries.find(e => e.playerId === liveRosterPlayerId);
    for (const input of $('live-roster-fields').querySelectorAll('[data-roster-path]')) {
      const spec = liveCatalog.fields.find(f => f.path === input.dataset.rosterPath), pending = liveRosterPending.get(liveRosterPlayerId + ':' + spec.path);
      input.value = pending ? pending.raw : rosterFieldValue(entry, spec) ?? '';
      input.setCustomValidity(pending?.error ?? '');
    }
  }
  function rosterFieldValue(entry, spec) {
    const authored = get(spec.entryPath ? entry : entry.physical, spec.path);
    if (authored !== undefined || !spec.defaultFrom) return authored ?? spec.default;
    const physical = core.applyLivePhysicalRosterV1({ players: liveCatalog.players, roster: livePhysicalRoster })
      .players.find(p => p.playerId === entry.playerId).physical;
    return get(physical, spec.defaultFrom) * (spec.defaultScale ?? 1);
  }
  function renderPublicAbilities(identity) {
    if (!livePublicReference) return;
    livePublicControls = []; $('live-public-abilities').replaceChildren();
    const projection = publicProjection();
    const pitcher = identity.role === 'P', sections = pitcher ? [['common', '共通'], ['pitcher', '投手'], ['batter', '打者']] : [['common', '共通'], ['batter', '打者'], ['pitcher', '投手']];
    for (const [section, title] of sections) {
      const abilities = projection.abilities.filter(a => a.section === section); if (!abilities.length) continue;
      const secondary = pitcher ? section === 'batter' : section === 'pitcher';
      let container = $('live-public-abilities');
      if (secondary) {
        const details = document.createElement('details'); details.id = 'live-public-secondary'; details.dataset.section = section;
        const summary = document.createElement('summary'); summary.textContent = pitcher ? '投手の打撃能力' : '野手の投球能力';
        container = document.createElement('div'); details.append(summary, container); $('live-public-abilities').append(details);
      } else {
        const heading = document.createElement('h3'); heading.textContent = title; container.append(heading);
      }
      for (const ability of abilities) {
        const wrapper = document.createElement('div'); wrapper.className = 'control';
        const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.min = ability.min; input.max = ability.max;
        input.id = 'public-ability-' + ability.id; input.dataset.publicAbility = ability.id; input.title = ability.note ?? '';
        const label = document.createElement('label'); label.htmlFor = input.id; label.textContent = ability.label + (ability.unit ? ` (${ability.unit})` : '');
        input.oninput = () => {
          const key = liveRosterPlayerId + ':public:' + ability.id;
          try {
            if (input.value === '' || !numeric(Number(input.value))) throw Error('有限の数値を入力してください。');
            const edited = core.editLivePublicAbilityV1({ roster: livePhysicalRoster, reference: livePublicReference,
              playerId: liveRosterPlayerId, abilityId: ability.id, value: Number(input.value) });
            livePhysicalRoster = validateLiveRoster(edited.roster).packet;
            liveRosterPending.delete(key); input.setCustomValidity(''); if (!liveRosterPending.size) clearProblem();
            refreshInternalValues(); refreshPublicValues();
          } catch (error) {
            liveRosterPending.set(key, { raw: input.value, label: ability.label, playerName: identity.name, error: error.message });
            input.setCustomValidity(error.message);
          }
          rosterStatus();
        };
        const rangeNote = document.createElement('p'); rangeNote.className = 'note'; rangeNote.dataset.publicRangeNote = ability.id;
        wrapper.append(label, input, rangeNote); container.append(wrapper); livePublicControls.push({ abilityId: ability.id, input, rangeNote });
      }
    }
    refreshPublicValues();
  }
  function renderLiveRoster() {
    if (!livePhysicalRoster) return;
    const identity = liveCatalog.players.find(p => p.playerId === liveRosterPlayerId), entry = livePhysicalRoster.entries.find(e => e.playerId === liveRosterPlayerId);
    $('live-roster-player').value = liveRosterPlayerId;
    $('live-roster-identity').textContent = [identity.teamName, identity.role, identity.name, identity.playerId].filter(Boolean).join(' · ');
    const container = $('live-roster-fields'); container.replaceChildren();
    for (const [section, title] of [['common', '共通・走塁・守備'], ['batter', '打者'], ['pitcher', '投手']]) {
      const heading = document.createElement('h3'); heading.textContent = title; container.append(heading);
      for (const spec of liveCatalog.fields.filter(f => f.section === section)) {
        const key = liveRosterPlayerId + ':' + spec.path, value = rosterFieldValue(entry, spec);
        const wrapper = document.createElement('div'); wrapper.className = 'control';
        const id = 'live-ability-' + (spec.entryPath ? 'entry-' : '') + spec.path.replaceAll('.', '-');
        const label = document.createElement('label'); label.htmlFor = id; label.textContent = spec.label + (spec.unit ? ` (${spec.unit})` : '');
        const input = document.createElement(spec.type === 'select' ? 'select' : 'input'); input.id = id; input.dataset.rosterPath = spec.path;
        if (spec.type === 'select') for (const option of spec.options ?? []) {
          const item = document.createElement('option'); item.value = option.value; item.textContent = option.label; input.append(item);
        } else {
          input.type = spec.type ?? (typeof value === 'string' ? 'text' : 'number');
          if (input.type === 'number') for (const k of ['min', 'max']) if (spec[k] !== undefined) input[k] = spec[k];
          // Preserve full SI precision; catalog increments never quantize a source value.
          if (input.type === 'number') input.step = 'any';
        }
        const pending = liveRosterPending.get(key); input.value = pending ? pending.raw : value ?? '';
        if (pending) input.setCustomValidity(pending.error);
        input.oninput = () => {
          try {
            if (input.value === '') throw Error('値を入力してください。');
            const next = clone(livePhysicalRoster), selected = next.entries.find(e => e.playerId === liveRosterPlayerId);
            const nextValue = input.type === 'number' ? Number(input.value) : input.value;
            if (input.type === 'number' && !numeric(nextValue)) throw Error('有限の数値を入力してください。');
            set(spec.entryPath ? selected : selected.physical, spec.path, nextValue);
            const priorEntrySuffix = selected.sourceId.match(/(?::maker-edited|:public-edited)+$/)?.[0] ?? '';
            selected.sourceId = selected.sourceId.replace(/(?::maker-edited|:public-edited)+$/, '') + ':maker-edited'
              + (priorEntrySuffix.includes(':public-edited') ? ':public-edited' : '');
            const priorAuthoringSuffix = next.sourceId.match(/(?::maker-edited-r\d+|:public-edited)+$/)?.[0] ?? '';
            next.sourceId = next.sourceId.replace(/(?::maker-edited-r\d+|:public-edited)+$/, '')
              + (priorAuthoringSuffix.includes(':public-edited') ? ':public-edited' : '') + ':maker-edited-r' + (liveRosterRevision + 1);
            const accepted = validateLiveRoster(next); livePhysicalRoster = accepted.packet; liveRosterRevision++;
            liveRosterPending.delete(key); input.setCustomValidity(''); if (!liveRosterPending.size) clearProblem();
            refreshInternalValues(); refreshPublicValues();
          } catch (error) {
            liveRosterPending.set(key, { raw: input.value, label: spec.label, playerName: identity.name, error: error.message });
            input.setCustomValidity(error.message);
          }
          rosterStatus();
        };
        wrapper.append(label, input);
        if (spec.note) { const note = document.createElement('p'); note.className = 'note'; note.textContent = spec.note; wrapper.append(note); }
        container.append(wrapper);
      }
    }
    renderPublicAbilities(identity); rosterStatus();
  }
  function importLiveRoster(raw) {
    const accepted = validateLiveRoster(raw); livePhysicalRoster = accepted.packet; liveRosterPending.clear();
    liveRosterRevision = Math.max(liveRosterRevision, Number(livePhysicalRoster.sourceId.match(/:maker-edited-r(\d+)$/)?.[1] ?? 0));
    if (!livePhysicalRoster.entries.some(e => e.playerId === liveRosterPlayerId)) liveRosterPlayerId = liveCatalog.players[0].playerId;
    renderLiveRoster(); clearProblem();
  }
  function initializeLiveRoster() {
    if (livePublicReference && ['projectLivePublicAbilitiesV1', 'editLivePublicAbilityV1', 'previewLivePublicLeagueV1'].some(key => typeof core[key] !== 'function'))
      throw Error('公開能力の編集Coreを読み込めませんでした。');
    $('live-public-editor').hidden = !livePublicReference;
    $('live-roster-internals').open = !livePublicReference;
    $('live-roster-internals').querySelector('summary').hidden = !livePublicReference;
    if (livePublicReference) $('live-roster-fields').before($('live-roster-note'));
    $('live-public-league').onchange = () => { try { refreshPublicLeague(); clearProblem(); } catch (error) { problem(error); } };
    validateLiveRoster(globalThis.KneekuraLiveGameRosterData);
    const paths = new Set();
    for (const field of liveCatalog.fields) {
      const key = (field.entryPath ? 'entry:' : 'physical:') + field.path;
      if (!['common', 'batter', 'pitcher'].includes(field.section) || !/^[a-zA-Z][\w]*(\.[a-zA-Z][\w]*)*$/.test(field.path) || paths.has(key))
        throw Error('試合用能力の項目定義が重複または不正です。');
      paths.add(key);
    }
    for (const identity of liveCatalog.players) {
      const option = document.createElement('option'); option.value = identity.playerId;
      option.textContent = [identity.teamName, identity.role, identity.name].filter(Boolean).join(' · '); $('live-roster-player').append(option);
      const row = document.createElement('p'); row.textContent = option.textContent; $('live-roster-list').append(row);
    }
    $('live-roster-note').textContent = liveCatalog.notes?.join?.('\n') ?? liveCatalog.notes ?? '個別能力は暫定のSI設定です。実測成績・選手能力の検証済み推定値ではありません。';
    liveRosterPlayerId = liveCatalog.players[0].playerId; importLiveRoster(globalThis.KneekuraLiveGameRosterData);
    $('live-roster-player').onchange = () => { liveRosterPlayerId = $('live-roster-player').value; renderLiveRoster(); };
    $('import-live-roster').onclick = () => $('live-roster-file').click();
    $('live-roster-file').onchange = () => readFile($('live-roster-file').files[0], importLiveRoster);
    $('export-live-roster').onclick = () => { try {
      assertLiveRosterEdits(); const blob = new Blob([JSON.stringify(livePhysicalRoster, null, 2) + '\n'], { type: 'application/json' });
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = '試合用能力.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); clearProblem();
    } catch (error) { problem(error); } };
    if (livePublicReference) tab('player');
  }
  const patternIntents = { grounder: 'ゴロ', liner: 'ライナー', fly: 'フライ', custom: '自由調整' };
  function exactDataFields(raw, required, optional = []) { if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
    const keys = Object.keys(raw), descriptors = Object.getOwnPropertyDescriptors(raw);
    return required.every(key => keys.includes(key)) && keys.every(key => required.includes(key) || optional.includes(key))
      && keys.every(key => 'value' in descriptors[key]); }
  function validatePatternScenario(raw) {
    if (!exactDataFields(raw, ['seed', 'pitch'], ['timingOffsetMs', 'positionOffsetM', 'throughSeconds'])
      || !exactDataFields(raw.pitch, ['speedMps', 'spinRpm', 'spinAxis', 'courseX', 'courseY'])
      || !Number.isSafeInteger(raw.seed)) throw Error('調整パターンの投球設定・seedが不正です。');
    const p = raw.pitch, duration = raw.throughSeconds ?? 8, timing = raw.timingOffsetMs ?? 0, offset = raw.positionOffsetM ?? 0;
    if (![p.speedMps, p.spinRpm, p.courseX, p.courseY, duration, timing, offset].every(numeric)
      || p.speedMps < 10 || p.speedMps > 80 || p.spinRpm < 0 || p.spinRpm > 5000 || Math.abs(p.courseX) > 1.5
      || p.courseY < .2 || p.courseY > 2.5 || duration < 1 || duration > 20 || Math.abs(timing) > 500 || Math.abs(offset) > .5
      || !['backspin', 'topspin', 'sidespin', 'gyro'].includes(p.spinAxis)) throw Error('調整パターンの投球値が範囲外です。');
    return clone(raw);
  }
  function validatePatterns(raw) {
    if (!Array.isArray(raw) || raw.length > 32) throw Error('調整パターンは32件までの配列にしてください。');
    const ids = new Set();
    return raw.map(pattern => {
      if (!exactDataFields(pattern, ['id', 'label', 'intent', 'swing', 'scenario'], ['reference'])
        || typeof pattern.id !== 'string' || !pattern.id || pattern.id.trim() !== pattern.id || pattern.id.length > 80
        || typeof pattern.label !== 'string' || !pattern.label || pattern.label.trim() !== pattern.label || pattern.label.length > 80
        || !Object.hasOwn(patternIntents, pattern.intent) || ids.has(pattern.id)) throw Error('調整パターンのID・名前・目標タグ・形式が不正です。');
      ids.add(pattern.id); const profile = clone(core.defaultWorkbenchPlayer()); profile.capability.maximumSweetSpotSpeedMps = 90; profile.swing = pattern.swing;
      const swing = core.createWorkbenchPlayer(profile).swing, saved = { id: pattern.id, label: pattern.label, intent: pattern.intent,
        swing: clone(swing), scenario: validatePatternScenario(pattern.scenario) };
      if (pattern.reference !== undefined) saved.reference = validateReference(pattern.reference);
      if (JSON.stringify(saved).length > 8192) throw Error('調整パターンが大きすぎます。'); return saved;
    });
  }
  const patternBasis = pattern => pattern?.reference?.mode === 'reference-experiment' ? '参考バット接触研究' : pattern?.reference?.mode === 'reference' ? '参考モーション研究' : 'Core打撃物理試験';
  function refreshPatterns() {
    $('pattern-select').replaceChildren(); const empty = document.createElement('option'); empty.value = ''; empty.textContent = '保存した調整を選択'; $('pattern-select').append(empty);
    for (const pattern of trajectoryPatterns) { const option = document.createElement('option'); option.value = pattern.id; option.textContent = `${pattern.label} · ${patternIntents[pattern.intent]} · ${patternBasis(pattern)}`; $('pattern-select').append(option); }
    if (!trajectoryPatterns.some(pattern => pattern.id === selectedPatternId)) selectedPatternId = '';
    $('pattern-select').value = selectedPatternId; const selected = trajectoryPatterns.find(pattern => pattern.id === selectedPatternId);
    $('pattern-basis').textContent = `現在の基盤：${isExperiment() ? '参考バット接触研究' : isReference() ? '参考モーション研究（球・接触結果なし）' : 'Core打撃物理試験'}${selected ? ` ／ 選択：${patternBasis(selected)}` : ''}`;
    $('pattern-update').disabled = !selected; $('pattern-delete').disabled = !selected; $('pattern-apply').disabled = !selected;
  }
  function capturePattern(id) { readScenario(); return validatePatterns([{ id, label: $('pattern-name').value.trim(), intent: $('pattern-intent').value,
    swing: clone(draft.swing), scenario: clone(scenario), ...(referenceTouched ? { reference: clone(reference) } : {}) }])[0]; }
  const referenceData = globalThis.KneekuraReferenceBatMotions ?? { clips: [] };
  let reference = null, referenceTouched = false, coreReplayTime = 0, coreReplaySpeed = .5, referenceFit = null;
  const isReference = () => reference?.mode === 'reference';
  const isExperiment = () => reference?.mode === 'reference-experiment';
  const isReferenceBased = () => isReference() || isExperiment();
  const physicsResult = () => isExperiment() ? experimentResult : result;
  const defaultExperiment = { startMs: 300, motorRate: .85, translation: { x: 0, y: 0, z: 0 } };
  const referenceClip = () => referenceData.clips.find(clip => clip.id === reference?.clipId);
  const referenceFrames = () => { const clip = referenceClip(), start = Math.round(reference.startTimeSeconds * 1e6), end = Math.round(reference.endTimeSeconds * 1e6);
    return clip.frames.filter(frame => frame.tick >= start && frame.tick <= end); };
  const identityCalibration = { worldYawDeg: 0, flipX: false, flipY: false, flipZ: false,
    localEulerDeg: { x: 0, y: 0, z: 0 }, localOriginOffsetM: { x: 0, y: 0, z: 0 } };
  const calibratedClips = new Map();
  const quaternionProduct = (a, b) => ({ w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w });
  const normalizeQuaternion = q => { const n = Math.hypot(q.w, q.x, q.y, q.z); return { w: q.w / n, x: q.x / n, y: q.y / n, z: q.z / n }; };
  const rotateQuaternion = (q, v) => { const t = cross({ x: q.x, y: q.y, z: q.z }, v), c = cross({ x: q.x, y: q.y, z: q.z }, t);
    return { x: v.x + 2 * (q.w * t.x + c.x), y: v.y + 2 * (q.w * t.y + c.y), z: v.z + 2 * (q.w * t.z + c.z) }; };
  function calibrationInfo(raw = reference?.calibration ?? identityCalibration) {
    const c = clone(raw), angle = c.worldYawDeg * Math.PI / 180, cs = Math.cos(angle), sn = Math.sin(angle);
    const signs = { x: c.flipX ? -1 : 1, y: c.flipY ? -1 : 1, z: c.flipZ ? -1 : 1 }, determinant = signs.x * signs.y * signs.z;
    const axisQuaternion = (axis, degrees) => { const half = degrees * Math.PI / 360; return { w: Math.cos(half), x: axis === 'x' ? Math.sin(half) : 0, y: axis === 'y' ? Math.sin(half) : 0, z: axis === 'z' ? Math.sin(half) : 0 }; };
    const localQuaternion = quaternionProduct(quaternionProduct(axisQuaternion('z', c.localEulerDeg.z), axisQuaternion('y', c.localEulerDeg.y)), axisQuaternion('x', c.localEulerDeg.x));
    const worldYawQuaternion = axisQuaternion('y', c.worldYawDeg);
    const lx = rotateQuaternion(localQuaternion, { x: 1, y: 0, z: 0 }), ly = rotateQuaternion(localQuaternion, { x: 0, y: 1, z: 0 }), lz = rotateQuaternion(localQuaternion, { x: 0, y: 0, z: 1 }), offset = c.localOriginOffsetM;
    return { parameters: c, matrixConvention: 'ROW_MAJOR_COLUMN_VECTOR', localEulerOrder: 'Rz * Ry * Rx; right-multiplied under Source orientation',
      worldMatrix4x4: [[cs * signs.x, 0, sn * signs.z, 0], [0, signs.y, 0, 0], [-sn * signs.x, 0, cs * signs.z, 0], [0, 0, 0, 1]],
      worldDeterminant: determinant, localBasisReflection3x3: [[signs.x, 0, 0], [0, signs.y, 0], [0, 0, signs.z]],
      localAttachmentMatrix4x4: [[lx.x, ly.x, lz.x, offset.x], [lx.y, ly.y, lz.y, offset.y], [lx.z, ly.z, lz.z, offset.z], [0, 0, 0, 1]],
      localQuaternion, worldYawQuaternion, signs,
      composition: 'worldMatrix * (sourceGrip + sourceRotation * (localOriginOffset + localRotation * sourceLocalPoint))',
      quaternionConvention: 'proper rotation plus explicit localBasisReflection; quaternion alone does not encode reflection' };
  }
  const applyWorldMatrix = (m, v) => ({ x: m[0][0] * v.x + m[0][1] * v.y + m[0][2] * v.z,
    y: m[1][0] * v.x + m[1][1] * v.y + m[1][2] * v.z, z: m[2][0] * v.x + m[2][1] * v.y + m[2][2] * v.z });
  function calibrationIsIdentity(c) { return c.worldYawDeg === 0 && !c.flipX && !c.flipY && !c.flipZ
    && Object.values(c.localEulerDeg).every(v => v === 0) && Object.values(c.localOriginOffsetM).every(v => v === 0); }
  function transformedClipFrames(clip) {
    const info = calibrationInfo(); if (calibrationIsIdentity(info.parameters)) return clip.frames;
    const key = clip.id + JSON.stringify(info.parameters); if (calibratedClips.has(key)) return calibratedClips.get(key);
    const frames = clip.frames.map(source => {
      const q = normalizeQuaternion(source.orientation), inverse = { w: q.w, x: -q.x, y: -q.y, z: -q.z };
      const offset = rotateQuaternion(q, info.parameters.localOriginOffsetM), grip = { x: source.grip.x + offset.x, y: source.grip.y + offset.y, z: source.grip.z + offset.z };
      const point = original => { const local = rotateQuaternion(inverse, sub(original, source.grip)), moved = rotateQuaternion(q, rotateQuaternion(info.localQuaternion, local));
        return applyWorldMatrix(info.worldMatrix4x4, { x: grip.x + moved.x, y: grip.y + moved.y, z: grip.z + moved.z }); };
      const attached = quaternionProduct(q, info.localQuaternion), reflected = { w: attached.w,
        x: info.worldDeterminant * info.signs.x * attached.x, y: info.worldDeterminant * info.signs.y * attached.y, z: info.worldDeterminant * info.signs.z * attached.z };
      return { ...source, grip: applyWorldMatrix(info.worldMatrix4x4, grip), tip: point(source.tip), sweetSpot: point(source.sweetSpot),
        orientation: normalizeQuaternion(quaternionProduct(info.worldYawQuaternion, reflected)) };
    });
    frames.forEach((frame, index) => { const a = frames[Math.max(0, index - 1)], b = frames[Math.min(frames.length - 1, index + 1)], seconds = (b.tick - a.tick) / 1e6;
      frame.sweetSpotVelocity = seconds > 0 ? { x: (b.sweetSpot.x - a.sweetSpot.x) / seconds, y: (b.sweetSpot.y - a.sweetSpot.y) / seconds, z: (b.sweetSpot.z - a.sweetSpot.z) / seconds } : { x: 0, y: 0, z: 0 }; });
    calibratedClips.set(key, frames); return frames;
  }
  const referenceMotionFrames = () => { const clip = referenceClip(), start = Math.round(reference.startTimeSeconds * 1e6), end = Math.round(reference.endTimeSeconds * 1e6);
    return transformedClipFrames(clip).filter(frame => frame.tick >= start && frame.tick <= end); };
  const replayStart = () => isReference() ? reference.startTimeSeconds : 0;
  const coreDuration = () => { const actual = physicsResult(); return Math.max(...[...actual.batFrames, ...actual.pitchFrames, ...(actual.flightFrames ?? [])].map(tickOf).filter(numeric)) / 1e6; };
  function defaultReference(mode = 'core') { const clip = referenceData.clips.find(clip => clip.id === referenceData.defaultClipId) ?? referenceData.clips[0];
    return clip ? { mode, clipId: clip.id, startTimeSeconds: clip.timeRange.start, endTimeSeconds: clip.timeRange.end, speed: .5,
      compareClipId: referenceData.clips.some(clip => clip.id === referenceData.comparisonClipId) ? referenceData.comparisonClipId : null } : null; }
  function validateReference(raw) {
    if (typeof raw?.clipId === 'string' && raw.clipId.startsWith('vmd-')) throw Error('旧MMD参照の設定は実測軌道へ自動変換できません。旧HTMLで確認し、新しい実測軌道を選択してください。');
    const keys = ['mode', 'clipId', 'startTimeSeconds', 'endTimeSeconds', 'speed', 'compareClipId', ...(raw?.calibration === undefined ? [] : ['calibration']), ...(raw?.experiment === undefined ? [] : ['experiment'])];
    if (!raw || Object.keys(raw).sort().join('|') !== keys.sort().join('|') || !['core', 'reference', 'reference-experiment'].includes(raw.mode)) throw Error('参考モーション設定の形式が不正です。');
    const clip = referenceData.clips.find(clip => clip.id === raw.clipId);
    if (!clip || !Number.isFinite(raw.startTimeSeconds) || !Number.isFinite(raw.endTimeSeconds)
      || raw.startTimeSeconds < clip.timeRange.start || raw.endTimeSeconds > clip.timeRange.end || raw.startTimeSeconds >= raw.endTimeSeconds
      || ![.1, .25, .5, 1, 2].includes(raw.speed)
      || (raw.compareClipId !== null && !referenceData.clips.some(clip => clip.id === raw.compareClipId))) throw Error('参考モーションの区間・速度・比較指定が不正です。');
    if (!clip.frames.some(frame => frame.tick >= Math.round(raw.startTimeSeconds * 1e6) && frame.tick <= Math.round(raw.endTimeSeconds * 1e6))) throw Error('参考区間にSource標本がありません。');
    if (raw.calibration !== undefined) { const c = raw.calibration;
      if (!c || Object.keys(c).sort().join('|') !== Object.keys(identityCalibration).sort().join('|') || !numeric(c.worldYawDeg) || Math.abs(c.worldYawDeg) > 180
        || ['flipX', 'flipY', 'flipZ'].some(key => typeof c[key] !== 'boolean')) throw Error('参考校正の形式・world回転が不正です。');
      for (const [key, limit] of [['localEulerDeg', 180], ['localOriginOffsetM', 2]]) if (!c[key] || Object.keys(c[key]).sort().join('|') !== 'x|y|z'
        || Object.values(c[key]).some(value => !numeric(value) || Math.abs(value) > limit)) throw Error('参考校正の局所回転・原点が不正です。'); }
    if (raw.experiment !== undefined && (!exactDataFields(raw.experiment, ['startMs', 'motorRate', 'translation'])
      || !numeric(raw.experiment.startMs) || raw.experiment.startMs < 0 || raw.experiment.startMs > 20000
      || !numeric(raw.experiment.motorRate) || raw.experiment.motorRate < .01 || raw.experiment.motorRate > 20
      || !exactDataFields(raw.experiment.translation, ['x', 'y', 'z']) || Object.values(raw.experiment.translation).some(value => !numeric(value) || Math.abs(value) > 20))) throw Error('参考接触試験の開始時刻・世界位置が不正です。');
    return clone(raw.mode === 'reference-experiment' && raw.experiment === undefined ? { ...raw, experiment: defaultExperiment } : raw);
  }
  function calculateReferenceExperiment(profile, pitch, settings, throughSeconds) {
    const frames = referenceMotionFramesFor(settings), flipY = (settings.calibration ?? identityCalibration).flipY;
    const trajectory = { provenance: { clipId: settings.clipId, sourceSha256: referenceData.clips.find(clip => clip.id === settings.clipId).source.sha256 },
      frames: frames.map(frame => ({ tick: frame.tick, grip: clone(frame.grip), orientation: flipY ? quaternionProduct(frame.orientation, { w: 0, x: 1, y: 0, z: 0 }) : clone(frame.orientation) })),
      batLengthM: profile.bat.lengthM, sweetSpotT: profile.bat.sweetSpotT, sourceTicksPerSecond: 1e6, startTick: Math.round((settings.experiment ?? defaultExperiment).startMs * 1000),
      ticksPerSecond: 1e6, playbackRate: (settings.experiment ?? defaultExperiment).motorRate, transform: { rotation: { w: 1, x: 0, y: 0, z: 0 }, translation: clone((settings.experiment ?? defaultExperiment).translation), scale: 1 } };
    const input = { player: clone(profile), pitch: clone(pitch), referenceTrajectory: trajectory, throughSeconds: throughSeconds ?? 8 };
    return { input, result: core.simulateReferenceBattingWorkbench(input) };
  }
  function referenceMotionFramesFor(settings) { const previous = reference; try { reference = settings; return referenceMotionFrames(); } finally { reference = previous; } }
  function runReferenceExperiment() { try { readScenario(); const candidate = core.createWorkbenchPlayer(clone(draft));
    const settings = validateReference({ ...reference, mode: 'reference-experiment', experiment: { startMs: Number($('reference-experiment-start').value), motorRate: Number($('reference-experiment-rate').value),
      translation: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, Number($('reference-experiment-' + axis).value)])) } });
    const proof = calculateReferenceExperiment(candidate, scenario.pitch, settings, scenario.throughSeconds);
    clearTimeout(timer); experimentInput = proof.input; experimentResult = proof.result; reference = settings; referenceTouched = true;
    refreshReference(false); time = proof.result.contact ? Math.max(0, proof.result.contact.tick / 1e6 - .04) : settings.experiment.startMs / 1000; draw(); clearProblem();
  } catch (error) { problem(error); } }
  function refreshReference(resetTime = false) {
    $('trajectory-mode').value = reference?.mode ?? 'core';
    $('reference-controls').hidden = !isReferenceBased(); $('core-bat-controls').hidden = isReferenceBased();
    $('core-trajectory-note').hidden = isReferenceBased();
    $('reference-threeviews').hidden = !isReference(); $('reference-coordinate-legend').hidden = !isReference(); $('reference-provenance').hidden = !isReference();
    $('export-reference').disabled = !isReference();
    if (reference) { const clip = referenceClip(); $('reference-clip').value = reference.clipId; $('reference-compare').value = reference.compareClipId ?? '';
      for (const [id, value] of [['reference-start', reference.startTimeSeconds], ['reference-end', reference.endTimeSeconds]]) {
        $(id).min = clip.timeRange.start; $(id).max = clip.timeRange.end; $(id).value = value; }
      $('reference-note').textContent = 'OpenBiomechanics実測：手元と芯の原標本・原時刻を使用します。ノブ・先端は公称長と公開モデルから推定し、軸まわり回転は未測定です。球・身体・公式結果は再現しません。';
      $('reference-baseline').textContent = `実測基準：${clip.label} ／ 接触時刻 ${clip.contactTimeSeconds}秒。左右とも記録された別試行で、反転生成はしていません。`;
      $('calibration-origin-note').textContent = `芯の原標本を固定した剛体推定です。手元基準点の最大残差 ${(clip.binding.maximumHandResidualM * 1000).toFixed(2)}mm。校正操作は原測定値と分離して保存します。`;
      for (const [id, selected] of [['reference-measured-right', referenceData.defaultClipId], ['reference-measured-left', referenceData.comparisonClipId]]) $(id).setAttribute('aria-pressed', String(clip.id === selected));
      const license = clip.license ?? clip.licenseNotes ?? clip.permissions ?? {};
      const parameters = reference.calibration ?? identityCalibration; $('calibration-world-yaw').value = parameters.worldYawDeg;
      const experiment = reference.experiment ?? defaultExperiment; $('reference-experiment-start').value = experiment.startMs;
      $('reference-experiment-rate').value = experiment.motorRate;
      for (const axis of ['x', 'y', 'z']) $('reference-experiment-' + axis).value = experiment.translation[axis];
      $('reference-experiment-note').textContent = `世界位置は局所ノブ原点オフセットとは別です。手元の軌道を維持し、設定バット長 ${(draft.bat.lengthM * 100).toFixed(1)}cm・芯位置で計算します。長さ変更は届く位置・芯の実速度・接触を変えます。実スイング時間倍率は物理速度を変えます（初期0.85倍）。観測の再生倍率は入力に使いません。能力上限超過は拒否し、値を自動調整しません。投球 ${scenario.pitch.speedMps}m/s・${scenario.pitch.spinRpm}rpm。始動・配置による接触は保証しません。`;
      for (const axis of ['x', 'y', 'z']) { $('calibration-flip-' + axis).checked = parameters['flip' + axis.toUpperCase()];
        $('calibration-local-' + axis).value = parameters.localEulerDeg[axis]; $('calibration-origin-' + axis).value = parameters.localOriginOffsetM[axis]; }
      $('reference-source').textContent = `${clip.source.archive} ／ ${clip.source.motion} ／ ${clip.source.model}\n作者: ${clip.source.author}\n${clip.source.repository}\ncommit: ${clip.source.commit}\nSHA256: ${clip.source.sha256}\n${(clip.assumptions ?? []).join('\n')}\n利用条件: ${typeof license === 'string' ? license : JSON.stringify(license)}\n${referenceData.licenseText}`;
    }
    if (isReference()) { const frames = [...referenceMotionFrames(), ...(reference.compareClipId ? transformedClipFrames(referenceData.clips.find(clip => clip.id === reference.compareClipId)) : [])];
      const low = { x: -.2, y: 0, z: -1.4 }, high = { x: 1.4, y: 1.4, z: 1.4 };
      for (const frame of frames) for (const point of [frame.grip, frame.tip]) for (const axis of ['x', 'y', 'z']) {
        low[axis] = Math.min(low[axis], point[axis]); high[axis] = Math.max(high[axis], point[axis]); }
      referenceFit = { center: { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2, z: (low.z + high.z) / 2 },
        radius: Math.max(.5, Math.hypot(high.x - low.x, high.y - low.y, high.z - low.z) / 2) };
      duration = reference.endTimeSeconds; if (resetTime) time = replayStart(); $('play-speed').value = reference.speed; }
    else if (physicsResult()) { duration = coreDuration(); if (resetTime) time = Math.min(duration, coreReplayTime); $('play-speed').value = coreReplaySpeed;
      if (isExperiment()) { const low = { x: Infinity, y: Infinity, z: Infinity }, high = { x: -Infinity, y: -Infinity, z: -Infinity };
        for (const frame of experimentResult.batFrames) for (const point of [frame.grip, frame.tip]) for (const axis of ['x', 'y', 'z']) {
          low[axis] = Math.min(low[axis], point[axis]); high[axis] = Math.max(high[axis], point[axis]); }
        referenceFit = { center: { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2, z: (low.z + high.z) / 2 },
          radius: Math.max(.5, Math.hypot(high.x - low.x, high.y - low.y, high.z - low.z) / 2) }; }
    }
    playing = false; lastPaint = null; refreshMetrics(); refreshPatterns(); draw();
  }
  function changeReference(raw) { const next = validateReference(raw); if (next.mode === 'reference-experiment') { const proof = calculateReferenceExperiment(core.createWorkbenchPlayer(clone(draft)), scenario.pitch, next, scenario.throughSeconds); experimentResult = proof.result; experimentInput = proof.input; }
    if (next.mode !== 'core') clearTimeout(timer);
    reference = next; referenceTouched = true; refreshReference(true); clearProblem(); }
  function changeCalibration() { try { const candidate = { worldYawDeg: Number($('calibration-world-yaw').value),
    flipX: $('calibration-flip-x').checked, flipY: $('calibration-flip-y').checked, flipZ: $('calibration-flip-z').checked,
    localEulerDeg: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, Number($('calibration-local-' + axis).value)])),
    localOriginOffsetM: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, Number($('calibration-origin-' + axis).value)])) };
    calibratedClips.clear(); changeReference({ ...reference, calibration: candidate }); clearProblem();
  } catch (error) { problem(error); } }
  const controls = [];
  // The paths below bind only existing, validated WorkbenchPlayer properties.
  // No per-player field is invented or inferred from a display rating.
  const swingSpec = [
    ['swing-speed', 'バット速度', 'swing.speedMps', .1, 90, .5, 'm/s'],
    ['attack-angle', '入射角', 'swing.attackAngleDeg', -25, 45, 1, '°'],
    ['pull-angle', '引っ張り・流し', 'swing.pullAngleDeg', -45, 45, 1, '°'],
    ['contact-depth', '接触の前後', 'swing.contactDepthM', .05, 1, .01, 'm'],
    ['load-angle', '構えの角度', 'swing.loadAngleDeg', -179, -2, 1, '°'],
    ['finish-angle', '振り抜き角度', 'swing.finishAngleDeg', 2, 179, 1, '°'],
    ['hand-travel', '手元の移動', 'swing.handTravelM', 0, .8, .01, 'm'],
  ];
  const identitySpec = [
    ['player-name', '名前', 'identity.name', 'text'], ['player-id', '識別名', 'identity.playerId', 'text'],
    ['player-league', '所属リーグ', 'identity.leagueId', 'select', [['CUSTOM', 'CUSTOM'], ['NPB', 'NPB'], ['MLB', 'MLB'], ['NLB', 'NLB'], ['KBO', 'KBO']]],
    ['bats', '打ち方', 'identity.bats', 'select', [['R', '右'], ['L', '左']]],
    ['throws', '投げ方', 'identity.throws', 'select', [['R', '右'], ['L', '左']]],
    ['body-height', '身長', 'body.heightMeters', 'number', .8, 3, .01, 'm'],
    ['body-mass', '体重', 'body.massKg', 'number', 15, 300, 1, 'kg'],
    ['maximum-bat-speed', '芯の最大速度', 'capability.maximumSweetSpotSpeedMps', 'number', .1, 90, .5, 'm/s'],
    ['run-speed', '走る速さ', 'capability.runSpeedMps', 'number', .1, 20, .1, 'm/s'],
    ['throw-speed', '送球速度', 'capability.throwSpeedMps', 'number', .1, 80, .1, 'm/s'],
    ['player-pitch-speed', '投球速度', 'capability.pitchSpeedMps', 'number', .1, 80, .1, 'm/s'],
    ['reaction-time', '動作までの時間', 'capability.motorLatencyTicks', 'number', .001, 2000, 1, 'ms'],
    ['position-error', '位置の誤差', 'capability.positionErrorMeters', 'number', 0, 1, .001, 'm'],
    ['timing-error', 'タイミングの誤差', 'capability.timingErrorTicks', 'number', 0, 500, 1, 'ms'],
  ];
  const advancedSpec = [
    ['judgment', '振る判断の基準', 'decision.threshold', 'number', 0, 1, .05, ''],
    ['aggression', '積極性', 'decision.aggressionWeight', 'number', 0, 1, .05, ''],
    ['approach', '打撃方針', 'decision.approach', 'select', [['AUTO', '判断に任せる'], ['TAKE', '見送る'], ['SWING', '振る']]],
    ['bad-ball-control', '悪球への対応', 'traits.badBallControl', 'number', 0, 1, .05, ''],
    ['technical-timing', '技術的なタイミング補正', 'capability.technicalTimingOffsetTicks', 'number', -500, 500, 1, 'ms'],
    ['bat-mass', 'バット重量', 'bat.massKg', 'number', .05, 3, .01, 'kg'],
    ['sweet-spot', '芯の位置（ノブからの割合）', 'bat.sweetSpotT', 'number', .65, .9, .0001, ''],
    ['traits', '特性の名前（カンマ区切り）', 'traits.labels', 'text'],
  ];
  function problem(error) { $('error-status').hidden = false; $('error-status').textContent = error.message ?? String(error); }
  function clearProblem() { $('error-status').hidden = true; $('error-status').textContent = ''; }
  function createControl(container, spec, range = false) {
    const [id, label, path] = spec, value = get(draft, path);
    if (value === undefined) return;
    const wrapper = document.createElement('div'); wrapper.className = 'control';
    const title = document.createElement('label'); title.htmlFor = id; title.append(document.createTextNode(label));
    const input = document.createElement(range ? 'input' : spec[3] === 'select' ? 'select' : 'input'); input.id = id;
    if (range) { input.type = 'range'; [input.min, input.max] = spec.slice(3, 5); input.step = 'any'; }
    else if (spec[3] === 'select') for (const [key, text] of spec[4]) { const option = document.createElement('option'); option.value = key; option.textContent = text; input.append(option); }
    else { input.type = spec[3]; if (spec[3] === 'number') [input.min, input.max, input.step] = spec.slice(4, 7); }
    const scale = path.endsWith('Ticks') ? 1000 : path === 'bat.lengthM' ? .01 : 1;
    input.value = Array.isArray(value) ? value.join(', ') : numeric(value) ? (path === 'bat.lengthM' ? Number((value / scale).toPrecision(12)) : value / scale) : value;
    const output = document.createElement('output'); title.append(output); wrapper.append(title, input); container.append(wrapper);
    const unit = range ? spec[6] : spec[7] ?? '';
    const update = () => { const displayed = range ? get(draft, path) / scale : Number(input.value);
      output.textContent = unit && numeric(displayed) ? `${displayed.toLocaleString('ja-JP', { maximumFractionDigits: 3 })} ${unit}` : ''; };
    input.addEventListener('input', () => { const next = Array.isArray(value) ? input.value.split(',').map(v => v.trim()).filter(Boolean)
      : input.type === 'range' || input.type === 'number' ? Number(input.value) * scale : input.value;
      set(draft, path, next); update();
      if (path === 'capability.maximumSweetSpotSpeedMps') { refreshSwingSpeedBounds();
        try { core.createWorkbenchPlayer(clone(draft)); clearProblem(); } catch (error) { problem(error); } }
      if (path === 'bat.lengthM') { clearTimeout(timer); timer = setTimeout(() => {
        if (isExperiment()) runReferenceExperiment(); else if (isReference()) draw(); else simulate();
      },120); }
      if (range) scheduleSimulation(); });
    controls.push({ input, output, path, scale, update }); update();
  }
  function refreshSwingSpeedBounds() { const control = controls.find(c => c.path === 'swing.speedMps'), cap = draft.capability.maximumSweetSpotSpeedMps;
    if (control && numeric(cap) && cap >= .1 && cap <= 90) { control.input.min = .1; control.input.max = cap; control.update(); } }
  function refreshControls() { refreshSwingSpeedBounds(); for (const c of controls) { const value = get(draft, c.path), displayed = numeric(value) ? value / c.scale : value;
    if (c.input.type === 'range' && c.path !== 'swing.speedMps') { c.input.min = Math.min(Number(c.input.min), displayed); c.input.max = Math.max(Number(c.input.max), displayed); }
    c.input.value = Array.isArray(value) ? value.join(', ') : c.path === 'bat.lengthM' ? Number(displayed.toPrecision(12)) : displayed; c.update(); } }
  function readScenario() { const pitch = { ...scenario.pitch };
    if (scenarioDirty.has('pitch-speed')) pitch.speedMps = Number($('pitch-speed').value) / 3.6;
    if (scenarioDirty.has('pitch-spin')) pitch.spinRpm = Number($('pitch-spin').value);
    if (scenarioDirty.has('spin-axis')) pitch.spinAxis = $('spin-axis').value;
    if (scenarioDirty.has('course-x')) pitch.courseX = Number($('course-x').value);
    if (scenarioDirty.has('course-y')) pitch.courseY = Number($('course-y').value);
    scenario = { ...scenario, pitch, seed: scenarioDirty.has('seed') ? Number($('seed').value) : scenario.seed,
      timingOffsetMs: scenarioDirty.has('timing') ? Number($('timing').value) : scenario.timingOffsetMs,
      positionOffsetM: scenarioDirty.has('position-offset') ? Number($('position-offset').value) : scenario.positionOffsetM };
    scenarioDirty.clear(); }
  function refreshScenario() { const imported = { 'pitch-speed': scenario.pitch.speedMps * 3.6, 'pitch-spin': scenario.pitch.spinRpm,
      'course-x': scenario.pitch.courseX, 'course-y': scenario.pitch.courseY, timing: scenario.timingOffsetMs ?? 0, 'position-offset': scenario.positionOffsetM ?? 0 };
    for (const [id, value] of Object.entries(imported)) { $(id).min = Math.min(Number($(id).min), value); $(id).max = Math.max(Number($(id).max), value); }
    $('seed').value = scenario.seed; $('pitch-speed').value = scenario.pitch.speedMps * 3.6; $('pitch-spin').value = scenario.pitch.spinRpm;
    $('spin-axis').value = scenario.pitch.spinAxis; $('course-x').value = scenario.pitch.courseX; $('course-y').value = scenario.pitch.courseY;
    $('timing').value = scenario.timingOffsetMs ?? 0; $('position-offset').value = scenario.positionOffsetM ?? 0; scenarioDirty.clear(); refreshOutputs(); }
  function refreshOutputs() { const units = { 'pitch-speed': 'km/h', 'pitch-spin': 'rpm', 'course-x': 'm', 'course-y': 'm', timing: 'ms', 'position-offset': 'm' };
    for (const [id, unit] of Object.entries(units)) document.querySelector(`[data-output="${id}"]`).textContent = `${$(id).value} ${unit}`; }
  function scheduleSimulation() { clearTimeout(timer); timer = setTimeout(simulate, 120); }
  function tickOf(frame) { return frame.tick ?? frame.ball?.tick; }
  function simulate() {
    clearTimeout(timer); readScenario();
    try { const candidate = core.createWorkbenchPlayer(clone(draft)); const calculated = core.simulateBattingWorkbench({ ...clone(scenario), player: candidate });
      if (!Array.isArray(calculated.batFrames) || !Array.isArray(calculated.pitchFrames)) throw Error('軌道を読み込めませんでした。');
      player = candidate; draft = clone(candidate); result = calculated; revision++; playing = false; lastPaint = null;
      duration = Math.max(...[...result.batFrames, ...result.pitchFrames, ...(result.flightFrames ?? [])].map(tickOf).filter(numeric)) / 1e6;
      time = result.contact ? Math.max(0, result.contact.tick / 1e6 - .04) : Math.max(0, result.batFrames[Math.floor(result.batFrames.length / 2)]?.tick / 1e6);
      if (!numeric(time)) time = 0;
      refreshControls(); if (isReference()) refreshReference(true); else refreshMetrics(); refreshPatterns(); preview(); clearProblem(); draw();
    } catch (error) { problem(error); }
  }
  function refreshMetrics() {
    if (isReference()) { const frames = referenceMotionFrames();
      const maximum = Math.max(...frames.map(frame => Math.hypot(frame.sweetSpotVelocity.x, frame.sweetSpotVelocity.y, frame.sweetSpotVelocity.z)));
      $('metric-bat-label').textContent = '参考区間の最大速度'; $('metric-bat').textContent = numeric(maximum) ? maximum.toFixed(1) : '—';
      $('metric-exit').textContent = '—'; $('metric-carry').textContent = '—'; $('result-status').textContent = '参考モーション研究 · OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH';
      $('detail-metrics').textContent = '再生倍率は時間表示だけに適用します。実Coreの打撃入力・速度・衝突・正史には使用していません。'; return; }
    const result = physicsResult(); if (!result) return;
    $('metric-bat-label').textContent = isExperiment() ? '参考軌道の実最大速度' : 'バット速度';
    const m = result.metrics, shown = (value, digits = 1) => numeric(value) ? value.toFixed(digits) : '—';
    $('metric-bat').textContent = shown(m.batSpeedMps); $('metric-exit').textContent = result.contact ? shown(m.exitSpeedMps * 3.6) : '—';
    $('metric-carry').textContent = result.contact ? shown(m.carryM) : '—';
    $('result-status').textContent = result.contact ? `接触 · ノブから ${(result.contact.segmentT * 100).toFixed(1)}% の位置`
      : result.metrics.batSpeedMps > 0 ? '空振り · 球とバットは接触していません。' : '見送り · スイングしていません。';
    $('detail-metrics').textContent = result.contact ? `打ち出し角 ${shown(m.launchAngleDeg)}° ／ 回転 ${shown(m.spinRpm, 0)} rpm ／ 有効回転 ${shown(m.spinEfficiency * 100, 0)}%`
      : (result.diagnostics ?? []).join(' ／ ');
    if (isExperiment()) { $('result-status').textContent = '参考接触研究 · ' + $('result-status').textContent;
      $('detail-metrics').textContent += ' ／ 身体・判断・位置誤差は未適用。反動未連成。Native採用なし・公式結果なし。'; }
  }
  function preview() {
    $('ratings').replaceChildren();
    try { const values = core.previewLeagueRatings(player, clone(population), league);
      if (!values?.available) { $('population-status').textContent = values?.sampleCount ? `${league} · 比較データ ${values.sampleCount}人。評価には異なる実値の選手が2人以上必要です。` : '比較する選手データを読み込んでください。'; return; }
      $('population-status').textContent = `${league} · 比較データ ${values.sampleCount}人`;
      for (const metric of values.metrics) { const item = document.createElement('div'); item.className = 'rating';
        const strong = document.createElement('strong'); strong.textContent = numeric(metric.rating) ? Math.round(metric.rating) : '—';
        item.append(document.createTextNode(metric.label), strong); $('ratings').append(item); }
    } catch (error) { $('population-status').textContent = error.message; }
  }
  const vec = value => value && ['x', 'y', 'z'].every(key => numeric(value[key]));
  const points = value => vec(value) ? [value] : Array.isArray(value) ? value.filter(vec) : value && typeof value === 'object' ? Object.values(value).filter(vec) : [];
  const mix = (a, b, alpha) => ({ x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha, z: a.z + (b.z - a.z) * alpha });
  function pair(frames, tick) { if (!frames?.length) return null; let i = 0; while (i + 1 < frames.length && tickOf(frames[i + 1]) <= tick) i++;
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)]; return { a, b, alpha: tickOf(b) > tickOf(a) ? Math.max(0, Math.min(1, (tick - tickOf(a)) / (tickOf(b) - tickOf(a)))) : 0 }; }
  function sceneFrame() {
    if (isReference()) { const tick = time * 1e6, bat = pair(referenceMotionFrames(), tick)?.a, source = pair(referenceFrames(), tick)?.a, info = calibrationInfo();
      const localAxes = bat ? Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, rotateQuaternion(bat.orientation, { x: axis === 'x' ? info.signs.x : 0, y: axis === 'y' ? info.signs.y : 0, z: axis === 'z' ? info.signs.z : 0 })])) : null;
      // Use the declared source length; rounded source coordinates can differ
      // by nanometres and must not trigger an equipment edit on identity replay.
      const sourceLength = referenceClip().normalization?.batLengthM ?? (bat ? Math.hypot(bat.tip.x-bat.grip.x,bat.tip.y-bat.grip.y,bat.tip.z-bat.grip.z) : null);
      const resized = bat && numeric(draft.bat.lengthM) && draft.bat.lengthM >= .2 && draft.bat.lengthM <= 1.5
        && Math.abs(draft.bat.lengthM-sourceLength) > 1e-10;
      const pointAt = distance => ({x:bat.grip.x+localAxes.y.x*distance,y:bat.grip.y+localAxes.y.y*distance,z:bat.grip.z+localAxes.y.z*distance});
      return { mode: 'reference', authority: referenceData.authority, tick, batSourceTick: bat?.tick ?? null,
        grip: bat?.grip ?? null, tip: resized ? pointAt(draft.bat.lengthM) : bat?.tip ?? null,
        sweetSpot: resized ? pointAt(draft.bat.lengthM*draft.bat.sweetSpotT) : bat?.sweetSpot ?? null, batOrientation: bat?.orientation ?? null,
        localAxes, calibration: info, sourcePose: source ? { grip: source.grip, tip: source.tip, sweetSpot: source.sweetSpot, orientation: source.orientation } : null,
        selectedSourceSeconds: tick / 1e6, sourceTimeSeconds: (source?.tick ?? 0) / 1e6,
        sourceMotionSha256: referenceClip().source.sha256,
        body: null, ball: null, ballSourceTick: null, ballOrientation: null, contact: null, officialResult: null }; }
    const result = physicsResult(); if (!result) return null; const tick = time * 1e6, bat = pair(result.batFrames, tick);
    const pitch = pair(result.pitchFrames, tick), flight = tick >= (result.contact?.tick ?? Infinity) ? pair(result.flightFrames, tick) : null;
    // Body and rigid bat share one actual Core sample. Endpoint interpolation
    // would change bat length during rotation and is deliberately excluded.
    const exactBat = bat?.a, body = exactBat?.body;
    const point = (p, key) => p && vec(p.a[key]) && vec(p.b[key]) ? mix(p.a[key], p.b[key], p.alpha) : null;
    const ball = flight && vec(flight.a.ball?.position) && vec(flight.b.ball?.position)
      ? mix(flight.a.ball.position, flight.b.ball.position, flight.alpha) : point(pitch, 'position');
    return { tick, batSourceTick: exactBat?.tick ?? null, grip: exactBat?.grip ?? null, tip: exactBat?.tip ?? null,
      sweetSpot: exactBat?.sweetSpot ?? null, body, ball, ballSourceTick: tickOf(flight?.a ?? pitch?.a ?? {}),
      ballOrientation: flight?.a.orientation ?? pitch?.a.orientation ?? null,
      ...(isExperiment() ? { mode: 'reference-experiment', authority: result.authority, nativeAdmission: false, officialResult: null } : {}) };
  }
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
  const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
  const unit = a => { const n = Math.hypot(a.x, a.y, a.z); return { x: a.x / n, y: a.y / n, z: a.z / n }; };
  const cross = (a, b) => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
  function projector(selectedCamera = camera, width = canvas.width, height = canvas.height, selectedFit = referenceFit) {
    const views = { side: [{ x: -4.2, y: 1.6, z: .65 }, { x: 0, y: 1, z: .3 }],
      catcher: [{ x: 0, y: 1.8, z: -3.7 }, { x: 0, y: .95, z: .55 }],
      pitcher: [{ x: .15, y: 1.7, z: 5 }, { x: 0, y: 1, z: 0 }],
      batter: [{ x: player?.identity.bats === 'L' ? .95 : -.95, y: (get(player, 'body.heightMeters') ?? 1.8) * .91, z: -1.05 }, { x: 0, y: 1, z: 2.4 }],
      overhead: [{ x: 0, y: 6, z: .001 }, { x: 0, y: 0, z: .3 }] };
    let [eye, target] = views[selectedCamera]; const focal = width * .83;
    if (isReferenceBased() && selectedFit) { const direction = unit(sub(eye, target)), distance = selectedFit.radius * (1 + focal / (Math.min(width, height) * .32));
      target = selectedFit.center; eye = { x: target.x + direction.x * distance, y: target.y + direction.y * distance, z: target.z + direction.z * distance }; }
    const forward = unit(sub(target, eye)), right = unit(cross(forward, { x: 0, y: 1, z: 0 })), up = cross(right, forward);
    const project = p => { if (!vec(p)) return null; const rel = sub(p, eye), depth = dot(rel, forward); return depth > .04 ? {
      x: width / 2 + dot(rel, right) * focal / depth, y: height * (isReferenceBased() ? .52 : .56) - dot(rel, up) * focal / depth, scale: focal / depth } : null; };
    project.eye = eye; return project;
  }
  let projectedBat = null, threeViews = null;
  function referenceOverlay(ctx, project, frame, fontSize = 13, compact = false) {
    const line = (a, b, color, width = 2) => { const p = project(a), q = project(b); if (!p || !q) return;
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); };
    const label = (point, text, color, dx = 5, dy = -5) => { const p = project(point); if (!p) return;
      ctx.font = `${fontSize}px sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = '#07100b'; ctx.strokeText(text, p.x + dx, p.y + dy); ctx.fillStyle = color; ctx.fillText(text, p.x + dx, p.y + dy); };
    const origin = { x: 0, y: 0, z: 0 }, colors = { x: '#ff7b76', y: '#9be48d', z: '#77b8ff' };
    if (compact && frame?.grip) { const p = project(frame.grip), ox = 43, oy = ctx.canvas.height - 43;
      for (const axis of ['x', 'y', 'z']) { const end = { x: frame.grip.x + (axis === 'x' ? 1 : 0), y: frame.grip.y + (axis === 'y' ? 1 : 0), z: frame.grip.z + (axis === 'z' ? 1 : 0) }, q = project(end);
        if (!p || !q) continue; const length = Math.hypot(q.x - p.x, q.y - p.y), dx = length > .01 ? (q.x - p.x) / length * 23 : 0, dy = length > .01 ? (q.y - p.y) / length * 23 : 0;
        ctx.strokeStyle = colors[axis]; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + dx, oy + dy); ctx.stroke();
        ctx.fillStyle = colors[axis]; ctx.font = '10px sans-serif'; ctx.fillText(axis.toUpperCase(), ox + dx + 3, oy + dy - 3); }
      ctx.fillStyle = '#b7c3b3'; ctx.fillText('世界方向', 10, ctx.canvas.height - 8);
    } else { for (const axis of ['x', 'y', 'z']) { const end = { x: axis === 'x' ? 1.2 : 0, y: axis === 'y' ? 1.2 : 0, z: axis === 'z' ? 1.2 : 0 };
        line(origin, end, colors[axis], 3); label(end, '世界' + axis.toUpperCase(), colors[axis]); }
      line(origin, { x: 0, y: 0, z: -1.2 }, '#b8bfb0', 2); label({ x: 0, y: 0, z: -1.2 }, '本塁方向 −Z', '#d8dfd2');
      label({ x: 0, y: 0, z: 1.2 }, '投手・外野 +Z', colors.z, 5, 13); }
    if (!frame?.grip) return;
    for (const axis of ['x', 'y', 'z']) { const v = frame.localAxes[axis], end = { x: frame.grip.x + .24 * v.x, y: frame.grip.y + .24 * v.y, z: frame.grip.z + .24 * v.z };
      line(frame.grip, end, colors[axis], 2); label(end, axis.toUpperCase(), colors[axis]); }
    const callout = (point, text, color, dx, dy) => { const p = project(point); if (!p) return;
      const x = Math.max(5, Math.min(ctx.canvas.width - 40, p.x + dx)), y = Math.max(15, Math.min(ctx.canvas.height - 8, p.y + dy));
      ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(x + 8, y - 4); ctx.stroke(); ctx.fillStyle = color; ctx.font = `${fontSize}px sans-serif`; ctx.fillText(text, x, y); };
    callout(frame.grip, 'ノブ', '#f4e0b7', -40, 32); callout(frame.tip, '先端', '#f4e0b7', 16, -22); callout(frame.sweetSpot, '芯', '#f4d06d', 25, 28);
  }
  function drawThreeViews(frame) {
    const views = {}; for (const [id, selectedCamera] of [['front', 'pitcher'], ['side', 'side'], ['overhead', 'overhead']]) {
      const mini = $('reference-view-' + id), ctx = mini.getContext('2d'), currentFit = { center: mix(frame.grip, frame.tip, .5), radius: Math.max(.5, Math.hypot(frame.tip.x - frame.grip.x, frame.tip.y - frame.grip.y, frame.tip.z - frame.grip.z) / 2) }, project = projector(selectedCamera, mini.width, mini.height, currentFit);
      ctx.clearRect(0, 0, mini.width, mini.height); ctx.fillStyle = '#09150d'; ctx.fillRect(0, 0, mini.width, mini.height);
      if (frame.grip && frame.tip) { const a = project(frame.grip), b = project(frame.tip); if (a && b) { ctx.strokeStyle = '#bc8343'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); } }
      referenceOverlay(ctx, project, frame, 12, true); views[id] = { worldGrip: frame.grip, worldTip: frame.tip, grip: project(frame.grip), tip: project(frame.tip) };
    }
    threeViews = { tick: frame.tick, batSourceTick: frame.batSourceTick, views };
  }
  function draw() {
    const result = physicsResult();
    context.clearRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#09150d'; context.fillRect(0, 0, canvas.width, canvas.height);
    const frame = sceneFrame(), project = projector();
    const line = (a, b, color, width = 2) => { const p = project(a), q = project(b); if (!p || !q) return; context.strokeStyle = color; context.lineWidth = width;
      context.beginPath(); context.moveTo(p.x, p.y); context.lineTo(q.x, q.y); context.stroke(); };
    for (let i = -3; i <= 3; i++) { line({ x: i, y: 0, z: -3 }, { x: i, y: 0, z: 7 }, '#233727'); line({ x: -3, y: 0, z: i }, { x: 3, y: 0, z: i }, '#233727'); }
    const plate = [{ x: -.216, y: .002, z: .216 }, { x: .216, y: .002, z: .216 }, { x: .216, y: .002, z: 0 }, { x: 0, y: .002, z: -.216 }, { x: -.216, y: .002, z: 0 }];
    plate.forEach((p, i) => line(p, plate[(i + 1) % plate.length], '#b8bfb0', 3));
    projectedBat = null;
    if (frame) {
      if ($('trail').value === 'yes') {
        const trace = (isReference() ? referenceMotionFrames() : result.batFrames).filter(f => f.tick <= frame.tick).slice(-160);
        for (let i = 1; i < trace.length; i++) line(trace[i - 1].tip, trace[i].tip, '#b18f4466', 2);
        const ballTrace = (isReference() ? [] : frame.tick < (result.contact?.tick ?? Infinity) ? result.pitchFrames : result.flightFrames ?? []).filter(f => tickOf(f) <= frame.tick).slice(-90);
        for (let i = 1; i < ballTrace.length; i++) line(ballTrace[i - 1].position ?? ballTrace[i - 1].ball?.position, ballTrace[i].position ?? ballTrace[i].ball?.position, '#ced8c177', 1.5);
      }
      if (isReference() && reference.compareClipId) { const comparison = transformedClipFrames(referenceData.clips.find(clip => clip.id === reference.compareClipId));
        for (let i = 1; i < comparison.length; i++) line(comparison[i - 1].tip, comparison[i].tip, '#82bbce55', 1); }
      if (frame.body) {
        const shoulders = points(frame.body.shoulders), elbows = points(frame.body.elbows), hands = points(frame.body.hands);
        if (vec(frame.body.torsoCenter) && shoulders.length === 2) line(frame.body.torsoCenter, mix(shoulders[0], shoulders[1], .5), '#71816c', 13);
        if (shoulders.length > 1) line(shoulders[0], shoulders[1], '#a7b69d', 10);
        shoulders.forEach((p, i) => { if (elbows[i]) line(p, elbows[i], '#889781', 8); if (elbows[i] && hands[i]) line(elbows[i], hands[i], '#a5b098', 7); });
      }
      if (frame.grip && frame.tip) {
        const equipment = result.sourceValues?.equipment ?? core.exportWorkbenchPlayerSources(player).equipment;
        const knots = equipment.batPhysical.radiusProfile.knots;
        const spriteDrawn=globalThis.KneekuraBatLengthSprites?.draw(context,{grip:project(frame.grip),tip:project(frame.tip),
          lengthM:Math.hypot(frame.tip.x-frame.grip.x,frame.tip.y-frame.grip.y,frame.tip.z-frame.grip.z),
          maximumRadiusM:Math.max(...knots.map(knot=>knot.radiusM))})??false;
        if (!spriteDrawn && isReference()) line(frame.grip, frame.tip, '#bc8343', 7);
        else if(!spriteDrawn) {
        const radiusAt = t => { let j = 0; while (j + 1 < knots.length && knots[j + 1].t < t) j++;
          const a = knots[j], b = knots[Math.min(j + 1, knots.length - 1)]; return a.radiusM + (b.radiusM - a.radiusM) * (b.t > a.t ? (t - a.t) / (b.t - a.t) : 0); };
        for (let i = 0; i < 24; i++) { const a = mix(frame.grip, frame.tip, i / 24), b = mix(frame.grip, frame.tip, (i + 1) / 24), projected = project(a);
          if (projected) line(a, b, '#bc8343', Math.max(1, radiusAt(i / 24) * projected.scale * 2)); } }
        if (frame.sweetSpot) { const p = project(frame.sweetSpot); if (p) { context.fillStyle = '#f2d07a'; context.beginPath(); context.arc(p.x, p.y, 4, 0, 2 * Math.PI); context.fill(); } }
        projectedBat = { grip: project(frame.grip), tip: project(frame.tip), worldGrip: frame.grip, worldTip: frame.tip };
        const grip = project(frame.grip); if (grip) { context.fillStyle = '#ebd4ae'; context.beginPath(); context.arc(grip.x, grip.y, 7, 0, 2 * Math.PI); context.fill(); } }
      const ball = project(frame.ball); if (ball) {
        const equipment = result.sourceValues?.equipment ?? core.exportWorkbenchPlayerSources(player).equipment;
        const radiusM = equipment.ball.radiusM, radius = Math.max(1.5, ball.scale * radiusM);
        context.fillStyle = '#f7f4e7'; context.beginPath(); context.arc(ball.x, ball.y, radius, 0, Math.PI * 2); context.fill();
        const q = frame.ballOrientation;
        if (q && ['w', 'x', 'y', 'z'].every(key => numeric(q[key]))) {
          const rotate = v => { const axis = { x: q.x, y: q.y, z: q.z }, twice = cross(axis, v), c = cross(axis, twice);
            return { x: v.x + 2 * (q.w * twice.x + c.x), y: v.y + 2 * (q.w * twice.y + c.y), z: v.z + 2 * (q.w * twice.z + c.z) }; };
          let last = null; const towardEye = unit(sub(project.eye, frame.ball));
          for (let i = 0; i <= 80; i++) { const angle = i / 80 * 2 * Math.PI, n = rotate(unit({ x: Math.cos(angle), y: Math.sin(angle), z: .5 * Math.sin(2 * angle) }));
            const surface = { x: frame.ball.x + n.x * radiusM, y: frame.ball.y + n.y * radiusM, z: frame.ball.z + n.z * radiusM };
            if (dot(n, towardEye) <= 0) { last = null; continue; } if (last) line(last, surface, '#aa5649', 1); last = surface;
          }
        }
      }
    }
    if (isReference() && frame) { referenceOverlay(context, project, frame); drawThreeViews(frame);
      $('reference-provenance').textContent = `選択時刻 ${frame.selectedSourceSeconds.toFixed(6)}秒 ／ 原標本 ${frame.sourceTimeSeconds.toFixed(6)}秒（${frame.batSourceTick}µs）\nSource SHA256 ${frame.sourceMotionSha256}\nカメラfitは観測位置だけを変更します。世界座標・選択tickは変更しません。`; }
    else threeViews = null;
    const cameras = { side: '横', batter: '打者', catcher: '捕手', pitcher: '投手', overhead: '俯瞰' };
    $('scene-label').textContent = `${cameras[camera]} · ${isReference() ? '参考モーション（バットのみ）' : isExperiment() ? '参考バット接触研究（身体なし）' : result?.contact && time * 1e6 >= result.contact.tick ? '打球' : '投球とスイング'}`;
    $('scrub').value = Math.round((time - replayStart()) / Math.max(duration - replayStart(), .001) * 1000);
    $('time-label').textContent = isReference() ? `原時刻 ${(time).toFixed(6)}秒 · ${(time - replayStart()).toFixed(3)}秒` : `${time.toFixed(3)}秒`;
    $('play-pause').textContent = playing ? 'Ⅱ 停止' : '▶ 再生';
  }
  function loop(now) { if (playing && result) { if (lastPaint !== null) time += Math.min(.1, (now - lastPaint) / 1000) * Number($('play-speed').value);
      if (time >= duration) { time = duration; playing = false; } draw(); } lastPaint = now; requestAnimationFrame(loop); }
  function state() { return { player: clone(draft), population: clone(population), scenario: clone(scenario), ...(referenceTouched ? { reference: clone(reference) } : {}),
    ...(patternsTouched ? { trajectoryPatterns: clone(trajectoryPatterns) } : {}), ...(livePhysicalRoster ? { livePhysicalRoster: clone(livePhysicalRoster) } : {}) }; }
  function importState(raw) {
    if (!raw || !raw.player || !Array.isArray(raw.population) || !raw.scenario?.pitch) throw Error('選手・比較データ・投球設定を含むJSONを選択してください。');
    const next = core.createWorkbenchPlayer(raw.player), nextScenario = clone(raw.scenario), nextPopulation = raw.population.map(value => core.createWorkbenchPlayer(value));
    core.previewLeagueRatings(next, nextPopulation, league);
    const nextReference = raw.reference === undefined ? null : validateReference(raw.reference);
    const nextPatterns = raw.trajectoryPatterns === undefined ? [] : validatePatterns(raw.trajectoryPatterns);
    const nextRoster = raw.livePhysicalRoster === undefined ? livePhysicalRoster : validateLiveRoster(raw.livePhysicalRoster).packet;
    const experimentProof = nextReference?.mode === 'reference-experiment' ? calculateReferenceExperiment(next, nextScenario.pitch, nextReference, nextScenario.throughSeconds) : null;
    const previous = { player, draft, population, scenario, result, time, duration, revision, reference, referenceTouched, trajectoryPatterns, patternsTouched, selectedPatternId, experimentResult, experimentInput };
    try { const proof = experimentProof ? result : core.simulateBattingWorkbench({ ...nextScenario, player: next });
      draft = clone(next); player = next; population = nextPopulation; scenario = nextScenario; result = proof;
      duration = Math.max(...[...result.batFrames, ...result.pitchFrames, ...(result.flightFrames ?? [])].map(tickOf).filter(numeric)) / 1e6;
      time = result.contact ? Math.max(0, result.contact.tick / 1e6 - .04) : 0; if (!experimentProof) revision++; playing = false;
      reference = nextReference ?? defaultReference(); referenceTouched = raw.reference !== undefined; coreReplayTime = time;
      experimentResult = experimentProof?.result ?? null; experimentInput = experimentProof?.input ?? null;
      trajectoryPatterns = nextPatterns; patternsTouched = raw.trajectoryPatterns !== undefined; selectedPatternId = '';
      refreshScenario(); refreshControls(); $('population-json').value = JSON.stringify(population, null, 2); refreshReference(true); preview(); draw();
      if (nextRoster) importLiveRoster(nextRoster);
    } catch (error) { ({ player, draft, population, scenario, result, time, duration, revision, reference, referenceTouched, trajectoryPatterns, patternsTouched, selectedPatternId, experimentResult, experimentInput } = previous); throw error; }
  }
  async function readFile(file, apply) { if (!file) return; try { apply(JSON.parse(await file.text())); clearProblem(); } catch (error) { problem(error); } }
  function tab(which) { const bat = which === 'bat'; $('tab-bat').setAttribute('aria-selected', String(bat)); $('tab-player').setAttribute('aria-selected', String(!bat)); $('bat-panel').hidden = !bat; $('player-panel').hidden = bat;
    $('maker-layout').classList.toggle('public-player-editor', !!livePublicReference && !bat); }
  $('tab-bat').onclick = () => tab('bat'); $('tab-player').onclick = () => tab('player');
  $('pattern-select').onchange = () => { selectedPatternId = $('pattern-select').value; const selected = trajectoryPatterns.find(pattern => pattern.id === selectedPatternId);
    if (selected) { $('pattern-name').value = selected.label; $('pattern-intent').value = selected.intent; } refreshPatterns(); };
  $('pattern-save').onclick = () => { try { let number = 1; while (trajectoryPatterns.some(pattern => pattern.id === 'trajectory-pattern-' + number)) number++;
    const saved = capturePattern('trajectory-pattern-' + number); trajectoryPatterns = validatePatterns([...trajectoryPatterns, saved]);
    patternsTouched = true; selectedPatternId = saved.id; refreshPatterns(); clearProblem();
  } catch (error) { problem(error); } };
  $('pattern-update').onclick = () => { try { if (!trajectoryPatterns.some(pattern => pattern.id === selectedPatternId)) throw Error('更新する調整を選択してください。');
    const saved = capturePattern(selectedPatternId); trajectoryPatterns = validatePatterns(trajectoryPatterns.map(pattern => pattern.id === selectedPatternId ? saved : pattern));
    patternsTouched = true; refreshPatterns(); clearProblem();
  } catch (error) { problem(error); } };
  $('pattern-delete').onclick = () => { trajectoryPatterns = trajectoryPatterns.filter(pattern => pattern.id !== selectedPatternId); patternsTouched = true; selectedPatternId = ''; refreshPatterns(); };
  $('pattern-apply').onclick = () => { try { const pattern = trajectoryPatterns.find(pattern => pattern.id === selectedPatternId); if (!pattern) throw Error('使用する調整を選択してください。');
    const nextPlayer = core.createWorkbenchPlayer({ ...clone(draft), swing: clone(pattern.swing) }), id = pattern.id;
    if (['reference', 'reference-experiment'].includes(pattern.reference?.mode)) { const nextReference = validateReference(pattern.reference);
      const proof = nextReference.mode === 'reference-experiment' ? calculateReferenceExperiment(nextPlayer, pattern.scenario.pitch, nextReference, pattern.scenario.throughSeconds) : null;
      clearTimeout(timer); if (!isReference()) coreReplayTime = time; draft = clone(nextPlayer); scenario = clone(pattern.scenario);
      experimentResult = proof?.result ?? null; experimentInput = proof?.input ?? null;
      reference = nextReference; referenceTouched = true; refreshScenario(); refreshControls(); refreshReference(true);
    } else { const nextState = { ...state(), player: clone(nextPlayer), scenario: clone(pattern.scenario) };
      if (pattern.reference) nextState.reference = clone(pattern.reference); else delete nextState.reference; importState(nextState); }
    selectedPatternId = id; refreshPatterns(); clearProblem();
  } catch (error) { problem(error); } };
  $('play-pause').onclick = () => { if (time >= duration) time = replayStart(); playing = !playing; lastPaint = null; draw(); };
  $('scrub').oninput = () => { playing = false; time = replayStart() + Number($('scrub').value) / 1000 * (duration - replayStart()); draw(); };
  $('play-speed').onchange = () => { if (isReference()) reference.speed = Number($('play-speed').value); else coreReplaySpeed = Number($('play-speed').value); };
  $('trajectory-mode').onchange = () => { try { if (!reference) throw Error('参考モーションデータがありません。');
    if (!isReference()) { coreReplayTime = time; coreReplaySpeed = Number($('play-speed').value); }
    changeReference({ ...reference, mode: $('trajectory-mode').value }); } catch (error) { problem(error); } };
  $('reference-clip').onchange = () => { try { const clip = referenceData.clips.find(clip => clip.id === $('reference-clip').value);
    changeReference({ ...reference, clipId: clip.id, startTimeSeconds: clip.timeRange.start, endTimeSeconds: clip.timeRange.end }); } catch (error) { problem(error); } };
  for (const id of ['reference-start', 'reference-end', 'reference-compare']) $(id).onchange = () => { try {
    changeReference({ ...reference, startTimeSeconds: Number($('reference-start').value), endTimeSeconds: Number($('reference-end').value), compareClipId: $('reference-compare').value || null });
  } catch (error) { problem(error); } };
  for (const id of ['calibration-world-yaw', ...['x', 'y', 'z'].flatMap(axis => ['calibration-flip-' + axis, 'calibration-local-' + axis, 'calibration-origin-' + axis])]) $(id).onchange = changeCalibration;
  $('calibration-reset').onclick = () => { const { calibration, ...rest } = reference; calibratedClips.clear(); try { changeReference(rest); } catch (error) { problem(error); } };
  $('run-reference-experiment').onclick = runReferenceExperiment;
  for (const [id, clipId] of [['reference-measured-right', referenceData.defaultClipId], ['reference-measured-left', referenceData.comparisonClipId]]) $(id).onclick = () => { try {
    if (clipId === referenceData.comparisonClipId) { changeReference({ ...reference, compareClipId: clipId }); return; }
    const clip = referenceData.clips.find(clip => clip.id === clipId), { calibration, ...rest } = reference;
    changeReference({ ...rest, mode: 'reference', clipId, compareClipId: referenceData.comparisonClipId, startTimeSeconds: clip.timeRange.start, endTimeSeconds: clip.timeRange.end });
  } catch (error) { problem(error); } };
  $('camera').onchange = () => { camera = $('camera').value; draw(); };
  const runCoreTrial = () => { if (isReferenceBased()) { reference.mode = 'core'; refreshReference(false); } simulate(); };
  $('trail').onchange = draw; $('recalculate').onclick = runCoreTrial; $('apply-player').onclick = runCoreTrial;
  for (const id of ['pitch-speed', 'pitch-spin', 'spin-axis', 'course-x', 'course-y', 'timing', 'position-offset', 'seed']) $(id).addEventListener('input', () => { scenarioDirty.add(id); refreshOutputs(); scheduleSimulation(); });
  $('league').onchange = () => { league = $('league').value; preview(); };
  const applyPopulation = raw => { if (!Array.isArray(raw)) throw Error('比較データは選手の配列にしてください。');
    const candidate = raw.map(value => core.createWorkbenchPlayer(value)); core.previewLeagueRatings(player, candidate, league);
    population = clone(candidate); $('population-json').value = JSON.stringify(population, null, 2); preview(); };
  $('add-player-population').onclick = () => { try { const candidate = core.createWorkbenchPlayer(clone(draft));
    const index = population.findIndex(member => member.identity.playerId === candidate.identity.playerId), next = clone(population);
    if (index < 0) next.push(candidate); else next[index] = candidate;
    applyPopulation(next); $('population-authoring-status').textContent = `${candidate.identity.name}を比較集団へ${index < 0 ? '追加' : '更新'}しました（全${population.length}人）。`; clearProblem();
  } catch (error) { problem(error); } };
  $('apply-population').onclick = () => { try { applyPopulation(JSON.parse($('population-json').value)); clearProblem(); } catch (error) { problem(error); } };
  $('import-population').onclick = () => $('population-file').click(); $('population-file').onchange = () => readFile($('population-file').files[0], applyPopulation);
  $('load-json').onclick = () => $('import-file').click(); $('import-file').onchange = () => readFile($('import-file').files[0], importState);
  $('export-reference').onclick = () => { try { if (!isReference()) throw Error('参考モーションを選択してください。');
    const clip = referenceClip(), frames = clone(referenceMotionFrames()), maximum = Math.max(...frames.map(frame => Math.hypot(frame.sweetSpotVelocity.x, frame.sweetSpotVelocity.y, frame.sweetSpotVelocity.z)));
    const selected = { ...clone(clip), schemaVersion: 2, authority: referenceData.authority,
      timeRange: { start: reference.startTimeSeconds, end: reference.endTimeSeconds }, frames, sourceFrames: clone(referenceFrames()), calibration: calibrationInfo(),
      calibrationAuthority: 'MANUAL_REFERENCE_RESEARCH_NOT_CORE_EXECUTION',
      velocityDerivation: calibrationIsIdentity(reference.calibration ?? identityCalibration) ? 'SOURCE_VELOCITY_UNCHANGED' : 'CENTRAL_DIFFERENCE_FULL_SOURCE_CLIP_BEFORE_SELECTION',
      originalClipMetrics: clone(clip.metrics), metrics: { maxSweetSpotSpeedMps: maximum }, metricsScope: 'SELECTED_SOURCE_SAMPLES',
      replaySpeed: reference.speed, contact: null, officialResult: null };
    const blob = new Blob([JSON.stringify(selected, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `参考バット軌道_${clip.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); clearProblem();
  } catch (error) { problem(error); } };
  $('save-json').onclick = () => { try { assertLiveRosterEdits(); readScenario(); const normalized = core.createWorkbenchPlayer(draft);
    if (isExperiment()) calculateReferenceExperiment(normalized, scenario.pitch, reference, scenario.throughSeconds);
    else if (!isReference()) core.simulateBattingWorkbench({ ...scenario, player: normalized });
    const saved = { ...state(), player: clone(normalized) }, blob = new Blob([JSON.stringify(saved, null, 2) + '\n'], { type: 'application/json' }), url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'にーくら選手とバット.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); clearProblem();
  } catch (error) { problem(error); } };
  globalThis.baseballMaker = Object.freeze({ getState: state, importState, getResult: () => clone(result), getFrame: () => clone(sceneFrame()),
    getPhysicsResult: () => clone(physicsResult()), getReferenceExperimentInput: () => clone(isExperiment() ? experimentInput : null),
    getThreeViews: () => clone(threeViews),
    getProjection: () => clone(projectedBat), getRevision: () => revision, seek: seconds => { time = Math.max(replayStart(), Math.min(duration, seconds)); playing = false; draw(); },
    setCamera: value => { if (!['side', 'batter', 'catcher', 'pitcher', 'overhead'].includes(value)) throw Error('unknown camera'); camera = value; $('camera').value = value; draw(); },
    exportSources: () => core.exportWorkbenchPlayerSources(player), importLiveRoster, getLiveRoster: () => clone(livePhysicalRoster),
    getPublicProjection: () => livePublicReference ? clone(publicProjection()) : null });
  if (!core?.defaultWorkbenchPlayer || !core?.simulateBattingWorkbench) { problem(Error('計算用Coreを読み込めませんでした。ビルド済みのメーカーHTMLを開いてください。')); return; }
  try { document.querySelectorAll('input[type=range]').forEach(input => { if (input.id !== 'scrub') input.step = 'any'; });
    const rank = clip => clip.id === referenceData.defaultClipId ? 0 : clip.id === referenceData.comparisonClipId ? 1 : 2;
    reference = defaultReference('reference'); referenceTouched = true;
    for (const clip of [...referenceData.clips].sort((a, b) => rank(a) - rank(b))) for (const id of ['reference-clip', 'reference-compare']) {
      const option = document.createElement('option'); option.value = clip.id;
      option.textContent = clip.label;
      $(id).append(option); }
    player = core.defaultWorkbenchPlayer(); draft = clone(player);
    const measuredDefault = referenceClip(); draft.bat.lengthM = measuredDefault.normalization.batLengthM;
    draft.bat.sweetSpotT = measuredDefault.normalization.sweetSpotT; player = core.createWorkbenchPlayer(clone(draft));
    const equipmentControls=document.createElement('div'); equipmentControls.id='bat-equipment-controls'; $('core-bat-controls').before(equipmentControls);
    createControl(equipmentControls,['bat-length','バット全長','bat.lengthM','number',20,150,.1,'cm']);
    const lengths=document.createElement('div'); lengths.setAttribute('aria-label','バット長の選択');
    for(const cm of [78,84,90]){const button=document.createElement('button');button.type='button';button.id='bat-length-'+cm;button.textContent=cm+'cm';
      button.onclick=()=>{$('bat-length').value=cm;$('bat-length').dispatchEvent(new Event('input',{bubbles:true}));};lengths.append(button);}
    equipmentControls.append(lengths);
    for (const spec of swingSpec) createControl($('swing-controls'), spec, true);
    for (const spec of identitySpec) createControl($('player-controls'), spec); for (const spec of advancedSpec) createControl($('advanced-controls'), spec);
    refreshScenario(); simulate(); initializeLiveRoster(); globalThis.KneekuraBatLengthSprites?.ready.then(draw,problem); requestAnimationFrame(loop);
  } catch (error) { problem(error); }
})();
