"""Read Excel Open XML without running macros or requiring third-party packages."""
import zipfile, xml.etree.ElementTree as ET, posixpath, re, json
from collections import Counter
X='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
R='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
NS={'x':X}
def colnum(c):
    v=0
    for x in c:v=v*26+ord(x)-64
    return v
def colname(n):
    s=''
    while n:n,a=divmod(n-1,26);s=chr(65+a)+s
    return s
def address(a):
    m=re.fullmatch(r'\$?([A-Z]+)\$?(\d+)',a);return colnum(m[1]),int(m[2])
def translate_formula(formula, origin, target):
    oc,orr=address(origin);tc,tr=address(target);dc,dr=tc-oc,tr-orr
    def cell(m):
        ca,cc,ra,rr=m.groups();c=colnum(cc)+(0 if ca else dc);r=int(rr)+(0 if ra else dr)
        return '#REF!' if c<1 or r<1 else ca+colname(c)+ra+str(r)
    # Excel double-quoted string literals never contain live A1 references.
    parts=re.split(r'("(?:[^"]|"")*")',formula)
    for i in range(0,len(parts),2):
        parts[i]=re.sub(r'(?<![A-Za-z0-9_.])(\$?)([A-Z]{1,3})(\$?)([0-9]+)(?![A-Za-z0-9_.(])',cell,parts[i])
    return ''.join(parts)

def read_book(path):
    with zipfile.ZipFile(path) as z:
        if sum(i.file_size for i in z.infolist())>250_000_000:raise ValueError('Workbook expands beyond 250 MB.')
        strings=[]
        if 'xl/sharedStrings.xml' in z.namelist():
            strings=[''.join(t.text or '' for t in e.iter('{'+X+'}t')) for e in ET.fromstring(z.read('xl/sharedStrings.xml'))]
        wb=ET.fromstring(z.read('xl/workbook.xml')); rel=ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        links={r.get('Id'):posixpath.normpath('xl/'+r.get('Target')) if not r.get('Target').startswith('/') else r.get('Target')[1:] for r in rel}
        result={'sheets':{},'names':{},'defined_names':[],'tables':{},'external_links':[]}
        for n in wb.findall('x:definedNames/x:definedName',NS):
            d={'name':n.get('name'),'ref':n.text,'scope':n.get('localSheetId'),'attributes':dict(n.attrib)}
            result['defined_names'].append(d)
            if n.get('localSheetId') is None or n.get('name') not in result['names']:result['names'][n.get('name')]={'ref':n.text,'scope':n.get('localSheetId')}
        for s in wb.findall('x:sheets/x:sheet',NS):
            target=links[s.get('{'+R+'}id')];root=ET.fromstring(z.read(target)); cells={}
            shared={}
            for c in root.findall('.//x:sheetData/x:row/x:c',NS):
                a=c.get('r');kind=c.get('t','n');f=c.find('x:f',NS);v=c.find('x:v',NS); val=v.text if v is not None else None
                if kind=='s':val=strings[int(val)] if val is not None else None
                elif kind=='inlineStr':val=''.join(t.text or '' for t in c.findall('.//x:t',NS))
                elif kind=='b':val=val=='1'
                elif kind=='n' and val is not None:
                    try:val=float(val);val=int(val) if val.is_integer() else val
                    except ValueError:pass
                if f is not None or val is not None:
                    formula='='+f.text if f is not None and f.text else None
                    if f is not None and f.get('t')=='shared':
                        si=f.get('si')
                        if formula:shared[si]=(a,formula)
                        elif si in shared:formula=translate_formula(shared[si][1],shared[si][0],a)
                    cells[a]={'value':val,'formula':formula,'formula_type':f.get('t','normal') if f is not None else None,'formula_source':f.text if f is not None else None,'shared_index':f.get('si') if f is not None else None,'formula_ref':f.get('ref') if f is not None else None,'type':kind,'style':c.get('s'),'metadata':c.get('cm')}
            validations=[{'range':v.get('sqref'),'type':v.get('type'),'formula1':v.findtext('x:formula1',None,NS),'formula2':v.findtext('x:formula2',None,NS)} for v in root.findall('x:dataValidations/x:dataValidation',NS)]
            sheet={'path':target,'code_name':(root.find('x:sheetPr',NS).get('codeName') if root.find('x:sheetPr',NS) is not None else None),'state':s.get('state','visible'),'cells':cells,'validations':validations,'hidden_rows':[int(r.get('r')) for r in root.findall('.//x:sheetData/x:row',NS) if r.get('hidden')=='1'],'hidden_columns':[dict(c.attrib) for c in root.findall('x:cols/x:col',NS) if c.get('hidden')=='1'],'merged_ranges':[m.get('ref') for m in root.findall('x:mergeCells/x:mergeCell',NS)]}
            result['sheets'][s.get('name')]=sheet
            rp=posixpath.dirname(target)+'/_rels/'+posixpath.basename(target)+'.rels'
            if rp in z.namelist():
                sr=ET.fromstring(z.read(rp)); tl={r.get('Id'):posixpath.normpath(posixpath.dirname(target)+'/'+r.get('Target')) for r in sr}
                for t in root.findall('x:tableParts/x:tablePart',NS):
                    tr=ET.fromstring(z.read(tl[t.get('{'+R+'}id')]));result['tables'][tr.get('name')]={'sheet':s.get('name'),'ref':tr.get('ref'),'columns':[c.get('name') for c in tr.findall('x:tableColumns/x:tableColumn',NS)]}
        for n in z.namelist():
            if n.startswith('xl/externalLinks/_rels/'):
                for r in ET.fromstring(z.read(n)):
                    if r.get('TargetMode')=='External':result['external_links'].append(r.get('Target'))
        result['stats']={'sheets':len(result['sheets']),'cells':sum(len(s['cells']) for s in result['sheets'].values()),'formula_cells':sum(bool(c['formula']) for s in result['sheets'].values() for c in s['cells'].values()),'array_formulas':sum(c['formula_type']=='array' for s in result['sheets'].values() for c in s['cells'].values()),'cached_errors':sum(c['type']=='e' for s in result['sheets'].values() for c in s['cells'].values()),'functions':dict(Counter(fn for s in result['sheets'].values() for c in s['cells'].values() for fn in re.findall(r'([A-Za-z_][\w.]*)\(',c['formula'] or '')))}
        return result

def val(book,sheet,cell,default=None):
    v=book['sheets'].get(sheet,{}).get('cells',{}).get(cell,{}).get('value');return default if v is None else v

def num(v,default=0):
    try:
        import math
        n=float(v);return n if math.isfinite(n) else default
    except (ValueError,TypeError):return default

def table_rows(book,name):
    t=book['tables'].get(name)
    if not t:return []
    a,b=t['ref'].split(':');lc,lr=address(a);rc,rr=address(b)
    return [(r,{h:val(book,t['sheet'],colname(lc+i)+str(r)) for i,h in enumerate(t['columns'])}) for r in range(lr+1,rr+1)]

def catalog(book):
    out=[]
    for name,fixed in [('tblParts',False),('tblFixed',True)]:
        for row,d in table_rows(book,name):
            desc=d.get('Description')
            if not desc or str(desc).startswith('#'):continue
            cat=d.get('Category 1') or ('Labour' if fixed else 'Equipment')
            out.append({'id':f'{name}-{row}','description':str(desc),'part':str(d.get('Part Number') or ''),'supplier':d.get('Supplier') or '', 'oem':d.get('OEM') or '', 'category':str(cat),'cost_category':d.get('Cost Category') or '', 'list':num(d.get('List Price (Unit)')),'discount':num(d.get('Discount'))*100,'net':num(d.get('NETT Price (Unit)')) if fixed else None,'sell':num(d.get('Selling Price (Unit)')) if fixed else None,'mode':'fixed' if fixed else 'markup','lead_days':num(d.get('Standard Leadtime')),'updated':d.get('Last Updated'),'source':f'RATES REFRESH!{row}','priority':0,'unit': 'km' if 'per km' in str(desc) else 'night' if 'per night' in str(desc) else 'day' if 'Daily' in str(desc) or 'per day' in str(desc) else 'hour' if fixed and cat=='Labour' else 'each'})
    for r in range(2,1302):
        desc=val(book,'RATES','B'+str(r));price=val(book,'RATES','F'+str(r))
        if not desc or not isinstance(price,(int,float)):continue
        out.append({'id':f'legacy-{r}','description':str(desc),'part':str(val(book,'RATES','C'+str(r),'')),'supplier':val(book,'RATES','D'+str(r),''),'oem':val(book,'RATES','E'+str(r),''),'category':'Legacy RATES','cost_category':val(book,'RATES','H'+str(r),''),'list':num(price),'discount':num(val(book,'RATES','G'+str(r)))*100,'net':None,'sell':None,'mode':'markup','lead_days':num(val(book,'RATES','I'+str(r))),'updated':val(book,'RATES','J'+str(r)),'source':f'RATES!{r}','priority':1,'unit':'each'})
    return out

def import_project(book,filename='workbook.xlsm'):
    from datetime import date
    settings={'document_type':val(book,'Inputs','B154','QUOTATION'),'quote_no':val(book,'Inputs','B152',''),'project_no':val(book,'Inputs','B153',''),'client':val(book,'Inputs','B155',''),'contact':val(book,'Inputs','B156',''),'email':val(book,'Inputs','B157',''),'description':val(book,'Inputs','B158',''),'currency':val(book,'Inputs','B159','ZAR'),'destination':val(book,'Inputs','B160',''),'enquiry':val(book,'Inputs','B161',''),'company':val(book,'Inputs','B162',''),'salesperson':val(book,'Inputs','B164',''),'scope':val(book,'SUMMARY','M23',''),'conversion':num(val(book,'COSTING','BL29'),15),'vat':0,'date':date.today().isoformat(),'revision':'00','notes':''}
    settings['markups']=[{'name':f'MU {i+1}','label':val(book,'COSTING',f'AJ{229+8*i}',f'MU {i+1}'),'components':[{'label':val(book,'COSTING',f'AJ{230+8*i+j}',''),'value':num(val(book,'COSTING',f'AM{230+8*i+j}'))*100} for j in range(5)]} for i in range(5)]
    groups=[];rows=book['sheets']['COSTING']['cells'];last=0
    primary_end=int(re.findall(r'\$(\d+)',book['names'].get('QTY',{}).get('ref','COSTING!$AT$92:$AT$156'))[-1])
    for a,c in rows.items():
        if a.startswith('F') and a[1:].isdigit() and int(a[1:])>87:last=max(last,int(a[1:]))
    for r in range(88,last+1):
        level=val(book,'COSTING','A'+str(r));desc=val(book,'COSTING','AJ'+str(r))
        if level!=2 or not desc:continue
        root=int(num(val(book,'COSTING','F'+str(r))));rootdesc=str(val(book,'COSTING','AJ'+str(root),''));option=root>primary_end
        category='pg' if 'P&G' in rootdesc else 'labour' if 'Labour' in rootdesc else 'materials'
        g={'id':f'g{r}','name':str(desc),'category':category,'option':option,'qty':num(val(book,'COSTING','AT'+str(r)),1),'source_row':r,'lines':[]}
        end=int(num(val(book,'COSTING','K'+str(r)),r))
        for lr in range(r+1,end):
            if val(book,'COSTING','A'+str(lr))!=4:continue
            desc=val(book,'COSTING','AJ'+str(lr));price=num(val(book,'COSTING','AU'+str(lr)));net=num(val(book,'COSTING','AW'+str(lr)));sale=num(val(book,'COSTING','BA'+str(lr)))
            # Blank template placeholders do not become quote lines.
            if not desc or desc==0 or str(desc).startswith('To Be Completed') or (not price and not net and not sale):continue
            f=rows.get('AU'+str(lr),{}).get('formula') or '';bf=rows.get('BA'+str(lr),{}).get('formula') or ''
            mode='percent' if 'SUM(INDIRECT' in f else 'fixed' if 'AllItems_Fixed' in bf or 'tblFixed' in bf or bf==f'=AU{lr}' else 'markup'
            parent=int(num(val(book,'COSTING','L'+str(lr))));multi=num(val(book,'COSTING','AS'+str(parent)),1)
            line={'id':f'l{lr}','description':str(desc),'part':str(val(book,'COSTING','AM'+str(lr),'')),'supplier':val(book,'COSTING','AN'+str(lr),''),'oem':val(book,'COSTING','AO'+str(lr),''),'qty':num(val(book,'COSTING','AR'+str(lr)),1),'multiplier':multi,'unit':'each','list':price,'discount':num(val(book,'COSTING','AV'+str(lr)))*100,'net':net,'sell':sale,'mode':mode,'markup':str(val(book,'COSTING','AY'+str(lr),'MU 1')),'cost_category':val(book,'COSTING','BN'+str(lr),''),'source':f'COSTING!{lr}','source_row':lr,'lead_days':num(val(book,'COSTING','AP'+str(lr))),'percent':num(val(book,'COSTING','AT'+str(lr)))*100 if mode=='percent' else 0,'notes':''}
            g['lines'].append(line)
        groups.append(g)
    payments=[]
    ref=book['names'].get('Payment_Perc',{}).get('ref',"'T&C'!$I$82:$I$96")
    m=re.search(r'\$I\$(\d+)',ref);start=int(m[1])+1 if m else 83
    for r in range(start,start+12):
        p=num(val(book,'T&C','I'+str(r)))
        if p:payments.append({'description':str(val(book,'T&C','B'+str(r),'')),'percent':p*100})
    return {'schema':1,'id':'template','name':str(settings['description']),'settings':settings,'groups':groups,'payments':payments,'source_file':filename,'source_totals':{k:num(val(book,'COSTING','BI'+str(r))) for k,r in [('materials',31),('pg',32),('labour',33)]},'import_warnings':['Workbook values are saved Excel caches; macros and external links were not run.','Rate sources include test data. Review prices before quoting.']}
