"""Standalone XLSX exports using only Python's standard library."""
from xml.sax.saxutils import escape
import zipfile,io
from workbook import colname
from engine import calculate,CATEGORIES

def xlsx(project):
    p=calculate(project);s=p['settings'];t=p['calculated']
    sheets=[('Summary',[[s.get('company','CGI'),'COSTING SUMMARY'],['Quote',s.get('quote_no','')],['Client',s.get('client','')],['Project',s.get('description','')],['Revision',s.get('revision','00')],['All figures in ZAR; excluding VAT unless shown'],['Section','Cost','Selling','Gross profit']]+[[label,t['sections'][k]['cost'],t['sections'][k]['sell'],t['sections'][k]['sell']-t['sections'][k]['cost']] for k,label in CATEGORIES.items()]+[['TOTAL',t['cost'],t['sell'],t['profit']],['Gross margin %',t['margin']],['VAT %',s.get('vat',0)],['VAT',t['vat']],['Selling including VAT',t['including_vat']],['Options separately (ex VAT)',t['option_sell']],['Rounded foreign quotation',t['foreign'],s.get('currency')],['ZAR per foreign unit',s.get('conversion')],['Scope',s.get('scope','')],['Notes',s.get('notes','')]]),('Costing',[['Section','Group','Optional','Description','Part number','Supplier','Mode','Unit','Line qty','Group factor','Group qty','Total qty','List unit','Discount %','Markup','Nett unit','Selling unit','Total nett','Total sell','Profit','Foreign total','Source','Calculation']]),('Payments',[['Milestone','Percent','Amount (ZAR, ex VAT)']]+[[m['description'],m['percent'],m['amount']] for m in p['payments']]+[['TOTAL',t['payment_percent'],sum(m['amount'] for m in p['payments'])]]),('Markup',[['Preset','Component','Percent']]+[[m['name'],c['label'],c['value']] for m in s['markups'] for c in m['components']]),('Review',[['Review item']]+[[x] for x in p.get('import_warnings',[])]+[[x] for x in t['warnings']])]
    for g in p['groups']:
        for l in g['lines']:
            c=l['calculated'];sheets[1][1].append([CATEGORIES[g['category']],g['name'],'Yes' if g.get('option') else 'No',l['description'],l.get('part',''),l.get('supplier',''),l['mode'],l.get('unit','each'),l.get('qty',1),l.get('multiplier',1),g['qty'],c['qty'],l.get('list',0),l.get('discount',0),l.get('markup',''),c['unitnet'],c['unitsell'],c['cost'],c['sell'],c['profit'],c['foreign'],l.get('source',''),c['trace']])
    sheets.insert(0,('Profile - Inputs',[['Field','Value']]+[[k,v] for k,v in p['settings'].items() if k!='markups']))
    return make_xlsx(sheets)

def make_xlsx(sheets):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'+''.join(f'<Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' for i in range(1,len(sheets)+1))+'</Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>')
        z.writestr('xl/workbook.xml','<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>'+''.join(f'<sheet name="{name}" sheetId="{i}" r:id="rId{i}"/>' for i,(name,rows) in enumerate(sheets,1))+'</sheets></workbook>')
        z.writestr('xl/_rels/workbook.xml.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'+''.join(f'<Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>' for i in range(1,len(sheets)+1))+f'<Relationship Id="rId{len(sheets)+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>')
        z.writestr('xl/styles.xml','<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF153D42"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="3"><xf xfId="0"/><xf fontId="1" fillId="2" xfId="0"/><xf numFmtId="4" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>')
        for i,(name,rows) in enumerate(sheets,1):
            xml=['<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="1" width="30" customWidth="1"/><col min="2" max="24" width="24" customWidth="1"/></cols><sheetData>']
            for r,row in enumerate(rows,1):
                xml.append(f'<row r="{r}">')
                for c,v in enumerate(row,1):
                    a=colname(c)+str(r)
                    if isinstance(v,(float,int)):xml.append(f'<c r="{a}" s="{1 if r==1 else 2}"><v>{v}</v></c>')
                    else:xml.append(f'<c r="{a}" s="{1 if r==1 else 0}" t="inlineStr"><is><t xml:space="preserve">{escape(str(v or ""))}</t></is></c>')
                xml.append('</row>')
            xml.append('</sheetData></worksheet>');z.writestr(f'xl/worksheets/sheet{i}.xml',''.join(xml))
    return out.getvalue()
