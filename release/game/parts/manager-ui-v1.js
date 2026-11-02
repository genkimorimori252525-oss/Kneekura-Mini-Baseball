/* Manager-mode match screen (owner-approved design, 2026-11-02), driven by the live match.
   Display and input only: it reads the Core record through window.liveMatchPlayback.inspect() and
   writes the existing instruction controls (#batting-choice, #pitch-choice, #location-choice,
   #baserunning-choice). Nothing is sent to the Core except what those controls already send.
   Parts of the design that have no data or no function yet are not drawn. */
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
  function live() {
    const playback = window.liveMatchPlayback;
    if (!playback || typeof playback.inspect !== 'function') return null;
    try {
      const view = playback.inspect();
      const history = view.host && view.host.history ? view.host.history : [];
      return { host: view.host, history, shown: view.lastResult || history[history.length - 1] || null, selectedRecord: view.lastResult || null };
    } catch (error) { return null; }
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
  const innerCol = hand => (hand === 'L' ? 2 : 0);
  const outerCol = hand => (hand === 'L' ? 0 : 2);

  /* Cards exist only where an instruction control exists: ctl = [select id, option value]. */
  const DECK = {
    batter: [
      { id: 'auto', name: 'おまかせ', note: '打者の判断に任せます。', portrait: '#batter-portrait', ctl: ['batting-choice', 'auto'] },
      { id: 'bunt', name: '送り<br>バント', note: '走者を次の塁へ進めます。', ctl: ['batting-choice', 'bunt'], needs: s => (s.first || s.second) && s.outs < 2, icon: () => { const c = fan(); c.block(8, 16, 2, 1, GOLD); arrow(c, 13, 15, 10, 12, CREAM); return c.svg(); } },
      { id: 'safety', name: 'セーフティ<br>バント', note: '打者が生きることを狙うバントです。', ctl: ['batting-choice', 'bunt'], needs: s => !((s.first || s.second) && s.outs < 2), icon: () => { const c = fan(); c.block(7, 16, 2, 1, GOLD); arrow(c, 10, 18, 13, 15, CREAM); return c.svg(); } }
    ],
    pitcher: [
      { id: 'auto', name: 'コース<br>おまかせ', note: '捕手の配球に任せます。', portrait: '#pitcher-portrait', ctl: ['location-choice', 'auto'] },
      { id: 'inside', name: '内角中心', note: '打者の内側を攻めます。', ctl: ['location-choice', 'inside'], icon: h => zone((r, col) => col === innerCol(h)).svg() },
      { id: 'outside', name: '外角中心', note: '打者の外側を攻めます。', ctl: ['location-choice', 'outside'], icon: h => zone((r, col) => col === outerCol(h)).svg() },
      { id: 'strike', name: 'ストライク<br>をとれ', note: 'ゾーンに投げ、四球を避けます。', ctl: ['location-choice', 'zone'], icon: () => zone(() => true).svg() },
      { id: 'low', name: '低め中心', note: '低めへ集めて長打を防ぎます。', ctl: ['location-choice', 'low'], icon: () => zone(r => r === 2).svg() }
    ]
  };

  /* Detail orders: one row per existing control, options read from the control itself. */
  const DETAIL = {
    batter: [['打者', [['振り方', 'batting-choice']]], ['走者', [['走塁', 'baserunning-choice']]]],
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
    row.innerHTML = cards.map(card => (
      '<button type="button" class="tactic" data-deck="' + deck + '" data-id="' + card.id + '" aria-pressed="' + (card === chosen) + '">' +
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
    $('.hand-title span').textContent = over ? '' : orders ? '作戦カードより優先します。' : hint ? hint.note : '詳細指示で選んだ内容を使います。';
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
      '<div class="card-row"></div><div class="orders-panel" role="region" aria-label="詳細指示"></div>';
    $('.broadcast').after(hand);
    hand.addEventListener('click', event => {
      const button = event.target.closest('.tactic');
      if (!button) return;
      const card = DECK[button.dataset.deck].find(c => c.id === button.dataset.id);
      state.hint = card.id;
      state.pick[button.dataset.deck] = card.id;
      setControl(card.ctl[0], card.ctl[1]);
      renderHand();
    });
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
      }).join('') + '</div><div class="orders-foot"><span class="orders-note">次の未生成の一球から有効</span>' +
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

  const slotRole = (team, index) => Object.keys(DATA.defenseMap[team]).find(role => DATA.defenseMap[team][role] === index) || 'DH';
  function lineupFor(team) {
    const rows = [];
    for (let i = 0; i < 9; i++) {
      const player = PLAYERS[team + '-b' + i];
      if (player) rows.push({ id: team + '-b' + i, name: player.name, bats: player.bats, pos: slotRole(team, i), order: i + 1 });
    }
    const pitcherId = team === 1 && selectOf('home-pitcher-choice') ? selectOf('home-pitcher-choice').value : team + '-p0';
    const pitcher = PLAYERS[pitcherId] || PLAYERS[team + '-p0'];
    if (pitcher) rows.push({ id: pitcherId, name: pitcher.name, bats: pitcher.throws, pos: 'P', order: '' });
    return rows;
  }
  const handHint = bats => (bats === 'L' ? 'L' : bats === 'S' ? 'S' : 'R');

  function renderTab(name) {
    state.detailTab = name;
    const body = $('#detail-sheet .sheet-body'), snap = live(), stats = analyze(snap ? snap.history : []);
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
      )).join('') + '</div>').join('') + '</div><p class="box-note">線の色は右打・右投が赤、左が青、両打が緑です。</p>';
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
    if (!snap || !snap.history.length) { pitcherBox.innerHTML = ''; batterBox.innerHTML = ''; return; }
    const stats = analyze(snap.history), shown = snap.shown || {};
    const batterId = shown.batterPlayerId || snap.host.batterPlayerId, pitcherId = shown.pitcherPlayerId || snap.host.pitcherPlayerId;
    const b = stats.bat.get(batterId), p = stats.pit.get(pitcherId);
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
  /* Records up to and including the official one, never the pitch in flight. */
  function settledHistory(view, official) {
    const all = (view.host && view.host.history) || [];
    if (!view.lastResult) return all;
    const at = all.indexOf(view.lastResult);
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
  function updateFaces() {
    const playback = window.liveMatchPlayback;
    let view = { host: null, lastResult: null, currentFrame: null };
    try { if (playback && typeof playback.inspect === 'function') view = playback.inspect() || view; } catch (error) { /* keep plain portraits */ }
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
  setInterval(() => { if (!document.hidden) updateFaces(); }, 200);

  /* ---------- Screen mode: manager layout or the plain watching layout ---------- */
  function buildModeSwitch() {
    const grid = $('.settings-grid');
    if (!grid) return;
    const field = document.createElement('fieldset');
    field.innerHTML = '<legend>画面</legend><div class="appearance-buttons"><button type="button" data-ui-mode="manager" aria-pressed="true">監督モード</button><button type="button" data-ui-mode="watch" aria-pressed="false">観戦（従来の指示欄）</button></div>';
    grid.prepend(field);
    let mode = 'manager';
    try { if (localStorage.getItem('kneekura.uiMode.v1') === 'watch') mode = 'watch'; } catch (error) { /* storage may be unavailable */ }
    const apply = next => {
      mode = next;
      document.body.dataset.mode = mode;
      $$('[data-ui-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.uiMode === mode)));
      try { localStorage.setItem('kneekura.uiMode.v1', mode); } catch (error) { /* ignore */ }
      if (mode === 'manager') schedule(true);
    };
    field.addEventListener('click', event => { const b = event.target.closest('[data-ui-mode]'); if (b) apply(b.dataset.uiMode); });
    apply(mode);
  }

  /* ---------- Refresh: only when what is on screen changed ---------- */
  let timer = 0;
  function signature() {
    return [$('#match-progress').textContent, $('#inning-label').textContent, $('#pitch-number').textContent, $('#result-text').textContent,
      $('#bso').textContent, $$('#bases .on').map(b => b.dataset.base).join(''), $('#batter-name').textContent, $('#pitcher-name').textContent,
      $('#managed-team').value, ['batting-choice', 'pitch-choice', 'location-choice', 'baserunning-choice'].map(id => selectOf(id).value).join('/'),
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

  /* The hand lowers while the match runs and returns when it stops. */
  new MutationObserver(() => {
    if (document.body.dataset.mode !== 'manager') return;
    tuck($('#play').getAttribute('aria-pressed') === 'true');
  }).observe($('#play'), { attributes: true, attributeFilter: ['aria-pressed'] });
  addEventListener('resize', () => { if ($('.hand-deck').dataset.state === 'orders') sizeOrders(); });

  const watch = [$('.play-status'), $('#phase'), $('#match-progress'), $('#inning-label')];
  const observer = new MutationObserver(() => schedule(false));
  watch.forEach(node => node && observer.observe(node, { childList: true, characterData: true, subtree: true }));
  observer.observe($('#bases'), { attributes: true, attributeFilter: ['class'], subtree: true });
  new MutationObserver(() => applyEmotions())
    .observe($('#actor-labels'), { childList: true, characterData: true, subtree: true });
  ['managed-team', 'batting-choice', 'pitch-choice', 'location-choice', 'baserunning-choice', 'home-pitcher-choice'].forEach(id => {
    const select = selectOf(id);
    if (select) select.addEventListener('change', () => schedule(true));
  });

  globalThis.KneekuraManagerUiV1 = Object.freeze({ refresh: () => refresh(true), emotions: () => [...emotionById.entries()], analyze: () => analyze((live() || { history: [] }).history) });
})();
