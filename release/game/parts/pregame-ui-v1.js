/* Pre-game screen (owner-approved design, 2026-11-02), connected to the existing match settings.
   It only sets #managed-team, #stadium-choice, #home-pitcher-choice, #inning-limit, #match-seed and
   #fixed-seed, then presses the existing "new game" button. Anything the game has no setting for
   (batting order, positions, bench, time of day, roof) is not shown. */
(function () {
  'use strict';
  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => [...(root || document).querySelectorAll(selector)];
  const DATA = JSON.parse($('#match-data').textContent);
  const PLAYERS = Object.assign({ robin: { id: 'robin', name: 'ロビン', bats: 'R', throws: 'R' } }, DATA.players);
  const POS = { DH: '指', SS: '遊', '1B': '一', '2B': '二', '3B': '三', C: '捕', RF: '右', LF: '左', CF: '中', P: '投' };
  const safe = text => String(text).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Stand-side photographs from the park studio (night; domes closed). Local assets, not tracked. */
  const PHOTOS = {
    fukuoka: 'data:image/jpeg;base64,@@ASSET:5dc1e3fafbb063c2b895763c@@',
    tambov: 'data:image/jpeg;base64,@@ASSET:563aabdb51f2387eb22757bb@@',
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
    fixed: control('fixed-seed').checked
  };

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

  /* Lineups are the game's own; only the home starter can be chosen. */
  const slotRole = (team, index) => Object.keys(DATA.defenseMap[team]).find(role => DATA.defenseMap[team][role] === index) || 'DH';
  function row(player, pos, order, tag) {
    return '<div class="player-row fixed"><span class="order">' + order + '</span><span>' + (POS[pos] || '') + '</span>' +
      '<span class="side" data-hand="' + (player.bats === 'L' ? 'L' : player.bats === 'S' ? 'S' : 'R') + '"></span>' +
      '<span class="who">' + safe(player.name) + '</span><span class="tag">' + (tag || '') + '</span></div>';
  }
  function teamColumn(team) {
    const rows = [];
    for (let i = 0; i < 9; i++) { const p = PLAYERS[team + '-b' + i]; if (p) rows.push(row(p, slotRole(team, i), i + 1)); }
    const starter = team === 1 ? PLAYERS[pre.pitcher] || PLAYERS[team + '-p0'] : PLAYERS[team + '-p0'];
    return '<div><h3 class="team-title" data-team="' + DATA.teams[team] + '">' + DATA.teams[team] + '</h3>' + rows.join('') +
      '<div class="pitcher-gap"></div>' + (starter ? row({ name: starter.name, bats: starter.throws }, 'P', '', '先発') : '') + '</div>';
  }
  function renderLineup() {
    const options = [...control('home-pitcher-choice').options];
    $('.lineup-body').innerHTML = '<div class="order-table">' + teamColumn(0) + teamColumn(1) + '</div>' +
      (options.length > 1 ? '<div class="starter-pick"><span>' + DATA.teams[1] + ' の先発投手</span><div class="segments" role="group" aria-label="先発投手">' +
        options.map(o => '<button type="button" data-pitcher="' + safe(o.value) + '" aria-pressed="' + (o.value === pre.pitcher) + '">' + safe(o.textContent.trim()) + '</button>').join('') + '</div></div>' : '');
  }

  function summary() {
    $('.pg-start p').textContent = (pre.team ? pre.team + 'を指揮' : '観戦') + '　' + parkOf(pre.park).name + '　' + pre.innings + '回';
  }
  function render() {
    $$('.pg-command button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.command === String(pre.team))));
    $$('.park').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.park === pre.park)));
    $$('[data-innings]').forEach(b => b.setAttribute('aria-pressed', String(Number(b.dataset.innings) === pre.innings)));
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
      '<details class="pg-more"><summary>乱数の設定</summary><div class="pg-more-fields"><label>シード <input type="text" class="pg-seed" maxlength="32" spellcheck="false"></label>' +
      '<label><input type="checkbox" class="pg-fixed"> 同じシードで再現</label></div></details></div>' +
      '<div class="pg-start"><p></p><button type="button" class="pg-go">試合開始</button></div>';
    $('.masthead').after(page);
    $('.pg-seed', page).value = pre.seed;
    $('.pg-fixed', page).checked = pre.fixed;

    page.addEventListener('click', event => {
      const button = event.target.closest('button');
      if (!button) return;
      if (button.dataset.command) pre.team = button.dataset.command === 'null' ? null : button.dataset.command;
      else if (button.dataset.park) pre.park = button.dataset.park;
      else if (button.dataset.innings) pre.innings = Number(button.dataset.innings);
      else if (button.dataset.pitcher) pre.pitcher = button.dataset.pitcher;
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

  /* Automated browsers (the release test scripts) and #match go straight to the match; #pregame forces the setup. */
  const startScreen = location.hash === '#pregame' ? 'pregame' : location.hash === '#match' || navigator.webdriver ? 'match' : 'pregame';
  build();
  updateHeading();
  render();
  setScreen(startScreen);
})();
