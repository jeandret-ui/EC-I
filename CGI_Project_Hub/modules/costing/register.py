"""Quote register rules extracted from CGI-ENG-REG-05; no Excel runtime required."""
import calendar, copy, datetime as dt, json, math, re, uuid, zipfile, xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path
STATUSES={1:'Open quote',2:'Submitted',3:'Follow up · 14+ days',4:'Follow up · 30+ days',5:'Follow up · 60+ days',6:'Follow up · 120+ days',6.5:'Budget submitted',7:'Open project',8:'Lost',9:'Cancelled',10:'Missed deadline',11:'Completed project',12:'Legacy data'}
BUDGETS={'equipment':'Equipment & materials','manufacturing':'Panel manufacturing','installation':'Installation','engineering':'Engineering & drawings','commissioning':'Commissioning & testing','pm':'Project management','pg':'P&Gs / travel','other':'Other costs'}
DATES=['start','end','enquiry_date','required_date','submitted_date','feedback_date','order_date','projected_end','progress_updated','completed_date']
NUMBERS=['quote_value','order_value','engineering_value','probability','completion','invoiced']
D=lambda x:Decimal(str(x or 0))
def date(v):
    try:return dt.date.fromisoformat(str(v))
    except (ValueError,TypeError):return None
def addmonths(v,n):
    m=v.month-1+n;y=v.year+m//12;m=m%12+1
    return dt.date(y,m,min(v.day,calendar.monthrange(y,m)[1]))
def fy(v):return v.year+1 if v.month>=3 else v.year
def yearfrac_30_360(start,end):
    d1,d2=start.day,end.day;feb1=start.month==2 and d1==calendar.monthrange(start.year,2)[1];feb2=end.month==2 and d2==calendar.monthrange(end.year,2)[1]
    if feb1 and feb2:d2=30
    if d1==31 or feb1:d1=30
    if d2==31 and d1>=30:d2=30
    return ((end.year-start.year)*360+(end.month-start.month)*30+d2-d1)/360


def validate_record(r,require_fields=True):
    if not isinstance(r,dict):raise ValueError('Expected a quote record.')
    for k,v in r.items():
        if isinstance(v,str) and len(v)>20000:raise ValueError('Text fields must be shorter than 20,000 characters.')
    if require_fields and not str(r.get('description') or '').strip():raise ValueError('Enter a quotation description.')
    if require_fields and not str(r.get('company') or '').strip():raise ValueError('Choose the supplying company.')
    for k in NUMBERS:
        v=r.get(k)
        if v in [None,'']:continue
        if isinstance(v,bool):raise ValueError('Enter a valid number for '+k+'.')
        try:n=float(v)
        except (ValueError,TypeError):raise ValueError('Enter a valid number for '+k+'.')
        if not math.isfinite(n) or n<0 or n>(1 if k in ['probability','completion','invoiced'] else 1e14):raise ValueError('Invalid range for '+k+'.')
    for k in DATES:
        if r.get(k) and not date(r[k]):raise ValueError('Enter a valid date for '+k+'.')
    if r.get('quote_type') not in ['Tender','Budget','Variation',None,'']:raise ValueError('Choose Tender, Budget or Variation.')
    if r.get('status_mode','auto') not in ['auto','manual']:raise ValueError('Invalid status mode.')
    if r.get('status_mode')=='manual' and r.get('status_override') not in list(STATUSES)+['-',None]:raise ValueError('Invalid status override.')
    if not isinstance(r.get('budgets',{}),dict):raise ValueError('Invalid department budget.')
    for k,b in r.get('budgets',{}).items():
        if k not in BUDGETS or not isinstance(b,dict):raise ValueError('Unknown department budget.')
        for field in ['planned','actual','committed','remaining']:
            v=b.get(field)
            if v in ['',None]:continue
            try:n=float(v)
            except (ValueError,TypeError):raise ValueError('Enter a valid budget amount.')
            if not math.isfinite(n) or not 0<=n<=1e14:raise ValueError('Budget amounts must be zero or positive.')

def status(r,asof):
    if r.get('status_mode')=='manual':return r.get('status_override')
    if str(r.get('bc_status') or '').lower()=='closed':return 11
    if r.get('missed_reason'):return 10
    if r.get('cancel_reason'):return 9
    if r.get('lost_to'):return 8
    if r.get('project_no'):return 7
    submitted=all([len(str(r.get('quote_no') or ''))>11,r.get('brand'),r.get('industry'),D(r.get('quote_value'))>0,r.get('submitted_date'),r.get('description'),r.get('owner')])
    if submitted:
        if r.get('quote_type')=='Budget':return 6.5
        age=(asof-date(r['submitted_date'])).days
        return 6 if age>=120 else 5 if age>=60 else 4 if age>=30 else 3 if age>=14 else 2
    return 1 if r.get('company') else None

def schedule(r,st):
    start=date(r.get('start'));end=date(r.get('end'));duration=r.get('duration') or '';modes=r.get('date_modes',{})
    actual=date(r.get('projected_end')) or date(r.get('completed_date'))
    q=D(r.get('quote_value'))
    if modes.get('start')=='auto':
        order=date(r.get('order_date'));enquiry=date(r.get('enquiry_date'));proposal=date(r.get('submitted_date'))
        start=order if st in [7,11] and order else addmonths(enquiry,1) if st==1 and enquiry else addmonths(proposal,1 if q<1000000 else 2 if q<=5000000 else 3) if isinstance(st,(int,float)) and 2<=st<=7 and proposal else None
    if modes.get('duration')=='auto':
        if st==11 and start and actual and actual>=start:
            days=(actual-start).days
            # Excel YEARFRAC defaults to US/NASD 30/360.
            duration=str(int(days/7+0.5))+'w' if days<84 else str(int(yearfrac_30_360(start,actual)*12+0.5))+'m'
        elif isinstance(st,(int,float)) and 1<=st<=7 and q>0:duration='1w' if q<=20000 else '6w' if q<=1000000 else '20w' if q<=10000000 else '12m'
        else:duration=''
    if modes.get('end')=='auto':
        match=re.fullmatch(r'(\d+)\s*([wm])',str(duration).lower().strip())
        if modes.get('duration')=='manual' and start and match:end=start+dt.timedelta(weeks=int(match[1])) if match[2]=='w' else addmonths(start,int(match[1]))
        elif st in [7,11] and actual:end=actual
        elif start and isinstance(st,(int,float)) and 1<=st<=7 and q>0:end=addmonths(start,12) if q>10000000 else start+dt.timedelta(days=7 if q<=20000 else 42 if q<=1000000 else 140)
        else:end=None
    return start,end,duration

def weight(r,meta,mode):
    p=r.get('probability');p=None if p in [None,''] else float(p)
    for w in meta['weights'][mode]:
        wp=w['probability'];wp=None if wp in [None,''] else float(wp)
        if p==wp:return w['budget'] if r.get('quote_type')=='Budget' else w['tender']
    return None

def compute_record(record,book,load_costing=None):
    r=copy.deepcopy(record);asof=date(book.get('as_of')) or dt.date.today();st=status(r,asof);start,end,duration=schedule(r,st)
    r.update(start=start.isoformat() if start else '',end=end.isoformat() if end else '',duration=duration)
    for dest,src in [('project_company','company'),('project_client','client'),('project_site','site')]:r[dest]=r.get(src) if r.get('order_no') else None
    order=D(r.get('order_value'));q=D(r.get('quote_value'));completion=D(r.get('completion'));invoiced=D(r.get('invoiced'))
    rem=order*(1-completion) if st!=11 else None;rem_inv=order*(1-invoiced) if st!=11 else None
    issues=[];alloc={};weight_value=weight(r,book['meta'],book.get('weight_mode','with'));weighted=float(q*D(weight_value)) if weight_value is not None else None
    monthly=[]
    if st==7 and rem:
        projected=date(r.get('projected_end')) or end;current=asof.replace(day=1)
        if not date(r.get('projected_end')) and end:issues.append('Forecast uses planned end because projected end is missing (FY allocation fallback).')
        if not start or not projected or projected<start:issues.append('Remaining work has missing or invalid forecast dates.')
        elif projected<current:issues.append('Project end date is overdue; remaining work is unallocated.')
        else:
            sm=max(start.replace(day=1),current);em=projected.replace(day=1);months=max(1,(em.year-sm.year)*12+em.month-sm.month+1)
            if months>600:issues.append('Forecast exceeds 50 years; review end date.')
            else:
                for i in range(months):
                    m=addmonths(sm,i);value=rem/months;alloc[str(fy(m))]=alloc.get(str(fy(m)),Decimal(0))+value;monthly.append({'month':m.isoformat(),'value':float(value)})
    quote_alloc={}
    if isinstance(st,(int,float)) and 2<=st<=6.5 and q:
        if start and end and end>=start:
            days=(end-start).days+1
            if end.year-start.year>50:issues.append('Quote schedule exceeds 50 years.')
            else:
                for year in range(fy(start),fy(end)+1):
                    lo=max(start,dt.date(year-1,3,1));hi=min(end,dt.date(year,3,1)-dt.timedelta(days=1))
                    if hi>=lo:quote_alloc[str(year)]=q*D((hi-lo).days+1)/days
        else:issues.append('Submitted value has missing or invalid schedule dates.')
        if weight_value is None:issues.append('Probability has no conversion weight in the workbook table.')
    if st in [2,3,4,5,6,6.5]:
        if r.get('probability') in [None,'']:issues.append('Win probability is blank; workbook uses the blank 2% conversion weight.')
        if date(r.get('submitted_date')) and date(r['submitted_date'])>asof:issues.append('Proposal date is in the future.')
    if st==1 and r.get('submitted_date') and q:issues.append('Proposal entered, but automatic submitted status needs brand, industry, owner and a full quote reference.')
    if st==7:
        for k,label in [('order_value','Order value'),('order_date','Order received date'),('projected_end','Projected end date'),('completion','Completion'),('invoiced','Invoiced percentage')]:
            if r.get(k) in [None,'']:issues.append(label+' is missing.')
        if re.search(r'await|work done|will be',str(r.get('order_no') or ''),re.I):issues.append('PO reference is provisional / awaiting a formal PO.')
        if r.get('bc_status') not in ['Open','Closed']:issues.append('Business Central project status is missing or unrecognized.')
    if st!=12 and not r.get('client'):issues.append('Client is missing.')
    if start and end and end<start:issues.append('Planned end precedes planned start.')
    linked=None
    if r.get('costing_id') and load_costing:
        try:linked=load_costing(r['costing_id'])
        except (OSError,ValueError,KeyError):issues.append('Linked costing cannot be opened.')
    linked_cost=linked['calculated']['cost'] if linked and any(g['lines'] for g in linked['groups'] if not g.get('option')) else None
    if linked and abs(linked['calculated']['sell']-float(q))>.01:issues.append('Linked costing selling differs from register quote value; sync explicitly after review.')
    budgetrows=[]
    for key,label in BUDGETS.items():
        b=r.get('budgets',{}).get(key,{});f={k:None if b.get(k) in [None,''] else float(b[k]) for k in ['planned','actual','committed','remaining']}
        # Remaining is additional, uncommitted cost to finish; committed excludes already paid costs.
        forecast=sum(D(f[k]) for k in ['actual','committed','remaining']) if any(f[k] is not None for k in ['actual','committed','remaining']) else None
        budgetrows.append({'key':key,'label':label,**f,'forecast':float(forecast) if forecast is not None else None,'available':float(D(f['planned'])-D(f['actual'])-D(f['committed'])) if f['planned'] is not None else None,'variance':float(D(f['planned'])-forecast) if f['planned'] is not None and forecast is not None else None})
    planned_entries=[b['planned'] for b in budgetrows if b['planned'] is not None];forecast_entries=[b['forecast'] for b in budgetrows if b['forecast'] is not None]
    planned=float(sum(map(D,planned_entries))) if planned_entries else linked_cost
    forecast=float(sum(map(D,forecast_entries))) if forecast_entries else None
    complete=bool(r.get('budget_complete'));revenue_data=r.get('order_value') if st in [7,11] else r.get('quote_value');revenue_known=revenue_data not in [None,''];revenue=float(order) if st in [7,11] else float(q)
    gp=revenue-planned if revenue_known and complete and planned is not None else None;forecast_gp=revenue-forecast if revenue_known and complete and forecast is not None else None
    if complete and planned is None:issues.append('Full budget is marked complete, but no costs have been entered.')
    if complete and forecast_entries and any(b['planned'] is not None and b['forecast'] is None for b in budgetrows):issues.append('Some budgeted departments have no forecast costs; forecast GP is incomplete.');forecast_gp=None
    total_alloc=sum(alloc.values(),Decimal(0));unallocated=rem-total_alloc if st==7 and rem is not None else Decimal(0)
    r['calculated']={'status':st,'status_label':STATUSES.get(st,'Unclassified'),'age':(asof-date(r['submitted_date'])).days if date(r.get('submitted_date')) else None,'days_to_quote':(date(r['required_date'])-date(r['enquiry_date'])).days if date(r.get('required_date')) and date(r.get('enquiry_date')) else None,'days_left':(date(r['required_date'])-asof).days if date(r.get('required_date')) else None,'remaining_work':float(rem) if rem is not None else None,'remaining_engineering':float(D(r.get('engineering_value'))*(1-completion)) if st==7 else None,'remaining_invoicing':float(rem_inv) if rem_inv is not None else None,'work_fy':{k:float(v) for k,v in alloc.items()},'quote_fy':{k:float(v) for k,v in quote_alloc.items()},'monthly_work':monthly,'unallocated_work':float(unallocated),'conversion_weight':weight_value,'weighted_quote':weighted,'budgets':budgetrows,'planned_cost':planned,'forecast_cost':forecast,'cost_complete':complete,'planned_gp':gp,'forecast_gp':forecast_gp,'margin':gp/revenue*100 if gp is not None and revenue else None,'linked_cost':linked_cost,'linked_sell':linked['calculated']['sell'] if linked else None,'issues':issues}
    return r

def compute(book,load_costing=None):
    out={k:copy.deepcopy(v) for k,v in book.items() if k!='records'};rows=[compute_record(r,book,load_costing) for r in book['records']];out['records']=rows
    live=[r for r in rows if not r.get('archived')];counts={str(s):sum(r['calculated']['status']==s for r in live) for s in STATUSES}
    submitted=[r for r in live if r['calculated']['status'] in [2,3,4,5,6,6.5]];won=[r for r in live if r['calculated']['status']==7];sums=lambda rr,k:float(sum(D(r.get(k)) for r in rr));cs=lambda k:float(sum(D(r['calculated'].get(k)) for r in won))
    wf={};qf={};weighted_fy={}
    for r in won:
        for y,v in r['calculated']['work_fy'].items():wf[y]=wf.get(y,0)+v
    for r in submitted:
        for y,v in r['calculated']['quote_fy'].items():qf[y]=qf.get(y,0)+v;weighted_fy[y]=weighted_fy.get(y,0)+float(D(v)*D(r['calculated']['conversion_weight']))
    gp_rows=[r for r in live if r['calculated']['status'] in [1,2,3,4,5,6,6.5,7] and r['calculated']['planned_gp'] is not None]
    out['summary']={'records':len(live),'counts':counts,'submitted_count':len(submitted),'submitted_value':sums(submitted,'quote_value'),'tender_value':sums([r for r in submitted if r['calculated']['status']!=6.5],'quote_value'),'budget_value':sums([r for r in submitted if r['calculated']['status']==6.5],'quote_value'),'weighted_value':float(sum(D(r['calculated']['weighted_quote']) for r in submitted)),'open_orders':sums(won,'order_value'),'remaining_work':cs('remaining_work'),'remaining_invoicing':cs('remaining_invoicing'),'unallocated_work':cs('unallocated_work'),'work_fy':wf,'quote_fy':qf,'weighted_fy':weighted_fy,'followups':sum(r['calculated']['status'] in [3,4,5,6] for r in live),'attention_records':sum(bool(r['calculated']['issues']) for r in live if r['calculated']['status']!=12),'known_gp':float(sum(D(r['calculated']['planned_gp']) for r in gp_rows)),'known_gp_count':len(gp_rows),'unknown_weight_count':sum(r['calculated']['conversion_weight'] is None for r in submitted)}
    return out

def suggest_reference(r,book,project=False):
    meta=book['meta'];codes=meta['codes'];company=str(r.get('company') or '');client=str(r.get('client') or '');site=str(r.get('site') or '');sc=next((x.get('code') for x in meta['sites'].get(client,[]) if x['name']==site),None)
    if r.get('quote_type')=='Variation':
        parent=str(r.get('parent_project') or '')
        if not parent:raise ValueError('Select the parent project for a variation.')
        prefix=parent if project else 'V_'+parent+'_';digits=1 if project else 2
        if project:
            letters=[str(x.get('project_no') or '')[len(parent):] for x in book['records'] if str(x.get('project_no') or '').startswith(parent)];return parent+str(r.get('sub_project') or chr(max([ord(x) for x in letters if len(x)==1 and x.isalpha()]+[ord('a')])+1))
    else:
        if not all([codes.get(company),codes.get(client),sc]):raise ValueError('Company, client or site has no code in the Excel lookup. Enter a reference manually.')
        prefix=str(codes[company])+str(codes[client])+str(sc)
        if not project:prefix={'Tender':'T_','Budget':'B_'}.get(r.get('quote_type'),'T_')+prefix
        digits=3
    key='project_no' if project else 'quote_no';nums=[]
    for x in book['records']:
        m=re.fullmatch(re.escape(prefix)+r'(\d+)',str(x.get(key) or ''))
        if m:nums.append(int(m[1]))
    return prefix+str(max(nums+[0])+1).zfill(digits)

def inspect_cell(path,cell):
    if not re.fullmatch('[A-Z]{1,3}[1-9][0-9]{0,5}',cell):raise ValueError('Enter an Excel cell reference, such as BT1634.')
    ns='{http://schemas.openxmlformats.org/spreadsheetml/2006/main}';found=None;masters={}
    with zipfile.ZipFile(path) as z:
        ss=[''.join(e.itertext()) for e in ET.fromstring(z.read('xl/sharedStrings.xml')).findall(ns+'si')]
        with z.open('xl/worksheets/sheet2.xml') as src:
            for _,e in ET.iterparse(src,events=['end']):
                if e.tag==ns+'c':
                    f=e.find(ns+'f');a=e.get('r');v=e.find(ns+'v');value=v.text if v is not None else None
                    if e.get('t')=='s' and value is not None:value=ss[int(value)]
                    if f is not None and f.get('t')=='shared' and f.text:masters[f.get('si')]=(a,f.text)
                    if a==cell:
                        formula=f.text if f is not None else None;attrs=f.attrib if f is not None else {}
                        if f is not None and not formula and f.get('si') in masters:
                            base,formula=masters[f.get('si')]
                            from workbook import translate_formula
                            formula=translate_formula(formula,base,a)
                        found={'cell':cell,'value':value,'formula':formula,'formula_attributes':attrs};break
                    e.clear()
    return found or {'cell':cell,'value':None,'formula':None,'formula_attributes':{}}
