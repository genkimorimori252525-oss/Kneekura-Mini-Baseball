"""Extract only bat paths from VMD using an explicitly assumed research rig.

No model meshes, executable archive content, game outcomes or player abilities
are imported. VMD alone does not contain the original model's parent/rest/IK
definitions; these paths must never be called an exact world reconstruction.
"""
from pathlib import Path
import argparse, bisect, hashlib, json, math, struct, zipfile

FPS = 30
SAMPLE_RATE = 120
UNIT_METERS = .09
IDENTITY = (0., 0., 0., 1.)

def add(a,b): return tuple(x+y for x,y in zip(a,b))
def sub(a,b): return tuple(x-y for x,y in zip(a,b))
def scale(a,k): return tuple(x*k for x in a)
def reflect(a): return (a[0],a[1],-a[2])
def normalize(q):
    n=math.sqrt(sum(x*x for x in q))
    if not math.isfinite(n) or n<1e-12: raise ValueError('invalid VMD quaternion')
    return tuple(x/n for x in q)
def multiply(a,b):
    x,y,z,w=a; X,Y,Z,W=b
    return normalize((w*X+x*W+y*Z-z*Y,w*Y-x*Z+y*W+z*X,w*Z+x*Y-y*X+z*W,w*W-x*X-y*Y-z*Z))
def rotate(q,v):
    x,y,z,w=q; X,Y,Z=v
    u=(y*Z-z*Y,z*X-x*Z,x*Y-y*X)
    t=(y*u[2]-z*u[1],z*u[0]-x*u[2],x*u[1]-y*u[0])
    return tuple(v[i]+2*(w*u[i]+t[i]) for i in range(3))
def slerp(a,b,t):
    dot=sum(x*y for x,y in zip(a,b))
    if dot<0: b=scale(b,-1); dot=-dot
    dot=min(1,max(-1,dot))
    if dot>.9995: return normalize(add(scale(a,1-t),scale(b,t)))
    angle=math.acos(dot); sine=math.sin(angle)
    return normalize(add(scale(a,math.sin((1-t)*angle)/sine),scale(b,math.sin(t*angle)/sine)))

def bezier_ratio(curve,fraction):
    if fraction<=0: return 0.
    if fraction>=1: return 1.
    x1,y1,x2,y2=(v/127 for v in curve)
    if x1==y1 and x2==y2: return fraction
    cubic=lambda u,a,b:3*(1-u)**2*u*a+3*(1-u)*u*u*b+u**3
    lo,hi=0.,1.
    for _ in range(32):
        mid=(lo+hi)/2
        if cubic(mid,x1,x2)<fraction: lo=mid
        else: hi=mid
    return cubic((lo+hi)/2,y1,y2)

def parse_vmd(data):
    if len(data)<54 or not data[:30].startswith(b'Vocaloid Motion Data 0002'):
        raise ValueError('unsupported/truncated VMD header')
    model=data[30:50].split(b'\0')[0].decode('cp932',errors='replace')
    count=struct.unpack_from('<I',data,50)[0]; cursor=54
    if count>200_000 or cursor+111*count>len(data): raise ValueError('truncated/oversize VMD bone block')
    tracks={}
    for _ in range(count):
        # VMD's 15-byte name field can end in half of a Shift-JIS character.
        # Keep that unresolved spelling distinct; never map it to a known bone.
        name=data[cursor:cursor+15].split(b'\0')[0].decode('cp932',errors='replace')
        frame,*values=struct.unpack_from('<I7f',data,cursor+15)
        interpolation=tuple(data[cursor+47:cursor+111])
        if frame>300_000 or not all(math.isfinite(v) for v in values) or any(v>127 for v in interpolation[:16]):
            raise ValueError('invalid VMD key values: '+repr((name,frame,values,interpolation[:16])))
        key={'frame':frame,'position':tuple(values[:3]),'quaternion':normalize(tuple(values[3:])), 'interpolation':interpolation}
        tracks.setdefault(name,[]).append(key); cursor+=111
    ambiguous=[]
    for name,keys in tracks.items():
        keys.sort(key=lambda k:k['frame'])
        if any(a['frame']==b['frame'] for a,b in zip(keys,keys[1:])): ambiguous.append(name)
    morphs=[]
    if cursor+4<=len(data):
        morph_count=struct.unpack_from('<I',data,cursor)[0]; cursor+=4
        if morph_count>200_000 or cursor+23*morph_count>len(data): raise ValueError('truncated VMD morph block')
        for _ in range(morph_count):
            name=data[cursor:cursor+15].split(b'\0')[0].decode('cp932',errors='replace')
            frame,weight=struct.unpack_from('<If',data,cursor+15)
            if not math.isfinite(weight): raise ValueError('invalid VMD morph')
            morphs.append({'name':name,'frame':frame,'weight':weight}); cursor+=23
    return {'model':model,'tracks':tracks,'ambiguousTracks':ambiguous,'morphs':morphs,'maxFrame':max((k['frame'] for keys in tracks.values() for k in keys),default=0)}

def sample_track(keys,frame):
    if not keys: return (0.,0.,0.),IDENTITY
    if frame<=keys[0]['frame']: return keys[0]['position'],keys[0]['quaternion']
    if frame>=keys[-1]['frame']: return keys[-1]['position'],keys[-1]['quaternion']
    index=bisect.bisect_right([k['frame'] for k in keys],frame)-1
    one,two=keys[index:index+2]; fraction=(frame-one['frame'])/(two['frame']-one['frame']); curve=two['interpolation']
    ratios=[bezier_ratio((curve[c],curve[c+4],curve[c+8],curve[c+12]),fraction) if c==3 or one['position'][c]!=two['position'][c] else 0 for c in range(4)]
    position=tuple(a+(b-a)*ratios[i] for i,(a,b) in enumerate(zip(one['position'],two['position'])))
    return position,slerp(one['quaternion'],two['quaternion'],ratios[3])

def rig_chain(model,wrist='右手首'):
    side='左' if wrist.startswith('左') else '右'; sign=1 if side=='左' else -1
    upper='上半身2' if '上半身2' in model['tracks'] else '上半身２'
    return [('全ての親',(0,0,0)),('センター',(0,10,0)),('グルーブ',(0,10,0)),('腰',(0,10,0)),
      ('上半身',(0,12,0)),(upper,(0,15,0)),(side+'胸',(0,15,0)),(side+'肩P',(.8*sign,15.8,0)),
      (side+'肩',(.8*sign,15.8,0)),(side+'腕',(1.6*sign,15.5,0)),(side+'腕捩',(2.4*sign,15.3,0)),
      (side+'ひじ',(3.2*sign,15.1,0)),(side+'手捩',(4*sign,14.9,0)),(wrist,(4.8*sign,14.7,0))]

def wrist_pose(model,frame,wrist):
    position=(0.,0.,0.); quaternion=IDENTITY; previous=(0.,0.,0.)
    for name,rest in rig_chain(model,wrist):
        offset,rotation=sample_track(model['tracks'].get(name),frame)
        position=add(position,rotate(quaternion,add(sub(rest,previous),offset)))
        quaternion=multiply(quaternion,rotation); previous=rest
    return position,quaternion

def vector(v): return dict(zip(('x','y','z'),(round(x,9) for x in v)))
def make_frames(model,bat_length=.84,wrist='右手首',attachment=None):
    if not math.isfinite(bat_length) or bat_length<=0: raise ValueError('invalid reference bat length')
    attachment=attachment or {'position':(0.,0.,0.),'quaternion':IDENTITY}
    if set(model.get('ambiguousTracks',[])).intersection(n for n,_ in rig_chain(model,wrist)):
        raise ValueError('ambiguous duplicate keys in a required bat ancestor')
    max_frame=model['maxFrame']; subdivisions=SAMPLE_RATE//FPS
    samples=[]
    for step in range(max_frame*subdivisions+1):
        frame=step/subdivisions
        wrist_position,wrist_rotation=wrist_pose(model,frame,wrist)
        origin=add(wrist_position,rotate(wrist_rotation,attachment['position']))
        rotation=multiply(wrist_rotation,attachment['quaternion'])
        axis=reflect(rotate(rotation,(0.,1.,0.)))
        grip=scale(reflect(origin),UNIT_METERS); tip=add(grip,scale(axis,bat_length)); sweet=add(grip,scale(axis,bat_length*.72))
        converted=(-rotation[0],-rotation[1],rotation[2],rotation[3])
        samples.append({'tick':round(frame/FPS*1e6),'grip':vector(grip),'tip':vector(tip),'sweetSpot':vector(sweet),
          'orientation':dict(zip(('x','y','z','w'),(round(v,9) for v in converted)))})
    for i,sample in enumerate(samples):
        a=samples[max(0,i-1)]; b=samples[min(len(samples)-1,i+1)]
        dt=(b['tick']-a['tick'])/1e6
        sample['sweetSpotVelocity']=vector(scale(sub(tuple(b['sweetSpot'].values()),tuple(a['sweetSpot'].values())),1/dt)) if dt else vector((0.,0.,0.))
    return samples

def compose_frames(segments):
    """Research composition: register each segment's initial rigid bat pose.

    Only one rigid transform is applied to the entire following segment. Its
    local path shape and timing/velocities remain intact; no spline bridge or
    hit/HR outcome is fabricated. This is not the author's original combined
    world motion and not an admitted physical muscle controller.
    """
    result=[]; offset=0
    for segment in segments:
        if not segment: continue
        start=segment[0]; source_origin=tuple(start['grip'].values()); correction=IDENTITY; target_origin=source_origin
        if result:
            target=result[-1]; target_origin=tuple(target['grip'].values()); one=tuple(start['orientation'].values()); two=tuple(target['orientation'].values())
            correction=multiply(two,(-one[0],-one[1],-one[2],one[3]))
        for i,frame in enumerate(segment):
            if result and i==0: continue
            transformed={'tick':offset+frame['tick']-start['tick']}
            for name in ['grip','tip','sweetSpot']:
                transformed[name]=vector(add(target_origin,rotate(correction,sub(tuple(frame[name].values()),source_origin))))
            transformed['sweetSpotVelocity']=vector(rotate(correction,tuple(frame['sweetSpotVelocity'].values())))
            q=multiply(correction,tuple(frame['orientation'].values()))
            transformed['orientation']=dict(zip(('x','y','z','w'),(round(v,9) for v in q)))
            result.append(transformed)
        offset=result[-1]['tick']
    return result

def composite_coverage(segments):
    metadata={}
    for key in ['usedAncestorTracks','unappliedPotentialParentTracks','ambiguousUnappliedTracks']:
        metadata[key]=list(dict.fromkeys(name for segment in segments for name in segment.get(key,[])))
    metadata['sourceMorphs']=[{**morph,'segmentId':segment['id']} for segment in segments for morph in segment.get('sourceMorphs',[])]
    return metadata

def decode_zip_name(info):
    if info.flag_bits & 0x800: return info.filename
    data=bytearray(info.filename.encode('cp437')); index=0
    while index<len(data)-1:
        if 0x81<=data[index]<=0x9f or 0xe0<=data[index]<=0xfc:
            if data[index+1]==0x2f: data[index+1]=0x5c
            index+=2
        else: index+=1
    return data.decode('cp932')

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--downloads',type=Path,default=Path('C:/Users/genki/Downloads'))
    parser.add_argument('--home-password'); parser.add_argument('--miku-password')
    parser.add_argument('--output',type=Path,default=Path('docs/demos/reference-bat-motions.json'))
    args=parser.parse_args()
    archives=[('今日のホームラン打撃＆投球モーションv1.0.zip',args.home_password,'たけちん＠＃！','改変時のみ再配布可・商用可'),
      ('初音ミク打撃汎用モーションv1.0.zip',args.miku_password,'たけちん＠＃！','改変時のみ再配布可・商用可（一部むつごろう様の移動モーションを改変）'),
      ('凛打撃モーション.zip',None,'まゆちゅP','営利利用不可'),('大谷選手っぽい打撃モーション.zip',None,'KEITEL','商用不可・改造再配布可')]
    clips=[]; unavailable=[]
    for archive_index,(archive,password,author,license_note) in enumerate(archives,1):
        path=args.downloads/archive; archive_sha=hashlib.sha256(path.read_bytes()).hexdigest(); motions=[]
        with zipfile.ZipFile(path) as z:
            for info in z.infolist():
                name=decode_zip_name(info)
                if not name.lower().endswith('.vmd') or '/投球モーション/' in name: continue
                data=None
                for encoding in (['utf-8','cp932'] if password else ['utf-8']):
                    try: data=z.read(info,pwd=password.encode(encoding) if password else None); break
                    except RuntimeError: pass
                if data is None:
                    unavailable.append({'archive':archive,'motion':name,'reason':'PASSWORD_REQUIRED_OR_NOT_ACCEPTED','archiveSha256':archive_sha}); continue
                model=parse_vmd(data)
                motions.append((name,data,model))
        attachment=None
        if archive_index==3:
            attached=next((m for name,_,m in motions if 'バット用' in name),None)
            if attached:
                position,quaternion=sample_track(attached['tracks'].get('センター'),0)
                attachment={'position':position,'quaternion':quaternion}
        for index,(name,data,model) in enumerate(motions):
            if 'バット用モーション' in name or not any(n in model['tracks'] for n in ['右手首','左手首']): continue
            frames=make_frames(model,attachment=attachment); wrist='右手首'
            used=[n for n,_ in rig_chain(model,wrist) if n in model['tracks']]
            ignored=[n for n in model['tracks'] if n not in used and any(term in n for term in ['肩','腕','手首','上半身','腰','胸','親'])]
            assumptions=['元モデルのPMX/PMD骨定義なし。標準骨格への研究用移し替えであり元world軌道の正確復元ではありません。',
              'MMD30fps、採用120Hzサンプル。SI倍率1MMD単位=.09m、研究バット全長=.84m、芯=.72を採用。実測値ではありません。',
              '左手座標から右手座標へZ反転。原キーのX/Y/Z/回転Bezierと最短SLERPを適用。',
              '親骨・基準位置は標準仮定。付与変形、IK、モーフ、特殊補助骨、外部親詳細は再現していません。',
              '身体メッシュ・身体モーションは表示/移植せず、バット位置を得るための祖先変換だけ使用。']
            assumptions.append('右手首への取り付けは同梱説明に基づき、バット用VMDの静的移動・回転を使用。元PMXモーフ長さ.5/太さ.6は未適用、.84mへ正規化。' if archive_index==3
              else 'バットは右手首へ、局所+Y軸・取り付け移動回転なしと仮定。元バット装着設定は未確認。')
            label=Path(name).name.removesuffix('.vmd')
            clips.append({'id':f'vmd-{archive_index}-{index}','label':label,'authority':'VMD_STANDARD_RIG_RETARGET_RESEARCH',
              'source':{'archive':archive,'motion':name,'sha256':hashlib.sha256(data).hexdigest(),'archiveSha256':archive_sha,'model':model['model'],'author':author},
              'license':license_note,'fps':FPS,'sampleRateHz':SAMPLE_RATE,'frameRange':{'start':0,'end':model['maxFrame']},
              'normalization':{'metersPerMmdUnit':UNIT_METERS,'batLengthM':.84,'sweetSpotT':.72,'attachmentBone':wrist,'rigVersion':'assumed-standard-mmd-ancestor-chain-v1'},
              'usedAncestorTracks':used,'unappliedPotentialParentTracks':ignored,'ambiguousUnappliedTracks':model.get('ambiguousTracks',[]),'sourceMorphs':model['morphs'],
              'assumptions':assumptions,'frames':frames,
              'metrics':{'maxSweetSpotSpeedMps':max((math.sqrt(sum(v*v for v in f['sweetSpotVelocity'].values())) for f in frames),default=0)}})
    composites=[]
    for side in ['右','左']:
        selected=[]
        for ending in ['③スタンダードバット半寝かせテイクバック.vmd','④トップ.vmd','⑤スイング～インパクト.vmd','⑥フォロースルー.vmd']:
            found=next((c for c in clips if f'/{side}打者/' in c['source']['motion'] and c['source']['motion'].endswith('/'+ending)),None)
            if not found: break
            selected.append(found)
        if len(selected)!=4: continue
        frames=compose_frames([c['frames'] for c in selected]); original=selected[0]
        composition={'policy':'RIGID_REGISTRATION_OF_SEGMENT_START_POSE_FOR_RESEARCH',
          'segments':[{'id':c['id'],'source':c['source']} for c in selected],
          'warning':'元の統合worldモーションではありません。各部分の初期バット姿勢を前部分の終端へ剛体登録した研究用連結です。位置と向きのみ連続で、速度の連続性は保証しません。筋力や接触結果は推定していません。'}
        digest=hashlib.sha256(json.dumps(composition['segments'],ensure_ascii=False,sort_keys=True).encode('utf-8')).hexdigest()
        composites.append({**{k:v for k,v in original.items() if k not in ['frames','source','frameRange','id','label','metrics']},
          'id':'vmd-composite-miku-'+('right' if side=='右' else 'left'), 'label':f'ミク {side}打者：テイクバック→トップ→スイング→振り抜き（研究用連結）',
          'source':{**original['source'],'motion':'③→④→⑤→⑥（研究用連結）','sha256':digest,'hashKind':'ORDERED_SEGMENT_SOURCES_JSON_SHA256'},
          'frameRange':{'start':0,'end':frames[-1]['tick']/1e6*FPS},'frames':frames,'composition':composition,
          'assumptions':original['assumptions']+[composition['warning']],
          **composite_coverage(selected),
          'metrics':{'maxSweetSpotSpeedMps':max(math.sqrt(sum(v*v for v in f['sweetSpotVelocity'].values())) for f in frames)}})
    clips=composites+clips
    result={'schemaVersion':1,'authority':'VMD_STANDARD_RIG_RETARGET_RESEARCH','clips':clips,'unavailable':unavailable}
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':'))+'\n',encoding='utf-8')
    report={'clips':len(clips),'frames':sum(len(c['frames']) for c in clips),'unavailableMotions':len(unavailable),'output':str(args.output),'sha256':hashlib.sha256(args.output.read_bytes()).hexdigest(),'bytes':args.output.stat().st_size}
    print(json.dumps(report,ensure_ascii=False))

if __name__=='__main__': main()
