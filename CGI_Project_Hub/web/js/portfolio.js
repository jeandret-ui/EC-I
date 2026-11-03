/* Portfolio: all projects, My work (agenda), Calendar, reminders. */
'use strict';

/* ---------------- events & agenda items for one project ---------------- */
function eventsFor(rec, project, code) {
  const ev = [], add = (o) => ev.push({ code, color: projColor(project), ...o });
  const cpm = scheduleCPM(rec, project);
  for (const r of cpm.rows) {
    if (r.summary || !r.es) continue;
    if (+r.t.is_milestone || r.dur === 0) add({ date: r.ef, type: 'ms', title: '◆ ' + r.t.title, k: 'tasks', r: r.t, done: r.progress >= 100 });
    else if ((r.dur || 0) <= 5) { let d = r.es; while (d && d <= r.ef) { if (isWork(D0(d))) add({ date: d, type: 'task', title: r.t.title, k: 'tasks', r: r.t, done: r.progress >= 100 }); d = addDays(d, 1); } }
    else { add({ date: r.es, type: 'task', title: '▶ ' + r.t.title, k: 'tasks', r: r.t }); add({ date: r.ef, type: 'task', title: '■ ' + r.t.title, k: 'tasks', r: r.t, done: r.progress >= 100 }); }
  }
  const map = [['meetings', 'meeting_date', 'meet'], ['actions', 'due_date', 'act'], ['reminders', 'remind_date', 'rem'], ['procurement', 'expected_delivery', 'proc'], ['tests', 'planned_date', 'test'],
    ['po_milestones', 'due_date', 'pay'], ['deliverables', 'forecast_due', 'act'], ['rfis', 'required_by', 'act'], ['punch_items', 'due_date', 'act']];
  for (const [k, f, type] of map) for (const r of rec[k] || []) if (r[f]) {
    const closed = isClosed(k, r); if (closed && k !== 'meetings') continue;
    const od = k !== 'meetings' && r[f] < isoToday();
    add({ date: r[f], type: od ? 'od' : type, title: (k === 'meetings' && r.start_time ? r.start_time + ' ' : '') + (k === 'procurement' ? 'Delivery: ' : k === 'po_milestones' ? 'Payment: ' : '') + titleOf(k, r), k, r, time: r.start_time || r.remind_time });
  }
  return ev;
}
function openEvent(e) {
  if (e.code !== ST.code) { loadProject(e.code).then(() => openEventHere(e)); } else openEventHere(e);
}
function openEventHere(e) { if (e.k === 'tasks') openTask(e.r); else if (e.k === 'meetings') go('meetings', { id: e.r.id }, e.code); else openForm(e.k, byId(e.k, e.r.id) || e.r); }

/* ---------------- portfolio ---------------- */
route('portfolio', { title: 'Portfolio', icon: 'grid', group: 'Portfolio', render: renderPortfolio });
async function renderPortfolio(v) {
  const P = await loadPortfolio(true), t = isoToday();
  const live = P.filter(x => !['Archived'].includes(x.project.status));
  const rows = live.map(x => ({ ...x, H: health(fillRec(x.records), x.project) }));
  const totC = rows.reduce((s, x) => s + x.H.C.contract, 0), active = rows.filter(x => ['Active', 'Planning'].includes(x.project.status));
  const openA = rows.reduce((s, x) => s + x.H.openActions, 0), od = rows.reduce((s, x) => s + x.H.overdue, 0);
  const evs = rows.flatMap(x => eventsFor(x.records, x.project, x.project.code));
  const soon = evs.filter(e => e.date >= t && e.date <= addDays(t, 14) && ['ms', 'meet', 'test', 'proc', 'pay', 'rem'].includes(e.type)).sort((a, b) => a.date < b.date ? -1 : 1);
  v.append(h('div', { class: 'hero' }, h('div', { class: 'eyebrow' }, 'CGI · Controlgear Instramac'), h('h1', {}, 'Project portfolio'),
    h('p', {}, `${active.length} active project${active.length === 1 ? '' : 's'} · ${ddate(t)} · all data in ${ST.cfg.storage}`),
    h('div', { class: 'acts' }, h('button', { class: 'btn', onclick: () => newProjectDialog() }, icon('plus'), 'New project'), h('button', { class: 'btn', onclick: () => go('quotes') }, icon('reg'), 'Quote register'))));
  v.append(h('div', { class: 'kpis' }, kpi('Active projects', String(active.length), `${live.length} in total`), kpi('Contract value', kmoney(totC), 'client POs + approved variations'),
    kpi('Open actions', String(openA), od ? `${od} overdue` : 'none overdue', od ? 'bad' : 'good', () => go('agenda')),
    kpi('Next 14 days', String(soon.length), 'milestones, meetings, tests, deliveries', '', () => go('calendar')),
    kpi('Health', `${rows.filter(x => x.H.label === 'Green').length} · ${rows.filter(x => x.H.label === 'Amber').length} · ${rows.filter(x => x.H.label === 'Red').length}`, 'green · amber · red')));
  const cards = h('div', { class: 'pcards' });
  for (const x of rows) {
    const p = x.project, H = x.H, prog = H.cpm.progress;
    cards.append(h('div', { class: 'pcard', onclick: () => go('overview', {}, p.code) }, h('div', { class: 'stripe', style: `background:${projColor(p)}` }),
      h('div', { class: 'row' }, h('span', { class: 'code' }, p.code), chip(p.status, p.status === 'Active' ? 'blue' : ''), (() => { const st = sortRows('status_updates', x.records.status_updates || [], '-week')[0]; return st ? chip(`${st.rag} · ${st.week.slice(5)}`, { 'On track': 'green', 'At risk': 'amber', 'Off track': 'red' }[st.rag]) : null; })(), h('span', { class: 'right' }, ragOf(H.label))),
      h('h3', {}, p.name), h('div', { class: 'note' }, [p.client_name, p.site].filter(Boolean).join(' · ') || '—'),
      h('div', { class: 'stats' }, h('div', {}, h('span', {}, 'Progress'), h('b', {}, pct(prog))), h('div', {}, h('span', {}, 'Open actions'), h('b', { style: H.overdue ? 'color:var(--red)' : '' }, `${H.openActions}${H.overdue ? ' · ' + H.overdue + ' late' : ''}`)),
        h('div', {}, h('span', {}, 'Contract'), h('b', {}, kmoney(H.C.contract)))),
      h('div', { class: 'bar' + (H.label === 'Red' ? ' red' : H.label === 'Amber' ? ' amber' : ' green') }, h('i', { style: `width:${Math.min(100, prog)}%` })),
      h('div', { class: 'next' }, H.nextMs ? ['Next milestone: ', h('b', {}, H.nextMs.t.title), ` · ${ddate(H.nextMs.ef)} (${relDays(H.nextMs.ef)})`] : 'No upcoming milestone',
        p.target_finish ? h('div', { class: 'tiny muted' }, `Target finish ${fdate(p.target_finish)} · forecast ${H.cpm.finish ? fdate(H.cpm.finish) : '—'}`) : null)));
  }
  cards.append(h('div', { class: 'pcard', style: 'display:grid;place-items:center;border-style:dashed;min-height:200px;color:var(--muted)', onclick: () => newProjectDialog() }, h('div', { style: 'text-align:center' }, h('div', { style: 'font-size:28px' }, '+'), h('b', {}, 'New project'), h('div', { class: 'small' }, 'From the quote register or a template'))));
  v.append(h('div', { class: 'grid g21' }, h('div', {}, cards, rows.length ? portfolioTimeline(rows) : null),
    h('div', { class: 'grid', style: 'align-content:start' }, h('div', { class: 'card' }, h('h3', {}, icon('cal'), 'Coming up (14 days)'), agendaList(soon.slice(0, 14).map(e => ({ ...e, due: e.date })), true)),
      h('div', { class: 'card' }, h('h3', {}, icon('risk'), 'Needs attention'), alertList(rows.flatMap(x => { const al = alerts(fillRec(x.records), x.project, x.project.code).filter(a => a.lvl !== 'info'); return [...al.slice(0, 3), ...(al.length > 3 ? [{ lvl: 'info', text: `+ ${al.length - 3} more`, open: () => go('overview', {}, x.project.code) }] : [])].map(a => ({ ...a, text: `${x.project.code} · ${a.text}` })); }), 12)))));
}
const fillRec = rec => { for (const k of Object.keys(ST.E)) rec[k] = rec[k] || []; return rec; };
function portfolioTimeline(rows) {
  const t = isoToday(), items = rows.map(x => ({ p: x.project, s: x.H.cpm.rows.map(r => r.es).filter(Boolean).sort()[0] || x.project.start_date, f: x.H.cpm.finish || x.project.target_finish, prog: x.H.cpm.progress })).filter(i => i.s && i.f);
  if (!items.length) return null;
  const a = items.map(i => i.s).sort()[0], b = items.map(i => i.f).sort().pop(), span = Math.max(30, daysBetween(a, b) + 14), X = d => 100 * daysBetween(a, d) / span;
  const months = []; let m = D0(a); m.setDate(1); while (iso(m) <= b) { months.push(iso(m)); m.setMonth(m.getMonth() + 1); }
  return h('div', { class: 'card', style: 'margin-top:16px' }, h('h3', {}, icon('gantt'), 'Portfolio timeline'),
    h('div', { style: 'position:relative;height:18px;margin-left:120px;border-bottom:1px solid var(--line)' }, months.map(mm => X(mm) >= 0 ? h('span', { class: 'tiny muted', style: `position:absolute;left:${X(mm)}%` }, `${MON[D0(mm).getMonth()]} ${String(D0(mm).getFullYear()).slice(2)}`) : null)),
    items.map(i => h('div', { style: 'display:flex;align-items:center;margin:8px 0;cursor:pointer', onclick: () => go('schedule', {}, i.p.code) }, h('div', { class: 'small', style: 'width:120px;font-weight:600' }, i.p.code),
      h('div', { style: 'position:relative;flex:1;height:16px;background:var(--line-2);border-radius:5px' },
        h('div', { title: `${i.p.name}: ${fdate(i.s)} → ${fdate(i.f)}`, style: `position:absolute;left:${X(i.s)}%;width:${Math.max(1, X(i.f) - X(i.s))}%;top:0;bottom:0;border-radius:5px;background:${projColor(i.p)}33` },
          h('div', { style: `height:100%;width:${i.prog}%;background:${projColor(i.p)};border-radius:5px` })),
        X(t) > 0 && X(t) < 100 ? h('div', { style: `position:absolute;left:${X(t)}%;top:-4px;bottom:-4px;width:2px;background:var(--red)` }) : null))));
}

/* ---------------- agenda (my work) ---------------- */
const AG_KINDS = [['actions', 'due_date', 'Action'], ['reminders', 'remind_date', 'Reminder'], ['punch_items', 'due_date', 'Punch'], ['procurement', 'expected_delivery', 'Delivery'],
  ['rfis', 'required_by', 'RFI'], ['deliverables', 'forecast_due', 'Deliverable'], ['tests', 'planned_date', 'Test'], ['meeting_items', 'due_date', 'Minutes'], ['issues', 'due_date', 'Issue']];
function agendaItems(P) {
  const out = [];
  for (const x of P) { const rec = fillRec(x.records), p = x.project; if (p.status === 'Archived') continue;
    for (const [k, f, lab] of AG_KINDS) for (const r of rec[k] || []) { if (isClosed(k, r)) continue; if (k === 'meeting_items' && (r.action_id || r.item_type !== 'Action')) continue;
      out.push({ code: p.code, project: p, k, r, due: r[f] || null, kind: lab, title: titleOf(k, r), owner: r.owner || (k === 'procurement' ? '' : ''), color: projColor(p) }); }
    for (const m of rec.meetings || []) if (m.meeting_date && m.meeting_date >= isoToday() && m.status !== 'Cancelled') out.push({ code: p.code, project: p, k: 'meetings', r: m, due: m.meeting_date, kind: 'Meeting', title: (m.start_time ? m.start_time + ' ' : '') + m.title, color: projColor(p) });
  }
  return out.sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1);
}
function agendaList(items, compact) {
  const t = isoToday(), list = h('div', { class: 'agenda' });
  if (!items.length) return h('p', { class: 'note' }, 'Nothing scheduled.');
  let grp = null;
  for (const it of items) {
    const g = !it.due ? 'No date' : it.due < t ? 'Overdue' : it.due === t ? 'Today' : it.due <= addDays(t, 7) ? 'Next 7 days' : 'Later';
    if (!compact && g !== grp) { list.append(h('div', { class: 'grp' }, g)); grp = g; }
    const d = D0(it.due);
    const canTick = ['actions', 'reminders', 'punch_items', 'meeting_items'].includes(it.k);
    list.append(h('div', { class: 'ai', onclick: ev => { if (ev.target.closest('input')) return; openEvent({ ...it, code: it.code }); } },
      h('div', { class: 'dd' + (it.due && it.due < t ? ' od' : '') }, d ? [h('b', {}, d.getDate()), h('small', {}, MON[d.getMonth()])] : h('small', {}, '—')),
      h('div', { class: 'tt' }, h('b', {}, it.title), h('div', { class: 'tiny muted' }, h('span', { style: `color:${it.color};font-weight:700` }, it.code), ` · ${it.kind || ent(it.k)?.singular || ''}${it.owner || it.r?.owner ? ' · ' + (it.owner || it.r.owner) : ''}${it.due ? ' · ' + relDays(it.due) : ''}`)),
      canTick && !compact ? h('input', { type: 'checkbox', title: 'Mark done', style: 'width:18px;height:18px;margin-top:6px', onchange: run(async () => { await completeItem(it.k, it.r, it.code); toast('Done ✓'); rerender(); }) }) : null));
  }
  return list;
}
async function completeItem(k, r, code) {
  const d = k === 'reminders' ? { done: 1 } : k === 'punch_items' ? { status: 'Closed', closed_date: isoToday() } : k === 'meeting_items' ? { status: 'Done' } : { status: 'Closed', completed_date: isoToday() };
  await DB.update(k, r.id, d, code);
}
route('agenda', { title: 'My work', icon: 'check', group: 'Portfolio', render: async v => {
  const P = await loadPortfolio(true), all = agendaItems(P);
  const owners = [...new Set(all.map(i => i.r.owner).filter(Boolean))].sort();
  const me = ST.cfg.settings.USER_NAME || '';
  let owner = ST.params.owner ?? (me && owners.includes(me) ? me : ''), proj = ST.params.p || '', kind = '';
  const list = h('div', { class: 'card' });
  const draw = () => { const items = all.filter(i => (!owner || i.r.owner === owner) && (!proj || i.code === proj) && (!kind || i.kind === kind)); list.innerHTML = ''; list.append(agendaList(items)); cnt.textContent = `${items.length} open items`; };
  const cnt = h('span', { class: 'note' });
  v.append(pageHead('Portfolio', 'My work', 'Every open action, to-do, reminder, punch item, delivery and upcoming meeting across your projects. Tick to complete.',
    h('button', { class: 'btn', onclick: () => downloadICS('CGI open items', all.filter(i => i.due).map(i => ({ uid: `${i.code}-${i.k}-${i.r.id}`, title: `[${i.code}] ${i.title}`, start: i.due, time: i.r.start_time || i.r.remind_time, desc: i.kind }))) }, icon('cal'), 'Export to Outlook (.ics)')));
  v.append(h('div', { class: 'tbar' }, h('select', { onchange: e => { owner = e.target.value; draw(); } }, h('option', { value: '' }, 'Everyone'), owners.map(o => h('option', { value: o, selected: o === owner }, o))),
    h('select', { onchange: e => { proj = e.target.value; draw(); } }, h('option', { value: '' }, 'All projects'), P.map(x => h('option', { value: x.project.code, selected: x.project.code === proj }, `${x.project.code} · ${x.project.name}`))),
    h('select', { onchange: e => { kind = e.target.value; draw(); } }, h('option', { value: '' }, 'All types'), [...new Set(all.map(i => i.kind))].map(k => h('option', { value: k }, k))), cnt));
  v.append(list); draw();
} });

/* ---------------- calendar ---------------- */
route('calendar', { title: 'Calendar', icon: 'cal', group: 'Portfolio', render: async v => {
  const P = await loadPortfolio(true); let scope = ST.params.scope || (ST.code ? ST.code : ''), month = ST.params.m || isoToday().slice(0, 7);
  const types = { ms: 'Milestones', task: 'Tasks', meet: 'Meetings', act: 'Actions & due items', proc: 'Deliveries', test: 'Tests', pay: 'Payments', rem: 'Reminders' };
  let show = new Set(Object.keys(types));
  const holder = h('div');
  const draw = () => {
    const evs = P.filter(x => !scope || x.project.code === scope).filter(x => x.project.status !== 'Archived').flatMap(x => eventsFor(fillRec(x.records), x.project, x.project.code)).filter(e => show.has(e.type === 'od' ? 'act' : e.type));
    const first = D0(month + '-01'), start = new Date(first); start.setDate(1 - ((first.getDay() + 6) % 7));
    const grid = h('div', { class: 'cal' }, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => h('div', { class: 'dh' }, d)));
    for (let i = 0; i < 42; i++) { const d = new Date(start); d.setDate(start.getDate() + i); const ds = iso(d); const de = evs.filter(e => e.date === ds).sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1);
      if (i >= 35 && d.getMonth() !== first.getMonth()) break;
      grid.append(h('div', { class: `day${d.getMonth() !== first.getMonth() ? ' out' : ''}${!isWork(d) ? ' we' : ''}${ds === isoToday() ? ' today' : ''}`, onclick: ev => { if (ev.target.closest('.ev')) return; quickAdd(ds); } },
        h('span', { class: 'dn' }, d.getDate()), de.slice(0, 6).map(e => h('div', { class: `ev ${e.type}`, title: `${e.code} · ${e.title}`, onclick: () => openEvent(e), style: e.done ? 'opacity:.55;text-decoration:line-through' : '' }, scope ? '' : h('small', {}, e.code + ' '), e.title)),
        de.length > 6 ? h('span', { class: 'tiny muted' }, `+${de.length - 6} more`) : null)); }
    holder.innerHTML = ''; holder.append(grid);
    title.textContent = `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][first.getMonth()]} ${first.getFullYear()}`;
    exp.onclick = () => downloadICS(`${scope || 'CGI'} calendar`, evs.filter(e => e.type !== 'task').map(e => ({ uid: `${e.code}-${e.k}-${e.r.id}-${e.date}`, title: `[${e.code}] ${e.title.replace(/^[◆▶■] /, '')}`, start: e.date, time: e.k === 'meetings' ? e.r.start_time : e.k === 'reminders' ? e.r.remind_time : null, duration: e.r.duration_min, location: e.r.location })));
  };
  const step = n => { const d = D0(month + '-01'); d.setMonth(d.getMonth() + n); month = iso(d).slice(0, 7); draw(); };
  const title = h('h2', { style: 'min-width:200px' }), exp = h('button', { class: 'btn' }, icon('download'), 'Export .ics');
  v.append(pageHead('Planning', 'Calendar', 'Milestones, meetings, due actions, deliveries, tests and payments. Click a day to add a meeting, reminder or action.', exp));
  v.append(h('div', { class: 'tbar' }, h('button', { class: 'btn sm', onclick: () => step(-1) }, '‹'), title, h('button', { class: 'btn sm', onclick: () => step(1) }, '›'), h('button', { class: 'btn sm', onclick: () => { month = isoToday().slice(0, 7); draw(); } }, 'Today'),
    h('select', { style: 'width:auto;margin-left:12px', onchange: e => { scope = e.target.value; draw(); } }, h('option', { value: '' }, 'All projects'), P.map(x => h('option', { value: x.project.code, selected: x.project.code === scope }, `${x.project.code} · ${x.project.name}`))),
    h('span', { class: 'right row' }, Object.entries(types).map(([k, l]) => h('label', { class: 'row tiny' }, h('input', { type: 'checkbox', checked: true, onchange: e => { e.target.checked ? show.add(k) : show.delete(k); draw(); } }), h('span', { class: `ev ${k}`, style: 'padding:0 6px' }, l))))));
  v.append(holder); draw();
} });

function quickAdd(date) {
  if (!ST.code) return toast('Choose a project first', true);
  const b = (label, fn) => h('button', { class: 'btn', style: 'justify-content:flex-start', onclick: () => { closeModal(); setTimeout(fn, 30); } }, label);
  modal(`Add on ${ddate(date)} · ${ST.code}`, h('div', { class: 'grid g2' },
    b('Meeting', () => openForm('meetings', null, { meeting_date: date, start_time: '09:00' }, r => r ? go('meetings', { id: r.id }) : rerender())),
    b('Reminder', () => openForm('reminders', null, { remind_date: date, remind_time: '08:00' })), b('Action / to-do', () => openForm('actions', null, { due_date: date })),
    b('Task', () => openForm('tasks', null, { forecast_start: date, forecast_finish: date })), b('Test (FAT / SAT)', () => openForm('tests', null, { planned_date: date })),
    b('Delivery', () => openForm('procurement', null, { expected_delivery: date }))));
}

/* ---------------- reminders & bell ---------------- */
const REM = { items: [] };
async function checkReminders() {
  try {
    const P = await loadPortfolio(); const t = isoToday(), now = new Date().toTimeString().slice(0, 5);
    const all = agendaItems(P); REM.items = all.filter(i => i.due && i.due <= t && i.k !== 'meetings');
    const pip = $('#bellPip'); pip.textContent = REM.items.length; pip.classList.toggle('hidden', !REM.items.length);
    const fire = [];
    for (const x of P) { const rec = fillRec(x.records);
      for (const r of rec.reminders) if (!+r.done && r.remind_date === t && (!r.remind_time || r.remind_time <= now)) fire.push({ key: `rem-${x.project.code}-${r.id}-${t}`, title: r.title, code: x.project.code });
      for (const a of rec.actions) if (!isClosed('actions', a) && a.reminder_date === t) fire.push({ key: `act-${x.project.code}-${a.id}-${t}`, title: a.title, code: x.project.code });
      for (const m of rec.meetings) if (m.meeting_date === t && m.start_time && m.status !== 'Cancelled') { const mins = (D0(t).setHours(...m.start_time.split(':').map(Number)) - Date.now()) / 6e4; if (mins <= 15 && mins > -5) fire.push({ key: `meet-${x.project.code}-${m.id}-${t}`, title: `Meeting at ${m.start_time}: ${m.title}`, code: x.project.code }); } }
    for (const f of fire) { if (localStorage.getItem('cgi-rem-' + f.key)) continue; localStorage.setItem('cgi-rem-' + f.key, '1'); toast(`⏰ ${f.code}: ${f.title}`);
      if ('Notification' in window && Notification.permission === 'granted') try { new Notification(`CGI Project Hub · ${f.code}`, { body: f.title, icon: 'img/favicon.png' }); } catch (e) { } }
  } catch (e) { console.warn(e); }
}
function bellMenu() {
  const items = REM.items;
  modal('Due and overdue', h('div', {}, 'Notification' in window && Notification.permission !== 'granted' ? h('div', { class: 'card', style: 'margin-bottom:12px' }, h('div', { class: 'row' }, h('span', {}, 'Get Windows pop-up reminders while the hub is open.'), h('button', { class: 'btn pri sm right', onclick: async () => { await Notification.requestPermission(); toast('Desktop reminders ' + (Notification.permission === 'granted' ? 'on' : 'blocked')); } }, 'Turn on desktop reminders'))) : null,
    items.length ? agendaList(items) : h('p', { class: 'note' }, 'Nothing due today or overdue. ✓')), h('button', { class: 'btn', onclick: () => { closeModal(); go('agenda'); } }, 'Open My work'));
}
