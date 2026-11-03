"""API checks for CGI Project Hub against a temporary storage folder. Run: python tests/test_hub.py"""
import json, os, sys, tempfile, threading, time, unittest, urllib.request, urllib.error
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]; sys.path.insert(0, str(ROOT))
TMP = Path(tempfile.mkdtemp(prefix='cgihub-')); os.environ['LOCALAPPDATA'] = str(TMP / 'local')
from server import app, store  # noqa
PORT = 8977

def call(method, path, body=None, raw=None, ctype='application/json'):
    data = raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    req = urllib.request.Request(f'http://127.0.0.1:{PORT}{path}', data=data, method=method, headers={'Content-Type': ctype, 'Host': f'127.0.0.1:{PORT}'})
    try:
        with urllib.request.urlopen(req, timeout=20) as r:
            b = r.read(); return r.status, (json.loads(b) if r.headers.get('Content-Type', '').startswith('application/json') else b)
    except urllib.error.HTTPError as e: return e.code, json.loads(e.read() or b'{}')

class Hub(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        threading.Thread(target=app.serve, args=(PORT, None, TMP / 'Local Dashboard Storage'), daemon=True).start()
        for _ in range(100):
            try: call('GET', '/api/health'); break
            except Exception: time.sleep(0.1)
    def test_1_seed_and_layout(self):
        s, ps = call('GET', '/api/projects'); self.assertEqual(s, 200)
        self.assertIn('IWECMOL003', [p['code'] for p in ps])
        d = store.pdir('IWECMOL003'); self.assertTrue((d / 'Registers' / 'tasks.json').exists()); self.assertTrue((d / 'project.json').exists())
        s, a = call('GET', '/api/projects/IWECMOL003/all'); self.assertGreaterEqual(len(a['records']['tasks']), 15)
    def test_2_crud_audit(self):
        s, r = call('POST', '/api/projects/IWECMOL003/r/actions', {'title': 'Test action', 'due_date': '2026-11-10', 'owner': 'Tester'}); self.assertEqual(s, 200)
        s, r2 = call('PATCH', f"/api/projects/IWECMOL003/r/actions/{r['id']}", {'status': 'Closed'}); self.assertEqual(r2['status'], 'Closed')
        s, e = call('POST', '/api/projects/IWECMOL003/r/actions', {'title': 'x', 'due_date': '10/11/2026'}); self.assertEqual(s, 400)
        s, au = call('GET', '/api/projects/IWECMOL003/audit?limit=5'); self.assertTrue(any(x['entity'] == 'actions' for x in au))
        s, _ = call('DELETE', f"/api/projects/IWECMOL003/r/actions/{r['id']}"); self.assertEqual(s, 200)
    def test_3_meeting_items_and_raci_json(self):
        s, m = call('POST', '/api/projects/IWECMOL003/r/meetings', {'title': 'Progress', 'meeting_date': '2026-11-05'})
        s, i = call('POST', '/api/projects/IWECMOL003/r/meeting_items', {'meeting_id': m['id'], 'topic': 'Send IP addresses', 'item_type': 'Action'}); self.assertEqual(s, 200)
        s, ra = call('POST', '/api/projects/IWECMOL003/r/raci', {'activity': 'FAT', 'assignments': {'1': 'A', '2': 'R'}}); self.assertEqual(ra['assignments']['1'], 'A')
    def test_4_new_project_template_and_files(self):
        s, p = call('POST', '/api/projects', {'code': 'TEST001', 'name': 'Test project', 'template': 'eci', 'client_name': 'ACME', 'po_number': 'PO1', 'po_value': 1000}); self.assertEqual(s, 200, p)
        s, a = call('GET', '/api/projects/TEST001/all'); self.assertEqual(len(a['records']['tasks']), 37); self.assertEqual(a['records']['client_pos'][0]['value_ex_vat'], 1000)
        s, f = call('POST', '/api/projects/TEST001/files?name=hello.txt&entity=tasks&id=1', raw=b'hello', ctype='text/plain'); self.assertEqual(s, 200, f)
        self.assertTrue((store.pdir('TEST001') / f['path']).exists()); self.assertEqual(f['entity'], 'tasks')
        s, b = call('GET', f"/api/projects/TEST001/file?path={urllib.request.quote(f['path'])}"); self.assertEqual(b, b'hello')
        s, e = call('GET', '/api/projects/TEST001/file?path=../../x'); self.assertIn(s, (403, 404))
        s, dup = call('POST', '/api/projects', {'code': 'TEST001', 'name': 'again'}); self.assertEqual(s, 400)
    def test_5_snapshot_restore(self):
        s, r = call('POST', '/api/projects/TEST001/snapshots'); name = r['name']
        call('POST', '/api/projects/TEST001/r/risks', {'title': 'Temporary risk'})
        s, _ = call('POST', '/api/projects/TEST001/restore', {'name': name}); self.assertEqual(s, 200)
        s, rs = call('GET', '/api/projects/TEST001/r/risks'); self.assertFalse(any(x['title'] == 'Temporary risk' for x in rs))
    def test_6_costing_saves_in_project_folder(self):
        if not app.COST: self.skipTest('costing module not loaded')
        s, p = call('POST', '/costing/api/new', {'name': 'Kalahari costing', 'project_no': 'IWECMOL003', 'project_name': 'Molepolole'}); self.assertEqual(s, 200, p)
        self.assertTrue((store.pdir('IWECMOL003') / 'Costing' / f"{p['id']}.json").exists())
        s, c = call('GET', '/api/projects/IWECMOL003/costings'); self.assertTrue(any(x['id'] == p['id'] for x in c))
        s, reg = call('GET', '/costing/api/register'); self.assertEqual(s, 200); self.assertGreater(len(reg['records']), 1000)
        self.assertTrue((store.ROOT / 'Commercial' / 'quote_register.json').exists())
    def test_7_tracker_without_ai(self):
        s, c = call('POST', '/api/projects/IWECMOL003/captures', {'text': 'UPS ordered, 3 weeks.'}); self.assertEqual(s, 200)
        time.sleep(0.6); s, cs = call('GET', '/api/projects/IWECMOL003/captures'); self.assertEqual(cs[0]['status'], 'Saved')
        s, sm = call('POST', '/api/projects/IWECMOL003/summaries', {}); self.assertIn('Daily summary', sm['text'])
    def test_8_ui_served(self):
        s, b = call('GET', '/'); self.assertIn(b'CGI Project Hub', b)
        s, b = call('GET', '/rf/rf-lab.html'); self.assertEqual(s, 200)
        s, b = call('GET', '/costing/'); self.assertEqual(s, 200)

if __name__ == '__main__':
    unittest.main(verbosity=2)
