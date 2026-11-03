/* =====================================================================
   RF ENGINE — pure functions, no DOM.
   Models: ITU-R P.525 (free space), P.526 (knife-edge, Deygout, Bullington),
   P.530 (multipath full-range, rain, clearance rules, worst-month→annual),
   P.676 Annex 2 (gaseous), P.838 (rain specific attenuation),
   F.699 (dish envelope), F.1336 (omni), thermal noise, MCS/throughput.
   ===================================================================== */
const RF = (() => {
'use strict';
const C = 299792458;            // m/s
const RE = 6371.0088;           // km, mean Earth radius
const PI = Math.PI, D2R = PI / 180, R2D = 180 / PI;
const log10 = Math.log10, sqrt = Math.sqrt, exp = Math.exp, pow = Math.pow, abs = Math.abs;
const db = x => 10 * log10(x), undb = x => pow(10, x / 10);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const dbSum = (a, b) => db(undb(a) + undb(b));     // power sum of two dBm values

/* ---------------- DEM ---------------- */
function makeDEM(meta, b64) {
  let bytes;
  if (typeof atob === 'function') {
    const bin = atob(b64); bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else { bytes = new Uint8Array(Buffer.from(b64, 'base64')); }
  const n = meta.w * meta.h, z = new Float32Array(n);
  let mn = 1e9, mx = -1e9, s = 0, s2 = 0;
  for (let i = 0; i < n; i++) {
    const v = (bytes[2 * i] | (bytes[2 * i + 1] << 8)) * meta.scale;
    z[i] = v; if (v < mn) mn = v; if (v > mx) mx = v; s += v; s2 += v * v;
  }
  const mean = s / n;
  const dem = {
    w: meta.w, h: meta.h, north: meta.north, west: meta.west, step: meta.step,
    south: meta.north - (meta.h - 1) * meta.step, east: meta.west + (meta.w - 1) * meta.step,
    z, minZ: mn, maxZ: mx, mean, std: sqrt(Math.max(0, s2 / n - mean * mean)),
  };
  dem.elev = (lat, lon) => {
    let r = (dem.north - lat) / dem.step, c = (lon - dem.west) / dem.step;
    r = clamp(r, 0, dem.h - 1.001); c = clamp(c, 0, dem.w - 1.001);
    const r0 = r | 0, c0 = c | 0, fr = r - r0, fc = c - c0, W = dem.w, i = r0 * W + c0;
    return z[i] * (1 - fr) * (1 - fc) + z[i + W] * fr * (1 - fc) + z[i + 1] * (1 - fr) * fc + z[i + W + 1] * fr * fc;
  };
  dem.contains = (lat, lon) => lat <= dem.north && lat >= dem.south && lon >= dem.west && lon <= dem.east;
  return dem;
}

/* ---------------- Geodesy ---------------- */
function distKm(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dp = (lat2 - lat1) * D2R, dl = (lon2 - lon1) * D2R;
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * RE * Math.asin(Math.min(1, sqrt(a)));
}
function bearing(lat1, lon1, lat2, lon2) {
  const p1 = lat1 * D2R, p2 = lat2 * D2R, dl = (lon2 - lon1) * D2R;
  const y = Math.sin(dl) * Math.cos(p2), x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
  return (Math.atan2(y, x) * R2D + 360) % 360;
}
function profile(dem, a, b, n) {
  const d = distKm(a.lat, a.lon, b.lat, b.lon);
  const dk = new Float64Array(n), z = new Float64Array(n), lat = new Float64Array(n), lon = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    lat[i] = a.lat + f * (b.lat - a.lat); lon[i] = a.lon + f * (b.lon - a.lon);
    dk[i] = f * d; z[i] = dem.elev(lat[i], lon[i]);
  }
  return { D: d, d: dk, z, lat, lon, n };
}

/* ---------------- Basic propagation ---------------- */
const lambda = fMHz => C / (fMHz * 1e6);
const fspl = (fMHz, dKm) => 32.4478 + 20 * log10(dKm) + 20 * log10(fMHz);           // ITU-R P.525
const fresnelR = (d1, d2, D, fGHz, nZone = 1) => (d1 <= 0 || d2 <= 0) ? 0 : 17.3205 * sqrt(nZone * d1 * d2 / (fGHz * D)); // m
const bulge = (d1, d2, K) => d1 * d2 / (12.742 * K);                                  // m (km inputs)
const kFromGradient = g => 157 / (157 + g);                                           // dN/dh (N/km) → K
const gradientFromK = K => 157 / K - 157;

/* Knife-edge loss J(ν), ITU-R P.526 eq. (31) */
function J(nu) { return nu <= -0.78 ? 0 : 6.9 + 20 * log10(sqrt((nu - 0.1) ** 2 + 1) + nu - 0.1); }
const nuFactor = (d1, d2, lam) => sqrt(0.002 * (d1 + d2) / (lam * d1 * d2));       // d in km, λ in m → ν = h·factor

/* Effective obstruction heights (terrain + clutter + Earth bulge at K) */
function effHeights(prof, K, clutter = 0) {
  const { d, z, D, n } = prof, y = new Float64Array(n);
  for (let i = 0; i < n; i++) y[i] = z[i] + ((i > 0 && i < n - 1) ? clutter : 0) + bulge(d[i], D - d[i], K);
  return y;
}

/* Geometry: LOS line, first Fresnel radius, clearance ratio along the path */
function geometry(prof, hA, hB, fGHz, K, clutter = 0) {
  const { d, D, n } = prof, y = effHeights(prof, K, clutter);
  const los = new Float64Array(n), r1 = new Float64Array(n), clr = new Float64Array(n), ratio = new Float64Array(n);
  let minRatio = Infinity, minIdx = 1, minClr = Infinity, minClrIdx = 1;
  for (let i = 0; i < n; i++) {
    los[i] = hA + (hB - hA) * d[i] / D;
    r1[i] = fresnelR(d[i], D - d[i], D, fGHz);
    clr[i] = los[i] - y[i];
    ratio[i] = r1[i] > 0 ? clr[i] / r1[i] : Infinity;
    if (i > 0 && i < n - 1) {
      if (ratio[i] < minRatio) { minRatio = ratio[i]; minIdx = i; }
      if (clr[i] < minClr) { minClr = clr[i]; minClrIdx = i; }
    }
  }
  return { y, los, r1, clr, ratio, minRatio, minIdx, minClr, minClrIdx, K, losClear: minClr > 0 };
}

/* Single dominant knife edge (P.526 §4.1) */
function knifeEdge(prof, y, hA, hB, lam) {
  const { d, D, n } = prof; let best = -Infinity, idx = 1;
  for (let i = 1; i < n - 1; i++) {
    const h = y[i] - (hA + (hB - hA) * d[i] / D), nu = h * nuFactor(d[i], D - d[i], lam);
    if (nu > best) { best = nu; idx = i; }
  }
  return { L: J(best), edges: [{ idx, nu: best, J: J(best) }] };
}

/* Deygout three-edge with P.526 empirical correction */
function deygout(prof, y, hA, hB, lam) {
  const { d, D, n } = prof;
  const maxNu = (i0, i1, h0, h1) => {
    let best = -Infinity, idx = -1; const d0 = d[i0], span = d[i1] - d0;
    for (let i = i0 + 1; i < i1; i++) {
      const di = d[i] - d0, h = y[i] - (h0 + (h1 - h0) * di / span), nu = h * nuFactor(di, span - di, lam);
      if (nu > best) { best = nu; idx = i; }
    }
    return { nu: best, idx };
  };
  const p = maxNu(0, n - 1, hA, hB);
  if (p.idx < 0 || p.nu <= -0.78) return { L: 0, edges: p.idx < 0 ? [] : [{ idx: p.idx, nu: p.nu, J: 0 }] };
  const Jp = J(p.nu), edges = [{ idx: p.idx, nu: p.nu, J: Jp, role: 'principal' }];
  const t = p.idx > 1 ? maxNu(0, p.idx, hA, y[p.idx]) : { nu: -9, idx: -1 };
  const r = p.idx < n - 2 ? maxNu(p.idx, n - 1, y[p.idx], hB) : { nu: -9, idx: -1 };
  const Jt = J(t.nu), Jr = J(r.nu);
  if (t.idx >= 0 && Jt > 0) edges.push({ idx: t.idx, nu: t.nu, J: Jt, role: 'tx-side' });
  if (r.idx >= 0 && Jr > 0) edges.push({ idx: r.idx, nu: r.nu, J: Jr, role: 'rx-side' });
  let L = Jp;
  if (Jt > 0 || Jr > 0) { const T = 1 - exp(-Jp / 6), Cc = 10 + 0.04 * D; L = Jp + T * (Jt + Jr + Cc); }
  return { L, edges };
}

/* Bullington method with correction, ITU-R P.526-15 §4.5 (Bullington part of delta-Bullington) */
function bullington(prof, y, hts, hrs, lam) {
  const { d, D, n } = prof;
  let Stim = -Infinity, iStim = 1;
  for (let i = 1; i < n - 1; i++) { const s = (y[i] - hts) / d[i]; if (s > Stim) { Stim = s; iStim = i; } }
  const Str = (hrs - hts) / D;
  let Luc, nu, bp, mode;
  if (Stim < Str) {
    mode = 'los'; nu = -Infinity; bp = 1;
    for (let i = 1; i < n - 1; i++) {
      const v = (y[i] - (hts * (D - d[i]) + hrs * d[i]) / D) * sqrt(0.002 * D / (lam * d[i] * (D - d[i])));
      if (v > nu) { nu = v; bp = d[i]; }
    }
    Luc = J(nu);
  } else {
    mode = 'trans-horizon';
    let Srim = -Infinity;
    for (let i = 1; i < n - 1; i++) { const s = (y[i] - hrs) / (D - d[i]); if (s > Srim) Srim = s; }
    bp = (hrs - hts + Srim * D) / (Stim + Srim);
    nu = (hts + Stim * bp - (hts * (D - bp) + hrs * bp) / D) * sqrt(0.002 * D / (lam * bp * (D - bp)));
    Luc = J(nu);
  }
  const L = Luc + (1 - exp(-Luc / 6)) * (10 + 0.02 * D);
  return { L, Luc, nu, bpKm: bp, mode, edges: [{ km: bp, nu, J: Luc }] };
}

function diffraction(model, prof, y, hA, hB, lam) {
  if (model === 'none') return { L: 0, edges: [] };
  if (model === 'knife') return knifeEdge(prof, y, hA, hB, lam);
  if (model === 'deygout') return deygout(prof, y, hA, hB, lam);
  return bullington(prof, y, hA, hB, lam);
}

/* ---------------- Gaseous attenuation, ITU-R P.676 Annex 2 (approx., f ≤ 54 GHz) ---------------- */
function gasSpecific(fGHz, pHpa = 1013.25, tC = 15, rho = 7.5) {
  const f = fGHz, rp = pHpa / 1013, rt = 288 / (273 + tC);
  const phi = (a, b, c, dd) => pow(rp, a) * pow(rt, b) * exp(c * (1 - rp) + dd * (1 - rt));
  const x1 = phi(0.0717, -1.8132, 0.0156, -1.6515), x2 = phi(0.5146, -4.6368, -0.1921, -5.7416), x3 = phi(0.3414, -6.5851, 0.2130, -8.5854);
  const go = (7.2 * pow(rt, 2.8) / (f * f + 0.34 * rp * rp * pow(rt, 1.6)) + 0.62 * x3 / (pow(54 - f, 1.16 * x1) + 0.83 * x2)) * f * f * rp * rp * 1e-3;
  const e1 = 0.955 * rp * pow(rt, 0.68) + 0.006 * rho, e2 = 0.735 * rp * pow(rt, 0.5) + 0.0353 * pow(rt, 4) * rho;
  const g = (fi) => 1 + ((f - fi) / (f + fi)) ** 2;
  const gw = (3.98 * e1 * exp(2.23 * (1 - rt)) / ((f - 22.235) ** 2 + 9.42 * e1 * e1) * g(22)
    + 11.96 * e1 * exp(0.7 * (1 - rt)) / ((f - 183.31) ** 2 + 11.14 * e1 * e1)
    + 0.081 * e1 * exp(6.44 * (1 - rt)) / ((f - 321.226) ** 2 + 6.29 * e1 * e1)
    + 3.66 * e1 * exp(1.6 * (1 - rt)) / ((f - 325.153) ** 2 + 9.22 * e1 * e1)
    + 25.37 * e1 * exp(1.09 * (1 - rt)) / (f - 380) ** 2
    + 17.4 * e1 * exp(1.46 * (1 - rt)) / (f - 448) ** 2
    + 844.6 * e1 * exp(0.17 * (1 - rt)) / (f - 557) ** 2 * g(557)
    + 290 * e1 * exp(0.41 * (1 - rt)) / (f - 752) ** 2 * g(752)
    + 8.3328e4 * e2 * exp(0.99 * (1 - rt)) / (f - 1780) ** 2 * g(1780)) * f * f * pow(rt, 2.5) * rho * 1e-4;
  return { go, gw, g: go + gw };
}
const pressureAt = hM => 1013.25 * pow(1 - 2.25577e-5 * hM, 5.25588);

/* ---------------- Rain, ITU-R P.838-3 + P.530 ---------------- */
const P838 = [ // f GHz, kH, aH, kV, aV
  [1, 2.59e-5, 0.9691, 3.08e-5, 0.8592], [2, 8.47e-5, 1.0664, 9.98e-5, 0.9490], [4, 1.071e-4, 1.6009, 2.461e-4, 1.2476],
  [5, 2.162e-4, 1.6969, 2.428e-4, 1.5317], [6, 7.056e-4, 1.5900, 4.878e-4, 1.5728], [7, 1.915e-3, 1.4810, 1.425e-3, 1.4745],
  [8, 4.115e-3, 1.3905, 3.450e-3, 1.3797], [10, 1.217e-2, 1.2571, 1.129e-2, 1.2156], [12, 2.386e-2, 1.1825, 2.455e-2, 1.1216],
  [15, 4.481e-2, 1.1233, 5.008e-2, 1.0440], [18, 7.078e-2, 1.0818, 7.708e-2, 1.0025], [20, 9.164e-2, 1.0568, 9.611e-2, 0.9847],
  [23, 0.1286, 1.0214, 0.1284, 0.9630], [25, 0.1571, 0.9991, 0.1533, 0.9491], [30, 0.2403, 0.9485, 0.2291, 0.9129],
  [35, 0.3374, 0.9047, 0.3224, 0.8761], [40, 0.4431, 0.8673, 0.4274, 0.8421]];
function rainCoef(fGHz, pol = 'V') {
  const f = clamp(fGHz, 1, 40); let i = 0; while (i < P838.length - 2 && P838[i + 1][0] < f) i++;
  const a = P838[i], b = P838[i + 1], t = (log10(f) - log10(a[0])) / (log10(b[0]) - log10(a[0]));
  const lerp = (u, v) => u + (v - u) * t, lk = (u, v) => pow(10, lerp(log10(u), log10(v)));
  const kH = lk(a[1], b[1]), aH = lerp(a[2], b[2]), kV = lk(a[3], b[3]), aV = lerp(a[4], b[4]);
  if (pol === 'H') return { k: kH, a: aH };
  if (pol === 'V') return { k: kV, a: aV };
  const k = (kH + kV) / 2; return { k, a: (kH * aH + kV * aV) / (2 * k) };   // circular / 45° slant
}
function rainModel(fGHz, dKm, R001, pol, latDeg) {
  const { k, a } = rainCoef(fGHz, pol), gamma = k * pow(R001, a);
  let r = 1 / (0.477 * pow(dKm, 0.633) * pow(R001, 0.073 * a) * pow(fGHz, 0.123) - 10.579 * (1 - exp(-0.024 * dKm)));
  if (!(r > 0) || r > 2.5) r = 2.5;
  const deff = dKm * r, A001 = gamma * deff;
  const C0 = fGHz >= 10 ? 0.12 + 0.4 * log10(pow(fGHz / 10, 0.8)) : 0.12;
  const C1 = pow(0.07, C0) * pow(0.12, 1 - C0), C2 = 0.855 * C0 + 0.546 * (1 - C0), C3 = 0.139 * C0 + 0.043 * (1 - C0);
  const Ap = p => A001 * C1 * pow(p, -(C2 + C3 * log10(p)));          // p in %
  const pOf = A => {                                                   // inverse: % of time attenuation ≥ A
    if (A <= 0) return Infinity; if (A001 <= 0) return 0;
    let lo = -7, hi = 1.3;                                             // log10 p
    if (Ap(pow(10, lo)) < A) return pow(10, lo) * pow(Ap(pow(10, lo)) / A, 8); // beyond curve: steep extrapolation
    if (Ap(pow(10, hi)) > A) return pow(10, hi);
    for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; if (Ap(pow(10, m)) > A) lo = m; else hi = m; }
    return pow(10, (lo + hi) / 2);
  };
  return { k, a, gamma, r, deff, A001, C0, C1, C2, C3, Ap, pOf };
}
const rainSpecific = (fGHz, R, pol) => { const { k, a } = rainCoef(fGHz, pol); return k * pow(R, a); };

/* ---------------- Multipath, ITU-R P.530 §2.3.1/2.3.2 ---------------- */
function multipathModel(dKm, fGHz, he, hr, dN1, sa, latDeg) {
  const ep = abs(hr - he) / dKm;                                       // mrad
  const K = pow(10, -4.4 - 0.0027 * dN1) * pow(10 + sa, -0.46);
  const hL = Math.min(he, hr);
  const p0 = K * pow(dKm, 3.1) * pow(1 + ep, -1.29) * pow(fGHz, 0.8) * pow(10, -0.00089 * hL);   // % worst month
  const At = 25 + 1.2 * log10(p0);
  const pt = p0 * pow(10, -At / 10);
  const qap = -20 * log10(-Math.log((100 - pt) / 100)) / At;
  const qt = (qap - 2) / ((1 + 0.3 * pow(10, -At / 20)) * pow(10, -0.016 * At)) - 4.3 * (pow(10, -At / 20) + At / 800);
  const pw = A => {                                                    // % of worst month fade depth ≥ A
    if (A >= At) return p0 * pow(10, -A / 10);
    const qa = 2 + (1 + 0.3 * pow(10, -A / 20)) * pow(10, -0.016 * A) * (qt + 4.3 * (pow(10, -A / 20) + A / 800));
    return 100 * (1 - exp(-pow(10, -qa * A / 20)));
  };
  const c2x = pow(abs(Math.cos(2 * latDeg * D2R)), 0.7);
  let dG = 10.5 - 5.6 * log10(1.1 + (abs(latDeg) <= 45 ? 1 : -1) * c2x) - 2.7 * log10(dKm) + 1.7 * log10(1 + ep);
  dG = Math.min(dG, 10.8);
  const conv = pow(10, -dG / 10);
  return { ep, K, hL, p0, At, dG, conv, pw, pAnnual: A => pw(A) * conv };
}
const keApprox = dKm => clamp(1 - 0.55 * exp(-dKm / 55), 0.4, 1);   // approximate fit to P.530 Fig. 3 (99.9 % worst month)

/* ---------------- Antennas ---------------- */
function dishGain(D, fMHz, eff = 0.55) { const x = PI * D / lambda(fMHz); return db(eff * x * x); }
function antGainMax(ant, fMHz) { return ant.D && !ant.gain ? dishGain(ant.D, fMHz, ant.eff || 0.55) : ant.gain; }
/* ITU-R F.699 reference envelope for a dish (dBi) at off-axis angle ψ (deg) */
function f699(G, psi) {
  psi = abs(psi); const dl = pow(10, (G - 7.7) / 20), G1 = 2 + 15 * log10(dl), pm = 20 / dl * sqrt(Math.max(0, G - G1));
  if (psi < pm) return G - 2.5e-3 * (dl * psi) ** 2;
  if (dl > 100) { const pr = 15.85 * pow(dl, -0.6); if (psi < pr) return G1; if (psi < 48) return 32 - 25 * log10(psi); return -10; }
  const pr = 100 / dl; if (psi < pr) return G1; if (psi < 48) return 52 - 10 * log10(dl) - 25 * log10(psi); return 10 - 10 * log10(dl);
}
/* ITU-R F.1336 omnidirectional elevation pattern */
function f1336omni(G0, theta, th3) {
  th3 = th3 || 107.6 * pow(10, -0.1 * G0); const k = 0.7;
  const G1 = G0 - 12 * (theta / th3) ** 2, G2 = G0 - 12 + 10 * log10(pow(Math.max(abs(theta) / th3, 1), -1.5) + k);
  return Math.max(G1, G2);
}
function sectorGain(G0, phi, theta, bwH, bwV) {
  return G0 - Math.min(12 * (phi / bwH) ** 2 + 12 * (theta / bwV) ** 2, 25);
}
const wrap180 = a => { a = ((a + 180) % 360 + 360) % 360 - 180; return a; };
/* Gain of an antenna toward a target at (az, el) given pointing (pAz, pEl). Dish boresight pointing; omni tilt. */
function antGain(ant, fMHz, az, el, pAz, pEl) {
  const G = antGainMax(ant, fMHz);
  if (ant.type === 'omni') return f1336omni(G, el - pEl, ant.bwV);
  const dAz = wrap180(az - pAz), dEl = el - pEl;
  if (ant.type === 'sector') return sectorGain(G, dAz, dEl, ant.bwH, ant.bwV || 41253 * 0.6 / (ant.bwH * undb(G)));
  if (ant.type === 'bidir') { const a = abs(dAz), d2 = Math.min(a, 180 - a); return G - Math.min(12 * (d2 / ant.bwH) ** 2 + 12 * (dEl / ant.bwV) ** 2, ant.fb || 25); }
  if (ant.type === 'dir') return G - Math.min(12 * (dAz / ant.bwH) ** 2 + 12 * (dEl / ant.bwV) ** 2, ant.fb || 30);
  // great-circle off-axis angle on the sphere of directions
  const c = Math.cos(el * D2R) * Math.cos(pEl * D2R) * Math.cos(dAz * D2R) + Math.sin(el * D2R) * Math.sin(pEl * D2R);
  return f699(G, Math.acos(clamp(c, -1, 1)) * R2D);
}
function antHPBW(ant, fMHz) {
  if (ant.type === 'omni') return { h: 360, v: ant.bwV || 107.6 * pow(10, -0.1 * antGainMax(ant, fMHz)) };
  if (ant.type === 'sector') { const G = antGainMax(ant, fMHz); return { h: ant.bwH, v: ant.bwV || 41253 * 0.6 / (ant.bwH * undb(G)) }; }
  if (ant.type === 'dir' || ant.type === 'bidir') return { h: ant.bwH, v: ant.bwV };
  const G = antGainMax(ant, fMHz), dl = pow(10, (G - 7.7) / 20), hp = 2 * sqrt(3 / 2.5e-3) / dl; return { h: hp, v: hp };
}

/* ---------------- Equipment libraries ---------------- */
const ANTENNAS = {
  rd5g30: { name: 'RocketDish RD-5G30', type: 'dish', gain: 30, band: [5100, 5900], note: '30 dBi dual-pol dish, ~0.65 m' },
  rd5g34: { name: 'RocketDish RD-5G34', type: 'dish', gain: 34, band: [5100, 5900], note: '34 dBi dual-pol dish' },
  amo5g13: { name: 'airMAX Omni AMO-5G13', type: 'omni', gain: 13, bwV: 7, band: [5100, 5900], note: '13 dBi omni, 7° vertical beam' },
  sec120: { name: 'Sector 120° (generic)', type: 'sector', gain: 17, bwH: 120, band: [5100, 5900], note: 'Generic 17 dBi sector' },
  sec60: { name: 'Sector 60° (generic)', type: 'sector', gain: 20, bwH: 60, band: [5100, 5900], note: 'Generic 20 dBi sector' },
  dish06: { name: '0.6 m parabolic (licensed)', type: 'dish', D: 0.6, eff: 0.55, band: [6000, 40000], note: 'Gain from G = η(πD/λ)²' },
  dish09: { name: '0.9 m parabolic (licensed)', type: 'dish', D: 0.9, eff: 0.55, band: [6000, 40000], note: 'Gain from G = η(πD/λ)²' },
};
const NSD = { 10: 26, 20: 52, 30: 80, 40: 108, 50: 140, 60: 171, 80: 234 };
const RADIOS = {
  r5ac: {
    name: 'Rocket 5AC Prism (airMAX ac, 2×2)', short: 'R5AC', duplex: 'TDD', bwRef: 20, bws: [10, 20, 30, 40, 50, 60, 80], ptmpMaxBw: 40,
    nss: 2, nf: 6, minTx: 4, eff: { ptp: 0.60, ptmp: 0.50 }, latency: { ptp: 2.5, ptmp: 4.5 }, powerW: 8.5, mtbf: 150000,
    band: [5150, 5875], dataNote: 'TX/RX per MCS from datasheet (20 MHz reference); intermediate MCS interpolated.',
    mcs: [
      { n: 'MCS0', mod: 'BPSK 1/2', bits: 1, R: 1 / 2, tx: 27, sens: -96 }, { n: 'MCS1', mod: 'QPSK 1/2', bits: 2, R: 1 / 2, tx: 27, sens: -95 },
      { n: 'MCS2', mod: 'QPSK 3/4', bits: 2, R: 3 / 4, tx: 27, sens: -92 }, { n: 'MCS3', mod: '16QAM 1/2', bits: 4, R: 1 / 2, tx: 27, sens: -90 },
      { n: 'MCS4', mod: '16QAM 3/4', bits: 4, R: 3 / 4, tx: 27, sens: -86 }, { n: 'MCS5', mod: '64QAM 2/3', bits: 6, R: 2 / 3, tx: 26, sens: -81 },
      { n: 'MCS6', mod: '64QAM 3/4', bits: 6, R: 3 / 4, tx: 26, sens: -77 }, { n: 'MCS7', mod: '64QAM 5/6', bits: 6, R: 5 / 6, tx: 25, sens: -74 },
      { n: 'MCS8', mod: '256QAM 3/4', bits: 8, R: 3 / 4, tx: 23, sens: -69 }, { n: 'MCS9', mod: '256QAM 5/6', bits: 8, R: 5 / 6, tx: 22, sens: -65 }],
    phy(m, bw) { const M = this.mcs[m]; return this.nss * (NSD[bw] || 52 * bw / 20) * M.bits * M.R / 3.6; },  // Mbps (SGI)
  },
  lic11: {
    name: 'Licensed 11 GHz ODU (class-typical)', short: 'L11', duplex: 'FDD', bwRef: 56, bws: [28, 40, 56, 80], ptmpMaxBw: 0,
    nss: 1, nf: 5, minTx: -10, eff: { ptp: 0.95, ptmp: 0.95 }, latency: { ptp: 0.25, ptmp: 0.25 }, powerW: 45, mtbf: 300000,
    band: [10700, 11700], dataNote: 'Generic adaptive-modulation figures typical of the class, not a specific product.',
    mcs: [
      { n: 'QPSK', mod: 'QPSK', tx: 26, sens: -87, phyRef: 85 }, { n: '16QAM', mod: '16QAM', tx: 25, sens: -81, phyRef: 170 },
      { n: '32QAM', mod: '32QAM', tx: 24, sens: -78, phyRef: 212 }, { n: '64QAM', mod: '64QAM', tx: 24, sens: -75, phyRef: 255 },
      { n: '128QAM', mod: '128QAM', tx: 23, sens: -72, phyRef: 298 }, { n: '256QAM', mod: '256QAM', tx: 22, sens: -69, phyRef: 340 },
      { n: '512QAM', mod: '512QAM', tx: 21, sens: -66, phyRef: 382 }, { n: '1024QAM', mod: '1024QAM', tx: 20, sens: -63, phyRef: 425 }],
    phy(m, bw) { return this.mcs[m].phyRef * bw / 56; },
  },
};
const BANDS = [
  { id: 'u1', name: '5150–5350 MHz', lo: 5150, hi: 5350, cap: 23, note: 'Low-power RLAN (EN 301 893). Generally unsuitable for outdoor PtP.' },
  { id: 'u2', name: '5470–5725 MHz', lo: 5470, hi: 5725, cap: 30, dfs: true, note: 'RLAN with DFS/TPC (EN 301 893). 5600–5650 MHz weather-radar segment.' },
  { id: 'u3', name: '5725–5875 MHz', lo: 5725, hi: 5875, cap: 36, note: 'Fixed broadband (EN 302 502). 4 W EIRP per SADC harmonisation document.' },
  { id: 'l11', name: '10.7–11.7 GHz', lo: 10700, hi: 11700, cap: null, licensed: true, note: 'Licensed fixed service, coordinated by the regulator.' },
];
function findBand(bands, fc, bw) { return bands.find(b => fc - bw / 2 >= b.lo - 1e-6 && fc + bw / 2 <= b.hi + 1e-6) || null; }

/* ---------------- Availability helpers ---------------- */
function availabilityModel(mp, rain) {
  const U = margin => {                         // annual unavailability %, components
    if (!(margin > 0)) return { mp: 100, mpWM: 100, rain: 100, total: 100 };
    const a = mp.pAnnual(margin), w = mp.pw(margin), r = Math.min(rain.pOf(margin), 100);
    return { mp: a, mpWM: w, rain: r, total: Math.min(100, a + r) };
  };
  const marginFor = targetAvail => {            // margin needed so total unavailability ≤ 100 − target
    const t = 100 - targetAvail; let lo = 0, hi = 80;
    if (U(hi).total > t) return Infinity;
    for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (U(m).total > t) lo = m; else hi = m; }
    return hi;
  };
  return { U, marginFor };
}

/* ---------------- Link analysis ---------------- */
function analyzeLink(hop, ctx) {
  const { dem, sites, g } = ctx, A = sites[hop.a], B = sites[hop.b];
  const radio = RADIOS[hop.radio], antA = ANTENNAS[hop.antA], antB = ANTENNAS[hop.antB];
  const fc = hop.fc, fGHz = fc / 1000, lam = lambda(fc);
  let bw = hop.bw; const warnings = [];
  if (hop.mode === 'ptmp' && radio.ptmpMaxBw && bw > radio.ptmpMaxBw) { warnings.push(`PtMP limited to ${radio.ptmpMaxBw} MHz on ${radio.short}; channel reduced from ${bw} MHz.`); bw = radio.ptmpMaxBw; }
  const D0 = distKm(A.lat, A.lon, B.lat, B.lon);
  const n = clamp(Math.round(D0 * 1000 / 25), 64, 1500);
  const prof = profile(dem, A, B, n), D = prof.D;
  const hA = A.ground + (hop.mountA ?? A.mount), hB = B.ground + (hop.mountB ?? B.mount);
  const azAB = bearing(A.lat, A.lon, B.lat, B.lon), azBA = bearing(B.lat, B.lon, A.lat, A.lon);
  const ke = g.keAuto ? keApprox(D) : g.ke;
  const geoK = geometry(prof, hA, hB, fGHz, g.k, g.clutter), geoKe = geometry(prof, hA, hB, fGHz, ke, g.clutter), geoInf = geometry(prof, hA, hB, fGHz, 1e9, g.clutter);
  const diff = diffraction(g.diffModel, prof, geoK.y, hA, hB, lam);
  const diffAll = { none: 0, knife: knifeEdge(prof, geoK.y, hA, hB, lam).L, deygout: deygout(prof, geoK.y, hA, hB, lam).L, bullington: bullington(prof, geoK.y, hA, hB, lam).L };
  const diffKe = diffraction(g.diffModel === 'none' ? 'bullington' : g.diffModel, prof, geoKe.y, hA, hB, lam);
  const pHpa = pressureAt((A.ground + B.ground) / 2), gas = gasSpecific(fGHz, pHpa, g.tempC, g.rho);
  const Lgas = gas.g * D, Lfs = fspl(fc, D);
  const Dm = D * 1000, Re = g.k * RE * 1000;
  const elAB = Math.atan(((hB - hA) - Dm * Dm / (2 * Re)) / Dm) * R2D, elBA = Math.atan(((hA - hB) - Dm * Dm / (2 * Re)) / Dm) * R2D;
  // pointing: dishes auto-aim + misalignment; omni tilt; sector az
  const point = (ant, az, el, mis, end) => ant.type === 'omni' ? { az: 0, el: -(hop['tilt' + end] || 0) }
    : ant.type === 'sector' || ant.type === 'bidir' ? { az: (hop['secAz' + end] ?? az) + (mis?.az || 0), el: -(hop['tilt' + end] || 0) + (mis?.el || 0) }
      : { az: az + (mis?.az || 0), el: el + (mis?.el || 0) };
  const pA = point(antA, azAB, elAB, hop.misA, 'A'), pB = point(antB, azBA, elBA, hop.misB, 'B');
  const GA = antGain(antA, fc, azAB, elAB, pA.az, pA.el), GB = antGain(antB, fc, azBA, elBA, pB.az, pB.el);
  const GAmax = antGainMax(antA, fc), GBmax = antGainMax(antB, fc);
  const band = findBand(ctx.bands, fc, bw), cap = band ? band.cap : null, enforce = g.enforceEirp && cap != null;
  if (!band) warnings.push(`Channel ${fc - bw / 2}–${fc + bw / 2} MHz is not wholly inside a listed allocation.`);
  if (fc < radio.band[0] || fc > radio.band[1]) warnings.push(`${radio.short} does not operate at ${fc} MHz.`);
  if (antA.band && (fc < antA.band[0] || fc > antA.band[1])) warnings.push(`${antA.name} is not rated for ${fc} MHz.`);
  if (antB.band && antB !== antA && (fc < antB.band[0] || fc > antB.band[1])) warnings.push(`${antB.name} is not rated for ${fc} MHz.`);
  const Nth = -174 + db(bw * 1e6) + radio.nf;
  const Ibg = g.interf == null || g.interf <= -150 ? -Infinity : g.interf;
  const desense = Ibg === -Infinity ? 0 : db(1 + undb(Ibg - Nth));
  const bwPen = db(bw / radio.bwRef);
  const Lfixed = Lfs + diff.L + Lgas + g.miscLoss;
  const dirCalc = (Gt, Gtmax, Lt, Gr, Lr) => {
    const M = radio.mcs.length, ptx = [], eirp = [], rsl = [], sens = [], margin = [], snr = [], snrReq = [], phy = [];
    let compliant = true, backoff = 0;
    for (let m = 0; m < M; m++) {
      let p = hop.txPower ?? radio.mcs[m].tx;
      if (enforce) { const lim = cap - Gtmax + Lt; if (p > lim) { backoff = Math.max(backoff, p - lim); p = lim; } }
      if (p < radio.minTx) { p = radio.minTx; if (enforce) compliant = false; }
      ptx.push(p); eirp.push(p + Gtmax - Lt);
      const r = p + Gt - Lt - Lfixed + Gr - Lr; rsl.push(r);
      const s = radio.mcs[m].sens + bwPen + desense; sens.push(s); margin.push(r - s);
      snr.push(r - dbSum(Nth, Ibg)); snrReq.push(radio.mcs[m].sens + bwPen - Nth); phy.push(radio.phy(m, bw));
    }
    if (cap != null && !enforce && eirp[0] > cap + 1e-9) compliant = false;
    return { ptx, eirp, rsl, sens, margin, snr, snrReq, phy, compliant, backoff, Gt, Gr, Lt, Lr };
  };
  const ab = dirCalc(GA, GAmax, hop.lossA, GB, hop.lossB), ba = dirCalc(GB, GBmax, hop.lossB, GA, hop.lossA);
  if (!ab.compliant || !ba.compliant) warnings.push(`EIRP exceeds the ${cap} dBm cap for ${band?.name} even at minimum TX power (${radio.minTx.toFixed(1)} dBm).`);
  const lat = (A.lat + B.lat) / 2;
  const mp = multipathModel(D, fGHz, hA, hB, g.dN1, g.sa, lat);
  const rain = rainModel(fGHz, D, g.R001, hop.pol || 'V', lat);
  const av = availabilityModel(mp, rain);
  const propFM = av.marginFor(g.reqAvail);
  const designFM = Math.max(g.minFM, propFM);
  const pick = (dir, need) => { let best = -1; for (let m = 0; m < dir.margin.length; m++) if (dir.margin[m] >= need) best = m; return best; };
  const eff = radio.eff[hop.mode] || radio.eff.ptp;
  const capacity = (mAB, mBA) => {
    if (mAB < 0 || mBA < 0) return { agg: 0, ab: 0, ba: 0 };
    if (radio.duplex === 'FDD') { const x = eff * ab.phy[mAB], y = eff * ba.phy[mBA]; return { agg: x + y, ab: x, ba: y }; }
    const x = eff * g.duty * ab.phy[mAB], y = eff * (1 - g.duty) * ba.phy[mBA]; return { agg: x + y, ab: x, ba: y };
  };
  const clear = { ab: pick(ab, 0), ba: pick(ba, 0) }, design = { ab: pick(ab, designFM), ba: pick(ba, designFM) };
  clear.cap = capacity(clear.ab, clear.ba); design.cap = capacity(design.ab, design.ba);
  // capacity-availability ladder (symmetric MCS, weaker direction)
  const ladder = radio.mcs.map((M, m) => {
    const mg = Math.min(ab.margin[m], ba.margin[m]), u = av.U(mg);
    return { m, name: M.n, mod: M.mod, margin: mg, unavail: u.total, uMp: u.mp, uRain: u.rain, cap: capacity(m, m).agg };
  });
  const req = { fm: designFM, at: (100 - g.reqAvail) };
  const reqMcs = ladder.findIndex(l => l.cap >= g.reqThroughput);
  const fmAtReq = reqMcs >= 0 ? ladder[reqMcs].margin : -Infinity;
  const clr = {
    c43: geoK.minRatio, cke: geoKe.minRatio,
    rule1: geoK.minRatio >= g.clr1, rule2: geoKe.minRatio >= (g.obstacle === 'single' ? 0 : 0.3),
  };
  const latency = (radio.latency[hop.mode] || radio.latency.ptp) + D / 299.792458;
  return {
    hop, A, B, radio, antA, antB, fc, fGHz, bw, lam, D, prof, hA, hB, azAB, azBA, elAB, elBA, pA, pB, GA, GB, GAmax, GBmax,
    ke, geoK, geoKe, geoInf, diff, diffAll, diffKe, gas, Lgas, Lfs, pHpa, Lfixed, band, cap, enforce, Nth, Ibg, desense, bwPen,
    ab, ba, mp, rain, av, propFM, designFM, clear, design, ladder, reqMcs, fmAtReq, clr, latency, eff, warnings, req,
  };
}

/* Diffraction loss as a function of K for the simulation (lookup table) */
function diffVsK(L, model, gmin = -150, gmax = 400, N = 111) {
  const tbl = new Float64Array(N), gs = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const gr = gmin + (gmax - gmin) * i / (N - 1), K = kFromGradient(gr);
    const y = effHeights(L.prof, K, 0); gs[i] = gr;
    tbl[i] = diffraction(model === 'none' ? 'bullington' : model, L.prof, y, L.hA, L.hB, L.lam).L;
  }
  return { gs, tbl, at: gr => { const t = clamp((gr - gmin) / (gmax - gmin) * (N - 1), 0, N - 1.0001), i = t | 0, f = t - i; return tbl[i] * (1 - f) + tbl[i + 1] * f; } };
}

/* ---------------- Network / architecture ---------------- */
function evalNetwork(arch, ctx) {
  const links = arch.hops.map(h => analyzeLink(h, ctx));
  const caps = links.map(l => l.design.cap.agg), clearCaps = links.map(l => l.clear.cap.agg);
  const shared = arch.topology === 'ptmp';
  const combine = cs => cs.some(c => !(c > 0)) ? 0 : shared ? 1 / cs.reduce((s, c) => s + 1 / c, 0) : Math.min(...cs);
  const e2e = combine(caps), e2eClear = combine(clearCaps);
  const propAvail = links.reduce((p, l) => p * (1 - l.av.U(Math.min(l.ab.margin[Math.max(0, l.design.ab)], l.ba.margin[Math.max(0, l.design.ba)])).total / 100), 1) * 100;
  const latency = links.reduce((s, l) => s + l.latency, 0) + 0.05 * (links.length + 1);
  // channel overlaps between hops that share a site
  const overlaps = [];
  for (let i = 0; i < links.length; i++) for (let j = i + 1; j < links.length; j++) {
    const a = links[i], b = links[j]; if (shared) continue;
    const share = [a.hop.a, a.hop.b].some(s => s === b.hop.a || s === b.hop.b);
    const lo = Math.max(a.fc - a.bw / 2, b.fc - b.bw / 2), hi = Math.min(a.fc + a.bw / 2, b.fc + b.bw / 2);
    if (hi > lo) overlaps.push({ i, j, mhz: hi - lo, cosite: share });
  }
  const radios = shared ? links.length + 1 : links.length * 2;
  return { arch, links, e2e, e2eClear, propAvail, latency, overlaps, radios, shared, meets: e2e >= ctx.g.reqThroughput };
}

/* Hardware (series reliability block) availability */
function hardwareAvail(items) {
  let A = 1; const rows = items.map(it => { const a = it.mtbf / (it.mtbf + it.mttr); A *= Math.pow(a, it.qty); return { ...it, a: Math.pow(a, it.qty) }; });
  return { A: A * 100, rows };
}

/* ---------------- Statistics helpers for simulation ---------------- */
function normCdf(x) { const t = 1 / (1 + 0.2316419 * abs(x)), d = 0.3989422804014327 * exp(-x * x / 2);
  const p = d * t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429)))); return x > 0 ? 1 - p : p; }
function randn(rng) { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return sqrt(-2 * Math.log(u)) * Math.cos(2 * PI * v); }
function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* Inverse-CDF table for a fade-depth distribution given exceedance P(A ≥ a) (fraction) */
function fadeTable(exceed, aMax = 60, da = 0.05) {
  const N = Math.round(aMax / da) + 1, a = new Float64Array(N), p = new Float64Array(N);
  for (let i = 0; i < N; i++) { a[i] = i * da; p[i] = clamp(exceed(a[i]), 0, 1); }
  for (let i = 1; i < N; i++) if (p[i] > p[i - 1]) p[i] = p[i - 1];  // enforce monotone
  return { sample: q => {                                             // q = exceedance probability
    if (q >= p[0]) return 0; if (q <= p[N - 1]) return aMax;
    let lo = 0, hi = N - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p[m] > q) lo = m; else hi = m; }
    const f = (Math.log(q) - Math.log(p[lo])) / (Math.log(p[hi]) - Math.log(p[lo]) || 1); return a[lo] + f * (a[hi] - a[lo]);
  }, a, p };
}

/* Simulation of one hop: Gaussian-copula fades with ITU marginals + K-factor process + interference bursts */
function makeHopSim(L, ctx, env, seed) {
  const g = ctx.g, rng = mulberry32(seed);
  const dvk = diffVsK(L, g.diffModel);
  const mpT = fadeTable(a => L.mp.pw(a) / 100), P0 = g.rainP0 / 100;
  const rnT = fadeTable(a => a <= 0 ? P0 : Math.min(P0, L.rain.pOf(a) / 100));
  const muG = gradientFromK(g.k), ke = L.ke, sigG = Math.max(5, (gradientFromK(ke) - muG) / 3.09);
  const M = L.radio.mcs.length;
  // clear-sky RSL without diffraction term (diffraction applied from K process)
  const base = dir => dir.rsl.map(r => r + L.diff.L);
  const baseAB = base(L.ab), baseBA = base(L.ba);
  const s = { t: 0, zMp: randn(rng), zRain: randn(rng), zK: randn(rng), iA: 0, iB: 0, lvA: 0, lvB: 0, mAB: M - 1, mBA: M - 1 };
  const step = (dt, drivers) => {
    const rMp = exp(-dt / 4), rRain = exp(-dt / 600), rK = exp(-dt / 1800);
    s.zMp = rMp * s.zMp + sqrt(1 - rMp * rMp) * randn(rng);
    s.zRain = drivers && drivers.zRain != null ? drivers.zRain : rRain * s.zRain + sqrt(1 - rRain * rRain) * randn(rng);
    s.zK = drivers && drivers.zK != null ? drivers.zK : rK * s.zK + sqrt(1 - rK * rK) * randn(rng);
    s.t += dt;
    const diurnal = -18 * Math.cos(2 * PI * ((s.t / 3600) % 24 - 4) / 24);           // stronger super-refraction pre-dawn
    const grad = muG + diurnal * 0.5 + s.zK * sigG + (drivers && drivers.gradOff || 0);
    const Kt = kFromGradient(Math.max(-150, grad));
    const Ld = dvk.at(Math.max(-150, grad));
    const Amp = mpT.sample(1 - normCdf(s.zMp));
    const Arain = rnT.sample(1 - normCdf(s.zRain)) + (drivers && drivers.stormA || 0);
    // interference on/off (Gilbert–Elliott), per receiver
    const pOn = dt / env.tOn * env.duty / Math.max(1e-6, 1 - env.duty), pOff = dt / env.tOn;
    const flip = (on, key) => { if (on) return rng() < pOff ? 0 : 1; return rng() < pOn ? 1 : 0; };
    const wasA = s.iA, wasB = s.iB; s.iA = flip(s.iA); s.iB = flip(s.iB);
    if (s.iA && !wasA) s.lvA = env.mu + env.sigma * randn(rng);
    if (s.iB && !wasB) s.lvB = env.mu + env.sigma * randn(rng);
    let IA = s.iA ? dbSum(L.Ibg, s.lvA) : L.Ibg, IB = s.iB ? dbSum(L.Ibg, s.lvB) : L.Ibg;
    if (drivers && drivers.forceI != null) { IA = dbSum(IA, drivers.forceI); IB = dbSum(IB, drivers.forceI); }
    const fade = Amp + Arain + Ld;
    const dirStep = (baseR, dir, I, cur) => {
      const des = I === -Infinity ? 0 : db(1 + undb(I - L.Nth)), mg = m => baseR[m] - fade - (L.radio.mcs[m].sens + L.bwPen + des);
      let m = cur; while (m >= 0 && mg(m) < 0) m--;                   // downshift immediately
      if (m < 0) { m = -1; for (let k = 0; k < M; k++) if (mg(k) >= 2) m = k; }
      else while (m < M - 1 && mg(m + 1) >= 2) m++;                   // upshift with 2 dB hysteresis
      const r = m >= 0 ? baseR[m] - fade : baseR[0] - fade;
      return { m, rsl: r, sinr: r - dbSum(L.Nth, I), I, des };
    };
    const x = dirStep(baseAB, L.ab, IB, s.mAB < 0 ? M - 1 : s.mAB), y = dirStep(baseBA, L.ba, IA, s.mBA < 0 ? M - 1 : s.mBA);
    s.mAB = x.m; s.mBA = y.m;
    const eff = L.eff;
    let thr = 0;
    if (x.m >= 0 && y.m >= 0) thr = L.radio.duplex === 'FDD' ? eff * (L.ab.phy[x.m] + L.ba.phy[y.m]) : eff * (g.duty * L.ab.phy[x.m] + (1 - g.duty) * L.ba.phy[y.m]);
    return { t: s.t, K: Kt, grad, Ld, Amp, Arain, fade, ab: x, ba: y, thr, intA: s.iA || (drivers && drivers.forceI != null) ? 1 : 0, intB: s.iB };
  };
  return { step, state: s, dvk, sigG, muG };
}

const ENV = {
  clean: { name: 'Quiet rural spectrum', duty: 0.002, tOn: 20, mu: -88, sigma: 4 },
  moderate: { name: 'Other 5 GHz operators nearby', duty: 0.02, tOn: 30, mu: -80, sigma: 5 },
  congested: { name: 'Congested 5 GHz spectrum', duty: 0.10, tOn: 45, mu: -72, sigma: 6 },
};

return {
  C, RE, db, undb, clamp, dbSum, makeDEM, distKm, bearing, profile, lambda, fspl, fresnelR, bulge, kFromGradient, gradientFromK,
  J, nuFactor, effHeights, geometry, knifeEdge, deygout, bullington, diffraction, gasSpecific, pressureAt, rainCoef, rainModel, rainSpecific,
  multipathModel, keApprox, dishGain, antGainMax, f699, f1336omni, sectorGain, antGain, antHPBW, wrap180, ANTENNAS, RADIOS, BANDS, NSD, findBand,
  availabilityModel, analyzeLink, diffVsK, evalNetwork, hardwareAvail, normCdf, randn, mulberry32, fadeTable, makeHopSim, ENV,
};
})();
if (typeof module !== 'undefined') module.exports = RF;
