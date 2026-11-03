/* Project views: overview, charter, schedule, board, actions & to-dos, RAID, technical, site diary. */
'use strict';
const P_ = () => ST.PH.project;

/* ---------------- overview ---------------- */
route('overview', { title: 'Overview', icon: 'home', group: 'Project', project: true, render: v => {
  const p = P_(), R = ST.PH.rec, H = health(R, p), C = H.C, t = isoToday(), al = alerts();
  const cpm = H.cpm, doneProc = R.procurement.filter(x => ['Delivered', 'Inspected', 'Issued to site', 'Installed'].includes(x.status)).length;
  const testsPass = R.tests.filter(x => ['Pass', 'Pass with comments'].includes(x.result)).length;
  const daysLeft = p.target_finish ? workdays(t, p.target_finish) : null;
  v.append(h('div', { class: 'hero', style: `background:linear-gradient(120deg,var(--navy) 0%,${projColor(p)} 75%,#1f78c4 100%)` },
    h('div', { class: 'eyebrow' }, `${p.code} · ${p.status || ''}${p.phase ? ' · ' + p.phase : ''}`), h('h1', {}, p.name), h('p', {}, p.description || ''),
    h('div', { class: 'meta' }, [['Client', p.client_name], ['Site', p.site], ['Project manager', p.project_manager], ['Client PO', p.po_number], ['Quote', p.quote_ref], ['Start', p.start_date && fdate(p.start_date)], ['Target finish', p.target_finish && fdate(p.target_finish)]]
      .filter(x => x[1]).map(([a, b]) => h('div', {}, a, h('b', {}, b)))),
    h('div', { class: 'acts' }, ragOf(H.label), h('button', { class: 'btn sm', onclick: () => go('charter') }, 'Edit profile & charter'), h('button', { class: 'btn sm', onclick: run(() => API.post(API.P(ST.code, '/open'))) , title: 'Open the project folder in Explorer' }, icon('folder'), 'Folder'))));
  v.append(h('div', { class: 'kpis' },
    kpi('Progress', pct(cpm.progress), `${cpm.rows.filter(r => !r.summary && r.progress >= 100).length}/${cpm.rows.filter(r => !r.summary).length} tasks complete`, '', () => go('schedule')),
    kpi('Forecast finish', cpm.finish ? sdate(cpm.finish) : '—', p.target_finish ? (H.overTarget ? `after target ${sdate(p.target_finish)}` : `target ${sdate(p.target_finish)} · ${daysLeft} work days left`) : 'set a target finish', H.overTarget ? 'bad' : cpm.finish ? 'good' : '', () => go('schedule')),
    kpi('Open actions', String(H.openActions), H.overdue ? `${H.overdue} overdue` : 'none overdue', H.overdue ? 'bad' : 'good', () => go('actions')),
    kpi('Procurement', `${doneProc}/${R.procurement.length}`, H.procLate.length ? `${H.procLate.length} delivery late` : 'items delivered', H.procLate.length ? 'warn' : '', () => go('procurement')),
    kpi('FAT / SAT', `${testsPass}/${R.tests.length}`, `${R.punch_items.filter(x => x.status !== 'Closed').length} open punch items`, H.punchA.length ? 'warn' : '', () => go('quality')),
    kpi('Contract value', kmoney(C.contract), C.hasCost ? `forecast margin ${pct(C.marginPct, 1)}` : `${R.client_pos.length} client PO`, C.hasCost && C.margin < 0 ? 'bad' : '', () => go('commercials'))));
  const look = [...eventsFor(R, p, ST.code)].filter(e => e.date >= t && e.date <= addDays(t, 14)).sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const ws = {}; for (const r of cpm.rows.filter(r => !r.summary)) { const w = r.t.workstream || 'Unassigned'; ws[w] = ws[w] || { n: 0, w: 0, p: 0 }; const wt = Math.max(1, r.dur || 1); ws[w].n++; ws[w].w += wt; ws[w].p += wt * r.progress; }
  v.append(h('div', { class: 'grid g21' },
    h('div', { class: 'grid', style: 'align-content:start' },
      h('div', { class: 'card' }, h('div', { class: 'ch' }, icon('gantt'), 'Schedule', h('button', { class: 'btn sm right', onclick: () => go('schedule') }, 'Open schedule')), gantt(cpm, { zoom: 'week', height: '360px', until: p.target_finish, links: false })),
      h('div', { class: 'grid g2' },
        h('div', { class: 'card' }, h('h3', {}, icon('board'), 'Workstreams'), Object.entries(ws).sort((a, b) => (ST.cfg.meta.workstreams.indexOf(a[0]) - ST.cfg.meta.workstreams.indexOf(b[0]))).map(([w, s]) => h('div', { class: 'wsrow' },
          h('span', {}, h('i', { style: `display:inline-block;width:9px;height:9px;border-radius:2px;background:${wsColor(w)};margin-right:6px` }), w), h('div', { class: 'bar' }, h('i', { style: `width:${s.p / s.w}%;background:${wsColor(w)}` })), h('span', { class: 'num tiny' }, pct(s.p / s.w))))),
        h('div', { class: 'card' }, h('h3', {}, icon('people'), 'Team & stakeholders', h('button', { class: 'btn sm right', onclick: () => go('people') }, 'Open')),
          R.stakeholders.length ? h('div', { class: 'agenda' }, R.stakeholders.slice(0, 7).map(s => h('div', { class: 'ai', onclick: () => openForm('stakeholders', s) }, h('div', { class: 'tt' }, h('b', {}, s.name), h('div', { class: 'tiny muted' }, [s.role, s.organisation].filter(Boolean).join(' · '))), chip(s.party, 'blue')))) : empty('No stakeholders yet', 'Add the client, contractors and your team.')))),
    h('div', { class: 'grid', style: 'align-content:start' },
      (() => { const st = sortRows('status_updates', R.status_updates || [], '-week')[0], c = { 'On track': 'g', 'At risk': 'a', 'Off track': 'r' };
        return st ? h('article', { class: 'wk-u ' + (c[st.rag] || ''), style: 'cursor:pointer;margin:0', onclick: () => { WK.view = 'status'; go('week'); } }, h('header', {}, h('span', { class: 'wk-ub' }, st.rag), h('b', {}, 'Status ' + st.week), h('small', {}, st.by || '')), st.done ? h('p', {}, st.done.slice(0, 260)) : null, st.help ? h('p', { class: 'hp' }, h('b', {}, 'Help: '), st.help) : null)
          : h('div', { class: 'clear', style: 'cursor:pointer', onclick: () => { WK.view = 'status'; go('week'); } }, h('span', { class: 'ck', style: 'background:var(--sky-100);color:var(--blue)' }, '✦'), h('div', {}, h('b', {}, 'Post this week’s status'), h('small', {}, 'On track / At risk / Off track — drafted from the project in one click.'))); })(),
      h('div', { class: 'card' }, h('h3', {}, icon('cal'), 'Next 14 days'), look.length ? agendaList(look.slice(0, 12).map(e => ({ ...e, due: e.date, kind: { ms: 'Milestone', task: 'Task', meet: 'Meeting', act: 'Due', od: 'Overdue', proc: 'Delivery', test: 'Test', pay: 'Payment', rem: 'Reminder' }[e.type] })), true) : h('p', { class: 'note' }, 'Nothing scheduled in the next two weeks.')),
      h('div', { class: 'card' }, h('h3', {}, icon('risk'), `Needs attention (${al.length})`), alertList(al, 10)),
      h('div', { class: 'card' }, h('h3', {}, icon('log'), 'Recent changes', h('button', { class: 'btn sm right', onclick: () => go('activity') }, 'All')), recentChanges()))));
} });
function recentChanges() {
  const box = h('div', { class: 'small' }, h('span', { class: 'note' }, 'Loading…'));
  API.get(API.P(ST.code, '/audit?limit=8')).then(a => { box.innerHTML = ''; if (!a.length) box.append(h('span', { class: 'note' }, 'No changes yet.'));
    a.forEach(x => box.append(h('div', { style: 'padding:5px 0;border-bottom:1px solid var(--line-2)' }, h('b', {}, `${x.action} `), `${ent(x.entity)?.singular?.toLowerCase() || x.entity}${x.after && (x.after.title || x.after.name || x.after.item || x.after.topic) ? ': ' + (x.after.title || x.after.name || x.after.item || x.after.topic) : x.id ? ' #' + x.id : ''}`,
      h('div', { class: 'tiny muted' }, `${String(x.at).slice(0, 16).replace('T', ' ')} · ${x.actor}`)))); }).catch(() => { });
  return box;
}

/* ---------------- charter (PMP) ---------------- */
route('charter', { title: 'Profile & charter', icon: 'charter', group: 'Project', project: true, render: v => {
  const p = P_(), ch = p.charter || {}, R = ST.PH.rec;
  const save = run(async (k, val, inCharter) => { await DB.patchProject(inCharter ? { charter: { [k]: val } } : { [k]: val }); toast('Saved'); renderSide(); });
  const fld = (label, k, type = 'text', inCharter = false, opts) => { const val = inCharter ? ch[k] : p[k];
    let el; if (type === 'textarea') el = h('textarea', { rows: 3 }, val ?? ''); else if (type === 'select') el = h('select', {}, opts.map(o => h('option', { selected: o === val }, o))); else el = h('input', { type, value: val ?? '' });
    el.addEventListener('change', () => save(k, type === 'number' ? (el.value === '' ? null : +el.value) : el.value, inCharter)); return h('label', { class: type === 'textarea' ? 'full' : '' }, label, el); };
  const ms = scheduleCPM().rows.filter(r => +r.t.is_milestone);
  v.append(pageHead('Project management plan', 'Profile & charter', 'The project profile and PMP-style charter. Changes save as you leave each field.',
    h('button', { class: 'btn', onclick: () => printCharter() }, icon('print'), 'Print charter')));
  v.append(h('div', { class: 'grid g2 charter' },
    h('div', { class: 'card' }, h('h3', {}, 'Project profile'), h('div', { class: 'form' }, fld('Project name', 'name'), fld('Status', 'status', 'select', false, ST.cfg.statuses), fld('Client', 'client_name'), fld('Site / location', 'site'),
      fld('Project manager', 'project_manager'), fld('Phase', 'phase', 'select', false, ['', ...ST.cfg.meta.workstreams]), fld('Start date', 'start_date', 'date'), fld('Target finish', 'target_finish', 'date'),
      fld('Client PO number', 'po_number'), fld('Quote reference', 'quote_ref'), fld('Colour', 'colour', 'color'), fld('Register project code', 'register_code'), fld('Description', 'description', 'textarea'))),
    h('div', { class: 'card' }, h('h3', {}, 'Charter'), h('div', { class: 'form' }, fld('Sponsor', 'sponsor', 'text', true), fld('Budget (ZAR excl. VAT)', 'budget', 'number', true),
      fld('Objectives', 'objectives', 'textarea', true), fld('Scope (in)', 'scope', 'textarea', true), fld('Out of scope / exclusions', 'out_of_scope', 'textarea', true),
      fld('Assumptions', 'assumptions', 'textarea', true), fld('Constraints', 'constraints', 'textarea', true), fld('Success / acceptance criteria', 'success_criteria', 'textarea', true),
      fld('Approval (name, date)', 'approval', 'text', true), fld('Client contact', 'client_contact', 'text', true)))));
  v.append(h('div', { class: 'grid g3', style: 'margin-top:16px' },
    h('div', { class: 'card' }, h('h3', {}, 'Key milestones (from schedule)'), ms.length ? h('div', { class: 'agenda' }, ms.map(r => h('div', { class: 'ai', onclick: () => openTask(r.t) }, h('div', { class: 'tt' }, h('b', {}, r.t.title), h('div', { class: 'tiny muted' }, r.ef ? ddate(r.ef) : 'not dated')), r.progress >= 100 ? chip('Done', 'green') : null))) : h('p', { class: 'note' }, 'Tick “milestone” on schedule tasks.')),
    h('div', { class: 'card' }, h('h3', {}, 'Top risks'), R.risks.filter(r => !isClosed('risks', r)).sort((a, b) => b.probability * b.impact - a.probability * a.impact).slice(0, 6).map(r => h('div', { class: 'todo', onclick: () => openForm('risks', r) }, chip(String((r.probability || 0) * (r.impact || 0)), (r.probability || 0) * (r.impact || 0) >= 15 ? 'red' : 'amber'), h('span', {}, r.title))), R.risks.length ? null : h('p', { class: 'note' }, 'No risks logged.')),
    h('div', { class: 'card' }, h('h3', {}, 'Stakeholders'), R.stakeholders.slice(0, 8).map(s => h('div', { class: 'small', style: 'padding:3px 0' }, h('b', {}, s.name), ` · ${s.role || s.party || ''}`)), R.stakeholders.length ? null : h('p', { class: 'note' }, 'None yet.'))));
} });
function printCharter() {
  const p = P_(), c = p.charter || {}, R = ST.PH.rec, ms = scheduleCPM().rows.filter(r => +r.t.is_milestone);
  const sec = (t, b) => b ? `<h3>${esc(t)}</h3><p>${esc(b).replace(/\n/g, '<br>')}</p>` : '';
  const w = window.open('', '_blank');
  w.document.write(`<html><head><title>${esc(p.code)} Project charter</title><style>body{font:13px/1.5 "Segoe UI",Arial;color:#14253a;margin:36px}h1{color:#005093;margin:0}h3{color:#005093;border-bottom:1px solid #dfe5ec;padding-bottom:3px;margin-top:20px;font-size:14px;text-transform:uppercase;letter-spacing:.06em}table{border-collapse:collapse;width:100%}td,th{border:1px solid #dfe5ec;padding:5px 8px;text-align:left}.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #005093;padding-bottom:10px}</style></head><body>
  <div class="hd"><div><div style="letter-spacing:.14em;font-size:11px;color:#76869a">PROJECT CHARTER</div><h1>${esc(p.name)}</h1><div>${esc(p.code)} · ${esc(p.client_name || '')} · ${esc(p.site || '')}</div></div><img src="${location.origin}/img/logo-blue.png" height="44"></div>
  <table style="margin-top:14px"><tr><th>Project manager</th><td>${esc(p.project_manager || '')}</td><th>Sponsor</th><td>${esc(c.sponsor || '')}</td></tr><tr><th>Start</th><td>${fdate(p.start_date)}</td><th>Target finish</th><td>${fdate(p.target_finish)}</td></tr><tr><th>Client PO</th><td>${esc(p.po_number || '')}</td><th>Budget</th><td>${c.budget ? money(c.budget) : ''}</td></tr></table>
  ${sec('Description', p.description)}${sec('Objectives', c.objectives)}${sec('Scope', c.scope)}${sec('Out of scope', c.out_of_scope)}
  <h3>Key milestones</h3><table>${ms.map(r => `<tr><td>${esc(r.t.title)}</td><td>${r.ef ? fdate(r.ef) : 'TBC'}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</table>
  <h3>Stakeholders</h3><table>${R.stakeholders.map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.organisation || '')}</td><td>${esc(s.role || '')}</td><td>${esc(s.party || '')}</td></tr>`).join('') || '<tr><td>—</td></tr>'}</table>
  ${sec('Assumptions', c.assumptions)}${sec('Constraints', c.constraints)}${sec('Success criteria', c.success_criteria)}
  <h3>Approval</h3><table><tr><th style="width:50%">Client</th><th>CGI</th></tr><tr><td style="height:60px">${esc(c.approval || '')}</td><td></td></tr></table>
  <p style="color:#76869a;font-size:11px;margin-top:20px">Printed ${fdate(isoToday())} from CGI Project Hub</p><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
}

/* ---------------- schedule ---------------- */
const SCH = { zoom: 'week', group: 'wbs', ws: '' };
route('schedule', { title: 'Schedule', icon: 'gantt', group: 'Project', project: true, render: v => {
  const p = P_(), cpm = scheduleCPM(), changed = cpm.rows.filter(r => r.changed);
  const start = h('input', { type: 'date', value: p.start_date || '', style: 'width:150px', onchange: run(async e => { await DB.patchProject({ start_date: e.target.value || null }); rerender(); }) });
  const reschedule = run(async () => { const items = changed.map(r => ({ id: r.t.id, forecast_start: r.es, forecast_finish: r.ef })); if (!items.length) return toast('Dates already match the critical-path calculation');
    await DB.bulk('tasks', items); toast(`Saved new dates for ${items.length} task(s)`); rerender(); });
  const baseline = run(async () => { if (!confirm('Copy every forecast date to the baseline? Slippage is then measured against it.')) return;
    await DB.bulk('tasks', ST.PH.rec.tasks.filter(t => t.forecast_start).map(t => ({ id: t.id, baseline_start: t.forecast_start, baseline_finish: t.forecast_finish }))); toast('Baseline set'); rerender(); });
  v.append(pageHead('Planning', 'Schedule', 'Waterfall plan with parallel workstreams. Working days Mon–Fri; predecessors are finish-to-start with optional lag (e.g. “2.1, 3.3+5”). Typed dates are kept as “start no earlier than”.',
    h('label', { class: 'row small' }, 'Project start', start), h('button', { class: 'btn', onclick: reschedule }, 'Reschedule' + (changed.length ? ` (${changed.length})` : '')), h('button', { class: 'btn', onclick: baseline }, 'Set baseline'),
    h('button', { class: 'btn', onclick: () => downloadICS(`${ST.code} schedule`, cpm.rows.filter(r => r.es && !r.summary).map(r => ({ uid: `${ST.code}-task-${r.t.id}`, title: `[${ST.code}] ${r.t.title}`, start: r.es, end: r.ef, desc: `${r.t.workstream || ''} ${r.t.owner || ''}`, alarm: false }))) }, icon('cal'), '.ics'),
    h('button', { class: 'btn pri', onclick: () => openForm('tasks', null, { progress: 0, wbs: nextWbs() }) }, icon('plus'), 'Add task')));
  const crit = cpm.rows.filter(r => r.critical).length, slip = cpm.finish && cpm.baselineFinish ? workdays(cpm.baselineFinish, cpm.finish) : null;
  v.append(h('div', { class: 'kpis' }, kpi('Forecast finish', cpm.finish ? fdate(cpm.finish) : '—'), kpi('Target finish', p.target_finish ? fdate(p.target_finish) : 'not set', p.target_finish && cpm.finish ? (cpm.finish > p.target_finish ? `${workdays(p.target_finish, cpm.finish)} work days late` : `${workdays(cpm.finish, p.target_finish)} work days spare`) : '', p.target_finish && cpm.finish > p.target_finish ? 'bad' : 'good'),
    kpi('Baseline slip', slip == null ? 'no baseline' : `${slip} days`, '', slip > 0 ? 'warn' : ''), kpi('Critical tasks', String(crit)), kpi('Progress', pct(cpm.progress))));
  if (cpm.errors.length) v.append(h('ul', { class: 'alerts', style: 'margin-bottom:12px' }, cpm.errors.map(e => h('li', { class: 'bad' }, e))));
  if (changed.length) v.append(h('ul', { class: 'alerts', style: 'margin-bottom:12px' }, h('li', { class: 'warn', onclick: reschedule }, `${changed.length} task date(s) differ from the critical-path calculation (predecessors moved or durations changed). Click to save the calculated dates.`)));
  v.append(h('div', { class: 'tbar' }, h('div', { class: 'seg' }, [['wbs', 'By WBS'], ['workstream', 'By workstream']].map(([k, l]) => h('button', { class: SCH.group === k ? 'on' : '', onclick: () => { SCH.group = k; rerender(); } }, l))),
    h('div', { class: 'seg' }, [['day', 'Days'], ['week', 'Weeks'], ['month', 'Months']].map(([k, l]) => h('button', { class: SCH.zoom === k ? 'on' : '', onclick: () => { SCH.zoom = k; rerender(); } }, l))),
    h('select', { style: 'width:auto', onchange: e => { SCH.ws = e.target.value; rerender(); } }, h('option', { value: '' }, 'All workstreams'), ST.cfg.meta.workstreams.map(w => h('option', { selected: SCH.ws === w }, w)))));
  v.append(gantt(cpm, { zoom: SCH.zoom, group: SCH.group, until: p.target_finish, filter: SCH.ws ? r => r.summary ? false : r.t.workstream === SCH.ws : null }));
  v.append(h('div', { class: 'legend' }, Object.entries(WS_COLORS).map(([w, c]) => h('span', {}, h('i', { style: `background:${c}` }), w)), h('span', {}, h('i', { style: 'background:#b9c4d0;height:3px' }), 'baseline'), h('span', {}, h('i', { style: 'border:1.6px solid #c43b31;background:none' }), 'critical path'), h('span', {}, '◆ milestone')));
  v.append(h('div', { style: 'margin-top:18px' }, registerBlock('tasks', { onRow: openTask, presets: () => ({ wbs: nextWbs(), progress: 0 }) })));
} });
function nextWbs() { const top = ST.PH.rec.tasks.map(t => String(t.wbs || '')).filter(w => /^\d+$/.test(w)).map(Number); return String((top.length ? Math.max(...top) : 0) + 1); }

/* task dialog: fields + linked to-dos + tests */
function openTask(t) { openForm('tasks', byId('tasks', t.id) || t); }
FORM_EXTRAS.tasks = (t, wrap) => {
  const box = h('div', { class: 'sub' });
  const draw = () => {
    const todos = ST.PH.rec.actions.filter(a => String(a.task_id) === String(t.id));
    box.innerHTML = ''; box.append(h('h4', {}, icon('check'), `To-dos (${todos.filter(a => !isClosed('actions', a)).length} open)`));
    for (const a of todos) box.append(h('div', { class: 'todo' + (isClosed('actions', a) ? ' done' : '') }, h('input', { type: 'checkbox', checked: isClosed('actions', a), onchange: run(async e => { await DB.update('actions', a.id, e.target.checked ? { status: 'Closed', completed_date: isoToday() } : { status: 'Open' }); draw(); }) }),
      h('span', { class: 'grow' }, a.title), a.owner ? chip(a.owner) : null, a.due_date ? h('span', { class: 'tiny ' + (overdue('actions', a) ? 'due' : 'muted'), style: overdue('actions', a) ? 'color:var(--red)' : '' }, sdate(a.due_date)) : null,
      h('button', { class: 'btn sm ghost', onclick: () => openForm('actions', a, {}, () => openTask(t)) }, 'Edit')));
    const inp = h('input', { type: 'text', placeholder: 'Add a to-do and press Enter…' }), own = h('input', { type: 'text', placeholder: 'Owner', list: 'dl-people', style: 'max-width:140px' }), due = h('input', { type: 'date', style: 'max-width:150px' });
    const add = run(async () => { if (!inp.value.trim()) return; await DB.create('actions', { title: inp.value.trim(), category: 'To-do', task_id: t.id, owner: own.value || t.owner, due_date: due.value || null, workstream: t.workstream }); draw(); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
    box.append(h('div', { class: 'row', style: 'margin-top:6px' }, inp, own, due, h('button', { class: 'btn sm', onclick: add }, 'Add')));
    const tests = ST.PH.rec.tests.filter(x => String(x.task_id) === String(t.id));
    if (tests.length) box.append(h('div', { style: 'margin-top:10px' }, h('b', { class: 'small' }, 'Linked tests: '), tests.map(x => h('span', { class: 'chip ' + tone(x.result), style: 'cursor:pointer;margin-right:4px', onclick: () => openForm('tests', x) }, `${x.ref || ''} ${x.title} · ${x.result}`))));
  };
  draw(); wrap.append(box);
};

/* ---------------- board (kanban) ---------------- */
const BOARD = { ws: '', by: 'status' };
route('board', { title: 'Task board', icon: 'board', group: 'Project', project: true, render: v => {
  const cols = ['Not started', 'In progress', 'On hold', 'Blocked', 'Complete'];
  const cpm = scheduleCPM(), info = new Map(cpm.rows.map(r => [r.t.id, r]));
  const tasks = ST.PH.rec.tasks.filter(t => !cpm.rows.find(r => r.t === t)?.summary).filter(t => !BOARD.ws || t.workstream === BOARD.ws);
  const statusOf = t => t.status || (+t.progress >= 100 ? 'Complete' : +t.progress > 0 ? 'In progress' : 'Not started');
  v.append(pageHead('Delivery', 'Task board', 'Drag cards between columns to update status. Click a card for details and its to-do list.',
    h('select', { style: 'width:auto', onchange: e => { BOARD.ws = e.target.value; rerender(); } }, h('option', { value: '' }, 'All workstreams'), ST.cfg.meta.workstreams.map(w => h('option', { selected: BOARD.ws === w }, w))),
    h('button', { class: 'btn pri', onclick: () => openForm('tasks', null, { wbs: nextWbs(), progress: 0 }) }, icon('plus'), 'Add task')));
  const board = h('div', { class: 'board' });
  for (const c of cols) {
    const items = tasks.filter(t => statusOf(t) === c);
    const col = h('div', { class: 'col', ondragover: e => { e.preventDefault(); col.classList.add('over'); }, ondragleave: () => col.classList.remove('over'),
      ondrop: run(async e => { e.preventDefault(); col.classList.remove('over'); const id = +e.dataTransfer.getData('text/plain'); const t = byId('tasks', id); if (!t || statusOf(t) === c) return;
        const d = { status: c }; if (c === 'Complete') { d.progress = 100; d.actual_finish = t.actual_finish || isoToday(); } if (c === 'In progress' && !t.actual_start) d.actual_start = isoToday(); if (c === 'In progress' && +t.progress >= 100) d.progress = 50;
        await DB.update('tasks', id, d); toast(`${t.title} → ${c}`); rerender(); }) }, h('h4', {}, h('i', { style: `width:8px;height:8px;border-radius:50%;background:var(--${{ 'Not started': 'muted', 'In progress': 'blue', 'On hold': 'amber', 'Blocked': 'red', 'Complete': 'green' }[c]})` }), c, h('span', { class: 'c' }, items.length)));
    for (const t of sortRows('tasks', items, 'wbs')) { const r = info.get(t.id) || {}, todos = ST.PH.rec.actions.filter(a => String(a.task_id) === String(t.id)), open = todos.filter(a => !isClosed('actions', a)).length;
      col.append(h('div', { class: 'kcard', draggable: 'true', style: `border-left-color:${wsColor(t.workstream)}`, ondragstart: e => { e.dataTransfer.setData('text/plain', t.id); e.target.classList.add('dragging'); }, ondragend: e => e.target.classList.remove('dragging'), onclick: () => openTask(t) },
        h('div', { class: 'km' }, h('span', {}, t.wbs), t.workstream ? h('span', {}, '· ' + t.workstream) : null, r.critical ? chip('critical', 'red') : null, r.late ? chip('late', 'red') : null),
        h('div', { class: 'kt' }, t.title), h('div', { class: 'km' }, r.es ? h('span', {}, `${sdate(r.es)} → ${sdate(r.ef)}`) : h('span', {}, 'unscheduled'), t.owner ? chip(t.owner) : null, todos.length ? chip(`☑ ${todos.length - open}/${todos.length}`, open ? 'amber' : 'green') : null),
        +t.progress > 0 && +t.progress < 100 ? h('div', { class: 'bar', style: 'margin-top:7px' }, h('i', { style: `width:${t.progress}%` })) : null)); }
    board.append(col);
  }
  v.append(board);
} });

/* ---------------- actions & to-dos ---------------- */
route('actions', { title: 'Actions & to-dos', icon: 'check', group: 'Project', project: true, badge: () => ST.PH ? ST.PH.rec.actions.filter(a => overdue('actions', a)).length : 0, render: v => {
  const tab = ST.params.tab || 'open'; const R = ST.PH.rec;
  const sets = { open: a => !isClosed('actions', a), overdue: a => overdue('actions', a), todo: a => a.category === 'To-do' && !isClosed('actions', a), all: () => true };
  v.append(pageHead('Delivery', 'Actions & to-dos', 'One list for actions from meetings, to-dos on tasks, follow-ups and reminders. Tick to close.',
    h('button', { class: 'btn', onclick: () => downloadICS(`${ST.code} actions`, R.actions.filter(a => a.due_date && !isClosed('actions', a)).map(a => ({ uid: `${ST.code}-act-${a.id}`, title: `[${ST.code}] ${a.title}`, start: a.due_date, desc: `Owner: ${a.owner || '-'}` }))) }, icon('cal'), 'Due dates to Outlook')));
  if (tab === 'reminders') { v.append(tabs([['open', 'Open'], ['overdue', 'Overdue'], ['todo', 'Task to-dos'], ['all', 'All'], ['owner', 'By owner'], ['reminders', 'Reminders']], tab, k => go('actions', { tab: k }))); v.append(registerBlock('reminders', { check: async (r, on) => { await DB.update('reminders', r.id, { done: on ? 1 : 0 }); rerender(); }, presets: () => ({ remind_date: isoToday(), remind_time: '08:00' }) })); return; }
  v.append(tabs([['open', 'Open', R.actions.filter(sets.open).length], ['overdue', 'Overdue', R.actions.filter(sets.overdue).length], ['todo', 'Task to-dos', R.actions.filter(sets.todo).length], ['all', 'All', R.actions.length], ['owner', 'By owner'], ['reminders', 'Reminders', R.reminders.filter(r => !+r.done).length]], tab, k => go('actions', { tab: k })));
  const check = async (a, on) => { await DB.update('actions', a.id, on ? { status: 'Closed', completed_date: isoToday() } : { status: 'Open', completed_date: null }); rerender(); };
  if (tab === 'owner') {
    const open = R.actions.filter(sets.open), owners = [...new Set(open.map(a => a.owner || 'Unassigned'))].sort();
    v.append(h('div', { class: 'grid g3' }, owners.map(o => { const its = open.filter(a => (a.owner || 'Unassigned') === o);
      return h('div', { class: 'card' }, h('h3', {}, o, h('span', { class: 'chip right' }, its.length)), its.map(a => h('div', { class: 'todo' }, h('input', { type: 'checkbox', onchange: run(() => check(a, true)) }), h('span', { class: 'grow', style: 'cursor:pointer', onclick: () => openForm('actions', a) }, a.title), a.due_date ? h('span', { class: 'tiny', style: overdue('actions', a) ? 'color:var(--red);font-weight:600' : 'color:var(--muted)' }, sdate(a.due_date)) : null))); })));
    return;
  }
  v.append(registerBlock('actions', { rows: () => R.actions.filter(sets[tab]), check, cols: ['title', 'category', 'owner', 'due_date', 'priority', 'status', 'task_id', 'meeting_id'], presets: () => ({ owner: ST.cfg.settings.USER_NAME || '' }) }));
} });

/* ---------------- RAID log ---------------- */
route('raid', { title: 'Risks & changes', icon: 'risk', group: 'Project', project: true, render: v => {
  const tab = ST.params.tab || 'risks', R = ST.PH.rec;
  v.append(pageHead('Control', 'RAID log & change control', 'Risks, issues, decisions, change requests / variations and lessons learned.'));
  v.append(tabs([['risks', 'Risks', R.risks.filter(r => !isClosed('risks', r)).length], ['issues', 'Issues', R.issues.filter(r => !isClosed('issues', r)).length], ['decisions', 'Decisions', R.decisions.length],
    ['variations', 'Change requests', R.variations.length], ['lessons', 'Lessons learned', R.lessons.length]], tab, k => go('raid', { tab: k })));
  if (tab === 'risks') {
    const open = R.risks.filter(r => !isClosed('risks', r)), cell = (p, i) => open.filter(r => +r.probability === p && +r.impact === i).length;
    const col = s => s >= 15 ? '#c43b31' : s >= 8 ? '#d38a12' : s >= 4 ? '#e8c35a' : '#7cbf94';
    const heat = h('div', { class: 'heat' });
    for (let p = 5; p >= 1; p--) { heat.append(h('div', { class: 'ax' }, p)); for (let i = 1; i <= 5; i++) { const n = cell(p, i); heat.append(h('div', { style: `background:${col(p * i)};opacity:${n ? 1 : .35}`, title: `Probability ${p} × impact ${i}` }, n || '')); } }
    heat.append(h('div', { class: 'ax' }), ...[1, 2, 3, 4, 5].map(i => h('div', { class: 'ax' }, i)));
    v.append(h('div', { class: 'grid g12' }, h('div', { class: 'card' }, h('h3', {}, 'Heat map (open risks)'), heat, h('p', { class: 'note' }, 'Rows: probability 1–5 · columns: impact 1–5 · score ≥15 is high.')),
      registerBlock('risks', { cols: ['title', 'category', 'owner', 'probability', 'impact', 'response', 'status'], extra: r => { const s = (r.probability || 0) * (r.impact || 0); return chip(String(s), s >= 15 ? 'red' : s >= 8 ? 'amber' : 'green'); }, extraLabel: 'Score' })));
  } else v.append(registerBlock(tab));
} });

/* ---------------- technical ---------------- */
route('technical', { title: 'Technical', icon: 'tech', group: 'Delivery', project: true, render: v => {
  const tab = ST.params.tab || 'requirements', R = ST.PH.rec;
  v.append(pageHead('Engineering', 'Technical control', 'Requirements, deliverables, RFIs and technical queries, document register and deviations.'));
  v.append(tabs([['requirements', 'Requirements', R.requirements.length], ['deliverables', 'Deliverables', R.deliverables.length], ['rfis', 'RFIs', R.rfis.filter(r => !isClosed('rfis', r)).length], ['documents', 'Document register', R.documents.length], ['deviations', 'Deviations', R.deviations.length]], tab, k => go('technical', { tab: k })));
  v.append(registerBlock(tab));
} });
route('diary', { title: 'Site diary', icon: 'diary', group: 'Delivery', project: true, render: v => {
  v.append(pageHead('Site', 'Site diary', 'Daily log of who was on site, what was done, weather and delays. Attach photos to each entry.'));
  v.append(registerBlock('daily_logs', { presets: () => ({ log_date: isoToday(), author: ST.cfg.settings.USER_NAME || '' }) }));
} });
