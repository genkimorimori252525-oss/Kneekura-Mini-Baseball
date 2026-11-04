# Batted-ball summary by condition (exit speed percentiles in mph, launch angle mix, line-drive spin, K/BB/HR).
# usage: python -I batted-summary.py <records dir> <tag>...   (reads <dir>/g-<tag>-*.jsonl)
import glob, json, sys, statistics as st
for cond in sys.argv[2:]:
    ev, la, back, side, pa, k, bb, hr = [], [], [], [], 0, 0, 0, 0
    for f in glob.glob(f'{sys.argv[1]}/g-{cond}-*.jsonl'):
        for line in open(f):
            r = json.loads(line); s = r.get('scoring')
            if s and s != 'plate_appearance_continues':
                pa += 1; k += s == 'strikeout'; bb += s == 'walk'; hr += (r.get('homeRuns') or 0) > 0
            e = r.get('exit')
            if e and r.get('foulOrContact') is not None and abs(e['spray']) <= 45:
                ev.append(e['kmh'] / 1.609344); la.append(e['launch'])
                if r.get('spin') and 10 <= e['launch'] <= 20: back.append(r['spin']['back']); side.append(abs(r['spin']['side']))
    if not ev: print(cond, 'no data'); continue
    q = st.quantiles(ev, n=10)
    n = len(la)
    print(f"{cond:10} BIP {n:4} EV mean {st.mean(ev):5.1f} p10 {q[0]:5.1f} p50 {q[4]:5.1f} p90 {q[8]:5.1f} hard95 {sum(v>=95 for v in ev)/n:.2f} | LA {st.mean(la):5.1f} GB {sum(a<10 for a in la)/n:.2f} LD {sum(10<=a<25 for a in la)/n:.2f} FB {sum(25<=a<50 for a in la)/n:.2f} PU {sum(a>=50 for a in la)/n:.2f} | LD back {st.median(back) if back else 0:6.0f} side {st.median(side) if side else 0:5.0f} | PA {pa} K {k/max(pa,1):.3f} BB {bb/max(pa,1):.3f} HR {hr/max(pa,1):.3f}")
