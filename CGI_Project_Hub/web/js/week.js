/* This week (ideas from the TMM implementation section, im-work.js + im-ahead.js):
   - My work: everything that needs doing on the project wherever it lives, by who and by when; an owner given in one tap,
     a task moved on in one tap (+25%, done), a quick add; a soft limit on how much one person holds;
   - Look-ahead (Last Planner): the next three weeks, what must be cleared before each task can start (tap round:
     ? → ✓ → ✗ → –), this week's work committed only when ready, and how much of what was committed got done (PPC);
   - Status updates: On track / At risk / Off track, what happened, what is next, help needed — drafted from the records;
   - Weekly review: the open items one at a time, for the weekly meeting. */
'use strict';
const WK = { view: localStorage.getItem('cgi-wk-view') || 'mine', only: '', later: false, off: 0 };
const mondayOf = d => addDays(d, -((D0(d).getDay() + 6) % 7)), sundayOf = d => addDays(mondayOf(d), 6);
const isoWeek = d => { const x = D0(d), w = (x.getDay() + 6) % 7; x.setDate(x.getDate() - w + 3); const y0 = new Date(x.getFullYear(), 0, 4); return `${x.getFullYear()}-W${String(1 + Math.round(((x - y0) / 864e5 - 3 + ((y0.getDay() + 6) % 7)) / 7)).padStart(2, '0')}`; };
const WIP = 12;
const SRC = { task: ['Task', '#2f6fb3'], ms: ['Milestone', '#6a5ad3'], actions: ['Action', '#005093'], issues: ['Issue', '#c43b31'], risks: ['Risk', '#c27c00'], tests: ['Test', '#1d8a5b'],
  procurement: ['Delivery', '#5d6f84'], punch_items: ['Punch', '#b0457b'], rfis: ['RFI', '#0f7c86'], deliverables: ['Deliverable', '#2e9d6a'], meeting_items: ['Minutes', '#9a6200'], reminders: ['Reminder', '#b0457b'] };
const whoKey = () => 'cgi-who-' + ST.code;
const getWho = () => localStorage.getItem(whoKey()) ?? (ST.cfg.settings.USER_NAME || '');

/* ---- everything that needs doing, from every register ---- */
function collectWork() {
  const R = ST.PH.rec, now = isoToday(), out = [], cpm = scheduleCPM();
  for (const r of cpm.rows) { if (r.summary || r.progress >= 100) continue; const t = r.t, bl = t.baseline_finish && r.ef && r.ef > t.baseline_finish ? workdays(t.baseline_finish, r.ef) : 0;
    const nr = readiness(t, r).filter(c => c.s === 'no').map(c => c.label.toLowerCase());
    out.push({ src: +t.is_milestone || r.dur === 0 ? 'ms' : 'task', k: 'tasks', rec: t, title: t.title, owner: t.owner || '', due: r.ef, start: r.es, pct: r.progress, crit: r.critical,
      note: [t.wbs, nr.length ? 'not ready: ' + nr.join(', ') : '', bl ? `${bl} days behind the baseline` : '', t.workstream].filter(Boolean).join(' · '), can: true }); }
  const add = (k, filter, due, extra = {}) => { for (const x of R[k] || []) if (!isClosed(k, x) && filter(x)) out.push({ src: k, k, rec: x, title: titleOf(k, x), owner: x.owner || '', due: due(x) || '', can: ent(k).fields.some(f => f.k === 'owner'), ...(typeof extra === 'function' ? extra(x) : extra) }); };
  add('actions', () => true, x => x.due_date, x => ({ note: [x.category !== 'Action' ? x.category : '', x.meeting_id ? 'from ' + titleOf('meetings', byId('meetings', x.meeting_id)) : '', x.task_id ? 'task ' + (byId('tasks', x.task_id)?.wbs || '') : ''].filter(Boolean).join(' · ') }));
  add('issues', () => true, x => x.due_date, x => ({ note: x.priority }));
  const monthEnd = (() => { const d = D0(now); return iso(new Date(d.getFullYear(), d.getMonth() + 1, 0)); })();
  add('risks', x => (x.probability || 0) * (x.impact || 0) >= 10 || !x.owner, x => (x.probability || 0) * (x.impact || 0) >= 10 ? monthEnd : '', x => ({ title: 'Review: ' + x.title, note: `score ${(x.probability || 0) * (x.impact || 0)}` }));
  add('tests', () => true, x => x.planned_date, x => ({ title: `Run ${x.ref || ''} ${x.title}`, note: x.test_type }));
  add('procurement', x => !!(x.expected_delivery || x.required_by), x => x.expected_delivery || x.required_by, x => ({ title: `${x.status === 'Not started' ? 'Order' : 'Arrives'}: ${x.item}`, note: x.status }));
  add('punch_items', () => true, x => x.due_date, x => ({ note: x.category }));
  add('rfis', () => true, x => x.required_by, x => ({ note: x.raised_to ? 'to ' + x.raised_to : '' }));
  add('deliverables', x => !!x.forecast_due, x => x.forecast_due);
  add('meeting_items', x => x.item_type === 'Action' && !x.action_id, x => x.due_date, x => ({ note: 'from ' + titleOf('meetings', byId('meetings', x.meeting_id)) }));
  add('reminders', () => true, x => x.remind_date, x => ({ owner: '' }));
  return out;
}
function bucket(it, now) { if (!it.due) return 'none'; if (it.due < now) return 'late'; const e = sundayOf(now); if (it.due <= e) return 'week'; if (it.due <= addDays(e, 7)) return 'next'; return 'later'; }
const BUCKETS = [['late', 'Overdue'], ['week', 'This week'], ['next', 'Next week'], ['later', 'Later'], ['none', 'No date']];
async function doneItem(it) {
  const k = it.k, x = it.rec;
  if (k === 'tasks') { await DB.update('tasks', x.id, { progress: 100, ...progressSide(x, 100) }); celebrate(it.src === 'ms' ? 'Milestone reached' : 'Task complete', it.title); return; }
  const d = { actions: { status: 'Closed', completed_date: isoToday() }, issues: { status: 'Resolved' }, punch_items: { status: 'Closed', closed_date: isoToday() }, reminders: { done: 1 }, meeting_items: { status: 'Done' }, rfis: { status: 'Answered' },
    deliverables: { status: 'Approved' }, procurement: { status: 'Delivered', actual_delivery: isoToday() }, tests: { result: 'Pass', executed_date: isoToday() }, risks: { status: x.status } }[k];
  if (k === 'risks') return openForm('risks', x);
  await DB.update(k, x.id, d); toast(`Done: ${it.title}`);
}
const doneLabel = it => ({ task: 'Done', ms: 'Reached', actions: 'Done', issues: 'Resolved', punch_items: 'Closed', reminders: 'Done', meeting_items: 'Done', rfis: 'Answered', deliverables: 'Approved', procurement: 'Delivered', tests: 'Passed' }[it.src] || null);
const openItem = it => it.k === 'tasks' ? openTask(it.rec) : openForm(it.k, byId(it.k, it.rec.id) || it.rec);

/* ---- readiness (look-ahead): what must be cleared before a task can start ---- */
const NEEDS = [['materials', 'Materials & equipment', 'stores, procurement'], ['info', 'Drawings & information', 'engineering, the client'], ['access', 'Access & permits', 'the client / site, safety file'],
  ['people', 'People available', 'the team plan'], ['tools', 'Tools & test gear', 'the workshop'], ['site', 'Client / site ready', 'the client']];
const NST = [['', '?', 'not checked'], ['ok', '✓', 'ready'], ['no', '✗', 'not yet'], ['na', '–', 'not needed']];
function readiness(t, r) {
  const n = t.needs || {}, out = NEEDS.map(([k, label]) => ({ k, label, s: (n[k] || {}).s || '', tap: true }));
  const map = new Map(REC('tasks').map(x => [String(x.wbs), x]));
  const open = parsePreds(t.predecessors).map(p => map.get(p.wbs)).filter(x => x && (+x.progress || 0) < 100);
  if (open.length) out.push({ k: 'deps', label: 'Work before it', s: open.some(x => x.forecast_finish && x.forecast_finish < isoToday()) ? 'no' : 'wait', note: open.map(x => `${x.wbs} ${x.title} (${x.progress || 0}%)`).join(', ') });
  const st = REC('stakeholders').find(s => s.name && s.name === t.owner);
  if (st && r && r.es) { const w = availOn(st, r.es > isoToday() ? r.es : isoToday()); if (w === 'leave' || w === 'busy') out.push({ k: 'away', label: 'Owner here', s: 'no', note: `${t.owner} is ${w === 'leave' ? 'on leave' : 'on other duties'}` }); }
  return out;
}
const verdict = C => C.some(c => c.s === 'no') ? 'no' : C.some(c => c.s === '' || c.s === 'wait') ? 'check' : 'ready';
const VERD = { ready: ['Ready', 'green'], check: ['To check', 'amber'], no: ['Not ready', 'red'] };
function ppcWeeks(rows, upto) {
  const W = [...new Set(rows.flatMap(r => r.t.commit || []))].filter(w => w <= upto).sort();
  return W.map(w => { const e = addDays(w, 6), C = rows.filter(r => (r.t.commit || []).includes(w)), Dn = C.filter(r => r.progress >= 100 && (!r.t.actual_finish || r.t.actual_finish <= e));
    const why = {}; C.filter(r => !Dn.includes(r)).forEach(r => { const k = r.t.miss_reason || 'not recorded'; why[k] = (why[k] || 0) + 1; });
    return { w, n: C.length, done: Dn.length, pct: C.length ? Math.round(100 * Dn.length / C.length) : null, why, open: w === mondayOf(isoToday()), miss: C.filter(r => !Dn.includes(r)) }; });
}

/* ---- the page ---- */
route('week', { title: 'This week', icon: 'check', group: 'Project', project: true, badge: () => ST.PH ? collectWork().filter(x => x.due && x.due < isoToday() && (!getWho() || x.owner === getWho())).length : 0, render: v => {
  localStorage.setItem('cgi-wk-view', WK.view);
  const W = collectWork(), now = isoToday(), who = getWho(), mine = W.filter(x => !who || x.owner === who), ppl = people();
  const last = sortRows('status_updates', REC('status_updates'), '-week')[0], ms = W.filter(x => x.src === 'ms' && x.due >= now).sort((a, b) => a.due < b.due ? -1 : 1)[0];
  const n = k => mine.filter(x => bucket(x, now) === k).length, un = W.filter(x => x.can && !x.owner).length;
  const whoSel = h('select', { class: 'wk-whos', onchange: e => { localStorage.setItem(whoKey(), e.target.value); rerender(); } }, h('option', { value: '' }, 'Everyone'), [...new Set([...ppl, who].filter(Boolean))].map(p => h('option', { selected: p === who }, p)));
  v.append(pageHead('Delivery', 'This week', 'Everything that needs doing on the project, wherever it lives — schedule, actions, issues, risks, tests, deliveries, punch list — by who and by when. Pick yourself to see your own work, give anything an owner in one tap, and post the week’s status.',
    h('label', { class: 'row small' }, 'Showing', whoSel), h('button', { class: 'btn pri', onclick: () => weeklyReview(), title: 'Go through the open items one at a time — for the weekly meeting' }, '▶ Weekly review')));
  if (!ST.cfg.settings.USER_NAME) { const nm = h('input', { type: 'text', placeholder: 'Your name, e.g. Jeandre', style: 'max-width:240px', list: 'wk-ppl' });
    v.append(h('div', { class: 'clear', style: 'margin-bottom:12px' }, h('span', { class: 'ck', style: 'background:var(--sky-100);color:var(--blue)' }, '👋'), h('div', { class: 'grow' }, h('b', {}, 'Who are you?'), h('small', {}, 'Your name picks out “My work”, signs your comments and status updates, and goes in the change log.')),
      h('datalist', { id: 'wk-ppl' }, ppl.map(p => h('option', { value: p }))), nm, h('button', { class: 'btn pri', onclick: run(async () => { if (!nm.value.trim()) return nm.focus(); ST.cfg.settings = await API.post('/api/settings', { USER_NAME: nm.value.trim() }); localStorage.setItem(whoKey(), nm.value.trim()); toast(`Hi ${nm.value.trim()}`); rerender(); }) }, 'Save'))); }
  if (who && mine.length > WIP) v.append(h('p', { class: 'wk-wip' }, `${who} holds `, h('b', {}, mine.length), ` open items — more than about ${WIP} at once slows everything down. Hand some on, or move the later ones out.`));
  const tile = (cls, val, lab, on, click) => h('button', { class: `wk-t ${cls}${on ? ' on' : ''}`, onclick: click }, h('b', {}, val), h('span', {}, lab));
  const rag = last ? last.rag : '';
  v.append(h('div', { class: 'wk-tiles' },
    tile('late', n('late'), 'overdue', WK.only === 'late', () => { WK.only = WK.only === 'late' ? '' : 'late'; WK.view = 'mine'; rerender(); }),
    tile('week', n('week'), 'due this week', WK.only === 'week', () => { WK.only = WK.only === 'week' ? '' : 'week'; WK.view = 'mine'; rerender(); }),
    tile('un', un, 'with no owner', WK.only === 'un', () => { WK.only = WK.only === 'un' ? '' : 'un'; WK.view = 'mine'; rerender(); }),
    tile('ms', ms ? daysBetween(now, ms.due) : '–', ms ? `days to ${ms.title}` : 'no milestone ahead', false, () => go('schedule')),
    tile('st ' + ({ 'On track': 'g', 'At risk': 'a', 'Off track': 'r' }[rag] || ''), last ? rag : 'No update', last ? `status ${last.week}` : 'post the first status', WK.view === 'status', () => { WK.view = 'status'; rerender(); })));
  v.append(h('div', { class: 'seg', style: 'margin-bottom:14px' }, [['mine', 'My work'], ['ahead', 'Look-ahead'], ['status', 'Status updates']].map(([k, l]) => h('button', { class: WK.view === k ? 'on' : '', onclick: () => { WK.view = k; rerender(); } }, l))));
  const B = h('div'); v.append(B);
  if (WK.view === 'ahead') lookAhead(B); else if (WK.view === 'status') statusView(B); else myWork(B, W, who, ppl);
} });

function myWork(B, W, who, ppl) {
  const now = isoToday(); let L = W.filter(x => !who || x.owner === who);
  if (WK.only === 'un') L = W.filter(x => x.can && !x.owner); else if (WK.only) L = L.filter(x => bucket(x, now) === WK.only);
  const ty = h('select', { style: 'width:auto' }, h('option', { value: 'actions' }, 'Action'), h('option', { value: 'issues' }, 'Issue'), h('option', { value: 'reminders' }, 'Reminder'));
  const tx = h('input', { type: 'text', placeholder: '+ Add an action or issue — e.g. confirm the 220 V supply at SR3' }), ow = h('select', { style: 'width:auto' }, h('option', { value: '' }, 'Owner'), ppl.map(p => h('option', { selected: p === who }, p)));
  const du = h('input', { type: 'date', value: addDays(now, 7), style: 'width:150px' });
  const addIt = run(async ev => { ev.preventDefault(); if (!tx.value.trim()) return tx.focus(); const k = ty.value;
    const d = k === 'reminders' ? { title: tx.value.trim(), remind_date: du.value || now } : k === 'issues' ? { title: tx.value.trim(), owner: ow.value || null, due_date: du.value || null, raised_date: now } : { title: tx.value.trim(), owner: ow.value || null, due_date: du.value || null, category: 'Action' };
    await DB.create(k, d); toast('Added'); rerender(); });
  B.append(h('form', { class: 'wk-add', onsubmit: addIt }, ty, tx, ow, du, h('button', { class: 'btn pri' }, 'Add')));
  if (!L.length) { B.append(h('div', { class: 'clear' }, h('span', { class: 'ck' }, '✓'), h('div', {}, h('b', {}, who ? `Nothing for ${who}${WK.only ? ' in this filter' : ''}` : 'Nothing to do'), h('small', {}, who ? 'Pick Everyone to see the whole project.' : 'Every task and item is done or not yet due.')))); return; }
  for (const [k, t] of BUCKETS) {
    const G = L.filter(x => bucket(x, now) === k).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1); if (!G.length) continue;
    const fold = k === 'later' && !WK.later && G.length > 6;
    B.append(h('section', { class: 'wk-g ' + k }, h('h2', {}, t, h('span', {}, G.length)), (fold ? G.slice(0, 6) : G).map(x => wkRow(x, ppl)),
      fold ? h('button', { class: 'btn sm ghost', onclick: () => { WK.later = true; rerender(); } }, `Show all ${G.length} ›`) : null));
  }
}
function wkRow(x, ppl) {
  const now = isoToday(), [lab, col] = SRC[x.src] || [x.src, '#5b7da3'], late = x.due && x.due < now, d = x.due ? daysBetween(now, x.due) : null, dl = doneLabel(x);
  const thread = (x.rec.thread || []).length;
  const own = x.can ? h('select', { class: 'wk-ow' + (x.owner ? '' : ' none'), onchange: run(async e => { await DB.update(x.k, x.rec.id, { owner: e.target.value || null }); toast(e.target.value ? `${e.target.value} owns it` : 'No owner'); rerender(); }) },
    h('option', { value: '' }, 'No owner'), [...new Set([...ppl, x.owner].filter(Boolean))].map(p => h('option', { selected: p === x.owner }, p))) : h('span', { class: 'tiny muted' }, x.owner || '');
  const acts = h('span', { class: 'wk-ac' });
  if (x.src === 'task') acts.append(h('span', { class: 'wk-pg', title: `${Math.round(x.pct)}%` }, h('i', { style: `width:${x.pct}%` })),
    h('button', { class: 'btn sm', title: 'Move it on by a quarter', onclick: run(async () => { const pc = Math.min(100, (Math.floor((+x.rec.progress || 0) / 25) + 1) * 25); await DB.update('tasks', x.rec.id, { progress: pc, ...progressSide(x.rec, pc) }); if (pc >= 100) celebrate('Task complete', x.title); else toast(`${x.title}: ${pc}%`); rerender(); }) }, '+25%'));
  if (dl) acts.append(h('button', { class: 'btn sm pri', onclick: run(async () => { await doneItem(x); rerender(); }) }, dl));
  else acts.append(h('button', { class: 'btn sm', onclick: () => openItem(x) }, 'Open ›'));
  return h('div', { class: 'wk-r' + (x.crit ? ' crit' : '') }, h('span', { class: 'wk-src', style: `color:${col}` }, lab),
    h('span', { class: 'wk-ti' }, h('button', { class: 'wk-tt', onclick: () => openItem(x) }, x.title), thread ? h('span', { class: 'wk-th', title: `${thread} comment(s)` }, `💬 ${thread}`) : null,
      x.crit ? h('small', { class: 'wk-crit' }, 'on the critical path') : null, x.note ? h('small', {}, x.note) : null),
    own, h('span', { class: 'wk-du' + (late ? ' late' : '') }, x.due ? [sdate(x.due), h('small', {}, d === 0 ? 'today' : d < 0 ? `${-d} days late` : `in ${d} day${d > 1 ? 's' : ''}`)] : ''), acts);
}

/* ---- look-ahead ---- */
function lookAhead(B) {
  const cpm = scheduleCPM(), now = isoToday(), m0 = mondayOf(now), a0 = addDays(m0, 7 * WK.off);
  const rows = cpm.rows.filter(r => !r.summary && r.dur && r.es);
  if (!rows.length) { B.append(empty('No dated work yet', 'The look-ahead reads the schedule: give tasks durations and dates in Schedule and the next three weeks show here.', h('button', { class: 'btn pri', onclick: () => go('schedule') }, 'Open the schedule'))); return; }
  const P = ppcWeeks(rows, m0), recent = P.slice(-8);
  // constraint summary across the three weeks shown
  const shown = rows.filter(r => r.progress < 100 && r.es <= addDays(a0, 20) && r.ef >= a0), sum = {};
  shown.forEach(r => readiness(r.t, r).forEach(c => { if (c.s === 'no' || c.s === '' || c.s === 'wait') { const o = sum[c.label] = sum[c.label] || { no: 0, unk: 0 }; c.s === 'no' ? o.no++ : o.unk++; } }));
  const ready = shown.filter(r => verdict(readiness(r.t, r)) === 'ready').length;
  B.append(h('p', { class: 'note', style: 'margin:0 0 12px;max-width:900px' }, 'The next three weeks of work. Before a task starts, clear what it needs — tap each check round: ? not checked → ✓ ready → ✗ not yet → – not needed. Commit this week’s work only when it is ready; at the end of the week, the share of committed work that got done (PPC) shows how reliable the plan is.'));
  B.append(h('div', { class: 'la-top' },
    h('div', { class: 'card' }, h('h3', {}, 'Plan reliability (PPC)', h('span', { class: 'right tiny muted' }, 'committed work done per week')),
      recent.length ? h('div', { class: 'la-bars' }, recent.map(p => h('div', { class: 'la-b' + (p.open ? ' open' : ''), title: `${p.done} of ${p.n} done${Object.keys(p.why).length ? '\nMissed: ' + Object.entries(p.why).map(([k, v]) => `${k} ×${v}`).join(', ') : ''}` },
        h('b', {}, p.pct == null ? '–' : p.pct + '%'), h('div', { class: 'la-bv' }, h('i', { class: p.pct >= 80 ? 'good' : p.pct >= 60 ? 'mid' : 'low', style: `height:${p.pct || 0}%` })), h('small', {}, sdate(p.w) + (p.open ? ' · now' : '')))))
        : h('p', { class: 'note' }, 'Commit tasks to a week (the “Commit” button on each card) and the reliability builds up here.'),
      (() => { const lastFull = P.filter(p => !p.open).slice(-1)[0]; if (!lastFull || !lastFull.miss.length) return null;
        return h('div', { class: 'la-miss' }, h('b', { class: 'small' }, `Week of ${sdate(lastFull.w)}: why weren’t these done?`), lastFull.miss.map(r => h('div', { class: 'row small', style: 'margin-top:4px' }, h('span', { class: 'grow' }, `${r.t.wbs} ${r.t.title}`),
          h('select', { style: 'width:auto', onchange: run(async e => { await DB.update('tasks', r.t.id, { miss_reason: e.target.value || null }); rerender(); }) }, (ent('tasks').fields.find(f => f.k === 'miss_reason').options).map(o => h('option', { value: o, selected: (r.t.miss_reason || '') === o }, o || 'Reason…')))))); })()),
    h('div', { class: 'card' }, h('h3', {}, 'What holds the work up', h('span', { class: 'right tiny muted' }, `${ready} of ${shown.length} tasks ready`)),
      Object.keys(sum).length ? h('div', { class: 'la-con' }, Object.entries(sum).sort((a, b) => b[1].no - a[1].no).map(([k, o]) => h('div', { class: 'la-cn' }, h('b', {}, k), h('span', {}, o.no ? h('i', { class: 'no' }, `${o.no} not yet`) : null, o.unk ? h('i', { class: 'unk' }, `${o.unk} to check`) : null),
        h('small', {}, 'cleared by ' + ((NEEDS.find(n => n[1] === k) || [])[2] || (k === 'Work before it' ? 'the owners of the work before it' : 'the team plan'))))))
        : h('div', { class: 'clear' }, h('span', { class: 'ck' }, '✓'), h('div', {}, h('b', {}, 'Nothing holding the work up'), h('small', {}, 'Every check is ready or not needed.'))))));
  const nav = h('div', { class: 'row', style: 'margin:4px 0 10px' }, h('button', { class: 'btn sm', onclick: () => { WK.off--; rerender(); } }, '‹'), h('b', {}, `${sdate(a0)} – ${sdate(addDays(a0, 20))}`), h('button', { class: 'btn sm', onclick: () => { WK.off++; rerender(); } }, '›'),
    WK.off ? h('button', { class: 'btn sm', onclick: () => { WK.off = 0; rerender(); } }, 'This week') : null);
  B.append(nav);
  const cols = h('div', { class: 'la-wk' });
  for (let w = 0; w < 3; w++) {
    const ws = addDays(a0, 7 * w), we = addDays(ws, 6), L = rows.filter(r => r.progress < 100 && r.es <= we && r.ef >= ws).sort((a, b) => a.es < b.es ? -1 : 1);
    const committed = L.filter(r => (r.t.commit || []).includes(ws)).length;
    cols.append(h('div', { class: 'la-col' + (ws === m0 ? ' now' : '') }, h('h3', {}, ws === m0 ? 'This week' : ws === addDays(m0, 7) ? 'Next week' : `Week of ${sdate(ws)}`, h('small', {}, `${sdate(ws)} – ${sdate(we)}`), h('span', {}, `${committed}/${L.length} committed`)),
      L.length ? L.map(r => laCard(r, ws)) : h('p', { class: 'note' }, 'No work this week.')));
  }
  B.append(cols);
}
function laCard(r, ws) {
  const t = r.t, C = readiness(t, r), vd = verdict(C), com = (t.commit || []).includes(ws), past = addDays(ws, 6) < isoToday();
  const setNeed = run(async (k, s) => { const n = { ...(t.needs || {}) }; n[k] = { ...(n[k] || {}), s, by: me(), at: isoToday() }; await DB.update('tasks', t.id, { needs: n }); rerender(); });
  return h('div', { class: 'la-card v-' + vd + (com ? ' com' : '') }, h('div', { class: 'row' }, h('span', { class: 'tiny muted' }, t.wbs), chip(VERD[vd][0], VERD[vd][1]), r.critical ? chip('critical', 'amber') : null,
    h('span', { class: 'right tiny muted' }, `${sdate(r.es)} → ${sdate(r.ef)}`)),
    h('button', { class: 'wk-tt', style: 'margin:4px 0 6px', onclick: () => openTask(t) }, t.title),
    h('div', { class: 'la-checks' }, C.map(c => { const st = NST.find(x => x[0] === c.s) || ['wait', '…', 'waiting'];
      return c.tap ? h('button', { class: 'la-ck s-' + (c.s || 'q'), title: `${c.label}: ${st[2]} — tap to change`, onclick: () => setNeed(c.k, NST[(NST.findIndex(x => x[0] === c.s) + 1) % NST.length][0]) }, h('b', {}, st[1]), c.label)
        : h('span', { class: 'la-ck auto s-' + c.s, title: c.note || '' }, h('b', {}, c.s === 'no' ? '✗' : '…'), c.label); })),
    h('div', { class: 'row', style: 'margin-top:6px' }, t.owner ? h('span', { class: 'av', title: t.owner }, initials(t.owner)) : h('span', { class: 'tiny muted' }, 'no owner'), h('span', { class: 'tiny muted grow' }, `${Math.round(r.progress)}% done`),
      past ? (com ? chip('was committed', 'blue') : null) : h('button', { class: 'btn sm' + (com ? ' on' : ''), title: vd === 'ready' ? 'Commit to doing it this week' : 'Commit anyway (it is not ready yet)', onclick: run(async () => {
        const cm = new Set(t.commit || []); com ? cm.delete(ws) : cm.add(ws); await DB.update('tasks', t.id, { commit: [...cm].sort() }); if (!com && vd !== 'ready') toast('Committed — but it is not ready yet', true); rerender(); }) }, com ? '✓ Committed' : 'Commit')));
}

/* ---- status updates ---- */
function statusDraft() {
  const cpm = scheduleCPM(), now = isoToday(), L = cpm.rows.filter(r => !r.summary), R = ST.PH.rec, parts = [];
  const done = L.filter(r => r.progress >= 100 && r.t.actual_finish && r.t.actual_finish >= addDays(now, -7)), late = L.filter(r => r.late), crit = L.filter(r => r.critical && r.late);
  parts.push(`The schedule is ${Math.round(cpm.progress)}% done${late.length ? `, ${late.length} task${late.length > 1 ? 's' : ''} past their finish` : ' with nothing past its finish'}.`);
  if (done.length) parts.push(`Finished this week: ${done.slice(0, 5).map(r => r.t.title).join('; ')}.`);
  const P = ppcWeeks(L.filter(r => r.dur), mondayOf(now)).filter(p => !p.open).slice(-1)[0]; if (P) parts.push(`Of the work committed last week, ${P.done} of ${P.n} got done (${P.pct}%).`);
  const procLate = R.procurement.filter(x => overdue('procurement', x)); if (procLate.length) parts.push(`${procLate.length} deliver${procLate.length > 1 ? 'ies' : 'y'} late.`);
  const tests = R.tests.filter(x => ['Pass', 'Pass with comments'].includes(x.result)); if (R.tests.length) parts.push(`Tests passed: ${tests.length} of ${R.tests.length}.`);
  const next = L.filter(r => (+r.t.is_milestone || r.dur === 0) && r.progress < 100 && r.ef >= now).sort((a, b) => a.ef < b.ef ? -1 : 1).slice(0, 3);
  const help = [...R.actions.filter(a => overdue('actions', a) && ['High', 'Critical'].includes(a.priority)).map(a => a.title), ...crit.map(r => `${r.t.title} (critical, late)`), ...R.issues.filter(i => !isClosed('issues', i) && i.priority === 'High').map(i => i.title)].slice(0, 4);
  const H = health(R, ST.PH.project);
  return { rag: H.label === 'Red' ? 'Off track' : H.label === 'Amber' ? 'At risk' : 'On track', done: parts.join(' '), next: next.length ? 'Next: ' + next.map(r => `${r.t.title} (${sdate(r.ef)})`).join('; ') + '.' : '', help: help.join('; ') };
}
function statusView(B) {
  const wk = isoWeek(isoToday()), all = sortRows('status_updates', REC('status_updates'), '-week'), cur = all.find(s => s.week === wk);
  const F = cur ? { ...cur } : { rag: '', done: '', next: '', help: '' };
  const RAGS = [['On track', 'Going to plan', 'g'], ['At risk', 'Could slip without help', 'a'], ['Off track', 'Slipping — help needed', 'r']];
  const ragBox = h('div', { class: 'wk-rag' }, RAGS.map(([k, s, c]) => h('button', { class: c + (F.rag === k ? ' on' : ''), onclick: e => { F.rag = k; [...ragBox.children].forEach(b => b.classList.toggle('on', b === e.currentTarget)); } }, h('b', {}, k), h('small', {}, s))));
  const ta = (k, ph, rows) => { const t = h('textarea', { rows, placeholder: ph }, F[k] || ''); t.oninput = () => F[k] = t.value; return t; };
  const tD = ta('done', 'What was done this week', 3), tN = ta('next', 'The next milestones, what starts', 2), tH = ta('help', 'What is blocked, who must decide', 2);
  B.append(h('div', { class: 'grid g2' },
    h('div', { class: 'card' }, h('h3', {}, 'This week’s status', h('span', { class: 'right tiny muted' }, wk + (cur ? ' · posted — change it if needed' : ''))), ragBox,
      h('label', { class: 'wk-f' }, 'What happened', tD), h('label', { class: 'wk-f' }, 'What is next', tN), h('label', { class: 'wk-f' }, 'Help needed', tH),
      h('div', { class: 'row', style: 'margin-top:10px' }, h('button', { class: 'btn sm', onclick: () => { const d = statusDraft(); Object.assign(F, d); tD.value = d.done; tN.value = d.next; tH.value = d.help; [...ragBox.children].forEach(b => b.classList.toggle('on', b.querySelector('b').textContent === d.rag)); toast('Drafted from the project — edit before posting'); } }, '✦ Draft it from the project'),
        h('span', { class: 'right' }), h('button', { class: 'btn', onclick: () => { const t = `${ST.PH.project.code} ${ST.PH.project.name} — status ${wk}: ${F.rag || '-'}\n\n${F.done}\n\n${F.next}${F.help ? '\n\nHelp needed: ' + F.help : ''}`; navigator.clipboard?.writeText(t); toast('Copied — paste into an email or Teams'); } }, 'Copy'),
        h('button', { class: 'btn pri', onclick: run(async () => { if (!F.rag) throw new Error('Pick On track, At risk or Off track'); const d = { week: wk, rag: F.rag, done: F.done, next: F.next, help: F.help, by: me(), posted: isoToday() };
          cur ? await DB.update('status_updates', cur.id, d) : await DB.create('status_updates', d); toast('Status posted'); rerender(); }) }, cur ? 'Update the status ›' : 'Post the status ›'))),
    h('div', {}, h('h3', { style: 'margin:2px 0 10px' }, 'Earlier updates'), all.length ? all.map(s => h('article', { class: 'wk-u ' + ({ 'On track': 'g', 'At risk': 'a', 'Off track': 'r' }[s.rag] || '') },
      h('header', {}, h('span', { class: 'wk-ub' }, s.rag), h('b', {}, s.week), h('small', {}, `${s.posted ? fdate(s.posted) : ''}${s.by ? ' · ' + s.by : ''}`)), s.done ? h('p', {}, s.done) : null, s.next ? h('p', { class: 'n' }, s.next) : null, s.help ? h('p', { class: 'hp' }, h('b', {}, 'Help: '), s.help) : null))
      : h('p', { class: 'note' }, 'None yet — the first one starts the history.'))));
}

/* ---- weekly review: one item at a time ---- */
function weeklyReview() {
  const now = isoToday(), L = collectWork().filter(x => x.due ? x.due <= addDays(sundayOf(now), 7) : x.can && !x.owner).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
  if (!L.length) return toast('Nothing due in the next two weeks — all clear');
  let i = 0; const ppl = people();
  const keys = e => { if (!$('#dlg').open || e.target.matches('input,select,textarea')) return; const k = e.key.toLowerCase(), btn = t => [...$$('#dlg .mf button, #dlg .mb button')].find(b => b.textContent.includes(t));
    if (k === 'enter') { e.preventDefault(); btn('Save & next')?.click(); } else if (k === 'd') btn('✓')?.click(); else if (k === 's') btn('Skip')?.click(); else if (k === 'w') btn('Push a week')?.click(); };
  document.addEventListener('keydown', keys);
  const draw = () => {
    const x = L[i]; if (!x) { closeModal(); celebrate('Review done', `${L.length} items gone through`); rerender(); return; }
    const [lab, col] = SRC[x.src] || [x.src, '#5b7da3'], d = x.due ? daysBetween(now, x.due) : null;
    const due = h('input', { type: 'date', value: x.due || '', style: 'width:160px' }), own = h('select', { style: 'width:auto' }, h('option', { value: '' }, 'No owner'), [...new Set([...ppl, x.owner].filter(Boolean))].map(p => h('option', { selected: p === x.owner }, p)));
    const dueField = { tasks: null, actions: 'due_date', issues: 'due_date', punch_items: 'due_date', rfis: 'required_by', deliverables: 'forecast_due', procurement: 'expected_delivery', tests: 'planned_date', meeting_items: 'due_date', reminders: 'remind_date' }[x.k];
    const saveAnd = run(async (extra = {}) => { const ch = { ...extra }; if (x.can && own.value !== (x.owner || '')) ch.owner = own.value || null; if (dueField && due.value && due.value !== x.due) ch[dueField] = due.value;
      if (Object.keys(ch).length) await DB.update(x.k, x.rec.id, ch); i++; draw(); });
    const dl = doneLabel(x);
    modal(`Weekly review · ${i + 1} of ${L.length}`, h('div', { class: 'rv' }, h('div', { class: 'rv-bar' }, h('i', { style: `width:${100 * i / L.length}%` })),
      h('div', { class: 'row', style: 'margin:12px 0 4px' }, h('span', { class: 'wk-src', style: `color:${col}` }, lab), x.crit ? chip('critical path', 'amber') : null, x.due ? chip(d < 0 ? `${-d} days late` : d === 0 ? 'due today' : `due in ${d} days`, d < 0 ? 'red' : d <= 7 ? 'amber' : 'blue') : chip('no date')),
      h('h2', { style: 'font-size:20px;margin:4px 0 6px' }, x.title), x.note ? h('p', { class: 'note' }, x.note) : null,
      x.src === 'task' ? h('div', { class: 'bar', style: 'margin:8px 0' }, h('i', { style: `width:${x.pct}%` })) : null,
      h('div', { class: 'row', style: 'margin-top:12px' }, x.can ? h('label', { class: 'row small' }, 'Owner', own) : null, dueField ? h('label', { class: 'row small' }, 'Due', due) : null,
        dueField ? h('button', { class: 'btn sm', onclick: () => { due.value = addDays(due.value || now, 7); } }, 'Push a week') : null)),
      [dl ? h('button', { class: 'btn pri', onclick: run(async () => { await doneItem(x); i++; draw(); }) }, `✓ ${dl}`) : null,
        x.src === 'task' ? h('button', { class: 'btn', onclick: () => { const pc = Math.min(100, (Math.floor((+x.rec.progress || 0) / 25) + 1) * 25); saveAnd({ progress: pc, ...progressSide(x.rec, pc) }); } }, '+25%') : null,
        h('button', { class: 'btn', onclick: () => saveAnd() }, 'Save & next ›'), h('button', { class: 'btn ghost', onclick: () => { i++; draw(); } }, 'Skip'),
        h('button', { class: 'btn ghost right', onclick: () => { closeModal(); openItem(x); } }, 'Open in full')].filter(Boolean),
      { icon: 'check', onclose: () => { document.removeEventListener('keydown', keys); rerender(); } });
    $('#dlg .mb').append(h('p', { class: 'tiny muted', style: 'margin-top:14px' }, 'Keys: Enter save & next · D done · S skip · W push a week'));
  };
  draw();
}
