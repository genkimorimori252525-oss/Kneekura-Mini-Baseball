/* Pre-game screen (owner-approved design, 2026-11-02), connected to the existing match settings.
   It sets #managed-team, #stadium-choice, #home-pitcher-choice, #inning-limit, #match-seed and #fixed-seed,
   then presses the existing "new game" button. The batting order and positions the owner arranged are read
   from KneekuraPregameLineupV1.team(index). Bench names are placeholders until the roster has a bench, so
   they show but cannot enter. Time of day and roof have no setting in the game and are not shown. */
(function () {
  'use strict';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const DATA = JSON.parse($('#match-data').textContent);
  const PLAYERS = Object.assign({ robin: { id: 'robin', name: 'ロビン', bats: 'R', throws: 'R' } }, DATA.players);
  const POS = { DH: '指', SS: '遊', '1B': '一', '2B': '二', '3B': '三', C: '捕', RF: '右', LF: '左', CF: '中', P: '投' };
  const safe = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Stand-side photographs from the park studio (night). Tambov's roof is open: closed, the photograph shows only
     the roof. Local assets, not tracked. */
  const PHOTOS = {
    fukuoka: 'data:image/jpeg;base64,@@ASSET:5dc1e3fafbb063c2b895763c@@',
    tambov: 'data:image/jpeg;base64,@@ASSET:29a437959ee3418672b7faa6@@',
    niikura: 'data:image/jpeg;base64,@@ASSET:44b5c5bd99fb5c6b60f53cc8@@',
    koshien: 'data:image/jpeg;base64,@@ASSET:89a12ae0010f12337cd81f18@@',
    dodger: 'data:image/jpeg;base64,@@ASSET:fb4f59c8e76fd20caa81a58b@@',
    core: 'data:image/jpeg;base64,@@ASSET:436003d658c355662d663cbc@@'
  };

  /* Facts are the park's preset in the park studio (tools/ballpark-studio/model.mjs). A missing field is not shown. */
  const PARKS = [
    { id: 'fukuoka', name: '福岡', full: 'みずほPayPayドーム福岡', kind: '開閉ドーム', seats: '39,894人・3層', roof: '3枚の屋根が開閉',
      center: 122, line: 100, wall: '4.2m', back: 20, side: 32, note: 'テラス・屋根・座席は写真を基にした近似です。' },
    { id: 'tambov', name: 'タンボフ', full: 'タンボフのドーム', kind: '開閉ドーム', seats: '120,000人・5層', roof: '赤・青・金の開閉式',
      center: 128, line: 105, wall: '1.3m', back: 26, side: 18.3, note: '両翼105m・フェンス1.3mは仮設定です。' },
    { id: 'niikura', name: 'にーくら', full: 'にーくらドーム', kind: '開口ドーム', seats: '76,000人・2層', roof: '中央が開いた固定膜',
      center: 142, line: 94.5, wall: '3m', back: 8.2, side: 12, note: 'フェンス3m・定員76,000人は暫定値です。' },
    { id: 'koshien', name: '甲子園', full: '阪神甲子園球場', kind: '屋外・銀傘', seats: '47,400人・3層', roof: '銀傘が内野席を覆う',
      center: 118, line: 95, wall: '3m', back: 18.4, side: 28, note: '中間距離・フェンス高・建築は近似です。' },
    { id: 'dodger', name: 'ドジャー', full: 'ドジャースタジアム', kind: '屋外', seats: '56,000人・5層', roof: 'なし',
      center: 120.4, line: 100.6, wall: '2.4m（両翼1.4m）', back: 23, side: 24, note: '客席・照明・ファウル側の形と一部の壁高は写真からの近似です。' },
    { id: 'core', name: '標準球場', full: '標準球場', kind: '客席なし', seats: 'なし', roof: 'なし',
      center: 110, wall: '3m', note: '建築のない円形の基準球場です。' }
  ];
  const parkOf = id => PARKS.find(p => p.id === id);
  const control = id => document.getElementById(id);

  const pre = {
    team: control('managed-team').value === '0' ? 'LAD' : 'TBD',
    park: parkOf(control('stadium-choice').value) ? control('stadium-choice').value : 'fukuoka',
    innings: Number(control('inning-limit').value) || 9,
    pitcher: control('home-pitcher-choice').value,
    seed: control('match-seed').value,
    fixed: control('fixed-seed').checked,
    swap: 'order',
    selected: null,
    kit: null
  };
  /* The Dragons' uniform: chosen before the match; until then home at their own park, away elsewhere. The Dodgers wear
     the other one. The art bank reads it through KneekuraUniformV1. */
  const kitFor = () => pre.kit || (pre.park === 'tambov' ? 'home' : 'away');
  let matchKit = kitFor();
  globalThis.KneekuraUniformV1 = Object.freeze({ tbd: () => matchKit, lad: () => (matchKit === 'home' ? 'away' : 'home') });

  function parkFacts(park) {
    const rows = [];
    if (park.center) rows.push(['広さ', '中堅 ' + Math.round(park.center) + 'm' + (park.line ? '・両翼 ' + Math.round(park.line) + 'm' : '')]);
    if (park.wall) rows.push(['フェンス', park.wall]);
    if (park.back) rows.push(['客席まで', '本塁後方 ' + park.back + 'm・塁側 ' + park.side + 'm']);
    if (park.seats) rows.push(['定員', park.seats]);
    if (park.roof) rows.push(['屋根', park.roof]);
    return rows.map(([label, value]) => '<div><dt>' + label + '</dt><dd>' + value + '</dd></div>').join('');
  }
  function renderPark() {
    const park = parkOf(pre.park);
    $$('.park img').forEach(image => { image.src = PHOTOS[image.closest('.park').dataset.park]; });
    $('.park-detail').innerHTML = '<img src="' + PHOTOS[park.id] + '" alt="' + park.full + 'のスタンドからの眺め"><div class="park-info"><h3>' + park.full + '</h3>' +
      '<dl>' + parkFacts(park) + '</dl><p>' + park.note + '</p></div>';
  }

  /* One gesture for every change: pick a player, then who they trade places with. */
  const slotRole = (team, index) => Object.keys(DATA.defenseMap[team]).find(role => DATA.defenseMap[team][role] === index) || 'DH';
  const BENCH = [['控え内野手A', 'R', '内'], ['控え外野手A', 'L', '外'], ['控え捕手A', 'R', '捕'], ['控え外野手B', 'S', '外']];
  const BULLPEN = [['控え投手A', 'R', '中継ぎ'], ['控え投手B', 'L', '中継ぎ'], ['控え投手C', 'R', '抑え']];
  const startingLineup = team => {
    const order = Array.from({ length: 9 }, (_, i) => team + '-b' + i);
    return { order, roles: Object.fromEntries(order.map((id, i) => [id, slotRole(team, i)])) };
  };
  const lineups = [startingLineup(0), startingLineup(1)];
  const commandedTeam = () => (pre.team ? DATA.teams.indexOf(pre.team) : -1);
  const starterOf = team => (team === 1 ? PLAYERS[pre.pitcher] || PLAYERS[team + '-p0'] : PLAYERS[team + '-p0']);
  function cells(player, pos, order, tag) {
    return '<span class="order">' + order + '</span><span>' + (POS[pos] || '') + '</span>' +
      '<span class="side" data-hand="' + (player.bats === 'L' ? 'L' : player.bats === 'S' ? 'S' : 'R') + '"></span>' +
      '<span class="who">' + safe(player.name) + '</span><span class="tag">' + (tag || '') + '</span>';
  }
  const row = (player, pos, order, tag) => '<div class="player-row fixed">' + cells(player, pos, order, tag) + '</div>';
  function teamRows(team) {
    const line = lineups[team], rows = line.order.map((id, i) => (PLAYERS[id] ? row(PLAYERS[id], line.roles[id], i + 1) : '')), starter = starterOf(team);
    return rows.join('') + (starter ? row({ name: starter.name, bats: starter.throws }, 'P', '', '先発') : '');
  }
  function benchRow([name, hand, role], attributes, pitcher) {
    const side = hand === 'L' ? '左' : hand === 'S' ? '両' : '右';
    return '<button type="button" class="player-row" ' + attributes + '><span></span><span></span><span class="side" data-hand="' + hand + '"></span>' +
      '<span class="who">' + safe(name) + '<small>' + side + (pitcher ? '投' : '打') + '　' + role + '</small></span><span class="tag"></span></button>';
  }
  function hintText() {
    if (pre.selected === null) return pre.swap === 'order' ? '打順を入れ替える2人を選びます。' : '守備位置を入れ替える2人を選びます。';
    if (pre.selected === 'P') return '先発にする投手を選びます。';
    return pre.swap === 'order' ? '入れ替える相手を選びます。' : '守備位置を入れ替える相手を選びます。';
  }
  function renderLineup() {
    const box = $('.lineup-body'), team = commandedTeam();
    if (team < 0) {
      const options = [...control('home-pitcher-choice').options];
      box.innerHTML = '<div class="rival-list">' + [0, 1].map(t => '<div><h3 class="team-title" data-team="' + DATA.teams[t] + '">' + DATA.teams[t] + '</h3>' + teamRows(t) + '</div>').join('') + '</div>' +
        (options.length > 1 ? '<div class="starter-pick"><span>' + DATA.teams[1] + ' の先発投手</span><div class="segments" role="group" aria-label="先発投手">' +
          options.map(o => '<button type="button" data-pitcher="' + safe(o.value) + '" aria-pressed="' + (o.value === pre.pitcher) + '">' + safe(o.textContent.trim()) + '</button>').join('') + '</div></div>' : '');
      return;
    }
    const line = lineups[team], onPitcher = pre.selected === 'P', starter = starterOf(team);
    const rivals = team === 1 ? [...control('home-pitcher-choice').options].filter(o => o.value !== pre.pitcher) : [];
    const list = onPitcher
      ? rivals.map(o => benchRow([o.textContent.trim(), (PLAYERS[o.value] || {}).throws === 'L' ? 'L' : 'R', '先発'], 'data-pitcher="' + safe(o.value) + '"', true)).join('') + BULLPEN.map(p => benchRow(p, 'disabled', true)).join('')
      : BENCH.map(p => benchRow(p, 'disabled', false)).join('');
    box.innerHTML = '<div class="lineup-tools"><div class="segments" role="group" aria-label="入れ替える内容">' +
      '<button type="button" data-swap="order" aria-pressed="' + (pre.swap === 'order') + '">打順</button>' +
      '<button type="button" data-swap="position" aria-pressed="' + (pre.swap === 'position') + '">守備位置</button></div>' +
      '<button type="button" class="reset-lineup">初期のオーダーに戻す</button></div>' +
      '<p class="lineup-hint">' + hintText() + '</p><div class="change-grid"><div class="change-column"><h3>' + DATA.teams[team] + ' のスタメン</h3>' +
      line.order.map((id, i) => '<button type="button" class="player-row" data-slot="' + i + '" aria-pressed="' + (pre.selected === i) + '">' + cells(PLAYERS[id], line.roles[id], i + 1) + '</button>').join('') +
      '<div class="pitcher-gap"></div><button type="button" class="player-row" data-slot="P" aria-pressed="' + onPitcher + '">' + cells({ name: starter.name, bats: starter.throws }, 'P', '', '先発') + '</button>' +
      '</div><div class="change-column"><h3>' + (onPitcher ? '控えの投手' : '控えの野手') + '</h3>' + list + '<p class="box-note">控えの名前は枠の見本です。</p></div></div>' +
      '<details class="rival"><summary>' + DATA.teams[1 - team] + ' のスタメンを見る</summary><div class="rival-list">' + teamRows(1 - team) + '</div></details>';
  }
  function pickRow(slot) {
    const line = lineups[commandedTeam()];
    if (pre.selected === null || slot === 'P' || pre.selected === 'P') {
      pre.selected = pre.selected === slot ? null : slot;
      return;
    }
    if (pre.selected !== slot) {
      const a = line.order[pre.selected], b = line.order[slot];
      if (pre.swap === 'order') { line.order[pre.selected] = b; line.order[slot] = a; }
      else [line.roles[a], line.roles[b]] = [line.roles[b], line.roles[a]];
    }
    pre.selected = null;
  }
  /* What the match builds its team from: the batting order and who plays where (the pitcher is set apart). */
  globalThis.KneekuraPregameLineupV1 = Object.freeze({
    team(index) {
      const line = lineups[index], defense = {};
      for (const id of line.order) if (line.roles[id] !== 'DH') defense[line.roles[id]] = id;
      return { battingOrder: line.order.slice(), defense };
    }
  });

  function summary() {
    $('.pg-start p').textContent = (pre.team ? pre.team + 'を指揮' : '観戦') + '　' + parkOf(pre.park).name + '　' + pre.innings + '回';
  }
  function render() {
    $$('.pg-command button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.command === String(pre.team))));
    $$('.park').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.park === pre.park)));
    $$('[data-innings]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.innings) === pre.innings)));
    $$('[data-kit]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.kit === kitFor())));
    renderPark();
    renderLineup();
    summary();
  }

  function setScreen(name) {
    document.body.dataset.screen = name;
    dispatchEvent(new Event('resize'));
  }
  function setControl(id, value) {
    const element = control(id);
    if (element.value === value) return;
    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function updateHeading() {
    const park = parkOf(control('stadium-choice').value);
    const label = $('.match-heading > span');
    if (park && label) label.textContent = park.full + ' / 2025 LAD';
  }

  function startMatch() {
    setControl('stadium-choice', pre.park);
    setControl('home-pitcher-choice', pre.pitcher);
    control('inning-limit').value = String(pre.innings);
    control('match-seed').value = pre.seed;
    control('fixed-seed').checked = pre.fixed;
    matchKit = kitFor();
    const mode = $(pre.team ? '[data-ui-mode="manager"]' : '[data-ui-mode="watch"]');
    if (mode) mode.click();
    if (pre.team) setControl('managed-team', pre.team === 'LAD' ? '0' : '1');
    updateHeading();
    setScreen('match');
    control('new-game').click();
    scrollTo(0, 0);
  }

  function build() {
    const page = document.createElement('section');
    page.className = 'pregame';
    page.setAttribute('aria-label', '試合の準備');
    page.innerHTML = '<div class="pg-card"><div class="pg-team"><strong>' + DATA.teams[0] + '</strong><span>ビジター</span></div><span class="pg-vs">vs</span><div class="pg-team"><strong>' + DATA.teams[1] + '</strong><span>ホーム</span></div></div>' +
      '<div class="pg-section"><h2>遊び方</h2><div class="pg-command">' +
      '<button type="button" data-command="TBD">TBDを指揮<small>ホーム</small></button>' +
      '<button type="button" data-command="LAD">LADを指揮<small>ビジター</small></button>' +
      '<button type="button" data-command="null">観戦する<small>指示なし</small></button></div></div>' +
      '<div class="pg-section"><h2>球場</h2><div class="park-row">' +
      PARKS.map(park => '<button type="button" class="park" data-park="' + park.id + '" aria-pressed="false"><img alt=""><span class="name">' + park.name + '</span><span class="size">' + park.kind + '</span></button>').join('') +
      '</div><div class="park-detail"></div></div><div class="pg-section"><h2>スタメン</h2><div class="lineup-body"></div></div>' +
      '<div class="pg-section"><h2>試合の長さ</h2><div class="pg-length"><div class="segments" role="group" aria-label="試合の長さ">' +
      [...control('inning-limit').options].map(o => '<button type="button" data-innings="' + safe(o.value) + '">' + safe(o.textContent.trim()) + '</button>').join('') + '</div></div>' +
      '<h2>' + DATA.teams[1] + 'のユニフォーム</h2><div class="pg-length"><div class="segments" role="group" aria-label="ユニフォーム">' +
      '<button type="button" data-kit="home">ホーム（黄）</button><button type="button" data-kit="away">アウェー（紺）</button></div></div>' +
      '<details class="pg-more"><summary>乱数の設定</summary><div class="pg-more-fields"><label>シード <input type="text" class="pg-seed" maxlength="32" spellcheck="false"></label>' +
      '<label><input type="checkbox" class="pg-fixed"> 同じシードで再現</label></div></details></div>' +
      '<div class="pg-start"><p></p><button type="button" class="pg-go">試合開始</button></div>';
    $('.masthead').after(page);
    $('.pg-seed', page).value = pre.seed;
    $('.pg-fixed', page).checked = pre.fixed;

    page.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.command) { pre.team = button.dataset.command === 'null' ? null : button.dataset.command; pre.selected = null; }
      else if (button.dataset.park) pre.park = button.dataset.park;
      else if (button.dataset.innings) pre.innings = Number(button.dataset.innings);
      else if (button.dataset.kit) pre.kit = button.dataset.kit;
      else if (button.dataset.pitcher) { pre.pitcher = button.dataset.pitcher; pre.selected = null; }
      else if (button.dataset.swap) { pre.swap = button.dataset.swap; pre.selected = null; }
      else if (button.dataset.slot !== undefined) pickRow(button.dataset.slot === 'P' ? 'P' : Number(button.dataset.slot));
      else if (button.classList.contains('reset-lineup')) { lineups[commandedTeam()] = startingLineup(commandedTeam()); pre.selected = null; }
      else if (button.classList.contains('pg-go')) { startMatch(); return; }
      render();
    });
    $('.pg-seed', page).addEventListener('input', event => { pre.seed = event.target.value; });
    $('.pg-fixed', page).addEventListener('change', event => { pre.fixed = event.target.checked; });

    /* A way back from the match: the existing "new game" button keeps starting a match at once. */
    const back = document.createElement('button');
    back.type = 'button';
    back.id = 'open-pregame';
    back.textContent = '試合前の設定へ';
    control('new-game').before(back);
    back.addEventListener('click', () => { render(); setScreen('pregame'); scrollTo(0, 0); });
    control('stadium-choice').addEventListener('change', updateHeading);
  }

  /* ---------- Substitutions in the match: the approved sheet. The roster has no bench yet, so nobody can enter. ---------- */
  function buildChanges() {
    const head = $('.hand-head');
    if (!head) return;
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'open-changes';
    open.textContent = '選手交代';
    head.querySelector('.open-detail-orders').before(open);
    const dialog = document.createElement('dialog');
    dialog.id = 'changes-sheet';
    dialog.className = 'sheet';
    dialog.setAttribute('aria-label', '選手交代');
    dialog.innerHTML = '<div class="sheet-frame"><div class="sheet-head"><h2>選手交代<small></small></h2><button type="button" class="sheet-close">閉じる</button></div><div class="sheet-body"></div><div class="sheet-foot"></div></div>';
    document.body.append(dialog);
    let selected = null;
    const draw = () => {
      const team = Number(control('managed-team').value), view = window.liveMatchPlayback.inspect(), match = view.host && view.host.match, frame = view.host && view.host.frame;
      const attacking = !!match && (match.half === 'bottom') === (team === 1), batter = frame && frame.batterPlayerId, line = lineups[team];
      const bases = Object.entries((match && match.bases) || {}).filter(([, id]) => id), baseName = { first: '一塁', second: '二塁', third: '三塁' };
      const tagOf = id => (attacking && id === batter ? '打席' : attacking ? (baseName[(bases.find(([, runner]) => runner === id) || [])[0]] || '') : '');
      if (selected === null) selected = attacking ? Math.max(0, line.order.indexOf(batter)) : 'P';
      const onPitcher = selected === 'P', starter = starterOf(team), kind = onPitcher ? '投手交代' : !attacking ? '守備交代' : line.order[selected] === batter ? '代打' : tagOf(line.order[selected]) ? '代走' : '交代';
      $('h2 small', dialog).textContent = DATA.teams[team] + '　' + (attacking ? '攻撃中' : '守備中');
      $('.sheet-body', dialog).innerHTML = '<div class="change-grid"><div class="change-column"><h3>下げる選手</h3>' +
        line.order.map((id, i) => '<button type="button" class="player-row" data-slot="' + i + '" aria-pressed="' + (selected === i) + '">' + cells(PLAYERS[id], line.roles[id], i + 1, tagOf(id)) + '</button>').join('') +
        '<div class="pitcher-gap"></div><button type="button" class="player-row" data-slot="P" aria-pressed="' + onPitcher + '">' + cells({ name: starter.name, bats: starter.throws }, 'P', '') + '</button></div>' +
        '<div class="change-column"><h3>' + kind + 'で出す選手</h3>' + (onPitcher ? BULLPEN : BENCH).map(p => benchRow(p, 'disabled', onPitcher)).join('') +
        '<p class="box-note">控えの名前は枠の見本です。控え選手が入ると交代できます。</p></div></div>';
      $('.sheet-foot', dialog).innerHTML = '<div class="pending-list"></div><button type="button" class="primary confirm-changes" disabled>交代を確定</button>';
    };
    open.addEventListener('click', () => { selected = null; draw(); dialog.showModal(); });
    dialog.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.classList.contains('sheet-close')) dialog.close();
      else if (button.dataset.slot !== undefined) { selected = button.dataset.slot === 'P' ? 'P' : Number(button.dataset.slot); draw(); }
    });
  }

  /* Automated browsers (the release test scripts) and #match go straight to the match; #pregame forces the setup. */
  const startScreen = location.hash === '#pregame' ? 'pregame' : location.hash === '#match' || navigator.webdriver ? 'match' : 'pregame';
  build();
  buildChanges();
  updateHeading();
  render();
  setScreen(startScreen);
})();
