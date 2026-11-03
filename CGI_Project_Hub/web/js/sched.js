/* Schedule maths (critical path), health, alerts, commercial control, Gantt. */
'use strict';
const WS_COLORS = { 'Project management': '#0b2342', 'Engineering & design': '#2f6fb3', 'Procurement': '#c27c00', 'Panel manufacture': '#6a5ad3', 'FAT': '#1d8a5b',
  'Logistics': '#7a8a9e', 'Site works': '#a0522d', 'Installation': '#005093', 'Commissioning': '#0f7c86', 'SAT': '#2e9d6a', 'Handover & close-out': '#b0457b', 'Commercial': '#8a4fb3' };
const wsColor = w => WS_COLORS[w] || '#5b7da3';

function parsePreds(s) { return String(s || '').split(/[,;]+/).map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^([\d.]+)\s*(?:FS)?\s*([+-]\s*\d+)?/i); return m ? { wbs: m[1], lag: m[2] ? parseInt(m[2].replace(/\s/g, '')) : 0 } : null; }).filter(Boolean); }

/* Critical path in working days. Stored forecast dates act as "start no earlier than" constraints, so dates typed in
   (or imported from a schedule) are kept; Reschedule only moves tasks whose predecessors push them later. */
function scheduleCPM(rec = ST.PH.rec, project = ST.PH.project) {
  const T = sortRows('tasks', rec.tasks, 'wbs'), map = new Map(T.map(t => [String(t.wbs), t])), S0 = project.start_date;
  const kids = new Map(T.map(t => [t, T.filter(o => o !== t && String(o.wbs).startsWith(String(t.wbs) + '.'))]));
  const isSum = t => kids.get(t).length > 0, leaves = T.filter(t => !isSum(t)), info = new Map(), errors = [];
  const dur = t => t.duration_days != null && t.duration_days !== '' ? Math.max(0, Math.round(+t.duration_days)) : (t.forecast_start && t.forecast_finish ? Math.max(0, workdays(t.forecast_start, t.forecast_finish) + (+t.is_milestone ? 0 : 1)) : null);
  const visit = (t, stack = []) => {
    if (info.has(t)) return info.get(t); if (stack.includes(t)) { errors.push(`Circular dependency at ${t.wbs}`); return {}; }
    const preds = parsePreds(t.predecessors); let es = null, driven = false;
    for (const p of preds) { const pt = map.get(p.wbs); if (!pt) { errors.push(`${t.wbs}: unknown predecessor ${p.wbs}`); continue; }
      for (const k of isSum(pt) ? kids.get(pt).filter(x => !isSum(x)) : [pt]) { const pi = visit(k, [...stack, t]); if (!pi || !pi.ef) continue;
        let c = (dur(t) === 0 || dur(k) === 0) ? pi.ef : nextWork(pi.ef); c = p.lag > 0 ? addWork(c, p.lag) : p.lag < 0 ? subWork(c, -p.lag) : c; if (!es || c > es) { es = c; driven = true; } } }
    if (t.forecast_start && (!es || t.forecast_start > es)) { es = t.forecast_start; driven = false; }
    if (!es && !preds.length && S0 && dur(t) != null) es = S0;
    if (dur(t) == null && !t.actual_start) es = null;
    if (t.actual_start) es = t.actual_start;
    if (es && !isWork(D0(es)) && dur(t) !== 0) es = addWork(es, 0);
    const d = dur(t); let ef = es && d != null ? (d === 0 ? es : addWork(es, d - 1)) : null;
    if (t.actual_finish) ef = t.actual_finish;
    else if (ef && (+t.progress || 0) < 100 && (t.actual_start || es < isoToday()) && d) { const rem = Math.ceil(d * (1 - (+t.progress || 0) / 100)); const e2 = rem > 0 ? addWork(isoToday() > es ? isoToday() : es, rem - 1) : es; if (t.actual_start && e2 > ef) ef = e2; }
    const r = { t, es, ef, dur: d, driven }; info.set(t, r); return r;
  };
  leaves.forEach(t => visit(t));
  const finish = [...info.values()].reduce((m, r) => r.ef && (!m || r.ef > m) ? r.ef : m, null);
  const succ = new Map(leaves.map(t => [t, []]));
  for (const t of leaves) for (const p of parsePreds(t.predecessors)) { const pt = map.get(p.wbs); if (!pt) continue; for (const k of isSum(pt) ? kids.get(pt).filter(x => !isSum(x)) : [pt]) succ.get(k)?.push({ t, lag: p.lag }); }
  const late = new Map();
  const lateOf = t => { if (late.has(t)) return late.get(t); const i = info.get(t); if (!i || !i.ef) return null; let lf = finish;
    for (const s of succ.get(t) || []) { const ls = lateOf(s.t); if (!ls) continue; let c = (info.get(s.t).dur === 0 || i.dur === 0) ? ls.ls : prevWork(ls.ls); c = s.lag > 0 ? subWork(c, s.lag) : c; if (c < lf) lf = c; }
    const ls = !i.dur ? lf : subWork(lf, Math.max(0, i.dur - 1)); const r = { lf, ls }; late.set(t, r); return r; };
  const rows = T.map(t => {
    if (isSum(t)) { const ks = kids.get(t).filter(x => !isSum(x)).map(l => info.get(l)).filter(x => x && x.es);
      const es = ks.length ? ks.reduce((m, x) => x.es < m ? x.es : m, ks[0].es) : null, ef = ks.length ? ks.reduce((m, x) => x.ef > m ? x.ef : m, ks[0].ef) : null;
      const lv = kids.get(t).filter(x => !isSum(x)); const w = lv.reduce((s, k) => s + Math.max(1, dur(k) || 1), 0);
      return { t, summary: true, es, ef, progress: w ? lv.reduce((s, k) => s + Math.max(1, dur(k) || 1) * (+k.progress || 0), 0) / w : 0, slip: 0, float: null, critical: false, level: String(t.wbs).split('.').length }; }
    const i = info.get(t) || {}, l = lateOf(t) || {}, fl = i.es && l.ls ? workdays(i.es, l.ls) : null;
    const bf = t.baseline_finish, slip = bf && i.ef ? workdays(bf, i.ef) : 0;
    const late_ = i.ef && i.ef < isoToday() && (+t.progress || 0) < 100 && t.status !== 'Complete';
    return { t, summary: false, es: i.es, ef: i.ef, dur: i.dur, ls: l.ls, lf: l.lf, float: fl, critical: fl != null && fl <= 0 && (+t.progress || 0) < 100, progress: +t.progress || 0, slip, late: late_, level: String(t.wbs).split('.').length,
      changed: !!(i.es && (i.es !== t.forecast_start || i.ef !== t.forecast_finish) && !t.actual_finish && i.dur != null) };
  });
  const bfin = T.reduce((m, t) => t.baseline_finish && (!m || t.baseline_finish > m) ? t.baseline_finish : m, null);
  const lv = rows.filter(r => !r.summary); const W = lv.reduce((s, r) => s + Math.max(1, r.dur || 1), 0);
  const progress = W ? lv.reduce((s, r) => s + Math.max(1, r.dur || 1) * r.progress, 0) / W : 0;
  return { rows, finish, baselineFinish: bfin, errors: [...new Set(errors)], progress };
}

/* ---------------- commercial control ---------------- */
function quoteTotals(q, rec = ST.PH.rec) {
  const lines = rec.quote_lines.filter(l => String(l.quote_id) === String(q.id));
  const net = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0) * (1 - (+l.discount_pct || 0) / 100), 0);
  const zar = net * (+q.exchange_rate || 1); return { lines, net, zar, vat: zar * (q.vat_rate == null ? 15 : +q.vat_rate) / 100 };
}
function commercial(rec = ST.PH.rec) {
  const R = rec, t = isoToday();
  const poValue = R.client_pos.reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
  const varSell = R.variations.filter(v => v.status === 'Approved').reduce((s, v) => s + (+v.sell_value || 0), 0), contract = poValue + varSell;
  const codes = R.cost_codes.map(c => {
    const budget = (+c.budget || 0) + (+c.approved_changes || 0);
    const committed = R.supplier_pos.filter(p => p.cost_code === c.code && p.status !== 'Cancelled').reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
    const actual = R.invoices.filter(i => i.direction === 'Supplier invoice' && i.cost_code === c.code).reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
    const etc = +c.etc || 0, eac = Math.max(committed, actual) + etc; return { c, code: c.code, name: c.name, budget, committed, actual, etc, eac, variance: budget - eac };
  });
  const uncoded = R.supplier_pos.filter(p => p.status !== 'Cancelled' && !R.cost_codes.some(c => c.code === p.cost_code)).reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
  const sum = k => codes.reduce((s, x) => s + x[k], 0), forecast = sum('eac') + uncoded, margin = contract - forecast;
  const billed = R.invoices.filter(i => i.direction === 'Client invoice').reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
  const received = R.invoices.filter(i => i.direction === 'Client invoice' && i.status === 'Paid').reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
  const quotes = R.supplier_quotes.map(r => ({ r, ...quoteTotals(r, R), daysLeft: r.validity_date ? daysBetween(t, r.validity_date) : null, supplier: R.suppliers.find(s => String(s.id) === String(r.supplier_id)) }));
  return { poValue, varSell, contract, codes, uncoded, budget: sum('budget'), committed: sum('committed') + uncoded, actual: sum('actual'), etc: sum('etc'), forecast, margin,
    marginPct: contract ? 100 * margin / contract : 0, billed, received, quotes, overrun: codes.filter(x => x.budget > 0 && x.eac > x.budget), hasCost: forecast > 0 };
}

/* ---------------- health & alerts (work on any project's records) ---------------- */
function health(rec, project) {
  const t = isoToday(), openA = rec.actions.filter(a => !isClosed('actions', a)), od = openA.filter(a => a.due_date && a.due_date < t), odHigh = od.filter(a => ['High', 'Critical'].includes(a.priority));
  const cpm = scheduleCPM(rec, project), slip = cpm.finish && cpm.baselineFinish ? workdays(cpm.baselineFinish, cpm.finish) : 0, lateTasks = cpm.rows.filter(r => r.late);
  const C = commercial(rec), procLate = rec.procurement.filter(p => !isClosed('procurement', p) && p.expected_delivery && p.expected_delivery < t);
  const punchA = rec.punch_items.filter(p => p.status !== 'Closed' && String(p.category || '').startsWith('A'));
  const target = project.target_finish, overTarget = target && cpm.finish && cpm.finish > target;
  const red = odHigh.length > 0 || slip > 10 || (C.contract > 0 && C.hasCost && C.margin < 0) || overTarget, amber = od.length > 0 || slip > 0 || lateTasks.length > 0 || procLate.length > 0 || C.overrun.length > 0 || punchA.length > 0;
  return { label: red ? 'Red' : amber ? 'Amber' : 'Green', openActions: openA.length, overdue: od.length, slip, lateTasks, procLate, cpm, C, punchA, overTarget,
    nextMs: cpm.rows.filter(r => +r.t.is_milestone && r.ef && r.ef >= t && r.progress < 100).sort((a, b) => a.ef < b.ef ? -1 : 1)[0] };
}
function alerts(rec = ST.PH.rec, project = ST.PH.project, code = ST.code) {
  const out = [], t = isoToday(), H = health(rec, project), C = H.C;
  const nav = (r, p) => () => go(r, p || {}, code);
  for (const k of ['actions', 'issues', 'rfis', 'deliverables', 'po_milestones', 'invoices', 'procurement', 'punch_items', 'tests', 'reminders'])
    for (const r of rec[k] || []) if (dueOf(k, r) && dueOf(k, r) < t && !isClosed(k, r)) out.push({ lvl: 'bad', k, r, text: `${ent(k).singular} overdue: ${titleOf(k, r)} (due ${fdate(dueOf(k, r))})` });
  for (const r of H.lateTasks) out.push({ lvl: r.critical ? 'bad' : 'warn', k: 'tasks', r: r.t, text: `Task ${r.t.wbs} ${r.t.title} should have finished ${fdate(r.ef)} (${r.progress}% done) — update progress or dates` });
  if (H.overTarget) out.push({ lvl: 'bad', text: `Forecast finish ${fdate(H.cpm.finish)} is after the target ${fdate(project.target_finish)}`, open: nav('schedule') });
  for (const r of H.cpm.rows.filter(r => r.slip > 0 && !r.summary)) out.push({ lvl: r.critical ? 'bad' : 'warn', k: 'tasks', r: r.t, text: `Task ${r.t.wbs} ${r.t.title} is ${r.slip} work days behind baseline${r.critical ? ' (critical path)' : ''}` });
  for (const q of C.quotes) if (q.daysLeft != null && q.daysLeft <= 7 && !['Rejected', 'Ordered', 'Expired'].includes(q.r.status)) out.push({ lvl: q.daysLeft < 0 ? 'warn' : 'warn', k: 'supplier_quotes', r: q.r, text: `Supplier quote ${q.r.quote_ref} ${q.daysLeft < 0 ? 'expired ' + (-q.daysLeft) + ' days ago' : 'expires in ' + q.daysLeft + ' days'}` });
  for (const c of C.overrun) out.push({ lvl: 'bad', text: `Cost code ${c.code} ${c.name}: forecast ${money(c.eac)} exceeds budget ${money(c.budget)}`, open: nav('commercials', { tab: 'budget' }) });
  for (const r of rec.risks) if (!isClosed('risks', r) && (r.probability || 0) * (r.impact || 0) >= 15) out.push({ lvl: 'warn', k: 'risks', r, text: `High risk: ${r.title} (score ${(r.probability * r.impact)})` });
  const unsched = rec.tasks.filter(x => !x.forecast_start && (x.duration_days == null || x.duration_days === '') && String(x.wbs).includes('.'));
  if (unsched.length) out.push({ lvl: 'info', text: `${unsched.length} task(s) have no dates or duration yet: ${unsched.slice(0, 4).map(x => x.title).join(', ')}`, open: nav('schedule') });
  const noA = rec.raci.filter(r => !Object.values(r.assignments || {}).some(v => String(v).includes('A')));
  if (rec.raci.length && noA.length) out.push({ lvl: 'info', text: `RACI: ${noA.length} activit${noA.length === 1 ? 'y has' : 'ies have'} no one Accountable`, open: nav('people', { tab: 'raci' }) });
  if (!rec.client_pos.length) out.push({ lvl: 'info', text: 'No client purchase order captured yet.', open: nav('commercials', { tab: 'po' }) });
  return out.map(a => ({ ...a, open: a.open || (a.k ? () => { if (code !== ST.code) go(a.k === 'tasks' ? 'schedule' : 'overview', {}, code); else openForm(a.k, a.r); } : null) }));
}
const alertList = (items, n = 12) => items.length ? h('ul', { class: 'alerts' }, items.slice(0, n).map(a => h('li', { class: a.lvl, onclick: a.open }, a.text)), items.length > n ? h('li', { class: 'info' }, `+ ${items.length - n} more`) : null) : h('p', { class: 'note' }, 'Nothing needs attention. ✓');

/* ---------------- Gantt (SVG) ---------------- */
function gantt(cpm, opts = {}) {
  const zoom = opts.zoom || 'week', ppd = { day: 26, week: 9, month: 3.2 }[zoom], group = opts.group || 'wbs';
  let rows = cpm.rows.filter(r => opts.filter ? opts.filter(r) : true);
  if (group === 'workstream') {
    const lanes = {}; for (const r of rows.filter(r => !r.summary)) (lanes[r.t.workstream || 'Unassigned'] = lanes[r.t.workstream || 'Unassigned'] || []).push(r);
    const order = [...(ST.cfg.meta.workstreams || []), 'Unassigned'];
    rows = []; for (const w of order) if (lanes[w]) { const ls = lanes[w].sort((a, b) => (a.es || '9') < (b.es || '9') ? -1 : 1);
      const es = ls.map(x => x.es).filter(Boolean).sort()[0], ef = ls.map(x => x.ef).filter(Boolean).sort().pop();
      rows.push({ lane: w, summary: true, es, ef, t: { title: w, wbs: '' }, progress: ls.reduce((s, x) => s + x.progress, 0) / ls.length }); rows.push(...ls); }
  }
  const dates = rows.flatMap(r => [r.es, r.ef, r.t.baseline_start, r.t.baseline_finish]).filter(Boolean).sort();
  if (!dates.length) return empty('No dated tasks yet', 'Give tasks a start date or a duration and predecessors, then press Reschedule.');
  const d0 = D0(dates[0]); d0.setDate(d0.getDate() - (zoom === 'day' ? 3 : 7)); while (d0.getDay() !== 1) d0.setDate(d0.getDate() - 1);
  const d1 = D0(dates[dates.length - 1]); d1.setDate(d1.getDate() + (zoom === 'day' ? 7 : 21));
  if (opts.until && D0(opts.until) > d1) d1.setTime(D0(opts.until).getTime() + 7 * 864e5);
  const L = 470, rh = 26, top = 46, days = Math.round((d1 - d0) / 864e5), W = L + days * ppd + 20, H = top + rows.length * rh + 6;
  const x = s => L + Math.round((D0(s) - d0) / 864e5) * ppd;
  const svg = S('svg', { width: W, height: H, viewBox: `0 0 ${W} ${H}` });
  svg.append(S('defs', {}, S('marker', { id: 'arr', viewBox: '0 0 8 8', refX: 7, refY: 4, markerWidth: 6, markerHeight: 6, orient: 'auto' }, S('path', { d: 'M0 0L8 4L0 8z', fill: '#8a9bb0' }))));
  // header
  svg.append(S('rect', { x: 0, y: 0, width: W, height: top, fill: '#f6f8fb' }), S('line', { x1: 0, x2: W, y1: top, y2: top, stroke: '#dfe5ec' }));
  for (const [lx, t] of [[10, 'WBS'], [52, 'Task'], [300, 'Start'], [362, 'Finish'], [424, '%']]) svg.append(S('text', { x: lx, y: 30, 'font-size': 10.5, fill: '#76869a', 'font-weight': 600, 'letter-spacing': '.06em' }, t.toUpperCase()));
  const dd = new Date(d0);
  for (let i = 0; i <= days; i++, dd.setDate(dd.getDate() + 1)) {
    const X = L + i * ppd;
    if (dd.getDate() === 1 || i === 0) svg.append(S('text', { x: X + 3, y: 15, 'font-size': 11, fill: '#14253a', 'font-weight': 600 }, `${MON[dd.getMonth()]} ${dd.getFullYear()}`), S('line', { x1: X, x2: X, y1: 0, y2: H, stroke: '#dfe5ec' }));
    if (zoom === 'day') { if (!isWork(dd)) svg.append(S('rect', { x: X, y: top, width: ppd, height: H - top, fill: '#f4f6f9' })); svg.append(S('text', { x: X + ppd / 2, y: 38, 'font-size': 10, fill: isWork(dd) ? '#405468' : '#a9b4c1', 'text-anchor': 'middle' }, dd.getDate())); }
    else if (zoom === 'week' && dd.getDay() === 1) svg.append(S('text', { x: X + 2, y: 38, 'font-size': 10, fill: '#76869a' }, dd.getDate()), S('line', { x1: X, x2: X, y1: top, y2: H, stroke: '#f0f3f6' }));
  }
  svg.append(S('line', { x1: L, x2: L, y1: 0, y2: H, stroke: '#cfd8e3' }));
  const pos = new Map();
  rows.forEach((r, i) => {
    const y = top + i * rh, cy = y + rh / 2, t = r.t;
    const g = S('g', { style: 'cursor:pointer', onclick: () => r.lane ? null : (opts.onClick || (z => openTask(z)))(t) });
    if (i % 2 === 0) g.append(S('rect', { x: 0, y, width: W, height: rh, fill: r.lane ? '#eef3f9' : '#fbfcfe' }));
    else if (r.lane) g.append(S('rect', { x: 0, y, width: W, height: rh, fill: '#eef3f9' }));
    const ind = r.lane ? 0 : Math.max(0, (r.level || 1) - 1) * 12;
    g.append(S('text', { x: 10, y: cy + 4, 'font-size': 11.5, fill: '#76869a' }, t.wbs || ''));
    const title = String(t.title || ''); g.append(S('text', { x: 52 + ind, y: cy + 4, 'font-size': 12.5, fill: r.lane ? '#0b2342' : r.late ? '#c43b31' : '#14253a', 'font-weight': r.summary ? 700 : 400 }, title.length > 34 - ind / 6 ? title.slice(0, 33 - ind / 6) + '…' : title));
    g.append(S('text', { x: 300, y: cy + 4, 'font-size': 11.5, fill: '#405468' }, r.es ? sdate(r.es) : ''), S('text', { x: 362, y: cy + 4, 'font-size': 11.5, fill: r.late ? '#c43b31' : '#405468' }, r.ef ? sdate(r.ef) : ''));
    g.append(S('text', { x: 424, y: cy + 4, 'font-size': 11.5, fill: '#405468' }, r.es ? Math.round(r.progress) + '%' : ''));
    if (r.es && r.ef) {
      const x0 = x(r.es), x1 = x(r.ef) + ppd;
      if (t.baseline_start && t.baseline_finish && !r.summary) g.append(S('rect', { x: x(t.baseline_start), y: cy + 6, width: Math.max(3, x(t.baseline_finish) + ppd - x(t.baseline_start)), height: 3, fill: '#b9c4d0', rx: 1.5 }));
      if (r.summary) { const col = r.lane ? wsColor(r.lane) : '#0b2342'; g.append(S('rect', { x: x0, y: cy - 4, width: Math.max(4, x1 - x0), height: 7, fill: col, rx: 2, opacity: r.lane ? .35 : .9 }), S('rect', { x: x0, y: cy - 4, width: Math.max(0, (x1 - x0) * r.progress / 100), height: 7, fill: col, rx: 2 })); }
      else if (+t.is_milestone || r.dur === 0) { const c = r.late ? '#c43b31' : r.critical ? '#c43b31' : '#6a5ad3'; g.append(S('path', { d: `M${x0 + ppd / 2} ${cy - 7} l7 7 l-7 7 l-7 -7z`, fill: r.progress >= 100 ? '#1d8a5b' : c })); g.append(S('text', { x: x0 + ppd / 2 + 11, y: cy + 4, 'font-size': 11, fill: '#405468' }, title.slice(0, 26))); }
      else { const col = wsColor(t.workstream); g.append(S('rect', { x: x0, y: cy - 7, width: Math.max(5, x1 - x0), height: 13, rx: 3, fill: col, opacity: .28, stroke: r.critical ? '#c43b31' : 'none', 'stroke-width': 1.6 }));
        g.append(S('rect', { x: x0, y: cy - 7, width: Math.max(0, (x1 - x0) * r.progress / 100), height: 13, rx: 3, fill: col }));
        if (x1 - x0 < 140) g.append(S('text', { x: x1 + 5, y: cy + 4, 'font-size': 11, fill: '#76869a' }, t.owner || '')); }
      pos.set(String(t.wbs), { x0, x1, cy });
    } else if (!r.summary) g.append(S('text', { x: L + 8, y: cy + 4, 'font-size': 11, fill: '#a9b4c1', 'font-style': 'italic' }, 'not scheduled — add a duration or dates'));
    g.append(S('title', {}, `${t.wbs || ''} ${title}\n${r.es ? fdate(r.es) + ' → ' + fdate(r.ef) : 'unscheduled'}${r.float != null ? `\nFloat: ${r.float} work days` : ''}${t.owner ? '\nOwner: ' + t.owner : ''}`));
    svg.append(g);
  });
  if (opts.links !== false && group === 'wbs') for (const r of rows) { if (r.summary) continue; const me = pos.get(String(r.t.wbs)); if (!me) continue;
    for (const p of parsePreds(r.t.predecessors)) { const a = pos.get(p.wbs); if (!a) continue; const sx = a.x1, sy = a.cy, ex = me.x0, ey = me.cy;
      svg.append(S('path', { d: `M${sx} ${sy} h6 V${ey} H${ex - 1}`, fill: 'none', stroke: '#8a9bb0', 'stroke-width': 1, 'marker-end': 'url(#arr)', opacity: .6, 'pointer-events': 'none' })); } }
  const tx = x(isoToday()); if (tx > L && tx < W) svg.append(S('line', { x1: tx, x2: tx, y1: top - 6, y2: H, stroke: '#c43b31', 'stroke-width': 1.5, 'stroke-dasharray': '4 3' }), S('text', { x: tx + 3, y: top - 8, 'font-size': 10, fill: '#c43b31', 'font-weight': 700 }, 'TODAY'));
  if (opts.until) { const ux = x(opts.until) + ppd; svg.append(S('line', { x1: ux, x2: ux, y1: top - 6, y2: H, stroke: '#6a5ad3', 'stroke-width': 1.5 }), S('text', { x: ux - 4, y: top - 8, 'font-size': 10, fill: '#6a5ad3', 'font-weight': 700, 'text-anchor': 'end' }, 'TARGET')); }
  const box = h('div', { class: 'gantt', style: opts.height ? `max-height:${opts.height}` : '' }, svg);
  setTimeout(() => { if (tx > L) box.scrollLeft = Math.max(0, tx - L - 200); }, 0);
  return box;
}
