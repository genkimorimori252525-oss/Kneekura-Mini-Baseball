// Defense symptom detectors over one field result. Reads only recorded facts and frames.
const flat = (a, b) => Math.hypot(a.x - b.x, a.z - b.z), OFS = ['LF', 'CF', 'RF'];
export function detectFieldSymptoms({field, input, outsBefore}) {
  const pos = id => input.fielders.find(f => f.playerId === id)?.defensivePosition ?? null, spec = id => input.fielders.find(f => f.playerId === id);
  const t0 = input.ball.elapsedSeconds, base = n => n === 4 ? input.field.bases.home : n === 1 ? input.field.bases.first : n === 2 ? input.field.bases.second : input.field.bases.third;
  const facts = field.facts, frames = field.frames.filter(q => !q.recoveryV115), out = {}, rel = t => +(t - t0).toFixed(2);
  const startRunners = input.runners.map(r => ({id: r.runnerId, b: r.initialBase}));
  const finalOf = id => field.finalRunners?.find(r => r.runnerId === id);
  const retiredAt = id => {for (const q of frames) if (q.runners.find(r => r.runnerId === id)?.retired) return q.elapsedSeconds; return Infinity;};
  const touches = id => facts.filter(f => f.kind === 'runner_base_touch' && f.runnerId === id);
  const touchTime = (id, b, after) => touches(id).find(f => f.base === b && f.elapsedSeconds >= after)?.elapsedSeconds ?? Infinity;
  const secures = facts.filter(f => f.kind === 'catch_secured'), throws = facts.filter(f => f.kind === 'throw_release');
  const playEnd = frames.at(-1)?.elapsedSeconds ?? t0, batter = startRunners.find(r => r.b === 0)?.id;
  const frameAt = t => frames.find(q => q.elapsedSeconds >= t) ?? frames.at(-1);
  // S5 tag-up
  const fly = field.ruleFacts.flyCatch;
  if (fly) {
    const tc = secures.find(f => f.playerId === fly.fielderId)?.elapsedSeconds ?? t0, q = frameAt(tc), who = pos(fly.fielderId), depth = Math.hypot(q.ball.position.x, q.ball.position.z);
    const tu = [];
    for (const r of startRunners.filter(r => r.b > 0)) {
      const seen = q.runners.find(x => x.runnerId === r.id); if (!seen || seen.retired) continue;
      const away = flat(seen.position, base(r.b)), fin = finalOf(r.id), left = facts.some(f => f.kind === 'runner_base_departure' && f.runnerId === r.id && f.elapsedSeconds > fly.firstTouchTick / 1e6 - 1e9);
      tu.push({from: r.b, away: +away.toFixed(1), adv: fin ? (fin.scored ? 4 : fin.base) - r.b : null, out: fin?.retired ?? false});
    }
    out.fly = {who, depth: +depth.toFixed(0), t: rel(tc), outs: outsBefore, tu};
  }
  // S1 outfield
  const groundT = field.ruleFacts.firstGroundContactTick === null ? null : (field.ruleFacts.firstGroundContactTick - field.ruleFacts.contactTick) / 1e6;
  const firstSec = secures[0], firstWho = firstSec ? pos(firstSec.playerId) : null, gf = facts.find(f => f.kind === 'ground_contact');
  const land = gf?.position ? Math.hypot(gf.position.x, gf.position.z) : null;
  const ofContacts = facts.filter(f => ['glove_contact', 'body_contact'].includes(f.kind) && OFS.includes(pos(f.playerId)));
  const fumbles = ofContacts.filter(c => !secures.some(s => s.playerId === c.playerId && s.elapsedSeconds >= c.elapsedSeconds && s.elapsedSeconds <= c.elapsedSeconds + .5));
  if (OFS.includes(firstWho) || (land !== null && land > 45)) {
    const p = firstSec ? frameAt(firstSec.elapsedSeconds).ball.position : null, nextThrow = firstSec ? throws.find(f => f.elapsedSeconds >= firstSec.elapsedSeconds) : null;
    let nearestOF = null;
    if (gf) {const q = frameAt(gf.elapsedSeconds); nearestOF = Math.min(...q.fielders.filter(a => OFS.includes(pos(a.playerId))).map(a => flat(a.position, q.ball.position)));}
    const movers = new Set(); for (const q of frames.slice(0, 40)) for (const a of q.fielders) if (OFS.includes(pos(a.playerId)) && a.intent === 'intercept') movers.add(pos(a.playerId));
    const hangLand = gf && groundT !== null ? {hang: +groundT.toFixed(2), land: +land.toFixed(0), nearestOF: nearestOF === null ? null : +nearestOF.toFixed(1)} : null;
    out.of = {who: firstWho, caught: !!fly, ...hangLand, fumbles: fumbles.length, pickT: firstSec ? rel(firstSec.elapsedSeconds) : null, pickR: p ? +Math.hypot(p.x, p.z).toFixed(0) : null,
      toThrow: firstSec && nextThrow ? +(nextThrow.elapsedSeconds - firstSec.elapsedSeconds).toFixed(2) : null, chasers: movers.size};
  }
  // S2 / S3: every spell of possession
  const missedForce = [], missedTag = [], missedThrow = [];
  const batterOutAt = batter ? retiredAt(batter) : Infinity, occupied = new Set(startRunners.map(r => r.b));
  const forcedInitial = new Set([0]); for (let b = 1; b <= 3 && occupied.has(b) && forcedInitial.has(b - 1); b++) forcedInitial.add(b);
  for (let i = 0; i < secures.length; i++) {
    const s = secures[i], F = s.playerId, q0 = frameAt(s.elapsedSeconds), P = q0.fielders.find(a => a.playerId === F).position, sp = spec(F);
    const nextOwnThrow = throws.find(f => f.playerId === F && f.elapsedSeconds >= s.elapsedSeconds), endT = nextOwnThrow?.elapsedSeconds ?? playEnd;
    if (fly && fly.fielderId === F && s === secures[0]) { /* a caught fly still has throws to make */ }
    const ready = s.elapsedSeconds + (sp?.transferSeconds ?? .4);
    for (const r of startRunners) {
      const seen = q0.runners.find(x => x.runnerId === r.id); if (!seen || seen.retired || seen.scored) continue;
      const b = seen.targetBase ?? (Math.hypot(seen.velocity.x, seen.velocity.z) > .5 ? seen.currentBase + 1 : null); if (!b || b > 4 || b <= seen.currentBase) continue;
      if (fly && r.b === 0) continue;
      const ta = touchTime(r.id, b, s.elapsedSeconds), retired = retiredAt(r.id) < Infinity, forced = !fly && forcedInitial.has(r.b) && s.elapsedSeconds < batterOutAt && b === r.b + 1;
      const d = flat(P, base(b)), run = d < .4 ? 0 : d / 5.5 + .1;
      if (forced && !retired && s.elapsedSeconds + run + .1 < ta && !(nextOwnThrow && nextOwnThrow.base === b) && d <= 12) missedForce.push({by: pos(F), base: b, d: +d.toFixed(1), lead: +(ta - s.elapsedSeconds - run).toFixed(2), runnerFrom: r.b});
      if (!retired && ready < ta) {
        const speed = (sp?.throwSpeedMps ?? 34) * .85, arrive = ready + d / speed + .1;
        const threw = throws.some(f => f.base === b && f.elapsedSeconds >= s.elapsedSeconds && f.elapsedSeconds < ta);
        const covered = (() => {const qa = frameAt(arrive); return Math.min(...qa.fielders.filter(a => a.playerId !== F).map(a => flat(a.position, base(b))));})();
        if (arrive + .15 < ta && !threw && !(d <= 3)) missedThrow.push({by: pos(F), base: b, runnerFrom: r.b, margin: +(ta - arrive).toFixed(2), d: +d.toFixed(0), cover: +covered.toFixed(1), threwElse: nextOwnThrow && nextOwnThrow.elapsedSeconds < ta ? nextOwnThrow.base ?? null : null});
      }
    }
    // Tag chances: ball in a hand, a live runner off the bag within reach
    let run = 0, best = null;
    for (const q of frames) {
      if (q.elapsedSeconds < s.elapsedSeconds || q.elapsedSeconds > endT || q.ball.possessedBy !== F) continue;
      const H = q.fielders.find(a => a.playerId === F).position;
      for (const x of q.runners) {
        if (x.retired || x.scored) continue;
        const onBag = [1, 2, 3, 4].some(n => flat(x.position, base(n)) <= 1), near = flat(H, x.position);
        if (!onBag && near <= 1.6) {run++; best ??= {by: pos(F), runner: x.runnerId === batter ? 0 : startRunners.find(r => r.id === x.runnerId)?.b, d: +near.toFixed(1), id: x.runnerId};}
      }
    }
    if (run >= 2 && best && retiredAt(best.id) === Infinity) {const {id, ...rest} = best; missedTag.push(rest);}
  }
  if (missedForce.length) out.force = missedForce; if (missedTag.length) out.tag = missedTag; if (missedThrow.length) out.thr = missedThrow;
  out.throwsMade = throws.map(f => {const c = secures.find(s => s.elapsedSeconds > f.elapsedSeconds); const p = frameAt(f.elapsedSeconds).ball.position; return {d: f.target ? +flat(p, f.target).toFixed(0) : null, t: c ? +(c.elapsedSeconds - f.elapsedSeconds).toFixed(2) : null, by: pos(f.playerId), rx: pos(f.receiverPlayerId), got: c ? pos(c.playerId) : null};});
  // S4 covers
  let maxCover = 0, dup = 0, excess = 0, needless = new Set(), coverers = new Set();
  for (const q of frames) {
    const covers = q.fielders.filter(a => a.intent === 'base_cover' && a.targetBase), by = {};
    for (const a of covers) {by[a.targetBase] = (by[a.targetBase] ?? 0) + 1; coverers.add(pos(a.playerId));}
    const live = q.runners.filter(r => !r.retired && !r.scored), threat = new Set(live.map(r => r.targetBase ?? r.currentBase + 1).filter(b => b >= 1 && b <= 4));
    for (const b of [...threat]) if (b < 4 && live.some(r => (r.targetBase ?? 0) === b)) threat.add(b + 1);
    maxCover = Math.max(maxCover, covers.length);
    if (Object.values(by).some(n => n > 1)) dup++;
    excess = Math.max(excess, covers.filter(a => !threat.has(a.targetBase)).length);
    for (const a of covers) if (!threat.has(a.targetBase)) needless.add(pos(a.playerId) + '>' + a.targetBase);
  }
  out.cov = {max: maxCover, dupFrames: dup, excess, coverers: coverers.size, needless: [...needless].slice(0, 6)};
  return out;
}
