/* =====================================================================
   NAVIGATION — sections, sub-tabs, drawer
   ===================================================================== */
const SECTIONS = [
  { k: 'home', label: 'Home', tabs: ['home'] },
  { k: 'project', label: 'Project', tabs: ['project', 'schedule', 'lookahead', 'actions', 'risks', 'issues', 'decisions', 'meetings', 'daily'] },
  { k: 'technical', label: 'Technical', tabs: ['tech', 'req', 'reqreg', 'deliverables', 'rfis', 'docs', 'deviations'] },
  { k: 'site', label: 'Site', tabs: ['site', 'map', 'net', 'reg', 'topo', 'prof', 'budget', 'fade', 'sim', 'ant', 'tower', 'spec', 'cmp', 'kit', 'val'], drawer: true, hops: true, sum: true },
  { k: 'commercial', label: 'Commercials', tabs: ['commercial', 'clientpo', 'budgetcom', 'quotes', 'quotecompare', 'supplierpo', 'invoices', 'variations', 'cashflow', 'clients', 'suppliers'] },
  { k: 'tracker', label: 'Tracker', tabs: ['ai', 'aisummaries', 'aiask', 'activity', 'settings'] },
];
const TAB_LABEL = Object.fromEntries(TABS);
const secOf = t => SECTIONS.find(s => s.tabs.includes(t)) || SECTIONS[0];
function layoutFor(k) {
  const sec = secOf(k); S.lastTab = S.lastTab || {}; S.lastTab[sec.k] = k;
  $$('#nav button').forEach(b => b.setAttribute('aria-current', b.dataset.k === sec.k ? 'page' : 'false'));
  const tabs = $('#tabs'); tabs.innerHTML = '';
  if (sec.tabs.length > 1) for (const t of sec.tabs) tabs.append(h('button', { role: 'tab', 'aria-selected': t === k, onclick: () => setTab(t) }, TAB_LABEL[t]));
  $('#subbar').style.display = sec.tabs.length > 1 || sec.drawer ? '' : 'none';
  $('#drawerBtn').style.display = sec.drawer ? '' : 'none';
  $('#hops').style.display = sec.hops ? '' : 'none';
  $('#techSum').style.display = ['prof','budget','topo','val','fade','sim','ant','tower','spec','cmp'].includes(k) ? '' : 'none';
  const open = sec.drawer && S.ui.drawer; $('#body').classList.toggle('closed', !open); $('#side').classList.toggle('open', open);
  $('#drawerBtn').setAttribute('aria-pressed', open); $('#drawerBtn').textContent = open ? 'Hide supplier inputs' : 'Supplier inputs';
  if (typeof renderContextHeader === 'function') renderContextHeader(sec.k);
  renderSummary();
}
function goSection(sk) { const sec = SECTIONS.find(s => s.k === sk); setTab((S.lastTab && S.lastTab[sk] && sec.tabs.includes(S.lastTab[sk])) ? S.lastTab[sk] : sec.tabs[0]); }
function syncArchSel() {
  const s = $('#archSel'); if (!s) return;
  const want = Object.keys(S.archs).join(',');
  if (s.dataset.keys !== want) { s.innerHTML = ''; s.dataset.keys = want; for (const [k, a] of Object.entries(S.archs)) s.append(h('option', { value: k }, a.name)); }
  s.value = S.arch;
}

/* =====================================================================
   SUPPLIER PROPOSAL — antennas, radio and heights as entered by a supplier
   ===================================================================== */
const ANT_TYPES = [['omni', 'Omnidirectional'], ['sector', 'Sector'], ['directional', 'Directional (dish/panel)'], ['bidir', 'Bidirectional']];
const bwFromGain = G => Math.sqrt(41253 * 0.55 / Math.pow(10, G / 10));
function supAntenna(cfg) {
  const G = +cfg.gain, a = { gain: G, band: [100, 100000], name: `${ANT_TYPES.find(t => t[0] === cfg.type)[1]}, ${G} dBi` };
  if (cfg.type === 'omni') return { ...a, type: 'omni', bwV: +cfg.bwV || 107.6 * Math.pow(10, -0.1 * G) };
  if (cfg.type === 'sector') return { ...a, type: 'sector', bwH: +cfg.bwH || 90, bwV: +cfg.bwV || 41253 * 0.6 / ((+cfg.bwH || 90) * Math.pow(10, G / 10)) };
  if (cfg.type === 'bidir') return { ...a, type: 'bidir', bwH: +cfg.bwH || 30, bwV: +cfg.bwV || Math.max(3, 41253 * 0.3 / ((+cfg.bwH || 30) * Math.pow(10, G / 10))), fb: 25 };
  return { ...a, type: 'dir', bwH: +cfg.bwH || bwFromGain(G), bwV: +cfg.bwV || bwFromGain(G), fb: 30 };
}
function supRadio() {
  const c = S.sup.custom, n = 8, mcs = [];
  for (let i = 0; i < n; i++) { const f = i / (n - 1); mcs.push({ n: `L${i + 1}`, mod: `Level ${i + 1}`, tx: c.txLo + (c.txHi - c.txLo) * f, sens: c.sensLo + (c.sensHi - c.sensLo) * f, phyRef: c.rateLo * Math.pow(c.rateHi / c.rateLo, f) }); }
  const bws = [10, 20, 30, 40, 50, 60, 80, 160].filter(b => b <= c.bwMax); if (!bws.includes(c.bwRef)) bws.push(c.bwRef); bws.sort((a, b) => a - b);
  return { name: `${c.model} (supplier)`, short: 'Supplier', model: c.model, vendor: 'Supplier proposal', family: c.model, duplex: 'TDD', bwRef: c.bwRef, bws, ptmpMaxBw: c.ptmpMax, nss: 1, nf: c.nf,
    minTx: c.txMin, eff: { ptp: c.eff / 100, ptmp: c.eff / 100 * 0.85 }, latency: { ptp: 2.5, ptmp: 4.5 }, powerW: c.powerW, mtbf: 150000, band: [c.fLo, c.fHi], port: c.port,
    supply: [24, 48], supplyNote: 'per supplier', tmax: c.tmax, mounting: 'mast', mcs, phy(m, bw) { return this.mcs[m].phyRef * bw / this.bwRef; },
    dataNote: 'Entered from the supplier datasheet; the intermediate modulation levels are interpolated between the lowest and highest rate.',
    spec: { Frequency: `${c.fLo}–${c.fHi} MHz`, 'TX power': `${c.txLo} dBm (low rate), ${c.txHi} dBm (top rate)`, Sensitivity: `${c.sensLo} dBm @ ${c.rateLo} Mbps, ${c.sensHi} dBm @ ${c.rateHi} Mbps (${c.bwRef} MHz)`, 'Data rate': `up to ${c.rateHi} Mbps PHY at ${c.bwRef} MHz, ${c.eff} % usable`, Ethernet: `${c.port} Mbps`, Supply: `${c.powerW} W`, Temperature: `to ${c.tmax} °C`, Source: 'Supplier inputs' } };
}
function applySupplier() {
  const sp = S.sup; if (!sp) return;
  RF.RADIOS.sup = supRadio();
  for (const id of ['eng', 'sr3', 'wwtp']) RF.ANTENNAS['sup_' + id] = supAntenna(sp.sites[id]);
  const radio = RF.RADIOS[sp.radio] ? sp.radio : 'r5ac', R = RF.RADIOS[radio], ptmp = sp.topology === 'ptmp';
  const bw = R.bws.includes(sp.bw) ? sp.bw : R.bws[Math.min(R.bws.length - 1, 1)];
  const loss = id => +sp.sites[id].loss, tilt = id => +sp.sites[id].tilt || 0;
  const mk = (a, b, fc, mode) => ({ ...mkHop(a, b, 'sup_' + a, 'sup_' + b, fc, bw, radio, mode), lossA: loss(a), lossB: loss(b), tiltA: tilt(a), tiltB: tilt(b) });
  let hops;
  if (ptmp) {
    hops = [mk('sr3', 'eng', sp.fc, 'ptmp'), mk('sr3', 'wwtp', sp.fc, 'ptmp')];
    const t = sp.sites.sr3.type;
    if (t === 'sector' || t === 'bidir') { const c = makeCtx ? null : null; const s3 = siteById('sr3'), e = siteById('eng'), w = siteById('wwtp');
      const be = RF.bearing(s3.lat, s3.lon, e.lat, e.lon), bwp = RF.bearing(s3.lat, s3.lon, w.lat, w.lon);
      const auto = t === 'sector' ? (be + bwp + (Math.abs(be - bwp) > 180 ? 360 : 0)) / 2 % 360 : be;
      const az = sp.sites.sr3.az === '' || sp.sites.sr3.az == null ? auto : +sp.sites.sr3.az; hops.forEach(x => { x.secAzA = az; }); }
  } else hops = [mk('eng', 'sr3', sp.fc, 'ptp'), mk('sr3', 'wwtp', sp.fc2, 'ptp')];
  for (const id of ['eng', 'wwtp']) { const t = sp.sites[id].type; if ((t === 'sector' || t === 'bidir') && sp.sites[id].az !== '' && sp.sites[id].az != null) hops.forEach(x => { if (x.a === id) x.secAzA = +sp.sites[id].az; if (x.b === id) x.secAzB = +sp.sites[id].az; }); }
  S.archs.S = { name: 'Supplier proposal', long: `${R.model || R.name}, ${ptmp ? `SR3 ${ANT_TYPES.find(t => t[0] === sp.sites.sr3.type)[1].toLowerCase()} serving both ends` : 'two point-to-point links at SR3'}; values entered from the supplier.`, topology: ptmp ? 'ptmp' : 'ptp', hops };
}
function supplierGroup(side) {
  const sp = S.sup, c = sp.custom, A = 'S';
  const go = (rebuild = true) => { S.arch = A; if (S.sel !== 'custom') S.sel = 0; if (NET3D) NET3D.static = null; update({ side: rebuild }); };
  const nIn = (obj, k, label, unit, step, o = {}) => { const i = h('input', { type: 'number', value: obj[k] ?? '', step, placeholder: o.ph || '' });
    i.addEventListener('change', () => { obj[k] = i.value === '' ? (o.blank ?? '') : +i.value; o.on && o.on(); go(o.rebuild); }); return h('label', { class: 'f' }, h('span', {}, label, unit ? h('span', { class: 'u' }, ' ' + unit) : null), i); };
  const sIn = (obj, k, label, opts, o = {}) => { const s = h('select', {}, opts.map(([v, t]) => h('option', { value: v, selected: String(obj[k]) === String(v) }, t)));
    s.addEventListener('change', () => { obj[k] = o.num ? +s.value : s.value; o.on && o.on(); go(true); }); return h('label', { class: 'f' }, h('span', {}, label), s); };
  const radios = Object.entries(RF.RADIOS).filter(([k]) => k !== 'elpro415').map(([k, r]) => [k, k === 'sup' ? 'Enter supplier radio specs…' : r.model || r.name]);
  const R = RF.RADIOS[sp.radio] || RF.RADIOS.r5ac;
  const kids = [h('p', { class: 'note' }, S.arch === 'S' ? 'These values drive the "Supplier proposal" design shown everywhere.' : 'Editing any value switches the design to "Supplier proposal".'),
    sIn(sp, 'topology', 'Topology', [['ptmp', 'SR3 serves both ends (as specified)'], ['ptp', 'Two point-to-point links at SR3 (deviation)']]),
    sIn(sp, 'radio', 'Radio', radios, { on: () => { const r = RF.RADIOS[sp.radio]; if (sp.radio === 'sup') applySupplier(); const rr = RF.RADIOS[sp.radio]; if (!rr.bws.includes(sp.bw)) sp.bw = rr.bws.includes(40) ? 40 : rr.bws[0]; if (sp.fc < rr.band[0] || sp.fc > rr.band[1]) { sp.fc = Math.round((rr.band[0] + rr.band[1]) / 2); sp.fc2 = sp.fc; } } })];
  if (sp.radio === 'sup') kids.push(h('div', { class: 'subgrp' }, h('div', { class: 'sub' }, 'Supplier radio datasheet'),
    (() => { const i = h('input', { type: 'text', value: c.model }); i.addEventListener('change', () => { c.model = i.value || 'Supplier radio'; go(); }); return h('label', { class: 'f' }, h('span', {}, 'Model'), i); })(),
    nIn(c, 'fLo', 'Band from', 'MHz', 5), nIn(c, 'fHi', 'Band to', 'MHz', 5), nIn(c, 'bwRef', 'Datasheet channel width', 'MHz', 10), nIn(c, 'bwMax', 'Widest channel', 'MHz', 10), nIn(c, 'ptmpMax', 'Widest channel, multipoint', 'MHz', 10),
    nIn(c, 'rateLo', 'Lowest rate (PHY)', 'Mbps', 1), nIn(c, 'sensLo', 'Sensitivity at lowest rate', 'dBm', 1), nIn(c, 'rateHi', 'Highest rate (PHY)', 'Mbps', 1), nIn(c, 'sensHi', 'Sensitivity at highest rate', 'dBm', 1),
    nIn(c, 'txLo', 'TX power at lowest rate', 'dBm', 1), nIn(c, 'txHi', 'TX power at highest rate', 'dBm', 1), nIn(c, 'txMin', 'Minimum TX power', 'dBm', 1),
    nIn(c, 'eff', 'Usable TCP share of PHY', '%', 1), nIn(c, 'port', 'Ethernet port', 'Mbps', 100), nIn(c, 'nf', 'Noise figure', 'dB', 0.5), nIn(c, 'powerW', 'Power draw', 'W', 1), nIn(c, 'tmax', 'Max. temperature', '°C', 1)));
  kids.push(nIn(sp, 'fc', sp.topology === 'ptp' ? 'Channel, Eng. Office hop' : 'Channel centre', 'MHz', 5));
  if (sp.topology === 'ptp') kids.push(nIn(sp, 'fc2', 'Channel, WWTP hop', 'MHz', 5));
  kids.push(sIn(sp, 'bw', 'Channel width', R.bws.map(b => [b, bwLab(b)]), { num: true }));
  for (const [id, nm] of [['eng', "Engineer's Office"], ['sr3', 'SR3 high site'], ['wwtp', 'WWTW control room']]) {
    const a = sp.sites[id], rs = S.reg.sites[id], t = a.type, dirLike = t !== 'omni';
    const ant = RF.ANTENNAS['sup_' + id] || supAntenna(a);
    kids.push(h('div', { class: 'subgrp' }, h('div', { class: 'sub' }, nm),
      sIn(a, 'type', 'Antenna type', ANT_TYPES, { on: () => { a.bwH = ''; a.bwV = ''; } }), nIn(a, 'gain', 'Antenna gain', 'dBi', 0.5),
      dirLike ? nIn(a, 'bwH', 'Horizontal beamwidth', '°', 0.5, { ph: f1(ant.bwH || 360, 1) }) : null,
      nIn(a, 'bwV', 'Vertical beamwidth', '°', 0.5, { ph: f1(ant.bwV || 0, 1) }),
      (t === 'sector' || t === 'bidir') ? nIn(a, 'az', 'Azimuth (blank = auto)', '°', 1, { ph: 'auto' }) : null,
      t !== 'directional' ? nIn(a, 'tilt', 'Downtilt', '°', 0.5) : null,
      nIn(a, 'loss', 'Cable and connector loss', 'dB', 0.1),
      nIn(rs, 'tower_m', 'Tower height', 'm', 1, { on: () => { if (S.mounts[id] > rs.tower_m) S.mounts[id] = rs.tower_m; } }),
      nIn(S.mounts, id, 'Antenna height', 'm', 1, { on: () => { if (S.mounts[id] > rs.tower_m) S.mounts[id] = rs.tower_m; } }),
      h('p', { class: 'note' }, `TTA minimum antenna height ${TTA_MIN[id]} m. Antennas cannot sit above the tower.`)));
  }
  const d = group('Supplier proposal', openGroups.has('sup'), ...kids); d.dataset.k = 'sup'; side.append(d);
}
function buildSide() {
  const side = $('#side'), keep = new Set($$('details.grp', side).filter(d => d.open).map(d => d.dataset.k));
  if (side.childElementCount) { openGroups.clear(); keep.forEach(k => openGroups.add(k)); }
  side.innerHTML = '';
  side.append(h('div', { class: 'sidehead' }, h('b', {}, 'Inputs'), h('button', { class: 'btn sm', onclick: () => { S.ui.drawer = false; layoutFor(S.tab); save(); } }, 'Close')));
  supplierGroup(side);
  buildSideAdvanced(side);
}

/* =====================================================================
   REQUIREMENT CHECKS
   ===================================================================== */
function reqCheck(key, N) {
  const req = S.g.reqThroughput, links = N.links, P = (st, t) => ({ st, t });
  const sr3Ants = links.flatMap(L => [[L.hop.a, L.antA], [L.hop.b, L.antB]]).filter(([s]) => s === 'sr3').map(x => x[1]);
  const fmReq = Math.min(...links.map(L => Math.min(dirMarginAtReq(L, L.ab), dirMarginAtReq(L, L.ba))));
  switch (key) {
    case 'bandwidth': return N.e2e >= 300 ? P('pass', `${fMb(N.e2e)} end to end at the design margin`) : N.e2e >= 200 ? P('warn', `${fMb(N.e2e)}: meets 200, short of 300`) : P('fail', `${fMb(N.e2e)} end to end at the design margin`);
    case 'noUHF': return links.some(L => L.fc < 1000) ? P('fail', 'UHF radio') : P('pass', `${links[0].radio.model || links[0].radio.name}`);
    case 'broadband': return N.e2e >= 10 ? P('pass', 'Ethernet bridge, broadband') : P('fail', 'too slow for Ethernet SCADA');
    case 'simplicity': return N.radios <= 3 ? P('pass', `${N.radios} radios, no gateways`) : N.radios <= 4 ? P('warn', `${N.radios} radios (extra radio at SR3)`) : P('fail', `${N.radios} radios`);
    case 'margin': return !isFinite(fmReq) ? P('fail', `${req} Mbps not reachable`) : fmReq >= S.g.minFM ? P('pass', `${f1(fmReq, 1)} dB at ${req} Mbps`) : fmReq >= 0 ? P('warn', `${f1(fmReq, 1)} dB at ${req} Mbps, below ${S.g.minFM} dB`) : P('fail', `${f1(fmReq, 1)} dB at ${req} Mbps`);
    case 'sites': { const s = new Set(links.flatMap(L => [L.hop.a, L.hop.b])); return ['wwtp', 'sr3', 'eng'].every(x => s.has(x)) ? P('pass', 'all three connected') : P('fail', 'a site is missing'); }
    case 'viaSR3': return links.every(L => L.hop.a === 'sr3' || L.hop.b === 'sr3') ? P('pass', 'all hops via SR3') : P('fail', 'a hop bypasses SR3');
    case 'noDirect': return links.some(L => samePair(L.hop, 'eng', 'wwtp')) ? P('fail', 'direct link used') : P('pass', 'not used');
    case 'band': return links.every(L => L.fc >= 5400 && L.fc <= 5900) ? P('pass', `${links.map(L => L.fc).join(' / ')} MHz`) : links.every(L => L.fc > 6000) ? P('warn', 'licensed microwave, deviates from 5 GHz concept') : P('fail', `${links[0].fc} MHz`);
    case 'sr3omni': return N.shared && sr3Ants.every(a => a.type === 'omni') ? P('pass', `omni at SR3, ${f1(sr3Ants[0].gain, 0)} dBi`) : P('warn', `${N.shared ? sr3Ants[0].type : 'two dishes'} at SR3: deviation, needs client approval`);
    case 'rockwell': return N.e2e >= 10 && Math.min(...links.map(L => L.radio.port || 1000)) >= 100 ? P('pass', 'Ethernet transparent to EtherNet/IP') : P('fail', 'cannot carry EtherNet/IP SCADA');
    case 'opmod': { const L = links.reduce((w, x) => (x.design.cap.agg < w.design.cap.agg ? x : w)), m = Math.max(0, Math.min(L.design.ab, L.design.ba));
      return N.e2e >= req ? P('pass', `${L.radio.mcs[m].mod} carries ${fMb(L.design.cap.agg)}`) : P('fail', `runs ${L.design.ab >= 0 ? L.radio.mcs[m].mod : 'no modulation'} at the design margin: ${fMb(N.e2e)}`); }
    case 'heights': { const low = ['sr3', 'wwtp', 'eng'].filter(id => CTX.sites[id].mount < TTA_MIN[id]); return low.length ? P('fail', `below minimum at ${low.map(shortName).join(', ')}`) : P('pass', ['sr3', 'wwtp', 'eng'].map(id => `${shortName(id)} ${CTX.sites[id].mount} m`).join(', ')); }
    default: return P('manual', '');
  }
}
const allReqItems = () => REQS.groups.flatMap(g => g.items);
function reqScore(N) { const items = allReqItems().filter(i => i.check !== 'manual'), r = items.map(i => reqCheck(i.check, N)); return { pass: r.filter(x => x.st === 'pass').length, warn: r.filter(x => x.st === 'warn').length, fail: r.filter(x => x.st === 'fail').length, n: items.length }; }

/* =====================================================================
   HOME
   ===================================================================== */
regTab('home', () => {}, renderHome);
function renderHome() {
  const pane = $('#pane-home'); pane.innerHTML = ''; pane.classList.add('homepg');
  const sc = reqScore(NET), sites = REGISTER.sites, up = sites.filter(s => S.reg.sites[s.id]?.status === 'existing').length, open = regActions().length + (REQS && REGISTER.actions ? REGISTER.actions.filter(a => !S.reg.done[a.id]).length : 0);
  const nets = allNets(), best = Object.entries(nets).filter(([, N]) => N.meets && !N.links.some(L => L.fc < 1000)).map(([k]) => S.archs[k].name);
  const A = nets.A;
  pane.append(h('section', { class: 'hero' },
    h('div', {}, h('h1', {}, 'Molepolole telemetry backhaul'), h('p', {}, 'Broadband Ethernet radio link from the Engineering Office to the WWTW control room through the SR3 high site, for the existing Rockwell PLC and SCADA system.'),
      h('div', { class: 'row', style: 'margin-top:14px' }, h('span', { class: 'note' }, 'Design shown:'), h('b', {}, arch().name))),
    h('div', { class: 'heronum' }, h('b', {}, fMb(NET.e2e).split(' ')[0]), h('span', {}, fMb(NET.e2e).split(' ')[1] + ' end to end'), h('span', { class: 'chip ' + (NET.meets ? 'pass' : 'fail') }, NET.meets ? `Meets ${S.g.reqThroughput} Mbps` : `Short of ${S.g.reqThroughput} Mbps`))));
  const card = (sk, title, line, stat, statLab) => h('button', { class: 'scard', onclick: () => goSection(sk) }, h('span', { class: 'st' }, title), h('span', { class: 'ln' }, line), h('span', { class: 'sv' }, h('b', {}, stat), ' ', statLab), h('span', { class: 'go' }, 'Open'));
  pane.append(h('div', { class: 'scards' },
    card('req', 'Requirements', 'What WUC asked for, the RFQ wording, and a live check of the selected design against each requirement.', `${sc.pass} of ${sc.n}`, 'checks met'),
    card('maps', 'Maps', 'The network on a 2D communications map with coverage, or as a 3D terrain model with Fresnel zones.', '2D and 3D', 'views'),
    card('tech', 'Technical', 'Path profiles, link budgets, fading, simulation, antennas, tower heights, spectrum and design comparison.', '10', 'analyses'),
    card('sites', 'Sites & status', 'Every tower and link with its build status and what is still outstanding.', `${up} of ${sites.length}`, 'towers up'),
    card('kit', 'Equipment', 'Supplier systems, quotes and a compatibility matrix against the requirements.', String(Object.keys(S.archs).length), 'designs compared')));
  const sp = h('div', { class: 'card' }, h('h3', {}, 'SR3 antenna: what the documents specify'), h('p', { class: 'cap', style: 'max-width:none' }, REQS.sr3Note),
    h('dl', { class: 'kv' }, h('dt', {}, `${S.archs.A.name}`), h('dd', { class: A.meets ? 'pos' : 'neg' }, `${fMb(A.e2e)} at the design margin`),
      h('dt', {}, `${S.archs.B.name}`), h('dd', { class: nets.B.meets ? 'pos' : 'neg' }, `${fMb(nets.B.e2e)} at the design margin`),
      h('dt', {}, 'Designs that meet the requirement'), h('dd', {}, best.length ? best.join(', ') : 'none yet')));
  const q = h('div', { class: 'card qcard' }, h('h3', {}, 'Open question for WUC'), h('p', { class: 'big' }, REQS.openQuestion), h('p', { class: 'cap', style: 'max-width:none' }, REQS.assumption),
    h('dl', { class: 'kv', style: 'margin-top:8px' }, h('dt', {}, 'Open actions and decisions'), h('dd', {}, String(open)), h('dt', {}, 'Requirement checks failing'), h('dd', { class: sc.fail ? 'neg' : 'pos' }, String(sc.fail))));
  pane.append(h('div', { class: 'g-two', style: 'display:grid;gap:14px' }, sp, q));
}

/* =====================================================================
   REQUIREMENTS
   ===================================================================== */
regTab('req', () => {}, renderReq);
const chipFor = r => r.st === 'manual' ? null : h('span', { class: 'chip ' + (r.st === 'pass' ? 'pass' : r.st === 'warn' ? 'warn' : 'fail') }, r.st === 'pass' ? 'Met' : r.st === 'warn' ? 'Condition' : 'Not met');
function renderReq() {
  const pane = $('#pane-req'); pane.innerHTML = ''; pane.classList.add('reqpg');
  S.reqDone = S.reqDone || {};
  const sc = reqScore(NET);
  const copy = h('button', { class: 'btn sm', onclick: e => { try { navigator.clipboard.writeText(REQS.headline); e.target.textContent = 'Copied'; } catch (x) { e.target.textContent = 'Select the text to copy'; } } }, 'Copy RFQ wording');
  pane.append(h('div', { class: 'card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', {}, 'RFQ headline'), copy), h('p', { class: 'rfq' }, REQS.headline)));
  pane.append(h('div', { class: 'card qcard' }, h('h3', {}, 'To clarify with WUC'), h('p', { class: 'big' }, REQS.openQuestion), h('p', { class: 'cap', style: 'max-width:none' }, h('b', {}, 'Working assumption: '), REQS.assumption)));
  const designPick = h('select', { class: 'tsel' }, Object.entries(S.archs).map(([k, a]) => h('option', { value: k, selected: k === S.arch }, a.name)));
  designPick.addEventListener('change', () => { S.arch = designPick.value; S.sel = 0; NET3D && (NET3D.static = null); update(); });
  pane.append(h('div', { class: 'card' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', {}, 'Live check of a design'), h('label', { class: 'row' }, h('span', { class: 'note' }, 'Design'), designPick)),
    h('p', { class: 'cap', style: 'max-width:none' }, `${sc.pass} met, ${sc.warn} with a condition, ${sc.fail} not met, out of ${sc.n} checkable requirements. Items marked "Confirm" need a person to sign them off.`)));
  for (const gp of REQS.groups) {
    const T = h('table', { class: 't rt' }, h('tr', {}, h('th', {}, 'Area'), h('th', {}, 'Requirement'), h('th', {}, 'Source'), h('th', {}, 'Selected design')));
    for (const it of gp.items) { const r = reqCheck(it.check, NET);
      let st; if (r.st === 'manual') { const cb = h('input', { type: 'checkbox', checked: !!S.reqDone[it.id], 'aria-label': 'Confirmed: ' + it.area }); cb.addEventListener('change', () => { S.reqDone[it.id] = cb.checked; save(); renderReq(); }); st = h('label', { class: 'tog' }, cb, S.reqDone[it.id] ? 'Confirmed' : 'Confirm'); }
      else st = h('div', { class: 'rst' }, chipFor(r), h('span', { class: 'note' }, r.t));
      T.append(h('tr', {}, h('td', {}, h('b', {}, it.area)), h('td', {}, it.text), h('td', { class: 'note' }, it.source), h('td', {}, st))); }
    pane.append(h('div', { class: 'card' }, h('h3', {}, gp.title), h('div', { class: 'tw' }, T)));
  }
  // sites, coordinates, heights
  const ST = h('table', { class: 't' }, h('tr', {}, ...['Site', 'Latitude', 'Longitude', 'TTA Table 1', 'Offset', 'Ground (DEM / TTA)', 'Tower', 'Antenna', 'TTA min. antenna', 'Status'].map(t => h('th', {}, t))));
  for (const s of REGISTER.sites) { const c = CTX.sites[s.id], t = s.tta, off = Math.hypot((c.lat - t.lat) * 110574, (c.lon - t.lon) * 111320 * Math.cos(t.lat * Math.PI / 180)), rs = S.reg.sites[s.id];
    ST.append(h('tr', {}, h('td', {}, h('b', {}, s.name)), h('td', {}, c.lat.toFixed(5)), h('td', {}, c.lon.toFixed(5)), h('td', {}, `${t.lat}, ${t.lon}`), h('td', { class: off < 5 ? 'pos' : 'neg' }, f1(off, 1) + ' m'),
      h('td', {}, `${f1(c.ground, 0)} / ${f1(t.elevation, 0)} m`), h('td', {}, (rs.tower_m ?? '—') + ' m'), h('td', { class: c.mount < t.antenna_min ? 'neg' : '' }, c.mount + ' m'), h('td', {}, t.antenna_min + ' m'), h('td', {}, SITE_ST[rs.status][0]))); }
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'Sites, coordinates and heights'), h('p', { class: 'cap', style: 'max-width:none' }, 'Coordinates are checked against TTA Table 1. Antenna heights feed every calculation, map and 3D view; they are clamped to the tower height. Edit them in Sites & status or the supplier inputs.'), h('div', { class: 'tw' }, ST)));
  // functionality, physical, philosophy
  const ul = a => h('ul', { class: 'plain' }, ...a.map(x => h('li', {}, x)));
  const flow = h('div', { class: 'flow' }, ...REQS.philosophy.flow.flatMap((x, i) => i ? [h('span', { class: 'ar' }, '→'), h('span', { class: 'fb' }, x)] : [h('span', { class: 'fb' }, x)]));
  pane.append(h('div', { class: 'g-two', style: 'display:grid;gap:14px' },
    h('div', { class: 'card' }, h('h3', {}, 'Process functionality the network carries'), h('p', { class: 'cap' }, REQS.process.note), ul(REQS.process.items)),
    h('div', { class: 'card' }, h('h3', {}, 'Outdoor panels'), ul(REQS.physical), h('p', { class: 'cap', style: 'margin-top:8px' }, 'The enclosure temperature model in Technical › Compare designs uses the canopy as a sun shield.'))));
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'Maintenance philosophy'), h('p', { class: 'cap', style: 'max-width:none' }, REQS.philosophy.note), flow, h('h3', { style: 'margin-top:12px;font-size:15px' }, 'Avoid'), ul(REQS.philosophy.avoid)));
  const D = h('ul', { class: 'acts' }, ...REQS.deliverables.map((d, i) => { const id = 'del' + i, cb = h('input', { type: 'checkbox', checked: !!S.reqDone[id], 'aria-label': d }); cb.addEventListener('change', () => { S.reqDone[id] = cb.checked; save(); renderReq(); });
    return h('li', { class: S.reqDone[id] ? 'done' : '' }, cb, h('span', {}, d), h('span', { class: 'pill', style: `color:var(${S.reqDone[id] ? '--green' : '--ink-3'})` }, S.reqDone[id] ? 'received' : 'outstanding')); }));
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'RF subcontractor deliverables'), h('p', { class: 'cap' }, 'Tick each one off as the supplier submits it.'), D));
}

/* =====================================================================
   PLAIN-LANGUAGE SUMMARY FOR TECHNICAL PAGES
   ===================================================================== */
function renderSummary() {
  const box = $('#techSum'); if (!box || secOf(S.tab).k !== 'site' || !LINK) return;
  const L = LINK, nm = hopName(L.hop), m = Math.max(0, L.design.ab), mg = Math.min(L.ab.margin[m], L.ba.margin[Math.max(0, L.design.ba)]);
  const T = {
    prof: `${nm} ${L.geoK.losClear ? 'has clear line of sight' : 'is blocked by terrain'}. At the tightest point the path clears ${f1(L.geoK.minRatio, 2)}× the first Fresnel radius (P.530 asks for ${S.g.clr1}×). ${L.diff.L > 0.5 ? `Terrain adds ${f1(L.diff.L, 1)} dB of diffraction loss.` : 'There is no diffraction loss.'}`,
    budget: `On ${nm} the signal arrives at ${fm(Math.min(L.ab.rsl[m], L.ba.rsl[Math.max(0, L.design.ba)]))} dBm. Keeping a ${f1(L.designFM, 1)} dB margin, the radios run ${L.design.ab >= 0 ? L.radio.mcs[m].mod : 'no modulation'} and carry ${fMb(L.design.cap.agg)}.`,
    topo: `${arch().name}: ${NET.radios} radios, ${fMb(NET.e2e)} end to end, ${f1(NET.latency, 1)} ms latency.`,
    val: 'Each TTA report figure re-run with this engine. Clear paths agree to a fraction of a dB, and every feasibility verdict matches.',
    fade: `Rain and multipath on ${nm} need only ${f1(L.propFM, 1)} dB of margin for ${S.g.reqAvail} %. The ${S.g.minFM} dB engineering allowance (interference, alignment, ageing) is what sets the design.`,
    sim: 'A replay of weather, refraction and interference on the current design. Press Start, or inject a storm to watch the radios change modulation.',
    ant: `On ${nm} the antennas point within ${f1(Math.max(L.GAmax - L.GA, L.GBmax - L.GB), 2)} dB of their peak gain toward each other.`,
    tower: `Current heights on ${nm} ${L.clr.rule1 && L.clr.rule2 ? 'meet' : 'do not meet'} the ITU-R P.530 clearance rule. Click any cell to try other heights.`,
    spec: `${nm} uses ${L.fc} MHz, ${bwLab(L.bw)} wide${L.band ? ` in ${L.band.name}` : ''}. ${NET.overlaps.length ? 'Some hops overlap in frequency.' : 'No hops overlap.'}`,
    cmp: (() => { const n = allNets(), ok = Object.entries(n).filter(([, N]) => N.meets && !N.links.some(x => x.fc < 1000)); return ok.length ? `Designs meeting ${S.g.reqThroughput} Mbps: ${ok.map(([k]) => S.archs[k].name).join(', ')}.` : `No design meets ${S.g.reqThroughput} Mbps with the current inputs.`; })(),
  };
  box.textContent = T[S.tab] || '';
}
