"""File storage for CGI Project Hub.

Everything that is not the program itself lives in the storage folder (by default
"OneDrive - Instramac/Desktop/Local Dashboard Storage"), one readable folder per project:

  Projects/<CODE - Name>/project.json          profile + PMP charter
  Projects/<CODE - Name>/Registers/<reg>.json   schedule, actions, meetings, procurement, ...
  Projects/<CODE - Name>/Tracker/*.json         notes, AI proposals, daily summaries
  Projects/<CODE - Name>/Costing/*.json         costing documents (quotes, revisions)
  Projects/<CODE - Name>/Documents/...          attachments and any files you drop in
  Projects/<CODE - Name>/audit.jsonl            who changed what, when
  Projects/<CODE - Name>/_history/<date>.json   daily snapshots (restore from Settings)
  Commercial/                                    quote register, unassigned costings
  Settings/settings.json                         non-secret settings

Writes are atomic (temp file + replace) so a OneDrive sync never sees a half-written file.
"""
from __future__ import annotations
import json, os, re, shutil, threading, time
from datetime import date, datetime, timezone
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
ENTITIES: dict = {k: v for k, v in json.loads((APP / 'config' / 'entities.json').read_text(encoding='utf-8')).items() if not k.startswith('_')}
META: dict = json.loads((APP / 'config' / 'entities.json').read_text(encoding='utf-8')).get('_meta', {})
LOCK = threading.RLock()
ROOT: Path = APP / 'data'          # replaced by init()
VERSION = '12.1'

class ValidationError(ValueError): pass

def now() -> str: return datetime.now(timezone.utc).astimezone().isoformat(timespec='seconds')
def today() -> str: return date.today().isoformat()

# ------------------------------------------------------------------ storage location
DEFAULT_HINT = r'%USERPROFILE%\OneDrive - Instramac\Desktop\Local Dashboard Storage'

def resolve_storage(cli: str | None = None) -> Path:
    """CLI flag > CGI_HUB_STORAGE env > storage_location.txt next to the app > OneDrive default > app/data."""
    cands = []
    if cli: cands.append(cli)
    if os.getenv('CGI_HUB_STORAGE'): cands.append(os.getenv('CGI_HUB_STORAGE'))
    f = APP / 'storage_location.txt'
    if f.exists():
        for line in f.read_text(encoding='utf-8-sig').splitlines():
            line = line.strip()
            if line and not line.startswith('#'): cands.append(line); break
    for c in cands:   # an explicit choice is used (and created) as long as its parent folder exists
        p = Path(os.path.expandvars(os.path.expanduser(c)))
        if p.exists() or p.parent.exists(): return p
    p = Path(os.path.expandvars(DEFAULT_HINT))
    if p.exists() or p.parent.exists(): return p
    return APP / 'data'

def init(path: Path):
    global ROOT
    ROOT = Path(path); ROOT.mkdir(parents=True, exist_ok=True)
    for d in ('Projects', 'Commercial', 'Settings', 'Archive'): (ROOT / d).mkdir(exist_ok=True)
    readme = ROOT / 'README - Local Dashboard Storage.txt'
    if not readme.exists():
        readme.write_text(
            'CGI Project Hub - data storage\r\n==============================\r\n\r\n'
            'This folder holds all project data for the CGI Project Hub app. The app itself is only the shell.\r\n\r\n'
            'Projects\\<CODE - Name>\\   one folder per project: schedule, actions, meetings, RACI, procurement, FAT/SAT,\r\n'
            '                           commercials (Registers), costing documents (Costing), files (Documents),\r\n'
            '                           notes and summaries (Tracker), change log (audit.jsonl) and daily snapshots (_history).\r\n'
            'Commercial\\               company quote register, register backups and costings not yet linked to a project.\r\n'
            'Settings\\                 app settings (API keys are kept on this PC only, not here).\r\n'
            'Archive\\                  archived projects.\r\n\r\n'
            'You can drop files straight into a project\'s Documents folder; they appear in the app under Documents.\r\n'
            'Do not edit the .json files while the app is running. Copy this whole folder to back up or move to another PC.\r\n', encoding='utf-8')
    _index.clear()

# ------------------------------------------------------------------ JSON helpers
def read_json(p: Path, default=None):
    try: return json.loads(p.read_text(encoding='utf-8'))
    except FileNotFoundError: return default
    except json.JSONDecodeError as e: raise RuntimeError(f'{p.name} is damaged ({e}). Restore it from _history or a OneDrive version.')

def write_json(p: Path, obj):
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(p.name + '.tmp')
    tmp.write_text(json.dumps(obj, ensure_ascii=False, indent=1, default=str), encoding='utf-8')
    for i in range(12):   # OneDrive or antivirus can hold a file for a moment
        try: os.replace(tmp, p); return
        except PermissionError:
            time.sleep(0.15 * (i + 1))
    os.replace(tmp, p)

_cache: dict = {}
def cached(p: Path, default):
    try: m = p.stat().st_mtime_ns
    except FileNotFoundError: return default() if callable(default) else default
    hit = _cache.get(p)
    if hit and hit[0] == m: return hit[1]
    data = read_json(p, None)
    if data is None: return default() if callable(default) else default
    _cache[p] = (m, data); return data
def put(p: Path, data):
    write_json(p, data)
    try: _cache[p] = (p.stat().st_mtime_ns, data)
    except FileNotFoundError: pass

# ------------------------------------------------------------------ projects
CODE_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9 _.\-]{0,59}$')
_index: dict = {}
PROJECT_FIELDS = ('code', 'name', 'client_name', 'site', 'description', 'status', 'phase', 'start_date', 'target_finish', 'project_manager', 'sponsor',
                  'quote_ref', 'po_number', 'colour', 'modules', 'charter', 'tags', 'register_code', 'currency')
STATUSES = ['Tender', 'Planning', 'Active', 'On hold', 'Complete', 'Archived']

def safe_name(s: str, n=60) -> str:
    s = re.sub(r'[<>:"/\\|?*\x00-\x1f]', '', str(s or '')).strip().rstrip('.')
    return re.sub(r'\s+', ' ', s)[:n].strip() or 'Project'

def scan():
    _index.clear()
    for base in (ROOT / 'Projects', ROOT / 'Archive'):
        if not base.exists(): continue
        for d in sorted(base.iterdir()):
            pj = d / 'project.json'
            if d.is_dir() and pj.exists():
                try: p = read_json(pj, {})
                except RuntimeError: continue
                if p.get('code'): _index[p['code'].upper()] = d
    return _index

def pdir(code: str) -> Path:
    c = str(code or '').upper()
    d = _index.get(c)
    if not d or not (d / 'project.json').exists():
        scan(); d = _index.get(c)
    if not d: raise KeyError(f'Project {code} not found')
    return d

def exists(code) -> bool:
    try: pdir(code); return True
    except KeyError: return False

def list_projects(include_archived=True):
    scan(); out = []
    for c, d in _index.items():
        p = cached(d / 'project.json', {})
        if p and (include_archived or p.get('status') != 'Archived'): out.append({**p, 'folder': str(d)})
    return sorted(out, key=lambda p: (p.get('status') in ('Complete', 'Archived'), p.get('code', '')))

def get_project(code):
    d = pdir(code); return {**cached(d / 'project.json', {}), 'folder': str(d)}

def create_project(data: dict, actor='web'):
    code = str(data.get('code') or '').strip().upper()
    if not CODE_RE.match(code): raise ValidationError('Project code: use letters, numbers, - _ . (max 60).')
    if not (data.get('name') or '').strip(): raise ValidationError('Project name is required')
    with LOCK:
        if exists(code): raise ValidationError(f'Project {code} already exists')
        d = ROOT / 'Projects' / safe_name(f"{code} - {data['name']}", 90)
        i = 2
        while d.exists(): d = ROOT / 'Projects' / safe_name(f"{code} - {data['name']} ({i})", 90); i += 1
        for sub in ('Registers', 'Tracker', 'Costing', 'Documents/General', '_history'): (d / sub).mkdir(parents=True, exist_ok=True)
        p = {k: data.get(k) for k in PROJECT_FIELDS if data.get(k) is not None}
        p.update({'code': code, 'name': data['name'].strip(), 'status': data.get('status') or 'Active', 'created_at': now(), 'updated_at': now()})
        p.setdefault('modules', {}); p.setdefault('charter', {})
        put(d / 'project.json', p); _index[code] = d
        audit(code, 'project', None, 'create', None, {'code': code, 'name': p['name']}, actor)
        return {**p, 'folder': str(d)}

def update_project(code, data: dict, actor='web'):
    with LOCK:
        d = pdir(code); p = dict(cached(d / 'project.json', {})); before = {}
        for k in PROJECT_FIELDS:
            if k in data and k != 'code':
                if k in ('charter', 'modules') and isinstance(data[k], dict): v = {**(p.get(k) or {}), **data[k]}
                else: v = data[k]
                if p.get(k) != v: before[k] = p.get(k); p[k] = v
        if 'name' in data and not str(p.get('name') or '').strip(): raise ValidationError('Project name is required')
        p['updated_at'] = now(); put(d / 'project.json', p)
        if before: audit(code, 'project', None, 'update', before, {k: p.get(k) for k in before}, actor)
        if data.get('status') == 'Archived' and d.parent.name == 'Projects': _move(code, d, ROOT / 'Archive' / d.name)
        elif data.get('status') and data.get('status') != 'Archived' and d.parent.name == 'Archive': _move(code, d, ROOT / 'Projects' / d.name)
        return get_project(code)

def _move(code, src: Path, dst: Path):
    if dst.exists(): return
    shutil.move(str(src), str(dst)); _cache.clear(); _index[code.upper()] = dst

# ------------------------------------------------------------------ validation
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
def clean(entity: str, data: dict, partial: bool) -> dict:
    if entity not in ENTITIES: raise ValidationError(f'Unknown register: {entity}')
    out = {}
    for f in ENTITIES[entity]['fields']:
        k, t = f['k'], f['t']
        if k not in data: continue
        v = data[k]
        if t == 'json':
            if isinstance(v, str):
                try: v = json.loads(v) if v.strip() else None
                except json.JSONDecodeError: raise ValidationError(f"{f['label']}: not valid JSON")
            out[k] = v; continue
        if v is None or (isinstance(v, str) and v.strip() == ''): out[k] = None; continue
        try:
            if t in ('number', 'money', 'pct'):
                v = float(str(v).replace(' ', '').replace(' ', '').replace(',', '').replace('R', '').replace('%', ''))
                if v.is_integer() and t != 'money': v = int(v)
            elif t == 'bool': v = 1 if v in (True, 1, '1', 'true', 'True', 'yes', 'on') else 0
            elif t == 'ref': v = int(v)
            elif t == 'date':
                v = str(v)[:10]
                if not DATE_RE.match(v): raise ValidationError(f"{f['label']}: use YYYY-MM-DD")
                date.fromisoformat(v)
            else: v = str(v)
        except ValidationError: raise
        except (TypeError, ValueError): raise ValidationError(f"{f['label']}: '{data[k]}' is not a valid {t}")
        out[k] = v
    if isinstance(data.get('thread'), list):   # comments & photos on any record: [{by, at, t, files:[path]}]
        out['thread'] = [{k: str(e.get(k) or '')[:4000] if k != 'files' else [str(x)[:400] for x in (e.get('files') or [])][:20] for k in ('by', 'at', 't', 'files')}
                         for e in data['thread'] if isinstance(e, dict)][-300:]
    if not partial:
        for f in ENTITIES[entity]['fields']:
            if f.get('req') and out.get(f['k']) in (None, ''): raise ValidationError(f"{f['label']} is required")
            if f['k'] not in out and 'default' in f: out[f['k']] = f['default']
    return out

# ------------------------------------------------------------------ tables (registers + tracker tables)
def _tpath(code, table):
    if table in ENTITIES: return pdir(code) / 'Registers' / f'{table}.json'
    if table in ('captures', 'proposals', 'summaries'): return pdir(code) / 'Tracker' / f'{table}.json'
    if table == 'rf_state': return pdir(code) / 'RF Lab' / 'rf_state.json'
    raise ValidationError(f'Unknown register: {table}')

def table(code, t) -> dict:
    return cached(_tpath(code, t), lambda: {'next_id': 1, 'records': []})

def rows(code, t) -> list: return table(code, t)['records']

def _save_table(code, t, tb):
    snapshot_if_due(code); put(_tpath(code, t), tb); touch(code)

def get(code, t, rid):
    rid = int(rid)
    for r in rows(code, t):
        if r.get('id') == rid: return r
    return None

def insert(code, t, rec: dict) -> dict:
    with LOCK:
        tb = json.loads(json.dumps(table(code, t)))
        rid = max([tb.get('next_id', 1)] + [r['id'] + 1 for r in tb['records']])
        r = {'id': rid, **rec, 'created_at': rec.get('created_at') or now(), 'updated_at': now()}
        tb['records'].append(r); tb['next_id'] = rid + 1; _save_table(code, t, tb); return r

def patch_row(code, t, rid, fields: dict) -> dict:
    with LOCK:
        tb = json.loads(json.dumps(table(code, t)))
        for r in tb['records']:
            if r['id'] == int(rid):
                r.update(fields); r['updated_at'] = now(); _save_table(code, t, tb); return r
        raise KeyError(f'{t} {rid} not found')

def all_entities(code) -> dict: return {k: rows(code, k) for k in ENTITIES}

def create(code, entity, data, actor='web', source='manual') -> dict:
    d = clean(entity, data, partial=False)
    with LOCK:
        r = insert(code, entity, {'source': source, **d}); audit(code, entity, r['id'], 'create', None, d, actor); return r

def update(code, entity, rid, data, actor='web') -> dict:
    d = clean(entity, data, partial=True)
    with LOCK:
        before = get(code, entity, rid)
        if not before: raise KeyError(f'{entity} {rid} not found')
        changed = {k: v for k, v in d.items() if before.get(k) != v}
        if not changed: return before
        r = patch_row(code, entity, rid, changed)
        audit(code, entity, int(rid), 'update', {k: before.get(k) for k in changed}, changed, actor); return r

def delete(code, entity, rid, actor='web'):
    if entity not in ENTITIES: raise ValidationError(f'Unknown register: {entity}')
    with LOCK:
        tb = json.loads(json.dumps(table(code, entity)))
        before = next((r for r in tb['records'] if r['id'] == int(rid)), None)
        if not before: raise KeyError(f'{entity} {rid} not found')
        tb['records'] = [r for r in tb['records'] if r['id'] != int(rid)]
        _save_table(code, entity, tb); audit(code, entity, int(rid), 'delete', before, None, actor)
        return {'ok': True}

def bulk_update(code, entity, items, actor='web'):
    return [update(code, entity, int(it['id']), {k: v for k, v in it.items() if k != 'id'}, actor) for it in items]

# ------------------------------------------------------------------ audit, revision, snapshots
def audit(code, entity, eid, action, before=None, after=None, actor='web'):
    try:
        line = json.dumps({'at': now(), 'entity': entity, 'id': eid, 'action': action, 'before': before, 'after': after, 'actor': actor}, ensure_ascii=False, default=str)
        with open(pdir(code) / 'audit.jsonl', 'a', encoding='utf-8') as fh: fh.write(line + '\n')
    except OSError as e: print('Audit write failed:', e)

def read_audit(code, limit=300, since=None, entity=None, eid=None):
    p = pdir(code) / 'audit.jsonl'
    if not p.exists(): return []
    lines = p.read_text(encoding='utf-8', errors='replace').splitlines()
    out = []
    for i, line in enumerate(reversed(lines)):
        try: a = json.loads(line)
        except json.JSONDecodeError: continue
        if since and a.get('at', '') < since: break
        if entity and (a.get('entity') != entity or (eid is not None and str(a.get('id')) != str(eid))): continue
        a['n'] = len(lines) - i; out.append(a)
        if len(out) >= limit: break
    return out

_rev: dict = {}
def touch(code): _rev[code.upper()] = time.time()
def revision(code) -> float:
    d = pdir(code); m = 0.0
    for p in [d / 'project.json', *(d / 'Registers').glob('*.json')]:
        try: m = max(m, p.stat().st_mtime)
        except OSError: pass
    return max(m, _rev.get(code.upper(), 0))

def snapshot(code, label=None) -> Path:
    d = pdir(code); h = d / '_history'; h.mkdir(exist_ok=True)
    name = label or today()
    dump = {'taken': now(), 'project': cached(d / 'project.json', {}), 'registers': {k: table(code, k) for k in ENTITIES}}
    p = h / f'{name}.json'; write_json(p, dump)
    snaps = sorted(x for x in h.glob('????-??-??.json'))
    for old in snaps[:-45]: old.unlink(missing_ok=True)
    return p

def snapshot_if_due(code):
    try:
        p = pdir(code) / '_history' / f'{today()}.json'
        if not p.exists(): snapshot(code)
    except Exception as e: print('Snapshot skipped:', e)

def list_snapshots(code):
    h = pdir(code) / '_history'
    return [{'name': p.stem, 'size': p.stat().st_size, 'modified': datetime.fromtimestamp(p.stat().st_mtime).isoformat(timespec='seconds')}
            for p in sorted(h.glob('*.json'), reverse=True)] if h.exists() else []

def restore(code, name, actor='web'):
    d = pdir(code); p = d / '_history' / f'{safe_name(name)}.json'
    if not p.exists(): raise KeyError('Snapshot not found')
    dump = read_json(p)
    with LOCK:
        snapshot(code, 'before-restore-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
        for k, tb in dump.get('registers', {}).items():
            if k in ENTITIES: put(_tpath(code, k), tb)
        audit(code, 'project', None, 'restore', None, {'snapshot': name}, actor); touch(code)
    return {'ok': True, 'restored': name}

# ------------------------------------------------------------------ documents (files)
def docs_root(code) -> Path:
    r = pdir(code) / 'Documents'; r.mkdir(exist_ok=True); return r

def entity_folder(entity) -> str:
    return safe_name(ENTITIES[entity]['label'], 50) if entity in ENTITIES else safe_name(entity or 'General', 50)

def save_file(code, filename, content: bytes, entity=None, entity_id=None, folder=None) -> dict:
    name = safe_name(Path(filename or 'file').name, 120) or 'file'
    if entity and entity_id: base = docs_root(code) / entity_folder(entity) / str(int(entity_id))
    elif folder: base = docs_root(code) / Path(*[safe_name(x) for x in Path(folder).parts if x not in ('..', '.')])
    else: base = docs_root(code) / 'General'
    base.mkdir(parents=True, exist_ok=True)
    p = base / name; stem, suf, i = p.stem, p.suffix, 2
    while p.exists(): p = base / f'{stem} ({i}){suf}'; i += 1
    p.write_bytes(content)
    audit(code, entity or 'documents', entity_id, 'upload', None, {'file': str(p.relative_to(pdir(code)))})
    return file_info(code, p)

def file_info(code, p: Path) -> dict:
    root = pdir(code); rel = p.relative_to(root).as_posix(); st = p.stat()
    parts = p.relative_to(root / 'Documents').parts if (root / 'Documents') in p.parents else ()
    ent, eid = None, None
    if len(parts) >= 3:
        lab = {entity_folder(k): k for k in ENTITIES}; ent = lab.get(parts[0])
        eid = int(parts[1]) if ent and parts[1].isdigit() else None
    if p.parent.name == 'Tracker' or 'Voice notes' in parts: ent = ent or 'captures'
    return {'path': rel, 'filename': p.name, 'size': st.st_size, 'modified': datetime.fromtimestamp(st.st_mtime).isoformat(timespec='seconds'),
            'entity': ent, 'entity_id': eid, 'folder': '/'.join(parts[:-1]) if parts else p.parent.name}

def list_files(code) -> list:
    root = docs_root(code)
    return sorted((file_info(code, p) for p in root.rglob('*') if p.is_file() and not p.name.endswith('.tmp') and not p.name.startswith('~$')),
                  key=lambda f: f['path'].lower())

def resolve_rel(code, rel: str) -> Path:
    root = pdir(code).resolve(); p = (root / rel).resolve()
    if root != p and root not in p.parents: raise PermissionError('Path outside the project folder')
    return p

def delete_file(code, rel):
    p = resolve_rel(code, rel)
    if 'Documents' not in p.relative_to(pdir(code).resolve()).parts[:1]: raise PermissionError('Only files under Documents can be removed here')
    trash = pdir(code) / 'Documents' / '_Deleted'; trash.mkdir(exist_ok=True)
    shutil.move(str(p), str(trash / f"{datetime.now().strftime('%Y%m%d-%H%M%S')} {p.name}"))
    audit(code, 'documents', None, 'delete', {'file': rel}, None); return {'ok': True}

# ------------------------------------------------------------------ settings (non-secret)
def settings() -> dict: return cached(ROOT / 'Settings' / 'settings.json', {})
def save_settings(d: dict):
    s = dict(settings()); s.update(d); put(ROOT / 'Settings' / 'settings.json', s); return s
