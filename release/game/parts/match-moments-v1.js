/* Match moments, read only: what the broadcast shows on top of the play. Nothing here reaches the Core.
   - steal and pickoff captions, worded like Sportsnavi's text play-by-play (M5)
   - which fielder wears the error balloon (M7; 032-script.js draws it)
   - how the crowd reacts (V7; 032-script.js swaps the held stadium pictures)
   - the stadium brightness setting (V2)
   - the short effect of each manager card (K1): window.playManagerCardFx(cardId, context) returns a promise */
(function () {
  'use strict';
  const DATA = JSON.parse(document.getElementById('match-data').textContent);
  const NAMES = Object.assign({ robin: 'ロビン' }, Object.fromEntries(Object.values(DATA.players).map(p => [p.id, p.name])));
  const BASES = { first: '一塁', second: '二塁', third: '三塁' }, NEXT = { first: '二塁', second: '三塁', third: '本塁' };
  const LOOK_MS = 80, CAPTION_MS = 3200, BALLOON_MS = 1800, POSE_MS = 130, POSES = [1, 0, 2, 0];
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

  /* ---------- Card effects: dots on the game's own 4px lattice over the picture ---------- */
  const FX_MS = 650, W = 600, H = 432, CELL = 4, DOT = 1.45;
  const GOLD = '#d9b65a', WHITE = '#f4f1e4', BLUE = '#7fb0e8', DIM = '#55705a', RED = '#d8574a';
  const HOME = [300, 396], FIRST = [420, 300], SECOND = [300, 204], THIRD = [180, 300];
  const CELLS = 3, ZONE = 40, ZX = W / 2 - ZONE * 1.5, ZY = H / 2 - ZONE * 1.5 + 16;
  const ease = t => 1 - (1 - t) * (1 - t), clamp01 = t => Math.max(0, Math.min(1, t));
  const mix = (a, b, t) => a + (b - a) * t;
  const bezier = (p, q, lift, t) => [mix(p[0], q[0], t), mix(p[1], q[1], t) - 4 * lift * t * (1 - t)];

  function painter(c) {
    const dot = (x, y, color, alpha = 1, size = DOT) => {
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.beginPath();
      c.arc(Math.round(x / CELL) * CELL, Math.round(y / CELL) * CELL, size, 0, Math.PI * 2);
      c.fill();
    };
    const line = (p, q, color, alpha) => {
      const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / CELL);
      for (let i = 0; i <= n; i += 2) dot(mix(p[0], q[0], i / n), mix(p[1], q[1], i / n), color, alpha);
    };
    return {
      dot, line,
      diamond(alpha) {
        line(HOME, [50, 146], DIM, alpha);
        line(HOME, [550, 146], DIM, alpha);
        [[FIRST, SECOND], [SECOND, THIRD], [THIRD, HOME], [HOME, FIRST]].forEach(([p, q]) => line(p, q, WHITE, alpha * .7));
        for (let a = -.78; a <= .78; a += .035) dot(300 + 352 * Math.sin(a), 396 - 352 * Math.cos(a), DIM, alpha);
      },
      flight(p, q, lift, t, color = GOLD) {
        const n = 26, head = ease(clamp01(t));
        for (let i = 0; i <= n; i++) {
          const u = i / n * head, at = bezier(p, q, lift, u);
          dot(at[0], at[1], color, .25 + .75 * (i / n));
        }
        const at = bezier(p, q, lift, head);
        dot(at[0], at[1], WHITE, 1, 3);
      },
      burst(at, t, color = GOLD) {
        if (t <= 0) return;
        for (let i = 0; i < 12; i++) {
          const a = i * Math.PI / 6, r = 6 + 28 * ease(t);
          dot(at[0] + r * Math.cos(a), at[1] + r * Math.sin(a), color, 1 - t);
        }
      },
      runner(p, q, t, color = BLUE) {
        const u = ease(clamp01(t));
        for (let i = 0; i <= 10; i++) dot(mix(p[0], q[0], u * i / 10), mix(p[1], q[1], u * i / 10), color, .2 + .08 * i);
        dot(mix(p[0], q[0], u), mix(p[1], q[1], u), WHITE, 1, 3.2);
      },
      zone(lit, flash) {
        for (let row = 0; row < CELLS; row++) for (let col = 0; col < CELLS; col++) {
          const on = lit(row, col);
          for (let y = 0; y < ZONE; y += CELL) for (let x = 0; x < ZONE; x += CELL) {
            if (x > 0 && y > 0 && x < ZONE - CELL && y < ZONE - CELL) { if (on) dot(ZX + col * ZONE + x, ZY + row * ZONE + y, GOLD, .28 + .5 * flash); continue; }
            dot(ZX + col * ZONE + x, ZY + row * ZONE + y, on ? GOLD : DIM, on ? .9 : .55);
          }
        }
      },
      pitch(row, col, t, color = WHITE) {
        const to = [ZX + (col + .5) * ZONE, ZY + (row + .5) * ZONE], u = ease(clamp01(t));
        dot(mix(300, to[0], u), mix(60, to[1], u), color, 1, 1.5 + 2.5 * u);
      }
    };
  }

  function batterHand() {
    try {
      const view = window.liveMatchPlayback.inspect(), frame = view.currentFrame || (view.host && view.host.frame);
      const player = DATA.players[frame && frame.batterPlayerId];
      if (player && player.bats === 'L') return 'L';
    } catch (error) { /* a right-handed picture is fine */ }
    return 'R';
  }
  /* Every card of the approved deck, by id. A card without its own picture falls back to the plain flash. */
  const BATTER_FX = {
    auto: (p, t) => { p.diamond(.8); p.burst(HOME, t); },
    center: (p, t) => { p.diamond(.8); p.flight(HOME, [300, 72], 120, t / .85); p.burst([300, 72], (t - .8) / .2); },
    pull: (p, t, h) => { const to = h === 'L' ? [508, 128] : [92, 128]; p.diamond(.8); p.flight(HOME, to, 110, t / .85); p.burst(to, (t - .8) / .2); },
    oppo: (p, t, h) => { const to = h === 'L' ? [92, 128] : [508, 128]; p.diamond(.8); p.flight(HOME, to, 110, t / .85); p.burst(to, (t - .8) / .2); },
    ground: (p, t, h) => { const to = h === 'L' ? [372, 236] : [228, 236], u = clamp01(t / .9); p.diamond(.8); for (let i = 0; i < 3; i++) p.flight(i ? bezier(HOME, to, 0, i / 3) : HOME, bezier(HOME, to, 0, (i + 1) / 3), 10, u * 3 - i); },
    sacfly: (p, t) => { p.diamond(.8); p.flight(HOME, [300, 60], 150, t / .6); if (t > .6) p.runner(THIRD, HOME, (t - .6) / .4); },
    hitrun: (p, t, h) => { const to = h === 'L' ? [150, 190] : [450, 190]; p.diamond(.8); p.runner(FIRST, SECOND, t); p.flight(HOME, to, 26, (t - .25) / .7); },
    bunt: (p, t) => { p.diamond(.8); p.flight(HOME, [352, 340], 8, t / .8); p.runner(FIRST, SECOND, t); },
    squeeze: (p, t) => { p.diamond(.8); p.runner(THIRD, HOME, t); p.flight(HOME, [248, 340], 8, (t - .35) / .6); },
    safety: (p, t, h) => { const to = h === 'L' ? [240, 336] : [360, 336]; p.diamond(.8); p.flight(HOME, to, 8, t / .7); p.runner(HOME, FIRST, (t - .2) / .8); },
    steal: (p, t) => { p.diamond(.8); p.runner(FIRST, SECOND, t); p.burst(SECOND, (t - .8) / .2, BLUE); }
  };
  const PITCHER_FX = {
    auto: (p, t) => { p.zone(() => false, 0); p.pitch(1, 1, t / .9); },
    inside: (p, t, h) => { const c = h === 'L' ? 2 : 0; p.zone((r, col) => col === c, t); p.pitch(1, c, t / .9); },
    outside: (p, t, h) => { const c = h === 'L' ? 0 : 2; p.zone((r, col) => col === c, t); p.pitch(1, c, t / .9); },
    strike: (p, t) => { p.zone(() => true, t); p.pitch(1, 1, t / .9); },
    low: (p, t) => { p.zone(r => r === 2, t); p.pitch(2, 1, t / .9); },
    edge: (p, t, h) => { const c = h === 'L' ? 0 : 2; p.zone((r, col) => r === 2 && col === c || r === 1 && col === c, t); p.pitch(2.3, c + (c ? .3 : -.3), t / .9); },
    contact: (p, t) => { p.zone(r => r === 2, t); p.pitch(2, 1, t / .6); if (t > .6) p.flight([300, 300], [230, 396], 6, (t - .6) / .4); },
    tempo: (p, t) => { p.zone((r, col) => r === 1 && col === 1, t); p.pitch(0, 1, t / .7, BLUE); p.pitch(2, 1, (t - .45) / .25); },
    walk: (p, t, h) => { const c = h === 'L' ? -1 : 3; p.zone(() => false, 0); for (let i = 0; i < 4; i++) p.pitch(i * .9, c, (t - i * .2) / .25, RED); },
    waste: (p, t, h) => { const c = h === 'L' ? -1 : 3; p.zone(() => false, 0); p.pitch(0, c, t / .9, RED); }
  };

  function playCardFx(cardId, context) {
    return new Promise(resolve => {
      const stage = (context && context.stage) || document.querySelector('.broadcast'), deck = context && context.deck;
      const scene = (deck === 'pitcher' ? PITCHER_FX : BATTER_FX)[cardId] || (deck === 'pitcher' ? PITCHER_FX.auto : BATTER_FX.auto);
      const page = document.createElement('canvas'), label = document.createElement('b');
      page.className = 'card-fx-field';
      page.width = W * 2;
      page.height = H * 2;
      label.className = 'card-fx-name';
      label.dataset.deck = deck || '';
      label.textContent = (context && context.name) || '';
      stage.append(page, label);
      const c = page.getContext('2d'), paint = painter(c), hand = batterHand(), still = reduceMotion(), started = performance.now();
      c.setTransform(2, 0, 0, 2, 0, 0);
      const finish = () => { page.remove(); label.remove(); resolve(); };
      const frame = now => {
        const t = still ? 1 : clamp01((now - started) / FX_MS);
        c.clearRect(0, 0, W, H);
        c.globalAlpha = .72;
        c.fillStyle = '#000';
        c.fillRect(0, 0, W, H);
        scene(paint, t, hand);
        c.globalAlpha = 1;
        if (t >= 1) setTimeout(finish, still ? 150 : 110);
        else requestAnimationFrame(frame);
      };
      frame(started);
    });
  }
  globalThis.playManagerCardFx = playCardFx;

  const broadcast = document.querySelector('.broadcast');
  if (broadcast) broadcast.append(captionBox);
  buildBrightness();

  globalThis.KneekuraMatchMomentsV1 = Object.freeze({ crowdMood, errorFielders, stadiumBrightness: () => brightness, cards: { batter: Object.keys(BATTER_FX), pitcher: Object.keys(PITCHER_FX) }, inspect: () => ({ mood, balloons: balloons.slice(), caption: captionBox.hidden ? null : captionBox.textContent }) });
})();
