/* Procurement tracker, supplier quotes/POs, FAT/SAT tests and punch list. */
'use strict';
const PROC_STAGES = ['Not started', 'Specifying', 'RFQ sent', 'Quoted', 'Ordered', 'Expediting', 'In transit', 'Delivered', 'Inspected', 'Issued to site', 'Installed'];
let PROC_FILTER = '';
route('procurement', { title: 'Procurement', icon: 'truck', group: 'Delivery', project: true, badge: () => ST.PH ? ST.PH.rec.procurement.filter(p => overdue('procurement', p)).length : 0, render: v => {
  const tab = ST.params.tab || 'tracker', R = ST.PH.rec;
  v.append(pageHead('Supply chain', 'Procurement', 'Track every item from specification to installed: supplier, quote, PO, lead time, delivery and inspection.'));
  v.append(tabs([['tracker', 'Tracker', R.procurement.length], ['quotes', 'Supplier quotes', R.supplier_quotes.length], ['compare', 'Quote comparison'], ['pos', 'Supplier POs', R.supplier_pos.length], ['suppliers', 'Suppliers', R.suppliers.length]], tab, k => go('procurement', { tab: k })));
  if (tab === 'tracker') {
    const t = isoToday(), late = R.procurement.filter(p => overdue('procurement', p)), needBy = R.procurement.filter(p => !isClosed('procurement', p) && p.required_by && p.expected_delivery && p.expected_delivery > p.required_by);
    v.append(h('div', { class: 'kpis' }, kpi('Items', String(R.procurement.length)), kpi('Ordered or later', String(R.procurement.filter(p => PROC_STAGES.indexOf(p.status) >= 4).length)),
      kpi('Delivered', String(R.procurement.filter(p => PROC_STAGES.indexOf(p.status) >= 7).length), '', 'good'), kpi('Late deliveries', String(late.length), late.length ? 'past expected date' : 'none', late.length ? 'bad' : ''),
      kpi('Arrives after needed', String(needBy.length), 'expected delivery after required-on-site date', needBy.length ? 'warn' : ''), kpi('Committed', kmoney(R.procurement.reduce((s, p) => s + (+p.cost || 0), 0)), 'sum of item costs')));
    v.append(h('div', { class: 'pipe' }, PROC_STAGES.map(s => { const n = R.procurement.filter(p => p.status === s).length; return h('div', { class: PROC_FILTER === s ? 'on' : '', onclick: () => { PROC_FILTER = PROC_FILTER === s ? '' : s; rerender(); } }, h('b', {}, n), h('span', {}, s)); })));
    v.append(registerBlock('procurement', { rows: () => R.procurement.filter(p => !PROC_FILTER || p.status === PROC_FILTER), cols: ['item', 'category', 'supplier_id', 'required_by', 'expected_delivery', 'location', 'inspection', 'status'],
      extra: p => p.required_by && p.expected_delivery && p.expected_delivery > p.required_by && !isClosed('procurement', p) ? chip(`${daysBetween(p.required_by, p.expected_delivery)}d late for site`, 'red') : '', extraLabel: 'Need-by' }));
  } else if (tab === 'quotes') v.append(registerBlock('supplier_quotes', { extra: q => money(quoteTotals(q).zar), extraLabel: 'Total (ZAR excl.)' }));
  else if (tab === 'pos') v.append(registerBlock('supplier_pos'));
  else if (tab === 'suppliers') v.append(registerBlock('suppliers'));
  else {
    const C = commercial(), qs = C.quotes;
    if (!qs.length) { v.append(empty('No supplier quotes yet', 'Add quotes with their line items to compare price, validity, lead time and terms.')); return; }
    const best = qs.filter(q => q.zar > 0 && !['Rejected', 'Expired'].includes(q.r.status)).sort((a, b) => a.zar - b.zar)[0];
    v.append(h('div', { class: 'twrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Supplier', 'Quote', 'Option', 'Lines', 'Total excl. VAT (ZAR)', 'Valid until', 'Lead time', 'Payment terms', 'Status'].map(x => h('th', {}, x)))),
      h('tbody', {}, qs.map(q => h('tr', { onclick: () => openForm('supplier_quotes', q.r), style: q === best ? 'background:#f2fbf6' : '' }, h('td', {}, q.supplier?.name || '—'), h('td', {}, q.r.quote_ref), h('td', { class: 'wrap' }, q.r.option || ''), h('td', { class: 'num' }, q.lines.length),
        h('td', { class: 'num' }, h('b', {}, money(q.zar)), q === best ? chip('lowest', 'green') : null), h('td', {}, q.r.validity_date ? [fdate(q.r.validity_date), q.daysLeft < 0 ? chip('expired', 'red') : q.daysLeft <= 7 ? chip(`${q.daysLeft}d`, 'amber') : null] : '—'),
        h('td', {}, q.r.lead_time || ''), h('td', { class: 'wrap' }, q.r.payment_terms || ''), h('td', {}, chip(q.r.status))))))));
    v.append(h('p', { class: 'note' }, 'Totals are line quantity × unit price less discount, converted with the quote exchange rate. Open a quote to edit its lines.'));
  }
} });
FORM_EXTRAS.supplier_quotes = (q, wrap) => { wrap.append(h('div', { class: 'sub' }, h('h4', {}, 'Quote lines', h('button', { class: 'btn sm right', onclick: () => openForm('quote_lines', null, { quote_id: q.id }, () => openForm('supplier_quotes', byId('supplier_quotes', q.id))) }, icon('plus'), 'Line')),
  table('quote_lines', ST.PH.rec.quote_lines.filter(l => String(l.quote_id) === String(q.id)), { cols: ['part_number', 'description', 'quantity', 'unit_price', 'discount_pct', 'cost_code'], onRow: l => openForm('quote_lines', l, {}, () => openForm('supplier_quotes', byId('supplier_quotes', q.id))) }),
  h('p', { class: 'small', style: 'text-align:right' }, 'Total: ', h('b', {}, money(quoteTotals(q).zar)), ' excl. VAT'))); };
FORM_EXTRAS.suppliers = (s, wrap) => { const items = ST.PH.rec.procurement.filter(p => String(p.supplier_id) === String(s.id)); if (items.length) wrap.append(h('div', { class: 'sub' }, h('h4', {}, 'Procurement items'), table('procurement', items, { cols: ['item', 'expected_delivery', 'status'] }))); };

/* ---------------- quality: FAT / SAT ---------------- */
route('quality', { title: 'FAT / SAT & punch list', icon: 'test', group: 'Delivery', project: true, badge: () => ST.PH ? ST.PH.rec.punch_items.filter(p => p.status !== 'Closed' && String(p.category || '').startsWith('A')).length : 0, render: v => {
  const tab = ST.params.tab || 'tests', R = ST.PH.rec;
  v.append(pageHead('Quality', 'FAT / SAT & punch list', 'Factory and site acceptance tests with criteria, witnesses, results and sign-off; defects tracked on the punch list until closed.'));
  const res = k => R.tests.filter(t => t.result === k).length;
  v.append(h('div', { class: 'kpis' }, kpi('Tests', String(R.tests.length), `${R.tests.filter(t => t.test_type === 'FAT').length} FAT · ${R.tests.filter(t => t.test_type === 'SAT').length} SAT`),
    kpi('Passed', String(res('Pass') + res('Pass with comments')), `${res('Pass with comments')} with comments`, 'good'), kpi('Failed / retest', String(res('Fail') + res('Retest required')), '', res('Fail') + res('Retest required') ? 'bad' : ''),
    kpi('Signed off', String(R.tests.filter(t => t.signoff_date).length)), kpi('Open punch items', String(R.punch_items.filter(p => p.status !== 'Closed').length), `${R.punch_items.filter(p => p.status !== 'Closed' && String(p.category || '').startsWith('A')).length} category A`, R.punch_items.some(p => p.status !== 'Closed' && String(p.category || '').startsWith('A')) ? 'warn' : '')));
  v.append(tabs([['tests', 'Tests'], ['punch', 'Punch list', R.punch_items.filter(p => p.status !== 'Closed').length]], tab, k => go('quality', { tab: k })));
  if (tab === 'punch') { v.append(registerBlock('punch_items', { presets: () => ({ ref: `P-${String(R.punch_items.length + 1).padStart(3, '0')}` }) })); return; }
  const groups = ['FAT', 'SAT', 'SIT', 'Pre-commissioning', 'Commissioning', 'Performance test'].filter(g => R.tests.some(t => t.test_type === g));
  if (!R.tests.length) v.append(empty('No tests planned yet', 'Plan the FAT before dispatch and the SAT on site. Add acceptance criteria and witnesses so sign-off is clear.'));
  for (const g of groups) v.append(h('h3', { style: 'margin:14px 0 8px' }, g), h('div', { class: 'grid g3' }, R.tests.filter(t => t.test_type === g).map(t => {
    const pi = R.punch_items.filter(p => String(p.test_id) === String(t.id)), open = pi.filter(p => p.status !== 'Closed').length;
    return h('div', { class: 'card', style: 'cursor:pointer', onclick: () => openForm('tests', t) }, h('div', { class: 'row' }, h('b', {}, t.ref || ''), chip(t.result), t.signoff_date ? chip('signed off', 'green') : null),
      h('div', { style: 'font-weight:600;margin:6px 0' }, t.title), h('div', { class: 'small muted' }, `${t.planned_date ? 'Planned ' + fdate(t.planned_date) : 'Not dated'}${t.location ? ' · ' + t.location : ''}`),
      t.witness ? h('div', { class: 'small' }, 'Witness: ' + t.witness) : null, h('div', { class: 'small', style: 'margin-top:6px' }, pi.length ? `${open} open of ${pi.length} punch items` : 'No punch items'));
  })));
  v.append(h('div', { style: 'margin-top:14px' }, h('button', { class: 'btn pri', onclick: () => openForm('tests', null, { ref: `T-${String(R.tests.length + 1).padStart(3, '0')}` }) }, icon('plus'), 'Add test'), ' ', h('button', { class: 'btn', onclick: () => go('quality', { tab: 'punch' }) }, 'Punch list')));
} });
FORM_EXTRAS.tests = (t, wrap) => {
  const box = h('div', { class: 'sub' }); const draw = () => { const pi = ST.PH.rec.punch_items.filter(p => String(p.test_id) === String(t.id)); box.innerHTML = '';
    box.append(h('h4', {}, 'Punch items', h('button', { class: 'btn sm right', onclick: () => openForm('punch_items', null, { test_id: t.id, ref: `${t.ref || 'P'}-${pi.length + 1}` }, () => openForm('tests', byId('tests', t.id))) }, icon('plus'), 'Punch item'),
      h('button', { class: 'btn sm', onclick: () => printTest(t) }, icon('print'), 'Test sheet')), table('punch_items', pi, { cols: ['ref', 'description', 'category', 'owner', 'due_date', 'status'], onRow: p => openForm('punch_items', p, {}, () => openForm('tests', byId('tests', t.id))) })); };
  draw(); wrap.append(box);
};
function printTest(t) {
  const p = ST.PH.project, pi = ST.PH.rec.punch_items.filter(x => String(x.test_id) === String(t.id)), w = window.open('', '_blank');
  w.document.write(`<html><head><title>${esc(t.ref || '')} ${esc(t.title)}</title><style>body{font:12.5px/1.5 "Segoe UI",Arial;margin:32px;color:#14253a}h1{color:#005093;font-size:20px;margin:0}table{border-collapse:collapse;width:100%;margin-top:12px}td,th{border:1px solid #dfe5ec;padding:7px 9px;text-align:left;vertical-align:top}th{background:#f3f6fa;width:22%}.hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #005093;padding-bottom:10px}</style></head><body>
  <div class="hd"><div><div style="font-size:11px;letter-spacing:.14em;color:#76869a">${esc(t.test_type)} — TEST RECORD</div><h1>${esc(t.ref || '')} ${esc(t.title)}</h1><div>${esc(p.code)} · ${esc(p.name)} · ${esc(p.client_name || '')}</div></div><img src="${location.origin}/img/logo-blue.png" height="42"></div>
  <table><tr><th>Procedure / ITP</th><td>${esc(t.procedure || '')}</td></tr><tr><th>Location</th><td>${esc(t.location || '')}</td></tr><tr><th>Planned / executed</th><td>${fdate(t.planned_date)} / ${t.executed_date ? fdate(t.executed_date) : '______________'}</td></tr>
  <tr><th>Acceptance criteria</th><td style="height:110px">${esc(t.criteria || '').replace(/\n/g, '<br>')}</td></tr><tr><th>Result</th><td>${['Pass', 'Pass with comments', 'Fail', 'Retest required'].map(r => `${r === t.result ? '☒' : '☐'} ${r}`).join('&nbsp;&nbsp;&nbsp;')}</td></tr>
  <tr><th>Evidence / report</th><td>${esc(t.evidence || '')}</td></tr><tr><th>Notes</th><td style="height:70px">${esc(t.notes || '').replace(/\n/g, '<br>')}</td></tr></table>
  <h3>Punch list</h3><table><tr><th style="width:auto">Ref</th><th style="width:auto">Description</th><th style="width:auto">Cat.</th><th style="width:auto">Owner</th><th style="width:auto">Status</th></tr>${pi.map(x => `<tr><td>${esc(x.ref || '')}</td><td>${esc(x.description)}</td><td>${esc(String(x.category || '').slice(0, 1))}</td><td>${esc(x.owner || '')}</td><td>${esc(x.status || '')}</td></tr>`).join('') || '<tr><td colspan="5" style="height:60px"></td></tr>'}</table>
  <h3>Sign-off</h3><table><tr><th>CGI</th><td style="height:56px">Name / signature / date</td></tr><tr><th>Witness (${esc(t.witness || 'client')})</th><td style="height:56px">Name / signature / date</td></tr></table><script>setTimeout(()=>print(),300)<\/script></body></html>`); w.document.close();
}
