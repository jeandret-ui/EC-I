"""Patch the V3 costing/quote-register module so it runs inside CGI Project Hub:
- costing documents stored per project (Projects/<CODE>/Costing) or Commercial/Costings/<code>
- relative URLs (served under /costing/)
- CGI colour palette
"""
import re, sys
from pathlib import Path
M = Path(sys.argv[1])

def sub(path, old, new, count=1):
    p = M / path; s = p.read_text(encoding='utf-8')
    if old not in s: raise SystemExit(f'{path}: pattern not found: {old[:80]}')
    s = s.replace(old, new) if count == 0 else s.replace(old, new, count); p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------- python: storage routing
sub('app.py', "DATA=Path(os.environ.get('CGI_COSTING_DATA',str(ROOT/'data')));PROJECTS=DATA/'projects';BACKUPS=DATA/'backups'\nfor d in [DATA,PROJECTS,BACKUPS]:d.mkdir(parents=True,exist_ok=True)",
"""DATA=Path(os.environ.get('CGI_COSTING_DATA',str(ROOT/'data')));COSTINGS=DATA/'Costings'
for d in [DATA,COSTINGS]:d.mkdir(parents=True,exist_ok=True)
# --- CGI Project Hub storage routing: documents for a project code live in that project's folder.
def code_dir(code):return None          # replaced by the hub: project code -> Projects/<..>/Costing or None
def workspace_dirs():return []          # replaced by the hub: every Projects/*/Costing folder
def safe_code(c):return re.sub(r'[^A-Za-z0-9 _.-]','',str(c or '').strip().upper())[:60] or '_Unassigned'
def all_doc_paths():
    out={}
    for p in COSTINGS.rglob('*.json'):
        if '_history' not in p.parts and p.name!='active.json':out[p.stem]=p
    for d in workspace_dirs():
        for p in Path(d).glob('*.json'):out[p.stem]=p
    return out
def doc_path(i):
    p=all_doc_paths().get(i)
    if not p:raise ValueError('Costing document not found.')
    return p
def target_dir(project_no):
    d=code_dir(project_no) if project_no else None
    return Path(d) if d else COSTINGS/safe_code(project_no)""")
sub('app.py', "def load(v):return readjson(PROJECTS/(pid(v)+'.json'))", "def load(v):return readjson(doc_path(pid(v)))")
sub('app.py', "validate(p);i=pid(p.get('id') or uuid.uuid4().hex);path=PROJECTS/(i+'.json')",
    "validate(p);i=pid(p.get('id') or uuid.uuid4().hex);old=all_doc_paths().get(i);tdir=target_dir(s.get('project_no'));tdir.mkdir(parents=True,exist_ok=True);path=tdir/(i+'.json')")
sub('app.py', "current=readjson(path) if path.exists() else None", "current=readjson(old) if old and old.exists() else None")
sub('app.py', "stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');atomic(BACKUPS/(i+'-'+stamp+'.json'),current)\n            # Keep the latest 40 versions per project, in addition to current data.\n            for old in sorted(BACKUPS.glob(i+'-*.json'))[:-40]:old.unlink()",
    "hist=old.parent/'_history';hist.mkdir(exist_ok=True);stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');atomic(hist/(i+'-'+stamp+'.json'),current)\n            # Keep the latest 40 versions per document, in addition to current data.\n            for oldb in sorted(hist.glob(i+'-*.json'))[:-40]:oldb.unlink()")
sub('app.py', "atomic(path,clean);atomic(DATA/'active.json',{'id':i})",
    "atomic(path,clean);atomic(DATA/'active.json',{'id':i})\n        if old and old.exists() and old.resolve()!=path.resolve():old.unlink()")
sub('app.py', "if not list(PROJECTS.glob('*.json')):save(TEMPLATE)", "if not all_doc_paths():save(TEMPLATE)")
sub('app.py', "except (OSError,KeyError,ValueError):return load(sorted(PROJECTS.glob('*.json'))[0].stem)", "except (OSError,KeyError,ValueError):return load(sorted(all_doc_paths())[0])")
sub('app.py', "project_index([readjson(p) for p in sorted(PROJECTS.glob('*.json'))], REG.read()['records'])", "project_index([readjson(p) for p in all_doc_paths().values()], REG.read()['records'])")
sub('app.py', "for p in sorted(PROJECTS.glob('*.json')) for d in [readjson(p)]]", "for p in all_doc_paths().values() for d in [readjson(p)]]")
# temp file name must not collide with OneDrive-synced .json neighbours
sub('app.py', "temp=path.with_suffix('.tmp')", "temp=path.with_name(path.name+'.tmp')")

# ---------------------------------------------------------------- web: relative URLs
for f in ['web/index.html', 'web/app.js', 'web/project.js', 'web/register.js']:
    p = M / f; s = p.read_text(encoding='utf-8')
    s = s.replace('href="/', 'href="').replace('src="/', 'src="').replace("'/api/", "'api/").replace('"/api/', '"api/')
    p.write_text(s, encoding='utf-8')

# ---------------------------------------------------------------- web: CGI palette (teal/green -> CGI blue)
PAL = {'#142c31': '#0b2342', '#18786b': '#005093', '#e6f2ec': '#e7eff8', '#f6f7f4': '#f4f6f9', '#243d42': '#1b2b3a', '#758589': '#66788a', '#dfe5df': '#dde3ea',
       '#125c52': '#003d72', '#254a4d': '#173c66', '#eff5f1': '#eef4fb', '#80c2ae': '#7fb2e5', '#a1bdbb': '#9db4cf', '#7c999b': '#7f97b3', '#b6c9c8': '#b7c7da',
       '#bac9c9': '#b7c7da', '#f3f6f0': '#f4f6f9', '#dce7da': '#dde3ea', '#e9f2e7': '#e7eff8'}
for f in ['web/style.css', 'web/register.css', 'web/project.css', 'web/app.js', 'web/project.js', 'web/register.js', 'web/icons.js']:
    p = M / f; s = p.read_text(encoding='utf-8')
    for a, b in PAL.items(): s = re.sub(re.escape(a), b, s, flags=re.I)
    p.write_text(s, encoding='utf-8')
print('costing module patched')

# ---------------------------------------------------------------- shift remaining green/teal tints to CGI blue-greys
import colorsys
def shift(m):
    h = m.group(0); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, l, s = colorsys.rgb_to_hls(r, g, b)
    if 80 / 360 <= hh <= 200 / 360 and s > 0.04:
        r2, g2, b2 = colorsys.hls_to_rgb(212 / 360, l, min(s, 0.55))
        return '#%02x%02x%02x' % tuple(round(x * 255) for x in (r2, g2, b2))
    return h
for f in ['web/style.css', 'web/register.css', 'web/project.css', 'web/app.js', 'web/project.js', 'web/register.js', 'web/icons.js']:
    p = M / f; s = p.read_text(encoding='utf-8')
    s = re.sub(r'#[0-9a-fA-F]{6}\b', shift, s)
    p.write_text(s, encoding='utf-8')
print('tints shifted')
