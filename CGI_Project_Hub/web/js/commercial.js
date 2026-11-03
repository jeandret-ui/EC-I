/* Commercials (client PO, payment milestones, budget, invoices, cash flow) and the costing / quote-register module. */
'use strict';
route('commercials', { title: 'Commercials', icon: 'money', group: 'Commercial', project: true, render: v => {
  const tab = ST.params.tab || 'overview', R = ST.PH.rec, C = commercial();
  v.append(pageHead('Commercial', 'Commercial control', 'Client order and variations against budget, commitments and actual cost. All values ZAR excl. VAT.',
    h('button', { class: 'btn', onclick: () => go('costing') }, icon('calc'), 'Open costing')));
  v.append(tabs([['overview', 'Overview'], ['po', 'Client PO & payments', R.client_pos.length], ['budget', 'Budget', R.cost_codes.length], ['invoices', 'Invoices', R.invoices.length], ['cash', 'Cash flow'], ['changes', 'Change requests', R.variations.length]], tab, k => go('commercials', { tab: k })));
  if (tab === 'overview') {
    v.append(h('div', { class: 'kpis' }, kpi('Contract value', money(C.contract), `PO ${kmoney(C.poValue)} + variations ${kmoney(C.varSell)}`), kpi('Budget', money(C.budget), 'cost codes incl. approved changes'),
      kpi('Committed', money(C.committed), 'supplier POs'), kpi('Actual cost', money(C.actual), 'supplier invoices'), kpi('Forecast cost', money(C.forecast), 'at completion'),
      kpi('Forecast margin', C.hasCost ? money(C.margin) : '—', C.hasCost && C.contract ? pct(C.marginPct, 1) + ' of contract' : 'enter budgets / POs', C.hasCost && C.margin < 0 ? 'bad' : C.hasCost ? 'good' : ''),
      kpi('Invoiced to client', money(C.billed), C.contract ? pct(100 * C.billed / C.contract) + ' of contract' : ''), kpi('Received', money(C.received))));
    const mx = Math.max(1, ...C.codes.map(x => Math.max(x.budget, x.eac)));
    const docs = h('div', {}, h('p', { class: 'note' }, 'Loading costing documents…'));
    API.get(API.P(ST.code, '/costings')).then(list => { docs.innerHTML = ''; if (!list.length) docs.append(h('p', { class: 'note' }, 'No costing documents for this project yet.'), h('button', { class: 'btn pri sm', onclick: () => go('costing') }, 'Start a costing'));
      for (const d of list) { const tt = d.totals || {}; docs.append(h('div', { class: 'file', style: 'cursor:pointer', onclick: () => go('costing') }, icon('calc'), h('div', { class: 'grow' }, h('b', {}, `${d.quote_no || ''} · Rev ${d.revision || '00'}`), h('div', { class: 'tiny muted' }, `${d.name || ''} · ${d.document_type || ''} · saved ${String(d.updated || '').slice(0, 10)}`)),
        tt.sell != null ? h('div', { class: 'num' }, h('b', {}, money(tt.sell)), h('div', { class: 'tiny muted' }, `cost ${money(tt.cost)} · GP ${tt.sell ? pct(100 * (tt.sell - tt.cost) / tt.sell, 1) : '—'}`)) : null)); } }).catch(e => { docs.innerHTML = ''; docs.append(h('p', { class: 'note' }, e.message)); });
    v.append(h('div', { class: 'grid g2' },
      h('div', { class: 'card' }, h('h3', {}, 'Budget vs forecast by cost code'), C.codes.length ? C.codes.map(x => h('div', { style: 'margin:8px 0' }, h('div', { class: 'row small' }, h('b', {}, `${x.code} ${x.name}`), h('span', { class: 'right num' }, `${kmoney(x.eac)} / ${kmoney(x.budget)}`)),
        h('div', { class: 'bar', style: 'height:6px;margin-top:3px' }, h('i', { style: `width:${100 * x.budget / mx}%;background:#b9c4d0` })), h('div', { class: 'bar' + (x.budget && x.eac > x.budget ? ' red' : ''), style: 'height:6px;margin-top:2px' }, h('i', { style: `width:${100 * x.eac / mx}%` }))))
        : h('p', { class: 'note' }, 'No cost codes yet.'), h('div', { class: 'legend' }, h('span', {}, h('i', { style: 'background:#b9c4d0' }), 'budget'), h('span', {}, h('i', { style: 'background:var(--blue)' }), 'forecast at completion'))),
      h('div', { class: 'grid', style: 'align-content:start' }, h('div', { class: 'card' }, h('h3', {}, icon('calc'), 'Costing documents (quotes & revisions)'), docs),
        h('div', { class: 'card' }, h('h3', {}, 'Commercial alerts'), alertList(alerts().filter(a => /quote|cost code|invoice|milestone|purchase order/i.test(a.text)))))));
  } else if (tab === 'po') {
    v.append(registerBlock('client_pos', { title: 'Client purchase orders' }));
    v.append(h('div', { style: 'margin-top:18px' }, registerBlock('po_milestones', { title: 'Payment milestones', extra: m => { const po = byId('client_pos', m.po_id); return m.amount ? money(m.amount) : po && m.pct ? money(po.value_ex_vat * m.pct / 100) : ''; }, extraLabel: 'Value' })));
  } else if (tab === 'budget') {
    const tb = C.codes.map(x => h('tr', { onclick: () => openForm('cost_codes', x.c) }, h('td', {}, x.code), h('td', {}, x.name), ...[x.budget, x.committed, x.actual, x.etc, x.eac].map(n => h('td', { class: 'num' }, money(n))), h('td', { class: 'num', style: x.variance < 0 ? 'color:var(--red);font-weight:600' : '' }, money(x.variance))));
    v.append(h('div', { class: 'tbar' }, h('span', { class: 'note' }, 'Committed = supplier POs on the cost code · Actual = supplier invoices · Forecast = max(committed, actual) + estimate to complete.'), h('button', { class: 'btn pri sm right', onclick: () => openForm('cost_codes', null) }, icon('plus'), 'Cost code')));
    v.append(h('div', { class: 'twrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Code', 'Name', 'Budget', 'Committed', 'Actual', 'To complete', 'Forecast', 'Variance'].map((x, i) => h('th', { class: i > 1 ? 'num' : '' }, x)))), h('tbody', {}, tb),
      h('tfoot', {}, h('tr', {}, h('td', {}, ''), h('td', {}, 'Total'), ...[C.budget, C.committed, C.actual, C.etc, C.forecast, C.budget - C.forecast].map(n => h('td', { class: 'num' }, money(n))))))));
    v.append(h('div', { style: 'margin-top:18px' }, registerBlock('supplier_pos', { title: 'Supplier purchase orders (commitments)' })));
  } else if (tab === 'invoices') v.append(registerBlock('invoices'));
  else if (tab === 'changes') v.append(registerBlock('variations'));
  else {
    const months = {}; const add = (d, k, n) => { if (!d || !n) return; const m = d.slice(0, 7); months[m] = months[m] || { in: 0, out: 0 }; months[m][k] += n; };
    for (const m of R.po_milestones) { const po = byId('client_pos', m.po_id); add(m.paid_date || m.due_date, 'in', +m.amount || (po && m.pct ? po.value_ex_vat * m.pct / 100 : 0)); }
    for (const p of R.supplier_pos.filter(p => p.status !== 'Cancelled')) add(p.payment_due || p.expected_delivery, 'out', +p.value_ex_vat || 0);
    for (const i of R.invoices.filter(i => i.direction === 'Supplier invoice' && !R.supplier_pos.length)) add(i.due_date, 'out', +i.amount_ex_vat || 0);
    const keys = Object.keys(months).sort(); let cum = 0;
    if (!keys.length) { v.append(empty('No cash-flow dates yet', 'Give payment milestones due dates and amounts (or %), and supplier POs payment dates.')); return; }
    const mx = Math.max(...keys.map(k => Math.max(months[k].in, months[k].out)));
    v.append(h('div', { class: 'twrap' }, h('table', { class: 't' }, h('thead', {}, h('tr', {}, ['Month', 'Money in (client)', 'Money out (suppliers)', 'Net', 'Cumulative', ''].map((x, i) => h('th', { class: i && i < 5 ? 'num' : '' }, x)))),
      h('tbody', {}, keys.map(k => { const m = months[k]; cum += m.in - m.out; return h('tr', {}, h('td', {}, `${MON[+k.slice(5) - 1]} ${k.slice(0, 4)}`), h('td', { class: 'num' }, money(m.in)), h('td', { class: 'num' }, money(m.out)), h('td', { class: 'num' }, money(m.in - m.out)), h('td', { class: 'num', style: cum < 0 ? 'color:var(--red)' : '' }, money(cum)),
        h('td', { style: 'width:30%' }, h('div', { class: 'bar green', style: 'height:5px' }, h('i', { style: `width:${100 * m.in / mx}%` })), h('div', { class: 'bar red', style: 'height:5px;margin-top:2px' }, h('i', { style: `width:${100 * m.out / mx}%` })))); })))));
  }
} });

/* ---------------- costing module (embedded) ---------------- */
function costingFrame(v, params) {
  if (!ST.cfg.costing) { v.append(empty('Costing module unavailable', 'It did not start — see the hub window for the error.')); return; }
  v.classList.add('full');
  v.append(h('iframe', { src: `/costing/?${new URLSearchParams({ embed: 1, ...params })}`, title: 'Costing and quote register' }));
}
route('costing', { title: 'Costing & quotes', icon: 'calc', group: 'Commercial', project: true, full: true, render: v => costingFrame(v, { code: ST.code, name: ST.PH.project.name, client: ST.PH.project.client_name || '', view: ST.params.view || 'profile' }) });
route('quotes', { title: 'Quote register', icon: 'reg', group: 'Portfolio', full: true, render: v => costingFrame(v, { view: 'register' }) });
route('forecast', { title: 'Pipeline & forecasts', icon: 'chart', group: 'Portfolio', full: true, render: v => costingFrame(v, { view: 'forecast' }) });
