/* =====================================================================
   TOPOGRAPHIC TEXTURES (shared by 3D view and coverage map)
   ===================================================================== */
const isDark = () => { const c = Plot.css('--paper').replace('#', ''); const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16); return ((n >> 16 & 255) * .3 + (n >> 8 & 255) * .59 + (n & 255) * .11) < 110; };
const hexRGB = hx => { const c = hx.trim().replace('#', ''); const n = parseInt(c.length === 3 ? c.split('').map(x => x + x).join('') : c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
const TEXSCALE = 2;
const TEX = { tint: null, map: null, tex3d: null, mapC: null, overlay: null, dark: null };
function hypso(t, dark) {
  const L = [[0, [158, 168, 148]], [0.25, [186, 186, 160]], [0.5, [204, 196, 170]], [0.75, [221, 212, 190]], [1, [240, 234, 220]]];
  const D = [[0, [34, 46, 50]], [0.25, [52, 60, 58]], [0.5, [76, 76, 66]], [0.75, [104, 98, 82]], [1, [140, 130, 108]]];
  const P = dark ? D : L; t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < P.length - 1; i++) if (t <= P[i + 1][0]) { const f = (t - P[i][0]) / (P[i + 1][0] - P[i][0]), a = P[i][1], b = P[i + 1][1]; return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
  return P[P.length - 1][1];
}
function buildTextures() {
  const dark = isDark(); TEX.dark = dark;
  const W = dem.w, H = dem.h, z = dem.z, lo = dem.minZ, span = dem.maxZ - dem.minZ;
  const dx = dem.step * KX * 1000, dy = dem.step * KY * 1000;
  const tint = new ImageData(W, H), shade = new ImageData(W, H);
  const sun = [-Math.sin(315 * Math.PI / 180) * Math.cos(Math.PI / 4) * -1, Math.cos(315 * Math.PI / 180) * Math.cos(Math.PI / 4), Math.sin(Math.PI / 4)];
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const i = r * W + c, v = z[i], col = hypso((v - lo) / span, dark);
    const zx = (z[r * W + Math.min(W - 1, c + 1)] - z[r * W + Math.max(0, c - 1)]) / (2 * dx) * 3;
    const zy = (z[Math.max(0, r - 1) * W + c] - z[Math.min(H - 1, r + 1) * W + c]) / (2 * dy) * 3;
    const nl = Math.hypot(zx, zy, 1), s = Math.max(0, (-zx * sun[0] - zy * sun[1] + sun[2]) / nl);
    const k = dark ? 0.45 + 0.75 * s : 0.62 + 0.5 * s;
    tint.data.set([col[0], col[1], col[2], 255], i * 4);
    shade.data.set([Math.min(255, col[0] * k), Math.min(255, col[1] * k), Math.min(255, col[2] * k), 255], i * 4);
  }
  const mk = (img) => { const a = document.createElement('canvas'); a.width = W; a.height = H; a.getContext('2d').putImageData(img, 0, 0);
    const b = document.createElement('canvas'); b.width = W * TEXSCALE; b.height = H * TEXSCALE; const g = b.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(a, 0, 0, b.width, b.height); return b; };
  TEX.tint = mk(tint); TEX.map = mk(shade);
  const minor = new Path2D(), major = new Path2D(); contours(minor, major, 10, 50);
  for (const cv of [TEX.tint, TEX.map]) { const g = cv.getContext('2d');
    g.lineWidth = 1; g.strokeStyle = dark ? 'rgba(235,215,170,0.13)' : 'rgba(70,52,28,0.20)'; g.stroke(minor);
    g.lineWidth = 1.6; g.strokeStyle = dark ? 'rgba(240,222,180,0.28)' : 'rgba(70,52,28,0.42)'; g.stroke(major); }
  composeTextures();
}
function contours(minor, major, step, idxStep) {
  const W = dem.w, H = dem.h, z = dem.z, s = TEXSCALE;
  for (let r = 0; r < H - 1; r++) for (let c = 0; c < W - 1; c++) {
    const a = z[r * W + c], b = z[r * W + c + 1], cc = z[(r + 1) * W + c + 1], d = z[(r + 1) * W + c];
    const mn = Math.min(a, b, cc, d), mx = Math.max(a, b, cc, d);
    for (let L = Math.ceil(mn / step) * step; L < mx; L += step) {
      const pts = []; const e = (v0, v1, x0, y0, x1, y1) => { if ((v0 < L) !== (v1 < L)) { const t = (L - v0) / (v1 - v0); pts.push([(x0 + (x1 - x0) * t + .5) * s, (y0 + (y1 - y0) * t + .5) * s]); } };
      e(a, b, c, r, c + 1, r); e(b, cc, c + 1, r, c + 1, r + 1); e(cc, d, c + 1, r + 1, c, r + 1); e(d, a, c, r + 1, c, r);
      const P = L % idxStep === 0 ? major : minor;
      for (let k = 0; k + 1 < pts.length; k += 2) { P.moveTo(pts[k][0], pts[k][1]); P.lineTo(pts[k + 1][0], pts[k + 1][1]); }
    }
  }
}
function composeTextures() {
  const W = TEX.tint.width, H = TEX.tint.height;
  if (!TEX.tex3d) { TEX.tex3d = document.createElement('canvas'); TEX.tex3d.width = W; TEX.tex3d.height = H; }
  if (!TEX.mapC) { TEX.mapC = document.createElement('canvas'); TEX.mapC.width = W; TEX.mapC.height = H; }
  const g3 = TEX.tex3d.getContext('2d'); g3.drawImage(TEX.tint, 0, 0);
  if (S.view.coverage && TEX.overlay) { g3.globalAlpha = 0.78; g3.imageSmoothingEnabled = true; g3.drawImage(TEX.overlay, 0, 0, W, H); g3.globalAlpha = 1; }
  const gm = TEX.mapC.getContext('2d'); gm.drawImage(TEX.map, 0, 0);
  if (TEX.overlay) { gm.globalAlpha = 0.72; gm.drawImage(TEX.overlay, 0, 0, W, H); gm.globalAlpha = 1; }
  if (NET3D && NET3D.R) { NET3D.R.setTexture(TEX.tex3d); NET3D.R.dirty = true; }
}

/* =====================================================================
   3D NETWORK TAB
   ===================================================================== */
let NET3D = null;
regTab('net', initNet, renderNet);
function sceneP(lat, lon, elev) { const [x, y] = toXY(lat, lon); return [x, y, (elev - ZBASE) / 1000 * S.view.exag]; }
function rgbaVar(name, a) { const [r, g, b] = hexRGB(Plot.css(name)); return [r / 255, g / 255, b / 255, a]; }
function initNet() {
  const pane = $('#pane-net');
  const cv = h('canvas', { 'aria-label': 'Interactive 3D terrain model of the Molepolole radio network. Drag to orbit, shift-drag to pan, scroll to zoom.' });
  const labels = h('div', { class: 'labels' }), tip = h('div', { class: 'tip' });
  const toggles = [['fresnel', 'Fresnel zones'], ['network', 'Telemetry network'], ['packets', 'Data packets'], ['lobes', 'Antenna lobes'], ['coverage', 'Coverage drape'], ['others', 'Other sites'], ['labels', 'Labels']]
    .map(([k, t]) => { const i = h('input', { type: 'checkbox', checked: !!S.view[k] }); i.addEventListener('change', () => { S.view[k] = i.checked; save(); if (k === 'coverage') composeTextures(); if (k === 'network' || k === 'others') NET3D.static = null; NET3D.dyn = null; NET3D.R.dirty = true; renderNet(); }); return h('label', { class: 'tog' }, i, t); });
  const exag = h('input', { type: 'range', min: 1, max: 8, step: 0.5, value: S.view.exag, 'aria-label': 'Vertical exaggeration' });
  const exagLab = h('span', { class: 'note' }, `Vertical ×${S.view.exag}`);
  exag.addEventListener('input', () => { S.view.exag = +exag.value; exagLab.textContent = `Vertical ×${S.view.exag}`; NET3D.R.exag = S.view.exag; NET3D.static = null; NET3D.dyn = null; renderNet(); save(); });
  const placeBtn = h('button', { class: 'btn sm', 'aria-pressed': 'false' }, 'Place candidate site');
  placeBtn.addEventListener('click', () => { NET3D.place = !NET3D.place; placeBtn.setAttribute('aria-pressed', NET3D.place); placeBtn.classList.toggle('pri', NET3D.place); cv.classList.toggle('place', NET3D.place); });
  const cams = h('div', { class: 'row' },
    h('button', { class: 'btn sm', onclick: () => camPreset('overview') }, 'Overview'), h('button', { class: 'btn sm', onclick: () => camPreset('plan') }, 'Plan view'),
    h('button', { class: 'btn sm', onclick: () => camPreset('hop') }, 'Down the hop'), h('button', { class: 'btn sm', onclick: () => fly() }, 'Fly the hop'));
  const readout = h('div', { class: 'ov tr', id: 'netReadout' });
  const stage = h('div', { class: 'stage' }, cv, labels, tip,
    h('details', { class: 'ov tl' }, h('summary', {}, 'Layers'), h('div', { class: 'in' }, ...toggles)),
    h('div', { class: 'ov bl' }, cams, h('div', { class: 'row' }, exag, exagLab), h('div', { class: 'row' }, placeBtn, h('span', { class: 'note', id: 'netHint' }, 'Drag to orbit · shift-drag to pan · scroll to zoom'))),
    readout);
  pane.append(stage);
  const R = GL3D.create(cv);
  NET3D = { R, cv, labels, tip, readout, place: false, static: null, dyn: null, t0: performance.now(), lblEls: {}, fly: null };
  if (!R) { stage.append(h('div', { class: 'ov', style: 'top:40%;left:50%;transform:translate(-50%,-50%)' }, 'WebGL is not available in this browser, so the 3D view cannot render. All other tabs still work.')); return; }
  R.exag = S.view.exag;
  R.setTerrain(terrainGeometry());
  if (!TEX.tint) buildTextures(); else composeTextures();
  R.setTexture(TEX.tex3d);
  const [x0, y0] = toXY(dem.south, dem.west), [x1, y1] = toXY(dem.north, dem.east); R.bounds = { x: [x0, x1], y: [y0, y1] };
  camPreset('overview', true);
  R.onInteract = () => { NET3D.fly = null; };
  R.onHover = e => {
    const r = cv.getBoundingClientRect(), p = pickTerrain(e.clientX - r.left, e.clientY - r.top);
    if (!p) { tip.style.display = 'none'; return; }
    tip.style.display = 'block'; tip.style.left = (e.clientX - r.left) + 'px'; tip.style.top = (e.clientY - r.top) + 'px';
    tip.textContent = `${f1(p.elev, 0)} m AMSL   ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` + (NET3D.place ? '   click to place' : '');
  };
  R.onClick = e => {
    if (!NET3D.place) return; const r = cv.getBoundingClientRect(), p = pickTerrain(e.clientX - r.left, e.clientY - r.top); if (!p) return;
    const n = (S.candidates.reduce((m, c) => Math.max(m, +c.id.replace('cand', '') || 0), 0)) + 1, id = 'cand' + n;
    S.candidates.push({ id, name: 'Candidate ' + n, short: 'Cand ' + n, lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), mount: 15 }); S.mounts[id] = 15;
    S.custom.a = 'sr3'; S.custom.b = id; S.sel = 'custom';
    NET3D.place = false; placeBtn.setAttribute('aria-pressed', 'false'); placeBtn.classList.remove('pri'); cv.classList.remove('place');
    NET3D.static = null; update({ side: true });
  };
  new ResizeObserver(() => { R.dirty = true; }).observe(cv);
  requestAnimationFrame(loop);
}
function terrainGeometry() {
  const W = dem.w, H = dem.h, z = dem.z, st = 2, nx = Math.floor((W - 1) / st) + 1, ny = Math.floor((H - 1) / st) + 1;
  const pos = new Float32Array(nx * ny * 3), uv = new Float32Array(nx * ny * 2), grad = new Float32Array(nx * ny * 2);
  const dxk = dem.step * KX, dyk = dem.step * KY;
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const r = Math.min(H - 1, j * st), c = Math.min(W - 1, i * st), k = j * nx + i;
    const lat = dem.north - r * dem.step, lon = dem.west + c * dem.step, [x, y] = toXY(lat, lon);
    pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = (z[r * W + c] - ZBASE) / 1000;
    uv[k * 2] = (c + .5) / W; uv[k * 2 + 1] = (r + .5) / H;
    grad[k * 2] = (z[r * W + Math.min(W - 1, c + 1)] - z[r * W + Math.max(0, c - 1)]) / 1000 / (2 * dxk);
    grad[k * 2 + 1] = (z[Math.max(0, r - 1) * W + c] - z[Math.min(H - 1, r + 1) * W + c]) / 1000 / (2 * dyk);
  }
  const big = nx * ny > 65535, idx = big ? new Uint32Array((nx - 1) * (ny - 1) * 6) : new Uint16Array((nx - 1) * (ny - 1) * 6);
  let q = 0; for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) { const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1; idx[q++] = a; idx[q++] = c; idx[q++] = b; idx[q++] = b; idx[q++] = c; idx[q++] = d; }
  NET3D.grid = { nx, ny, st };
  return { pos, uv, grad, idx };
}
function pickTerrain(sx, sy) {
  const R = NET3D.R; if (!R.ivp) return null; const { o, d } = R.ray(sx, sy), ex = S.view.exag;
  const hAt = (x, y) => { const [lat, lon] = fromXY(x, y); if (!dem.contains(lat, lon)) return null; return { lat, lon, elev: dem.elev(lat, lon), z: (dem.elev(lat, lon) - ZBASE) / 1000 * ex }; };
  let prev = 0, step = 0.04;
  for (let t = 0; t < 150; t += step) {
    const p = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t], q = hAt(p[0], p[1]);
    if (q && p[2] <= q.z) { let a = prev, b = t; for (let k = 0; k < 20; k++) { const m = (a + b) / 2, pm = [o[0] + d[0] * m, o[1] + d[1] * m, o[2] + d[2] * m], qm = hAt(pm[0], pm[1]); if (qm && pm[2] <= qm.z) b = m; else a = m; }
      const pf = [o[0] + d[0] * b, o[1] + d[1] * b]; return hAt(pf[0], pf[1]); }
    prev = t; step = Math.min(0.25, 0.02 + t * 0.004);
  }
  return null;
}
function siteTop(id) { const s = CTX.sites[id]; return sceneP(s.lat, s.lon, s.ground + s.mount); }
function buildStatic() {
  const op = GL3D.Mesh(), ex = S.view.exag, W = dem.w, H = dem.h, st = NET3D.grid.st, zb = -0.22;
  const top = rgbaVar('--sand', 1).map((v, i) => i < 3 ? v * 0.62 : 1), bot = rgbaVar('--ink', 1).map((v, i) => i < 3 ? v * 0.55 + 0.1 : 1);
  const edge = (pts, nrm) => { const base = op.pos.length / 3;
    for (const [lat, lon] of pts) { const [x, y] = toXY(lat, lon), zz = (dem.elev(lat, lon) - ZBASE) / 1000 * ex; op.pos.push(x, y, zz, x, y, zb); op.nor.push(...nrm, ...nrm); op.col.push(...top, ...bot); }
    for (let i = 0; i < pts.length - 1; i++) { const a = base + i * 2; op.idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } };
  const rowPts = r => { const a = []; for (let c = 0; c < W; c += st) a.push([dem.north - r * dem.step, dem.west + c * dem.step]); return a; };
  const colPts = c => { const a = []; for (let r = 0; r < H; r += st) a.push([dem.north - r * dem.step, dem.west + c * dem.step]); return a; };
  edge(rowPts(0), [0, 1, 0]); edge(rowPts(Math.floor((H - 1) / st) * st), [0, -1, 0]); edge(colPts(0), [-1, 0, 0]); edge(colPts(Math.floor((W - 1) / st) * st), [1, 0, 0]);
  const used = usedSites3D(), tr = GL3D.Mesh();
  const mastC = rgbaVar('--ink', 1).map((v, i) => i < 3 ? v * 0.7 + 0.15 : 1);
  for (const s of allSites()) {
    if (!used.has(s.id) && !S.view.others) continue;
    const c = CTX.sites[s.id], rs = S.reg.sites[s.id], st = rs ? rs.status : 'existing', tw = Math.max(rs && rs.tower_m != null ? rs.tower_m : 0, c.mount);
    const built = st === 'existing' || st === 'construction', dst = built ? op : tr, sc = rgbaVar(SITE_ST[st] ? SITE_ST[st][1] : '--ink-3', 1);
    const col = built ? (st === 'construction' ? [sc[0], sc[1], sc[2], 1] : mastC) : [sc[0], sc[1], sc[2], 0.55];
    const g0 = sceneP(c.lat, c.lon, c.ground), t = sceneP(c.lat, c.lon, c.ground + tw);
    GL3D.cylinder(dst, g0, [t[0], t[1], Math.max(t[2], g0[2] + 0.01)], used.has(s.id) ? 0.03 : 0.022, 8, col, used.has(s.id) ? 0.012 : 0.009);
    GL3D.cylinder(dst, [g0[0], g0[1], g0[2] - 0.01], [g0[0], g0[1], g0[2] + 0.004], 0.11, 18, col);
  }
  NET3D.static = op; NET3D.staticTr = tr;
}
function usedSites3D() {
  const used = new Set(NET.links.flatMap(l => [l.hop.a, l.hop.b])); if (S.sel === 'custom') { used.add(S.custom.a); used.add(S.custom.b); }
  if (S.view.network) for (const R of REGL) if (R.st.status !== 'not_feasible') { used.add(R.def.a); used.add(R.def.b); }
  return used;
}
function hopRay(L, n = 90) {
  const pts = [], rh = [], rv = [], ratio = [], ex = S.view.exag, K = S.g.k, D = L.D;
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), d = f * D, lat = L.A.lat + f * (L.B.lat - L.A.lat), lon = L.A.lon + f * (L.B.lon - L.A.lon);
    const elev = L.hA + (L.hB - L.hA) * f - RF.bulge(d, D - d, K), r1 = RF.fresnelR(d, D - d, D, L.fGHz);
    pts.push(sceneP(lat, lon, elev)); rh.push(Math.max(0.0015, r1 / 1000)); rv.push(Math.max(0.0015, r1 / 1000 * ex));
    const k = Math.min(L.prof.n - 1, Math.round(f * (L.prof.n - 1))); ratio.push(L.geoK.ratio[k]);
  }
  return { pts, rh, rv, ratio };
}
function buildDynamic() {
  const tr = GL3D.Mesh(), gl = GL3D.Mesh(), op = GL3D.Mesh(), ex = S.view.exag;
  const sig = rgbaVar('--signal', 1), red = rgbaVar('--red', 1), amb = rgbaVar('--amber', 1);
  const links = [...NET.links]; if (S.sel === 'custom' && LINK) links.push(LINK);
  NET3D.rays = [];
  links.forEach((L, li) => {
    const isSel = (S.sel === 'custom' && L === LINK) || (S.sel === li), ray = hopRay(L), ok = L.clear.cap.agg > 0;
    NET3D.rays.push({ L, ray, sel: isSel });
    const lc = rgbaVar(ST_VAR[hopStatus(L)], 1);
    GL3D.tube(gl, ray.pts, ray.pts.map(() => isSel ? 0.011 : 0.007), ray.pts.map(() => isSel ? 0.011 : 0.007), ray.pts.map(() => [lc[0], lc[1], lc[2], isSel ? 0.95 : 0.6]), 8);
    if (S.view.fresnel) {
      const cols = ray.ratio.map(r => r >= 0.6 ? [sig[0], sig[1], sig[2], isSel ? 0.22 : 0.13] : r >= 0 ? [amb[0], amb[1], amb[2], 0.36] : [red[0], red[1], red[2], 0.5]);
      GL3D.tube(tr, ray.pts, ray.rh, ray.rv, cols, 24);
    }
    for (const e of L.diff.edges) { if (!(e.J > 0)) continue;
      const km = e.km != null ? e.km : L.prof.d[e.idx], f = km / L.D, lat = L.A.lat + f * (L.B.lat - L.A.lat), lon = L.A.lon + f * (L.B.lon - L.A.lon);
      const g0 = sceneP(lat, lon, dem.elev(lat, lon)), top = sceneP(lat, lon, L.hA + (L.hB - L.hA) * f - RF.bulge(km, L.D - km, S.g.k));
      GL3D.cylinder(gl, g0, [g0[0], g0[1], Math.max(top[2], g0[2] + 0.05)], 0.02, 8, [red[0], red[1], red[2], 0.9]); GL3D.sphere(gl, g0, 0.06, [red[0], red[1], red[2], 0.8], 10); }
  });
  if (S.view.network) for (const R of REGL) { if (R.wec) continue;
    const st = R.st.status, ray = hopRay(R.L, 50), c = rgbaVar(LINK_ST[st][1], 1), a = { communicating: 0.95, installed: 0.85, planned: 0.75, recommended: 0.6, not_feasible: 0.4 }[st];
    GL3D.tube(tr, ray.pts, ray.pts.map(() => 0.008), ray.pts.map(() => 0.008), ray.pts.map(() => [c[0], c[1], c[2], a]), 8);
    for (const [site, hh] of [[R.L.A, R.L.hA], [R.L.B, R.L.hB]]) GL3D.sphere(tr, sceneP(site.lat, site.lon, hh), 0.035, [c[0], c[1], c[2], 0.9], 8); }
  // site beacons
  const used = usedSites3D();
  for (const s of allSites()) { if (!used.has(s.id) && !S.view.others) continue; const t = siteTop(s.id);
    GL3D.sphere(used.has(s.id) ? gl : op, t, used.has(s.id) ? 0.07 : 0.045, used.has(s.id) ? [sig[0], sig[1], sig[2], 0.95] : rgbaVar('--ink-3', 1), 12); }
  if (S.view.lobes) {
    const seen = new Set();
    for (const L of links) for (const end of ['A', 'B']) {
      const sid = end === 'A' ? L.hop.a : L.hop.b, ant = end === 'A' ? L.antA : L.antB, p = end === 'A' ? L.pA : L.pB, key = sid + (end === 'A' ? L.hop.antA : L.hop.antB) + p.az.toFixed(1);
      if (seen.has(key)) continue; seen.add(key);
      const Gm = RF.antGainMax(ant, L.fc), up = ant.type === 'omni';
      GL3D.lobe(tr, siteTop(sid), p.az, p.el, (az, el) => RF.antGain(ant, L.fc, az, el, p.az, p.el) - Gm, up ? 0.9 : 1.6, [sig[0], sig[1], sig[2], 0.3], ex, up);
    }
  }
  NET3D.dyn = { tr, gl, op };
}
function renderNet() {
  if (!NET3D || !NET3D.R) return; const R = NET3D.R;
  if (!NET3D.static) buildStatic();
  buildDynamic();
  const op = GL3D.Mesh(), add = (dst, src) => { const b = dst.pos.length / 3; dst.pos.push(...src.pos); dst.nor.push(...src.nor); dst.col.push(...src.col); for (const i of src.idx) dst.idx.push(i + b); };
  add(op, NET3D.static); add(op, NET3D.dyn.op);
  const tr = GL3D.Mesh(); add(tr, NET3D.staticTr); add(tr, NET3D.dyn.tr);
  R.setMeshes(op, tr, NET3D.dyn.gl);
  const fog = hexRGB(Plot.css('--sky-bot')); R.fog = fog.map(v => v / 255); R.amb = isDark() ? 0.42 : 0.55; R.fogD = 0.016;
  buildLabels(); renderReadout(); R.dirty = true;
}
function buildLabels() {
  const box = NET3D.labels; box.innerHTML = ''; NET3D.lblEls = {};
  if (!S.view.labels) return;
  const used = usedSites3D();
  for (const s of allSites()) { if (!used.has(s.id) && !S.view.others) continue;
    const rs = S.reg.sites[s.id], tw = rs ? Math.max(rs.tower_m || 0, CTX.sites[s.id].mount) : CTX.sites[s.id].mount;
    const el = h('div', { class: 'lbl3' + (used.has(s.id) ? '' : ' dim'), title: `${s.name}: ground ${f1(CTX.sites[s.id].ground, 0)} m, tower ${tw} m, antenna ${CTX.sites[s.id].mount} m${rs ? ', ' + SITE_ST[rs.status][0] : ''}` },
      rs ? h('i', { class: 'dot', style: `background:var(${SITE_ST[rs.status][1]})` }) : null, s.short, h('small', {}, `${tw} m ${rs ? SITE_SHORT[rs.status] : ''}`));
    el.addEventListener('click', () => focusSite(s.id)); box.append(el); NET3D.lblEls[s.id] = el; }
}
function updateLabels() {
  for (const [id, el] of Object.entries(NET3D.lblEls)) { const p = NET3D.R.project(siteTop(id)); if (!p) { el.style.display = 'none'; continue; } el.style.display = ''; el.style.left = p[0] + 'px'; el.style.top = p[1] + 'px'; }
}
function renderReadout() {
  const box = NET3D.readout; box.innerHTML = '';
  const det = h('details', { open: !!S.ui.roOpen }); det.addEventListener('toggle', () => { S.ui.roOpen = det.open; save(); });
  det.append(h('summary', { style: 'cursor:pointer;list-style:none' }, h('div', { class: 'e2e' }, h('b', {}, fMb(NET.e2e).split(' ')[0]), h('span', {}, `${fMb(NET.e2e).split(' ')[1]} end-to-end, needs ${S.g.reqThroughput}. ${S.ui.roOpen ? 'Hide' : 'Show'} details`))));
  const ro = h('div'); det.append(ro); box.append(det);
  ro.append(h('h4', {}, arch().name), h('p', { class: 'note', style: 'margin:0 0 4px' }, SPEC_TXT[specLevel(S.arch)]));
  ro.append(h('p', { class: 'note', style: 'margin:2px 0 6px' }, NET.shared ? 'Shared airtime: relayed traffic crosses the SR3 radio twice, so capacity combines harmonically.' : 'Independent hops: end-to-end capacity is the weaker hop.'));
  NET.links.forEach((L, i) => {
    const m = L.design.ab, mm = Math.min(L.ab.margin[Math.max(0, L.design.ab)], L.ba.margin[Math.max(0, L.design.ba)]);
    const rows = [['Distance', f1(L.D, 2) + ' km'], ['Min clearance', f1(L.geoK.minRatio, 2) + ' F1'], ['Received level', fm(Math.min(L.ab.rsl[Math.max(0, m)], L.ba.rsl[Math.max(0, L.design.ba)])) + ' dBm'],
      ['Design modulation', m >= 0 ? `${L.radio.mcs[m].mod}` : 'none'], ['Capacity', fMb(L.design.cap.agg)], ['Margin', f1(mm, 1) + ' dB'],
      ['Availability', fAvail(100 - L.av.U(mm).total) + ' %']];
    ro.append(h('div', { class: 'hoprow' }, h('div', { class: 't' }, hopName(L.hop)), ...rows.flatMap(([a, b]) => [h('span', {}, a), h('em', {}, b)])));
  });
  const w = [...new Set(NET.links.flatMap(l => l.warnings))];
  NET.overlaps.forEach(o => w.push(`Hops ${o.i + 1} and ${o.j + 1} overlap by ${o.mhz} MHz${o.cosite ? ' at a shared site' : ''}.`));
  if (w.length) ro.append(h('ul', { class: 'warns', style: 'margin-top:8px' }, w.map(t => h('li', { class: /EIRP|overlap/.test(t) ? 'bad' : '' }, t))));
}
function focusSite(id) { const p = siteTop(id), c = NET3D.R.cam; c.tx = p[0]; c.ty = p[1]; c.tz = p[2]; c.dist = 6; c.el = 0.45; NET3D.R.dirty = true; }
function camPreset(k, instant) {
  const R = NET3D.R, c = R.cam; NET3D.fly = null;
  const ids = NET.links.flatMap(l => [l.hop.a, l.hop.b]), ps = ids.map(siteTop), cx = ps.reduce((s, p) => s + p[0], 0) / ps.length, cy = ps.reduce((s, p) => s + p[1], 0) / ps.length;
  if (k === 'overview') Object.assign(c, { tx: cx - 1.5, ty: cy + 0.5, tz: 0.25, dist: 19, az: -0.62, el: 0.5 });
  if (k === 'plan') Object.assign(c, { tx: 0, ty: 0, tz: 0, dist: 34, az: 0, el: 1.45 });
  if (k === 'hop' && LINK) { const a = siteTop(LINK.hop.a), b = siteTop(LINK.hop.b), dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
    const tx = a[0] + dx * 0.5, ty = a[1] + dy * 0.5; Object.assign(c, { tx, ty, tz: (a[2] + b[2]) / 2, dist: L * 0.85, az: Math.atan2(-dx, dy) + 0.62, el: 0.2 }); }
  R.dirty = true;
}
function fly() {
  if (!LINK) return; const a = siteTop(LINK.hop.a), b = siteTop(LINK.hop.b);
  if (REDUCED) { camPreset('hop'); return; }
  NET3D.fly = { a, b, t0: performance.now(), dur: 9000 };
}
function setCamFromEye(eye, tgt) {
  const c = NET3D.R.cam, v = [eye[0] - tgt[0], eye[1] - tgt[1], eye[2] - tgt[2]], d = Math.hypot(...v);
  c.tx = tgt[0]; c.ty = tgt[1]; c.tz = tgt[2]; c.dist = d; c.el = Math.asin(v[2] / d); c.az = Math.atan2(v[0], -v[1]);
}
function loop(ts) {
  requestAnimationFrame(loop);
  if (!NET3D || !NET3D.R || S.tab !== 'net' || document.hidden) return;
  const R = NET3D.R, t = (ts - NET3D.t0) / 1000;
  if (NET3D.fly) { const F = NET3D.fly, u = Math.min(1, (ts - F.t0) / F.dur), e = u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    const lerp = (p, q, k) => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k, p[2] + (q[2] - p[2]) * k];
    const s = -0.08 + 1.0 * e, eye = lerp(F.a, F.b, s), tgt = lerp(F.a, F.b, Math.min(1.25, s + 0.25)); eye[2] += 0.06; tgt[2] += 0.02;
    setCamFromEye(eye, tgt); R.dirty = true; if (u >= 1) NET3D.fly = null; }
  if (S.view.packets && NET3D.rays && !REDUCED) {
    const pos = [], col = [], size = [], sig = rgbaVar('--signal', 1), sand = rgbaVar('--sand', 1);
    for (const { L, ray } of NET3D.rays) {
      const cap = L.clear.cap.agg; if (!(cap > 0)) continue; const n = Math.max(2, Math.min(26, Math.round(cap / 22)));
      for (const [dir, c] of [[1, sig], [-1, sand]]) for (let k = 0; k < n; k++) {
        let u = (t * 0.16 + k / n + (dir < 0 ? 0.5 / n : 0)) % 1; if (dir < 0) u = 1 - u;
        const fi = u * (ray.pts.length - 1), i = Math.min(ray.pts.length - 2, Math.floor(fi)), fr = fi - i, p = ray.pts[i], q = ray.pts[i + 1];
        pos.push(p[0] + (q[0] - p[0]) * fr, p[1] + (q[1] - p[1]) * fr, p[2] + (q[2] - p[2]) * fr + (dir > 0 ? 0.012 : -0.004)); col.push(c[0], c[1], c[2], 0.95); size.push(0.075);
      }
    }
    R.setPoints(new Float32Array(pos), new Float32Array(col), new Float32Array(size)); R.dirty = true;
  } else if (R.points && R.points.n) { R.points.n = 0; R.dirty = true; }
  if (R.dirty) { R.render(); updateLabels(); R.dirty = false; }
}
