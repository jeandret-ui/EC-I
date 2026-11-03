"""Costing rules traced to the September 2026 CGI Excel template."""
from decimal import Decimal, ROUND_UP
from copy import deepcopy
import math
D=lambda n:Decimal(str(n or 0))
CATEGORIES={'materials':'Materials & equipment','pg':'P&Gs','labour':'Services & labour'}
def roundup(v,digits=0):
    return D(v).quantize(Decimal(10)**-digits,rounding=ROUND_UP)

def validate(p):
    if not isinstance(p,dict) or p.get('schema')!=1:raise ValueError('Use a dashboard project JSON with schema 1.')
    s=p.get('settings',{});groups=p.get('groups',[])
    if not isinstance(groups,list) or len(groups)>500:raise ValueError('Maximum 500 groups.')
    def check(n,lo=0,hi=1e12):
        try:v=float(n)
        except (ValueError,TypeError):raise ValueError('Enter a valid number.')
        if not math.isfinite(v) or not lo<=v<=hi:raise ValueError(f'Number must be between {lo:g} and {hi:g}.')
    check(s.get('conversion',15),0.000001);check(s.get('vat',0),0,100)
    ids=set()
    for g in groups:
        if g.get('category') not in CATEGORIES:raise ValueError('Unknown costing section.')
        if g.get('id') in ids:raise ValueError('Duplicate group ID.')
        ids.add(g.get('id'));check(g.get('qty',1));lineids=set()
        if len(g.get('lines',[]))>5000:raise ValueError('Maximum 5000 lines per group.')
        for l in g.get('lines',[]):
            if l.get('id') in lineids:raise ValueError('Duplicate line ID.')
            lineids.add(l.get('id'))
            if l.get('mode') not in ['markup','fixed','percent']:raise ValueError('Unknown pricing method.')
            for k in ['qty','multiplier','list','net','sell','percent','lead_days']:check(l.get(k,0))
            check(l.get('discount',0),0,100)
    for m in s.get('markups',[]):
        for c in m.get('components',[]):check(c.get('value',0),0,1000)
    if len(p.get('payments',[]))>12:raise ValueError('Maximum 12 payment milestones.')
    for m in p.get('payments',[]):check(m.get('percent',0),0,100)

def calculate(project):
    validate(project);p=deepcopy(project);s=p['settings'];rates={m['name']:sum(D(c['value']) for c in m['components'])/100 for m in s['markups']};rates.update({'None':Decimal(0),'-':Decimal(0)});fx=D(s.get('conversion',15))
    totals={k:{'cost':Decimal(0),'sell':Decimal(0),'foreign':Decimal(0)} for k in CATEGORIES};options=deepcopy(totals);warnings=[]
    for g in p['groups']:
        gc=gs=gf=Decimal(0);base=Decimal(0);gqty=D(g.get('qty',1))
        for l in g['lines']:
            qty=D(l.get('qty',1))*D(l.get('multiplier',1))*gqty;mu=rates.get(l.get('markup'),Decimal(0));disc=D(l.get('discount',0))/100
            if l['mode']=='percent':
                # COSTING!AU101, AX101, BA101, BC101, BD101 and BF101.
                net=roundup(base*D(l.get('percent',10))/100);cost=roundup(net*(1-disc));sell=roundup(cost*(1+mu)/gqty)*gqty if gqty else Decimal(0)
                unitnet=cost/gqty if gqty else Decimal(0);unitsell=sell/gqty if gqty else Decimal(0);qty=gqty
                foreign=roundup(sell/fx/gqty)*gqty if gqty else Decimal(0)
                trace=f'Consumables base {base} × {l.get("percent",10)}% → ROUNDUP = {net}; group-rounded selling {sell}.'
            else:
                unitnet=D(l.get('net',0)) if l['mode']=='fixed' else roundup(D(l.get('list',0))*(1-disc))
                unitsell=D(l.get('sell',0)) if l['mode']=='fixed' else roundup(unitnet*(1+mu));cost=unitnet*qty;sell=unitsell*qty;foreign=roundup(unitsell/fx,1)*qty
                base+=cost
                trace=f'Quantity = {l.get("qty",1)} × {l.get("multiplier",1)} × {g.get("qty",1)} = {qty}. '
                trace+=f'Fixed nett {unitnet}, sell {unitsell}.' if l['mode']=='fixed' else f'ROUNDUP({l.get("list",0)} × (1 − {disc})) = {unitnet}; ROUNDUP({unitnet} × (1 + {mu})) = {unitsell}.'
            l['calculated']={k:float(v) for k,v in {'qty':qty,'unitnet':unitnet,'unitsell':unitsell,'cost':cost,'sell':sell,'foreign':foreign,'profit':sell-cost}.items()};l['calculated']['trace']=trace
            if sell<cost and qty: warnings.append(f'{g["name"]}: {l["description"]} sells below cost.')
            if l['mode']=='markup' and l.get('markup') not in rates:warnings.append(f'{l["description"]}: markup selection is missing; using 0%.')
            if 'testing' in l.get('description','').lower() or (l.get('source') and 0<D(l.get('list'))<100 and l['mode']=='markup'):warnings.append(f'{l["description"]}: check this source price before issuing a quotation.')
            gc+=cost;gs+=sell;gf+=foreign
        g['calculated']={'cost':float(gc),'sell':float(gs),'foreign':float(gf),'profit':float(gs-gc),'margin':float((gs-gc)/gs*100) if gs else 0}
        t=(options if g.get('option') else totals)[g['category']];t['cost']+=gc;t['sell']+=gs;t['foreign']+=gf
    cost=sum(t['cost'] for t in totals.values());sell=sum(t['sell'] for t in totals.values());foreign=sum(t['foreign'] for t in totals.values());vat=sell*D(s.get('vat',0))/100
    p['calculated']={'cost':float(cost),'sell':float(sell),'profit':float(sell-cost),'margin':float((sell-cost)/sell*100) if sell else 0,'foreign':float(foreign),'vat':float(vat),'including_vat':float(sell+vat),'option_sell':float(sum(t['sell'] for t in options.values())),'sections':{k:{kk:float(vv) for kk,vv in t.items()} for k,t in totals.items()},'option_sections':{k:{kk:float(vv) for kk,vv in t.items()} for k,t in options.items()}}
    pp=sum(D(m['percent']) for m in p.get('payments',[]))
    if abs(pp-100)>D('0.00001'):warnings.append(f'Payment milestones total {format(pp.normalize(), "f")}% (expected 100%).')
    for m in p.get('payments',[]):m['amount']=float(sell*D(m['percent'])/100)
    p['calculated']['payment_percent']=float(pp);p['calculated']['warnings']=warnings
    return p
