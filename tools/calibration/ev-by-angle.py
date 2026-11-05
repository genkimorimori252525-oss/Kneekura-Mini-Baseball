# Exit speed by launch-angle band: game records vs Statcast 2024 balls in play (fair-ish, |spray|<=45).
import csv, glob, json, math, sys, statistics as st
bands = [(-90,-10),(-10,0),(0,10),(10,20),(20,30),(30,40),(40,50),(50,90)]
def band(la): return next(i for i,(a,b) in enumerate(bands) if a <= la < b)
def summ(rows):
    out = []; n = len(rows)
    for i,(a,b) in enumerate(bands):
        ev = sorted(e for l,e in rows if band(l)==i)
        if not ev: out.append((a,b,0,0,0,0)); continue
        q = lambda p: ev[min(len(ev)-1,int(p*len(ev)))]
        out.append((a,b,len(ev)/n,q(.1),q(.5),q(.9)))
    return out, n
g = []
for f in glob.glob(sys.argv[1]):
    for line in open(f):
        r = json.loads(line); e = r.get('exit')
        if e and r.get('foulOrContact') is not None and abs(e['spray']) <= 45:
            g.append((e['launch'], e['kmh']/1.609344))
m = []
for r in csv.DictReader(open(sys.argv[2], encoding='utf8')):
    if not r['launch_speed'] or not r['launch_angle'] or not r['hc_x']: continue
    sp = .75*math.degrees(math.atan2(float(r['hc_x'])-125.42, 198.27-float(r['hc_y'])))
    if abs(sp) <= 45: m.append((float(r['launch_angle']), float(r['launch_speed'])))
(gs, gn), (ms, mn) = summ(g), summ(m)
print(f'game n={gn} median EV {st.median(e for _,e in g):.1f} | MLB n={mn} median EV {st.median(e for _,e in m):.1f}')
print('band       share g/m     p10 g/m      p50 g/m      p90 g/m')
for x,y in zip(gs,ms):
    print(f'{x[0]:>4}..{x[1]:<4} {x[2]:.3f}/{y[2]:.3f}  {x[3]:5.1f}/{y[3]:5.1f}  {x[4]:5.1f}/{y[4]:5.1f}  {x[5]:5.1f}/{y[5]:5.1f}')
