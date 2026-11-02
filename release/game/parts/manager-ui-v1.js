/* Manager-mode match screen (owner-approved design, 2026-11-02), driven by the live match.
   Display and input only: it reads the Core record through window.liveMatchPlayback.inspect() and
   writes the existing instruction controls (#batting-choice, #pitch-choice, #location-choice,
   #baserunning-choice). Nothing is sent to the Core except what those controls already send.
   Parts of the design that have no data or no function yet are not drawn.
   Match flow (manager mode only): the match holds at the first pitch of every plate appearance until the
   manager taps a card or goes on; a card lasts one plate appearance; at most STOPS_PER_GAME stops per game
   (a stop before the plate appearance's first pitch is free); the card effect is playManagerCardFx(cardId).
   A card with hold:true can be kept for the rest of the half inning (scope "このイニング"): the match then does
   not stop between its plate appearances. Settings: "カードの出し方" = stop at every plate appearance, or only
   when the manager stops. */
(function () {
  'use strict';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const GOLD = '#e0b541', CREAM = '#efeee4', LINE = '#7fb08a', DIM = '#3f6a4c';
  const COOL = '#7fa6c4', COOL_DIM = '#2c4a64';
  const POS = { DH: '指', SS: '遊', '1B': '一', '2B': '二', '3B': '三', C: '捕', RF: '右', LF: '左', CF: '中', P: '投' };
  const DATA = JSON.parse($('#match-data').textContent);
  const PLAYERS = Object.assign({ robin: { id: 'robin', name: 'ロビン', bats: 'R', throws: 'R', hand: 'R', number: '' } }, DATA.players);
  const TEAMS = DATA.teams;
  const safe = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- Live match access (read only) ---------- */
  function readView() {
    const playback = window.liveMatchPlayback;
    if (!playback || typeof playback.inspect !== 'function') return null;
    try { return playback.inspect() || null; } catch (error) { return null; }
  }
  /* settled = the records whose result is already on screen; the pitch being prepared or in flight is left out. */
  function live(given) {
    const view = given || readView();
    if (!view || !view.host) return null;
    const history = view.host.history || [];
    return { host: view.host, history, settled: settledHistory(view, !!officialRecord(view)), shown: view.lastResult || history[history.length - 1] || null, selectedRecord: view.lastResult || null, view };
  }

  const managedTeam = () => Number($('#managed-team').value);
  const battingTeam = () => ($('#inning-label').textContent.includes('裏') ? 1 : 0);
  const finished = () => $('#inning-label').textContent.includes('終了');
  const side = () => (battingTeam() === managedTeam() ? 'batter' : 'pitcher');

  function situation() {
    const lit = base => !!$('#bases [data-base="' + base + '"].on');
    return {
      first: lit(1), second: lit(2), third: lit(3),
      outs: $$('#bso .o.on').length,
      batter: $('#batter-name').textContent.replace(/\s+/g, ''),
      pitcher: $('#pitcher-name').textContent.replace(/\s+/g, ''),
      hand: $('#batter-hand').textContent.includes('左') ? 'L' : 'R'
    };
  }

  /* ---------- Pixel diagrams on a 20 x 20 grid ---------- */
  function canvas() {
    const dots = new Map();
    const put = (x, y, color) => dots.set(x + ',' + y, color);
    return {
      put,
      block(x, y, w, h, color) { for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) put(x + i, y + j, color); },
      line(x0, y0, x1, y1, color, step) {
        const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
        let error = dx + dy, x = x0, y = y0, n = 0;
        for (;;) {
          if (!step || n % step === 0) put(x, y, color);
          n += 1;
          if (x === x1 && y === y1) break;
          const e = 2 * error;
          if (e >= dy) { error += dy; x += sx; }
          if (e <= dx) { error += dx; y += sy; }
        }
      },
      paint(ctx) { dots.forEach((color, key) => { const [x, y] = key.split(','); ctx.fillStyle = color; ctx.fillRect(+x, +y, 1, 1); }); },
      svg() {
        let out = '<svg viewBox="0 0 20 20" shape-rendering="crispEdges" aria-hidden="true">';
        dots.forEach((color, key) => {
          const [x, y] = key.split(',');
          out += '<rect x="' + x + '" y="' + y + '" width="1" height="1" fill="' + color + '"/>';
        });
        return out + '</svg>';
      }
    };
  }
  function fan() {
    const c = canvas();
    c.line(10, 18, 2, 10, LINE);
    c.line(10, 18, 18, 10, LINE);
    for (let x = 2; x <= 18; x++) c.put(x, Math.round(10 - 7 * Math.sin(Math.PI * (x - 2) / 16)), DIM);
    [[13, 15], [10, 12], [7, 15]].forEach(([x, y]) => c.put(x, y, LINE));
    c.block(9, 18, 2, 1, CREAM);
    return c;
  }
  function arrow(c, x0, y0, x1, y1, color, step) {
    c.line(x0, y0, x1, y1, color, step);
    c.block(x1 - 1, y1 - 1, 3, 3, color);
  }
  function zone(lit, bright) {
    const c = canvas();
    for (let i = 3; i <= 16; i++) { c.put(i, 3, COOL); c.put(i, 16, COOL); c.put(3, i, COOL); c.put(16, i, COOL); }
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) c.block(5 + col * 4, 5 + row * 4, 3, 3, lit(row, col) ? (bright || GOLD) : COOL_DIM);
    }
    return c;
  }
  /* The card pictures, for the effect that moves them (match-moments-v1.js). */
  globalThis.KneekuraCardArtV1 = Object.freeze({ canvas, fan, zone, arrow, GOLD, CREAM, COOL, pullX: h => pullX(h), oppoX: h => oppoX(h) });
  const innerCol = hand => (hand === 'L' ? 2 : 0);
  const outerCol = hand => (hand === 'L' ? 0 : 2);

  /* Cards exist only where an instruction control exists: ctl = [select id, option value].
     hold: true = the card can be kept for the rest of the half inning; false = it works for one plate appearance only. */
  const pullX = hand => (hand === 'L' ? 17 : 3);
  const oppoX = hand => (hand === 'L' ? 3 : 17);
  const DECK = {
    batter: [
      { id: 'auto', hold: true, name: 'おまかせ', note: '打者の判断に任せます。', portrait: '#batter-portrait', ctl: ['batting-choice', 'auto'] },
      { id: 'bunt', hold: false, name: '送り<br>バント', note: '走者を次の塁へ進めます。', ctl: ['batting-choice', 'bunt'], needs: s => (s.first || s.second) && s.outs < 2, icon: () => { const c = fan(); c.block(8, 16, 2, 1, GOLD); arrow(c, 13, 15, 10, 12, CREAM); return c.svg(); } },
      { id: 'safety', hold: false, name: 'セーフティ<br>バント', note: '打者が生きることを狙うバントです。', ctl: ['batting-choice', 'bunt'], needs: s => !((s.first || s.second) && s.outs < 2), icon: () => { const c = fan(); c.block(7, 16, 2, 1, GOLD); arrow(c, 10, 18, 13, 15, CREAM); return c.svg(); } },
      { id: 'center', hold: true, name: 'センター<br>返し', note: '中堅方向へ打ち返します。', ctl: ['direction-choice', 'CENTER'], icon: () => { const c = fan(); arrow(c, 10, 18, 10, 5, GOLD); return c.svg(); } },
      { id: 'pull', hold: true, name: '引っ張り', note: '引っ張り方向へ強く打ちます。', ctl: ['direction-choice', 'PULL'], icon: h => { const c = fan(); arrow(c, 10, 18, pullX(h), 7, GOLD); return c.svg(); } },
      { id: 'oppo', hold: true, name: '流し打ち', note: '逆方向へ打ちます。', ctl: ['direction-choice', 'OPPOSITE'], icon: h => { const c = fan(); arrow(c, 10, 18, oppoX(h), 7, GOLD); return c.svg(); } }
    ],
    pitcher: [
      { id: 'auto', hold: true, name: 'コース<br>おまかせ', note: '捕手の配球に任せます。', portrait: '#pitcher-portrait', ctl: ['location-choice', 'auto'] },
      { id: 'inside', hold: true, name: '内角中心', note: '打者の内側を攻めます。', ctl: ['location-choice', 'inside'], icon: h => zone((r, col) => col === innerCol(h)).svg() },
      { id: 'outside', hold: true, name: '外角中心', note: '打者の外側を攻めます。', ctl: ['location-choice', 'outside'], icon: h => zone((r, col) => col === outerCol(h)).svg() },
      { id: 'strike', hold: true, name: 'ストライク<br>をとれ', note: 'ゾーンに投げ、四球を避けます。', ctl: ['location-choice', 'zone'], icon: () => zone(() => true).svg() },
      { id: 'low', hold: true, name: '低め中心', note: '低めへ集めて長打を防ぎます。', ctl: ['location-choice', 'low'], icon: () => zone(r => r === 2).svg() },
      { id: 'walk', hold: false, name: '敬遠', note: '勝負を避けて歩かせます。', ctl: ['location-choice', 'intentional'], icon: () => { const c = zone(() => false, GOLD); [4, 9, 14].forEach(y => c.block(18, y, 2, 2, GOLD)); return c.svg(); } }
    ]
  };

  /* Detail orders: one row per existing control, options read from the control itself. */
  const DETAIL = {
    batter: [['打者', [['振り方', 'batting-choice'], ['打つ方向', 'direction-choice']]], ['走者', [['走塁', 'baserunning-choice']]]],
    pitcher: [['投手', [['球種', 'pitch-choice'], ['コース', 'location-choice']]]]
  };
  const selectOf = id => document.getElementById(id);
  const optionsOf = id => [...selectOf(id).options].map(o => [o.value, o.textContent.trim()]);
  const isDefault = id => { const select = selectOf(id); return !select.options.length || select.value === select.options[0].value; };

  const state = { pick: {}, hint: null, ordersGroup: 0, detailTab: 'batters', lastKey: '' };

  function setControl(id, value) {
    const select = selectOf(id);
    if (select.value === value) return;
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }
  const controlOn = card => selectOf(card.ctl[0]).value === card.ctl[1];

  function cardPlate(card, s) {
    if (card.portrait) return '<span class="plate portrait" data-emotion-slot="' + card.portrait + '">' + $(card.portrait).innerHTML + '</span>';
    return '<span class="plate">' + card.icon(s.hand) + '</span>';
  }

  function renderHand() {
    const deck = side(), s = situation(), row = $('.card-row'), over = finished();
    const cards = over ? [] : DECK[deck].filter(card => !card.needs || card.needs(s));
    const active = cards.filter(controlOn);
    const chosen = active.find(c => c.id === state.pick[deck]) || active[0] || null;
    const kept = flow.sustain && flow.sustain.deck === deck ? flow.sustain.id : null;
    row.innerHTML = cards.map(card => (
      '<button type="button" class="tactic" data-deck="' + deck + '" data-id="' + card.id + '" data-hold="' + card.hold + '" aria-pressed="' + (card === chosen) + '"' +
      (card.id === kept ? ' data-kept="true"' : '') + '>' +
      (card.id === kept ? '<span class="tag kept">持続中</span>' : card.hold ? '' : '<span class="tag once">1打席</span>') +
      cardPlate(card, s) + '<span class="name">' + card.name + '</span></button>'
    )).join('');
    let picked = chosen ? chosen.name.replace('<br>', '') : null;
    if (!picked) {
      const first = DECK[deck][0], select = selectOf(first.ctl[0]);
      picked = (select.selectedOptions[0] || { textContent: '' }).textContent.trim();
    }
    const title = $('.hand-title strong');
    title.innerHTML = over ? '試合終了' : '<em>' + safe(picked) + '</em> ' + (deck === 'batter' ? safe(s.batter) : '対 ' + safe(s.batter));
    const hint = cards.find(c => c.id === state.hint) || chosen;
    const orders = $('.hand-deck').dataset.state === 'orders';
    $('.hand-title span').textContent = over ? '' : orders ? '作戦カードより優先します。' : hint ? hint.note + (hint.id === kept ? ' このイニングは続きます。' : !hint.hold ? ' 1打席だけ効きます。' : '') : '詳細指示で選んだ内容を使います。';
    renderScope();
    $('.open-detail-orders').dataset.count = ordersChanged(deck);
    $('.open-detail-orders').hidden = !DETAIL[deck].length;
    applyEmotions();
  }

  function ordersChanged(deck) {
    return DETAIL[deck].flatMap(group => group[1]).filter(([, id]) => !isDefault(id)).length;
  }

  function buildHand() {
    const hand = document.createElement('section');
    hand.className = 'hand-deck';
    hand.dataset.state = 'open';
    hand.setAttribute('aria-label', '作戦カード');
    hand.innerHTML = '<div class="hand-head"><div class="hand-title"><strong></strong><span></span></div>' +
      '<button type="button" class="open-detail-orders" aria-expanded="false" data-count="0">詳細指示</button>' +
      '<button type="button" class="hand-toggle" aria-expanded="true">しまう</button></div>' +
      '<div class="run-row" data-run="idle"><span class="run-stops" role="img"><span class="run-stops-label">ストップ</span><span class="pips" aria-hidden="true"><i></i><i></i><i></i></span><b></b></span>' +
      '<span class="run-state" role="status"></span><button type="button" class="run-btn primary"></button></div>' +
      '<div class="scope-row" role="group" aria-label="カードの効く期間"><span class="scope-label">効く期間</span>' +
      '<button type="button" data-scope="plate" aria-pressed="true">この打席</button><button type="button" data-scope="inning" aria-pressed="false">このイニング</button></div>' +
      '<div class="card-row"></div><div class="orders-panel" role="region" aria-label="詳細指示"></div>';
    $('.broadcast').after(hand);
    $('.scope-row').addEventListener('click', event => {
      const button = event.target.closest('[data-scope]');
      if (!button || flow.fxBusy) return;
      flow.scope = button.dataset.scope;
      renderScope();
    });
    hand.addEventListener('click', event => {
      const button = event.target.closest('.tactic');
      if (button) playCard(DECK[button.dataset.deck].find(c => c.id === button.dataset.id));
    });
    $('.run-btn').addEventListener('click', onRunButton);
    $('.hand-toggle').addEventListener('click', () => tuck(hand.dataset.state === 'open'));
    $('.open-detail-orders').addEventListener('click', () => (hand.dataset.state === 'orders' ? closeOrders() : openOrders()));
    $('.orders-panel').addEventListener('click', onOrdersClick);
    hand.addEventListener('keydown', event => {
      if (event.key === 'Escape' && hand.dataset.state === 'orders') closeOrders();
    });
  }

  function tuck(tucked) {
    const hand = $('.hand-deck');
    if (hand.dataset.state === 'orders') return;
    hand.dataset.state = tucked ? 'tucked' : 'open';
    $('.hand-toggle').textContent = tucked ? '手札を出す' : 'しまう';
    $('.hand-toggle').setAttribute('aria-expanded', String(!tucked));
  }

  function sheet(id, title, sub) {
    const dialog = document.createElement('dialog');
    dialog.className = 'sheet';
    dialog.id = id;
    dialog.setAttribute('aria-label', title);
    dialog.innerHTML = '<div class="sheet-frame"><div class="sheet-head"><h2>' + title + '<small></small></h2><button type="button" class="sheet-close">閉じる</button></div>' +
      '<div class="sheet-body"></div><div class="sheet-foot"></div></div>';
    $('small', dialog).textContent = sub || '';
    $('.sheet-close', dialog).addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    document.body.append(dialog);
    return dialog;
  }

  /* ---------- Detail orders (rise over the lower half of the picture) ---------- */
  function renderOrders() {
    const deck = side(), groups = DETAIL[deck], group = groups[Math.min(state.ordersGroup, groups.length - 1)];
    $('.orders-panel').innerHTML = '<div class="orders-tabs" role="tablist">' +
      (groups.length > 1 ? groups.map(([name], i) => '<button type="button" role="tab" data-group="' + i + '" aria-selected="' + (groups[i] === group) + '">' + name + '</button>').join('') : '<button type="button" role="tab" aria-selected="true">' + group[0] + '</button>') +
      '<button type="button" class="reset-orders">おまかせに戻す</button></div><div class="orders-rows">' +
      group[1].map(([label, id]) => {
        const current = selectOf(id).value;
        return '<div class="field-row"><span>' + label + '</span><div class="segments" role="group" aria-label="' + label + '">' +
          optionsOf(id).map(([value, text]) => '<button type="button" data-ctl="' + id + '" data-value="' + safe(value) + '" aria-pressed="' + (current === value) + '">' + safe(text) + '</button>').join('') +
          '</div></div>';
      }).join('') + '</div><div class="orders-foot"><span class="orders-note">次の一球から有効。打席が終わるとおまかせに戻ります（走塁を除く）</span>' +
      '<button type="button" class="primary apply-orders">閉じる</button></div>';
  }

  function sizeOrders(handHeight) {
    const hand = $('.hand-deck'), lift = $('.broadcast').offsetHeight / 2;
    if (handHeight) hand.dataset.baseHeight = handHeight;
    hand.style.setProperty('--orders-lift', lift + 'px');
    hand.style.setProperty('--orders-height', (Number(hand.dataset.baseHeight) + lift) + 'px');
  }
  function openOrders() {
    const hand = $('.hand-deck');
    tuck(false);
    sizeOrders(hand.offsetHeight);
    hand.dataset.state = 'orders';
    $('.open-detail-orders').setAttribute('aria-expanded', 'true');
    state.ordersGroup = 0;
    renderOrders();
    renderHand();
    hand.scrollIntoView({ block: 'nearest' });
    const tab = $('.orders-panel [aria-selected="true"]');
    if (tab) tab.focus({ preventScroll: true });
  }
  function closeOrders() {
    $('.hand-deck').dataset.state = 'open';
    $('.open-detail-orders').setAttribute('aria-expanded', 'false');
    renderHand();
    $('.open-detail-orders').focus({ preventScroll: true });
  }
  function onOrdersClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.dataset.group) {
      state.ordersGroup = Number(button.dataset.group);
      renderOrders();
    } else if (button.dataset.ctl) {
      setControl(button.dataset.ctl, button.dataset.value);
      $$('[data-ctl="' + button.dataset.ctl + '"]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      renderHand();
    } else if (button.classList.contains('reset-orders')) {
      DETAIL[side()].flatMap(group => group[1]).forEach(([, id]) => { if (selectOf(id).options.length) setControl(id, selectOf(id).options[0].value); });
      renderOrders();
      renderHand();
    } else if (button.classList.contains('apply-orders')) {
      closeOrders();
    }
  }

  /* ---------- This game's numbers, read from the Core records ---------- */
  const OUT_LABEL = { ground_out: 'ゴロアウト', fly_out: 'フライアウト', foul_out: 'ファウルフライアウト', field_out: 'アウト', double_play: 'ゲッツー', sacrifice: '犠打', sacrifice_fly: '犠牲フライ', fielders_choice: '野選', error: 'エラー出塁', strikeout: '三振', walk: '四球', hit_by_pitch: '死球' };
  const HIT_LABEL = ['', '単打', '二塁打', '三塁打', '本塁打'];

  function plateResult(record) {
    const play = record.play || {}, score = play.localScoringV100 || {}, cls = play.classification;
    if (cls === 'strikeout') return play.call === 'called_strike' ? '見逃し三振' : '空振り三振';
    if (Number(score.hits) >= 1) return HIT_LABEL[Math.min(4, Math.max(1, Number(score.hitBases) || 1))];
    if (OUT_LABEL[cls]) return OUT_LABEL[cls];
    const advanced = record.beforeMatch && record.match && (record.match.outs > record.beforeMatch.outs || record.match.inning !== record.beforeMatch.inning || record.match.half !== record.beforeMatch.half);
    return advanced ? 'アウト' : '出塁';
  }

  function analyze(history) {
    const bat = new Map(), pit = new Map(), plates = [];
    const get = (map, id, make) => { if (!map.has(id)) map.set(id, make()); return map.get(id); };
    let pitches = 0, lastPa = null;
    history.forEach(record => {
      const rules = (record.play && record.play.rules) || {}, score = (record.play && record.play.localScoringV100) || {};
      const b = get(bat, record.batterPlayerId, () => ({ pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, results: [] }));
      const p = get(pit, record.pitcherPlayerId, () => ({ pitches: 0, outs: 0, h: 0, k: 0, bb: 0, r: 0 }));
      p.pitches += 1;
      pitches += 1;
      const before = record.beforeMatch, after = record.match;
      const runs = (rules.scoredRunnerIds || []).length;
      p.r += runs;
      if (before && after) p.outs += after.half !== before.half || after.inning !== before.inning ? Math.max(0, 3 - before.outs) : Math.max(0, after.outs - before.outs);
      if (!lastPa || lastPa.playId !== (before && before.playId)) lastPa = { playId: before && before.playId, n: 0, inning: before && before.inning, half: before && before.half, batter: record.batterPlayerId, pitcher: record.pitcherPlayerId, record };
      lastPa.n += 1;
      if (rules.batterAdvanced) {
        const cls = record.play.classification, label = plateResult(record);
        b.pa += 1;
        const walk = cls === 'walk' || cls === 'hit_by_pitch';
        if (!walk && cls !== 'sacrifice' && cls !== 'sacrifice_fly') b.ab += 1;
        if (cls === 'walk') { b.bb += 1; p.bb += 1; }
        if (cls === 'strikeout') { b.k += 1; p.k += 1; }
        if (Number(score.hits) >= 1) { b.h += 1; p.h += 1; }
        if (Number(score.homeRuns) >= 1) b.hr += Number(score.homeRuns);
        b.results.push(label);
        plates.push({ inning: lastPa.inning, half: lastPa.half, batter: lastPa.batter, text: lastPa.n + '球目　' + label + (runs ? '　' + runs + '点' : '') + (after && before && after.outs > before.outs && after.half === before.half ? '　' + after.outs + 'アウト' : '') });
        lastPa = null;
      }
    });
    return { bat, pit, plates, pitches };
  }

  const activeTeam = team => globalThis.KneekuraActiveTeamsV1?.[team];
  const slotRole = (team, index) => {
    const defense = activeTeam(team)?.defense, id = team + '-b' + index;
    if (defense) return Object.keys(defense).find(role => defense[role] === id) || 'DH';
    return Object.keys(DATA.defenseMap[team]).find(role => DATA.defenseMap[team][role] === index) || 'DH';
  };
  function lineupFor(team) {
    const rows = [];
    const order = activeTeam(team)?.battingOrder ?? Array.from({ length: 9 }, (_, i) => team + '-b' + i);
    order.forEach((id, i) => {
      const player = PLAYERS[id];
      if (player) rows.push({ id, name: player.name, bats: player.bats, pos: slotRole(team, Number(id.split('-b')[1])), order: i + 1 });
    });
    const pitcherId = team === 1 && selectOf('home-pitcher-choice') ? selectOf('home-pitcher-choice').value : team + '-p0';
    const pitcher = PLAYERS[pitcherId] || PLAYERS[team + '-p0'];
    if (pitcher) rows.push({ id: pitcherId, name: pitcher.name, bats: pitcher.throws, pos: 'P', order: '' });
    return rows;
  }
  const handHint = bats => (bats === 'L' ? 'L' : bats === 'S' ? 'S' : 'R');

  function renderTab(name) {
    state.detailTab = name;
    const body = $('#detail-sheet .sheet-body'), snap = live(), stats = analyze(snap ? snap.settled : []);
    const teamTitle = team => '<h3 class="team-title" data-team="' + TEAMS[team] + '">' + TEAMS[team] + '</h3>';
    const inningName = (inning, half) => inning + '回' + (half === 'top' ? '表' : '裏');
    if (name === 'log') {
      const groups = [];
      stats.plates.forEach(plate => {
        const key = plate.inning + '-' + plate.half;
        let group = groups.find(g => g.key === key);
        if (!group) groups.push(group = { key, title: inningName(plate.inning, plate.half) + ' ' + TEAMS[plate.half === 'top' ? 0 : 1] + ' の攻撃', rows: [] });
        group.rows.push([(PLAYERS[plate.batter] || {}).name || '', plate.text]);
      });
      body.innerHTML = groups.length
        ? groups.map(g => '<h3 class="log-half">' + g.title + '</h3>' + g.rows.map(([who, text]) => '<div class="log-row"><b>' + safe(who) + '</b><span>' + safe(text) + '</span></div>').join('')).join('')
        : '<p class="box-note">まだ打席が終わっていません。</p>';
    } else if (name === 'batters') {
      body.innerHTML = [0, 1].map(team => teamTitle(team) + '<div class="box-scroll"><table class="box"><thead><tr><th>位置</th><th class="name">選手名</th><th>打</th><th>安</th><th>本</th><th>四</th><th>振</th></tr></thead><tbody>' +
        lineupFor(team).filter(p => p.pos !== 'P' || false).map(p => {
          const b = stats.bat.get(p.id) || { ab: 0, h: 0, hr: 0, bb: 0, k: 0 };
          return '<tr><td class="pos">(' + POS[p.pos] + ')</td><td class="name">' + safe(p.name) + '</td><td>' + b.ab + '</td><td>' + b.h + '</td><td>' + b.hr + '</td><td>' + b.bb + '</td><td>' + b.k + '</td></tr>';
        }).join('') + '</tbody></table></div>').join('') +
        '<p class="box-note">（）：先発。この試合の数字です。</p>';
    } else if (name === 'pitchers') {
      body.innerHTML = [1, 0].map(team => teamTitle(team) + '<div class="box-scroll"><table class="box"><thead><tr><th class="name">選手名</th><th>回</th><th>球</th><th>安</th><th>振</th><th>四</th><th>失</th></tr></thead><tbody>' +
        lineupFor(team).filter(p => p.pos === 'P').map(p => {
          const t = stats.pit.get(p.id) || { pitches: 0, outs: 0, h: 0, k: 0, bb: 0, r: 0 };
          return '<tr><td class="name">' + safe(p.name) + '</td><td>' + Math.floor(t.outs / 3) + '.' + (t.outs % 3) + '</td><td>' + t.pitches + '</td><td>' + t.h + '</td><td>' + t.k + '</td><td>' + t.bb + '</td><td>' + t.r + '</td></tr>';
        }).join('') + '</tbody></table></div>').join('');
    } else if (name === 'order') {
      body.innerHTML = '<div class="order-table">' + [0, 1].map(team => '<div>' + teamTitle(team) + lineupFor(team).map(p => (
        '<div class="player-row" style="cursor:default"><span class="order">' + p.order + '</span><span>' + POS[p.pos] + '</span><span class="side" data-hand="' + handHint(p.bats) + '"></span><span class="who">' + safe(p.name) + '</span><span></span></div>'
      )).join('') + '</div>').join('') + '</div><p class="box-note">線の色は右打・右投が赤、左が青、両打が紫です。</p>';
    }
    $$('.detail-tabs button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
  }

  function buildDetail() {
    const dialog = sheet('detail-sheet', '詳細表示', 'この試合の記録です');
    const tabs = document.createElement('div');
    tabs.className = 'detail-tabs';
    tabs.setAttribute('role', 'tablist');
    tabs.innerHTML = [['log', '経過'], ['batters', '打者成績'], ['pitchers', '投手成績'], ['order', 'オーダー']]
      .map(([id, label]) => '<button type="button" role="tab" data-tab="' + id + '">' + label + '</button>').join('');
    $('.sheet-body', dialog).before(tabs);
    $('.sheet-foot', dialog).remove();
    tabs.addEventListener('click', event => { const b = event.target.closest('button'); if (b) renderTab(b.dataset.tab); });
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'detail-open';
    open.textContent = '詳細表示';
    open.addEventListener('click', () => { renderTab(state.detailTab); dialog.showModal(); });
    $('.count-band').append(open);
  }

  /* ---------- Today's line under each name ---------- */
  const statList = pairs => pairs.map(([label, value]) => '<dt>' + label + '</dt><dd>' + value + '</dd>').join('');

  function renderPlayerStats(snap) {
    const pitcherBox = $('.pitcher-card .player-stats'), batterBox = $('.batter-card .player-stats');
    if (!snap) { pitcherBox.innerHTML = ''; batterBox.innerHTML = ''; return; }
    const stats = analyze(snap.settled), shown = snap.selectedRecord || snap.host;
    const batterId = shown.batterPlayerId, pitcherId = shown.pitcherPlayerId;
    const b = stats.bat.get(batterId) || { pa: 0, ab: 0, h: 0, hr: 0, bb: 0, k: 0, results: [] }, p = stats.pit.get(pitcherId) || { pitches: 0, outs: 0, h: 0, k: 0, bb: 0, r: 0 };
    batterBox.innerHTML = b ? '<dl class="stat-line">' + statList([['今', b.ab + '打数' + b.h + '安打']]) + '</dl>' +
      '<div class="stat-split"><dl class="stat-line">' + statList([['本', b.hr], ['四', b.bb], ['振', b.k]]) + '</dl>' +
      '<ol class="game-results" aria-label="この試合の打席結果">' + b.results.slice(-3).map((result, i, all) => '<li><b>' + (b.results.length - all.length + i + 1) + '</b>' + safe(result) + '</li>').join('') + '</ol></div>' : '';
    pitcherBox.innerHTML = p ? '<dl class="stat-line stat-pairs">' + statList([
      ['球', p.pitches], ['回', Math.floor(p.outs / 3) + '.' + (p.outs % 3)], ['安', p.h], ['振', p.k], ['四', p.bb], ['失', p.r]
    ]) + '</dl>' : '';
  }

  /* Names stay on one line by shrinking; below the readable size they break at the middle dot. */
  const MIN_ONE_LINE = 15, MIN_TWO_LINES = 13;
  function textWidth(element, text) {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap';
    probe.textContent = text;
    element.append(probe);
    const width = probe.getBoundingClientRect().width;
    probe.remove();
    return width;
  }
  function bestBreak(name) {
    const parts = name.split('・');
    let best = null;
    for (let i = 1; i < parts.length; i++) {
      const pair = [parts.slice(0, i).join('・') + '・', parts.slice(i).join('・')];
      if (!best || Math.max(pair[0].length, pair[1].length) < Math.max(best[0].length, best[1].length)) best = pair;
    }
    return best;
  }
  function fitName(element) {
    const name = element.textContent.replace(/\s+/g, '');
    element.style.fontSize = '';
    const base = parseFloat(getComputedStyle(element).fontSize);
    const room = element.parentElement.clientWidth - 2;
    if (!name || !room) return;
    const fitted = lines => Math.floor(Math.min(base, ...lines.map(line => base * room / textWidth(element, line))) * 2) / 2;
    const oneLine = fitted([name]), lines = bestBreak(name);
    if (oneLine >= MIN_ONE_LINE || !lines) {
      element.replaceChildren(name);
      element.style.fontSize = oneLine + 'px';
    } else {
      element.replaceChildren(lines[0], document.createElement('br'), lines[1]);
      element.style.fontSize = Math.max(MIN_TWO_LINES, fitted(lines)) + 'px';
    }
  }
  const nameObserver = new MutationObserver(fitNames);
  function fitNames() {
    nameObserver.disconnect();
    ['#pitcher-name', '#batter-name'].forEach(selector => {
      fitName($(selector));
      nameObserver.observe($(selector), { childList: true, characterData: true, subtree: true });
    });
  }
  function buildPlayerStats() {
    ['pitcher', 'batter'].forEach(role => {
      const card = $('.' + role + '-card');
      const meta = document.createElement('div');
      meta.className = 'player-meta';
      $('#' + role + '-meta').before(meta);
      meta.append($('#' + role + '-hand'), $('#' + role + '-meta'));
      const stats = document.createElement('section');
      stats.className = 'player-stats';
      stats.setAttribute('aria-label', 'この試合の成績');
      card.append(stats);
    });
    fitNames();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitNames);
    addEventListener('resize', fitNames);
  }

  /* ---------- Batted-ball window (off until asked for) ---------- */
  function lastContact(snap) {
    if (!snap) return null;
    const list = snap.history, shownAt = snap.selectedRecord ? list.indexOf(snap.selectedRecord) : list.length - 1;
    for (let i = (shownAt < 0 ? list.length : shownAt + 1) - 1; i >= 0; i--) {
      const moment = list[i].play && list[i].play.outgoingBallMoment;
      if (list[i].play && list[i].play.contact && moment && moment.ball && moment.ball.velocity) return moment.ball.velocity;
    }
    return null;
  }
  function renderHitWindow(snap) {
    const box = $('.hit-window');
    if (box.hidden) return;
    const v = lastContact(snap || live());
    if (!v) { box.innerHTML = '<strong>直近の打球</strong><dl><dt>まだ打球がありません</dt><dd></dd></dl>'; return; }
    const speed = Math.hypot(v.x, v.y, v.z) * 3.6, angle = Math.atan2(v.y, Math.hypot(v.x, v.z)) * 180 / Math.PI;
    box.innerHTML = '<strong>直近の打球</strong><dl><dt>速度</dt><dd>' + Math.round(speed) + ' km/h</dd><dt>角度</dt><dd>' + Math.round(angle) + ' 度</dd></dl>';
  }
  function buildHitWindow() {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'hit-tab';
    tab.textContent = '打球データ';
    tab.setAttribute('aria-pressed', 'false');
    const box = document.createElement('div');
    box.className = 'hit-window';
    box.hidden = true;
    $('.broadcast').append(tab, box);
    tab.addEventListener('click', () => {
      box.hidden = !box.hidden;
      tab.setAttribute('aria-pressed', String(!box.hidden));
      renderHitWindow();
    });
  }

  /* ---------- Emotion marks: record.emotionMarksV1 = [{playerId, emotion}] ---------- */
  const EMOTION = {
    '優越感': 'superior', '優越': 'superior', superiority: 'superior', superior: 'superior',
    'やる気': 'motivated', 'ヤル気': 'motivated', motivation: 'motivated', motivated: 'motivated', drive: 'motivated',
    '恐怖': 'fear', fear: 'fear',
    '焦り': 'impatient', impatience: 'impatient', impatient: 'impatient', hurry: 'impatient',
    '怒り': 'anger', anger: 'anger'
  };
  const EMOTION_NAME = { superior: '優越感', motivated: 'やる気', fear: '恐怖', impatient: '焦り', anger: '怒り' };
  const NAME_TO_ID = {};
  Object.keys(PLAYERS).forEach(id => { NAME_TO_ID[PLAYERS[id].name] = id; });
  let emotionById = new Map();

  function readEmotions(snap) {
    const next = new Map();
    const marks = snap && snap.shown && snap.shown.emotionMarksV1;
    if (Array.isArray(marks)) {
      marks.forEach(mark => {
        const kind = mark && EMOTION[String(mark.emotion)];
        if (kind && typeof mark.playerId === 'string') next.set(mark.playerId, kind);
      });
    }
    return next;
  }
  function setMark(element, kind) {
    if (kind) {
      if (element.dataset.emotion !== kind) { element.dataset.emotion = kind; element.title = EMOTION_NAME[kind]; }
    } else if (element.dataset.emotion) {
      delete element.dataset.emotion;
      element.removeAttribute('title');
    }
  }
  function applyEmotions() {
    $$('#actor-labels span').forEach(label => setMark(label, emotionById.get(NAME_TO_ID[label.textContent])));
    const snap = emotionById.owner || {};
    setMark($('#batter-portrait'), emotionById.get(snap.batter));
    setMark($('#pitcher-portrait'), emotionById.get(snap.pitcher));
    $$('.tactic .plate.portrait').forEach(plate => {
      const slot = plate.dataset.emotionSlot;
      setMark(plate, slot === '#batter-portrait' ? emotionById.get(snap.batter) : emotionById.get(snap.pitcher));
    });
  }
  function updateEmotions(snap) {
    emotionById = readEmotions(snap);
    emotionById.owner = snap && snap.shown ? { batter: snap.shown.batterPlayerId, pitcher: snap.shown.pitcherPlayerId } : {};
    applyEmotions();
  }

  /* ---------- Face photos: the owner's pictures stand in for the portrait slots ----------
     Only the players named here get a photo; the pictures live in the git-ignored release assets and are
     referenced by id only. Display only: reads the public record (batterPlayerId, pitcherPlayerId,
     play.localScoringV100.classification, play.call, play.intentionalWalkV1) and writes nothing to the Core.
     An event photo is shown from the moment the pitch result is official until the next pitch begins
     (FACE_EVENT_HOLD), except the intentional-walk photo, which lasts the whole plate appearance. */
  const FACE_URL = id => 'data:image/webp;base64,' + id;
  const FACES = {
    'ロビン': { base: FACE_URL('@@ASSET:fa8be43dd80eea2c1870cc9a@@') },
    'ライポア': { base: FACE_URL('@@ASSET:fa3a44f9c5630706a347da57@@') },
    'ペイン酒井': { base: FACE_URL('@@ASSET:4e7eabe248e1e43c6b6f86ab@@') },
    'ニッチロー': { base: FACE_URL('@@ASSET:025f391d743ba935d515b4ab@@') },
    'ロッツォ': { base: FACE_URL('@@ASSET:4b0d74f5242d20a286708c93@@'), lookedK: FACE_URL('@@ASSET:1d31339da2be184b954803bc@@') },
    'ちんすけ': { base: FACE_URL('@@ASSET:73da0b61a5c01f0a56d9a01b@@'), lookedK: FACE_URL('@@ASSET:d1b691269b8ad7ea7d6e58ea@@') },
    'ティカオ': { base: FACE_URL('@@ASSET:dc46247adb2426dc306d63eb@@'), walk: FACE_URL('@@ASSET:81a3458479258fb0738700c4@@'), bad: FACE_URL('@@ASSET:8025535ee24115ca6dd6251e@@') }
  };
  const SLOT_ROLE = { '#batter-portrait': 'batter', '#pitcher-portrait': 'pitcher' };
  const facePlain = {};

  function recordClass(record) {
    const play = (record && record.play) || {}, score = play.localScoringV100 || {};
    return score.classification || play.classification || '';
  }
  /* The record whose result is on screen and final; null while a pitch is being prepared or in flight. */
  function officialRecord(view) {
    const record = view.lastResult;
    if (!record) return null;
    const frame = view.currentFrame, end = record.play && record.play.rules && record.play.rules.endedAtTick;
    if (frame && Number.isFinite(end) && !(frame.tick >= end)) return null;
    return record;
  }
  /* Records up to and including the official one, never the pitch in flight. The displayed record is a copy of
     the host's, so it is found by its index (selectedPitch), not by identity. */
  function settledHistory(view, official) {
    const all = (view.host && view.host.history) || [];
    if (!view.lastResult) return all;
    const at = Number.isInteger(view.selectedPitch) ? view.selectedPitch : all.indexOf(view.lastResult);
    return at < 0 ? all : all.slice(0, official ? at + 1 : at);
  }
  /* Was the batter just ahead of this player in the order walked intentionally? */
  function aheadWasIntentionallyWalked(history, id) {
    const team = PLAYERS[id] && PLAYERS[id].team;
    let i = history.length - 1;
    while (i >= 0 && history[i].batterPlayerId === id) i -= 1;
    for (; i >= 0; i--) {
      const who = history[i].batterPlayerId;
      if (who === id || (PLAYERS[who] && PLAYERS[who].team !== team)) continue;
      for (let j = i; j >= 0 && history[j].batterPlayerId === who; j--) {
        if (history[j].play && history[j].play.intentionalWalkV1 === true) return true;
      }
      return false;
    }
    return false;
  }
  /* Which photo of this player for the slot's role: a key of FACES[name], or null when he has none. */
  function faceVariant(name, role, view) {
    const set = FACES[name], id = NAME_TO_ID[name];
    if (!set) return null;
    const official = officialRecord(view), cls = recordClass(official), play = (official && official.play) || {};
    const asBatter = !!official && official.batterPlayerId === id, asPitcher = !!official && official.pitcherPlayerId === id;
    if (set.lookedK && role === 'batter' && asBatter && cls === 'strikeout' && play.call === 'called_strike') return 'lookedK';
    if (set.bad && ((asBatter && cls === 'strikeout') || (asPitcher && cls === 'home_run'))) return 'bad';
    if (set.walk) {
      if ((asPitcher && (cls === 'walk' || cls === 'hit_by_pitch')) || (asBatter && cls === 'hit_by_pitch')) return 'walk';
      if (role === 'batter' && id && aheadWasIntentionallyWalked(settledHistory(view, !!official), id)) return 'walk';
    }
    return 'base';
  }
  function paintFace(selector, key, url, name) {
    const slot = $(selector);
    if (!slot || slot.dataset.face === key) return;
    if (!(selector in facePlain)) facePlain[selector] = { html: slot.innerHTML, label: slot.getAttribute('aria-label') };
    slot.dataset.face = key;
    if (url) {
      slot.innerHTML = '<img alt="" draggable="false" src="' + url + '">';
      slot.setAttribute('aria-label', name + 'の顔写真');
    } else {
      slot.innerHTML = facePlain[selector].html;
      slot.setAttribute('aria-label', facePlain[selector].label);
    }
  }
  function updateFaces(given) {
    const view = given || { host: null, lastResult: null, currentFrame: null };
    Object.keys(SLOT_ROLE).forEach(selector => {
      const role = SLOT_ROLE[selector], name = ($('#' + role + '-name').textContent || '').replace(/\s+/g, '');
      let variant = null;
      try { variant = faceVariant(name, role, view); } catch (error) { variant = null; }
      const set = FACES[name];
      paintFace(selector, variant ? name + '|' + variant : '', variant ? (set[variant] || set.base) : null, name);
      $$('.tactic .plate.portrait').forEach(plate => {
        if (plate.dataset.emotionSlot !== selector || plate.dataset.face === $(selector).dataset.face) return;
        plate.innerHTML = $(selector).innerHTML;
        plate.dataset.face = $(selector).dataset.face || '';
      });
    });
  }
  /* One look at the match every 200 ms feeds the faces, the stats and the match flow. */
  setInterval(() => {
    if (document.hidden) return;
    const view = readView();
    updateFaces(view);
    syncFlow(view);
  }, 200);

  /* ---------- Screen mode: manager layout or the plain watching layout ---------- */
  function buildModeSwitch() {
    const grid = $('.settings-grid');
    if (!grid) return;
    const field = document.createElement('fieldset');
    field.innerHTML = '<legend>画面</legend><div class="appearance-buttons"><button type="button" data-ui-mode="manager" aria-pressed="true">監督モード</button><button type="button" data-ui-mode="watch" aria-pressed="false">観戦（従来の指示欄）</button></div>';
    grid.prepend(field);
    const cards = document.createElement('fieldset');
    cards.className = 'card-mode-field';
    cards.innerHTML = '<legend>カードの出し方</legend><div class="appearance-buttons"><button type="button" data-card-mode="each" aria-pressed="true">毎打席止める</button><button type="button" data-card-mode="manual" aria-pressed="false">変更時だけ止める</button></div>' +
      '<p class="card-mode-note">変更時だけ止める：カードを出さずに進み、ストップを押したときだけ手札を開きます。監督モードのみ。</p>';
    field.after(cards);
    try { if (localStorage.getItem(CARD_MODE_KEY) === 'manual') flow.cardMode = 'manual'; } catch (error) { /* storage may be unavailable */ }
    const applyCardMode = next => {
      flow.cardMode = next;
      $$('[data-card-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cardMode === next)));
      try { localStorage.setItem(CARD_MODE_KEY, next); } catch (error) { /* ignore */ }
      if (next === 'manual' && flow.held) release();
      flow.shown = '';
    };
    cards.addEventListener('click', event => { const b = event.target.closest('[data-card-mode]'); if (b) applyCardMode(b.dataset.cardMode); });
    applyCardMode(flow.cardMode);
    let mode = 'manager';
    try { if (localStorage.getItem('kneekura.uiMode.v1') === 'watch') mode = 'watch'; } catch (error) { /* storage may be unavailable */ }
    const apply = next => {
      mode = next;
      document.body.dataset.mode = mode;
      $$('[data-ui-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.uiMode === mode)));
      try { localStorage.setItem('kneekura.uiMode.v1', mode); } catch (error) { /* ignore */ }
      if (mode === 'manager') schedule(true);
      else if (flow.held) release();
    };
    field.addEventListener('click', event => { const b = event.target.closest('[data-ui-mode]'); if (b) apply(b.dataset.uiMode); });
    apply(mode);
  }

  /* ---------- Match flow: hold at each plate appearance, stops, card effect ---------- */
  const STOPS_PER_GAME = 3, FX_MS = 500, FX_LIMIT_MS = 4000, RUN_GRACE_MS = 6000, NOTICE_MS = 3200;
  const PLATE_ORDERS = ['batting-choice', 'direction-choice', 'pitch-choice', 'location-choice'];
  /* scope: how long the next card lasts. sustain: the card kept for the half inning ({deck, id, key}).
     once: a one-plate card was chosen under "このイニング". gapStop: stop at the next gap between plate appearances. */
  const CARD_MODE_KEY = 'kneekura.cardMode.v1';
  const flow = { scope: 'plate', sustain: null, once: false, gapStop: false, cardMode: 'each', stopsLeft: STOPS_PER_GAME, held: null, run: false, busyAt: 0, fxToken: 0, fxBusy: false, queued: false, lastPitchCount: 0, statKey: '', notice: '', noticeAt: 0, mode: '', shown: '' };
  const managerOn = () => document.body.dataset.mode === 'manager';
  const endsPlate = record => !!(record && record.play && record.play.rules && record.play.rules.batterAdvanced);
  const sceneEnded = view => !!view.presentation && view.presentation.durationMs > 0 && view.presentation.elapsedMs >= view.presentation.durationMs;
  const swallow = event => { event.stopImmediatePropagation(); event.preventDefault(); };

  function say(text) {
    flow.notice = text;
    flow.noticeAt = performance.now();
    flow.shown = '';
    renderRun(readView());
  }

  /* Pitches of the current plate appearance that have left the pitcher's hand. A pitch still being prepared has not. */
  function pitchesThrown(view) {
    const history = (view.host && view.host.history) || [], record = view.lastResult;
    if (!record) {
      let n = 0;
      for (let i = history.length - 1; i >= 0 && !endsPlate(history[i]); i--) n += 1;
      return n;
    }
    /* Between two pitches the screen still shows the last one, at time 0 of its preparation: it is complete. */
    const preparing = !!view.presentation && view.presentation.stage === 'preparation', between = preparing && view.presentation.elapsedMs === 0;
    if (between && endsPlate(record)) return 0;
    let n = !preparing || between ? 1 : 0;
    for (let i = (Number.isInteger(view.selectedPitch) ? view.selectedPitch : history.length - 1) - 1; i >= 0 && !endsPlate(history[i]); i--) n += 1;
    return n;
  }
  /* The pitch on screen is the last of this plate appearance: the match stops by itself right after it. */
  function lastPitchFlying(view) {
    return !!view.lastResult && endsPlate(view.lastResult) && !(view.presentation && view.presentation.stage === 'preparation');
  }

  /* A card holds for one plate appearance. Set silently: the Core reads the controls again at the next pitch, and a
     change event would also pause the match. */
  function resetPlateOrders() {
    PLATE_ORDERS.forEach(id => {
      const select = selectOf(id);
      if (select && select.options.length && select.value !== select.options[0].value) select.value = select.options[0].value;
    });
    state.pick = {};
    state.hint = null;
    schedule(true);
  }

  const setQuiet = (id, value) => { const select = selectOf(id); if (select && select.value !== value) select.value = value; };
  /* A batter card owns both swing controls: choosing one clears the other. */
  function applyCard(card, deck, quiet) {
    const set = quiet ? setQuiet : setControl;
    if (deck === 'batter') { set('batting-choice', 'auto'); set('direction-choice', 'AUTO'); }
    set(card.ctl[0], card.ctl[1]);
  }
  /* The half inning the next pitch belongs to. */
  function halfKey(view) {
    const match = view && view.host && view.host.match;
    return match ? match.inning + '-' + match.half : $('#inning-label').textContent;
  }
  /* A plate appearance is over: the plate cards go back to default. A card kept for the half inning comes back, unless the
     half inning changed (then the keep ends and the scope is "この打席" again). A one-plate card chosen under
     "このイニング" ends the scope too. */
  function endPlateOrders(view, dropKept) {
    resetPlateOrders();
    if (flow.once) { flow.once = false; flow.scope = 'plate'; }
    const kept = flow.sustain;
    if (kept && (dropKept || kept.key !== halfKey(view))) { flow.sustain = null; flow.scope = 'plate'; }
    else if (kept) {
      const card = DECK[kept.deck].find(c => c.id === kept.id);
      if (card) { applyCard(card, kept.deck, true); state.pick[kept.deck] = kept.id; state.hint = kept.id; }
    }
    renderScope();
  }
  function renderScope() {
    $$('.scope-row [data-scope]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.scope === flow.scope)));
  }
  /* Will the match stop before the next plate appearance by itself? */
  const willHold = view => flow.gapStop || (flow.cardMode === 'each' && !(flow.sustain && flow.sustain.key === halfKey(view)));

  function newGameFlow() {
    flow.scope = 'plate';
    flow.sustain = null;
    flow.once = false;
    flow.gapStop = false;
    flow.stopsLeft = STOPS_PER_GAME;
    flow.held = null;
    flow.run = false;
    flow.queued = false;
    flow.fxToken += 1;
    flow.notice = '';
    flow.shown = '';
  }

  /* Called by the match just before it generates a pitch: a promise holds the match, null lets it go on. */
  function holdBeforePitch() {
    try {
      if (!managerOn()) return null;
      const view = readView();
      if (!view || !view.host || view.host.finished) return null;
      const history = view.host.history || [];
      if (!endsPlate(history[history.length - 1])) return null;
      endPlateOrders(view);
      const hold = willHold(view);
      flow.gapStop = false;
      if (!hold) return null;
      flow.run = false;
      return new Promise(resolve => { flow.held = resolve; schedule(true); });
    } catch (error) { return null; }
  }
  function release() {
    const go = flow.held;
    flow.held = null;
    flow.run = true;
    flow.busyAt = performance.now();
    if (go) go();
    schedule(true);
  }
  /* Go on from wherever the match is stopped. */
  function proceed() {
    if (flow.held) { release(); return; }
    if (flow.run || !managerOn()) return;
    if ($('.hand-deck').dataset.state === 'orders') closeOrders();
    $('#play').click();
  }

  /* The play button is the stop button while the match runs. A stop costs one of the game's stops, unless this
     plate appearance has not had a pitch yet. It is refused when none is left. */
  $('#play').addEventListener('click', event => {
    if (!managerOn()) return;
    const view = readView();
    if (!view || !view.host) return;
    if (flow.held) { flow.fxToken += 1; swallow(event); release(); return; }
    const over = view.host.finished || view.fast;
    if (!over && (view.playing || view.preparingPitchV99 || flow.run)) {
      if (lastPitchFlying(view)) {
        swallow(event);
        if (willHold(view)) say('この打席が終わると、次の打席の前で自動で止まります。');
        else { flow.gapStop = true; say('この打席が終わったら止まります。ストップには数えません。'); }
        return;
      }
      const free = pitchesThrown(view) === 0;
      if (!free && flow.stopsLeft <= 0) { swallow(event); say('ストップを使い切りました。この打席はこのまま進みます。'); return; }
      if (!free) flow.stopsLeft -= 1;
      flow.run = false;
      flow.queued = false;
      flow.gapStop = false;
      flow.notice = '';
      return;
    }
    if (!over) {
      /* The match ignores the play button while a pitch is being generated; go on by itself once it is ready. */
      if (view.generationV116 && view.generationV116.pending && !view.playing && !view.preparingPitchV99) {
        swallow(event);
        flow.queued = true;
        flow.run = true;
        flow.busyAt = performance.now();
        return;
      }
      if (view.lastResult && endsPlate(view.lastResult) && sceneEnded(view)) endPlateOrders(view);
      flow.run = true;
      flow.busyAt = performance.now();
    }
  }, true);
  /* Stepping and jumping are stops too, so they wait until the manager has stopped. */
  ['next-pitch', 'previous-pitch'].forEach(id => $('#' + id).addEventListener('click', event => {
    if (!managerOn()) return;
    if (flow.run && !flow.held) { swallow(event); say('先にストップしてください。'); return; }
    const view = readView();
    const history = (view && view.host && view.host.history) || [];
    if (id === 'next-pitch' && endsPlate(history[history.length - 1]) && (!view.lastResult || view.selectedPitch === history.length - 1)) endPlateOrders(view);
  }, true));
  $('#finish-game').addEventListener('click', () => {
    const view = readView();
    if (!managerOn() || !view || view.fast) return;
    endPlateOrders(view, true);
    flow.held = null;
    flow.run = false;
  }, true);
  $('#new-game').addEventListener('click', newGameFlow, true);
  $('#managed-team').addEventListener('change', () => { flow.sustain = null; flow.once = false; flow.scope = 'plate'; schedule(true); });

  /* ---------- Card effect: playManagerCardFx(cardId, context) returns a promise that settles when it is over ----------
     The default is a short banner over the picture. Replace window.playManagerCardFx to change it; the match waits
     for the promise (at most FX_LIMIT_MS), then goes on. context = { deck, cardId, name, note, button, stage, ms }. */
  function defaultCardFx(cardId, context) {
    return new Promise(resolve => {
      const stage = (context && context.stage) || $('.broadcast');
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      const fx = document.createElement('div');
      fx.className = 'card-fx';
      fx.dataset.card = cardId;
      fx.dataset.deck = (context && context.deck) || '';
      const name = document.createElement('b'), note = document.createElement('span');
      name.textContent = (context && context.name) || '';
      note.textContent = (context && context.note) || '';
      fx.append(name, note);
      stage.append(fx);
      setTimeout(() => { fx.remove(); resolve(); }, reduce ? 150 : FX_MS);
    });
  }
  if (typeof globalThis.playManagerCardFx !== 'function') globalThis.playManagerCardFx = defaultCardFx;

  function runCardFx(card, deck) {
    const row = $('.card-row');
    row.dataset.fx = card.id;
    const context = { deck, cardId: card.id, name: card.name.replace('<br>', ''), note: card.note, button: $('.tactic[data-id="' + card.id + '"]', row), stage: $('.broadcast'), ms: FX_MS };
    let timer = 0;
    const limit = new Promise(resolve => { timer = setTimeout(resolve, FX_LIMIT_MS); });
    const effect = new Promise(resolve => resolve(globalThis.playManagerCardFx(card.id, context)));
    return Promise.race([effect, limit]).catch(() => {}).then(() => { clearTimeout(timer); delete row.dataset.fx; });
  }
  /* Tapping a card chooses it, plays its effect, then lets the match go on. */
  function playCard(card) {
    if (!card || flow.fxBusy || flow.run) return;
    const deck = $('.tactic[data-id="' + card.id + '"]').dataset.deck, token = ++flow.fxToken;
    state.hint = card.id;
    state.pick[deck] = card.id;
    applyCard(card, deck, false);
    if (flow.scope === 'inning') {
      if (card.hold) { flow.sustain = { deck, id: card.id, key: halfKey(readView()) }; flow.once = false; }
      else flow.once = true;
    }
    renderHand();
    flow.fxBusy = true;
    runCardFx(card, deck).then(() => {
      flow.fxBusy = false;
      if (token === flow.fxToken) proceed();
    });
  }
  function onRunButton() {
    const mode = $('.run-row').dataset.run;
    if (mode === 'running') $('#play').click();
    else if (mode === 'idle' || mode === 'stopped' || mode === 'held') { flow.fxToken += 1; proceed(); }
  }

  /* Where the match is: idle (not started), running, held (waiting at the first pitch of a plate appearance),
     stopped (by the manager), fast (calculating the rest) or over. */
  function renderRun(view) {
    const hand = $('.hand-deck'), row = $('.run-row');
    if (!hand || !row || !managerOn()) return;
    const mode = finished() ? 'over' : view && view.fast ? 'fast' : flow.held ? 'held' : flow.run ? 'running' : !view || !view.host || view.host.pitchCount === 0 ? 'idle' : 'stopped';
    if (mode !== flow.mode) {
      flow.mode = mode;
      hand.dataset.run = mode;
      document.body.dataset.run = mode === 'running' ? '1' : '';
      if (mode === 'running' && hand.dataset.state === 'orders') closeOrders();
      tuck(mode === 'running');
      ['pa-select', 'inning-select', 'restart', 'managed-team'].forEach(id => { const node = $('#' + id); if (node) node.disabled = mode === 'running'; });
      schedule(true);
    }
    const thrown = mode === 'running' && view ? pitchesThrown(view) : 0, auto = mode === 'running' && !!view && lastPitchFlying(view);
    const blocked = mode === 'running' && ((auto && !!view && willHold(view)) || (auto && flow.gapStop) || (!auto && thrown > 0 && flow.stopsLeft <= 0));
    let text = { idle: '試合前です。カードを選ぶか、このまま始めます。', held: '打席の頭で停止中。カードを選ぶと試合が進みます。', stopped: 'ストップ中。カードを変えられます。', fast: 'Coreで残りを計算中です。', over: '' }[mode] || '';
    const hold = auto && !!view && willHold(view), queuedStop = auto && !hold && flow.gapStop;
    if (mode === 'running') text = hold ? '結果が出ると、次の打席の前で自動で止まります。' : queuedStop ? '結果が出たら止まります。ストップには数えません。' : auto ? '試合進行中。いまストップすると打席の終わりで止まります（数えません）。' : blocked ? 'ストップを使い切りました。この打席は止められません。' : thrown === 0 ? '試合進行中。いまのストップは数えません。' : '試合進行中';
    const noticed = !!flow.notice && performance.now() - flow.noticeAt < NOTICE_MS;
    if (noticed) text = flow.notice;
    const label = { idle: '試合を進める', held: 'このまま進める', stopped: '再開', running: 'ストップ' }[mode] || '';
    const key = [mode, flow.stopsLeft, blocked, text, label, flow.cardMode].join('|');
    if (key === flow.shown) return;
    flow.shown = key;
    row.dataset.run = mode;
    row.dataset.notice = noticed ? '1' : '';
    $('.run-state', row).textContent = text;
    $('.run-stops b', row).textContent = flow.stopsLeft + '/' + STOPS_PER_GAME;
    $('.run-stops', row).setAttribute('aria-label', 'ストップ残り' + flow.stopsLeft + '回');
    $$('.pips i', row).forEach((pip, i) => pip.classList.toggle('on', i < flow.stopsLeft));
    const button = $('.run-btn', row);
    button.textContent = label;
    button.disabled = !label || blocked;
    $('.open-detail-orders').disabled = mode === 'running';
    $('.hand-toggle').hidden = mode === 'running';
  }

  function syncFlow(view) {
    if (!view || !view.host) return;
    const now = performance.now(), count = view.host.pitchCount;
    if (count < flow.lastPitchCount) newGameFlow();
    flow.lastPitchCount = count;
    const busy = !!(view.playing || view.preparingPitchV99), generating = !!(view.generationV116 && view.generationV116.pending);
    if (flow.held && !view.preparingPitchV99) flow.held = null;
    if (flow.queued && !generating) {
      flow.queued = false;
      flow.run = false;
      $('#play').click();
    }
    if (busy && !flow.held) { flow.run = true; flow.busyAt = now; }
    else if (flow.run && generating) flow.busyAt = now;
    if (view.host.finished || view.fast || view.error) flow.run = false;
    else if (flow.run && !busy && now - flow.busyAt > RUN_GRACE_MS) flow.run = false;
    /* The records the stats are built from change when a result becomes official, not only when a pitch is made. */
    const key = count + '|' + view.selectedPitch + '|' + !!officialRecord(view);
    if (key !== flow.statKey) { flow.statKey = key; schedule(true); }
    renderRun(view);
  }

  /* ---------- Refresh: only when what is on screen changed ---------- */
  let timer = 0;
  function signature() {
    return [$('#match-progress').textContent, $('#inning-label').textContent, $('#pitch-number').textContent, $('#result-text').textContent,
      $('#bso').textContent, $$('#bases .on').map(b => b.dataset.base).join(''), $('#batter-name').textContent, $('#pitcher-name').textContent,
      $('#managed-team').value, ['batting-choice', 'direction-choice', 'pitch-choice', 'location-choice', 'baserunning-choice'].map(id => selectOf(id).value).join('/'),
      selectOf('pitch-choice').options.length].join('|');
  }
  function refresh(force) {
    timer = 0;
    const key = signature();
    if (!force && key === state.lastKey) return;
    state.lastKey = key;
    const snap = live();
    updateEmotions(snap);
    if (document.body.dataset.mode !== 'manager') return;
    renderHand();
    if ($('.hand-deck').dataset.state === 'orders') renderOrders();
    renderPlayerStats(snap);
    renderHitWindow(snap);
    if ($('#detail-sheet').open) renderTab(state.detailTab);
  }
  function schedule(force) {
    if (force) state.lastKey = '';
    if (!timer) timer = setTimeout(() => refresh(false), 60);
  }

  buildHand();
  buildDetail();
  buildHitWindow();
  buildPlayerStats();
  buildModeSwitch();
  schedule(true);

  addEventListener('resize', () => { if ($('.hand-deck').dataset.state === 'orders') sizeOrders(); });

  const watch = [$('.play-status'), $('#phase'), $('#match-progress'), $('#inning-label')];
  const observer = new MutationObserver(() => schedule(false));
  watch.forEach(node => node && observer.observe(node, { childList: true, characterData: true, subtree: true }));
  observer.observe($('#bases'), { attributes: true, attributeFilter: ['class'], subtree: true });
  new MutationObserver(() => applyEmotions())
    .observe($('#actor-labels'), { childList: true, characterData: true, subtree: true });
  ['managed-team', 'batting-choice', 'direction-choice', 'pitch-choice', 'location-choice', 'baserunning-choice', 'home-pitcher-choice'].forEach(id => {
    const select = selectOf(id);
    if (select) select.addEventListener('change', () => schedule(true));
  });

  /* The match asks this before it generates the first pitch of each plate appearance (parts/090). */
  globalThis.KneekuraManagerGateV1 = Object.freeze({ holdBeforePitch });
  globalThis.KneekuraManagerUiV1 = Object.freeze({
    refresh: () => refresh(true), emotions: () => [...emotionById.entries()], analyze: () => analyze((live() || { history: [] }).history),
    defaultCardFx, flow: () => ({ mode: flow.mode, held: !!flow.held, run: flow.run, stopsLeft: flow.stopsLeft, scope: flow.scope, cardMode: flow.cardMode, kept: flow.sustain ? flow.sustain.id : null, once: flow.once, gapStop: flow.gapStop })
  });
})();
