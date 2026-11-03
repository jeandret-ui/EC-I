/* =====================================================================
   PLOT — tiny Canvas2D charting for engineering sheets (theme-aware)
   ===================================================================== */
const Plot = (() => {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const T = () => ({ ink: css('--ink'), ink2: css('--ink-2'), ink3: css('--ink-3'), rule: css('--rule'), rule2: css('--rule-2'),
    sand: css('--sand'), sig: css('--signal'), sig2: css('--signal-2'), red: css('--red'), green: css('--green'), amber: css('--amber'),
    panel: css('--panel'), paper: css('--paper'), ui: css('--font-ui'), cond: css('--font-cond'), math: css('--font-math') });
  const alpha = (hex, a) => {
    if (!hex) return `rgba(0,0,0,${a})`;
    if (hex.startsWith('rgb')) return hex.replace(/rgba?\(([^)]+)\)/, (m, s) => `rgba(${s.split(',').slice(0, 3).join(',')},${a})`);
    const h = hex.replace('#', ''), n = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`;
  };
  function nice(min, max, count = 6) {
    if (!(max > min)) { max = min + 1; }
    const span = max - min, step0 = span / count, mag = Math.pow(10, Math.floor(Math.log10(step0)));
    const r = step0 / mag, step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const out = []; for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }
  const fmtTick = (v, step) => { const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); return v.toFixed(Math.min(d, 4)); };
  const all = new Set();
  class Chart {
    constructor(canvas, draw, opts = {}) {
      this.c = canvas; this.draw = draw; this.ctx = canvas.getContext('2d'); this.mouse = null; this.opts = opts; this.data = {};
      this.ro = new ResizeObserver(() => this.resize()); this.ro.observe(canvas);
      canvas.addEventListener('mousemove', e => { const r = canvas.getBoundingClientRect(); this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; this.redraw(); });
      canvas.addEventListener('mouseleave', () => { this.mouse = null; this.redraw(); });
      canvas.addEventListener('click', e => { if (this.onClick) { const r = canvas.getBoundingClientRect(); this.onClick({ x: e.clientX - r.left, y: e.clientY - r.top }, this); } });
      all.add(this);
    }
    resize() {
      const r = this.c.getBoundingClientRect(); if (r.width < 4) return;
      const h = this.opts.aspect ? r.width / this.opts.aspect : (this.opts.height || r.height);
      if (this.opts.aspect || this.opts.height) this.c.style.height = h + 'px';
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      this.w = r.width; this.h = h; this.c.width = Math.round(r.width * dpr); this.c.height = Math.round(h * dpr); this.dpr = dpr; this.redraw();
    }
    redraw() {
      if (!this.w || !this.c.isConnected) return; const g = this.ctx;
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); g.clearRect(0, 0, this.w, this.h); this.th = T();
      try { this.draw(this, g, this.th); } catch (err) { console.error(err); }
    }
    /* frame: margins, scales, grid, axes */
    frame(o) {
      const g = this.ctx, th = this.th, m = Object.assign({ l: 52, r: 14, t: 12, b: 34 }, o.m || {});
      this.m = m; this.px0 = m.l; this.px1 = this.w - m.r; this.py0 = this.h - m.b; this.py1 = m.t;
      this.xlog = !!o.xlog; this.ylog = !!o.ylog; this.xr = o.x; this.yr = o.y; this.xrev = !!o.xrev;
      g.font = `11.5px ${th.ui}`; g.lineWidth = 1;
      const xt = o.xticks || (this.xlog ? logTicks(o.x) : nice(o.x[0], o.x[1], o.nx || Math.max(3, Math.floor((this.px1 - this.px0) / 80))).ticks);
      const yt = o.yticks || (this.ylog ? logTicks(o.y) : nice(o.y[0], o.y[1], o.ny || Math.max(3, Math.floor((this.py0 - this.py1) / 42))).ticks);
      const xs = xt.length > 1 ? Math.abs(xt[1] - xt[0]) : 1, ys = yt.length > 1 ? Math.abs(yt[1] - yt[0]) : 1;
      g.strokeStyle = th.rule2; g.fillStyle = th.ink2;
      g.textAlign = 'center'; g.textBaseline = 'top';
      for (const v of xt) { const x = this.X(v); if (x < this.px0 - 1 || x > this.px1 + 1) continue;
        if (o.grid !== false) { g.beginPath(); g.moveTo(Math.round(x) + .5, this.py1); g.lineTo(Math.round(x) + .5, this.py0); g.stroke(); }
        g.fillText(o.xfmt ? o.xfmt(v) : this.xlog ? logLabel(v) : fmtTick(v, xs), x, this.py0 + 5); }
      g.textAlign = 'right'; g.textBaseline = 'middle';
      for (const v of yt) { const y = this.Y(v); if (y < this.py1 - 1 || y > this.py0 + 1) continue;
        if (o.grid !== false) { g.beginPath(); g.moveTo(this.px0, Math.round(y) + .5); g.lineTo(this.px1, Math.round(y) + .5); g.stroke(); }
        g.fillText(o.yfmt ? o.yfmt(v) : this.ylog ? logLabel(v) : fmtTick(v, ys), this.px0 - 6, y); }
      g.strokeStyle = th.rule; g.strokeRect(this.px0 + .5, this.py1 + .5, this.px1 - this.px0, this.py0 - this.py1);
      g.fillStyle = th.ink2; g.font = `12px ${th.ui}`;
      if (o.xlabel) { g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(o.xlabel, (this.px0 + this.px1) / 2, this.h - 2); }
      if (o.ylabel) { g.save(); g.translate(12, (this.py0 + this.py1) / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(o.ylabel, 0, 0); g.restore(); }
    }
    X(v) { const [a, b] = this.xr; let t = this.xlog ? (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) : (v - a) / (b - a); if (this.xrev) t = 1 - t; return this.px0 + t * (this.px1 - this.px0); }
    Y(v) { const [a, b] = this.yr; const t = this.ylog ? (Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)) : (v - a) / (b - a); return this.py0 - t * (this.py0 - this.py1); }
    ix(px) { let t = (px - this.px0) / (this.px1 - this.px0); if (this.xrev) t = 1 - t; const [a, b] = this.xr; return this.xlog ? Math.pow(10, Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a); }
    iy(py) { const t = (this.py0 - py) / (this.py0 - this.py1), [a, b] = this.yr; return this.ylog ? Math.pow(10, Math.log10(a) + t * (Math.log10(b) - Math.log10(a))) : a + t * (b - a); }
    clip() { const g = this.ctx; g.save(); g.beginPath(); g.rect(this.px0, this.py1, this.px1 - this.px0, this.py0 - this.py1); g.clip(); }
    unclip() { this.ctx.restore(); }
    line(xs, ys, st = {}) {
      const g = this.ctx; g.beginPath(); let pen = false;
      for (let i = 0; i < xs.length; i++) { const y = ys[i]; if (!isFinite(y) || (this.ylog && y <= 0)) { pen = false; continue; }
        const X = this.X(xs[i]), Y = this.Y(y); pen ? g.lineTo(X, Y) : g.moveTo(X, Y); pen = true; }
      g.strokeStyle = st.color || this.th.ink; g.lineWidth = st.width || 1.5; g.setLineDash(st.dash || []); g.lineJoin = 'round'; g.stroke(); g.setLineDash([]);
    }
    area(xs, y0, y1, fill) {
      const g = this.ctx; g.beginPath();
      for (let i = 0; i < xs.length; i++) { const X = this.X(xs[i]), Y = this.Y(typeof y1 === 'number' ? y1 : y1[i]); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      for (let i = xs.length - 1; i >= 0; i--) g.lineTo(this.X(xs[i]), this.Y(typeof y0 === 'number' ? y0 : y0[i]));
      g.closePath(); g.fillStyle = fill; g.fill();
    }
    stairs(xs, ys, st = {}) { const px = [], py = []; for (let i = 0; i < xs.length; i++) { if (i) { px.push(xs[i]); py.push(ys[i - 1]); } px.push(xs[i]); py.push(ys[i]); } this.line(px, py, st); }
    vline(v, st = {}) { const g = this.ctx, x = this.X(v); g.beginPath(); g.moveTo(x, this.py1); g.lineTo(x, this.py0); g.strokeStyle = st.color || this.th.ink3; g.lineWidth = st.width || 1; g.setLineDash(st.dash || [4, 3]); g.stroke(); g.setLineDash([]); if (st.label) this.text(st.label, x + 4, this.py1 + 4, { color: st.color, align: 'left', base: 'top', size: 11 }); }
    hline(v, st = {}) { const g = this.ctx, y = this.Y(v); g.beginPath(); g.moveTo(this.px0, y); g.lineTo(this.px1, y); g.strokeStyle = st.color || this.th.ink3; g.lineWidth = st.width || 1; g.setLineDash(st.dash || [4, 3]); g.stroke(); g.setLineDash([]); if (st.label) this.text(st.label, st.right ? this.px1 - 4 : this.px0 + 4, y - 3, { color: st.color, align: st.right ? 'right' : 'left', base: 'bottom', size: 11 }); }
    text(s, x, y, st = {}) { const g = this.ctx; g.font = `${st.weight || 500} ${st.size || 12}px ${st.font || this.th.ui}`; g.fillStyle = st.color || this.th.ink; g.textAlign = st.align || 'left'; g.textBaseline = st.base || 'middle';
      if (st.halo) { g.lineWidth = 3; g.strokeStyle = alpha(this.th.panel, .85); g.strokeText(s, x, y); } g.fillText(s, x, y); }
    dot(x, y, r, fill, stroke) { const g = this.ctx; g.beginPath(); g.arc(this.X(x), this.Y(y), r, 0, 2 * Math.PI); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = 1.5; g.stroke(); } }
    legend(items, x, y) {
      const g = this.ctx; g.font = `11.5px ${this.th.ui}`; let cx = x ?? this.px0 + 8; const cy = y ?? this.py1 + 10;
      for (const it of items) { g.strokeStyle = it.color; g.fillStyle = it.color; g.lineWidth = it.width || 2; g.setLineDash(it.dash || []);
        if (it.fill) { g.fillRect(cx, cy - 5, 14, 10); } else { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 16, cy); g.stroke(); }
        g.setLineDash([]); g.fillStyle = this.th.ink2; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(it.label, cx + 20, cy); cx += 28 + g.measureText(it.label).width; }
    }
    inPlot(m) { return m && m.x >= this.px0 && m.x <= this.px1 && m.y >= this.py1 && m.y <= this.py0; }
  }
  function logTicks([a, b]) { const out = []; for (let e = Math.floor(Math.log10(a)); e <= Math.ceil(Math.log10(b)); e++) { const v = Math.pow(10, e); if (v >= a * 0.999 && v <= b * 1.001) out.push(v); } return out; }
  function logLabel(v) { const e = Math.round(Math.log10(v)); if (e >= -2 && e <= 3) return String(+v.toPrecision(3)); return '10' + sup(e); }
  const sup = e => String(e).split('').map(c => '⁰¹²³⁴⁵⁶⁷⁸⁹⁻'['0123456789-'.indexOf(c)]).join('');
  /* perceptual signal ramp (dark plum → red → amber → pale) */
  const RAMP = [[45, 30, 70], [96, 44, 104], [155, 52, 96], [205, 82, 70], [232, 138, 52], [242, 196, 84], [247, 238, 186]];
  function ramp(t) { t = Math.max(0, Math.min(1, t)) * (RAMP.length - 1); const i = Math.min(RAMP.length - 2, Math.floor(t)), f = t - i, a = RAMP[i], b = RAMP[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
  const DIVERGE = [[178, 38, 52], [222, 120, 96], [240, 214, 168], [130, 178, 140], [44, 120, 74]];
  function diverge(t) { t = Math.max(0, Math.min(1, t)) * (DIVERGE.length - 1); const i = Math.min(DIVERGE.length - 2, Math.floor(t)), f = t - i, a = DIVERGE[i], b = DIVERGE[i + 1];
    return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]; }
  const redrawAll = () => all.forEach(c => c.c.isConnected && c.redraw());
  return { Chart, nice, css, T, alpha, ramp, diverge, redrawAll, sup };
})();
