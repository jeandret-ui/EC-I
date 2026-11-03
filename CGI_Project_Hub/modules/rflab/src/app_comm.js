/* =====================================================================
   COMMERCIALS — client PO, budget, margin, quotes, comparison, cash flow
   ===================================================================== */
function quoteTotals(q) {
  const lines = PH.rec.quote_lines.filter(l => String(l.quote_id) === String(q.id));
  const net = lines.reduce((s, l) => s + (+l.quantity || 0) * (+l.unit_price || 0) * (1 - (+l.discount_pct || 0) / 100), 0);
  const zar = net * (+q.exchange_rate || 1), vat = zar * (q.vat_rate == null ? 15 : +q.vat_rate) / 100;
  return { lines, net, zar, vat, incl: zar + vat };
}
function rfFit(key) {
  if (!key || !RF.RADIOS[key]) return null;
  const nets = allNets(), cands = Object.entries(S.archs).filter(([, a]) => a.hops.some(hp => hp.radio === key)).map(([k]) => ({ k, N: nets[k] }));
  if (!cands.length) return { text: 'Not modelled in the RF lab', ok: null };
  const best = cands.sort((a, b) => b.N.e2e - a.N.e2e)[0], uhf = RF.RADIOS[key].band[1] < 1000, req = S.g.reqThroughput;
  return { arch: best.k, N: best.N, radios: best.N.radios, ok: !uhf && best.N.meets, text: uhf ? 'Excluded: WUC requires no UHF' : `${fMb(best.N.e2e)} end to end (${S.archs[best.k].name})${best.N.meets ? '' : `: short of ${req} Mbps`}` };
}
function commercial() {
  const R = PH.rec, t = isoToday();
  const poValue = R.client_pos.reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
  const varApproved = R.variations.filter(v => v.status === 'Approved'), varSell = varApproved.reduce((s, v) => s + (+v.sell_value || 0), 0);
  const contract = poValue + varSell;
  const codes = R.cost_codes.map(c => {
    const budget = (+c.budget || 0) + (+c.approved_changes || 0);
    const committed = R.supplier_pos.filter(p => p.cost_code === c.code && p.status !== 'Cancelled').reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
    const actual = R.invoices.filter(i => i.direction === 'Supplier invoice' && i.cost_code === c.code).reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
    const etc = +c.etc || 0, eac = Math.max(committed, actual) + etc;
    return { c, code: c.code, name: c.name, budget, committed, actual, etc, eac, variance: budget - eac };
  });
  const uncoded = R.supplier_pos.filter(p => p.status !== 'Cancelled' && !R.cost_codes.some(c => c.code === p.cost_code)).reduce((s, p) => s + (+p.value_ex_vat || 0), 0);
  const sum = k => codes.reduce((s, x) => s + x[k], 0);
  const forecast = sum('eac') + uncoded, margin = contract - forecast;
  const billed = R.invoices.filter(i => i.direction === 'Client invoice').reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
  const received = R.invoices.filter(i => i.direction === 'Client invoice' && i.status === 'Paid').reduce((s, i) => s + (+i.amount_ex_vat || 0), 0);
  const quotes = R.supplier_quotes.map(r => { const T = quoteTotals(r); return { r, ...T, daysLeft: r.validity_date ? daysBetween(t, r.validity_date) : null, fit: rfFit(r.equipment_key), supplier: byId('suppliers', r.supplier_id) }; });
  return { poValue, varSell, contract, codes, uncoded, budget: sum('budget'), committed: sum('committed') + uncoded, actual: sum('actual'), etc: sum('etc'), forecast, margin,
    marginPct: contract ? 100 * margin / contract : 0, billed, received, quotes, overrun: codes.filter(x => x.budget > 0 && x.eac > x.budget) };
}

/* ---------------- overview ---------------- */
regTab('commercial', () => {}, () => {
  const p = pane('commercial'), C = commercial();
  p.append(hubTitle('Commercial control', 'Client order and variations against budget, commitments and actual cost. All values excl. VAT, in rand.'));
  p.append(h('div', { class: 'metricgrid' }, metric('Contract value', money(C.contract), `PO ${money(C.poValue)} + variations ${money(C.varSell)}`), metric('Budget', money(C.budget)),
    metric('Committed', money(C.committed), 'supplier POs'), metric('Actual cost', money(C.actual), 'supplier invoices'), metric('Forecast cost', money(C.forecast), 'at completion'),
    metric('Forecast margin', money(C.margin), C.contract ? `${f1(C.marginPct, 1)} % of contract` : 'add the client PO', C.margin < 0 ? 'mbad' : ''),
    metric('Invoiced to client', money(C.billed), C.contract ? `${f1(100 * C.billed / C.contract, 0)} % of contract` : ''), metric('Received', money(C.received))));
  if (!PH.rec.client_pos.length) p.append(emptyState('Start with your client PO', 'Capture the purchase order from WEC: number, value, retention, payment terms and the payment milestones. Margin and cash flow build on it.',
    h('button', { class: 'btn pri', style: 'margin-top:10px', onclick: () => setTab('clientpo') }, 'Add client PO')));
  const al = alerts().filter(a => /Quote|Cost code|Invoice|milestone/i.test(a.text));
  p.append(h('div', { class: 'g-two' }, h('div', { class: 'card' }, h('h3', {}, 'Commercial alerts'), alertList(al)),
    chartCard('Budget against forecast, by cost code', null, { aspect: 1.5 }, (c, g, th) => {
      const xs = C.codes.filter(x => x.budget || x.eac); if (!xs.length) { c.frame({ x: [0, 1], y: [0, 1], xticks: [], yticks: [] }); c.text('Enter budgets under Budget', c.w / 2, c.h / 2, { align: 'center', color: th.ink3 }); return; }
      const mx = Math.max(...xs.map(x => Math.max(x.budget, x.eac))) * 1.1;
      c.frame({ x: [0, mx], y: [-0.5, xs.length - 0.5], yticks: [], xfmt: v => 'R' + (v / 1000).toFixed(0) + 'k', m: { l: 150 } });
      xs.forEach((x, i) => { const y = c.Y(xs.length - 1 - i), bh = (c.py0 - c.py1) / xs.length * 0.32;
        c.text(`${x.code} ${x.name}`.slice(0, 24), c.px0 - 6, y, { align: 'right', size: 11 });
        g.fillStyle = Plot.alpha(th.ink3, .45); g.fillRect(c.X(0), y - bh - 1, c.X(x.budget) - c.X(0), bh);
        g.fillStyle = x.eac > x.budget && x.budget ? th.red : th.sig; g.fillRect(c.X(0), y + 1, c.X(x.eac) - c.X(0), bh); });
      c.legend([{ label: 'Budget', color: Plot.alpha(th.ink3, .45), fill: true }, { label: 'Forecast at completion', color: th.sig, fill: true }], c.px0 + 8, c.py0 - 12); })));
});

/* ---------------- quotes ---------------- */
regTab('quotes', () => {}, () => {
  const p = pane('quotes'), C = commercial();
  p.append(hubTitle('Supplier quotes', 'Each quote with what it offers, its lines and totals. Prices are converted to rand at the quote’s exchange rate.',
    h('button', { class: 'btn sm', onclick: () => setTab('quotecompare') }, 'Compare quotes'), h('button', { class: 'btn pri sm', onclick: () => openForm('supplier_quotes', null, { quote_date: isoToday(), currency: 'ZAR', exchange_rate: 1, vat_rate: 15, status: 'Received' }) }, 'Add quote')));
  if (!C.quotes.length) { p.append(emptyState('No supplier quotes yet', 'Add a quote, then its lines.')); return; }
  for (const q of C.quotes) { const r = q.r;
    const lines = h('table', { class: 't hubtable click' }, h('tr', {}, ...['Code', 'Description', 'Qty', `Unit (${r.currency || 'ZAR'})`, 'Disc.', 'Net', 'Cost code'].map(x => h('th', {}, x))),
      ...q.lines.map(l => h('tr', { onclick: () => openForm('quote_lines', l) }, h('td', {}, l.part_number || ''), h('td', { class: 'wrap' }, l.description), h('td', { class: 'num' }, String(l.quantity ?? '')),
        h('td', { class: 'num' }, money(l.unit_price, 2).replace('R\u00a0', '')), h('td', { class: 'num' }, l.discount_pct ? l.discount_pct + ' %' : ''), h('td', { class: 'num' }, money((+l.quantity || 0) * (+l.unit_price || 0) * (1 - (+l.discount_pct || 0) / 100), 2).replace('R\u00a0', '')), h('td', {}, l.cost_code || ''))),
      h('tr', { class: 'sel' }, h('td', {}, ''), h('td', {}, 'Total excl. VAT (ZAR)'), h('td', {}), h('td', {}), h('td', {}), h('td', { class: 'num' }, money(q.zar, 2)), h('td', {})));
    const exp = q.daysLeft == null ? '' : q.daysLeft < 0 ? `expired ${-q.daysLeft} days ago` : `${q.daysLeft} days left`;
    p.append(h('div', { class: 'card' }, h('div', { class: 'toolbar' }, h('div', { style: 'margin-right:auto' }, h('h3', { style: 'margin:0' }, `${q.supplier?.name || 'Supplier'} · ${r.quote_ref}`), h('div', { class: 'note' }, r.option || '')),
      stChip(r.status), h('button', { class: 'btn sm', onclick: () => openForm('supplier_quotes', r) }, 'Edit quote'), h('button', { class: 'btn sm', onclick: () => openForm('quote_lines', null, { quote_id: r.id, quantity: 1 }) }, 'Add line')),
      h('dl', { class: 'kv two' }, h('dt', {}, 'Offers'), h('dd', {}, r.scope || '—'), h('dt', {}, 'Excludes'), h('dd', {}, r.exclusions || '—'), h('dt', {}, 'Valid until'), h('dd', { class: q.daysLeft != null && q.daysLeft < 0 ? 'neg' : q.daysLeft <= 7 ? 'mid' : '' }, `${dateTxt(r.validity_date)} ${exp ? '(' + exp + ')' : ''}`),
        h('dt', {}, 'Lead time / payment'), h('dd', {}, `${r.lead_time || '—'} · ${r.payment_terms || '—'}`), h('dt', {}, 'Exchange rate'), h('dd', {}, r.fx_basis || (r.currency === 'ZAR' ? 'Rand pricing' : `1 ${r.currency} = R${r.exchange_rate}`)),
        h('dt', {}, 'RF fit'), h('dd', { class: q.fit ? (q.fit.ok ? 'pos' : q.fit.ok === false ? 'neg' : '') : '' }, q.fit ? q.fit.text : 'Link an RF system to check')), h('div', { class: 'tw' }, lines)));
  }
});
regTab('quotecompare', () => {}, () => {
  const p = pane('quotecompare'), C = commercial(), req = S.g.reqThroughput;
  p.append(hubTitle('Quote comparison', 'Price, validity, terms and technical fit side by side. Technical fit comes from the RF lab: the radio each quote offers is run through the real terrain and the requirements.'));
  if (!C.quotes.length) { p.append(emptyState('No quotes to compare', 'Add supplier quotes first.')); return; }
  const Q = C.quotes, proj = q => q.fit && q.fit.radios ? q.zar * q.fit.radios : null;
  const okQ = Q.filter(q => q.fit && q.fit.ok && !['Rejected', 'Expired'].includes(q.r.status)), cheapest = okQ.length ? okQ.reduce((m, q) => proj(q) < proj(m) ? q : m) : null;
  const rows = [
    ['Supplier', q => q.supplier?.name || '—'], ['Quote', q => `${q.r.quote_ref}${q.r.option ? ' · ' + q.r.option.split(':')[0] : ''}`], ['Offers', q => q.r.option?.split(':').slice(1).join(':').trim() || q.r.scope || '—'],
    ['Status', q => stChip(q.r.status)], ['Price per quote, excl. VAT', q => money(q.zar, 2)], ['Incl. VAT', q => money(q.incl, 2)],
    ['Radio ends needed', q => q.fit && q.fit.radios ? String(q.fit.radios) : '—'], ['Project equipment cost', q => proj(q) != null ? h('b', {}, money(proj(q))) : '—'],
    [`Technical fit (needs ${req} Mbps, no UHF)`, q => q.fit ? h('span', { class: 'chip ' + (q.fit.ok ? 'pass' : q.fit.ok === false ? 'fail' : 'warn') }, q.fit.text) : '—'],
    ['Valid until', q => h('span', { class: q.daysLeft != null && q.daysLeft < 0 ? 'neg' : q.daysLeft <= 7 ? 'mid' : '' }, `${dateTxt(q.r.validity_date)}${q.daysLeft != null ? ` (${q.daysLeft < 0 ? 'expired' : q.daysLeft + ' days'})` : ''}`)],
    ['Lead time', q => q.r.lead_time || '—'], ['Payment terms', q => q.r.payment_terms || '—'], ['Delivery', q => q.r.delivery_terms || '—'], ['Exchange-rate exposure', q => q.r.fx_basis || (q.r.currency === 'ZAR' ? 'None stated' : q.r.currency)], ['Excludes', q => q.r.exclusions || '—']];
  const T = h('table', { class: 't cmp' }, h('tr', {}, h('th', {}, ''), ...Q.map(q => h('th', { class: q === cheapest ? 'best' : '' }, q === cheapest ? 'Best compliant price' : ''))));
  for (const [lab, fn] of rows) T.append(h('tr', {}, h('td', {}, lab), ...Q.map(q => { const v = fn(q); return h('td', { class: (q === cheapest ? 'best ' : '') + 'wrap' }, v); })));
  p.append(h('div', { class: 'card' }, h('div', { class: 'tw' }, T)));
  p.append(h('p', { class: 'note' }, cheapest ? `${cheapest.supplier?.name} ${cheapest.r.quote_ref} is the lowest-cost quote that meets the requirement.` : 'No quote currently meets the technical requirement. Request quotes for a system the RF lab shows reaching the requirement (for example the dual point-to-point or licensed designs).'));
});

/* ---------------- client PO ---------------- */
regTab('clientpo', () => {}, () => {
  const p = pane('clientpo'), C = commercial(), R = PH.rec;
  p.append(hubTitle('Client purchase order', 'Your order from the client, its payment milestones and approved variations. Attach the signed PO to the record.',
    h('button', { class: 'btn pri sm', onclick: () => openForm('client_pos', null, { po_date: isoToday(), currency: 'ZAR', vat_rate: 15, status: 'Received' }) }, 'Add client PO')));
  if (!R.client_pos.length) { p.append(emptyState('No client PO captured', 'Add the PO number, value excl. VAT, retention and payment terms. Then add payment milestones so cash flow can be forecast.')); return; }
  for (const po of R.client_pos) {
    const ms = R.po_milestones.filter(m => String(m.po_id) === String(po.id)), amt = m => m.amount != null ? +m.amount : (+m.pct || 0) / 100 * (+po.value_ex_vat || 0);
    const pctSum = ms.reduce((s, m) => s + (m.amount != null ? 100 * m.amount / (po.value_ex_vat || 1) : +m.pct || 0), 0);
    const files = PH.files.filter(f => f.entity === 'client_pos' && String(f.entity_id) === String(po.id));
    p.append(h('div', { class: 'card' }, h('div', { class: 'toolbar' }, h('h3', { style: 'margin:0;margin-right:auto' }, `PO ${po.po_number} · ${titleOf('clients', byId('clients', po.client_id))}`), stChip(po.status),
      h('button', { class: 'btn sm', onclick: () => openForm('client_pos', po) }, 'Edit PO / attach'), h('button', { class: 'btn sm', onclick: () => openForm('po_milestones', null, { po_id: po.id, status: 'Planned' }) }, 'Add milestone')),
      h('div', { class: 'metricgrid' }, metric('PO value excl. VAT', money(po.value_ex_vat, 2)), metric('Incl. VAT', money((+po.value_ex_vat || 0) * (1 + (po.vat_rate ?? 15) / 100), 2)),
        metric('Retention', po.retention_pct ? `${po.retention_pct} %` : '—', po.retention_pct ? money((+po.value_ex_vat || 0) * po.retention_pct / 100) : ''), metric('Milestones', `${f1(pctSum, 0)} %`, pctSum && Math.abs(pctSum - 100) > 0.5 ? 'do not add up to 100 %' : 'of PO value', pctSum && Math.abs(pctSum - 100) > 0.5 ? 'mbad' : '')),
      h('dl', { class: 'kv two' }, h('dt', {}, 'PO date'), h('dd', {}, dateTxt(po.po_date)), h('dt', {}, 'Our quote'), h('dd', {}, po.our_quote_ref || '—'), h('dt', {}, 'Payment terms'), h('dd', {}, po.payment_terms || '—'), h('dt', {}, 'Scope'), h('dd', {}, po.scope || '—'),
        h('dt', {}, 'Documents'), h('dd', {}, files.length ? h('span', {}, ...files.map(f => h('a', { href: API.fileUrl(f), target: '_blank', style: 'margin-right:10px' }, f.filename))) : 'none attached')),
      ms.length ? h('div', { class: 'tw' }, h('table', { class: 't hubtable click' }, h('tr', {}, ...['Milestone', '%', 'Amount', 'Expected', 'Invoiced', 'Paid', 'Status'].map(x => h('th', {}, x))),
        ...ms.map(m => h('tr', { class: overdue('po_milestones', m) ? 'overdue' : '', onclick: () => openForm('po_milestones', m) }, h('td', {}, m.title), h('td', { class: 'num' }, m.pct != null ? m.pct + ' %' : ''), h('td', { class: 'num' }, money(amt(m), 2)),
          h('td', {}, dateTxt(m.due_date)), h('td', {}, dateTxt(m.invoiced_date)), h('td', {}, dateTxt(m.paid_date)), h('td', {}, stChip(m.status)))))) : h('p', { class: 'note' }, 'No payment milestones yet.')));
  }
  p.append(h('div', { class: 'card' }, h('h3', {}, 'Contract value'), h('dl', { class: 'kv' }, h('dt', {}, 'Client POs'), h('dd', {}, money(C.poValue, 2)), h('dt', {}, 'Approved variations'), h('dd', {}, money(C.varSell, 2)), h('dt', {}, 'Contract value'), h('dd', {}, h('b', {}, money(C.contract, 2))))));
});

/* ---------------- budget ---------------- */
regTab('budgetcom', () => {}, () => {
  const p = pane('budgetcom'), C = commercial();
  p.append(hubTitle('Budget', 'Budget per cost code against what is committed (supplier POs), spent (supplier invoices) and still to come (estimate to complete).',
    h('button', { class: 'btn pri sm', onclick: () => openForm('cost_codes') }, 'Add cost code')));
  const T = h('table', { class: 't hubtable click' }, h('tr', {}, ...['Code', 'Cost code', 'Budget', 'Committed', 'Actual', 'To complete', 'Forecast at completion', 'Variance'].map(x => h('th', {}, x))));
  for (const x of C.codes) T.append(h('tr', { onclick: () => openForm('cost_codes', x.c) }, h('td', {}, x.code), h('td', {}, x.name), ...[x.budget, x.committed, x.actual, x.etc, x.eac].map(v => h('td', { class: 'num' }, money(v))), h('td', { class: 'num ' + (x.variance < 0 ? 'neg' : '') }, money(x.variance))));
  if (C.uncoded) T.append(h('tr', {}, h('td', {}, '—'), h('td', {}, 'POs without a cost code'), h('td', {}), h('td', { class: 'num' }, money(C.uncoded)), h('td', {}), h('td', {}), h('td', { class: 'num' }, money(C.uncoded)), h('td', {})));
  T.append(h('tr', { class: 'sel' }, h('td', {}, ''), h('td', {}, 'Total'), ...[C.budget, C.committed, C.actual, C.etc, C.forecast].map(v => h('td', { class: 'num' }, money(v))), h('td', { class: 'num ' + (C.budget - C.forecast < 0 ? 'neg' : '') }, money(C.budget - C.forecast))));
  p.append(h('div', { class: 'card' }, h('div', { class: 'tw' }, T), h('p', { class: 'note' }, 'Forecast at completion = the larger of committed and actual, plus estimate to complete. Click a row to enter budgets.')));
  p.append(h('div', { class: 'metricgrid' }, metric('Contract value', money(C.contract)), metric('Forecast cost', money(C.forecast)), metric('Forecast margin', money(C.margin), C.contract ? `${f1(C.marginPct, 1)} %` : '', C.margin < 0 ? 'mbad' : ''), metric('Budgeted margin', money(C.contract - C.budget))));
});

/* ---------------- cash flow ---------------- */
function cashflow() {
  const R = PH.rec, ev = [], ym = d => String(d).slice(0, 7);
  for (const m of R.po_milestones) { const po = byId('client_pos', m.po_id); const a = m.amount != null ? +m.amount : (+m.pct || 0) / 100 * (+po?.value_ex_vat || 0); const d = m.paid_date || m.invoiced_date || m.due_date; if (d && a) ev.push({ d, v: a, dir: 'in', what: m.title }); }
  const invoicedPOs = new Set(R.invoices.filter(i => i.direction === 'Supplier invoice').map(i => i.po_ref));
  for (const i of R.invoices.filter(i => i.direction === 'Supplier invoice')) { const d = i.due_date || i.invoice_date; if (d) ev.push({ d, v: -(+i.amount_ex_vat || 0), dir: 'out', what: i.number }); }
  for (const po of R.supplier_pos.filter(p => p.status !== 'Cancelled' && !invoicedPOs.has(p.po_number))) { const d = po.payment_due || po.expected_delivery || po.po_date; if (d) ev.push({ d, v: -(+po.value_ex_vat || 0), dir: 'out', what: po.po_number }); }
  const months = [...new Set(ev.map(e => ym(e.d)))].sort(); let cum = 0;
  return months.map(m => { const i = ev.filter(e => ym(e.d) === m && e.dir === 'in').reduce((s, e) => s + e.v, 0), o = ev.filter(e => ym(e.d) === m && e.dir === 'out').reduce((s, e) => s + e.v, 0); cum += i + o; return { m, i, o, cum }; });
}
regTab('cashflow', () => {}, () => {
  const p = pane('cashflow'), F = cashflow();
  p.append(hubTitle('Cash flow', 'Money in from client payment milestones against money out to suppliers (invoices, or PO payment dates where not yet invoiced), by month, excl. VAT.'));
  if (!F.length) { p.append(emptyState('Nothing to forecast yet', 'Add client PO payment milestones with expected dates, and supplier POs with payment due dates.')); return; }
  const low = Math.min(...F.map(x => x.cum)); p.append(h('div', { class: 'metricgrid' }, metric('Peak funding needed', money(Math.max(0, -low)), low < 0 ? 'cash you must carry before payments arrive' : 'none', low < 0 ? 'mbad' : ''), metric('Net position at end', money(F[F.length - 1].cum))));
  p.append(chartCard('Monthly cash flow', null, { aspect: 2.6 }, (c, g, th) => {
    const mx = Math.max(...F.map(x => Math.max(x.i, x.cum, 0))) * 1.15 || 1, mn = Math.min(...F.map(x => Math.min(x.o, x.cum, 0))) * 1.15;
    c.frame({ x: [-0.5, F.length - 0.5], y: [mn, mx], xticks: F.map((_, i) => i), xfmt: i => F[i] ? D0(F[i].m + '-01').toLocaleDateString('en-ZA', { month: 'short', year: '2-digit' }) : '', yfmt: v => 'R' + (v / 1000).toFixed(0) + 'k' });
    const bw = (c.px1 - c.px0) / F.length * 0.35; c.hline(0, { color: th.ink3, dash: [] });
    F.forEach((x, i) => { g.fillStyle = th.green; g.fillRect(c.X(i) - bw, c.Y(x.i), bw, c.Y(0) - c.Y(x.i)); g.fillStyle = th.red; g.fillRect(c.X(i), c.Y(0), bw, c.Y(x.o) - c.Y(0)); });
    c.line(F.map((_, i) => i), F.map(x => x.cum), { color: th.ink, width: 2.2 });
    c.legend([{ label: 'In', color: th.green, fill: true }, { label: 'Out', color: th.red, fill: true }, { label: 'Cumulative', color: th.ink, width: 2.2 }]); }));
  p.append(h('div', { class: 'card' }, h('div', { class: 'tw' }, h('table', { class: 't' }, h('tr', {}, ...['Month', 'In', 'Out', 'Net', 'Cumulative'].map(x => h('th', {}, x))),
    ...F.map(x => h('tr', {}, h('td', {}, x.m), h('td', { class: 'num' }, money(x.i)), h('td', { class: 'num' }, money(-x.o)), h('td', { class: 'num' }, money(x.i + x.o)), h('td', { class: 'num ' + (x.cum < 0 ? 'neg' : '') }, money(x.cum))))))));
});
registerPage('supplierpo', 'supplier_pos', 'Supplier purchase orders', 'What you have committed with suppliers. Committed cost feeds the budget by cost code.');
registerPage('invoices', 'invoices', 'Invoices', 'Supplier invoices are your actual cost; client invoices track billing against the PO.');
registerPage('variations', 'variations', 'Variations', 'Scope changes with cost, sell value and schedule impact. Approved variations add to the contract value.');
registerPage('clients', 'clients', 'Clients', 'Company details, contacts and payment terms.');
registerPage('suppliers', 'suppliers', 'Suppliers', 'Company details, contacts, what they supply and payment terms.');
