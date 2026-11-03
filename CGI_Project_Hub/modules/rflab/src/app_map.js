/* =====================================================================
   NETWORK MAP — 2D communications map (planning-tool conventions)
   ===================================================================== */
let MAP = null;
const COV = { data: null, running: false, key: null, stats: null, prog: 0 };
const RSSI_BANDS = [[-50, '#1a9850', 'above −50'], [-60, '#66bd63', '−50 to −60'], [-67, '#a6d96a', '−60 to −67'], [-72, '#fee08b', '−67 to −72'], [-78, '#fdae61', '−72 to −78'], [-Infinity, '#f46d43', '−78 to sensitivity']];
const THR_COLS = ['#1a9850', '#66bd63', '#a6d96a', '#fee08b', '#fdae61', '#f46d43'];
const CLR_BANDS = [[1, '#1a9850', '≥ 1.0 F1'], [0.6, '#66bd63', '0.6–1.0 F1'], [0.3, '#fee08b', '0.3–0.6 F1'], [0, '#fdae61', '0–0.3 F1'], [-0.5, '#f46d43', 'grazing to −0.5 F1'], [-Infinity, '#d73027', 'obstructed']];
const ST_VAR = { ok: '--green', warn: '--amber', bad: '--red' };
const dirMarginAtReq = (L, dir) => L.reqMcs < 0 ? -Infinity : dir.margin[L.reqMcs];
const stOf = (m, L) => m >= L.designFM ? 'ok' : m >= 0 ? 'warn' : 'bad';
function hopStatus(L) {
  if (!(L.clear.cap.agg > 0)) return 'bad';
  const a = stOf(dirMarginAtReq(L, L.ab), L), b = stOf(dirMarginAtReq(L, L.ba), L);
  return [a, b].includes('bad') ? 'bad' : [a, b].includes('warn') ? 'warn' : 'ok';
}
const loadCol = u => u < 0.5 ? '#1a9850' : u < 0.7 ? '#91cf60' : u < 0.85 ? '#fee08b' : u < 1 ? '#fc8d59' : '#d73027';
const rsslCol = r => { for (const [t, c] of RSSI_BANDS) if (r >= t) return c; return '#f46d43'; };
const mapLinks = () => { const a = NET.links.map((L, i) => ({ L, i })); if (S.sel === 'custom' && LINK) a.push({ L: LINK, i: 'custom' }); return a; };

regTab('map', initMap, () => { if (MAP) { buildMapPanel(); drawMap(); } });
function initMap() {
  const pane = $('#pane-map');
  const cv = h('canvas', { class: 'mapcv', 'aria-label': 'Communications map of the Molepolole radio network with terrain relief, links and coverage prediction' });
  const tip = h('div', { class: 'tip' }), panel = h('div', { class: 'ov tl mapctl', id: 'mapPanel' });
  pane.append(h('div', { class: 'stage flat' }, cv, tip, panel));
  MAP = { cv, ctx: cv.getContext('2d'), tip, cx: 0, cy: 0, s: 30, hits: [], drag: null, ptr: new Map() };
  if (!TEX.map) buildTextures();
  new ResizeObserver(() => { if (!MAP.fitted && cv.clientWidth > 10) { fitMap('network'); MAP.fitted = true; } drawMap(); }).observe(cv);
  const inv = (px, py) => [(px - MAP.W / 2) / MAP.s + MAP.cx, (MAP.H / 2 - py) / MAP.s + MAP.cy];
  cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); MAP.ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY }); MAP.drag = { x: e.offsetX, y: e.offsetY, moved: 0 }; });
  cv.addEventListener('pointermove', e => {
    if (MAP.ptr.has(e.pointerId)) {
      const prev = MAP.ptr.get(e.pointerId); MAP.ptr.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (MAP.ptr.size === 2) { const ps = [...MAP.ptr.values()], o = [...MAP.ptr.entries()].find(([k]) => k !== e.pointerId)[1];
        const d0 = Math.hypot(prev.x - o.x, prev.y - o.y), d1 = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y); if (d0 > 0) zoomAt((ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2, d1 / d0); return; }
      if (MAP.drag) { const dx = e.offsetX - MAP.drag.x, dy = e.offsetY - MAP.drag.y; MAP.drag.x = e.offsetX; MAP.drag.y = e.offsetY; MAP.drag.moved += Math.abs(dx) + Math.abs(dy);
        MAP.cx -= dx / MAP.s; MAP.cy += dy / MAP.s; drawMap(); } return; }
    mapHover(e.offsetX, e.offsetY, inv);
  });
  const up = e => { MAP.ptr.delete(e.pointerId); if (MAP.drag && MAP.drag.moved < 4) mapClick(e.offsetX, e.offsetY); MAP.drag = null; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { tip.style.display = 'none'; });
  cv.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  cv.addEventListener('dblclick', e => zoomAt(e.offsetX, e.offsetY, 1.8));
  buildMapPanel();
  if (!COV.data && !COV.running) runCoverage();
}
function zoomAt(px, py, f) {
  const wx = (px - MAP.W / 2) / MAP.s + MAP.cx, wy = (MAP.H / 2 - py) / MAP.s + MAP.cy;
  MAP.s = Math.max(4, Math.min(3000, MAP.s * f)); MAP.cx = wx - (px - MAP.W / 2) / MAP.s; MAP.cy = wy - (MAP.H / 2 - py) / MAP.s; drawMap();
}
function fitMap(k) {
  const W = MAP.cv.clientWidth || 800, H = MAP.cv.clientHeight || 600;
  let pts = k === 'network' ? [...new Set(mapLinks().flatMap(o => [o.L.hop.a, o.L.hop.b]))].map(id => toXY(CTX.sites[id].lat, CTX.sites[id].lon)) : [toXY(dem.north, dem.west), toXY(dem.south, dem.east)];
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]), pad = k === 'network' ? 2.2 : 0.3;
  const x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad;
  const left = W > 900 ? 300 : 0; // keep clear of the control panel
  MAP.s = Math.min((W - left - 40) / (x1 - x0), (H - 60) / (y1 - y0)); MAP.cx = (x0 + x1) / 2 - left / 2 / MAP.s; MAP.cy = (y0 + y1) / 2;
  MAP.W = W; MAP.H = H; drawMap();
}
function buildMapPanel() {
  const p = $('#mapPanel'); if (!p) return; const open = p.dataset.init ? new Set($$('details', p).filter(d => d.open).map(d => d.dataset.k)) : new Set([]);
  p.dataset.init = 1; p.innerHTML = ''; const mv = S.mapv, cv = S.cov;
  const redraw = () => { save(); drawMap(); };
  const mt = (k, label) => { const i = h('input', { type: 'checkbox', checked: !!mv[k] }); i.addEventListener('change', () => { mv[k] = i.checked; redraw(); }); return h('label', { class: 'tog' }, i, label); };
  const ms = (obj, k, label, opts, after) => { const s = h('select', { 'aria-label': label }, opts.map(([v, t]) => h('option', { value: v, selected: String(obj[k]) === String(v) }, t)));
    s.addEventListener('change', () => { obj[k] = isNaN(+s.value) || s.value === '' ? s.value : +s.value; after ? after() : redraw(); }); return h('label', { class: 'f' }, h('span', {}, label), s); };
  const mn = (obj, k, label, unit, step, after) => { const i = h('input', { type: 'number', value: obj[k], step }); i.addEventListener('change', () => { const v = +i.value; if (isFinite(v)) { obj[k] = v; after ? after() : redraw(); } }); return h('label', { class: 'f' }, h('span', {}, label, h('span', { class: 'u' }, ' ' + unit)), i); };
  const lay = h('details', { open: open.has('lay') }, h('summary', {}, 'Map layers'), h('div', { class: 'in' },
    ms(mv, 'base', 'Base map', [['relief', 'Relief and contours'], ['plain', 'Plain']]),
    ms(mv, 'linkColor', 'Link colouring', [['margin', 'Fade margin at requirement'], ['load', 'Load against requirement'], ['rsl', 'Received level']]),
    mt('network', 'Telemetry network register'), mt('grid', 'Graticule'), mt('beams', 'Antenna beams'), mt('labels', 'Link labels'), mt('others', 'Other sites'),
    h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => fitMap('network') }, 'Fit network'), h('button', { class: 'btn sm', onclick: () => fitMap('dem') }, 'Fit terrain'))));
  lay.dataset.k = 'lay';
  const stale = COV.data && COV.key !== covKey();
  const ant = RF.ANTENNAS[cv.ant];
  const covBox = h('details', { open: open.has('cov') }, h('summary', {}, 'Coverage prediction'), h('div', { class: 'in' },
    ms(cv, 'layer', 'Display', [['thr', 'Throughput'], ['rsl', 'Received level'], ['clear', 'Fresnel clearance'], ['los', 'Line of sight'], ['none', 'Off']], () => { save(); paintOverlay(); }),
    ms(cv, 'tx', 'Transmitter', siteOpts(), () => { save(); buildMapPanel(); }),
    ms(cv, 'ant', 'TX antenna', antOpts(), () => { save(); buildMapPanel(); }),
    ant.type !== 'omni' ? mn(cv, 'az', 'Azimuth', '°', 1, () => { save(); buildMapPanel(); }) : null,
    mn(cv, 'tilt', 'Downtilt', '°', 0.5, () => { save(); buildMapPanel(); }),
    ms(cv, 'radio', 'Radio', radioOpts(), () => { const r = RF.RADIOS[cv.radio]; if (!r.bws.includes(cv.bw)) cv.bw = r.bws[Math.min(1, r.bws.length - 1)]; if (cv.fc < r.band[0] || cv.fc > r.band[1]) cv.fc = Math.round((r.band[0] + r.band[1]) / 2); save(); buildMapPanel(); }),
    mn(cv, 'fc', 'Centre frequency', 'MHz', 5, () => { save(); buildMapPanel(); }),
    ms(cv, 'bw', 'Channel width', RF.RADIOS[cv.radio].bws.map(b => [b, bwLab(b)]), () => { save(); buildMapPanel(); }),
    mn(cv, 'rxH', 'Receiver height', 'm', 1, () => { save(); buildMapPanel(); }),
    ms(cv, 'rxAnt', 'RX antenna (aligned)', antOpts(), () => { save(); buildMapPanel(); }),
    ms(cv, 'res', 'Resolution', [[5, 'Draft, 150 m'], [3, 'Standard, 90 m'], [2, 'Fine, 60 m']], () => { save(); buildMapPanel(); }),
    h('div', { class: 'row' }, h('button', { class: 'btn pri sm', disabled: COV.running, onclick: runCoverage }, COV.running ? 'Predicting…' : 'Run prediction'), h('div', { class: 'prog' }, h('i', { id: 'covProg', style: `width:${COV.running ? COV.prog * 100 : 0}%` }))),
    stale ? h('p', { class: 'note', style: 'color:var(--amber)' }, 'Inputs changed since the last prediction.') : null,
    COV.stats ? h('p', { class: 'note' }, COV.stats) : null,
    h('p', { class: 'note' }, 'Each cell gets its own terrain profile with Bullington diffraction, gases and the regulatory EIRP cap.')));
  covBox.dataset.k = 'cov';
  p.append(lay, covBox);
}
const covKey = () => JSON.stringify([S.cov, S.mounts, S.g, S.caps]);
async function runCoverage() {
  if (COV.running) return; COV.running = true; COV.prog = 0; buildMapPanel();
  const cfg = { ...S.cov }, ctx = makeCtx(), tx = ctx.sites[cfg.tx], ant = RF.ANTENNAS[cfg.ant], rxAnt = RF.ANTENNAS[cfg.rxAnt], radio = RF.RADIOS[cfg.radio];
  const st = cfg.res, nx = Math.floor((dem.w - 1) / st) + 1, ny = Math.floor((dem.h - 1) / st) + 1, fc = cfg.fc, fGHz = fc / 1000, lam = RF.lambda(fc);
  const rsl = new Float32Array(nx * ny).fill(NaN), ratio = new Float32Array(nx * ny).fill(NaN);
  const K = ctx.g.k, Re = K * RF.RE, hts = tx.ground + tx.mount, Gm = RF.antGainMax(ant, fc), Gr = RF.antGainMax(rxAnt, fc);
  const band = RF.findBand(ctx.bands, fc, cfg.bw), cap = band ? band.cap : null, enforce = ctx.g.enforceEirp && cap != null;
  const ptx = radio.mcs.map(m => { let p = m.tx; if (enforce) p = Math.min(p, cap - Gm + 0.5); return Math.max(p, radio.minTx); });
  const gas = RF.gasSpecific(fGHz, RF.pressureAt(tx.ground), ctx.g.tempC, ctx.g.rho).g;
  const P = { d: new Float64Array(600), z: null, D: 0, n: 0 }, Y = new Float64Array(600), spKm = st * 0.03;
  const pAz = cfg.az, pEl = -cfg.tilt;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const lat = dem.north - j * st * dem.step, lon = dem.west + i * st * dem.step, d = RF.distKm(tx.lat, tx.lon, lat, lon), k = j * nx + i;
      if (d < 0.05) { rsl[k] = -20; ratio[k] = 99; continue; }
      const n = Math.max(8, Math.min(600, Math.ceil(d / spKm) + 1)); P.D = d; P.n = n;
      for (let q = 0; q < n; q++) { const f = q / (n - 1), dq = f * d; P.d[q] = dq; Y[q] = dem.elev(tx.lat + f * (lat - tx.lat), tx.lon + f * (lon - tx.lon)) + (q > 0 && q < n - 1 ? dq * (d - dq) / (12.742 * K) + ctx.g.clutter : 0); }
      const hrs = Y[n - 1] + cfg.rxH; let mr = Infinity;
      for (let q = 1; q < n - 1; q++) { const r1 = 17.3205 * Math.sqrt(P.d[q] * (d - P.d[q]) / (fGHz * d)), los = hts + (hrs - hts) * P.d[q] / d, rr = (los - Y[q]) / r1; if (rr < mr) mr = rr; }
      const Lb = RF.bullington(P, Y, hts, hrs, lam).L;
      const el = Math.atan(((hrs - hts) - d * d * 1e6 / (2 * Re * 1000)) / (d * 1000)) * 180 / Math.PI, az = RF.bearing(tx.lat, tx.lon, lat, lon);
      const Gt = RF.antGain(ant, fc, az, el, pAz, pEl);
      rsl[k] = ptx[0] + Gt - 0.5 - RF.fspl(fc, d) - Lb - gas * d - ctx.g.miscLoss + Gr - 0.5; ratio[k] = mr;
    }
    if (j % 4 === 3) { COV.prog = j / ny; const pb = $('#covProg'); if (pb) pb.style.width = (COV.prog * 100) + '%'; await new Promise(r => setTimeout(r, 0)); }
  }
  const Nth = -174 + RF.db(cfg.bw * 1e6) + radio.nf, des = ctx.g.interf == null ? 0 : RF.db(1 + RF.undb(ctx.g.interf - Nth));
  const sens = radio.mcs.map(m => m.sens + RF.db(cfg.bw / radio.bwRef) + des), phy = radio.mcs.map((_, m) => radio.phy(m, cfg.bw));
  COV.data = { nx, ny, st, rsl, ratio, sens, ptx, phy, eff: radio.eff.ptp, cfg, txName: tx.short, rxAnt: rxAnt.name };
  COV.key = covKey(); COV.running = false; paintOverlay(); buildMapPanel();
}
function covCap(D, k) {
  const r = D.rsl[k]; if (!isFinite(r)) return NaN; let best = -1;
  for (let m = 0; m < D.sens.length; m++) if (r - (D.ptx[0] - D.ptx[m]) - D.sens[m] >= (D.cfg.fm ? S.g.minFM : 0)) best = m;
  return best < 0 ? 0 : D.eff * D.phy[best];
}
function paintOverlay() {
  const D = COV.data; if (!D) return; const layer = S.cov.layer;
  if (layer === 'none') { TEX.overlay = null; composeTextures(); drawMap(); return; }
  const cv = document.createElement('canvas'); cv.width = D.nx; cv.height = D.ny; const g = cv.getContext('2d'), img = g.createImageData(D.nx, D.ny);
  const req = S.g.reqThroughput, cellKm2 = (D.st * dem.step * KX) * (D.st * dem.step * KY); let served = 0, full = 0;
  for (let k = 0; k < D.rsl.length; k++) {
    let col = null; const r = D.rsl[k];
    if (layer === 'rsl') { if (r >= D.sens[0]) col = rsslCol(r); }
    else if (layer === 'thr') { const c = covCap(D, k); if (c > 0) { served++; if (c >= req) full++; col = THR_COLS[c >= req ? 0 : c >= 0.75 * req ? 1 : c >= 0.5 * req ? 2 : c >= 0.25 * req ? 3 : c >= 0.1 * req ? 4 : 5]; } }
    else if (layer === 'clear') { const v = D.ratio[k]; for (const [t, c] of CLR_BANDS) if (v >= t) { col = c; break; } }
    else if (layer === 'los') col = D.ratio[k] > 0 ? '#1a9850' : '#d73027';
    if (col) { const [R, G, Bc] = hexRGB(col); img.data.set([R, G, Bc, layer === 'los' ? 150 : 215], k * 4); }
  }
  g.putImageData(img, 0, 0); TEX.overlay = cv; TEX.overlayStep = D.st;
  if (layer === 'thr') COV.stats = `${D.txName}: ${f1(full * cellKm2, 1)} km² at or above ${req} Mbps, ${f1(served * cellKm2, 1)} km² with any service (receiver ${D.cfg.rxH} m, ${D.rxAnt}).`;
  composeTextures(); drawMap(); const pnl = $('#mapPanel'); if (pnl && !COV.running) { const n = pnl.querySelector('.in p.note:nth-last-child(2)'); }
}
/* ---------- drawing ---------- */
const DMS = (v, isLat, stepMin) => { const a = Math.abs(v), d = Math.floor(a + 1e-9), m = (a - d) * 60; return `${d}°${m.toFixed(stepMin < 1 ? 1 : 0).padStart(stepMin < 1 ? 4 : 2, '0')}′${isLat ? (v < 0 ? 'S' : 'N') : (v < 0 ? 'W' : 'E')}`; };
function drawMap() {
  if (!MAP || S.tab !== 'map') return; const cv = MAP.cv, W = cv.clientWidth, H = cv.clientHeight; if (W < 10 || H < 10) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1); if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = MAP.ctx, th = Plot.T(); g.setTransform(dpr, 0, 0, dpr, 0, 0); MAP.W = W; MAP.H = H; MAP.hits = [];
  const X = x => (x - MAP.cx) * MAP.s + W / 2, Y = y => H / 2 - (y - MAP.cy) * MAP.s, P = (lat, lon) => { const [x, y] = toXY(lat, lon); return [X(x), Y(y)]; };
  g.fillStyle = th.paper; g.fillRect(0, 0, W, H);
  const hs = dem.step / 2, [ax, ay] = toXY(dem.north + hs, dem.west - hs), [bx, by] = toXY(dem.south - hs, dem.east + hs);
  if (S.mapv.base === 'relief' && TEX.map) { g.imageSmoothingEnabled = true; g.drawImage(TEX.map, X(ax), Y(ay), (bx - ax) * MAP.s, (ay - by) * MAP.s); }
  else { g.fillStyle = th.panel; g.fillRect(X(ax), Y(ay), (bx - ax) * MAP.s, (ay - by) * MAP.s); }
  g.strokeStyle = th.rule; g.lineWidth = 1; g.strokeRect(X(ax) + .5, Y(ay) + .5, (bx - ax) * MAP.s, (ay - by) * MAP.s);
  if (TEX.overlay && COV.data && S.cov.layer !== 'none') {
    const st = COV.data.st, o = st * dem.step / 2, [cx0, cy0] = toXY(dem.north + o, dem.west - o), [cx1, cy1] = toXY(dem.north + o - COV.data.ny * st * dem.step, dem.west - o + COV.data.nx * st * dem.step);
    g.globalAlpha = 0.56; g.imageSmoothingEnabled = MAP.s < 60; g.drawImage(TEX.overlay, X(cx0), Y(cy0), (cx1 - cx0) * MAP.s, (cy0 - cy1) * MAP.s); g.globalAlpha = 1; g.imageSmoothingEnabled = true;
  }
  if (S.mapv.grid) drawGraticule(g, th, W, H);
  const links = mapLinks();
  if (S.mapv.beams) for (const { L } of links) for (const end of ['A', 'B']) {
    const s = end === 'A' ? L.A : L.B, ant = end === 'A' ? L.antA : L.antB, p = end === 'A' ? L.pA : L.pB, [sx, sy] = P(s.lat, s.lon);
    if (ant.type === 'omni') { g.setLineDash([4, 4]); g.strokeStyle = Plot.alpha(th.sig, 0.6); g.lineWidth = 1.2; g.beginPath(); g.arc(sx, sy, Math.max(14, 0.9 * MAP.s), 0, 2 * Math.PI); g.stroke(); g.setLineDash([]); continue; }
    const half = Math.max(RF.antHPBW(ant, L.fc).h / 2, 1), len = L.D * 1.12 * MAP.s;
    for (const bz of ant.type === 'bidir' ? [p.az, p.az + 180] : [p.az]) { const a0 = (bz - half) * Math.PI / 180, a1 = (bz + half) * Math.PI / 180;
      const grd = g.createRadialGradient(sx, sy, 0, sx, sy, len); grd.addColorStop(0, Plot.alpha(th.sig, 0.32)); grd.addColorStop(1, Plot.alpha(th.sig, 0));
      g.fillStyle = grd; g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + Math.sin(a0) * len, sy - Math.cos(a0) * len); g.arc(sx, sy, len, a0 - Math.PI / 2, a1 - Math.PI / 2); g.closePath(); g.fill(); }
  }
  // telemetry network register (status styling)
  if (S.mapv.network) for (const R of REGL) { if (R.wec) continue;
    const L = R.L, st = R.st.status, [x1, y1] = P(L.A.lat, L.A.lon), [x2, y2] = P(L.B.lat, L.B.lon), col = Plot.css(LINK_ST[st][1]);
    const sty = { communicating: [[], 5], installed: [[], 4], planned: [[10, 6], 4], recommended: [[2, 6], 4], not_feasible: [[6, 6], 2] }[st];
    g.lineCap = 'round'; g.strokeStyle = Plot.alpha(th.panel, 0.9); g.lineWidth = sty[1] + 4; g.setLineDash(sty[0]); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = st === 'not_feasible' ? Plot.alpha(col, 0.7) : col; g.lineWidth = sty[1]; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); g.setLineDash([]);
    MAP.hits.push({ type: 'reg', R, x1, y1, x2, y2 }); }
  // links (weathermap style: one arrow per direction)
  links.forEach(({ L, i }, n) => {
    const [x1, y1] = P(L.A.lat, L.A.lon), [x2, y2] = P(L.B.lat, L.B.lon), mx = (x1 + x2) / 2, my = (y1 + y2) / 2, isSel = S.sel === i;
    const ln = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / ln, uy = (y2 - y1) / ln, w = isSel ? 8 : 6;
    const dirs = [[L.ab, x1, y1, 1, S.g.duty, L.design.cap.ab], [L.ba, x2, y2, -1, 1 - S.g.duty, L.design.cap.ba]];
    if (isSel) { g.strokeStyle = Plot.alpha(th.sig, 0.28); g.lineWidth = w + 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
    for (const [dir, sx, sy, sg, share, capd] of dirs) {
      let col; const m = dirMarginAtReq(L, dir);
      if (S.mapv.linkColor === 'load') col = capd > 0 ? loadCol(S.g.reqThroughput * share / capd) : '#d73027';
      else if (S.mapv.linkColor === 'rsl') col = rsslCol(dir.rsl[Math.max(0, sg > 0 ? L.design.ab : L.design.ba)]);
      else col = Plot.css(ST_VAR[L.clear.cap.agg > 0 ? stOf(m, L) : 'bad']);
      const ex = mx - ux * sg * (w * 0.9), ey = my - uy * sg * (w * 0.9);
      g.lineCap = 'butt'; g.strokeStyle = th.panel; g.lineWidth = w + 4; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(sx, sy); g.lineTo(ex, ey); g.stroke();
      const hx = mx - ux * sg * 1.5, hy = my - uy * sg * 1.5, bxp = hx - ux * sg * (w * 2.1), byp = hy - uy * sg * (w * 2.1), nx = -uy * (w * 1.15), ny = ux * (w * 1.15);
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(bxp + nx, byp + ny); g.lineTo(bxp - nx, byp - ny); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = th.panel; g.lineWidth = 1.5; g.stroke();
    }
    MAP.hits.push({ type: 'link', i, x1, y1, x2, y2, L });
    if (S.mapv.labels) {
      const side = n % 2 ? 1 : -1, nxp = -uy * side, nyp = ux * side, off = 44;
      const lines = [[hopName(L.hop), 600], [`${f1(L.D, 2)} km, ${L.fc} MHz, ${bwLab(L.bw)}`, 500]];
      if (S.mapv.linkColor === 'load') lines.push([`Load ${f1(100 * S.g.reqThroughput * S.g.duty / Math.max(1e-9, L.design.cap.ab), 0)} % / ${f1(100 * S.g.reqThroughput * (1 - S.g.duty) / Math.max(1e-9, L.design.cap.ba), 0)} %`, 500]);
      else if (S.mapv.linkColor === 'rsl') lines.push([`RSL ${fm(L.ab.rsl[Math.max(0, L.design.ab)])} / ${fm(L.ba.rsl[Math.max(0, L.design.ba)])} dBm`, 500]);
      else lines.push([`FM ${fm(dirMarginAtReq(L, L.ab))} / ${fm(dirMarginAtReq(L, L.ba))} dB at ${S.g.reqThroughput} Mbps`, 500]);
      lines.push([`${fMb(L.design.cap.agg)} at design margin`, 600]);
      const RR = REGL.find(r => r.L === L); if (RR) lines.splice(1, 0, [`Status: ${LINK_ST[RR.st.status][0]}`, 500]);
      g.font = `500 11.5px ${th.ui}`; const bw = Math.max(...lines.map(([t, wt]) => { g.font = `${wt} 11.5px ${th.ui}`; return g.measureText(t).width; })) + 18, bh = lines.length * 15 + 9;
      let bxl = mx + nxp * off - (nxp < -0.3 ? bw : nxp > 0.3 ? 0 : bw / 2), byl = my + nyp * off - (nyp < -0.3 ? bh : nyp > 0.3 ? 0 : bh / 2);
      bxl = Math.max(4, Math.min(W - bw - 4, bxl)); byl = Math.max(4, Math.min(H - bh - 4, byl));
      g.strokeStyle = Plot.alpha(th.ink, 0.5); g.lineWidth = 1; g.beginPath(); g.moveTo(mx, my); g.lineTo(Math.max(bxl, Math.min(bxl + bw, mx)), Math.max(byl, Math.min(byl + bh, my))); g.stroke();
      g.fillStyle = Plot.alpha(th.panel, 0.95); g.fillRect(bxl, byl, bw, bh); g.strokeStyle = isSel ? th.sig : th.rule; g.strokeRect(bxl + .5, byl + .5, bw, bh);
      g.fillStyle = Plot.css(ST_VAR[hopStatus(L)]); g.fillRect(bxl, byl, 4, bh);
      lines.forEach(([t, wt], k) => { g.font = `${wt} 11.5px ${th.ui}`; g.fillStyle = k ? th.ink2 : th.ink; if (k === lines.length - 1) g.fillStyle = th.ink; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, bxl + 11, byl + 12 + k * 15); });
      MAP.hits.push({ type: 'label', i, x: bxl, y: byl, w: bw, h: bh, L });
    }
  });
  // sites
  const used = new Set(links.flatMap(o => [o.L.hop.a, o.L.hop.b])); if (S.mapv.network) REGL.forEach(R => { if (R.st.status !== 'not_feasible') { used.add(R.def.a); used.add(R.def.b); } });
  for (const s of allSites()) {
    const isU = used.has(s.id); if (!isU && !S.mapv.others) continue;
    const c = CTX.sites[s.id], [x, y] = P(c.lat, c.lon); siteGlyph(g, x, y, s.role, isU, th);
    const rs = S.reg.sites[s.id]; if (rs) { g.beginPath(); g.arc(x + 9, y - 9, 4.5, 0, 2 * Math.PI); g.fillStyle = Plot.css(SITE_ST[rs.status][1]); g.fill(); g.strokeStyle = th.panel; g.lineWidth = 1.5; g.stroke(); }
    g.font = `600 12.5px ${th.ui}`; g.textAlign = 'left'; g.textBaseline = 'alphabetic'; g.lineWidth = 3.5; g.strokeStyle = Plot.alpha(th.panel, 0.92); g.lineJoin = 'round';
    g.strokeText(s.short, x + 13, y - 3); g.fillStyle = isU ? th.ink : th.ink2; g.fillText(s.short, x + 13, y - 3);
    if (isU || MAP.s > 60) { g.font = `500 11px ${th.ui}`; const tw = rs ? Math.max(rs.tower_m || 0, c.mount) : c.mount; const t2 = `${f1(c.ground, 0)} m AMSL, ${tw} m tower${rs ? ', ' + SITE_SHORT[rs.status] : ''}`; g.strokeText(t2, x + 13, y + 11); g.fillStyle = th.ink2; g.fillText(t2, x + 13, y + 11); }
    MAP.hits.push({ type: 'site', id: s.id, x, y, r: 12 });
  }
  drawFurniture(g, th, W, H);
}
function siteGlyph(g, x, y, role, used, th) {
  g.lineWidth = 1.6; g.strokeStyle = th.ink; g.fillStyle = th.panel;
  if (used) { g.beginPath(); g.arc(x, y, 13, 0, 2 * Math.PI); g.fillStyle = Plot.alpha(th.sig, 0.18); g.fill(); g.fillStyle = th.panel; }
  if (role === 'relay') { g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x - 7, y + 8); g.lineTo(x + 7, y + 8); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(x - 3.5, y - 1); g.lineTo(x + 3.5, y - 1); g.moveTo(x - 5, y + 4); g.lineTo(x + 5, y + 4); g.stroke();
    g.strokeStyle = th.sig; for (const r of [5, 9]) { g.beginPath(); g.arc(x, y - 10, r, -Math.PI * 0.8, -Math.PI * 0.2); g.stroke(); } }
  else if (role === 'end') { g.beginPath(); g.rect(x - 7, y - 6, 14, 13); g.fill(); g.stroke(); g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y - 13); g.stroke(); g.beginPath(); g.arc(x, y - 13, 2, 0, 2 * Math.PI); g.fillStyle = th.sig; g.fill(); g.fillStyle = th.ink; g.fillRect(x - 3, y - 2, 6, 5); }
  else if (role === 'candidate') { g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 8, y); g.lineTo(x, y + 8); g.lineTo(x - 8, y); g.closePath(); g.fill(); g.setLineDash([2, 2]); g.stroke(); g.setLineDash([]); }
  else { g.beginPath(); g.arc(x, y, 5, 0, 2 * Math.PI); g.fill(); g.stroke(); }
}
function drawGraticule(g, th, W, H) {
  const lonPerKm = 1 / KX, steps = [0.25, 0.5, 1, 2, 5, 10, 15, 30]; let sm = steps[steps.length - 1];
  for (const s of steps) if (s / 60 / lonPerKm * MAP.s >= 120) { sm = s; break; }
  const sd = sm / 60, inv = (px, py) => fromXY((px - W / 2) / MAP.s + MAP.cx, (H / 2 - py) / MAP.s + MAP.cy);
  const [latTop, lonL] = inv(0, 0), [latBot, lonR] = inv(W, H);
  g.strokeStyle = Plot.alpha(th.ink, 0.22); g.lineWidth = 1; g.font = `500 10.5px ${th.ui}`; g.fillStyle = th.ink2;
  for (let lon = Math.ceil(lonL / sd) * sd; lon <= lonR; lon += sd) { const [x] = toXY(LAT0, lon), px = Math.round((x - MAP.cx) * MAP.s + W / 2) + .5;
    g.beginPath(); g.moveTo(px, 0); g.lineTo(px, H); g.stroke(); g.textAlign = 'center'; g.textBaseline = 'bottom'; labelBox(g, DMS(lon, false, sm), px, H - 4, th, 'center'); }
  for (let lat = Math.ceil(latBot / sd) * sd; lat <= latTop; lat += sd) { const [, y] = toXY(lat, LON0), py = Math.round(H / 2 - (y - MAP.cy) * MAP.s) + .5;
    g.beginPath(); g.moveTo(0, py); g.lineTo(W, py); g.stroke(); labelBox(g, DMS(lat, true, sm), W - 6, py, th, 'right'); }
}
function labelBox(g, t, x, y, th, align) { const w = g.measureText(t).width + 8, x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.fillStyle = Plot.alpha(th.panel, 0.85); g.fillRect(x0, y - (align === 'center' ? 14 : 7), w, 14); g.fillStyle = th.ink2; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(t, x0 + 4, y - (align === 'center' ? 7 : 0)); }
function drawFurniture(g, th, W, H) {
  // north arrow
  const nx = W - 34, ny = 46; g.fillStyle = th.ink; g.beginPath(); g.moveTo(nx, ny - 20); g.lineTo(nx + 8, ny + 6); g.lineTo(nx, ny + 1); g.closePath(); g.fill();
  g.fillStyle = th.panel; g.strokeStyle = th.ink; g.lineWidth = 1; g.beginPath(); g.moveTo(nx, ny - 20); g.lineTo(nx - 8, ny + 6); g.lineTo(nx, ny + 1); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = th.ink; g.font = `600 12px ${th.ui}`; g.textAlign = 'center'; g.textBaseline = 'top'; g.fillText('N', nx, ny + 9);
  // scale bar
  const target = Math.min(220, W * 0.3) / MAP.s, nice = [0.1, 0.2, 0.5, 1, 2, 5, 10, 20].reduce((b, v) => v <= target ? v : b, 0.1), len = nice * MAP.s, sx = 16, sy = H - 30;
  g.fillStyle = Plot.alpha(th.panel, 0.88); g.fillRect(sx - 8, sy - 22, len + 52, 40);
  for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? th.panel : th.ink; g.fillRect(sx + k * len / 4, sy, len / 4, 6); } g.strokeStyle = th.ink; g.strokeRect(sx + .5, sy + .5, len, 6);
  g.fillStyle = th.ink; g.font = `500 11px ${th.ui}`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText('0', sx, sy - 3); g.fillText(`${nice} km`, sx + len, sy - 3);
  g.textAlign = 'left'; g.textBaseline = 'top'; g.fillStyle = th.ink2; g.fillText(`1 cm ≈ ${f1(100 / MAP.s / 37.8 * 1000 / 1000, 2)} km on screen`, sx, sy + 9);
  // legend + title block (measured so it never clips)
  const req = S.g.reqThroughput, items = [], lc = S.mapv.linkColor;
  if (lc === 'margin') items.push(['Link margin at required rate', [[Plot.css('--green'), 'at or above design margin'], [Plot.css('--amber'), 'positive, below design'], [Plot.css('--red'), 'negative or rate unreachable']]]);
  else if (lc === 'load') items.push([`Link load at ${req} Mbps`, [['#1a9850', 'below 50 %'], ['#91cf60', '50–70 %'], ['#fee08b', '70–85 %'], ['#fc8d59', '85–100 %'], ['#d73027', 'overloaded']]]);
  else items.push(['Link received level, dBm', RSSI_BANDS.map(([, c, t]) => [c, t])]);
  if (S.mapv.network) items.push(['Telemetry network status', Object.entries(LINK_ST).map(([k, v]) => [Plot.css(v[1]), v[0]])]);
  items.push(['Tower status (dot)', Object.entries(SITE_ST).filter(([k]) => k !== 'unknown').map(([k, v]) => [Plot.css(v[1]), v[0]])]);
  if (COV.data && S.cov.layer !== 'none') { const D = COV.data, tx = D.txName;
    if (S.cov.layer === 'thr') items.push([`Coverage from ${tx}, Mbps`, THR_COLS.map((c, k) => [c, ['≥ ' + req, '≥ ' + 0.75 * req, '≥ ' + 0.5 * req, '≥ ' + 0.25 * req, '≥ ' + 0.1 * req, 'above 0'][k]])]);
    if (S.cov.layer === 'rsl') items.push([`Coverage from ${tx}, dBm`, RSSI_BANDS.map(([, c, t]) => [c, t])]);
    if (S.cov.layer === 'clear') items.push([`Fresnel clearance from ${tx}`, CLR_BANDS.map(([, c, t]) => [c, t])]);
    if (S.cov.layer === 'los') items.push([`Line of sight from ${tx}`, [['#1a9850', 'clear'], ['#d73027', 'blocked']]]); }
  const bw = 248, showSites = H > 560; let bh = 12 + (showSites ? 20 + 3 * 20 : 0) + 64; items.forEach(([, rows]) => bh += 20 + rows.length * 15);
  if (W < 640) return;
  const lx = W - bw - 12, ly = Math.max(70, H - bh - 12);
  g.fillStyle = Plot.alpha(th.panel, 0.95); g.fillRect(lx, ly, bw, bh); g.strokeStyle = th.rule; g.strokeRect(lx + .5, ly + .5, bw, bh);
  const fit = (t, w) => { if (g.measureText(t).width <= w) return t; while (t.length > 3 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; };
  let yy = ly + 16; g.textAlign = 'left'; g.textBaseline = 'middle';
  if (showSites) { g.font = `600 12px ${th.ui}`; g.fillStyle = th.ink; g.fillText('Sites', lx + 10, yy); yy += 22;
    [['relay', 'Relay high site'], ['end', 'End site with mast'], ['other', 'Other telemetry site']].forEach(([r, t]) => { siteGlyph(g, lx + 20, yy + 2, r, false, th); g.font = `500 11px ${th.ui}`; g.fillStyle = th.ink2; g.textBaseline = 'middle'; g.fillText(t, lx + 38, yy); yy += 20; }); yy -= 2; }
  for (const [title, rows] of items) { yy += 6; g.font = `600 12px ${th.ui}`; g.fillStyle = th.ink; g.fillText(fit(title, bw - 20), lx + 10, yy); yy += 15;
    for (const [c, t] of rows) { g.fillStyle = c; g.fillRect(lx + 12, yy - 5, 18, 10); g.font = `500 11px ${th.ui}`; g.fillStyle = th.ink2; g.fillText(t, lx + 38, yy); yy += 15; } }
  yy += 4; g.strokeStyle = th.rule; g.beginPath(); g.moveTo(lx, yy); g.lineTo(lx + bw, yy); g.stroke();
  g.font = `600 12px ${th.ui}`; g.fillStyle = th.ink; g.fillText('Molepolole telemetry backhaul', lx + 10, yy + 13);
  g.font = `500 11px ${th.ui}`; g.fillStyle = th.ink2; g.fillText(fit(arch().name, bw - 20), lx + 10, yy + 28);
  g.fillText('WGS 84, Copernicus GLO-30 DSM, 10 m contours', lx + 10, yy + 42); g.fillText(`Plotted ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`, lx + 10, yy + 56);
}
function mapHover(x, y, inv) {
  const tip = MAP.tip; let html = null;
  const site = MAP.hits.find(o => o.type === 'site' && Math.hypot(o.x - x, o.y - y) < o.r);
  const lab = MAP.hits.find(o => o.type === 'label' && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
  const lk = lab || MAP.hits.find(o => o.type === 'link' && segDist(x, y, o) < 7);
  const rg = !site && !lk && MAP.hits.find(o => o.type === 'reg' && segDist(x, y, o) < 7);
  if (site) { const c = CTX.sites[site.id], s = siteById(site.id), rs = S.reg.sites[site.id]; html = `<b>${s.name}</b>${rs ? ': ' + SITE_ST[rs.status][0] : ''}<br>${c.lat.toFixed(5)}, ${c.lon.toFixed(5)}<br>Ground ${f1(c.ground, 1)} m, antenna ${c.mount} m AGL${rs ? `, tower ${rs.tower_m} m` : ''}${s.tower ? '<br>' + s.tower : ''}`; }
  else if (rg) { const L = rg.R.L; html = `<b>${hopName(L.hop)}</b>: ${LINK_ST[rg.R.st.status][0]}<br>${rg.R.def.scope}, click to analyse<br>${f1(L.D, 2)} km, antennas ${f1(L.hA - L.A.ground, 0)} m / ${f1(L.hB - L.B.ground, 0)} m<br>Clearance ${f1(L.geoK.minRatio, 2)} F1, diffraction ${f1(L.diff.L, 1)} dB<br>RSL ${fm(L.ab.rsl[0])} dBm at max power, ${fMb(L.design.cap.agg)} in ${L.bw} MHz`; }
  else if (lk) { const L = lk.L; html = `<b>${hopName(L.hop)}</b>, click to analyse<br>${f1(L.D, 3)} km, azimuth ${f1(L.azAB, 1)}° / ${f1(L.azBA, 1)}°<br>Clearance ${f1(L.geoK.minRatio, 2)} F1, diffraction ${f1(L.diff.L, 1)} dB<br>RSL ${fm(L.ab.rsl[Math.max(0, L.design.ab)])} / ${fm(L.ba.rsl[Math.max(0, L.design.ba)])} dBm<br>${fMb(L.design.cap.agg)} at ${f1(L.designFM, 1)} dB margin`; }
  else { const [wx, wy] = inv(x, y), [lat, lon] = fromXY(wx, wy);
    if (dem.contains(lat, lon)) { html = `${DMS(lat, true, 0.1)} ${DMS(lon, false, 0.1)}<br>${f1(dem.elev(lat, lon), 0)} m AMSL`;
      const D = COV.data; if (D && S.cov.layer !== 'none') { const i = Math.round((lon - dem.west) / (D.st * dem.step)), j = Math.round((dem.north - lat) / (D.st * dem.step)), k = j * D.nx + i;
        if (i >= 0 && j >= 0 && i < D.nx && j < D.ny) html += `<br>From ${D.txName}: ${fm(D.rsl[k])} dBm, ${f1(covCap(D, k), 0)} Mbps, ${f1(D.ratio[k], 2)} F1`; } } }
  if (!html) { tip.style.display = 'none'; MAP.cv.style.cursor = 'grab'; return; }
  MAP.cv.style.cursor = lk || rg ? 'pointer' : 'grab';
  tip.innerHTML = html; tip.style.display = 'block'; tip.style.left = Math.min(x, MAP.W - 260) + 'px'; tip.style.top = Math.min(y, MAP.H - 110) + 'px';
}
function segDist(x, y, o) { const dx = o.x2 - o.x1, dy = o.y2 - o.y1, t = Math.max(0, Math.min(1, ((x - o.x1) * dx + (y - o.y1) * dy) / (dx * dx + dy * dy || 1))); return Math.hypot(o.x1 + t * dx - x, o.y1 + t * dy - y); }
function mapClick(x, y) {
  const lab = MAP.hits.find(o => o.type === 'label' && x >= o.x && x <= o.x + o.w && y >= o.y && y <= o.y + o.h);
  const lk = lab || MAP.hits.find(o => o.type === 'link' && segDist(x, y, o) < 7);
  if (lk) { S.sel = lk.i; update({ side: true }); return; }
  const rg = MAP.hits.find(o => o.type === 'reg' && segDist(x, y, o) < 7); if (rg) openRegLink(rg.R);
}
