(() => {
  'use strict';
  const $ = id => document.getElementById(id), core = globalThis.KneekuraBaseballWorkbench;
  const independentTraits = globalThis.KneekuraIndependentTraitsV77 === true;
  const canvas = $('maker-scene'), context = canvas.getContext('2d');
  const clone = value => JSON.parse(JSON.stringify(value));
  const numeric = value => typeof value === 'number' && Number.isFinite(value);
  const publicRank = value => !numeric(value) ? '未算出' : value < 0 ? '範囲外'
    : value >= 90 ? 'S' : value >= 80 ? 'A' : value >= 70 ? 'B' : value >= 60 ? 'C'
      : value >= 50 ? 'D' : value >= 40 ? 'E' : value >= 20 ? 'F' : 'G';

  const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
  const set = (object, path, value) => { const keys = path.split('.'); const key = keys.pop(); const parent = keys.reduce((v, k) => v[k], object); parent[key] = value; };
  const scenarioDefaults = { seed: 20261015, pitch: { speedMps: 40, spinRpm: 2200, spinAxis: 'backspin', courseX: 0, courseY: 1 },
    timingOffsetMs: 0, positionOffsetM: 0, throughSeconds: 8 };
  let player, draft, population = [], scenario = clone(scenarioDefaults), result = null, time = 0, duration = 1;
  let playing = false, lastPaint = null, revision = 0, timer, camera = 'side', league = 'NPB';
  const previewDisplayDefault = Object.freeze({ zoom: 1, panX: 0, panY: 0 });
  let previewDisplay = { ...previewDisplayDefault };
  const previewOrbitDefault = Object.freeze({ yawRadians: 0, pitchRadians: 0 });
  let previewOrbit = { ...previewOrbitDefault };
  const defaultPreviewDisplay = () => previewDisplay.zoom === 1 && previewDisplay.panX === 0 && previewDisplay.panY === 0;
  function previewDisplayPatch(raw, complete = false) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(raw))) throw Error('拡大表示の設定は数値の組で指定してください。');
    const descriptors = Object.getOwnPropertyDescriptors(raw), keys = Reflect.ownKeys(descriptors);
    if (keys.some(key => typeof key !== 'string' || !['zoom', 'panX', 'panY'].includes(key)
      || !('value' in descriptors[key]) || !descriptors[key].enumerable)
      || complete && keys.length !== 3) throw Error('拡大表示の設定項目が不正です。');
    const patch = {};
    for (const key of keys) {
      const value = descriptors[key].value;
      if (!numeric(value) || (key === 'zoom' ? value < .25 || value > 12 : value < -10 || value > 10))
        throw Error(key === 'zoom' ? '拡大率は0.25〜12倍で指定してください。' : '画面の移動量が範囲外です。');
      patch[key] = value;
    }
    return patch;
  }
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
    let packet = clone(raw);
    if (livePublicReference) packet = clone(core.materializeLivePlateVisionV1({ roster: packet, reference: livePublicReference }).roster);
    const proof = core.applyLivePhysicalRosterV1({ players: liveCatalog.players, roster: packet });
    const ids = liveCatalog.players.map(p => p.playerId);
    if (packet.entries.length !== ids.length || packet.entries.some(e => !ids.includes(e.playerId) || !e.physical || e.workbenchPlayer))
      throw Error('全選手のphysicalを含む試合用能力JSONを選択してください。単体実験用の選手JSONはこの欄へ適用できません。');
    for (const entry of packet.entries) {
      const identity = liveCatalog.players.find(p => p.playerId === entry.playerId);
      const candidates = referenceData.clips.filter(c => c.side === identity.bats
        && (entry.physical.clipId ? c.id === entry.physical.clipId : c.defaultSelection !== false));
      if (!candidates.length) throw Error(identity.name + 'の右打ち・左打ちに合う打ち方を選んでください。');
      const settings = entry.physical.impactTrajectory;
      if (settings && settings.method !== 'whole-arc-target' && candidates.some(c => settings.beforeSeconds > c.contactTimeSeconds - c.frames[0].tick / 1e6 + 1e-12
        || settings.afterSeconds > c.frames.at(-1).tick / 1e6 - c.contactTimeSeconds + 1e-12))
        throw Error(identity.name + 'の打ち方には、指定した前後の時間の記録がありません。時間を短くしてください。');
    }
    if (livePublicReference) core.projectLivePublicAbilitiesV1({ roster: packet, reference: livePublicReference, playerId: liveRosterPlayerId || ids[0] });
    return { packet, proof };
  }
  function assertLiveRosterEdits() {
    globalThis.KneekuraPitcherMakerV77?.assertNoPending?.();
    globalThis.KneekuraPitchLibraryV78?.assertNoPending?.();
    if (liveRosterPending.size) throw Error('試合用能力に未確定の入力があります。選手と項目のエラーを修正してから保存してください。');
    if (livePhysicalRoster) validateLiveRoster(livePhysicalRoster);
  }
  function rosterStatus() {
    const pending = [...liveRosterPending.values()];
    $('live-roster-status').textContent = pending.length ? pending.map(p => `${p.playerName} · ${p.label}: ${p.error}`).join('\n')
      : `${livePhysicalRoster.entries.length}選手 · 入力値の形式・範囲を確認しました。通常試合への反映には「試合用能力JSON」を読み込んでください。`;
    $('live-roster-status').classList.toggle('error', pending.length > 0);
    document.dispatchEvent(new CustomEvent('kneekura:maker-roster-change', { detail: { playerId: liveRosterPlayerId } }));
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
      const value = document.createElement('strong'); value.textContent = metric.label === '球速' ? (numeric(metric.value) ? metric.value.toLocaleString('ja-JP', { maximumFractionDigits: 1 }) + ' km/h' : '未算出') : publicRank(metric.value)+(metric.value>100?' '+metric.value.toLocaleString('ja-JP',{maximumFractionDigits:2}):'');
      item.append(document.createTextNode(metric.basis === 'ABSOLUTE_1_TO_100' ? `${metric.label}（絶対能力）` : `${metric.label}（${metric.sampleCount}人）`), value);
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
      control.grade.textContent = control.abilityId === 'maxSpeedKmh' ? (numeric(displayed) ? displayed + ' km/h' : '未算出') : publicRank(displayed);
      control.grade.dataset.rank = control.grade.textContent;
      control.input.setCustomValidity(pending?.error ?? '');
      control.rangeNote.textContent = numeric(displayed) && (displayed < ability.min || numeric(ability.max) && displayed > ability.max) ? '詳細設定から算出・範囲外' : '';
      control.rangeNote.hidden = control.rangeNote.textContent === '';
    }
    refreshPublicLeague();
    renderLiveTraits();
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
    if (independentTraits && spec.path === 'badBallControl' && entry.traitProfile?.version === 'live_trait_profile_v2') return entry.traitProfile.selections.find(s => s.familyId === 'bad_ball_hitting')?.source.badBallControl ?? entry.physical?.badBallControl ?? 0;
    const authored = get(spec.entryPath ? entry : entry.physical, spec.path);
    if (authored !== undefined || !spec.defaultFrom) return authored ?? spec.default;
    const physical = core.applyLivePhysicalRosterV1({ players: liveCatalog.players, roster: livePhysicalRoster })
      .players.find(p => p.playerId === entry.playerId).physical;
    return get(physical, spec.defaultFrom) * (spec.defaultScale ?? 1);
  }
  function traitProjection() {
    if (independentTraits) return core.projectLiveTraitProfilesV77({ roster: livePhysicalRoster, playerId: liveRosterPlayerId });
    return core.projectLiveTraitProfilesV1({ roster: livePhysicalRoster, playerId: liveRosterPlayerId,
      ...(globalThis.KneekuraTechnicalTraitsV75 === true ? { includeTechnical: true } : {}) });
  }
  function renderLiveTraits() {
    const panel = $('live-trait-editor'); if (!panel || !livePhysicalRoster) return;
    panel.replaceChildren();
    const heading = document.createElement('h3'); heading.textContent = '得能'; panel.append(heading);
    if (independentTraits) {
      const note = document.createElement('p'); note.className = 'note'; note.textContent = '得能は基礎能力と別の技術・好みです。変更しても公開能力や詳細の基礎値は変わりません。現在の試合で動く得能だけを表示しています。'; panel.append(note);
      if (livePhysicalRoster.entries.some(e => e.traitProfile?.version === 'live_trait_profile_v1')) {
        const button = document.createElement('button'); button.id = 'live-trait-migrate'; button.textContent = '旧得能を独立方式へ変換'; button.dataset.help = '元のJSONは変更しません。送球の変更前の基礎値は残っていないため現在値を維持し、独立送球は未設定にします。緑特は保存された元値へ戻し、技術だけを実行時に適用します。';
        button.onclick = () => { try { assertLiveRosterEdits(); importLiveRoster(core.migrateLiveTraitRosterV77({ roster: livePhysicalRoster }).roster); } catch (error) { problem(error); } }; panel.append(button);
      }
    }
    const colors = { blue: '#2166a5', red: '#a12d36', green: '#27633e', gold: '#805700' };
    const technical = globalThis.KneekuraTechnicalTraitsV75 === true;
    const definitions = independentTraits ? core.getLiveTraitCatalogV77() : core.getLiveTraitCatalogV1(technical ? { includeTechnical: true } : undefined), projection = traitProjection(), identity = liveCatalog.players.find(p => p.playerId === liveRosterPlayerId);
    const sectionOf = id => ['pitch_approach', 'low_zone_command', 'inside_command', 'pitcher_field_reaction'].includes(id) ? 'pitcher'
      : ['bad_ball_hitting', 'plate_aggression', 'swing_mode_preference', 'bunting', 'bat_to_run_transition', 'high_zone_hitting', 'low_zone_hitting'].includes(id) ? 'batter' : 'common';
    const notes = {
      bad_ball_hitting: '窮屈なコースでも狙ったスイングを保つ技術です。悪球を振る積極性とは別です。',
      throw_accuracy: independentTraits ? '送球の際だけ働く技術です。基礎の送球精度や肩力は変わりません。Dは中立、Aや金は方向の誤差を抑え、FやGは誤差が増えます。' : '公開能力の送球精度と同じ値から表示します。段階は作成用の暫定尺度です。',
      inside_command: '内角を狙う投球だけで狙いの誤差を抑えます。基礎の制球・球速・回転は変えません。',
      high_zone_hitting: '高い球を打つときの打撃技術です。一般のミートや選球眼は変わりません。',
      low_zone_hitting: '低い球を打つときの打撃技術です。一般のミートや選球眼は変わりません。',
      pitcher_field_reaction: '投手本人が打球を処理する際の反応技術です。他の野手や送球を受ける動作には作用しません。',
      plate_aggression: '振るか見送るかの積極性です。コースを見分ける選球眼は変わりません。',
      running_aggression: '進塁を試みる積極性です。走力は変わりません。',
      fielding_aggression: '捕球へ向かう積極性です。身体の速さや捕球能力は変わりません。',
      swing_mode_preference: '試合の打撃指示が「選手に任せる」のときに使うスイングの好みです。',
      pitch_approach: '投球を「投手に任せる」ときに使う球種の好みです。明示した球種が優先されます。',
      baserunning: 'ベースを回る経路の選び方に使います。走速や身体の加速度上限は変わりません。低い段階の不利も、倍率に応じて強まります。',
      bunting: 'バントのときだけ、予測した打点への構え、迎球して引く動作、面・位置・時刻の再現性に使います。',
      advanced_fielding: '捕球体勢と、捕球後の持ち替えに使います。一般の走力・肩力・手の速度上限は変わりません。',
      bat_to_run_transition: '打者走者が、打撃から走り出しへ切り替える動作に使います。塁上の走者や最高走速は変わりません。',
      slow_ball_charge: '低速で地面を転がる打球へ前進し、拾う動作に使います。飛球や送球には使いません。',
      low_zone_command: '低めを狙う投球だけ、狙いの誤差に使います。球速・回転・審判の判定や、リリース後の球は変わりません。',
    };
    if (technical) {
      const note = document.createElement('p'); note.id = 'live-trait-technical-note'; note.className = 'note';
      note.textContent = '技術の得能は専用の動作へ反映し、一般能力を書き換えません。OFFまたは0倍では従来の動作になります。段階・倍率は試験用の暫定係数です。ここでの設定はNative側の習得記録を認証するものではありません。';
      panel.append(note);
    }
    const sections = identity.role === 'P' ? [['common', '共通'], ['pitcher', '投手'], ['batter', '投手の打撃の得能']]
      : [['common', '共通'], ['batter', '打者'], ['pitcher', '野手の投球の得能']];
    for (const [section, title] of sections) {
      let container = panel;
      if (identity.role === 'P' ? section === 'batter' : section === 'pitcher') {
        const details = document.createElement('details'); details.dataset.traitSecondary = section;
        const summary = document.createElement('summary'); summary.textContent = title; details.append(summary); panel.append(details); container = details;
      } else { const titleNode = document.createElement('h4'); titleNode.textContent = title; panel.append(titleNode); }
      for (const trait of projection.traits.filter(t => sectionOf(t.familyId) === section)) {
        const definition = definitions.find(d => d.familyId === trait.familyId), editor = definition.editor ?? 'OWNERSHIP';
        const row = document.createElement('div'); row.className = 'control';
        const label = document.createElement('label'); label.htmlFor = 'live-trait-' + trait.familyId; label.textContent = trait.label;
        const select = document.createElement('select'); select.id = label.htmlFor; select.dataset.traitFamily = trait.familyId; select.dataset.traitEditor = editor;
        const options = [...(!independentTraits && trait.status === 'UNASSESSED' && editor !== 'TECHNIQUE' ? [{ stateId: 'UNASSESSED', label: '未査定（現在値を維持）', color: 'neutral' }] : []),
          ...(editor === 'GRADE' && !independentTraits ? [] : [{ stateId: '', label: editor === 'TECHNIQUE' ? 'OFF（従来の動作）' : editor === 'PREFERENCE' ? '設定なし（元の設定）' : '保有なし', color: 'neutral' }]), ...definition.states];
        for (const state of options) {
          const option = document.createElement('option'); option.value = state.stateId; option.textContent = state.label;
          option.style.color = colors[state.color] ?? '#e7e9dd'; select.append(option);
        }
        select.value = !independentTraits && trait.status === 'UNASSESSED' && editor !== 'TECHNIQUE' ? 'UNASSESSED' : trait.stateId ?? '';
        select.style.color = colors[trait.color] ?? '';
        select.onchange = () => {
          if (select.value === 'UNASSESSED') return;
          try {
            assertLiveRosterEdits();
            const request = { roster: livePhysicalRoster, playerId: liveRosterPlayerId, familyId: trait.familyId, stateId: select.value || null };
            if (trait.familyId === 'bad_ball_hitting' && select.value) {
              if (independentTraits) request.source = { badBallControl: trait.sourceValue?.badBallControl ?? livePhysicalRoster.entries.find(e => e.playerId === liveRosterPlayerId)?.physical?.badBallControl ?? .5, effectScale: trait.sourceValue?.effectScale ?? 1 };
              else if (!trait.sourceValue) request.source = { badBallControl: trait.sourceValue ?? 0 };
            }
            if (editor === 'TECHNIQUE' && trait.familyId !== 'bad_ball_hitting') request.source = { effectScale: traitProjection().traits.find(value => value.familyId === trait.familyId)?.sourceValue?.effectScale ?? 1 };
            livePhysicalRoster = validateLiveRoster((independentTraits ? core.setLiveTraitProfileV77(request) : core.setLiveTraitProfileV1(request)).roster).packet;
            renderLiveRoster(); clearProblem();
          } catch (error) { problem(error); renderLiveTraits(); }
        };
        const note = document.createElement('p'); note.className = 'note'; note.textContent = notes[trait.familyId] ?? '';
        row.append(label, select);
        if (editor === 'TECHNIQUE' || independentTraits && ['throw_accuracy', 'bad_ball_hitting', 'plate_aggression', 'running_aggression', 'fielding_aggression'].includes(trait.familyId)) {
          const key = liveRosterPlayerId + ':trait-effect:' + trait.familyId;
          const scaleLabel = document.createElement('label'); scaleLabel.htmlFor = 'live-trait-effect-' + trait.familyId; scaleLabel.textContent = '技術の効果（倍）';
          const input = document.createElement('input'); input.id = scaleLabel.htmlFor; input.type = 'number'; input.min = '0'; input.max = '2'; input.step = '0.05';
          input.dataset.traitEffectScale = trait.familyId;
          input.dataset.help = notes[trait.familyId] + ' 一般能力への追加加算はありません。0倍は技術の効果なし、1倍は選んだ段階の標準、2倍は強めです。OFFまたは0倍では従来動作です。試験用の暫定係数で、Native側の習得認証ではありません。';
          select.dataset.help = notes[trait.familyId] + ' 段階を変更しても「技術の効果（倍）」は維持します。OFFは従来の動作です。';
          const pending = liveRosterPending.get(key);
          input.value = pending ? pending.raw : trait.sourceValue?.effectScale ?? trait.effectiveSourceValue?.effectScale ?? 1;
          input.setCustomValidity(pending?.error ?? '');
          input.oninput = () => {
            try {
              if (input.value === '') throw Error('技術の効果を0〜2倍で入力してください。');
              const value = Number(input.value);
              if (!numeric(value) || value < 0 || value > 2) throw Error('技術の効果は有限の数値で0〜2倍にしてください。');
              const current = traitProjection().traits.find(item => item.familyId === trait.familyId);
              if (value !== (current.sourceValue?.effectScale ?? 1)) {
                const request = { roster: livePhysicalRoster, playerId: liveRosterPlayerId, familyId: trait.familyId,
                  stateId: current.stateId, source: { effectScale: value } };
                livePhysicalRoster = validateLiveRoster((independentTraits ? core.setLiveTraitProfileV77(request) : core.setLiveTraitProfileV1(request)).roster).packet;
              }
              liveRosterPending.delete(key); input.setCustomValidity(''); if (!liveRosterPending.size) clearProblem();
            } catch (error) {
              liveRosterPending.set(key, { raw: input.value, label: trait.label + '・技術の効果（倍）', playerName: identity.name, error: error.message });
              input.setCustomValidity(error.message);
            }
            rosterStatus();
          };
          row.append(scaleLabel, input);
        }
        row.append(note); container.append(row);
      }
    }
    const availability = globalThis.KneekuraLiveTraitAvailabilityCatalog;
    if (availability?.entries && !independentTraits) {
      const details = document.createElement('details'); details.id = 'live-trait-unsupported';
      const entries = availability.entries.filter(e => !definitions.some(d => d.familyId === e.familyId));
      const summary = document.createElement('summary'); summary.textContent = `未対応・対象外の得能（${entries.length}項目）`; details.append(summary);
      const note = document.createElement('p'); note.className = 'note'; note.textContent = 'これらは現在選択できず、試合へ効果を加えません。'; details.append(note);
      const search = document.createElement('input'); search.type = 'search'; search.id = 'live-trait-search'; search.placeholder = '得能名を検索'; search.setAttribute('aria-label', '未対応の得能を検索'); details.append(search);
      const list = document.createElement('div'); list.id = 'live-trait-unsupported-list'; details.append(list);
      for (const entry of entries) {
        const row = document.createElement('div'); row.className = 'control'; row.dataset.unsupportedTrait = entry.familyId;
        row.dataset.traitAvailability = entry.status;
        const title = document.createElement('strong'); title.textContent = entry.label + ' — ' + ({ OUT_OF_SCOPE: '試合能力の対象外', REVIEW_REQUIRED: '仕様確認待ち' }[entry.status] ?? '未対応');
        const reason = document.createElement('p'); reason.className = 'note'; reason.textContent = entry.userReason ?? entry.reason;
        row.append(title, reason); list.append(row);
      }
      search.oninput = () => { const value = search.value.trim().toLocaleLowerCase('ja-JP');
        for (const [index, row] of [...list.children].entries()) row.hidden = ![entries[index].label, ...(entries[index].aliases ?? [])].join(' ').toLocaleLowerCase('ja-JP').includes(value);
      };
      panel.append(details);
    }
  }
  function renderPublicAbilities(identity) {
    if (!livePublicReference) return;
    livePublicControls = []; $('live-public-abilities').replaceChildren();
    const projection = publicProjection();
    if(projection.abilities.some(ability=>ability.max===null)){const note=document.createElement('p');note.id='live-public-authoring-note';note.className='note';
      note.textContent='メーカーでは100を超える実値を編集・保存できます。通常試合の能力表示は100までです。選球眼は絶対能力1〜100、球速は従来の範囲を保ちます。物理の許容範囲を超える値は保存できません。';$('live-public-abilities').append(note);}
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
        const input = document.createElement('input'); input.type = 'number'; input.step = 'any'; input.min = ability.min;if(numeric(ability.max))input.max=ability.max;
        input.id = 'public-ability-' + ability.id; input.dataset.publicAbility = ability.id; input.title = ability.note ?? '';
        if(ability.max===null)input.dataset.help=(ability.note??'')+'。メーカーでは100を超える実値を編集できます。通常試合の能力表示は100までです。関連する物理の許容範囲を超える値は拒否され、前の設定を維持します。';
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
        const grade = document.createElement('output'); grade.className = 'public-grade'; grade.dataset.helpLabel = '能力のランク'; grade.dataset.help = '能力をGからSで表示します。Gは0〜19、Fは20〜39、Eは40〜49、Dは50〜59、Cは60〜69、Bは70〜79、Aは80〜89、Sは90以上。メーカーでは100を超える実値も保存できますが、通常試合の能力表示は100までです。選球眼は1〜100、球速は従来の範囲です。物理の許容範囲を超える設定は拒否されます。';
        wrapper.append(label, grade, input, rangeNote); container.append(wrapper); livePublicControls.push({ abilityId: ability.id, input, rangeNote, grade });
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
        if (spec.path === 'badBallControl' && typeof core.projectLiveTraitProfilesV1 === 'function') {
          input.disabled = traitProjection().traits.find(t => t.familyId === 'bad_ball_hitting')?.owned === false;
          if (input.disabled) input.title = '得能欄で悪球打ちを保有すると、保存した技術強度を編集できます。';
        }
        input.oninput = () => {
          try {
            if (input.value === '') throw Error('値を入力してください。');
            let next = clone(livePhysicalRoster); const selected = next.entries.find(e => e.playerId === liveRosterPlayerId);
            const nextValue = input.type === 'number' ? Number(input.value) : input.value;
            if (input.type === 'number' && !numeric(nextValue)) throw Error('有限の数値を入力してください。');
            const previousValue = get(spec.entryPath ? selected : selected.physical, spec.path);
            if (globalThis.KneekuraPlayerEquipmentPreviewEnabled === true && !spec.entryPath
              && ['batLengthM', 'batMassKg'].includes(spec.path) && nextValue === previousValue) {
              liveRosterPending.delete(key); input.setCustomValidity('');
              refreshInternalValues(); refreshPublicValues(); if (!liveRosterPending.size) clearProblem(); rosterStatus(); return;
            }
            if (independentTraits && !spec.entryPath && spec.path === 'badBallControl') {
              const current = traitProjection().traits.find(t => t.familyId === 'bad_ball_hitting');
              next = core.setLiveTraitProfileV77({ roster: next, playerId: liveRosterPlayerId, familyId: 'bad_ball_hitting', stateId: current.stateId,
                source: { badBallControl: nextValue, effectScale: current.sourceValue?.effectScale ?? 1 } }).roster;
              livePhysicalRoster = validateLiveRoster(next).packet; liveRosterRevision++;
              liveRosterPending.delete(key); input.setCustomValidity(''); if (!liveRosterPending.size) clearProblem();
              refreshInternalValues(); refreshPublicValues(); rosterStatus(); return;
            }
            set(spec.entryPath ? selected : selected.physical, spec.path, nextValue);
            // An explicit sensory-SI edit replaces the linked public authoring
            // source. Recompute absolute vision instead of keeping a stale grade.
            if (!spec.entryPath && spec.path === 'zoneJudgmentStdMeters' && nextValue !== previousValue) delete selected.physical.plateVision;
            const priorEntrySuffix = selected.sourceId.match(/(?::maker-edited|:public-edited)+$/)?.[0] ?? '';
            selected.sourceId = selected.sourceId.replace(/(?::maker-edited|:public-edited)+$/, '') + ':maker-edited'
              + (priorEntrySuffix.includes(':public-edited') ? ':public-edited' : '');
            const priorAuthoringSuffix = next.sourceId.match(/(?::maker-edited-r\d+|:public-edited)+$/)?.[0] ?? '';
            next.sourceId = next.sourceId.replace(/(?::maker-edited-r\d+|:public-edited)+$/, '')
              + (priorAuthoringSuffix.includes(':public-edited') ? ':public-edited' : '') + ':maker-edited-r' + (liveRosterRevision + 1);
            if (!spec.entryPath && typeof core.reconcileLiveTraitSourcesV54 === 'function') next = core.reconcileLiveTraitSourcesV54({ roster: next, playerId: liveRosterPlayerId, changedPaths: [spec.path] });
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
    renderPublicAbilities(identity); renderLiveTraits(); rosterStatus();
  }
  function importLiveRoster(raw) {
    const accepted = validateLiveRoster(raw); livePhysicalRoster = accepted.packet; liveRosterPending.clear();
    liveRosterRevision = Math.max(liveRosterRevision, Number(livePhysicalRoster.sourceId.match(/:(?:maker|swing)-edited-r(\d+)$/)?.[1] ?? 0));
    if (!livePhysicalRoster.entries.some(e => e.playerId === liveRosterPlayerId)) liveRosterPlayerId = liveCatalog.players[0].playerId;
    renderLiveRoster(); clearProblem();
  }
  function initializeLiveRoster() {
    if (livePublicReference && ['projectLivePublicAbilitiesV1', 'editLivePublicAbilityV1', 'previewLivePublicLeagueV1'].some(key => typeof core[key] !== 'function'))
      throw Error('公開能力の編集Coreを読み込めませんでした。');
    if (typeof core.projectLiveTraitProfilesV1 === 'function') {
      const panel = document.createElement('section'); panel.id = 'live-trait-editor';
      $('live-public-editor').after(panel);
    }
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
  // A view choice only. The selected player's saved motion remains owned by
  // setPlayerSwing; legacy research settings and JSON keep their own meaning.
  let playerSwingPreviewActive = false, playerSwingPreviewSpeed = .5, playerSwingPreviewInitialized = false, legacyPreviewClock = null;
  let playerSwingSourceSnapshot = null, playerSwingFramesSnapshot = null;
  const playerSwingSource = () => playerSwingSourceSnapshot ?? (playerSwingSourceSnapshot = globalThis.KneekuraSwingMaker?.getPreviewSource?.() ?? null);
  const playerSwingTick = () => { const source = playerSwingSource(); return Math.max(source.startTick, Math.min(source.endTick, time * 1e6)); };
  const isPlayerSwingPreview = () => playerSwingPreviewActive && playerSwingSource()?.ready === true;
  const isReference = () => isPlayerSwingPreview() || reference?.mode === 'reference';
  const isExperiment = () => !isPlayerSwingPreview() && reference?.mode === 'reference-experiment';
  const isReferenceBased = () => isReference() || isExperiment();
  const physicsResult = () => isExperiment() ? experimentResult : result;
  const defaultExperiment = { startMs: 300, motorRate: .85, translation: { x: 0, y: 0, z: 0 } };
  const referenceClip = () => isPlayerSwingPreview() ? playerSwingSource().clip : referenceData.clips.find(clip => clip.id === reference?.clipId);
  const referenceFrames = () => { const clip = referenceClip(), start = Math.round(reference.startTimeSeconds * 1e6), end = Math.round(reference.endTimeSeconds * 1e6);
    if (isPlayerSwingPreview()) return clip.frames;
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
  function calibrationInfo(raw = isPlayerSwingPreview() ? identityCalibration : reference?.calibration ?? identityCalibration) {
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
    if (isPlayerSwingPreview()) return playerSwingFramesSnapshot ?? (playerSwingFramesSnapshot = globalThis.KneekuraSwingMaker.getPreviewFrames());
    return transformedClipFrames(clip).filter(frame => frame.tick >= start && frame.tick <= end); };
  const replayStart = () => isPlayerSwingPreview() ? playerSwingSource().startTick / 1e6 : isReference() ? reference.startTimeSeconds : 0;
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
  function referenceMotionFramesFor(settings) { const previous = reference, previousPlayerView = playerSwingPreviewActive;
    try { reference = settings; playerSwingPreviewActive = false; return referenceMotionFrames(); }
    finally { reference = previous; playerSwingPreviewActive = previousPlayerView; } }
  function runReferenceExperiment() { try { readScenario(); const candidate = core.createWorkbenchPlayer(clone(draft));
    const settings = validateReference({ ...reference, mode: 'reference-experiment', experiment: { startMs: Number($('reference-experiment-start').value), motorRate: Number($('reference-experiment-rate').value),
      translation: Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, Number($('reference-experiment-' + axis).value)])) } });
    const proof = calculateReferenceExperiment(candidate, scenario.pitch, settings, scenario.throughSeconds);
    clearTimeout(timer); experimentInput = proof.input; experimentResult = proof.result; reference = settings; referenceTouched = true;
    refreshReference(false); time = proof.result.contact ? Math.max(0, proof.result.contact.tick / 1e6 - .04) : settings.experiment.startMs / 1000; draw(); clearProblem();
  } catch (error) { problem(error); } }
  function refreshReference(resetTime = false) {
    if (isPlayerSwingPreview()) {
      const source = playerSwingSource(), frames = referenceMotionFrames(), bounds = globalThis.KneekuraSwingMaker.getPreviewBounds?.(),
        points = bounds?.points ?? frames.flatMap(frame => [frame.grip, frame.tip]),
        low = { x: -.2, y: 0, z: -1.4 }, high = { x: 1.4, y: 1.4, z: 1.4 };
      for (const point of points) for (const axis of ['x', 'y', 'z']) { low[axis] = Math.min(low[axis], point[axis]); high[axis] = Math.max(high[axis], point[axis]); }
      referenceFit = { center: { x: (low.x + high.x) / 2, y: (low.y + high.y) / 2, z: (low.z + high.z) / 2 },
        radius: Math.max(.5, Math.hypot(high.x - low.x, high.y - low.y, high.z - low.z) / 2) };
      duration = source.endTick / 1e6;
      time = resetTime ? source.contactTick / 1e6 : Math.max(source.startTick / 1e6, Math.min(duration, time));
      $('play-speed').value = String(playerSwingPreviewSpeed);
      $('reference-controls').hidden = true; $('core-bat-controls').hidden = true; $('core-trajectory-note').hidden = true;
      $('reference-threeviews').hidden = true; $('reference-coordinate-legend').hidden = false; $('reference-provenance').hidden = false;
      $('export-reference').disabled = true;
      playing = false; lastPaint = null; refreshMetrics(); draw(); return;
    }
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
    playerSwingPreviewActive = false; reference = next; referenceTouched = true; refreshReference(true); clearProblem(); }
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
    ['bat-mass', 'バット重量', 'bat.massKg', 'number', .05, 5, .01, 'kg'],
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
      $('metric-bat-label').textContent = isPlayerSwingPreview() ? '選んだ軌道の最大速度（元測定基準）' : '参考区間の最大速度'; $('metric-bat').textContent = numeric(maximum) ? maximum.toFixed(1) : '—';
      $('metric-exit').textContent = '—'; $('metric-carry').textContent = '—'; $('result-status').textContent = '参考モーション研究 · OPENBIOMECHANICS_MEASURED_BAT_AXIS_RESEARCH';
      $('detail-metrics').textContent = isPlayerSwingPreview()
        ? '選んだ選手の打ち方・弾道です。図は元の測定の長さ・速さで表示します。試合用能力JSONで通常試合へ反映できます。打球は下の同条件比較で計算します。'
        : '再生倍率は時間表示だけに適用します。実Coreの打撃入力・速度・衝突・正史には使用していません。'; return; }
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
        const strong = document.createElement('strong'); strong.textContent = publicRank(metric.rating)+(metric.rating>100?' '+metric.rating.toLocaleString('ja-JP',{maximumFractionDigits:2}):'');
        item.append(document.createTextNode(metric.label), strong); $('ratings').append(item); }
    } catch (error) { $('population-status').textContent = error.message; }
  }
  const vec = value => value && ['x', 'y', 'z'].every(key => numeric(value[key]));
  const points = value => vec(value) ? [value] : Array.isArray(value) ? value.filter(vec) : value && typeof value === 'object' ? Object.values(value).filter(vec) : [];
  const mix = (a, b, alpha) => ({ x: a.x + (b.x - a.x) * alpha, y: a.y + (b.y - a.y) * alpha, z: a.z + (b.z - a.z) * alpha });
  function pair(frames, tick) { if (!frames?.length) return null; let i = 0; while (i + 1 < frames.length && tickOf(frames[i + 1]) <= tick) i++;
    const a = frames[i], b = frames[Math.min(i + 1, frames.length - 1)]; return { a, b, alpha: tickOf(b) > tickOf(a) ? Math.max(0, Math.min(1, (tick - tickOf(a)) / (tickOf(b) - tickOf(a)))) : 0 }; }
  function sceneFrame() {
    if (isPlayerSwingPreview()) {
      const tick = playerSwingTick(), preview = playerSwingSource(), sample = globalThis.KneekuraSwingMaker.sampleAtSourceTick(tick),
        source = pair(preview.clip.frames, tick)?.a, info = calibrationInfo(),
        localAxes = Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, rotateQuaternion(sample.orientation, { x: axis === 'x' ? 1 : 0, y: axis === 'y' ? 1 : 0, z: axis === 'z' ? 1 : 0 })]));
      return { mode: 'player-swing-reference', authority: 'SHARED_REFERENCE_IMPACT_TRAJECTORY_PREVIEW', nativeAdmission: false,
        tick, batSourceTick: sample.sourceTick, grip: clone(sample.state.pose.grip), tip: clone(sample.state.pose.tip),
        sweetSpot: clone(sample.sweetSpot), sweetSpotVelocity: clone(sample.sweetSpotVelocity), batOrientation: clone(sample.orientation),
        localAxes, calibration: info, sourcePose: source ? { grip: clone(source.grip), tip: clone(source.tip), sweetSpot: clone(source.sweetSpot), orientation: clone(source.orientation) } : null,
        selectedSourceSeconds: tick / 1e6, sourceTimeSeconds: (source?.tick ?? 0) / 1e6, sourceMotionSha256: preview.clip.source.sha256,
        playerSwingPreview: { playerId: preview.playerId, clipId: preview.clip.id, level: preview.level, enabled: preview.enabled },
        body: null, ball: null, ballSourceTick: null, ballOrientation: null, contact: null, officialResult: null };
    }
    if (isReference()) { const tick = time * 1e6, bat = pair(referenceMotionFrames(), tick)?.a, source = pair(referenceFrames(), tick)?.a, info = calibrationInfo();
      const localAxes = bat ? Object.fromEntries(['x', 'y', 'z'].map(axis => [axis, rotateQuaternion(bat.orientation, { x: axis === 'x' ? info.signs.x : 0, y: axis === 'y' ? info.signs.y : 0, z: axis === 'z' ? info.signs.z : 0 })])) : null;
      // Use the declared source length; rounded source coordinates can differ
      // by nanometres and must not trigger an equipment edit on identity replay.
      const sourceLength = referenceClip().normalization?.batLengthM ?? (bat ? Math.hypot(bat.tip.x-bat.grip.x,bat.tip.y-bat.grip.y,bat.tip.z-bat.grip.z) : null);
      const resized = bat && numeric(draft.bat.lengthM) && draft.bat.lengthM >= .2 && draft.bat.lengthM <= 3
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
  function projector(selectedCamera = camera, width = canvas.width, height = canvas.height, selectedFit = referenceFit, usePreviewDisplay = false, usePreviewOrbit = usePreviewDisplay) {
    const selectedPlayerId = isPlayerSwingPreview() ? playerSwingSource().playerId : null,
      selectedIdentity = selectedPlayerId ? liveCatalog.players.find(p => p.playerId === selectedPlayerId) : null,
      selectedPhysical = selectedPlayerId ? livePhysicalRoster.entries.find(p => p.playerId === selectedPlayerId)?.physical : null,
      batterHand = selectedIdentity?.bats ?? player?.identity.bats,
      batterHeight = selectedPhysical?.heightMeters ?? selectedIdentity?.heightMeters ?? get(player, 'body.heightMeters') ?? 1.8;
    const views = { side: [{ x: -4.2, y: 1.6, z: .65 }, { x: 0, y: 1, z: .3 }],
      catcher: [{ x: 0, y: 1.8, z: -3.7 }, { x: 0, y: .95, z: .55 }],
      pitcher: [{ x: .15, y: 1.7, z: 5 }, { x: 0, y: 1, z: 0 }],
      batter: [{ x: batterHand === 'L' ? .95 : -.95, y: batterHeight * .91, z: -1.05 }, { x: 0, y: 1, z: 2.4 }],
      overhead: [{ x: 0, y: 6, z: .001 }, { x: 0, y: 0, z: .3 }] };
    let [eye, target] = views[selectedCamera]; const focal = width * .83;
    if (isReferenceBased() && selectedFit) { const direction = unit(sub(eye, target)), distance = selectedFit.radius * (1 + focal / (Math.min(width, height) * .32));
      target = selectedFit.center; eye = { x: target.x + direction.x * distance, y: target.y + direction.y * distance, z: target.z + direction.z * distance }; }
    if (usePreviewOrbit && (previewOrbit.yawRadians !== 0 || previewOrbit.pitchRadians !== 0)) {
      const offset = sub(eye, target), distance = Math.hypot(offset.x, offset.y, offset.z),
        yaw = Math.atan2(offset.x, offset.z) + previewOrbit.yawRadians,
        pitch = Math.max(-Math.PI / 2 + .01, Math.min(Math.PI / 2 - .01, Math.asin(offset.y / distance) + previewOrbit.pitchRadians));
      eye = { x: target.x + distance * Math.cos(pitch) * Math.sin(yaw), y: target.y + distance * Math.sin(pitch),
        z: target.z + distance * Math.cos(pitch) * Math.cos(yaw) };
    }
    const forward = unit(sub(target, eye)), right = unit(cross(forward, { x: 0, y: 1, z: 0 })), up = cross(right, forward);
    const project = p => { if (!vec(p)) return null; const rel = sub(p, eye), depth = dot(rel, forward); if (depth <= .04) return null;
      const projected = { x: width / 2 + dot(rel, right) * focal / depth,
        y: height * (isReferenceBased() ? .52 : .56) - dot(rel, up) * focal / depth, scale: focal / depth };
      if (!usePreviewDisplay || defaultPreviewDisplay()) return projected;
      return { x: width / 2 + (projected.x - width / 2) * previewDisplay.zoom + previewDisplay.panX * width,
        y: height / 2 + (projected.y - height / 2) * previewDisplay.zoom + previewDisplay.panY * height,
        scale: projected.scale * previewDisplay.zoom }; };
    project.eye = eye; return project;
  }
  let projectedBat = null, threeViews = null;
  function refreshPreviewDisplayControls() {
    if ($('preview-zoom')) $('preview-zoom').value = String(previewDisplay.zoom);
    if ($('preview-zoom-value')) $('preview-zoom-value').textContent = previewDisplay.zoom.toFixed(2).replace(/0$/, '').replace(/\.0$/, '') + '倍';
  }
  function setPreviewDisplay(patch) {
    previewDisplay = { ...previewDisplay, ...previewDisplayPatch(patch) };
    refreshPreviewDisplayControls(); draw(); return clone(previewDisplay);
  }
  function setPreviewOrbit(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)
      || ![Object.prototype, null].includes(Object.getPrototypeOf(patch))) throw Error('バットを見る角度は数値で指定してください。');
    const next = { ...previewOrbit };
    for (const key of Reflect.ownKeys(patch)) {
      const descriptor = Object.getOwnPropertyDescriptor(patch, key), limit = key === 'yawRadians' ? Math.PI : Math.PI / 2;
      if (!Object.hasOwn(previewOrbitDefault, key) || !Object.hasOwn(descriptor, 'value')
        || !numeric(descriptor.value) || Math.abs(descriptor.value) > limit) throw Error('バットを見る角度が範囲外です。');
      next[key] = descriptor.value;
    }
    previewOrbit = next; draw(); return clone(previewOrbit);
  }
  function resetPreviewDisplay() { previewOrbit = { ...previewOrbitDefault }; return setPreviewDisplay(previewDisplayDefault); }
  function centerPreviewOnBat() {
    const frame = sceneFrame(), middle = frame?.grip && frame?.tip ? mix(frame.grip, frame.tip, .5) : null,
      projected = middle ? projector(camera, canvas.width, canvas.height, referenceFit, false, true)(middle) : null;
    return setPreviewDisplay(projected ? { panX: -(projected.x / canvas.width - .5) * previewDisplay.zoom,
      panY: -(projected.y / canvas.height - .5) * previewDisplay.zoom } : { panX: 0, panY: 0 });
  }
  function installPreviewDisplayControls() {
    const controls = document.createElement('div'); controls.id = 'maker-preview-display'; controls.className = 'playbar';
    controls.setAttribute('role', 'group'); controls.setAttribute('aria-label', '黒い画面の拡大と移動');
    controls.innerHTML = '<label for="preview-zoom">拡大 <output id="preview-zoom-value">1倍</output></label>'
      + '<button id="preview-zoom-out" type="button" aria-label="黒い画面を縮小">−</button>'
      + '<input id="preview-zoom" type="range" min="0.25" max="12" step="0.05" value="1" aria-label="黒い画面の拡大率" data-help-label="黒い画面の拡大率" data-help="黒い画面だけを0.25〜12倍に拡大・縮小します。球やバットの物理上の大きさ、計算結果は変わりません。ドラッグで見たい場所へ動かせます。">'
      + '<button id="preview-zoom-in" type="button" aria-label="黒い画面を拡大">＋</button>'
      + '<button id="preview-zoom-center" type="button" data-help="今のバットを黒い画面の中央へ移します。拡大率と元の位置・時刻は変わりません。">バットを中央へ</button>'
      + '<button id="preview-zoom-reset" type="button" data-help="黒い画面の角度・拡大率・移動量を初期値へ戻します。選手やバットの道筋は変更しません。">角度と全体表示を戻す</button>';
    canvas.closest('.stage').after(controls);
    const note = document.createElement('p'); note.className = 'note'; note.id = 'maker-preview-display-note';
    note.textContent = '黒い画面は右ボタンでドラッグするとバットを回り込んで見られます。左ドラッグは移動、ホイールは拡大。タッチでは2本指で拡大・縮小できます。'; controls.after(note);
    const clampZoom = value => Math.max(.25, Math.min(12, value)), clampPan = value => Math.max(-10, Math.min(10, value));
    const anchoredZoom = (zoom, pointer) => { const rect = canvas.getBoundingClientRect(), x = (pointer.x - rect.left) / rect.width - .5,
      y = (pointer.y - rect.top) / rect.height - .5, ratio = zoom / previewDisplay.zoom;
      setPreviewDisplay({ zoom, panX: clampPan(x - (x - previewDisplay.panX) * ratio),
        panY: clampPan(y - (y - previewDisplay.panY) * ratio) }); };
    $('preview-zoom').addEventListener('input', () => setPreviewDisplay({ zoom: Number($('preview-zoom').value) }));
    $('preview-zoom-in').onclick = () => setPreviewDisplay({ zoom: clampZoom(previewDisplay.zoom * 1.25) });
    $('preview-zoom-out').onclick = () => setPreviewDisplay({ zoom: clampZoom(previewDisplay.zoom / 1.25) });
    $('preview-zoom-center').onclick = centerPreviewOnBat;
    $('preview-zoom-reset').onclick = resetPreviewDisplay;
    canvas.addEventListener('contextmenu', event => event.preventDefault());
    canvas.style.touchAction = 'none'; canvas.style.cursor = 'grab';
    canvas.addEventListener('wheel', event => { event.preventDefault(); const units = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 300 : 1;
      anchoredZoom(clampZoom(previewDisplay.zoom * Math.exp(-event.deltaY * units * .0015)), { x: event.clientX, y: event.clientY }); }, { passive: false });
    const pointers = new Map(); let gesture = null, orbitDrag = null;
    const begin = () => { const points = [...pointers.values()].slice(0, 2); gesture = points.length ? { points, display: { ...previewDisplay } } : null; };
    canvas.addEventListener('pointerdown', event => {
      if (event.button === 2) {
        if (pointers.size || orbitDrag) return; event.preventDefault();
        orbitDrag = { id: event.pointerId, x: event.clientX, y: event.clientY, orbit: { ...previewOrbit } };
        try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic test events have no native capture. */ }
        canvas.style.cursor = 'move'; return;
      }
      if (orbitDrag) return;
      if (event.button !== 0) return; event.preventDefault(); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      try { canvas.setPointerCapture(event.pointerId); } catch { /* Synthetic test events have no native capture. */ }
      canvas.style.cursor = 'grabbing'; begin();
    });
    canvas.addEventListener('pointermove', event => {
      if (orbitDrag?.id === event.pointerId) {
        event.preventDefault(); const rect = canvas.getBoundingClientRect();
        setPreviewOrbit({ yawRadians: Math.max(-Math.PI, Math.min(Math.PI, orbitDrag.orbit.yawRadians + (event.clientX - orbitDrag.x) / rect.width * 2 * Math.PI)),
          pitchRadians: Math.max(-Math.PI / 2, Math.min(Math.PI / 2, orbitDrag.orbit.pitchRadians + (event.clientY - orbitDrag.y) / rect.height * Math.PI)) }); return;
      }
      if (!pointers.has(event.pointerId) || !gesture) return; event.preventDefault();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const points = [...pointers.values()].slice(0, 2), rect = canvas.getBoundingClientRect();
      if (points.length === 1 && gesture.points.length === 1) setPreviewDisplay({
        panX: clampPan(gesture.display.panX + (points[0].x - gesture.points[0].x) / rect.width),
        panY: clampPan(gesture.display.panY + (points[0].y - gesture.points[0].y) / rect.height) });
      else if (points.length === 2 && gesture.points.length === 2) {
        const center = values => ({ x: (values[0].x + values[1].x) / 2, y: (values[0].y + values[1].y) / 2 }),
          old = center(gesture.points), next = center(points), distance = values => Math.hypot(values[1].x - values[0].x, values[1].y - values[0].y),
          initialDistance = distance(gesture.points);
        if (initialDistance < 1) return;
        const zoom = clampZoom(gesture.display.zoom * distance(points) / initialDistance), ratio = zoom / gesture.display.zoom;
        setPreviewDisplay({ zoom,
          panX: clampPan((next.x - rect.left) / rect.width - .5 - ((old.x - rect.left) / rect.width - .5 - gesture.display.panX) * ratio),
          panY: clampPan((next.y - rect.top) / rect.height - .5 - ((old.y - rect.top) / rect.height - .5 - gesture.display.panY) * ratio) });
      }
    });
    const end = event => { if (orbitDrag?.id === event.pointerId) orbitDrag = null; pointers.delete(event.pointerId); begin(); if (!pointers.size && !orbitDrag) canvas.style.cursor = 'grab'; };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, end);
    refreshPreviewDisplayControls(); rootHelp();
  }
  function rootHelp() { globalThis.KneekuraMakerHelp?.decorate($('maker-preview-display')); }
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
    const frame = sceneFrame(), project = projector(camera, canvas.width, canvas.height, referenceFit, true);
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
      if (isReference() && !isPlayerSwingPreview() && reference.compareClipId) { const comparison = transformedClipFrames(referenceData.clips.find(clip => clip.id === reference.compareClipId));
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
    if (isReference() && frame) { referenceOverlay(context, project, frame); if (!isPlayerSwingPreview()) drawThreeViews(frame); else threeViews = null;
      $('reference-provenance').textContent = `選択時刻 ${frame.selectedSourceSeconds.toFixed(6)}秒 ／ 原標本 ${frame.sourceTimeSeconds.toFixed(6)}秒（${frame.batSourceTick}µs）\nSource SHA256 ${frame.sourceMotionSha256}\nカメラfitは観測位置だけを変更します。世界座標・選択tickは変更しません。`; }
    else threeViews = null;
    const cameras = { side: '横', batter: '打者', catcher: '捕手', pitcher: '投手', overhead: '俯瞰' };
    $('scene-label').textContent = `${cameras[camera]} · ${isPlayerSwingPreview() ? '選んだ選手のバット軌道' : isReference() ? '参考モーション（バットのみ）' : isExperiment() ? '参考バット接触研究（身体なし）' : result?.contact && time * 1e6 >= result.contact.tick ? '打球' : '投球とスイング'}`;
    $('scrub').value = Math.round((time - replayStart()) / Math.max(duration - replayStart(), .001) * 1000);
    $('time-label').textContent = isReference() ? `原時刻 ${(time).toFixed(6)}秒 · ${(time - replayStart()).toFixed(3)}秒` : `${time.toFixed(3)}秒`;
    $('play-pause').textContent = playing ? 'Ⅱ 停止' : '▶ 再生';
    if (isPlayerSwingPreview()) globalThis.KneekuraSwingMaker.syncClock(playerSwingTick(), playing, playerSwingPreviewSpeed);
  }
  function loop(now) { if (playing && result) { if (lastPaint !== null) time += Math.min(.1, (now - lastPaint) / 1000) * Number($('play-speed').value);
      if (time >= duration) { time = duration; playing = false; } draw(); } lastPaint = now; requestAnimationFrame(loop); }
  function state() { return { player: clone(draft), population: clone(population), scenario: clone(scenario), ...(referenceTouched ? { reference: clone(reference) } : {}),
    ...(patternsTouched ? { trajectoryPatterns: clone(trajectoryPatterns) } : {}), ...(livePhysicalRoster ? { livePhysicalRoster: clone(livePhysicalRoster) } : {}),
    ...(defaultPreviewDisplay() ? {} : { previewDisplay: clone(previewDisplay) }),
    ...(globalThis.KneekuraPitchLibraryV78?.exportState()?.records?.length ? { pitchLibrary: clone(globalThis.KneekuraPitchLibraryV78.exportState()) } : {}) }; }
  function importState(raw) {
    if (!raw || !raw.player || !Array.isArray(raw.population) || !raw.scenario?.pitch) throw Error('選手・比較データ・投球設定を含むJSONを選択してください。');
    const pitchLibrary = globalThis.KneekuraPitchLibraryV78,
      nextPitchLibrary = pitchLibrary?.validateState(raw.pitchLibrary ?? { version: 'pitch_library_v78', records: [] }),
      previousPitchLibrary = pitchLibrary?.exportState();
    pitchLibrary?.assertNoPending?.();
    const next = core.createWorkbenchPlayer(raw.player), nextScenario = clone(raw.scenario), nextPopulation = raw.population.map(value => core.createWorkbenchPlayer(value));
    const displayDescriptor = Object.getOwnPropertyDescriptor(raw, 'previewDisplay');
    if (displayDescriptor && !('value' in displayDescriptor)) throw Error('拡大表示の設定は数値で指定してください。');
    const nextPreviewDisplay = displayDescriptor ? previewDisplayPatch(displayDescriptor.value, true) : { ...previewDisplayDefault };
    core.previewLeagueRatings(next, nextPopulation, league);
    const nextReference = raw.reference === undefined ? null : validateReference(raw.reference);
    const nextPatterns = raw.trajectoryPatterns === undefined ? [] : validatePatterns(raw.trajectoryPatterns);
    const nextRoster = raw.livePhysicalRoster === undefined ? livePhysicalRoster : validateLiveRoster(raw.livePhysicalRoster).packet;
    const experimentProof = nextReference?.mode === 'reference-experiment' ? calculateReferenceExperiment(next, nextScenario.pitch, nextReference, nextScenario.throughSeconds) : null;
    const previous = { player, draft, population, scenario, result, time, duration, revision, reference, referenceTouched, trajectoryPatterns, patternsTouched, selectedPatternId, experimentResult, experimentInput, previewDisplay };
    try { const proof = experimentProof ? result : core.simulateBattingWorkbench({ ...nextScenario, player: next });
      draft = clone(next); player = next; population = nextPopulation; scenario = nextScenario; result = proof;
      duration = Math.max(...[...result.batFrames, ...result.pitchFrames, ...(result.flightFrames ?? [])].map(tickOf).filter(numeric)) / 1e6;
      time = result.contact ? Math.max(0, result.contact.tick / 1e6 - .04) : 0; if (!experimentProof) revision++; playing = false;
      reference = nextReference ?? defaultReference(); referenceTouched = raw.reference !== undefined; coreReplayTime = time;
      previewDisplay = nextPreviewDisplay; refreshPreviewDisplayControls();
      experimentResult = experimentProof?.result ?? null; experimentInput = experimentProof?.input ?? null;
      trajectoryPatterns = nextPatterns; patternsTouched = raw.trajectoryPatterns !== undefined; selectedPatternId = '';
      refreshScenario(); refreshControls(); $('population-json').value = JSON.stringify(population, null, 2); refreshReference(true); preview(); draw();
      if (nextRoster) importLiveRoster(nextRoster);
      if (pitchLibrary) pitchLibrary.replaceValidated(nextPitchLibrary);
    } catch (error) { ({ player, draft, population, scenario, result, time, duration, revision, reference, referenceTouched, trajectoryPatterns, patternsTouched, selectedPatternId, experimentResult, experimentInput, previewDisplay } = previous); if (pitchLibrary) pitchLibrary.replaceValidated(previousPitchLibrary); refreshPreviewDisplayControls(); throw error; }
  }
  async function readFile(file, apply) { if (!file) return; try { apply(JSON.parse(await file.text())); clearProblem(); } catch (error) { problem(error); } }
  function tab(which) { const bat = which === 'bat'; $('tab-bat').setAttribute('aria-selected', String(bat)); $('tab-player').setAttribute('aria-selected', String(!bat)); $('bat-panel').hidden = !bat; $('player-panel').hidden = bat;
    if (globalThis.KneekuraBallComparisonLayoutV74 === true && $('ball-comparison-editor')) $('ball-comparison-editor').hidden = !bat;
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
  $('play-speed').onchange = () => { if (isPlayerSwingPreview()) { playerSwingPreviewSpeed = Number($('play-speed').value); draw(); }
    else if (isReference()) reference.speed = Number($('play-speed').value); else coreReplaySpeed = Number($('play-speed').value); };
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
  $('export-reference').onclick = () => { try { if (isPlayerSwingPreview()) throw Error('選手の打ち方と弾道は、試合用能力JSONへ保存してください。');
    if (!isReference()) throw Error('参考モーションを選択してください。');
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
  function setPlayerSwing({ playerId = liveRosterPlayerId, clipId, impactTrajectory } = {}) {
    assertLiveRosterEdits();
    const identity = liveCatalog.players.find(p => p.playerId === playerId);
    if (!identity) throw Error('編集する選手を選んでください。');
    if (clipId !== undefined && clipId !== null) {
      const clip = referenceData.clips.find(c => c.id === clipId);
      if (!clip || clip.side !== identity.bats) throw Error('この選手の右打ち・左打ちに合う打ち方を選んでください。');
    }
    const next = clone(livePhysicalRoster), entry = next.entries.find(e => e.playerId === playerId);
    if (clipId !== undefined) { if (clipId === null) delete entry.physical.clipId; else entry.physical.clipId = clipId; }
    if (impactTrajectory !== undefined) {
      if (impactTrajectory === null) delete entry.physical.impactTrajectory;
      else entry.physical.impactTrajectory = clone(core.validateImpactTrajectorySettingsV1(impactTrajectory));
    }
    if (!entry.sourceId.endsWith(':swing-edited')) entry.sourceId += ':swing-edited';
    const nextRevision = liveRosterRevision + 1;
    next.sourceId = next.sourceId.replace(/:swing-edited-r\d+$/, '') + ':swing-edited-r' + nextRevision;
    const accepted = validateLiveRoster(next); livePhysicalRoster = accepted.packet; liveRosterRevision = nextRevision;
    renderLiveRoster(); clearProblem();
    return clone(entry.physical);
  }
  function getPlayerSwingPreview() {
    const source = playerSwingSource();
    return { active: isPlayerSwingPreview(), ready: source?.ready === true, playerId: source?.playerId ?? null,
      clipId: source?.clip?.id ?? null, level: source?.level ?? null, enabled: source?.enabled ?? false,
      sourceTick: isPlayerSwingPreview() ? playerSwingTick() : time * 1e6, contactTick: source?.contactTick ?? null, startTick: source?.startTick ?? null,
      endTick: source?.endTick ?? null, playing: isPlayerSwingPreview() && playing, speed: playerSwingPreviewSpeed,
      authority: 'SHARED_REFERENCE_IMPACT_TRAJECTORY_PREVIEW', nativeAdmission: false };
  }
  function showPlayerSwingPreview(enabled = true) {
    if (typeof enabled !== 'boolean') throw Error('選手のバット軌道の表示を選んでください。');
    if (enabled && playerSwingSource()?.ready !== true) throw Error('選手のバット軌道を読み込めませんでした。');
    const changed = enabled !== playerSwingPreviewActive;
    if (changed && enabled) legacyPreviewClock = { time, speed: Number($('play-speed').value) };
    playerSwingPreviewInitialized = true; playerSwingPreviewActive = enabled;
    refreshReference(changed && enabled);
    if (!enabled && changed && legacyPreviewClock) {
      time = Math.max(replayStart(), Math.min(duration, legacyPreviewClock.time));
      $('play-speed').value = String(legacyPreviewClock.speed); draw();
    }
    return getPlayerSwingPreview();
  }
  function seekMeasuredPreview(sourceTick) {
    if (!numeric(sourceTick) || sourceTick < 0) throw Error('バットを見る時刻が不正です。');
    if (!isPlayerSwingPreview()) showPlayerSwingPreview(true);
    const source = playerSwingSource(); time = Math.max(source.startTick, Math.min(source.endTick, sourceTick)) / 1e6;
    playing = false; lastPaint = null; draw(); return getPlayerSwingPreview();
  }
  function setMeasuredPreviewPlayback(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw Error('バットの再生設定が不正です。');
    const descriptors = Object.getOwnPropertyDescriptors(patch);
    for (const key of Reflect.ownKeys(descriptors)) if (!['playing', 'speed'].includes(key) || !Object.hasOwn(descriptors[key], 'value')
      || !descriptors[key].enumerable || (key === 'playing' ? typeof descriptors[key].value !== 'boolean' : ![.1, .25, .5, 1, 2].includes(descriptors[key].value)))
      throw Error('バットの再生設定が範囲外です。');
    if (!isPlayerSwingPreview()) showPlayerSwingPreview(true);
    if (Object.hasOwn(patch, 'speed')) { playerSwingPreviewSpeed = patch.speed; $('play-speed').value = String(patch.speed); }
    if (Object.hasOwn(patch, 'playing')) { if (patch.playing && time >= duration) time = replayStart(); playing = patch.playing; }
    lastPaint = null; draw(); return getPlayerSwingPreview();
  }
  document.addEventListener('kneekura:swing-preview-source-change', () => {
    playerSwingSourceSnapshot = null; playerSwingFramesSnapshot = null;
    if (globalThis.KneekuraPlayerSwingPreviewEnabled !== true || playerSwingSource()?.ready !== true) return;
    if (!playerSwingPreviewInitialized && !$('swing-legacy-research')?.open) showPlayerSwingPreview(true);
    else if (playerSwingPreviewActive) refreshReference(false);
  });
  globalThis.baseballMaker = Object.freeze({ getState: state, importState, setPlayerSwing, publicRank, getResult: () => clone(result), getFrame: () => clone(sceneFrame()),
    showPlayerSwingPreview, getPlayerSwingPreview, seekMeasuredPreview, setMeasuredPreviewPlayback,
    getPreviewDisplay: () => clone(previewDisplay), setPreviewDisplay, resetPreviewDisplay, centerPreviewOnBat,
    getPreviewOrbit: () => clone(previewOrbit), setPreviewOrbit,
    getPhysicsResult: () => clone(physicsResult()), getReferenceExperimentInput: () => clone(isExperiment() ? experimentInput : null),
    getThreeViews: () => clone(threeViews),
    getProjection: () => clone(projectedBat), getRevision: () => revision, seek: seconds => { time = Math.max(replayStart(), Math.min(duration, seconds)); playing = false; draw(); },
    setCamera: value => { if (!['side', 'batter', 'catcher', 'pitcher', 'overhead'].includes(value)) throw Error('unknown camera'); camera = value; $('camera').value = value; draw(); },
    exportSources: () => core.exportWorkbenchPlayerSources(player), importLiveRoster, getLiveRoster: () => clone(livePhysicalRoster),
    validateLiveRoster: raw => clone(validateLiveRoster(raw).packet),
    assertCanSave: assertLiveRosterEdits,
    setLivePublicAbility: ({ playerId = liveRosterPlayerId, abilityId, value }) => { assertLiveRosterEdits(); const edited = core.editLivePublicAbilityV1({ roster: livePhysicalRoster, reference: livePublicReference, playerId, abilityId, value }); importLiveRoster(edited.roster); return clone(livePhysicalRoster); },
    getPublicProjection: () => livePublicReference ? clone(publicProjection()) : null,
    getTraitProjection: () => typeof core.projectLiveTraitProfilesV1 === 'function' ? clone(traitProjection()) : null });
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
    createControl(equipmentControls,['bat-length','バット全長','bat.lengthM','number',20,300,.1,'cm']);
    const lengths=document.createElement('div'); lengths.setAttribute('aria-label','バット長の選択');
    for(const cm of [78,84,90]){const button=document.createElement('button');button.type='button';button.id='bat-length-'+cm;button.textContent=cm+'cm';
      button.onclick=()=>{$('bat-length').value=cm;$('bat-length').dispatchEvent(new Event('input',{bubbles:true}));};lengths.append(button);}
    equipmentControls.append(lengths);
    for (const spec of swingSpec) createControl($('swing-controls'), spec, true);
    for (const spec of identitySpec) createControl($('player-controls'), spec); for (const spec of advancedSpec) createControl($('advanced-controls'), spec);
    refreshScenario(); simulate(); initializeLiveRoster(); installPreviewDisplayControls(); globalThis.KneekuraBatLengthSprites?.ready.then(draw,problem); requestAnimationFrame(loop);
  } catch (error) { problem(error); }
})();
