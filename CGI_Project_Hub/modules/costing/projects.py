"""Project navigation without changing the register's PO/status rules.

Costing documents sharing a project code appear in one project. A tender's
workspace_code is an association only; project_no still means the awarded PO
reference in the source register.
"""
def code(value):
    return str(value or '').strip().upper()

def project_index(documents, records):
    groups = {}
    docs = {p['id']: p for p in documents}
    def ensure(key, reference='', name='', client=''):
        if key not in groups:
            groups[key] = {'key':key, 'code':reference, 'name':name or reference,
                           'client':client or '', 'documents':[], 'record_ids':[],
                           'active':False}
        return groups[key]
    for p in documents:
        s = p['settings']; reference = code(s.get('project_no'))
        g = ensure('code:'+reference if reference else 'doc:'+p['id'], reference,
                   s.get('project_name') or s.get('description') or p.get('name'), s.get('client'))
        g['documents'].append({'id':p['id'], 'name':p.get('name') or s.get('description'),
                               'quote':s.get('quote_no'), 'revision':s.get('revision'),
                               'updated':p.get('updated')})
        g['active'] = True
    for r in records:
        reference = code(r.get('workspace_code') or r.get('parent_project') or r.get('project_no'))
        linked = docs.get(r.get('costing_id'))
        if linked:
            reference = code(linked['settings'].get('project_no')) or reference
        key = 'code:'+reference if reference else ('doc:'+linked['id'] if linked else None)
        if not key:continue
        g = ensure(key, reference, r.get('description'), r.get('client') or r.get('legacy_client'))
        g['record_ids'].append(r['id'])
        if not r.get('archived') and not r.get('completed_date') and r.get('bc_status') != 'Closed':
            g['active'] = True
    return sorted(groups.values(), key=lambda g:(not bool(g['documents']), not g['active'], g['code'], g['name'] or ''))
