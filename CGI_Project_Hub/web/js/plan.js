/* Schedule — interactive Gantt (ideas from the TMM implementation planner, im-plan.js):
   - the task list on the left, edited in place (name, owner, working days, waits-for, % done); groups fold;
   - a toolbar on the selected row: + task, + milestone, indent, outdent, move up/down, open, remove (WBS codes renumber
     and every "waits for" follows);
   - the bars on the right: drag to move (a start-no-earlier-than date), drag the end to stretch; click to open;
   - what waits for what, the critical path in orange, today, the target finish, the baseline beneath or as a ghost;
   - the task list's width dragged on the divider and kept in this browser. */
'use strict';
const PL = {
  zoom: localStorage.getItem('cgi-pl-zoom') || 'week', tab: 'gantt', sel: null,
  tw: Math.max(300, Math.min(1000, +localStorage.getItem('cgi-pl-tw') || 680)), tshow: localStorage.getItem('cgi-pl-ts') !== '0', cmp: localStorage.getItem('cgi-pl-cmp') === '1',
  fold: code => { try { return new Set(JSON.parse(localStorage.getItem('cgi-pl-fold-' + code) || '[]')); } catch (e) { return new Set(); } },
  keepFold: (code, f) => { try { localStorage.setItem('cgi-pl-fold-' + code, JSON.stringify([...f])); } catch (e) { } },
};
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };

/* ---- WBS tree operations: renumber codes, carry the links along ---- */
const wbsParts = w => String(w || '').split('.').filter(Boolean);
function wbsTree(tasks) {
  const T = sortRows('tasks', tasks, 'wbs'), nodes = new Map(T.map(t => [String(t.wbs), { t, kids: [] }])), roots = [];
  for (const t of T) { const p = wbsParts(t.wbs).slice(0, -1).join('.'); (nodes.get(p)?.kids || roots).push(nodes.get(String(t.wbs))); }
  return roots;
}
function renumber(roots) {   // -> Map(task.id -> new code)
  const out = new Map(), walk = (list, pre) => list.forEach((n, i) => { const c = pre ? `${pre}.${i + 1}` : String(i + 1); out.set(n.t.id, c); walk(n.kids, c); });
  walk(roots, ''); return out;
}
function relink(preds, oldToNew, gone) {
  return parsePreds(preds).filter(p => !gone.has(p.wbs) && oldToNew.has(p.wbs)).map(p => oldToNew.get(p.wbs) + (p.lag ? (p.lag > 0 ? '+' : '') + p.lag : '')).join(', ');
}
async function applyTree(roots, extra = {}, gone = new Set()) {
  const T = REC('tasks'), codes = renumber(roots), o2n = new Map(T.filter(t => codes.has(t.id)).map(t => [String(t.wbs), codes.get(t.id)]));
  const items = [];
  for (const t of T) { if (!codes.has(t.id)) continue;
    const w = codes.get(t.id), pr = relink(t.predecessors, o2n, gone), d = { ...(extra[t.id] || {}) };
    if (w !== String(t.wbs)) d.wbs = w; if ((pr || '') !== (t.predecessors || '')) d.predecessors = pr || null;
    if (Object.keys(d).length) items.push({ id: t.id, ...d }); }
  if (items.length) await DB.bulk('tasks', items);
  return codes;
}
function findNode(roots, id, parent = null) {
  for (let i = 0; i < roots.length; i++) { const n = roots[i]; if (n.t.id === id) return { list: roots, i, n, parent }; const r = findNode(n.kids, id, n); if (r) return r; }
  return null;
}

/* ---- the page ---- */
route('schedule', { title: 'Schedule', icon: 'gantt', group: 'Project', project: true, render: v => {
  const p = ST.PH.project, cpm = scheduleCPM(), changed = cpm.rows.filter(r => r.changed);
  const start = h('input', { type: 'date', value: p.start_date || '', style: 'width:150px', onchange: run(async e => { await DB.patchProject({ start_date: e.target.value || null }); rerender(); }) });
  const reschedule = run(async () => { const items = changed.map(r => ({ id: r.t.id, forecast_start: r.es, forecast_finish: r.ef })); if (!items.length) return toast('Dates already match the critical-path calculation');
    await DB.bulk('tasks', items); toast(`Saved new dates for ${items.length} task(s)`); rerender(); });
  const baseline = run(async () => { if (!confirm('Keep today\'s plan as the baseline? Every task\'s dates are copied; slip is measured against it.')) return;
    await DB.bulk('tasks', cpm.rows.filter(r => r.es).map(r => ({ id: r.t.id, baseline_start: r.es, baseline_finish: r.ef }))); toast('Baseline set'); rerender(); });
  const leaves = cpm.rows.filter(r => !r.summary), late = leaves.filter(r => r.late), crit = leaves.filter(r => r.critical).length;
  const slip = cpm.finish && cpm.baselineFinish ? workdays(cpm.baselineFinish, cpm.finish) : null;
  v.append(pageHead('Planning', 'Schedule & WBS', 'The work broken down, what waits for what, and the dates worked out on a Monday–Friday week. The critical path — the work that moves the finish — in orange. Drag a bar to move it, its end to stretch it; edit the list in place.',
    h('label', { class: 'row small' }, 'Project start', start),
    h('button', { class: 'btn', onclick: reschedule }, 'Reschedule' + (changed.length ? ` (${changed.length})` : '')), h('button', { class: 'btn', onclick: baseline }, 'Set baseline'),
    h('button', { class: 'btn', title: 'All dated tasks to Outlook', onclick: () => downloadICS(`${ST.code} schedule`, cpm.rows.filter(r => r.es && !r.summary).map(r => ({ uid: `${ST.code}-task-${r.t.id}`, title: `[${ST.code}] ${r.t.title}`, start: r.es, end: r.ef, desc: `${r.t.workstream || ''} ${r.t.owner || ''}`, alarm: false }))) }, icon('cal'), '.ics')));
  v.append(h('div', { class: 'mts' },
    mt('Start', p.start_date ? fdate(p.start_date) : '—', 'Mon–Fri week'),
    mt('Finish (forecast)', cpm.finish ? fdate(cpm.finish) : '—', slip == null ? 'no baseline yet' : slip > 0 ? `${slip} days later than the baseline` : slip < 0 ? `${-slip} days earlier than the baseline` : 'on the baseline', slip > 0),
    mt('Target', p.target_finish ? fdate(p.target_finish) : 'not set', p.target_finish && cpm.finish ? (cpm.finish > p.target_finish ? `${workdays(p.target_finish, cpm.finish)} work days over` : `${workdays(cpm.finish, p.target_finish)} work days spare`) : '', p.target_finish && cpm.finish > p.target_finish),
    mt('Critical', String(crit), 'no float'), mt('Complete', pct(cpm.progress), 'by duration'), mt('Behind', String(late.length), 'should have finished', late.length > 0)));
  if (cpm.errors.length) v.append(h('ul', { class: 'alerts', style: 'margin-bottom:10px' }, cpm.errors.map(e => h('li', { class: 'bad' }, e))));
  if (changed.length) v.append(h('ul', { class: 'alerts', style: 'margin-bottom:10px' }, h('li', { class: 'warn', onclick: reschedule }, `${changed.length} task date(s) differ from the critical-path calculation — predecessors moved or durations changed. Click to save the calculated dates.`)));
  v.append(h('div', { class: 'seg', style: 'margin-bottom:12px' }, [['gantt', 'Gantt'], ['lanes', 'Workstreams'], ['miles', 'Milestones'], ['table', 'Task table']].map(([k, l]) => h('button', { class: PL.tab === k ? 'on' : '', onclick: () => { PL.tab = k; rerender(); } }, l))));
  const B = h('div'); v.append(B);
  if (!REC('tasks').length) { B.append(empty('No schedule yet', 'Add the first task, or create the project from a template (EC&I standard or Telemetry) to start with a full WBS.', h('button', { class: 'btn pri', onclick: () => planAdd(false) }, icon('plus'), 'Add the first task'))); return; }
  if (PL.tab === 'lanes') { B.append(gantt(cpm, { zoom: PL.zoom, group: 'workstream', until: p.target_finish })); B.append(h('div', { class: 'legend' }, Object.entries(WS_COLORS).map(([w, c]) => h('span', {}, h('i', { style: `background:${c}` }), w)))); return; }
  if (PL.tab === 'miles') { B.append(milestoneView(cpm)); return; }
  if (PL.tab === 'table') { B.append(registerBlock('tasks', { onRow: openTask, presets: () => ({ wbs: nextWbs(), progress: 0 }) })); return; }
  B.append(planGantt(cpm));
} });
const mt = (l, v, s, warn) => h('div', { class: 'mt' + (warn ? ' warn' : '') }, h('span', { class: 'mt-l' }, l), h('b', {}, v), h('span', { class: 'mt-s' }, s || ''));

function milestoneView(cpm) {
  const ms = cpm.rows.filter(r => !r.summary && (+r.t.is_milestone || r.dur === 0));
  if (!ms.length) return empty('No milestones yet', 'Tick “Milestone” on a task (no duration) — handover, FAT, lock-down…');
  return h('div', { class: 'ms-list' }, ms.map(r => { const bl = r.t.baseline_finish, d = bl && r.ef ? workdays(bl, r.ef) : null, done = r.progress >= 100;
    return h('div', { class: 'ms-r' + (done ? ' done' : r.late ? ' late' : ''), onclick: () => openTask(r.t) }, h('span', { class: 'ms-dia' }, '◆'),
      h('div', { class: 'grow' }, h('b', {}, r.t.title), h('div', { class: 'tiny muted' }, `${r.t.wbs} · ${r.t.workstream || ''}`)),
      h('div', { class: 'num' }, h('b', {}, r.ef ? ddate(r.ef) : 'not dated'), h('div', { class: 'tiny muted' }, done ? 'reached' : r.ef ? relDays(r.ef) : '')),
      h('div', { class: 'num', style: 'width:130px' }, bl ? chip(d > 0 ? `+${d} days vs baseline` : d < 0 ? `${d} days vs baseline` : 'on baseline', d > 0 ? 'red' : 'green') : h('span', { class: 'tiny muted' }, 'no baseline')),
      done ? chip('Reached', 'green') : h('button', { class: 'btn sm', onclick: run(async ev => { ev.stopPropagation(); await DB.update('tasks', r.t.id, { progress: 100, status: 'Complete', actual_finish: isoToday() }); celebrate('Milestone reached', r.t.title); rerender(); }) }, 'Reached ✓')); }));
}

/* ---- the interactive Gantt ---- */
function planGantt(cpm) {
  const code = ST.code, fold = PL.fold(code), ROWH = 30, HEADH = 46, ppd = { day: 26, week: 9, month: 3.2 }[PL.zoom];
  const hasKids = new Set(cpm.rows.filter(r => r.summary).map(r => String(r.t.wbs)));
  const hidden = r => { const ps = wbsParts(r.t.wbs); for (let i = 1; i < ps.length; i++) if (fold.has(ps.slice(0, i).join('.'))) return true; return false; };
  const vis = cpm.rows.filter(r => !hidden(r)), now = isoToday(), p = ST.PH.project;
  const ds = vis.flatMap(r => [r.es, r.ef, r.t.baseline_start, r.t.baseline_finish]).filter(Boolean).sort();
  const t0 = addDays(ds[0] || p.start_date || now, -4), t1 = addDays([ds[ds.length - 1] || now, now, p.target_finish || now].sort().pop(), 18), days = daysBetween(t0, t1) + 1;
  const X = s => daysBetween(t0, s) * ppd, Wd = days * ppd, H = HEADH + vis.length * ROWH, row = new Map(vis.map((r, i) => [String(r.t.wbs), i]));
  const ppl = people();
  // header & grid
  const svg = S('svg', { class: 'pl-svg', width: Wd, height: H, viewBox: `0 0 ${Wd} ${H}` });
  svg.append(S('defs', {}, S('marker', { id: 'plArr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: 'auto' }, S('path', { d: 'M0 0L8 4L0 8z', class: 'pl-ah' }))));
  svg.append(S('rect', { class: 'pl-hd', width: Wd, height: HEADH }));
  for (let d = t0; d <= t1; d = addDays(d, 1)) { const dd = D0(d), x = X(d);
    if (!isWork(dd) && ppd >= 6) svg.append(S('rect', { class: 'pl-off', x, y: HEADH, width: ppd, height: H - HEADH }));
    if (dd.getDate() === 1 || d === t0) svg.append(S('text', { class: 'pl-mo', x: x + 4, y: 16 }, `${MON[dd.getMonth()]} ${dd.getFullYear()}`), S('path', { class: 'pl-ln', d: `M${x} 0V${H}` }));
    if (PL.zoom === 'day') svg.append(S('text', { class: 'pl-dy', x: x + ppd / 2, y: 38, 'text-anchor': 'middle' }, dd.getDate()));
    else if (PL.zoom === 'week' && dd.getDay() === 1) svg.append(S('text', { class: 'pl-dy', x: x + 2, y: 38 }, dd.getDate()), S('path', { class: 'pl-wk', d: `M${x} 24V${H}` }));
  }
  vis.forEach((r, i) => { if (PL.sel === r.t.id) svg.append(S('rect', { class: 'pl-hl', y: HEADH + i * ROWH, width: Wd, height: ROWH })); });
  if (now >= t0 && now <= t1) svg.append(S('path', { class: 'pl-now', d: `M${X(now) + ppd / 2} 24V${H}` }), S('text', { class: 'pl-nowt', x: X(now) + ppd / 2 + 3, y: H - 4 }, 'today'));
  if (p.target_finish && p.target_finish >= t0 && p.target_finish <= t1) svg.append(S('path', { class: 'pl-tgt', d: `M${X(p.target_finish) + ppd} 24V${H}` }), S('text', { class: 'pl-tgtt', x: X(p.target_finish) + ppd - 3, y: 34, 'text-anchor': 'end' }, 'target'));
  // links
  for (const r of vis) { if (r.summary || !r.es) continue;
    for (const pr of parsePreds(r.t.predecessors)) { const i = row.get(pr.wbs), j = row.get(String(r.t.wbs)); if (i == null) continue; const a = vis[i]; if (!a.ef || a.summary) continue;
      const x1 = a.dur ? X(a.ef) + ppd : X(a.es) + ppd / 2 + 8, y1 = HEADH + i * ROWH + 15, x2 = X(r.es) + (r.dur ? 0 : ppd / 2 - 8), y2 = HEADH + j * ROWH + 15;
      svg.append(S('path', { class: 'pl-dep' + (a.critical && r.critical ? ' crit' : ''), 'marker-end': 'url(#plArr)', d: x2 - x1 >= 10 ? `M${x1} ${y1}H${x1 + 5}V${y2}H${x2}` : `M${x1} ${y1}H${x1 + 5}V${y1 + (y2 > y1 ? 15 : -15)}H${x2 - 6}V${y2}H${x2}` })); } }
  // bars
  vis.forEach((r, i) => { const t = r.t, y = HEADH + i * ROWH;
    if (!r.es || !r.ef) { if (!r.summary) svg.append(S('text', { class: 'pl-un', x: Math.max(6, X(now) - 60), y: y + 19 }, 'not scheduled — set days or a start')); return; }
    const a = X(r.es), b = X(r.ef) + ppd, bl = t.baseline_start && t.baseline_finish ? t : null;
    const tip = S('title', {}, `${t.wbs} ${t.title}\n${fdate(r.es)} → ${fdate(r.ef)} · ${r.dur ?? 0} working day(s) · ${Math.round(r.progress)}% done${t.owner ? '\nOwner: ' + t.owner : ''}\n${r.critical ? 'Critical — no float' : r.float != null ? r.float + ' working days of float' : ''}${bl ? `\nBaseline finish ${fdate(t.baseline_finish)}` : ''}\nClick to open · drag to move · drag the end to stretch`);
    if (bl && !r.summary) svg.append(PL.cmp ? S('rect', { class: 'pl-ghost', x: X(t.baseline_start), y: y + 4, width: Math.max(4, X(t.baseline_finish) + ppd - X(t.baseline_start)), height: 21, rx: 5 })
      : S('rect', { class: 'pl-base', x: X(t.baseline_start), y: y + 23, width: Math.max(2, X(t.baseline_finish) + ppd - X(t.baseline_start)), height: 3 }));
    let g;
    if (r.summary) g = S('path', { class: 'pl-sum', d: `M${a} ${y + 9}H${b}V${y + 19}l-5 -4H${a + 5}l-5 4z` }, tip);
    else if (+t.is_milestone || r.dur === 0) g = S('path', { class: 'pl-ms' + (r.critical ? ' crit' : '') + (r.progress >= 100 ? ' done' : '') + (r.late ? ' late' : ''), 'data-id': t.id, d: `M${a + ppd / 2} ${y + 6}l8 8l-8 8l-8 -8z` }, tip);
    else { const c = wsColor(t.workstream); g = S('g', { class: 'pl-bar' + (r.critical ? ' crit' : '') + (r.late ? ' late' : ''), 'data-id': t.id, style: `--c:${c}` },
      S('rect', { class: 'pl-bg', x: a, y: y + 7, width: b - a, height: 15, rx: 4 }), S('rect', { class: 'pl-pg', x: a, y: y + 7, width: (b - a) * r.progress / 100, height: 15, rx: 4 }), S('rect', { class: 'pl-grip', x: b - 7, y: y + 7, width: 9, height: 15 }), tip); }
    svg.append(g);
    const sl = PL.cmp && bl && !r.summary ? workdays(t.baseline_finish, r.ef) : 0;
    const lab = PL.tshow ? (!r.summary ? (t.owner || '') : '') : `${t.title}${!r.summary && t.owner ? ' · ' + t.owner : ''}`;
    if (lab || sl) { const tx = S('text', { class: 'pl-lab', x: Math.max(r.dur ? b : a + ppd / 2 + 10, PL.cmp && bl ? X(t.baseline_finish) + ppd : 0) + 5, y: y + 19 });
      if (sl) tx.append(S('tspan', { class: sl > 0 ? 'pl-late' : 'pl-early' }, `${sl > 0 ? '+' : ''}${sl}d `)); tx.append(document.createTextNode(lab)); svg.append(tx); }
  });
  // task list
  const head = h('div', { class: 'pl-h' }, ['WBS', 'Task', 'Owner', 'Days', 'Start', 'Finish', 'Waits for', '%'].map(x => h('span', {}, x)));
  const list = h('div', { class: 'pl-t', role: 'grid' }, head, vis.map(r => {
    const t = r.t, sum = r.summary, lv = (r.level || 1) - 1;
    const inp = (f, val, attrs = {}) => { const el = h('input', { 'data-f': f, value: val ?? '', ...attrs }); el.defaultValue = val ?? ''; return el; };
    return h('div', { class: 'pl-r' + (sum ? ' sum' : '') + (PL.sel === t.id ? ' sel' : '') + (r.critical ? ' crit' : '') + (r.late ? ' late' : ''), 'data-id': t.id },
      h('span', { class: 'pl-c' }, t.wbs),
      h('span', { class: 'pl-n', style: `padding-left:${lv * 14}px` }, hasKids.has(String(t.wbs)) ? h('button', { class: 'pl-tw', 'data-fold': t.wbs, title: fold.has(String(t.wbs)) ? 'Open' : 'Fold' }, fold.has(String(t.wbs)) ? '▸' : '▾') : h('i', { class: 'pl-tw' }),
        +t.is_milestone ? h('span', { class: 'pl-msi' }, '◆') : null, inp('title', t.title, { 'aria-label': 'Task' })),
      sum ? h('span') : inp('owner', t.owner, { list: 'pl-people', placeholder: '–' }),
      sum ? h('span', { class: 'pl-v' }, r.es && r.ef ? workdays(r.es, r.ef) + 1 : '') : inp('duration_days', t.duration_days ?? '', { type: 'number', min: 0, step: 1, placeholder: '–' }),
      h('span', { class: 'pl-v' }, r.es ? sdate(r.es) : ''), h('span', { class: 'pl-v' + (r.late ? ' bad' : '') }, r.ef ? sdate(r.ef) : ''),
      sum ? h('span') : inp('predecessors', t.predecessors, { placeholder: '–', title: 'WBS codes it waits for, lag after +, e.g. 2.1, 3.3+2' }),
      sum ? h('span', { class: 'pl-v' }, Math.round(r.progress)) : inp('progress', t.progress ?? 0, { type: 'number', min: 0, max: 100, step: 5 }));
  }));
  const split = h('div', { class: 'pl-split', role: 'separator', tabindex: 0, title: 'Drag to resize the task list (double-click to reset)' });
  const chart = h('div', { class: 'pl-s' }, svg);
  const grid = h('div', { class: 'pl-g' + (PL.tshow ? '' : ' notable'), style: `--tw:${PL.tw}px` }, list, split, chart);
  const tb = (label, op, title, cls = '') => h('button', { class: 'btn sm ' + cls, title, onclick: () => planOp(op) }, label);
  const tools = h('div', { class: 'pl-tools' },
    h('button', { class: 'btn sm pri', onclick: () => planAdd(false) }, '+ Task'), h('button', { class: 'btn sm', onclick: () => planAdd(true) }, '+ Milestone'), h('span', { class: 'pl-sep' }),
    tb('⇤', 'out', 'Outdent: up a level'), tb('⇥', 'in', 'Indent: under the task above'), tb('↑', 'up', 'Move up'), tb('↓', 'down', 'Move down'), tb('Open', 'open', 'Open the task (or double-click a row)'), tb('Remove', 'del', 'Remove the task', 'danger'),
    h('span', { class: 'grow' }),
    h('button', { class: 'btn sm' + (PL.tshow ? ' on' : ''), title: 'Show or hide the task list', onclick: () => { PL.tshow = !PL.tshow; lsSet('cgi-pl-ts', PL.tshow ? '1' : '0'); rerender(); } }, '◫ Task list'),
    h('button', { class: 'btn sm' + (PL.cmp ? ' on' : ''), title: 'The baseline as a ghost of each bar, and the days each has moved', onclick: () => { PL.cmp = !PL.cmp; lsSet('cgi-pl-cmp', PL.cmp ? '1' : '0'); rerender(); } }, (PL.cmp ? '✓ ' : '') + 'Planned vs actual'),
    h('span', { class: 'seg sm' }, ['day', 'week', 'month'].map(z => h('button', { class: PL.zoom === z ? 'on' : '', onclick: () => { PL.zoom = z; lsSet('cgi-pl-zoom', z); rerender(); } }, z[0].toUpperCase() + z.slice(1)))));
  const wrap = h('div', {}, tools, h('datalist', { id: 'pl-people' }, ppl.map(n => h('option', { value: n }))), grid,
    h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#e07b24' }), 'critical path'), h('span', {}, h('i', { style: 'background:#b9c4d0;height:3px' }), 'baseline'), h('span', {}, '◆ milestone'),
      h('span', {}, 'Waits for: WBS codes, a lag after + (e.g. 1.2, 2.3+2). Bars take their workstream colour.')));
  // ---- wiring
  setTimeout(() => { chart.scrollLeft = Math.max(0, X(now) - 220); }, 0);
  list.querySelectorAll('.pl-r').forEach(el => { const id = +el.dataset.id;
    el.addEventListener('click', () => { if (PL.sel === id) return; PL.sel = id; list.querySelectorAll('.pl-r').forEach(x => x.classList.toggle('sel', x === el)); svg.querySelectorAll('.pl-hl').forEach(x => x.remove()); const i = vis.findIndex(r => r.t.id === id); svg.insertBefore(S('rect', { class: 'pl-hl', y: HEADH + i * ROWH, width: Wd, height: ROWH }), svg.children[2]); });
    el.addEventListener('dblclick', e => { if (!e.target.matches('input')) openTask(byId('tasks', id)); }); });
  list.querySelectorAll('[data-fold]').forEach(b => b.onclick = e => { e.stopPropagation(); const k = b.dataset.fold; fold.has(k) ? fold.delete(k) : fold.add(k); PL.keepFold(code, fold); rerender(); });
  list.querySelectorAll('.pl-r input').forEach(inp => {
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } if (e.key === 'Escape') { inp.value = inp.defaultValue; inp.blur(); } });
    inp.addEventListener('change', run(async () => { const id = +inp.closest('.pl-r').dataset.id, t = byId('tasks', id), f = inp.dataset.f; if (!t) return; let val = inp.value.trim(); const d = {};
      if (f === 'title') { if (!val) { inp.value = t.title; return; } d.title = val; }
      else if (f === 'owner') d.owner = val || null;
      else if (f === 'duration_days') { d.duration_days = val === '' ? null : Math.max(0, Math.round(+val)); if (t.forecast_start && d.duration_days) d.forecast_finish = addWork(t.forecast_start, d.duration_days - 1); }
      else if (f === 'progress') { const pc = Math.max(0, Math.min(100, Math.round(+val || 0))); Object.assign(d, { progress: pc }, progressSide(t, pc)); }
      else if (f === 'predecessors') { const codes = new Set(REC('tasks').map(x => String(x.wbs))), P = parsePreds(val), bad = val.split(/[,;]+/).map(x => x.trim()).filter(Boolean).filter(x => !(x.match(/^([\d.]+)/) && codes.has(x.match(/^([\d.]+)/)[1])) || x.startsWith(String(t.wbs)));
        if (bad.length) toast(`Not a task code: ${bad.join(', ')}`, true); d.predecessors = P.filter(x => codes.has(x.wbs) && x.wbs !== String(t.wbs)).map(x => x.wbs + (x.lag ? (x.lag > 0 ? '+' : '') + x.lag : '')).join(', ') || null; }
      await DB.update('tasks', id, d); if (f === 'progress' && d.progress >= 100) celebrate(+t.is_milestone ? 'Milestone reached' : 'Task complete', t.title); rerender(); }));
  });
  // divider
  let dg = null;
  split.onpointerdown = e => { dg = { x: e.clientX, w: PL.tw }; split.setPointerCapture(e.pointerId); split.classList.add('on'); e.preventDefault(); };
  split.onpointermove = e => { if (!dg) return; PL.tw = Math.max(300, Math.min(1000, Math.round(dg.w + e.clientX - dg.x))); grid.style.setProperty('--tw', PL.tw + 'px'); };
  split.onpointerup = split.onpointercancel = () => { if (!dg) return; dg = null; split.classList.remove('on'); lsSet('cgi-pl-tw', PL.tw); };
  split.onkeydown = e => { if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault(); PL.tw = Math.max(300, Math.min(1000, PL.tw + (e.key === 'ArrowRight' ? 40 : -40))); grid.style.setProperty('--tw', PL.tw + 'px'); lsSet('cgi-pl-tw', PL.tw); };
  split.ondblclick = () => { PL.tw = 680; grid.style.setProperty('--tw', '680px'); lsSet('cgi-pl-tw', 680); };
  // drag bars
  let bd = null;
  svg.addEventListener('pointerdown', e => { const g = e.target.closest('.pl-bar, .pl-ms'); if (!g) return; const id = +g.dataset.id;
    bd = { id, g, x0: e.clientX, mode: e.target.classList.contains('pl-grip') ? 'end' : 'move', dx: 0, w0: null }; PL.sel = id; svg.setPointerCapture(e.pointerId); e.preventDefault(); });
  svg.addEventListener('pointermove', e => { if (!bd) return; bd.dx = e.clientX - bd.x0; const n = Math.round(bd.dx / ppd) * ppd;
    if (bd.mode === 'move') bd.g.setAttribute('transform', `translate(${n} 0)`);
    else { const rc = bd.g.querySelector('.pl-bg'); if (bd.w0 == null) bd.w0 = +rc.getAttribute('width'); rc.setAttribute('width', Math.max(ppd, bd.w0 + n)); } });
  svg.addEventListener('pointerup', run(async () => { if (!bd) return; const { id, mode } = bd, dd = Math.round(bd.dx / ppd); bd = null; const t = byId('tasks', id), r = cpm.rows.find(x => x.t.id === id);
    if (!dd) { openTask(t); return; }
    if (mode === 'move') { let s = addDays(r.es, dd); if (r.dur && !isWork(D0(s))) s = addWork(s, 0); const f = r.dur ? addWork(s, r.dur - 1) : s;
      await DB.update('tasks', id, { forecast_start: s, forecast_finish: f }); const after = scheduleCPM().rows.find(x => x.t.id === id);
      toast(after && after.es > s ? `It waits for its predecessors — earliest ${fdate(after.es)}` : `${t.title}: starts no earlier than ${fdate(s)}`); }
    else { const f = addDays(r.ef, dd), n = Math.max(1, workdays(r.es, f) + (isWork(D0(f)) ? 1 : 0)); await DB.update('tasks', id, { duration_days: n, forecast_start: r.es, forecast_finish: addWork(r.es, n - 1) }); toast(`${t.title}: ${n} working days`); }
    rerender(); }));
  return wrap;
}
const progressSide = (t, pc) => { const d = {}; if (pc >= 100) { d.status = 'Complete'; d.actual_finish = t.actual_finish || isoToday(); if (!t.actual_start) d.actual_start = t.forecast_start && t.forecast_start <= isoToday() ? t.forecast_start : isoToday(); }
  else if (pc > 0) { if (!t.status || t.status === 'Not started' || t.status === 'Complete') d.status = 'In progress'; if (!t.actual_start) d.actual_start = isoToday(); d.actual_finish = null; } return d; };

async function planAdd(ms) {
  const T = REC('tasks'), sel = byId('tasks', PL.sel), roots = wbsTree(T);
  const cr = await DB.create('tasks', { title: ms ? 'New milestone' : 'New task', wbs: 'zz-new', duration_days: ms ? 0 : 5, is_milestone: ms ? 1 : 0, progress: 0, status: 'Not started', workstream: sel?.workstream || null,
    predecessors: sel && !REC('tasks').some(x => String(x.wbs).startsWith(String(sel.wbs) + '.')) ? String(sel.wbs) : null });
  const node = { t: cr, kids: [] }, f = sel ? findNode(roots, sel.id) : null;
  if (f) { const isSum = f.n.kids.length > 0; if (isSum) f.n.kids.push(node); else f.list.splice(f.i + 1, 0, node); } else roots.push(node);
  const codes = await applyTree(roots); PL.sel = cr.id; rerender();
  setTimeout(() => { const inp = document.querySelector(`.pl-r[data-id="${cr.id}"] input[data-f="title"]`); if (inp) { inp.focus(); inp.select(); } }, 60);
  return codes;
}
async function planOp(op) {
  const t = byId('tasks', PL.sel); if (!t) return toast('Click a task row first', true);
  if (op === 'open') return openTask(t);
  const roots = wbsTree(REC('tasks')), f = findNode(roots, t.id); if (!f) return;
  if (op === 'in') { if (f.i < 1) return toast('Nothing above it to go under', true); const P = f.list[f.i - 1]; f.list.splice(f.i, 1); P.kids.push(f.n); const fd = PL.fold(ST.code); fd.delete(String(P.t.wbs)); PL.keepFold(ST.code, fd); }
  else if (op === 'out') { if (!f.parent) return toast('Already at the top level', true); const g = findNode(roots, f.parent.t.id); f.list.splice(f.i, 1); g.list.splice(g.i + 1, 0, f.n); }
  else if (op === 'up' || op === 'down') { const j = op === 'up' ? f.i - 1 : f.i + 1; if (j < 0 || j >= f.list.length) return; [f.list[f.i], f.list[j]] = [f.list[j], f.list[f.i]]; }
  else if (op === 'del') { const gone = [], mark = n => { gone.push(n.t); n.kids.forEach(mark); }; mark(f.n);
    if (!confirm(gone.length > 1 ? `Remove “${t.title}” and the ${gone.length - 1} task(s) under it?` : `Remove “${t.title}”?`)) return;
    f.list.splice(f.i, 1); for (const x of gone) await DB.remove('tasks', x.id); PL.sel = null;
    await applyTree(roots, {}, new Set(gone.map(x => String(x.wbs)))); toast('Removed'); return rerender(); }
  await applyTree(roots); rerender();
}

/* a small moment of delight when something is finished */
function celebrate(title, sub) {
  const el = h('div', { class: 'cele' }, h('div', { class: 'cele-in' }, h('span', { class: 'cele-ck' }, '✓'), h('b', {}, title), sub ? h('small', {}, sub) : null));
  for (let i = 0; i < 18; i++) el.append(h('i', { class: 'conf', style: `--x:${(Math.random() * 2 - 1) * 180}px;--y:${-60 - Math.random() * 140}px;--r:${Math.random() * 540}deg;--d:${(.5 + Math.random() * .5).toFixed(2)}s;background:${['#005093', '#2f8fdb', '#e07b24', '#1d8a5b', '#7fc0ff'][i % 5]}` }));
  document.body.append(el); setTimeout(() => el.remove(), 1900);
}
