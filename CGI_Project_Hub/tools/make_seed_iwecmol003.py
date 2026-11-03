"""Build config/seed_IWECMOL003.json from:
  - IWECMOL003 Schedule.xlsx (the Kalahari schedule: dated activities, procurement items, notes)
  - the Hub V11 Molepolole configuration (requirements, deliverables, RF actions, RFI, deviation, cost codes, Tabateq quote)
  - the quote register record for project IWECMOL003 (PO023758, WEC Projects)
Run: python tools/make_seed_iwecmol003.py "path/to/IWECMOL003 Schedule.xlsx"   (needs openpyxl)
"""
import json, sys
from datetime import timedelta
from pathlib import Path
import openpyxl

APP = Path(__file__).resolve().parents[1]
CFG = APP / 'config'
xlsx = Path(sys.argv[1])
wb = openpyxl.load_workbook(xlsx, data_only=True); ws = wb['Sheet1']
dates = {c: ws.cell(3, c).value.date() for c in range(7, ws.max_column + 1) if hasattr(ws.cell(3, c).value, 'date')}
def cells(r): return [(c, ws.cell(r, c).value) for c in range(7, ws.max_column + 1) if ws.cell(r, c).value not in (None, '')]
def d(c): return dates[c].isoformat()

T = {k: {'next_id': 1, 'records': []} for k in ('tasks', 'actions', 'procurement', 'stakeholders', 'raci', 'requirements', 'deliverables', 'rfis', 'deviations',
                                                  'cost_codes', 'suppliers', 'supplier_quotes', 'quote_lines', 'clients', 'client_pos', 'po_milestones', 'tests', 'meetings', 'risks', 'issues')}
NOW = '2026-11-03T10:00:00+02:00'
def add(k, **rec):
    tb = T[k]; rec = {'id': tb['next_id'], 'source': 'seed', **{a: b for a, b in rec.items() if b is not None}, 'created_at': NOW, 'updated_at': NOW}
    tb['records'].append(rec); tb['next_id'] += 1; return rec['id']

SRC = f'IWECMOL003 Schedule.xlsx'
# ---------------- schedule (Sheet1) ----------------
row = {ws.cell(r, 2).value: r for r in range(1, ws.max_row + 1) if ws.cell(r, 2).value}
po = dict(cells(6)); kick = dict(cells(7)); panel = cells(18); inst = cells(21); comm = cells(23)
pcol = {v.strip(): c for c, v in panel}
def t(**k):
    k.setdefault('progress', 0); k.setdefault('status', 'Not started'); k.setdefault('notes', f'From {SRC}.'); return add('tasks', **k)
t(wbs='1', title='Project management', workstream='Project management', duration_days=0)
t(wbs='1.1', title='PO submitted', workstream='Project management', duration_days=0, is_milestone=1, forecast_start=d(7), forecast_finish=d(7), baseline_start=d(7), baseline_finish=d(7),
  notes=f'Schedule week 1 ({SRC}). Register: client PO PO023758 dated 2026-09-16.')
t(wbs='1.2', title='Project kick-off', workstream='Project management', duration_days=0, is_milestone=1, predecessors='1.1', forecast_start=d(9), forecast_finish=d(9), baseline_start=d(9), baseline_finish=d(9))
t(wbs='2', title='Procurement', workstream='Procurement', duration_days=0)
t(wbs='2.1', title='Antennas + radios', workstream='Procurement', duration_days=None, predecessors='1.2', notes=f'Schedule note: "In stores in South Africa". Status box not ticked. ({SRC})')
t(wbs='2.2', title='UPS', workstream='Procurement', duration_days=None, predecessors='1.2', notes=f'No date in the schedule yet. ({SRC})')
t(wbs='3', title='Panel', workstream='Panel manufacture', duration_days=0)
c = pcol['Already sized']
t(wbs='3.1', title='Panel sizing', workstream='Engineering & design', duration_days=1, predecessors='1.2', forecast_start=d(c), forecast_finish=d(c), baseline_start=d(c), baseline_finish=d(c),
  actual_finish=d(c), progress=100, status='Complete', notes=f'Schedule: "Already sized". ({SRC})')
t(wbs='3.2', title='Assemble and configure', workstream='Panel manufacture', duration_days=None, predecessors='3.1, 2.1, 2.2', notes=f'Row in the schedule without dates yet. ({SRC})')
c = pcol['Panel in Botswana']
t(wbs='3.3', title='Panel in Botswana', workstream='Logistics', duration_days=0, is_milestone=1, predecessors='3.2', forecast_start=d(c), forecast_finish=d(c), baseline_start=d(c), baseline_finish=d(c))
c = pcol['Testing']
t(wbs='3.4', title='Panel testing', workstream='FAT', duration_days=1, predecessors='3.3', forecast_start=d(c), forecast_finish=d(c), baseline_start=d(c), baseline_finish=d(c))
t(wbs='4', title='Install', workstream='Installation', duration_days=0)
icol = {}
for cc, v in inst: icol.setdefault(v.strip(), []).append(cc)
seqs = [('4.1', 'Travel to site', 'Travel', '3.4'), ('4.2', 'Install', 'Install', '4.1'), ('4.3', 'Handover', 'Handover', '4.2')]
for w, title, key, pred in seqs:
    cs = icol[key]; s, f = d(min(cs)), d(max(cs))
    t(wbs=w, title=title, workstream='Installation' if key != 'Handover' else 'Handover & close-out', duration_days=len(cs), predecessors=pred, forecast_start=s, forecast_finish=f, baseline_start=s, baseline_finish=f)
t(wbs='5', title='Commission', workstream='Commissioning', duration_days=0)
scada = [cc for cc in range(7, ws.max_column + 1) if ws.cell(23, cc).fill and ws.cell(23, cc).fill.fill_type and ws.cell(23, cc).fill.fgColor.rgb not in ('00000000', None)] or [cc for cc, v in comm if v == 'Scada']
sc = [cc for cc, v in comm if v == 'Scada'][0]; scada_cols = [x for x in range(sc, sc + 5) if x in dates]
t(wbs='5.1', title='SCADA commissioning', workstream='Commissioning', duration_days=len(scada_cols), predecessors='4.3', forecast_start=d(scada_cols[0]), forecast_finish=d(scada_cols[-1]),
  baseline_start=d(scada_cols[0]), baseline_finish=d(scada_cols[-1]))
lk = [cc for cc, v in comm if 'lock' in str(v).lower()][0]
t(wbs='5.2', title='Kalahari lock down', workstream='Handover & close-out', duration_days=0, is_milestone=1, predecessors='5.1', forecast_start=d(lk), forecast_finish=d(lk), baseline_start=d(lk), baseline_finish=d(lk),
  notes=f'Site lock-down date from the schedule. ({SRC})')

# ---------------- procurement items ----------------
add('procurement', item='Antennas + radios', category='Radios & comms', location='In stores in South Africa', status='Ordered', required_by=d(pcol['Panel in Botswana']),
    notes=f'Schedule note: "In stores in South Africa"; status box not ticked. Confirm status and move to Delivered / Issued to site. ({SRC})')
add('procurement', item='UPS', category='Power & UPS', status='Not started', required_by=d(pcol['Panel in Botswana']), notes=f'Listed under Procurement in the schedule, no date yet. ({SRC})')

# ---------------- notes (Sheet3) -> follow-ups ----------------
notes = [r[0] for r in wb['Sheet3'].iter_rows(values_only=True) if r and r[0]]
for n in notes:
    low = n.lower(); cat = 'Follow-up'
    ws_ = 'Commercial' if ('vat' in low or 'payment' in low) else 'Engineering & design'
    add('actions', title=n.strip(), category=cat, priority='High' if 'ip add' in low else 'Normal', status='Open', workstream=ws_, source='Schedule notes', notes=f'From the notes sheet in {SRC}.')
add('actions', title='Revert back to confirm dates', category='Follow-up', due_date=d([c for c, v in cells(6) if 'Revert' in str(v)][0]), priority='High', status='Open',
    workstream='Project management', source='Schedule', notes=f'Shown on the schedule timeline. ({SRC})')

# ---------------- Hub V11 Molepolole content ----------------
seed = json.loads((CFG / 'project_seed.json').read_text(encoding='utf-8'))
reqs = json.loads((CFG / 'requirements.json').read_text(encoding='utf-8'))
net = json.loads((CFG / 'network.json').read_text(encoding='utf-8'))
for g in reqs.get('groups', []):
    for it in g.get('items', []):
        add('requirements', ref=it['id'].upper(), area=it.get('area'), text=it['text'], source=it.get('source'), status='Open',
            verification_method='RF analysis' if it.get('check') not in (None, 'manual') else 'Document review')
for i, x in enumerate(reqs.get('deliverables', []), 1): add('deliverables', ref=f'DEL-{i:03d}', title=x, status='Outstanding')
for a in net.get('actions', []): add('actions', title=a['text'], category='Action', status='Closed' if a.get('done') else 'Open', priority='High', workstream='Engineering & design', source='RF Lab')
add('rfis', ref='RFI-001', title='Definition of 200–300 Mbps', question=reqs.get('openQuestion'), raised_to='WUC', status='Draft')
ip = [n for n in notes if 'ip add' in n.lower()]
if ip: add('rfis', ref='RFI-002', title='IP addresses for the three sites', question=ip[0].strip(), raised_to='WEC Projects', status='Draft')
add('deviations', ref='DEV-001', title='Two point-to-point links at SR3 instead of the specified omni', requirement_ref='OMNI',
    description='Replace the SR3 omnidirectional antenna with two directional point-to-point links.',
    reason='The specified omni topology may not deliver 200–300 Mbps; to be proven by the RF contractor first.', status='Proposed')
for cc in seed.get('cost_codes', []): add('cost_codes', **cc)
sup = {}
for x in seed.get('suppliers', []): sup[x['name']] = add('suppliers', **x)
for q in seed.get('supplier_quotes', []):
    data = {k: v for k, v in q.items() if k not in ('lines', 'supplier', 'key')}; data['supplier_id'] = sup[q['supplier']]
    qid = add('supplier_quotes', **data)
    for code, desc, qty, price, disc, cc in q.get('lines', []):
        add('quote_lines', quote_id=qid, part_number=code, description=desc, quantity=qty, unit_price=price, discount_pct=disc, cost_code=cc)
for i, r in enumerate(T['procurement']['records']):
    if 'radio' in r['item'].lower() and sup: r['supplier_id'] = list(sup.values())[0]; r['quote_ref'] = seed['supplier_quotes'][0].get('quote_ref')

# ---------------- quote register record (IWECMOL003) ----------------
reg = json.loads((APP / 'modules' / 'costing' / 'reference' / 'register_seed.json').read_text(encoding='utf-8'))
rec = next(r for r in reg['records'] if r.get('project_no') == 'IWECMOL003')
cid = add('clients', name='WEC Projects', contact_name='Ruan Kellerman', email='ruan.kellerman@wecprojects.com', notes='Client per quote register (WEC_Projects).')
poid = add('client_pos', po_number=rec['order_no'], client_id=cid, po_date=rec['order_date'], value_ex_vat=rec['order_value'], vat_rate=15, currency='ZAR',
           our_quote_ref=rec['quote_no'], scope=rec['description'], status='Received')
add('po_milestones', po_id=poid, title='Payment after panel', status='Planned', notes=None)
T['po_milestones']['records'][-1].pop('notes', None)
add('stakeholders', name='Ruan Kellerman', organisation='WEC Projects', party='Client', role='Client contact', email='ruan.kellerman@wecprojects.com', influence='High', interest='High',
    engagement='Supportive', notes='Contact from the quote register.')
add('stakeholders', name='WUC', organisation='Water Utilities Corporation', party='End user', role='End user / approver of the RF design', influence='High', interest='Medium', notes='Named in the RF requirements and RFI-001.')
add('stakeholders', name='Anrich', organisation='Instramac (CGI)', party='Internal (CGI)', role='Quote owner (register)', influence='High', interest='High', engagement='Leading')
for s in seed.get('suppliers', []): add('stakeholders', name=s['name'], organisation=s['name'], party='Supplier', role='Radio equipment supplier', influence='Medium', interest='Medium')
acts = [('Client PO & contract', 'Commercial'), ('Schedule & reporting', 'Project management'), ('RF design & link budgets', 'Engineering & design'), ('Client approval of RF design', 'Engineering & design'),
        ('Procure antennas, radios & UPS', 'Procurement'), ('Panel assemble & configure', 'Panel manufacture'), ('Panel testing', 'FAT'), ('Delivery to Botswana', 'Logistics'),
        ('Installation & alignment', 'Installation'), ('SCADA commissioning', 'Commissioning'), ('Handover & lock down', 'Handover & close-out'), ('Invoicing & payment', 'Commercial')]
for i, (a, w) in enumerate(acts, 1): add('raci', activity=a, workstream=w, seq=i, assignments={})
add('tests', ref='FAT-001', test_type='FAT', title='Panel test before dispatch / on arrival', planned_date=d(pcol['Testing']), result='Not run', criteria='IO and radio link checks per the test sheet; record RSSI and throughput.', task_id=next(r['id'] for r in T['tasks']['records'] if r['wbs'] == '3.4'))
add('tests', ref='SAT-001', test_type='SAT', title='SAT: RSSI, iPerf throughput and stability', result='Not run', criteria='Throughput meets the RF requirement (see Requirements register); 24 h stability run.')
add('tests', ref='SAT-002', test_type='SAT', title='SCADA integration test', planned_date=d(scada_cols[-1]), result='Not run', task_id=next(r['id'] for r in T['tasks']['records'] if r['wbs'] == '5.1'))

add('meetings', title='Project kick-off', meeting_type='Kick-off', meeting_date=d(9), start_time='09:00', duration_min=60, status='Planned',
    agenda='1. Introductions & roles (RACI)\n2. Scope and deliverables (PO ' + rec['order_no'] + ')\n3. Schedule & key milestones\n4. Procurement & lead times\n5. Panel testing / SAT approach\n6. Open items: IP addresses, 220 V supply, payment, VAT\n7. Next steps',
    notes=f'Kick-off date from {SRC}. Update the status and capture minutes.')
project = {'code': 'IWECMOL003', 'name': 'Molepolole WWTW Telemetry', 'client_name': 'WEC Projects', 'site': 'Molepolole WWTW · Kalahari', 'status': 'Active', 'phase': 'Procurement',
           'description': 'Industrial broadband Ethernet radio network connecting the Engineering Office to the WWTW control room via the SR3 high site (Kalahari schedule).',
           'start_date': d(7), 'target_finish': d(lk), 'quote_ref': rec['quote_no'], 'po_number': rec['order_no'], 'register_code': 'IWECMOL003', 'currency': 'ZAR', 'colour': '#005093',
           'modules': {'rf_lab': True},
           'charter': {'objectives': 'Deliver a working telemetry radio network for Molepolole WWTW (SR3 high site, WWTP, Engineering Office) with SCADA integration, by the Kalahari lock-down date.',
                       'scope': rec['description'] + ': engineering, supply, panel manufacture, installation and commissioning (per quote ' + rec['quote_no'] + ').',
                       'budget': rec['order_value'], 'sponsor': 'WEC Projects', 'client_contact': 'Ruan Kellerman',
                       'assumptions': 'Antennas and radios are in stores in South Africa. Panel is already sized.',
                       'constraints': 'Kalahari lock down on ' + d(lk) + '. Confirm 220 V supply and IP addresses before configuration.',
                       'success_criteria': 'SAT passed (throughput per RF requirement), SCADA integrated, handover signed.'}}
out = {'project': project, 'tables': T, 'source': {'schedule': xlsx.name, 'register_record': rec['id']}}
(CFG / 'seed_IWECMOL003.json').write_text(json.dumps(out, indent=1, ensure_ascii=False), encoding='utf-8')
print('tasks', len(T['tasks']['records']), 'actions', len(T['actions']['records']), 'procurement', len(T['procurement']['records']))
for r in T['tasks']['records']: print(r['wbs'], r['title'], r.get('forecast_start'), r.get('forecast_finish'))
