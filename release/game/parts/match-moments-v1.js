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
  /* ---------- Card effects: the picture on the card itself moves, on the card's own 20 x 20 lattice ---------- */
  const FX_MS = 650, FX_HOLD_MS = 110, SIDE = 20;
  const clamp01 = t => Math.max(0, Math.min(1, t)), ease = t => 1 - (1 - t) * (1 - t);
  const along = (p, q, t) => [Math.round(p[0] + (q[0] - p[0]) * t), Math.round(p[1] + (q[1] - p[1]) * t)];
  const HOME = [10, 18], THIRD = [7, 15], FIRST = [13, 15], SECOND = [10, 12];

  function drawer(c, art) {
    const ball = (at, color = art.CREAM, size = 2) => c.block(at[0] - (size >> 1), at[1] - (size >> 1), size, size, color);
    return {
      c, ball,
      /* A line that grows from p to q with the ball at its head. */
      run(p, q, t, color = art.GOLD, step = 0) {
        const u = ease(clamp01(t)), at = along(p, q, u);
        if (u > 0) { c.line(p[0], p[1], at[0], at[1], color, step); ball(at); }
      },
      /* The same through several points. */
      path(points, t) {
        const n = points.length - 1, u = ease(clamp01(t)) * n, i = Math.min(n - 1, Math.floor(u));
        for (let k = 0; k < i; k++) c.line(points[k][0], points[k][1], points[k + 1][0], points[k + 1][1], art.GOLD);
        const at = along(points[i], points[i + 1], u - i);
        c.line(points[i][0], points[i][1], at[0], at[1], art.GOLD);
        ball(at);
      },
      /* The ball comes in from the mound and grows as it reaches the zone. */
      pitch(to, t, color = art.CREAM) {
        const u = clamp01(t);
        if (u > 0) ball(along([10, 2], to, ease(u)), color, 1 + Math.round(2 * u));
      }
    };
  }
  /* Each scene builds the card's picture for time t. Portrait cards (auto) keep their photo and only the frame runs. */
  const BATTER_FX = {
    center: (art, t) => { const p = drawer(art.fan(), art); p.run(HOME, [10, 5], t); return p.c; },
    pull: (art, t, h) => { const p = drawer(art.fan(), art); p.run(HOME, [art.pullX(h), 7], t); return p.c; },
    oppo: (art, t, h) => { const p = drawer(art.fan(), art); p.run(HOME, [art.oppoX(h), 7], t); return p.c; },
    ground: (art, t, h) => { const p = drawer(art.fan(), art), s = h === 'L' ? 1 : -1; p.path([[10, 17], [10 + s, 13], [10 + 2 * s, 15], [10 + 3 * s, 11], [10 + 4 * s, 13], [10 + 5 * s, 9]], t); return p.c; },
    sacfly: (art, t) => { const p = drawer(art.fan(), art); p.run([10, 17], [10, 3], t / .6, art.GOLD, 2); if (t > .6) p.run(THIRD, [9, 17], (t - .6) / .4, art.CREAM); return p.c; },
    hitrun: (art, t, h) => { const p = drawer(art.fan(), art); p.run(FIRST, SECOND, t / .45, art.CREAM); if (t > .3) p.run(HOME, [art.oppoX(h), 8], (t - .3) / .7); return p.c; },
    bunt: (art, t) => { const p = drawer(art.fan(), art); p.c.block(8, 16, 2, 1, art.GOLD); p.run(FIRST, SECOND, t, art.CREAM); return p.c; },
    squeeze: (art, t) => { const p = drawer(art.fan(), art); p.c.block(11, 16, 2, 1, art.GOLD); p.run(THIRD, [9, 17], t, art.CREAM); return p.c; },
    safety: (art, t) => { const p = drawer(art.fan(), art); p.c.block(7, 16, 2, 1, art.GOLD); p.run([10, 18], FIRST, t, art.CREAM); return p.c; },
    steal: (art, t) => { const p = drawer(art.fan(), art); p.run(FIRST, SECOND, t, art.CREAM); return p.c; }
  };
  const lightUp = (art, lit, t) => art.zone((r, col) => t > (r + col) * .08 && lit(r, col));
  const PITCHER_FX = {
    inside: (art, t, h) => { const col = h === 'L' ? 2 : 0, p = drawer(lightUp(art, (r, c) => c === col, t), art); p.pitch([5 + col * 4 + 1, 10], (t - .35) / .65); return p.c; },
    outside: (art, t, h) => { const col = h === 'L' ? 0 : 2, p = drawer(lightUp(art, (r, c) => c === col, t), art); p.pitch([5 + col * 4 + 1, 10], (t - .35) / .65); return p.c; },
    strike: (art, t) => { const p = drawer(lightUp(art, () => true, t), art); p.pitch([10, 10], (t - .35) / .65); return p.c; },
    low: (art, t) => { const p = drawer(lightUp(art, r => r === 2, t), art); p.pitch([10, 14], (t - .35) / .65); return p.c; },
    edge: (art, t) => { const p = drawer(lightUp(art, (r, c) => r !== 1 || c !== 1, t), art); p.pitch([14, 14], (t - .35) / .65); return p.c; },
    contact: (art, t) => { const p = drawer(art.zone(r => r === 2), art); p.pitch([10, 14], t / .6); if (t > .6) p.run([4, 18], [15, 18], (t - .6) / .4, art.GOLD, 2); return p.c; },
    tempo: (art, t) => { const p = drawer(art.canvas(), art); p.run([2, 6], [17, 6], t / .4); p.run([2, 14], [9, 14], (t - .3) / .7, art.COOL, 2); return p.c; },
    walk: (art, t) => { const p = drawer(art.zone(() => false, art.GOLD), art); [4, 9, 14].forEach((y, i) => { if (t > .15 + i * .28) p.c.block(18, y, 2, 2, art.GOLD); }); return p.c; },
    waste: (art, t) => { const p = drawer(art.zone(() => false, art.GOLD), art); p.pitch([18, 2], t / .9, art.GOLD); return p.c; }
  };
  /* The photo stays; a gold mark runs once round the frame. */
  function frameRun(art, t) {
    const c = art.canvas(), around = n => (n < 19 ? [n, 0] : n < 38 ? [19, n - 19] : n < 57 ? [57 - n, 19] : [0, 76 - n]);
    const head = Math.floor(ease(t) * 76);
    for (let n = Math.max(0, head - 22); n <= head; n++) { const at = around(n % 76); c.put(at[0], at[1], art.GOLD); }
    return c;
  }

  function playCardFx(cardId, context) {
    return new Promise(resolve => {
      const button = context && context.button, plate = button && button.querySelector('.plate'), art = globalThis.KneekuraCardArtV1;
      if (!plate || !art) { resolve(); return; }
      const scene = ((context.deck === 'pitcher' ? PITCHER_FX : BATTER_FX)[cardId]) || null;
      const page = document.createElement('canvas');
      page.className = 'card-fx-plate';
      page.dataset.over = scene ? 'picture' : 'photo';
      page.width = page.height = SIDE;
      plate.append(page);
      const c = page.getContext('2d'), hand = batterHand(), still = reduceMotion(), started = performance.now();
      const finish = () => { page.remove(); resolve(); };
      const frame = now => {
        const t = still ? 1 : clamp01((now - started) / FX_MS);
        c.clearRect(0, 0, SIDE, SIDE);
        (scene ? scene(art, t, hand) : frameRun(art, t)).paint(c);
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
