/* =====================================================================
   APP CORE — state, compute, sidebar, header, tabs
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'style') e.style.cssText = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(k));
  return e;
};
const fMb = v => !isFinite(v) ? '—' : v > 0 && v < 1 ? (v * 1000).toFixed(v * 1000 < 10 ? 1 : 0) + ' kbps' : v.toFixed(0) + ' Mbps';
const bwLab = b => b < 1 ? (b * 1000) + ' kHz' : b + ' MHz';
const f1 = (v, d = 1) => (v == null || !isFinite(v)) ? '—' : v.toFixed(d);
const fs = (v, d = 1) => (v == null || !isFinite(v)) ? '—' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const fm = v => (v == null || !isFinite(v)) ? '—' : v < 0 ? '−' + Math.abs(v).toFixed(1) : v.toFixed(1);
const fAvail = a => { if (!isFinite(a)) return '—'; if (a >= 100 - 1e-9) return '100'; const u = 100 - a, d = Math.min(8, Math.max(2, Math.ceil(-Math.log10(u)) + 1)); return a.toFixed(d).replace(/0+$/, ''); };
const fPct = p => !isFinite(p) ? '—' : p === 0 ? '0' : p >= 0.01 ? p.toPrecision(3) : p.toExponential(1).replace('e', '×10^').replace(/\^(-?\d+)/, (m, e) => Plot.sup(+e));
const mins = pct => pct * 5259.6;  // % of year → minutes
const fDur = m => !isFinite(m) ? '—' : m < 1 ? (m * 60).toFixed(m * 60 < 10 ? 1 : 0) + ' s' : m < 120 ? m.toFixed(m < 10 ? 1 : 0) + ' min' : (m / 60).toFixed(1) + ' h';

const dem = RF.makeDEM(DEM_META, DEM_B64);
const LAT0 = (dem.north + dem.south) / 2, LON0 = (dem.west + dem.east) / 2;
const KX = 111.320 * Math.cos(LAT0 * Math.PI / 180), KY = 110.574;
const toXY = (lat, lon) => [(lon - LON0) * KX, (lat - LAT0) * KY];
const fromXY = (x, y) => [y / KY + LAT0, x / KX + LON0];
const ZBASE = dem.minZ - 25;
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const BASE_SITES = REGISTER.sites.map(s => ({ id: s.id, name: s.name, short: s.short, lat: s.lat, lon: s.lon, mount: s.antenna_m, role: s.role, tower: s.owner }));
const TTA_MIN = Object.fromEntries(REGISTER.sites.filter(s => s.tta && s.tta.antenna_min != null).map(s => [s.id, s.tta.antenna_min]));
const REG_HASH = (() => { const t = JSON.stringify(REGISTER); let x = 0; for (let i = 0; i < t.length; i++) x = (x * 31 + t.charCodeAt(i)) | 0; return t.length + ':' + x; })();
const regDefaults = () => ({ sites: Object.fromEntries(REGISTER.sites.map(s => [s.id, { status: s.status, tower_m: s.tower_m }])),
  links: Object.fromEntries(REGISTER.links.map(l => [l.id, { status: l.status, hA: l.hA ?? null, hB: l.hB ?? null }])),
  done: Object.fromEntries((REGISTER.actions || []).map(a => [a.id, !!a.done])) });
const SITE_ST = { existing: ['Up, in service', '--green'], construction: ['Under construction', '--amber'], planned: ['Planned', '--signal'], recommended: ['Recommended by study', '--ink-3'], unknown: ['To confirm on site', '--ink-3'] };
const LINK_ST = { communicating: ['Communicating', '--green'], installed: ['Installed, commissioning', '--amber'], planned: ['Planned', '--signal'], recommended: ['Recommended by study', '--ink-3'], not_feasible: ['Not feasible', '--red'] };
const SITE_SHORT = { existing: 'up', construction: 'building', planned: 'planned', recommended: 'proposed', unknown: 'to confirm' };
const mkHop = (a, b, antA, antB, fc, bw, radio = 'r5ac', mode = 'ptp') => ({ a, b, radio, antA, antB, fc, bw, pol: 'V', lossA: 0.5, lossB: 0.5, mode, misA: { az: 0, el: 0 }, misB: { az: 0, el: 0 }, tiltA: 0, tiltB: 0 });
const DEFAULTS = () => ({
  v: 9, arch: 'A', ui: { drawer: false, roOpen: false }, tab: 'home', sel: 0, reqDone: {},
  sup: { topology: 'ptmp', radio: 'r5ac', fc: 5785, fc2: 5745, bw: 40,
    custom: { model: 'Supplier radio', fLo: 5470, fHi: 5875, bwRef: 20, bwMax: 80, ptmpMax: 40, rateLo: 14.4, sensLo: -96, rateHi: 192.6, sensHi: -65, txLo: 27, txHi: 22, txMin: 4, eff: 60, port: 1000, nf: 6, powerW: 10, tmax: 70 },
    sites: { eng: { type: 'directional', gain: 30, bwH: '', bwV: '', az: '', tilt: 0, loss: 0.5 }, sr3: { type: 'omni', gain: 13, bwH: '', bwV: 7, az: '', tilt: 0, loss: 0.5 }, wwtp: { type: 'directional', gain: 30, bwH: '', bwV: '', az: '', tilt: 0, loss: 0.5 } } }, reg: regDefaults(), regHash: REG_HASH,
  mapv: { base: 'relief', linkColor: 'margin', grid: true, beams: true, labels: true, others: true, network: true },
  mounts: Object.fromEntries(BASE_SITES.map(s => [s.id, s.mount])), candidates: [],
  g: { k: 1.3333, keAuto: true, ke: 0.6, clutter: 0, diffModel: 'bullington', tempC: 25, rho: 7.5, miscLoss: 0, enforceEirp: true, interf: -130,
    groundSrc: 'tta', dN1: -250, saAuto: true, sa: 50, R001: 60, reqAvail: 99.99, minFM: 10, duty: 0.5, reqThroughput: 300, clr1: 1.0, obstacle: 'extended', rainP0: 3 },
  caps: Object.fromEntries(RF.BANDS.map(b => [b.id, b.cap])),
  archs: {
    A: { name: 'Specified: SR3 omni', long: 'As specified by TTA (Feb 2025) and Rev 3: one SR3 radio on a 13 dBi omni serving both ends, RD-5G30 dishes at the Engineer’s Office and WWTP', topology: 'ptmp',
      hops: [mkHop('sr3', 'eng', 'amo5g13', 'rd5g30', 5785, 40, 'r5ac', 'ptmp'), mkHop('sr3', 'wwtp', 'amo5g13', 'rd5g30', 5785, 40, 'r5ac', 'ptmp')] },
    B: { name: 'Deviation: dual PtP', long: 'Proposed deviation for 300 Mbps: two dish-to-dish links meeting on a switch at SR3 (four radios). Needs client approval', topology: 'ptp',
      hops: [mkHop('eng', 'sr3', 'rd5g30', 'rd5g30', 5775, 80), mkHop('sr3', 'wwtp', 'rd5g30', 'rd5g30', 5845, 60)] },
    C: { name: 'Licensed 11 GHz', long: 'Two licensed 11 GHz FDD links with 0.6 m dishes (class-typical radio figures)', topology: 'ptp',
      hops: [mkHop('eng', 'sr3', 'dish06', 'dish06', 10955, 56, 'lic11'), mkHop('sr3', 'wwtp', 'dish06', 'dish06', 11255, 56, 'lic11')] },
    D: { name: 'Tabateq 245U, SR3 omni', long: 'ELPRO 245U-E-A1 in the specified topology: SR3 access point on a 13 dBi omni, Tabateq 30 dBi dishes at the ends, radios in the panel with the quoted coax kit', topology: 'ptmp',
      hops: [{ ...mkHop('sr3', 'eng', 'omni13n', 'tab30dish', 5785, 20, 'elpro245', 'ptmp'), lossA: +RF.kitLoss('tab245', 5785).toFixed(1), lossB: +RF.kitLoss('tab245', 5785).toFixed(1) },
        { ...mkHop('sr3', 'wwtp', 'omni13n', 'tab30dish', 5785, 20, 'elpro245', 'ptmp'), lossA: +RF.kitLoss('tab245', 5785).toFixed(1), lossB: +RF.kitLoss('tab245', 5785).toFixed(1) }] },
    E: { name: 'Tabateq 415U UHF (excluded: no UHF)', long: 'ELPRO 415U-2-C4 UHF I/O gateways, SR3 as base, 2 dBi dipoles and the Tabateq coax kit, licensed 400–480 MHz', topology: 'ptmp',
      hops: [{ ...mkHop('sr3', 'eng', 'tabdipole', 'tabdipole', 450, 0.025, 'elpro415', 'ptmp'), lossA: +RF.kitLoss('tab415', 450).toFixed(1), lossB: +RF.kitLoss('tab415', 450).toFixed(1) },
        { ...mkHop('sr3', 'wwtp', 'tabdipole', 'tabdipole', 450, 0.025, 'elpro415', 'ptmp'), lossA: +RF.kitLoss('tab415', 450).toFixed(1), lossB: +RF.kitLoss('tab415', 450).toFixed(1) }] },
  },
  custom: mkHop('wwtp', 'eng', 'rd5g30', 'rd5g30', 5775, 40),
  view: { exag: 3, fresnel: true, packets: !REDUCED, lobes: false, coverage: false, labels: true, others: true, network: true },
  cov: { tx: 'sr3', ant: 'amo5g13', az: 230, tilt: 0, rxH: 10, rxAnt: 'rd5g30', layer: 'thr', res: 3, fc: 5785, bw: 40, radio: 'r5ac', fm: false },
  sim: { env: 'moderate', speed: 60 },
  tower: { metric: 'p530', hmax: 60 },
  hw: { mttrEnd: 8, mttrRelay: 24, mtbf: { switch: 400000, router: 250000, firewall: 200000, psu: 120000, spd: 500000 } },
  pw: { hours: 8, volts: 24, eta: 0.9, dod: 0.7, kt: 0.9, kage: 1.25, ambient: 38, encW: 600, encH: 600, encD: 250, absorb: 0.5, shield: true, k: 5.5 },
});
const KEY = 'wec-rf-lab-v9';
let S;
try { const raw = localStorage.getItem(KEY); S = raw ? JSON.parse(raw) : null; if (!S || S.v !== 9) S = null; } catch (e) { S = null; }
if (!S) S = DEFAULTS();
if (S.regHash !== REG_HASH) { S.reg = regDefaults(); S.regHash = REG_HASH; for (const s0 of REGISTER.sites) S.mounts[s0.id] = s0.antenna_m; }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };

const regSite = id => REGISTER.sites.find(s => s.id === id);
const groundOf = s => { const r = regSite(s.id); return S.g.groundSrc === 'tta' && r && r.tta && r.tta.elevation != null ? r.tta.elevation : dem.elev(s.lat, s.lon); };
const specLevel = k => { const A = S.archs[k]; let omni = true, dir = true;
  for (const x of A.hops) { const sa = x.a === 'sr3', s = RF.ANTENNAS[sa ? x.antA : x.antB], e = RF.ANTENNAS[sa ? x.antB : x.antA]; if (s.type !== 'omni') omni = false; if (e.type === 'omni') dir = false; }
  return omni && dir ? 'yes' : omni ? 'partial' : 'no'; };
const SPEC_TXT = { yes: 'Matches specified topology', partial: 'SR3 omni as specified, omni ends', no: 'Deviation from spec: needs approval' };
const allSites = () => [...BASE_SITES, ...S.candidates.map(c => ({ ...c, role: 'candidate' }))];
const siteById = id => allSites().find(s => s.id === id);
const shortName = id => siteById(id)?.short || id;
const arch = () => S.archs[S.arch];
const selHop = () => S.sel === 'custom' ? S.custom : arch().hops[Math.min(S.sel, arch().hops.length - 1)];
const hopName = hp => `${shortName(hp.a)} ⇄ ${shortName(hp.b)}`;

/* ---------------- compute ---------------- */
let CTX, NET, LINK, NETS = null;
function makeCtx() {
  const sites = {};
  for (const s of allSites()) sites[s.id] = { ...s, ground: groundOf(s), mount: S.mounts[s.id] ?? s.mount ?? 10 };
  const bands = RF.BANDS.map(b => ({ ...b, cap: S.caps[b.id] === '' || S.caps[b.id] == null ? null : +S.caps[b.id] }));
  return { dem, sites, bands, g: { ...S.g, sa: S.g.saAuto ? dem.std : S.g.sa, interf: S.g.interf <= -130 ? null : S.g.interf } };
}
function compute() {
  applySupplier();
  CTX = makeCtx();
  NET = RF.evalNetwork(arch(), CTX);
  if (S.sel !== 'custom' && S.sel >= NET.links.length) S.sel = 0;
  LINK = S.sel === 'custom' ? RF.analyzeLink(S.custom, CTX) : NET.links[S.sel];
  NETS = null; REGL = evalRegister();
}
let REGL = [];
const samePair = (hp, a, b) => (hp.a === a && hp.b === b) || (hp.a === b && hp.b === a);
function evalRegister() {
  return REGISTER.links.map(l => {
    const st = S.reg.links[l.id] || { status: l.status }, own = NET.links.find(L => samePair(L.hop, l.a, l.b));
    if (own) return { def: l, st, L: own, wec: true };
    if (!CTX.sites[l.a] || !CTX.sites[l.b]) return null;
    const kid = S.telemKit || 'rocket', K = RF.KITS[kid];
    const hop = K ? { ...mkHop(l.a, l.b, K.ant, K.ant, K.fc, K.bw, K.radio), lossA: RF.kitLoss(kid, K.fc), lossB: RF.kitLoss(kid, K.fc), mountA: st.hA, mountB: st.hB }
      : { ...mkHop(l.a, l.b, l.antA || 'rd5g30', l.antB || 'rd5g30', l.fc || 5785, l.bw || 20), lossA: 1, lossB: 1, mountA: st.hA, mountB: st.hB };
    try { return { def: l, st, L: RF.analyzeLink(hop, CTX), wec: false }; } catch (e) { return null; }
  }).filter(Boolean);
}
const allNets = () => { if (!NETS) NETS = Object.fromEntries(Object.keys(S.archs).map(k => [k, RF.evalNetwork(S.archs[k], CTX)])); return NETS; };

const listeners = { tab: {} };
let pending = false;
function update(opts = {}) {
  if (opts.side) buildSide();
  if (pending) return; pending = true;
  requestAnimationFrame(() => {
    pending = false; save();
    try { compute(); } catch (e) { console.error(e); }
    renderHeader(); renderHops();
    for (const k in listeners.tab) listeners.tab[k].stale = true;
    renderActive(); renderSummary();
  });
}
function renderActive() { const t = listeners.tab[S.tab]; if (t) { t.stale = false; t.render(); } }

/* ---------------- header ---------------- */
function renderHeader() {
  const as = $('#archSel'); syncArchSel();
  const sl = specLevel(S.arch), sc = $('#specChip'); sc.className = 'chip ' + (sl === 'yes' ? 'pass' : 'warn'); sc.textContent = SPEC_TXT[sl];
  const req = S.g.reqThroughput, v = NET.e2e, ok = NET.meets;
  $('#vNum').innerHTML = v > 0 && v < 1 ? `${f1(v * 1000, 0)}<small>kbps</small>` : `${f1(v, 0)}<small>Mbps</small>`;
  $('#vLab').textContent = `End-to-end at a ${f1(Math.max(...NET.links.map(l => l.designFM)), 1)} dB design margin (clear air ${fMb(NET.e2eClear)})`;
  const mx = Math.max(req * 1.6, v * 1.05, 100);
  $('#vBar').style.width = (100 * Math.min(1, v / mx)) + '%'; $('#vBar').style.background = ok ? 'var(--green)' : 'var(--red)';
  $('#vReq').style.left = (100 * req / mx) + '%'; $('#vReq').title = `Requirement ${req} Mbps`;
  const c = $('#vChip'); c.className = 'chip ' + (ok ? 'pass' : 'fail');
  c.textContent = ok ? `Meets ${req} Mbps` : `Short of ${req} Mbps`;
}
/* ---------------- hop strip ---------------- */
function renderHops() {
  const box = $('#hops'); box.innerHTML = '';
  NET.links.forEach((L, i) => {
    const fmReq = L.reqMcs >= 0 ? L.ladder[L.reqMcs].margin : null;
    box.append(h('button', { class: 'hop', 'aria-pressed': S.sel === i, onclick: () => { S.sel = i; update({ side: true }); } },
      h('span', { class: 'nm' }, hopName(L.hop)),
      h('span', { class: 'k' }, h('b', {}, f1(L.D, 2)), 'km'),
      h('span', { class: 'k' }, h('b', {}, fMb(L.design.cap.agg).split(' ')[0]), fMb(L.design.cap.agg).split(' ')[1]),
      h('span', { class: 'k', title: 'Weakest-direction margin at the design modulation' }, h('b', {}, f1(Math.min(L.ab.margin[Math.max(0, L.design.ab)], L.ba.margin[Math.max(0, L.design.ba)]), 1)), 'dB margin'),
      h('span', { class: 'k', title: 'Minimum first-Fresnel-zone clearance at K = ' + S.g.k.toFixed(2) }, h('b', {}, f1(L.geoK.minRatio, 2)), 'F1')));
  });
  const c = S.custom;
  box.append(h('button', { class: 'hop' + (S.sel === 'custom' ? '' : ' custom'), 'aria-pressed': S.sel === 'custom', onclick: () => { S.sel = 'custom'; update({ side: true }); } },
    S.sel === 'custom' && LINK ? [h('span', { class: 'nm' }, 'Any path: ' + hopName(c)), h('span', { class: 'k' }, h('b', {}, f1(LINK.D, 2)), 'km'), h('span', { class: 'k' }, h('b', {}, f1(LINK.clear.cap.agg, 0)), 'Mbps clear'), h('span', { class: 'k' }, h('b', {}, f1(LINK.diff.L, 1)), 'dB diffraction'), h('span', { class: 'k' }, h('b', {}, f1(LINK.geoK.minRatio, 2)), 'F1')]
      : 'Analyse any path…'));
}

/* ---------------- sidebar inputs ---------------- */
function fld(label, input, unit, cls) { return h('label', { class: 'f' + (cls ? ' ' + cls : '') }, h('span', {}, label, unit ? h('span', { class: 'u' }, ' ' + unit) : null), input); }
function num(obj, key, o = {}) {
  const i = h('input', { type: 'number', value: obj[key], step: o.step ?? 'any', min: o.min, max: o.max, 'aria-label': o.label });
  i.addEventListener('change', () => { let v = parseFloat(i.value); if (!isFinite(v)) { i.value = obj[key]; return; } if (o.min != null) v = Math.max(o.min, v); if (o.max != null) v = Math.min(o.max, v); i.value = v; obj[key] = v; o.on && o.on(v); update({ side: !!o.rebuild }); });
  return fld(o.label, i, o.unit);
}
function sel(obj, key, options, o = {}) {
  const s = h('select', { 'aria-label': o.label }, options.map(([v, t]) => h('option', { value: v, selected: String(obj[key]) === String(v) }, t)));
  s.addEventListener('change', () => { const v = o.numeric ? +s.value : s.value; obj[key] = v; o.on && o.on(v); update({ side: !!o.rebuild }); });
  return fld(o.label, s, o.unit, o.wide ? 'wide' : '');
}
function tog(obj, key, label, o = {}) {
  const i = h('input', { type: 'checkbox', checked: !!obj[key] });
  i.addEventListener('change', () => { obj[key] = i.checked; o.on && o.on(i.checked); update({ side: !!o.rebuild }); });
  return h('label', { class: 'tog' }, i, label);
}
const group = (title, open, ...kids) => h('details', { class: 'grp', open: open }, h('summary', {}, title), h('div', { class: 'in' }, ...kids));
const radioOpts = () => Object.entries(RF.RADIOS).map(([k, r]) => [k, r.name]);
const antOpts = () => Object.entries(RF.ANTENNAS).filter(([k]) => !k.startsWith('tta') && !k.startsWith('sup_')).map(([k, a]) => [k, a.name]);
const siteOpts = () => allSites().map(s => [s.id, s.name]);
const openGroups = new Set(['sup']);
function buildSideAdvanced(side) {
  const g = S.g, hp = selHop(), A = arch(), isPtmp = S.sel !== 'custom' && A.topology === 'ptmp', radio = RF.RADIOS[hp.radio];
  const link = (key) => (v) => { if (isPtmp) A.hops.forEach(x => { x[key] = v; }); };
  const add = (k, title, ...kids) => { const d = group(title, openGroups.has(k), ...kids); d.dataset.k = k; side.append(d); };
  add('req', 'Requirement targets',
    num(g, 'reqThroughput', { label: 'Usable throughput', unit: 'Mbps', min: 1, max: 5000, step: 10 }),
    num(g, 'reqAvail', { label: 'Availability target', unit: '%', min: 90, max: 99.99999, step: 0.001 }),
    num(g, 'minFM', { label: 'Engineering fade margin', unit: 'dB', min: 0, max: 40, step: 0.5 }),
    num(g, 'duty', { label: 'TDD share A→B', unit: '0–1', min: 0.1, max: 0.9, step: 0.05 }),
    h('p', { class: 'note' }, 'Throughput is aggregate TCP/IP (both directions). The design margin is the larger of the engineering margin and the propagation margin the availability target needs.'));
  const hopKids = [];
  if (S.sel === 'custom') {
    hopKids.push(sel(hp, 'a', siteOpts(), { label: 'Site A', rebuild: true }), sel(hp, 'b', siteOpts(), { label: 'Site B', rebuild: true }));
  } else hopKids.push(h('p', { class: 'note' }, A.long + (isPtmp ? '. Radio, channel and SR3 antenna are shared by both hops.' : '.')));
  hopKids.push(
    sel(hp, 'radio', radioOpts(), { label: 'Radio', rebuild: true, on: v => { link('radio')(v); const r = RF.RADIOS[v]; const fix = x => { if (!r.bws.includes(x.bw)) x.bw = r.bws.includes(80) ? 80 : r.bws[r.bws.length - 2] || r.bws[0]; if (x.fc < r.band[0] || x.fc > r.band[1]) x.fc = Math.round((r.band[0] + r.band[1]) / 2); }; (isPtmp ? A.hops : [hp]).forEach(fix); } }),
    sel(hp, 'antA', antOpts(), { label: `Antenna at ${shortName(hp.a)}`, on: link('antA') }),
    sel(hp, 'antB', antOpts(), { label: `Antenna at ${shortName(hp.b)}` }),
    num(hp, 'fc', { label: 'Centre frequency', unit: 'MHz', min: radio.band[0], max: radio.band[1], step: 5, on: link('fc') }),
    sel(hp, 'bw', radio.bws.map(b => [b, bwLab(b)]), { label: 'Channel width', numeric: true, on: link('bw') }),
    sel(hp, 'pol', [['V', 'Vertical'], ['H', 'Horizontal'], ['C', 'Dual / slant']], { label: 'Polarisation (rain)' }),
    num(hp, 'lossA', { label: `Feeder loss ${shortName(hp.a)}`, unit: 'dB', min: 0, max: 10, step: 0.1, on: link('lossA') }),
    num(hp, 'lossB', { label: `Feeder loss ${shortName(hp.b)}`, unit: 'dB', min: 0, max: 10, step: 0.1 }));
  if (RF.ANTENNAS[hp.antA].type !== 'dish') hopKids.push(num(hp, 'tiltA', { label: `Downtilt at ${shortName(hp.a)}`, unit: '°', min: -10, max: 15, step: 0.5, on: link('tiltA') }));
  if (RF.ANTENNAS[hp.antB].type !== 'dish') hopKids.push(num(hp, 'tiltB', { label: `Downtilt at ${shortName(hp.b)}`, unit: '°', min: -10, max: 15, step: 0.5 }));
  if (!(S.arch === 'S' && S.sel !== 'custom')) add('hop', S.sel === 'custom' ? 'Analyse any path' : `Selected hop (advanced): ${hopName(hp)}`, ...hopKids);
  // sites
  const sg = h('div', { class: 'sitegrid' }, h('span', { class: 'h' }, 'Site'), h('span', { class: 'h' }, 'Ground m'), h('span', { class: 'h' }, 'Antenna m'));
  for (const s of allSites()) {
    const i = h('input', { type: 'number', value: S.mounts[s.id] ?? s.mount, min: 0, max: 150, step: 1, 'aria-label': `${s.name} antenna height` });
    i.addEventListener('change', () => { const v = Math.max(0, Math.min(150, +i.value || 0)); i.value = v; S.mounts[s.id] = v; update(); });
    sg.append(h('span', { title: s.tower || '' }, s.name, s.role === 'candidate' ? h('button', { class: 'btn sm', style: 'margin-left:6px;padding:0 6px', title: 'Remove candidate', onclick: () => removeCandidate(s.id) }, '×') : null),
      h('span', { style: 'color:var(--ink-2)' }, f1(groundOf(s), 0)), i);
  }
  add('sites', 'Site ground levels', sel(g, 'groundSrc', [['tta', 'TTA report (surveyed list)'], ['dem', 'Copernicus DEM']], { label: 'Site ground level from' }), h('p', { class: 'note' }, 'TTA surveyed elevations are used by default; switch to the Copernicus DEM to compare. Tower and antenna heights are edited in Supplier proposal and Sites & status.'));
  add('prop', 'Propagation and climate',
    sel(g, 'diffModel', [['bullington', 'Bullington (P.526-15)'], ['deygout', 'Deygout 3-edge (P.526)'], ['knife', 'Single knife edge'], ['none', 'Free space only']], { label: 'Diffraction model' }),
    num(g, 'k', { label: 'Median K-factor', min: 0.3, max: 10, step: 0.01 }),
    tog(g, 'keAuto', 'Estimate worst-month kₑ from path length', { rebuild: true }),
    g.keAuto ? null : num(g, 'ke', { label: 'kₑ (99.9 % worst month)', min: 0.3, max: 2, step: 0.01 }),
    num(g, 'clutter', { label: 'Extra clutter on path', unit: 'm', min: 0, max: 40, step: 1 }),
    num(g, 'dN1', { label: 'dN₁ refractivity gradient', unit: 'N/km', min: -1000, max: 0, step: 10 }),
    num(g, 'R001', { label: 'Rain rate R₀.₀₁', unit: 'mm/h', min: 1, max: 200, step: 1 }),
    num(g, 'rainP0', { label: 'Time with rain', unit: '%', min: 0.1, max: 20, step: 0.1 }),
    num(g, 'tempC', { label: 'Air temperature', unit: '°C', min: -10, max: 50, step: 1 }),
    num(g, 'rho', { label: 'Water vapour density', unit: 'g/m³', min: 0, max: 30, step: 0.5 }),
    num(g, 'miscLoss', { label: 'Other fixed losses', unit: 'dB', min: 0, max: 20, step: 0.5 }),
    sel(g, 'clr1', [[1.0, '1.0 F1 at median K (P.530)'], [0.6, '0.6 F1 at median K (common practice)']], { label: 'Clearance rule step 1', numeric: true }),
    sel(g, 'obstacle', [['extended', 'Extended (0.3 F1 at kₑ)'], ['single', 'Single isolated (grazing at kₑ)']], { label: 'Obstruction type' }),
    h('p', { class: 'note' }, 'dN₁ and R₀.₀₁ should be read from the ITU-R P.453 and P.837 digital maps for Molepolole before final design.'));
  const capKids = RF.BANDS.map(b => { const i = h('input', { type: 'number', value: S.caps[b.id] ?? '', placeholder: 'none', step: 0.5 });
    i.addEventListener('change', () => { S.caps[b.id] = i.value === '' ? null : +i.value; update(); }); return fld(b.name, i, 'dBm EIRP'); });
  add('reg', 'Regulatory EIRP', tog(g, 'enforceEirp', 'Back off TX power to respect the caps'), ...capKids,
    h('p', { class: 'note' }, 'Reference caps follow ETSI EN 301 893 / EN 302 502 and the SADC harmonisation figure (4 W in 5725–5875 MHz). Confirm the Botswana limits in writing with BOCRA.'));
  add('int', 'Interference',
    num(g, 'interf', { label: 'In-channel interference', unit: 'dBm', min: -130, max: -40, step: 1 }),
    h('p', { class: 'note' }, '−130 means none. Any other value raises the noise floor and desensitises every modulation by 10·log₁₀(1 + I/N). Run a spectrum survey at SR3 first.'));
}
function removeCandidate(id) { S.candidates = S.candidates.filter(c => c.id !== id); delete S.mounts[id]; if ([S.custom.a, S.custom.b].includes(id)) { S.custom.a = 'wwtp'; S.custom.b = 'eng'; } NET3D && (NET3D.static = null); update({ side: true }); }

/* ---------------- tabs ---------------- */
const TABS = [
  ['home', 'Home'],
  ['project', 'Overview'], ['schedule', 'Schedule'], ['lookahead', 'Lookahead'], ['actions', 'Actions'], ['risks', 'Risks'], ['issues', 'Issues'], ['decisions', 'Decisions'], ['meetings', 'Meetings'], ['daily', 'Site diary'],
  ['tech', 'Overview'], ['req', 'Live RF compliance'], ['reqreg', 'Requirements register'], ['deliverables', 'Deliverables'], ['rfis', 'RFIs'], ['docs', 'Documents'], ['deviations', 'Deviations'],
  ['site', 'Overview'], ['map', '2D map'], ['net', '3D terrain'], ['reg', 'Sites & status'], ['topo', 'Topology'], ['val', 'TTA check'], ['prof', 'Path profile'], ['budget', 'Link budget'], ['fade', 'Fading'],
  ['sim', 'Live simulation'], ['ant', 'Antennas'], ['tower', 'Tower heights'], ['spec', 'Spectrum'], ['kit', 'Equipment'], ['cmp', 'Compare designs'],
  ['commercial', 'Overview'], ['clientpo', 'Client PO'], ['budgetcom', 'Budget'], ['quotes', 'Supplier quotes'], ['quotecompare', 'Quote comparison'], ['supplierpo', 'Supplier POs'], ['invoices', 'Invoices'], ['variations', 'Variations'], ['cashflow', 'Cash flow'], ['clients', 'Clients'], ['suppliers', 'Suppliers'],
  ['ai', 'Capture & inbox'], ['aisummaries', 'Daily summaries'], ['aiask', 'Ask the project'], ['activity', 'Activity log'], ['settings', 'Settings']
];
const TAB_GROUPS = [['Network', ['map', 'net', 'reg', 'topo']], ['Link engineering', ['prof', 'budget', 'fade', 'ant', 'tower', 'spec']], ['Design checks', ['cmp', 'kit', 'val', 'sim']]];
function renderNav() {
  const nav = $('#tabs'), gi = Math.max(0, TAB_GROUPS.findIndex(g0 => g0[1].includes(S.tab))), names = Object.fromEntries(TABS);
  nav.innerHTML = '';
  nav.append(h('div', { class: 'seg grp' }, TAB_GROUPS.map(([nm, ks], i) => h('button', { 'aria-pressed': i === gi, onclick: () => setTab(ks.includes(S.tab) ? S.tab : ks[0]) }, nm))));
  for (const k of TAB_GROUPS[gi][1]) nav.append(h('button', { role: 'tab', 'data-k': k, 'aria-selected': S.tab === k, onclick: () => setTab(k) }, names[k]));
}
function setTab(k) {
  S.tab = k; save(); layoutFor(k);
  $$('.pane').forEach(p => p.classList.toggle('on', p.dataset.k === k));
  const t = listeners.tab[k]; if (t) { if (!t.inited) { t.init(); t.inited = true; } t.stale = false; t.render(); }
  window.dispatchEvent(new Event('tabchange'));
}
function regTab(k, init, render) { listeners.tab[k] = { init, render, inited: false, stale: true }; }
/* helper to build a chart inside a card */
function chartCard(title, cap, opts, draw) {
  const cv = h('canvas', { class: 'cv' }), card = h('div', { class: 'card' + (opts.span ? ' span2' : '') }, h('h3', {}, title), cap ? h('p', { class: 'cap' }, cap) : null, opts.top || null, cv, opts.bottom || null);
  const ch = new Plot.Chart(cv, draw, { aspect: opts.aspect, height: opts.height }); card.chart = ch; return card;
}
const eq = (label, html) => h('div', { class: 'eq' }, h('span', { class: 'lbl' }, label), h('span', { html }));
const V = s => `<var>${s}</var>`, FR = (a, b) => `<span class="fr"><span>${a}</span><span>${b}</span></span>`, SQ = x => `√<span class="sq">${x}</span>`, B = (v) => `<b>${v}</b>`;
