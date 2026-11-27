import json, re, time, urllib.request, urllib.parse, html, os
FULL_REFRESH=os.environ.get('FULL_REFRESH','false').lower()=='true'
DEADLINE=time.monotonic()+600
from html.parser import HTMLParser
from pathlib import Path

class Page(HTMLParser):
    def __init__(self):
        super().__init__(); self.data={}; self.links=[]; self.meta={}; self.tags=set(); self.tag_text=False; self.tag_scope=0; self.div_stack=[]; self.release_tags_seen=False
    def handle_starttag(self, tag, attrs):
        a=dict(attrs)
        if tag=='div':
            scope='tralbum-tags' in a.get('class','').split()
            self.div_stack.append(scope)
            if scope: self.tag_scope+=1; self.release_tags_seen=True
        if tag=='a' and a.get('href'):
            self.links.append(a['href'])
            u=urllib.parse.urlparse(a['href'])
            if self.tag_scope and 'tag' in a.get('class','').split() and '/tag/' in u.path:
                self.tags.add(urllib.parse.unquote(u.path.split('/tag/',1)[1]).strip('/').replace('-',' '))
        if self.tag_scope and tag=='a' and 'tag' in a.get('class','').split(): self.tag_text=True
        if tag=='meta': self.meta[a.get('property',a.get('name',''))]=a.get('content','')
        for k in ('data-tralbum','data-band','data-blob','data-client-items','data-items','data-props'):
            if a.get(k):
                try: self.data[k]=json.loads(a[k])
                except ValueError: pass

    def handle_data(self, data):
        if self.tag_text and data.strip(): self.tags.add(data.strip().casefold())
    def handle_endtag(self, tag):
        if tag=='a': self.tag_text=False
        if tag=='div' and self.div_stack:
            if self.div_stack.pop(): self.tag_scope-=1

def get(url):
    if time.monotonic()>DEADLINE: raise TimeoutError('Sync time budget reached')
    time.sleep(1)
    req=urllib.request.Request(url,headers={'User-Agent':'BlackUnicornCatalogue/1.0 (label catalogue sync)'})
    with urllib.request.urlopen(req,timeout=8) as r:
        if urllib.parse.urlparse(r.url).hostname not in ('larrylush.bandcamp.com','quietmanmusic.bandcamp.com','friendsloversandfamily.bandcamp.com'): raise ValueError('Unexpected redirect')
        p=Page(); p.feed(r.read(4000000).decode('utf-8','replace')); return p

def canonical(url):
    u=urllib.parse.urlparse(url)
    return 'https://'+u.netloc+u.path.rstrip('/')

def normalize_artist(name):
    key=re.sub(r'[^a-z0-9]+','',name.casefold().replace('&','and'))
    aliases={'friendsloversandfamily':'Friends, Lovers & Family','flf':'Friends, Lovers & Family','quietman':'Quietman','larrylush':'Larry Lush','blackunicornrecordings':'Black Unicorn Recordings'}
    return aliases.get(key,' '.join(name.split()))

path=Path('catalogue.json')
def promotional(title):
    return bool(re.search(r'\bradio[\s-]+show\b', title or '', re.I))

records=json.loads(path.read_text())
original_count=len(records)
records=[r for r in records if not promotional(r.get('title'))]
if len(records)!=original_count:
    path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
normalized=0
for record in records:
    name=normalize_artist(record['artist'])
    if name!=record['artist']:
        record['artist']=name; normalized+=1
known={canonical(r['url']):r for r in records}
urls=set(known)
def discover(value,base):
    if isinstance(value,dict):
        for v in value.values(): discover(v,base)
    elif isinstance(value,list):
        for v in value: discover(v,base)
    elif isinstance(value,str) and re.match(r'^(https://[^/]+)?/(album|track)/[^/?#]+',value):
        u=urllib.parse.urljoin(base,value); parts=urllib.parse.urlparse(u)
        if parts.hostname==urllib.parse.urlparse(base).hostname: urls.add(canonical(u))

for host in ('larrylush.bandcamp.com','quietmanmusic.bandcamp.com','friendsloversandfamily.bandcamp.com'):
    try:
        base='https://'+host+'/music'
        p=get(base)
        for link in p.links:
            u=urllib.parse.urljoin(base,link); parts=urllib.parse.urlparse(u)
            if parts.hostname==host and parts.path.startswith(('/album/','/track/')): urls.add(canonical(u))
        discover(p.data,base)
        print('Discovery:',host,len(urls))
    except Exception as e: print('Discovery failed:',host,e)
seen_ids={(r.get('kind','album'),int(r['embed'])):r for r in records if r.get('embed')}
updated=0
for url in sorted(urls,key=lambda u: ('larrylush.bandcamp.com' not in u,u)):
    if time.monotonic()>DEADLINE: break
    old=known.get(url)
    if old and old.get('embed') and old.get('genre','Unclassified').casefold()!='unclassified' and not FULL_REFRESH: continue
    try:
        kind='track' if '/track/' in urllib.parse.urlparse(url).path else 'album'
        p=get(url); t=p.data.get('data-tralbum',{}); c=t.get('current') or {}
        if promotional(c.get('title') or p.meta.get('og:title') or ''):
            print('Excluded promotional radio show:',url)
            if old and old in records:
                records.remove(old); updated+=1
            continue
        aid=c.get('id') or t.get('id')
        if not aid:
            m=re.search(kind+r'=(\d+)',p.meta.get('og:video','')+' '+p.meta.get('og:video:secure_url',''))
            aid=int(m.group(1)) if m else None
        if not aid or not str(aid).isdigit(): raise ValueError('No album ID found')
        if old:
            old['embed']=int(aid)
            old['kind']=kind
            seen_ids[(kind,int(aid))]=old
        elif (kind,int(aid)) in seen_ids:
            print('Duplicate album ID:',url,aid); continue
        else:
            title=c.get('title') or p.meta.get('og:title')
            artist=t.get('artist') or c.get('artist') or p.meta.get('og:site_name')
            art=p.meta.get('og:image')
            if not all(isinstance(x,str) and x for x in (title,artist,art)): raise ValueError('Incomplete metadata')
            records.append(dict(title=title,artist=normalize_artist(artist),genre='Unclassified',kind=kind,img=art,url=url,embed=int(aid),description=c.get('about') or ''))
            seen_ids[(kind,int(aid))]=records[-1]
        record=old if old else records[-1]
        tags=sorted({x.strip().casefold() for x in p.tags if x.strip()})
        if p.release_tags_seen:
            record['tags']=[tag for tag in tags if tag not in ('portugal','london','united kingdom','uk electronic','quietman','larry lush','ambiet') and tag in ('ambient','trance','breakbeat','house','techno','dub','electronica','experimental','eclectic','progressive trance','classic trance','chillout','drum & bass','jungle','soundscape')][:2]
            # Account-wide tags can appear on every release. Only explicit genre tags override curated genres.
            for genre in ('Ambient','Trance','Breakbeat','House','Techno','Dub','Electronica','Archive'):
                if any(tag in ('genre:'+genre.casefold(), 'genre: '+genre.casefold(), 'genre '+genre.casefold()) for tag in tags):
                    record['genre']=genre
                    break
        if record.get('genre','Unclassified').casefold()=='unclassified':
            candidates=[g for g in ('Ambient','Trance','Breakbeat','House','Techno','Dub','Electronica','Experimental','Eclectic') if g.casefold() in tags]
            if len(candidates)==1: record['genre']=candidates[0]
        record['release_date']=c.get('release_date') or t.get('album_release_date') or record.get('release_date')
        record['metadata_checked']=p.release_tags_seen
        updated+=1; print('Imported:',url,aid,'tags:',tags)
    except Exception as e: print('Skipped:',url,e)
if updated or normalized:
    path.write_text(json.dumps(records,ensure_ascii=False,indent=2)+'\n')
print('Updated releases:',updated)
print('Remaining missing IDs:',sum(not r.get('embed') for r in records))

# Prefer the label account for exact artist/title/format matches.
def release_key(r):
    return (normalize_artist(r['artist']).casefold(), ' '.join(r['title'].casefold().split()), r.get('kind','album'))
unique={}
for r in sorted(records,key=lambda r: 'larrylush.bandcamp.com' not in r['url']):
    unique.setdefault(release_key(r),r)
if len(unique)!=len(records):
    print('Removed duplicate releases:',len(records)-len(unique))
    path.write_text(json.dumps(list(unique.values()),ensure_ascii=False,indent=2)+'\n')

# Merchandise discovery across all label accounts, including physical album packages.
mp=Path('merch.json')
merch=json.loads(mp.read_text())
products={canonical(r['url']):r for r in merch}
hosts=('larrylush.bandcamp.com','quietmanmusic.bandcamp.com','friendsloversandfamily.bandcamp.com')
def merch_links(value,base,out):
    if isinstance(value,dict):
        for v in value.values(): merch_links(v,base,out)
    elif isinstance(value,list):
        for v in value: merch_links(v,base,out)
    elif isinstance(value,str):
        u=urllib.parse.urljoin(base,value)
        p=urllib.parse.urlparse(u)
        if p.hostname in hosts and re.match(r'^/merch/[^/]+',p.path): out.add(canonical(u))
def category(title):
    t=title.casefold()
    for pattern,cat in [(r'hoodie|sweatshirt','Hoodies'),(r'tee|t-shirt|t shirt','T-shirts'),(r'vinyl|\blp\b','Vinyl'),(r'\bcd\b|compact disc','CDs'),(r'plug.?in|software|vst','Software'),(r'book|print|poster','Art & books'),(r'bundle','Bundles')]:
        if re.search(pattern,t): return cat
    return 'Other'
for host in hosts:
    base='https://'+host+'/merch'
    try:
        p=get(base); found=set()
        merch_links(p.links,base,found); merch_links(p.data,base,found)
        print('Merch discovery:',host,len(found))
        for url in sorted(found):
            if time.monotonic()>DEADLINE: break
            if url in products and not FULL_REFRESH: continue
            try:
                q=get(url)
                title=q.meta.get('og:title','').strip()
                art=q.meta.get('og:image','')
                if not title or not art: raise ValueError('Missing product metadata')
                old=products.get(url,{})
                products[url]={**old,'title':title,'category':category(title),'img':art,'url':url,'description':q.meta.get('og:description') or old.get('description',''),'price':old.get('price')}
                print('Merch imported:',url)
            except Exception as e: print('Merch skipped:',url,e)
    except Exception as e: print('Merch discovery failed:',host,e)
mp.write_text(json.dumps(list(products.values()),ensure_ascii=False,indent=2)+'\n')
print('Merch products:',len(products))
