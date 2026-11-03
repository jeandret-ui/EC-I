/* =====================================================================
   EQUIPMENT — vendor systems, compatibility, quote
   ===================================================================== */
regTab('kit', () => { $('#pane-kit').classList.add('g-two'); }, renderKit);
const ARCH_KIT = { D: 'tab245', E: 'tab415' };
const archRadio = k => RF.RADIOS[S.archs[k].hops[0].radio];
function encTemp(k) {
  const pw = S.pw, area = 2 * (pw.encW * pw.encH + pw.encW * pw.encD + pw.encH * pw.encD) / 1e6, qs = pw.absorb * 1000 * (pw.encW * pw.encD + pw.encW * pw.encH) / 1e6 * (pw.shield ? 0.2 : 1);
  const P = equipment(k)[0].items.reduce((a, it) => a + it.W * it.qty, 0) * 1.1; return pw.ambient + (P + qs) / (pw.k * area);
}
function compatRows(nets) {
  const keys = Object.keys(S.archs), req = S.g.reqThroughput, row = (label, fn, hint) => ({ label, hint, cells: keys.map(k => fn(nets[k], k, archRadio(k))) });
  const C = (st, v) => ({ st, v });
  const minFM = N => Math.min(...N.links.map(L => Math.min(dirMarginAtReq(L, L.ab), dirMarginAtReq(L, L.ba))));
  return [
    row(`Throughput at design margin (needs ${req} Mbps)`, N => C(N.e2e >= req ? 'pass' : N.e2e >= 0.5 * req ? 'warn' : 'fail', fMb(N.e2e))),
    row('SR3 omni as specified (TTA, Rev 3)', (N, k) => { const l = specLevel(k); return C(l === 'yes' ? 'pass' : 'warn', SPEC_TXT[l]); }),
    row('Clear-air throughput', N => C('info', fMb(N.e2eClear))),
    row(`Weakest margin at ${req} Mbps`, N => { const m = minFM(N); return isFinite(m) ? C(m >= S.g.minFM ? 'pass' : m >= 0 ? 'warn' : 'fail', fs(m) + ' dB') : C('fail', 'rate unreachable'); }),
    row('Ethernet port speed', (N, k, r) => C(r.port >= req ? 'pass' : 'fail', r.port >= 1000 ? '1 GbE' : `${r.port} Mbps`), 'The radio’s own LAN port caps the link.'),
    row('Rockwell EtherNet/IP and ViewNode traffic', N => C(N.e2e >= 10 ? 'pass' : N.e2e >= 0.05 ? 'warn' : 'fail', N.e2e >= 10 ? 'full SCADA client traffic' : N.e2e >= 0.05 ? 'polled tags only' : 'not practical')),
    row('Licensing and EIRP (Botswana)', N => { const lic = N.links.some(L => L.band && L.band.licensed), ok = N.links.every(L => L.ab.compliant && L.ba.compliant && L.band);
      return C(!ok ? 'fail' : lic ? 'warn' : 'pass', !ok ? 'exceeds cap or off-band' : lic ? 'BOCRA licence needed' : 'licence-exempt, within caps'); }),
    row('Feeder loss per end', (N, k) => { const l = Math.max(...S.archs[k].hops.flatMap(h0 => [h0.lossA, h0.lossB])); return C(l <= 1 ? 'pass' : l <= 3 ? 'warn' : 'fail', f1(l, 1) + ' dB'); }, 'Panel-mounted radios lose signal in the coax run up the mast, at both ends.'),
    row('Latency end to end', N => C(N.latency <= 20 ? 'pass' : N.latency <= 250 ? 'warn' : 'fail', f1(N.latency, 1) + ' ms')),
    row(`Runs from the ${S.pw.volts} V DC bus`, (N, k, r) => C(S.pw.volts >= r.supply[0] && S.pw.volts <= r.supply[1] ? 'pass' : 'warn', r.supplyNote)),
    row('Radio temperature rating', (N, k, r) => { const T = r.mounting === 'panel' ? encTemp(k) : S.pw.ambient + 20, ok = r.tmax >= T + 5;
      return C(ok ? 'pass' : r.tmax >= T ? 'warn' : 'fail', `${r.tmax} °C rated, ${f1(T, 0)} °C ${r.mounting === 'panel' ? 'in panel' : 'on mast'}`); }),
    row('Same family as the Rev 3 radios', (N, k, r) => C(r.family === 'airMAX ac' ? 'pass' : 'warn', r.family === 'airMAX ac' ? 'airMAX ac' : `${r.family}: replace all ends together`)),
    row('Radios needed', N => C('info', String(N.radios))),
    row('Quoted equipment cost', (N, k) => { const kit = ARCH_KIT[k]; return kit ? C('info', `R ${(RF.kitPrice(kit) * N.radios).toLocaleString('en-ZA', { maximumFractionDigits: 0 })} excl. VAT`) : C('info', 'not quoted'); }),
  ];
}
const chipC = st => st === 'info' ? '' : st;
function renderKit() {
  const pane = $('#pane-kit'); pane.innerHTML = ''; const nets = allNets(), keys = Object.keys(S.archs);
  // systems
  const cards = h('div', { style: 'display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:10px' });
  for (const k of keys) { const r = archRadio(k), N = nets[k], kit = ARCH_KIT[k];
    cards.append(h('div', { class: 'stat', style: `display:grid;gap:5px;${k === S.arch ? 'border-color:var(--signal);box-shadow:inset 0 0 0 1px var(--signal)' : ''}` },
      h('b', { style: 'font-size:18px' }, S.archs[k].name), h('span', {}, r.vendor || ''), h('span', {}, S.archs[k].long),
      h('span', {}, h('b', { style: 'display:inline;font-size:16px' }, fMb(N.e2e)), ' end to end at design margin'),
      kit ? h('span', {}, `Kit per end: R ${RF.kitPrice(kit).toLocaleString('en-ZA', { minimumFractionDigits: 2 })} excl. VAT`) : null,
      h('button', { class: 'btn sm' + (k === S.arch ? ' pri' : ''), onclick: () => { S.arch = k; S.sel = 0; if (NET3D) NET3D.static = null; update({ side: true }); } }, k === S.arch ? 'Current design' : 'Use this system')));
  }
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Equipment systems'), h('p', { class: 'cap' }, 'Each system is evaluated over the real terrain with the same requirement, climate and regulatory inputs. The two Tabateq systems use the ELPRO datasheets and the exact coax, arrestor and antenna chain from quote QS8044.'), cards));
  // compatibility matrix
  const rows = compatRows(nets), T = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Check'), ...keys.map(k => h('th', { class: k === S.arch ? 'cur' : '' }, S.archs[k].name))));
  for (const r of rows) T.append(h('tr', {}, h('td', { title: r.hint || '' }, r.label), ...r.cells.map((c, i) => h('td', { class: keys[i] === S.arch ? 'cur' : '' }, c.st === 'info' ? c.v : h('span', { class: 'chip ' + chipC(c.st), title: c.v }, c.v)))));
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Compatibility matrix'), h('p', { class: 'cap' }, 'Green fits the WEC backhaul as specified, amber works with a condition, red does not meet it. Temperature uses the enclosure model from Compare designs.'), h('div', { class: 'tw' }, T)));
  // feeder loss chart
  pane.append(chartCard('Feeder loss per end', 'Panel-mounted ELPRO radios reach the antenna through the quoted coax, arrestor and connectors. Each end pays this twice in the link budget (transmit and receive). The Rocket mounts on its dish.', { aspect: 1.6 }, (c, g, th) => {
    const sets = [['Rocket on dish', [['Pigtail and connector', 0.5]]], ['245U kit @ 5.8 GHz', RF.kitBreakdown('tab245', 5785)], ['415U kit @ 450 MHz', RF.kitBreakdown('tab415', 450)]];
    const mx = Math.ceil(Math.max(...sets.map(s => s[1].reduce((a, x) => a + x[1], 0))) + 1), cols = [th.sig, th.sand, th.sig2, th.amber, th.ink3];
    c.frame({ x: [0, mx], y: [-0.5, sets.length - 0.5], yticks: [], xlabel: 'Loss (dB)', m: { l: 130 } });
    sets.forEach(([nm, parts], i) => { let x0 = 0; const y = c.Y(i), bh = (c.py0 - c.py1) / sets.length * 0.5; c.text(nm, c.px0 - 8, y, { align: 'right', size: 12, weight: 600 });
      parts.forEach(([lab, v], j) => { g.fillStyle = cols[j % cols.length]; g.fillRect(c.X(x0), y - bh / 2, c.X(x0 + v) - c.X(x0), bh); if (c.X(x0 + v) - c.X(x0) > 40) c.text(f1(v, 1), (c.X(x0) + c.X(x0 + v)) / 2, y, { align: 'center', size: 11, color: '#fff', weight: 600 }); x0 += v; });
      c.text(`${f1(x0, 1)} dB`, c.X(x0) + 6, y, { size: 12, weight: 600 }); });
    c.legend(['Cable 1 m', 'Surge arrestor', 'Cable 10 m', 'Connectors'].map((l, j) => ({ label: l, color: [th.sig, th.sand, th.sig2, th.amber][j], fill: true })), c.px0 + 8, c.py0 - 12); }));
  // telemetry radio comparison on TTA links
  const extra = [['ps1', 'sr3', 20, 22], ['ps4', 'sr3', 3, 22], ['eng', 'wwtp', 12, 50]];
  const pairs = [...REGISTER.links.filter(l => l.status !== 'not_feasible').filter(l => !samePair({ a: 'eng', b: 'sr3' }, l.a, l.b) && !samePair({ a: 'sr3', b: 'wwtp' }, l.a, l.b)).map(l => [l.a, l.b, l.hA, l.hB, l]), ...extra.map(e => [...e, null])];
  const kitHop = (kid, a, b, hA, hB, l) => kid === 'rocket' ? { ...mkHop(a, b, l?.antA || 'rd5g30', l?.antB || 'rd5g30', 5785, 20), lossA: 1, lossB: 1, mountA: hA, mountB: hB }
    : { ...mkHop(a, b, RF.KITS[kid].ant, RF.KITS[kid].ant, RF.KITS[kid].fc, RF.KITS[kid].bw, RF.KITS[kid].radio), lossA: RF.kitLoss(kid, RF.KITS[kid].fc), lossB: RF.kitLoss(kid, RF.KITS[kid].fc), mountA: hA, mountB: hB };
  const TL = h('table', { class: 't' }, h('tr', {}, h('th', {}, 'Path'), h('th', {}, 'Antennas m'), ...['Rocket 5AC, 20 MHz', '245U kit, 20 MHz', '415U kit, 25 kHz'].map(t => h('th', {}, t))));
  for (const [a, b, hA, hB, l] of pairs) {
    const cell = kid => { const L = RF.analyzeLink(kitHop(kid, a, b, hA, hB, l), CTX), ok = L.design.cap.agg > 0;
      return h('td', { title: `Diffraction ${f1(L.diff.L, 1)} dB, RSL ${fm(Math.max(...L.ab.rsl))} dBm` }, h('span', { class: 'chip ' + (ok ? 'pass' : L.clear.cap.agg > 0 ? 'warn' : 'fail') }, ok ? fMb(L.design.cap.agg) : L.clear.cap.agg > 0 ? 'below margin' : `fails, −${f1(L.diff.L, 0)} dB diffr.`)); };
    TL.append(h('tr', {}, h('td', {}, `${shortName(a)} ⇄ ${shortName(b)}${l ? '' : ' (direct, not in TTA plan)'}`), h('td', {}, `${hA} / ${hB}`), cell('rocket'), cell('tab245'), cell('tab415')));
  }
  const tsel = h('select', { class: 'tsel' }, [['rocket', 'Rocket 5AC (TTA basis)'], ['tab245', 'Tabateq ELPRO 245U kit'], ['tab415', 'Tabateq ELPRO 415U UHF kit']].map(([v, t]) => h('option', { value: v, selected: (S.telemKit || 'rocket') === v }, t)));
  tsel.addEventListener('change', () => { S.telemKit = tsel.value; NET3D && (NET3D.static = null); update(); });
  pane.append(h('div', { class: 'card' }, h('h3', {}, 'Telemetry network: which radio fits the pump stations?'), h('p', { class: 'cap' }, 'Capacity at the design margin on every TTA pump-station path, plus three direct paths TTA rejected at 5.8 GHz. UHF diffracts round the escarpment far better, which is what the 415U is for: I/O telemetry, not SCADA backhaul.'),
    h('label', { class: 'f' }, h('span', {}, 'Radio used for the telemetry network on the maps and in Sites & status'), tsel), h('div', { class: 'tw', style: 'margin-top:8px' }, TL)));
  // datasheet comparison
  const rlist = ['r5ac', 'elpro245', 'elpro415', 'lic11'].map(k => RF.RADIOS[k]), fields = Object.keys(rlist[1].spec);
  pane.append(h('div', { class: 'card span2' }, h('h3', {}, 'Datasheet comparison'), h('p', { class: 'cap' }, 'Values transcribed from the uploaded ELPRO datasheets (EL-DS-245U-A1 July 2024, EL-DS-415U-2-Cx Feb 2025) next to the Rev 3 Rocket and the generic licensed option. Modelling assumptions are listed at the bottom.'),
    h('div', { class: 'tw' }, h('table', { class: 't' }, h('tr', {}, h('th', {}, ''), ...rlist.map(r => h('th', { style: 'text-align:left' }, r.model))),
      ...fields.map(f => h('tr', {}, h('td', {}, f), ...rlist.map(r => h('td', { style: 'text-align:left;white-space:normal;min-width:150px' }, r.spec[f] || '—')))),
      h('tr', {}, h('td', {}, 'Modelling note'), ...rlist.map(r => h('td', { style: 'text-align:left;white-space:normal;color:var(--ink-2)' }, r.dataNote || '—')))))));
  // BOM
  const N = nets[S.arch], kid = ARCH_KIT[S.arch] || 'tab245', K = RF.KITS[kid], qty = ARCH_KIT[S.arch] ? N.radios : 1, sub = RF.kitPrice(kid) * qty;
  const BT = h('table', { class: 't' }, h('tr', {}, ...['Code', 'Description', 'Qty', 'Net each', 'Total'].map(t => h('th', {}, t))),
    ...K.items.map(([c, d, p]) => h('tr', {}, h('td', {}, c), h('td', { style: 'text-align:left;white-space:normal' }, d), h('td', {}, String(qty)), h('td', {}, p.toLocaleString('en-ZA', { minimumFractionDigits: 2 })), h('td', {}, (p * qty).toLocaleString('en-ZA', { minimumFractionDigits: 2 })))),
    h('tr', { class: 'sel' }, h('td', {}, ''), h('td', { style: 'text-align:left' }, 'Sub-total excl. VAT'), h('td', {}, ''), h('td', {}, ''), h('td', {}, 'R ' + sub.toLocaleString('en-ZA', { minimumFractionDigits: 2 }))),
    h('tr', {}, h('td', {}, ''), h('td', { style: 'text-align:left' }, 'VAT 15 % (as quoted)'), h('td', {}, ''), h('td', {}, ''), h('td', {}, 'R ' + (sub * 0.15).toLocaleString('en-ZA', { minimumFractionDigits: 2 }))));
  pane.append(h('div', { class: 'card' }, h('h3', {}, `Bill of materials: ${K.name}`), h('p', { class: 'cap' }, ARCH_KIT[S.arch] ? `${K.quote} prices one end. This design needs ${qty} radio ends, so the quoted kit is multiplied by ${qty}.${S.arch === 'D' ? ' The SR3 end needs a 5 GHz N-type omni instead of the quoted dish: ask Tabateq to add one.' : ''} Excludes masts, panels, power and installation.` : `${K.quote} prices one end. Select a Tabateq system above to size the order for a design.`),
    h('div', { class: 'tw' }, BT), h('ul', { class: 'warns', style: 'margin-top:10px' },
      h('li', {}, `Prices are tied to AUD at R11.90; lead time ${K.leadTime}; quote valid ${K.validity}; payment before dispatch.`),
      h('li', {}, 'The quote refers to ICASA licensing, which is South Africa. These sites are in Botswana: 5 GHz must meet BOCRA limits and UHF needs a BOCRA frequency licence.'),
      h('li', {}, 'Tabateq assumes a reliable radio path between all sites; the path and diffraction results here are the check on that assumption.'))));
}
