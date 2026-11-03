/* =====================================================================
   PROJECT HUB — UI kit, registers, Home, Project and Technical
   ===================================================================== */
const money = (v, dp = 0) => (v == null || v === '' || !isFinite(+v)) ? '—' : 'R\u00a0' + (+v).toLocaleString('en-ZA', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const dateTxt = v => { const d = D0(v); return d ? d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'; };
const escH = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const chipCls = s => { const z = String(s || '').toLowerCase(); return /(approved|closed|complete|paid|accepted|compliant$|answered|done|applied|resolved|ordered|preferred)/.test(z) ? 'pass' : /(overdue|rejected|non-compliant|critical|error|expired|cancelled)/.test(z) ? 'fail' : 'warn'; };
const stChip = s => h('span', { class: 'chip ' + chipCls(s) }, s || '—');
const emptyState = (title, body, btn) => h('div', { class: 'empty' }, h('b', {}, title), h('p', {}, body), btn || null);
const metric = (label, value, sub = '', cls = '') => h('div', { class: 'metric ' + cls }, h('span', {}, label), h('b', {}, value), sub ? h('small', {}, sub) : null);
const hubTitle = (title, sub, ...right) => h('div', { class: 'hubtitle' }, h('div', {}, h('h1', {}, title), sub ? h('p', {}, sub) : null), h('div', { class: 'row' }, ...right));
const pane = k => { const p = $('#pane-' + k); p.innerHTML = ''; p.className = 'pane on hubpg'; return p; };
const toast = (msg, bad) => { const t = h('div', { class: 'toast' + (bad ? ' bad' : '') }, msg); document.body.append(t); setTimeout(() => t.remove(), bad ? 6000 : 2600); };
const run = fn => async (...a) => { try { await fn(...a); } catch (e) { console.error(e); toast(e.message || String(e), true); } };
const overdue = (ent, r) => { const k = ENTITIES[ent].due; return k && r[k] && r[k] < isoToday() && !isClosed(ent, r); };
const download = (name, text, type = 'text/csv') => { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove(); };

/* ---------------- header context ---------------- */
function refreshProjectHub() {
  const ps = $('#projectSel'); if (ps) { ps.innerHTML = ''; ps.append(h('option', {}, `${PH.project.code ? PH.project.code + ' — ' : ''}${PH.project.name}`)); ps.disabled = true; }
  const bp = $('#brandProject'); if (bp) bp.textContent = PH.project.name;
  const sc = $('#syncChip'); if (sc) { sc.className = 'chip ' + (PH.mode === 'server' ? 'pass' : 'warn'); sc.textContent = PH.mode === 'server' ? 'Shared database' : 'Local only'; sc.title = PH.mode === 'server' ? 'Records are saved on the hub server' : 'Hub server not running: records are kept in this browser only. ' + (PH.error || ''); }
  renderContextHeader(secOf(S.tab).k);
}
function renderContextHeader(section) {
  const rf = $('#rfHeader'), main = $('#ctxMain'), lab = $('#ctxLabel'); if (rf) rf.style.display = section === 'site' ? '' : 'none'; if (!main) return;
  const H = projectHealth();
  const m = { project: [String(H.openActions), H.overdue ? `${H.overdue} overdue` : 'open actions'], technical: [`${H.delApproved}/${PH.rec.deliverables.length}`, 'deliverables approved'],
    commercial: [money(commercial().margin), 'forecast margin'], tracker: [String(TRK.pending || 0), 'changes to review'], site: [fMb(NET?.e2e || 0), 'RF design'] }[section] || [H.label, 'project health'];
  main.textContent = m[0]; lab.textContent = m[1];
}

/* ---------------- form dialog ---------------- */
let DLG;
function fieldInput(ent, f, val) {
  const id = 'fld-' + f.k; let el;
  const opts = f.k === 'cost_code' ? ['', ...PH.rec.cost_codes.map(c => c.code)] : f.k === 'equipment_key' ? ['', ...Object.keys(RF.RADIOS)] : null;
  if (f.t === 'select' || opts) {
    const list = opts || f.options, label = v => f.k === 'cost_code' ? (v ? `${v} ${PH.rec.cost_codes.find(c => c.code === v)?.name || ''}` : '—') : f.k === 'equipment_key' ? (v ? RF.RADIOS[v].model || RF.RADIOS[v].name : '—') : v;
    el = h('select', { id }, list.map(o => h('option', { value: o, selected: String(val ?? f.default ?? '') === String(o) }, label(o))));
  } else if (f.t === 'ref') el = h('select', { id }, h('option', { value: '' }, '—'), ...PH.rec[f.ref].map(r => h('option', { value: r.id, selected: String(val) === String(r.id) }, titleOf(f.ref, r) + (f.ref === 'supplier_quotes' && r.option ? ' — ' + r.option.split(':')[0] : ''))));
  else if (f.t === 'longtext') el = h('textarea', { id, rows: 3 }, val ?? '');
  else if (f.t === 'bool') el = h('input', { id, type: 'checkbox', checked: !!+val });
  else el = h('input', { id, type: f.t === 'date' ? 'date' : ['number', 'money', 'pct'].includes(f.t) ? 'number' : 'text', step: 'any', value: val ?? (f.default ?? '') });
  return h('label', { class: 'ff' + (f.t === 'longtext' ? ' wide' : '') }, h('span', {}, f.label, f.req ? ' *' : ''), el);
}
function openForm(ent, rec, presets = {}, after) {
  const E = ENTITIES[ent], isNew = !rec; rec = rec || presets;
  if (!DLG) { DLG = h('dialog', { class: 'hubdlg' }); document.body.append(DLG); }
  const err = h('p', { class: 'ferr' }), grid = h('div', { class: 'fgrid' }, ...E.fields.map(f => fieldInput(ent, f, rec[f.k])));
  const read = () => Object.fromEntries(E.fields.map(f => { const el = grid.querySelector('#fld-' + f.k); return [f.k, f.t === 'bool' ? el.checked : el.value]; }));
  const save = run(async () => { err.textContent = ''; try { const d = read(); const r = isNew ? await API.create(ent, d) : await API.update(ent, rec.id, d); DLG.close(); toast(`${E.singular} saved`); after && after(r); afterChange(); } catch (e) { err.textContent = e.message; } });
  const del = run(async () => { if (!confirm(`Delete this ${E.singular.toLowerCase()}? This is recorded in the activity log.`)) return; await API.remove(ent, rec.id); DLG.close(); toast(`${E.singular} deleted`); afterChange(); });
  const files = !isNew && PH.mode === 'server' ? (() => { const box = h('div', { class: 'files' });
    const list = () => { box.querySelector('ul')?.remove(); const fs = PH.files.filter(f => f.entity === ent && String(f.entity_id) === String(rec.id)); box.prepend(h('ul', {}, ...fs.map(f => h('li', {}, h('a', { href: API.fileUrl(f), target: '_blank' }, f.filename), h('span', { class: 'note' }, ` ${Math.round(f.size / 1024)} kB`))))); };
    const inp = h('input', { type: 'file' }); inp.addEventListener('change', run(async () => { for (const f of inp.files) await API.upload(f, ent, rec.id); inp.value = ''; list(); toast('Attached'); }));
    box.append(h('label', { class: 'btn sm' }, 'Attach file', inp)); list(); return h('div', {}, h('h4', {}, 'Attachments'), box); })() : null;
  DLG.innerHTML = ''; DLG.append(h('form', { method: 'dialog', onsubmit: e => { e.preventDefault(); save(); } },
    h('div', { class: 'dhead' }, h('h3', {}, `${isNew ? 'New' : 'Edit'} ${E.singular.toLowerCase()}`), h('button', { type: 'button', class: 'btn sm', onclick: () => DLG.close() }, 'Close')),
    grid, files, err, h('div', { class: 'dfoot' }, !isNew ? h('button', { type: 'button', class: 'btn danger', onclick: del }, 'Delete') : h('span'),
      rec.updated_at ? h('span', { class: 'note' }, `Last changed ${new Date(rec.updated_at).toLocaleString('en-ZA')}${rec.source && rec.source !== 'manual' ? ' · from ' + rec.source : ''}`) : h('span'),
      h('button', { class: 'btn pri', type: 'submit' }, 'Save'))));
  DLG.showModal(); setTimeout(() => grid.querySelector('input,select,textarea')?.focus(), 30);
}
function afterChange() { refreshProjectHub(); renderActive(); }

/* ---------------- generic register ---------------- */
const RQ = {};   // per-page UI state
function cellFor(ent, f, r) {
  const v = r[f.k]; if (v == null || v === '') return h('td', { class: 'note' }, '—');
  if (f.t === 'date') return h('td', { class: overdue(ent, r) && f.k === ENTITIES[ent].due ? 'neg' : '' }, dateTxt(v));
  if (f.t === 'money') return h('td', { class: 'num' }, money(v, 2));
  if (f.t === 'pct') return h('td', { class: 'num' }, f1(+v, 0) + ' %');
  if (f.t === 'number') return h('td', { class: 'num' }, String(+v));
  if (f.t === 'bool') return h('td', {}, +v ? 'Yes' : '');
  if (f.t === 'ref') return h('td', {}, titleOf(f.ref, byId(f.ref, v)));
  if (f.k === 'status' || f.k === 'client_status' || f.k === 'priority') return h('td', {}, stChip(v));
  return h('td', { class: f.t === 'longtext' || f.k === ENTITIES[ent].title ? 'wrap' : '' }, String(v).length > 160 ? String(v).slice(0, 160) + '…' : String(v));
}
function sortRows(ent, rows) {
  const s = ENTITIES[ent].sort; if (!s) return rows; const desc = s.startsWith('-'), k = s.replace('-', '');
  const key = v => k === 'wbs' || k === 'ref' || k === 'code' ? String(v ?? '').replace(/\d+/g, d => d.padStart(5, '0')) : String(v ?? '');
  return [...rows].sort((a, b) => (key(a[k]) < key(b[k]) ? -1 : key(a[k]) > key(b[k]) ? 1 : 0) * (desc ? -1 : 1));
}
function registerTable(ent, rows, cols) {
  const E = ENTITIES[ent], fs = (cols || E.list).map(k => E.fields.find(f => f.k === k));
  const t = h('table', { class: 't hubtable click' }, h('tr', {}, ...fs.map(f => h('th', {}, f.label))));
  for (const r of rows) t.append(h('tr', { class: (isClosed(ent, r) ? 'mutedrow ' : '') + (overdue(ent, r) ? 'overdue' : ''), onclick: () => openForm(ent, r) }, ...fs.map(f => cellFor(ent, f, r))));
  return rows.length ? h('div', { class: 'tw' }, t) : emptyState(`No ${E.label.toLowerCase()} yet`, `Use “Add ${E.singular.toLowerCase()}” to create the first one.`);
}
function toCSV(ent, rows) {
  const fs = ENTITIES[ent].fields, q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [['id', ...fs.map(f => f.label)].map(q).join(','), ...rows.map(r => [r.id, ...fs.map(f => f.t === 'ref' ? titleOf(f.ref, byId(f.ref, r[f.k])) : r[f.k])].map(q).join(','))].join('\r\n');
}
function registerBlock(ent, opts = {}) {
  const E = ENTITIES[ent], st = RQ[ent] = RQ[ent] || { q: '', closed: false };
  const box = h('div', { class: 'card' }), body = h('div');
  const draw = () => { let rows = PH.rec[ent].filter(r => !opts.filter || opts.filter(r));
    if (!st.closed && Object.keys(E.closed || {}).length) rows = rows.filter(r => !isClosed(ent, r));
    if (st.q) { const q = st.q.toLowerCase(); rows = rows.filter(r => JSON.stringify(r).toLowerCase().includes(q)); }
    body.innerHTML = ''; body.append(registerTable(ent, sortRows(ent, rows), opts.cols)); };
  const search = h('input', { type: 'search', placeholder: 'Search', value: st.q, class: 'srch' }); search.addEventListener('input', () => { st.q = search.value; draw(); });
  const closedT = Object.keys(E.closed || {}).length ? (() => { const c = h('input', { type: 'checkbox', checked: st.closed }); c.addEventListener('change', () => { st.closed = c.checked; draw(); }); return h('label', { class: 'tog' }, c, 'Show closed'); })() : null;
  box.append(h('div', { class: 'toolbar' }, opts.title ? h('h3', { style: 'margin:0;margin-right:auto' }, opts.title) : h('span', { style: 'margin-right:auto' }), search, closedT,
    h('button', { class: 'btn sm', onclick: () => download(`${ent}.csv`, toCSV(ent, PH.rec[ent])) }, 'Export CSV'),
    h('button', { class: 'btn pri sm', onclick: () => openForm(ent, null, opts.presets ? opts.presets() : {}) }, `Add ${E.singular.toLowerCase()}`)), body);
  draw(); return box;
}
function registerPage(k, ent, title, sub, extra) { regTab(k, () => {}, () => { const p = pane(k); p.append(hubTitle(title || ENTITIES[ent].label, sub)); if (extra) p.append(extra()); p.append(registerBlock(ent)); }); }

/* ---------------- health and alerts ---------------- */
function projectHealth() {
  const R = PH.rec, t = isoToday(), open = R.actions.filter(a => !isClosed('actions', a));
  const od = open.filter(a => a.due_date && a.due_date < t), odHigh = od.filter(a => ['High', 'Critical'].includes(a.priority));
  const cpm = scheduleCPM(); const slip = cpm.finish && cpm.baselineFinish ? daysBetween(cpm.baselineFinish, cpm.finish) : 0;
  const C = commercial(); const exp = C.quotes.filter(q => q.daysLeft != null && q.daysLeft <= 3 && !['Rejected', 'Ordered', 'Expired'].includes(q.r.status));
  const red = odHigh.length > 0 || slip > 10 || (C.contract > 0 && C.margin < 0), amber = od.length > 0 || slip > 0 || exp.length > 0 || C.overrun.length > 0;
  return { label: red ? 'Red' : amber ? 'Amber' : 'Green', cls: red ? 'fail' : amber ? 'warn' : 'pass', openActions: open.length, overdue: od.length, slip,
    delApproved: R.deliverables.filter(d => d.status === 'Approved').length, cpm, C };
}
function alerts() {
  const R = PH.rec, t = isoToday(), out = [], C = commercial(), cpm = scheduleCPM();
  for (const ent of ['actions', 'issues', 'rfis', 'deliverables', 'po_milestones', 'invoices']) for (const r of R[ent]) if (overdue(ent, r)) out.push({ lvl: 'bad', sec: ent, text: `${ENTITIES[ent].singular} overdue: ${titleOf(ent, r)} (due ${dateTxt(r[ENTITIES[ent].due])})`, open: () => openForm(ent, r) });
  for (const q of C.quotes) if (q.daysLeft != null && q.daysLeft <= 7 && !['Rejected', 'Ordered', 'Expired'].includes(q.r.status)) out.push({ lvl: q.daysLeft < 0 ? 'bad' : 'warn', text: `Quote ${q.r.quote_ref} ${q.r.option ? '(' + q.r.option.split(':')[0] + ')' : ''} ${q.daysLeft < 0 ? 'expired ' + (-q.daysLeft) + ' days ago' : 'expires in ' + q.daysLeft + ' days'}`, open: () => setTab('quotecompare') });
  for (const c of C.overrun) out.push({ lvl: 'bad', text: `Cost code ${c.code} ${c.name}: forecast ${money(c.eac)} exceeds budget ${money(c.budget)}`, open: () => setTab('budgetcom') });
  for (const tk of cpm.rows.filter(r => r.slip > 0 && !r.summary)) out.push({ lvl: tk.critical ? 'bad' : 'warn', text: `Task ${tk.t.wbs} ${tk.t.title} is ${tk.slip} work days behind baseline${tk.critical ? ' (critical path)' : ''}`, open: () => setTab('schedule') });
  for (const r of R.risks) if (!isClosed('risks', r) && (r.probability || 0) * (r.impact || 0) >= 15) out.push({ lvl: 'warn', text: `High risk: ${r.title} (score ${(r.probability * r.impact).toFixed(0)})`, open: () => openForm('risks', r) });
  if (!R.client_pos.length) out.push({ lvl: 'info', text: 'No client purchase order captured yet: add it under Commercials › Client PO.', open: () => setTab('clientpo') });
  if (!PH.project.start_date) out.push({ lvl: 'info', text: 'No project start date: set it under Project › Schedule to generate dates.', open: () => setTab('schedule') });
  return out;
}
const alertList = items => items.length ? h('ul', { class: 'alerts' }, ...items.map(a => h('li', { class: a.lvl, onclick: a.open }, a.text))) : h('p', { class: 'note' }, 'Nothing needs attention.');

/* ---------------- Home ---------------- */
regTab('home', () => {}, renderHubHome);
function renderHubHome() {
  const p = pane('home'), H = projectHealth(), C = H.C, sc = reqScore(NET), al = alerts();
  p.append(hubTitle(PH.project.name, PH.project.description, h('span', { class: 'chip ' + H.cls, title: 'Red: overdue high-priority actions, more than 10 days of slip, or a negative margin. Amber: anything overdue, slipping or expiring.' }, `Health: ${H.label}`)));
  p.append(h('div', { class: 'metricgrid' },
    metric('Open actions', String(H.openActions), H.overdue ? `${H.overdue} overdue` : 'none overdue', H.overdue ? 'mbad' : ''),
    metric('Forecast completion', H.cpm.finish ? dateTxt(H.cpm.finish) : '—', H.cpm.finish && H.cpm.baselineFinish ? (H.slip > 0 ? `${H.slip} work days late` : 'on baseline') : 'set a start date'),
    metric('Deliverables approved', `${H.delApproved}/${PH.rec.deliverables.length}`),
    metric('Contract value', money(C.contract), C.contract ? `${PH.rec.client_pos.length} PO(s)` : 'no PO yet'),
    metric('Forecast margin', money(C.margin), C.contract ? `${f1(C.marginPct, 1)} %` : '', C.margin < 0 ? 'mbad' : ''),
    metric('RF requirement checks', `${sc.pass}/${sc.n}`, `${arch().name}`)));
  const card = (sk, title, body, stat) => h('button', { class: 'modulecard', onclick: () => goSection(sk) }, h('span', { class: 'eyebrow' }, title), h('b', {}, stat), h('p', {}, body), h('span', { class: 'go' }, 'Open'));
  p.append(h('div', { class: 'modulegrid' },
    card('project', 'Project', 'Schedule and critical path, lookahead, actions, risks, issues, decisions, meetings and site diary.', `${H.openActions} open actions`),
    card('technical', 'Technical', 'Requirements and live RF compliance, deliverables, RFIs, documents and deviations.', `${H.delApproved}/${PH.rec.deliverables.length} approved`),
    card('site', 'Site', 'The RF design lab: 2D and 3D maps, towers, link engineering and equipment.', fMb(NET.e2e)),
    card('commercial', 'Commercials', 'Client PO, budget and margin, supplier quotes and comparison, POs, invoices, variations, cash flow.', money(C.margin)),
    card('tracker', 'Tracker', 'Log notes and voice notes, review proposed updates, daily summaries and questions.', PH.mode === 'server' ? `${TRK.pending || 0} to review` : 'needs server')));
  const sumBox = h('div', { class: 'card' }, h('h3', {}, 'Latest daily summary'), h('p', { class: 'note' }, PH.mode === 'server' ? 'Loading…' : 'Summaries need the hub server.'));
  if (PH.mode === 'server') API.summaries().then(s => { sumBox.lastChild.remove(); sumBox.append(s.length ? h('div', { class: 'md', html: md(s[0].text) }) : h('p', { class: 'note' }, 'None yet. Generate one in Tracker › Daily summaries.')); }).catch(() => {});
  p.append(h('div', { class: 'g-two' }, h('div', { class: 'card' }, h('h3', {}, `Needs attention (${al.length})`), alertList(al.slice(0, 12))), sumBox));
}

/* ---------------- Schedule: critical path ---------------- */
function parsePreds(s) { return String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^([\d.]+)\s*(?:FS)?\s*([+-]\s*\d+)?/i); return m ? { wbs: m[1], lag: m[2] ? parseInt(m[2].replace(/\s/g, '')) : 0 } : null; }).filter(Boolean); }
const prevWork = s => { const d = D0(s); d.setDate(d.getDate() - 1); while (!isWork(d)) d.setDate(d.getDate() - 1); return iso(d); };
function subWork(s, n) { let d = s; for (let i = 0; i < n; i++) d = prevWork(d); return d; }
function workdays(a, b) { if (!a || !b) return 0; let n = 0, s = a <= b ? a : b, e = a <= b ? b : a; const d = D0(s); while (iso(d) < e) { d.setDate(d.getDate() + 1); if (isWork(d)) n++; } return a <= b ? n : -n; }
function scheduleCPM(start) {
  const T = sortRows('tasks', PH.rec.tasks), map = new Map(T.map(t => [String(t.wbs), t])), S0 = start || PH.project.start_date;
  const isSum = t => T.some(o => o !== t && String(o.wbs).startsWith(String(t.wbs) + '.'));
  const leaves = T.filter(t => !isSum(t)), info = new Map(), errors = [];
  const dur = t => Math.max(0, Math.round(+t.duration_days || 0));
  const visit = (t, stack = []) => {
    if (info.has(t)) return info.get(t); if (stack.includes(t)) { errors.push(`Circular dependency at ${t.wbs}`); return null; }
    let es = S0 || t.forecast_start || null;
    for (const p of parsePreds(t.predecessors)) { const pt = map.get(p.wbs); if (!pt) { errors.push(`${t.wbs}: unknown predecessor ${p.wbs}`); continue; }
      const kids = isSum(pt) ? leaves.filter(l => String(l.wbs).startsWith(pt.wbs + '.')) : [pt];
      for (const k of kids) { const pi = visit(k, [...stack, t]); if (!pi || !pi.ef) continue; let c = dur(t) === 0 || dur(k) === 0 && false ? pi.ef : nextWork(pi.ef); if (dur(t) === 0) c = pi.ef; c = p.lag > 0 ? addWork(c, p.lag) : p.lag < 0 ? subWork(c, -p.lag) : c; if (!es || c > es) es = c; } }
    if (t.actual_start) es = t.actual_start;
    if (es && !isWork(D0(es))) es = addWork(es, 0);
    let ef = es ? (dur(t) === 0 ? es : addWork(es, dur(t) - 1)) : null;
    if (t.actual_finish) ef = t.actual_finish;
    else if (t.actual_start && ef && +t.progress < 100) { const rem = Math.ceil(dur(t) * (1 - (+t.progress || 0) / 100)); const e2 = rem > 0 ? addWork(isoToday() > es ? isoToday() : es, rem - 1) : es; if (e2 > ef) ef = e2; }
    const r = { t, es, ef }; info.set(t, r); return r;
  };
  leaves.forEach(t => visit(t));
  const finish = [...info.values()].reduce((m, r) => r.ef && (!m || r.ef > m) ? r.ef : m, null);
  // backward pass
  const succ = new Map(leaves.map(t => [t, []]));
  for (const t of leaves) for (const p of parsePreds(t.predecessors)) { const pt = map.get(p.wbs); if (!pt) continue; for (const k of isSum(pt) ? leaves.filter(l => String(l.wbs).startsWith(pt.wbs + '.')) : [pt]) succ.get(k)?.push({ t, lag: p.lag }); }
  const late = new Map();
  const lateOf = t => { if (late.has(t)) return late.get(t); const i = info.get(t); if (!i || !i.ef) return null; let lf = finish;
    for (const s of succ.get(t) || []) { const ls = lateOf(s.t); if (!ls) continue; let c = dur(s.t) === 0 ? ls.ls : prevWork(ls.ls); c = s.lag > 0 ? subWork(c, s.lag) : c; if (c < lf) lf = c; }
    const ls = dur(t) === 0 ? lf : subWork(lf, Math.max(0, dur(t) - 1)); const r = { lf, ls }; late.set(t, r); return r; };
  const rows = T.map(t => {
    if (isSum(t)) { const ks = leaves.filter(l => String(l.wbs).startsWith(t.wbs + '.')).map(l => info.get(l)).filter(x => x && x.es);
      const es = ks.length ? ks.reduce((m, x) => x.es < m ? x.es : m, ks[0].es) : null, ef = ks.length ? ks.reduce((m, x) => x.ef > m ? x.ef : m, ks[0].ef) : null;
      const kids = leaves.filter(l => String(l.wbs).startsWith(t.wbs + '.')); const w = kids.reduce((s, k) => s + Math.max(1, dur(k)), 0);
      return { t, summary: true, es, ef, progress: w ? kids.reduce((s, k) => s + Math.max(1, dur(k)) * (+k.progress || 0), 0) / w : 0, slip: 0, float: null, critical: false }; }
    const i = info.get(t) || {}, l = lateOf(t) || {}, fl = i.es && l.ls ? workdays(i.es, l.ls) : null;
    const bf = t.baseline_finish, slip = bf && (i.ef || t.forecast_finish) ? workdays(bf, i.ef || t.forecast_finish) : 0;
    return { t, summary: false, es: i.es, ef: i.ef, ls: l.ls, lf: l.lf, float: fl, critical: fl != null && fl <= 0, progress: +t.progress || 0, slip };
  });
  const bfin = T.reduce((m, t) => t.baseline_finish && (!m || t.baseline_finish > m) ? t.baseline_finish : m, null);
  return { rows, finish, baselineFinish: bfin, errors: [...new Set(errors)] };
}
const PJ = { zoom: 5 };
regTab('schedule', () => {}, renderSchedule);
function renderSchedule() {
  const p = pane('schedule'), cpm = scheduleCPM();
  const start = h('input', { type: 'date', value: PH.project.start_date || '' });
  start.addEventListener('change', run(async () => { await API.patchProject({ start_date: start.value || null }); renderSchedule(); }));
  const apply = run(async () => {
    if (!PH.project.start_date) throw new Error('Set the project start date first.');
    const items = cpm.rows.filter(r => r.es && !r.t.actual_finish && (r.es !== r.t.forecast_start || r.ef !== r.t.forecast_finish)).map(r => ({ id: r.t.id, forecast_start: r.es, forecast_finish: r.ef }));
    await API.bulk('tasks', items); toast(`Rescheduled ${items.length} task(s)`); afterChange(); });
  const baseline = run(async () => { if (!confirm('Copy every forecast date to the baseline? Slippage is measured against the baseline from then on.')) return;
    await API.bulk('tasks', PH.rec.tasks.filter(t => t.forecast_start).map(t => ({ id: t.id, baseline_start: t.forecast_start, baseline_finish: t.forecast_finish }))); toast('Baseline set'); afterChange(); });
  const zoom = h('select', { class: 'tsel' }, [[3, 'Months'], [5, 'Weeks'], [12, 'Days']].map(([v, l]) => h('option', { value: v, selected: PJ.zoom === v }, l))); zoom.addEventListener('change', () => { PJ.zoom = +zoom.value; renderSchedule(); });
  p.append(hubTitle('Schedule', 'Critical-path schedule in working days (Monday to Friday). Predecessors are finish-to-start, with optional lag, e.g. “2.1, 3.3+5”.',
    h('label', { class: 'row note' }, 'Project start', start), zoom, h('button', { class: 'btn sm', onclick: apply }, 'Reschedule'), h('button', { class: 'btn sm', onclick: baseline }, 'Set baseline'),
    h('button', { class: 'btn pri sm', onclick: () => openForm('tasks', null, { progress: 0 }) }, 'Add task')));
  const crit = cpm.rows.filter(r => r.critical).length;
  p.append(h('div', { class: 'metricgrid' }, metric('Forecast finish', cpm.finish ? dateTxt(cpm.finish) : '—'), metric('Baseline finish', cpm.baselineFinish ? dateTxt(cpm.baselineFinish) : 'not set'),
    metric('Slip', cpm.finish && cpm.baselineFinish ? `${workdays(cpm.baselineFinish, cpm.finish)} work days` : '—', '', cpm.finish && cpm.baselineFinish && cpm.finish > cpm.baselineFinish ? 'mbad' : ''),
    metric('Critical tasks', String(crit)), metric('Tasks', String(cpm.rows.filter(r => !r.summary).length))));
  if (cpm.errors.length) p.append(h('ul', { class: 'warns' }, ...cpm.errors.map(e => h('li', { class: 'bad' }, e))));
  if (!cpm.rows.some(r => r.es)) { p.append(emptyState('Set a project start date', 'The template WBS has durations and dependencies. Choose a start date above, then press Reschedule to calculate every date and the critical path.')); p.append(registerBlock('tasks')); return; }
  p.append(h('div', { class: 'card' }, gantt(cpm), h('p', { class: 'note' }, 'Bars: forecast (red = critical path, no float), thin grey = baseline, dark fill = progress. Click a row to edit.')));
}
function gantt(cpm) {
  const rows = cpm.rows, dates = rows.flatMap(r => [r.es, r.ef, r.t.baseline_start, r.t.baseline_finish]).filter(Boolean).sort();
  const d0 = D0(dates[0]); d0.setDate(d0.getDate() - 3); const d1 = D0(dates[dates.length - 1]); d1.setDate(d1.getDate() + 10);
  const ppd = PJ.zoom, L = 470, rh = 24, days = Math.round((d1 - d0) / 864e5), W = L + days * ppd + 10, H = 34 + rows.length * rh;
  const x = s => L + Math.round((D0(s) - d0) / 864e5) * ppd;
  let g = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="gantt" role="img" aria-label="Gantt chart"><rect x="${L}" y="0" width="${W - L}" height="${H}" fill="var(--paper)"/>`;
  for (let d = new Date(d0); d <= d1; d.setDate(d.getDate() + 1)) { const xx = x(iso(d));
    if (!isWork(d) && ppd >= 5) g += `<rect x="${xx}" y="28" width="${ppd}" height="${H - 28}" fill="var(--panel-2)" opacity=".6"/>`;
    if (d.getDate() === 1) g += `<line x1="${xx}" y1="0" x2="${xx}" y2="${H}" stroke="var(--rule)"/><text x="${xx + 4}" y="12" font-size="11" fill="var(--ink-2)">${d.toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' })}</text>`;
    if (d.getDay() === 1 && ppd >= 5) g += `<text x="${xx + 2}" y="25" font-size="9.5" fill="var(--ink-3)">${d.getDate()}</text>`; }
  g += `<text x="6" y="22" font-size="11" font-weight="600" fill="var(--ink-2)">WBS</text><text x="46" y="22" font-size="11" font-weight="600" fill="var(--ink-2)">Task</text><text x="${L - 128}" y="22" font-size="11" font-weight="600" fill="var(--ink-2)">Finish</text><text x="${L - 50}" y="22" font-size="11" font-weight="600" fill="var(--ink-2)">Float</text>`;
  rows.forEach((r, i) => { const y = 30 + i * rh, t = r.t, b = t.summary;
    g += `<g class="grow" data-id="${t.id}"><rect x="0" y="${y - 2}" width="${W}" height="${rh}" fill="transparent"/>`;
    g += `<text x="6" y="${y + 13}" font-size="11.5" fill="var(--ink-2)">${escH(t.wbs)}</text><text x="46" y="${y + 13}" font-size="12" ${r.summary ? 'font-weight="600"' : ''} fill="var(--ink)">${escH(String(t.title).slice(0, 44))}</text>`;
    g += `<text x="${L - 128}" y="${y + 13}" font-size="11" fill="var(--ink-2)">${r.ef ? dateTxt(r.ef) : ''}</text><text x="${L - 50}" y="${y + 13}" font-size="11" fill="${r.critical ? 'var(--red)' : 'var(--ink-3)'}">${r.float != null ? r.float + 'd' : ''}</text>`;
    if (t.baseline_start && t.baseline_finish) g += `<rect x="${x(t.baseline_start)}" y="${y + 15}" width="${Math.max(3, x(t.baseline_finish) - x(t.baseline_start) + ppd)}" height="4" rx="2" fill="var(--ink-3)" opacity=".55"/>`;
    if (r.es && r.ef) { const x0 = x(r.es), w = Math.max(ppd, x(r.ef) - x0 + ppd), col = r.summary ? 'var(--ink)' : r.critical ? 'var(--red)' : 'var(--signal)';
      if (+t.is_milestone || (+t.duration_days === 0 && !r.summary)) g += `<path d="M${x0 + ppd / 2} ${y + 2} l7 7 l-7 7 l-7 -7z" fill="${col}"/>`;
      else if (r.summary) g += `<rect x="${x0}" y="${y + 5}" width="${w}" height="6" fill="${col}"/><rect x="${x0}" y="${y + 5}" width="${w * r.progress / 100}" height="6" fill="var(--green)"/>`;
      else g += `<rect x="${x0}" y="${y + 2}" width="${w}" height="12" rx="3" fill="${col}" opacity=".35"/><rect x="${x0}" y="${y + 2}" width="${w * r.progress / 100}" height="12" rx="3" fill="${col}"/>`; }
    g += '</g>'; });
  const tx = x(isoToday()); if (tx > L && tx < W) g += `<line x1="${tx}" y1="28" x2="${tx}" y2="${H}" stroke="var(--amber)" stroke-width="2"/><text x="${tx + 3}" y="${H - 4}" font-size="10" fill="var(--amber)">today</text>`;
  const box = h('div', { class: 'tw ganttwrap', html: g + '</svg>' });
  box.addEventListener('click', e => { const gr = e.target.closest('.grow'); if (gr) openForm('tasks', byId('tasks', gr.dataset.id)); });
  return box;
}

/* ---------------- Project overview, lookahead, registers ---------------- */
regTab('project', () => {}, () => {
  const p = pane('project'), H = projectHealth(), R = PH.rec, t = isoToday();
  p.append(hubTitle('Project controls', 'What is late, what is next, and who owns it.', h('span', { class: 'chip ' + H.cls }, `Health: ${H.label}`)));
  p.append(h('div', { class: 'metricgrid' }, metric('Open actions', String(H.openActions), `${H.overdue} overdue`, H.overdue ? 'mbad' : ''), metric('Open risks', String(R.risks.filter(r => !isClosed('risks', r)).length)),
    metric('Open issues', String(R.issues.filter(r => !isClosed('issues', r)).length)), metric('Decisions', String(R.decisions.length)), metric('Meetings', String(R.meetings.length)),
    metric('Forecast finish', H.cpm.finish ? dateTxt(H.cpm.finish) : '—', H.slip > 0 ? `${H.slip} work days late` : '')));
  const mine = R.actions.filter(a => !isClosed('actions', a)).sort((a, b) => String(a.due_date || '9999').localeCompare(String(b.due_date || '9999')));
  p.append(h('div', { class: 'g-two' }, h('div', { class: 'card' }, h('h3', {}, 'Open actions by due date'), registerTable('actions', mine.slice(0, 12))),
    h('div', { class: 'card' }, h('h3', {}, 'Needs attention'), alertList(alerts().filter(a => a.lvl !== 'info').slice(0, 10)))));
});
regTab('lookahead', () => {}, () => {
  const p = pane('lookahead'), R = PH.rec, t = isoToday(), end = addWork(t, 10), cpm = scheduleCPM(), items = [];
  for (const r of cpm.rows) if (!r.summary && r.es && r.ef && r.es <= end && r.ef >= t && +r.t.progress < 100) items.push({ d: r.es < t ? t : r.es, kind: 'Task', text: `${r.t.wbs} ${r.t.title}`, sub: `${dateTxt(r.es)} → ${dateTxt(r.ef)}${r.critical ? ' · critical' : ''}`, open: () => openForm('tasks', r.t), crit: r.critical });
  for (const [ent, lab] of [['actions', 'Action'], ['deliverables', 'Deliverable'], ['rfis', 'RFI response'], ['po_milestones', 'Payment milestone'], ['supplier_pos', 'Delivery'], ['invoices', 'Invoice due']]) {
    const k = ENTITIES[ent].due; for (const r of R[ent]) if (r[k] && r[k] <= end && !isClosed(ent, r)) items.push({ d: r[k] < t ? t : r[k], late: r[k] < t, kind: lab, text: titleOf(ent, r), sub: (r.owner ? r.owner + ' · ' : '') + dateTxt(r[k]), open: () => openForm(ent, r) }); }
  items.sort((a, b) => a.d.localeCompare(b.d));
  p.append(hubTitle('Two-week lookahead', `${dateTxt(t)} to ${dateTxt(end)}: tasks running, and everything due, across all registers.`));
  if (!items.length) { p.append(emptyState('Nothing scheduled in the next two weeks', 'Set the project start date and reschedule, or add due dates to actions and deliverables.')); return; }
  const days = [...new Set(items.map(i => i.d))];
  p.append(h('div', { class: 'card' }, ...days.map(d => h('div', { class: 'lkday' }, h('h4', {}, D0(d).toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long' })),
    h('ul', { class: 'lk' }, ...items.filter(i => i.d === d).map(i => h('li', { class: i.late ? 'late' : i.crit ? 'crit' : '', onclick: i.open }, h('span', { class: 'kind' }, i.late ? 'Overdue' : i.kind), h('b', {}, i.text), h('span', { class: 'note' }, i.sub))))))));
});
registerPage('actions', 'actions', 'Actions', 'Every action has one owner and one due date. Overdue items are flagged across the hub.');
registerPage('issues', 'issues', 'Issues', 'Problems that have already happened and need resolving.');
registerPage('decisions', 'decisions', 'Decisions', 'The decision log: what was decided, by whom, when and why.');
registerPage('meetings', 'meetings', 'Meetings', 'Minutes and attendance. Notes captured in the Tracker create these automatically after review.');
registerPage('daily', 'daily_logs', 'Site diary', 'Daily record of activities, people on site, weather and delays. Useful later for claims and extension-of-time.');
regTab('risks', () => {}, () => {
  const p = pane('risks'), R = PH.rec.risks.filter(r => !isClosed('risks', r));
  p.append(hubTitle('Risks', 'Probability × impact on a 1–5 scale. Scores of 15 and above appear on the Home page.'));
  const grid = h('div', { class: 'heat' }, h('span', { class: 'hl y' }, 'Probability'), h('span', { class: 'hl x' }, 'Impact'));
  for (let pr = 5; pr >= 1; pr--) for (let im = 1; im <= 5; im++) { const n = R.filter(r => +r.probability === pr && +r.impact === im), s = pr * im;
    grid.append(h('div', { class: 'hc ' + (s >= 15 ? 'r' : s >= 8 ? 'a' : 'g'), title: n.map(r => r.title).join('\n') || `P${pr} × I${im}` }, n.length ? String(n.length) : '')); }
  p.append(h('div', { class: 'g-two' }, h('div', { class: 'card' }, h('h3', {}, 'Heat map (open risks)'), grid), h('div', { class: 'card' }, h('h3', {}, 'Highest scores'),
    registerTable('risks', [...R].sort((a, b) => (b.probability * b.impact || 0) - (a.probability * a.impact || 0)).slice(0, 8), ['title', 'owner', 'probability', 'impact']))));
  p.append(registerBlock('risks'));
});

/* ---------------- Technical ---------------- */
regTab('tech', () => {}, () => {
  const p = pane('tech'), R = PH.rec, sc = reqScore(NET), byS = s => R.requirements.filter(r => r.status === s).length;
  p.append(hubTitle('Technical control', 'Requirements, evidence, submissions and client clarifications.'));
  p.append(h('div', { class: 'metricgrid' }, metric('Automated RF checks', `${sc.pass}/${sc.n}`, `${sc.fail} failing · ${arch().name}`, sc.fail ? 'mbad' : ''),
    metric('Requirements compliant', `${byS('Compliant')}/${R.requirements.length}`, `${byS('Clarification needed')} need clarification`),
    metric('Deliverables approved', `${R.deliverables.filter(d => d.status === 'Approved').length}/${R.deliverables.length}`), metric('Open RFIs', String(R.rfis.filter(r => !isClosed('rfis', r)).length)),
    metric('Documents', String(R.documents.length)), metric('Deviations', String(R.deviations.length), `${R.deviations.filter(d => d.status === 'Approved').length} approved`)));
  p.append(h('div', { class: 'g-two' }, h('div', { class: 'card' }, h('h3', {}, 'RFQ headline'), h('p', {}, REQS.headline), h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => setTab('req') }, 'Live RF compliance'), h('button', { class: 'btn sm', onclick: () => setTab('reqreg') }, 'Requirements register'))),
    h('div', { class: 'card' }, h('h3', {}, 'Open technical questions'), registerTable('rfis', R.rfis.filter(r => !isClosed('rfis', r)), ['ref', 'title', 'required_by', 'status']))));
});
registerPage('reqreg', 'requirements', 'Requirements register', 'Formal status, owner and verification method for each requirement. The live RF check (Technical › Live RF compliance) tests the selected design automatically.');
registerPage('deliverables', 'deliverables', 'Deliverables register', 'Owner, revision, due dates and approval for every deliverable, including the 17 RF subcontractor items.');
registerPage('rfis', 'rfis', 'RFIs and technical queries', 'Questions to the client or consultant, with the date a response is needed.');
registerPage('docs', 'documents', 'Document register', 'Document number, revision, issue purpose and client response. Attach the PDF to each record.');
registerPage('deviations', 'deviations', 'Technical deviations', 'Departures from the specification that need client approval, such as replacing the SR3 omni with point-to-point links.');

/* ---------------- tiny markdown for summaries ---------------- */
function md(s) {
  const lines = escH(s).split('\n'); let out = '', inList = false;
  for (const l of lines) { const b = l.match(/^\s*[-*•]\s+(.*)/);
    if (b) { if (!inList) { out += '<ul>'; inList = true; } out += `<li>${b[1]}</li>`; continue; }
    if (inList) { out += '</ul>'; inList = false; }
    const hd = l.match(/^(#{1,4})\s+(.*)/); if (hd) out += `<h${Math.min(4, hd[1].length + 2)}>${hd[2]}</h${Math.min(4, hd[1].length + 2)}>`; else if (l.trim()) out += `<p>${l}</p>`; }
  return (inList ? out + '</ul>' : out).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/_(.+?)_/g, '<i>$1</i>');
}

/* ---------------- Site overview (RF lab entry) ---------------- */
regTab('site', () => {}, () => {
  const p = pane('site'), sc = reqScore(NET), up = REGISTER.sites.filter(s => S.reg.sites[s.id]?.status === 'existing').length;
  p.append(hubTitle('Site and RF engineering', 'The RF design lab: terrain, towers, links, equipment and the live check against the requirements.'));
  p.append(h('div', { class: 'metricgrid' }, metric('Selected design', arch().name), metric('End to end', fMb(NET.e2e), NET.meets ? 'meets requirement' : `short of ${S.g.reqThroughput} Mbps`, NET.meets ? '' : 'mbad'),
    metric('RF checks', `${sc.pass}/${sc.n}`), metric('Towers up', `${up}/${REGISTER.sites.length}`), metric('Designs compared', String(Object.keys(S.archs).length))));
  const desc = { map: '2D communications map and coverage', net: '3D terrain with Fresnel zones', reg: 'Tower and link build status', prof: 'Terrain profile and clearance', budget: 'Link budget', cmp: 'Compare designs', kit: 'Equipment and suppliers', val: 'Check against the TTA report' };
  p.append(h('div', { class: 'modulegrid' }, ...Object.entries(desc).map(([k, d]) => h('button', { class: 'modulecard', onclick: () => setTab(k) }, h('span', { class: 'eyebrow' }, TAB_LABEL[k]), h('p', {}, d), h('span', { class: 'go' }, 'Open')))));
});
