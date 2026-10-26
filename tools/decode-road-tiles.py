"""Extract factual OSM road lines from the archived mapstew MVT files.
MVT 2.1 specification: https://github.com/mapbox/vector-tile-spec/tree/master/2.1
Input is an envelope of base64 tile files fetched via GitHub's file API.
"""
import sys,json,base64,struct,math,hashlib

def varint(data,i):
 v=0;s=0
 while True:
  b=data[i];i+=1;v|=(b&127)<<s
  if b<128:return v,i
  s+=7
  if s>70:raise ValueError('Bad varint')
def fields(data):
 i=0
 while i<len(data):
  k,i=varint(data,i);wire=k&7;n=k>>3
  if wire==0:v,i=varint(data,i)
  elif wire==1:v=data[i:i+8];i+=8
  elif wire==2:l,i=varint(data,i);v=data[i:i+l];i+=l
  elif wire==5:v=data[i:i+4];i+=4
  else:raise ValueError('Unknown protobuf wire type')
  yield n,wire,v

def packed(data):
 out=[];i=0
 while i<len(data):v,i=varint(data,i);out.append(v)
 return out

def value(data):
 for n,w,v in fields(data):
  if n==1:return v.decode('utf-8')
  if n==2:return struct.unpack('<f',v)[0]
  if n==3:return struct.unpack('<d',v)[0]
  if n in (4,5):return v
  if n==6:return (v>>1)^-(v&1)
  if n==7:return bool(v)

def lines(data):
 a=packed(data);i=0;x=y=0;paths=[];current=[]
 while i<len(a):
  c=a[i];i+=1;op=c&7;count=c>>3
  if op in (1,2):
   for _ in range(count):
    dx,dy=a[i],a[i+1];i+=2;x+=(dx>>1)^-(dx&1);y+=(dy>>1)^-(dy&1)
    if op==1:
     if current:paths.append(current)
     current=[]
    current.append([x,y])
  elif op==7:
   if current and current[-1]!=current[0]:current.append(current[0])
  else:raise ValueError('Unknown MVT geometry command')
 if current:paths.append(current)
 return [p for p in paths if len(p)>1]

source=json.load(open(sys.argv[1]));features=[];counts={};tile_manifest=[]
for tile in source['tiles']:
 raw=base64.b64decode(tile['data']);tile_manifest.append({k:tile[k] for k in ['z','x','y','sha']})
 if len(raw)!=tile['size']:raise ValueError('Truncated source tile')
 for n,w,layer in fields(raw):
  if n!=3:continue
  lf=list(fields(layer));name=next((v.decode() for n,w,v in lf if n==1),'')
  if name!='road':continue
  keys=[v.decode() for n,w,v in lf if n==3];values=[value(v) for n,w,v in lf if n==4];extent=next(v for n,w,v in lf if n==5)
  for n,w,feature in lf:
   if n!=2:continue
   ff=list(fields(feature));typ=next((v for n,w,v in ff if n==3),None)
   if typ!=2:continue
   tags=next((packed(v) for n,w,v in ff if n==2),[]);attrs={keys[tags[i]]:values[tags[i+1]] for i in range(0,len(tags),2)}
   geom=next(v for n,w,v in ff if n==4)
   for path in lines(geom):
    coords=[];global_grid=[]
    for x,y in path:
     gx=tile['x']*extent+x;gy=tile['y']*extent+y;nn=(2**tile['z'])*extent
     lng=gx/nn*360-180;lat=math.degrees(math.atan(math.sinh(math.pi*(1-2*gy/nn))))
     coords.append([lng,lat]);global_grid.append([gx,gy])
    features.append({'type':'Feature','properties':attrs,'geometry':{'type':'LineString','coordinates':coords},'grid':global_grid})
    h=attrs.get('highway','');counts[h]=counts.get(h,0)+1
out={'type':'FeatureCollection','properties':{'source':'OpenStreetMap via mapstew archived vector tiles','timestamp':source['timestamp'],'zoom':14,'sourceURL':source['source'],'license':'ODbL-1.0','tiles':tile_manifest},'features':features}
json.dump(out,open(sys.argv[2],'w'),ensure_ascii=False,separators=(',',':'))
print(json.dumps({'features':len(features),'classes':counts,'bridges':[f['properties'] for f in features if '橋' in f['properties'].get('name','')]},ensure_ascii=False))
