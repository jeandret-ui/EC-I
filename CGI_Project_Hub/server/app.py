"""CGI Project Hub server: standard-library HTTP. Serves the hub UI, the costing/quote-register module (/costing/)
and the RF design lab (/rf/), and stores everything in the storage folder (see store.py)."""
from __future__ import annotations
import importlib.util, json, mimetypes, os, re, sqlite3, subprocess, sys, threading, time, traceback, urllib.parse
from datetime import date, datetime
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from . import store, tracker as ai, telegram, seed

APP = store.APP
WEB = APP / 'web'
RF = APP / 'modules' / 'rflab'
ROUTES = []
COST = None
# fixed types: the Windows registry sometimes maps .js/.css to text/plain, which breaks the page
MIME = {'.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.svg': 'image/svg+xml',
        '.json': 'application/json', '.pdf': 'application/pdf', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'}   # costing module, loaded in serve()

def route(method, pattern):
    rx = re.compile('^' + re.sub(r'\{(\w+)\}', r'(?P<\1>[^/]+)', pattern) + '$')
    def deco(fn): ROUTES.append((method, rx, fn)); return fn
    return deco

class Req:
    def __init__(self, h, params, query):
        self.h, self.params, self.query = h, {k: urllib.parse.unquote(v) for k, v in params.items()}, query; self._body = None
    @property
    def body(self) -> bytes:
        if self._body is None:
            n = int(self.h.headers.get('Content-Length') or 0); self._body = self.h.rfile.read(n) if n else b''
        return self._body
    def json(self) -> dict:
        try: return json.loads(self.body or b'{}')
        except json.JSONDecodeError: raise store.ValidationError('Request body is not valid JSON')
    def q(self, k, d=None): return self.query.get(k, [d])[0]
    @property
    def local(self) -> bool: return self.h.client_address[0] in ('127.0.0.1', '::1')
    @property
    def code(self) -> str: return store.get_project(self.params['code'])['code']

def actor(r): return ai.CFG.get('USER_NAME') or 'web'

# ------------------------------------------------------------------ core
@route('GET', '/api/health')
def health(r): return {'ok': True, 'app': 'CGI Project Hub', 'version': store.VERSION, 'today': date.today().isoformat(), 'storage': str(store.ROOT)}

@route('GET', '/api/config')
def config(r):
    return {'version': store.VERSION, 'entities': store.ENTITIES, 'meta': store.META, 'storage': str(store.ROOT), 'today': date.today().isoformat(),
            'settings': ai.public_settings(), 'templates': seed.template_list(), 'statuses': store.STATUSES, 'costing': COST is not None,
            'local': r.local, 'platform': sys.platform}

@route('GET', '/api/projects')
def projects(r): return store.list_projects()

@route('POST', '/api/projects')
def create_project(r):
    d = r.json(); p = store.create_project(d, actor(r))
    seed.apply_template(p['code'], d.get('template') or 'blank', d)
    move_costings(p['code'])
    return store.get_project(p['code'])

@route('GET', '/api/projects/{code}')
def get_project(r): return store.get_project(r.params['code'])

@route('PATCH', '/api/projects/{code}')
def patch_project(r): return store.update_project(r.code, r.json(), actor(r))

@route('GET', '/api/projects/{code}/all')
def everything(r):
    c = r.code
    return {'project': store.get_project(c), 'records': store.all_entities(c), 'files': store.list_files(c), 'rev': store.revision(c)}

@route('GET', '/api/projects/{code}/rev')
def rev(r): return {'rev': store.revision(r.code)}

@route('GET', '/api/portfolio')
def portfolio(r):
    out = []
    for p in store.list_projects():
        try: out.append({'project': p, 'records': store.all_entities(p['code'])})
        except Exception as e: out.append({'project': p, 'records': {}, 'error': str(e)})
    return out

@route('GET', '/api/projects/{code}/r/{entity}')
def list_(r): return store.rows(r.code, r.params['entity'])
@route('POST', '/api/projects/{code}/r/{entity}')
def create_(r): return store.create(r.code, r.params['entity'], r.json(), actor(r))
@route('PATCH', '/api/projects/{code}/r/{entity}/{id}')
def update_(r): return store.update(r.code, r.params['entity'], int(r.params['id']), r.json(), actor(r))
@route('DELETE', '/api/projects/{code}/r/{entity}/{id}')
def delete_(r): return store.delete(r.code, r.params['entity'], int(r.params['id']), actor(r))
@route('POST', '/api/projects/{code}/bulk/{entity}')
def bulk_(r): return store.bulk_update(r.code, r.params['entity'], r.json().get('items', []), actor(r))

@route('GET', '/api/projects/{code}/audit')
def audit_(r): return store.read_audit(r.code, min(2000, int(r.q('limit', '300'))), entity=r.q('entity'), eid=r.q('id'))

@route('GET', '/api/projects/{code}/snapshots')
def snaps(r): return store.list_snapshots(r.code)
@route('POST', '/api/projects/{code}/snapshots')
def snap_now(r): p = store.snapshot(r.code, 'manual-' + datetime.now().strftime('%Y%m%d-%H%M%S')); return {'ok': True, 'name': p.stem}
@route('POST', '/api/projects/{code}/restore')
def restore(r): return store.restore(r.code, r.json().get('name', ''), actor(r))

@route('GET', '/api/projects/{code}/export')
def export(r):
    c = r.code; body = {'exported': store.now(), 'app': 'CGI Project Hub', 'version': store.VERSION, 'project': store.get_project(c),
                        'registers': {k: store.table(c, k) for k in store.ENTITIES}, 'tracker': {t: store.table(c, t) for t in ('captures', 'proposals', 'summaries')}}
    return ('bytes', json.dumps(body, ensure_ascii=False, indent=1, default=str).encode(), 'application/json', f'{c}_backup_{date.today().isoformat()}.json')

@route('POST', '/api/projects/{code}/import')
def import_backup(r):
    c = r.code; d = r.json()
    if 'registers' not in d: raise store.ValidationError('Choose a CGI Project Hub backup (.json) file')
    store.snapshot(c, 'before-import-' + datetime.now().strftime('%Y%m%d-%H%M%S'))
    for k, tb in d['registers'].items():
        if k in store.ENTITIES and isinstance(tb, dict) and isinstance(tb.get('records'), list): store.put(store._tpath(c, k), tb)
    store.audit(c, 'project', None, 'import', None, {'registers': len(d['registers'])}, actor(r)); store.touch(c)
    return {'ok': True}

# ------------------------------------------------------------------ files
@route('GET', '/api/projects/{code}/files')
def files(r): return store.list_files(r.code)

@route('POST', '/api/projects/{code}/files')
def upload(r):
    if len(r.body) > 200 * 1024 * 1024: raise store.ValidationError('File is larger than 200 MB')
    ent, eid = r.q('entity'), r.q('id')
    return store.save_file(r.code, urllib.parse.unquote(r.q('name', 'file')), r.body, ent, int(eid) if eid else None, r.q('folder'))

@route('GET', '/api/projects/{code}/file')
def download(r):
    p = store.resolve_rel(r.code, r.q('path', ''))
    if not p.is_file(): raise KeyError('File not found')
    return ('file', p, mimetypes.guess_type(p.name)[0], p.name, r.q('dl') == '1')

@route('DELETE', '/api/projects/{code}/file')
def del_file(r): return store.delete_file(r.code, r.q('path', ''))

def _open_path(p: Path):
    if sys.platform.startswith('win'): os.startfile(str(p))  # noqa
    elif sys.platform == 'darwin': subprocess.Popen(['open', str(p)])
    else: subprocess.Popen(['xdg-open', str(p)])

@route('POST', '/api/projects/{code}/open')
def open_local(r):
    if not r.local: raise PermissionError('Folders open only on the computer running the hub.')
    rel = r.q('path', ''); p = store.resolve_rel(r.code, rel) if rel else store.pdir(r.code)
    if not p.exists(): p.mkdir(parents=True, exist_ok=True)
    _open_path(p); return {'ok': True, 'path': str(p)}

@route('POST', '/api/open-storage')
def open_storage(r):
    if not r.local: raise PermissionError('Folders open only on the computer running the hub.')
    _open_path(store.ROOT); return {'ok': True}

# ------------------------------------------------------------------ RF lab state (per project)
@route('GET', '/api/projects/{code}/rfstate')
def rf_get(r): return store.cached(store._tpath(r.code, 'rf_state'), {})
@route('POST', '/api/projects/{code}/rfstate')
def rf_put(r): store.put(store._tpath(r.code, 'rf_state'), r.json()); return {'ok': True}

# ------------------------------------------------------------------ costing summaries for the project
@route('GET', '/api/projects/{code}/costings')
def costings(r):
    if not COST: return []
    c = r.code; out = []
    for i, p in COST.all_doc_paths().items():
        try:
            d = store.read_json(p, {})
            if str(d.get('settings', {}).get('project_no') or '').strip().upper() != c: continue
            calc = COST.calculate(d)['calculated']; tot = {k: calc.get(k) for k in ('cost', 'sell', 'profit', 'margin', 'option_sell', 'including_vat')}
            out.append({'id': i, 'name': d.get('name'), 'quote_no': d['settings'].get('quote_no'), 'revision': d['settings'].get('revision'),
                        'document_type': d['settings'].get('document_type'), 'updated': d.get('updated'), 'totals': tot, 'path': str(p)})
        except Exception as e: out.append({'id': i, 'error': str(e)})
    return out

@route('GET', '/api/register/records')
def register_records(r):
    if not COST: return []
    keep = ('id', 'quote_no', 'project_no', 'workspace_code', 'parent_project', 'description', 'client', 'project_client', 'site', 'project_site', 'company', 'quote_type',
            'quote_value', 'order_no', 'order_value', 'order_date', 'start', 'end', 'projected_end', 'owner', 'pm', 'contact', 'completion', 'invoiced', 'bc_status',
            'completed_date', 'archived', 'status_label', 'status')
    v = COST.REG.view(); recs = v.get('records', [])
    return [{k: x.get(k) for k in keep if x.get(k) not in (None, '')} for x in recs if not x.get('archived')]

def move_costings(code):
    """Costings already saved for this project code (before the workspace existed) move into the project folder."""
    if not COST: return 0
    n = 0
    for i, p in list(COST.all_doc_paths().items()):
        try:
            d = store.read_json(p, {})
            if str(d.get('settings', {}).get('project_no') or '').strip().upper() == code and store.pdir(code) not in p.parents:
                dst = store.pdir(code) / 'Costing' / p.name; dst.parent.mkdir(exist_ok=True); p.replace(dst); n += 1
        except Exception as e: print('Costing move skipped:', e)
    return n

# ------------------------------------------------------------------ tracker / AI
@route('GET', '/api/projects/{code}/captures')
def captures(r): return ai.captures(r.code)

@route('POST', '/api/projects/{code}/captures')
def capture_text(r):
    d = r.json(); text = (d.get('text') or '').strip()
    if not text: raise store.ValidationError('Write something first')
    return ai.new_capture(r.code, d.get('kind') or 'Note', 'web', text)

@route('POST', '/api/projects/{code}/captures/audio')
def capture_audio(r):
    if not r.body: raise store.ValidationError('No audio received')
    info = store.save_file(r.code, r.q('name', 'voice.webm'), r.body, folder='Voice notes')
    return ai.new_capture(r.code, r.q('kind', 'Voice note'), 'web', urllib.parse.unquote(r.q('note', '')) or None, info['path'], r.h.headers.get('Content-Type', 'audio/webm'))

@route('POST', '/api/projects/{code}/captures/{cid}/retry')
def capture_retry(r):
    store.patch_row(r.code, 'captures', int(r.params['cid']), {'status': 'Queued', 'error': None}); ai.JOBS.put((r.code, int(r.params['cid']))); return {'ok': True}

@route('POST', '/api/projects/{code}/proposals/{id}/approve')
def approve(r):
    d = r.json() if r.body else {}; return ai.apply_proposal(r.code, int(r.params['id']), d.get('fields'))

@route('POST', '/api/projects/{code}/proposals/{id}/reject')
def reject(r): return ai.reject_proposal(r.code, int(r.params['id']))

@route('GET', '/api/projects/{code}/summaries')
def summaries(r): return sorted(store.rows(r.code, 'summaries'), key=lambda s: -s['id'])[:60]

@route('POST', '/api/projects/{code}/summaries')
def make_summary(r): return ai.make_summary(r.code, r.json().get('date'))

@route('POST', '/api/projects/{code}/ask')
def ask(r):
    q = (r.json().get('question') or '').strip()
    if not q: raise store.ValidationError('Ask a question first')
    return {'answer': ai.ask(r.code, q)}

@route('GET', '/api/settings')
def get_settings(r): return ai.public_settings()

@route('POST', '/api/settings')
def set_settings(r):
    if not r.local: raise PermissionError('Settings can only be changed on the computer running the hub.')
    ai.save_cfg(r.json()); return ai.public_settings()

@route('POST', '/api/settings/test')
def test_ai(r):
    t0 = time.time(); txt = ai.claude_text('Reply with exactly: OK', 'Connection test', 10)
    return {'ok': True, 'reply': txt, 'model': ai.CFG['ANTHROPIC_MODEL'], 'seconds': round(time.time() - t0, 1)}

@route('POST', '/api/settings/storage')
def set_storage(r):
    if not r.local: raise PermissionError('Only on the computer running the hub.')
    path = (r.json().get('path') or '').strip()
    if not path: raise store.ValidationError('Enter a folder path')
    p = Path(os.path.expandvars(path))
    if not p.parent.exists(): raise store.ValidationError(f'The parent folder {p.parent} does not exist')
    (APP / 'storage_location.txt').write_text('# Folder where CGI Project Hub keeps all project data\n' + str(p) + '\n', encoding='utf-8')
    return {'ok': True, 'path': str(p), 'restart': True}

@route('POST', '/api/import-legacy')
def import_legacy(r):
    if not r.local: raise PermissionError('Only on the computer running the hub.')
    return seed.import_legacy(Path(os.path.expandvars((r.json().get('path') or '').strip().strip('"'))), COST, actor(r))

# ------------------------------------------------------------------ HTTP plumbing
def _make_handler(base):
    class Handler(base):
        server_version = 'CGIProjectHub/' + store.VERSION
        def log_message(self, *a): pass
        def _send(self, code, obj=None, ctype='application/json', raw=None, extra=None):
            data = raw if raw is not None else json.dumps(obj, default=str, ensure_ascii=False).encode()
            self.send_response(code); self.send_header('Content-Type', ctype); self.send_header('Content-Length', str(len(data)))
            self.send_header('Cache-Control', 'no-store')
            for k, v in (extra or {}).items(): self.send_header(k, v)
            self.end_headers(); self.wfile.write(data)
        def _authorised(self, query) -> bool:
            tok = ai.CFG.get('HUB_TOKEN')
            if not tok or self.client_address[0] in ('127.0.0.1', '::1'): return True
            return (self.headers.get('X-Hub-Token') or (query.get('token') or [''])[0]) == tok
        def _costing(self, method):
            u = urllib.parse.urlparse(self.path)
            if u.path == '/costing': return self._send(302, raw=b'', extra={'Location': '/costing/' + ('?' + u.query if u.query else '')})
            if not COST: return self._send(503, {'error': 'The costing module could not start. See the console window.'})
            self.path = u.path[len('/costing'):] + ('?' + u.query if u.query else '')
            if self.path.split('?')[0] in ('/embed.js',):
                return self._send(200, raw=(APP / 'modules' / 'costing' / 'web' / 'embed.js').read_bytes(), ctype='text/javascript; charset=utf-8')
            return getattr(base, 'do_' + method)(self)
        def _dispatch(self, method):
            u = urllib.parse.urlparse(self.path); query = urllib.parse.parse_qs(u.query)
            if u.path.startswith('/costing') and COST and (u.path == '/costing' or u.path.startswith('/costing/')): return self._costing(method)
            if u.path.startswith('/api/'):
                if not self._authorised(query): return self._send(401, {'error': 'Access token required'})
                for m, rx, fn in ROUTES:
                    mt = rx.match(u.path)
                    if m == method and mt:
                        try:
                            res = fn(Req(self, mt.groupdict(), query))
                            if isinstance(res, tuple) and res and res[0] == 'file':
                                _, path, mime, name, dl = res
                                disp = ('attachment' if dl else 'inline') + f"; filename*=UTF-8''{urllib.parse.quote(name)}"
                                return self._send(200, raw=path.read_bytes(), ctype=mime or 'application/octet-stream', extra={'Content-Disposition': disp})
                            if isinstance(res, tuple) and res and res[0] == 'bytes':
                                _, data, mime, name = res
                                return self._send(200, raw=data, ctype=mime, extra={'Content-Disposition': f'attachment; filename="{name}"'})
                            return self._send(200, res)
                        except store.ValidationError as e: return self._send(400, {'error': str(e)})
                        except KeyError as e: return self._send(404, {'error': str(e).strip("'")})
                        except PermissionError as e: return self._send(403, {'error': str(e)})
                        except RuntimeError as e: return self._send(502, {'error': str(e)})
                        except (BrokenPipeError, ConnectionResetError): return
                        except Exception as e: traceback.print_exc(); return self._send(500, {'error': f'Server error: {e}'})
                return self._send(404, {'error': 'Unknown API route'})
            if method != 'GET': return self._send(405, {'error': 'Method not allowed'})
            rel = urllib.parse.unquote(u.path.lstrip('/')) or 'index.html'
            root = WEB
            if rel.startswith('rf/'): root, rel = RF, rel[3:] or 'rf-lab.html'
            f = (root / rel).resolve()
            if not str(f).startswith(str(root.resolve())) or not f.is_file(): return self._send(404, raw=b'Not found', ctype='text/plain')
            ct = MIME.get(f.suffix.lower()) or mimetypes.guess_type(f.name)[0] or 'application/octet-stream'
            if ct.startswith('text/') or ct in ('application/javascript', 'application/json'): ct += '; charset=utf-8'
            self._send(200, raw=f.read_bytes(), ctype=ct)
        def do_GET(self): self._dispatch('GET')
        def do_POST(self): self._dispatch('POST')
        def do_PATCH(self): self._dispatch('PATCH')
        def do_DELETE(self): self._dispatch('DELETE')
    return Handler

HTTPD = None
@route('POST', '/api/shutdown')
def shutdown(r):
    if not r.local: raise PermissionError('Only on the computer running the hub.')
    threading.Timer(0.3, lambda: HTTPD and HTTPD.shutdown()).start()
    return {'ok': True}

class Server(ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = not sys.platform.startswith('win')   # on Windows reuse would let two apps share a port

def load_costing():
    global COST
    try:
        os.environ['CGI_COSTING_DATA'] = str(store.ROOT / 'Commercial')
        mod_dir = APP / 'modules' / 'costing'
        if str(mod_dir) not in sys.path: sys.path.insert(0, str(mod_dir))
        spec = importlib.util.spec_from_file_location('costing_app', mod_dir / 'app.py')
        m = importlib.util.module_from_spec(spec); sys.modules['costing_app'] = m
        # storage hooks must exist before the module's import-time code runs
        spec.loader.exec_module(m)
        def code_dir(code):
            try: d = store.pdir(code) / 'Costing'; d.mkdir(exist_ok=True); return d
            except KeyError: return None
        m.code_dir = code_dir
        m.workspace_dirs = lambda: [p for p in (store.ROOT / 'Projects').glob('*/Costing') if p.is_dir()] + [p for p in (store.ROOT / 'Archive').glob('*/Costing') if p.is_dir()]
        COST = m
        for p in store.list_projects(): move_costings(p['code'])
        return m
    except Exception:
        traceback.print_exc(); print('\n!! The costing / quote register module did not start. The rest of the hub works.\n'); return None

def scheduler():
    while True:
        try:
            hm = ai.CFG.get('SUMMARY_TIME', '17:30'); now = datetime.now()
            if hm and now.strftime('%H:%M') >= hm and now.weekday() < 5:
                for p in store.list_projects(False):
                    if p.get('status') not in ('Active', 'Planning'): continue
                    if not [s for s in store.rows(p['code'], 'summaries') if s.get('for_date') == now.date().isoformat() and s.get('period') == 'auto']:
                        s = ai.make_summary(p['code'], period='auto')
                        if ai.CFG.get('TELEGRAM_BOT_TOKEN') and ai.CFG.get('SUMMARY_TO_TELEGRAM', 'yes').lower().startswith('y'):
                            for chat in [c.strip() for c in ai.CFG.get('TELEGRAM_ALLOWED_CHATS', '').split(',') if c.strip()]:
                                try: telegram.send(chat, s['text'])
                                except Exception as e: print('Summary send failed:', e)
        except Exception: traceback.print_exc()
        time.sleep(60)

def serve(port=8765, open_url=None, storage=None):
    store.init(storage or store.resolve_storage()); ai.load_cfg()
    seed.first_run()
    base = BaseHTTPRequestHandler
    if load_costing(): base = COST.Handler
    Handler = _make_handler(base)
    threading.Thread(target=ai.worker, daemon=True, name='capture-worker').start()
    threading.Thread(target=scheduler, daemon=True, name='scheduler').start()
    telegram.start(); ai.resume()
    host = ai.CFG.get('HUB_HOST', '127.0.0.1') or '127.0.0.1'
    global HTTPD
    httpd = None
    for p in range(port, port + 30):
        try: httpd = Server((host, p), Handler); port = p; break
        except OSError: continue
    HTTPD = httpd
    if not httpd: raise SystemExit('No free port found. Close other CGI Project Hub windows and try again.')
    url = f'http://127.0.0.1:{port}/'
    (store.ROOT / 'Settings').mkdir(exist_ok=True)
    print(f' Hub running at {url}\n Storage: {store.ROOT}\n Leave this window open. Ctrl+C or closing it stops the hub.\n', flush=True)
    try: (APP / '.hub_url').write_text(url, encoding='utf-8')
    except OSError: pass
    if open_url: open_url(url)
    try: httpd.serve_forever()
    except KeyboardInterrupt: print('\nStopped.')
    finally:
        try: httpd.server_close(); (APP / '.hub_url').unlink(missing_ok=True)
        except OSError: pass
