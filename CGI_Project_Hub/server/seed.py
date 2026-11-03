"""First-run data, project templates and import from earlier versions (Hub V11 SQLite, Dashboard V3 data folder)."""
from __future__ import annotations
import json, shutil, sqlite3
from datetime import datetime
from pathlib import Path
from . import store

CFG = store.APP / 'config'

# ------------------------------------------------------------------ templates
# (wbs, title, workstream, duration (work days), predecessors, milestone)
ECI = [
    ('1', 'Project start-up', 'Project management', 0, '', 0),
    ('1.1', 'Client PO received and reviewed', 'Commercial', 0, '', 1),
    ('1.2', 'Internal handover from sales (quote to project)', 'Project management', 1, '1.1', 0),
    ('1.3', 'Kick-off meeting with client', 'Project management', 0, '1.2', 1),
    ('1.4', 'Project plan and baseline schedule', 'Project management', 3, '1.3', 0),
    ('2', 'Engineering and design', 'Engineering & design', 0, '', 0),
    ('2.1', 'Design basis and sizing', 'Engineering & design', 5, '1.3', 0),
    ('2.2', 'Drawings and IO list (EPLAN)', 'Engineering & design', 10, '2.1', 0),
    ('2.3', 'Client design review and approval', 'Engineering & design', 5, '2.2', 0),
    ('3', 'Procurement', 'Procurement', 0, '', 0),
    ('3.1', 'RFQs and supplier quotes', 'Procurement', 5, '2.1', 0),
    ('3.2', 'Place supplier purchase orders', 'Procurement', 2, '3.1', 0),
    ('3.3', 'Equipment lead time', 'Procurement', 20, '3.2', 0),
    ('3.4', 'Receive and inspect equipment', 'Procurement', 2, '3.3', 0),
    ('4', 'Panel manufacture', 'Panel manufacture', 0, '', 0),
    ('4.1', 'Assemble and wire panel', 'Panel manufacture', 10, '2.3, 3.4', 0),
    ('4.2', 'Configure PLC, radios and SCADA', 'Panel manufacture', 5, '4.1', 0),
    ('5', 'Factory acceptance test', 'FAT', 0, '', 0),
    ('5.1', 'Internal pre-FAT', 'FAT', 2, '4.2', 0),
    ('5.2', 'FAT witnessed by client', 'FAT', 1, '5.1', 0),
    ('5.3', 'Close FAT punch items', 'FAT', 3, '5.2', 0),
    ('6', 'Logistics', 'Logistics', 0, '', 0),
    ('6.1', 'Pack, export documents and deliver to site', 'Logistics', 5, '5.3', 0),
    ('7', 'Installation', 'Installation', 0, '', 0),
    ('7.1', 'Travel and site establishment', 'Installation', 1, '6.1', 0),
    ('7.2', 'Install and terminate', 'Installation', 5, '7.1', 0),
    ('8', 'Commissioning', 'Commissioning', 0, '', 0),
    ('8.1', 'Cold commissioning and loop checks', 'Commissioning', 3, '7.2', 0),
    ('8.2', 'Hot commissioning and SCADA integration', 'Commissioning', 5, '8.1', 0),
    ('9', 'SAT and handover', 'SAT', 0, '', 0),
    ('9.1', 'SAT witnessed by client', 'SAT', 2, '8.2', 0),
    ('9.2', 'Close SAT punch items', 'SAT', 3, '9.1', 0),
    ('9.3', 'Handover and practical completion', 'Handover & close-out', 0, '9.2', 1),
    ('10', 'Close-out', 'Handover & close-out', 0, '', 0),
    ('10.1', 'As-built drawings, O&M manuals and data book', 'Handover & close-out', 10, '9.3', 0),
    ('10.2', 'Final invoice and retention release', 'Commercial', 1, '10.1', 0),
    ('10.3', 'Lessons learned and project close', 'Project management', 1, '10.2', 1),
]
TELEM_WS = {'1': 'Engineering & design', '2': 'Procurement', '3': 'Panel manufacture', '4': 'Installation', '5': 'Commissioning'}
ECI_CODES = [('100', 'Engineering and design'), ('200', 'Equipment and materials'), ('300', 'Panels and enclosures'), ('400', 'Workshop labour'), ('500', 'Installation labour'),
             ('600', 'Travel and accommodation'), ('700', 'Testing and commissioning'), ('800', 'Documentation and handover'), ('900', 'Contingency')]
RACI = [('Client PO and contract', 'Commercial'), ('Project plan and schedule', 'Project management'), ('Design and drawings', 'Engineering & design'),
        ('Design approval', 'Engineering & design'), ('Procurement', 'Procurement'), ('Panel manufacture', 'Panel manufacture'), ('FAT', 'FAT'),
        ('Delivery to site', 'Logistics'), ('Installation', 'Installation'), ('Commissioning', 'Commissioning'), ('SAT', 'SAT'),
        ('Handover and documentation', 'Handover & close-out'), ('Invoicing and payment', 'Commercial')]

def template_list():
    return [{'key': 'eci', 'label': 'EC&I supply, install and commission', 'note': 'CGI standard: start-up, engineering, procurement, panel, FAT, logistics, install, commissioning, SAT, close-out (37 tasks).'},
            {'key': 'telemetry', 'label': 'Telemetry / radio network', 'note': 'RF design, BOCRA, spectrum survey, towers, alignment, iPerf SAT (25 tasks, from the Molepolole hub).'},
            {'key': 'blank', 'label': 'Blank project', 'note': 'Empty registers. Add tasks yourself.'}]

def _empty(code, k): return not store.rows(code, k)

def apply_template(code, key, data=None):
    data = data or {}; a = 'template'
    if key == 'eci' and _empty(code, 'tasks'):
        for w, t, ws, dur, pred, ms in ECI:
            store.create(code, 'tasks', {'wbs': w, 'title': t, 'workstream': ws, 'duration_days': dur, 'predecessors': pred, 'is_milestone': ms, 'progress': 0,
                                         'notes': 'Template duration: review before baselining.' if dur else None}, a, 'template')
    if key == 'telemetry' and _empty(code, 'tasks'):
        s = json.loads((CFG / 'project_seed.json').read_text(encoding='utf-8'))
        for w, t, dur, pred, ms in s.get('tasks', []):
            ws = 'FAT' if 'FAT' in t else 'SAT' if t.startswith('SAT') else TELEM_WS.get(w.split('.')[0], 'Project management')
            store.create(code, 'tasks', {'wbs': w, 'title': t, 'workstream': ws, 'duration_days': dur, 'predecessors': pred, 'is_milestone': ms, 'progress': 0,
                                         'notes': 'Template duration: review before baselining.' if dur else None}, a, 'template')
    if key in ('eci', 'telemetry'):
        if _empty(code, 'cost_codes'):
            codes = ECI_CODES if key == 'eci' else [(c['code'], c['name']) for c in json.loads((CFG / 'project_seed.json').read_text(encoding='utf-8'))['cost_codes']]
            for c, n in codes: store.create(code, 'cost_codes', {'code': c, 'name': n}, a, 'template')
        if _empty(code, 'raci'):
            for i, (act, ws) in enumerate(RACI, 1): store.create(code, 'raci', {'activity': act, 'workstream': ws, 'seq': i, 'assignments': {}}, a, 'template')
        if _empty(code, 'tests'):
            store.create(code, 'tests', {'ref': 'FAT-001', 'test_type': 'FAT', 'title': 'Factory acceptance test', 'result': 'Not run'}, a, 'template')
            store.create(code, 'tests', {'ref': 'SAT-001', 'test_type': 'SAT', 'title': 'Site acceptance test', 'result': 'Not run'}, a, 'template')
    # details carried over from the quote register / new-project form
    if data.get('client_name') and _empty(code, 'clients'):
        cid = store.create(code, 'clients', {'name': data['client_name'], 'contact_name': data.get('contact_name'), 'email': data.get('contact_email')}, a, 'register')['id']
        if data.get('po_number') or data.get('po_value'):
            store.create(code, 'client_pos', {'po_number': data.get('po_number') or 'TBC', 'client_id': cid, 'po_date': data.get('po_date'), 'value_ex_vat': data.get('po_value'),
                                              'vat_rate': 15, 'currency': data.get('currency') or 'ZAR', 'our_quote_ref': data.get('quote_ref'), 'scope': data.get('description'), 'status': 'Received'}, a, 'register')
    if data.get('contact_name') and _empty(code, 'stakeholders'):
        store.create(code, 'stakeholders', {'name': data['contact_name'], 'organisation': data.get('client_name'), 'party': 'Client', 'role': 'Client contact',
                                            'email': data.get('contact_email'), 'influence': 'High', 'interest': 'High'}, a, 'register')
    if data.get('project_manager') and not any(s.get('name') == data['project_manager'] for s in store.rows(code, 'stakeholders')):
        store.create(code, 'stakeholders', {'name': data['project_manager'], 'organisation': 'CGI', 'party': 'Internal (CGI)', 'role': 'Project manager', 'influence': 'High', 'interest': 'High', 'engagement': 'Leading'}, a, 'register')

# ------------------------------------------------------------------ first run
def first_run():
    s = store.settings()
    if s.get('seeded') or store.list_projects():
        if not s.get('seeded'): store.save_settings({'seeded': store.now()})
        return
    f = CFG / 'seed_IWECMOL003.json'
    if f.exists():
        d = json.loads(f.read_text(encoding='utf-8')); p = d['project']
        store.create_project(p, 'seed')
        store.update_project(p['code'], {k: v for k, v in p.items() if k != 'code'}, 'seed')
        for k, tb in d['tables'].items():
            if k in store.ENTITIES: store.put(store._tpath(p['code'], k), tb)
        store.audit(p['code'], 'project', None, 'seed', None, {'from': d.get('source')}, 'seed')
        print(f"  First run: created project {p['code']} {p['name']} from {d['source']['schedule']}")
    store.save_settings({'seeded': store.now()})

# ------------------------------------------------------------------ import earlier versions
def import_legacy(path: Path, cost=None, actor='import') -> dict:
    if not path or not path.exists(): raise store.ValidationError(f'Not found: {path}')
    report = []
    dbs = [path] if path.is_file() and path.suffix in ('.sqlite3', '.db') else [p for p in (path / 'store' / 'hub.sqlite3', path / 'hub.sqlite3') if p.exists()]
    for db in dbs: report += _import_hub(db, actor)
    reg = next((p for p in (path / 'data' / 'quote_register.json', path / 'quote_register.json') if path.is_dir() and p.exists()), None)
    if reg and cost:
        new, cur = store.read_json(reg, {}), store.read_json(store.ROOT / 'Commercial' / 'quote_register.json', {})
        if new.get('records') and (new.get('version', 0) > cur.get('version', 0) or new.get('updated', '') > cur.get('updated', '')):
            bak = store.ROOT / 'Commercial' / 'register_backups' / f"before-import-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
            bak.parent.mkdir(exist_ok=True)
            if (store.ROOT / 'Commercial' / 'quote_register.json').exists(): shutil.copy2(store.ROOT / 'Commercial' / 'quote_register.json', bak)
            shutil.copy2(reg, store.ROOT / 'Commercial' / 'quote_register.json'); report.append(f"Quote register imported ({len(new['records'])} records, version {new.get('version')}).")
        else: report.append('Quote register: the current one is the same or newer, kept.')
    pdir = next((p for p in (path / 'data' / 'projects', path / 'projects') if path.is_dir() and p.exists()), None)
    if pdir and cost:
        n = 0
        for f in pdir.glob('*.json'):
            d = store.read_json(f, {})
            if not d.get('settings'): continue
            if f.stem in cost.all_doc_paths(): continue
            t = cost.target_dir(d['settings'].get('project_no')); t.mkdir(parents=True, exist_ok=True); shutil.copy2(f, t / f.name); n += 1
        report.append(f'{n} costing document(s) imported.')
    if not report: raise store.ValidationError('Nothing to import here. Choose the old CGI_Project_Hub folder (with store\\hub.sqlite3) or the old Dashboard V3 folder (with data\\).')
    return {'ok': True, 'report': report}

def _import_hub(db: Path, actor):
    out = []; con = sqlite3.connect(db); con.row_factory = sqlite3.Row
    tables = {r[0] for r in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    for p in con.execute('SELECT * FROM projects'):
        p = dict(p); code = (p.get('code') or f"HUB-{p['id']}").upper()
        if not store.exists(code):
            store.create_project({'code': code, 'name': p.get('name') or code, 'client_name': p.get('client_name'), 'description': p.get('description'),
                                  'start_date': p.get('start_date'), 'status': p.get('status') or 'Active'}, actor)
            out.append(f'Created project {code}.')
        for k in store.ENTITIES:
            if k not in tables: continue
            rs = [dict(r) for r in con.execute(f'SELECT * FROM {k} WHERE project_id=? ORDER BY id', (p['id'],))]
            if not rs: continue
            if store.rows(code, k): out.append(f'{code} {k}: kept existing records, skipped {len(rs)}.'); continue
            keys = {f['k'] for f in store.ENTITIES[k]['fields']} | {'id', 'source', 'created_at', 'updated_at'}
            recs = [{kk: vv for kk, vv in r.items() if kk in keys and vv is not None} for r in rs]
            store.put(store._tpath(code, k), {'next_id': max(r['id'] for r in recs) + 1, 'records': recs}); out.append(f'{code} {k}: {len(recs)} imported.')
        store.audit(code, 'project', None, 'import', None, {'from': str(db)}, actor)
    return out
