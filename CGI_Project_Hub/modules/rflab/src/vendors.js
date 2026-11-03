/* =====================================================================
   EQUIPMENT LIBRARY — vendor systems from datasheets and quotes.
   Edit this file to add vendors; run_all.bat rebuilds the dashboard.
   ===================================================================== */
(() => {
  const dbm = mw => 10 * Math.log10(mw);
  // ---- metadata for the existing generic radios ----
  Object.assign(RF.RADIOS.r5ac, { model: 'Rocket 5AC Prism', vendor: 'Ubiquiti (Rev 3 proposal)', family: 'airMAX ac', port: 1000, supply: [24, 24], supplyNote: '24 V passive PoE', tmax: 70, mounting: 'mast',
    spec: { Frequency: '5150–5875 MHz', 'TX power': 'up to 27 dBm', Sensitivity: '−96 dBm (MCS0) to −65 dBm (MCS9), 20 MHz', 'Data rate': '500+ Mbps TCP (80 MHz)', Ethernet: '10/100/1000', 'Serial / I/O': 'none', Supply: '24 V passive PoE, 8.5 W', Temperature: '−40 to +70 °C', Mounting: 'On the dish, at the mast', Licence: 'Licence-exempt 5 GHz', Source: 'Datasheet values used in Rev 3' } });
  Object.assign(RF.RADIOS.lic11, { model: '11 GHz ODU + IDU', vendor: 'Generic licensed', family: 'licensed microwave', port: 1000, supply: [24, 57], supplyNote: '−48 V or 24 V DC', tmax: 55, mounting: 'mast',
    spec: { Frequency: '10.7–11.7 GHz', 'TX power': '20–26 dBm', Sensitivity: '−87 to −63 dBm (56 MHz)', 'Data rate': 'up to ~400 Mbps per direction', Ethernet: '1 GbE', 'Serial / I/O': 'none', Supply: '−48 V / 24 V, ~45 W', Temperature: 'ODU −33 to +55 °C typical', Mounting: 'ODU on the dish', Licence: 'BOCRA link licence', Source: 'Class-typical figures, not a product' } });

  // ---- ELPRO 245U-E-A1 (datasheet EL-DS-245U-A1, July 2024) ----
  RF.RADIOS.elpro245 = {
    name: 'ELPRO 245U-E-A1 (802.11a, 5 GHz)', short: '245U', model: 'ELPRO 245U-E-A1', vendor: 'Tabateq (ELPRO)', family: 'ELPRO 802.11a',
    duplex: 'TDD', bwRef: 20, bws: [20, 40], ptmpMaxBw: 20, nss: 1, nf: 7, minTx: dbm(15), eff: { ptp: 0.55, ptmp: 0.45 }, latency: { ptp: 3, ptmp: 5 },
    powerW: 6.0, mtbf: 200000, band: [5150, 5825], port: 100, supply: [9, 30], supplyNote: '9–30 V DC', tmax: 60, mounting: 'panel',
    dataNote: 'Datasheet gives −95 dBm at 6 Mbps and −74 dBm at 108 Mbps (40 MHz turbo); intermediate rates and per-rate TX back-off are typical 802.11a values.',
    mcs: [
      { n: '6M', mod: 'BPSK 1/2', tx: 26, sens: -95, phyRef: 6 }, { n: '9M', mod: 'BPSK 3/4', tx: 26, sens: -94, phyRef: 9 },
      { n: '12M', mod: 'QPSK 1/2', tx: 26, sens: -92, phyRef: 12 }, { n: '18M', mod: 'QPSK 3/4', tx: 26, sens: -90, phyRef: 18 },
      { n: '24M', mod: '16QAM 1/2', tx: 26, sens: -87, phyRef: 24 }, { n: '36M', mod: '16QAM 3/4', tx: 25, sens: -84, phyRef: 36 },
      { n: '48M', mod: '64QAM 2/3', tx: 24, sens: -80, phyRef: 48 }, { n: '54M', mod: '64QAM 3/4', tx: 23, sens: -77, phyRef: 54 }],
    phy(m, bw) { return this.mcs[m].phyRef * bw / 20; },
    spec: { Frequency: '5150–5825 MHz (802.11a)', 'TX power': '15–400 mW (11.8–26 dBm)', Sensitivity: '−95 dBm @ 6 Mbps, −74 dBm @ 108 Mbps', 'Data rate': '6–54 Mbps, 108 Mbps turbo (40 MHz)', Ethernet: '10/100 (100BASE-T)',
      'Serial / I/O': 'RS-232, RS-485, 1 DI / 1 DO', Supply: '9–30 V DC, 250 mA @ 24 V TX', Temperature: '−40 to +60 °C', Mounting: 'DIN rail in panel, SMA to coax', Licence: 'Licence-exempt 5 GHz', Source: 'EL-DS-245U-A1, July 2024' },
  };
  // ---- ELPRO 415U-2-C4 (datasheet EL-DS-415U-2-Cx, Feb 2025) ----
  RF.RADIOS.elpro415 = {
    name: 'ELPRO 415U-2-C4 (UHF 400–480 MHz)', short: '415U', model: 'ELPRO 415U-2-C4', vendor: 'Tabateq (ELPRO)', family: 'ELPRO Condor UHF',
    duplex: 'TDD', bwRef: 0.0125, bws: [0.00625, 0.0125, 0.025], ptmpMaxBw: 0.025, nss: 1, nf: 5, minTx: 10, eff: { ptp: 0.9, ptmp: 0.85 }, latency: { ptp: 120, ptmp: 200 },
    powerW: 24, mtbf: 250000, band: [400, 480], port: 100, supply: [10.8, 30], supplyNote: '10.8–30 V DC', tmax: 70, mounting: 'panel',
    dataNote: 'Datasheet sensitivity is quoted for 6.25/12.5/25 kHz without splitting by width; modelled at 12.5 kHz. Rates are raw (no compression); compression can add up to 50 %.',
    mcs: [
      { n: 'QPSK-FEC', mod: 'QPSK-FEC', tx: 36, sens: -116, phyRef: 0.008 }, { n: 'QPSK', mod: 'QPSK', tx: 36, sens: -113, phyRef: 0.016 },
      { n: '16QAM', mod: '16-QAM', tx: 34, sens: -104, phyRef: 0.032 }, { n: '64QAM', mod: '64-QAM', tx: 34, sens: -97, phyRef: 0.048 }],
    phy(m, bw) { return this.mcs[m].phyRef * bw / 0.0125; },
    spec: { Frequency: '400–480 MHz (C4)', 'TX power': '10 mW–10 W; 4 W QPSK, 2.5 W QAM', Sensitivity: '−116 dBm QPSK-FEC to −97 dBm 64-QAM', 'Data rate': '4–96 kbps raw; ~140 kbps typical at 25 kHz', Ethernet: '10/100 auto-MDIX',
      'Serial / I/O': 'RS-232, RS-485, 8 DIO, 4 AI, 2 AO, +24 V loop power', Supply: '10.8–30 V DC, 1.5 A @ 24 V at 10 W', Temperature: '−40 to +70 °C', Mounting: 'DIN rail in panel, SMA to coax', Licence: 'Licensed UHF (BOCRA frequency licence)', Source: 'EL-DS-415U-2-Cx, Feb 2025' },
  };
  // ---- antennas ----
  Object.assign(RF.ANTENNAS, {
    tab30dish: { name: 'Tabateq 30 dBi dish, 5 GHz (UCE-AC-30DBDISH)', type: 'dish', gain: 30, band: [5100, 5900], note: 'Quoted with the 245U kit' },
    tabdipole: { name: 'Tabateq 2 dBi dipole, 440 MHz (UCE-AC-D1-C)', type: 'omni', gain: 2, bwV: 78, band: [400, 480], note: 'Quoted with the 415U kit' },
    omni13n: { name: '5 GHz 13 dBi omni, N-type (generic, not in quote)', type: 'omni', gain: 13, bwV: 7, band: [5100, 5900], note: 'Needed at SR3 to keep the specified omni topology with ELPRO radios' },
    uhfyagi: { name: 'UHF 9 dBi Yagi (generic, not quoted)', type: 'sector', gain: 9, bwH: 60, bwV: 55, band: [400, 480], note: 'Typical directional option for remote UHF ends' },
  });
  // ---- bands ----
  if (!RF.BANDS.some(b => b.id === 'uhf')) RF.BANDS.push({ id: 'uhf', name: '400–480 MHz', lo: 400, hi: 480, cap: null, licensed: true, note: 'Licensed UHF fixed/telemetry. Needs a BOCRA frequency licence; power is set by the licence.' });
  // ---- feeder components (typical attenuation, dB/m at 450 MHz and 5800 MHz) ----
  RF.CABLES = { lmr195: { name: 'LMR-195', db: [0.26, 0.98] }, lmr400: { name: 'LMR-400', db: [0.089, 0.36] }, rg58: { name: 'RG-58', db: [0.33, 1.7] }, rg213: { name: 'RG-213', db: [0.15, 0.75] } };
  RF.cableDb = (c, f) => { const [a, b] = RF.CABLES[c].db, t = (Math.log(f) - Math.log(450)) / (Math.log(5800) - Math.log(450)); return Math.exp(Math.log(a) + t * (Math.log(b) - Math.log(a))); };
  RF.KITS = {
    tab245: { name: 'Tabateq: ELPRO 245U-E-A1 + 30 dBi dish', radio: 'elpro245', ant: 'tab30dish', fc: 5785, bw: 20, quote: 'Tabateq QS8044, 1 Oct 2026', leadTime: '4–6 weeks', validity: '14 days',
      chain: [['cable', 'lmr195', 1], ['arrestor'], ['cable', 'lmr400', 10]], connectors: 4,
      items: [['UCE-245U-E-A', 'ELPRO 245U-E-A Ethernet modem, 5 GHz, 400 mW', 16520.40], ['UCE-AC-CC-01C', '1 m LMR195 SMA(M)–N(M)', 702.00], ['UCE-LP-RFSA', 'Inline RF surge arrestor N(F)–N(F)', 1420.20],
        ['UCE-AC-CC-10LMR', '10 m LMR400 N(M)–N(M)', 2173.50], ['UCE-AC-30DBDISH', '30 dBi dish antenna, 5 GHz', 5906.70]] },
    tab415: { name: 'Tabateq: ELPRO 415U-2-C4 + 2 dBi dipole', radio: 'elpro415', ant: 'tabdipole', fc: 450, bw: 0.025, quote: 'Tabateq QS8044, 1 Oct 2026', leadTime: '4–6 weeks', validity: '14 days',
      chain: [['cable', 'rg58', 1], ['arrestor'], ['cable', 'rg213', 10]], connectors: 4,
      items: [['UCE-415U-2-C4', 'ELPRO 415U-2-C4 I/O gateway, 400–480 MHz, 10 mW–10 W', 39627.90], ['UCE-AC-CC-01B', '1 m RG58 SMA(M)–N(M)', 421.20], ['UCE-LP-RFSA', 'Inline RF surge arrestor N(F)–N(F)', 1420.20],
        ['UCE-AC-CC-10B', '10 m RG213 N(M)–N(M)', 1582.20], ['UCE-AC-D1-C', '2 dBi dipole, N(F), 440 MHz', 4456.80], ['UCE-AB-WM3AL', 'Wall and pole bracket', 439.20]] },
  };
  RF.kitBreakdown = (k, f) => { const K = RF.KITS[k], out = [];
    for (const c of K.chain) out.push(c[0] === 'cable' ? [`${c[2]} m ${RF.CABLES[c[1]].name}`, RF.cableDb(c[1], f) * c[2]] : ['Surge arrestor', f < 1000 ? 0.2 : 0.4]);
    out.push([`${K.connectors} N/SMA connectors`, K.connectors * (f < 1000 ? 0.05 : 0.1)]); return out; };
  RF.kitLoss = (k, f) => RF.kitBreakdown(k, f).reduce((s, x) => s + x[1], 0);
  RF.kitPrice = k => RF.KITS[k].items.reduce((s, x) => s + x[2], 0);
})();
