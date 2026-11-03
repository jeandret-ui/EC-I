"""Local CGI costing dashboard. Python 3.10+, no pip packages required."""
import json, os, sys, webbrowser, threading, argparse, uuid, datetime, base64, io, re, traceback, urllib.parse
from pathlib import Path
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from engine import calculate,validate
from workbook import read_book,import_project,catalog
from reports import xlsx
from register_store import RegisterStore
import register as register_rules
from projects import project_index
ROOT=Path(__file__).resolve().parent
DATA=Path(os.environ.get('CGI_COSTING_DATA',str(ROOT/'data')));COSTINGS=DATA/'Costings'
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
    return Path(d) if d else COSTINGS/safe_code(project_no)
LOCK=threading.RLock()
COMPANIES=json.loads((ROOT/'reference/profile_companies.json').read_text(encoding='utf-8'))
def readjson(p):return json.loads(p.read_text(encoding='utf-8'))
def atomic(path,obj):
    temp=path.with_name(path.name+'.tmp');temp.write_text(json.dumps(obj,ensure_ascii=False,indent=2),encoding='utf-8');os.replace(temp,path)
def pid(v):
    if not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',str(v)):raise ValueError('Invalid project identifier.')
    return str(v)
def load(v):return readjson(doc_path(pid(v)))
def save(p,expected=None):
    s=p.setdefault('settings',{});s.setdefault('document_type','QUOTATION')
    company=next((c for c in COMPANIES if c['name']==s.get('company')), {})
    for key,value in company.items():
        if key!='name':s.setdefault(key,value)
    validate(p);i=pid(p.get('id') or uuid.uuid4().hex);old=all_doc_paths().get(i);tdir=target_dir(s.get('project_no'));tdir.mkdir(parents=True,exist_ok=True);path=tdir/(i+'.json')
    with LOCK:
        current=readjson(old) if old and old.exists() else None
        if current and expected is not None and current.get('version',0)!=expected:raise ValueError('This project changed in another window. Reopen it before saving.')
        if current:
            hist=old.parent/'_history';hist.mkdir(exist_ok=True);stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');atomic(hist/(i+'-'+stamp+'.json'),current)
            # Keep the latest 40 versions per document, in addition to current data.
            for oldb in sorted(hist.glob(i+'-*.json'))[:-40]:oldb.unlink()
        clean=json.loads(json.dumps(p));clean.pop('calculated',None)
        for g in clean['groups']:
            g.pop('calculated',None)
            for l in g['lines']:l.pop('calculated',None)
        for m in clean['payments']:m.pop('amount',None)
        clean['id']=i;clean['version']=(current or {}).get('version',0)+1;clean['updated']=datetime.datetime.now().isoformat(timespec='seconds');atomic(path,clean);atomic(DATA/'active.json',{'id':i})
        if old and old.exists() and old.resolve()!=path.resolve():old.unlink()
        return calculate(clean)
TEMPLATE=readjson(ROOT/'reference/template_project.json');CAT=readjson(ROOT/'reference/catalogue.json');AUDIT=None
if not all_doc_paths():save(TEMPLATE)
def active():
    try:return load(readjson(DATA/'active.json')['id'])
    except (OSError,KeyError,ValueError):return load(sorted(all_doc_paths())[0])
def audit():
    global AUDIT
    if AUDIT is None:AUDIT=readjson(ROOT/'reference/workbook_audit.json')
    return AUDIT

REG=RegisterStore(ROOT,DATA,LOCK,atomic,lambda i:calculate(load(i)))

def cell_inspect(sheet,a):
    b=audit();s=b['sheets'].get(sheet)
    if not s:raise ValueError('Sheet not found.')
    c=s['cells'].get(a.upper().replace('$',''))
    if c is None:return {'cell':a,'sheet':sheet,'value':None,'formula':None,'references':[],'dependents':[]}
    f=c.get('formula') or '';refs=[]
    # Literal references, symbolic named ranges and tables. INDIRECT is explicitly unresolved.
    masked=re.sub(r'"(?:[^"]|"")*"','""',f)
    for m in re.finditer(r"(?<![\w.])(?:(?:'([^']+)'|([A-Za-z_][\w ]*))!)?(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?(?![\w.(])",masked):
        sh=m[1] or m[2] or sheet;ref=m[3].replace('$','')+(':'+m[4].replace('$','') if m[4] else '')
        refs.append({'sheet':sh,'ref':ref})
    names=[{'name':n,'ref':d['ref']} for n,d in b['names'].items() if re.search(r'(?<![\w.])'+re.escape(n)+r'(?![\w.])',masked)]
    tables=[{'name':n,**t} for n,t in b['tables'].items() if n in f]
    deps=[];pattern=re.compile(r'(?<![A-Z0-9_])\$?'+re.escape(re.match('[A-Z]+',a)[0])+r'\$?'+re.escape(re.search(r'\d+',a)[0])+r'(?!\d)')
    for sh,d in b['sheets'].items():
        for ca,v in d['cells'].items():
            ff=v.get('formula') or ''
            if pattern.search(ff) and (sh==sheet or sheet+'!' in ff or "'"+sheet+"'!" in ff):deps.append({'sheet':sh,'cell':ca})
    return {'sheet':sheet,'cell':a,**c,'references':refs,'named_ranges':names,'tables':tables,'dependents':deps[:100],'dependent_count':len(deps),'dynamic':bool(re.search(r'INDIRECT|OFFSET|LOOKUP|FILTER',f)),'note':'References below are literal/symbolic references. INDIRECT and lookup-selected dependencies need Excel runtime evaluation; dependent search does not expand ranges.'}

class Handler(BaseHTTPRequestHandler):
    def log_message(self,fmt,*args):pass
    def reply(self,data,status=200,ctype='application/json',filename=None):
        raw=json.dumps(data,ensure_ascii=False).encode() if ctype=='application/json' else data
        self.send_response(status);self.send_header('Content-Type',ctype);self.send_header('Content-Length',str(len(raw)));self.send_header('Cache-Control','no-store');self.send_header('X-Content-Type-Options','nosniff')
        if filename:self.send_header('Content-Disposition',f'attachment; filename="{filename}"')
        self.end_headers();self.wfile.write(raw)
    def local_request(self):
        host=self.headers.get('Host','');port=self.server.server_port
        if host not in [f'127.0.0.1:{port}',f'localhost:{port}']:raise ValueError('Local requests only.')
        origin=self.headers.get('Origin')
        if origin and origin not in [f'http://127.0.0.1:{port}',f'http://localhost:{port}']:raise ValueError('Cross-site request blocked.')
    def do_GET(self):
        try:
            self.local_request();u=urllib.parse.urlparse(self.path);q=urllib.parse.parse_qs(u.query);arg=lambda k,d='':q.get(k,[d])[0]
            if u.path=='/api/register':self.reply(REG.view());return
            if u.path=='/api/register-cell':self.reply(register_rules.inspect_cell(ROOT/'workbooks/Quote_Register_20260806.xlsm',arg('cell').upper()));return
            if u.path=='/api/register-vba':
                self.reply({'modules':readjson(ROOT/'reference/register_vba_index.json'),'source':(ROOT/'reference/register_VBA/Module1.bas').read_text(encoding='utf-8')});return
            if u.path=='/api/register-export':
                if arg('type')=='xlsx':self.reply(REG.export_xlsx(),ctype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename='CGI_Quote_Register.xlsx')
                else:self.reply(json.dumps(REG.read(),ensure_ascii=False,indent=2).encode(),ctype='application/octet-stream',filename='CGI_Quote_Register.json')
                return
            if u.path=='/api/init':
                b=audit();self.reply({'project':calculate(active()),'catalogue':active().get('catalogue',CAT),'stats':b['stats'],'sheets':[{'name':n,'state':s['state'],'cells':len(s['cells']),'formulas':sum(bool(c['formula']) for c in s['cells'].values())} for n,s in b['sheets'].items()],'vba':readjson(ROOT/'reference/vba_index.json'),'companies':COMPANIES});return
            if u.path=='/api/project-index':
                self.reply(project_index([readjson(p) for p in all_doc_paths().values()], REG.read()['records']));return
            if u.path=='/api/projects':self.reply([{'id':p.stem,'name':d.get('name'),'client':d['settings'].get('client'),'updated':d.get('updated'),'quote':d['settings'].get('quote_no'),'project_no':d['settings'].get('project_no'),'project_name':d['settings'].get('project_name')} for p in all_doc_paths().values() for d in [readjson(p)]]);return
            if u.path=='/api/project':
                p=load(arg('id'));atomic(DATA/'active.json',{'id':p['id']});self.reply(calculate(p));return
            if u.path=='/api/export':
                p=load(arg('id'));mode=arg('type');fn=re.sub(r'[^A-Za-z0-9_-]','_',str(p['settings'].get('quote_no') or 'costing'))
                if mode=='xlsx':self.reply(xlsx(p),ctype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',filename=fn+'.xlsx')
                else:self.reply(json.dumps(p,indent=2,ensure_ascii=False).encode(),ctype='application/octet-stream',filename=fn+'.json')
                return
            if u.path=='/api/audit':
                b=audit();query=arg('q').lower();sn=arg('sheet');rows=[]
                for n,s in b['sheets'].items():
                    if sn and sn!=n:continue
                    for a,c in s['cells'].items():
                        if not query or query in (a+' '+str(c['value'])+' '+str(c['formula'])).lower():rows.append({'sheet':n,'cell':a,**c})
                self.reply({'total':len(rows),'rows':rows[:200]});return
            if u.path=='/api/cell':self.reply(cell_inspect(arg('sheet'),arg('cell').upper()));return
            if u.path=='/api/vba':
                name=arg('name');idx=readjson(ROOT/'reference/vba_index.json')
                if name not in [m['name'] for m in idx]:raise ValueError('Module not found.')
                self.reply({'source':(ROOT/'reference/VBA'/name).read_text(encoding='utf-8')});return
            allowed={'/project.js':('web/project.js','text/javascript; charset=utf-8'),'/project.css':('web/project.css','text/css; charset=utf-8'),'/icons.js':('web/icons.js','text/javascript; charset=utf-8'),'/register.js':('web/register.js','text/javascript; charset=utf-8'),'/register.css':('web/register.css','text/css; charset=utf-8'),'/logo.png':('web/logo.png','image/png'),'/register-workbook':('workbooks/Quote_Register_20260806.xlsm','application/vnd.ms-excel.sheet.macroEnabled.12'),'/':('web/index.html','text/html; charset=utf-8'),'/app.js':('web/app.js','text/javascript; charset=utf-8'),'/style.css':('web/style.css','text/css; charset=utf-8'),'/workbook':('workbooks/Costing_Template_20260910.xlsm','application/vnd.ms-excel.sheet.macroEnabled.12'),'/audit-download':('reference/workbook_audit.json','application/json')}
            if u.path not in allowed:self.reply({'error':'Not found'},404);return
            f,ct=allowed[u.path];self.reply((ROOT/f).read_bytes(),ctype=ct,filename=Path(f).name if u.path in ['/workbook','/audit-download','/register-workbook'] else None)
        except (BrokenPipeError,ConnectionResetError):pass
        except (ValueError,KeyError,OSError) as e:self.reply({'error':str(e)},400)
        except Exception as e:traceback.print_exc();self.reply({'error':'Unexpected error. See the console.'},500)
    def do_POST(self):
        try:
            self.local_request();size=int(self.headers.get('Content-Length',0))
            if size>30_000_000:raise ValueError('Maximum request size is 30 MB.')
            d=json.loads(self.rfile.read(size));route=urllib.parse.urlparse(self.path).path
            if route=='/api/register-save':self.reply(REG.record(d['record'],d.get('version')));return
            if route=='/api/register-settings':self.reply(REG.settings(d));return
            if route=='/api/register-suggest':self.reply({'reference':register_rules.suggest_reference(d['record'],REG.read(),d.get('project',False))});return
            if route=='/api/register-restore':self.reply(REG.restore(d));return
            if route=='/api/register-sync':self.reply(REG.sync(d));return
            if route=='/api/register-link':
                with LOCK:
                    book=REG.checked(d.get('version'));r=next((r for r in book['records'] if r['id']==d['id']),None)
                    if not r:raise ValueError('Record not found.')
                    project_id=d.get('project_id');p=None
                    if d.get('create'):
                        p=json.loads(json.dumps(TEMPLATE));p['id']=uuid.uuid4().hex;p['name']=r.get('description') or 'New costing';p['settings'].update({'description':p['name'],'project_name':d.get('project_name') or p['name'],'project_no':r.get('workspace_code') or r.get('parent_project') or r.get('project_no') or '', 'quote_no':r.get('quote_no') or '', 'client':r.get('client') or '', 'contact':r.get('contact') or '', 'destination':r.get('site') or '', 'salesperson':r.get('owner') or '', 'scope':'','currency':'ZAR','date':datetime.date.today().isoformat(),'company':{'CONTROLGEAR PRODUCTS':'CONTROLGEAR PRODUCTS (Pty) Ltd','INSTRAMAC':'INSTRAMAC (Pty) Ltd','CGI INSTALLATIONS':'CONTROLGEAR INSTRAMAC INSTALLATIONS (Pty) Ltd','CGI RWANDA':'CONTROLGEAR INSTRAMAC RWANDA (Pty) Ltd'}.get(r.get('company'),r.get('company') or TEMPLATE['settings']['company']),'client_po':r.get('order_no') or ''})
                        for g in p['groups']:g['lines']=[];g.pop('builder_visible',None)
                        p.pop('source_totals',None);p=save(p);project_id=p['id']
                    out=REG.link(d['id'],project_id,d['version']);self.reply({'register':out,'project':p});return
            if route=='/api/save':self.reply(save(d['project'],d.get('version')));return
            if route=='/api/calculate':self.reply(calculate(d['project']));return
            if route=='/api/new':
                p=json.loads(json.dumps(d.get('project') or TEMPLATE));p['id']=uuid.uuid4().hex;p['name']=d.get('name','New costing');p['settings']['description']=p['name']
                if not d.get('project'):
                    p['settings'].update({'quote_no':'NEW-QUOTE','project_no':str(d.get('project_no') or '').strip().upper(),'project_name':d.get('project_name') or p['name'],'client':d.get('client') or '', 'contact':d.get('contact') or '', 'email':'','destination':d.get('destination') or '', 'scope':'','date':datetime.date.today().isoformat(),'revision':'00','salesperson':'','enquiry':'','notes':''});p['groups']=[g for g in p['groups'] if not g.get('option')]
                    for g in p['groups']:g['lines']=[];g.pop('builder_visible',None)
                for key in ['quote_no','company','client_po','project_manager','document_type','project_start','project_end']:
                    if key in d:p['settings'][key]=str(d[key] or '')
                p.pop('source_totals',None);self.reply(save(p));return
            if route=='/api/import':
                content=base64.b64decode(d['content'],validate=True);filename=d['filename']
                if filename.lower().endswith('.json'):
                    p=json.loads(content);validate(p);cat=None
                elif filename.lower().endswith(('.xlsm','.xlsx')):
                    b=read_book(io.BytesIO(content))
                    if not all(s in b['sheets'] for s in ['Inputs','COSTING','RATES']):raise ValueError('Import a CGI costing workbook with Inputs, COSTING and RATES sheets.')
                    p=import_project(b,filename);cat=catalog(b)
                else:raise ValueError('Choose a dashboard JSON or CGI costing XLSM/XLSX.')
                p['id']=uuid.uuid4().hex
                if cat is not None:p['catalogue']=cat
                check=calculate(p)
                if p.get('source_totals'):
                    for k,v in p['source_totals'].items():
                        delta=check['calculated']['sections'][k]['sell']-v
                        if abs(delta)>.01:p.setdefault('import_warnings',[]).append(f'{k}: dashboard selling differs from the saved Excel total by R{delta:,.2f}. Review the imported structure.')
                out=save(p);self.reply({'project':out,'catalogue':cat});return
            self.reply({'error':'Not found'},404)
        except (BrokenPipeError,ConnectionResetError):pass
        except (ValueError,KeyError,OSError) as e:self.reply({'error':str(e)},400)
        except Exception:traceback.print_exc();self.reply({'error':'Could not read this file. See the console.'},500)

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=8765);parser.add_argument('--no-browser',action='store_true');a=parser.parse_args()
    server=None
    for port in range(a.port,a.port+20):
        try:server=ThreadingHTTPServer(('127.0.0.1',port),Handler);break
        except OSError:continue
    if not server:raise SystemExit('No local port available. Close previous dashboard consoles and try again.')
    url=f'http://127.0.0.1:{server.server_port}';print('\nCGI PROJECT DASHBOARD v3.0\n'+url+'\nKeep this window open. Press Ctrl+C to stop.\n')
    if not a.no_browser:threading.Timer(.5,lambda:webbrowser.open(url)).start()
    try:server.serve_forever()
    except KeyboardInterrupt:print('\nDashboard stopped.')
    finally:server.server_close()
if __name__=='__main__':main()
