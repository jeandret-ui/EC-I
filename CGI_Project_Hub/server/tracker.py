"""Tracker: notes and voice notes -> proposed register changes (approved by a person), daily summaries, Q&A.

API keys are kept on this PC only (%LOCALAPPDATA%/CGI Project Hub/secrets.env), never in the shared storage
folder and never sent to the browser. Everything else (notes, proposals, summaries) is stored per project.
"""
from __future__ import annotations
import json, os, queue, threading, time, traceback, urllib.request, urllib.error, uuid
from datetime import date, timedelta
from pathlib import Path
from . import store

SECRET_DIR = Path(os.getenv('LOCALAPPDATA') or Path.home() / '.config') / 'CGI Project Hub'
SECRET_PATH = SECRET_DIR / 'secrets.env'
DEFAULTS = {
    'ANTHROPIC_API_KEY': '', 'ANTHROPIC_MODEL': 'claude-sonnet-5-5', 'ANTHROPIC_BASE_URL': 'https://api.anthropic.com',
    'TRANSCRIBE_PROVIDER': 'openai', 'OPENAI_API_KEY': '', 'OPENAI_TRANSCRIBE_MODEL': 'gpt-4o-mini-transcribe', 'OPENAI_BASE_URL': 'https://api.openai.com',
    'ASSEMBLYAI_API_KEY': '', 'TELEGRAM_BOT_TOKEN': '', 'TELEGRAM_ALLOWED_CHATS': '', 'TELEGRAM_PROJECT': '', 'SUMMARY_TIME': '17:30', 'SUMMARY_TO_TELEGRAM': 'yes',
    'HUB_HOST': '127.0.0.1', 'HUB_TOKEN': '', 'USER_NAME': '',
    'VOCABULARY': 'SR3, WWTP, WWTW, WUC, WEC, CGI, Instramac, Controlgear, Tabateq, ELPRO, Rocket 5AC, RocketDish, BOCRA, Fresnel, iPerf, Rockwell, SCADA, FAT, SAT, Molepolole, Kalahari',
}
SECRET = {'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'ASSEMBLYAI_API_KEY', 'TELEGRAM_BOT_TOKEN', 'HUB_TOKEN'}
CFG: dict = dict(DEFAULTS)

def load_cfg():
    cfg = dict(DEFAULTS)
    cfg.update({k: str(v) for k, v in store.settings().get('hub', {}).items() if k in DEFAULTS and k not in SECRET})
    if SECRET_PATH.exists():
        for line in SECRET_PATH.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                if k.strip() in SECRET: cfg[k.strip()] = v.strip().strip('"').strip("'")
    for k in DEFAULTS:
        if os.getenv(k): cfg[k] = os.getenv(k)
    CFG.clear(); CFG.update(cfg); return CFG

def save_cfg(updates: dict):
    pub = {k: str(v).strip() for k, v in updates.items() if k in DEFAULTS and k not in SECRET and v is not None}
    if pub: store.save_settings({'hub': {**store.settings().get('hub', {}), **pub}})
    sec = {k: str(v).strip() for k, v in updates.items() if k in SECRET and v is not None and v != 'set'}
    if sec:
        cur = {k: CFG.get(k, '') for k in SECRET}; cur.update(sec)
        SECRET_DIR.mkdir(parents=True, exist_ok=True)
        SECRET_PATH.write_text('# CGI Project Hub secrets (this PC only). Never shared.\n' + '\n'.join(f'{k}={v}' for k, v in cur.items()) + '\n', encoding='utf-8')
    return load_cfg()

def public_settings() -> dict:
    out = {k: ('set' if CFG.get(k) else '') if k in SECRET else CFG.get(k) for k in DEFAULTS}
    out['ai_ready'] = bool(CFG.get('ANTHROPIC_API_KEY'))
    prov = CFG.get('TRANSCRIBE_PROVIDER')
    out['voice_ready'] = (prov == 'openai' and bool(CFG.get('OPENAI_API_KEY'))) or (prov == 'assemblyai' and bool(CFG.get('ASSEMBLYAI_API_KEY')))
    out['telegram_ready'] = bool(CFG.get('TELEGRAM_BOT_TOKEN'))
    out['secrets_file'] = str(SECRET_PATH)
    return out

# ------------------------------------------------------------------ HTTP helpers
def _http(url, data=None, headers=None, method=None, timeout=180):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r: return r.read()
    except urllib.error.HTTPError as e:
        raise RuntimeError(f'{url.split("/")[2]} returned {e.code}: {e.read().decode("utf-8", "replace")[:400]}')
    except urllib.error.URLError as e:
        raise RuntimeError(f'Could not reach {url.split("/")[2]}: {e.reason}')

def claude(system, user, tools=None, tool_choice=None, max_tokens=4000) -> dict:
    if not CFG.get('ANTHROPIC_API_KEY'): raise RuntimeError('No Claude API key set (Tracker › Settings).')
    body = {'model': CFG['ANTHROPIC_MODEL'], 'max_tokens': max_tokens, 'system': system, 'messages': [{'role': 'user', 'content': user}]}
    if tools: body['tools'] = tools
    if tool_choice: body['tool_choice'] = tool_choice
    raw = _http(CFG['ANTHROPIC_BASE_URL'].rstrip('/') + '/v1/messages', json.dumps(body).encode(),
                {'x-api-key': CFG['ANTHROPIC_API_KEY'], 'anthropic-version': '2023-06-01', 'content-type': 'application/json'})
    return json.loads(raw)

def claude_text(system, user, max_tokens=3000) -> str:
    r = claude(system, user, max_tokens=max_tokens)
    return ''.join(b.get('text', '') for b in r.get('content', []) if b.get('type') == 'text').strip()

def _multipart(fields, file_field, filename, content, mime):
    b = uuid.uuid4().hex; out = bytearray()
    for k, v in fields.items(): out += f'--{b}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode()
    out += f'--{b}\r\nContent-Disposition: form-data; name="{file_field}"; filename="{filename}"\r\nContent-Type: {mime}\r\n\r\n'.encode() + content + b'\r\n'
    out += f'--{b}--\r\n'.encode(); return bytes(out), f'multipart/form-data; boundary={b}'

def transcribe(path: Path, mime: str) -> str:
    prov, content = CFG.get('TRANSCRIBE_PROVIDER', 'openai'), path.read_bytes()
    if prov == 'openai':
        if not CFG.get('OPENAI_API_KEY'): raise RuntimeError('Voice notes need a transcription key (OpenAI or AssemblyAI) in Settings, or use Dictate.')
        body, ctype = _multipart({'model': CFG['OPENAI_TRANSCRIBE_MODEL'], 'prompt': f"Project terms: {CFG.get('VOCABULARY', '')}"}, 'file', path.name, content, mime or 'audio/webm')
        return json.loads(_http(CFG['OPENAI_BASE_URL'].rstrip('/') + '/v1/audio/transcriptions', body, {'Authorization': f"Bearer {CFG['OPENAI_API_KEY']}", 'Content-Type': ctype})).get('text', '').strip()
    if prov == 'assemblyai':
        if not CFG.get('ASSEMBLYAI_API_KEY'): raise RuntimeError('AssemblyAI key missing.')
        h = {'authorization': CFG['ASSEMBLYAI_API_KEY']}
        up = json.loads(_http('https://api.assemblyai.com/v2/upload', content, {**h, 'content-type': 'application/octet-stream'}))
        job = json.loads(_http('https://api.assemblyai.com/v2/transcript', json.dumps({'audio_url': up['upload_url']}).encode(), {**h, 'content-type': 'application/json'}))
        for _ in range(240):
            time.sleep(2); st = json.loads(_http(f"https://api.assemblyai.com/v2/transcript/{job['id']}", headers=h))
            if st['status'] == 'completed': return (st.get('text') or '').strip()
            if st['status'] == 'error': raise RuntimeError(st.get('error', 'Transcription failed'))
        raise RuntimeError('Transcription timed out')
    raise RuntimeError('Transcription is switched off (Settings).')

# ------------------------------------------------------------------ project context
def _open(k, r): return not any(r.get(f) in v for f, v in store.ENTITIES[k].get('closed', {}).items())

def _brief(code, limit=60) -> dict:
    out = {}
    for k, rs in store.all_entities(code).items():
        if k in ('quote_lines', 'po_milestones', 'raci'): continue
        keep = [r for r in rs if _open(k, r)] if store.ENTITIES[k].get('closed') else rs
        cols = ['id'] + [f['k'] for f in store.ENTITIES[k]['fields'] if f['t'] not in ('longtext', 'json')][:9]
        out[k] = [{c: r.get(c) for c in cols if r.get(c) not in (None, '')} for r in keep[-limit:]]
    p = store.get_project(code); out['project'] = {k: p.get(k) for k in ('code', 'name', 'client_name', 'site', 'start_date', 'status')}
    out['people'] = [s.get('name') for s in store.rows(code, 'stakeholders')]
    return out

def _entity_guide() -> str:
    lines = []
    for k, e in store.ENTITIES.items():
        if not e.get('ai'): continue
        fs = ', '.join(f"{f['k']}({f['t']}{':' + '|'.join(map(str, f['options'])) if f.get('options') else ''}{'->' + f['ref'] if f.get('ref') else ''})" for f in e['fields'])
        lines.append(f"- {k} [{'/'.join(e['ai'])}]: {fs}")
    return '\n'.join(lines)

PROPOSE_TOOL = {
    'name': 'propose_changes',
    'description': 'Propose structured changes to the project registers based on the note. Each proposal is reviewed by a person before it is applied.',
    'input_schema': {'type': 'object', 'properties': {
        'summary': {'type': 'string', 'description': 'One or two sentences: what this note was about.'},
        'proposals': {'type': 'array', 'items': {'type': 'object', 'properties': {
            'op': {'type': 'string', 'enum': ['create', 'update']},
            'entity': {'type': 'string', 'description': 'Register key, e.g. actions, decisions, risks, issues, meetings, meeting_items, daily_logs, tasks, procurement, tests, punch_items, rfis, variations'},
            'target_id': {'type': 'integer', 'description': 'For update: the id of the existing record from the context.'},
            'fields': {'type': 'object', 'description': 'Only fields to set. Dates as YYYY-MM-DD. Use option values exactly as listed.'},
            'summary': {'type': 'string'}, 'confidence': {'type': 'number'}, 'evidence': {'type': 'string'}},
            'required': ['op', 'entity', 'fields', 'summary', 'confidence']}}},
        'required': ['summary', 'proposals']}}

def extract(code, text, kind='Note') -> dict:
    t = date.today()
    system = ('You are the project controls assistant for an electrical, control and instrumentation (EC&I) project run by CGI (Controlgear Instramac). '
              'Turn a project manager’s note, meeting notes or voice transcript into precise register changes. Rules: only propose what the note says; '
              'prefer updating an existing record (use its id) over creating a duplicate; resolve relative dates against today; never invent amounts, people or dates; '
              'a meeting note should usually create a meetings record plus actions and decisions; site events go to daily_logs; equipment orders and deliveries go to procurement; '
              'test results go to tests and defects to punch_items; schedule progress updates tasks. Keep text concise, in the user’s words. If nothing should change, return no proposals.')
    user = (f'Today is {t.strftime("%A %d %B %Y")} ({t.isoformat()}). Note type: {kind}.\n\nRegisters you may change (fields):\n{_entity_guide()}\n\n'
            f'Current project records (open items):\n{json.dumps(_brief(code), default=str)[:60000]}\n\nNOTE:\n"""{text}"""')
    r = claude(system, user, tools=[PROPOSE_TOOL], tool_choice={'type': 'tool', 'name': 'propose_changes'})
    for b in r.get('content', []):
        if b.get('type') == 'tool_use': return b.get('input') or {}
    return {'summary': '', 'proposals': []}

def store_proposals(code, capture_id, result) -> int:
    n = 0
    for p in result.get('proposals', []):
        ent, op = p.get('entity'), p.get('op')
        if ent not in store.ENTITIES or op not in store.ENTITIES[ent].get('ai', []): continue
        try: fields = store.clean(ent, p.get('fields') or {}, partial=True)
        except store.ValidationError: fields = {k: v for k, v in (p.get('fields') or {}).items() if k in {f['k'] for f in store.ENTITIES[ent]['fields']}}
        if not fields: continue
        store.insert(code, 'proposals', {'capture_id': capture_id, 'op': op, 'entity': ent, 'target_id': p.get('target_id'), 'fields': fields,
                                         'summary': p.get('summary'), 'confidence': p.get('confidence'), 'evidence': p.get('evidence'), 'status': 'Pending'}); n += 1
    return n

def apply_proposal(code, prop_id, fields_override=None) -> dict:
    p = store.get(code, 'proposals', prop_id)
    if not p: raise KeyError('Proposal not found')
    if p['status'] != 'Pending': raise store.ValidationError(f"Proposal is already {p['status'].lower()}")
    fields = fields_override if fields_override is not None else p['fields']
    actor = f"tracker:note-{p['capture_id']}"
    rec = store.create(code, p['entity'], fields, actor, 'tracker') if p['op'] == 'create' else store.update(code, p['entity'], int(p['target_id']), fields, actor)
    store.patch_row(code, 'proposals', prop_id, {'status': 'Applied', 'applied_id': rec['id'], 'fields': fields, 'reviewed_at': store.now()})
    _settle(code, p['capture_id']); return rec

def reject_proposal(code, prop_id):
    p = store.get(code, 'proposals', prop_id)
    if not p: raise KeyError('Proposal not found')
    store.patch_row(code, 'proposals', prop_id, {'status': 'Rejected', 'reviewed_at': store.now()}); _settle(code, p['capture_id']); return {'ok': True}

def _settle(code, cid):
    if not cid: return
    if not [x for x in store.rows(code, 'proposals') if x.get('capture_id') == cid and x.get('status') == 'Pending']:
        c = store.get(code, 'captures', cid)
        if c and c.get('status') == 'Review': store.patch_row(code, 'captures', cid, {'status': 'Done'})

def captures(code):
    caps = sorted(store.rows(code, 'captures'), key=lambda c: -c['id'])[:200]
    props = store.rows(code, 'proposals'); by = {}
    for p in props: by.setdefault(p.get('capture_id'), []).append(p)
    return [{**c, 'proposals': by.get(c['id'], [])} for c in caps]

# ------------------------------------------------------------------ capture worker
JOBS: 'queue.Queue[tuple]' = queue.Queue()
NOTIFY = []

def process_capture(code, cid):
    c = store.get(code, 'captures', cid)
    if not c: return
    n = 0
    try:
        text = c.get('raw_text') or ''
        if c.get('file') and not c.get('transcript'):
            store.patch_row(code, 'captures', cid, {'status': 'Transcribing'})
            tr = transcribe(store.resolve_rel(code, c['file']), c.get('mime') or 'audio/webm')
            store.patch_row(code, 'captures', cid, {'transcript': tr}); text = (text + '\n' + tr).strip()
        elif c.get('transcript'): text = (text + '\n' + c['transcript']).strip()
        if not text: store.patch_row(code, 'captures', cid, {'status': 'Error', 'error': 'Nothing to process'}); return
        if not CFG.get('ANTHROPIC_API_KEY'): store.patch_row(code, 'captures', cid, {'status': 'Saved', 'error': 'AI is off: saved to the log without proposals.'}); return
        store.patch_row(code, 'captures', cid, {'status': 'Extracting'})
        res = extract(code, text, c.get('kind') or 'Note'); n = store_proposals(code, cid, res)
        meta = dict(c.get('meta') or {}); meta['ai_summary'] = res.get('summary', '')
        store.patch_row(code, 'captures', cid, {'status': 'Review' if n else 'No changes', 'meta': meta, 'error': None})
    except Exception as e:
        traceback.print_exc(); store.patch_row(code, 'captures', cid, {'status': 'Error', 'error': str(e)[:500]})
    finally:
        c2 = store.get(code, 'captures', cid)
        for cb in NOTIFY:
            try: cb(code, c2, n)
            except Exception: traceback.print_exc()

def worker():
    while True:
        code, cid = JOBS.get()
        try: process_capture(code, cid)
        except Exception: traceback.print_exc()
        finally: JOBS.task_done()

def new_capture(code, kind='Note', channel='web', raw_text=None, file_rel=None, mime=None, meta=None) -> dict:
    c = store.insert(code, 'captures', {'kind': kind, 'channel': channel, 'raw_text': raw_text, 'file': file_rel, 'mime': mime, 'status': 'Queued', 'meta': meta or {}})
    store.audit(code, 'captures', c['id'], 'create', None, {'kind': kind, 'channel': channel}, channel)
    JOBS.put((code, c['id'])); return c

def resume():
    for p in store.list_projects(False):
        try:
            for c in store.rows(p['code'], 'captures'):
                if c.get('status') in ('Queued', 'Transcribing', 'Extracting'): JOBS.put((p['code'], c['id']))
        except Exception: pass

# ------------------------------------------------------------------ digest + summaries
def _d(s):
    try: return date.fromisoformat(str(s)[:10])
    except Exception: return None

def digest(code, for_date) -> dict:
    D = _d(for_date) or date.today(); data = store.all_entities(code); E = store.ENTITIES; soon = D + timedelta(days=7)
    due = lambda k, r: _d(r.get(E[k]['due'])) if E[k].get('due') else None
    out = {'date': D.isoformat(), 'project': store.get_project(code).get('name')}
    out['overdue'] = [{'register': k, 'id': r['id'], 'title': r.get(E[k]['title']), 'due': r.get(E[k]['due']), 'owner': r.get('owner')}
                      for k in ('actions', 'issues', 'rfis', 'deliverables', 'procurement', 'punch_items', 'tests') for r in data[k] if _open(k, r) and due(k, r) and due(k, r) < D]
    out['due_this_week'] = [{'register': k, 'title': r.get(E[k]['title']), 'due': r.get(E[k]['due']), 'owner': r.get('owner')}
                            for k in ('actions', 'deliverables', 'rfis', 'po_milestones', 'procurement', 'tests', 'meetings', 'reminders') for r in data[k] if _open(k, r) and due(k, r) and D <= due(k, r) <= soon]
    out['slipping_tasks'] = [{'wbs': r.get('wbs'), 'title': r['title'], 'slip_days': (_d(r['forecast_finish']) - _d(r['baseline_finish'])).days}
                             for r in data['tasks'] if _d(r.get('forecast_finish')) and _d(r.get('baseline_finish')) and _d(r['forecast_finish']) > _d(r['baseline_finish'])]
    out['high_risks'] = [{'title': r['title'], 'score': (r.get('probability') or 0) * (r.get('impact') or 0)} for r in data['risks'] if _open('risks', r) and (r.get('probability') or 0) * (r.get('impact') or 0) >= 12]
    start, end = D.isoformat(), (D + timedelta(days=1)).isoformat()
    out['changes'] = [a for a in reversed(store.read_audit(code, 400, start)) if a.get('at', '')[:10] == start and a.get('actor') != 'seed']
    for c in out['changes']:
        a = c.pop('after', None) or {}; c.pop('before', None); c['what'] = a.get('title') or a.get('activities') or a.get('name') or a.get('item') or a.get('topic') or ', '.join(f'{k}={v}' for k, v in list(a.items())[:3])
    out['notes'] = [((c.get('raw_text') or '') + ' ' + (c.get('transcript') or '')).strip() for c in store.rows(code, 'captures') if start <= c.get('created_at', '')[:10] < end]
    out['pending_review'] = len([p for p in store.rows(code, 'proposals') if p.get('status') == 'Pending'])
    return out

def _template_summary(g) -> str:
    L = [f"# Daily summary, {g['date']}"]
    def sec(title, items, fmt):
        if items: L.append(f'\n## {title}'); L.extend('- ' + fmt(x) for x in items)
    sec('What changed today', g['changes'], lambda c: f"{c['action']} {str(c['entity']).replace('_', ' ')}: {c['what']}")
    sec('Notes captured', g['notes'], lambda n: n.strip()[:300])
    sec('Overdue', g['overdue'], lambda x: f"{x['title']} ({x['register'].replace('_', ' ')}, due {x['due']}{', ' + x['owner'] if x.get('owner') else ''})")
    sec('Due in the next 7 days', g['due_this_week'], lambda x: f"{x['title']} ({x['register'].replace('_', ' ')}, {x['due']})")
    sec('Schedule slippage against baseline', g['slipping_tasks'], lambda x: f"{x['wbs']} {x['title']}: {x['slip_days']} days late")
    sec('High risks', g['high_risks'], lambda x: f"{x['title']} (score {x['score']:.0f})")
    if g['pending_review']: L.append(f"\n{g['pending_review']} proposed change(s) are waiting in the Tracker inbox.")
    if len(L) == 1: L.append('\nNo activity recorded today.')
    return '\n'.join(L)

def make_summary(code, for_date=None, period='daily') -> dict:
    g = digest(code, for_date or date.today().isoformat()); gen = 'template'; text = _template_summary(g)
    if CFG.get('ANTHROPIC_API_KEY'):
        try:
            text = claude_text('You write the end-of-day project summary for an EC&I project manager. Use only the facts given. Markdown, short: "## Today", '
                               '"## Decisions and changes", "## Attention needed", "## Tomorrow". Name owners and dates. No filler. Omit empty sections.',
                               f'Facts (JSON):\n{json.dumps(g, default=str)[:50000]}', 1800) or text
            gen = CFG['ANTHROPIC_MODEL']
        except Exception as e: text += f'\n\n_(AI summary unavailable: {e})_'
    return store.insert(code, 'summaries', {'period': period, 'for_date': g['date'], 'text': text, 'generator': gen})

def ask(code, question) -> str:
    ctx = json.dumps({'project': store.get_project(code), 'records': store.all_entities(code),
                      'recent_notes': [{k: c.get(k) for k in ('created_at', 'kind', 'raw_text', 'transcript')} for c in store.rows(code, 'captures')[-40:]],
                      'recent_summaries': [{'date': s.get('for_date'), 'text': s.get('text')} for s in store.rows(code, 'summaries')[-7:]]}, default=str)[:150000]
    return claude_text('Answer questions about this project using only the records provided. Cite the register and record (e.g. "actions #12"). '
                       'If the records do not contain the answer, say so plainly. Be concise.', f'Today: {date.today().isoformat()}\nRecords:\n{ctx}\n\nQuestion: {question}', 1500)
