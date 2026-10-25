import duckdb,json,gzip,re,urllib.request
rel=sorted(re.findall(r'release/([0-9][^/<]+)/',urllib.request.urlopen('https://overturemaps-us-west-2.s3.amazonaws.com/?list-type=2&prefix=release/&delimiter=/').read().decode()))[-1]
print('release',rel)
con=duckdb.connect();con.execute("INSTALL spatial;LOAD spatial;INSTALL httpfs;LOAD httpfs;SET s3_region='us-west-2';")
q=f"""SELECT height,num_floors,class,subtype,to_json(sources) src,ST_AsGeoJSON(geometry) g FROM read_parquet('s3://overturemaps-us-west-2/release/{rel}/theme=buildings/type=building/*',hive_partitioning=1)
WHERE bbox.xmin>119.3 AND bbox.xmax<119.75 AND bbox.ymin>23.1 AND bbox.ymax<23.85"""
rows=con.execute(q).fetchall();print('overture rows',len(rows))
feats=[{'type':'Feature','properties':{'height':r[0],'floors':r[1],'class':r[2],'subtype':r[3],'src':r[4]},'geometry':json.loads(r[5])} for r in rows]
json.dump({'release':rel,'type':'FeatureCollection','features':feats},gzip.open('data/overture-buildings.json.gz','wt'))
open('data/overture-log.txt','w').write(f'release {rel}\nrows {len(rows)}\n')
