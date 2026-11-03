/* =====================================================================
   TOPOLOGY — physical/logical diagram with IEC 62443 zones and conduits
   ===================================================================== */
regTab('topo', () => {}, renderTopo);
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
function renderTopo() {
  const pane = $('#pane-topo'); pane.innerHTML = ''; pane.classList.add('g-two');
  const A = arch(), lic = A.hops[0].radio === 'lic11', ptmp = A.topology === 'ptmp';
  const stc = st => `var(${ST_VAR[st]})`;
  const hopTo = id => NET.links.find(L => L.hop.a === id || L.hop.b === id);
  const Lw = hopTo('wwtp'), Le = hopTo('eng');
  const zx = { wwtp: 20, sr3: 420, eng: 820 }, ZW = 360;
  const RAD = RF.RADIOS[A.hops[0].radio], radioName = RAD.model || RAD.name, radioWire = lic ? 'IF cable / 1 GbE' : RAD.mounting === 'panel' ? 'Radio in panel, coax up the mast' : 'PoE, shielded Cat6, SPD';
  let s = `<svg viewBox="0 0 1200 640" role="img" aria-label="Network topology diagram" style="width:100%;height:auto;display:block;font-family:var(--font-ui)">`;
  s += `<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" fill="var(--ink-2)"/></marker></defs>`;
  const zones = [['wwtp', 'Zone: WWTP control network', 'Operational technology'], ['sr3', 'Conduit: radio backhaul', 'Relay only, no process equipment'], ['eng', "Zone: Engineer's Office", 'Supervisory view node']];
  for (const [id, t, sub] of zones) { const c = CTX.sites[id], x = zx[id];
    s += `<rect x="${x}" y="150" width="${ZW}" height="470" rx="12" fill="var(--panel)" stroke="var(--rule)" stroke-dasharray="${id === 'sr3' ? '0' : '6 4'}"/>`;
    s += `<text x="${x + 16}" y="176" font-size="14" font-weight="600" fill="var(--ink)">${esc(t)}</text><text x="${x + 16}" y="194" font-size="12" fill="var(--ink-2)">${esc(sub)}. Ground ${f1(c.ground, 0)} m, antenna ${c.mount} m</text>`; }
  const dev = (x, y, w, icon, role, model, st) => {
    let ic = ''; const ix = x + 12, iy = y + 11;
    if (icon === 'radio') ic = `<rect x="${ix}" y="${iy + 4}" width="20" height="14" rx="2" fill="none" stroke="currentColor"/><path d="M${ix + 5} ${iy + 2}q5 -6 10 0M${ix + 2} ${iy - 1}q8 -9 16 0" fill="none" stroke="currentColor"/>`;
    if (icon === 'switch') ic = `<rect x="${ix}" y="${iy + 3}" width="22" height="16" rx="2" fill="none" stroke="currentColor"/><path d="M${ix + 4} ${iy + 8}h13l-3 -3M${ix + 18} ${iy + 14}h-13l3 3" fill="none" stroke="currentColor"/>`;
    if (icon === 'router') ic = `<circle cx="${ix + 11}" cy="${iy + 11}" r="10" fill="none" stroke="currentColor"/><path d="M${ix + 11} ${iy + 3}v16M${ix + 3} ${iy + 11}h16" stroke="currentColor"/>`;
    if (icon === 'fw') ic = `<rect x="${ix}" y="${iy + 2}" width="22" height="18" fill="none" stroke="currentColor"/><path d="M${ix} ${iy + 8}h22M${ix} ${iy + 14}h22M${ix + 7} ${iy + 2}v6M${ix + 15} ${iy + 8}v6M${ix + 7} ${iy + 14}v6" stroke="currentColor"/>`;
    if (icon === 'plc') ic = `<rect x="${ix}" y="${iy + 1}" width="22" height="20" rx="2" fill="none" stroke="currentColor"/><path d="M${ix + 4} ${iy + 6}h4M${ix + 4} ${iy + 11}h4M${ix + 4} ${iy + 16}h4M${ix + 13} ${iy + 5}v12" stroke="currentColor"/>`;
    if (icon === 'pc') ic = `<rect x="${ix}" y="${iy + 1}" width="22" height="14" rx="1" fill="none" stroke="currentColor"/><path d="M${ix + 7} ${iy + 20}h8M${ix + 11} ${iy + 15}v5" stroke="currentColor"/>`;
    if (icon === 'ups') ic = `<rect x="${ix}" y="${iy + 5}" width="20" height="12" rx="2" fill="none" stroke="currentColor"/><path d="M${ix + 20} ${iy + 9}h3v4h-3M${ix + 9} ${iy + 7}l-3 4h5l-3 4" fill="none" stroke="currentColor"/>`;
    return `<g color="var(--ink-2)"><rect x="${x}" y="${y}" width="${w}" height="44" rx="6" fill="var(--paper)" stroke="var(--rule)"/>${ic}<text x="${x + 44}" y="${y + 19}" font-size="12.5" font-weight="600" fill="var(--ink)">${esc(role)}</text><text x="${x + 44}" y="${y + 34}" font-size="11.5" fill="var(--ink-2)">${esc(model)}</text><circle cx="${x + w - 12}" cy="${y + 12}" r="4.5" fill="${stc(st)}"/></g>`;
  };
  const wire = (x, y0, y1, label) => `<line x1="${x}" y1="${y0}" x2="${x}" y2="${y1}" stroke="var(--ink-2)" stroke-width="1.6"/><text x="${x + 7}" y="${(y0 + y1) / 2 + 4}" font-size="11" fill="var(--ink-2)">${esc(label)}</text>`;
  const endSite = (id, L, endpoint) => {
    const x = zx[id] + 70, w = 220, st = L ? hopStatus(L) : 'ok', rows = [[214, 'radio', 'Radio', radioName, st], [290, 'switch', 'Managed switch', 'Moxa, VLAN, IGMP, QoS', 'ok'], [366, 'router', 'Router', 'EdgeRouter, static routes', 'ok'], [442, 'fw', 'Firewall', 'FortiGate, zone policy', 'ok'], [518, endpoint[0], endpoint[1], endpoint[2], 'ok']];
    let o = ''; rows.forEach(([y, ic, r, m, sst], k) => { o += dev(x, y, w, ic, r, m, sst); if (k < rows.length - 1) o += wire(x + 26, y + 44, rows[k + 1][0], k === 0 ? radioWire : k === 3 ? (id === 'wwtp' ? 'Fibre, 1000BASE-LX' : '1 GbE copper') : '1 GbE, 802.1Q trunk'); });
    o += dev(x + 120, 580, 130, 'ups', 'DC UPS', `${S.pw.volts} V battery`, 'ok').replace('height="44"', 'height="34"');
    return o; };
  s += endSite('wwtp', Lw, ['plc', 'Existing Rockwell network', 'PLCs, SCADA servers']);
  s += endSite('eng', Le, ['pc', 'SCADA ViewNode', 'PC and 2 × 42″ displays']);
  const sx = zx.sr3;
  if (ptmp) { s += dev(sx + 70, 214, 220, 'radio', 'Access point radio', radioName + ', omni', hopStatus(Lw) === 'bad' || hopStatus(Le) === 'bad' ? 'bad' : 'ok'); s += wire(sx + 96, 258, 290, 'PoE, shielded Cat6'); }
  else { s += dev(sx + 14, 214, 160, 'radio', 'Radio to WWTP', radioName, hopStatus(Lw)); s += dev(sx + 186, 214, 160, 'radio', 'Radio to office', radioName, hopStatus(Le));
    s += `<path d="M${sx + 94} 258V274H${sx + 180}V290M${sx + 266} 258V274H${sx + 180}" fill="none" stroke="var(--ink-2)" stroke-width="1.6"/><text x="${sx + 186}" y="284" font-size="11" fill="var(--ink-2)">PoE</text>`; }
  s += dev(sx + 70, 290, 220, 'switch', 'Managed switch', 'Moxa, layer-2 bridge', 'ok') + dev(sx + 70, 580, 130, 'ups', 'DC UPS', `${S.pw.volts} V battery`, 'ok').replace('height="44"', 'height="34"');
  s += `<text x="${sx + 30}" y="400" font-size="12" fill="var(--ink-2)"><tspan x="${sx + 30}">The relay bridges the two hops at layer 2.</tspan><tspan x="${sx + 30}" dy="17">No routing or firewalling here keeps the</tspan><tspan x="${sx + 30}" dy="17">high site simple and low-maintenance.</tspan></text>`;
  // antennas and RF links
  const antTop = { wwtp: [zx.wwtp + 180, 110], eng: [zx.eng + 180, 110], sr3W: [sx + (ptmp ? 180 : 94), 110], sr3E: [sx + (ptmp ? 180 : 266), 110] };
  const mast = ([x, y], toY, type) => `<line x1="${x}" y1="${y}" x2="${x}" y2="${toY}" stroke="var(--ink-2)" stroke-width="2"/>` + (type === 'omni' ? `<rect x="${x - 3}" y="${y - 22}" width="6" height="24" rx="3" fill="var(--ink)"/>` : `<path d="M${x - 9} ${y - 14}q9 12 0 26" fill="none" stroke="var(--ink)" stroke-width="3"/>`);
  s += mast(antTop.wwtp, 214, 'dish') + mast(antTop.eng, 214, 'dish') + mast(antTop.sr3W, 214, ptmp ? 'omni' : 'dish') + (ptmp ? '' : mast(antTop.sr3E, 214, 'dish'));
  const rf = (p, q, L) => { if (!L) return ''; const st = hopStatus(L), mx = (p[0] + q[0]) / 2, my = 48, m = Math.max(0, L.design.ab), mod = L.design.ab >= 0 ? L.radio.mcs[m].mod : 'no service';
    return `<path d="M${p[0]} ${p[1] - 18}Q${mx} ${my - 40} ${q[0]} ${q[1] - 18}" fill="none" stroke="${stc(st)}" stroke-width="3" stroke-dasharray="9 6" marker-start="url(#ar)" marker-end="url(#ar)"/>
      <g><rect x="${mx - 125}" y="${my - 36}" width="250" height="56" rx="6" fill="var(--panel)" stroke="${stc(st)}"/><text x="${mx}" y="${my - 18}" text-anchor="middle" font-size="12.5" font-weight="600" fill="var(--ink)">${esc(hopName(L.hop))}, ${f1(L.D, 2)} km</text>
      <text x="${mx}" y="${my - 2}" text-anchor="middle" font-size="11.5" fill="var(--ink-2)">${L.fc} MHz, ${L.bw} MHz, ${esc(mod)}</text><text x="${mx}" y="${my + 13}" text-anchor="middle" font-size="11.5" fill="var(--ink-2)">${fMb(L.design.cap.agg)}, margin ${fm(Math.min(L.ab.margin[m], L.ba.margin[Math.max(0, L.design.ba)]))} dB</text></g>`; };
  s += rf(antTop.wwtp, antTop.sr3W, Lw) + rf(antTop.sr3E, antTop.eng, Le) + '</svg>';
  const card = h('div', { class: 'card span2' }, h('h3', {}, `Topology: ${A.name}`), h('p', { class: 'cap' }, 'Physical and logical layout with IEC 62443 zones joined by the radio conduit. Status lights follow the link analysis; dashed RF paths are colour-coded by fade margin at the required rate.'), h('div', { class: 'tw', html: s }));
  const lat = NET.links.map(L => [hopName(L.hop), L.latency]);
  const hw = hwAvail(S.arch), Atot = NET.propAvail / 100 * hw.A / 100 * 100;
  const path = h('div', { class: 'card' }, h('h3', {}, 'End-to-end path'), h('table', { class: 't' },
    h('tr', {}, h('th', {}, 'Element'), h('th', {}, 'Latency'), h('th', {}, 'Capacity')),
    ...NET.links.map(L => h('tr', {}, h('td', {}, 'RF: ' + hopName(L.hop)), h('td', {}, f1(L.latency, 2) + ' ms'), h('td', {}, fMb(L.design.cap.agg)))),
    h('tr', {}, h('td', {}, 'Switching and firewalls'), h('td', {}, f1(NET.latency - lat.reduce((a, b) => a + b[1], 0), 2) + ' ms'), h('td', {}, '1000 Mbps')),
    h('tr', { class: 'sel' }, h('td', {}, 'End to end'), h('td', {}, f1(NET.latency, 2) + ' ms'), h('td', {}, fMb(NET.e2e)))),
    h('dl', { class: 'kv', style: 'margin-top:10px' }, h('dt', {}, 'Propagation availability'), h('dd', {}, fAvail(NET.propAvail) + ' %'), h('dt', {}, 'Equipment availability'), h('dd', {}, fAvail(hw.A) + ' %'), h('dt', {}, 'Combined'), h('dd', {}, `${fAvail(Atot)} % (${fDur(mins(100 - Atot))} per year)`)));
  const vl = [['10', 'OT control', 'EtherNet/IP, CIP, SCADA server traffic', '10.10.10.0/24'], ['20', 'Supervisory view', 'ViewNode clients at the office', '10.10.20.0/24'], ['99', 'Network management', 'Radios, switches, UPS (SNMP, NTP, syslog)', '10.10.99.0/24']];
  const vlan = h('div', { class: 'card' }, h('h3', {}, 'Proposed VLAN plan'), h('p', { class: 'cap' }, 'An example segmentation to align with WUC IT/OT standards. The firewalls form the conduit policy: only named SCADA client–server flows and engineering hosts cross between zones.'),
    h('table', { class: 't' }, h('tr', {}, h('th', {}, 'VLAN'), h('th', {}, 'Purpose'), h('th', {}, 'Carries'), h('th', {}, 'Subnet')), ...vl.map(r => h('tr', {}, ...r.map(c => h('td', {}, c))))));
  pane.append(card, path, vlan);
}

/* =====================================================================
   LIVE SIMULATION + MONTE CARLO YEAR
   ===================================================================== */
const SIM = { running: false, hops: null, hist: [], log: [], key: null, last: 0, year: null };
let SIMC;
regTab('sim', initSim, renderSim);
const simKey = () => JSON.stringify([S.arch, S.archs[S.arch], S.mounts, S.g, S.caps, S.sim.env]);
function simReset() {
  SIM.links = NET.links; SIM.shared = NET.shared; SIM.hops = NET.links.map((L, i) => RF.makeHopSim(L, CTX, RF.ENV[S.sim.env], 9001 + i * 131));
  Object.assign(SIM, { t: 0, acc: 0, hist: [], log: [], zK: 0, zR: 0, own: NET.links.map(() => 0), rng: RF.mulberry32(4242), storm: null, subref: null, burst: null, lastRec: -1e9,
    st: { n: 0, up: 0, meet: 0, sum: 0, min: Infinity }, prev: NET.links.map(() => ({ m: null, rain: false, intf: false, out: false })), prevK: false, key: simKey() });
}
const combineCaps = (cs, shared) => cs.some(c => !(c > 0)) ? 0 : shared ? 1 / cs.reduce((s, c) => s + 1 / c, 0) : Math.min(...cs);
const clock = t => { const d = Math.floor(t / 86400), r = t % 86400; return `${d ? `Day ${d + 1} ` : ''}${String(Math.floor(r / 3600)).padStart(2, '0')}:${String(Math.floor(r % 3600 / 60)).padStart(2, '0')}:${String(Math.floor(r % 60)).padStart(2, '0')}`; };
function simStepAll(dt, record) {
  const rn = () => RF.randn(SIM.rng), aK = Math.exp(-dt / 1800), aR = Math.exp(-dt / 600);
  SIM.zK = aK * SIM.zK + Math.sqrt(1 - aK * aK) * rn(); SIM.zR = aR * SIM.zR + Math.sqrt(1 - aR * aR) * rn();
  const t = SIM.t + dt; let gradOff = 0, stormR = 0, forceHop = -1;
  if (SIM.subref != null) { const u = (t - SIM.subref) / 1800; if (u > 1) SIM.subref = null; else gradOff = 300 * Math.sin(Math.PI * u); }
  if (SIM.storm != null) { const u = (t - SIM.storm) / 1200; if (u > 1) SIM.storm = null; else stormR = 130 * Math.sin(Math.PI * u); }
  if (SIM.burst) { if (t - SIM.burst.t0 > 150) SIM.burst = null; else forceHop = SIM.burst.hop; }
  const out = SIM.hops.map((hs, i) => {
    SIM.own[i] = aR * SIM.own[i] + Math.sqrt(1 - aR * aR) * rn(); const L = SIM.links[i];
    const stormA = stormR > 0.5 ? RF.rainModel(L.fGHz, L.D, stormR, L.hop.pol || 'V', 0).A001 : 0;
    return hs.step(dt, { zK: SIM.zK, zRain: 0.7 * SIM.zR + 0.714 * SIM.own[i], gradOff, stormA, forceI: forceHop === i ? -62 : null });
  });
  SIM.t = t; const caps = out.map(o => o.thr), e2e = combineCaps(caps, SIM.shared), st = SIM.st, req = S.g.reqThroughput;
  st.n++; if (e2e > 0) st.up++; if (e2e >= req) st.meet++; st.sum += e2e; st.min = Math.min(st.min, e2e);
  if (!record) return out;
  out.forEach((o, i) => { const p = SIM.prev[i], nm = hopName(SIM.links[i].hop), mcs = SIM.links[i].radio.mcs;
    const cause = () => { const c = [['rain', o.Arain], ['diffraction (K = ' + o.K.toFixed(2) + ')', o.Ld - SIM.links[i].diff.L], ['multipath', o.Amp]].sort((a, b) => b[1] - a[1]); return o.intA || o.intB ? 'interference' : c[0][0]; };
    if (o.thr <= 0 && !p.out) logEv(`${nm}: link down, ${cause()}`, 'bad'); else if (o.thr > 0 && p.out) logEv(`${nm}: link restored at ${mcs[o.ab.m].mod}`, 'ok');
    else if (p.m != null && o.ab.m >= 0 && o.ab.m <= p.m - 2) logEv(`${nm}: ${mcs[p.m].mod} → ${mcs[o.ab.m].mod}, ${cause()}`, 'warn');
    if (o.Arain > 0.5 && !p.rain) logEv(`${nm}: rain fade ${o.Arain.toFixed(1)} dB`, 'warn');
    if ((o.intA || o.intB) && !p.intf) logEv(`${nm}: interference burst at a receiver`, 'warn');
    p.out = o.thr <= 0; p.m = o.ab.m; p.rain = o.Arain > 0.5; p.intf = !!(o.intA || o.intB); });
  const K = out[0] ? out[0].K : 4 / 3; if (K < 1 && !SIM.prevK) logEv(`Sub-refraction: K fell to ${K.toFixed(2)}`, 'warn'); SIM.prevK = K < 1;
  const rec = Math.max(1, S.sim.speed / 10); if (SIM.t - SIM.lastRec >= rec) { SIM.lastRec = SIM.t; const si = typeof S.sel === 'number' && S.sel < out.length ? S.sel : 0, o = out[si];
    SIM.hist.push({ t: SIM.t, e2e, caps, rAB: o.ab.rsl, rBA: o.ba.rsl, sAB: o.ab.sinr, mAB: o.ab.m, Ar: o.Arain, Ld: o.Ld, Am: o.Amp, int: o.intA || o.intB, K: o.K, si }); if (SIM.hist.length > 600) SIM.hist.shift(); }
  return out;
}
function logEv(t, cls) { SIM.log.unshift({ t: SIM.t, msg: t, cls }); if (SIM.log.length > 200) SIM.log.pop(); }
function initSim() {
  const pane = $('#pane-sim'); pane.classList.add('g-two');
  const bar = h('div', { class: 'card span2' }, h('h3', {}, 'Live link simulation'), h('p', { class: 'cap' }, 'A stochastic replay of the network: Gaussian-copula fades with ITU-R P.530 marginals, a refractivity process calibrated to kₑ, correlated rain, and on/off interference. Each radio adapts its modulation with 2 dB hysteresis.'),
    h('div', { class: 'row' }, h('button', { class: 'btn pri', id: 'simPlay', onclick: () => { SIM.running = !SIM.running; renderSimBar(); } }, 'Start'),
      h('button', { class: 'btn', onclick: () => { simReset(); renderSim(); } }, 'Reset'),
      h('label', { class: 'tog' }, 'Speed', h('select', { id: 'simSpeed', onchange: e => { S.sim.speed = +e.target.value; save(); } }, [[1, 'Real time'], [10, '10×'], [60, '1 min/s'], [600, '10 min/s'], [3600, '1 h/s']].map(([v, t]) => h('option', { value: v, selected: S.sim.speed === v }, t)))),
      h('label', { class: 'tog' }, 'Spectrum', h('select', { onchange: e => { S.sim.env = e.target.value; save(); simReset(); renderSim(); } }, Object.entries(RF.ENV).map(([k, v]) => h('option', { value: k, selected: S.sim.env === k }, v.name)))),
      h('span', { style: 'flex:1' }),
      h('button', { class: 'btn sm', onclick: () => { SIM.storm = SIM.t; logEv('Storm cell injected: 130 mm/h peak over 20 min', 'warn'); } }, 'Inject storm cell'),
      h('button', { class: 'btn sm', onclick: () => { SIM.subref = SIM.t; logEv('Sub-refraction event injected: +300 N/km for 30 min', 'warn'); } }, 'Inject sub-refraction'),
      h('button', { class: 'btn sm', onclick: () => { SIM.burst = { t0: SIM.t, hop: typeof S.sel === 'number' ? S.sel : 0 }; logEv('Interference burst injected: −62 dBm for 150 s', 'warn'); } }, 'Inject interference')),
    h('div', { class: 'statgrid', id: 'simStats', style: 'margin-top:10px' }));
  const c1 = chartCard('Received signal level', 'Selected hop, both directions. Dashed lines are sensitivities of the lowest, design and highest modulation; red bands mark interference.', { aspect: 2.1 }, drawSimRsl);
  const c2 = chartCard('Throughput', 'End-to-end (heavy) and each hop (light) against the requirement.', { aspect: 2.1 }, drawSimThr);
  const c3 = chartCard('Fade contributions', 'Rain, extra diffraction from refractivity and multipath on the selected hop.', { aspect: 2.1 }, drawSimFade);
  const lg = h('div', { class: 'card' }, h('h3', {}, 'Event log'), h('div', { class: 'log', id: 'simLog' }));
  const mc = h('div', { class: 'card span2' }, h('h3', {}, 'Monte Carlo: one simulated year'), h('p', { class: 'cap' }, '525 600 one-minute steps per hop with the same physics, compared with the closed-form ITU-R P.530 prediction. Interference is included here but not in the analytic figure.'),
    h('div', { class: 'row' }, h('button', { class: 'btn pri', id: 'mcBtn', onclick: runYear }, 'Simulate one year'), h('div', { class: 'prog' }, h('i', { id: 'mcProg' }))), h('div', { id: 'mcOut', class: 'g-two', style: 'display:grid;gap:14px;margin-top:12px' }));
  pane.append(bar, c1, c2, c3, lg, mc); SIMC = { c1, c2, c3 };
  let last = performance.now();
  const tick = ts => { requestAnimationFrame(tick); const dtF = Math.min(0.1, (ts - last) / 1000); last = ts;
    if (S.tab !== 'sim' || !SIM.running || document.hidden) return;
    if (SIM.key !== simKey()) simReset();
    const dt = S.sim.speed >= 600 ? 10 : S.sim.speed >= 60 ? 2 : 1; SIM.acc += S.sim.speed * dtF; let it = 0;
    while (SIM.acc >= dt && it < 4000) { simStepAll(dt, true); SIM.acc -= dt; it++; }
    if (ts - SIM.last > 60) { SIM.last = ts; renderSimLive(); } };
  requestAnimationFrame(tick);
}
function renderSim() { if (!SIM.hops || SIM.key !== simKey()) simReset(); renderSimBar(); renderSimLive(); }
function renderSimBar() { const b = $('#simPlay'); if (b) b.textContent = SIM.running ? 'Pause' : 'Start'; }
function renderSimLive() {
  const st = SIM.st, last = SIM.hist[SIM.hist.length - 1], L = SIM.links[last ? last.si : 0];
  const tiles = [[clock(SIM.t), 'Simulated time'], [st.n ? fAvail(100 * st.up / st.n) + ' %' : '—', 'Availability so far'], [st.n ? f1(100 * st.meet / st.n, 2) + ' %' : '—', `Time at ≥ ${S.g.reqThroughput} Mbps`],
    [st.n ? f1(st.sum / st.n, 0) : '—', 'Mean Mbps end-to-end'], [last ? f1(last.e2e, 0) : '—', 'Mbps now'], [last && last.mAB >= 0 ? L.radio.mcs[last.mAB].mod : '—', 'Modulation now'], [last ? last.K.toFixed(2) : '—', 'K-factor now']];
  const g = $('#simStats'); if (g) { g.innerHTML = ''; tiles.forEach(([v, t]) => g.append(h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, t)))); }
  const lg = $('#simLog'); if (lg) { lg.innerHTML = ''; if (!SIM.log.length) lg.append(h('p', { class: 'note' }, 'Start the simulation or inject an event to see modulation changes, fades and outages here.'));
    SIM.log.slice(0, 80).forEach(e => lg.append(h('div', {}, h('span', {}, clock(e.t)), h('span', { class: e.cls === 'bad' ? 'neg' : e.cls === 'ok' ? 'pos' : '' }, e.msg)))); }
  [SIMC.c1, SIMC.c2, SIMC.c3].forEach(c => c.chart.redraw());
}
function simAxes(c, y, ylabel, opts = {}) {
  const H = SIM.hist, t1 = H.length ? H[H.length - 1].t : 0, span = Math.min(600 * Math.max(1, S.sim.speed / 10), Math.max(600, SIM.t)), unit = span > 7200 ? 3600 : 60;
  c.frame({ x: [-(span / unit), 0], y, xlabel: unit === 60 ? 'Minutes before now' : 'Hours before now', ylabel, ...opts }); return { t1, unit };
}
function drawSimRsl(c, g, th) {
  const H = SIM.hist; if (!H.length) { c.frame({ x: [-10, 0], y: [-100, -40], xlabel: 'Minutes before now', ylabel: 'dBm' }); return; }
  const L = SIM.links[H[H.length - 1].si], sens = L.ab.sens, dm = Math.max(0, L.design.ab);
  const lo = Math.min(sens[0], ...H.map(o => o.rAB), ...H.map(o => o.rBA)) - 4, hi = Math.max(...H.map(o => o.rAB), ...H.map(o => o.rBA), sens[sens.length - 1]) + 4;
  const { t1, unit } = simAxes(c, [lo, hi], 'dBm'); const xs = H.map(o => (o.t - t1) / unit);
  c.clip(); g.fillStyle = Plot.alpha(th.red, 0.12); H.forEach((o, i) => { if (o.int && i) g.fillRect(c.X(xs[i - 1]), c.py1, c.X(xs[i]) - c.X(xs[i - 1]) + 1, c.py0 - c.py1); });
  [[0, th.red], [dm, th.amber], [sens.length - 1, th.green]].forEach(([m, col]) => c.hline(sens[m], { color: col, label: L.radio.mcs[m].mod, right: true }));
  c.line(xs, H.map(o => o.rBA), { color: th.sig2, width: 1.3 }); c.line(xs, H.map(o => o.rAB), { color: th.sig, width: 1.8 }); c.unclip();
  c.legend([{ label: `${shortName(L.hop.a)} → ${shortName(L.hop.b)}`, color: th.sig }, { label: 'reverse', color: th.sig2 }]);
}
function drawSimThr(c, g, th) {
  const H = SIM.hist, mx = Math.max(S.g.reqThroughput * 1.3, ...H.map(o => Math.max(o.e2e, ...o.caps))) * 1.05;
  if (!H.length) { c.frame({ x: [-10, 0], y: [0, mx], xlabel: 'Minutes before now', ylabel: 'Mbps' }); return; }
  const { t1, unit } = simAxes(c, [0, mx], 'Mbps'); const xs = H.map(o => (o.t - t1) / unit), cols = [th.sig, th.sand, th.sig2];
  c.clip(); c.hline(S.g.reqThroughput, { color: th.red, label: 'requirement' });
  H[0].caps.forEach((_, k) => c.stairs(xs, H.map(o => o.caps[k]), { color: Plot.alpha(cols[k % 3], 0.8), width: 1.2 }));
  c.stairs(xs, H.map(o => o.e2e), { color: th.ink, width: 2.2 }); c.unclip();
  c.legend([{ label: 'End to end', color: th.ink, width: 2.2 }, ...SIM.links.map((L, k) => ({ label: hopName(L.hop), color: cols[k % 3] }))]);
}
function drawSimFade(c, g, th) {
  const H = SIM.hist; if (!H.length) { c.frame({ x: [-10, 0], y: [0, 3], xlabel: 'Minutes before now', ylabel: 'dB' }); return; }
  const L = SIM.links[H[H.length - 1].si], base = L.diff.L, mx = Math.max(2, ...H.map(o => Math.max(o.Ar, o.Ld - base, o.Am))) * 1.15;
  const { t1, unit } = simAxes(c, [0, mx], 'Extra loss (dB)'); const xs = H.map(o => (o.t - t1) / unit);
  c.clip(); c.line(xs, H.map(o => o.Am), { color: th.ink3, width: 1 }); c.line(xs, H.map(o => Math.max(0, o.Ld - base)), { color: th.amber, width: 1.8 }); c.line(xs, H.map(o => o.Ar), { color: th.sig, width: 1.8 }); c.unclip();
  c.legend([{ label: 'Rain', color: th.sig }, { label: 'Refractive diffraction', color: th.amber }, { label: 'Multipath', color: th.ink3 }]);
}
async function runYear() {
  const btn = $('#mcBtn'); btn.disabled = true; btn.textContent = 'Simulating…';
  const keep = { ...SIM }, links = NET.links, N = 525600, dt = 60, req = S.g.reqThroughput, M = links.map(L => L.radio.mcs.length);
  SIM.links = links; SIM.shared = NET.shared; SIM.hops = links.map((L, i) => RF.makeHopSim(L, CTX, RF.ENV[S.sim.env], 77 + i * 999));
  Object.assign(SIM, { t: 0, zK: 0, zR: 0, own: links.map(() => 0), rng: RF.mulberry32(99), storm: null, subref: null, burst: null, st: { n: 0, up: 0, meet: 0, sum: 0, min: Infinity } });
  const occ = links.map((L, i) => new Float64Array(M[i] + 1)), bins = new Float64Array(201), maxCap = Math.max(...links.map(L => L.clear.cap.agg)) * 1.05 || 1;
  let events = 0, out = false, outMin = 0;
  for (let k = 0; k < N; k++) {
    const o = simStepAll(dt, false), e2e = combineCaps(o.map(x => x.thr), NET.shared);
    o.forEach((x, i) => occ[i][x.ab.m + 1]++); bins[Math.min(200, Math.floor(e2e / maxCap * 200))]++;
    if (e2e <= 0) { outMin++; if (!out) events++; out = true; } else out = false;
    if (k % 8760 === 0) { $('#mcProg').style.width = (100 * k / N) + '%'; await new Promise(r => setTimeout(r, 0)); }
  }
  const st = SIM.st; Object.assign(SIM, keep); $('#mcProg').style.width = '100%'; btn.disabled = false; btn.textContent = 'Simulate one year again';
  const analytic = links.reduce((p, L) => p * (1 - L.av.U(Math.min(L.ab.margin[0], L.ba.margin[0])).total / 100), 1) * 100;
  const cdf = []; let acc = 0; for (let b = 200; b >= 0; b--) { acc += bins[b]; cdf.unshift([b / 200 * maxCap, 100 * acc / N]); }
  SIM.year = { st, analytic, events, outMin, occ, cdf, N, links };
  const box = $('#mcOut'); box.innerHTML = '';
  const tiles = h('div', { class: 'statgrid span2' }, ...[[fAvail(100 * st.up / N) + ' %', 'Simulated availability, any rate'], [fAvail(analytic) + ' %', 'P.530 analytic, any rate'], [f1(100 * st.meet / N, 3) + ' %', `Time at ≥ ${req} Mbps`],
    [f1(st.sum / N, 0) + ' Mbps', 'Mean end-to-end'], [String(events), 'Outage events'], [fDur(outMin), 'Total outage']].map(([v, t]) => h('div', { class: 'stat' }, h('b', {}, v), h('span', {}, t))));
  const cd = chartCard('Throughput exceedance over the year', 'Percentage of the year the end-to-end throughput was at least x.', { aspect: 1.9 }, (c, g, th) => {
    c.frame({ x: [0, maxCap], y: [0, 100], xlabel: 'End-to-end throughput (Mbps)', ylabel: '% of year ≥ x' }); c.clip(); c.vline(req, { color: th.red, label: 'requirement' });
    c.line(cdf.map(p => p[0]), cdf.map(p => p[1]), { color: th.sig, width: 2.2 }); c.unclip(); });
  const oc = chartCard('Modulation occupancy', 'Share of the year each hop spent at each modulation (forward direction).', { aspect: 1.9 }, (c, g, th) => {
    const MM = Math.max(...M), cols = [th.sig, th.sand, th.sig2];
    c.frame({ x: [-1.5, MM - 0.5], y: [0, 100], xticks: [-1, ...Array.from({ length: MM }, (_, i) => i)], xfmt: v => v < 0 ? 'down' : links[0].radio.mcs[v] ? links[0].radio.mcs[v].n : '', ylabel: '% of year' });
    const bw = (c.px1 - c.px0) / (MM + 1) / (links.length + 1);
    occ.forEach((a, i) => a.forEach((v, m) => { const x = c.X(m - 1) + (i - links.length / 2) * bw, y = c.Y(100 * v / N); g.fillStyle = cols[i % 3]; g.fillRect(x, y, bw * 0.9, c.py0 - y); }));
    c.legend(links.map((L, i) => ({ label: hopName(L.hop), color: cols[i % 3], fill: true }))); });
  box.append(tiles, cd, oc);
}

/* =====================================================================
   ANTENNAS
   ===================================================================== */
let ANTC;
regTab('ant', () => { $('#pane-ant').classList.add('g-two'); }, renderAnt);
function renderAnt() {
  const pane = $('#pane-ant'); pane.innerHTML = ''; const L = LINK, hp = selHop();
  for (const end of ['A', 'B']) {
    const ant = end === 'A' ? L.antA : L.antB, p = end === 'A' ? L.pA : L.pB, az = end === 'A' ? L.azAB : L.azBA, el = end === 'A' ? L.elAB : L.elBA, G = end === 'A' ? L.GA : L.GB, Gm = end === 'A' ? L.GAmax : L.GBmax, mis = hp['mis' + end] || (hp['mis' + end] = { az: 0, el: 0 });
    const hpbw = RF.antHPBW(ant, L.fc), site = shortName(end === 'A' ? hp.a : hp.b), far = shortName(end === 'A' ? hp.b : hp.a);
    const inp = (k, lab) => { const i = h('input', { type: 'number', step: 0.1, value: mis[k] }); i.addEventListener('change', () => { mis[k] = +i.value || 0; update(); }); return h('label', { class: 'f' }, h('span', {}, lab, h('span', { class: 'u' }, ' °')), i); };
    const polar = (mode) => { const cv = h('canvas', { class: 'cv' }); new Plot.Chart(cv, (c, g, th) => drawPolar(c, g, th, ant, L.fc, p, az, el, mode, Gm), { aspect: 1 }); return cv; };
    pane.append(h('div', { class: 'card' }, h('h3', {}, `${site}: ${ant.name}`), h('p', { class: 'cap' }, `${f1(Gm, 1)} dBi peak, half-power beam ${f1(hpbw.h, 1)}° × ${f1(hpbw.v, 1)}°. ${ant.type === 'dish' ? 'Envelope per ITU-R F.699.' : ant.type === 'omni' ? 'Elevation pattern per ITU-R F.1336.' : 'Simplified sector pattern.'}`),
      h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:10px' }, h('div', {}, h('div', { class: 'note' }, 'Azimuth cut (north up)'), polar('az')), h('div', {}, h('div', { class: 'note' }, 'Elevation cut (horizon right)'), polar('el'))),
      h('dl', { class: 'kv', style: 'margin:8px 0' }, h('dt', {}, `Bearing to ${far}`), h('dd', {}, f1(az, 2) + '°'), h('dt', {}, `Elevation to ${far}`), h('dd', {}, f1(el, 3) + '°'), h('dt', {}, 'Gain toward far end'), h('dd', {}, f1(G, 2) + ' dBi'), h('dt', {}, 'Pointing loss'), h('dd', { class: Gm - G > 1 ? 'neg' : '' }, f1(Gm - G, 2) + ' dB')),
      ant.type === 'dish' ? h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' }, inp('az', 'Azimuth error'), inp('el', 'Elevation error')) : h('p', { class: 'note' }, 'Downtilt for this antenna is set in the hop inputs.')));
  }
  const pl = chartCard('Pointing loss against alignment error', 'Main-beam roll-off G(ψ) = Gmax − 2.5×10⁻³(Dψ/λ)². Tower twist and sway in wind should stay well inside the 1 dB point.', { aspect: 2.6, span: true }, (c, g, th) => {
    const ants = [[L.antA, th.sig, shortName(hp.a), hp.misA], [L.antB, th.sand, shortName(hp.b), hp.misB]].filter(a => a[0].type === 'dish'), x = []; for (let v = 0; v <= 8; v += 0.05) x.push(v);
    c.frame({ x: [0, 8], y: [0, 25], xlabel: 'Off-axis angle ψ (°)', ylabel: 'Loss (dB)' }); c.clip(); c.hline(1, { color: th.ink3, label: '1 dB' }); c.hline(3, { color: th.ink3, label: 'half power' });
    for (const [a, col, nm, mis] of ants) { const Gm = RF.antGainMax(a, L.fc); c.line(x, x.map(v => Gm - RF.f699(Gm, v)), { color: col, width: 2 }); const e = Math.hypot(mis?.az || 0, mis?.el || 0); if (e > 0) c.dot(e, Gm - RF.f699(Gm, e), 4, col); }
    c.unclip(); c.legend(ants.map(([a, col, nm]) => ({ label: `${nm} ${a.name}`, color: col }))); });
  pane.append(pl);
}
function drawPolar(c, g, th, ant, fc, p, az, el, mode, Gm) {
  const W = c.w, H = c.h, cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 22, rad = d => Math.max(0, (d + 40) / 40) * R;
  g.strokeStyle = th.rule2; g.fillStyle = th.ink3; g.font = `10.5px ${th.ui}`;
  for (const d of [0, -10, -20, -30]) { g.beginPath(); g.arc(cx, cy, rad(d), 0, 2 * Math.PI); g.stroke(); g.textAlign = 'left'; g.fillText(`${d}`, cx + 3, cy - rad(d) + 10); }
  for (let a = 0; a < 360; a += 30) { const t = a * Math.PI / 180; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.sin(t) * R, cy - Math.cos(t) * R); g.stroke(); }
  const toXYp = (ang, r) => mode === 'az' ? [cx + Math.sin(ang * Math.PI / 180) * r, cy - Math.cos(ang * Math.PI / 180) * r] : [cx + Math.cos(ang * Math.PI / 180) * r, cy - Math.sin(ang * Math.PI / 180) * r];
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = th.ink2;
  (mode === 'az' ? [[0, 'N'], [90, 'E'], [180, 'S'], [270, 'W']] : [[0, '0°'], [90, '+90°'], [180, 'back'], [-90, '−90°']]).forEach(([a, t]) => { const [x, y] = toXYp(a, R + 12); g.fillText(t, x, y); });
  g.beginPath();
  for (let k = 0; k <= 720; k++) { const a = -180 + k * 0.5; let gd;
    if (mode === 'az') gd = RF.antGain(ant, fc, a, p.el, p.az, p.el) - Gm;
    else { const front = Math.abs(a) <= 90; gd = RF.antGain(ant, fc, front ? p.az : p.az + 180, front ? a : 180 - a * Math.sign(a || 1), p.az, p.el) - Gm; }
    const [x, y] = toXYp(a, rad(Math.max(-40, gd))); k ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.closePath(); g.fillStyle = Plot.alpha(th.sig, 0.14); g.fill(); g.strokeStyle = th.sig; g.lineWidth = 1.8; g.stroke();
  const ray = (ang, col, dash) => { const [x, y] = toXYp(ang, R); g.strokeStyle = col; g.lineWidth = 1.6; g.setLineDash(dash || []); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); };
  if (mode === 'az') { ray(az, th.red, [4, 3]); if (ant.type !== 'omni') ray(p.az, th.ink); } else { ray(el, th.red, [4, 3]); ray(p.el, th.ink); }
}

/* =====================================================================
   TOWER HEIGHTS
   ===================================================================== */
const TW = { key: null, grid: null };
let TWC;
regTab('tower', () => {
  const pane = $('#pane-tower'); pane.classList.add('g-main-side');
  const hm = chartCard('Antenna height trade-space', 'Every combination of antenna heights evaluated over the real profile. Click a cell to adopt those heights. The bold contour is the ITU-R P.530 boundary.', { aspect: 1.25 }, drawTower);
  hm.chart.onClick = (m, c) => { const G = TW.grid; if (!G || !c.inPlot(m)) return; const a = Math.round(c.ix(m.x) / G.st) * G.st, b = Math.round(c.iy(m.y) / G.st) * G.st; S.mounts[LINK.hop.a] = a; S.mounts[LINK.hop.b] = b; update({ side: true }); };
  pane.append(hm, h('div', { class: 'stack' }, h('div', { class: 'card', id: 'twSide' })));
  TWC = hm;
}, () => { towerCompute(); TWC.chart.redraw(); renderTowerSide(); });
function capShift(L, shift) {
  let ma = -1, mb = -1; for (let m = 0; m < L.radio.mcs.length; m++) { if (L.ab.margin[m] + shift >= L.designFM) ma = m; if (L.ba.margin[m] + shift >= L.designFM) mb = m; }
  if (ma < 0 || mb < 0) return 0; return L.radio.duplex === 'FDD' ? L.eff * (L.ab.phy[ma] + L.ba.phy[mb]) : L.eff * (S.g.duty * L.ab.phy[ma] + (1 - S.g.duty) * L.ba.phy[mb]);
}
function towerCompute() {
  const L = LINK, key = JSON.stringify([L.hop, S.tower, S.g, L.A.lat, L.B.lat]); if (TW.key === key && TW.grid) return;
  const hmax = S.tower.hmax, st = hmax > 80 ? 2 : 1, N = Math.floor(hmax / st) + 1, P = L.prof, n = P.n, d = P.d, D = L.D, zA = P.z[0], zB = P.z[n - 1];
  const y4 = L.geoK.y, yk = L.geoKe.y, r1 = L.geoK.r1, c1 = S.g.clr1, c2 = S.g.obstacle === 'single' ? 0 : 0.3, model = S.g.diffModel;
  const r43 = new Float32Array(N * N), rke = new Float32Array(N * N), ld = new Float32Array(N * N), cap = new Float32Array(N * N), p530 = new Float32Array(N * N);
  for (let ia = 0; ia < N; ia++) for (let ib = 0; ib < N; ib++) {
    const hA = zA + ia * st, hB = zB + ib * st; let a = Infinity, b = Infinity;
    for (let i = 1; i < n - 1; i++) { const los = hA + (hB - hA) * d[i] / D; const x = (los - y4[i]) / r1[i], y = (los - yk[i]) / r1[i]; if (x < a) a = x; if (y < b) b = y; }
    const k = ib * N + ia, l = RF.diffraction(model, P, y4, hA, hB, L.lam).L;
    r43[k] = a; rke[k] = b; ld[k] = l; cap[k] = capShift(L, L.diff.L - l); p530[k] = Math.min(a - c1, b - c2);
  }
  TW.grid = { N, st, r43, rke, ld, cap, p530, hmax }; TW.key = key;
}
function drawTower(c, g, th) {
  const G = TW.grid; if (!G) return; const L = LINK, m = S.tower.metric, req = S.g.reqThroughput, arr = G[m];
  c.frame({ x: [-G.st / 2, G.hmax + G.st / 2], y: [-G.st / 2, G.hmax + G.st / 2], xlabel: `Antenna height at ${shortName(L.hop.a)} (m AGL)`, ylabel: `Antenna height at ${shortName(L.hop.b)} (m AGL)`, grid: false });
  const cw = (c.px1 - c.px0) / G.N, chh = (c.py0 - c.py1) / G.N;
  const colOf = v => { const t = m === 'p530' ? (v + 1) / 2 : m === 'r43' ? (v - S.g.clr1 + 1) / 2 : m === 'rke' ? (v + 0.7) / 2 : m === 'ld' ? 1 - v / 30 : v / (2 * req); return Plot.diverge(t); };
  for (let ia = 0; ia < G.N; ia++) for (let ib = 0; ib < G.N; ib++) { const [r, gg, b] = colOf(arr[ib * G.N + ia]); g.fillStyle = `rgb(${r | 0},${gg | 0},${b | 0})`; g.fillRect(c.X(ia * G.st) - cw / 2, c.Y(ib * G.st) - chh / 2, cw + 0.6, chh + 0.6); }
  // P.530 boundary via marching squares on p530 = 0
  g.strokeStyle = th.ink; g.lineWidth = 2.2; g.beginPath(); const v = (i, j) => G.p530[j * G.N + i];
  for (let i = 0; i < G.N - 1; i++) for (let j = 0; j < G.N - 1; j++) { const q = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]], pts = [];
    for (let e = 0; e < 4; e++) { const [a1, b1] = q[e], [a2, b2] = q[(e + 1) % 4], v1 = v(a1, b1), v2 = v(a2, b2); if ((v1 < 0) !== (v2 < 0)) { const t = v1 / (v1 - v2); pts.push([c.X((a1 + (a2 - a1) * t) * G.st), c.Y((b1 + (b2 - b1) * t) * G.st)]); } }
    if (pts.length >= 2) { g.moveTo(...pts[0]); g.lineTo(...pts[1]); } if (pts.length === 4) { g.moveTo(...pts[2]); g.lineTo(...pts[3]); } } g.stroke();
  const mark = (a, b, shape, label) => { const x = c.X(a), y = c.Y(b); g.fillStyle = th.panel; g.strokeStyle = th.ink; g.lineWidth = 2; g.beginPath(); shape === 'sq' ? g.rect(x - 5, y - 5, 10, 10) : shape === 'd' ? (g.moveTo(x, y - 7), g.lineTo(x + 7, y), g.lineTo(x, y + 7), g.lineTo(x - 7, y), g.closePath()) : g.arc(x, y, 6, 0, 2 * Math.PI); g.fill(); g.stroke(); c.text(label, x + 9, y - 9, { size: 11.5, weight: 600, halo: true }); };
  const cur = [L.A.mount, L.B.mount]; if (cur[0] <= G.hmax && cur[1] <= G.hmax) mark(cur[0], cur[1], 'o', 'current');
  if (TTA_MIN[L.hop.a] != null && TTA_MIN[L.hop.b] != null) mark(TTA_MIN[L.hop.a], TTA_MIN[L.hop.b], 'sq', 'TTA minimum');
  const best = towerBest(); if (best) mark(best.a, best.b, 'd', 'lowest compliant');
  if (c.inPlot(c.mouse)) { const ia = Math.round(c.ix(c.mouse.x) / G.st), ib = Math.round(c.iy(c.mouse.y) / G.st); if (ia >= 0 && ib >= 0 && ia < G.N && ib < G.N) { const k = ib * G.N + ia;
    const lines = [`${ia * G.st} m / ${ib * G.st} m`, `${f1(G.r43[k], 2)} F1 at K, ${f1(G.rke[k], 2)} F1 at kₑ`, `Diffraction ${f1(G.ld[k], 1)} dB`, `${fMb(G.cap[k])} at design margin`, G.p530[k] >= 0 ? 'Meets P.530' : 'Fails P.530'];
    const bx = Math.min(c.mouse.x + 12, c.px1 - 205), by = Math.max(c.py1 + 4, c.mouse.y - 90); g.fillStyle = Plot.alpha(th.panel, 0.95); g.fillRect(bx, by, 198, lines.length * 17 + 8); g.strokeStyle = th.rule; g.strokeRect(bx + .5, by + .5, 198, lines.length * 17 + 8);
    lines.forEach((t, j) => c.text(t, bx + 8, by + 13 + j * 17, { size: 12, weight: j ? 500 : 600 })); } }
}
function towerBest() { const G = TW.grid; if (!G) return null; let best = null; for (let ia = 0; ia < G.N; ia++) for (let ib = 0; ib < G.N; ib++) if (G.p530[ib * G.N + ia] >= 0) { const s = ia + ib; if (!best || s < best.s) best = { a: ia * G.st, b: ib * G.st, s }; } return best; }
function renderTowerSide() {
  const L = LINK, G = TW.grid, box = $('#twSide'); box.innerHTML = '';
  const mSel = h('select', {}, [['p530', 'P.530 compliance margin'], ['r43', 'Clearance at median K'], ['rke', 'Clearance at kₑ'], ['ld', 'Diffraction loss'], ['cap', 'Capacity at design margin']].map(([v, t]) => h('option', { value: v, selected: S.tower.metric === v }, t)));
  mSel.addEventListener('change', () => { S.tower.metric = mSel.value; save(); TWC.chart.redraw(); });
  const hm = h('select', {}, [40, 60, 80, 120].map(v => h('option', { value: v, selected: S.tower.hmax === v }, v + ' m')));
  hm.addEventListener('change', () => { S.tower.hmax = +hm.value; save(); towerCompute(); TWC.chart.redraw(); renderTowerSide(); });
  const best = towerBest(), minB = (a) => { for (let ib = 0; ib < G.N; ib++) if (G.p530[ib * G.N + Math.round(a / G.st)] >= 0) return ib * G.st; return null; }, minA = (b) => { for (let ia = 0; ia < G.N; ia++) if (G.p530[Math.round(b / G.st) * G.N + ia] >= 0) return ia * G.st; return null; };
  const ca = Math.min(G.hmax, L.A.mount), cb = Math.min(G.hmax, L.B.mount), mb = minB(ca), ma = minA(cb);
  box.append(h('h3', {}, hopName(L.hop)), h('label', { class: 'f' }, h('span', {}, 'Colour by'), mSel), h('label', { class: 'f' }, h('span', {}, 'Height range'), hm),
    h('dl', { class: 'kv', style: 'margin-top:10px' },
      h('dt', {}, 'Lowest compliant pair'), h('dd', {}, best ? `${best.a} m / ${best.b} m` : 'none in range'),
      h('dt', {}, `Minimum at ${shortName(L.hop.b)} with ${shortName(L.hop.a)} at ${ca} m`), h('dd', {}, mb == null ? 'none' : mb + ' m'),
      h('dt', {}, `Minimum at ${shortName(L.hop.a)} with ${shortName(L.hop.b)} at ${cb} m`), h('dd', {}, ma == null ? 'none' : ma + ' m'),
      h('dt', {}, 'Current design'), h('dd', { class: L.clr.rule1 && L.clr.rule2 ? 'pos' : 'neg' }, `${L.A.mount} m / ${L.B.mount} m, ${L.clr.rule1 && L.clr.rule2 ? 'compliant' : 'not compliant'}`)),
    h('p', { class: 'note', style: 'margin-top:10px' }, `Rule: ≥ ${S.g.clr1} F1 at K = ${S.g.k.toFixed(2)} and ≥ ${S.g.obstacle === 'single' ? 0 : 0.3} F1 at kₑ = ${f1(L.ke, 2)}. Green is compliant; the colour scale is centred on each metric's threshold.`),
    best ? h('button', { class: 'btn pri', style: 'margin-top:6px', onclick: () => { S.mounts[L.hop.a] = best.a; S.mounts[L.hop.b] = best.b; update({ side: true }); } }, 'Use the lowest compliant pair') : null);
}

/* =====================================================================
   SPECTRUM
   ===================================================================== */
let SPC;
regTab('spec', () => {
  const pane = $('#pane-spec'); pane.classList.add('g-two');
  const bp = chartCard('Channel plan', 'Regulatory allocations with their reference EIRP caps, and each hop’s occupied channel. Overlapping channels at a shared site are hatched red.', { aspect: 3.2, span: true }, drawBandPlan);
  const cw = chartCard('Capacity against channel width', 'Wider channels carry more symbols but add 3 dB of noise per doubling, eating into the fade margin.', { aspect: 1.7 }, drawChanWidth);
  pane.append(bp, cw, h('div', { class: 'card', id: 'specWork' })); SPC = { bp, cw };
}, () => { SPC.cw.data = null; SPC.bp.chart.redraw(); SPC.cw.chart.redraw(); renderSpecWork(); });
function drawBandPlan(c, g, th) {
  const links = mapLinks().map(o => o.L), lic = links.some(L => L.fc > 6000), uhf = links.every(L => L.fc < 1000), xr = uhf ? [395, 485] : lic ? [10650, 11750] : [5100, 5900];
  const lanes = links.length + 1, laneH = (c.h - 60) / lanes;
  c.frame({ x: xr, y: [0, lanes], yticks: [], xlabel: 'Frequency (MHz)', m: { l: 16, t: 8, b: 34 }, grid: true });
  CTX.bands.forEach((b, k) => { if (b.hi < xr[0] || b.lo > xr[1]) return; const x0 = c.X(Math.max(xr[0], b.lo)), x1 = c.X(Math.min(xr[1], b.hi)), y0 = c.Y(lanes), y1 = c.Y(lanes - 1);
    g.fillStyle = Plot.alpha([th.sig, th.sand, th.green, th.sig2][k % 4], 0.22); g.fillRect(x0, y0 + 4, x1 - x0, y1 - y0 - 8); g.strokeStyle = th.rule; g.strokeRect(x0 + .5, y0 + 4.5, x1 - x0, y1 - y0 - 8);
    c.text(b.name, x0 + 6, y0 + 18, { size: 12, weight: 600 }); c.text(b.cap == null ? 'licensed, coordinated' : `cap ${b.cap} dBm EIRP${b.dfs ? ', DFS' : ''}`, x0 + 6, y0 + 34, { size: 11, color: th.ink2 });
    g.strokeStyle = Plot.alpha(th.ink, 0.15); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x0, c.py0); g.moveTo(x1, y0); g.lineTo(x1, c.py0); g.stroke(); });
  if (!lic && !uhf) { const x0 = c.X(5600), x1 = c.X(5650), y0 = c.Y(lanes); g.save(); g.beginPath(); g.rect(x0, y0 + 4, x1 - x0, c.py0 - y0 - 4); g.clip(); g.strokeStyle = Plot.alpha(th.amber, 0.6); for (let x = x0 - 200; x < x1 + 200; x += 6) { g.beginPath(); g.moveTo(x, c.py0); g.lineTo(x + 200, y0); g.stroke(); } g.restore(); c.text('weather radar', (x0 + x1) / 2, c.py0 - 8, { align: 'center', size: 10.5, color: th.amber }); }
  links.forEach((L, i) => { const y0 = c.Y(lanes - 1 - i), y1 = c.Y(lanes - 2 - i), x0 = c.X(L.fc - L.bw / 2), x1 = c.X(L.fc + L.bw / 2), col = Plot.css(ST_VAR[hopStatus(L)]);
    g.fillStyle = Plot.alpha(col, 0.35); g.fillRect(x0, y0 + 6, x1 - x0, y1 - y0 - 12); g.strokeStyle = col; g.lineWidth = 1.5; g.strokeRect(x0 + .5, y0 + 6.5, x1 - x0, y1 - y0 - 12);
    const t = `${hopName(L.hop)}: ${L.fc} MHz, ${bwLab(L.bw)}`; g.font = `600 12px ${th.ui}`; const tw = g.measureText(t).width; c.text(t, x1 + tw + 10 < c.px1 ? x1 + 8 : x0 - tw - 8, (y0 + y1) / 2, { size: 12, weight: 600 });
    links.forEach((M, j) => { if (j <= i || NET.shared) return; const lo = Math.max(L.fc - L.bw / 2, M.fc - M.bw / 2), hi = Math.min(L.fc + L.bw / 2, M.fc + M.bw / 2); if (hi > lo) { g.save(); g.beginPath(); g.rect(c.X(lo), c.Y(lanes - 1), c.X(hi) - c.X(lo), c.py0 - c.Y(lanes - 1)); g.clip(); g.strokeStyle = Plot.alpha(th.red, 0.8); for (let x = c.X(lo) - 300; x < c.X(hi) + 300; x += 5) { g.beginPath(); g.moveTo(x, c.py0); g.lineTo(x + 300, c.Y(lanes - 1)); g.stroke(); } g.restore(); } }); });
}
function drawChanWidth(c, g, th) {
  const L = LINK, bws = L.radio.bws;
  if (!SPC.cw.data) SPC.cw.data = bws.map(bw => { const hop = { ...L.hop, bw, mode: 'ptp' }; const R = RF.analyzeLink(hop, CTX); return { bw, clear: R.clear.cap.agg, design: R.design.cap.agg, fits: !!R.band, N: R.Nth }; });
  const D = SPC.cw.data, mx = Math.max(S.g.reqThroughput * 1.2, ...D.map(d => d.clear)) * 1.1;
  c.frame({ x: [-0.5, D.length - 0.5], y: [0, mx], xticks: D.map((_, i) => i), xfmt: i => D[i] ? bwLab(D[i].bw) : '', ylabel: 'Mbps' });
  const bw = (c.px1 - c.px0) / D.length;
  D.forEach((d, i) => { const x = c.X(i); g.fillStyle = Plot.alpha(th.sig, 0.3); g.fillRect(x - bw * 0.36, c.Y(d.clear), bw * 0.34, c.py0 - c.Y(d.clear)); g.fillStyle = th.sig; g.fillRect(x + 0.02 * bw, c.Y(d.design), bw * 0.34, c.py0 - c.Y(d.design));
    if (!d.fits) c.text('outside band', x, c.py0 - 10, { align: 'center', size: 10.5, color: th.red }); if (d.bw === L.bw) { g.strokeStyle = th.ink; g.lineWidth = 1.5; g.strokeRect(x - bw * 0.42, c.py1 + 2, bw * 0.84, c.py0 - c.py1 - 4); } });
  c.hline(S.g.reqThroughput, { color: th.red, label: 'requirement' }); c.legend([{ label: 'Clear air', color: Plot.alpha(th.sig, .3), fill: true }, { label: 'At design margin', color: th.sig, fill: true }]);
}
function renderSpecWork() {
  const L = LINK, w = $('#specWork'); w.innerHTML = ''; const u3 = CTX.bands.find(b => b.id === 'u3');
  w.append(h('h3', {}, 'Working'), h('div', { class: 'work' },
    eq('Noise floor scales with width', `${V('N')} = −174 + 10 log ${V('B')} + ${V('NF')} → ${[20, 40, 80].map(b => `${b} MHz: ${fm(-174 + RF.db(b * 1e6) + L.radio.nf)} dBm`).join(', ')}`),
    eq('Usable spectral efficiency at the design rate', `${FR(V('C'), V('B'))} = ${FR(fMb(L.design.cap.agg), L.bw + ' MHz')} = ${B(f1(L.design.cap.agg / L.bw, 2) + ' bit/s/Hz')}`),
    eq('Shannon bound at the received SNR', `${V('C')}<sub>max</sub> = ${V('B')} log<sub>2</sub>(1 + SNR) = ${L.bw} × log<sub>2</sub>(1 + 10<sup>${f1(L.ab.snr[0] / 10, 2)}</sup>) = ${B(f1(L.bw * Math.log2(1 + RF.undb(L.ab.snr[0])), 0) + ' Mbps per stream')}`),
    eq('Channel fit in 5725–5875 MHz', `${u3 ? u3.hi - u3.lo : 150} MHz available: one 80 MHz channel plus at most a 60 MHz neighbour without guard band, or two 60 MHz channels with 10 MHz guard.`)));
}

/* =====================================================================
   COMPARE DESIGNS — capacity, availability, hardware RBD, power & thermal
   ===================================================================== */
let CMP;
regTab('cmp', () => { $('#pane-cmp').classList.add('g-two'); }, renderCmp);
function equipment(k) {
  const A = S.archs[k], lic = A.hops[0].radio === 'lic11', rad = RF.RADIOS[A.hops[0].radio], ptmp = A.topology === 'ptmp', hw = S.hw;
  const count = id => ptmp && id === 'sr3' ? 1 : A.hops.filter(x => x.a === id || x.b === id).length;
  const R = n => ({ name: rad.model || rad.name, qty: n, W: rad.powerW, mtbf: rad.mtbf, tmax: rad.tmax ?? 70 });
  const sw = { name: 'Managed switch', qty: 1, W: 12, mtbf: hw.mtbf.switch, tmax: 75 }, rt = { name: 'EdgeRouter', qty: 1, W: 5, mtbf: hw.mtbf.router, tmax: 45 }, fw = { name: 'FortiGate firewall', qty: 1, W: 15, mtbf: hw.mtbf.firewall, tmax: 40 };
  const ps = { name: 'DC UPS and battery', qty: 1, W: 0, mtbf: hw.mtbf.psu, tmax: 60 }, sp = { name: 'Surge protection, cabling', qty: 1, W: 0, mtbf: hw.mtbf.spd, tmax: 85 };
  return [{ id: 'wwtp', relay: false, items: [R(count('wwtp')), sw, rt, fw, ps, sp] }, { id: 'sr3', relay: true, items: [R(count('sr3')), sw, ps, sp] }, { id: 'eng', relay: false, items: [R(count('eng')), sw, rt, fw, ps, sp] }];
}
function hwAvail(k) { const sites = equipment(k); return RF.hardwareAvail(sites.flatMap(s => s.items.map(it => ({ ...it, mttr: s.relay ? S.hw.mttrRelay : S.hw.mttrEnd })))); }
function renderCmp() {
  const pane = $('#pane-cmp'); pane.innerHTML = ''; const nets = allNets(), keys = Object.keys(S.archs), req = S.g.reqThroughput;
  const nA = nets.A, nB = nets.B;
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Specification and the 300 Mbps requirement'),
    h('p', { style: 'margin:4px 0 8px;max-width:90ch' }, `TTA (Feb 2025) and Rev 3 specify SR3 as the central repeater on an omnidirectional antenna, with directional dishes at the Engineer’s Office and WWTP. That design was made before the client stated 200–300 Mbps, and TTA §7.6 asks for gains and heights to be reviewed once equipment and throughput are known.`),
    h('div', { class: 'statgrid' }, h('div', { class: 'stat' }, h('b', {}, fMb(nA.e2e)), h('span', {}, 'Specified SR3 omni, at design margin')), h('div', { class: 'stat' }, h('b', {}, fMb(nA.e2eClear)), h('span', {}, 'Specified SR3 omni, clear air')),
      h('div', { class: 'stat' }, h('b', {}, fMb(nB.e2e)), h('span', {}, 'Dual PtP deviation, at design margin')), h('div', { class: 'stat' }, h('b', {}, `${S.g.reqThroughput} Mbps`), h('span', {}, 'Client requirement'))),
    h('ul', { class: 'warns', style: 'margin-top:10px' }, h('li', { class: nA.meets ? '' : 'bad' }, nA.meets ? 'The specified omni design meets the requirement with these inputs.' : `With these inputs the specified omni design does not reach ${S.g.reqThroughput} Mbps: point-to-multipoint caps the channel at 40 MHz and SR3 airtime is shared by both hops. Ask the RF contractor to verify.`),
      h('li', {}, nB.meets ? 'The dual point-to-point deviation meets the requirement; propose it to the client for approval.' : `Even the dual point-to-point deviation reaches ${fMb(nB.e2e)}; channel plan and EIRP limits need resolving before either design can promise ${S.g.reqThroughput} Mbps.`))));
  const row = (label, fn, cls) => h('tr', {}, h('td', {}, label), ...keys.map(k => { const v = fn(nets[k], k); return h('td', { class: (cls ? cls(nets[k], k) : '') + (k === S.arch ? ' cur' : '') }, v); }));
  const minFM = N => Math.min(...N.links.map(L => Math.min(dirMarginAtReq(L, L.ab), dirMarginAtReq(L, L.ba))));
  const tot = (N, k) => N.propAvail / 100 * hwAvail(k).A;
  const T = h('table', { class: 't' }, h('tr', {}, h('th', {}, ''), ...keys.map(k => h('th', {}, S.archs[k].name))),
    row('Topology against specification', (N, k) => SPEC_TXT[specLevel(k)], (N, k) => specLevel(k) === 'yes' ? 'pos' : 'mid'),
    row('Radios', N => String(N.radios)),
    row('End to end at design margin', N => fMb(N.e2e), N => N.e2e >= req ? 'pos' : 'neg'),
    row('End to end, clear air', N => fMb(N.e2eClear)),
    row(`Weakest margin at ${req} Mbps`, N => { const m = minFM(N); return isFinite(m) ? fs(m) + ' dB' : 'rate unreachable'; }, N => minFM(N) >= Math.max(...N.links.map(l => l.designFM)) ? 'pos' : minFM(N) >= 0 ? 'mid' : 'neg'),
    row('Propagation availability', N => fAvail(N.propAvail) + ' %'),
    row('Equipment availability', (N, k) => fAvail(hwAvail(k).A) + ' %'),
    row('Combined downtime', (N, k) => fDur(mins(100 - tot(N, k))) + ' / yr'),
    row('Latency', N => f1(N.latency, 2) + ' ms'),
    row('EIRP compliance', N => N.links.every(L => L.ab.compliant && L.ba.compliant) ? 'within caps' : 'exceeds a cap', N => N.links.every(L => L.ab.compliant && L.ba.compliant) ? 'pos' : 'neg'),
    row('Spectrum occupied', N => (N.shared ? N.links[0].bw : N.links.reduce((s, L) => s + L.bw, 0)) + ' MHz'),
    row('Verdict', N => N.meets ? `Meets ${req} Mbps` : `Short of ${req} Mbps`, N => N.meets ? 'pos' : 'neg'));
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Design comparison'), h('p', { class: 'cap' }, 'All three architectures evaluated with the same terrain, climate, regulatory and requirement inputs. The current design is outlined.'), h('div', { class: 'tw' }, T)));
  pane.append(chartCard('End-to-end capacity', 'Clear-air and design-margin capacity per architecture against the requirement.', { aspect: 1.7 }, (c, g, th) => {
    const mx = Math.max(req * 1.3, ...keys.map(k => nets[k].e2eClear)) * 1.1; c.frame({ x: [-0.5, keys.length - 0.5], y: [0, mx], xticks: keys.map((_, i) => i), xfmt: i => S.archs[keys[i]] ? S.archs[keys[i]].name : '', ylabel: 'Mbps' });
    const bw = (c.px1 - c.px0) / keys.length; keys.forEach((k, i) => { const x = c.X(i), N = nets[k];
      g.fillStyle = Plot.alpha(th.sig, 0.28); g.fillRect(x - bw * 0.34, c.Y(N.e2eClear), bw * 0.32, c.py0 - c.Y(N.e2eClear)); g.fillStyle = N.meets ? th.green : th.red; g.fillRect(x + bw * 0.02, c.Y(N.e2e), bw * 0.32, c.py0 - c.Y(N.e2e));
      c.text(f1(N.e2e, 0), x + bw * 0.18, c.Y(N.e2e) - 9, { align: 'center', weight: 600, halo: true }); });
    c.hline(req, { color: th.red, label: 'requirement' }); c.legend([{ label: 'Clear air', color: Plot.alpha(th.sig, .28), fill: true }, { label: 'Design margin', color: th.green, fill: true }]); }));
  // hardware inputs + power
  const hw = S.hw, pw = S.pw, inN = (obj, k, label, unit, step) => { const i = h('input', { type: 'number', value: obj[k], step }); i.addEventListener('change', () => { obj[k] = +i.value; save(); renderCmp(); }); return h('label', { class: 'f' }, h('span', {}, label, h('span', { class: 'u' }, ' ' + unit)), i); };
  const shield = h('input', { type: 'checkbox', checked: pw.shield }); shield.addEventListener('change', () => { pw.shield = shield.checked; save(); renderCmp(); });
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'Reliability and power inputs'), h('div', { class: 'work', style: 'gap:7px' },
    inN(hw, 'mttrEnd', 'Repair time, end sites', 'h', 1), inN(hw, 'mttrRelay', 'Repair time, SR3', 'h', 1),
    ...Object.keys(hw.mtbf).map(k => inN(hw.mtbf, k, `MTBF ${({ switch: 'switch', router: 'router', firewall: 'firewall', psu: 'UPS and battery', spd: 'surge and cabling' })[k]}`, 'h', 1000)),
    inN(pw, 'hours', 'Battery autonomy', 'h', 1), inN(pw, 'volts', 'DC bus', 'V', 12), inN(pw, 'ambient', 'Design ambient', '°C', 1),
    inN(pw, 'encW', 'Enclosure width', 'mm', 50), inN(pw, 'encH', 'Enclosure height', 'mm', 50), inN(pw, 'encD', 'Enclosure depth', 'mm', 50), inN(pw, 'absorb', 'Solar absorptance', '0–1', 0.05),
    h('label', { class: 'tog' }, shield, 'Sun shield fitted (cuts solar gain by 80 %)'))));
  const sites = equipment(S.arch), area = 2 * (pw.encW * pw.encH + pw.encW * pw.encD + pw.encH * pw.encD) / 1e6, qs = pw.absorb * 1000 * (pw.encW * pw.encD + pw.encW * pw.encH) / 1e6 * (pw.shield ? 0.2 : 1);
  const PT = h('table', { class: 't' }, h('tr', {}, ...['Site', 'Load', 'PSU ≥', 'Battery', 'Internal peak', 'At risk'].map(t => h('th', {}, t))));
  for (const s of sites) { const P = s.items.reduce((a, it) => a + it.W * it.qty, 0) * 1.1, Ah = P * pw.hours / (pw.volts * pw.eta * pw.dod * pw.kt) * pw.kage, dT = (P + qs) / (pw.k * area), Ti = pw.ambient + dT, risk = s.items.filter(it => it.W > 0 && it.tmax < Ti).map(it => it.name);
    PT.append(h('tr', {}, h('td', {}, shortName(s.id)), h('td', {}, f1(P, 0) + ' W'), h('td', {}, f1(P * 1.25, 0) + ' W'), h('td', {}, f1(Ah, 0) + ' Ah'), h('td', { class: Ti > 55 ? 'neg' : Ti > 45 ? 'mid' : 'pos' }, f1(Ti, 0) + ' °C'), h('td', { style: 'white-space:normal;text-align:left' }, risk.length ? risk.join(', ') : 'none'))); }
  pane.append(h('div', { class: 'card' }, h('h3', {}, `Site power and enclosure heat: ${arch().name}`), h('p', { class: 'cap' }, 'Load includes 10 % conversion loss. Battery uses the derated capacity equation; enclosure temperature rise is a steady-state balance of electrical and solar heat against surface loss.'),
    h('div', { class: 'tw' }, PT), h('div', { class: 'work', style: 'margin-top:10px' },
      eq('Battery capacity', `${V('C')} = ${FR(V('P') + V('t'), V('V') + V('η') + '·DOD·' + V('K') + '<sub>T</sub>')} · ${V('K')}<sub>age</sub> &nbsp;with ${V('η')} = ${pw.eta}, DOD = ${pw.dod}, ${V('K')}<sub>T</sub> = ${pw.kt}, ${V('K')}<sub>age</sub> = ${pw.kage}`),
      eq('Enclosure temperature rise', `Δ${V('T')} = ${FR(V('P') + ' + ' + V('α') + V('G') + V('A') + '<sub>sun</sub>', V('k') + V('A'))} &nbsp;with solar gain ${B(f1(qs, 0) + ' W')}, surface ${f1(area, 2)} m², ${V('k')} = ${pw.k} W/m²K`))));
}
