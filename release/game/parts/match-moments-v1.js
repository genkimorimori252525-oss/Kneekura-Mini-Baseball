/* Match moments, read only: what the broadcast shows on top of the play. Nothing here reaches the Core.
   - steal and pickoff captions, worded like Sportsnavi's text play-by-play (M5)
   - which fielder wears the error balloon (M7; 032-script.js draws it)
   - how the crowd reacts (V7; 032-script.js swaps the held stadium pictures)
   - the stadium brightness setting (V2)
   - the short effect of each manager card (K1), on the card's own picture: window.playManagerCardFx(cardId, context) returns a promise */
(function () {
  'use strict';
  const DATA = JSON.parse(document.getElementById('match-data').textContent);
  const NAMES = Object.assign({ robin: 'ロビン' }, Object.fromEntries(Object.values(DATA.players).map(p => [p.id, p.name])));
  const BASES = { first: '一塁', second: '二塁', third: '三塁' }, NEXT = { first: '二塁', second: '三塁', third: '本塁' };
  const LOOK_MS = 80, CAPTION_MS = 3200, BALLOON_MS = 1800, POSE_MS = 87, POSES = [1, 0, 2, 0];
  const REACTION_MS = { homeRun: 5200, run: 3000, hit: 2000, out: 1300 };
  const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- What happened in one record, by tick ---------- */
  const momentsOf = new WeakMap();
  function baseOf(record, runnerId) {
    return Object.keys(BASES).find(base => record.beforeMatch && record.beforeMatch.bases && record.beforeMatch.bases[base] === runnerId);
  }
  function captionFor(event, record) {
    const base = baseOf(record, event.playerId), name = NAMES[event.playerId] || '';
    if (!base) return null;
    if (event.kind === 'stolen_base') return { kind: 'safe', text: BASES[base] + '走者 ' + name + ' :盗塁成功 ' + NEXT[base] };
    if (event.kind === 'caught_stealing') return { kind: 'out', text: BASES[base] + '走者 ' + name + ' :盗塁失敗 ' + NEXT[base] };
    if (event.kind === 'picked_off') return { kind: 'out', text: BASES[base] + 'けん制:ランナー ' + name + ' 戻りきれずタッチアウト！' };
    return null;
  }
  function reactionFor(record) {
    const play = record.play || {}, rules = play.rules || {}, half = record.beforeMatch && record.beforeMatch.half;
    if (!half) return null;
    const offense = half === 'bottom' ? 'home' : 'visitor', defense = offense === 'home' ? 'visitor' : 'home';
    const fence = play.field && play.field.ruleFacts && play.field.ruleFacts.overFence;
    if (play.classification === 'home_run' && fence) return { tick: fence.tick, fan: offense, ms: REACTION_MS.homeRun };
    if (rules.scoredRunnerIds && rules.scoredRunnerIds.length) return { tick: rules.endedAtTick, fan: offense, ms: REACTION_MS.run };
    if (play.localScoringV100 && play.localScoringV100.hits === 1) return { tick: play.localScoringV100.atTick, fan: offense, ms: REACTION_MS.hit };
    if (rules.outcomes && rules.outcomes.length) return { tick: rules.endedAtTick, fan: defense, ms: REACTION_MS.out };
    return null;
  }
  function moments(record) {
    let list = momentsOf.get(record);
    if (list) return list;
    list = [];
    for (const event of record.events || []) {
      const caption = Number.isFinite(event.tick) ? captionFor(event, record) : null;
      if (caption) list.push({ tick: event.tick, caption });
    }
    const local = record.play && record.play.localScoringV100;
    for (const error of (local && local.errors) || []) list.push({ tick: error.tick, fielderId: error.fielderId });
    const reaction = reactionFor(record);
    if (reaction && Number.isFinite(reaction.tick)) list.push({ tick: reaction.tick, reaction });
    /* The frames can stop just short of a fact's tick, so each moment waits for the last frame at or before it. */
    const ticks = (record.frames || []).map(frame => frame.tick);
    for (const moment of list) moment.tick = ticks.reduce((best, tick) => (tick <= moment.tick && tick > best ? tick : best), ticks.length ? Math.min(moment.tick, ticks[0]) : moment.tick);
    momentsOf.set(record, list);
    return list;
  }

  /* ---------- Following the picture ---------- */
  const fired = new WeakSet();
  let balloons = [], mood = null, lastAsked = 0, captionTimer = 0;
  const captionBox = document.createElement('div');
  captionBox.className = 'match-caption';
  captionBox.setAttribute('role', 'status');
  captionBox.hidden = true;
  function showCaption(caption) {
    captionBox.textContent = caption.text;
    captionBox.dataset.kind = caption.kind;
    captionBox.hidden = false;
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { captionBox.hidden = true; }, CAPTION_MS);
  }
  function fire(moment, now) {
    if (moment.caption) showCaption(moment.caption);
    if (moment.fielderId) balloons.push({ id: moment.fielderId, until: now + BALLOON_MS });
    if (moment.reaction) mood = { fan: moment.reaction.fan, from: now, until: now + moment.reaction.ms };
  }
  function look() {
    if (document.hidden) return;
    const playback = window.liveMatchPlayback;
    if (!playback || typeof playback.inspect !== 'function') return;
    let view;
    try { view = playback.inspect(); } catch (error) { return; }
    const record = view.lastResult, frame = view.currentFrame, now = performance.now();
    if (!record || !frame || view.fast) return;
    for (const moment of moments(record)) {
      if (frame.tick < moment.tick) fired.delete(moment);
      else if (!fired.has(moment)) { fired.add(moment); fire(moment, now); }
    }
  }
  setInterval(look, LOOK_MS);

  /* A paused match draws nothing by itself, so a reaction in progress asks for its own pictures. */
  function keepCrowdMoving() {
    if (mood && performance.now() - lastAsked > POSE_MS) dispatchEvent(new Event('kneekura:stadium-settled'));
    if (mood && performance.now() >= mood.until) { mood = null; dispatchEvent(new Event('kneekura:stadium-settled')); }
  }
  setInterval(keepCrowdMoving, POSE_MS);

  function crowdMood() {
    lastAsked = performance.now();
    if (!mood) return null;
    return { fan: mood.fan, frame: POSES[Math.floor((lastAsked - mood.from) / POSE_MS) % POSES.length] };
  }
  function errorFielders() {
    const now = performance.now();
    balloons = balloons.filter(balloon => balloon.until > now);
    return balloons.map(balloon => balloon.id);
  }

  /* ---------- Stadium brightness ---------- */
  const BRIGHTNESS_KEY = 'kneekura.stadiumBrightness.v1';
  let brightness = 1;
  try {
    const saved = Number(localStorage.getItem(BRIGHTNESS_KEY));
    if (saved >= .3 && saved <= 1) brightness = saved;
  } catch (error) { /* storage may be unavailable */ }
  function buildBrightness() {
    const grid = document.querySelector('.settings-grid');
    if (!grid) return;
    const field = document.createElement('fieldset');
    field.innerHTML = '<legend>球場の明るさ</legend><label class="stadium-brightness"><input id="stadium-brightness" type="range" min="30" max="100" step="5" aria-label="球場の明るさ"><output></output></label>';
    const input = field.querySelector('input'), output = field.querySelector('output');
    input.value = String(Math.round(brightness * 100));
    output.textContent = input.value + '%';
    input.addEventListener('input', () => {
      brightness = Number(input.value) / 100;
      output.textContent = input.value + '%';
      try { localStorage.setItem(BRIGHTNESS_KEY, String(brightness)); } catch (error) { /* ignore */ }
      dispatchEvent(new Event('kneekura:stadium-settled'));
    });
    grid.append(field);
  }

  function batterHand() {
    try {
      const view = window.liveMatchPlayback.inspect(), frame = view.currentFrame || (view.host && view.host.frame);
      const player = DATA.players[frame && frame.batterPlayerId];
      if (player && player.bats === 'L') return 'L';
    } catch (error) { /* a right-handed picture is fine */ }
    return 'R';
  }
  /* ---------- Card effects: the picture on the card itself moves, on the card's own 20 x 20 lattice ----------
     Three beats inside the card: the frame charges, the picture plays with a lit ball and its trail, and the play lands
     with a burst and a flash. The card itself glows in its deck colour and gives a small jolt at the landing. */
  const FX_MS = 900, FX_HOLD_MS = 150, SIDE = 20, ACT_FROM = .14, ACT_TO = .72;
  const clamp01 = t => Math.max(0, Math.min(1, t)), ease = t => 1 - (1 - t) * (1 - t);
  const along = (p, q, t) => [Math.round(p[0] + (q[0] - p[0]) * t), Math.round(p[1] + (q[1] - p[1]) * t)];
  const HOME = [10, 18], THIRD = [7, 15], FIRST = [13, 15], SECOND = [10, 12];
  const WHITE = '#ffffff', EMBER = '#8a6a2a', ICE = '#3f6584';
  const RAYS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

  function drawer(c, art) {
    const p = { c, hit: null };
    const ball = (at, color = WHITE, size = 2) => c.block(at[0] - (size >> 1), at[1] - (size >> 1), size, size, color);
    /* The ball with a short fading tail behind it. */
    const comet = (points, head, tail, color) => {
      for (let k = 1; k <= 4; k++) {
        const at = points(Math.max(0, head - k * .07));
        c.put(at[0], at[1], k < 2 ? tail : k < 4 ? color : EMBER);
      }
      ball(points(head));
    };
    Object.assign(p, {
      ball,
      /* A line that grows from p to q, the ball running at its head. */
      run(from, to, t, color = art.GOLD, step = 0) {
        const u = ease(clamp01(t)), at = along(from, to, u);
        if (u <= 0) return;
        c.line(from[0], from[1], at[0], at[1], u < 1 ? EMBER : color, step);
        if (u < 1) comet(v => along(from, to, v), u, art.CREAM, color);
        else { c.line(from[0], from[1], to[0], to[1], color, step); p.hit = to; }
      },
      /* The same through several points (a bouncing ball). */
      path(points, t) {
        const n = points.length - 1, u = ease(clamp01(t)), at = v => { const x = v * n, i = Math.min(n - 1, Math.floor(x)); return along(points[i], points[i + 1], x - i); };
        const i = Math.min(n - 1, Math.floor(u * n));
        for (let k = 0; k < i; k++) c.line(points[k][0], points[k][1], points[k + 1][0], points[k + 1][1], art.GOLD);
        const head = at(u);
        c.line(points[i][0], points[i][1], head[0], head[1], art.GOLD);
        if (u < 1) comet(at, u, art.CREAM, art.GOLD); else p.hit = points[n];
      },
      /* The pitch: from the mound at the top it grows as it comes in, with a cold tail. */
      pitch(to, t, color = WHITE) {
        const u = clamp01(t);
        if (u <= 0) return;
        const at = v => along([10, 1], to, ease(v));
        if (u < 1) {
          for (let k = 1; k <= 3; k++) { const q = at(Math.max(0, u - k * .08)); c.put(q[0], q[1], k === 1 ? art.COOL : ICE); }
          ball(at(u), color, 1 + Math.round(2 * u));
        } else { ball(to, color, 3); p.hit = to; }
      }
    });
    return p;
  }
  /* Each scene draws the card's picture for time t of its own beat and may name where the play lands (p.hit). */
  const BATTER_FX = {
    center: (art, t) => { const p = drawer(art.fan(), art); p.run(HOME, [10, 5], t); return p; },
    pull: (art, t, h) => { const p = drawer(art.fan(), art); p.run(HOME, [art.pullX(h), 7], t); return p; },
    oppo: (art, t, h) => { const p = drawer(art.fan(), art); p.run(HOME, [art.oppoX(h), 7], t); return p; },
    ground: (art, t, h) => { const p = drawer(art.fan(), art), s = h === 'L' ? 1 : -1; p.path([[10, 17], [10 + s, 13], [10 + 2 * s, 15], [10 + 3 * s, 11], [10 + 4 * s, 13], [10 + 5 * s, 9]], t); return p; },
    sacfly: (art, t) => { const p = drawer(art.fan(), art); p.run([10, 17], [10, 3], t / .55, art.GOLD, 2); if (t > .55) { p.hit = null; p.run(THIRD, [9, 17], (t - .55) / .45, art.CREAM); } return p; },
    hitrun: (art, t, h) => { const p = drawer(art.fan(), art); p.run(FIRST, SECOND, t / .45, art.CREAM); if (t > .3) { p.hit = null; p.run(HOME, [art.oppoX(h), 8], (t - .3) / .7); } return p; },
    bunt: (art, t) => { const p = drawer(art.fan(), art); p.c.block(8, 16, 2, 1, t > .1 ? art.GOLD : art.CREAM); p.run(FIRST, SECOND, t, art.CREAM); return p; },
    squeeze: (art, t) => { const p = drawer(art.fan(), art); p.c.block(11, 16, 2, 1, art.GOLD); p.run(THIRD, [9, 17], t, art.CREAM); return p; },
    safety: (art, t) => { const p = drawer(art.fan(), art); p.c.block(7, 16, 2, 1, art.GOLD); p.run([10, 18], FIRST, t, art.CREAM); return p; },
    steal: (art, t) => { const p = drawer(art.fan(), art); p.run(FIRST, SECOND, t, art.CREAM); return p; }
  };
  /* The zone lights cell by cell before the pitch arrives; landed, the chosen cells shimmer. */
  const lightUp = (art, lit, t) => art.zone((r, col) => t > (r + col) * .07 && lit(r, col));
  const cellCenter = (row, col) => [5 + col * 4 + 1, 5 + row * 4 + 1];
  const PITCHER_FX = {
    inside: (art, t, h) => { const col = h === 'L' ? 2 : 0, p = drawer(lightUp(art, (r, c) => c === col, t), art); p.pitch(cellCenter(1, col), (t - .3) / .7); p.cells = (r, c) => c === col; return p; },
    outside: (art, t, h) => { const col = h === 'L' ? 0 : 2, p = drawer(lightUp(art, (r, c) => c === col, t), art); p.pitch(cellCenter(1, col), (t - .3) / .7); p.cells = (r, c) => c === col; return p; },
    strike: (art, t) => { const p = drawer(lightUp(art, () => true, t), art); p.pitch(cellCenter(1, 1), (t - .3) / .7); p.cells = () => true; return p; },
    low: (art, t) => { const p = drawer(lightUp(art, r => r === 2, t), art); p.pitch(cellCenter(2, 1), (t - .3) / .7); p.cells = r => r === 2; return p; },
    edge: (art, t) => { const p = drawer(lightUp(art, (r, c) => r !== 1 || c !== 1, t), art); p.pitch(cellCenter(2, 2), (t - .3) / .7); p.cells = (r, c) => r !== 1 || c !== 1; return p; },
    contact: (art, t) => { const p = drawer(art.zone(r => r === 2), art); p.pitch(cellCenter(2, 1), t / .55); if (t > .55) { p.hit = null; p.run([4, 18], [15, 18], (t - .55) / .45, art.GOLD, 2); } p.cells = r => r === 2; return p; },
    tempo: (art, t) => { const p = drawer(art.canvas(), art); p.run([2, 6], [17, 6], t / .35); if (t > .3) { p.hit = null; p.run([2, 14], [9, 14], (t - .3) / .7, art.COOL, 2); } return p; },
    walk: (art, t) => {
      const p = drawer(art.zone(() => false, art.GOLD), art);
      [4, 9, 14].forEach((y, i) => { const u = (t - i * .3) / .3; if (u >= 1) p.c.block(18, y, 2, 2, art.GOLD); else if (u > 0) p.ball(along([10, 1], [19, y + 1], ease(u)), WHITE, 1 + Math.round(u)); });
      if (t >= .9) p.hit = [18, 15];
      return p;
    },
    waste: (art, t) => { const p = drawer(art.zone(() => false, art.GOLD), art); p.pitch([18, 2], t / .85, art.GOLD); return p; }
  };

  /* A gold mark that runs round the card's frame: the charge before the play, or the whole effect of a portrait card. */
  const around = n => (n < 19 ? [n, 0] : n < 38 ? [19, n - 19] : n < 57 ? [57 - n, 19] : [0, 76 - n]);
  function frameRun(c, art, t, length = 22, color = art.GOLD) {
    const head = Math.floor(ease(clamp01(t)) * 76);
    for (let n = Math.max(0, head - length); n <= head; n++) { const at = around(n % 76); c.put(at[0], at[1], n > head - 3 ? WHITE : color); }
  }
  /* The landing: rays thrown out from the point the play reached. */
  function burst(c, art, at, u, color) {
    if (!at || u <= 0 || u >= 1) return;
    const reach = 1 + Math.round(5 * ease(u));
    for (const [dx, dy] of RAYS) for (let r = Math.max(1, reach - 2); r <= reach; r++) {
      const x = at[0] + dx * r, y = at[1] + dy * r;
      if (x >= 0 && y >= 0 && x < SIDE && y < SIDE) c.put(x, y, r === reach ? (u < .5 ? WHITE : color) : color);
    }
  }

  function playCardFx(cardId, context) {
    return new Promise(resolve => {
      const button = context && context.button, plate = button && button.querySelector('.plate'), art = globalThis.KneekuraCardArtV1;
      if (!plate || !art) { resolve(); return; }
      const deck = context.deck === 'pitcher' ? 'pitcher' : 'batter', scene = (deck === 'pitcher' ? PITCHER_FX : BATTER_FX)[cardId] || null;
      const accent = deck === 'pitcher' ? art.COOL : art.GOLD;
      const page = document.createElement('canvas');
      page.className = 'card-fx-plate';
      page.dataset.over = scene ? 'picture' : 'photo';
      page.width = page.height = SIDE;
      plate.append(page);
      const c = page.getContext('2d'), hand = batterHand(), still = reduceMotion(), started = performance.now();
      let landed = false, card = button;
      card.dataset.fxGlow = deck;
      /* The hand is redrawn while a card plays: the effect moves onto the card that now stands in its place. */
      const follow = () => {
        if (card.isConnected) return;
        const next = document.querySelector('.tactic[data-id="' + cardId + '"][data-deck="' + context.deck + '"]') || document.querySelector('.tactic[data-id="' + cardId + '"]'), nextPlate = next && next.querySelector('.plate');
        if (!nextPlate) return;
        nextPlate.append(page);
        next.dataset.fxGlow = deck;
        if (landed) next.dataset.fxLand = '';
        card = next;
      };
      const finish = () => { page.remove(); delete card.dataset.fxGlow; delete card.dataset.fxLand; resolve(); };
      const frame = now => {
        follow();
        const t = still ? 1 : clamp01((now - started) / FX_MS), act = clamp01((t - ACT_FROM) / (ACT_TO - ACT_FROM));
        c.clearRect(0, 0, SIDE, SIDE);
        if (scene) {
          const p = scene(art, act, hand);
          p.c.paint(c);
          // A landed pitch shimmers in the cells it chose.
          if (p.cells && act >= 1) {
            const shine = art.canvas();
            for (let r = 0; r < 3; r++) for (let col = 0; col < 3; col++) if (p.cells(r, col) && (r + col + Math.floor(t * 18)) % 3 !== 0) shine.block(5 + col * 4, 5 + r * 4, 3, 3, WHITE);
            shine.paint(c);
          }
          if (t < ACT_FROM + .06) { const glow = art.canvas(); frameRun(glow, art, t / (ACT_FROM + .06), 30, accent); glow.paint(c); }
          const hit = p.hit || (act >= 1 ? [10, 10] : null), land = clamp01((t - ACT_TO) / (1 - ACT_TO));
          if (hit && act >= 1) {
            if (!landed) { landed = true; card.dataset.fxLand = ''; }
            const rays = art.canvas(); burst(rays, art, hit, land, accent); rays.paint(c);
            if (land < .35) { c.globalAlpha = .55 * (1 - land / .35); c.fillStyle = WHITE; c.fillRect(0, 0, SIDE, SIDE); c.globalAlpha = 1; }
          }
        } else {
          const ring = art.canvas();
          frameRun(ring, art, t * 2, 26, accent);
          if (t > .5) frameRun(ring, art, (t - .5) * 2, 10, WHITE);
          ring.paint(c);
          if (t > .78 && !landed) { landed = true; card.dataset.fxLand = ''; }
        }
        if (t >= 1) setTimeout(finish, still ? 150 : FX_HOLD_MS);
        else requestAnimationFrame(frame);
      };
      frame(started);
    });
  }
  globalThis.playManagerCardFx = playCardFx;

  const broadcast = document.querySelector('.broadcast');
  if (broadcast) broadcast.append(captionBox);
  buildBrightness();

  globalThis.KneekuraMatchMomentsV1 = Object.freeze({ crowdMood, errorFielders, stadiumBrightness: () => brightness, cards: { batter: ['auto', ...Object.keys(BATTER_FX)], pitcher: ['auto', ...Object.keys(PITCHER_FX)] }, inspect: () => ({ mood, balloons: balloons.slice(), caption: captionBox.hidden ? null : captionBox.textContent }) });
})();
