"""Generate the merged entities.json: Hub V11 registers + PM additions (meetings minutes, RACI, FAT/SAT, procurement ...)."""
import json, sys
from pathlib import Path
src, out = Path(sys.argv[1]), Path(sys.argv[2])
E = json.loads(src.read_text(encoding='utf-8'))

def F(k, t, label, **kw): return {'k': k, 't': t, 'label': label, **kw}
def sel(k, label, options, default=None, **kw):
    d = F(k, 'select', label, options=options, **kw)
    if default is not None: d['default'] = default
    return d
def ent(label, singular, section, title, fields, lst, closed=None, due=None, ai=(), sort=None, **kw):
    return {'label': label, 'singular': singular, 'section': section, 'title': title, 'fields': fields, 'list': lst,
            'closed': closed or {}, 'due': due, 'ai': list(ai), 'sort': sort, **kw}
def add_fields(key, fields, after=None):
    fs = E[key]['fields']; have = {f['k'] for f in fs}
    new = [f for f in fields if f['k'] not in have]
    if after:
        i = next(i for i, f in enumerate(fs) if f['k'] == after) + 1
        fs[i:i] = new
    else: fs.extend(new)
def patch(key, k, **kw):
    for f in E[key]['fields']:
        if f['k'] == k: f.update(kw)

WORKSTREAMS = ['Project management', 'Engineering & design', 'Procurement', 'Panel manufacture', 'FAT', 'Logistics', 'Site works', 'Installation',
               'Commissioning', 'SAT', 'Handover & close-out', 'Commercial']
E['_meta'] = {'workstreams': WORKSTREAMS}

# ---------------- tasks: workstream lanes, status board, owner
add_fields('tasks', [sel('workstream', 'Workstream', WORKSTREAMS), sel('status', 'Status', ['Not started', 'In progress', 'On hold', 'Blocked', 'Complete'], 'Not started'),
                     sel('priority', 'Priority', ['Low', 'Normal', 'High', 'Critical'], 'Normal'), F('location', 'text', 'Location / site')], after='title')
patch('tasks', 'predecessors', label='Predecessors (WBS, e.g. 2.1, 3.3+5)')
E['tasks']['list'] = ['wbs', 'title', 'workstream', 'owner', 'forecast_start', 'forecast_finish', 'progress', 'status']
E['tasks']['closed'] = {'status': ['Complete'], 'progress': [100]}

# ---------------- actions = to-dos linked to tasks and meetings
add_fields('actions', [sel('category', 'Type', ['Action', 'To-do', 'Follow-up', 'Reminder'], 'Action'), F('task_id', 'ref', 'Related task', ref='tasks'),
                       F('meeting_id', 'ref', 'From meeting', ref='meetings'), sel('workstream', 'Workstream', WORKSTREAMS), F('reminder_date', 'date', 'Remind me on'),
                       F('completed_date', 'date', 'Completed')], after='status')
E['actions']['label'] = 'Actions & to-dos'
E['actions']['list'] = ['title', 'category', 'owner', 'due_date', 'priority', 'status']

# ---------------- meetings with minutes
add_fields('meetings', [sel('meeting_type', 'Type', ['Kick-off', 'Progress', 'Technical', 'Design review', 'Site', 'FAT', 'SAT', 'Commercial', 'Internal', 'Close-out'], 'Progress'),
                        F('start_time', 'text', 'Start time (HH:MM)'), F('duration_min', 'number', 'Duration (min)', default=60), F('location', 'text', 'Location / link'),
                        F('chair', 'text', 'Chair'), F('apologies', 'text', 'Apologies'), F('agenda', 'longtext', 'Agenda'),
                        sel('status', 'Status', ['Planned', 'Held', 'Minutes issued', 'Cancelled'], 'Planned'), F('next_meeting', 'date', 'Next meeting')], after='meeting_date')
patch('meetings', 'notes', label='General notes')
E['meetings']['list'] = ['meeting_date', 'start_time', 'title', 'meeting_type', 'status']
E['meetings']['due'] = 'meeting_date'
E['meeting_items'] = ent('Meeting minutes items', 'Minutes item', 'project', 'topic', [
    F('meeting_id', 'ref', 'Meeting', ref='meetings', req=True), F('seq', 'number', 'Item no.'),
    sel('item_type', 'Type', ['Discussion', 'Decision', 'Action', 'Information', 'Risk'], 'Discussion'),
    F('topic', 'text', 'Topic', req=True), F('details', 'longtext', 'Discussion / detail'), F('owner', 'text', 'Owner'), F('due_date', 'date', 'Due'),
    sel('status', 'Status', ['Open', 'Done', 'Carried forward', 'Noted'], 'Open'), F('action_id', 'ref', 'Linked action', ref='actions')],
    ['seq', 'item_type', 'topic', 'owner', 'due_date', 'status'], closed={'status': ['Done', 'Noted']}, due='due_date', ai=['create'], sort='seq')

# ---------------- stakeholders & RACI
PARTIES = ['Client', 'Client engineer', 'Contractor', 'Sub-contractor', 'Supplier', 'Consultant', 'Internal (CGI)', 'Authority', 'End user']
E['stakeholders'] = ent('Stakeholders & contacts', 'Stakeholder', 'people', 'name', [
    F('name', 'text', 'Name', req=True), F('organisation', 'text', 'Organisation'), sel('party', 'Party', PARTIES, 'Client'), F('role', 'text', 'Role / title'),
    F('email', 'text', 'Email'), F('phone', 'text', 'Phone'), sel('influence', 'Influence', ['High', 'Medium', 'Low'], 'Medium'),
    sel('interest', 'Interest', ['High', 'Medium', 'Low'], 'Medium'), sel('engagement', 'Engagement', ['Unaware', 'Resistant', 'Neutral', 'Supportive', 'Leading'], 'Neutral'),
    F('communication', 'text', 'Communication (how / how often)'), F('notes', 'longtext', 'Notes')],
    ['name', 'organisation', 'party', 'role', 'email', 'phone'], sort='name')
E['raci'] = ent('RACI matrix', 'RACI activity', 'people', 'activity', [
    F('activity', 'text', 'Activity / deliverable', req=True), sel('workstream', 'Workstream', WORKSTREAMS), F('task_id', 'ref', 'Related task', ref='tasks'),
    F('seq', 'number', 'Order'), F('assignments', 'json', 'Assignments'), F('notes', 'longtext', 'Notes')],
    ['activity', 'workstream'], sort='seq')

# ---------------- procurement tracker
PROC = ['Not started', 'Specifying', 'RFQ sent', 'Quoted', 'Ordered', 'Expediting', 'In transit', 'Delivered', 'Inspected', 'Issued to site', 'Installed', 'Cancelled']
E['procurement'] = ent('Procurement tracker', 'Procurement item', 'procurement', 'item', [
    F('item', 'text', 'Item', req=True), F('description', 'longtext', 'Specification / description'), sel('category', 'Category',
      ['Radios & comms', 'Antennas & masts', 'Panels & enclosures', 'Power & UPS', 'PLC & SCADA', 'Instrumentation', 'Cables & accessories', 'Services', 'Other'], 'Other'),
    F('supplier_id', 'ref', 'Supplier', ref='suppliers'), F('quantity', 'number', 'Qty'), F('unit', 'text', 'Unit'), F('required_by', 'date', 'Required on site by'),
    F('quote_ref', 'text', 'Supplier quote'), F('po_ref', 'text', 'Our PO number'), F('order_date', 'date', 'Ordered'), F('lead_time_weeks', 'number', 'Lead time (weeks)'),
    F('expected_delivery', 'date', 'Expected delivery'), F('actual_delivery', 'date', 'Delivered'), F('location', 'text', 'Current location'),
    sel('inspection', 'Inspection', ['Not inspected', 'Passed', 'Partial', 'Failed'], 'Not inspected'), sel('status', 'Status', PROC, 'Not started'),
    F('cost', 'money', 'Cost (excl. VAT)'), F('cost_code', 'text', 'Cost code'), F('notes', 'longtext', 'Notes')],
    ['item', 'category', 'supplier_id', 'required_by', 'expected_delivery', 'status'], closed={'status': ['Installed', 'Issued to site', 'Inspected', 'Cancelled']},
    due='expected_delivery', ai=['create', 'update'])

# ---------------- FAT / SAT and punch list
E['tests'] = ent('FAT / SAT tests', 'Test', 'quality', 'title', [
    F('ref', 'text', 'Ref'), sel('test_type', 'Test', ['FAT', 'SAT', 'SIT', 'Pre-commissioning', 'Commissioning', 'Performance test'], 'FAT'), F('title', 'text', 'Title', req=True),
    F('procedure', 'text', 'Procedure / ITP document'), F('location', 'text', 'Location'), F('planned_date', 'date', 'Planned'), F('witness', 'text', 'Witnesses (client / engineer)'),
    F('criteria', 'longtext', 'Acceptance criteria'), sel('result', 'Result', ['Not run', 'Pass', 'Pass with comments', 'Fail', 'Retest required'], 'Not run'),
    F('executed_date', 'date', 'Executed'), F('signed_off_by', 'text', 'Signed off by'), F('signoff_date', 'date', 'Sign-off date'), F('evidence', 'text', 'Evidence / report ref'),
    F('task_id', 'ref', 'Schedule task', ref='tasks'), F('notes', 'longtext', 'Notes')],
    ['ref', 'test_type', 'title', 'planned_date', 'result', 'signoff_date'], closed={'result': ['Pass', 'Pass with comments']}, due='planned_date', ai=['create', 'update'], sort='ref')
E['punch_items'] = ent('Punch list', 'Punch item', 'quality', 'description', [
    F('ref', 'text', 'Ref'), F('test_id', 'ref', 'Test', ref='tests'), F('description', 'text', 'Description', req=True),
    sel('category', 'Category', ['A – before acceptance', 'B – before handover', 'C – minor'], 'B – before handover'), F('location', 'text', 'Location'), F('owner', 'text', 'Owner'),
    F('due_date', 'date', 'Due'), sel('status', 'Status', ['Open', 'In progress', 'Ready to verify', 'Closed'], 'Open'), F('closed_date', 'date', 'Closed'), F('notes', 'longtext', 'Notes')],
    ['ref', 'description', 'category', 'owner', 'due_date', 'status'], closed={'status': ['Closed']}, due='due_date', ai=['create', 'update'], sort='ref')

# ---------------- change control (PMP) on the existing variations register
E['variations']['label'] = 'Change requests & variations'; E['variations']['singular'] = 'Change request'
add_fields('variations', [sel('change_type', 'Type', ['Client change', 'Internal change', 'Variation order', 'Scope clarification'], 'Client change'),
                          F('requested_by', 'text', 'Requested by'), F('request_date', 'date', 'Requested'), F('impact_scope', 'longtext', 'Scope / quality impact'),
                          F('decision_by', 'text', 'Decision by')], after='origin')
E['variations']['due'] = None

# ---------------- risks: PMP response
add_fields('risks', [sel('category', 'Category', ['Technical', 'Schedule', 'Commercial', 'Site / HSE', 'Supply chain', 'Client', 'Regulatory'], 'Technical'),
                     sel('response', 'Response', ['Avoid', 'Mitigate', 'Transfer', 'Accept', 'Exploit'], 'Mitigate'), F('contingency', 'longtext', 'Contingency plan')], after='cause')
E['risks']['list'] = ['title', 'category', 'owner', 'probability', 'impact', 'status']
add_fields('decisions', [F('meeting_id', 'ref', 'From meeting', ref='meetings')])
add_fields('issues', [F('raised_date', 'date', 'Raised'), F('raised_by', 'text', 'Raised by'), sel('category', 'Category', ['Technical', 'Site', 'Commercial', 'Client', 'Supplier', 'HSE'], 'Technical')], after='title')

# ---------------- lessons learned & reminders
E['lessons'] = ent('Lessons learned', 'Lesson', 'project', 'title', [
    F('title', 'text', 'Lesson', req=True), sel('phase', 'Phase', WORKSTREAMS), sel('kind', 'Kind', ['Went well', 'Improve', 'Risk to watch'], 'Improve'),
    F('what_happened', 'longtext', 'What happened'), F('recommendation', 'longtext', 'Recommendation'), F('owner', 'text', 'Raised by'), F('lesson_date', 'date', 'Date')],
    ['lesson_date', 'title', 'phase', 'kind'], sort='-lesson_date')
E['reminders'] = ent('Reminders', 'Reminder', 'project', 'title', [
    F('title', 'text', 'Reminder', req=True), F('remind_date', 'date', 'Date', req=True), F('remind_time', 'text', 'Time (HH:MM)'), F('notes', 'longtext', 'Notes'),
    F('done', 'bool', 'Done')], ['remind_date', 'remind_time', 'title', 'done'], closed={'done': [1]}, due='remind_date', ai=['create'], sort='remind_date')

# ---------------- v12.1 (TMM-inspired): look-ahead readiness on tasks, team availability, weekly status
add_fields('tasks', [F('needs', 'json', 'Ready to start'), F('commit', 'json', 'Committed weeks'),
                     sel('miss_reason', 'Why not done as planned', ['', 'Materials / equipment late', 'Drawings / information', 'Access / permits', 'People not available',
                                                                   'Tools', 'Work before it late', 'Client / site not ready', 'Weather', 'Rework', 'Other'])])
add_fields('stakeholders', [sel('team', 'Team', ['Project management', 'Engineering', 'Workshop', 'Site / installation', 'Commissioning', 'Client', 'Contractor', 'Supplier']),
                            sel('clearance', 'Site clearance', ['Cleared to work', 'Supervise only', 'Papers pending', 'Not needed'], 'Not needed'),
                            F('availability', 'json', 'Availability'), F('papers', 'json', 'Papers')], after='role')
E['status_updates'] = ent('Status updates', 'Status update', 'project', 'week', [
    F('week', 'text', 'Week', req=True), sel('rag', 'Status', ['On track', 'At risk', 'Off track'], 'On track'), F('done', 'longtext', 'What happened'),
    F('next', 'longtext', 'What is next'), F('help', 'longtext', 'Help needed'), F('by', 'text', 'Posted by'), F('posted', 'date', 'Posted')],
    ['week', 'rag', 'posted', 'by'], sort='-week')

# sections: regroup for the new navigation
for k in ('clients', 'suppliers'): E[k]['section'] = 'people' if k == 'clients' else 'procurement'
out.write_text(json.dumps(E, indent=1, ensure_ascii=False), encoding='utf-8')
print(len([k for k in E if not k.startswith('_')]), 'registers written to', out)
