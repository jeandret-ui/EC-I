/* =====================================================================
   PATH PROFILE
   ===================================================================== */
const PV = { curved: false, zones: false };
regTab('prof', () => {
  const pane = $('#pane-prof');
  const t1 = h('input', { type: 'checkbox' }); t1.addEventListener('change', () => { PV.curved = t1.checked; PROF.main.chart.redraw(); });
  const t2 = h('input', { type: 'checkbox' }); t2.addEventListener('change', () => { PV.zones = t2.checked; PROF.main.chart.redraw(); });
  const main = chartCard('Terrain profile', null, { aspect: 2.35, top: h('div', { class: 'row', style: 'margin-bottom:6px' }, h('label', { class: 'tog' }, t1, 'True terrain with a curved ray'), h('label', { class: 'tog' }, t2, 'Show F2 and F3 zones')) }, drawProfile);
  const side = h('div', { class: 'stack' }, h('div', { class: 'card', id: 'profCrit' }), h('div', { class: 'card', id: 'profWork' }));
  const clr = chartCard('Clearance along the path', 'Clearance divided by the local first-Fresnel radius, h/F1, at the median K and the worst-month kₑ.', { aspect: 2.1 }, drawClearance);
  const kk = chartCard('Diffraction loss against K-factor', 'Each method re-run over the real terrain as the atmosphere bends the ray. Sub-refraction (K < 1) lifts the Earth bulge into the path.', { aspect: 2.1 }, drawDiffK);
  pane.append(main, side, clr, kk); PROF = { main, clr, kk };
}, () => { PROF.main.querySelector('h3').textContent = `Terrain profile: ${hopName(LINK.hop)}`; PROF.dk = null; [PROF.main, PROF.clr, PROF.kk].forEach(c => c.chart.redraw()); renderProfSide(); });
let PROF;
function drawProfile(c, g, th) {
  const L = LINK, P = L.prof, G = L.geoK, n = P.n, K = S.g.k, d = P.d;
  const curved = PV.curved, bul = i => RF.bulge(d[i], L.D - d[i], K);
  const ter = i => curved ? P.z[i] : G.y[i] - S.g.clutter * (i > 0 && i < n - 1 ? 1 : 0), ray = i => curved ? G.los[i] - bul(i) : G.los[i];
  const terK = i => curved ? P.z[i] + S.g.clutter : G.y[i];
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < n; i++) { ymin = Math.min(ymin, P.z[i]); ymax = Math.max(ymax, ray(i) + G.r1[i] * (PV.zones ? 1.75 : 1), terK(i)); }
  ymin = Math.floor((ymin - 15) / 10) * 10; ymax = Math.ceil((ymax + 10) / 10) * 10;
  c.frame({ x: [0, L.D], y: [ymin, ymax], xlabel: `Distance from ${shortName(L.hop.a)} (km)`, ylabel: 'Elevation (m AMSL)', m: { l: 56 } });
  c.clip();
  const xs = Array.from(d), ys = xs.map((_, i) => ter(i));
  const grd = g.createLinearGradient(0, c.Y(ymax), 0, c.Y(ymin)); grd.addColorStop(0, Plot.alpha(th.sand, 0.75)); grd.addColorStop(1, Plot.alpha(th.sand, 0.25));
  c.area(xs, ymin, ys, grd); c.line(xs, ys, { color: Plot.alpha(th.ink, 0.75), width: 1.2 });
  if (S.g.clutter > 0) c.line(xs, xs.map((_, i) => terK(i)), { color: th.green, width: 1, dash: [3, 3] });
  if (!curved) { const ke = L.geoKe.y; c.line(xs, Array.from(ke), { color: th.amber, width: 1, dash: [5, 4] }); }
  const lo = xs.map((_, i) => ray(i) - G.r1[i]), hi = xs.map((_, i) => ray(i) + G.r1[i]);
  if (PV.zones) for (const z of [3, 2]) { const k = Math.sqrt(z); c.area(xs, xs.map((_, i) => ray(i) - G.r1[i] * k), xs.map((_, i) => ray(i) + G.r1[i] * k), Plot.alpha(th.sig, 0.05)); }
  c.area(xs, lo, hi, Plot.alpha(th.sig, 0.13));
  c.line(xs, hi, { color: Plot.alpha(th.sig, 0.6), width: 1 }); c.line(xs, lo, { color: Plot.alpha(th.sig, 0.6), width: 1 });
  c.line(xs, xs.map((_, i) => ray(i) - 0.6 * G.r1[i]), { color: th.sig2, width: 1, dash: [6, 4] });
  // intrusion into 0.6 F1
  g.fillStyle = Plot.alpha(th.red, 0.55);
  for (let i = 1; i < n - 1; i++) { const lim = ray(i) - 0.6 * G.r1[i], t = terK(i); if (t > lim) { const x0 = c.X(d[i - 1] + (d[i] - d[i - 1]) / 2), x1 = c.X(d[i] + (d[Math.min(n - 1, i + 1)] - d[i]) / 2); g.fillRect(x0, c.Y(t), x1 - x0, c.Y(lim) - c.Y(t)); } }
  c.line(xs, xs.map((_, i) => ray(i)), { color: th.sig, width: 2.2 });
  c.unclip();
  // masts
  for (const [x, gnd, ant, nm] of [[0, P.z[0], L.hA, shortName(L.hop.a)], [L.D, P.z[n - 1], L.hB, shortName(L.hop.b)]]) {
    g.strokeStyle = th.ink; g.lineWidth = 3; g.beginPath(); g.moveTo(c.X(x), c.Y(gnd)); g.lineTo(c.X(x), c.Y(ant)); g.stroke(); c.dot(x, ant, 4, th.sig, th.panel);
    c.text(`${nm} ${f1(ant - (x ? L.B.ground : L.A.ground), 0)} m`, c.X(x) + (x ? -6 : 6), c.Y(ant) - 10, { align: x ? 'right' : 'left', size: 12, weight: 600, halo: true }); }
  // edges
  for (const e of L.diff.edges) { const km = e.km != null ? e.km : d[e.idx]; if (!(km > 0)) continue; const i = Math.min(n - 1, Math.round(km / L.D * (n - 1)));
    const y = terK(i); g.strokeStyle = e.J > 0 ? th.red : th.ink3; g.lineWidth = 1.5; g.setLineDash([2, 2]); g.beginPath(); g.moveTo(c.X(km), c.Y(y)); g.lineTo(c.X(km), c.Y(ray(i))); g.stroke(); g.setLineDash([]);
    c.dot(km, y, 4, e.J > 0 ? th.red : th.ink3); c.text(`ν = ${f1(e.nu, 2)}${e.J > 0 ? `, J = ${f1(e.J, 1)} dB` : ''}`, c.X(km) + 6, c.Y(y) - 9, { size: 11.5, color: e.J > 0 ? th.red : th.ink2, halo: true }); }
  // worst point
  const wi = G.minIdx; c.dot(d[wi], terK(wi), 3.5, th.panel, th.ink);
  c.legend([{ label: 'Line of sight', color: th.sig, width: 2.2 }, { label: 'First Fresnel zone', color: Plot.alpha(th.sig, .4), fill: true }, { label: '0.6 F1', color: th.sig2, dash: [6, 4] },
    ...(curved ? [] : [{ label: `Terrain at kₑ = ${f1(L.ke, 2)}`, color: th.amber, dash: [5, 4] }])], c.px0 + 8, c.py1 + 12);
  // hover
  if (c.inPlot(c.mouse)) { const km = c.ix(c.mouse.x), i = Math.max(0, Math.min(n - 1, Math.round(km / L.D * (n - 1))));
    g.strokeStyle = Plot.alpha(th.ink, 0.4); g.lineWidth = 1; g.beginPath(); g.moveTo(c.X(d[i]), c.py1); g.lineTo(c.X(d[i]), c.py0); g.stroke();
    const nu = (terK(i) - ray(i)) * (i > 0 && i < n - 1 ? RF.nuFactor(d[i], L.D - d[i], L.lam) : 0);
    const lines = [`${f1(d[i], 3)} km from ${shortName(L.hop.a)}`, `Ground ${f1(P.z[i], 1)} m, bulge ${f1(bul(i), 2)} m`, `Ray ${f1(G.los[i], 1)} m, F1 ${f1(G.r1[i], 2)} m`, `Clearance ${f1(G.clr[i], 1)} m = ${f1(G.ratio[i], 2)} F1`, `ν = ${f1(nu, 2)}`];
    const bx = Math.min(c.X(d[i]) + 10, c.px1 - 210), by = c.py1 + 34; g.fillStyle = Plot.alpha(th.panel, 0.94); g.strokeStyle = th.rule; g.fillRect(bx, by, 200, lines.length * 17 + 10); g.strokeRect(bx + .5, by + .5, 200, lines.length * 17 + 10);
    lines.forEach((t, k) => c.text(t, bx + 8, by + 13 + k * 17, { size: 12, weight: k ? 500 : 600 })); }
}
function drawClearance(c, g, th) {
  const L = LINK, d = Array.from(L.prof.d), r43 = Array.from(L.geoK.ratio), rke = Array.from(L.geoKe.ratio);
  const inner = (a) => a.slice(1, -1), lo = Math.min(-1, Math.floor(Math.min(...inner(rke)))), hi = Math.max(2, Math.min(8, Math.ceil(Math.max(...inner(r43)) * 0.6)));
  c.frame({ x: [0, L.D], y: [lo, hi], xlabel: 'Distance (km)', ylabel: 'h / F1' });
  c.clip(); g.fillStyle = Plot.alpha(th.red, 0.08); g.fillRect(c.px0, c.Y(0), c.px1 - c.px0, c.py0 - c.Y(0));
  for (const [v, lab] of [[1, '1.0 F1'], [0.6, '0.6 F1'], [0.3, '0.3 F1'], [0, 'grazing']]) c.hline(v, { color: v === 0 ? th.red : th.ink3, label: lab, right: true });
  c.line(inner(d), inner(rke), { color: th.amber, width: 1.5 }); c.line(inner(d), inner(r43), { color: th.sig, width: 2 }); c.unclip();
  c.legend([{ label: `K = ${S.g.k.toFixed(2)}`, color: th.sig }, { label: `kₑ = ${f1(L.ke, 2)}`, color: th.amber }]);
}
function drawDiffK(c, g, th) {
  const L = LINK;
  if (!PROF.dk || PROF.dk.L !== L) { const Ks = []; for (let i = 0; i <= 50; i++) Ks.push(0.35 * Math.pow(4.5 / 0.35, i / 50));
    const res = { knife: [], deygout: [], bullington: [] };
    for (const K of Ks) { const y = RF.effHeights(L.prof, K, S.g.clutter); res.knife.push(RF.knifeEdge(L.prof, y, L.hA, L.hB, L.lam).L); res.deygout.push(RF.deygout(L.prof, y, L.hA, L.hB, L.lam).L); res.bullington.push(RF.bullington(L.prof, y, L.hA, L.hB, L.lam).L); }
    PROF.dk = { L, Ks, res }; }
  const { Ks, res } = PROF.dk, mx = Math.max(6, ...res.deygout, ...res.bullington);
  c.frame({ x: [0.35, 4.5], xlog: true, y: [0, Math.ceil(mx / 5) * 5], xlabel: 'Effective Earth-radius factor K', ylabel: 'Loss (dB)', xticks: [0.4, 0.5, 0.67, 1, 1.33, 2, 3, 4], xfmt: v => String(v) });
  c.clip(); c.vline(S.g.k, { color: th.sig, label: 'median' }); c.vline(L.ke, { color: th.amber, label: 'kₑ' });
  c.line(Ks, res.knife, { color: th.ink3, width: 1.5, dash: [4, 3] }); c.line(Ks, res.deygout, { color: th.sand, width: 2 }); c.line(Ks, res.bullington, { color: th.sig, width: 2 }); c.unclip();
  c.legend([{ label: 'Bullington', color: th.sig }, { label: 'Deygout', color: th.sand }, { label: 'Knife edge', color: th.ink3, dash: [4, 3] }], c.px0 + 70, c.py1 + 12);
}
function renderProfSide() {
  const L = LINK, cr = $('#profCrit'), w = $('#profWork'), c2 = S.g.obstacle === 'single' ? 0 : 0.3;
  const pass = b => h('span', { class: 'chip ' + (b ? 'pass' : 'fail') }, b ? 'Pass' : 'Fail');
  cr.innerHTML = ''; cr.append(h('h3', {}, 'ITU-R P.530 clearance test'), h('p', { class: 'cap' }, 'Step 1 sizes masts for the median atmosphere; step 3 for the 99.9 % worst-month sub-refractive kₑ. The larger height governs.'),
    h('div', { class: 'tw' }, h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Check'), h('th', {}, 'Needs'), h('th', {}, 'Has'), h('th', {}, '')),
      h('tr', {}, h('td', {}, `Step 1, K = ${S.g.k.toFixed(2)}`), h('td', {}, `${S.g.clr1} F1`), h('td', {}, f1(L.geoK.minRatio, 2) + ' F1'), h('td', {}, pass(L.clr.rule1))),
      h('tr', {}, h('td', {}, `Step 3, kₑ = ${f1(L.ke, 2)}`), h('td', {}, `${c2} F1`), h('td', {}, f1(L.geoKe.minRatio, 2) + ' F1'), h('td', {}, pass(L.clr.rule2))),
      h('tr', {}, h('td', {}, 'Optical line of sight'), h('td', {}, '> 0 m'), h('td', {}, f1(L.geoK.minClr, 1) + ' m'), h('td', {}, pass(L.geoK.losClear))))),
    h('h3', { style: 'margin-top:12px' }, 'Diffraction loss by method'),
    h('div', { class: 'tw' }, h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Method'), h('th', {}, `K ${S.g.k.toFixed(2)}`), h('th', {}, `kₑ ${f1(L.ke, 2)}`)),
      ...[['bullington', 'Bullington'], ['deygout', 'Deygout + correction'], ['knife', 'Single knife edge']].map(([k, n]) => {
        const y = RF.effHeights(L.prof, L.ke, S.g.clutter), lk = k === 'knife' ? RF.knifeEdge(L.prof, y, L.hA, L.hB, L.lam).L : k === 'deygout' ? RF.deygout(L.prof, y, L.hA, L.hB, L.lam).L : RF.bullington(L.prof, y, L.hA, L.hB, L.lam).L;
        return h('tr', { class: S.g.diffModel === k ? 'sel' : '' }, h('td', {}, n), h('td', {}, f1(L.diffAll[k], 1) + ' dB'), h('td', {}, f1(lk, 1) + ' dB')); }))));
  const i = L.geoK.minIdx, d1 = L.prof.d[i], d2 = L.D - d1, r1 = L.geoK.r1[i], bul = RF.bulge(d1, d2, S.g.k);
  const nuF = RF.nuFactor(d1, d2, L.lam), hh = -L.geoK.clr[i], nu = hh * nuF;
  w.innerHTML = ''; w.append(h('h3', {}, 'Working at the tightest point'), h('p', { class: 'cap' }, `${f1(d1, 3)} km from ${shortName(L.hop.a)}, where clearance is smallest relative to F1.`), h('div', { class: 'work' },
    eq('First Fresnel radius', `${V('r')}<sub>1</sub> = 17.32 ${SQ(FR(V('d') + '<sub>1</sub>' + V('d') + '<sub>2</sub>', V('f') + V('D')))} = 17.32 ${SQ(FR(`${f1(d1, 3)}·${f1(d2, 3)}`, `${f1(L.fGHz, 3)}·${f1(L.D, 3)}`))} = ${B(f1(r1, 2) + ' m')}`),
    eq('Earth bulge (effective radius KR)', `${V('b')} = ${FR(V('d') + '<sub>1</sub>' + V('d') + '<sub>2</sub>', '12.74 ' + V('K'))} = ${FR(`${f1(d1, 3)}·${f1(d2, 3)}`, `12.74·${S.g.k.toFixed(3)}`)} = ${B(f1(bul, 2) + ' m')}`),
    eq('Fresnel–Kirchhoff parameter', `${V('ν')} = ${V('h')} ${SQ(FR('2', V('λ')) + '(' + FR('1', V('d') + '<sub>1</sub>') + ' + ' + FR('1', V('d') + '<sub>2</sub>') + ')')} = ${f1(hh, 2)} × ${f1(nuF, 4)} = ${B(f1(nu, 3))}`),
    eq('Knife-edge loss, P.526 eq. 31', `${V('J')}(${V('ν')}) = 6.9 + 20 log<sub>10</sub>[${SQ('(' + V('ν') + '−0.1)<sup>2</sup>+1')} + ${V('ν')} − 0.1] = ${B(f1(RF.J(nu), 2) + ' dB')}` + (nu <= -0.78 ? ' &nbsp;(ν ≤ −0.78 → 0 dB)' : '')),
    eq('Bullington with correction', `${V('L')}<sub>b</sub> = ${V('L')}<sub>uc</sub> + [1 − e<sup>−${V('L')}<sub>uc</sub>/6</sup>](10 + 0.02${V('d')}) = ${B(f1(L.diffAll.bullington, 2) + ' dB')}`)));
}

/* =====================================================================
   LINK BUDGET
   ===================================================================== */
const LB = { dir: 'ab', mcs: null };
let LBT;
regTab('budget', () => {
  const pane = $('#pane-budget'); pane.classList.add('g-main-side');
  const dirSeg = h('div', { class: 'seg', id: 'lbDir' });
  const wf = chartCard('Link budget cascade', 'Every gain and loss from transmitter output to receiver input, at the selected modulation. Tick marks show sensitivity and the noise floor.', { aspect: 2.3, top: h('div', { class: 'row', style: 'margin-bottom:6px' }, dirSeg, h('select', { id: 'lbMcs', 'aria-label': 'Modulation' })) }, drawWaterfall);
  const lad = chartCard('Modulation ladder', 'Received level against each modulation’s sensitivity at this channel width. The gap is the fade margin; shaded rungs keep the design margin.', { aspect: 2.5 }, drawLadder);
  const tbl = h('div', { class: 'card' }, h('h3', {}, 'Per-modulation table'), h('div', { class: 'tw', id: 'lbTable' }));
  const side = h('div', { class: 'stack' }, h('div', { class: 'card', id: 'lbEirp' }), h('div', { class: 'card', id: 'lbWork' }));
  pane.append(h('div', { class: 'stack' }, wf, lad, tbl), side); LBT = { wf, lad };
  $('#lbMcs').addEventListener('change', e => { LB.mcs = +e.target.value; renderBudget(); });
}, renderBudget);
function lbDir() { const L = LINK; return LB.dir === 'ab' ? { d: L.ab, from: L.hop.a, to: L.hop.b, m: L.design.ab, Gt: L.GA, Gr: L.GB, Gtm: L.GAmax } : { d: L.ba, from: L.hop.b, to: L.hop.a, m: L.design.ba, Gt: L.GB, Gr: L.GA, Gtm: L.GBmax }; }
function renderBudget() {
  const L = LINK, seg = $('#lbDir'); seg.innerHTML = '';
  for (const k of ['ab', 'ba']) seg.append(h('button', { 'aria-pressed': LB.dir === k, onclick: () => { LB.dir = k; renderBudget(); } }, k === 'ab' ? `${shortName(L.hop.a)} → ${shortName(L.hop.b)}` : `${shortName(L.hop.b)} → ${shortName(L.hop.a)}`));
  const D = lbDir(), M = L.radio.mcs.length; if (LB.mcs == null || LB.mcs >= M || LB.lastLink !== L.hop) { LB.mcs = Math.max(0, D.m); LB.lastLink = L.hop; }
  const ms = $('#lbMcs'); ms.innerHTML = ''; L.radio.mcs.forEach((x, i) => ms.append(h('option', { value: i, selected: i === LB.mcs }, `${x.n} · ${x.mod}${i === D.m ? ' (design)' : ''}`)));
  LBT.wf.chart.redraw(); LBT.lad.chart.redraw();
  const T = h('table', { class: 't' }, h('tr', {}, ...['Modulation', 'TX dBm', 'EIRP dBm', 'RX dBm', 'Sens. dBm', 'SNR need', 'SNR has', 'Margin dB', 'PHY Mbps', 'Usable Mbps', 'Unavail. min/yr'].map(t => h('th', {}, t))));
  L.radio.mcs.forEach((x, i) => { const mg = D.d.margin[i], u = L.av.U(Math.min(L.ab.margin[i], L.ba.margin[i])).total;
    T.append(h('tr', { class: i === D.m ? 'sel' : '' }, h('td', {}, `${x.n} ${x.mod}`), h('td', {}, f1(D.d.ptx[i])), h('td', {}, f1(D.d.eirp[i])), h('td', {}, fm(D.d.rsl[i])), h('td', {}, fm(D.d.sens[i])),
      h('td', {}, f1(D.d.snrReq[i])), h('td', {}, f1(D.d.snr[i])), h('td', { class: mg >= L.designFM ? 'pos' : mg >= 0 ? 'mid' : 'neg' }, fs(mg)), h('td', {}, f1(D.d.phy[i], 0)), h('td', {}, f1(L.ladder[i].cap, 0)), h('td', {}, u >= 100 ? 'down' : fDur(mins(u))))); });
  $('#lbTable').innerHTML = ''; $('#lbTable').append(T);
  // EIRP box
  const e = $('#lbEirp'); e.innerHTML = '';
  const cap = L.cap, band = L.band;
  e.append(h('h3', {}, 'Regulatory EIRP'), h('p', { class: 'cap' }, band ? `${band.name}: ${band.note}` : 'Channel is outside the listed allocations.'));
  const kv = h('dl', { class: 'kv' });
  for (const [nm, dir, Gm] of [[shortName(L.hop.a), L.ab, L.GAmax], [shortName(L.hop.b), L.ba, L.GBmax]]) {
    kv.append(h('dt', {}, `${nm} EIRP (max)`), h('dd', { class: cap != null && dir.eirp[0] > cap + 1e-6 ? 'neg' : '' }, `${f1(dir.eirp[0])} dBm = ${f1(Math.pow(10, (dir.eirp[0] - 30) / 10), 2)} W`));
    if (dir.backoff > 0) kv.append(h('dt', {}, `${nm} TX back-off`), h('dd', {}, `${f1(dir.backoff)} dB`)); }
  kv.append(h('dt', {}, 'Cap'), h('dd', {}, cap == null ? 'none (licensed / unset)' : `${cap} dBm = ${f1(Math.pow(10, (cap - 30) / 10), 2)} W`));
  e.append(kv);
  if (L.enforce) e.append(h('p', { class: 'note', style: 'margin-top:8px' }, 'With a cap, received level becomes EIRPcap − path loss + Grx − Lrx. Transmit-dish gain no longer helps; receive gain and lower losses still do.'));
  // working
  const m = LB.mcs, w = $('#lbWork'); w.innerHTML = '';
  w.append(h('h3', {}, 'Working'), h('div', { class: 'work' },
    eq('Free-space loss, ITU-R P.525', `${V('L')}<sub>fs</sub> = 32.45 + 20 log ${V('f')}<sub>MHz</sub> + 20 log ${V('d')}<sub>km</sub> = 32.45 + 20 log ${L.fc} + 20 log ${f1(L.D, 3)} = ${B(f1(L.Lfs, 2) + ' dB')}`),
    eq('Gaseous absorption, P.676', `${V('γ')}<sub>o</sub> + ${V('γ')}<sub>w</sub> = ${f1(L.gas.go, 4)} + ${f1(L.gas.gw, 4)} dB/km at ${f1(L.pHpa, 0)} hPa → ${B(f1(L.Lgas, 3) + ' dB')}`),
    eq('Received level', `${V('P')}<sub>rx</sub> = ${V('P')}<sub>tx</sub> + ${V('G')}<sub>t</sub> − ${V('L')}<sub>t</sub> − ${V('L')}<sub>fs</sub> − ${V('L')}<sub>d</sub> − ${V('L')}<sub>gas</sub> + ${V('G')}<sub>r</sub> − ${V('L')}<sub>r</sub><br>= ${f1(D.d.ptx[m])} + ${f1(D.Gt, 2)} − ${f1(D.d.Lt)} − ${f1(L.Lfs, 2)} − ${f1(L.diff.L, 2)} − ${f1(L.Lgas, 2)} + ${f1(D.Gr, 2)} − ${f1(D.d.Lr)} = ${B(fm(D.d.rsl[m]) + ' dBm')}`),
    eq('Thermal noise floor', `${V('N')} = −174 + 10 log ${V('B')} + ${V('NF')} = −174 + 10 log(${L.bw}×10<sup>6</sup>) + ${L.radio.nf} = ${B(fm(L.Nth) + ' dBm')}`),
    eq('Sensitivity at this width', `${V('S')} = ${V('S')}<sub>ref</sub> + 10 log(${FR(V('B'), V('B') + '<sub>ref</sub>')}) + ${V('D')}<sub>I</sub> = ${L.radio.mcs[m].sens} + ${f1(L.bwPen, 2)} + ${f1(L.desense, 2)} = ${B(fm(D.d.sens[m]) + ' dBm')}`),
    eq('Fade margin', `${V('FM')} = ${V('P')}<sub>rx</sub> − ${V('S')} = ${B(fs(D.d.margin[m]) + ' dB')} &nbsp;(design needs ${f1(L.designFM, 1)} dB)`),
    eq('Usable throughput', `${V('C')} = ${V('η')} · ${V('N')}<sub>ss</sub>${V('N')}<sub>sd</sub>${V('b')}${V('R')} / ${V('T')}<sub>sym</sub> = ${L.eff} × ${f1(D.d.phy[m], 1)} = ${B(fMb(L.ladder[m].cap))}`)));
}
function drawWaterfall(c, g, th) {
  const L = LINK, D = lbDir(), m = LB.mcs ?? 0, d = D.d;
  const steps = [['TX power', d.ptx[m], 'abs'], ['TX antenna', D.Gt, 'up'], ['TX feeder', -d.Lt, 'dn'], ['Free space', -L.Lfs, 'dn'], ['Diffraction', -L.diff.L, 'dn'], ['Gases', -L.Lgas, 'dn'], ['Other', -S.g.miscLoss, 'dn'], ['RX antenna', D.Gr, 'up'], ['RX feeder', -d.Lr, 'dn'], ['Received', d.rsl[m], 'abs']];
  let run = 0; const bars = steps.map(([n, v, k]) => { const a = k === 'abs' ? 0 : run, b = k === 'abs' ? v : run + v; if (k !== 'abs' || n === 'TX power') run = b; return { n, a, b, v, k }; });
  const lo = Math.min(L.Nth, d.sens[m], d.rsl[m]) - 12, hi = Math.max(...bars.map(b => Math.max(b.a, b.b))) + 10;
  c.frame({ x: [0, steps.length], y: [lo, hi], xticks: [], ylabel: 'Level (dBm / dB)', m: { b: 44 } });
  const bw = (c.px1 - c.px0) / steps.length;
  bars.forEach((b, i) => {
    const x = c.px0 + bw * (i + .18), w = bw * .64, y0 = c.Y(Math.max(lo, Math.min(b.a, b.b))), y1 = c.Y(Math.max(b.a, b.b));
    g.fillStyle = b.k === 'abs' ? Plot.alpha(th.ink, .85) : b.v >= 0 ? th.sig : Plot.alpha(th.sand, .9);
    if (b.k === 'abs') { const top = c.Y(b.v), base = c.Y(Math.max(lo, Math.min(0, b.v))); g.fillRect(x, Math.min(top, base), w, Math.abs(base - top)); }
    else g.fillRect(x, y1, w, Math.max(1.5, y0 - y1));
    if (i < bars.length - 1) { g.strokeStyle = Plot.alpha(th.ink, .35); g.setLineDash([2, 2]); g.beginPath(); g.moveTo(x + w, c.Y(b.k === 'abs' && i ? b.v : b.b)); g.lineTo(x + bw, c.Y(b.k === 'abs' && i ? b.v : b.b)); g.stroke(); g.setLineDash([]); }
    c.text(b.k === 'abs' ? fm(b.v) : fs(b.v, Math.abs(b.v) < 1 ? 2 : 1), x + w / 2, Math.min(y1, c.Y(b.k === 'abs' ? b.v : b.b)) - 8, { align: 'center', size: 12, weight: 600, halo: true });
    c.text(b.n, x + w / 2, c.py0 + 14, { align: 'center', size: 11.5, color: th.ink2 });
  });
  c.hline(d.sens[m], { color: th.red, dash: [6, 3], label: `Sensitivity ${fm(d.sens[m])} dBm`, right: true });
  c.hline(L.Nth, { color: th.ink3, dash: [2, 3], label: `Noise floor ${fm(L.Nth)} dBm`, right: true });
  const xr = c.px0 + bw * (steps.length - 1 + .5); g.strokeStyle = th.green; g.lineWidth = 2; g.beginPath(); g.moveTo(xr + bw * .36, c.Y(d.rsl[m])); g.lineTo(xr + bw * .36, c.Y(d.sens[m])); g.stroke();
  c.text(`${fs(d.margin[m])} dB`, xr + bw * .36 - 4, (c.Y(d.rsl[m]) + c.Y(d.sens[m])) / 2, { align: 'right', size: 12, weight: 600, color: d.margin[m] >= L.designFM ? th.green : th.red, halo: true });
}
function drawLadder(c, g, th) {
  const L = LINK, D = lbDir(), d = D.d, M = L.radio.mcs.length;
  const lo = Math.min(...d.sens, ...d.rsl) - 6, hi = Math.max(...d.rsl, ...d.sens) + 8;
  c.frame({ x: [-0.5, M - 0.5], y: [lo, hi], xticks: L.radio.mcs.map((_, i) => i), xfmt: i => L.radio.mcs[i].n, ylabel: 'dBm', m: { b: 40 } });
  const bw = (c.px1 - c.px0) / M;
  for (let i = 0; i < M; i++) { const x = c.X(i), ok = d.margin[i] >= L.designFM;
    g.fillStyle = Plot.alpha(ok ? th.sig : d.margin[i] >= 0 ? th.amber : th.red, ok ? 0.22 : 0.12); g.fillRect(x - bw * .32, c.Y(d.rsl[i]), bw * .64, c.Y(d.sens[i]) - c.Y(d.rsl[i]));
    g.fillStyle = th.red; g.fillRect(x - bw * .36, c.Y(d.sens[i]) - 1, bw * .72, 2.5);
    g.fillStyle = th.sig; g.fillRect(x - bw * .36, c.Y(d.rsl[i]) - 1, bw * .72, 2.5);
    c.text(fs(d.margin[i]), x, Math.min(c.Y(d.rsl[i]), c.Y(d.sens[i])) - 9, { align: 'center', size: 11.5, weight: 600, color: ok ? th.green : d.margin[i] >= 0 ? th.amber : th.red, halo: true });
    c.text(`${f1(L.ladder[i].cap, 0)}`, x, c.py0 + 24, { align: 'center', size: 10.5, color: th.ink3 }); }
  c.legend([{ label: 'Received level', color: th.sig, width: 3 }, { label: 'Sensitivity', color: th.red, width: 3 }, { label: `Keeps ${f1(L.designFM, 1)} dB`, color: Plot.alpha(th.sig, .3), fill: true }]);
}

/* =====================================================================
   FADING & AVAILABILITY
   ===================================================================== */
let FAD;
regTab('fade', () => {
  const pane = $('#pane-fade'); pane.classList.add('g-two');
  const ex = chartCard('Fade-depth exceedance', 'Probability that fading exceeds a depth A. Multipath uses the P.530 full-range method; rain uses P.530 with P.838 coefficients. Dotted verticals are each modulation’s margin.', { aspect: 1.55 }, drawExceed);
  const ca = chartCard('Capacity against availability', 'With adaptive modulation the link trades throughput for time. Read the capacity you can guarantee for a given percentage of the year.', { aspect: 1.55 }, drawCapAvail);
  const rr = chartCard('Rain specific attenuation', 'γR = k·R^α (ITU-R P.838-3). At 5.8 GHz rain is a minor term; at 11 GHz and above it starts to dominate.', { aspect: 1.55 }, drawRain);
  const tb = h('div', { class: 'card', id: 'fadeWork' });
  pane.append(ex, ca, rr, tb); FAD = { ex, ca, rr };
}, () => { [FAD.ex, FAD.ca, FAD.rr].forEach(c => c.chart.redraw()); renderFadeWork(); });
function drawExceed(c, g, th) {
  const L = LINK, A = []; for (let a = 0; a <= 45; a += 0.25) A.push(a);
  const mpW = A.map(a => L.mp.pw(a)), mpA = A.map(a => L.mp.pAnnual(a)), rn = A.map(a => a <= 0 ? S.g.rainP0 : Math.min(S.g.rainP0, L.rain.pOf(a))), tot = A.map((a, i) => Math.min(100, mpA[i] + rn[i]));
  c.frame({ x: [0, 45], y: [1e-7, 100], ylog: true, xlabel: 'Fade depth A (dB)', ylabel: '% of time exceeded', yfmt: v => v >= 0.01 ? String(+v.toPrecision(2)) : '10' + Plot.sup(Math.round(Math.log10(v))) });
  c.clip();
  const tgt = 100 - S.g.reqAvail; c.hline(tgt, { color: th.ink2, label: `target ${fPct(tgt)} %`, right: true });
  L.ladder.forEach((l, i) => { if (l.margin > 0 && l.margin < 45 && (i === 0 || i === L.ladder.length - 1 || i === L.design.ab)) c.vline(l.margin, { color: i === L.design.ab ? th.sig : th.ink3, dash: [2, 3], label: L.radio.mcs[i].n }); });
  c.line(A, mpW, { color: th.amber, width: 1.5, dash: [5, 3] }); c.line(A, mpA, { color: th.amber, width: 2 }); c.line(A, rn, { color: th.sig2, width: 2 }); c.line(A, tot, { color: th.ink, width: 2.4 });
  c.unclip();
  c.legend([{ label: 'Total (year)', color: th.ink, width: 2.4 }, { label: 'Multipath (year)', color: th.amber }, { label: 'Multipath (worst month)', color: th.amber, dash: [5, 3] }, { label: 'Rain', color: th.sig2 }], c.px0 + 8, c.py0 - 12);
}
function drawCapAvail(c, g, th) {
  const L = LINK, nines = u => -Math.log10(Math.max(1e-12, u / 100));
  const pts = L.ladder.filter(l => l.unavail < 100).map(l => ({ x: nines(l.unavail), y: l.cap, l })).sort((a, b) => a.x - b.x);
  const xmax = Math.max(7, Math.ceil(nines(100 - S.g.reqAvail)) + 2), ymax = Math.max(S.g.reqThroughput * 1.2, ...L.ladder.map(l => l.cap)) * 1.08;
  c.frame({ x: [1, xmax], y: [0, ymax], xlabel: 'Time the capacity is available', ylabel: 'Usable throughput (Mbps)', xticks: Array.from({ length: xmax }, (_, i) => i + 1), xfmt: v => (100 - 100 * Math.pow(10, -v)).toFixed(Math.max(0, v - 2)) + '%' });
  c.clip();
  // envelope: best capacity achievable at availability level x
  const X = [], Y = []; for (let x = 1; x <= xmax; x += 0.01) { let best = 0; for (const p of pts) if (p.x >= x) best = Math.max(best, p.y); X.push(x); Y.push(best); }
  c.area(X, 0, Y, Plot.alpha(th.sig, 0.15)); c.line(X, Y, { color: th.sig, width: 2.2 });
  c.hline(S.g.reqThroughput, { color: th.red, label: `${S.g.reqThroughput} Mbps required` }); c.vline(nines(100 - S.g.reqAvail), { color: th.ink2, label: `${S.g.reqAvail}%` });
  for (const p of pts) { if (p.x > xmax) continue; c.dot(p.x, p.y, 3, th.panel, th.sig); }
  c.unclip();
  const at = (() => { const x = nines(100 - S.g.reqAvail); let best = 0, nm = 'none'; for (const p of pts) if (p.x >= x && p.y > best) { best = p.y; nm = L.radio.mcs[p.l.m].mod; } return { best, nm }; })();
  c.text(`At ${S.g.reqAvail} %: ${f1(at.best, 0)} Mbps (${at.nm})`, c.px1 - 8, c.py1 + 14, { align: 'right', weight: 600, halo: true, color: at.best >= S.g.reqThroughput ? th.green : th.red });
}
function drawRain(c, g, th) {
  const L = LINK, R = []; for (let r = 1; r <= 200; r *= 1.08) R.push(r);
  const fsel = [[L.fGHz, th.sig, `${f1(L.fGHz, 2)} GHz (this hop)`], [11, th.sand, '11 GHz'], [18, th.red, '18 GHz'], [23, th.ink3, '23 GHz']];
  c.frame({ x: [1, 200], xlog: true, y: [1e-3, 20], ylog: true, xlabel: 'Rain rate R (mm/h)', ylabel: 'γR (dB/km)', xticks: [1, 2, 5, 10, 20, 50, 100, 200], xfmt: v => String(v) });
  c.clip(); c.vline(S.g.R001, { color: th.ink2, label: `R₀.₀₁ = ${S.g.R001}` });
  for (const [f, col] of fsel) c.line(R, R.map(r => RF.rainSpecific(f, r, LINK.hop.pol || 'V')), { color: col, width: f === L.fGHz ? 2.4 : 1.4 });
  c.unclip(); c.legend(fsel.map(([f, col, lab]) => ({ label: lab, color: col })), c.px0 + 8, c.py1 + 12);
}
function renderFadeWork() {
  const L = LINK, mp = L.mp, rn = L.rain, w = $('#fadeWork'), U = L.av.U(L.designFM);
  w.innerHTML = ''; w.append(h('h3', {}, 'ITU-R P.530 working'), h('p', { class: 'cap' }, `Latitude ${f1((L.A.lat + L.B.lat) / 2, 2)}°, path ${f1(L.D, 3)} km, ${f1(L.fGHz, 3)} GHz, ${({ V: 'vertical', H: 'horizontal', C: 'dual/slant' })[L.hop.pol || 'V']} polarisation.`), h('div', { class: 'work' },
    eq('Geoclimatic factor', `${V('K')} = 10<sup>−4.4 − 0.0027 d${V('N')}<sub>1</sub></sup>(10 + ${V('s')}<sub>a</sub>)<sup>−0.46</sup> = 10<sup>−4.4 − 0.0027·(${S.g.dN1})</sup>(10 + ${f1(CTX.g.sa, 1)})<sup>−0.46</sup> = ${B(mp.K.toExponential(3))}`),
    eq('Path inclination and lower antenna', `|${V('ε')}<sub>p</sub>| = ${FR('|' + V('h') + '<sub>r</sub> − ' + V('h') + '<sub>e</sub>|', V('d'))} = ${B(f1(mp.ep, 2) + ' mrad')}, &nbsp; ${V('h')}<sub>L</sub> = ${B(f1(mp.hL, 0) + ' m')}`),
    eq('Multipath occurrence factor (worst month)', `${V('p')}<sub>0</sub> = ${V('K')}${V('d')}<sup>3.1</sup>(1+|${V('ε')}<sub>p</sub>|)<sup>−1.29</sup>${V('f')}<sup>0.8</sup>10<sup>−0.00089${V('h')}<sub>L</sub></sup> = ${B(fPct(mp.p0) + ' %')}`),
    eq('Deep-fade transition and annual conversion', `${V('A')}<sub>t</sub> = 25 + 1.2 log ${V('p')}<sub>0</sub> = ${B(f1(mp.At, 1) + ' dB')}, &nbsp; Δ${V('G')} = ${B(f1(mp.dG, 2) + ' dB')}`),
    eq('Rain: specific attenuation and path reduction', `${V('γ')}<sub>R</sub> = ${rn.k.toExponential(3)} · ${S.g.R001}<sup>${f1(rn.a, 3)}</sup> = ${B(f1(rn.gamma, 3) + ' dB/km')}, &nbsp; ${V('r')} = ${B(f1(rn.r, 3))}, &nbsp; ${V('d')}<sub>eff</sub> = ${B(f1(rn.deff, 2) + ' km')}`),
    eq('Rain fade exceeded 0.01 % of the year', `${V('A')}<sub>0.01</sub> = ${V('γ')}<sub>R</sub>${V('d')}<sub>eff</sub> = ${B(f1(rn.A001, 2) + ' dB')}, &nbsp; ${FR(V('A') + '<sub>p</sub>', V('A') + '<sub>0.01</sub>')} = ${f1(rn.C1, 4)}${V('p')}<sup>−(${f1(rn.C2, 3)} + ${f1(rn.C3, 4)} log ${V('p')})</sup>`),
    eq(`Outage at the ${f1(L.designFM, 1)} dB design margin`, `${V('U')} = ${fPct(U.mp)} % (multipath) + ${fPct(U.rain)} % (rain) = ${B(fDur(mins(U.total)) + ' per year')}`),
    eq('Margin needed for the availability target alone', `${V('FM')}<sub>prop</sub> = ${B(f1(L.propFM, 2) + ' dB')} for ${S.g.reqAvail} % &nbsp;(engineering allowance ${S.g.minFM} dB governs if larger)`)));
}
