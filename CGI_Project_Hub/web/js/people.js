/* Meetings & minutes, stakeholders, RACI. */
'use strict';

/* ---------------- meetings ---------------- */
route('meetings', { title: 'Meetings & minutes', icon: 'meet', group: 'Project', project: true, render: v => {
  const R = ST.PH.rec, t = isoToday();
  const ms = [...R.meetings].sort((a, b) => (b.meeting_date || '') < (a.meeting_date || '') ? -1 : 1);
  const up = ms.filter(m => (m.meeting_date || '9') >= t).reverse(), past = ms.filter(m => (m.meeting_date || '9') < t);
  let sel = byId('meetings', ST.params.id) || up[0] || past[0];
  v.append(pageHead('Communication', 'Meetings & minutes', 'Agenda, attendees, discussion points, decisions and actions assigned to people — every action lands in Actions & to-dos and on the calendar.',
    ms.length ? h('button', { class: 'btn', onclick: () => newMeeting(true) }, 'New from last meeting') : null, h('button', { class: 'btn pri', onclick: () => newMeeting(false) }, icon('plus'), 'New meeting')));
  if (!ms.length) { v.append(empty('No meetings yet', 'Plan the kick-off meeting: add attendees from your stakeholders, an agenda, and capture minutes as you go.', h('button', { class: 'btn pri', onclick: () => newMeeting(false) }, 'Plan a meeting'))); return; }
  const item = m => h('div', { class: 'mt-item' + (sel && m.id === sel.id ? ' on' : ''), onclick: () => go('meetings', { id: m.id }) }, h('div', { class: 'd' }, `${m.meeting_date ? ddate(m.meeting_date) : 'No date'}${m.start_time ? ' · ' + m.start_time : ''}`), h('b', {}, m.title),
    h('div', { class: 'row tiny' }, chip(m.meeting_type, 'blue'), chip(m.status), (() => { const n = R.meeting_items.filter(i => String(i.meeting_id) === String(m.id)).length; return n ? h('span', { class: 'muted' }, `${n} items`) : null; })()));
  v.append(h('div', { class: 'mt-layout' }, h('div', { class: 'mt-list' }, up.length ? h('div', { class: 'mt-sec' }, 'Upcoming') : null, up.map(item), past.length ? h('div', { class: 'mt-sec' }, 'Past') : null, past.map(item)),
    sel ? meetingDetail(sel) : h('div')));
} });
async function newMeeting(fromLast) {
  const R = ST.PH.rec, last = [...R.meetings].sort((a, b) => (a.meeting_date || '') < (b.meeting_date || '') ? 1 : -1)[0];
  const base = fromLast && last ? { title: last.title, meeting_type: last.meeting_type, attendees: last.attendees, location: last.location, chair: last.chair, start_time: last.start_time, duration_min: last.duration_min, agenda: last.agenda, meeting_date: last.next_meeting || addDays(last.meeting_date || isoToday(), 7) }
    : { title: R.meetings.length ? 'Progress meeting' : 'Project kick-off meeting', meeting_type: R.meetings.length ? 'Progress' : 'Kick-off', meeting_date: isoToday(), start_time: '09:00', duration_min: 60,
        agenda: R.meetings.length ? '1. Safety\n2. Previous actions\n3. Schedule & progress\n4. Procurement\n5. Technical / RFIs\n6. Commercial\n7. AOB' : '1. Introductions & roles (RACI)\n2. Scope and deliverables\n3. Schedule & key milestones\n4. Procurement & lead times\n5. FAT / SAT approach\n6. Communication & meetings\n7. Risks\n8. Next steps' };
  const m = await DB.create('meetings', { status: 'Planned', ...base });
  if (fromLast && last) { let n = 1;
    for (const a of R.actions.filter(a => a.meeting_id && !isClosed('actions', a))) await DB.create('meeting_items', { meeting_id: m.id, seq: n++, item_type: 'Action', topic: a.title, owner: a.owner, due_date: a.due_date, status: 'Carried forward', action_id: a.id });
    for (const i of R.meeting_items.filter(i => String(i.meeting_id) === String(last.id) && i.item_type !== 'Action' && i.status === 'Open')) await DB.create('meeting_items', { meeting_id: m.id, seq: n++, item_type: i.item_type, topic: i.topic, details: i.details, owner: i.owner, due_date: i.due_date, status: 'Carried forward' });
  }
  toast('Meeting created'); go('meetings', { id: m.id });
}
function meetingDetail(m) {
  const R = ST.PH.rec, box = h('div', { class: 'grid', style: 'align-content:start' });
  const save = run(async (k, val) => { const r = await DB.update('meetings', m.id, { [k]: val }); Object.assign(m, r); });
  const f = (label, k, type = 'text', opts) => { const el = type === 'select' ? h('select', {}, opts.map(o => h('option', { selected: o === m[k] }, o))) : type === 'textarea' ? h('textarea', { rows: 4 }, m[k] ?? '') : h('input', { type, value: m[k] ?? '' });
    el.addEventListener('change', () => save(k, type === 'number' ? +el.value : el.value)); return h('label', { class: type === 'textarea' ? 'full' : '' }, label, el); };
  const E_ = ent('meetings').fields, opt = k => E_.find(x => x.k === k).options;
  // header card
  box.append(h('div', { class: 'card' }, h('div', { class: 'ch' }, icon('meet'), h('span', { style: 'font-size:17px' }, m.title), h('span', { class: 'right row' },
    h('button', { class: 'btn sm', onclick: () => downloadICS(m.title, [meetingEvent(m)]) }, icon('cal'), 'Invite (.ics)'),
    h('button', { class: 'btn sm', onclick: () => emailMinutes(m) }, 'Email minutes'), h('button', { class: 'btn sm', onclick: () => printMinutes(m) }, icon('print'), 'Print'),
    h('button', { class: 'btn sm danger', onclick: run(async () => { if (!confirm('Delete this meeting and its minutes items?')) return; for (const i of R.meeting_items.filter(i => String(i.meeting_id) === String(m.id))) await DB.remove('meeting_items', i.id); await DB.remove('meetings', m.id); go('meetings'); }) }, icon('trash')))),
    h('div', { class: 'form', style: 'grid-template-columns:repeat(4,minmax(0,1fr))' }, f('Title', 'title'), f('Date', 'meeting_date', 'date'), f('Start', 'start_time', 'time'), f('Duration (min)', 'duration_min', 'number'),
      f('Type', 'meeting_type', 'select', opt('meeting_type')), f('Status', 'status', 'select', opt('status')), f('Location / link', 'location'), f('Chair', 'chair')),
    attendeesBlock(m, save)));
  // agenda + notes
  box.append(h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', {}, 'Agenda'), (() => { const t = h('textarea', { rows: 8 }, m.agenda || ''); t.addEventListener('change', () => save('agenda', t.value)); return t; })()),
    h('div', { class: 'card' }, h('h3', {}, 'General notes'), (() => { const t = h('textarea', { rows: 8 }, m.notes || ''); t.addEventListener('change', () => save('notes', t.value)); return t; })(),
      h('label', { class: 'row small', style: 'margin-top:8px' }, 'Next meeting', (() => { const i = h('input', { type: 'date', value: m.next_meeting || '', style: 'width:160px' }); i.addEventListener('change', () => save('next_meeting', i.value)); return i; })()))));
  box.append(minutesTable(m));
  // open actions from earlier meetings
  const prevOpen = R.actions.filter(a => a.meeting_id && String(a.meeting_id) !== String(m.id) && !isClosed('actions', a) && !R.meeting_items.some(i => String(i.meeting_id) === String(m.id) && String(i.action_id) === String(a.id)));
  if (prevOpen.length) box.append(h('div', { class: 'card' }, h('h3', {}, icon('check'), `Open actions from earlier meetings (${prevOpen.length})`, h('button', { class: 'btn sm right', onclick: run(async () => { let n = nextSeq(m); for (const a of prevOpen) await DB.create('meeting_items', { meeting_id: m.id, seq: n++, item_type: 'Action', topic: a.title, owner: a.owner, due_date: a.due_date, status: 'Carried forward', action_id: a.id }); rerender(); }) }, 'Carry all forward')),
    prevOpen.map(a => h('div', { class: 'todo' }, h('input', { type: 'checkbox', title: 'Close action', onchange: run(async () => { await DB.update('actions', a.id, { status: 'Closed', completed_date: isoToday() }); rerender(); }) }), h('span', { class: 'grow' }, a.title), a.owner ? chip(a.owner) : null, a.due_date ? h('span', { class: 'tiny', style: overdue('actions', a) ? 'color:var(--red)' : '' }, sdate(a.due_date)) : null,
      h('span', { class: 'tiny muted' }, `from ${titleOf('meetings', byId('meetings', a.meeting_id))}`)))));
  box.append(h('div', { class: 'card' }, attachBlock('meetings', m.id)));
  return box;
}
function attendeesBlock(m, save) {
  const list = () => String(m.attendees || '').split(/[,;\n]/).map(s => s.trim()).filter(Boolean);
  const wrap = h('div', { class: 'sub' });
  const draw = () => {
    const names = list(), st = ST.PH.rec.stakeholders;
    wrap.innerHTML = ''; wrap.append(h('h4', {}, icon('people'), `Attendees (${names.length})`));
    wrap.append(h('div', { class: 'att' }, names.map(n => { const s = st.find(x => x.name === n); return h('span', { class: 'chip ' + (s && s.party === 'Internal (CGI)' ? 'blue' : '') }, n, s?.organisation ? h('span', { class: 'muted' }, ' · ' + s.organisation) : '', h('button', { title: 'Remove', onclick: run(async () => { m.attendees = names.filter(x => x !== n).join(', '); await save('attendees', m.attendees); draw(); }) }, '×')); })));
    const sel = h('select', { style: 'width:auto' }, h('option', { value: '' }, '+ Add stakeholder…'), st.filter(s => !names.includes(s.name)).map(s => h('option', { value: s.name }, `${s.name}${s.organisation ? ' (' + s.organisation + ')' : ''}`)));
    sel.addEventListener('change', run(async () => { if (!sel.value) return; m.attendees = [...names, sel.value].join(', '); await save('attendees', m.attendees); draw(); }));
    const free = h('input', { type: 'text', placeholder: 'or type a name + Enter', style: 'max-width:220px' });
    free.addEventListener('keydown', run(async e => { if (e.key !== 'Enter' || !free.value.trim()) return; e.preventDefault(); m.attendees = [...names, free.value.trim()].join(', '); await save('attendees', m.attendees); draw(); }));
    const apol = h('input', { type: 'text', value: m.apologies || '', placeholder: 'Apologies', style: 'max-width:280px' }); apol.addEventListener('change', () => save('apologies', apol.value));
    wrap.append(h('div', { class: 'row', style: 'margin-top:8px' }, sel, free, h('span', { class: 'small muted right' }, 'Apologies'), apol));
  };
  draw(); return wrap;
}
const nextSeq = m => Math.max(0, ...ST.PH.rec.meeting_items.filter(i => String(i.meeting_id) === String(m.id)).map(i => +i.seq || 0)) + 1;
function minutesTable(m) {
  const card = h('div', { class: 'card flush' });
  const draw = () => {
    const items = sortRows('meeting_items', ST.PH.rec.meeting_items.filter(i => String(i.meeting_id) === String(m.id)), 'seq');
    const F = ent('meeting_items').fields, opt = k => F.find(x => x.k === k).options;
    const upd = (i, k) => run(async e => { const val = e.target.value; const r = await DB.update('meeting_items', i.id, { [k]: val });
      if (k === 'status' && val === 'Done' && i.action_id) await DB.update('actions', i.action_id, { status: 'Closed', completed_date: isoToday() });
      if (['owner', 'due_date', 'topic'].includes(k) && i.action_id) await DB.update('actions', i.action_id, { [k === 'topic' ? 'title' : k]: val || null });
      Object.assign(i, r); if (k === 'item_type' || k === 'status') draw(); });
    const tb = h('tbody');
    for (const i of items) {
      const a = i.action_id ? byId('actions', i.action_id) : null;
      tb.append(h('tr', {}, h('td', { style: 'width:42px' }, h('input', { type: 'number', value: i.seq ?? '', style: 'width:46px', onchange: upd(i, 'seq') })),
        h('td', { style: 'width:120px' }, h('select', { class: 'itype', onchange: upd(i, 'item_type'), style: `color:${{ Action: '#9a6200', Decision: '#6a5ad3', Risk: '#c43b31', Information: '#76869a' }[i.item_type] || '#005093'}` }, opt('item_type').map(o => h('option', { selected: o === i.item_type }, o)))),
        h('td', { style: 'min-width:220px' }, h('input', { type: 'text', value: i.topic || '', onchange: upd(i, 'topic'), style: 'font-weight:600' }), h('textarea', { rows: 1, placeholder: 'Discussion / detail', onchange: upd(i, 'details') }, i.details || '')),
        h('td', { style: 'width:150px' }, h('input', { type: 'text', value: i.owner || '', list: 'dl-mt-people', placeholder: 'Owner', onchange: upd(i, 'owner') })),
        h('td', { style: 'width:140px' }, h('input', { type: 'date', value: i.due_date || '', onchange: upd(i, 'due_date') })),
        h('td', { style: 'width:140px' }, h('select', { onchange: upd(i, 'status') }, opt('status').map(o => h('option', { selected: o === i.status }, o)))),
        h('td', { style: 'width:150px' }, i.item_type === 'Action' ? (a ? h('span', { class: 'chip ' + tone(a.status), style: 'cursor:pointer', onclick: () => openForm('actions', a, {}, () => rerender()) }, `Action #${a.id} · ${a.status}`)
          : h('button', { class: 'btn sm', onclick: run(async () => { const na = await DB.create('actions', { title: i.topic, owner: i.owner, due_date: i.due_date, meeting_id: m.id, category: 'Action', notes: i.details, status: 'Open', source: 'Meeting ' + (m.meeting_date || '') });
              await DB.update('meeting_items', i.id, { action_id: na.id }); toast('Action created and assigned'); draw(); }) }, '→ Create action'))
          : i.item_type === 'Decision' ? (R_hasDecision(i) ? chip('In decision log', 'violet') : h('button', { class: 'btn sm', onclick: run(async () => { await DB.create('decisions', { title: i.topic, decision_date: m.meeting_date, made_by: m.chair || '', rationale: i.details, status: 'Approved', meeting_id: m.id }); toast('Logged to the decision register'); draw(); }) }, '→ Decision log')) : '',
          h('button', { class: 'btn sm ghost', title: 'Delete item', onclick: run(async () => { await DB.remove('meeting_items', i.id); draw(); }) }, '×'))));
    }
    if (!items.length) tb.append(h('tr', {}, h('td', { colspan: 7, class: 'muted', style: 'text-align:center;padding:18px' }, 'No minutes yet. Add discussion points, decisions and actions below.')));
    const quick = h('input', { type: 'text', placeholder: 'Type a point and press Enter (start with "A:" for an action, "D:" for a decision)…' });
    quick.addEventListener('keydown', run(async e => { if (e.key !== 'Enter' || !quick.value.trim()) return; e.preventDefault(); let v = quick.value.trim(), type = 'Discussion';
      const mm = v.match(/^([ADIR]):\s*/i); if (mm) { type = { A: 'Action', D: 'Decision', I: 'Information', R: 'Risk' }[mm[1].toUpperCase()]; v = v.slice(mm[0].length); }
      await DB.create('meeting_items', { meeting_id: m.id, seq: nextSeq(m), item_type: type, topic: v, status: type === 'Information' ? 'Noted' : 'Open' }); draw(); setTimeout(() => $('.minutes-quick')?.focus(), 50); }));
    quick.classList.add('minutes-quick');
    card.innerHTML = ''; card.append(h('div', { class: 'ch' }, icon('list'), `Minutes (${items.length} items · ${items.filter(i => i.item_type === 'Action').length} actions)`),
      h('datalist', { id: 'dl-mt-people' }, [...String(m.attendees || '').split(/[,;]/).map(s => s.trim()).filter(Boolean), ...people()].filter((x, i, a) => a.indexOf(x) === i).map(p => h('option', { value: p }))),
      h('div', { style: 'overflow:auto;padding:0 6px' }, h('table', { class: 't minutes' }, h('thead', {}, h('tr', {}, ['#', 'Type', 'Topic & discussion', 'Owner', 'Due', 'Status', ''].map(x => h('th', {}, x)))), tb)),
      h('div', { style: 'padding:10px 14px 14px' }, quick));
  };
  draw(); return card;
}
const R_hasDecision = i => ST.PH.rec.decisions.some(d => String(d.meeting_id) === String(i.meeting_id) && d.title === i.topic);
function meetingEvent(m) {
  const st = ST.PH.rec.stakeholders, names = String(m.attendees || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
  return { uid: `${ST.code}-meeting-${m.id}`, title: `[${ST.code}] ${m.title}`, start: m.meeting_date || isoToday(), time: m.start_time || '09:00', duration: m.duration_min || 60, location: m.location, desc: `Agenda:\n${m.agenda || ''}`,
    attendees: names.map(n => ({ name: n, email: (st.find(s => s.name === n) || {}).email })) };
}
function minutesText(m) {
  const items = sortRows('meeting_items', ST.PH.rec.meeting_items.filter(i => String(i.meeting_id) === String(m.id)), 'seq');
  return `MINUTES — ${m.title}\n${ST.PH.project.code} ${ST.PH.project.name}\n${fdate(m.meeting_date)} ${m.start_time || ''} · ${m.location || ''}\nAttendees: ${m.attendees || '-'}\nApologies: ${m.apologies || '-'}\n\n` +
    items.map(i => `${i.seq || '-'}. [${i.item_type}] ${i.topic}${i.details ? '\n   ' + i.details : ''}${i.owner ? '\n   Owner: ' + i.owner : ''}${i.due_date ? '   Due: ' + fdate(i.due_date) : ''}${i.status ? '   (' + i.status + ')' : ''}`).join('\n') +
    (m.notes ? `\n\nNotes:\n${m.notes}` : '') + (m.next_meeting ? `\n\nNext meeting: ${fdate(m.next_meeting)}` : '');
}
function emailMinutes(m) {
  const st = ST.PH.rec.stakeholders, to = String(m.attendees || '').split(/[,;]/).map(s => (st.find(x => x.name === s.trim()) || {}).email).filter(Boolean).join(';');
  location.href = `mailto:${to}?subject=${encodeURIComponent(`Minutes: ${m.title} (${ST.code}, ${fdate(m.meeting_date)})`)}&body=${encodeURIComponent(minutesText(m).slice(0, 1800))}`;
}
function printMinutes(m) {
  const items = sortRows('meeting_items', ST.PH.rec.meeting_items.filter(i => String(i.meeting_id) === String(m.id)), 'seq'), p = ST.PH.project, w = window.open('', '_blank');
  w.document.write(`<html><head><title>Minutes ${esc(m.title)}</title><style>body{font:12.5px/1.45 "Segoe UI",Arial;color:#14253a;margin:32px}h1{color:#005093;font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #dfe5ec;padding:6px 8px;text-align:left;vertical-align:top}th{background:#f3f6fa;font-size:11px;text-transform:uppercase;letter-spacing:.05em}.hd{display:flex;justify-content:space-between;border-bottom:3px solid #005093;padding-bottom:10px;align-items:center}.t{font-weight:700;font-size:10.5px;letter-spacing:.06em}</style></head><body>
  <div class="hd"><div><div style="font-size:11px;letter-spacing:.14em;color:#76869a">MINUTES OF MEETING</div><h1>${esc(m.title)}</h1><div>${esc(p.code)} · ${esc(p.name)}</div></div><img src="${location.origin}/img/logo-blue.png" height="42"></div>
  <table><tr><th>Date</th><td>${fdate(m.meeting_date)} ${esc(m.start_time || '')}</td><th>Location</th><td>${esc(m.location || '')}</td></tr><tr><th>Chair</th><td>${esc(m.chair || '')}</td><th>Type</th><td>${esc(m.meeting_type || '')}</td></tr>
  <tr><th>Attendees</th><td colspan="3">${esc(m.attendees || '')}</td></tr><tr><th>Apologies</th><td colspan="3">${esc(m.apologies || '')}</td></tr></table>
  ${m.agenda ? `<h3>Agenda</h3><div>${esc(m.agenda).replace(/\n/g, '<br>')}</div>` : ''}
  <table><thead><tr><th>#</th><th>Type</th><th>Item</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>${items.map(i => `<tr><td>${esc(i.seq ?? '')}</td><td class="t">${esc(i.item_type)}</td><td><b>${esc(i.topic)}</b>${i.details ? '<br>' + esc(i.details).replace(/\n/g, '<br>') : ''}</td><td>${esc(i.owner || '')}</td><td>${i.due_date ? fdate(i.due_date) : ''}</td><td>${esc(i.status || '')}</td></tr>`).join('')}</tbody></table>
  ${m.notes ? `<h3>Notes</h3><div>${esc(m.notes).replace(/\n/g, '<br>')}</div>` : ''}${m.next_meeting ? `<p><b>Next meeting:</b> ${fdate(m.next_meeting)}</p>` : ''}
  <p style="color:#76869a;font-size:11px;margin-top:24px">Issued from CGI Project Hub · ${fdate(isoToday())}</p><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
}

/* ---------------- stakeholders & RACI ---------------- */
route('people', { title: 'Stakeholders & RACI', icon: 'people', group: 'Project', project: true, render: v => {
  const tab = ST.params.tab || 'raci', R = ST.PH.rec;
  v.append(pageHead('People', 'Stakeholders & RACI', 'Client, contractors, suppliers, authorities and your team — who is Responsible, Accountable, Consulted and Informed for each activity.'));
  v.append(tabs([['raci', 'RACI matrix', R.raci.length], ['directory', 'Directory', R.stakeholders.length], ['grid', 'Power / interest'], ['clients', 'Clients', R.clients.length]], tab, k => go('people', { tab: k })));
  if (tab === 'directory') v.append(registerBlock('stakeholders', { cols: ['name', 'organisation', 'party', 'role', 'email', 'phone', 'influence', 'engagement'] }));
  else if (tab === 'clients') v.append(registerBlock('clients'));
  else if (tab === 'grid') {
    const q = (inf, int) => R.stakeholders.filter(s => (['High'].includes(s.influence) === inf) && (['High'].includes(s.interest) === int));
    const quad = (t, sub, list, hot) => h('div', { class: 'quad' + (hot ? ' hot' : '') }, h('h5', {}, t), h('div', { class: 'tiny muted', style: 'margin-bottom:6px' }, sub), list.map(s => h('div', { class: 'todo', style: 'cursor:pointer', onclick: () => openForm('stakeholders', s) }, h('b', {}, s.name), h('span', { class: 'tiny muted' }, s.organisation || ''), chip(s.engagement))));
    v.append(h('div', { class: 'card' }, h('div', { class: 'grid2x2' }, quad('Keep satisfied', 'High influence · lower interest', q(true, false)), quad('Manage closely', 'High influence · high interest', q(true, true), true),
      quad('Monitor', 'Lower influence · lower interest', q(false, false)), quad('Keep informed', 'Lower influence · high interest', q(false, true))), h('p', { class: 'note' }, 'Set influence and interest on each stakeholder to place them.')));
  } else v.append(raciMatrix());
} });
let RACI_PARTY = '';
function raciMatrix() {
  const R = ST.PH.rec, acts = sortRows('raci', R.raci, 'seq');
  const ppl = R.stakeholders.filter(s => !RACI_PARTY || s.party === RACI_PARTY);
  const cyc = ['', 'R', 'A', 'C', 'I', 'A/R'];
  const wrap = h('div');
  const check = a => { const v = Object.values(a.assignments || {}); const nA = v.filter(x => String(x).includes('A')).length, nR = v.filter(x => String(x).includes('R')).length;
    return nA === 1 && nR >= 1 ? chip('✓', 'green') : chip(nA === 0 ? 'no A' : nA > 1 ? `${nA}× A` : 'no R', 'red'); };
  const tb = h('tbody');
  for (const a of acts) {
    const tr = h('tr', {}, h('td', { style: 'min-width:240px;cursor:pointer', onclick: () => openForm('raci', a) }, h('b', {}, a.activity), a.workstream ? h('div', { class: 'tiny muted' }, a.workstream) : null));
    for (const s of ppl) { const val = (a.assignments || {})[s.id] || '';
      tr.append(h('td', { class: 'c' }, h('button', { class: val.replace('/', ''), title: `${s.name}: click to cycle R → A → C → I → A/R`, onclick: run(async e => { const nv = cyc[(cyc.indexOf(val) + 1) % cyc.length]; const asg = { ...(a.assignments || {}) }; if (nv) asg[s.id] = nv; else delete asg[s.id];
        const r = await DB.update('raci', a.id, { assignments: asg }); Object.assign(a, r); wrap.replaceWith(raciMatrix()); }) }, val))); }
    tr.append(h('td', {}, check(a))); tb.append(tr);
  }
  const addAct = run(async () => { const n = prompt('Activity or deliverable'); if (!n) return; await DB.create('raci', { activity: n, seq: acts.length + 1, assignments: {} }); rerender(); });
  const fromSched = run(async () => { const sums = scheduleCPM().rows.filter(r => r.summary); let n = acts.length; for (const r of sums) if (!acts.some(a => a.activity === r.t.title)) await DB.create('raci', { activity: r.t.title, workstream: r.t.workstream, task_id: r.t.id, seq: ++n, assignments: {} }); rerender(); });
  wrap.append(h('div', { class: 'tbar' }, h('select', { style: 'width:auto', onchange: e => { RACI_PARTY = e.target.value; wrap.replaceWith(raciMatrix()); } }, h('option', { value: '' }, 'All parties'), [...new Set(R.stakeholders.map(s => s.party).filter(Boolean))].map(p => h('option', { selected: p === RACI_PARTY }, p))),
    h('span', { class: 'small muted' }, h('b', {}, 'R'), ' Responsible · ', h('b', {}, 'A'), ' Accountable (exactly one) · ', h('b', {}, 'C'), ' Consulted · ', h('b', {}, 'I'), ' Informed'), h('span', { class: 'right' }),
    h('button', { class: 'btn sm', onclick: fromSched }, 'Add phases from schedule'), h('button', { class: 'btn sm', onclick: () => openForm('stakeholders', null) }, icon('plus'), 'Stakeholder'), h('button', { class: 'btn pri sm', onclick: addAct }, icon('plus'), 'Activity')));
  if (!ppl.length) { wrap.append(empty('Add stakeholders first', 'People from the client, contractors, suppliers and CGI appear as columns.', h('button', { class: 'btn pri', onclick: () => openForm('stakeholders', null) }, 'Add stakeholder'))); return wrap; }
  wrap.append(h('div', { class: 'twrap' }, h('table', { class: 't raci' }, h('thead', {}, h('tr', {}, h('th', { style: 'vertical-align:bottom' }, 'Activity'), ppl.map(s => h('th', { class: 'p', title: `${s.name} · ${s.role || ''} · ${s.organisation || ''}` }, `${s.name}${s.organisation && s.organisation !== s.name ? ' · ' + String(s.organisation).slice(0, 16) : ''}`)), h('th', { style: 'vertical-align:bottom' }, 'Check'))), tb)));
  return wrap;
}
