/* =====================================================================
   SITES & STATUS — tower and link register, outstanding work
   ===================================================================== */
for (const g of [13, 20, 21, 28]) RF.ANTENNAS['ttag' + g] = { name: `TTA model: ${g} dBi`, type: 'dish', gain: g };
regTab('reg', () => { $('#pane-reg').classList.add('g-two'); }, renderReg);
function openRegLink(R) {
  if (R.wec) { S.sel = NET.links.indexOf(R.L); update({ side: true }); return; }
  S.custom = { ...mkHop(R.def.a, R.def.b, R.def.antA || 'rd5g30', R.def.antB || 'rd5g30', R.def.fc || 5785, R.def.bw || 20), lossA: 1, lossB: 1, mountA: R.st.hA, mountB: R.st.hB };
  S.sel = 'custom'; update({ side: true });
}
const stDot = (map, k) => h('span', { class: 'sdot', style: `background:var(${map[k][1]})` });
function stSelect(map, val, on) {
  const s = h('select', { class: 'tsel', 'aria-label': 'Status' }, Object.entries(map).map(([k, v]) => h('option', { value: k, selected: k === val }, v[0])));
  s.addEventListener('change', () => on(s.value)); return s;
}
function tinput(val, on, label) { const i = h('input', { class: 'tin', type: 'number', value: val ?? '', min: 0, max: 150, step: 1, 'aria-label': label }); i.addEventListener('change', () => on(i.value === '' ? null : Math.max(0, +i.value))); return i; }
function regActions() {
  const out = [];
  for (const s of REGISTER.sites) { const r = S.reg.sites[s.id]; if (!r) continue; const t = r.tower_m;
    if (r.status === 'planned') out.push({ grp: 'Towers', st: 'planned', text: `Erect the ${t} m tower at ${s.name} (${s.owner}).` });
    if (r.status === 'construction') out.push({ grp: 'Towers', st: 'construction', text: `Complete and certify the ${t} m tower at ${s.name}; bond it to the site earth.` });
    if (r.status === 'recommended') out.push({ grp: 'Towers', st: 'recommended', text: `Approve or drop the ${t} m mast at ${s.name} recommended by TTA.` });
    if (r.status === 'unknown') out.push({ grp: 'Towers', st: 'unknown', text: `Survey ${s.name}: confirm whether a mast exists and how tall it is.` });
  }
  for (const s of REGISTER.sites) { const r = S.reg.sites[s.id]; if (r && (S.mounts[s.id] ?? 0) > (r.tower_m ?? 0)) out.push({ grp: 'Towers', st: 'bad', text: `Antenna at ${s.name} (${S.mounts[s.id]} m) is above its ${r.tower_m} m tower: raise the tower or lower the antenna.` }); }
  for (const R of REGL) { const st = R.st.status, nm = hopName(R.L.hop), L = R.L;
    if (st === 'recommended') out.push({ grp: 'Links', st, text: `Decide whether ${nm} is in scope (TTA recommends it, ${f1(L.D, 2)} km).` });
    if (st === 'planned') out.push({ grp: 'Links', st, text: `Procure, install and align ${nm}: radios, antennas, shielded PoE cabling and surge protection.` });
    if (st === 'installed') out.push({ grp: 'Links', st, text: `Commission ${nm}: check RSSI against the predicted ${fm(Math.max(...L.ab.rsl))} dBm, then iPerf in both directions.` });
    if (st !== 'not_feasible' && st !== 'communicating') {
      if (!(L.clear.cap.agg > 0)) out.push({ grp: 'Links', st: 'bad', text: `Redesign ${nm}: no modulation closes with the current heights and equipment.` });
      else if (R.wec && !(L.design.cap.agg >= S.g.reqThroughput)) out.push({ grp: 'Links', st: 'bad', text: `${nm} carries ${fMb(L.design.cap.agg)} at the design margin, short of ${S.g.reqThroughput} Mbps.` });
    }
  }
  return out;
}
function renderReg() {
  const pane = $('#pane-reg'); pane.innerHTML = '';
  const sc = k => REGISTER.sites.filter(s => S.reg.sites[s.id]?.status === k).length, lc = k => REGL.filter(R => R.st.status === k).length;
  const feasible = REGL.filter(R => R.st.status !== 'not_feasible'), acts = regActions(), manual = REGISTER.actions || [], openMan = manual.filter(a => !S.reg.done[a.id]).length;
  const towerPct = 100 * (sc('existing') + 0.5 * sc('construction')) / REGISTER.sites.length, linkPct = 100 * (lc('communicating') + 0.5 * lc('installed')) / Math.max(1, feasible.length);
  const tiles = [[`${sc('existing')} of ${REGISTER.sites.length}`, 'Towers up'], [sc('construction'), 'Towers under construction'], [sc('planned'), 'Towers planned'], [sc('recommended') + sc('unknown'), 'Towers proposed or to confirm'],
    [`${lc('communicating')} of ${feasible.length}`, 'Links communicating'], [lc('installed'), 'Links installed, commissioning'], [lc('planned'), 'Links planned'], [acts.length + openMan, 'Open actions']];
  const bar = (pct, label) => h('div', { style: 'display:grid;grid-template-columns:150px 1fr 48px;gap:10px;align-items:center;font-size:12.5px' }, h('span', {}, label), h('div', { class: 'prog' }, h('i', { style: `width:${pct}%;background:var(--green)` })), h('b', {}, f1(pct, 0) + ' %'));
  pane.append(h('div', { class: 'card span2' }, h('div', { class: 'row', style: 'justify-content:space-between' }, h('h3', {}, 'Network build status'),
      h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: exportRegister }, 'Export register as JSON'), h('button', { class: 'btn sm', onclick: () => { S.reg = regDefaults(); for (const s of REGISTER.sites) S.mounts[s.id] = s.antenna_m; NET3D && (NET3D.static = null); update({ side: true }); } }, 'Reset to config file'))),
    h('p', { class: 'cap' }, `Every tower and link from the TTA study and the WEC Rev 3 scope. Set the status as work progresses; the maps, 3D view and action list follow. Statuses start from config/network.json and your changes are kept in this browser until you export them.`),
    h('div', { class: 'statgrid' }, ...tiles.map(([v, t]) => h('div', { class: 'stat' }, h('b', {}, String(v)), h('span', {}, t)))),
    h('div', { style: 'display:grid;gap:6px;margin-top:12px' }, bar(towerPct, 'Towers built'), bar(linkPct, 'Links communicating'))));
  // towers
  const TT = h('table', { class: 't' }, h('tr', {}, ...['Site', 'Status', 'Latitude', 'Longitude', 'Δ to TTA Table 1', 'Tower m', 'Antenna m', 'Ground m (DEM / TTA)', 'TTA min. antenna', 'Owner / scope', 'Notes'].map(t => h('th', {}, t))));
  for (const s of REGISTER.sites) { const r = S.reg.sites[s.id], c = CTX.sites[s.id]; if (!r || !c) continue;
    const mn = TTA_MIN[s.id], low = mn != null && c.mount < mn;
    TT.append(h('tr', {}, h('td', {}, stDot(SITE_ST, r.status), h('b', {}, s.name)),
      h('td', {}, stSelect(SITE_ST, r.status, v => { r.status = v; NET3D && (NET3D.static = null); update(); })),
      h('td', {}, s.lat.toFixed(5)), h('td', {}, s.lon.toFixed(5)),
      h('td', { class: s.tta.lat != null && Math.hypot((s.lat - s.tta.lat) * 110574, (s.lon - s.tta.lon) * 101400) < 5 ? 'pos' : 'neg' }, s.tta.lat != null ? f1(Math.hypot((s.lat - s.tta.lat) * 110574, (s.lon - s.tta.lon) * 101400), 1) + ' m' : '—'),
      h('td', { class: (S.mounts[s.id] ?? 0) > (r.tower_m ?? 0) ? 'neg' : '' }, tinput(r.tower_m, v => { r.tower_m = v; NET3D && (NET3D.static = null); update(); }, `${s.name} tower height`)),
      h('td', {}, tinput(S.mounts[s.id], v => { S.mounts[s.id] = v ?? 0; NET3D && (NET3D.static = null); update({ side: true }); }, `${s.name} antenna height`)),
      h('td', {}, `${f1(c.ground, 0)} / ${f1(s.tta.elevation, 0)}`), h('td', { class: low ? 'neg' : '' }, mn != null ? mn + ' m' : '—'),
      h('td', { style: 'text-align:left;white-space:normal;min-width:150px' }, s.owner), h('td', { style: 'text-align:left;white-space:normal;min-width:260px;color:var(--ink-2)' }, s.note || '')));
  }
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Towers'), h('p', { class: 'cap' }, 'Tower height is the structure; antenna height is the centre-line used in every calculation. Ground levels compare the embedded Copernicus DEM with the TTA report.'), h('div', { class: 'tw' }, TT)));
  // links
  const LT = h('table', { class: 't' }, h('tr', {}, ...['Link', 'Scope', 'Status', 'Antennas m (A / B)', 'Distance', 'Clearance', 'Diffraction', 'RSL max', 'Capacity', 'Verdict'].map(t => h('th', {}, t))));
  for (const R of REGL) { const L = R.L, st = R.st, ok = L.clear.cap.agg > 0, good = L.design.cap.agg > 0;
    const hts = R.wec ? h('span', { title: 'Uses the site antenna heights and the selected architecture' }, `${L.A.mount} / ${L.B.mount}`)
      : h('span', {}, tinput(st.hA, v => { st.hA = v; update(); }, 'Antenna height A'), ' / ', tinput(st.hB, v => { st.hB = v; update(); }, 'Antenna height B'));
    LT.append(h('tr', {}, h('td', {}, stDot(LINK_ST, st.status), h('a', { href: '#', onclick: e => { e.preventDefault(); openRegLink(R); setTab('prof'); } }, hopName(L.hop))),
      h('td', { style: 'text-align:left' }, R.def.scope), h('td', {}, stSelect(LINK_ST, st.status, v => { st.status = v; update(); })), h('td', {}, hts),
      h('td', {}, f1(L.D, 2) + ' km'), h('td', { class: L.geoK.minRatio >= 0.6 ? 'pos' : L.geoK.minRatio >= 0 ? 'mid' : 'neg' }, f1(L.geoK.minRatio, 2) + ' F1'),
      h('td', {}, f1(L.diff.L, 1) + ' dB'), h('td', {}, fm(Math.max(...L.ab.rsl)) + ' dBm'), h('td', {}, fMb(L.design.cap.agg)),
      h('td', {}, h('span', { class: 'chip ' + (good ? 'pass' : ok ? 'warn' : 'fail') }, good ? 'Feasible' : ok ? 'Marginal' : 'Not feasible'))));
  }
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Links'), h('p', { class: 'cap' }, `Backhaul hops use the selected architecture (${arch().name}). Telemetry links are evaluated with ${S.telemKit && RF.KITS[S.telemKit] ? RF.KITS[S.telemKit].name : 'Rocket 5AC radios in a 20 MHz channel'} (change it in Equipment) and the current regulatory caps, at the TTA antenna heights unless you change them. Click a link to open its profile.`), h('div', { class: 'tw' }, LT)));
  // actions
  const grp = g => acts.filter(a => a.grp === g);
  const autoList = g => h('ul', { class: 'acts' }, ...grp(g).map(a => h('li', {}, h('span', { class: 'sdot', style: `margin-top:6px;background:var(${a.st === 'bad' ? '--red' : (g === 'Towers' ? SITE_ST : LINK_ST)[a.st] ? (g === 'Towers' ? SITE_ST : LINK_ST)[a.st][1] : '--ink-3'})` }), h('span', {}, a.text), h('span', { class: 'pill', style: `color:var(${a.st === 'bad' ? '--red' : '--ink-2'})` }, a.st === 'bad' ? 'design issue' : ((g === 'Towers' ? SITE_ST : LINK_ST)[a.st] || ['open'])[0]))), grp(g).length ? null : h('li', {}, h('span', {}), h('span', { class: 'note' }, 'Nothing outstanding.'), h('span', {})));
  const man = h('ul', { class: 'acts' }, ...manual.map(a => { const cb = h('input', { type: 'checkbox', checked: !!S.reg.done[a.id], 'aria-label': a.text }); cb.addEventListener('change', () => { S.reg.done[a.id] = cb.checked; save(); renderReg(); });
    return h('li', { class: S.reg.done[a.id] ? 'done' : '' }, cb, h('span', {}, a.text), h('span', { class: 'pill', style: `color:var(${S.reg.done[a.id] ? '--green' : '--amber'})` }, S.reg.done[a.id] ? 'done' : 'open')); }));
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'What we still need to do: towers'), autoList('Towers'), h('h3', { style: 'margin-top:14px' }, 'What we still need to do: links'), autoList('Links')),
    h('div', { class: 'card' }, h('h3', {}, 'Design decisions and approvals'), h('p', { class: 'cap' }, 'Tick these off as they are resolved; they are saved with the register.'), man));
}
function exportRegister() {
  const out = JSON.parse(JSON.stringify(REGISTER));
  out.sites.forEach(s => { const r = S.reg.sites[s.id]; if (r) { s.status = r.status; s.tower_m = r.tower_m; } s.antenna_m = S.mounts[s.id] ?? s.antenna_m; });
  out.links.forEach(l => { const r = S.reg.links[l.id]; if (r) { l.status = r.status; l.hA = r.hA; l.hB = r.hB; } });
  (out.actions || []).forEach(a => { a.done = !!S.reg.done[a.id]; });
  out.exported = new Date().toISOString();
  const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })), download: 'network.json' }); document.body.append(a); a.click(); a.remove();
}

/* =====================================================================
   TTA CHECK — reproduce the TTA report with this engine
   ===================================================================== */
let VALC = null;
regTab('val', () => { $('#pane-val').classList.add('g-two'); }, renderVal);
function valRows() {
  const cases = [...REGISTER.links.filter(l => l.tta).map(l => ({ ...l.tta, a: l.a, b: l.b })), ...(REGISTER.validation || [])];
  const run = (v, model) => {
    const ctx = { ...CTX, g: { ...CTX.g, enforceEirp: false, interf: null, miscLoss: 0, clutter: 0, diffModel: model } };
    const hop = { ...mkHop(v.a, v.b, 'ttag' + v.gA, 'ttag' + v.gB, 5800, 20), lossA: v.lossA, lossB: v.lossB, mountA: v.hA, mountB: v.hB, txPower: v.tx };
    return RF.analyzeLink(hop, ctx);
  };
  return cases.map(v => { const Lb = run(v, 'bullington'), Ld = run(v, 'deygout'); return { v, Lb, Ld, rb: Lb.ab.rsl[0], rd: Ld.ab.rsl[0], d: Lb.ab.rsl[0] - v.rssl }; });
}
function renderVal() {
  const pane = $('#pane-val'); pane.innerHTML = ''; const rows = valRows(); VALC = rows;
  const free = rows.filter(r => !(r.v.diff > 0)), obst = rows.filter(r => r.v.diff > 0), mad = a => a.length ? a.reduce((s, r) => s + Math.abs(r.d), 0) / a.length : NaN;
  const T = h('table', { class: 't' }, h('tr', {}, ...['TTA figure', 'Link', 'Antennas m', 'Gains dBi', 'Distance TTA / here', 'Diffraction TTA', 'Bullington', 'Deygout', 'RSSL TTA', 'RSL here', 'Δ', 'Agreement'].map(t => h('th', {}, t))));
  for (const r of rows) { const v = r.v, ad = Math.abs(r.d), cls = ad <= 3 ? 'pass' : ad <= 10 ? 'warn' : 'fail';
    T.append(h('tr', {}, h('td', {}, 'Fig. ' + v.figure), h('td', {}, `${shortName(v.a)} ⇄ ${shortName(v.b)}`), h('td', {}, `${v.hA} / ${v.hB}`), h('td', {}, `${v.gA} / ${v.gB}`),
      h('td', {}, `${f1(v.dist, 2)} / ${f1(r.Lb.D, 2)} km`), h('td', {}, f1(v.diff, 1) + ' dB'), h('td', {}, f1(r.Lb.diff.L, 1) + ' dB'), h('td', {}, f1(r.Ld.diff.L, 1) + ' dB'),
      h('td', {}, fm(v.rssl)), h('td', {}, fm(r.rb)), h('td', { class: ad <= 3 ? 'pos' : ad <= 10 ? 'mid' : 'neg' }, fs(r.d)), h('td', {}, h('span', { class: 'chip ' + cls }, ad <= 3 ? 'Agrees' : ad <= 10 ? 'Close' : 'Differs'))));
  }
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Reproducing the TTA path analysis'), h('p', { class: 'cap' }, 'Each link from the TTA report (Rev 2, 17 Feb 2025) re-run here with TTA’s own inputs: 26 dBm transmit power, their antenna gains, heights and feeder losses, no EIRP cap. TTA used a commercial planner with Longley-Rice; this engine uses the Copernicus 30 m DSM with ITU-R P.526 Bullington (and Deygout for comparison).'),
    h('div', { class: 'statgrid', style: 'margin-bottom:10px' }, h('div', { class: 'stat' }, h('b', {}, f1(mad(free), 2) + ' dB'), h('span', {}, `Mean |Δ| on ${free.length} clear paths`)), h('div', { class: 'stat' }, h('b', {}, f1(mad(obst), 1) + ' dB'), h('span', {}, `Mean |Δ| on ${obst.length} obstructed paths`)),
      h('div', { class: 'stat' }, h('b', {}, `${rows.filter(r => (r.v.rssl >= -80) === (r.rb >= -80)).length} of ${rows.length}`), h('span', {}, 'Same verdict against TTA’s −80 dBm threshold'))),
    h('div', { class: 'tw' }, T)));
  pane.append(chartCard('Predicted level: TTA against this engine', 'Points on the diagonal agree exactly; the band is ±3 dB. Clear paths are pure free-space geometry, so they should sit on the line.', { aspect: 1.25 }, (c, g, th) => {
    c.frame({ x: [-145, -35], y: [-145, -35], xlabel: 'TTA predicted RSSL (dBm)', ylabel: 'This engine, Bullington (dBm)' });
    c.clip(); g.fillStyle = Plot.alpha(th.green, 0.12); g.beginPath(); g.moveTo(c.X(-145), c.Y(-142)); g.lineTo(c.X(-38), c.Y(-35)); g.lineTo(c.X(-35), c.Y(-38)); g.lineTo(c.X(-142), c.Y(-145)); g.closePath(); g.fill();
    c.line([-145, -35], [-145, -35], { color: th.ink3, dash: [4, 3], width: 1 }); c.vline(-80, { color: th.red, label: 'TTA threshold' }); c.hline(-80, { color: th.red });
    for (const r of rows) { c.dot(r.v.rssl, r.rb, 5, r.v.diff > 0 ? th.amber : th.sig, th.panel); c.text(`${shortName(r.v.a)}–${shortName(r.v.b)} ${r.v.hA}/${r.v.hB}`, c.X(r.v.rssl) + 7, c.Y(r.rb) - 7, { size: 10.5, color: th.ink2, halo: true }); }
    c.unclip(); c.legend([{ label: 'Clear path', color: th.sig, fill: true }, { label: 'Obstructed path', color: th.amber, fill: true }], c.px0 + 8, c.py0 - 12); }));
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'How to read the differences'), h('div', { class: 'work' },
    eq('Clear paths', `Both tools reduce to ${V('P')}<sub>rx</sub> = ${V('P')}<sub>tx</sub> + ${V('G')}<sub>t</sub> + ${V('G')}<sub>r</sub> − ${V('L')} − ${V('L')}<sub>fs</sub>. Small residuals come from distance (coordinates) and the free-space constant.`),
    eq('Obstructed paths', `Longley-Rice blends knife-edge and smooth-earth diffraction with statistical terrain terms; Bullington replaces the terrain with one equivalent edge. Expect several dB of disagreement, and up to tens of dB on deep shadowing where both are extrapolating.`),
    eq('Terrain source', `TTA: 1-arcsecond DEM in their planner. Here: Copernicus GLO-30 DSM, which includes buildings and tree canopy. Site ground levels differ by ${f1(Math.max(...REGISTER.sites.map(s => Math.abs(CTX.sites[s.id].ground - s.tta.elevation))), 1)} m at most.`),
    eq('What matters for the decision', `Both tools agree on which paths are feasible: the SR3 star works, and the Engineer's Office cannot reach WWTP or PS3 directly.`))));
}
