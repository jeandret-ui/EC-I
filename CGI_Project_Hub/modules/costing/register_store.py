"""Atomic quote-register storage, versions and portable reports."""
import copy, datetime, json, re, uuid
from pathlib import Path
import register
class RegisterStore:
    def __init__(self,root,data,lock,atomic,load_costing):
        self.root,self.data,self.lock,self.atomic,self.load_costing=root,data,lock,atomic,load_costing
        self.path=data/'quote_register.json';self.backups=data/'register_backups';self.backups.mkdir(exist_ok=True)
        self.seed=json.loads((root/'reference/register_seed.json').read_text(encoding='utf-8'))
        if not self.path.exists():self.atomic(self.path,self.seed)
    def read(self):return json.loads(self.path.read_text(encoding='utf-8'))
    def view(self):return register.compute(self.read(),self.load_costing)
    def checked(self,expected):
        b=self.read()
        if expected is None or b['version']!=expected:raise ValueError('The register changed in another window. Reload it before saving; your draft remains open.')
        return b
    def write(self,b,old):
        stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S-%f');self.atomic(self.backups/(stamp+'.json'),old)
        for p in sorted(self.backups.glob('*.json'))[:-30]:p.unlink()
        b['version']=old['version']+1;b['updated']=datetime.datetime.now().isoformat(timespec='seconds');self.atomic(self.path,b)
        return register.compute(b,self.load_costing)
    def record(self,fields,expected):
        with self.lock:
            old=self.checked(expected);b=copy.deepcopy(old);i=fields.get('id');existing=next((r for r in b['records'] if r['id']==i),None)
            if i and not existing:raise ValueError('Quote record no longer exists.')
            if len(b['records'])>=10000 and not existing:raise ValueError('Maximum 10,000 register records.')
            r=copy.deepcopy(existing or {'id':uuid.uuid4().hex,'date_modes':{'start':'auto','duration':'auto','end':'auto'},'status_mode':'auto','budget_complete':False,'budgets':{}})
            allowed=set(json.loads((self.root/'reference/register_fields.json').read_text()))|{'status_mode','status_override','date_modes','budgets','budget_complete','archived','workspace_code'}
            for k,v in fields.items():
                if k in allowed:r[k]=v
            for k in register.NUMBERS:
                if r.get(k)=='':r[k]=None
            for k in ['start','duration','end']:
                if r.get('date_modes',{}).get(k) not in ['auto','manual']:raise ValueError('Choose automatic or manual dates.')
            if r.get('workspace_code') is not None:r['workspace_code']=str(r['workspace_code']).strip().upper()[:120]
            register.validate_record(r)
            if not r.get('quote_no'):r['quote_no']=register.suggest_reference(r,b)
            if r.get('quote_type')!='Variation' and r.get('quote_override'):r['quote_no']=r['quote_override']
            if r.get('project_override'):r['project_no']=r['project_override']
            if r.get('quote_no') and any(x['id']!=r['id'] and x.get('quote_no')==r['quote_no'] and not x.get('archived') and x.get('source',{}).get('status')!=12 for x in b['records']):raise ValueError('This quote reference is already in the register. Use a new reference or edit the existing record.')
            changes={k:{'before':existing.get(k),'after':r.get(k)} for k in allowed if existing and existing.get(k)!=r.get(k)}
            if changes:r['history']=(r.get('history',[])+[{'at':datetime.datetime.now().isoformat(timespec='seconds'),'changes':changes}])[-20:]
            if existing:b['records'][b['records'].index(existing)]=r
            else:b['records'].append(r)
            out=self.write(b,old);out['saved_id']=r['id'];return out
    def settings(self,d):
        with self.lock:
            old=self.checked(d.get('version'));b=copy.deepcopy(old)
            if not register.date(d.get('as_of')):raise ValueError('Choose a valid reporting date.')
            if d.get('weight_mode') not in ['with','without']:raise ValueError('Choose a conversion weighting mode.')
            b['as_of']=d['as_of'];b['weight_mode']=d['weight_mode'];return self.write(b,old)
    def link(self,record_id,project_id,expected):
        with self.lock:
            old=self.checked(expected);b=copy.deepcopy(old);r=next((r for r in b['records'] if r['id']==record_id),None)
            if not r:raise ValueError('Record not found.')
            if project_id:self.load_costing(project_id)
            r['history']=(r.get('history',[])+[{'at':datetime.datetime.now().isoformat(timespec='seconds'),'changes':{'costing_id':{'before':r.get('costing_id'),'after':project_id or None}}}])[-20:]
            r['costing_id']=project_id or None;return self.write(b,old)
    def sync(self,d):
        with self.lock:
            old=self.checked(d.get('version'));b=copy.deepcopy(old);r=next((r for r in b['records'] if r['id']==d.get('id')),None)
            if not r or not r.get('costing_id'):raise ValueError('Link a costing first.')
            p=self.load_costing(r['costing_id'])
            if not any(g['lines'] for g in p['groups'] if not g.get('option')):raise ValueError('The costing has no primary line items. Add costs before synchronizing.')
            if p['settings'].get('currency')!='ZAR':raise ValueError('Register figures are in ZAR. Set the linked quote currency to ZAR before synchronization.')
            before_values={'quote_value':r.get('quote_value'),'budgets':copy.deepcopy(r.get('budgets',{}))}
            r['quote_value']=p['calculated']['sell']
            allocation={}
            for g in p['groups']:
                if g.get('option'):continue
                key=d.get('mapping',{}).get(g['id'],{'materials':'equipment','labour':'engineering','pg':'pg'}[g['category']])
                if key not in register.BUDGETS:raise ValueError('Choose a department for every group.')
                allocation[key]=allocation.get(key,0)+g['calculated']['cost']
            for key,cost in allocation.items():r.setdefault('budgets',{}).setdefault(key,{})['planned']=cost
            for key in r.get('budgets',{}):
                if key not in allocation:r['budgets'][key]['planned']=None
            r['history']=(r.get('history',[])+[{'at':datetime.datetime.now().isoformat(timespec='seconds'),'changes':{k:{'before':v,'after':r.get(k)} for k,v in before_values.items()}}])[-20:]
            r['budget_complete']=True;r['costing_synced_at']=datetime.datetime.now().isoformat(timespec='seconds');return self.write(b,old)
    def restore(self,d):
        incoming=d.get('register')
        if not isinstance(incoming,dict) or incoming.get('schema')!='cgi-register-1':raise ValueError('Choose a quote register JSON backup.')
        if not isinstance(incoming.get('records'),list) or len(incoming['records'])>10000:raise ValueError('Invalid register record list.')
        if not register.date(incoming.get('as_of')) or incoming.get('weight_mode') not in ['with','without']:raise ValueError('Invalid reporting settings.')
        ids=set()
        for r in incoming['records']:
            # Preserve legacy malformed source records; still reject unsafe numeric updates.
            if not isinstance(r,dict) or not re.fullmatch(r'[A-Za-z0-9_-]{1,80}',str(r.get('id',''))) or r['id'] in ids:raise ValueError('Invalid or duplicate record ID.')
            ids.add(r['id'])
            register.validate_record(r,require_fields=False)
        with self.lock:
            old=self.checked(d.get('version'));b=copy.deepcopy(incoming);b['meta']=copy.deepcopy(self.seed['meta']);return self.write(b,old)
    def export_xlsx(self):
        from reports import make_xlsx
        d=self.view();fields=json.loads((self.root/'reference/register_fields.json').read_text());headers=[d['meta']['headers'].get(c,k) for k,c in fields.items()]
        computed=['status_label','remaining_work','remaining_engineering','remaining_invoicing','conversion_weight','weighted_quote','unallocated_work','planned_cost','planned_gp','margin','forecast_cost','forecast_gp']
        reg=[['Source row','Archived','Status mode']+headers+computed+['Budget scope complete','Issues','Associated project code']]
        budgets=[['Quote','Client','Department','Planned budget','Actual paid / incurred','Unpaid commitments','Additional cost to finish','Forecast total cost','Uncommitted budget','Variance']]
        months=[['Quote','Project','Client','Month','Remaining work allocation']]
        for r in d['records']:
            c=r['calculated'];reg.append([r.get('source_row'),'Yes' if r.get('archived') else 'No',r.get('status_mode')]+[r.get(k) for k in fields]+[c.get(k) for k in computed]+['Yes' if r.get('budget_complete') else 'No','; '.join(c['issues']),r.get('workspace_code')])
            for x in c['budgets']:
                if any(x.get(k) is not None for k in ['planned','actual','committed','remaining']):budgets.append([r.get('quote_no'),r.get('client'),x['label']]+[x.get(k) for k in ['planned','actual','committed','remaining','forecast','available','variance']])
            for x in c['monthly_work']:months.append([r.get('quote_no'),r.get('project_no'),r.get('client'),x['month'],x['value']])
        s=d['summary'];summary=[['CGI QUOTE REGISTER','Snapshot / scenario report'],['Reporting date',d['as_of']],['Excel saved date',d['source_date']],['Weighting mode',d['weight_mode']],['All currency values ZAR. Costs, GP and register values are treated as ex VAT.'],['Measure','Value']]+[[k,v] for k,v in s.items() if not isinstance(v,dict)]
        fyrows=[['Financial year (March–February)','Confirmed remaining work','Unweighted submitted quotes','Conversion weighted quotes']]+[[y,s['work_fy'].get(y,0),s['quote_fy'].get(y,0),s['weighted_fy'].get(y,0)] for y in sorted(set(s['work_fy'])|set(s['quote_fy']))]
        methods=[['Calculation','Definition'],['Remaining work','Order value × (1 − completed). Closed projects have no remaining value.'],['Remaining invoicing','Order value × (1 − invoiced). This is uninvoiced revenue, not cash received or accounts receivable.'],['Work forecast','Even monthly allocation from later of current month and start month through projected end month. Overdue / invalid schedules remain unallocated.'],['Quote forecast','Quotation value allocated by inclusive overlap days across March–February years.'],['Weighted quote','Value × conversion weight from workbook lookup; raw probability is not the conversion weight.'],['Planned GP','Quote value (or won PO value) minus complete planned costs; blank if costs incomplete.'],['Forecast cost','Actual incurred + outstanding commitments + additional uncommitted cost to finish. Avoid counting the same cost twice.'],['Forecast GP','Revenue minus complete forecast cost. Unknown costs remain blank.'],['Budget','Added dashboard fields; department costs do not exist in the supplied register.'],['Excel source','Preserved XLSM, including original formulas and VBA. Dashboard does not write back to XLSM.']]
        return make_xlsx([('Summary',summary),('Register',reg),('Department budgets',budgets),('Financial years',fyrows),('Monthly work',months),('Definitions',methods)])
