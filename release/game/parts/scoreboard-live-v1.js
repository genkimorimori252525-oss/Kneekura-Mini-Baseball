/* Live stadium scoreboard feed. Read only: it turns the displayed match record (record.match, record.line,
   record.hits / record.errors from localScoringV100, the pitch speed and the defense positions at the start of
   the pitch) into the architecture.scoreboard shape. The stadium draws only the board's own cells from it. */
(function () {
  'use strict';
  const DATA = JSON.parse(document.getElementById('match-data').textContent);
  const ROLES = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'];
  const NAMES = Object.assign({ robin: 'ロビン' }, Object.fromEntries(Object.values(DATA.players).map(p => [p.id, p.name])));
  const label = id => String(NAMES[id] || '').slice(0, 12) || '-';
  const zero = { away: 0, home: 0 };
  let cache = null, cacheAt = -Infinity, cacheKey = '';

  function innings(line, key, innings9) {
    const rows = (line || []).slice();
    const last = rows.length ? rows[rows.length - 1].inning : 1;
    const first = Math.max(1, last - 8);
    return Array.from({ length: innings9 }, (_, i) => {
      const row = rows.find(r => r.inning === first + i);
      return row && row[key] !== null && row[key] !== undefined ? Math.max(0, Math.min(99, row[key])) : null;
    });
  }

  function build() {
    const playback = window.liveMatchPlayback;
    if (!playback || typeof playback.inspect !== 'function') return null;
    const view = playback.inspect(), host = view.host, record = view.lastResult;
    if (!host) return null;
    const history = host.history || [];
    const frame = view.currentFrame;
    const official = !!record && !!frame && frame.tick >= record.play.rules.endedAtTick;
    const match = view.observedMatch || (record ? (official ? record.match : record.beforeMatch) : host.match);
    const line = record ? (official ? record.line : record.beforeLine) : host.line;
    const index = record ? history.indexOf(record) : history.length - 1;
    const counted = record ? (official ? record : history[index - 1]) : history[history.length - 1];
    const hits = (counted && counted.hits) || zero, errors = (counted && counted.errors) || zero;
    const startFrame = record && record.beforeFrame ? record.beforeFrame : host.frame;
    const defendingTeam = match.half === 'top' ? 1 : 0;
    const defenders = [];
    for (const role of ROLES) {
      const actor = ((startFrame && startFrame.actors) || []).find(a => a.role === role && a.team === defendingTeam);
      if (actor && actor.position) defenders.push({ role, label: label(actor.playerId), x: Math.round(actor.position.x * 10) / 10, z: Math.round(actor.position.z * 10) / 10 });
    }
    const board = {
      teams: [
        { name: DATA.teams[0], innings: innings(line, 'away', 9), hits: Math.min(999, hits.away || 0), errors: Math.min(99, errors.away || 0) },
        { name: DATA.teams[1], innings: innings(line, 'home', 9), hits: Math.min(999, hits.home || 0), errors: Math.min(99, errors.home || 0) }
      ],
      balls: Math.min(3, match.balls || 0), strikes: Math.min(2, match.strikes || 0), outs: Math.min(2, match.outs || 0),
      speedKmh: record && Number.isFinite(record.speedKmh) ? Math.round(record.speedKmh) : 0
    };
    if (defenders.length === 9) {
      board.fieldDiagram = { version: 1, enabled: true, defenders, runners: { first: !!match.bases.first, second: !!match.bases.second, third: !!match.bases.third } };
    }
    return board;
  }

  /* One object per distinct content, so the stadium rebuilds the board's texture only when something changed. */
  function board() {
    const now = performance.now();
    if (cache && now - cacheAt < 120) return cache;
    cacheAt = now;
    try {
      const next = build();
      if (!next) return cache;
      const key = JSON.stringify(next);
      if (key !== cacheKey) { cacheKey = key; cache = next; }
    } catch (error) { /* keep the last board */ }
    return cache;
  }

  globalThis.KneekuraLiveScoreboardV1 = Object.freeze({ board, rebuild: () => { cacheAt = -Infinity; return board(); } });
})();
